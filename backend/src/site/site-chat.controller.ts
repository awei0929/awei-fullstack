import { BadRequestException, Body, Controller, Delete, Get, Headers, HttpCode, NotFoundException, Param, Post, Req, Res } from '@nestjs/common';
import type { Request, Response } from 'express';
import { PublicChatDto } from './dto/public-chat.dto.js';
import { SiteChatService } from './chat/site-chat.service.js';
import type { PreparedPublicChat } from './chat/site-chat.service.js';
import { SiteChatConfig } from './chat/site-chat.config.js';
import { SiteChatRepository } from './chat/site-chat.repository.js';
import { createSseWriter } from './chat/site-chat.sse.js';
import { hashVisitor, isUuid, isVisitorId } from './chat/site-chat.types.js';
import { ChatLogsService } from '../chat-logs/chat-logs.service.js';
import { chatErrorMessage } from '../chat-logs/utils/error-message.js';

// 公开对话不挂Session/Owner/CSRF守卫；入口只接收问题与会话ID，模型与提示词全部由服务端决定。
@Controller('site-chat')
export class SiteChatController {
  constructor(
    private readonly chat: SiteChatService,
    private readonly config: SiteChatConfig,
    private readonly repository: SiteChatRepository,
    // 日志是旁路依赖：只写观测数据，不参与对话是否成功的判断。
    private readonly logs: ChatLogsService,
  ) {}

  @Get()
  status() { return this.chat.status(); }

  @Get('conversations')
  async list(@Headers('x-visitor-id') visitor?: string) {
    // 缺失或格式错误的 visitor 不创建数据，直接返回空列表；列表不是认证接口。
    if (!isVisitorId(visitor)) return { conversations: [] };
    return { conversations: await this.repository.list(hashVisitor(visitor)) };
  }

  @Get('conversations/:id')
  async detail(@Headers('x-visitor-id') visitor: string | undefined, @Param('id') id: string) {
    // 无效 ID 与“不属于当前 visitor”使用同一个 404，避免泄露会话是否存在。
    if (!isVisitorId(visitor) || !isUuid(id)) throw this.notFound();
    const view = await this.repository.get(hashVisitor(visitor), id);
    if (!view) throw this.notFound();
    return view;
  }

  @Delete('conversations/:id')
  @HttpCode(204)
  async remove(@Headers('x-visitor-id') visitor: string | undefined, @Param('id') id: string): Promise<void> {
    if (!isVisitorId(visitor) || !isUuid(id)) throw this.notFound();
    const removed = await this.repository.remove(hashVisitor(visitor), id);
    if (!removed) throw this.notFound();
  }

  @Post('conversations')
  @HttpCode(200)
  async streamNew(
    @Req() request: Request,
    @Res() response: Response,
    @Body() input: PublicChatDto,
    @Headers('x-visitor-id') visitor?: string,
  ): Promise<void> {
    return this.streamTurn(request, response, input, visitor);
  }

  @Post('conversations/:conversationId/messages')
  @HttpCode(200)
  async streamMessage(
    @Req() request: Request,
    @Res() response: Response,
    @Body() input: PublicChatDto,
    @Param('conversationId') conversationId: string,
    @Headers('x-visitor-id') visitor?: string,
  ): Promise<void> {
    // 路径是会话归属的唯一来源；格式错误与越权都走 404，避免枚举。
    if (!isUuid(conversationId)) throw this.notFound();
    return this.streamTurn(request, response, input, visitor, conversationId);
  }

