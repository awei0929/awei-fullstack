const KEY = 'nest.chat.visitor.v1'
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
let memory = ''

// 只用于匿名访客标识与请求幂等；不是登录凭据，也不存任何聊天内容。
export function createUuid(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID()
  const bytes = new Uint8Array(16)
  if (typeof crypto === 'undefined' || typeof crypto.getRandomValues !== 'function') {
    throw new Error('当前浏览器不支持安全随机数，无法创建匿名会话')
  }
  crypto.getRandomValues(bytes)
  bytes[6] = (bytes[6] & 0x0f) | 0x40
  bytes[8] = (bytes[8] & 0x3f) | 0x80
  const hex = Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('')
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
}

function read(storage: Storage): string {
  try {
    const value = storage.getItem(KEY) ?? ''
    return UUID_RE.test(value) ? value : ''
  } catch {
    return ''
  }
}

function write(storage: Storage, value: string): boolean {
  try {
    storage.setItem(KEY, value)
    return true
  } catch {
    return false
  }
}

export function getVisitorId(): string {
  if (memory) return memory
  const local = typeof localStorage === 'undefined' ? '' : read(localStorage)
  if (local) return (memory = local)
  const session = typeof sessionStorage === 'undefined' ? '' : read(sessionStorage)
  if (session) {
    memory = session
    if (typeof localStorage !== 'undefined') write(localStorage, session)
    return session
  }
  const created = createUuid()
  memory = created
  if (typeof localStorage !== 'undefined' && write(localStorage, created)) return created
  if (typeof sessionStorage !== 'undefined') write(sessionStorage, created)
  return created
}
