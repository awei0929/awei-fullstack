import { createFluidRenderer } from './renderer'
import type { FluidPoint, FluidRenderer } from './renderer'

type ClientPoint = { clientX: number; clientY: number }
const idleDuration = 2500

/** Owns scheduling and DOM subscriptions separately from the WebGL solver. */
export function mountFluidBackground(canvas: HTMLCanvasElement, container: HTMLDivElement): () => void {
  const capability = window.matchMedia('(hover: hover) and (pointer: fine) and (prefers-reduced-motion: no-preference)')
  let inView = false
  let disposed = false
  let listening = false
  let renderer: FluidRenderer | null = null
  let previous: ClientPoint | null = null
  let pending: ClientPoint | null = null
  let raf = 0
  let lastFrame = 0
  let lastActivity = 0
  canvas.style.visibility = 'hidden'

  const stop = () => {
    cancelAnimationFrame(raf)
    raf = 0
    previous = null
    pending = null
    renderer?.dispose()
    renderer = null
    canvas.style.visibility = 'hidden'
  }
  const allowed = () => !disposed && capability.matches && inView && !document.hidden
  const locate = (point: ClientPoint, rect: DOMRect): FluidPoint => ({
    x: (point.clientX - rect.left) / rect.width,
    y: 1 - (point.clientY - rect.top) / rect.height,
  })
  const frame = (now: number) => {
    raf = 0
    if (!allowed()) { stop(); return }
    try {
      if (!renderer) renderer = createFluidRenderer(canvas)
      if (!renderer) { cleanup(); return }
      if (now - lastActivity >= idleDuration) {
        renderer.clear()
        canvas.style.visibility = 'hidden'
        pending = null
        return
      }
      const dt = Math.min(Math.max((now - lastFrame) / 1000, 1 / 120), 1 / 30)
      lastFrame = now
      if (pending && previous) {
        const rect = canvas.getBoundingClientRect()
        if (rect.width > 0 && rect.height > 0) {
          const from = locate(previous, rect)
          const to = locate(pending, rect)
          if (to.x >= 0 && to.x <= 1 && to.y >= 0 && to.y <= 1) renderer.splat(from, to, dt, now)
        }
        previous = pending
        pending = null
      }
      renderer.step(dt)
      renderer.render()
      canvas.style.visibility = 'visible'
      raf = requestAnimationFrame(frame)
    } catch { cleanup() }
  }
  const onMove = (event: PointerEvent) => {
    if (!allowed() || event.pointerType !== 'mouse') return
    const point = { clientX: event.clientX, clientY: event.clientY }
    if (!previous) { previous = point; return }
    if (point.clientX === (pending ?? previous).clientX && point.clientY === (pending ?? previous).clientY) return
    pending = point
    lastActivity = performance.now()
    if (!raf) {
      lastFrame = lastActivity - 1000 / 60
      raf = requestAnimationFrame(frame)
    }
  }
  const onLeave = () => stop()
  const detachInput = () => {
    if (!listening) return
    container.removeEventListener('pointermove', onMove)
    container.removeEventListener('pointerleave', onLeave)
    listening = false
  }
  const sync = () => {
    if (allowed()) {
      if (listening) return
      container.addEventListener('pointermove', onMove, { passive: true })
      container.addEventListener('pointerleave', onLeave)
      listening = true
    } else {
      detachInput()
      stop()
    }
  }
  const onContextLost = (event: Event) => {
    event.preventDefault()
    cleanup()
  }
  const intersection = new IntersectionObserver((entries) => {
    inView = entries.some((entry) => entry.isIntersecting)
    sync()
  }, { threshold: 0 })
  // Resizing replaces all targets lazily on the next movement, with no old ink.
  const resize = new ResizeObserver(() => stop())
  const cleanup = () => {
    if (disposed) return
    disposed = true
    detachInput()
    stop()
    capability.removeEventListener('change', sync)
    document.removeEventListener('visibilitychange', sync)
    canvas.removeEventListener('webglcontextlost', onContextLost)
    intersection.disconnect()
    resize.disconnect()
  }
  capability.addEventListener('change', sync)
  document.addEventListener('visibilitychange', sync)
  canvas.addEventListener('webglcontextlost', onContextLost)
  intersection.observe(container)
  resize.observe(canvas)
  return cleanup
}
