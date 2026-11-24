import { useEffect, useRef, useState } from 'react'
import type { FormEvent, KeyboardEvent } from 'react'
import { observer } from 'mobx-react-lite'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ChatMarkdown } from '../../components/chat-markdown'
import { ThemeToggle } from '../../components/theme-toggle'
import { siteChatStore } from '../../store/site-chat'
import { siteStore } from '../../store/site'
import type { SiteChatContent } from '../../types/site'
import styles from './style.module.less'

const fallbackChat: SiteChatContent = {
  enabled: false,
  heading: '今天想聊点什么？',
  intro: '关于我、这个网站，或者你正在想的事，都可以从一句话开始。',
  placeholder: '想到什么，就说什么……',
  systemPrompt: '',
  suggestions: [],
}

type SuggestionCard = { label: string; prompt: string }

function buildCards(chat: SiteChatContent): SuggestionCard[] {
  return [
    { label: '先说说', prompt: chat.suggestions[0] || '你最近在做什么？' },
    { label: '小事也行', prompt: chat.suggestions[1] || '这个网站是怎么做出来的？' },
    { label: '随便聊聊', prompt: chat.suggestions[2] || '你相信什么样的产品？' },
    { label: '认真一点', prompt: '你最近在反复想的一个问题是什么？' },
  ]
}

const statusText = { loading: '接通中', ready: '在线', closed: '未开放', error: '连接失败' } as const

const relative = new Intl.RelativeTimeFormat('zh-CN', { numeric: 'auto' })

function relativeTime(value: string): string {
  const diff = Date.parse(value) - Date.now()
  if (!Number.isFinite(diff)) return ''
  const minutes = Math.round(diff / 60000)
  if (Math.abs(minutes) < 1) return '刚刚'
  if (Math.abs(minutes) < 60) return relative.format(minutes, 'minute')
  const hours = Math.round(minutes / 60)
  if (Math.abs(hours) < 24) return relative.format(hours, 'hour')
  const days = Math.round(hours / 24)
  if (Math.abs(days) < 30) return relative.format(days, 'day')
  return relative.format(Math.round(days / 30), 'month')
}

// oxlint-disable-next-line react/only-export-components -- MobX observer 包装的命名页面组件。
export const ChatPage = observer(function ChatPage() {
  const { conversationId } = useParams()
  const navigate = useNavigate()
  const [drawer, setDrawer] = useState(false)
  const activeId = siteChatStore.activeId
  useEffect(() => {
    void siteStore.load()
    void siteChatStore.loadStatus()
    void siteChatStore.loadList()
  }, [])

  useEffect(() => {
    if (conversationId) {
      if (siteChatStore.activeId !== conversationId) void siteChatStore.open(conversationId)
    } else {
      siteChatStore.newChat()
    }
  }, [conversationId])

  useEffect(() => {
    if (activeId && !conversationId) navigate(`/chat/${activeId}`, { replace: true })
  }, [activeId, conversationId, navigate])

  useEffect(() => {
    if (!drawer) return
    const close = (event: globalThis.KeyboardEvent) => { if (event.key === 'Escape') setDrawer(false) }
    window.addEventListener('keydown', close)
    return () => window.removeEventListener('keydown', close)
  }, [drawer])

  return <ChatExperience
    chat={siteStore.document?.content.chat ?? fallbackChat}
    name={siteStore.document?.content.profile.name.trim() || 'HEY.'}
    email={siteStore.document?.content.contact.email.trim() || ''}
    loading={siteStore.loading || (!siteStore.document && !siteStore.error)}
    error={siteStore.error}
    conversationId={conversationId}
    drawer={drawer}
    onDrawer={setDrawer}
    onNavigate={navigate}
  />
})

type ChatExperienceProps = {
  chat: SiteChatContent
  name: string
  email: string
  loading?: boolean
  error?: string
  conversationId?: string
  drawer: boolean
  onDrawer: (open: boolean) => void
  onNavigate: (path: string, options?: { replace?: boolean }) => void
}

