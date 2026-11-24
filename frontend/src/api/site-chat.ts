import { request, requestResponse } from './http'
import { readSseEvents } from '../utils/sse'
import { createUuid, getVisitorId } from '../utils/visitor'

export interface SiteChatStatus { enabled: boolean; available: boolean }
export interface SiteChatConversationSummary {
  id: string
  title: string
  updatedAt: string
  messageCount: number
  preview: string
}
export type SiteChatTurnStatus = 'streaming' | 'completed' | 'canceled' | 'failed' | 'interrupted'
export interface SiteChatTurn {
  requestId: string
  content: string
  answer: string
  status: SiteChatTurnStatus
  modelId: string
  error: string
  createdAt: string
  updatedAt: string
}
export interface SiteChatConversationView {
  conversation: { id: string; title: string; createdAt: string; updatedAt: string }
  turns: SiteChatTurn[]
}
export interface SiteChatStart { conversationId: string; turnId: string; requestId: string }

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const STATUSES = new Set<SiteChatTurnStatus>(['streaming', 'completed', 'canceled', 'failed', 'interrupted'])

function invalid(): never { throw new Error('对话服务返回了无法识别的数据') }
function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return invalid()
  return value as Record<string, unknown>
}
function text(value: unknown): string {
  if (typeof value !== 'string') return invalid()
  return value
}
function iso(value: unknown): string {
  const result = text(value)
  return Number.isNaN(Date.parse(result)) ? invalid() : result
}
function headers(): Record<string, string> {
  return { 'X-Visitor-Id': getVisitorId() }
}
function optionalText(value: unknown): string {
  return value === null || value === undefined ? '' : text(value)
}
function turn(value: unknown): SiteChatTurn {
  const item = record(value)
  if (!UUID_RE.test(text(item.requestId)) || !STATUSES.has(text(item.status) as SiteChatTurnStatus)) return invalid()
  return {
    requestId: text(item.requestId),
    content: text(item.content),
    answer: text(item.answer),
    status: text(item.status) as SiteChatTurnStatus,
    modelId: text(item.modelId),
    error: optionalText(item.error),
    createdAt: iso(item.createdAt),
    updatedAt: iso(item.updatedAt),
  }
}
function summary(value: unknown): SiteChatConversationSummary {
  const item = record(value)
  const count = item.messageCount
  if (!UUID_RE.test(text(item.id)) || typeof count !== 'number' || !Number.isInteger(count) || count < 0) return invalid()
  return { id: text(item.id), title: text(item.title), updatedAt: iso(item.updatedAt), messageCount: count, preview: text(item.preview) }
}

export async function getSiteChatStatus(): Promise<SiteChatStatus> {
  const value = record(await request<unknown>('/site-chat'))
  if (Object.keys(value).length !== 2 || typeof value.enabled !== 'boolean' || typeof value.available !== 'boolean') return invalid()
  return { enabled: value.enabled, available: value.available }
}

export async function listSiteChatConversations(): Promise<SiteChatConversationSummary[]> {
  const value = record(await request<unknown>('/site-chat/conversations', { headers: headers() }))
  if (!Array.isArray(value.conversations)) return invalid()
  return value.conversations.map(summary)
}

export async function getSiteChatConversation(id: string): Promise<SiteChatConversationView> {
  const value = record(await request<unknown>(`/site-chat/conversations/${encodeURIComponent(id)}`, { headers: headers() }))
  const conversation = record(value.conversation)
  if (!UUID_RE.test(text(conversation.id)) || !Array.isArray(value.turns)) return invalid()
  return {
    conversation: {
      id: text(conversation.id),
      title: text(conversation.title),
      createdAt: iso(conversation.createdAt),
      updatedAt: iso(conversation.updatedAt),
    },
    turns: value.turns.map(turn),
  }
}

export async function deleteSiteChatConversation(id: string): Promise<void> {
  await requestResponse(`/site-chat/conversations/${encodeURIComponent(id)}`, { method: 'DELETE', headers: headers() })
}

const WATCHDOG_MS = 45_000

// 公开对话是一条POST SSE流；服务端用start确定会话，ping证明链路还活着。
export async function streamSiteChat(
  input: { message: string; conversationId?: string; requestId?: string },
  signal: AbortSignal,
  onDelta: (text: string) => void,
  onStart?: (ids: SiteChatStart) => void,
): Promise<SiteChatStart> {
  const requestId = input.requestId ?? createUuid()
  const controller = new AbortController()
  let timedOut = false
  let watchdog: ReturnType<typeof setTimeout> | undefined
  let started: SiteChatStart | null = null
  let done = false
  const touch = () => {
    if (watchdog) clearTimeout(watchdog)
    watchdog = setTimeout(() => { timedOut = true; controller.abort() }, WATCHDOG_MS)
  }
  const abort = () => controller.abort()
  signal.addEventListener('abort', abort)
  touch()
  try {
    // 首条消息 POST 集合创建会话；已有会话 POST 到自己的 messages 子资源。
    // 两者都返回 SSE：POST 的响应体可以直接是流，SSE 是传输方式，不是第二个接口。
    const path = input.conversationId
      ? `/site-chat/conversations/${encodeURIComponent(input.conversationId)}/messages`
      : '/site-chat/conversations';
    const response = await requestResponse(path, {
      method: 'POST',
      headers: { ...headers(), 'Content-Type': 'application/json', Accept: 'text/event-stream' },
      body: JSON.stringify({ message: input.message, requestId }),
      signal: controller.signal,
    })
    if (!response.body || !(response.headers.get('content-type') ?? '').includes('text/event-stream')) {
      throw new Error('对话服务没有返回可读取的流')
    }
    for await (const message of readSseEvents(response.body)) {
      touch()
      let data: unknown
      try { data = JSON.parse(message.data) } catch { throw new Error('对话流格式异常，请重试') }
      const event = record(data)
      if (message.event === 'ping') continue
      if (message.event === 'start') {
        if (!UUID_RE.test(text(event.conversationId)) || !UUID_RE.test(text(event.turnId)) || !UUID_RE.test(text(event.requestId))) return invalid()
        started = { conversationId: text(event.conversationId), turnId: text(event.turnId), requestId: text(event.requestId) }
        onStart?.(started)
      } else if (message.event === 'delta') {
        if (typeof event.text !== 'string' || event.text.length > 8192) throw new Error('对话流格式异常，请重试')
        onDelta(event.text)
      } else if (message.event === 'done') {
        done = true
        break
      } else if (message.event === 'error') {
        throw new Error(typeof event.message === 'string' && event.message.trim() ? event.message : '对话暂时不可用，请稍后再试')
      }
    }
    if (!done) throw new Error('对话连接中断，请重试')
    if (!started) throw new Error('对话流缺少会话标识，请重试')
    return started
  } catch (error) {
    if (timedOut) throw new Error('对话响应超时，请重试')
    throw error
  } finally {
    if (watchdog) clearTimeout(watchdog)
    signal.removeEventListener('abort', abort)
  }
}
