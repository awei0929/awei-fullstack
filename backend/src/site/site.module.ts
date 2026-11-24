import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AuthModule } from '../auth/auth.module.js';
import { ChatModule } from '../chat/chat.module.js';
import { SiteController } from './site.controller.js';
import { SiteChatController } from './site-chat.controller.js';
import { SiteService } from './site.service.js';
import { SiteAssetsService } from './site-assets.service.js';
import { SiteChatService } from './chat/site-chat.service.js';
import { SiteChatGraph } from './chat/agent/site-chat.graph.js';
import { SiteChatConfig } from './chat/site-chat.config.js';
import { SiteChatLimiter } from './chat/site-chat.limiter.js';
import { SiteRecord, SiteRecordSchema } from './schemas/site.schema.js';
import { SiteChatConversationRecord, SiteChatConversationSchema } from './chat/schemas/site-chat-conversation.schema.js';
import { SiteChatRepository } from './chat/site-chat.repository.js';

// 官网作为独立业务模块，通过imports复用认证与聊天适配器，不重新注册会话或模型配置。
@Module({
  imports: [AuthModule, ChatModule, MongooseModule.forFeature([
    { name: SiteRecord.name, schema: SiteRecordSchema },
    { name: SiteChatConversationRecord.name, schema: SiteChatConversationSchema },
  ])],
  controllers: [SiteController, SiteChatController],
  providers: [SiteService, SiteAssetsService, SiteChatService, SiteChatConfig, SiteChatLimiter, SiteChatRepository, SiteChatGraph],
})
export class SiteModule {}
