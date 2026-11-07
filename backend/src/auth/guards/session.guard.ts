import { Injectable, UnauthorizedException } from '@nestjs/common';
import type { CanActivate, ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';
import { AuthService } from '../auth.service.js';

// Guard 是 Controller 执行前的访问关卡；@Injectable 使其可以通过依赖注入复用 AuthService。
// 任务 Controller 的类级 SessionGuard 先执行，写方法的 CsrfGuard 随后执行，最后才校验 DTO。
@Injectable()
export class SessionGuard implements CanActivate {
  constructor(private readonly auth: AuthService) {}
  async canActivate(context: ExecutionContext): Promise<boolean> {
    // ExecutionContext 可支持不同传输方式；这里明确切换到 HTTP，读取当前请求。
    const request = context.switchToHttp().getRequest<Request>();
    const user = await this.auth.currentUser(request);
    if (!user) throw new UnauthorizedException('请先登录');
    // 只把验证后的公开用户信息交给 Controller；ownerId 从这里取得，不接受客户端指定。
    request.authUser = user;
    return true;
  }
}
