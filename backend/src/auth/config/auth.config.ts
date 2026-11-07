import type { ConfigService } from '@nestjs/config';

// 环境变量读到的是字符串；统一转换并拒绝小数、负数等非法配置，避免各模块解释不一致。
// 这是无状态的配置辅助函数，不需要注册成 Nest Provider。
export function positiveInteger(config: ConfigService, key: string, fallback: number): number {
  const value = Number(config.get(key) ?? fallback);
  if (!Number.isSafeInteger(value) || value <= 0) throw new Error(`${key} 必须是正整数`);
  return value;
}

// 会话期限固定从登录时刻起算，允许为了测试或产品策略缩短，但不能超过七天。
export function sessionDuration(config: ConfigService): number {
  const maximum = 7 * 24 * 60 * 60 * 1000;
  const duration = positiveInteger(config, 'SESSION_MAX_AGE_MS', maximum);
  if (duration > maximum) throw new Error('SESSION_MAX_AGE_MS 不能超过7天');
  return duration;
}
