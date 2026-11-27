import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AuthModule } from '../auth/auth.module.js';
import { ChatLogsController } from './chat-logs.controller.js';
import { ChatLogsService } from './chat-logs.service.js';
import { ChatLogRecord, ChatLogSchema } from './schemas/chat-log.schema.js';

// 对话日志是跨聊天入口的观测模块：公开对话和站主对话都写入同一集合，
// 管理端只在这里暴露受 Session/Owner 保护的查询接口，其他模块只注入写入服务。
@Module({
  imports: [AuthModule, MongooseModule.forFeature([{ name: ChatLogRecord.name, schema: ChatLogSchema }])],
  controllers: [ChatLogsController],
  providers: [ChatLogsService],
  exports: [ChatLogsService],
})
export class ChatLogsModule {}
