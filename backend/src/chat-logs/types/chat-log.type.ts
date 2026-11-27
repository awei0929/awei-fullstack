import type { ChatLogChannel, ChatLogStatus } from '../schemas/chat-log.schema.js';

// 对外只暴露观测需要的字段，不返回访客哈希、IP 等可关联身份的信息。
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
