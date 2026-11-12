import { makeAutoObservable, reaction, runInAction } from 'mobx'
import * as chatApi from '../api/chat'
import { getSession } from '../api/auth'
import { HttpError } from '../api/http'
import type { ChatConversation, ChatEvent, ChatModel, ChatTurn } from '../types/chat'
import { authStore } from './auth'

interface ChatRun {
  identity: number
  view: number
  conversationId: string
  requestId: string
  controller: AbortController
  csrfToken: string
  accepted: boolean
  stopping: boolean
  done: boolean
}
const errorText = (error: unknown) => error instanceof Error ? error.message : '暂时无法完成请求，请重试'

export class ChatStore {
  models: ChatModel[] = []
  conversations: ChatConversation[] = []
  selectedModelId = ''
  selectedConversationId: string | null = null
  turns: ChatTurn[] = []
  draft = ''
  loading = false
  loadingConversation = false
  creating = false
  sending = false
  stopping = false
  forbidden = false
  loadError = ''
  detailError = ''
  sendError = ''
  private active = false
  private identity = -1
  private viewVersion = 0
  private loadVersion = 0
  private activeRun: ChatRun | null = null
  private disposeIdentity: (() => void) | null = null

  constructor() {
    makeAutoObservable<this, 'activeRun' | 'disposeIdentity'>(this, { activeRun: false, disposeIdentity: false }, { autoBind: true })
  }

  get busy(): boolean { return this.sending || this.stopping || this.creating }
  get hasStreamingTurn(): boolean { return this.turns.some(turn => turn.status === 'streaming') }
  get available(): boolean { return this.models.some(model => model.id === this.selectedModelId && model.available) }
  get canSend(): boolean {
    const length = Array.from(this.draft.trim()).length
    return this.active && authStore.ready && Boolean(authStore.user) && !authStore.loggingOut && !this.forbidden && !this.loading && !this.loadingConversation && !this.detailError && !this.busy && !this.hasStreamingTurn && this.available && length > 0 && length <= 4000 && this.turns.length < 100
  }

  activate(): void {
    if (this.active) return
    this.active = true
    this.disposeIdentity = reaction(() => `${authStore.identityVersion}:${authStore.ready}:${authStore.loggingOut}`, this.syncIdentity, { fireImmediately: true })
  }

  deactivate(): void {
    this.detachRun()
    this.active = false
    this.disposeIdentity?.()
    this.disposeIdentity = null
    this.viewVersion += 1
    this.loadVersion += 1
    this.loading = false
    this.loadingConversation = false
    this.creating = false
  }

  private syncIdentity(): void {
    this.detachRun()
    this.viewVersion += 1
    this.loadVersion += 1
    this.loading = false
    this.loadingConversation = false
    this.creating = false
    if (this.identity !== authStore.identityVersion || !authStore.user) {
      this.models = []; this.conversations = []; this.turns = []
      this.selectedConversationId = null; this.selectedModelId = ''; this.draft = ''
      this.loadError = ''; this.detailError = ''; this.sendError = ''; this.forbidden = false
    }
    this.identity = authStore.identityVersion
    if (this.current(this.identity)) void this.refresh()
  }

  private current(identity: number, view?: number): boolean {
    return this.active && authStore.ready && Boolean(authStore.user) && !authStore.loggingOut
      && identity === authStore.identityVersion && (view === undefined || view === this.viewVersion)
  }

  private currentRun(run: ChatRun): boolean {
    return this.activeRun === run && this.current(run.identity, run.view) && this.selectedConversationId === run.conversationId
  }

  private authFailure(error: unknown, identity: number): boolean {
    if (!(error instanceof HttpError)) return false
    if (error.status === 401) { authStore.expireSession(identity); return true }
    if (error.status === 403 && error.code !== 'CSRF_INVALID') {
      this.detachRun()
      this.models = []; this.conversations = []; this.turns = []; this.draft = ''
      this.selectedConversationId = null
      this.forbidden = true
      this.loadError = '此账号没有 AI 对话权限，请使用站主账号。'
      return true
    }
    if (error.status === 403) authStore.csrfToken = ''
    return false
  }

  private async writeToken(identity: number): Promise<string> {
    if (authStore.csrfToken) return authStore.csrfToken
    const session = await getSession()
    if (!this.current(identity) || session.user?.id !== authStore.user?.id) throw new HttpError('登录已失效', 401)
    runInAction(() => { authStore.csrfToken = session.csrfToken })
    return session.csrfToken
  }

  setDraft(value: string): void { if (!this.busy) this.draft = value }
  setModel(id: string): void {
    if (!this.busy && this.models.some(model => model.id === id && model.available)) this.selectedModelId = id
  }
  editTurn(turn: ChatTurn): void {
    if (this.busy) return
    this.draft = turn.content
    this.sendError = ''
  }

