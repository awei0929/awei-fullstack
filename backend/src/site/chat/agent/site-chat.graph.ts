import { AIMessageChunk } from '@langchain/core/messages';
import { Annotation, END, START, StateGraph } from '@langchain/langgraph';
import { Injectable } from '@nestjs/common';
import type {
  ModelMessage,
  ModelSettings,
} from '../../../chat/types/chat.type.js';
import { SiteService } from '../../site.service.js';
import { SiteChatRepository } from '../site-chat.repository.js';
import { buildSiteChatMessages } from '../site-chat.prompt.js';
import {
  chunkText,
  createChatModel,
  toLangChainMessages,
} from './site-chat.models.js';

const SiteChatState = Annotation.Root({
  message: Annotation<string>(),
  visitorHash: Annotation<string>(),
  conversationId: Annotation<string>(),
  history: Annotation<ModelMessage[]>(),
  messages: Annotation<ModelMessage[]>(),
  model: Annotation<ModelSettings>(),
  maxTokens: Annotation<number>(),
  answer: Annotation<string>({
    reducer: (left, right) => left + right,
    default: () => '',
  }),
});

export type SiteChatGraphInput = {
  message: string;
  visitorHash: string;
  conversationId: string;
  model: ModelSettings;
  maxTokens: number;
};

@Injectable()
export class SiteChatGraph {
  private readonly graph: ReturnType<typeof this.build>;

  constructor(
    private readonly site: SiteService,
    private readonly repository: SiteChatRepository,
  ) {
    this.graph = this.build();
  }

  private build() {
    return (
      new StateGraph(SiteChatState)
        // 最近8轮对话历史
        .addNode(
          'loadConversation',
          async (state: typeof SiteChatState.State) => ({
            history: await this.repository.history(
              state.visitorHash,
              state.conversationId,
            ),
          }),
        )
        // 构建模型上下文：系统提示词 + 历史对话 + 当前访客消息
        .addNode('buildContext', async (state: typeof SiteChatState.State) => {
          const document = await this.site.read();
          return {
            messages: buildSiteChatMessages(
              document.content,
              state.history,
              state.message,
            ),
          };
        })
        // 调用模型生成回答：流式输出，最终结果写入 state.answer
        .addNode('agent', async (state: typeof SiteChatState.State) => {
          const model = createChatModel(state.model, state.maxTokens);
          let answer = '';
          const stream = await model.stream(
            toLangChainMessages(state.messages),
          );
          for await (const chunk of stream as AsyncIterable<AIMessageChunk>)
            answer += chunkText(chunk);
          return { answer };
        })
        // 状态机连接：按顺序执行 loadConversation -> buildContext -> agent，最终返回 END
        .addEdge(START, 'loadConversation')
        // 轮次写入由 controller/service 负责：它们知道 500ms 增量、断连和失败状态。
        .addEdge('loadConversation', 'buildContext')
        // 轮次写入由 controller/service 负责：它们知道 500ms 增量、断连和失败状态。
        .addEdge('buildContext', 'agent')
        // 轮次写入由 controller/service 负责：它们知道 500ms 增量、断连和失败状态。
        .addEdge('agent', END)
        // 编译成可执行的状态机
        .compile()
    );
  }

  async *stream(
    input: SiteChatGraphInput,
    signal: AbortSignal,
  ): AsyncGenerator<string> {
    const events = this.graph.streamEvents(input, { version: 'v2', signal });
    for await (const event of events) {
      if (event.event !== 'on_chat_model_stream') continue;
      const text = chunkText(event.data.chunk as { content: unknown });
      if (text) yield text;
    }
  }
}
