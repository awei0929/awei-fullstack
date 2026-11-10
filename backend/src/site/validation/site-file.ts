import { extname } from 'node:path';
import { TextDecoder } from 'node:util';

// 白名单同时决定写盘扩展名、公开响应MIME和下载方式，不采用客户端Content-Type。
// 签名校验不等于完整解码或病毒扫描；Office仅承诺ZIP容器与扩展名一致。
export type SiteFileType = { extension: string; mime: string; kind: 'image' | 'attachment' };
const types: Record<string, SiteFileType> = {
  jpg: { extension: 'jpg', mime: 'image/jpeg', kind: 'image' },
  jpeg: { extension: 'jpg', mime: 'image/jpeg', kind: 'image' },
  png: { extension: 'png', mime: 'image/png', kind: 'image' },
  webp: { extension: 'webp', mime: 'image/webp', kind: 'image' },
  pdf: { extension: 'pdf', mime: 'application/pdf', kind: 'attachment' },
  zip: { extension: 'zip', mime: 'application/zip', kind: 'attachment' },
  txt: { extension: 'txt', mime: 'text/plain', kind: 'attachment' },
  docx: { extension: 'docx', mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', kind: 'attachment' },
  xlsx: { extension: 'xlsx', mime: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', kind: 'attachment' },
  pptx: { extension: 'pptx', mime: 'application/vnd.openxmlformats-officedocument.presentationml.presentation', kind: 'attachment' },
};

// 普通对象含constructor等继承键；白名单必须只读取自有项，不能让ZIP借原型名称通过。
export function siteFileType(extension: string): SiteFileType | undefined { return Object.hasOwn(types, extension) ? types[extension] : undefined; }

export function sanitizeSiteFilename(input: string): string {
  let decoded = input;
  // multipart默认latin1读取filename；浏览器实际上发UTF-8。只在能无损解码时恢复中文，避免损坏已有Unicode。
  if (Array.from(input).every(character => character.charCodeAt(0) <= 255)) {
    try { decoded = new TextDecoder('utf-8', { fatal: true }).decode(Buffer.from(input, 'latin1')); } catch { /* 保留原始合法字符。 */ }
  }
  // JSON元数据也可能被人工损坏；UTF-8往返把孤立代理项正规化，避免编码下载头时抛错。
  const leaf = Buffer.from(decoded, 'utf8').toString('utf8').split(/[\\/]/).at(-1) ?? '';
  // 目录、C0/C1控制字符及双向文本覆盖符不得进入界面或Content-Disposition。
  const clean = leaf.replace(/[\u0000-\u001f\u007f-\u009f\u202a-\u202e\u2066-\u2069]/g, '').trim();
  const characters = Array.from(clean), extension = extname(clean);
  if (characters.length <= 150) return clean;
  // 长原名保留扩展名，避免有效附件因显示名截断而丢失类型或下载后无法识别。
  const extensionLength = Array.from(extension).length;
  return extensionLength < 150 ? characters.slice(0, 150 - extensionLength).join('') + extension : characters.slice(0, 150).join('');
}

function isZip(data: Buffer): boolean {
  if (data.length < 22 || !(data.subarray(0, 4).equals(Buffer.from([0x50, 0x4b, 3, 4])) || data.subarray(0, 4).equals(Buffer.from([0x50, 0x4b, 5, 6])))) return false;
  // ZIP尾记录最多带65535字节注释；限制搜索范围，避免将任意PK前缀当容器。
  for (let offset = data.length - 22; offset >= Math.max(0, data.length - 22 - 65535); offset -= 1) {
    if (data.readUInt32LE(offset) !== 0x06054b50 || offset + 22 + data.readUInt16LE(offset + 20) !== data.length) continue;
    const entries = data.readUInt16LE(offset + 10), size = data.readUInt32LE(offset + 12), start = data.readUInt32LE(offset + 16);
    // 本轮不支持分卷或ZIP64；普通Office/ZIP的中央目录边界必须在尾记录之前。
    if (data.readUInt16LE(offset + 4) !== 0 || data.readUInt16LE(offset + 6) !== 0 || data.readUInt16LE(offset + 8) !== entries || entries === 0xffff || start + size !== offset) return false;
    if (entries === 0) return size === 0 && start === 0;
    let cursor = start;
    for (let entry = 0; entry < entries; entry += 1) {
      if (cursor + 46 > offset || data.readUInt32LE(cursor) !== 0x02014b50) return false;
      const local = data.readUInt32LE(cursor + 42);
      if (local + 30 > start || data.readUInt32LE(local) !== 0x04034b50) return false;
      cursor += 46 + data.readUInt16LE(cursor + 28) + data.readUInt16LE(cursor + 30) + data.readUInt16LE(cursor + 32);
    }
    return cursor === offset;
  }
  return false;
}

function isUtf8Text(data: Buffer): boolean {
  try {
    const text = new TextDecoder('utf-8', { fatal: true }).decode(data);
    // 允许正文换行/制表符，拒绝NUL、转义序列、其他二进制控制字符及C1控制字符。
    return !/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f-\u009f]/.test(text);
  } catch { return false; }
}

export function detectSiteFile(data: Buffer, filename: string): SiteFileType | null {
  const extension = extname(filename).slice(1).toLowerCase(), type = siteFileType(extension);
  if (!type) return null;
  let valid = false;
  if (extension === 'jpg' || extension === 'jpeg') valid = data.length >= 4 && data[0] === 0xff && data[1] === 0xd8 && data[2] === 0xff && data[data.length - 2] === 0xff && data[data.length - 1] === 0xd9;
  else if (extension === 'png') valid = data.length >= 33 && data.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])) && data.readUInt32BE(8) === 13 && data.toString('latin1', 12, 16) === 'IHDR' && data.readUInt32BE(16) > 0 && data.readUInt32BE(20) > 0;
  else if (extension === 'webp') valid = data.length >= 20 && data.toString('latin1', 0, 4) === 'RIFF' && data.readUInt32LE(4) === data.length - 8 && data.toString('latin1', 8, 12) === 'WEBP' && ['VP8 ', 'VP8L', 'VP8X'].includes(data.toString('latin1', 12, 16)) && data.readUInt32LE(16) > 0 && data.readUInt32LE(16) + 20 <= data.length;
  else if (extension === 'pdf') valid = data.length >= 12 && /^%PDF-(?:1\.[0-7]|2\.0)(?:\r|\n| )/.test(data.toString('latin1', 0, 9)) && /%%EOF\s*$/.test(data.subarray(Math.max(0, data.length - 1024)).toString('latin1'));
  else if (extension === 'txt') valid = isUtf8Text(data);
  else valid = isZip(data);
  return valid ? type : null;
}
