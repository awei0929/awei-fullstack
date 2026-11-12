import { Injectable } from '@nestjs/common';
import type { ModelMessage, ModelSettings } from '../types/chat.type.js';
import { sseData } from './sse-parser.js';

// 仅可信HTTP状态创建此本地错误；流内供应商错误或错误文案不能触发自动切换。
export class ModelRateLimitError extends Error {
  readonly status = 429;
  constructor() { super('模型请求过于频繁或额度不足，请稍后重试'); this.name = 'ModelRateLimitError'; }
}

// 服务端兼容适配器将厂商SSE转换为纯文本增量，不让上游协议进入Controller或浏览器。
@Injectable()
export class ChatCompletionsProvider {
  async *generate(model: ModelSettings, messages: ModelMessage[], signal: AbortSignal): AsyncGenerator<string> {
    const response = await fetch(`${model.baseUrl}/chat/completions`, {
      method: 'POST', redirect: 'error', signal,
      headers: { Authorization: `Bearer ${model.apiKey}`, 'Content-Type': 'application/json', Accept: 'text/event-stream' },
      body: JSON.stringify({ model: model.model, messages, stream: true, max_tokens: 4096, ...(model.disableThinking ? { thinking: { type: 'disabled' } } : {}) }),
    });
    if (!response.ok || !response.body || !response.headers.get('content-type')?.includes('text/event-stream')) {
      await response.body?.cancel();
      if (response.status === 401 || response.status === 403) throw new Error('模型鉴权失败，请检查服务端配置');
      if (response.status === 429) throw new ModelRateLimitError();
      throw new Error('模型服务暂时不可用，请稍后重试');
    }
    for await (const data of sseData(response.body)) {
      if (data === '[DONE]') return;
      let parsed: { error?: unknown; choices?: { delta?: { content?: unknown }; finish_reason?: unknown }[] };
      try { parsed = JSON.parse(data); } catch { throw new Error('模型返回了无法解析的数据'); }
      if (!parsed || typeof parsed !== 'object' || parsed.error || !Array.isArray(parsed.choices)) throw new Error('模型返回了无效数据');
      const choice = parsed.choices[0];
      if (choice?.delta?.content !== undefined && choice.delta.content !== null) {
        if (typeof choice.delta.content !== 'string') throw new Error('模型返回了无效文本');
        if (choice.delta.content) yield choice.delta.content;
      }
      // length/content_filter等终止原因意味着不完整，不因后续DONE而误报成功。
      if (choice?.finish_reason && choice.finish_reason !== 'stop') throw new Error('模型回复受限，已保留收到的部分内容');
    }
    throw new Error('模型连接提前结束，回复不完整');
  }
}
