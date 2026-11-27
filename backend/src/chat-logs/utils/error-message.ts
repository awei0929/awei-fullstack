import { HttpException } from '@nestjs/common';

// 对话入口可能抛出 HttpException、普通 Error 或非 Error 值。
// 日志只对站主开放，保留具体 message 便于排查；数据库连接串等基础设施细节由调用方的兜底控制。
export function chatErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof HttpException) {
    const response = error.getResponse();
    if (typeof response === 'string' && response.trim()) return response;
    if (response && typeof response === 'object' && 'message' in response) {
      const message = response.message;
      if (Array.isArray(message)) return message.filter((item): item is string => typeof item === 'string').join('；');
      if (typeof message === 'string' && message.trim()) return message;
    }
  }
  if (error instanceof Error && error.message && error.message.trim()) return error.message;
  return fallback;
}
