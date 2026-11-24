import { useEffect, useRef, useState } from 'react'
import type { FormEvent, KeyboardEvent } from 'react'
import { observer } from 'mobx-react-lite'
import { Link, useNavigate } from 'react-router-dom'
import { siteChatStore } from '../../store/site-chat'
import type { SiteChatContent } from '../../types/site'
import styles from './home.module.less'
import { setPendingPrompt } from './chat-pending'

// 消息保存在服务端，浏览器只保存匿名 visitor ID；刷新后历史仍可通过 /chat 查看。
export const Conversation = observer(function Conversation({ chat }: { chat: SiteChatContent }) {
  const navigate = useNavigate()
  const { status, available } = siteChatStore
  const [draft, setDraft] = useState('')
  const inputRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => { void siteChatStore.loadStatus() }, [])

  const enabled = status === 'ready'
  const live = enabled && available
  const state = !enabled ? (status === 'loading' ? '连接中' : '离线') : available ? '在线' : '离线'

  // 首页只负责收下问题；具体生成在独立对话页完成，避免首屏同时维护两条流。
  const startConversation = (text: string) => {
    const prompt = text.trim()
    if (!prompt || !live) return
    setPendingPrompt(prompt)
    navigate('/chat')
  }

  const submit = (event?: FormEvent) => {
    event?.preventDefault()
    startConversation(draft)
  }

  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault()
      void submit()
    }
  }
  return <section className={styles.conversation} id="conversation" aria-labelledby="conversation-title">
    <div className={styles.conversationHead}>
      <span className={styles.conversationKicker}>AI 分身 / 随时可聊</span>
      <h2 id="conversation-title">{chat.heading || '找我说会儿话。'}</h2>
      <p>{chat.intro || '关于经历、想法和这个网站，都可以直接问。'}</p>
      <Link className={styles.conversationFull} to="/chat">打开完整对话<span aria-hidden="true">↗</span></Link>
    </div>
    <div className={styles.chatCard}>
      <div className={styles.chatMeta}>
        <span className={styles.chatDot} data-live={enabled && available} aria-hidden="true" />
        <span>AI 分身</span><span className={styles.chatDivider} aria-hidden="true">/</span><span>只基于公开内容</span>
        <span className={styles.chatState}>{state}</span>
      </div>
      <div className={styles.chatEmpty}>
        <p>{enabled ? '你好，想从哪儿聊起？' : status === 'loading' ? '正在接通对话…' : '对话暂时没有接通。'}</p>
        <small>我不会读心，也不会编造没写在网站上的事。</small>
      </div>
      {status === 'closed' && <p className={styles.chatNotice}>对话暂未开放。</p>}
      {status === 'ready' && !available && <p className={styles.chatNotice}>AI 分身暂时离线。</p>}
      {live && <form className={styles.composer} onSubmit={submit}>
        <label htmlFor="site-chat-input" className={styles.srOnly}>想说的话</label>
        <textarea id="site-chat-input" ref={inputRef} rows={3} maxLength={500} value={draft}
          placeholder={chat.placeholder || '今天想从哪儿说起……'}
          onChange={event => setDraft(event.target.value)} onKeyDown={onKeyDown} />
        <div className={styles.composerFoot}>
          <button type="button" className={styles.hintAction} onClick={() => startConversation(draft)}>Enter 发送 · Shift + Enter 换行</button>
          <button type="submit" className={styles.sendButton} disabled={!draft.trim()} aria-label="发送"><span aria-hidden="true">↑</span></button>
        </div>
      </form>}
      {live && chat.suggestions.length > 0 && <div className={styles.suggestions} aria-label="可以这样问">
        {chat.suggestions.map(text => <button key={text} type="button" onClick={() => startConversation(text)}>{text}<span aria-hidden="true">↗</span></button>)}
      </div>}
      <p className={styles.chatDisclaimer}>回答由 AI 生成，可能不准确；重要的事请直接联系我。</p>
    </div>
  </section>
})
