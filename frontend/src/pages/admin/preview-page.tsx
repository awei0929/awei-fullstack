import { useEffect, useState } from 'react'
import type { SiteContent } from '../../types/site'
import { SiteExperience } from '../site'
import { readPreviewDraft, SITE_PREVIEW_READY } from './preview-protocol'
import styles from './site-preview.module.less'

export function SitePreviewPage() {
  const [draft, setDraft] = useState<SiteContent | null>(null)

  useEffect(() => {
    if (window.parent === window) return
    const receive = (event: MessageEvent) => {
      const next = readPreviewDraft(event, window.parent, window.location.origin)
      if (next) setDraft(next)
    }
    // 先监听再握手，避免父页发来的首份草稿落在注册前。
    window.addEventListener('message', receive)
    window.parent.postMessage({ type: SITE_PREVIEW_READY }, window.location.origin)
    return () => window.removeEventListener('message', receive)
  }, [])

  return <div className={styles.page}>
    {draft ? <SiteExperience content={draft} preview /> : <div className={styles.waiting} role="status">
      <p>等待官网预览</p>
      <span>请从站主配置页打开预览，未保存内容会在这里同步。</span>
    </div>}
  </div>
}
