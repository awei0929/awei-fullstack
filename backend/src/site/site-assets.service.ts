import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { SiteUpload } from './types/site.type.js';
import { detectSiteAudio } from './validation/site-audio.js';

// 新上传仅接受音频，独立媒体存储不修改官网配置；浏览器保存全部时才会引用新URL。
// 不相信客户端文件名和Content-Type，先验证实际签名，再使用随机名写入受控目录。
@Injectable()
export class SiteAssetsService {
  constructor(private readonly config: ConfigService) {}
  private directory(): string {
    return resolve(this.config.get<string>('SITE_ASSETS_DIR') || fileURLToPath(new URL('../../.data/site-assets', import.meta.url)));
  }
  async uploadAudio(file?: SiteUpload): Promise<{ url: string }> {
    if (!file?.buffer || file.size === 0 || file.size > 15 * 1024 * 1024) throw new BadRequestException('请选择不超过15MiB的MP3、WAV或OGG音频');
    const type = detectSiteAudio(file.buffer);
    if (!type || !type.acceptedMimes.includes(file.mimetype)) throw new BadRequestException('音频类型与实际文件内容不符，仅支持MP3、WAV和音频OGG');
    return this.write(file.buffer, type.extension);
  }
  private async write(data: Buffer, extension: string): Promise<{ url: string }> {
    const filename = `${randomUUID()}.${extension}`;
    await mkdir(this.directory(), { recursive: true });
    // wx禁止覆盖同名文件，即便随机UUID极小概率重复，也不覆盖已有资产。
    await writeFile(resolve(this.directory(), filename), data, { flag: 'wx' });
    return { url: `/api/site/assets/${filename}` };
  }
  // 历史图片与现有音频继续只读提供，不因移除封面编辑而删除旧媒体。
  async read(filename: string): Promise<{ data: Buffer; mime: string }> {
    if (!/^[a-f\d]{8}-[a-f\d]{4}-4[a-f\d]{3}-[89ab][a-f\d]{3}-[a-f\d]{12}\.(png|jpg|webp|mp3|wav|ogg)$/.test(filename)) throw new BadRequestException('媒体文件名无效');
    try {
      const types: Record<string, string> = { png: 'image/png', jpg: 'image/jpeg', webp: 'image/webp', mp3: 'audio/mpeg', wav: 'audio/wav', ogg: 'audio/ogg' };
      return { data: await readFile(resolve(this.directory(), filename)), mime: types[filename.split('.').at(-1)!]! };
    } catch (error) {
      if (typeof error === 'object' && error !== null && 'code' in error && error.code === 'ENOENT') throw new NotFoundException('媒体不存在');
      throw error;
    }
  }
}
