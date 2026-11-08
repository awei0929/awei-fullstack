import { useEffect } from 'react'
import type { RefObject } from 'react'

type SceneMotionOptions = {
  rootRef: RefObject<HTMLDivElement>
  enabled: boolean
  paused: boolean
}

// The ambient light only requests a frame after pointer input; idle scenes have no JS loop.
export function useSceneMotion({ rootRef, enabled, paused }: SceneMotionOptions) {
  useEffect(() => {
    const root = rootRef.current
    if (!root) return

    const desktop = window.matchMedia('(min-width: 768px)')
    let frame = 0
    let pointer = { x: 0, y: 0 }

    const update = () => {
      frame = 0
      if (document.hidden) return
      if (enabled && !paused && desktop.matches) {
        root.style.setProperty('--light-drift-x', `${pointer.x * 30}px`)
        root.style.setProperty('--light-drift-y', `${pointer.y * 18}px`)
      } else {
        root.style.removeProperty('--light-drift-x')
        root.style.removeProperty('--light-drift-y')
      }
    }
    const schedule = () => {
      if (!frame && !document.hidden) frame = requestAnimationFrame(update)
    }
    const onPointerMove = (event: PointerEvent) => {
      if (!enabled || paused || !desktop.matches || event.pointerType !== 'mouse') return
      pointer = { x: event.clientX / window.innerWidth * 2 - 1, y: event.clientY / window.innerHeight * 2 - 1 }
      schedule()
    }
    const onPointerLeave = () => { pointer = { x: 0, y: 0 }; schedule() }
    const onVisibility = () => {
      root.dataset.motionPaused = String(document.hidden || paused)
      root.dataset.pageHidden = String(document.hidden)
      if (document.hidden) { cancelAnimationFrame(frame); frame = 0 }
      else schedule()
    }

    root.dataset.motionPaused = String(document.hidden || paused)
    root.dataset.pageHidden = String(document.hidden)
    update()
    root.addEventListener('pointermove', onPointerMove, { passive: true })
    root.addEventListener('pointerleave', onPointerLeave, { passive: true })
    document.addEventListener('visibilitychange', onVisibility)
    desktop.addEventListener('change', schedule)

    return () => {
      cancelAnimationFrame(frame)
      root.removeEventListener('pointermove', onPointerMove)
      root.removeEventListener('pointerleave', onPointerLeave)
      document.removeEventListener('visibilitychange', onVisibility)
      desktop.removeEventListener('change', schedule)
      root.style.removeProperty('--light-drift-x')
      root.style.removeProperty('--light-drift-y')
      delete root.dataset.motionPaused
      delete root.dataset.pageHidden
    }
  }, [rootRef, enabled, paused])
}
