import { useEffect, useState } from 'react'
import { observer } from 'mobx-react-lite'
import type { SiteContent } from '../../types/site'
import { SiteExperience } from '../site'
import { ResumeExperience } from '../resume'
import { siteStore } from '../../store/site'
import { readPreviewDraft, SITE_PREVIEW_READY } from './preview-protocol'
import styles from './site-preview.module.less'

// oxlint-disable-next-line react/only-export-components -- MobX observer 读取已保存内容，直接打开预览时也要跟随加载完成刷新。
export const SitePreviewPage = observer(function SitePreviewPage() {
  const [draft, setDraft] = useState<SiteContent | null>(null)
  const view = new URLSearchParams(window.location.search).get('view')
  const focus = view === 'thoughts' || view === 'works' || view === 'conversation' ? view : undefined

  useEffect(() => {
    // 直接打开 /admin/preview 时没有父页面，用已保存的公开内容兜底，避免只看到“等待预览”。
    if (window.parent === window) { void siteStore.load(); return }
    const receive = (event: MessageEvent) => {
      const next = readPreviewDraft(event, window.parent, window.location.origin)
      if (next) setDraft(next)
    }
    // 先监听再握手，避免父页发来的首份草稿落在注册前。
    window.addEventListener('message', receive)
    window.parent.postMessage({ type: SITE_PREVIEW_READY }, window.location.origin)
    return () => window.removeEventListener('message', receive)
  }, [])

  const content = draft ?? siteStore.document?.content ?? null
  return <div className={styles.page}>
    {content ? view === 'resume' ? <ResumeExperience content={content} preview /> : <SiteExperience content={content} preview focus={focus} /> : <div className={styles.waiting} role="status">
      <p>等待官网预览</p>
      <span>请从站主配置页打开预览，未保存内容会在这里同步。</span>
    </div>}
  </div>
})
