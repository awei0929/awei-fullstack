import { once } from 'node:events';
import type { Response } from 'express';

export interface SseWriter {
  start(data: { conversationId: string; turnId: string; requestId: string }): Promise<void>;
  delta(text: string): Promise<void>;
  done(data: { conversationId: string; turnId: string }): Promise<void>;
  error(data: { code: string; message: string; retryable?: boolean }): Promise<void>;
  close(): void;
}

type Payload = Record<string, unknown>;

/**
 * 唯一的公开对话 SSE writer：事件串行、30 秒空闲 ping、背压等待与关闭清理都在这里，
 * controller 不再手写 `event:` 字符串，后续换传输层也不会出现两套协议。
 */
export function createSseWriter(response: Response, options: { turnId: string; pingMs?: number; onClose?: () => void }): SseWriter {
  const pingMs = options.pingMs ?? 30000;
  let seq = 0;
  let closed = false;
  let lastWriteAt = Date.now();
  let chain: Promise<void> = Promise.resolve();

  response.status(200).set({
    'Content-Type': 'text/event-stream; charset=utf-8',
    'Cache-Control': 'no-store, no-transform',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
  });
  response.flushHeaders();

  const finish = () => {
    if (closed) return;
    closed = true;
    clearInterval(timer);
    if (!response.writableEnded) response.end();
  };

  const frame = async (event: string, payload: Payload) => {
    if (closed || response.writableEnded || response.destroyed) return;
    seq += 1;
    const chunk = `id: ${options.turnId}:${seq}\nevent: ${event}\ndata: ${JSON.stringify(payload)}\n\n`;
    lastWriteAt = Date.now();
    if (!response.write(chunk)) {
      // 客户端读得慢时等缓冲区排空；close 时 Promise 也要能退出，不能把请求悬挂住。
      await Promise.race([
        once(response, 'drain'),
        once(response, 'close'),
      ]).catch(() => undefined);
    }
  };

  const enqueue = (event: string, payload: Payload) => {
    chain = chain.then(() => frame(event, payload)).catch(() => undefined);
    return chain;
  };

  const timer = setInterval(() => {
    // 连续 delta 已经刷新了 lastWriteAt，只有真正空闲才补 ping，避免额外噪音。
    if (closed || Date.now() - lastWriteAt < pingMs) return;
    void enqueue('ping', { type: 'ping', ts: Date.now() });
  }, Math.min(5000, pingMs));

  response.on('close', () => {
    if (!closed) options.onClose?.();
    closed = true;
    clearInterval(timer);
  });

  return {
    start: data => enqueue('start', { type: 'start', ...data }),
    delta: text => enqueue('delta', { type: 'delta', text }),
    done: async data => {
      await enqueue('done', { type: 'done', ...data });
      finish();
    },
    error: async data => {
      await enqueue('error', { type: 'error', ...data });
      finish();
    },
    close: finish,
  };
}
