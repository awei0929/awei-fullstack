import { makeAutoObservable, reaction, runInAction } from 'mobx'
import * as chatLogsApi from '../api/chat-logs'
import { HttpError } from '../api/http'
import type { ChatLog, ChatLogChannel, ChatLogStatus } from '../types/chat-log'
import { authStore } from './auth'

const PAGE_SIZE = 20

export class ChatLogsStore {
  logs: ChatLog[] = []
  total = 0
  page = 1
  channel: ChatLogChannel | 'all' = 'all'
  status: ChatLogStatus | 'all' = 'all'
  loading = false
  error = ''
  loaded = false
  private active = false
  private requestVersion = 0

  constructor() {
    makeAutoObservable(this, {}, { autoBind: true })
    reaction(() => `${authStore.identityVersion}:${authStore.ready}`, () => {
      if (this.active) this.syncIdentity()
    })
  }

  get pageCount(): number {
    return Math.max(1, Math.ceil(this.total / PAGE_SIZE))
  }

  get hasPrevious(): boolean {
    return this.page > 1
  }

  get hasNext(): boolean {
    return this.page < this.pageCount
  }

  activate(): void {
    this.active = true
    if (authStore.ready && authStore.user) void this.load()
  }

  deactivate(): void {
    this.active = false
    this.requestVersion += 1
    this.loading = false
  }

  setChannel(value: ChatLogChannel | 'all'): void {
    if (value === this.channel) return
    this.channel = value
    this.page = 1
    void this.load()
  }

  setStatus(value: ChatLogStatus | 'all'): void {
    if (value === this.status) return
    this.status = value
    this.page = 1
    void this.load()
  }

  previous(): void {
    if (!this.hasPrevious) return
    this.page -= 1
    void this.load()
  }

  next(): void {
    if (!this.hasNext) return
    this.page += 1
    void this.load()
  }

  refresh(): void {
    void this.load()
  }

  // 身份切换时清空上一位站主的分页和内容，避免旧响应落到新会话。
  private syncIdentity(): void {
    this.requestVersion += 1
    this.logs = []
    this.total = 0
    this.page = 1
    this.loading = false
    this.error = ''
    this.loaded = false
    if (!authStore.user || !authStore.ready) return
    void this.load()
  }

  async load(): Promise<void> {
    if (!authStore.user || !authStore.ready) return
    const identity = authStore.identityVersion
    const version = ++this.requestVersion
    this.loading = true
    this.error = ''
    try {
      const page = await chatLogsApi.listChatLogs({
        ...(this.channel === 'all' ? {} : { channel: this.channel }),
        ...(this.status === 'all' ? {} : { status: this.status }),
        limit: PAGE_SIZE,
        offset: (this.page - 1) * PAGE_SIZE,
      })
      if (version !== this.requestVersion) return
      runInAction(() => {
        this.logs = page.logs
        this.total = page.total
        this.page = Math.floor(page.offset / page.limit) + 1
        this.loading = false
        this.loaded = true
      })
    } catch (error) {
      if (version !== this.requestVersion) return
      runInAction(() => {
        // 加载失败保留已有日志，只展示错误和重试入口。
        this.error = error instanceof Error ? error.message : '对话日志加载失败，请稍后重试'
        this.loading = false
      })
      if (error instanceof HttpError && error.status === 401) authStore.expireSession(identity)
    }
  }
}

export const chatLogsStore = new ChatLogsStore()
