import { makeAutoObservable, runInAction } from 'mobx'
import * as authApi from '../api/auth'
import { HttpError } from '../api/http'
import type { AuthInput, AuthMode, SessionView, User } from '../types/auth'

class AuthStore {
  user: User | null = null
  status: 'idle' | 'loading' | 'ready' | 'error' = 'idle'
  csrfToken = ''
  identityVersion = 0
  submitting = false
  loggingOut = false
  restoreError = ''
  authError = ''
  logoutError = ''
  loginPromptVersion = 0
  private operationVersion = 0

  constructor() {
    makeAutoObservable(this, {}, { autoBind: true })
  }

  get ready(): boolean {
    return this.status === 'ready'
  }

  private applySession(session: SessionView): void {
    this.user = session.user
    this.csrfToken = session.csrfToken
    this.status = 'ready'
    this.identityVersion += 1
    this.restoreError = ''
    this.authError = ''
    this.logoutError = ''
  }

  async restoreSession(): Promise<void> {
    if (this.status === 'loading' || this.ready || this.submitting || this.loggingOut) return
    const operation = ++this.operationVersion
    this.status = 'loading'
    this.restoreError = ''
    try {
      const session = await authApi.getSession()
      runInAction(() => {
        if (operation === this.operationVersion) this.applySession(session)
      })
    } catch (error) {
      runInAction(() => {
        if (operation !== this.operationVersion) return
        this.status = 'error'
        this.restoreError = error instanceof Error ? error.message : '暂时无法恢复登录状态'
      })
    }
  }

  clearAuthError(): void {
    this.authError = ''
  }

  async authenticate(mode: AuthMode, input: AuthInput): Promise<boolean> {
    if (!this.ready || this.submitting || this.loggingOut) return false
    const operation = ++this.operationVersion
    this.submitting = true
    this.authError = ''
    try {
      // An expired or destroyed session needs a fresh anonymous CSRF session.
      const token = this.csrfToken || (await authApi.getSession()).csrfToken
      if (operation !== this.operationVersion) return false
      const session = await authApi.authenticate(mode, input, token)
      if (operation !== this.operationVersion) return false
      runInAction(() => this.applySession(session))
      return true
    } catch (error) {
      runInAction(() => {
        if (operation !== this.operationVersion) return
        if (error instanceof HttpError && error.status === 403) this.csrfToken = ''
        this.authError = error instanceof HttpError && error.status === 401
          ? '账号或密码错误'
          : error instanceof HttpError && error.status === 409
            ? '账号已注册'
            : error instanceof HttpError && error.status === 403
              ? '登录状态已更新，请再次提交'
              : error instanceof Error ? error.message : '暂时无法登录，请重试'
      })
      return false
    } finally {
      runInAction(() => {
        if (operation === this.operationVersion) this.submitting = false
      })
    }
  }

  async logout(): Promise<boolean> {
    if (!this.user || !this.ready || this.loggingOut || this.submitting) return false
    const operation = ++this.operationVersion
    this.loggingOut = true
    this.logoutError = ''
    try {
      const token = this.csrfToken || (await authApi.getSession()).csrfToken
      if (operation !== this.operationVersion) return false
      await authApi.logout(token)
      if (operation !== this.operationVersion) return false
      runInAction(() => this.applySession({ user: null, csrfToken: '' }))
      return true
    } catch (error) {
      runInAction(() => {
        if (operation !== this.operationVersion) return
        if (error instanceof HttpError && error.status === 403) this.csrfToken = ''
        this.logoutError = error instanceof HttpError && error.status === 403
          ? '登录状态已更新，请重试退出'
          : error instanceof Error ? error.message : '退出失败，请重试'
      })
      return false
    } finally {
      runInAction(() => {
        // Identity can expire before this response; keep the network lock until
        // logout finishes so its late Set-Cookie cannot clear a newer login.
        this.loggingOut = false
      })
    }
  }

  expireSession(expectedIdentity: number): void {
    if (expectedIdentity !== this.identityVersion || !this.user) return
    this.operationVersion += 1
    this.applySession({ user: null, csrfToken: '' })
    this.submitting = false
    this.loginPromptVersion += 1
  }
}

export const authStore = new AuthStore()
