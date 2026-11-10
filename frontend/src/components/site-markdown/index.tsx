import { useState } from 'react'
import type { ComponentProps } from 'react'
import Markdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { isSafeSiteUrl } from '../../api/site'
import styles from './style.module.less'

// 与配置封面共用同一URL边界；图片错误独立于正文，失败不使整份履历消失。
export function SiteImage({ src, alt = '', ...props }: ComponentProps<'img'>) {
  const [failedSource, setFailedSource] = useState<string | undefined>()
  if (!src || !isSafeSiteUrl(src, 'image') || failedSource === src) return <span className={styles.imageFallback} role="img" aria-label={alt ? `${alt}（图片暂不可用）` : '图片暂不可用'}>图片暂不可用{alt && <small>{alt}</small>}</span>
  return <img {...props} src={src} alt={alt} loading="lazy" referrerPolicy="no-referrer" onError={() => setFailedSource(src)} />
}

// 不启用raw HTML插件；链接支持严格本站文件路径，图片仍使用独立图片白名单。
export function SiteMarkdown({ content }: { content: string }) {
  return <div className={styles.markdown}><Markdown remarkPlugins={[remarkGfm]} skipHtml urlTransform={(url, key) => {
    if (key === 'src') return isSafeSiteUrl(url, 'image') ? url : undefined
    return /^#[\w\u4e00-\u9fff-]+$/u.test(url) || isSafeSiteUrl(url, 'markdown') ? url : undefined
  }} components={{
    a: ({ href, children }) => href ? <a href={href} target={href.startsWith('#') ? undefined : '_blank'} rel="noopener noreferrer">{children}</a> : <span>{children}</span>,
    img: ({ src, alt }) => <SiteImage src={src} alt={alt} />,
    table: ({ children }) => <div className={styles.tableScroll} tabIndex={0} role="region" aria-label="表格，可横向滚动"><table>{children}</table></div>,
    pre: ({ children }) => <pre tabIndex={0}>{children}</pre>,
  }}>{content}</Markdown></div>
}
