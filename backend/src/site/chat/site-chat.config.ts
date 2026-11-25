import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

function integer(config: ConfigService, key: string, fallback: number, min: number, max: number): number {
  const raw = config.get<string>(key);
  if (raw === undefined || raw === '') return fallback;
  if (!/^\d+$/.test(raw) || Number(raw) < min || Number(raw) > max) {
    throw new ServiceUnavailableException(`${key} 必须为${min}至${max}的整数`);
  }
  return Number(raw);
}

// 公开对话比站主聊天多一层预算：访客匿名、单轮短答，限制必须由服务端固定并可测试。
@Injectable()
export class SiteChatConfig {
  constructor(private readonly config: ConfigService) {}
  rateLimit(): number { return integer(this.config, 'SITE_CHAT_RATE_LIMIT', 8, 1, 100); }
  rateWindow(): number { return integer(this.config, 'SITE_CHAT_RATE_WINDOW_MS', 600000, 60000, 86400000); }
  dailyLimit(): number { return integer(this.config, 'SITE_CHAT_DAILY_LIMIT', 200, 1, 10000); }
  timeout(): number { return integer(this.config, 'SITE_CHAT_TIMEOUT_MS', 45000, 1000, 120000); }
  // 主模型首个 token 的等待上限；超过就中止当前尝试并切备用模型，避免整轮挂到总超时。
  firstTokenMs(): number { return integer(this.config, 'SITE_CHAT_FIRST_TOKEN_MS', 8000, 1000, 60000); }
  maxTokens(): number { return integer(this.config, 'SITE_CHAT_MAX_TOKENS', 700, 100, 2048); }
  // 测试可以压到 50ms；生产默认 30s，且不应低于 10s，避免无意义地占连接。
  pingMs(): number { return integer(this.config, 'SITE_CHAT_PING_MS', 30000, 50, 120000); }
}
