import { request, requestResponse } from './http'
import { readSseEvents } from '../utils/sse'
import type { ChatConversation, ChatDetail, ChatEvent, ChatInput, ChatModel, ChatStatus, ChatTurn } from '../types/chat'

function invalid(): never { throw new Error('对话数据格式异常，请重新加载') }
function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return invalid()
  return value as Record<string, unknown>
}
function text(value: unknown, max: number, required = false): string {
  if (typeof value !== 'string' || Array.from(value).length > max || (required && !value.trim())) return invalid()
  return value
}
function uuid(value: unknown): string {
  if (typeof value !== 'string' || !/^[a-f\d]{8}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{12}$/i.test(value)) return invalid()
  return value
}
function date(value: unknown): string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T/.test(value) || !Number.isFinite(Date.parse(value))) return invalid()
  return value
}
function list<T>(value: unknown, max: number, parse: (item: unknown) => T): T[] {
  if (!Array.isArray(value) || value.length > max) return invalid()
  return value.map(parse)
}
function parseConversation(value: unknown): ChatConversation {
  const item = object(value)
  return { id: uuid(item.id), title: text(item.title, 4000, true), createdAt: date(item.createdAt), updatedAt: date(item.updatedAt) }
}
export function parseChatTurn(value: unknown): ChatTurn {
  const item = object(value)
  if (!['streaming', 'completed', 'canceled', 'failed', 'interrupted'].includes(String(item.status))) return invalid()
  const modelId = text(item.modelId, 200, true)
  const modelLabel = text(item.modelLabel, 200, true)
  const legacy = !('requestedModelId' in item) && !('requestedModelLabel' in item)
  const requestedModelId = legacy ? modelId : text(item.requestedModelId, 200, true)
  const requestedModelLabel = legacy ? modelLabel : text(item.requestedModelLabel, 200, true)
  return { requestId: uuid(item.requestId), content: text(item.content, 4000, true), answer: text(item.answer, 16000), requestedModelId, requestedModelLabel, modelId, modelLabel, status: item.status as ChatStatus, error: item.error === null ? null : text(item.error, 4000), createdAt: date(item.createdAt), updatedAt: date(item.updatedAt) }
}
function parseEvent(value: unknown): ChatEvent {
  const item = object(value)
  if (item.type === 'delta') return { type: 'delta', requestId: uuid(item.requestId), text: text(item.text, 16000) }
  if (item.type === 'start' || item.type === 'fallback' || item.type === 'done') return { type: item.type, conversationId: uuid(item.conversationId), turn: parseChatTurn(item.turn) }
  return invalid()
}

export async function getChatModels(): Promise<{ models: ChatModel[]; defaultModelId: string }> {
  const result = object(await request<unknown>('/chat/models'))
  const models = list(result.models, 12, value => {
    const item = object(value)
    if (typeof item.available !== 'boolean') return invalid()
    return { id: text(item.id, 200, true), label: text(item.label, 200, true), available: item.available, ...('fallbackModelId' in item ? { fallbackModelId: text(item.fallbackModelId, 200, true) } : {}) }
  })
  const defaultModelId = text(result.defaultModelId, 200, true)
  if (!models.some(model => model.id === defaultModelId) || new Set(models.map(model => model.id)).size !== models.length) return invalid()
  if (models.some(model => model.fallbackModelId && (model.fallbackModelId === model.id || !models.some(target => target.id === model.fallbackModelId)))) return invalid()
  return { models, defaultModelId }
}
export async function getChatConversations(): Promise<ChatConversation[]> {
  const result = object(await request<unknown>('/chat/conversations'))
  return list(result.conversations, 50, parseConversation)
}
export async function createChatConversation(csrfToken: string): Promise<ChatConversation> {
  return parseConversation(await request<unknown>('/chat/conversations', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}', csrfToken }))
}
export async function getChatConversation(id: string): Promise<ChatDetail> {
  const result = object(await request<unknown>(`/chat/conversations/${uuid(id)}`))
  const conversation = parseConversation(result.conversation)
  if (conversation.id !== id) return invalid()
  return { conversation, turns: list(result.turns, 100, parseChatTurn) }
}
export async function cancelChatTurn(id: string, requestId: string, csrfToken: string): Promise<ChatTurn> {
  const turn = parseChatTurn(await request<unknown>(`/chat/conversations/${uuid(id)}/turns/${uuid(requestId)}/cancel`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}', csrfToken }))
  if (turn.requestId !== requestId || turn.status === 'streaming') return invalid()
  return turn
}
export async function consumeChatStream(body: ReadableStream<Uint8Array>, onEvent: (event: ChatEvent) => void, conversationId: string, requestId: string): Promise<void> {
  let started: ChatTurn | null = null
  let switched = false
  let length = 0
  for await (const message of readSseEvents(body)) {
    let value: unknown
    try { value = JSON.parse(message.data) } catch { return invalid() }
    const event = parseEvent(value)
    if (message.event !== event.type) return invalid()
    if (event.type === 'delta') {
      if (!started || event.requestId !== requestId) return invalid()
      length += Array.from(event.text).length
      if (length > 16000) return invalid()
    } else {
      if (event.conversationId !== conversationId || event.turn.requestId !== requestId) return invalid()
      if (event.type === 'start') {
        if (started) return invalid()
        started = event.turn
        length = Array.from(event.turn.answer).length
      } else if (event.type === 'fallback') {
        if (!started || switched || length !== 0 || started.status !== 'streaming'
          || event.turn.status !== 'streaming' || event.turn.answer !== '' || event.turn.error !== null
          || event.turn.requestedModelId !== started.requestedModelId || event.turn.requestedModelLabel !== started.requestedModelLabel
          || event.turn.modelId === started.modelId || event.turn.content !== started.content || event.turn.createdAt !== started.createdAt) return invalid()
        switched = true
      } else if (!started || event.turn.status === 'streaming') return invalid()
    }
    onEvent(event)
    if (event.type === 'done') return
  }
  throw new Error('连接中断，未收到完整结果')
}
export async function startChatStream(id: string, input: ChatInput, csrfToken: string, signal: AbortSignal, onEvent: (event: ChatEvent) => void): Promise<void> {
  const response = await requestResponse(`/chat/conversations/${uuid(id)}/stream`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'text/event-stream' }, csrfToken, signal,
    body: JSON.stringify({ requestId: uuid(input.requestId), content: text(input.content, 4000, true), modelId: text(input.modelId, 200, true) }),
  })
  if (!response.body || !response.headers.get('Content-Type')?.toLowerCase().startsWith('text/event-stream')) {
    await response.body?.cancel().catch(() => {})
    throw new Error('未收到有效的对话数据流，请重新加载会话确认结果')
  }
  await consumeChatStream(response.body, onEvent, id, input.requestId)
}
