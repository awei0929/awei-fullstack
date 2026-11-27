import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { SessionGuard } from '../auth/guards/session.guard.js';
import { SiteOwnerGuard } from '../auth/guards/site-owner.guard.js';
import { ChatLogsService } from './chat-logs.service.js';
import { ListChatLogsDto } from './dto/list-chat-logs.dto.js';
import type { ChatLogPage } from './types/chat-log.type.js';

// 日志只给站主看：Session → Owner 与官网管理入口一致，日志包含访客提问与回答，不能匿名读取。
@Controller('chat-logs')
@UseGuards(SessionGuard, SiteOwnerGuard)
export class ChatLogsController {
  constructor(private readonly logs: ChatLogsService) {}

  @Get()
  list(@Query() query: ListChatLogsDto): Promise<ChatLogPage> {
    return this.logs.list(query);
  }
}
