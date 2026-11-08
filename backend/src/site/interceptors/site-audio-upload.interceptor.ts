import { BadRequestException, Injectable, PayloadTooLargeException } from '@nestjs/common';
import type { CallHandler, ExecutionContext } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Observable } from 'rxjs';

// 音频以15MiB为解析上限；多留1字节交给业务层核对精确边界。
const UploadBase = FileInterceptor('file', {
  limits: { fileSize: 15 * 1024 * 1024 + 1, files: 1, fields: 0, parts: 2 },
  fileFilter: (_request, file, callback) => {
    if (!['audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/x-wav', 'audio/wave', 'audio/vnd.wave', 'audio/ogg', 'application/ogg'].includes(file.mimetype)) return callback(new BadRequestException('仅支持MP3、WAV和OGG音频'), false);
    callback(null, true);
  },
});
@Injectable()
export class SiteAudioUploadInterceptor extends UploadBase {
  async intercept(context: ExecutionContext, next: CallHandler): Promise<Observable<unknown>> {
    try { return await super.intercept(context, next); }
    catch (error) {
      // 非法上传统一400；不把磁盘等内部故障伪装成格式错误。
      if (error instanceof PayloadTooLargeException) throw new BadRequestException('音频不能超过15MiB');
      throw error;
    }
  }
}
