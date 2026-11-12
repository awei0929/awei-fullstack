import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Req, Res, UseGuards } from '@nestjs/common';
import type { Request, Response } from 'express';
import { SessionGuard } from '../auth/guards/session.guard.js';
import { SiteOwnerGuard } from '../auth/guards/site-owner.guard.js';
import { CsrfGuard } from '../auth/guards/csrf.guard.js';
import { ConversationParamsDto, EmptyChatDto, StreamChatDto, TurnParamsDto } from './dto/chat.dto.js';
import { ChatService } from './chat.service.js';
import { ChatMemoryService } from './chat-memory.service.js';
import { CreateMemoryDto, MemoryParamsDto, UpdateMemoryDto } from './dto/chat-memory.dto.js';

// Session→Owner在类级执行，写入口再验CSRF；DTO完成后才进入持久化和流输出。
@Controller('chat')
@UseGuards(SessionGuard, SiteOwnerGuard)
export class ChatController {
  constructor(private readonly chat: ChatService, private readonly memories: ChatMemoryService) {}
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
    const prepared = await this.chat.prepare(request.authUser!.id, params.id, input);
    const close = () => { void this.chat.disconnect(prepared); };
    response.on('close', close);
    if (response.destroyed) { await this.chat.disconnect(prepared); return; }
    response.status(200).set({ 'Content-Type': 'text/event-stream; charset=utf-8', 'Cache-Control': 'no-store', 'X-Accel-Buffering': 'no', Connection: 'keep-alive' });
    response.flushHeaders();
    const heartbeat = setInterval(() => { if (!response.destroyed) response.write(': heartbeat\n\n'); }, 15000);
    try { await this.chat.stream(prepared, event => { if (!response.destroyed) response.write(`event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`); }); }
    finally { clearInterval(heartbeat); response.off('close', close); if (!response.destroyed) response.end(); }
  }
}
