import { Controller, Get, Param, ParseUUIDPipe, Query, UseGuards } from '@nestjs/common';
import { SessionGuard } from '../auth/guards/session.guard.js';
import { SiteOwnerGuard } from '../auth/guards/site-owner.guard.js';
import { ChatLogsService } from './chat-logs.service.js';
import { ListChatLogsDto } from './dto/list-chat-logs.dto.js';
import type { ChatLogDetail, ChatLogPage } from './types/chat-log.type.js';

// 日志只给站主看：Session → Owner 与官网管理入口一致，日志包含访客提问与回答，不能匿名读取。
@Controller('chat-logs')
@UseGuards(SessionGuard, SiteOwnerGuard)
export class ChatLogsController {
  constructor(private readonly logs: ChatLogsService) {}

  @Get()
  list(@Query() query: ListChatLogsDto): Promise<ChatLogPage> {
    return this.logs.list(query);
  }

  // 轨迹是详情才需要的重字段；ID 由服务端生成的 UUID，格式错误直接 400。
  @Get(':id')
  detail(@Param('id', new ParseUUIDPipe({ version: '4' })) id: string): Promise<ChatLogDetail> {
    return this.logs.detail(id);
  }
}