  private async streamTurn(
    request: Request,
    response: Response,
    input: PublicChatDto,
    visitor?: string,
    conversationId?: string,
  ): Promise<void> {
    // 受理失败（访客标识、关闭、限流、无模型Key）仍返回标准JSON错误，不会先写出200再报错。
    if (!isVisitorId(visitor)) {
      throw new BadRequestException({ message: '缺少有效的匿名访客标识。', code: 'SITE_CHAT_VISITOR_REQUIRED' });
    }
    // 从受理瞬间开始计时，覆盖限流/建会话等受理失败，也覆盖后续模型生成。
    // requestId 是每轮唯一的幂等键，重试同一轮时日志只保留一条。
    const startedAt = Date.now();
    const logId = await this.logs.start({
      channel: 'site',
      requestKey: input.requestId,
      conversationId: conversationId ?? null,
      question: input.message,
      startedAt: new Date(startedAt),
    });
    let prepared: PreparedPublicChat;
    try {
      prepared = await this.chat.begin(
        { ...input, ...(conversationId ? { conversationId } : {}) },
        visitor,
        request.ip || request.socket.remoteAddress || 'unknown',
      );
    } catch (error) {
      // 受理失败也要留下这一轮日志，错误文案与返回给访客的安全文案一致。
      await this.logs.finish(logId, {
        status: 'failed',
        answer: '',
        error: chatErrorMessage(error, '对话未能开始，请稍后再试。'),
        durationMs: Date.now() - startedAt,
      });
      throw error;
    }
    await this.logs.attach(logId, prepared.conversationId, prepared.turnId);
    const controller = new AbortController();
    let settled = false;
    let clientGone = false;
    const disconnect = () => {
      if (settled) return;
      clientGone = true;
      controller.abort();
    };
    // 浏览器取消 fetch 时最先变化的是连接，不一定立刻反映在 response.destroyed 上。
    request.socket.on('close', disconnect);
    response.on('close', disconnect);
    const writer = createSseWriter(response, {
      turnId: prepared.turnId,
      pingMs: this.config.pingMs(),
      onClose: () => controller.abort(),
    });
    await writer.start({ conversationId: prepared.conversationId, turnId: prepared.turnId, requestId: input.requestId });
    if (clientGone || response.destroyed) {
      await this.repository.finishTurn(prepared.visitorHash, prepared.conversationId, prepared.turnId, 'canceled');
      await this.logs.finish(logId, { status: 'canceled', answer: '', durationMs: Date.now() - startedAt });
      writer.close();
      return;
    }

    // 幂等重放：该轮已经完成，不调用模型，也不重复写库。
    if (prepared.answer !== undefined) {
      if (prepared.answer) await writer.delta(prepared.answer);
      await this.logs.finish(logId, {
        status: 'completed',
        answer: prepared.answer,
        durationMs: Date.now() - startedAt,
      });
      await writer.done({ conversationId: prepared.conversationId, turnId: prepared.turnId });
      return;
    }

    let answer = '';
    let lastSaved = 0;
    const finish = async (status: 'completed' | 'failed' | 'canceled', error?: string | null) => {
      if (settled) return;
      settled = true;
      try {
        await this.repository.finishTurn(prepared.visitorHash, prepared.conversationId, prepared.turnId, status, error);
      } finally {
        // 即使会话落库失败，也要把已生成内容和耗时写进日志，保证这一轮可观测。
        await this.logs.finish(logId, {
          status,
          answer,
          error: error ?? null,
          durationMs: Date.now() - startedAt,
        });
      }
    };

    try {
      for await (const text of this.chat.stream(prepared, controller.signal)) {
        if (clientGone || controller.signal.aborted || response.destroyed) break;
        answer += text;
        await writer.delta(text);
        // 每 500ms 落一次增量，刷新页面时至少能看到已经生成的部分；最终终态再写一次完整正文。
        if (Date.now() - lastSaved >= 500) {
          lastSaved = Date.now();
          await this.repository.appendAnswer(prepared.visitorHash, prepared.conversationId, prepared.turnId, answer);
        }
      }
      if (clientGone || controller.signal.aborted || response.destroyed) {
        await this.repository.appendAnswer(prepared.visitorHash, prepared.conversationId, prepared.turnId, answer);
        await finish('canceled');
        return;
      }
      await this.repository.appendAnswer(prepared.visitorHash, prepared.conversationId, prepared.turnId, answer);
      await finish('completed');
      await writer.done({ conversationId: prepared.conversationId, turnId: prepared.turnId });
    } catch (error) {
      const message = error instanceof Error && error.message ? error.message : '对话暂时不可用，请稍后再试。';
      if (clientGone || controller.signal.aborted || response.destroyed) {
        await this.repository.appendAnswer(prepared.visitorHash, prepared.conversationId, prepared.turnId, answer);
        await finish('canceled');
        return;
      }
      await this.repository.appendAnswer(prepared.visitorHash, prepared.conversationId, prepared.turnId, answer);
      // 后台日志保留可用于排查的具体错误；返回给匿名访客的仍然是安全文案。
      await finish('failed', chatErrorMessage(error, message));
      await writer.error({ code: 'SITE_CHAT_UPSTREAM', message, retryable: true });
    } finally {
      request.socket.off('close', disconnect);
      response.off('close', disconnect);
      writer.close();
    }
  }

  private notFound(): NotFoundException {
    return new NotFoundException({ message: '会话不存在', code: 'SITE_CHAT_CONVERSATION_NOT_FOUND' });
  }
}
