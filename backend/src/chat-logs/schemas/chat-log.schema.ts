import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { randomUUID } from 'node:crypto';

// 每一轮对话单独存一条日志，而不是内嵌在会话文档里：
// 1. 访客删除会话、TTL 清理会话后，管理端仍能追溯这一轮发生过什么；
// 2. 站主对话与公开对话使用同一张表，后台可以统一按时间查看；
// 3. 日志是旁路观测数据，写入失败不能影响正常对话，因此不和会话终态强绑定。
export type ChatLogChannel = 'site' | 'owner';
export type ChatLogStatus = 'streaming' | 'completed' | 'failed' | 'canceled' | 'interrupted';
export type ChatLogTraceStatus = 'started' | 'completed' | 'failed';

// Agent/模型的执行轨迹单独存成子文档数组：详情页按时间顺序展示，
// 列表接口不返回它，避免一次查询把所有轮次的内部步骤都读出来。
@Schema({ _id: false, versionKey: false })
export class ChatLogTraceRecord {
  @Prop({ type: Date, required: true }) at!: Date;
  @Prop({ type: String, required: true }) stage!: string;
  @Prop({ type: String, required: true, enum: ['started', 'completed', 'failed'] }) status!: ChatLogTraceStatus;
  @Prop({ type: Number, default: null }) durationMs!: number | null;
  @Prop({ type: String, default: null }) detail!: string | null;
}

export const ChatLogTraceSchema = SchemaFactory.createForClass(ChatLogTraceRecord);

@Schema({ collection: 'chat_logs', timestamps: true, versionKey: false, id: false })
export class ChatLogRecord {
  // id 由应用生成，管理端直接分页/定位，不依赖 Mongo 的 ObjectId 字符串。
  @Prop({ type: String, default: () => randomUUID(), immutable: true }) id!: string;
  @Prop({ type: String, required: true, enum: ['site', 'owner'] }) channel!: ChatLogChannel;
  // requestKey 是客户端每轮生成的 requestId：同一请求重试时只保留一条日志。
  @Prop({ type: String, required: true }) requestKey!: string;
  @Prop({ type: String, default: null }) conversationId!: string | null;
  @Prop({ type: String, default: null }) turnId!: string | null;
  @Prop({ type: String, required: true }) question!: string;
  @Prop({ type: String, default: '' }) answer!: string;
  @Prop({ type: String, required: true, enum: ['streaming', 'completed', 'failed', 'canceled', 'interrupted'] }) status!: ChatLogStatus;
  @Prop({ type: String, default: null }) error!: string | null;
  // 受理到终态的毫秒数；仍在生成时为 null，前端显示“生成中”。
  @Prop({ type: Number, default: null }) durationMs!: number | null;
  @Prop({ type: Date, required: true }) startedAt!: Date;
  @Prop({ type: Date, default: null }) finishedAt!: Date | null;
  // 实际调用模型与请求模型分开保存：公开对话可能从 GLM 切到备用 DeepSeek，
  // 后台需要知道“用户选了什么”和“最终谁回答了”。
  @Prop({ type: String, default: null }) modelId!: string | null;
  @Prop({ type: String, default: null }) modelLabel!: string | null;
  @Prop({ type: String, default: null }) requestedModelId!: string | null;
  @Prop({ type: String, default: null }) requestedModelLabel!: string | null;
  @Prop({ type: Boolean, default: false }) fallbackUsed!: boolean;
  @Prop({ type: Number, default: null }) firstTokenMs!: number | null;
  @Prop({ type: Number, default: null }) promptTokens!: number | null;
  @Prop({ type: Number, default: null }) completionTokens!: number | null;
  @Prop({ type: Number, default: null }) totalTokens!: number | null;
  @Prop({ type: [ChatLogTraceSchema], default: [] }) trace!: ChatLogTraceRecord[];
  createdAt!: Date;
  updatedAt!: Date;
}

export const ChatLogSchema = SchemaFactory.createForClass(ChatLogRecord);

// 同一入口的同一 requestId 只能有一条日志；start 用 upsert 实现幂等。
ChatLogSchema.index({ channel: 1, requestKey: 1 }, { unique: true });
// 管理端默认按开始时间倒序分页，并按入口/状态筛选。
ChatLogSchema.index({ startedAt: -1 });
ChatLogSchema.index({ channel: 1, startedAt: -1 });
ChatLogSchema.index({ status: 1, startedAt: -1 });
