import { ForbiddenException, Injectable } from '@nestjs/common';
import type { CanActivate, ExecutionContext } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request } from 'express';

// 必须放在SessionGuard之后：只比较经过服务端认证的UUID，不接受账号、请求体或前端角色。
// 未配置站主时拒绝所有人；普通登录用户永远不能自行提升权限。
@Injectable()
export class SiteOwnerGuard implements CanActivate {
  constructor(private readonly config: ConfigService) {}
  canActivate(context: ExecutionContext): boolean {
    const ownerId = this.config.get<string>('SITE_OWNER_USER_ID')?.trim();
    if (!ownerId) throw new ForbiddenException({ message: '尚未配置站主管理权限', code: 'SITE_OWNER_NOT_CONFIGURED' });
    const request = context.switchToHttp().getRequest<Request>();
    if (request.authUser?.id !== ownerId) throw new ForbiddenException({ message: '仅站主可以管理官网', code: 'SITE_OWNER_REQUIRED' });
    return true;
  }
}
