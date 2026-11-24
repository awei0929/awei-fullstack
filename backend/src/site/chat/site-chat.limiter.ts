import { Injectable } from '@nestjs/common';
import { SiteChatConfig } from './site-chat.config.js';

type Limited = { retryAfter: number };

// 单进程内存限流只保护公开对话的模型预算；进程重启会清空，部署为单实例时足够。
// 键使用IP哈希，不保存原始地址；检查与写入同步完成，避免并发请求一起越过上限。
@Injectable()
export class SiteChatLimiter {
  private readonly buckets = new Map<string, number[]>();
  private day = '';
  private daily = 0;

  constructor(private readonly config: SiteChatConfig) {}

  // 一次请求可能同时受 IP 和 visitor 两个桶约束；先检查全部桶，再统一写入并只记一次日总量。
  consume(keys: string[]): Limited | null {
    const now = Date.now();
    this.rollDay(now);
    const window = this.config.rateWindow();
    const limit = this.config.rateLimit();
    if (this.daily >= this.config.dailyLimit()) {
      return { retryAfter: Math.max(1, Math.ceil((this.nextUtcMidnight(now) - now) / 1000)) };
    }
    const entries = [...new Set(keys)].map(key => ({
      key,
      hits: (this.buckets.get(key) ?? []).filter(time => now - time < window),
    }));
    for (const entry of entries) {
      if (entry.hits.length >= limit) {
        this.buckets.set(entry.key, entry.hits);
        return { retryAfter: Math.max(1, Math.ceil((entry.hits[0] + window - now) / 1000)) };
      }
    }
    for (const entry of entries) {
      entry.hits.push(now);
      this.buckets.set(entry.key, entry.hits);
    }
    this.daily += 1;
    // 防御大量不同来源把表撑大：只清理已经过窗的桶，不影响仍在限流中的记录。
    if (this.buckets.size > 4000) {
      for (const [bucketKey, times] of this.buckets) {
        if (times.every(time => now - time >= window)) this.buckets.delete(bucketKey);
      }
    }
    return null;
  }

  private rollDay(now: number): void {
    const day = new Date(now).toISOString().slice(0, 10);
    if (day !== this.day) {
      this.day = day;
      this.daily = 0;
    }
  }

  private nextUtcMidnight(now: number): number {
    const date = new Date(now);
    return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate() + 1);
  }
}
