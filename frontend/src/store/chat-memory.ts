import { makeAutoObservable, reaction, runInAction } from 'mobx'
import * as api from '../api/chat-memory'
import { getSession } from '../api/auth'
import { HttpError } from '../api/http'
import type { ChatMemory } from '../types/chat-memory'
import { authStore } from './auth'

// 记忆独立于聊天流和官网草稿；身份/操作版本使旧请求不能改写新身份的数据。
export class ChatMemoryStore {
  memories: ChatMemory[] = []
  loading = false
  loaded = false
  busy = false
  forbidden = false
  loadError = ''
  writeError = ''
  notice = ''
  open = false
  editorOpen = false
  editingId: string | null = null
  deleteId: string | null = null
  draft = ''
  private active = false
  private identity = -1
  private lifecycle = 0
  private loadVersion = 0
  private operation = 0
  private dispose: (() => void) | null = null
  constructor() { makeAutoObservable<this, 'dispose'>(this, { dispose: false }, { autoBind: true }) }
  get enabledCount(): number { return this.memories.filter(item => item.enabled).length }
  get draftLength(): number { return Array.from(this.draft.trim()).length }
  get canSave(): boolean { return this.current(this.identity, this.lifecycle) && this.loaded && !this.busy && !this.forbidden && this.draftLength > 0 && this.draftLength <= 500 && (Boolean(this.editingId) || this.memories.length < 20) }
  activate(): void {
    if (this.active) return
    this.active = true
    this.dispose = reaction(() => `${authStore.identityVersion}:${authStore.ready}:${authStore.loggingOut}`, this.syncIdentity, { fireImmediately: true })
  }
  deactivate(): void { this.active = false; this.dispose?.(); this.dispose = null; this.reset() }
  private reset(): void {
    this.lifecycle++; this.loadVersion++; this.operation++
    this.memories = []; this.loading = false; this.loaded = false; this.busy = false; this.forbidden = false
    this.loadError = ''; this.writeError = ''; this.notice = ''; this.open = false; this.editorOpen = false
    this.editingId = null; this.deleteId = null; this.draft = ''
  }
  private syncIdentity(): void {
    this.reset(); this.identity = authStore.identityVersion
    if (this.current(this.identity, this.lifecycle)) void this.load()
  }
  private current(identity: number, lifecycle: number): boolean {
    return this.active && authStore.ready && Boolean(authStore.user) && !authStore.loggingOut && identity === authStore.identityVersion && lifecycle === this.lifecycle
  }
  private fail(error: unknown, identity: number): boolean {
    if (!(error instanceof HttpError)) return false
    if (error.status === 401) { authStore.expireSession(identity); return true }
    if (error.status === 403 && error.code !== 'CSRF_INVALID') {
      this.reset(); this.forbidden = true; this.loadError = '此账号没有记忆管理权限'; return true
    }
    if (error.status === 403) authStore.csrfToken = ''
    return false
  }
  async load(): Promise<void> {
    if (!this.current(this.identity, this.lifecycle) || this.busy) return
    const identity = this.identity, lifecycle = this.lifecycle, version = ++this.loadVersion
    this.loading = true; this.loadError = ''
    try {
      const memories = await api.getChatMemories()
      runInAction(() => { if (this.current(identity, lifecycle) && version === this.loadVersion) { this.memories = memories; this.loaded = true } })
    } catch (error) {
      runInAction(() => { if (this.current(identity, lifecycle) && version === this.loadVersion && !this.fail(error, identity)) this.loadError = error instanceof Error ? error.message : '暂时无法读取记忆' })
    } finally { runInAction(() => { if (this.current(identity, lifecycle) && version === this.loadVersion) this.loading = false }) }
  }
  openManager(content?: string): void {
    if (!this.current(this.identity, this.lifecycle) || this.forbidden || this.busy) return
    this.open = true; this.notice = ''; this.writeError = ''; this.deleteId = null
    if (content !== undefined) this.startNew(content)
  }
  close(): void { if (!this.busy) { this.open = false; this.cancelEdit(); this.deleteId = null } }
  startNew(content = ''): void {
    if (this.busy) return
    this.editingId = null; this.draft = content; this.editorOpen = true; this.writeError = ''; this.notice = ''; this.deleteId = null
  }
  edit(item: ChatMemory): void {
    if (this.busy) return
    this.editingId = item.id; this.draft = item.content; this.editorOpen = true; this.writeError = ''; this.notice = ''; this.deleteId = null
  }
  cancelEdit(): void { if (!this.busy) { this.editorOpen = false; this.editingId = null; this.draft = ''; this.writeError = '' } }
  setDraft(value: string): void { if (!this.busy) this.draft = value }
  askDelete(id: string): void { if (!this.busy && this.memories.some(item => item.id === id)) { this.deleteId = id; this.writeError = ''; this.notice = '' } }
  cancelDelete(): void { if (!this.busy) { this.deleteId = null; this.writeError = '' } }
  private async write(action: (token: string) => Promise<ChatMemory | string>, apply: (value: ChatMemory | string) => void): Promise<boolean> {
    if (!this.current(this.identity, this.lifecycle) || this.forbidden || this.busy) return false
    const identity = this.identity, lifecycle = this.lifecycle, operation = ++this.operation
    this.busy = true; this.writeError = ''; this.notice = ''; this.loadVersion++; this.loading = false
    try {
      let token = authStore.csrfToken
      if (!token) {
        const session = await getSession()
        if (!this.current(identity, lifecycle)) return false
        if (session.user?.id !== authStore.user?.id) throw new HttpError('登录已失效', 401)
        token = session.csrfToken
        runInAction(() => { authStore.csrfToken = token })
      }
      if (!this.current(identity, lifecycle)) return false
      const result = await action(token)
      if (!this.current(identity, lifecycle)) return false
      runInAction(() => apply(result)); return true
    } catch (error) {
      runInAction(() => { if (this.current(identity, lifecycle) && !this.fail(error, identity)) this.writeError = error instanceof Error ? error.message : '暂时无法保存记忆' }); return false
    } finally { runInAction(() => { if (this.current(identity, lifecycle) && operation === this.operation) this.busy = false }) }
  }
  private upsert(value: ChatMemory | string): void {
    if (typeof value === 'string') return
    this.memories = [value, ...this.memories.filter(item => item.id !== value.id)].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
  }
  async save(): Promise<boolean> {
    if (!this.canSave) return false
    const id = this.editingId, content = this.draft.trim()
    return this.write(token => id ? api.updateChatMemory(id, { content }, token) : api.createChatMemory(content, token), result => {
      this.upsert(result); this.editorOpen = false; this.editingId = null; this.draft = ''; this.notice = '记忆已保存，将用于后续对话'
    })
  }
  async toggle(item: ChatMemory): Promise<boolean> {
    return this.write(token => api.updateChatMemory(item.id, { enabled: !item.enabled }, token), result => { this.upsert(result); this.notice = item.enabled ? '记忆已停用，后续对话不再使用' : '记忆已启用，将用于后续对话' })
  }
  async remove(): Promise<boolean> {
    const id = this.deleteId
    if (!id) return false
    return this.write(token => api.deleteChatMemory(id, token), () => {
      this.memories = this.memories.filter(item => item.id !== id); this.deleteId = null
      if (this.editingId === id) { this.editorOpen = false; this.editingId = null; this.draft = '' }
      this.notice = '记忆已删除，后续对话不再使用'
    })
  }
}
export const chatMemoryStore = new ChatMemoryStore()
