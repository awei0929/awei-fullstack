import { useId } from 'react'
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
    capabilities: <><path d="m8 8-4 4 4 4m8-8 4 4-4 4m-3-11-2 14" /></>,
    profile: <><circle cx="12" cy="7" r="4" /><path d="M4 21v-2a8 8 0 0 1 16 0v2" /></>,
    contact: <><path d="m3 10 18-7-7 18-3-8Z" /><path d="m11 13 10-10" /></>,
    appearance: <><path d="M3 6h18M3 12h18M3 18h18" /><circle cx="8" cy="6" r="2" /><circle cx="16" cy="12" r="2" /><circle cx="9" cy="18" r="2" /></>,
  }
  return <svg aria-hidden="true" viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">{paths[name]}</svg>
}
