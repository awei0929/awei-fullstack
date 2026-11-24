import { Injectable, Logger } from '@nestjs/common';
import type { BeforeApplicationShutdown, OnModuleInit } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import type { Model } from 'mongoose';
import { QueueConfig } from './queue.config.js';
import { JobRecord } from './schemas/job.schema.js';
import type { JobStatus } from './types/job.type.js';

interface ActiveJob {
  timer: ReturnType<typeof setInterval>;
  generation: number;
  label: string;
}

// Worker 与 API 在同一个 Nest 进程内运行：定时领取 pending 作业，按步写回进度。
// 租约保证进程被强杀后作业仍可被其他进程或重启后的本进程重新领取；
// 内存 Map 只保存当前进程的计时器，真正的状态与恢复依据都在 MongoDB。
@Injectable()
export class JobsWorker implements OnModuleInit, BeforeApplicationShutdown {
  private readonly logger = new Logger(JobsWorker.name);
  private readonly active = new Map<string, ActiveJob>();
  private timer?: ReturnType<typeof setInterval>;
  private polling?: Promise<void>;
  private generation = 0;
  private stopped = false;

  constructor(
    @InjectModel(JobRecord.name) private readonly jobModel: Model<JobRecord>,
    private readonly config: QueueConfig,
  ) {}

  onModuleInit(): void {
    // 测试可用 QUEUE_WORKER_ENABLED=false 关闭自动轮询，再手动调用 pollOnce。
    // 关闭自动轮询不影响领取逻辑本身，只影响谁来驱动它。
    if (!this.config.workerEnabled()) return;
    this.stopped = false;
    void this.recoverExpired();
    this.timer = setInterval(() => { void this.pollOnce(); }, this.config.pollIntervalMs());
  }

  async beforeApplicationShutdown(): Promise<void> {
    this.stopped = true;
    if (this.timer) clearInterval(this.timer);
    const ids = [...this.active.keys()];
    for (const job of this.active.values()) clearInterval(job.timer);
    this.active.clear();
    if (ids.length === 0) return;
    // 优雅停机把在途作业交还给队列，重启后可立即领取；强杀则依赖租约过期恢复。
    try {
      await this.jobModel.updateMany(
        { id: { $in: ids }, status: 'running' },
        { $set: { status: 'pending', progress: 0, result: '', error: null, leaseUntil: null, startedAt: null } },
      ).exec();
    } catch (error) {
      this.logger.warn(`释放作业租约失败：${error instanceof Error ? error.message : String(error)}`);
    }
  }

  // 供定时器与 HTTP 测试共用的驱动入口；并发轮询复用同一个 Promise，避免超过并发上限。
  async pollOnce(): Promise<void> {
    if (this.stopped) return;
    if (this.polling) return this.polling;
    this.polling = this.doPoll().finally(() => { this.polling = undefined; });
    return this.polling;
  }

  private async doPoll(): Promise<void> {
    try {
      await this.recoverExpired();
      // 一次只领取到并发上限；active 中的作业由各自的计时器推进。
      while (!this.stopped && this.active.size < this.config.concurrency()) {
        const job = await this.claim();
        if (!job) break;
        this.run(job);
      }
    } catch (error) {
      this.logger.warn(`作业队列轮询失败：${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private async recoverExpired(): Promise<void> {
    const activeIds = [...this.active.keys()];
    // 只回收不在本进程活跃表中的过期租约，避免把正在处理的作业重新排队。
    await this.jobModel.updateMany(
      {
        status: 'running',
        $or: [{ leaseUntil: null }, { leaseUntil: { $lte: new Date() } }],
        ...(activeIds.length > 0 ? { id: { $nin: activeIds } } : {}),
      },
      { $set: { status: 'pending', progress: 0, result: '', error: null, leaseUntil: null, startedAt: null } },
    ).exec();
  }

  private async claim(): Promise<JobRecord | null> {
    const now = new Date();
    // findOneAndUpdate 的原子性保证同一作业只会被一个 Worker 领取；
    // 领取时递增 attempt，便于验证重启恢复后没有重复执行已完成作业。
    const record = await this.jobModel.findOneAndUpdate(
      { status: 'pending', $or: [{ leaseUntil: null }, { leaseUntil: { $lte: now } }] },
      {
        $set: {
          status: 'running',
          leaseUntil: new Date(now.getTime() + this.config.leaseMs()),
          startedAt: now,
          progress: 0,
          result: '',
          error: null,
        },
        $inc: { attempt: 1 },
      },
      { sort: { createdAt: 1, _id: 1 }, returnDocument: 'after' },
    ).lean().exec();
    return record as JobRecord | null;
  }

  private run(job: JobRecord): void {
    // generation 区分同一 id 的多次处理；旧计时器即使晚到也不能覆盖新状态。
    const generation = ++this.generation;
    const total = this.config.steps();
    let step = 0;
    const timer = setInterval(() => {
      step += 1;
      void this.advance(job.id, job.label, generation, step, total);
    }, this.config.stepMs());
    this.active.set(job.id, { timer, generation, label: job.label });
  }

  private async advance(id: string, label: string, generation: number, step: number, total: number): Promise<void> {
    if (this.stopped || this.active.get(id)?.generation !== generation) return;
    if (step >= total) {
      await this.settle(id, generation, 'done');
      return;
    }
    const progress = Math.min(99, Math.round((step / total) * 100));
    try {
      // 每步都续租，慢数据库或短暂暂停不会让正在处理的作业被误判为超时。
      // matchedCount 为 0 表示状态已被终态或恢复逻辑改写，本计时器立即停止。
      const result = await this.jobModel.updateOne(
        { id, status: 'running', leaseUntil: { $gt: new Date() } },
        { $set: { progress, leaseUntil: new Date(Date.now() + this.config.leaseMs()) } },
      ).exec();
      if (result.matchedCount === 0) this.stop(id, generation);
    } catch (error) {
      this.logger.warn(`作业进度写入失败：${error instanceof Error ? error.message : String(error)}`);
      await this.settle(id, generation, 'failed');
    }
  }

  private async settle(id: string, generation: number, status: Extract<JobStatus, 'done' | 'failed'>): Promise<void> {
    if (this.active.get(id)?.generation !== generation) return;
    const label = this.active.get(id)?.label ?? '';
    try {
      await this.jobModel.updateOne(
        { id, status: 'running' },
        {
          $set: {
            status,
            progress: status === 'done' ? 100 : 0,
            result: status === 'done' ? `演示作业已完成：${label}` : '',
            error: status === 'failed' ? '作业处理失败，请稍后重试' : null,
            finishedAt: new Date(),
            leaseUntil: null,
          },
        },
      ).exec();
    } catch (error) {
      this.logger.warn(`作业终态写入失败：${error instanceof Error ? error.message : String(error)}`);
    } finally {
      this.stop(id, generation);
    }
  }

  private stop(id: string, generation: number): void {
    const active = this.active.get(id);
    if (!active || active.generation !== generation) return;
    clearInterval(active.timer);
    this.active.delete(id);
  }
}
