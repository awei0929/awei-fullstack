import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import type { OnModuleInit } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import type { Model } from 'mongoose';
import { ChatLogRecord } from './schemas/chat-log.schema.js';
import type { ChatLogChannel, ChatLogStatus } from './schemas/chat-log.schema.js';
import type {
  ChatLogDetail,
  ChatLogMetaInput,
  ChatLogPage,
  ChatLogTraceInput,
  ChatLogView,
  FinishChatLogInput,
  StartChatLogInput,
} from './types/chat-log.type.js';
import type { ListChatLogsDto } from './dto/list-chat-logs.dto.js';

const MAX_QUESTION = 4000;
const MAX_ANSWER = 20000;
const MAX_ERROR = 1000;
const MAX_TRACE_DETAIL = 1000;
const MAX_TRACE = 50;
const DEFAULT_LIMIT = 20;

// 日志是旁路能力：所有写入都用 try/catch 包住并只记服务端日志，
// 任何日志数据库异常都不能让正在进行的对话失败。
@Injectable()
export class ChatLogsService implements OnModuleInit {
  private readonly logger = new Logger(ChatLogsService.name);

  constructor(@InjectModel(ChatLogRecord.name) private readonly records: Model<ChatLogRecord>) {}

  async onModuleInit(): Promise<void> {
    // 索引初始化失败不能阻止整个应用启动：日志是旁路能力，启动脚本还可能在
    // 同一数据库上与应用并发建索引。这里只记录告警，后续 upsert 仍会使用已有集合。
    try {
      await this.records.init();
    } catch (error) {
      this.logger.warn(`初始化对话日志索引失败：${error instanceof Error ? error.message : 'unknown'}`);
    }
    // 进程重启后，上一个进程留下的 streaming 日志不会再有终态更新。
    // 启动时统一收口，避免后台永远显示“生成中”；新进程此时还没有产生新日志。
    try {
      const stale = await this.records.find({ status: 'streaming' }).select('_id startedAt').lean().exec();
      if (!stale.length) return;
      const now = new Date();
      await this.records.bulkWrite(stale.map((record) => ({
        updateOne: {
          filter: { _id: record._id, status: 'streaming' },
          update: {
            $set: {
              status: 'failed' as const,
              error: '服务重启，生成结果未记录',
              finishedAt: now,
              durationMs: Math.max(0, now.getTime() - new Date(record.startedAt).getTime()),
            },
          },
        },
      })));
    } catch (error) {
      this.logger.warn(`收口遗留对话日志失败：${error instanceof Error ? error.message : 'unknown'}`);
    }
  }

  // 开始一轮日志；相同入口 + requestId 幂等，重试不会生成重复记录。
  async start(input: StartChatLogInput): Promise<string | null> {
    try {
      const record = await this.records.findOneAndUpdate(
        { channel: input.channel, requestKey: input.requestKey },
        {
          $setOnInsert: {
            channel: input.channel,
            requestKey: input.requestKey,
            conversationId: input.conversationId ?? null,
            turnId: input.turnId ?? null,
            question: truncate(input.question, MAX_QUESTION),
            answer: '',
            status: 'streaming',
            error: null,
            durationMs: null,
            startedAt: input.startedAt,
            finishedAt: null,
          },
        },
        { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true },
      ).lean().exec();
      return record?.id ?? null;
    } catch (error) {
      // 两个并发重试可能同时 upsert；唯一索引只允许一个成功，另一个读取已有记录。
      if (this.duplicate(error)) {
        try {
          const existing = await this.records.findOne({ channel: input.channel, requestKey: input.requestKey }).select('id').lean().exec();
          return existing?.id ?? null;
        } catch (readError) {
          this.logger.warn(`读取重复对话日志失败：${readError instanceof Error ? readError.message : 'unknown'}`);
          return null;
        }
      }
      this.logger.warn(`写入对话日志失败：${error instanceof Error ? error.message : 'unknown'}`);
      return null;
    }
  }

  // beginTurn 成功后补上会话/轮次标识；日志主键不依赖它们，所以即使失败也能保留问题。
  async attach(id: string | null, conversationId: string, turnId: string): Promise<void> {
    if (!id) return;
    try {
      await this.records.updateOne({ id }, { $set: { conversationId, turnId } }).exec();
    } catch (error) {
      this.logger.warn(`补充对话日志标识失败：${error instanceof Error ? error.message : 'unknown'}`);
    }
  }

  // 模型信息可能在日志受理之后才确定，且会随备用切换更新；只写传入的字段。
  async meta(id: string | null, input: ChatLogMetaInput): Promise<void> {
    if (!id) return;
    const update: Record<string, string | number | boolean | null> = {};
    for (const key of [
      'modelId',
      'modelLabel',
      'requestedModelId',
      'requestedModelLabel',
      'fallbackUsed',
      'firstTokenMs',
      'promptTokens',
      'completionTokens',
      'totalTokens',
    ] as const) {
      const value = input[key];
      if (value !== undefined) update[key] = value;
    }
    if (!Object.keys(update).length) return;
    try {
      await this.records.updateOne({ id }, { $set: update }).exec();
    } catch (error) {
      this.logger.warn(`补充对话日志模型信息失败：${error instanceof Error ? error.message : 'unknown'}`);
    }
  }

