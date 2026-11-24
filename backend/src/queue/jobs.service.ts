import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import type { Model } from 'mongoose';
import { JobRecord } from './schemas/job.schema.js';
import type { JobView } from './types/job.type.js';

// Service 受理与查询作业：Controller 不直接操作数据库，Worker 只负责消费。
// ownerId 由 Controller 从会话注入，所有查询都带归属条件。
@Injectable()
export class JobsService {
  constructor(
    @InjectModel(JobRecord.name) private readonly jobModel: Model<JobRecord>,
  ) {}

  async create(ownerId: string, label: string): Promise<JobView> {
    // 显式选择字段，避免把请求体里的额外属性展开进文档。
    // 初始状态 pending，进度 0；Worker 随后通过租约领取。
    const record = await this.jobModel.create({
      ownerId,
      label,
      status: 'pending',
      progress: 0,
      result: '',
      error: null,
      leaseUntil: null,
      attempt: 0,
      startedAt: null,
      finishedAt: null,
    });
    return this.toView(record);
  }

  async list(ownerId: string): Promise<JobView[]> {
    // 最近 20 条足够演示；倒序让新提交的作业出现在最上方。
    const records = await this.jobModel
      .find({ ownerId })
      .sort({ createdAt: -1, _id: -1 })
      .limit(20)
      .lean()
      .exec();
    return records.map((record) => this.toView(record));
  }

  // 公开视图与数据库文档分开：只输出前端需要展示的字段。
  // 日期统一转为 ISO 字符串，与现有任务接口保持一致。
  private toView(record: JobRecord): JobView {
    return {
      id: record.id,
      label: record.label,
      status: record.status,
      progress: record.progress,
      result: record.result,
      error: record.error,
      createdAt: record.createdAt.toISOString(),
      startedAt: record.startedAt ? record.startedAt.toISOString() : null,
      finishedAt: record.finishedAt ? record.finishedAt.toISOString() : null,
    };
  }
}
