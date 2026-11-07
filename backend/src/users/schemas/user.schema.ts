import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { randomUUID } from 'node:crypto';

// Schema 定义数据库存储结构，DTO 定义 HTTP 输入规则，公开 User 定义返回形状，三者职责不同。
// timestamps 自动维护创建/更新时间；关闭默认 id 虚拟字段，使用下方明确声明的 UUID。
@Schema({ collection: 'users', timestamps: true, versionKey: false, id: false })
export class UserRecord {
  // 对外 UUID 与 MongoDB 内部 _id 分离；唯一索引防止重复，immutable 禁止通过模型更新身份标识。
  @Prop({ type: String, required: true, unique: true, immutable: true, default: () => randomUUID() })
  id!: string;

  // account 的唯一索引负责并发注册排他；字符串类型保留前导零，match 与 DTO 统一限制为3–5位数字。
  @Prop({ type: String, required: true, unique: true, immutable: true, match: /^[0-9]{3,5}$/ })
  account!: string;

  // 仅保存不可逆的 Argon2id 哈希；此字段不会进入公开用户响应。
  @Prop({ type: String, required: true })
  passwordHash!: string;

  // 实际值由 timestamps 维护，这里补充 TypeScript 类型声明。
  createdAt!: Date;
  updatedAt!: Date;
}
// 将类上的 @Schema/@Prop 元数据转换成 Mongoose Schema，再交由模块注册模型。
export const UserRecordSchema = SchemaFactory.createForClass(UserRecord);
