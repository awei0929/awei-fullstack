import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { randomUUID } from 'node:crypto';

// 单条轮次内嵌在会话文档里：用户消息与助手回复始终成对出现，读取历史时不需要再跨集合拼接。
// 公开对话只存匿名 visitor 的哈希，不存原始浏览器标识，避免把可关联 ID 直接落库。
@Schema({ _id: false })
export class SiteChatTurnRecord {
  @Prop({ type: String, required: true }) requestId!: string;
  @Prop({ type: String, required: true }) content!: string;
  @Prop({ type: String, default: '' }) answer!: string;
  @Prop({ type: String, required: true, enum: ['streaming', 'completed', 'failed', 'canceled'] }) status!: 'streaming' | 'completed' | 'failed' | 'canceled';
  @Prop({ type: String, required: true }) modelId!: string;
  @Prop({ type: String, default: null }) error!: string | null;
  @Prop({ type: Date, required: true }) createdAt!: Date;
  @Prop({ type: Date, required: true }) updatedAt!: Date;
}
const SiteChatTurnSchema = SchemaFactory.createForClass(SiteChatTurnRecord);

// id 由应用生成而不是 Mongo _id，便于公开接口与前端路由直接使用稳定 UUID。
@Schema({ collection: 'site_chat_conversations', timestamps: true, versionKey: false, id: false })
export class SiteChatConversationRecord {
  @Prop({ type: String, default: () => randomUUID(), immutable: true }) id!: string;
  @Prop({ type: String, required: true }) visitorHash!: string;
  @Prop({ type: String, default: '新对话' }) title!: string;
  @Prop({ type: [SiteChatTurnSchema], default: [] }) turns!: SiteChatTurnRecord[];
  // active/activeUntil 构成单文档锁：同一会话在锁有效期内只允许一个流。
  @Prop({ type: Boolean, default: false }) active!: boolean;
  @Prop({ type: Date, default: null }) activeUntil!: Date | null;
  @Prop({ type: Date, required: true }) expiresAt!: Date;
  createdAt!: Date;
  updatedAt!: Date;
}

export const SiteChatConversationSchema = SchemaFactory.createForClass(SiteChatConversationRecord);
SiteChatConversationSchema.index({ visitorHash: 1, updatedAt: -1 });
SiteChatConversationSchema.index({ id: 1 }, { unique: true });
// TTL 索引由 Mongo 按 expiresAt 清理匿名历史，业务层不需要定时任务。
SiteChatConversationSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
