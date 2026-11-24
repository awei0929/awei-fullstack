import { useEffect, useState } from 'react'
import styles from './style.module.less'

type Theme = 'light' | 'dark'

const STORAGE_KEY = 'nest-theme'

function currentTheme(): Theme {
  const saved = document.documentElement.dataset.theme
  if (saved === 'light' || saved === 'dark') return saved
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

// 黑白主题只切换根节点的 data-theme，颜色全部由 CSS 变量承接；偏好写入 localStorage。
export function ThemeToggle({ className = '' }: { className?: string }) {
  const [theme, setTheme] = useState<Theme>(currentTheme)

  useEffect(() => {
    document.documentElement.dataset.theme = theme
  }, [theme])

  useEffect(() => {
    const media = window.matchMedia?.('(prefers-color-scheme: dark)')
    if (!media) return
    const onChange = () => {
      try { if (localStorage.getItem(STORAGE_KEY)) return } catch { /* 隐私模式可能禁用存储 */ }
      setTheme(media.matches ? 'dark' : 'light')
    }
    media.addEventListener('change', onChange)
    return () => media.removeEventListener('change', onChange)
  }, [])

  const toggle = () => {
    const next: Theme = theme === 'dark' ? 'light' : 'dark'
    try { localStorage.setItem(STORAGE_KEY, next) } catch { /* 隐私模式可能禁用存储 */ }
    setTheme(next)
  }
  const label = theme === 'dark' ? '切换到白天模式' : '切换到黑夜模式'

  return <button type="button" className={`${styles.toggle} ${className}`.trim()} onClick={toggle} aria-label={label} title={label}>
    {theme === 'dark'
      ? <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="4.2" /><path d="M12 2.4v2.2M12 19.4v2.2M2.4 12h2.2M19.4 12h2.2M4.9 4.9l1.6 1.6M17.5 17.5l1.6 1.6M19.1 4.9l-1.6 1.6M6.5 17.5l-1.6 1.6" /></svg>
      : <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 14.7A8.2 8.2 0 0 1 9.3 4a8.2 8.2 0 1 0 10.7 10.7Z" /></svg>}
  </button>
}
