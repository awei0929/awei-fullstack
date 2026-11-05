import { Injectable, Logger } from '@nestjs/common';
import type { NestMiddleware } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';
import { randomUUID } from 'node:crypto';

// @Injectable 标记这个类可以由 Nest 创建，也可以通过构造函数注入其他服务。
// implements NestMiddleware 是 TypeScript 的接口约束，要求这个类提供 use 方法。
// 中间件绑定在哪些接口上，由 AppModule.configure 中的 forRoutes 决定。
@Injectable()
export class RequestLoggerMiddleware implements NestMiddleware {
  private readonly logger = new Logger(RequestLoggerMiddleware.name);

  // req：本次请求，例如请求方法、URL、请求头、请求体。
  // res：本次响应，可以设置响应头，也可以直接发送响应。
  // next：把控制权交给后续处理流程；它不是 Controller 的业务返回值。
  use(req: Request, res: Response, next: NextFunction): void {
    const requestId = randomUUID();
    const startedAt = Date.now();
    const { method, originalUrl } = req;

    // 能力一：读取请求信息。使用同一个请求编号关联开始和结束两条日志。
    this.logger.log(`[${requestId}] 请求开始 ${method} ${originalUrl}`);

    // 能力二：修改响应。前端或 curl 可以从响应头中看到这个请求编号。
    res.setHeader('X-Request-Id', requestId);

    // 能力三：监听响应完成。此时才能得到最终状态码和本次处理耗时。
    // 这里只观察响应，不修改 Controller 返回的任务数据。
    res.once('finish', () => {
      const durationMs = Date.now() - startedAt;
      this.logger.log(
        `[${requestId}] 请求结束 ${method} ${originalUrl} ${res.statusCode} ${durationMs}ms`,
      );
    });

    // 能力四：放行请求，让它继续进入守卫、管道和 Controller 等后续流程。
    // 如果既不调用 next()，也不通过 res 发送响应，请求就会一直等待。
    // next() 不会等待整个业务完成，所以结束日志使用上面的 finish 事件。
    next();
  }
}
