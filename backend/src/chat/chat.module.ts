import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AuthModule } from '../auth/auth.module.js';
import { ChatController } from './chat.controller.js';
import { ChatService } from './chat.service.js';
import { ChatConfig } from './config/chat.config.js';
import { ChatCompletionsProvider } from './providers/chat-completions.provider.js';
import { ConversationRecord, ConversationSchema } from './schemas/conversation.schema.js';
import { ChatMemoryRecord, ChatMemorySchema } from './schemas/chat-memory.schema.js';
import { ChatMemoryService } from './chat-memory.service.js';

// 独立聊天模块通过AuthModule复用认证，不依赖官网内容或把历史写进SiteContent。
@Module({
  imports: [AuthModule, MongooseModule.forFeature([
    { name: ConversationRecord.name, schema: ConversationSchema },
    { name: ChatMemoryRecord.name, schema: ChatMemorySchema },
  ])],
  controllers: [ChatController],
  providers: [ChatService, ChatMemoryService, ChatConfig, ChatCompletionsProvider],
})
export class ChatModule {}
