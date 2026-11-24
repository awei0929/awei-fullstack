import { AIMessage, HumanMessage, SystemMessage } from '@langchain/core/messages';
import type { BaseChatModel } from '@langchain/core/language_models/chat_models';
import { ChatDeepSeek } from '@langchain/deepseek';
import { ChatOpenAI } from '@langchain/openai';
import type { ModelMessage, ModelSettings } from '../../../chat/types/chat.type.js';

// DeepSeek 与 GLM 都走 OpenAI 兼容协议，但 DeepSeek 包会补上它自己的默认参数与流式字段。
export function createChatModel(settings: ModelSettings, maxTokens: number): BaseChatModel {
  const modelKwargs = settings.disableThinking ? { thinking: { type: 'disabled' } } : undefined;
  if (settings.id === 'deepseek-flash') {
    return new ChatDeepSeek({
      apiKey: settings.apiKey,
      model: settings.model,
      maxTokens,
      streaming: true,
      maxRetries: 0,
      modelKwargs,
      configuration: { baseURL: settings.baseUrl },
    });
  }
  return new ChatOpenAI({
    apiKey: settings.apiKey,
    model: settings.model,
    maxTokens,
    streaming: true,
    maxRetries: 0,
    modelKwargs,
    configuration: { baseURL: settings.baseUrl },
  });
}

// 站内提示词用轻量结构，只有真正调用模型时才转换成 LangChain 消息。
export function toLangChainMessages(messages: ModelMessage[]) {
  return messages.map(message => {
    if (message.role === 'system') return new SystemMessage(message.content);
    if (message.role === 'assistant') return new AIMessage(message.content);
    return new HumanMessage(message.content);
  });
}

// 有些兼容服务会把 content 返回成分段数组，这里统一成文本。
export function chunkText(message: { content: unknown }): string {
  if (typeof message.content === 'string') return message.content;
  if (!Array.isArray(message.content)) return '';
  return message.content
    .map(part => typeof part === 'string' ? part : (part && typeof part === 'object' && 'text' in part && typeof part.text === 'string' ? part.text : ''))
    .join('');
}
