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
import { notifyError } from '../utils/error-tips'
import { createUuid } from '../utils/visitor'

const now = () => new Date().toISOString()
const cut = (value: string, max: number) => Array.from(value).slice(0, max).join('')

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
  private abort: AbortController | null = null
  private openVersion = 0
  private sendVersion = 0
  private listPromise: Promise<void> | null = null
  private listLoadedAt = 0
  private statusPromise: Promise<void> | null = null
  private openPromise: { id: string; promise: Promise<void> } | null = null
  private initializedAt = 0

  constructor() {
    makeAutoObservable<this, 'abort' | 'openVersion' | 'sendVersion' | 'listPromise' | 'listLoadedAt' | 'statusPromise' | 'openPromise' | 'initializedAt'>(
      this,
      { abort: false, openVersion: false, sendVersion: false, listPromise: false, listLoadedAt: false, statusPromise: false, openPromise: false, initializedAt: false },
      { autoBind: true },
    )
  }

  // 页面挂载只拉一次；StrictMode 的第二次挂载直接复用同一个 Promise。
  async initialize(): Promise<void> {
    if (this.initializedAt && Date.now() - this.initializedAt < 1000) return
    await Promise.all([this.loadStatus(), this.loadList()])
    this.initializedAt = Date.now()
  }

  async loadStatus(): Promise<void> {
    if (this.statusPromise) return this.statusPromise
    this.statusPromise = (async () => {
      try {
        const result = await getSiteChatStatus()
        runInAction(() => {
          this.available = result.available
          this.status = result.enabled ? 'ready' : 'closed'
        })
      } catch (error) {
        runInAction(() => { this.status = 'error' })
        notifyError(error instanceof Error && error.message ? error.message : '无法连接对话服务，请稍后重试')
      } finally {
        this.statusPromise = null
      }
    })()
    return this.statusPromise
  }

  async loadList(): Promise<void> {
    if (this.listPromise) return this.listPromise
    // 短时间内的重复挂载/重复调用复用刚才的结果，避免 StrictMode 发两次列表请求。
    if (this.listLoadedAt && Date.now() - this.listLoadedAt < 1000) return
    this.loadingList = true
    this.listPromise = (async () => {
      try {
        const conversations = await listSiteChatConversations()
        runInAction(() => { this.conversations = conversations })
      } catch (error) {
        // 列表失败不覆盖当前对话；用户仍可继续发消息。
        notifyError(error instanceof Error && error.message ? error.message : '历史对话加载失败，请稍后重试')
      } finally {
        runInAction(() => { this.loadingList = false })
        this.listLoadedAt = Date.now()
        this.listPromise = null
      }
    })()
    return this.listPromise
  }

  async open(id: string): Promise<void> {
    if (this.sending) return
    // StrictMode 会把同一个路由 effect 跑两次；同一个 id 的读取共用一次请求。
    if (this.openPromise?.id === id) return this.openPromise.promise
    const version = ++this.openVersion
    this.loadingConversation = true
    const promise = (async () => {
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
        })
        notifyError(error instanceof Error && error.message ? error.message : '无法读取这段对话')
      } finally {
        if (version === this.openVersion) runInAction(() => { this.loadingConversation = false })
      }
    })()
    this.openPromise = { id, promise }
    try { await promise } finally {
      if (this.openPromise?.promise === promise) this.openPromise = null
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
            // SSE 的 start 已经带回了会话 ID：本地补一条摘要，不再为发消息额外请求列表。
            const summary = this.conversations.find(item => item.id === ids.conversationId)
            if (summary) {
              summary.messageCount += 1
              summary.updatedAt = now()
              summary.preview = cut(content, 80)
            } else {
              this.conversations.unshift({
                id: ids.conversationId,
                title: cut(content, 24) || '新对话',
                updatedAt: now(),
                messageCount: 1,
                preview: cut(content, 80),
              })
            }
          })
        },
      )
      if (version !== this.sendVersion) return true
      runInAction(() => {
        const current = this.turns.find(item => item.requestId === requestId)
        if (current) { current.status = 'completed'; current.updatedAt = now() }
        const summary = this.conversations.find(item => item.id === this.activeId)
        if (summary) {
          summary.updatedAt = now()
          if (answer) summary.preview = cut(answer, 80)
        }
      })
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
      })
      notifyError(text)
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
      notifyError(error instanceof Error && error.message ? error.message : '删除失败，请稍后再试')
    }
  }

  newChat(): void {
    this.openVersion += 1
    this.sendVersion += 1
    this.abort?.abort()
    this.abort = null
    this.activeId = null
    this.turns = []
    this.sending = false
  }
}

export const siteChatStore = new SiteChatStore()
