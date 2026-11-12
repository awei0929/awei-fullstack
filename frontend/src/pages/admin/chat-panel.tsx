import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { Alert, Button, Input, Select, Spin } from 'antd'
import { observer } from 'mobx-react-lite'
import { chatStore as store } from '../../store/chat'
import { ChatMarkdown } from '../../components/chat-markdown'
import { ChatCopyButton } from '../../components/chat-markdown/copy-button'
import { ChatMemoryPanel, MemorySaveButton } from './chat-memory-panel'
import type { ChatStatus } from '../../types/chat'
import { filterConversations, isNearConversationEnd, shouldSendFromKeyboard, visibleSendError, selectHistoryConversation } from './chat-workspace'
import styles from './chat-panel.module.less'

const statuses: Record<ChatStatus, string> = { streaming: '生成中', completed: '已完成', canceled: '已停止', failed: '生成失败', interrupted: '连接中断' }
const suggestions = [
  { title: '官网文案', description: '让介绍更清楚，也更像自己', draft: '我想打磨个人官网的介绍文案。请先问我目标读者、个人经历和希望呈现的语气，再一起整理。' },
  { title: '项目梳理', description: '把做过的事情讲出重点', draft: '我想整理一段项目经历。请帮我从背景、负责的工作、技术选择和结果四个方面梳理，并先问我需要补充的信息。' },
  { title: '技术方案', description: '拆解问题，比较实现取舍', draft: '我有一个技术方案想讨论。请先帮我明确目标、约束和现有技术栈，再比较可选方案与取舍。' },
]
const dateLabel = (value: string) => new Date(value).toLocaleDateString('zh-CN', { month: '2-digit', day: '2-digit' })