  async refresh(): Promise<void> {
    if (!this.current(authStore.identityVersion) || this.busy) return
    const identity = authStore.identityVersion
    const version = ++this.loadVersion
    this.loading = true
    this.loadError = ''
    const results = await Promise.allSettled([chatApi.getChatModels(), chatApi.getChatConversations()])
    if (!this.current(identity) || version !== this.loadVersion) return
    runInAction(() => {
      for (const result of results) {
        if (result.status === 'rejected' && this.authFailure(result.reason, identity)) { this.loading = false; return }
      }
      const [models, conversations] = results
      if (models.status === 'fulfilled') {
        this.models = models.value.models
        if (!this.models.some(model => model.id === this.selectedModelId && model.available)) this.selectedModelId = models.value.defaultModelId
      }
      if (conversations.status === 'fulfilled') this.conversations = conversations.value
      this.forbidden = false
      this.loadError = results.filter(result => result.status === 'rejected').map(result => errorText(result.reason)).join('；')
      this.loading = false
    })
    if (!this.current(identity) || this.forbidden) return
    const selected = this.selectedConversationId ?? this.conversations[0]?.id
    if (selected) await this.selectConversation(selected)
  }

  async selectConversation(id: string): Promise<void> {
    if (!this.current(authStore.identityVersion) || this.creating) return
    this.detachRun()
    const identity = authStore.identityVersion
    const view = ++this.viewVersion
    const changed = id !== this.selectedConversationId
    this.selectedConversationId = id
    if (changed) { this.turns = []; this.draft = '' }
    this.loadingConversation = true
    this.detailError = ''; this.sendError = ''
    try {
      const detail = await chatApi.getChatConversation(id)
      runInAction(() => {
        if (!this.current(identity, view)) return
        this.turns = detail.turns
        this.updateConversation(detail.conversation)
        const previousModel = detail.turns.at(-1)?.requestedModelId
        if (previousModel && this.models.some(model => model.id === previousModel && model.available)) this.selectedModelId = previousModel
      })
    } catch (error) {
      runInAction(() => {
        if (!this.current(identity, view) || this.authFailure(error, identity)) return
        this.detailError = errorText(error)
      })
    } finally { runInAction(() => { if (this.current(identity, view)) this.loadingConversation = false }) }
  }

  async createConversation(): Promise<void> {
    if (!this.current(authStore.identityVersion) || this.creating || this.loading || this.forbidden) return
    this.detachRun()
    const identity = authStore.identityVersion
    const view = ++this.viewVersion
    this.creating = true
    this.sendError = ''
    try {
      const token = await this.writeToken(identity)
      if (!this.current(identity, view)) return
      const conversation = await chatApi.createChatConversation(token)
      runInAction(() => {
        if (!this.current(identity, view)) return
        this.updateConversation(conversation)
        this.selectedConversationId = conversation.id
        this.turns = []; this.draft = ''; this.detailError = ''
      })
    } catch (error) {
      runInAction(() => { if (this.current(identity, view) && !this.authFailure(error, identity)) this.sendError = errorText(error) })
    } finally { runInAction(() => { if (this.current(identity, view)) { this.creating = false; this.loadingConversation = false } }) }
  }

