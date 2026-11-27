import { useEffect, useId, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import type { Section } from './sections'
import styles from './style.module.less'

interface TextFieldProps {
  label: string
  value: string
  onChange: (value: string) => void
  maxLength?: number
  multiline?: boolean
  rows?: number
  required?: boolean
  placeholder?: string
  hint?: string
  type?: 'text' | 'email' | 'password'
}

export function TextField({ label, value, onChange, maxLength, multiline, rows = 3, required, placeholder, hint, type = 'text' }: TextFieldProps) {
  const id = useId()
  const props = { id, value, maxLength, required, placeholder, onChange: (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => onChange(event.target.value), 'aria-describedby': hint ? `${id}-hint` : undefined }
  return <div className={styles.field}>
    <label htmlFor={id}>{label}{required && <span aria-hidden="true"> *</span>}</label>
    {multiline ? <textarea {...props} rows={rows} /> : <input {...props} type={type} />}
    {hint && <small id={`${id}-hint`}>{hint}</small>}
  </div>
}


interface LinesFieldProps {
  label: string
  value: string[]
  onChange: (value: string[]) => void
  rows?: number
  placeholder?: string
  hint?: string
}

// 多行列表在失焦时提交，避免每敲一个换行就被父级重渲染吞掉空行。
export function LinesField({ label, value, onChange, rows = 4, placeholder, hint }: LinesFieldProps) {
  const id = useId()
  const [text, setText] = useState(value.join('\n'))
  const latest = useRef(value)
  useEffect(() => {
    if (latest.current.length !== value.length || latest.current.some((line, index) => line !== value[index])) {
      latest.current = value
      setText(value.join('\n'))
    }
  }, [value])
  const commit = () => {
    const next = text.split('\n').map((line) => line.trim()).filter(Boolean)
    latest.current = next
    onChange(next)
  }
  return <div className={styles.field}>
    <label htmlFor={id}>{label}</label>
    <textarea id={id} value={text} rows={rows} placeholder={placeholder} onChange={(event) => setText(event.target.value)} onBlur={commit} aria-describedby={hint ? `${id}-hint` : undefined} />
    {hint && <small id={`${id}-hint`}>{hint}</small>}
  </div>
}

export function Group({ title, children, description }: { title: string; children: ReactNode; description?: string }) {
  return <section className={styles.group}><h2>{title}</h2>{description && <p className={styles.hint}>{description}</p>}{children}</section>
}

export function Toggle({ label, checked, onChange, hint }: { label: string; checked: boolean; onChange: (value: boolean) => void; hint?: string }) {
  return <label className={styles.toggle}>
    <span>{label}{hint && <small>{hint}</small>}</span>
    <input type="checkbox" role="switch" checked={checked} onChange={(event) => onChange(event.target.checked)} />
  </label>
}

export function Icon({ name }: { name: Section }) {
  const paths = {
    home: <><path d="m3 10 9-7 9 7v11h-6v-7H9v7H3Z" /></>,
    thoughts: <><path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-4 10c.7.7 1 1.2 1 2h6c0-.8.3-1.3 1-2a6 6 0 0 0-4-10Z" /></>,
    works: <><rect x="3" y="7" width="18" height="13" rx="2" /><path d="M8 7V5h8v2M3 12h18" /></>,
    resume: <path d="M5 3h14v18H5ZM8 8h8m-8 4h8m-8 4h5" />,
    capabilities: <><path d="m8 8-4 4 4 4m8-8 4 4-4 4m-3-11-2 14" /></>,
    profile: <><circle cx="12" cy="7" r="4" /><path d="M4 21v-2a8 8 0 0 1 16 0v2" /></>,
    contact: <><path d="m3 10 18-7-7 18-3-8Z" /><path d="m11 13 10-10" /></>,
    appearance: <><path d="M3 6h18M3 12h18M3 18h18" /><circle cx="8" cy="6" r="2" /><circle cx="16" cy="12" r="2" /><circle cx="9" cy="18" r="2" /></>,
    files: <><path d="M14 3H5v18h14V8Z" /><path d="M14 3v5h5M12 17v-6m-3 3 3-3 3 3" /></>,
    conversation: <><path d="M4 5h16v11H9l-5 4V5Z" /><path d="M12 8v1.5M9.5 12a2.5 2.5 0 0 0 5 0" /></>,
    chat: <><path d="M3 4h18v13H9l-6 4V4Z" /><path d="M7 9h10M7 13h6" /></>,
    logs: <><rect x="4" y="3" width="16" height="18" rx="2" /><path d="M8 8h8M8 12h8M8 16h5" /></>,
  }
  return <svg aria-hidden="true" viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">{paths[name]}</svg>
}
