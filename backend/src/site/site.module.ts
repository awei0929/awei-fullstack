import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AuthModule } from '../auth/auth.module.js';
import { SiteController } from './site.controller.js';
import { SiteService } from './site.service.js';
import { SiteAssetsService } from './site-assets.service.js';
import { SiteRecord, SiteRecordSchema } from './schemas/site.schema.js';

// 官网作为独立业务模块，通过imports复用认证，不重新注册会话或用户服务。
@Module({
  imports: [AuthModule, MongooseModule.forFeature([{ name: SiteRecord.name, schema: SiteRecordSchema }])],
  controllers: [SiteController], providers: [SiteService, SiteAssetsService],
})
export class SiteModule {}
