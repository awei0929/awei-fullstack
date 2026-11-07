import { ForbiddenException, Injectable } from '@nestjs/common';
import type { CanActivate, ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';
import { timingSafeEqual } from 'node:crypto';

// CSRF 令牌同时存在于服务端会话和请求头；攻击网站即使让浏览器带上 Cookie，
// 也必须知道该会话的随机令牌才能发起写操作。SameSite Cookie 不能替代这一步。
@Injectable()
export class CsrfGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    const expected = request.session.csrfToken;
    const received = request.get('X-CSRF-Token');
    if (!expected || !received) throw new ForbiddenException('CSRF令牌无效');
    // timingSafeEqual 在长度相等时以恒定时间比较内容，避免普通字符串比较的提前退出差异。
    // 此 API 要求 Buffer 长度相同，因此先检查长度；令牌内容不会进入错误响应。
    const a = Buffer.from(expected), b = Buffer.from(received);
    if (a.length !== b.length || !timingSafeEqual(a, b)) throw new ForbiddenException('CSRF令牌无效');
    return true;
  }
}
