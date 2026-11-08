import { Body, Controller, Get, Param, Post, Put, Res, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import type { Response } from 'express';
import { SiteAudioUploadInterceptor } from './interceptors/site-audio-upload.interceptor.js';
import { SessionGuard } from '../auth/guards/session.guard.js';
import { CsrfGuard } from '../auth/guards/csrf.guard.js';
import { SiteOwnerGuard } from './guards/site-owner.guard.js';
import { SaveSiteDto } from './dto/save-site.dto.js';
import { SiteService } from './site.service.js';
import { SiteAssetsService } from './site-assets.service.js';
import type { SiteDocument, SiteUpload } from './types/site.type.js';

// 公开读取经过隐藏项目投影，受控管理保留完整文档；管理入口显式列出Session→Owner→CSRF顺序。
@Controller('site')
export class SiteController {
  constructor(private readonly site: SiteService, private readonly assets: SiteAssetsService) {}
  @Get()
  publicSite(): Promise<SiteDocument> { return this.site.readPublic(); }
  @Get('config')
  @UseGuards(SessionGuard, SiteOwnerGuard)
  config(): Promise<SiteDocument> { return this.site.read(); }
  @Put('config')
  @UseGuards(SessionGuard, SiteOwnerGuard, CsrfGuard)
  save(@Body() input: SaveSiteDto): Promise<SiteDocument> { return this.site.save(input.version, input.content); }
  @Post('audio-assets')
  @UseGuards(SessionGuard, SiteOwnerGuard, CsrfGuard)
  // Guard先于文件解析执行；未授权请求不会触及媒体存储。
  @UseInterceptors(SiteAudioUploadInterceptor)
  uploadAudio(@UploadedFile() file?: SiteUpload): Promise<{ url: string }> { return this.assets.uploadAudio(file); }
  @Get('assets/:filename')
  async asset(@Param('filename') filename: string, @Res() response: Response): Promise<void> {
    const file = await this.assets.read(filename);
    response.setHeader('Content-Type', file.mime);
    response.setHeader('X-Content-Type-Options', 'nosniff');
    response.send(file.data);
  }
}
