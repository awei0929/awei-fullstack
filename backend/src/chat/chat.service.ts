import { BadRequestException, ConflictException, Injectable, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import type { BeforeApplicationShutdown, OnModuleInit } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import type { Model } from 'mongoose';
import { randomUUID } from 'node:crypto';
import { ConversationRecord } from './schemas/conversation.schema.js';
import type { TurnRecord } from './schemas/conversation.schema.js';
import { ChatConfig } from './config/chat.config.js';
import { ChatCompletionsProvider, ModelRateLimitError } from './providers/chat-completions.provider.js';
import { ChatMemoryService } from './chat-memory.service.js';
import type { StreamChatDto } from './dto/chat.dto.js';
import type { ChatConversation, ChatEvent, ChatStatus, ChatTurn, ModelMessage, ModelSettings } from './types/chat.type.js';

interface Run {
  ownerId: string; conversationId: string; turn: ChatTurn; model: ModelSettings; messages: ModelMessage[];
  controller: AbortController; answer: string; savedAt: number; deadline: number; fallbackModel?: ModelSettings;
  ending?: Promise<ChatTurn>; timer?: ReturnType<typeof setTimeout>;
}
export interface PreparedChat { conversationId: string; turn: ChatTurn; run?: Run }
// Service组织受理、模型调用和持久化；内存只存取消句柄，Mongo负责历史、幂等与最终状态。
@Injectable()
export class ChatService implements OnModuleInit, BeforeApplicationShutdown {
  private readonly runtimeId = randomUUID();
  private readonly runs = new Map<string, Run>();
  private readonly admitting = new Set<string>();
  constructor(
    @InjectModel(ConversationRecord.name) private readonly conversations: Model<ConversationRecord>,
    private readonly config: ChatConfig,
    private readonly provider: ChatCompletionsProvider,
    private readonly memories: ChatMemoryService,
  ) {}
  async onModuleInit(): Promise<void> {
    // 等待唯一索引并检查配置；缺Key合法，坏白名单明确拒绝，不能静默换模型。
    await this.conversations.init(); this.config.models(); this.config.timeout();
  }
  async beforeApplicationShutdown(): Promise<void> {
    await Promise.allSettled([...this.runs.values()].map(run => this.finish(run, 'interrupted', '服务已停止，回复已中断')));
  }
  catalog() { return this.config.catalog(); }
  async list(ownerId: string): Promise<{ conversations: ChatConversation[] }> {
    await this.recover(ownerId);
    const records = await this.conversations.find({ ownerId }).select('-turns').sort({ updatedAt: -1, _id: -1 }).limit(50).lean().exec();
    return { conversations: records.map(record => this.conversationView(record)) };
  }
  async create(ownerId: string): Promise<ChatConversation> { return this.conversationView(await this.conversations.create({ ownerId })); }
  async detail(ownerId: string, id: string): Promise<{ conversation: ChatConversation; turns: ChatTurn[] }> {
    await this.recover(ownerId); const record = await this.find(ownerId, id);
    return { conversation: this.conversationView(record), turns: record.turns.map(turn => this.turnView(turn)) };
  }
  async prepare(ownerId: string, id: string, input: StreamChatDto): Promise<PreparedChat> {
    await this.recover(ownerId); const record = await this.find(ownerId, id);
    const existing = record.turns.find(turn => turn.requestId === input.requestId);
    if (existing) {
      if (existing.content !== input.content || (existing.requestedModelId ?? existing.modelId) !== input.modelId) throw new ConflictException('同一请求编号不能用于不同内容或模型');
      if (existing.status === 'streaming') throw new ConflictException('该请求仍在生成中');
      return { conversationId: id, turn: this.turnView(existing) };
    }
    // 同步预占阻止await之间重复受理；数据库唯一索引再兜底跨会话竞争。
    if (this.runs.has(ownerId) || this.admitting.has(ownerId)) throw new ConflictException('已有回复正在生成，请先停止或等待完成');
    this.admitting.add(ownerId);
    try {
      if (record.turns.length >= 100) throw new BadRequestException('此会话已达100轮，请新建会话');
      const models = this.config.models();
      const model = models.find(item => item.id === input.modelId);
      if (!model) throw new BadRequestException('请选择有效模型');
      if (!model.apiKey) throw new ServiceUnavailableException('此模型尚未配置，请在服务端配置API Key');
      // 在受理写库前获取启用记忆快照；失败时仍返回普通JSON，不产生无上下文的半受理轮次。
      const memoryContext = await this.memories.context(ownerId);
      const timeoutMs = this.config.timeout(); const now = new Date();
      const turn: TurnRecord = { requestId: input.requestId, content: input.content, answer: '', modelId: model.id, modelLabel: model.label, requestedModelId: model.id, requestedModelLabel: model.label, status: 'streaming', error: null, createdAt: now, updatedAt: now };
      let updated;
      try {
        updated = await this.conversations.findOneAndUpdate(
          { ownerId, id, active: false, 'turns.requestId': { $ne: input.requestId }, 'turns.99': { $exists: false } },
          { $push: { turns: turn }, $set: { active: true, runtimeId: this.runtimeId, expiresAt: new Date(now.getTime() + timeoutMs), ...(record.turns.length === 0 ? { title: Array.from(input.content).slice(0, 40).join('') } : {}) } },
          { returnDocument: 'after' },
        ).lean().exec();
      } catch (error) {
        if (error && typeof error === 'object' && 'code' in error && error.code === 11000) throw new ConflictException('已有回复正在生成，请先停止或等待完成');
        throw error;
      }
      if (!updated) throw new ConflictException('会话状态已变化，请刷新后重试');
      const run: Run = { ownerId, conversationId: id, turn: this.turnView(turn), model, fallbackModel: models.find(item => item.id === model.fallbackModelId && item.apiKey), messages: [...memoryContext, ...this.context(record.turns, input.content)], controller: new AbortController(), answer: '', savedAt: 0, deadline: now.getTime() + timeoutMs };
      this.runs.set(ownerId, run);
      // 数据库可能已受理但响应迟到，另一请求已取消；登记句柄后再读一次，封住此窗口。
      try {
        const current = (await this.find(ownerId, id)).turns.find(item => item.requestId === input.requestId)!;
        if (current.status !== 'streaming') {
          run.controller.abort(); run.turn = this.turnView(current); run.ending = Promise.resolve(run.turn);
          return { conversationId: id, turn: run.turn, run };
        }
      } catch (error) {
        await this.finish(run, 'failed', '受理回复失败，请刷新后重试');
        if (this.runs.get(ownerId) === run) this.runs.delete(ownerId);
        throw error;
      }
      // 从受理时计时，客户端不读取流也不能无限占用模型资源。
      run.timer = setTimeout(() => { void this.finish(run, 'interrupted', '生成超时，已保留部分回复'); }, Math.max(1, run.deadline - Date.now()));
      return { conversationId: id, turn: run.turn, run };
    } finally { this.admitting.delete(ownerId); }
  }
  async stream(prepared: PreparedChat, emit: (event: ChatEvent) => void): Promise<void> {
    emit({ type: 'start', conversationId: prepared.conversationId, turn: prepared.turn });
    const run = prepared.run;
    if (!run) { emit({ type: 'done', conversationId: prepared.conversationId, turn: prepared.turn }); return; }
    try {
      try { await this.consume(run, emit); }
      catch (error) {
        // 只在首次可信HTTP429且无正文时尝试固定免费备用；第二次consume不再进入此catch。
        if (!(error instanceof ModelRateLimitError) || !run.fallbackModel || run.answer || this.stopped(run)) throw error;
        const fallback = run.fallbackModel;
        run.fallbackModel = undefined;
        const updated = await this.conversations.findOneAndUpdate(
          { ownerId: run.ownerId, id: run.conversationId, active: true, runtimeId: this.runtimeId, expiresAt: { $gt: new Date() }, turns: { $elemMatch: { requestId: run.turn.requestId, status: 'streaming', modelId: run.model.id, answer: '' } } },
          { $set: { 'turns.$.modelId': fallback.id, 'turns.$.modelLabel': fallback.label, 'turns.$.updatedAt': new Date() } },
          { returnDocument: 'after' },
        ).lean().exec();
        // await期间可能取消或超时；终态CAS优先，写入失败/未命中都不能启动新上游。
        if (updated) run.turn = this.turnView(updated.turns.find(turn => turn.requestId === run.turn.requestId)!);
        if (!this.stopped(run)) {
          if (!updated) throw new Error('切换模型状态已变化');
          run.model = fallback;
          emit({ type: 'fallback', conversationId: run.conversationId, turn: run.turn });
          await this.consume(run, emit);
        }
      }
      this.stopped(run);
      const turn = await (run.ending ?? this.finish(run, run.answer.trim() ? 'completed' : 'failed', run.answer.trim() ? null : '模型未返回有效文本，请重试'));
      emit({ type: 'done', conversationId: run.conversationId, turn });
    } catch (error) {
      this.stopped(run);
      // 只公开本地适配层定义的错误；未知网络/数据库异常不能带出原始响应或连接信息。
      const message = error instanceof Error && /^(模型|回复超过)/.test(error.message) ? error.message : '生成或保存回复失败，请刷新后重试';
      const turn = await (run.ending ?? this.finish(run, 'failed', message));
      emit({ type: 'done', conversationId: run.conversationId, turn });
    } finally {
      if (run.timer) clearTimeout(run.timer);
      if (this.runs.get(run.ownerId) === run) this.runs.delete(run.ownerId);
    }
  }
  private async consume(run: Run, emit: (event: ChatEvent) => void): Promise<void> {
    if (this.stopped(run)) return;
    for await (const text of this.provider.generate(run.model, run.messages, run.controller.signal)) {
      // 每次上游/数据库await后检查同一截止时间，不依赖计时器是否已获得事件循环执行机会。
      if (this.stopped(run)) break;
      const remaining = 16000 - Array.from(run.answer).length;
      const points = Array.from(text); const accepted = points.slice(0, remaining).join('');
      run.answer += accepted;
      if (accepted) emit({ type: 'delta', requestId: run.turn.requestId, text: accepted });
      if (points.length > remaining) throw new Error('回复超过16000字符限制，已保留部分内容');
      if (Date.now() - run.savedAt >= 250) {
        await this.conversations.updateOne({ ownerId: run.ownerId, id: run.conversationId, turns: { $elemMatch: { requestId: run.turn.requestId, status: 'streaming' } } },
          { $set: { 'turns.$.answer': run.answer, 'turns.$.updatedAt': new Date() } }).exec();
        if (this.stopped(run)) break;
        run.savedAt = Date.now();
      }
    }
  }
  private stopped(run: Run): boolean {
    if (!run.ending && Date.now() >= run.deadline) void this.finish(run, 'interrupted', '生成超时，已保留部分回复');
    return Boolean(run.ending) || run.controller.signal.aborted;
  }
  async disconnect(prepared: PreparedChat): Promise<void> {
    if (prepared.run) {
      await this.finish(prepared.run, 'interrupted', '连接已断开，回复已中断');
      // 写头前断开的请求不会进入stream.finally，因此在断开路径也必须释放运行句柄。
      if (this.runs.get(prepared.run.ownerId) === prepared.run) this.runs.delete(prepared.run.ownerId);
    }
  }
  async cancel(ownerId: string, id: string, requestId: string): Promise<ChatTurn> {
    await this.recover(ownerId); const record = await this.find(ownerId, id);
    const turn = record.turns.find(item => item.requestId === requestId);
    if (!turn) throw new NotFoundException('对话轮次不存在');
    if (turn.status !== 'streaming') return this.turnView(turn);
    const run = this.runs.get(ownerId);
    if (run?.conversationId === id && run.turn.requestId === requestId) return this.finish(run, 'canceled', null);
    return this.persistTerminal(ownerId, id, requestId, turn.answer, 'canceled', null);
  }
  private finish(run: Run, status: Exclude<ChatStatus, 'streaming'>, error: string | null): Promise<ChatTurn> {
    if (run.ending) return run.ending;
    // await前固定终态，abort停止上游，Mongo CAS防止迟到完成覆盖取消。
    run.controller.abort(); if (run.timer) clearTimeout(run.timer);
    run.ending = this.persistTerminal(run.ownerId, run.conversationId, run.turn.requestId, run.answer, status, error).catch(async () => {
      const message = '保存回复失败，请刷新确认结果';
      try { return await this.persistTerminal(run.ownerId, run.conversationId, run.turn.requestId, run.answer, 'failed', message); }
      catch { return { ...run.turn, answer: run.answer, status: 'failed', error: message, updatedAt: new Date().toISOString() }; }
    });
    return run.ending;
  }
  private async persistTerminal(ownerId: string, id: string, requestId: string, answer: string, status: Exclude<ChatStatus, 'streaming'>, error: string | null): Promise<ChatTurn> {
    const updated = await this.conversations.findOneAndUpdate(
      { ownerId, id, turns: { $elemMatch: { requestId, status: 'streaming' } } },
      { $set: { active: false, expiresAt: null, 'turns.$.answer': answer, 'turns.$.status': status, 'turns.$.error': error, 'turns.$.updatedAt': new Date() } },
      { returnDocument: 'after' },
    ).lean().exec();
    const record = updated ?? await this.find(ownerId, id);
    const turn = record.turns.find(item => item.requestId === requestId);
    if (!turn) throw new NotFoundException('对话轮次不存在'); return this.turnView(turn);
  }
  private async recover(ownerId: string): Promise<void> {
    // 每个查询仍带ownerId；新进程标识不同，旧streaming即使未超时也不会永久挂起。
    await this.conversations.updateMany({ ownerId, active: true, $or: [{ expiresAt: { $lte: new Date() } }, { runtimeId: { $ne: this.runtimeId } }] },
      { $set: { active: false, expiresAt: null, 'turns.$[turn].status': 'interrupted', 'turns.$[turn].error': '生成已中断，请重新编辑后发送', 'turns.$[turn].updatedAt': new Date() } },
      { arrayFilters: [{ 'turn.status': 'streaming' }] }).exec();
  }
  private async find(ownerId: string, id: string): Promise<ConversationRecord> {
    const record = await this.conversations.findOne({ ownerId, id }).lean().exec();
    if (!record) throw new NotFoundException('对话不存在'); return record;
  }
  private context(turns: TurnRecord[], content: string): ModelMessage[] {
    // 保留完整问答对，从最近10轮completed倒序取预算，再恢复旧到新顺序；当前输入永不裁剪。
    let budget = 32000 - Array.from(content).length; const selected: TurnRecord[] = [];
    for (const turn of turns.filter(item => item.status === 'completed').slice(-10).reverse()) {
      const cost = Array.from(turn.content).length + Array.from(turn.answer).length;
      if (cost > budget) break; selected.unshift(turn); budget -= cost;
    }
    return [...selected.flatMap(turn => [{ role: 'user' as const, content: turn.content }, { role: 'assistant' as const, content: turn.answer }]), { role: 'user', content }];
  }
  private conversationView(record: ConversationRecord): ChatConversation { return { id: record.id, title: record.title, createdAt: record.createdAt.toISOString(), updatedAt: record.updatedAt.toISOString() }; }
  private turnView(turn: TurnRecord): ChatTurn { return { requestId: turn.requestId, content: turn.content, answer: turn.answer, modelId: turn.modelId, modelLabel: turn.modelLabel, requestedModelId: turn.requestedModelId ?? turn.modelId, requestedModelLabel: turn.requestedModelLabel ?? turn.modelLabel, status: turn.status, error: turn.error, createdAt: turn.createdAt.toISOString(), updatedAt: turn.updatedAt.toISOString() }; }
}
