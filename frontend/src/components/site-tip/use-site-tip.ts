import { useCallback, useEffect, useRef, useState } from 'react'

export type SiteTipTone = 'info' | 'success' | 'error'

export interface SiteTipMessage {
  id: number
  message: string
  tone: SiteTipTone
  exiting: boolean
}

export function useSiteTip() {
  const [tip, setTip] = useState<SiteTipMessage | null>(null)
  const nextId = useRef(0)
  const mounted = useRef(true)
  const timeout = useRef<number | undefined>(undefined)
  const exitTimeout = useRef<number | undefined>(undefined)

  const cancelTimers = useCallback(() => {
    window.clearTimeout(timeout.current)
    window.clearTimeout(exitTimeout.current)
    timeout.current = undefined
    exitTimeout.current = undefined
  }, [])

  const clearTip = useCallback(() => {
    cancelTimers()
    if (mounted.current) setTip(null)
  }, [cancelTimers])

  const dismissTip = useCallback(() => {
    cancelTimers()
    if (!mounted.current) return
    setTip((current) => current ? { ...current, exiting: true } : null)
    exitTimeout.current = window.setTimeout(() => {
      exitTimeout.current = undefined
      if (mounted.current) setTip(null)
    }, 160)
  }, [cancelTimers])

  const showTip = useCallback((message: string, tone: SiteTipTone = 'info') => {
    cancelTimers()
    if (!mounted.current) return
    setTip({ id: ++nextId.current, message, tone, exiting: false })
    timeout.current = window.setTimeout(dismissTip, 4500)
  }, [cancelTimers, dismissTip])

  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
      cancelTimers()
    }
  }, [cancelTimers])

  return { tip, showTip, dismissTip, clearTip }
}
