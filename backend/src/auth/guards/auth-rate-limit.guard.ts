import { HttpException, Injectable } from '@nestjs/common';
import type { CanActivate, ExecutionContext, OnModuleInit } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { InjectConnection } from '@nestjs/mongoose';
import type { Connection } from 'mongoose';
import type { Request, Response } from 'express';
import { createHash } from 'node:crypto';
import { positiveInteger } from '../config/auth.config.js';

// Controller 用 SetMetadata 标记哪些处理器需要额外的账号限流，Guard 用 Reflector 读取。
// 标记绑定到处理器，不受 URL 大小写或尾斜杠别名影响。
export const ACCOUNT_RATE_LIMIT = 'auth:account-rate-limit';

// 每个 IP/账号对应一个窗口计数文档；这里只描述驱动返回值类型，不是 Mongoose Schema。
interface Counter { _id: string; count: number; expiresAt: Date }

// 计数保存在共享 MongoDB 中，多进程和重启都使用同一限流状态，而不是进程内 Map。
@Injectable()
export class AuthRateLimitGuard implements CanActivate, OnModuleInit {
  // @InjectConnection 指定数据库连接注入令牌，复用应用已有的 Mongoose 连接。
  // Connection 是纯类型导入；实际注入依靠装饰器，不依赖运行时 Connection 类。
  constructor(@InjectConnection() private readonly connection: Connection, private readonly config: ConfigService, private readonly reflector: Reflector) {}

  // Nest 在模块初始化时等待此钩子，确保开始接收请求前已建立过期清理索引。
  // expireAfterSeconds:0 表示 expiresAt 到期后可删除；TTL 清理有延迟，窗口逻辑仍需自行判断。
  async onModuleInit(): Promise<void> {
    await this.connection.collection<Counter>('auth_rate_limits').createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 });
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const http = context.switchToHttp();
    const request = http.getRequest<Request>();
    const response = http.getResponse<Response>();
    // 通过 CSRF 守卫的登录/注册尝试共享 IP 额度，之后的 DTO 校验失败也会计数。
    // request.ip 由 Express 的 trust proxy 配置决定，默认不信任任意 X-Forwarded-For。
    await this.consume(`ip:${request.ip}`, positiveInteger(this.config, 'AUTH_IP_LIMIT', 30), response);
    // Guard 在 DTO 管道之前执行，此时请求体仍是不可信输入，必须先检查账号类型和格式。
    // 只有标记为登录的处理器才额外消费账号额度；注册受上面的 IP 总额度限制。
    const account: unknown = request.body?.account;
    if (this.reflector.get<boolean>(ACCOUNT_RATE_LIMIT, context.getHandler()) && typeof account === 'string' && /^[0-9]{3,5}$/.test(account)) {
      await this.consume(`account:${account}`, positiveInteger(this.config, 'AUTH_ACCOUNT_LIMIT', 10), response);
    }
    return true;
  }

  // 每次请求占用一次额度；先原子增加，再按返回的新值决定是否超过阈值。
  private async consume(key: string, limit: number, response: Response): Promise<void> {
    const now = new Date();
    const windowMs = positiveInteger(this.config, 'AUTH_RATE_WINDOW_MS', 15 * 60 * 1000);
    const collection = this.connection.collection<Counter>('auth_rate_limits');
    // 哈希只用于生成固定长度的计数键，IP 与账号前缀防止两类键混淆；这不是密码哈希。
    const id = createHash('sha256').update(key).digest('hex');
    // 聚合更新管道在同一文档内原子判断窗口并递增，避免先读后写造成并发丢失计数。
    // $expiresAt 代表文档字段；$ifNull 将首次创建时缺失的时间视为已过期；$lte 比较截止时间。
    const expired = { $lte: [{ $ifNull: ['$expiresAt', new Date(0)] }, now] };
    // $cond 按窗口是否过期选择分支：过期则计数重置为 1 并建立新窗口，
    // 未过期则用 $add 加 1 并保留原截止时间。两个字段都依据本次更新前的文档计算。
    const update = [{ $set: {
      count: { $cond: [expired, 1, { $add: ['$count', 1] }] },
      expiresAt: { $cond: [expired, new Date(now.getTime() + windowMs), '$expiresAt'] },
    } }];
    // upsert 在没有文档时创建；returnDocument:after 返回原子更新后的值，便于准确判断阈值。
    const increment = () => collection.findOneAndUpdate({ _id: id }, update, { upsert: true, returnDocument: 'after' });
    let counter;
    try { counter = await increment(); }
    catch (error) {
      // 多个请求同时创建同一个键时，唯一 _id 索引可能让其中一个插入报 11000。
      // 此时重试会更新已创建的文档；其他数据库错误仍原样抛出，不能伪装限流成功。
      if (typeof error !== 'object' || error === null || !('code' in error) || error.code !== 11000) throw error;
      counter = await increment();
    }
    if (counter && counter.count > limit) {
      // Retry-After 使用剩余秒数并向上取整，客户端可以据此提示等待后重试。
      response.setHeader('Retry-After', Math.max(1, Math.ceil((counter.expiresAt.getTime() - Date.now()) / 1000)));
      throw new HttpException('尝试过于频繁，请稍后重试', 429);
    }
  }
}