  private updateConversation(conversation: ChatConversation): void {
    this.conversations = [conversation, ...this.conversations.filter(item => item.id !== conversation.id)].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).slice(0, 50)
  }

  private updateTurn(turn: ChatTurn): void {
    const index = this.turns.findIndex(item => item.requestId === turn.requestId)
    if (index < 0) this.turns.push(turn)
    else this.turns[index] = turn
  }

  private receive(run: ChatRun, event: ChatEvent): void {
    if (!this.currentRun(run) || run.stopping) return
    if (event.type === 'delta') {
      const turn = this.turns.find(item => item.requestId === run.requestId)
      if (turn?.status === 'streaming') turn.answer += event.text
      return
    }
    this.updateTurn(event.turn)
    if (event.type === 'start') {
      run.accepted = true
      this.draft = ''
      const conversation = this.conversations.find(item => item.id === run.conversationId)
      if (conversation) this.updateConversation({ ...conversation, title: this.turns.length === 1 ? Array.from(event.turn.content).slice(0, 40).join('') : conversation.title, updatedAt: event.turn.updatedAt })
    } else if (event.type === 'done') {
      run.done = true
      this.sendError = event.turn.error || ''
    }
  }

  async send(): Promise<void> {
    if (!this.canSend) return
    const identity = authStore.identityVersion
    const view = this.viewVersion
    const content = this.draft.trim()
    const modelId = this.selectedModelId
    this.sending = true
    this.sendError = ''
    let run: ChatRun | null = null
    try {
      const token = await this.writeToken(identity)
      if (!this.current(identity, view)) return
      let conversationId = this.selectedConversationId
      if (!conversationId) {
        const conversation = await chatApi.createChatConversation(token)
        if (!this.current(identity, view)) return
        runInAction(() => { this.updateConversation(conversation); this.selectedConversationId = conversation.id })
        conversationId = conversation.id
      }
      run = { identity, view, conversationId, requestId: crypto.randomUUID(), controller: new AbortController(), csrfToken: token, accepted: false, stopping: false, done: false }
      this.activeRun = run
      await chatApi.startChatStream(conversationId, { requestId: run.requestId, content, modelId }, token, run.controller.signal, event => this.receive(run!, event))
    } catch (error) {
      if (!this.current(identity, view) || (run && !this.currentRun(run))) return
      let handled = false
      runInAction(() => {
        handled = this.authFailure(error, identity)
        if (!handled && !run?.stopping) this.sendError = errorText(error)
      })
      if (!handled && run && !run.stopping && !(error instanceof HttpError)) await this.reconcile(run)
    } finally {
      runInAction(() => {
        if (!this.current(identity, view) || (run && !this.currentRun(run)) || run?.stopping) return
        this.activeRun = null
        this.sending = false
      })
    }
  }

  private async reconcile(run: ChatRun): Promise<void> {
    if (!this.currentRun(run)) return
    run.controller.abort()
    runInAction(() => {
      const turn = this.turns.find(item => item.requestId === run.requestId)
      if (turn?.status === 'streaming') this.updateTurn({ ...turn, status: 'interrupted', error: '连接已中断，正在核对已保存结果。' })
    })
    try {
      const detail = await chatApi.getChatConversation(run.conversationId)
      runInAction(() => {
        if (!this.currentRun(run)) return
        const saved = detail.turns.find(item => item.requestId === run.requestId)
        if (!saved) return
        run.accepted = true
        this.draft = ''
        const partial = this.turns.find(item => item.requestId === run.requestId)?.answer || ''
        this.updateTurn(saved.status === 'streaming' ? { ...saved, answer: partial.length > saved.answer.length ? partial : saved.answer, status: 'interrupted', error: '连接已中断，服务端结果待确认。请重新加载会话。' } : saved)
        this.updateConversation(detail.conversation)
        this.sendError = saved.status === 'streaming' ? '连接已中断，请重新加载会话确认最终状态。' : saved.error || (saved.status === 'completed' ? '' : '本次生成已中断，已保留保存的内容。')
      })
    } catch (error) {
      runInAction(() => {
        if (!this.currentRun(run) || this.authFailure(error, run.identity)) return
        this.sendError = `${errorText(error)}；未能核对最终结果，请重新加载会话。`
      })
    }
  }

  async stop(): Promise<void> {
    let run = this.activeRun
    const preserveDraft = !run
    const draft = this.draft
    if (!run && this.sending) {
      // Token refresh / first conversation creation has not started a generation.
      this.viewVersion += 1
      this.sending = false
      return
    }
    if (!run) {
      const turn = this.turns.find(item => item.status === 'streaming')
      if (!turn || !this.selectedConversationId || !this.current(authStore.identityVersion)) return
      run = { identity: authStore.identityVersion, view: this.viewVersion, conversationId: this.selectedConversationId, requestId: turn.requestId, controller: new AbortController(), csrfToken: '', accepted: true, stopping: false, done: false }
      this.activeRun = run
    }
    if (!this.currentRun(run) || run.stopping) return
    run.stopping = true
    this.stopping = true
    this.sendError = ''
    try {
      if (!run.csrfToken) run.csrfToken = await this.writeToken(run.identity)
      if (!this.currentRun(run)) return
      const turn = await chatApi.cancelChatTurn(run.conversationId, run.requestId, run.csrfToken)
      runInAction(() => {
        if (!this.currentRun(run)) return
        this.updateTurn(turn)
        this.draft = ''
        this.sendError = turn.error || ''
      })
    } catch (error) {
      if (!this.currentRun(run)) return
      let handled = false
      runInAction(() => { handled = this.authFailure(error, run.identity); if (!handled) this.sendError = errorText(error) })
      if (!handled) await this.reconcile(run)
    } finally {
      run.controller.abort()
      runInAction(() => { if (this.currentRun(run)) { if (preserveDraft) this.draft = draft; this.activeRun = null; this.sending = false; this.stopping = false } })
    }
  }

  private detachRun(): void {
    const run = this.activeRun
    this.activeRun = null
    this.sending = false
    this.stopping = false
    if (!run) return
    run.controller.abort()
    if (run.accepted && !run.done && !run.stopping) void chatApi.cancelChatTurn(run.conversationId, run.requestId, run.csrfToken).catch(() => {})
  }
}

export const chatStore = new ChatStore()
