// 音频格式检测只检查容器/帧的真实结构，不信扩展名，也不在服务端抓取或执行外部内容。
// 它不替代浏览器解码：格式合法但音频流损坏时，播放器仍须报告实际播放错误。
// 签名用latin1逐字节比较；Node的ascii解码会清除高位，可能把伪造字节误认成文件头。
export type AudioType = { extension: 'mp3' | 'wav' | 'ogg'; mime: string; acceptedMimes: string[] };

function isWave(data: Buffer): boolean {
  if (data.length < 44 || data.toString('latin1', 0, 4) !== 'RIFF' || data.toString('latin1', 8, 12) !== 'WAVE' || data.readUInt32LE(4) !== data.length - 8) return false;
  let format = false, samples = false, offset = 12;
  while (offset + 8 <= data.length) {
    const kind = data.toString('latin1', offset, offset + 4), size = data.readUInt32LE(offset + 4), start = offset + 8;
    if (start + size > data.length) return false;
    if (kind === 'fmt ') {
      // PCM、浮点、A-law、μ-law与扩展格式都属于常见WAV音频，不能只按PCM白名单拒绝。
      if (size < 16 || ![1, 3, 6, 7, 0xfffe].includes(data.readUInt16LE(start)) || data.readUInt16LE(start + 2) === 0 || data.readUInt32LE(start + 4) === 0 || data.readUInt32LE(start + 8) === 0 || data.readUInt16LE(start + 12) === 0) return false;
      format = true;
    }
    if (kind === 'data' && size > 0) samples = true;
    // RIFF奇数字节chunk使用一个padding字节，不能把它当下一段头。
    offset = start + size + (size % 2);
  }
  return format && samples && offset === data.length;
}

function audioIdentification(packet: Buffer): boolean {
  if (packet.length >= 19 && packet.toString('latin1', 0, 8) === 'OpusHead') return packet[8] === 1 && packet[9] > 0;
  return packet.length >= 30 && packet[0] === 1 && packet.toString('latin1', 1, 7) === 'vorbis'
    && packet.readUInt32LE(7) === 0 && packet[11] > 0 && packet.readUInt32LE(12) > 0 && (packet[29]! & 1) === 1;
}

function isAudioOgg(data: Buffer): boolean {
  let offset = 0, streams = 0;
  while (offset < data.length) {
    if (offset + 27 > data.length || data.toString('latin1', offset, offset + 4) !== 'OggS' || data[offset + 4] !== 0) return false;
    const segments = data[offset + 26]!, start = offset + 27 + segments;
    if (start > data.length) return false;
    let size = 0, packetSize = 0, firstPacketComplete = false;
    for (let index = offset + 27; index < start; index += 1) {
      const length = data[index]!; size += length;
      if (!firstPacketComplete) { packetSize += length; if (length < 255) firstPacketComplete = true; }
    }
    if (start + size > data.length) return false;
    const bos = Boolean(data[offset + 5]! & 2);
    if (offset === 0 && !bos) return false;
    // 每条逻辑流的BOS都必须是音频标识，避免只凭OggS放过Theora或混合视频。
    if (bos) {
      if ((data[offset + 5]! & 1) !== 0 || !firstPacketComplete || !audioIdentification(data.subarray(start, start + packetSize))) return false;
      streams += 1;
    }
    offset = start + size;
  }
  return streams > 0;
}

function mpegFrameLength(data: Buffer, offset: number): number {
  if (offset + 4 > data.length || data[offset] !== 0xff || (data[offset + 1]! & 0xe0) !== 0xe0) return 0;
  const version = (data[offset + 1]! >> 3) & 3, layer = (data[offset + 1]! >> 1) & 3;
  const bitrateIndex = data[offset + 2]! >> 4, sampleIndex = (data[offset + 2]! >> 2) & 3;
  // MP3是MPEG Layer III；保留版本/采样率、free-format和bad bitrate不作为可验证音源。
  if (version === 1 || layer !== 1 || bitrateIndex === 0 || bitrateIndex === 15 || sampleIndex === 3 || (data[offset + 3]! & 3) === 2) return 0;
  const rates = version === 3 ? [0, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320] : [0, 8, 16, 24, 32, 40, 48, 56, 64, 80, 96, 112, 128, 144, 160];
  const sampleRate = [44100, 48000, 32000][sampleIndex]! / (version === 3 ? 1 : version === 2 ? 2 : 4);
  return Math.floor((version === 3 ? 144000 : 72000) * rates[bitrateIndex]! / sampleRate) + ((data[offset + 2]! >> 1) & 1);
}

function isMp3(data: Buffer): boolean {
  let offset = 0;
  if (data.toString('latin1', 0, 3) === 'ID3') {
    if (data.length < 10 || ![2, 3, 4].includes(data[3]!) || data[4] === 0xff || data.subarray(6, 10).some(byte => byte > 127)) return false;
    const version = data[3]!, reserved = version === 2 ? 0x3f : version === 3 ? 0x1f : 0x0f;
    if ((data[5]! & reserved) !== 0) return false;
    const tagSize = (data[6]! << 21) | (data[7]! << 14) | (data[8]! << 7) | data[9]!;
    offset = 10 + tagSize + (version === 4 && (data[5]! & 0x10) !== 0 ? 10 : 0);
  }
  const length = mpegFrameLength(data, offset);
  if (!length || offset + length > data.length) return false;
  const next = offset + length;
  // 单帧文件或带ID3v1尾标记允许；其他文件须有第二个完整帧，拒绝偶然匹配的四字节头。
  if (next === data.length || (next + 128 === data.length && data.toString('latin1', next, next + 3) === 'TAG')) return true;
  const secondLength = mpegFrameLength(data, next);
  return secondLength > 0 && next + secondLength <= data.length;
}

export function detectSiteAudio(data: Buffer): AudioType | null {
  if (isWave(data)) return { extension: 'wav', mime: 'audio/wav', acceptedMimes: ['audio/wav', 'audio/x-wav', 'audio/wave', 'audio/vnd.wave'] };
  if (isAudioOgg(data)) return { extension: 'ogg', mime: 'audio/ogg', acceptedMimes: ['audio/ogg', 'application/ogg'] };
  if (isMp3(data)) return { extension: 'mp3', mime: 'audio/mpeg', acceptedMimes: ['audio/mpeg', 'audio/mp3'] };
  return null;
}
