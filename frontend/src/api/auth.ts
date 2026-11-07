import type { AuthInput, SessionView } from '../types/auth'
import { request } from './http'

function parseSession(value: unknown): SessionView {
  if (!value || typeof value !== 'object' || !('csrfToken' in value)
    || typeof value.csrfToken !== 'string' || !value.csrfToken || !('user' in value)) {
    throw new Error('登录状态响应无效，请重试')
  }
  const user = value.user
  if (user !== null && (!user || typeof user !== 'object' || !('id' in user)
    || typeof user.id !== 'string' || !('account' in user)
    || typeof user.account !== 'string' || !/^[0-9]{3,5}$/.test(user.account))) {
    throw new Error('登录状态响应无效，请重试')
  }
  return value as SessionView
}

export async function getSession(): Promise<SessionView> {
  return parseSession(await request<unknown>('/auth/session'))
}

export async function authenticate(mode: 'login' | 'register', input: AuthInput, csrfToken: string): Promise<SessionView> {
  const session = parseSession(await request<unknown>(`/auth/${mode}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    csrfToken,
    body: JSON.stringify(input),
  }))
  if (!session.user) throw new Error('服务未能确认登录状态，请重试')
  return session
}

export async function logout(csrfToken: string): Promise<void> {
  const result = await request<{ success?: unknown }>('/auth/logout', {
    method: 'POST',
    csrfToken,
  })
  if (result.success !== true) throw new Error('服务未能确认退出，请重试')
}
