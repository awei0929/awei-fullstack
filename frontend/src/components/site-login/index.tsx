import { useEffect, useId, useRef, useState } from 'react'
import type { FormEvent, KeyboardEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { observer } from 'mobx-react-lite'
import { authStore } from '../../store/auth'
import { hasValidPasswordLength } from '../../utils/auth-validation'
import { SiteTip, useSiteTip } from '../site-tip'
import styles from './style.module.less'

interface SiteLoginPanelProps {
  open: boolean
  onClose: () => void
  reducedMotion?: boolean
}

export const SiteLoginPanel = observer(function SiteLoginPanel({ open, onClose, reducedMotion = false }: SiteLoginPanelProps) {
  const navigate = useNavigate()
  const id = useId()
  const dialogRef = useRef<HTMLDialogElement>(null)
  const headingRef = useRef<HTMLHeadingElement>(null)
  const accountRef = useRef<HTMLInputElement>(null)
  const passwordRef = useRef<HTMLInputElement>(null)
  const openerRef = useRef<HTMLElement | null>(null)
  const savedOverflow = useRef<string | null>(null)
  const mountedRef = useRef(true)
  const sessionRef = useRef(0)
  const [visible, setVisible] = useState(false)
  const [account, setAccount] = useState('')
  const [password, setPassword] = useState('')
  const [errors, setErrors] = useState<{ account?: string; password?: string }>({})
  const [characterFailed, setCharacterFailed] = useState(false)
  const [restoreAttempt, setRestoreAttempt] = useState(0)
  const { tip, showTip, dismissTip, clearTip } = useSiteTip()
  const { status, user, submitting, loggingOut, restoreError, logoutError } = authStore
  const busy = submitting || loggingOut

  function releaseDialog() {
    const dialog = dialogRef.current
    if (!dialog?.open && savedOverflow.current === null) return
    if (dialog?.open) dialog.close()
    if (savedOverflow.current !== null) {
      document.body.style.overflow = savedOverflow.current
      savedOverflow.current = null
    }
    const opener = openerRef.current
    const target = opener?.isConnected && opener.getClientRects().length
      ? opener
      : Array.from(document.querySelectorAll<HTMLElement>('[data-site-login-trigger]')).find((element) => element.getClientRects().length)
    target?.focus({ preventScroll: true })
  }

  useEffect(() => {
    sessionRef.current += 1
    if (!open) clearTip()
  }, [open, clearTip])

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
      releaseDialog()
    }
  }, [])

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    let frame = 0
    let timer = 0
    if (open) {
      if (!dialog.open) {
        openerRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null
        savedOverflow.current = document.body.style.overflow
        document.body.style.overflow = 'hidden'
        dialog.showModal()
        headingRef.current?.focus({ preventScroll: true })
      }
      frame = requestAnimationFrame(() => {
        setVisible(true)
        const target = dialog.querySelector<HTMLElement>('[data-login-autofocus]') || headingRef.current
        target?.focus({ preventScroll: true })
      })
    } else {
      setVisible(false)
      setAccount('')
      setPassword('')
      setErrors({})
      if (dialog.open) timer = window.setTimeout(releaseDialog, reducedMotion ? 0 : 180)
    }
    return () => {
      cancelAnimationFrame(frame)
      window.clearTimeout(timer)
    }
  }, [open, reducedMotion])

  useEffect(() => {
    if (!open) return
    authStore.clearAuthError()
    void authStore.restoreSession()
  }, [open])

  useEffect(() => {
    if (open && authStore.status === 'error') {
      showTip(restoreError || '暂时无法连接，请重试', 'error')
    }
  }, [open, status, restoreError, restoreAttempt, showTip])

  useEffect(() => {
    if (!open || status === 'loading' || status === 'idle') return
    const active = document.activeElement
    if (active !== headingRef.current && active !== dialogRef.current) return
    dialogRef.current?.querySelector<HTMLElement>('[data-login-autofocus]')?.focus({ preventScroll: true })
  }, [open, status, user])

  function close() {
    if (authStore.submitting || authStore.loggingOut) return
    sessionRef.current += 1
    clearTip()
    authStore.clearAuthError()
    onClose()
  }

  function trapFocus(event: KeyboardEvent<HTMLDialogElement>) {
    if (event.key !== 'Tab') return
    const focusable = Array.from(event.currentTarget.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), [tabindex="0"]'))
      .filter((element) => element.getClientRects().length)
    const first = focusable[0]
    const last = focusable.at(-1)
    if (!first) {
      event.preventDefault()
      headingRef.current?.focus()
    } else if (event.shiftKey && (document.activeElement === first || !focusable.includes(document.activeElement as HTMLElement))) {
      event.preventDefault()
      last?.focus()
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault()
      first.focus()
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!open || !authStore.ready || authStore.submitting || authStore.loggingOut) return
    const nextErrors = {
      account: !account ? '请输入账号' : !/^[0-9]{3,5}$/.test(account) ? '账号须为 3–5 位数字' : undefined,
      password: !password ? '请输入密码' : !hasValidPasswordLength(password) ? '密码须为 8–64 个字符' : undefined,
    }
    setErrors(nextErrors)
    if (nextErrors.account || nextErrors.password) {
      showTip(nextErrors.account || nextErrors.password || '', 'error')
      if (nextErrors.account) accountRef.current?.focus()
      else passwordRef.current?.focus()
      return
    }
    clearTip()
    const session = sessionRef.current
    const authenticated = await authStore.authenticate('login', { account, password })
    if (!mountedRef.current || session !== sessionRef.current) return
    if (authenticated) {
      setPassword('')
      clearTip()
      navigate('/admin')
    } else if (authStore.authError) showTip(authStore.authError, 'error')
  }

  async function switchAccount() {
    if (!open || !authStore.ready || !authStore.user || authStore.submitting || authStore.loggingOut) return
    clearTip()
    const session = sessionRef.current
    const loggedOut = await authStore.logout()
    if (!mountedRef.current || session !== sessionRef.current) return
    if (loggedOut) {
      setAccount('')
      setPassword('')
      setErrors({})
      requestAnimationFrame(() => { if (mountedRef.current) accountRef.current?.focus({ preventScroll: true }) })
    } else if (authStore.logoutError) showTip(authStore.logoutError, 'error')
  }

  function retryRestore() {
    clearTip()
    setRestoreAttempt((attempt) => attempt + 1)
    void authStore.restoreSession()
  }

  return <dialog
    ref={dialogRef}
    className={`${styles.dialog} ${reducedMotion ? styles.reducedMotion : ''}`}
    data-visible={visible}
    aria-labelledby={`${id}-title`}
    aria-describedby={`${id}-description`}
    aria-busy={busy || status === 'loading'}
    onCancel={(event) => { event.preventDefault(); close() }}
    onKeyDown={trapFocus}
    onClick={(event) => {
      if (event.target !== event.currentTarget) return
      const bounds = event.currentTarget.getBoundingClientRect()
      if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) close()
    }}
  >
    <SiteTip tip={tip} onClose={dismissTip} reducedMotion={reducedMotion} className={styles.tipViewport} />
    <div className={styles.panel}>
      <button className={styles.close} type="button" onClick={close} disabled={busy} aria-label="关闭登录面板"><span aria-hidden="true">×</span></button>
      <div className={styles.stage} aria-hidden="true">
        <span className={styles.stageEyebrow}>YOUR LITTLE CORNER</span>
        <p className={styles.stageTitle}>MAKE<br />YOURSELF<br /><span>AT HOME.</span></p>
        <div className={styles.orbit} />
        <span className={styles.spark}>✳</span>
        {!characterFailed && <img src="/site/hero-character.png" alt="" onError={() => setCharacterFailed(true)} />}
        <span className={styles.stageFooter}>A SMALL SPACE. A WORLD OF IDEAS.</span>
      </div>
      <section className={styles.content}>
        <p className={styles.eyebrow}><span /> WELCOME BACK</p>
        <h2 ref={headingRef} id={`${id}-title`} tabIndex={-1}>{user ? '欢迎回来。' : '站主登录'}</h2>
        <p className={styles.description} id={`${id}-description`}>{user ? '已登录，继续照料这个小小世界。' : '从这里，继续打理你的小小世界。'}</p>
        {status === 'idle' || status === 'loading' ? <div className={styles.waiting} role="status"><span className={styles.loader} aria-hidden="true" /><p>正在恢复登录状态<span>片刻之后，就可以继续。</span></p></div>
          : status === 'error' ? <div className={styles.state}>
            <p className={styles.restoreHint}>连接后即可继续登录。</p>
            <button type="button" className={styles.primary} data-login-autofocus onClick={retryRestore}>重新连接 <span aria-hidden="true">↗</span></button>
          </div>
            : user ? <div className={styles.state}>
              <div className={styles.accountCard}><span className={styles.accountIcon} aria-hidden="true">↳</span><div><span>当前账号</span><strong>{user.account}</strong></div><i aria-hidden="true" /></div>
              <button type="button" className={styles.primary} data-login-autofocus disabled={busy} onClick={() => { clearTip(); navigate('/admin') }}>继续进入配置 <span aria-hidden="true">↗</span></button>
              <button type="button" className={styles.secondary} disabled={busy} onClick={() => void switchAccount()}>{loggingOut ? '正在退出当前账号…' : logoutError ? '重试切换账号' : '切换账号'} <span aria-hidden="true">⇄</span></button>
            </div>
              : <form className={styles.form} noValidate onSubmit={(event) => void submit(event)}>
                {loggingOut && <p className={styles.hint} role="status">正在完成退出，请稍候再登录…</p>}
                <div className={styles.field}>
                  <label htmlFor={`${id}-account`}>账号 <span>ACCOUNT</span></label>
                  <input ref={accountRef} id={`${id}-account`} name="account" type="text" inputMode="numeric" autoComplete="username" required data-login-autofocus placeholder="输入站主账号" value={account} disabled={busy} aria-invalid={Boolean(errors.account)} aria-describedby={errors.account ? `${id}-account-error` : undefined} onChange={(event) => { setAccount(event.target.value); setErrors((current) => ({ ...current, account: undefined })); authStore.clearAuthError() }} />
                  {errors.account && <span className={styles.srOnly} id={`${id}-account-error`}>{errors.account}</span>}
                </div>
                <div className={styles.field}>
                  <label htmlFor={`${id}-password`}>密码 <span>PASSWORD</span></label>
                  <input ref={passwordRef} id={`${id}-password`} name="password" type="password" autoComplete="current-password" required placeholder="输入密码" value={password} disabled={busy} aria-invalid={Boolean(errors.password)} aria-describedby={errors.password ? `${id}-password-error` : undefined} onChange={(event) => { setPassword(event.target.value); setErrors((current) => ({ ...current, password: undefined })); authStore.clearAuthError() }} />
                  {errors.password && <span className={styles.srOnly} id={`${id}-password-error`}>{errors.password}</span>}
                </div>
                <button className={styles.primary} type="submit" disabled={busy}>{submitting ? '正在登录…' : '登录并进入配置'}<span aria-hidden="true">{submitting ? '· · ·' : '↗'}</span></button>
              </form>}
        <p className={styles.footnote}>留一点空间，给新的灵感。</p>
      </section>
    </div>
  </dialog>
})
