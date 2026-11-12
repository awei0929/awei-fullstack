export interface ChatModel { id: string; label: string; available: boolean }
export interface ChatConversation { id: string; title: string; createdAt: string; updatedAt: string }
export type ChatStatus = 'streaming' | 'completed' | 'canceled' | 'failed' | 'interrupted'
export interface ChatTurn {
  requestId: string
  content: string
  answer: string
  modelId: string
  modelLabel: string
  status: ChatStatus
  error: string | null
  createdAt: string
  updatedAt: string
}
export type ChatEvent =
  | { type: 'start'; conversationId: string; turn: ChatTurn }
  | { type: 'delta'; requestId: string; text: string }
  | { type: 'done'; conversationId: string; turn: ChatTurn }
export interface ChatInput { requestId: string; content: string; modelId: string }
export interface ChatDetail { conversation: ChatConversation; turns: ChatTurn[] }
