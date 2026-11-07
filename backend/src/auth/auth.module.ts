import { Module } from '@nestjs/common';
import { UsersModule } from '../users/users.module.js';
import { AuthService } from './auth.service.js';
import { AuthController } from './auth.controller.js';
import { SessionGuard } from './guards/session.guard.js';
import { CsrfGuard } from './guards/csrf.guard.js';
import { AuthRateLimitGuard } from './guards/auth-rate-limit.guard.js';

// AuthModule 负责认证 HTTP 入口、Session 生命周期与认证守卫；用户存储属于 UsersModule。
@Module({
  // 导入 UsersModule 后可注入它导出的 UsersService，不在认证模块重复注册服务或用户模型。
  // 依赖方向只有 AuthModule → UsersModule，用户模块无需知道 Session、Guard 或认证 DTO。
  imports: [UsersModule],
  // controllers 登记 HTTP 路由入口；仅把类写进文件不会自动注册路由。
  controllers: [AuthController],
  // providers 由 Nest 创建并管理；默认在各自注册范围内为单例，导出服务可由导入方复用。
  // @UseGuards 传入守卫类时，Nest还会在使用方模块上下文管理守卫，不代表所有模块共用一个守卫对象。
  providers: [AuthService, SessionGuard, CsrfGuard, AuthRateLimitGuard],
  // 任务/统计模块导入 AuthModule 后复用认证能力，无需重复注册 AuthService。
  // 登录限流守卫只供本模块的认证入口使用；UsersService 由 UsersModule 独立管理。
  exports: [AuthService, SessionGuard, CsrfGuard],
})
export class AuthModule {}