// oxlint-disable-next-line react/only-export-components -- 页面内部排版组件。
const ChatExperience = observer(function ChatExperience({ chat, name, email, loading = false, error = '', conversationId, drawer, onDrawer, onNavigate }: ChatExperienceProps) {
  const { status, available, conversations, activeId, turns, loadingList, loadingConversation, sending, notice } = siteChatStore
  const [draft, setDraft] = useState('')
  const threadRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const cards = buildCards(chat)
  const canSend = status === 'ready' && available && !sending && !loadingConversation
  const live = status === 'ready' && available

  useEffect(() => {
    const thread = threadRef.current
    if (!thread) return
    thread.scrollTo({ top: thread.scrollHeight, behavior: turns.length > 1 ? 'smooth' : 'auto' })
  }, [turns, notice])

  const submit = async (event?: FormEvent) => {
    event?.preventDefault()
    if (!canSend || !draft.trim()) return
    if (await siteChatStore.send(draft)) setDraft('')
  }

  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault()
      void submit()
    }
  }

  const suggest = (text: string) => {
    setDraft(text)
    inputRef.current?.focus()
  }

  const newChat = () => {
    siteChatStore.newChat()
    setDraft('')
    onDrawer(false)
    onNavigate('/chat')
    window.setTimeout(() => inputRef.current?.focus(), 0)
  }

  const select = (id: string) => {
    if (sending) return
    onDrawer(false)
    if (id === conversationId) return
    onNavigate(`/chat/${id}`)
  }

  const remove = async (id: string) => {
    if (sending) return
    if (!window.confirm('删除这段对话？删除后无法恢复。')) return
    await siteChatStore.remove(id)
    if (id === conversationId || id === activeId) onNavigate('/chat', { replace: true })
  }

  return <div className={styles.page}>
    <aside className={`${styles.sidebar} ${drawer ? styles.sidebarOpen : ''}`} id="chat-sidebar" aria-label="对话导航">
      <Link className={styles.brand} to="/" aria-label={`${name} 首页`}>
        <span className={styles.brandMark}>{Array.from(name)[0]}</span>
        <span>{name}</span>
      </Link>
      <button type="button" className={styles.newChat} onClick={newChat}>
        <span aria-hidden="true">＋</span> 新对话
      </button>
      <div className={styles.history}>
        <p className={styles.historyLabel}>历史对话</p>
        {loadingList
          ? <p className={styles.historyHint}>正在读取…</p>
          : conversations.length > 0
            ? <nav className={styles.historyList} aria-label="历史对话">
              {conversations.map(item => <div key={item.id} className={styles.historyRow} data-active={item.id === (activeId ?? conversationId)}>
                <button type="button" className={styles.historyButton} onClick={() => select(item.id)}
                  aria-current={item.id === (activeId ?? conversationId) ? 'page' : undefined}>
                  <span className={styles.historyTitle}>{item.title}</span>
                  <span className={styles.historyMeta}>{relativeTime(item.updatedAt)} · {item.messageCount} 轮</span>
                </button>
                <button type="button" className={styles.deleteButton} onClick={() => void remove(item.id)}
                  aria-label={`删除 ${item.title}`} disabled={sending}>×</button>
              </div>)}
            </nav>
            : <p className={styles.historyHint}>还没有对话。问一句，历史会留在这里。</p>}
      </div>
      <div className={styles.sidebarFoot}>
        <Link to="/">首页<span aria-hidden="true">↗</span></Link>
        <Link to="/thoughts">想法<span aria-hidden="true">↗</span></Link>
        <Link to="/works">作品<span aria-hidden="true">↗</span></Link>
        <p>对话保存在服务器，只有这台浏览器能查看</p>
      </div>
    </aside>
    {drawer && <button type="button" className={styles.backdrop} aria-label="关闭历史对话" onClick={() => onDrawer(false)} />}

    <main className={styles.main}>
      <header className={styles.topbar}>
        <button type="button" className={styles.drawerButton} onClick={() => onDrawer(true)} aria-label="打开历史对话" aria-controls="chat-sidebar" aria-expanded={drawer}>历史</button>
        <div className={styles.identity}>
          <span className={styles.liveDot} data-live={live} aria-hidden="true" />
          <strong>{name} 的分身</strong>
          <span className={styles.identityNote}>只基于公开内容</span>
        </div>
        <div className={styles.topActions}>
          <span className={styles.status}>{statusText[status]}</span>
          <ThemeToggle />
          <button type="button" className={styles.mobileNew} onClick={newChat}>新对话</button>
          <Link className={styles.homeLink} to="/">回到首页<span aria-hidden="true">↗</span></Link>
        </div>
      </header>

      <div className={styles.thread} ref={threadRef} aria-live="polite" aria-busy={sending}>
        {loadingConversation
          ? <p className={styles.threadStatus}>正在载入这段对话…</p>
          : turns.length === 0
            ? <section className={styles.empty} aria-labelledby="chat-title">
              <span className={styles.emptyMark} aria-hidden="true"><i /><i /><i /><i /></span>
              <h1 id="chat-title">{chat.heading || '今天想聊点什么？'}</h1>
              <p>{chat.intro || '关于我、这个网站，或者你正在想的事，都可以从一句话开始。'}</p>
              {status === 'loading' && <p className={styles.emptyStatus}>正在接通对话…</p>}
              {(status === 'closed' || (status === 'ready' && !available)) && <p className={styles.emptyStatus}>
                {status === 'closed' ? '对话暂未开放' : 'AI 分身暂时离线'}{email ? <>，可以先 <a href={`mailto:${email}`}>写信给我</a></> : null}。
              </p>}
              {status === 'error' && <p className={styles.emptyStatus} role="alert">连接对话服务失败，请刷新页面重试。</p>}
              {loading && <p className={styles.emptyStatus}>正在载入对话设置…</p>}
              {error && <p className={styles.emptyStatus} role="alert">内容加载失败：{error}</p>}
              {live && <div className={styles.suggestionGrid} aria-label="可以这样开始">
                {cards.map(card => <button key={card.label} type="button" className={styles.suggestionCard} onClick={() => suggest(card.prompt)}>
                  <span className={styles.cardLabel}>{card.label}</span>
                  <span className={styles.cardPrompt}>{card.prompt}</span>
                  <span className={styles.cardArrow} aria-hidden="true">↗</span>
                </button>)}
              </div>}
            </section>
            : <div className={styles.messageList}>
              {turns.map(turn => <div key={turn.requestId} className={styles.turn}>
                <div className={styles.userRow}>
                  <p className={styles.userBubble}>{turn.content}</p>
                </div>
                {(turn.answer || turn.status === 'streaming') && <article className={styles.assistantRow}>
                  <span className={styles.assistantMark} aria-hidden="true">{Array.from(name)[0]}</span>
                  <div className={styles.assistantBody}>
                    {turn.answer
                      ? <ChatMarkdown content={turn.answer} />
                      : <span className={styles.typing} aria-label="正在回答"><i /><i /><i /></span>}
                  </div>
                </article>}
                {!notice && (turn.status === 'failed' || turn.status === 'canceled') && <p className={styles.turnError} role="status">
                  {turn.status === 'canceled' ? '已停止生成。' : turn.error || '回答失败，请重试。'}
                </p>}
              </div>)}
              {notice && <p className={styles.notice} role="alert">{notice}</p>}
            </div>}
      </div>

      <div className={styles.composerWrap}>
        {notice && turns.length === 0 && <p className={styles.notice} role="alert">{notice}</p>}
        <form className={styles.composer} onSubmit={event => void submit(event)}>
          <label htmlFor="chat-input" className={styles.srOnly}>想说的话</label>
          <textarea id="chat-input" ref={inputRef} rows={1} maxLength={500} value={draft}
            placeholder={status === 'ready' && !available ? '对话暂时离线，稍后再来。' : chat.placeholder || '想到什么，就说什么……'}
            onChange={event => setDraft(event.target.value)} onKeyDown={onKeyDown} disabled={!canSend} />
          <div className={styles.composerFoot}>
            <span>Enter 发送 · Shift + Enter 换行</span>
            {sending
              ? <button type="button" className={styles.sendButton} onClick={() => siteChatStore.stop()} aria-label="停止生成"><span className={styles.stopIcon} /></button>
              : <button type="submit" className={styles.sendButton} disabled={!canSend || !draft.trim()} aria-label="发送"><span aria-hidden="true">↑</span></button>}
          </div>
        </form>
        <p className={styles.disclaimer}>回答由 AI 生成，可能不准确；重要的事请直接联系我{email ? <>（<a href={`mailto:${email}`}>{email}</a>）</> : null}。</p>
      </div>
    </main>
  </div>
})
