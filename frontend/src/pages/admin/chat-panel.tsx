import { useCallback, useEffect, useRef, useState } from 'react'
import { Alert, Button, ConfigProvider, Input, Select, Spin, theme } from 'antd'
import { reaction } from 'mobx'
import { observer } from 'mobx-react-lite'
import { chatStore as store } from '../../store/chat'
import { ChatMemoryPanel } from './chat-memory-panel'
import { ChatTurnCard } from './chat-turn'
import { createChatScroll } from './chat-scroll'
import type { ChatTurn } from '../../types/chat'
import { filterConversations, isNearConversationEnd, shouldSendFromKeyboard, visibleSendError, selectHistoryConversation } from './chat-workspace'
import styles from './chat-panel.module.less'

const suggestions = [
  { title: '官网文案', description: '让介绍更清楚，也更像自己', draft: '我想打磨个人官网的介绍文案。请先问我目标读者、个人经历和希望呈现的语气，再一起整理。' },
  { title: '项目梳理', description: '把做过的事情讲出重点', draft: '我想整理一段项目经历。请帮我从背景、负责的工作、技术选择和结果四个方面梳理，并先问我需要补充的信息。' },
  { title: '技术方案', description: '拆解问题，比较实现取舍', draft: '我有一个技术方案想讨论。请先帮我明确目标、约束和现有技术栈，再比较可选方案与取舍。' },
]
const dateLabel = (value: string) => new Date(value).toLocaleDateString('zh-CN', { month: '2-digit', day: '2-digit' })

export const ChatPanel = observer(function ChatPanel() {
  const messagesRef = useRef<HTMLDivElement>(null)
  const contentRef = useRef<HTMLDivElement>(null)
  const scrollRef = useRef<ReturnType<typeof createChatScroll> | null>(null)
  const inputRef = useRef<HTMLTextAreaElement | null>(null)
  const historyDialogRef = useRef<HTMLDialogElement>(null)
  const followOutput = useRef(true)
  const [historyOpen, setHistoryOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [showLatest, setShowLatest] = useState(false)
  const lastTurn = store.turns.at(-1)
  const selected = store.selectedConversationId
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
  useEffect(() => {
    const scroll = createChatScroll({ area: () => messagesRef.current, following: () => followOutput.current, onFollow: () => setShowLatest(false) })
    scrollRef.current = scroll
    let previousSelected = store.selectedConversationId
    // 订阅流的尺寸信号，不让活动正文成为整页 React 渲染的依赖。
    const dispose = reaction(() => [store.selectedConversationId, store.turns.at(-1)?.answer, store.turns.at(-1)?.status, store.turns.length, store.loadingConversation], () => {
      if (previousSelected !== store.selectedConversationId) {
        previousSelected = store.selectedConversationId
        followOutput.current = true
      }
      scroll.schedule()
    }, { fireImmediately: true })
    const resize = new ResizeObserver(scroll.schedule)
    if (messagesRef.current) resize.observe(messagesRef.current)
    if (contentRef.current) resize.observe(contentRef.current)
    return () => { dispose(); resize.disconnect(); scroll.cancel(); scrollRef.current = null }
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

  const focusInput = useCallback(() => { requestAnimationFrame(() => inputRef.current?.focus()) }, [])
  const editTurn = useCallback((turn: ChatTurn) => { store.editTurn(turn); focusInput() }, [focusInput])
  function jumpToLatest() {
    followOutput.current = true
    setShowLatest(false)
    scrollRef.current?.schedule()
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
      <Button className={styles.newButton} disabled={store.creating || store.loading || store.forbidden} loading={store.creating} onClick={() => void createConversation()}>＋ 开始新对话</Button>
      <Input className={styles.historySearch} aria-label={mobile ? '搜索历史对话' : '搜索对话'} placeholder="搜索对话" value={search} allowClear onChange={event => setSearch(event.target.value)} />
      <nav className={styles.historyList} aria-label="历史会话">
        {store.loading && !store.conversations.length ? <p className={styles.historyEmpty}>正在读取历史…</p> : conversations.length ? conversations.map(item => <button key={item.id} type="button" className={`${styles.historyItem} ${item.id === selected ? styles.selectedConversation : ''}`} aria-current={item.id === selected ? 'true' : undefined} disabled={store.creating || store.forbidden} onClick={() => void selectConversation(item.id)}><span><strong>{item.title}</strong><time dateTime={item.updatedAt}>{dateLabel(item.updatedAt)} 更新</time></span></button>) : <p className={styles.historyEmpty}>{search.trim() ? '没有找到相关对话' : '新的想法，会留在这里'}</p>}
      </nav>
      <p className={styles.historyFootnote}><span aria-hidden="true">HEY.</span>私人的想法，慢慢整理</p>
    </>
  }

  return <ConfigProvider theme={{ algorithm: theme.defaultAlgorithm, token: { colorPrimary: '#555f3c', colorBgBase: '#ffffff', colorText: '#272925', colorTextSecondary: '#656961', colorTextPlaceholder: '#777b73', colorBorder: '#dcded7', borderRadius: 8, fontFamily: 'inherit' } }}><section className={styles.panel} aria-label="AI 对话工作区">
    <aside className={styles.history}>{historyContents()}</aside>
    <dialog ref={historyDialogRef} className={styles.historyDialog} aria-labelledby="chat-history-title" onCancel={event => { event.preventDefault(); setHistoryOpen(false) }} onClose={() => setHistoryOpen(false)} onClick={event => { if (event.target === event.currentTarget) { const rect = event.currentTarget.getBoundingClientRect(); if (event.clientX > rect.right || event.clientX < rect.left || event.clientY < rect.top || event.clientY > rect.bottom) setHistoryOpen(false) } }}>{historyContents(true)}</dialog>
    <div className={styles.conversation}>
      <header className={styles.threadHeader}>
        <button type="button" className={styles.historyToggle} aria-label="打开历史对话" aria-haspopup="dialog" aria-expanded={historyOpen} onClick={() => setHistoryOpen(true)}><svg viewBox="0 0 20 20" fill="none" aria-hidden="true"><path d="M3 4h14v12H3zM8 4v12" stroke="currentColor" strokeWidth="1.5" /></svg><span>历史</span></button>
        <div className={styles.threadTitle}><h2 title={conversation?.title}>{conversation?.title ?? '新对话'}</h2><p>{store.loadingConversation ? '正在读取…' : '仅站主可见 · 自动保存'}</p></div>
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
          <div ref={contentRef} className={styles.messageContent}>{store.loadingConversation ? <div className={styles.empty}><Spin /><p>正在读取会话…</p></div>
            : !store.turns.length ? <div className={styles.empty}>
              <p className={styles.emptyEyebrow}><span aria-hidden="true">HEY.</span> 私人写作台</p><h2>让脑海里的想法<br />在这里有个着落</h2><p>写一段更像你的介绍，梳理一个项目，<br className={styles.emptyBreak} />或把技术问题聊清楚</p>
              <div className={styles.suggestions}>{suggestions.map(item => <button key={item.title} type="button" disabled={store.busy || store.forbidden} onClick={() => { store.setDraft(item.draft); focusInput() }}><strong>{item.title}<span aria-hidden="true">↗</span></strong><span>{item.description}</span></button>)}</div>
              <p className={styles.suggestionHint}>选择一个方向，编辑后再发送</p>
            </div>
              : <div className={styles.messageColumn}>{store.turns.map(turn => <ChatTurnCard key={turn.requestId} turn={turn} busy={store.busy} onEdit={editTurn} />)}</div>}</div>
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
  </section></ConfigProvider>
})
