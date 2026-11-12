import { useEffect, useRef, useState } from 'react'
import { copyChatText } from './clipboard'
import styles from './style.module.less'

type CopyFeedback = { status: 'idle' | 'copying' | 'copied' } | { status: 'error'; message: string }

export function ChatCopyButton({ text, label = '复制', className }: { text: string; label?: string; className?: string }) {
  const [feedback, setFeedback] = useState<CopyFeedback>({ status: 'idle' })
  const mounted = useRef(false)
  const pending = useRef(false)
  const resetTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
      clearTimeout(resetTimer.current)
    }
  }, [])

  async function copy() {
    if (pending.current) return
    pending.current = true
    clearTimeout(resetTimer.current)
    setFeedback({ status: 'copying' })
    const result = await copyChatText(text)
    pending.current = false
    if (!mounted.current) return
    if (result.ok === false) {
      setFeedback({ status: 'error', message: result.message })
      return
    }
    setFeedback({ status: 'copied' })
    resetTimer.current = setTimeout(() => setFeedback({ status: 'idle' }), 2200)
  }

  return <span className={styles.copyControl}>
    <button type="button" className={[styles.copyButton, className].filter(Boolean).join(' ')} disabled={feedback.status === 'copying'} onClick={() => { void copy() }}>
      {feedback.status === 'copying' ? '复制中…' : feedback.status === 'copied' ? '已复制' : label}
    </button>
    <span role="status" aria-live="polite" className={feedback.status === 'error' ? styles.copyError : styles.srOnly}>
      {feedback.status === 'error' ? feedback.message : feedback.status === 'copied' ? '已复制到剪贴板' : ''}
    </span>
  </span>
}
