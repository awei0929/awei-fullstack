import { useEffect, useRef, useState } from 'react'
import type { FormEvent, KeyboardEvent } from 'react'
import { Link } from 'react-router-dom'
import type { SiteChatContent } from '../../types/site'
import styles from './home.module.less'
import { useSiteChat } from './use-site-chat'

// 消息保存在服务端，浏览器只保存匿名 visitor ID；刷新后历史仍可通过 /chat 查看。
export function Conversation({ chat, email }: { chat: SiteChatContent; email: string }) {
  const { status, available, conversationId, messages, busy, notice, send, stop } = useSiteChat()
  const [draft, setDraft] = useState('')
  const listRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    const list = listRef.current
    if (list) list.scrollTo({ top: list.scrollHeight, behavior: 'smooth' })
  }, [messages, notice])

  const submit = async (event?: FormEvent) => {
    event?.preventDefault()
    if (!draft.trim()) return
    if (await send(draft)) setDraft('')
  }

  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault()
      void submit()
    }
  }
  const suggestion = (text: string) => {
    setDraft(text)
    inputRef.current?.focus()
  }

  const enabled = status === 'ready'
  const state = !enabled ? (status === 'loading' ? '连接中' : '离线') : available ? (busy ? '回答中' : '在线') : '离线'
  return <section className={styles.conversation} id="conversation" aria-labelledby="conversation-title">
    <div className={styles.conversationHead}>
      <span className={styles.conversationKicker}>AI 分身 / 随时可聊</span>
      <h2 id="conversation-title">{chat.heading || '找我说会儿话。'}</h2>
      <p>{chat.intro || '关于经历、想法和这个网站，都可以直接问。'}</p>
      <Link className={styles.conversationFull} to={conversationId ? `/chat/${conversationId}` : '/chat'}>打开完整对话<span aria-hidden="true">↗</span></Link>
    </div>
    <div className={styles.chatCard}>
      <div className={styles.chatMeta}>
        <span className={styles.chatDot} data-live={enabled && available} aria-hidden="true" />
        <span>AI 分身</span><span className={styles.chatDivider} aria-hidden="true">/</span><span>只基于公开内容</span>
        <span className={styles.chatState}>{state}</span>
      </div>
      <div className={styles.messages} ref={listRef} aria-live="polite" aria-busy={busy}>
        {messages.length === 0 && <div className={styles.chatEmpty}>
          <p>{enabled ? '你好，想从哪儿聊起？' : status === 'loading' ? '正在接通对话…' : '对话暂时没有接通。'}</p>
          <small>我不会读心，也不会编造没写在网站上的事。</small>
        </div>}
        {messages.map(item => <div key={item.id} className={styles.message} data-role={item.role}>
          {item.role === 'assistant' && <span className={styles.messageMark} aria-hidden="true">H</span>}
          <div className={styles.bubble}>
            {item.content ? <p>{item.content}</p> : <span className={styles.typing} aria-label="正在回答"><i /><i /><i /></span>}
          </div>
        </div>)}
      </div>
      {notice && <p className={styles.chatNotice} role="alert">{notice}</p>}
      {status === 'error' && <p className={styles.chatNotice} role="alert">连接对话服务失败，请刷新页面重试{email ? <>，或 <a href={`mailto:${email}`}>写信给我</a></> : null}。</p>}
      {status === 'closed' && <p className={styles.chatNotice}>对话暂未开放{email ? <>，可以先 <a href={`mailto:${email}`}>写信给我</a></> : null}。</p>}
      {status === 'ready' && !available && <p className={styles.chatNotice}>AI 分身暂时离线{email ? <>，可以先 <a href={`mailto:${email}`}>写信给我</a></> : null}。</p>}
      {enabled && available && <form className={styles.composer} onSubmit={event => void submit(event)}>
        <label htmlFor="site-chat-input" className={styles.srOnly}>想说的话</label>
        <textarea id="site-chat-input" ref={inputRef} rows={2} maxLength={500} value={draft}
          placeholder={chat.placeholder || '今天想从哪儿说起……'}
          onChange={event => setDraft(event.target.value)} onKeyDown={onKeyDown} disabled={busy} />
        <div className={styles.composerFoot}>
          <span>Enter 发送 · Shift + Enter 换行</span>
          {busy
            ? <button type="button" className={styles.sendButton} onClick={stop} aria-label="停止生成"><span className={styles.stopIcon} /></button>
            : <button type="submit" className={styles.sendButton} disabled={!draft.trim()} aria-label="发送"><span aria-hidden="true">↑</span></button>}
        </div>
      </form>}
      {enabled && available && chat.suggestions.length > 0 && <div className={styles.suggestions} aria-label="可以这样问">
        {chat.suggestions.map(text => <button key={text} type="button" onClick={() => suggestion(text)} disabled={busy}>{text}<span aria-hidden="true">↗</span></button>)}
      </div>}
      <p className={styles.chatDisclaimer}>回答由 AI 生成，可能不准确；重要的事请直接联系我。</p>
    </div>
  </section>
}
