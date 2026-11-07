import { ConflictException, Injectable, UnauthorizedException } from '@nestjs/common';
import type { OnModuleInit } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import type { Model } from 'mongoose';
import { argon2id, hash, verify } from 'argon2';
import { randomBytes } from 'node:crypto';
import { UserRecord } from './schemas/user.schema.js';
import type { User, UserCredentials } from './types/user.type.js';

// Argon2id 是带盐的单向密码哈希；内存参数单位为 KiB，时间参数控制迭代次数。
// 库自动生成随机盐并把算法/参数/盐写入结果；验证时无需另外保存明文密码或盐字段。
const hashOptions = { type: argon2id, memoryCost: 19456, timeCost: 2, parallelism: 1 } as const;

// 用户业务服务通过模型访问数据库，并把持久化文档转换成安全的公开用户信息。
// 输入依赖用户模块自己的纯类型，不引用认证 DTO 或 Session；HTTP 校验由调用方的 DTO 承担。
@Injectable()
export class UsersService implements OnModuleInit {
  // 用随机内容预生成同参数哈希，供“账号不存在”的登录路径使用，避免明显的快速返回差异。
  private dummyHash: string;
  // @InjectModel 使用 UsersModule 中 MongooseModule.forFeature 注册的模型令牌；Model 是整个 users 集合的操作入口。
  constructor(@InjectModel(UserRecord.name) private readonly users: Model<UserRecord>) {}

  // 生命周期钩子由 Nest 在启动阶段调用，HTTP 服务开始处理请求前会等待它完成。
  async onModuleInit(): Promise<void> {
    // init 等待模型索引就绪；unique 是数据库约束，并非先查一次账号就能替代的逻辑。
    await this.users.init();
    this.dummyHash = await hash(randomBytes(32), hashOptions);
  }

  // 先计算哈希再保存；不先查重后插入，因为两个并发请求可能同时查到“尚不存在”。
  async register(input: UserCredentials): Promise<User> {
    const passwordHash = await hash(input.password, hashOptions);
    try {
      const user = await this.users.create({ account: input.account, passwordHash });
      return this.toUser(user);
    } catch (error) {
      // MongoDB 唯一索引冲突码 11000 映射为 HTTP 409；其他存储故障不能误报成重名。
      if (typeof error === 'object' && error !== null && 'code' in error && error.code === 11000) {
        throw new ConflictException('账号已注册');
      }
      throw error;
    }
  }

  // lean 返回普通对象，适合只读查询；verify 从已保存哈希中读取参数和盐并验证原始密码。
  async login(input: UserCredentials): Promise<User> {
    const record = await this.users.findOne({ account: input.account }).lean().exec();
    // 不存在的账号也验证同参数哈希，避免明显的快速失败分支。
    const valid = await verify(record?.passwordHash ?? this.dummyHash, input.password);
    // 不区分“账号不存在”和“密码错误”，对外保持同一条凭据错误信息。
    if (!record || !valid) throw new UnauthorizedException('账号或密码错误');
    return this.toUser(record);
  }

  // 会话恢复只需要 id/account：查询时明确投影，不取出密码哈希。
  async findById(id: string): Promise<User | null> {
    const record = await this.users.findOne({ id }).select({ id: 1, account: 1 }).lean().exec();
    return record ? this.toUser(record) : null;
  }

  // 显式构造响应对象，而不是直接返回数据库文档，防止未来新增内部字段意外泄漏。
  private toUser(record: Pick<UserRecord, 'id' | 'account'>): User {
    return { id: record.id, account: record.account };
  }
}
