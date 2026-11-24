import { useEffect, useRef, useState } from 'react'
import { getSiteChatStatus, streamSiteChat } from '../../api/site-chat'

export type SiteChatMessage = { id: number; role: 'user' | 'assistant'; content: string }

// 对话状态只活在当前页面：刷新、关闭标签页即清空，不写浏览器存储或服务端。
export function useSiteChat() {
  const [status, setStatus] = useState<'loading' | 'ready' | 'closed' | 'error'>('loading')
  const [available, setAvailable] = useState(false)
  const [messages, setMessages] = useState<SiteChatMessage[]>([])
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState('')
  const [conversationId, setConversationId] = useState<string | undefined>(undefined)
  const nextId = useRef(1)
  const conversationRef = useRef<string | undefined>(undefined)
  const busyRef = useRef(false)
  const abortRef = useRef<AbortController | null>(null)

  useEffect(() => {
    const controller = new AbortController()
    void getSiteChatStatus().then(result => {
      if (controller.signal.aborted) return
      setAvailable(result.available)
      setStatus(result.enabled ? 'ready' : 'closed')
    }).catch(() => { if (!controller.signal.aborted) setStatus('error') })
    return () => controller.abort()
  }, [])

  useEffect(() => () => abortRef.current?.abort(), [])

  const send = async (value: string): Promise<boolean> => {
    const message = value.trim()
    if (!message || busyRef.current || status !== 'ready' || !available) return false
    const user: SiteChatMessage = { id: nextId.current++, role: 'user', content: message }
    const assistant: SiteChatMessage = { id: nextId.current++, role: 'assistant', content: '' }
    setMessages(current => [...current, user, assistant])
    setNotice('')
    setBusy(true)
    busyRef.current = true
    const controller = new AbortController()
    abortRef.current = controller
    let answer = ''
    try {
      await streamSiteChat({ message, conversationId: conversationRef.current }, controller.signal, text => {
        answer += text
        setMessages(current => current.map(item => item.id === assistant.id ? { ...item, content: answer } : item))
      }, ids => {
        conversationRef.current = ids.conversationId
        setConversationId(ids.conversationId)
      })
      return true
    } catch (error) {
      if (controller.signal.aborted) {
        setNotice('已停止生成。')
      } else {
        setNotice(error instanceof Error && error.message ? error.message : '对话暂时不可用，请稍后再试。')
      }
      // 请求已经受理过，输入框应清空；失败提示留给用户决定是否重试。
      return true
    } finally {
      setBusy(false)
      busyRef.current = false
      abortRef.current = null
      // 没有拿到任何正文时移除空气泡，避免留下空白答案。
      if (!answer) setMessages(current => current.filter(item => item.id !== assistant.id))
    }
  }

  const stop = () => { abortRef.current?.abort() }

  const reset = () => {
    abortRef.current?.abort()
    abortRef.current = null
    busyRef.current = false
    setBusy(false)
    setMessages([])
    setNotice('')
    conversationRef.current = undefined
    setConversationId(undefined)
    nextId.current = 1
  }

  return { status, available, conversationId, messages, busy, notice, send, stop, reset }
}
