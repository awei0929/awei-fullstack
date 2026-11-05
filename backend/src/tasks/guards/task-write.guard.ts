import { Injectable, Logger } from '@nestjs/common';
import type { CanActivate, ExecutionContext } from '@nestjs/common';
import type { Request, Response } from 'express';

// 公开的学习演示值：用来观察守卫是否放行，后续学习登录时再替换为真实凭证校验。
export const TASK_WRITE_DEMO_KEY = 'awei-learning';

// @Injectable 允许 Nest 管理这个守卫；同时在 TasksModule.providers 中注册。
// implements CanActivate 约束类必须提供 canActivate 方法。
@Injectable()
export class TaskWriteGuard implements CanActivate {
  private readonly logger = new Logger(TaskWriteGuard.name);

  // Nest 在中间件之后、拦截器和管道之前调用此方法。
  // 守卫没有 next 参数：通过返回值告诉 Nest 是否继续处理请求。
  canActivate(context: ExecutionContext): boolean {
    // ExecutionContext 是 Nest 提供的执行上下文，可以取得请求、响应和目标方法。
    const request = context.switchToHttp().getRequest<Request>();
    const response = context.switchToHttp().getResponse<Response>();
    const handler = `${context.getClass().name}.${context.getHandler().name}`;

    // 这个编号由前面执行的日志中间件写入响应头，便于串起同一次请求的日志。
    const requestId = response.getHeader('X-Request-Id');

    // 请求头是 HTTP 输入的一部分；这里仅做演示密钥比对，不处理任务业务。
    const allowed = request.get('X-Learning-Key') === TASK_WRITE_DEMO_KEY;
    this.logger.log(`[${requestId}] 守卫${allowed ? '放行' : '拒绝'} ${handler}`);

    // true：继续进入后续流程；false：Nest 自动抛出 ForbiddenException，默认响应为 403。
    // 被拒绝时不会执行 DTO/路径参数管道，也不会调用 Controller 方法和任务 Service。
    // 如需表达“未登录”等其他错误，也可以主动抛出 UnauthorizedException 等异常。
    return allowed;
  }
}
