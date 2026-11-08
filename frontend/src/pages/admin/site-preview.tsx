import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { observer } from 'mobx-react-lite'
import type { SiteContent } from '../../types/site'
import { getPreviewGeometry } from './preview-geometry'
import type { SitePreviewDevice } from './preview-geometry'
import { isPreviewReadyEvent, SITE_PREVIEW_DRAFT } from './preview-protocol'
import styles from './site-preview.module.less'

// oxlint-disable-next-line react/only-export-components -- 深读MobX草稿，保持iframe内的未保存内容同步。
export const SitePreview = observer(function SitePreview({ content, device }: { content: SiteContent; device: SitePreviewDevice }) {
  const hostRef = useRef<HTMLDivElement>(null)
  const frameRef = useRef<HTMLIFrameElement>(null)
  const [width, setWidth] = useState<number | null>(null)
  // JSON快照既订阅深层可观察字段，也避免将MobX代理传入postMessage。
  const serialized = JSON.stringify(content)
  const snapshotRef = useRef(serialized)
  snapshotRef.current = serialized

  const sendDraft = useCallback(() => {
    frameRef.current?.contentWindow?.postMessage({ type: SITE_PREVIEW_DRAFT, content: JSON.parse(snapshotRef.current) }, window.location.origin)
  }, [])

  useLayoutEffect(() => {
    const host = hostRef.current
    if (!host) return
    const measure = (next: number) => { if (Number.isFinite(next) && next > 0) setWidth(next) }
    measure(host.getBoundingClientRect().width)
    const resize = new ResizeObserver(([entry]) => { if (entry) measure(entry.contentRect.width) })
    resize.observe(host)
    return () => resize.disconnect()
  }, [])

  useEffect(() => {
    const receive = (event: MessageEvent) => {
      if (isPreviewReadyEvent(event, frameRef.current?.contentWindow ?? null, window.location.origin)) sendDraft()
    }
    window.addEventListener('message', receive)
    return () => window.removeEventListener('message', receive)
  }, [sendDraft])

  useEffect(() => { sendDraft() }, [serialized, sendDraft])

  const geometry = width === null ? null : getPreviewGeometry(width, device)
  return <div ref={hostRef} className={styles.host}>
    {geometry && <div className={styles.frame} style={{ width: geometry.width, height: geometry.height }}>
      <iframe
        ref={frameRef}
        className={styles.canvas}
        title={device === 'mobile' ? '官网手机预览' : '官网桌面预览'}
        src="/admin/preview"
        style={{ width: geometry.canvasWidth, height: geometry.canvasHeight, transform: `scale(${geometry.scale})` }}
        onLoad={sendDraft}
      />
    </div>}
  </div>
})
