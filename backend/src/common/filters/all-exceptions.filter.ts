import { Catch, HttpException, HttpStatus, Logger } from '@nestjs/common';
import type { ArgumentsHost, ExceptionFilter } from '@nestjs/common';
import type { Request, Response } from 'express';
import { randomUUID } from 'node:crypto';

// @Catch() 不指定异常类型，接住当前 HTTP 请求中未被处理的异常。
// 如果写成 @Catch(HttpException)，就只处理 HttpException 及其子类。
// 全局作用范围由 AppModule 中的 APP_FILTER 注册决定。
@Catch()
export class AllExceptionsFilter implements ExceptionFilter<unknown> {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  // ExceptionFilter 接口要求提供 catch 方法；Nest 在匹配到异常时调用它。
  // exception 是本次异常；host 用来取得发生异常的请求、响应等上下文。
  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const request = ctx.getRequest<Request>();
    const response = ctx.getResponse<Response>();

    // 通常复用 RequestLoggerMiddleware 写入的编号，串起中间件、守卫和异常日志。
    // 不存在的路由等请求可能没经过该中间件，因此在这里补一个编号。
    const existingRequestId = response.getHeader('X-Request-Id');
    const requestId = typeof existingRequestId === 'string' ? existingRequestId : randomUUID();

    // HttpException 携带明确的 HTTP 状态码，例如 400、403、404，保持原值。
    // 普通 Error 等未知异常统一响应 500，不将内部错误详情发送给前端。
    const status = exception instanceof HttpException
      ? exception.getStatus()
      : HttpStatus.INTERNAL_SERVER_ERROR;
    const originalBody = exception instanceof HttpException
      ? exception.getResponse()
      : { message: 'Internal server error' };

    // HttpException 的响应可以是字符串或对象：字符串转成 message，对象保留原字段。
    // 因此 ValidationPipe 返回的 message 数组也会保留，前端原来的错误处理仍然适用。
    const body = typeof originalBody === 'string' ? { message: originalBody } : originalBody;
    const summary = `[${requestId}] 异常响应 ${request.method} ${request.originalUrl} ${status}`;

    if (status >= HttpStatus.INTERNAL_SERVER_ERROR) {
      // 服务器内部错误的堆栈只记录在后端，方便定位具体出错位置。
      this.logger.error(summary, exception instanceof Error ? exception.stack : undefined);
    } else {
      this.logger.warn(summary);
    }

    // 如果响应已经开始发送，就不能再次设置状态码、响应头或发送另一份 JSON。
    if (response.headersSent) {
      response.end();
      return;
    }

    // 同时写入响应头和响应体，客户端可以用同一个编号查询后端日志。
    response.setHeader('X-Request-Id', requestId);
    response.status(status).json({
      ...body,
      statusCode: status,
      // originalUrl 包含全局 /api 前缀以及查询参数，记录客户端实际请求的地址。
      path: request.originalUrl,
      requestId,
    });
  }
}
