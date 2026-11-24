import { Body, Controller, Get, Param, Post, Put, Query, Res, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import type { Response } from 'express';
import { SiteAudioUploadInterceptor } from './interceptors/site-audio-upload.interceptor.js';
import { SiteFileUploadInterceptor } from './interceptors/site-file-upload.interceptor.js';
import { SessionGuard } from '../auth/guards/session.guard.js';
import { CsrfGuard } from '../auth/guards/csrf.guard.js';
import { SiteOwnerGuard } from './guards/site-owner.guard.js';
import { SaveSiteDto } from './dto/save-site.dto.js';
import { SiteService } from './site.service.js';
import { SiteAssetsService } from './site-assets.service.js';
import type { SiteContent, SiteDocument, SiteFileAsset, SiteUpload } from './types/site.type.js';

type SiteResponse = Omit<SiteDocument, 'content'> & { content: Omit<SiteContent, 'resume'> & Partial<Pick<SiteContent, 'resume'>> };

// 已打开的旧前端校验固定响应字段。由新版读取显式选择简历，提交简历时一同返回保存结果。
function siteResponse(document: SiteDocument, includeResume: boolean): SiteResponse {
  if (includeResume) return document;
  const { resume: _resume, ...content } = document.content;
  return { ...document, content };
}

// 公开读取经过隐藏项目投影，受控管理保留完整文档；管理入口显式列出Session→Owner→CSRF顺序。
@Controller('site')
export class SiteController {
  constructor(private readonly site: SiteService, private readonly assets: SiteAssetsService) {}
  @Get()
  async publicSite(@Query('include') include?: string): Promise<SiteResponse> {
    return siteResponse(await this.site.readPublic(), include === 'resume');
  }
  @Get('config')
  @UseGuards(SessionGuard, SiteOwnerGuard)
  async config(@Query('include') include?: string): Promise<SiteResponse> {
    return siteResponse(await this.site.read(), include === 'resume');
  }
  @Put('config')
  @UseGuards(SessionGuard, SiteOwnerGuard, CsrfGuard)
  async save(@Body() input: SaveSiteDto): Promise<SiteResponse> {
    return siteResponse(await this.site.save(input.version, input.content), input.content.resume !== undefined);
  }
  @Post('audio-assets')
  @UseGuards(SessionGuard, SiteOwnerGuard, CsrfGuard)
  // Guard先于文件解析执行；未授权请求不会触及媒体存储。
  @UseInterceptors(SiteAudioUploadInterceptor)
  uploadAudio(@UploadedFile() file?: SiteUpload): Promise<{ url: string }> { return this.assets.uploadAudio(file); }
  @Post('file-assets')
  @UseGuards(SessionGuard, SiteOwnerGuard, CsrfGuard)
  @UseInterceptors(SiteFileUploadInterceptor)
  uploadFile(@UploadedFile() file?: SiteUpload): Promise<SiteFileAsset> { return this.assets.uploadFile(file); }
  @Get('assets/:filename')
  async asset(@Param('filename') filename: string, @Res() response: Response): Promise<void> {
    const file = await this.assets.read(filename);
    response.setHeader('Content-Type', file.mime);
    response.setHeader('X-Content-Type-Options', 'nosniff');
    if (file.downloadName) {
      // ASCII回退名去除引号/反斜杠；RFC5987参数编码原Unicode名，不能拼接原始请求头值。
      const fallback = file.downloadName.replace(/[^\x20-\x7e]|["\\]/g, '_');
      const encoded = encodeURIComponent(file.downloadName).replace(/['()*]/g, character => `%${character.charCodeAt(0).toString(16).toUpperCase()}`);
      response.setHeader('Content-Disposition', `attachment; filename="${fallback}"; filename*=UTF-8''${encoded}`);
    }
    response.send(file.data);
  }
}
