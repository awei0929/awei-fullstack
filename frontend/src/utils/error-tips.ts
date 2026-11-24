type ErrorTipListener = (message: string) => void

const listeners = new Set<ErrorTipListener>()
let pending: string | null = null
let lastMessage = ''
let lastAt = 0

// 网络层和 SSE 层共用这一条提示通道；同一条错误在短时间内只弹一次。
export function notifyError(message: string): void {
  const text = message.trim()
  if (!text) return
  const now = Date.now()
  if (text === lastMessage && now - lastAt < 2000) return
  lastMessage = text
  lastAt = now
  if (listeners.size === 0) {
    pending = text
    return
  }
  listeners.forEach(listener => listener(text))
}

export function subscribeErrorTips(listener: ErrorTipListener): () => void {
  listeners.add(listener)
  if (pending) {
    const text = pending
    pending = null
    listener(text)
  }
  return () => { listeners.delete(listener) }
}
