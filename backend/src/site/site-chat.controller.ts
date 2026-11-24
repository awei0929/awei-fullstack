import { Body, Controller, Delete, Get, Headers, HttpCode, NotFoundException, Param, Post, Req, Res } from '@nestjs/common';
import type { Request, Response } from 'express';
import { PublicChatDto } from './dto/public-chat.dto.js';
import { SiteChatService } from './chat/site-chat.service.js';
import { SiteChatRepository } from './chat/site-chat.repository.js';
import { hashVisitor, isUuid, isVisitorId } from './chat/site-chat.types.js';

// 公开对话不挂Session/Owner/CSRF守卫；入口只接收问题与最近上下文，模型与提示词全部由服务端决定。
@Controller('site-chat')
export class SiteChatController {
  constructor(
    private readonly chat: SiteChatService,
    private readonly repository: SiteChatRepository,
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

  @Post('stream')
  @HttpCode(200)
  async stream(@Req() request: Request, @Res() response: Response, @Body() input: PublicChatDto): Promise<void> {
    // 受理失败（关闭、限流、无模型Key）仍返回标准JSON错误，不会先写出200再报错。
    const prepared = await this.chat.prepare(input, request.ip || request.socket.remoteAddress || 'unknown');
    const controller = new AbortController();
    const close = () => controller.abort();
    response.on('close', close);
    if (response.destroyed) { controller.abort(); return; }
    response.status(200).set({
      'Content-Type': 'text/event-stream; charset=utf-8', 'Cache-Control': 'no-store',
      'X-Accel-Buffering': 'no', Connection: 'keep-alive',
    });
    response.flushHeaders();
    const heartbeat = setInterval(() => { if (!response.destroyed) response.write(': heartbeat\n\n'); }, 15000);
    try {
      for await (const text of this.chat.stream(prepared, controller.signal)) {
        if (response.destroyed) break;
        response.write(`event: delta\ndata: ${JSON.stringify({ type: 'delta', text })}\n\n`);
      }
      if (!response.destroyed) response.write(`event: done\ndata: ${JSON.stringify({ type: 'done' })}\n\n`);
    } catch (error) {
      if (!response.destroyed) {
        const message = error instanceof Error && error.message ? error.message : '对话暂时不可用，请稍后再试。';
        response.write(`event: error\ndata: ${JSON.stringify({ type: 'error', message })}\n\n`);
      }
    } finally {
      clearInterval(heartbeat);
      response.off('close', close);
      if (!response.destroyed) response.end();
    }
  }

  private notFound(): NotFoundException {
    return new NotFoundException({ message: '会话不存在', code: 'SITE_CHAT_CONVERSATION_NOT_FOUND' });
  }
}
