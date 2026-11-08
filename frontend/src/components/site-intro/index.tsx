import { useId, useLayoutEffect, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import styles from './style.module.less'

type SiteIntroProps = { enabled: boolean; ready: boolean; onFinish?: () => void }

// Each path is one pen movement, rather than the outline of a filled font.
const strokes = [
  { d: 'M88 38 C69 74 53 123 53 162', delay: 100, duration: 370 },
  { d: 'M54 117 C91 107 133 110 167 102', delay: 360, duration: 290 },
  { d: 'M181 35 C163 73 144 123 142 162', delay: 570, duration: 340 },
  { d: 'M277 56 C260 49 232 51 219 61 C210 82 194 123 187 151 C204 160 234 156 259 146', delay: 820, duration: 460 },
  { d: 'M202 109 C218 104 238 104 254 101', delay: 1140, duration: 180 },
  { d: 'M311 49 C316 74 329 94 346 106 C364 89 380 68 393 47', delay: 1280, duration: 340 },
  { d: 'M347 106 C334 129 326 153 315 170', delay: 1530, duration: 250 },
]

export function SiteIntro({ enabled, ready, onFinish }: SiteIntroProps) {
  const descriptionId = useId()
  const dialogRef = useRef<HTMLDialogElement>(null)
  const finishRef = useRef<(() => void) | null>(null)
  const playback = useRef<{ finished: boolean } | null>(null)
  const [holdComplete, setHoldComplete] = useState(false)

  useLayoutEffect(() => {
    const dialog = dialogRef.current
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)')

    if (!enabled || reducedMotion.matches || !dialog?.showModal) {
      if (playback.current && !playback.current.finished) {
        playback.current.finished = true
        onFinish?.()
      }
      return
    }

    if (playback.current?.finished) return

    // Completion belongs to this app lifetime, never sessionStorage: a refresh
    // receives a new entrance, while StrictMode resumes the unfinished mount.
    playback.current = { finished: false }
    const focusBefore = document.activeElement instanceof HTMLElement ? document.activeElement : null
    let finished = false
    let safetyTimer: number | undefined
    let remainingSafetyTime = 12_000
    let visibleSince: number | null = null

    const close = () => {
      const ownsFocus = dialog.contains(document.activeElement)
      if (dialog.open) dialog.close()
      // Native dialog normally restores focus itself. Only supply its fallback
      // while focus is still unclaimed; never interrupt a newer user action.
      if (ownsFocus && focusBefore?.isConnected && document.activeElement === document.body) {
        focusBefore.focus({ preventScroll: true })
      }
    }

    const finish = () => {
      if (finished) return
      finished = true
      if (playback.current) playback.current.finished = true
      removeListeners()
      close()
      onFinish?.()
    }

    const syncVisibility = () => {
      dialog.dataset.paused = String(document.hidden)
      if (safetyTimer !== undefined) window.clearTimeout(safetyTimer)
      if (visibleSince !== null) remainingSafetyTime -= performance.now() - visibleSince
      visibleSince = document.hidden ? null : performance.now()
      // Also recover if a browser never dispatches the CSS animationend event.
      if (!document.hidden) safetyTimer = window.setTimeout(finish, Math.max(0, remainingSafetyTime))
    }
    const syncMotion = () => {
      if (reducedMotion.matches) finish()
    }
    const removeListeners = () => {
      if (safetyTimer !== undefined) window.clearTimeout(safetyTimer)
      document.removeEventListener('visibilitychange', syncVisibility)
      reducedMotion.removeEventListener('change', syncMotion)
    }

    finishRef.current = finish
    syncVisibility()
    try { dialog.showModal() } catch { finish(); return }
    dialog.focus({ preventScroll: true })
    document.addEventListener('visibilitychange', syncVisibility)
    reducedMotion.addEventListener('change', syncMotion)

    return () => {
      removeListeners()
      if (finishRef.current === finish) finishRef.current = null
      close()
    }
  }, [enabled, onFinish])

  return <dialog
    ref={dialogRef}
    className={styles.intro}
    data-releasing={holdComplete && ready}
    tabIndex={-1}
    aria-label="开场动画"
    aria-describedby={descriptionId}
    onCancel={(event) => { event.preventDefault(); finishRef.current?.() }}
    onKeyDown={(event) => {
      if (event.key === 'Tab') {
        event.preventDefault()
        event.currentTarget.focus({ preventScroll: true })
      }
    }}
  >
    <div className={styles.glass} aria-hidden="true" onAnimationEnd={(event) => {
      if (event.target === event.currentTarget && holdComplete && ready) finishRef.current?.()
    }} />
    <span className={styles.holdClock} aria-hidden="true" onAnimationEnd={(event) => {
      if (event.target === event.currentTarget) setHoldComplete(true)
    }} />
    <div className={styles.artwork} aria-hidden="true">
      <p className={styles.eyebrow}><span /> A LITTLE HELLO</p>
      <svg className={styles.signature} viewBox="0 0 480 220" fill="none">
        {strokes.map((stroke, index) => <path
          key={index}
          className={styles.stroke}
          d={stroke.d}
          pathLength="1"
          style={{ '--stroke-delay': `${stroke.delay}ms`, '--stroke-duration': `${stroke.duration}ms` } as CSSProperties}
        />)}
        <circle className={styles.period} cx="408" cy="151" r="4.5" />
        <path className={styles.flourish} d="M72 193 C170 175 305 180 423 180" pathLength="1" />
      </svg>
      <p className={styles.caption}>很高兴，在这里遇见你。</p>
    </div>
    <p id={descriptionId} className={styles.srOnly}>HEY.，很高兴见到你。开场结束后将自动进入主页。</p>
    <span className={styles.cornerNote} aria-hidden="true">SOMETHING GOOD, JUST AHEAD.</span>
  </dialog>
}
