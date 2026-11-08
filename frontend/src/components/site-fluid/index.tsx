import { useEffect, useRef } from 'react'
import type { RefObject } from 'react'
import { mountFluidBackground } from './lifecycle'
import styles from './style.module.less'

type SiteFluidBackgroundProps = {
  enabled: boolean
  containerRef: RefObject<HTMLDivElement>
}

export function SiteFluidBackground({ enabled, containerRef }: SiteFluidBackgroundProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const canvas = canvasRef.current
    const container = containerRef.current
    if (!enabled || !canvas || !container) return
    return mountFluidBackground(canvas, container)
  }, [enabled, containerRef])

  return <canvas ref={canvasRef} className={styles.canvas} aria-hidden="true" width={1} height={1} />
}
