// 首页只负责收问题；跨路由交接用同标签页 sessionStorage，避免把问题塞进 URL。
const KEY = 'nest.chat.pending.v1'
let fallback = ''

export function setPendingPrompt(value: string): void {
  const prompt = value.trim()
  fallback = prompt
  try { window.sessionStorage.setItem(KEY, prompt) } catch { /* 隐私模式下降级到内存 */ }
}

export function takePendingPrompt(): string {
  let value = fallback
  fallback = ''
  try {
    value = window.sessionStorage.getItem(KEY) || value
    window.sessionStorage.removeItem(KEY)
  } catch { /* 隐私模式下降级到内存 */ }
  return value.trim()
}
