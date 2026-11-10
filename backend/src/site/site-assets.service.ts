import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'node:crypto';
import { constants } from 'node:fs';
import { mkdir, open, unlink } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { SiteFileAsset, SiteUpload } from './types/site.type.js';
import { detectSiteAudio } from './validation/site-audio.js';
import { detectSiteFile, sanitizeSiteFilename, siteFileType } from './validation/site-file.js';

// 上传图片、下载附件与音频属于同一官网媒体业务；独立磁盘存储不修改官网配置。
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
  async uploadFile(file?: SiteUpload): Promise<SiteFileAsset> {
    if (!file?.buffer || file.buffer.length === 0) throw new BadRequestException('请选择非空图片或附件');
    const name = sanitizeSiteFilename(file.originalname ?? '');
    const type = detectSiteFile(file.buffer, name);
    if (!type) throw new BadRequestException('文件扩展名与实际内容不符，或文件格式不受支持');
    const size = file.buffer.length, limit = type.kind === 'image' ? 5 * 1024 * 1024 : 20 * 1024 * 1024;
    if (size > limit) throw new BadRequestException(type.kind === 'image' ? '图片不能超过5MiB' : '附件不能超过20MiB');
    const stored = await this.write(file.buffer, type.extension, type.kind === 'attachment' ? name : undefined);
    return { url: stored.url, name, mimeType: type.mime, size, kind: type.kind };
  }
  private async write(data: Buffer, extension: string, downloadName?: string): Promise<{ url: string }> {
    const filename = `${randomUUID()}.${extension}`;
    const directory = this.directory(), path = resolve(directory, filename), metadataPath = `${path}.json`;
    await mkdir(directory, { recursive: true });
    // wx禁止覆盖同名文件，即便随机UUID极小概率重复，也不覆盖已有资产。
    // 显式open之后才取得清理所有权；任何写入/关闭失败只删除本请求创建的文件，不能删到旧资产。
    let createdFile = false, createdMetadata = false;
    try {
      const handle = await open(path, 'wx', 0o600); createdFile = true;
      try { await handle.writeFile(data); } finally { await handle.close(); }
      if (downloadName) {
        const metadata = await open(metadataPath, 'wx', 0o600); createdMetadata = true;
        try { await metadata.writeFile(JSON.stringify({ name: downloadName }), 'utf8'); } finally { await metadata.close(); }
      }
    } catch (error) {
      // 数据和原名元数据属于一次上传；正常I/O失败尽力回滚，错误交给全局过滤器返回无内部细节的500。
      await Promise.allSettled([...(createdFile ? [unlink(path)] : []), ...(createdMetadata ? [unlink(metadataPath)] : [])]);
      throw error;
    }
    return { url: `/api/site/assets/${filename}` };
  }
  // 元数据只用于下载名；缺失、损坏、超大或不可读时回退随机文件名，不阻断历史媒体访问。
  private async downloadName(path: string, fallback: string): Promise<string> {
    try {
      const handle = await open(`${path}.json`, constants.O_RDONLY | constants.O_NOFOLLOW);
      try {
        const stat = await handle.stat();
        if (!stat.isFile() || stat.size > 4096) return fallback;
        const value: unknown = JSON.parse(await handle.readFile('utf8'));
        if (typeof value === 'object' && value !== null && 'name' in value && typeof value.name === 'string') {
          return sanitizeSiteFilename(value.name) || fallback;
        }
      } finally { await handle.close(); }
    } catch { /* 文件仍然可下载；不让可选显示元数据改变访问控制。 */ }
    return fallback;
  }
  // UUID和扩展名均受控，附件不会作为HTML或内联脚本展示；旧图片/音频无需元数据。
  async read(filename: string): Promise<{ data: Buffer; mime: string; downloadName?: string }> {
    if (!/^[a-f\d]{8}-[a-f\d]{4}-4[a-f\d]{3}-[89ab][a-f\d]{3}-[a-f\d]{12}\.(png|jpg|webp|mp3|wav|ogg|pdf|zip|txt|docx|xlsx|pptx)$/.test(filename)) throw new BadRequestException('媒体文件名无效');
    try {
      const extension = filename.split('.').at(-1)!, type = siteFileType(extension);
      const audioMimes: Record<string, string> = { mp3: 'audio/mpeg', wav: 'audio/wav', ogg: 'audio/ogg' };
      const path = resolve(this.directory(), filename), handle = await open(path, constants.O_RDONLY | constants.O_NOFOLLOW);
      let data: Buffer;
      try {
        if (!(await handle.stat()).isFile()) throw new NotFoundException('媒体不存在');
        data = await handle.readFile();
      } finally { await handle.close(); }
      return { data, mime: type?.mime ?? audioMimes[extension]!, ...(type?.kind === 'attachment' ? { downloadName: await this.downloadName(path, filename) } : {}) };
    } catch (error) {
      if (typeof error === 'object' && error !== null && 'code' in error && ['ENOENT', 'ELOOP'].includes(String(error.code))) throw new NotFoundException('媒体不存在');
      throw error;
    }
  }
}
