import Markdown from 'react-markdown'
import type { Components } from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { ChatCopyButton } from './copy-button'
import styles from './style.module.less'

function safeChatUrl(url: string) {
  if (url.startsWith('#')) {
    try {
      const fragment = decodeURIComponent(url)
      return /^#[\p{L}\p{N}_-]+$/u.test(fragment) ? fragment : undefined
    } catch {
      return undefined
    }
  }
  const hasControl = Array.from(url).some(character => character.charCodeAt(0) < 32 || character.charCodeAt(0) === 127)
  if (!/^https?:\/\//i.test(url) || /[\s\\]/u.test(url) || hasControl) return undefined
  try {
    const parsed = new URL(url)
    return parsed.protocol === 'http:' || parsed.protocol === 'https:' ? url : undefined
  } catch {
    return undefined
  }
}

const components: Components = {
  a: ({ href, children }) => href ? <a href={href} target={href.startsWith('#') ? undefined : '_blank'} rel="noopener noreferrer">{children}</a> : <span>{children}</span>,
  // Model output must never load a remote image merely by being rendered.
  img: ({ alt }) => <span className={styles.imageReference}>
    <span>图片：{alt || '未提供说明'}</span>
    <span className={styles.imageNote}>（未自动加载）</span>
  </span>,
  table: ({ children }) => <div className={styles.tableScroll} tabIndex={0} role="region" aria-label="表格，可横向滚动"><table>{children}</table></div>,
  pre: ({ node, children }) => {
    const code = node?.children.find(child => child.type === 'element' && child.tagName === 'code')
    const classNames = code?.type === 'element' ? code.properties.className : []
    const language = Array.isArray(classNames) ? String(classNames.find(name => String(name).startsWith('language-')) || '').slice(9) : ''
    const text = code?.type === 'element' ? code.children.map(child => child.type === 'text' ? child.value : '').join('') : ''
    return <div className={styles.codeBlock}>
      <div className={styles.codeHeader}>
        <span className={styles.codeLanguage}>{language || '代码'}</span>
        <ChatCopyButton text={text} label="复制代码" />
      </div>
      <pre tabIndex={0} aria-label={language ? `${language} 代码，可横向滚动` : '代码，可横向滚动'}>{children}</pre>
    </div>
  },
}

export function ChatMarkdown({ content }: { content: string }) {
  return <div className={styles.markdown}>
    <Markdown remarkPlugins={[remarkGfm]} skipHtml urlTransform={safeChatUrl} components={components}>{content}</Markdown>
  </div>
}
