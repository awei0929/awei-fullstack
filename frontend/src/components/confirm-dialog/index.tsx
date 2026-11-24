import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { Modal } from 'antd'
import styles from './style.module.less'

export type ConfirmOptions = {
  title: string
  description?: string
  confirmText?: string
  cancelText?: string
}

type ConfirmFn = (options: ConfirmOptions) => Promise<boolean>
type PendingState = { options: ConfirmOptions; open: boolean }
type Resolver = (value: boolean) => void

const ConfirmContext = createContext<ConfirmFn | null>(null)

// 公共确认弹窗：用 AntD Modal 承接焦点/遮罩/键盘行为，颜色跟随站点的黑白 CSS 变量。
export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [pending, setPending] = useState<PendingState | null>(null)
  const resolver = useRef<Resolver | null>(null)

  const settle = useCallback((value: boolean) => {
    const resolve = resolver.current
    resolver.current = null
    setPending(current => (current ? { ...current, open: false } : null))
    resolve?.(value)
  }, [])

  const confirm = useCallback<ConfirmFn>(options => new Promise<boolean>(resolve => {
    // 同一时间只保留一个确认框；旧的 Promise 以取消结束，避免悬挂。
    resolver.current?.(false)
    resolver.current = resolve
    setPending({ options, open: true })
  }), [])

  useEffect(() => () => {
    resolver.current?.(false)
    resolver.current = null
  }, [])

  return <ConfirmContext.Provider value={confirm}>
    {children}
    <Modal
      open={pending?.open ?? false}
      title={pending?.options.title}
      okText={pending?.options.confirmText ?? '确定'}
      cancelText={pending?.options.cancelText ?? '取消'}
      onOk={() => settle(true)}
      onCancel={() => settle(false)}
      centered
      width={420}
      closeIcon={<span className={styles.closeGlyph} aria-hidden="true">×</span>}
      classNames={{
        root: styles.root,
        close: styles.close,
      }}
      styles={{
        container: {
          background: 'var(--theme-surface)',
          color: 'var(--theme-text)',
          border: '1px solid var(--theme-line)',
          borderRadius: 2,
          padding: '22px 24px 20px',
          boxShadow: '0 24px 80px var(--theme-shadow)',
        },
        header: { background: 'transparent', margin: 0, padding: 0 },
        title: {
          color: 'var(--theme-text)',
          fontFamily: "Georgia, 'Songti SC', 'Noto Serif SC', serif",
          fontSize: 22,
          fontWeight: 500,
          letterSpacing: '-0.02em',
        },
        body: { color: 'var(--theme-muted)', padding: '8px 0 0', fontSize: 13, lineHeight: 1.8 },
        footer: { marginTop: 22, padding: 0, borderTop: 0 },
        mask: { background: 'rgba(0, 0, 0, 0.52)' },
      }}
      okButtonProps={{
        style: {
          background: 'var(--theme-text)',
          borderColor: 'var(--theme-text)',
          color: 'var(--theme-bg)',
          borderRadius: 999,
          boxShadow: 'none',
        },
      }}
      cancelButtonProps={{
        style: {
          background: 'transparent',
          borderColor: 'var(--theme-line-strong)',
          color: 'var(--theme-text)',
          borderRadius: 999,
          boxShadow: 'none',
        },
      }}
    >
      {pending?.options.description
        ? <p className={styles.description}>{pending.options.description}</p>
        : null}
    </Modal>
  </ConfirmContext.Provider>
}

// 页面里通过 useConfirm 调用，返回值是用户是否确认；不依赖 window.confirm 的原生样式。
// oxlint-disable-next-line react/only-export-components -- 公共弹窗同时导出 Provider 与调用 Hook。
export function useConfirm(): ConfirmFn {
  const confirm = useContext(ConfirmContext)
  if (!confirm) throw new Error('useConfirm must be used inside ConfirmProvider')
  return confirm
}
