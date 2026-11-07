import { Body, Controller, Get, HttpCode, Post, Req, Res, SetMetadata, UseGuards } from '@nestjs/common';
import type { Request, Response } from 'express';
import { ConfigService } from '@nestjs/config';
import { CredentialsDto } from './dto/credentials.dto.js';
import { AuthService } from './auth.service.js';
import { UsersService } from '../users/users.service.js';
import { CsrfGuard } from './guards/csrf.guard.js';
import { ACCOUNT_RATE_LIMIT, AuthRateLimitGuard } from './guards/auth-rate-limit.guard.js';
import type { SessionView } from './types/auth.type.js';

// Controller 只编排 HTTP 输入和响应；密码校验、用户持久化与会话生命周期交给服务。
// 全局前缀在 configureApp 中配置，因此这里对应 /api/auth。
@Controller('auth')
export class AuthController {
  // 构造参数由 Nest 容器注入：AuthService 来自本模块 providers，
  // UsersService 由导入的 UsersModule 导出，ConfigService 来自全局 ConfigModule。
  constructor(private readonly auth: AuthService, private readonly users: UsersService, private readonly config: ConfigService) {}

  // @Req 取得当前请求，session 由前置 express-session 中间件挂载。
  // 游客也能调用此接口，先取得绑定匿名会话的 CSRF 令牌，再提交注册或登录。
  @Get('session')
  session(@Req() request: Request): Promise<SessionView> { return this.auth.session(request); }

  // POST 默认成功状态为 201。守卫先按声明顺序验证 CSRF、限流，
  // 放行后全局 ValidationPipe 才验证 @Body 的 DTO，最后执行方法。
  @Post('register')
  @UseGuards(CsrfGuard, AuthRateLimitGuard)
  async register(@Req() request: Request, @Body() input: CredentialsDto): Promise<SessionView> {
    // 等用户创建成功后才建立登录会话；重复账号等错误不会进入会话建立步骤。
    return this.auth.establish(request, await this.users.register(input));
  }

  // 使用处理器元数据标记账号限流，而不根据请求 URL 文本判断。
  // Express 接受大小写或尾斜杠别名，这些请求仍必须共享同一账号计数。
  @Post('login')
  @SetMetadata(ACCOUNT_RATE_LIMIT, true)
  // 登录沿用 POST，但成功不是创建资源，所以显式返回 200。
  @HttpCode(200)
  @UseGuards(CsrfGuard, AuthRateLimitGuard)
  async login(@Req() request: Request, @Body() input: CredentialsDto): Promise<SessionView> {
    return this.auth.establish(request, await this.users.login(input));
  }

  // 退出也会改变认证状态，必须验证 CSRF；不能只依赖浏览器自动携带 Cookie。
  @Post('logout')
  @HttpCode(200)
  @UseGuards(CsrfGuard)
  async logout(@Req() request: Request, @Res({ passthrough: true }) response: Response): Promise<{ success: true }> {
    // passthrough 允许设置 Cookie 响应头，同时仍由 Nest 序列化返回值。
    // 先确认服务端会话销毁成功，再清除浏览器 Cookie；存储失败会走全局异常过滤器。
    await this.auth.logout(request);
    response.clearCookie('nest.sid', { path: '/', httpOnly: true, sameSite: 'lax', secure: this.config.get('NODE_ENV') === 'production' });
    return { success: true };
  }
}
