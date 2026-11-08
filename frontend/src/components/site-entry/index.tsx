import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { useRouteError } from 'react-router-dom'
import { SiteIntro } from '../site-intro'
import styles from './style.module.less'

type PageReadiness = { enabled: boolean; ready: boolean }
type EntryState = { report: (page: PageReadiness) => void; entering: boolean }
const EntryContext = createContext<EntryState | null>(null)

function motionAllowed() {
  return !window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

// The public page reports readiness; admin previews never affect the entrance.
// oxlint-disable-next-line react/only-export-components -- Lightweight readiness hook shared by the lazy page and the entry shell.
export function useSiteEntryReady({ enabled, ready, preview = false }: PageReadiness & { preview?: boolean }) {
  const entry = useContext(EntryContext)
  const report = entry?.report
  useLayoutEffect(() => {
    if (!preview) report?.({ enabled, ready })
  }, [enabled, ready, preview, report])
  return !preview && Boolean(entry?.entering)
}

export function SiteEntryProvider({ active, children }: { active: boolean; children: ReactNode }) {
  // App stays mounted during client navigation. Only an initial / document gets
  // an entrance, and a hard refresh creates a fresh lifetime without a seen flag.
  const [eligible] = useState(() => active && motionAllowed())
  const [finished, setFinished] = useState(false)
  const [page, setPage] = useState<PageReadiness>({ enabled: true, ready: false })
  const [imageReady, setImageReady] = useState(false)
  const [waitExpired, setWaitExpired] = useState(false)
  const report = useCallback((next: PageReadiness) => setPage((current) => (
    current.enabled === next.enabled && current.ready === next.ready ? current : next
  )), [])
  const finish = useCallback(() => setFinished(true), [])
  const enabled = eligible && active && page.enabled && !finished

  useEffect(() => {
    if (!enabled) return
    let disposed = false
    const image = new Image()
    const settleImage = () => { if (!disposed) setImageReady(true) }
    image.decoding = 'async'
    image.fetchPriority = 'high'
    image.onload = () => {
      // Decode before revealing when supported; a failed image is also terminal
      // so the page's own character fallback can remain usable.
      if (typeof image.decode === 'function') void image.decode().catch(() => undefined).then(settleImage)
      else settleImage()
    }
    image.onerror = settleImage
    image.src = '/site/hero-character.png'
    if (image.complete) image.onload(new Event('load'))
    const deadline = window.setTimeout(() => setWaitExpired(true), 8_000)
    return () => {
      disposed = true
      image.onload = null
      image.onerror = null
      window.clearTimeout(deadline)
    }
  }, [enabled])

  return <EntryContext.Provider value={{ report, entering: enabled }}>
    {children}
    <SiteIntro enabled={enabled} ready={waitExpired || (page.ready && imageReady)} onFinish={finish} />
  </EntryContext.Provider>
}

export function PageLoadFallback({ home = false }: { home?: boolean }) {
  const [delayed, setDelayed] = useState(false)
  useEffect(() => {
    const timeout = window.setTimeout(() => setDelayed(true), 8_000)
    return () => window.clearTimeout(timeout)
  }, [])
  return <main className={`${styles.loading} ${home ? styles.home : ''}`} aria-live="polite">
    <p role="status">{delayed ? '页面准备得有点久，请重新载入试试。' : '正在准备页面…'}</p>
    {delayed && <button type="button" onClick={() => window.location.reload()}>重新载入</button>}
  </main>
}

export function PageLoadError() {
  const error = useRouteError()
  useEffect(() => {
    if (import.meta.env.DEV && error instanceof Error) console.error('Page loading failed:', error.message)
  }, [error])
  useSiteEntryReady({ enabled: true, ready: true })
  return <main className={`${styles.loading} ${window.location.pathname === '/' ? styles.home : ''}`}>
    <p role="alert">暂时无法打开页面，请重新载入试试。</p>
    <button type="button" onClick={() => window.location.reload()}>重新载入</button>
  </main>
}
