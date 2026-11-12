import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { randomUUID } from 'node:crypto';
import type { ChatStatus } from '../types/chat.type.js';

// 有界内嵌轮次与会话锁处于同一文档，受理和终态能使用Mongo单文档原子更新。
@Schema({ _id: false })
export class TurnRecord {
  @Prop({ type: String, required: true }) requestId!: string;
  @Prop({ type: String, required: true }) content!: string;
  @Prop({ type: String, default: '' }) answer!: string;
  @Prop({ type: String, required: true }) modelId!: string;
  @Prop({ type: String, required: true }) modelLabel!: string;
  @Prop({ type: String, required: true, enum: ['streaming', 'completed', 'canceled', 'failed', 'interrupted'] }) status!: ChatStatus;
  @Prop({ type: String, default: null }) error!: string | null;
  @Prop({ type: Date, required: true }) createdAt!: Date;
  @Prop({ type: Date, required: true }) updatedAt!: Date;
}
const TurnSchema = SchemaFactory.createForClass(TurnRecord);
@Schema({ collection: 'chat_conversations', timestamps: true, versionKey: false, id: false })
export class ConversationRecord {
  @Prop({ type: String, default: () => randomUUID(), unique: true, immutable: true }) id!: string;
  @Prop({ type: String, required: true, immutable: true }) ownerId!: string;
  @Prop({ type: String, default: '新对话' }) title!: string;
  @Prop({ type: [TurnSchema], default: [] }) turns!: TurnRecord[];
  @Prop({ type: Boolean, default: false }) active!: boolean;
  @Prop({ type: Date, default: null }) expiresAt!: Date | null;
  @Prop({ type: String, default: null }) runtimeId!: string | null;
  createdAt!: Date;
  updatedAt!: Date;
}
export const ConversationSchema = SchemaFactory.createForClass(ConversationRecord);
ConversationSchema.index({ ownerId: 1, updatedAt: -1 });
// 部分唯一索引只约束活动会话，跨会话竞争也不能给同一站主启动两轮生成。
ConversationSchema.index({ ownerId: 1 }, { unique: true, partialFilterExpression: { active: true }, name: 'one_active_chat_per_owner' });
