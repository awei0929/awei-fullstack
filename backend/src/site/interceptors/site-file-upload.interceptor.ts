import { BadRequestException, Injectable, PayloadTooLargeException } from '@nestjs/common';
import type { CallHandler, ExecutionContext } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Observable } from 'rxjs';

// Guard先做身份与CSRF，再在内存解析唯一file；内容校验通过前不创建任何磁盘文件。
// 最大附件20MiB多留1字节由Service精确判断；图片使用独立5MiB业务上限。
const UploadBase = FileInterceptor('file', { limits: { fileSize: 20 * 1024 * 1024 + 1, files: 1, fields: 0, parts: 2 } });
@Injectable()
export class SiteFileUploadInterceptor extends UploadBase {
  async intercept(context: ExecutionContext, next: CallHandler): Promise<Observable<unknown>> {
    try { return await super.intercept(context, next); }
    catch (error) {
      if (error instanceof PayloadTooLargeException) throw new BadRequestException('附件不能超过20MiB，图片不能超过5MiB');
      throw error;
    }
  }
}
