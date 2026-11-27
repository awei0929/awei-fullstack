import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Req, Res, UseGuards } from '@nestjs/common';
import type { Request, Response } from 'express';
import { SessionGuard } from '../auth/guards/session.guard.js';
import { SiteOwnerGuard } from '../auth/guards/site-owner.guard.js';
import { CsrfGuard } from '../auth/guards/csrf.guard.js';
import { ConversationParamsDto, EmptyChatDto, StreamChatDto, TurnParamsDto } from './dto/chat.dto.js';
import { ChatService } from './chat.service.js';
import type { PreparedChat } from './chat.service.js';
import type { ChatTurn } from './types/chat.type.js';
import { ChatMemoryService } from './chat-memory.service.js';
import { CreateMemoryDto, MemoryParamsDto, UpdateMemoryDto } from './dto/chat-memory.dto.js';
import { ChatLogsService } from '../chat-logs/chat-logs.service.js';
import { chatErrorMessage } from '../chat-logs/utils/error-message.js';

// Session→Owner在类级执行，写入口再验CSRF；DTO完成后才进入持久化和流输出。
@Controller('chat')
@UseGuards(SessionGuard, SiteOwnerGuard)
export class ChatController {
  constructor(
    private readonly chat: ChatService,
    private readonly memories: ChatMemoryService,
    // 站主对话也写同一张日志表，后台可以统一观察公开对话与站主对话。
    private readonly logs: ChatLogsService,
  ) {}
  @Get('models') models() { return this.chat.catalog(); }
  // 记忆沿用同一Session/Owner/no-store边界；写入口独立校验CSRF，owner不接受客户端指定。
  @Get('memories') memoryList(@Req() request: Request) { return this.memories.list(request.authUser!.id); }
  @Post('memories') @UseGuards(CsrfGuard)
  memoryCreate(@Req() request: Request, @Body() input: CreateMemoryDto) { return this.memories.create(request.authUser!.id, input); }
  @Patch('memories/:id') @UseGuards(CsrfGuard)
  memoryUpdate(@Req() request: Request, @Param() params: MemoryParamsDto, @Body() input: UpdateMemoryDto) { return this.memories.update(request.authUser!.id, params.id, input); }
  @Delete('memories/:id') @UseGuards(CsrfGuard)
  memoryDelete(@Req() request: Request, @Param() params: MemoryParamsDto) { return this.memories.remove(request.authUser!.id, params.id); }
  @Get('conversations') list(@Req() request: Request) { return this.chat.list(request.authUser!.id); }
  @Post('conversations') @UseGuards(CsrfGuard)
  create(@Req() request: Request, @Body() _input: EmptyChatDto) { return this.chat.create(request.authUser!.id); }
  @Get('conversations/:id')
  detail(@Req() request: Request, @Param() params: ConversationParamsDto) { return this.chat.detail(request.authUser!.id, params.id); }
  @Post('conversations/:id/turns/:requestId/cancel') @HttpCode(200) @UseGuards(CsrfGuard)
  cancel(@Req() request: Request, @Param() params: TurnParamsDto, @Body() _input: EmptyChatDto) { return this.chat.cancel(request.authUser!.id, params.id, params.requestId); }
  @Post('conversations/:id/stream') @HttpCode(200) @UseGuards(CsrfGuard)
  async stream(@Req() request: Request, @Res() response: Response, @Param() params: ConversationParamsDto, @Body() input: StreamChatDto): Promise<void> {
    // 手工SSE让写头前受理失败保留标准JSON错误，并准确绑定response.close取消生成。
    const startedAt = Date.now();
    const logId = await this.logs.start({
      channel: 'owner',
      requestKey: input.requestId,
      conversationId: params.id,
      question: input.content,
      startedAt: new Date(startedAt),
    });
    void this.logs.trace(logId, { stage: 'request', status: 'started', detail: '已受理站主对话请求' });
    void this.logs.meta(logId, { requestedModelId: input.modelId });
    let prepared: PreparedChat;
    try {
      prepared = await this.chat.prepare(request.authUser!.id, params.id, input);
    } catch (error) {
      // prepare 阶段的 404/409/限流同样是一轮对话的失败结果，先终结日志再返回 HTTP 错误。
      await this.logs.trace(logId, {
        stage: 'request',
        status: 'failed',
        durationMs: Date.now() - startedAt,
        detail: chatErrorMessage(error, '对话未能开始，请稍后再试。'),
      });
      await this.logs.finish(logId, {
        status: 'failed',
        answer: '',
        error: chatErrorMessage(error, '对话未能开始，请稍后再试。'),
        durationMs: Date.now() - startedAt,
      });
      throw error;
    }
    await this.logs.attach(logId, prepared.conversationId, prepared.turn.requestId);
    await this.logs.meta(logId, {
      modelId: prepared.turn.modelId,
      modelLabel: prepared.turn.modelLabel,
      requestedModelId: prepared.turn.requestedModelId,
      requestedModelLabel: prepared.turn.requestedModelLabel,
      fallbackUsed: prepared.turn.modelId !== prepared.turn.requestedModelId,
    });
    await this.logs.trace(logId, {
      stage: 'request',
      status: 'completed',
      durationMs: Date.now() - startedAt,
      detail: '会话与轮次已创建',
    });
    // 以 done 事件里的 turn 为准，能覆盖 completed/failed/canceled/interrupted 全部终态。
    let finalTurn: ChatTurn = prepared.turn;
    let currentModelId = prepared.turn.modelId;
    let currentModelLabel = prepared.turn.modelLabel;
    let firstToken = false;
    let firstTokenMs: number | null = null;
    const modelStarted = Date.now();
    void this.logs.trace(logId, {
      stage: 'model.request',
      status: 'started',
      detail: `${prepared.turn.modelLabel}（${prepared.turn.modelId}）`,
    });
    const close = () => { void this.chat.disconnect(prepared); };
    response.on('close', close);
    if (response.destroyed) {
      await this.chat.disconnect(prepared);
      await this.logs.trace(logId, { stage: 'stream', status: 'failed', detail: '写入响应前客户端已断开' });
      await this.logs.finish(logId, { status: 'canceled', answer: '', durationMs: Date.now() - startedAt });
      return;
    }
    response.status(200).set({ 'Content-Type': 'text/event-stream; charset=utf-8', 'Cache-Control': 'no-store', 'X-Accel-Buffering': 'no', Connection: 'keep-alive' });
    response.flushHeaders();
    const heartbeat = setInterval(() => { if (!response.destroyed) response.write(': heartbeat\n\n'); }, 15000);
    try {
      await this.chat.stream(prepared, event => {
        if (event.type === 'done') finalTurn = event.turn;
        if (event.type === 'delta' && !firstToken) {
          firstToken = true;
          firstTokenMs = Date.now() - modelStarted;
          void this.logs.trace(logId, {
            stage: 'model.firstToken',
            status: 'completed',
            durationMs: firstTokenMs,
            detail: `${currentModelLabel}（${currentModelId}）`,
          });
          void this.logs.meta(logId, { firstTokenMs });
        }
        if (event.type === 'fallback') {
          currentModelId = event.turn.modelId;
          currentModelLabel = event.turn.modelLabel;
          void this.logs.trace(logId, {
            stage: 'model.fallback',
            status: 'completed',
            detail: `切换到备用模型 ${event.turn.modelLabel}（${event.turn.modelId}）`,
          });
          void this.logs.meta(logId, {
            modelId: event.turn.modelId,
            modelLabel: event.turn.modelLabel,
            fallbackUsed: true,
          });
        }
        if (!response.destroyed) response.write(`event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`);
      });
    } finally {
      clearInterval(heartbeat);
      response.off('close', close);
      if (!response.destroyed) response.end();
      // stream 正常会发出 done；若上游直接抛错导致没有终态，按 failed 收口，避免日志永远停在生成中。
      await this.logs.trace(logId, {
        stage: 'stream',
        status: finalTurn.status === 'completed' ? 'completed' : 'failed',
        durationMs: Date.now() - startedAt,
        detail: finalTurn.status === 'completed' ? '回答生成完成' : '生成未正常完成',
      });
      await this.logs.meta(logId, {
        modelId: finalTurn.modelId,
        modelLabel: finalTurn.modelLabel,
        ...(firstTokenMs !== null ? { firstTokenMs } : {}),
      });
      await this.logs.finish(logId, {
        status: finalTurn.status === 'streaming' ? 'failed' : finalTurn.status,
        answer: finalTurn.answer,
        error: finalTurn.status === 'streaming' ? '对话生成中断，未记录终态' : finalTurn.error,
        durationMs: Date.now() - startedAt,
      });
    }
  }
}
