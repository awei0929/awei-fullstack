import { request } from './http'
import type { ChatLog, ChatLogChannel, ChatLogPage, ChatLogQuery, ChatLogStatus } from '../types/chat-log'

const CHANNELS: ChatLogChannel[] = ['site', 'owner']
const STATUSES: ChatLogStatus[] = ['streaming', 'completed', 'failed', 'canceled', 'interrupted']

function invalid(): never {
  throw new Error('对话日志格式无效，请稍后重试')
}

function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return invalid()
  return value as Record<string, unknown>
}

function text(value: unknown): string {
  if (typeof value !== 'string') return invalid()
  return value
}

function nullableText(value: unknown): string | null {
  if (value === null) return null
  return text(value)
}

function dateText(value: unknown): string {
  const result = text(value)
  if (Number.isNaN(Date.parse(result))) return invalid()
  return result
}

function nullableDateText(value: unknown): string | null {
  if (value === null) return null
  return dateText(value)
}

function integer(value: unknown): number {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 0) return invalid()
  return value
}

function parseLog(value: unknown): ChatLog {
  const item = object(value)
  if (!CHANNELS.includes(item.channel as ChatLogChannel)) return invalid()
  if (!STATUSES.includes(item.status as ChatLogStatus)) return invalid()
  if (item.durationMs !== null && (typeof item.durationMs !== 'number' || !Number.isFinite(item.durationMs) || item.durationMs < 0)) return invalid()
  return {
    id: text(item.id),
    channel: item.channel as ChatLogChannel,
    conversationId: nullableText(item.conversationId),
    turnId: nullableText(item.turnId),
    question: text(item.question),
    answer: text(item.answer),
    status: item.status as ChatLogStatus,
    error: nullableText(item.error),
    durationMs: item.durationMs as number | null,
    startedAt: dateText(item.startedAt),
    finishedAt: nullableDateText(item.finishedAt),
  }
}

export async function listChatLogs(query: ChatLogQuery = {}): Promise<ChatLogPage> {
  const search = new URLSearchParams()
  if (query.channel) search.set('channel', query.channel)
  if (query.status) search.set('status', query.status)
  if (query.limit !== undefined) search.set('limit', String(query.limit))
  if (query.offset !== undefined) search.set('offset', String(query.offset))
  const suffix = search.size ? `?${search.toString()}` : ''
  const body = object(await request<unknown>(`/chat-logs${suffix}`))
  if (!Array.isArray(body.logs) || body.logs.length > 100) return invalid()
  return {
    logs: body.logs.map(parseLog),
    total: integer(body.total),
    limit: integer(body.limit),
    offset: integer(body.offset),
  }
}
