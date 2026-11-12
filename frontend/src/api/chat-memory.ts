import { request } from './http'
import type { ChatMemory } from '../types/chat-memory'

function invalid(): never { throw new Error('记忆数据格式异常，请重新加载') }
function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return invalid()
  return value as Record<string, unknown>
}
function uuid(value: unknown): string {
  if (typeof value !== 'string' || !/^[a-f\d]{8}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{12}$/i.test(value)) return invalid()
  return value
}
function parseMemory(value: unknown): ChatMemory {
  const item = object(value)
  if (typeof item.content !== 'string' || !item.content.trim() || Array.from(item.content).length > 500 || typeof item.enabled !== 'boolean') return invalid()
  const date = (value: unknown) => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(value) && Number.isFinite(Date.parse(value)) ? value : invalid()
  return { id: uuid(item.id), content: item.content, enabled: item.enabled, createdAt: date(item.createdAt), updatedAt: date(item.updatedAt) }
}
export async function getChatMemories(): Promise<ChatMemory[]> {
  const value = object(await request<unknown>('/chat/memories')).memories
  if (!Array.isArray(value) || value.length > 20) return invalid()
  const items = value.map(parseMemory)
  if (new Set(items.map(item => item.id)).size !== items.length) return invalid()
  return items
}
export async function createChatMemory(content: string, csrfToken: string): Promise<ChatMemory> {
  return parseMemory(await request<unknown>('/chat/memories', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ content }), csrfToken }))
}
export async function updateChatMemory(id: string, input: { content?: string; enabled?: boolean }, csrfToken: string): Promise<ChatMemory> {
  // 仅投影允许字段，不允许把身份或其他上游参数带入记忆接口。
  const item = parseMemory(await request<unknown>(`/chat/memories/${uuid(id)}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...(input.content !== undefined ? { content: input.content } : {}), ...(input.enabled !== undefined ? { enabled: input.enabled } : {}) }), csrfToken }))
  if (item.id !== id) return invalid()
  return item
}
export async function deleteChatMemory(id: string, csrfToken: string): Promise<string> {
  const value = object(await request<unknown>(`/chat/memories/${uuid(id)}`, { method: 'DELETE', csrfToken }))
  if (uuid(value.id) !== id) return invalid()
  return id
}
