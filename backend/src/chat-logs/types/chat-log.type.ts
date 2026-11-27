import type { ChatLogChannel, ChatLogStatus, ChatLogTraceStatus } from '../schemas/chat-log.schema.js';

export interface ChatLogTraceView {
  at: string;
  stage: string;
  status: ChatLogTraceStatus;
  durationMs: number | null;
  detail: string | null;
}

// 对外只暴露观测需要的字段，不返回访客哈希、IP 等可关联身份的信息。
// 模型与 token 字段在列表和详情都返回，方便后台先判断“慢在哪、用了谁”；
// trace 只在详情接口返回，避免列表一次读出大量内部步骤。
export interface ChatLogView {
  id: string;
  channel: ChatLogChannel;
  conversationId: string | null;
  turnId: string | null;
  question: string;
  answer: string;
  status: ChatLogStatus;
  error: string | null;
  durationMs: number | null;
  startedAt: string;
  finishedAt: string | null;
  modelId: string | null;
  modelLabel: string | null;
  requestedModelId: string | null;
  requestedModelLabel: string | null;
  fallbackUsed: boolean;
  firstTokenMs: number | null;
  promptTokens: number | null;
  completionTokens: number | null;
  totalTokens: number | null;
}

export interface ChatLogDetail extends ChatLogView {
  trace: ChatLogTraceView[];
}

export interface ChatLogPage {
  logs: ChatLogView[];
  total: number;
  limit: number;
  offset: number;
}

export interface StartChatLogInput {
  channel: ChatLogChannel;
  requestKey: string;
  conversationId?: string | null;
  turnId?: string | null;
  question: string;
  startedAt: Date;
}

export interface FinishChatLogInput {
  status: Exclude<ChatLogStatus, 'streaming'>;
  answer?: string;
  error?: string | null;
  durationMs: number;
}

// start 之后才能确定模型（公开对话要先过限流/建会话），所以模型信息单独补写。
export interface ChatLogMetaInput {
  modelId?: string | null;
  modelLabel?: string | null;
  requestedModelId?: string | null;
  requestedModelLabel?: string | null;
  fallbackUsed?: boolean;
  firstTokenMs?: number | null;
  promptTokens?: number | null;
  completionTokens?: number | null;
  totalTokens?: number | null;
}

export interface ChatLogTraceInput {
  at?: Date;
  stage: string;
  status: ChatLogTraceStatus;
  durationMs?: number | null;
  detail?: string | null;
}