export const ChatPanel = observer(function ChatPanel() {
  const messagesRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement | null>(null)
  const historyDialogRef = useRef<HTMLDialogElement>(null)
  const followOutput = useRef(true)
  const [historyOpen, setHistoryOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [showLatest, setShowLatest] = useState(false)
  const lastTurn = store.turns.at(-1)
  const answer = lastTurn?.answer
  const lastStatus = lastTurn?.status
  const selected = store.selectedConversationId
  const previousSelected = useRef(selected)
  const turnCount = store.turns.length
  const loadingConversation = store.loadingConversation
  const count = Array.from(store.draft.trim()).length
  const conversations = filterConversations(store.conversations, search)
  const conversation = store.conversations.find(item => item.id === selected)
  const sendError = visibleSendError(store.sendError, lastTurn?.error)
  const generating = store.sending || store.stopping || store.hasStreamingTurn
  const fallbackModelId = store.models.find(model => model.id === store.selectedModelId)?.fallbackModelId
  const fallbackModel = store.models.find(model => model.id === fallbackModelId && model.available)

  useEffect(() => {
    store.activate()
    window.addEventListener('pagehide', store.deactivate)
    window.addEventListener('pageshow', store.activate)
    return () => {
      window.removeEventListener('pagehide', store.deactivate)
      window.removeEventListener('pageshow', store.activate)
      store.deactivate()
    }
  }, [])
  useLayoutEffect(() => {
    // 切会话才重置跟随；增量到达时尊重用户正在阅读的历史位置。
    if (previousSelected.current !== selected) { previousSelected.current = selected; followOutput.current = true }
    const area = messagesRef.current
    if (area && followOutput.current) { area.scrollTop = area.scrollHeight; setShowLatest(false) }
  }, [selected, answer, lastStatus, turnCount, loadingConversation])
  useEffect(() => {
    const area = messagesRef.current
    if (!area) return
    const resize = new ResizeObserver(() => { if (followOutput.current) area.scrollTop = area.scrollHeight })
    resize.observe(area)
    return () => resize.disconnect()
  }, [])
  useEffect(() => {
    const dialog = historyDialogRef.current
    if (!dialog) return
    if (historyOpen) {
      dialog.showModal()
      dialog.querySelector<HTMLInputElement>('input')?.focus()
    } else if (dialog.open) dialog.close()
  }, [historyOpen])
  useEffect(() => {
    const desktop = window.matchMedia('(min-width: 1101px)')
    const closeOnDesktop = () => { if (desktop.matches) setHistoryOpen(false) }
    desktop.addEventListener('change', closeOnDesktop)
    return () => desktop.removeEventListener('change', closeOnDesktop)
  }, [])

  function focusInput() { requestAnimationFrame(() => inputRef.current?.focus()) }
  function jumpToLatest() {
    followOutput.current = true
    setShowLatest(false)
    if (messagesRef.current) messagesRef.current.scrollTop = messagesRef.current.scrollHeight
  }
  function send() {
    if (!store.canSend) return
    jumpToLatest()
    void store.send()
  }
  function selectConversation(id: string) {
    return selectHistoryConversation(id, store.selectedConversationId, {
      close: () => setHistoryOpen(false),
      select: store.selectConversation,
      focus: focusInput,
    })
  }
  async function createConversation() {
    setHistoryOpen(false)
    setSearch('')
    await store.createConversation()
    focusInput()
  }
  function historyContents(mobile = false) {
    return <>
      <div className={styles.historyHeading}><h2 id={mobile ? 'chat-history-title' : undefined}>历史对话</h2><span>{store.conversations.length}</span>{mobile && <button type="button" className={styles.closeHistory} aria-label="关闭历史对话" onClick={() => setHistoryOpen(false)}>关闭</button>}</div>
      <Button className={styles.newButton} disabled={store.creating || store.loading || store.forbidden} loading={store.creating} onClick={() => void createConversation()}>＋ 新对话</Button>
      <Input className={styles.historySearch} aria-label={mobile ? '搜索历史对话' : '搜索对话'} placeholder="搜索对话" value={search} allowClear onChange={event => setSearch(event.target.value)} />
      <nav className={styles.historyList} aria-label="历史会话">
        {store.loading && !store.conversations.length ? <p className={styles.historyEmpty}>正在读取历史…</p> : conversations.length ? conversations.map(item => <button key={item.id} type="button" className={`${styles.historyItem} ${item.id === selected ? styles.selectedConversation : ''}`} aria-current={item.id === selected ? 'true' : undefined} disabled={store.creating || store.forbidden} onClick={() => void selectConversation(item.id)}><span>{item.title}</span><time dateTime={item.updatedAt}>{dateLabel(item.updatedAt)}</time></button>) : <p className={styles.historyEmpty}>{search.trim() ? '没有找到相关对话' : '新的想法，会留在这里'}</p>}
      </nav>
      <p className={styles.historyFootnote}>仅站主可见</p>
    </>
  }

  return <section className={styles.panel} aria-label="AI 对话工作区">
    <aside className={styles.history}>{historyContents()}</aside>
    <dialog ref={historyDialogRef} className={styles.historyDialog} aria-labelledby="chat-history-title" onCancel={event => { event.preventDefault(); setHistoryOpen(false) }} onClose={() => setHistoryOpen(false)} onClick={event => { if (event.target === event.currentTarget) { const rect = event.currentTarget.getBoundingClientRect(); if (event.clientX > rect.right || event.clientX < rect.left || event.clientY < rect.top || event.clientY > rect.bottom) setHistoryOpen(false) } }}>{historyContents(true)}</dialog>
    <div className={styles.conversation}>
      <header className={styles.threadHeader}>
        <button type="button" className={styles.historyToggle} aria-label="打开历史对话" aria-haspopup="dialog" aria-expanded={historyOpen} onClick={() => setHistoryOpen(true)}><svg viewBox="0 0 20 20" fill="none" aria-hidden="true"><path d="M3 4h14v12H3zM8 4v12" stroke="currentColor" strokeWidth="1.5" /></svg><span>历史</span></button>
        <div className={styles.threadTitle}><h2 title={conversation?.title}>{conversation?.title ?? '新对话'}</h2><p>{store.loadingConversation ? '正在读取…' : '思考、写作与技术讨论'}</p></div>
        <div className={styles.threadActions}>
          <ChatMemoryPanel />
          <Button className={styles.refreshButton} aria-label="刷新对话" title="刷新对话" disabled={store.busy || store.loadingConversation} loading={store.loading} onClick={() => void store.refresh()}><svg viewBox="0 0 20 20" fill="none" aria-hidden="true"><path d="M16 7a6 6 0 1 0 0 6M16 3v4h-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg></Button>
          <Button className={styles.mobileNewButton} disabled={store.creating || store.loading || store.forbidden} loading={store.creating} onClick={() => void createConversation()}>新对话</Button>
        </div>
      </header>
      {(store.loadError || store.detailError || (!store.loading && !store.models.some(model => model.available))) && <div className={styles.notices}>
        {store.loadError && <Alert type="error" title={store.loadError} showIcon />}
        {!store.loading && !store.loadError && !store.models.some(model => model.available) && <Alert type="info" title="模型尚未配置" description="服务端配置 API Key 并重启后，点击刷新。" showIcon />}
        {store.detailError && <Alert type="error" title={store.detailError} action={<Button size="small" onClick={() => selected && void store.selectConversation(selected)}>重试读取</Button>} showIcon />}
      </div>}
      <div className={styles.messageRegion}>
        <div ref={messagesRef} className={styles.messages} aria-label="对话消息" tabIndex={0} onScroll={() => { const area = messagesRef.current; if (area) { const nearEnd = isNearConversationEnd(area); followOutput.current = nearEnd; setShowLatest(!nearEnd) } }}>
          {store.loadingConversation ? <div className={styles.empty}><Spin /><p>正在读取会话…</p></div>
            : !store.turns.length ? <div className={styles.empty}>
              <p className={styles.emptyEyebrow}>你的创作工作区</p><h2>把想法整理成下一步</h2><p>从官网文案、项目经历，或一个技术问题开始</p>
              <div className={styles.suggestions}>{suggestions.map(item => <button key={item.title} type="button" disabled={store.busy || store.forbidden} onClick={() => { store.setDraft(item.draft); focusInput() }}><strong>{item.title}<span aria-hidden="true">↗</span></strong><span>{item.description}</span></button>)}</div>
              <p className={styles.suggestionHint}>选择一个方向，编辑后再发送</p>
            </div>
              : <div className={styles.messageColumn}>{store.turns.map(turn => <article key={turn.requestId} className={styles.turn}>
                <div className={styles.question}><div className={styles.messageHeading}><strong>你</strong><button type="button" disabled={store.busy} onClick={() => { store.editTurn(turn); focusInput() }}>重新编辑</button></div><p>{turn.content}</p></div>
                <div className={styles.answer}><div className={styles.messageHeading}><strong>{turn.modelLabel}</strong>{turn.status !== 'completed' && <span className={`${styles.turnStatus} ${turn.status === 'failed' || turn.status === 'interrupted' ? styles.failureStatus : ''}`}>{statuses[turn.status]}</span>}</div>
                  {turn.modelId !== turn.requestedModelId && <p className={styles.fallbackNotice}>因限流自动切换自{turn.requestedModelLabel}</p>}
                  {turn.answer ? <ChatMarkdown content={turn.answer} /> : <p className={styles.answerPlaceholder}>{turn.status === 'streaming' ? '正在思考…' : '本次没有生成回复'}</p>}
                  {turn.error && <p role="alert" className={styles.turnError}>{turn.error}</p>}
                  {turn.answer && turn.status !== 'streaming' && <div className={styles.messageActions}><ChatCopyButton text={turn.answer} label="复制回复" className={styles.copyButton} /><MemorySaveButton content={turn.answer} /></div>}
                </div>
              </article>)}</div>}
        </div>
        {showLatest && <button className={styles.latestButton} type="button" onClick={jumpToLatest}>↓ 返回最新</button>}
      </div>
      <form className={styles.composer} onSubmit={event => { event.preventDefault(); send() }}>
        {sendError && <Alert className={styles.sendError} type="error" title={sendError} showIcon />}
        {store.turns.length >= 100 && <p role="status" className={styles.limit}>已达到 100 轮，请新建对话继续</p>}
        <div className={styles.composerBox}>
          <label className={styles.srOnly} htmlFor="chat-input">消息</label>
          <Input.TextArea id="chat-input" ref={element => { inputRef.current = element?.resizableTextArea?.textArea ?? null }} value={store.draft} onChange={event => store.setDraft(event.target.value)} disabled={store.busy || store.loadingConversation || store.forbidden} autoSize={{ minRows: 2, maxRows: 5 }} placeholder="写下你的问题或想法…" aria-describedby="chat-input-hint" onKeyDown={event => { if (shouldSendFromKeyboard(event.nativeEvent)) { event.preventDefault(); send() } }} />
          <div className={styles.composerControls}>
            <label className={styles.srOnly} htmlFor="chat-model">本轮模型</label><Select id="chat-model" aria-label="本轮模型" value={store.selectedModelId || undefined} placeholder="选择模型" disabled={store.busy || store.loading || store.loadingConversation || store.forbidden} options={store.models.map(model => ({ value: model.id, label: `${model.label}${model.available ? '' : ' · 未配置'}`, disabled: !model.available }))} onChange={store.setModel} />
            <span className={styles.srOnly} role="status" aria-live="polite">{store.stopping ? '正在停止…' : generating ? '正在生成回复…' : ''}</span>
            {generating ? <Button className={styles.stopButton} loading={store.stopping} disabled={store.stopping} onClick={() => void store.stop()}>停止生成</Button> : <Button className={styles.sendButton} type="primary" htmlType="submit" disabled={!store.canSend}>发送<span aria-hidden="true"> ↑</span></Button>}
          </div>
          {fallbackModel && <p className={styles.fallbackHint}>繁忙时将尝试免费备用 {fallbackModel.label}</p>}
        </div>
        <div className={styles.composerFootnote}><p id="chat-input-hint"><span>Enter 换行</span><span>Ctrl / ⌘ + Enter 发送</span></p><span className={count > 4000 ? styles.overLimit : ''}>{count} / 4000</span></div>
      </form>
    </div>
  </section>
})
