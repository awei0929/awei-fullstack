import { ConflictException, Injectable, NotFoundException, type OnModuleInit } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { randomUUID } from 'node:crypto';
import { Model } from 'mongoose';
import type { ModelMessage } from '../../chat/types/chat.type.js';
import { SiteChatConversationRecord } from './schemas/site-chat-conversation.schema.js';
import type { SiteChatConversationSummary, SiteChatConversationView, SiteChatTurnView } from './site-chat.types.js';

const MAX_CONVERSATIONS = 20;
const MAX_TURNS = 100;
const HISTORY_TURNS = 8;
const TTL_MS = 30 * 24 * 60 * 60 * 1000;

function iso(value: Date | string): string {
  return new Date(value).toISOString();
}

function cut(value: string, max: number): string {
  return Array.from(value.trim()).slice(0, max).join('');
}

// 公开历史只返回视图字段；visitorHash、active 锁和内部错误细节不进入响应。
function turnView(turn: SiteChatConversationRecord['turns'][number]): SiteChatTurnView {
  return {
    requestId: turn.requestId,
    content: turn.content,
    answer: turn.answer,
    status: turn.status,
    modelId: turn.modelId,
    error: turn.error,
    createdAt: iso(turn.createdAt),
    updatedAt: iso(turn.updatedAt),
  };
}

function historyOf(turns: SiteChatConversationRecord['turns']): ModelMessage[] {
  // 只把已完成的轮次带给模型；失败/取消的半截答案不能继续污染下一轮语气。
  const messages: ModelMessage[] = [];
  for (const turn of turns.filter(item => item.status === 'completed' && item.answer.trim()).slice(-HISTORY_TURNS)) {
    messages.push({ role: 'user', content: turn.content }, { role: 'assistant', content: turn.answer });
  }
  return messages;
}

@Injectable()
export class SiteChatRepository implements OnModuleInit {
  constructor(
    @InjectModel(SiteChatConversationRecord.name)
    private readonly conversations: Model<SiteChatConversationRecord>,
  ) {}

  async onModuleInit(): Promise<void> {
    // 索引（尤其TTL）必须在服务开始接流量前就绪，否则测试和首次访问会看到半初始化状态。
    await this.conversations.init();
  }

  async history(visitorHash: string, conversationId: string): Promise<ModelMessage[]> {
    // 图只读取已完成轮次；当前 streaming 轮次不会进入下一轮上下文。
    const record = await this.conversations.findOne({ id: conversationId, visitorHash }).lean();
    return record ? historyOf(record.turns) : [];
  }

  async list(visitorHash: string): Promise<SiteChatConversationSummary[]> {
    // turns 为空的半成品会话不展示；排序与上限都在数据库完成，避免把大文档读进内存。
    const records = await this.conversations.find({
      visitorHash,
      'turns.0': { $exists: true },
    })
      .sort({ updatedAt: -1 })
      .limit(MAX_CONVERSATIONS)
      .lean()
      .exec();

    return records.map(record => {
      const last = record.turns.at(-1);
      return {
        id: record.id,
        title: record.title,
        updatedAt: iso(record.updatedAt),
        messageCount: record.turns.length,
        preview: cut(last?.answer || last?.content || '', 80),
      };
    });
  }

  async get(visitorHash: string, id: string): Promise<SiteChatConversationView | null> {
    // id 与 visitorHash 必须同时匹配，不能靠前端传对 ID 就读取别人的会话。
    const record = await this.conversations.findOne({ id, visitorHash }).lean().exec();
    if (!record) return null;
    return {
      conversation: {
        id: record.id,
        title: record.title,
        createdAt: iso(record.createdAt),
        updatedAt: iso(record.updatedAt),
      },
      turns: record.turns.map(turnView),
    };
  }

  async remove(visitorHash: string, id: string): Promise<boolean> {
    // 硬删除匿名会话；TTL 是兜底，不是删除语义的替代。
    const result = await this.conversations.deleteOne({ id, visitorHash }).exec();
    return result.deletedCount === 1;
  }

