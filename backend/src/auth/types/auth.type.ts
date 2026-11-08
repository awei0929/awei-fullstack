import type { User } from '../../users/types/user.type.js';

// 同一种响应形状用于恢复和登录；游客以 user:null 明确表示，仍可持有 CSRF 令牌。
export interface SessionView { user: User | null; csrfToken: string }

// 声明合并：为第三方 SessionData 补充本项目字段，让读取/写入会话有类型提示。
// 这里只扩展 TypeScript 类型；实际字段由 AuthService 写入并由 connect-mongo 持久化。
declare module 'express-session' {
  interface SessionData {
    // 匿名会话没有 userId，登录成功后才写入用户公开 UUID。
    userId?: string;
    csrfToken?: string;
    // 毫秒时间戳，表示固定绝对有效期；不能随每次请求向后延长。
    authExpiresAt?: number;
  }
}

// 扩展 Express 请求类型，承载 SessionGuard 已核验的用户；Controller 不再自行重复查身份。
declare global {
  namespace Express {
    interface Request { authUser?: User }
  }
}
