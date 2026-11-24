import { makeAutoObservable, runInAction } from 'mobx'
import {
  deleteSiteChatConversation,
  getSiteChatConversation,
  getSiteChatStatus,
  listSiteChatConversations,
  streamSiteChat,
  type SiteChatConversationSummary,
  type SiteChatTurn,
} from '../api/site-chat'
import { createUuid } from '../utils/visitor'

const now = () => new Date().toISOString()

// 会话与消息都只存在服务端；这里只缓存当前标签页的展示状态。
export class SiteChatStore {
  conversations: SiteChatConversationSummary[] = []
  activeId: string | null = null
  turns: SiteChatTurn[] = []
  status: 'loading' | 'ready' | 'closed' | 'error' = 'loading'
  available = false
  loadingList = false
  loadingConversation = false
  sending = false
  notice = ''
  private abort: AbortController | null = null
  private openVersion = 0
  private sendVersion = 0

  constructor() {
    makeAutoObservable<this, 'abort' | 'openVersion' | 'sendVersion'>(this, { abort: false, openVersion: false, sendVersion: false }, { autoBind: true })
  }

  async loadStatus(): Promise<void> {
    try {
      const result = await getSiteChatStatus()
      runInAction(() => {
        this.available = result.available
        this.status = result.enabled ? 'ready' : 'closed'
      })
    } catch {
      runInAction(() => { this.status = 'error' })
    }
  }

  async loadList(): Promise<void> {
    if (this.loadingList) return
    this.loadingList = true
    try {
      const conversations = await listSiteChatConversations()
      runInAction(() => { this.conversations = conversations })
    } catch {
      // 列表失败不覆盖当前对话；用户仍可继续发消息。
    } finally {
      runInAction(() => { this.loadingList = false })
    }
  }

  async open(id: string): Promise<void> {
    if (this.sending) return
    const version = ++this.openVersion
    this.loadingConversation = true
    this.notice = ''
    try {
      const view = await getSiteChatConversation(id)
      if (version !== this.openVersion) return
      runInAction(() => {
        this.activeId = view.conversation.id
        this.turns = view.turns
      })
    } catch (error) {
      if (version !== this.openVersion) return
      runInAction(() => {
        this.activeId = null
        this.turns = []
        this.notice = error instanceof Error && error.message ? error.message : '无法读取这段对话'
      })
    } finally {
      if (version === this.openVersion) runInAction(() => { this.loadingConversation = false })
    }
  }

  async send(message: string): Promise<boolean> {
    const content = message.trim()
    if (!content || this.sending) return false
    const version = ++this.sendVersion
    const requestId = createUuid()
    const createdAt = now()
    const turn: SiteChatTurn = {
      requestId,
      content,
      answer: '',
      status: 'streaming',
      modelId: '',
      error: '',
      createdAt,
      updatedAt: createdAt,
    }
    let started = false
    let answer = ''
    const controller = new AbortController()
    this.abort = controller
    runInAction(() => {
      this.turns.push(turn)
      this.notice = ''
      this.sending = true
    })
    try {
      await streamSiteChat(
        { message: content, conversationId: this.activeId ?? undefined, requestId },
        controller.signal,
        text => {
          if (version !== this.sendVersion) return
          answer += text
          runInAction(() => {
            const current = this.turns.find(item => item.requestId === requestId)
            if (!current) return
            current.answer = answer
            current.updatedAt = now()
          })
        },
        ids => {
          if (version !== this.sendVersion) return
          started = true
          runInAction(() => {
            this.activeId = ids.conversationId
            const current = this.turns.find(item => item.requestId === requestId)
            if (current) current.updatedAt = now()
          })
          void this.loadList()
        },
      )
      if (version !== this.sendVersion) return true
      runInAction(() => {
        const current = this.turns.find(item => item.requestId === requestId)
        if (current) { current.status = 'completed'; current.updatedAt = now() }
      })
      void this.loadList()
      return true
    } catch (error) {
      if (version !== this.sendVersion) return true
      const aborted = controller.signal.aborted
      const text = aborted ? '已停止生成。' : (error instanceof Error && error.message ? error.message : '对话暂时不可用，请稍后再试')
      runInAction(() => {
        const current = this.turns.find(item => item.requestId === requestId)
        if (current) {
          current.status = aborted ? 'canceled' : 'failed'
          current.error = aborted ? '' : text
          current.updatedAt = now()
        }
        // 请求在受理前就被拒绝（限流/无模型）时没有服务端记录，移除乐观插入。
        if (!started && !answer) this.turns = this.turns.filter(item => item.requestId !== requestId)
        this.notice = text
      })
      if (started) void this.loadList()
      // 只要请求被受理过，输入框就应清空；失败提示由用户决定是否重试。
      return true
    } finally {
      if (version === this.sendVersion) {
        if (this.abort === controller) this.abort = null
        runInAction(() => { this.sending = false })
      }
    }
  }

  stop(): void {
    this.abort?.abort()
  }

  async remove(id: string): Promise<void> {
    if (this.sending) return
    try {
      await deleteSiteChatConversation(id)
      runInAction(() => {
        this.conversations = this.conversations.filter(item => item.id !== id)
        if (this.activeId === id) this.newChat()
      })
    } catch (error) {
      runInAction(() => { this.notice = error instanceof Error && error.message ? error.message : '删除失败，请稍后再试' })
    }
  }

  newChat(): void {
    this.openVersion += 1
    this.sendVersion += 1
    this.abort?.abort()
    this.abort = null
    this.activeId = null
    this.turns = []
    this.notice = ''
    this.sending = false
  }
}

export const siteChatStore = new SiteChatStore()
