import {
  HttpException,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
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
  /** GLM 主模型在首个 token 前失败时才使用的备用模型。 */
  fallback?: ModelSettings;
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
    return {
      enabled: document.content.chat.enabled,
      available: Boolean(this.availableModels()),
    };
  }

  async begin(
    input: PublicChatDto & { conversationId?: string },
    visitorId: string,
    ip: string,
  ): Promise<PreparedPublicChat> {
    const document = await this.site.read();
    if (!document.content.chat.enabled) {
      throw new ServiceUnavailableException({
        message: '对话暂未开放。',
        code: 'SITE_CHAT_DISABLED',
      });
    }
    const selection = this.availableModels();
    if (!selection) {
      throw new ServiceUnavailableException({
        message: '对话暂时不可用，请稍后再试或直接联系站主。',
        code: 'SITE_CHAT_UNAVAILABLE',
      });
    }
    const visitorHash = hashVisitor(visitorId);
    // IP 桶与 visitor 桶同时生效：同一网络换 visitor 仍受 IP 限制，同一 visitor 换 IP 也受自身限制。
    const limited = this.limiter.consume([
      createHash('sha256').update(ip).digest('hex'),
      `visitor:${visitorHash}`,
    ]);
    if (limited) {
      throw new HttpException(
        {
          statusCode: 429,
          message: '聊得有点快，等一会儿再继续吧。',
          code: 'SITE_CHAT_RATE_LIMITED',
          retryAfter: limited.retryAfter,
        },
        429,
      );
    }
    const turn = await this.repository.beginTurn({
      visitorHash,
      conversationId: input.conversationId,
      requestId: input.requestId,
      content: input.message.trim(),
      modelId: selection.model.id,
      lockMs: this.config.timeout() + 15000,
    });
    const maxTokens = this.config.maxTokens();
    return {
      conversationId: turn.conversationId,
      turnId: turn.turnId,
      visitorHash,
      answer: turn.answer,
      message: input.message.trim(),
      model: { ...selection.model, maxTokens },
      ...(selection.fallback
        ? { fallback: { ...selection.fallback, maxTokens } }
        : {}),
      timeout: this.config.timeout(),
      maxTokens,
    };
  }

  async *stream(
    prepared: PreparedPublicChat,
    signal: AbortSignal,
  ): AsyncGenerator<string> {
    const outer = new AbortController();
    const forward = () => outer.abort();
    signal.addEventListener('abort', forward);
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      outer.abort();
    }, prepared.timeout);

    // 每次尝试单独一个 AbortController：首个 token 看门狗只中止当前模型，
    // 这样主模型长时间静默时能尽快切到备用模型，而不用等整轮总超时。
    let attempt = new AbortController();
    let firstTokenExpired = false;
    let firstTokenTimer: NodeJS.Timeout | undefined;
    const abortAttempt = () => attempt.abort();
    outer.signal.addEventListener('abort', abortAttempt);
    const armFirstToken = () => {
      clearTimeout(firstTokenTimer);
      firstTokenTimer = setTimeout(() => {
        firstTokenExpired = true;
        abortAttempt();
      }, this.config.firstTokenMs());
    };
    const disarmFirstToken = () => clearTimeout(firstTokenTimer);
    const nextAttempt = () => {
      attempt = new AbortController();
      if (outer.signal.aborted) attempt.abort();
    };

    try {
      let emitted = false;
      armFirstToken();
      try {
        for await (const text of this.generate(
          prepared,
          prepared.model,
          attempt.signal,
        )) {
          if (!emitted) {
            emitted = true;
            disarmFirstToken();
          }
          yield text;
        }
      } catch (error) {
        disarmFirstToken();
        // 只有主模型一个 token 都没吐出来时才切换；已经输出半句再重试会造成重复内容。
        if (!prepared.fallback || emitted || outer.signal.aborted)
          throw error;
        await this.repository.switchModel(
          prepared.visitorHash,
          prepared.conversationId,
          prepared.turnId,
          prepared.fallback.id,
        );
        nextAttempt();
        armFirstToken();
        try {
          for await (const text of this.generate(
            prepared,
            prepared.fallback,
            attempt.signal,
          )) {
            if (!emitted) {
              emitted = true;
              disarmFirstToken();
            }
            yield text;
          }
        } finally {
          disarmFirstToken();
        }
        return;
      }
      disarmFirstToken();
      // 主模型正常结束但没有任何正文（例如只返回思考片段）也算失败，允许切换一次备用。
      if (!emitted && prepared.fallback && !outer.signal.aborted) {
        await this.repository.switchModel(
          prepared.visitorHash,
          prepared.conversationId,
          prepared.turnId,
          prepared.fallback.id,
        );
        nextAttempt();
        armFirstToken();
        try {
          for await (const text of this.generate(
            prepared,
            prepared.fallback,
            attempt.signal,
          )) {
            if (!emitted) {
              emitted = true;
              disarmFirstToken();
            }
            yield text;
          }
        } finally {
          disarmFirstToken();
        }
      }
    } catch (error) {
      if (signal.aborted) throw error;
      if (timedOut) throw new Error('回答超时了，请稍后再试。');
      if (firstTokenExpired) throw new Error('模型有点忙，请稍后再试。');
      const status = (error as { status?: number }).status;
      const message = error instanceof Error ? error.message : '';
      // LangChain 会把上游错误包装成不同异常，只把安全、可行动的几类翻译给访客。
      if (status === 429 || /429|rate limit|too many requests/i.test(message))
        throw new Error('模型有点忙，请稍后再试。');
      if (
        status === 401 ||
        status === 403 ||
        /401|403|unauthorized|forbidden/i.test(message)
      )
        throw new Error('对话配置有点问题，请稍后再试。');
      throw new Error('对话暂时不可用，请稍后再试。');
    } finally {
      clearTimeout(timer);
      clearTimeout(firstTokenTimer);
      outer.signal.removeEventListener('abort', abortAttempt);
      signal.removeEventListener('abort', forward);
    }
  }

  private async *generate(
    prepared: PreparedPublicChat,
    model: ModelSettings,
    signal: AbortSignal,
  ): AsyncGenerator<string> {
    yield* this.graph.stream(
      {
        message: prepared.message,
        visitorHash: prepared.visitorHash,
        conversationId: prepared.conversationId,
        model,
        maxTokens: prepared.maxTokens,
      },
      signal,
    );
  }

  private availableModels(): {
    model: ModelSettings;
    fallback?: ModelSettings;
  } | null {
    try {
      const models = this.chatConfig.models();
      // GLM 优先；只有它没配 Key 时才让 DeepSeek 直接做主模型，避免无谓的多一跳。
      const deepseek = models.find(
        (model) => model.id === 'deepseek-flash' && model.apiKey,
      );
      const model =
        models.find((item) => item.id === 'glm-4.7-flash' && item.apiKey) ??
        deepseek ??
        models.find((item) => item.apiKey);
      if (!model) return null;
      // 配置了 DeepSeek 就把它作为 GLM 的备用；否则沿用 GLM 内置的免费备用。
      const fallback =
        model.id === 'deepseek-flash'
          ? undefined
          : (deepseek ??
            models.find(
              (item) => item.id === model.fallbackModelId && item.apiKey,
            ));
      return {
        model,
        ...(fallback && fallback.id !== model.id ? { fallback } : {}),
      };
    } catch {
      // 配置错误不向访客输出变量名或密钥状态，只表现为暂不可用。
      return null;
    }
  }
}
