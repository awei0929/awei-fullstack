// HTTP公开类型不含ownerId、密钥、上游地址或运行锁，防止存储模型直接泄漏配置。
export type ChatStatus = 'streaming' | 'completed' | 'canceled' | 'failed' | 'interrupted';
export interface ChatModel { id: string; label: string; available: boolean; fallbackModelId?: string }
export interface ChatConversation { id: string; title: string; createdAt: string; updatedAt: string }
export interface ChatTurn {
  requestId: string; content: string; answer: string; modelId: string; modelLabel: string;
  requestedModelId: string; requestedModelLabel: string;
  status: ChatStatus; error: string | null; createdAt: string; updatedAt: string;
}
export type ChatEvent =
  | { type: 'start'; conversationId: string; turn: ChatTurn }
  | { type: 'fallback'; conversationId: string; turn: ChatTurn }
  | { type: 'delta'; requestId: string; text: string }
  | { type: 'done'; conversationId: string; turn: ChatTurn };
export interface ModelSettings { id: string; label: string; model: string; baseUrl: string; apiKey: string; disableThinking: boolean; fallbackModelId?: string }
export interface ModelMessage { role: 'system' | 'user' | 'assistant'; content: string }