  // Agent/模型轨迹按发生顺序追加；只保留最近 50 条，防止异常循环把日志文档无限撑大。
  async trace(id: string | null, input: ChatLogTraceInput): Promise<void> {
    if (!id) return;
    const event = {
      at: input.at ?? new Date(),
      stage: truncate(input.stage, 160),
      status: input.status,
      durationMs: input.durationMs === undefined || input.durationMs === null
        ? null
        : Math.max(0, Math.round(input.durationMs)),
      detail: input.detail ? truncate(input.detail, MAX_TRACE_DETAIL) : null,
    };
    try {
      await this.records.updateOne(
        { id },
        { $push: { trace: { $each: [event], $slice: -MAX_TRACE } } },
      ).exec();
    } catch (error) {
      this.logger.warn(`追加对话日志轨迹失败：${error instanceof Error ? error.message : 'unknown'}`);
    }
  }

  // 详情接口单独读取 trace；列表接口不返回它，避免一页 20 条日志带着几十条子步骤。
  async detail(id: string): Promise<ChatLogDetail> {
    const record = await this.records.findOne({ id }).lean().exec();
    if (!record) throw new NotFoundException('对话日志不存在');
    return {
      ...this.view(record),
      // trace 是并发追加的，落库顺序可能受连接调度影响；按 at 排序保证时间线可读。
      trace: (record.trace ?? []).slice().sort((left, right) => new Date(left.at).getTime() - new Date(right.at).getTime()).map((event) => ({
        at: new Date(event.at).toISOString(),
        stage: event.stage,
        status: event.status,
        durationMs: event.durationMs ?? null,
        detail: event.detail ?? null,
      })),
    };
  }

  // 只允许 streaming → 终态，重复终态写入会自然变成 no-op，避免重试的请求覆盖第一次结果。
  async finish(id: string | null, input: FinishChatLogInput): Promise<void> {
    if (!id) return;
    try {
      await this.records.updateOne(
        { id, status: 'streaming' },
        {
          $set: {
            status: input.status,
            answer: truncate(input.answer ?? '', MAX_ANSWER),
            error: input.error ? truncate(input.error, MAX_ERROR) : null,
            durationMs: Math.max(0, Math.round(input.durationMs)),
            finishedAt: new Date(),
          },
        },
      ).exec();
    } catch (error) {
      this.logger.warn(`写入对话日志终态失败：${error instanceof Error ? error.message : 'unknown'}`);
    }
  }

  async list(query: ListChatLogsDto): Promise<ChatLogPage> {
    const limit = query.limit ?? DEFAULT_LIMIT;
    const offset = query.offset ?? 0;
    const filter: { channel?: ChatLogChannel; status?: ChatLogStatus } = {};
    if (query.channel) filter.channel = query.channel;
    if (query.status) filter.status = query.status;
    const [records, total] = await Promise.all([
      this.records
        .find(filter)
        .sort({ startedAt: -1, _id: -1 })
        .skip(offset)
        .limit(limit)
        .lean()
        .exec(),
      this.records.countDocuments(filter).exec(),
    ]);
    return {
      logs: records.map((record) => this.view(record)),
      total,
      limit,
      offset,
    };
  }

  private view(record: ChatLogRecord): ChatLogView {
    return {
      id: record.id,
      channel: record.channel,
      conversationId: record.conversationId ?? null,
      turnId: record.turnId ?? null,
      question: record.question,
      answer: record.answer ?? '',
      status: record.status,
      error: record.error ?? null,
      durationMs: record.durationMs ?? null,
      startedAt: new Date(record.startedAt).toISOString(),
      finishedAt: record.finishedAt ? new Date(record.finishedAt).toISOString() : null,
      modelId: record.modelId ?? null,
      modelLabel: record.modelLabel ?? null,
      requestedModelId: record.requestedModelId ?? null,
      requestedModelLabel: record.requestedModelLabel ?? null,
      fallbackUsed: record.fallbackUsed ?? false,
      firstTokenMs: record.firstTokenMs ?? null,
      promptTokens: record.promptTokens ?? null,
      completionTokens: record.completionTokens ?? null,
      totalTokens: record.totalTokens ?? null,
    };
  }

  private duplicate(error: unknown): boolean {
    return Boolean(error && typeof error === 'object' && 'code' in error && error.code === 11000);
  }
}

// 按 Unicode 码点截断，避免把中文或 emoji 截成半个字符。
function truncate(value: string, max: number): string {
  const points = Array.from(value);
  return points.length > max ? points.slice(0, max).join('') : value;
}