  async beginTurn(input: {
    visitorHash: string;
    conversationId?: string;
    requestId: string;
    content: string;
    modelId: string;
    lockMs: number;
  }): Promise<{ conversationId: string; turnId: string; history: ModelMessage[]; answer?: string }> {
    const now = new Date();
    const lockUntil = new Date(now.getTime() + input.lockMs);

    if (!input.conversationId) {
      // 没有 conversationId 时也先按 requestId 查重：客户端首条消息重试不能新建第二个会话。
      const replayed = await this.conversations.findOne({ visitorHash: input.visitorHash, 'turns.requestId': input.requestId }).lean().exec();
      if (replayed) {
        const turn = replayed.turns.find(item => item.requestId === input.requestId)!;
        if (turn.status === 'completed') return { conversationId: replayed.id, turnId: turn.requestId, history: historyOf(replayed.turns.filter(item => item !== turn)), answer: turn.answer };
        this.busy();
      }
      // 无会话时先检查数量，再创建；20 是单个匿名浏览器的硬上限，防止无限占用模型预算。
      const count = await this.conversations.countDocuments({ visitorHash: input.visitorHash, 'turns.0': { $exists: true } });
      if (count >= MAX_CONVERSATIONS) this.limitReached();

      const conversationId = randomUUID();
      await this.conversations.create({
        id: conversationId,
        visitorHash: input.visitorHash,
        title: cut(input.content, 24) || '新对话',
        turns: [this.newTurn(input, now)],
        active: true,
        activeUntil: lockUntil,
        expiresAt: new Date(now.getTime() + TTL_MS),
      });
      return { conversationId, turnId: input.requestId, history: [] };
    }

    const record = await this.conversations.findOne({ id: input.conversationId, visitorHash: input.visitorHash }).lean().exec();
    if (!record) throw new NotFoundException({ message: '会话不存在', code: 'SITE_CHAT_CONVERSATION_NOT_FOUND' });

    const same = record.turns.find(turn => turn.requestId === input.requestId);
    if (same) {
      // 同一轮已生成完时直接重放，不能再调用模型；仍在上游生成时视为忙。
      if (same.status === 'completed') {
        return { conversationId: record.id, turnId: same.requestId, history: historyOf(record.turns.filter(turn => turn !== same)), answer: same.answer };
      }
      this.busy();
    }

    if (record.active && record.activeUntil && record.activeUntil.getTime() > now.getTime()) this.busy();

    // 锁已过期或进程异常退出时，把遗留的 streaming 轮次标为 failed，再抢占新锁。
    if (record.active || record.turns.some(turn => turn.status === 'streaming')) {
      await this.conversations.updateOne(
        { id: record.id, visitorHash: input.visitorHash },
        {
          $set: {
            active: false,
            activeUntil: null,
            updatedAt: now,
            expiresAt: new Date(now.getTime() + TTL_MS),
            'turns.$[turn].status': 'failed',
            'turns.$[turn].error': '上一次回答中断了。',
            'turns.$[turn].updatedAt': now,
          },
        },
        { arrayFilters: [{ 'turn.status': 'streaming' }] },
      ).exec();
    }

    if (record.turns.length >= MAX_TURNS) this.limitReached();

    const updated = await this.conversations.findOneAndUpdate(
      {
        id: record.id,
        visitorHash: input.visitorHash,
        $or: [{ active: false }, { activeUntil: { $lte: now } }],
      },
      {
        $set: {
          active: true,
          activeUntil: lockUntil,
          updatedAt: now,
          expiresAt: new Date(now.getTime() + TTL_MS),
        },
        $push: { turns: this.newTurn(input, now) },
      },
      { returnDocument: 'after' },
    ).lean().exec();
    if (!updated) this.busy();

    return { conversationId: record.id, turnId: input.requestId, history: historyOf(record.turns) };
  }

  async appendAnswer(visitorHash: string, conversationId: string, requestId: string, answer: string): Promise<void> {
    // 用 arrayFilters 定位轮次，避免并发更新覆盖其他轮次；只改增量正文，不改状态。
    const now = new Date();
    await this.conversations.updateOne(
      { id: conversationId, visitorHash },
      {
        $set: {
          'turns.$[turn].answer': answer,
          'turns.$[turn].updatedAt': now,
          updatedAt: now,
          expiresAt: new Date(now.getTime() + TTL_MS),
        },
      },
      { arrayFilters: [{ 'turn.requestId': requestId, 'turn.status': 'streaming' }] },
    ).exec();
  }

  async finishTurn(visitorHash: string, conversationId: string, requestId: string, status: 'completed' | 'failed' | 'canceled', error?: string | null): Promise<void> {
    const now = new Date();
    await this.conversations.updateOne(
      { id: conversationId, visitorHash },
      {
        $set: {
          active: false,
          activeUntil: null,
          updatedAt: now,
          expiresAt: new Date(now.getTime() + TTL_MS),
          'turns.$[turn].status': status,
          'turns.$[turn].error': error ?? null,
          'turns.$[turn].updatedAt': now,
        },
      },
      { arrayFilters: [{ 'turn.requestId': requestId, 'turn.status': 'streaming' }] },
    ).exec();
  }

  async release(visitorHash: string, conversationId: string): Promise<void> {
    // 只清锁，不改轮次；用于“受理后未来得及进入生成”的异常路径。
    await this.conversations.updateOne(
      { id: conversationId, visitorHash },
      { $set: { active: false, activeUntil: null, updatedAt: new Date() } },
    ).exec();
  }

  private newTurn(input: { requestId: string; content: string; modelId: string }, now: Date) {
    return {
      requestId: input.requestId,
      content: input.content,
      answer: '',
      status: 'streaming' as const,
      modelId: input.modelId,
      error: null,
      createdAt: now,
      updatedAt: now,
    };
  }

  private busy(): never {
    throw new ConflictException({ message: '这个会话正在回答上一条消息，请稍后再试。', code: 'SITE_CHAT_BUSY' });
  }

  private limitReached(): never {
    throw new ConflictException({ message: '匿名对话数量已达上限，删除旧会话后再继续。', code: 'SITE_CHAT_LIMIT_REACHED' });
  }
}
