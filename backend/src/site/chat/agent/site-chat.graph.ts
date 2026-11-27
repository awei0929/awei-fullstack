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
import type { SiteChatTrace } from '../site-chat.types.js';

const NODE_NAMES = new Set(['loadConversation', 'buildContext', 'agent']);

type GraphStreamEvent = {
  event: string;
  name?: string;
  run_id?: string;
  data?: { output?: unknown; error?: unknown; chunk?: unknown };
};

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
    trace?: SiteChatTrace,
  ): AsyncGenerator<string> {
    // LangGraph 的 streamEvents 会为 graph、节点和模型分别发 start/end。
    // 只订阅白名单节点与 chat model，避免把内部包装链也写进后台。
    const nodeStarts = new Map<string, number>();
    const modelStarts = new Map<string, number>();
    const events = this.graph.streamEvents(input, { version: 'v2', signal }) as unknown as AsyncIterable<GraphStreamEvent>;
    for await (const event of events) {
      const runId = event.run_id ?? '';
      if (event.event === 'on_chain_start' && event.name && NODE_NAMES.has(event.name)) {
        nodeStarts.set(runId, Date.now());
        trace?.({ stage: `agent.${event.name}`, status: 'started', detail: '节点开始执行' });
      } else if (event.event === 'on_chain_end' && event.name && NODE_NAMES.has(event.name)) {
        const startedAt = nodeStarts.get(runId);
        trace?.({
          stage: `agent.${event.name}`,
          status: 'completed',
          durationMs: startedAt ? Date.now() - startedAt : undefined,
          detail: '节点执行完成',
        });
      } else if (event.event === 'on_chain_error' && event.name && NODE_NAMES.has(event.name)) {
        const startedAt = nodeStarts.get(runId);
        trace?.({
          stage: `agent.${event.name}`,
          status: 'failed',
          durationMs: startedAt ? Date.now() - startedAt : undefined,
          detail: errorText(event.data?.error, '节点执行失败'),
        });
      } else if (event.event === 'on_chat_model_start') {
        modelStarts.set(runId, Date.now());
        trace?.({
          stage: 'model.request',
          status: 'started',
          modelId: input.model.id,
          modelLabel: input.model.label,
          detail: `${input.model.label}（${input.model.id}）`,
        });
      } else if (event.event === 'on_chat_model_end') {
        const startedAt = modelStarts.get(runId);
        const usage = usageOf(event.data?.output);
        trace?.({
          stage: 'model.request',
          status: 'completed',
          modelId: input.model.id,
          modelLabel: input.model.label,
          durationMs: startedAt ? Date.now() - startedAt : undefined,
          detail: usage
            ? `输入 ${usage.prompt} / 输出 ${usage.completion} tokens`
            : '模型调用完成',
          ...(usage ? { tokens: usage } : {}),
        });
      } else if (event.event === 'on_chat_model_error') {
        const startedAt = modelStarts.get(runId);
        trace?.({
          stage: 'model.request',
          status: 'failed',
          modelId: input.model.id,
          modelLabel: input.model.label,
          durationMs: startedAt ? Date.now() - startedAt : undefined,
          detail: errorText(event.data?.error, '模型调用失败'),
        });
      } else if (event.event === 'on_chat_model_stream') {
        const text = chunkText(event.data?.chunk as { content: unknown });
        if (text) yield text;
      }
    }
  }
}

// 日志只给站主看，但仍不把上游原始报错整段写入：可能带地址、响应体甚至密钥。
// 仅保留可安全展示的 HTTP 状态码，其余统一成阶段失败说明。
function errorText(error: unknown, fallback: string): string {
  const message = error instanceof Error ? error.message : typeof error === 'string' ? error : '';
  const status = /\bHTTP\s+(\d{3})\b/i.exec(message)?.[1];
  return status ? `${fallback}（HTTP ${status}）` : fallback;
}

// LangChain 不同模型的 usage 字段可能缺失；只在双方都是数字时记录，避免 NaN 进入日志。
function usageOf(output: unknown): { prompt: number; completion: number; total: number } | undefined {
  if (!output || typeof output !== 'object') return undefined;
  const usage = (output as { usage_metadata?: { input_tokens?: unknown; output_tokens?: unknown; total_tokens?: unknown } }).usage_metadata;
  if (!usage) return undefined;
  const prompt = typeof usage.input_tokens === 'number' ? usage.input_tokens : 0;
  const completion = typeof usage.output_tokens === 'number' ? usage.output_tokens : 0;
  const total = typeof usage.total_tokens === 'number' ? usage.total_tokens : prompt + completion;
  if (!Number.isFinite(prompt) || !Number.isFinite(completion) || !Number.isFinite(total)) return undefined;
  return { prompt, completion, total };
}
