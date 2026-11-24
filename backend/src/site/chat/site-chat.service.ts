import { HttpException, Injectable, ServiceUnavailableException } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { ChatConfig } from '../../chat/config/chat.config.js';
import type { ModelSettings } from '../../chat/types/chat.type.js';
import { SiteService } from '../site.service.js';
import type { PublicChatDto } from '../dto/public-chat.dto.js';
import { SiteChatConfig } from './site-chat.config.js';
import { SiteChatLimiter } from './site-chat.limiter.js';
import { SiteChatRepository } from './site-chat.repository.js';
import { hashVisitor } from './site-chat.types.js';
import { SiteChatGraph } from './agent/site-chat.graph.js';

export type PreparedPublicChat = {
  conversationId: string;
  turnId: string;
  visitorHash: string;
  answer?: string;
  message: string;
  model: ModelSettings;
  timeout: number;
  maxTokens: number;
};

// 公开对话按匿名 visitor 持久化；每次生成只读取该 visitor 自己的会话，避免匿名访客之间串话。
@Injectable()
export class SiteChatService {
  constructor(
    private readonly site: SiteService,
    private readonly chatConfig: ChatConfig,
    private readonly config: SiteChatConfig,
    private readonly limiter: SiteChatLimiter,
    private readonly repository: SiteChatRepository,
    private readonly graph: SiteChatGraph,
  ) {}

  async status(): Promise<{ enabled: boolean; available: boolean }> {
    const document = await this.site.readPublic();
    return { enabled: document.content.chat.enabled, available: Boolean(this.availableModel()) };
  }

  async begin(input: PublicChatDto, visitorId: string, ip: string): Promise<PreparedPublicChat> {
    const document = await this.site.read();
    if (!document.content.chat.enabled) {
      throw new ServiceUnavailableException({ message: '对话暂未开放。', code: 'SITE_CHAT_DISABLED' });
    }
    const model = this.availableModel();
    if (!model) {
      throw new ServiceUnavailableException({ message: '对话暂时不可用，请稍后再试或直接联系站主。', code: 'SITE_CHAT_UNAVAILABLE' });
    }
    const visitorHash = hashVisitor(visitorId);
    // IP 桶与 visitor 桶同时生效：同一网络换 visitor 仍受 IP 限制，同一 visitor 换 IP 也受自身限制。
    const limited = this.limiter.consume(createHash('sha256').update(ip).digest('hex'))
      ?? this.limiter.consume(`visitor:${visitorHash}`);
    if (limited) {
      throw new HttpException({
        statusCode: 429,
        message: '聊得有点快，等一会儿再继续吧。',
        code: 'SITE_CHAT_RATE_LIMITED',
        retryAfter: limited.retryAfter,
      }, 429);
    }
    const turn = await this.repository.beginTurn({
      visitorHash,
      conversationId: input.conversationId,
      requestId: input.requestId,
      content: input.message.trim(),
      modelId: model.id,
      lockMs: this.config.timeout() + 15000,
    });
    return {
      conversationId: turn.conversationId,
      turnId: turn.turnId,
      visitorHash,
      answer: turn.answer,
      message: input.message.trim(),
      model: { ...model, maxTokens: this.config.maxTokens() },
      timeout: this.config.timeout(),
      maxTokens: this.config.maxTokens(),
    };
  }

  async *stream(prepared: PreparedPublicChat, signal: AbortSignal): AsyncGenerator<string> {
    const controller = new AbortController();
    let timedOut = false;
    const abort = () => controller.abort();
    signal.addEventListener('abort', abort);
    const timer = setTimeout(() => { timedOut = true; controller.abort(); }, prepared.timeout);
    try {
      yield* this.graph.stream({
        message: prepared.message,
        visitorHash: prepared.visitorHash,
        conversationId: prepared.conversationId,
        model: prepared.model,
        maxTokens: prepared.maxTokens,
      }, controller.signal);
    } catch (error) {
      if (signal.aborted) throw error;
      if (timedOut) throw new Error('回答超时了，请稍后再试。');
      const status = (error as { status?: number }).status;
      const message = error instanceof Error ? error.message : '';
      // LangChain 会把上游错误包装成不同异常，只把安全、可行动的几类翻译给访客。
      if (status === 429 || /429|rate limit|too many requests/i.test(message)) throw new Error('模型有点忙，请稍后再试。');
      if (status === 401 || status === 403 || /401|403|unauthorized|forbidden/i.test(message)) throw new Error('对话配置有点问题，请稍后再试。');
      throw new Error('对话暂时不可用，请稍后再试。');
    } finally {
      clearTimeout(timer);
      signal.removeEventListener('abort', abort);
    }
  }

  private availableModel(): ModelSettings | null {
    try {
      const models = this.chatConfig.models();
      // 配置了DeepSeek就用它；未配置时保持原来的GLM优先逻辑，部署不需要同时维护两套Key。
      return models.find(model => model.id === 'deepseek-flash' && model.apiKey)
        ?? models.find(model => model.id === 'glm-4.7-flash' && model.apiKey)
        ?? models.find(model => model.apiKey)
        ?? null;
    } catch {
      // 配置错误不向访客输出变量名或密钥状态，只表现为暂不可用。
      return null;
    }
  }
}
