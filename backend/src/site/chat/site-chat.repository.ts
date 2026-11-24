import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { SiteChatConversationRecord } from './schemas/site-chat-conversation.schema.js';
import type { SiteChatConversationSummary, SiteChatConversationView, SiteChatTurnView } from './site-chat.types.js';

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

@Injectable()
export class SiteChatRepository {
  constructor(
    @InjectModel(SiteChatConversationRecord.name)
    private readonly conversations: Model<SiteChatConversationRecord>,
  ) {}

  async list(visitorHash: string): Promise<SiteChatConversationSummary[]> {
    // turns 为空的半成品会话不展示；排序与上限都在数据库完成，避免把大文档读进内存。
    const records = await this.conversations.find({
      visitorHash,
      'turns.0': { $exists: true },
    })
      .sort({ updatedAt: -1 })
      .limit(20)
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
}
