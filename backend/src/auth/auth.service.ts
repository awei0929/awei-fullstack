import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request } from 'express';
import { randomBytes } from 'node:crypto';
import { UsersService } from '../users/users.service.js';
import { sessionDuration } from './config/auth.config.js';
import type { SessionView } from './types/auth.type.js';
import type { User } from '../users/types/user.type.js';

// AuthService 管理会话状态；UsersService 管理用户与密码，两者职责分开。
// 运行时需要注入的服务使用普通 import，Request/SessionView 等纯类型使用 import type。
@Injectable()
export class AuthService {
  // Nest 根据构造参数类型注入用户服务与全局 ConfigService，无需在业务方法里 new。
  constructor(private readonly users: UsersService, private readonly config: ConfigService) {}

  // Cookie 能找到会话不等于身份仍有效；每次访问都验证绝对期限，并确认用户仍存在。
  // MongoDB 的 TTL 删除是后台清理，可能延迟，不能把它当成身份过期判断。
  async currentUser(request: Request): Promise<User | null> {
    const { userId, authExpiresAt } = request.session;
    if (!userId || !authExpiresAt || authExpiresAt <= Date.now()) return null;
    return this.users.findById(userId);
  }

  // 恢复有效身份；过期或已删除的用户会轮换成新的匿名会话。
  // 首次游客访问也保存随机令牌，后续登录/注册才能通过 CSRF 校验。
  async session(request: Request): Promise<SessionView> {
    const user = await this.currentUser(request);
    if (request.session.userId && !user) await this.regenerate(request);
    if (!request.session.csrfToken) {
      request.session.csrfToken = this.token();
      await this.save(request);
    }
    // 有效会话只读，不主动调用 save；结合 resave:false 与不补建记录的 store.touch，
    // 退出时尚未完成的旧读取不会重新保存已被删除的会话。
    return { user, csrfToken: request.session.csrfToken! };
  }

  // 注册/登录成功后重新生成 Session ID，防止沿用登录前已知的匿名 ID（会话固定攻击）。
  // 同时轮换 CSRF 令牌；浏览器 Cookie 只保存签名后的 ID，用户身份保存在 MongoDB 会话中。
  async establish(request: Request, user: User): Promise<SessionView> {
    await this.regenerate(request);
    const duration = sessionDuration(this.config);
    request.session.userId = user.id;
    request.session.csrfToken = this.token();
    // authExpiresAt 是服务端身份截止时间；普通请求不会刷新它，避免形成滑动有效期。
    // Cookie 的 maxAge 控制浏览器保留期限，不能替代上面的服务端期限校验。
    request.session.authExpiresAt = Date.now() + duration;
    request.session.cookie.maxAge = duration;
    // 必须等存储确认成功再返回登录结果；失败时不能仅依赖响应结束时的自动保存。
    await this.save(request);
    return { user, csrfToken: request.session.csrfToken };
  }

  // express-session 使用回调 API；包装成 Promise 后，Controller 才能等待销毁结果并传播故障。
  async logout(request: Request): Promise<void> {
    await new Promise<void>((resolve, reject) => request.session.destroy(error => error ? reject(error) : resolve()));
  }

  // regenerate 会销毁旧会话并为当前请求建立新 ID；新会话仍需显式填充和保存数据。
  private regenerate(request: Request): Promise<void> {
    return new Promise((resolve, reject) => request.session.regenerate(error => error ? reject(error) : resolve()));
  }

  // 显式保存统一走这里，让登录与匿名令牌初始化共享失败清理逻辑。
  private async save(request: Request): Promise<void> {
    try {
      await new Promise<void>((resolve, reject) => request.session.save(error => error ? reject(error) : resolve()));
    } catch (error) {
      // destroy 会先同步移除 request.session，防止 express-session 在 500 响应结束时
      // 再次自动保存并发送 Cookie；写入实际成功但确认回调失败时，也要撤销新会话 ID。
      try { await this.logout(request); }
      catch {
        // 数据库持续故障时删除可能失败，但 request.session 已移除，不会发送该新会话 ID。
        // 保留最初的保存错误，交给全局异常过滤器处理。
      }
      throw error;
    }
  }

  // 使用密码学安全随机源生成 32 字节令牌，十六进制编码便于通过请求头传输。
  private token(): string { return randomBytes(32).toString('hex'); }
}
