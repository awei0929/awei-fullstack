// 日志接口的公开类型；字段与后端 ChatLogView 一一对应，前端仍会做运行时校验后再展示。

export type ChatLogChannel = 'site' | 'owner'
export type ChatLogStatus = 'streaming' | 'completed' | 'failed' | 'canceled' | 'interrupted'
export type ChatLogTraceStatus = 'started' | 'completed' | 'failed'

export interface ChatLogTrace {
  at: string
  stage: string
  status: ChatLogTraceStatus
  durationMs: number | null
  detail: string | null
}

export interface ChatLog {
  id: string
  channel: ChatLogChannel
  conversationId: string | null
  turnId: string | null
  question: string
  answer: string
  status: ChatLogStatus
  error: string | null
  durationMs: number | null
  startedAt: string
  finishedAt: string | null
  modelId: string | null
  modelLabel: string | null
  requestedModelId: string | null
  requestedModelLabel: string | null
  fallbackUsed: boolean
  firstTokenMs: number | null
  promptTokens: number | null
  completionTokens: number | null
  totalTokens: number | null
}

export interface ChatLogDetail extends ChatLog {
  trace: ChatLogTrace[]
}

export interface ChatLogPage {
  logs: ChatLog[]
  total: number
  limit: number
  offset: number
}

export interface ChatLogQuery {
  channel?: ChatLogChannel
  status?: ChatLogStatus
  limit?: number
  offset?: number
}
