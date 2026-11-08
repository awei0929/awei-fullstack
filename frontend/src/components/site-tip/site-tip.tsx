import { useEffect, useRef } from 'react'
import type { SiteTipMessage } from './use-site-tip'
import styles from './style.module.less'

interface SiteTipProps {
  tip: SiteTipMessage | null
  onClose: () => void
  reducedMotion?: boolean
  className?: string
}

// Render inside the active dialog when used in a modal: a body portal cannot
// appear above the browser's modal top layer, regardless of its z-index.
export function SiteTip({ tip, onClose, reducedMotion = false, className = '' }: SiteTipProps) {
  const closeRef = useRef<HTMLButtonElement>(null)
  const previousFocus = useRef<Element | null>(null)
  const tipId = tip?.id
  const exiting = tip?.exiting

  useEffect(() => {
    if (tipId === undefined) return
    if (document.activeElement !== closeRef.current) previousFocus.current = document.activeElement
  }, [tipId])

  useEffect(() => {
    const previous = previousFocus.current
    if (exiting && document.activeElement === closeRef.current && previous instanceof HTMLElement && previous.isConnected) {
      previous.focus({ preventScroll: true })
    }
  }, [exiting])

  if (!tip) return null

  return <div className={`${styles.viewport} ${reducedMotion ? styles.reducedMotion : ''} ${className}`}>
    <div className={styles.tip} key={tip.id} data-tone={tip.tone} data-exiting={tip.exiting}>
      <span className={styles.icon} aria-hidden="true">{tip.tone === 'success' ? '✓' : tip.tone === 'error' ? '!' : 'i'}</span>
      <span className={styles.message} role={tip.tone === 'error' ? 'alert' : 'status'} aria-atomic="true">{tip.message}</span>
      <button ref={closeRef} className={styles.close} type="button" aria-label="关闭提示" onClick={onClose}><span aria-hidden="true">×</span></button>
    </div>
  </div>
}
