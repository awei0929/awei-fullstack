import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { randomUUID } from 'node:crypto';
import type { JobStatus } from '../types/job.type.js';

// @Schema 描述 demo_jobs 集合的文档结构。它是持久化边界，不是 HTTP 请求体。
// 时间戳由 Mongoose 维护；公开 id 与 MongoDB 内部 _id 分离，前端只看到公开 id。
@Schema({
  collection: 'demo_jobs',
  timestamps: true,
  versionKey: false,
  id: false,
})
export class JobRecord {
  // 唯一索引既方便按 id 查询，也防止并发生成相同公开 id。
  @Prop({ type: String, required: true, default: () => randomUUID(), immutable: true, unique: true })
  id!: string;

  // 归属来自服务端会话，不接受客户端指定；创建后不可修改。
  @Prop({ type: String, required: true, immutable: true })
  ownerId!: string;

  // 演示作业的短标签；HTTP DTO 已 trim，这里保留模型层约束。
  @Prop({ type: String, required: true, trim: true, minlength: 1, maxlength: 80 })
  label!: string;

  // 状态机的四个端点。Worker 用原子更新推动状态，前端只读取。
  @Prop({ type: String, required: true, enum: ['pending', 'running', 'done', 'failed'], default: 'pending', index: true })
  status!: JobStatus;

  // 0–100 的整数进度，仅用于演示逐步写回。
  @Prop({ type: Number, required: true, default: 0, min: 0, max: 100 })
  progress!: number;

  // 终态结果与错误信息；失败原因会保留，供前端展示。
  @Prop({ type: String, default: '' })
  result!: string;

  @Prop({ type: String, default: null })
  error!: string | null;

  // 租约截止时间：只有持有有效租约的 Worker 才继续写进度。
  // 进程被强杀后租约会过期，新进程可重新领取，这就是重启恢复的基础。
  @Prop({ type: Date, default: null })
  leaseUntil!: Date | null;

  // 领取次数用于验证“已完成作业不重复执行”等边界。
  @Prop({ type: Number, required: true, default: 0, min: 0 })
  attempt!: number;

  @Prop({ type: Date, default: null })
  startedAt!: Date | null;

  @Prop({ type: Date, default: null })
  finishedAt!: Date | null;

  createdAt!: Date;
  updatedAt!: Date;
}

export const JobRecordSchema = SchemaFactory.createForClass(JobRecord);

// 复合索引对应 Worker 领取查询：先筛状态，再看租约与创建顺序。
JobRecordSchema.index({ status: 1, leaseUntil: 1, createdAt: 1, _id: 1 });
