import { useCallback, useLayoutEffect, useRef, useState } from 'react'
import type { RefObject } from 'react'

type Scene = 0 | 1
type Options = { rootRef: RefObject<HTMLDivElement>; enabled: boolean; paused: boolean }
type Timeline = {
  goTo: (scene: Scene) => boolean
  reconcile: () => void
  dispose: () => void
}

const DURATION = 850
const EASE = 'cubic-bezier(.4, 0, .2, 1)'

// Delays live inside the keyframes, so returning samples the exact same sequence
// backwards rather than starting a second set of CSS entrance animations.
function segment(from: Keyframe, to: Keyframe, start: number, end: number): Keyframe[] {
  return [
    { ...from, offset: 0 },
    ...(start > 0 ? [{ ...from, offset: start / DURATION, easing: EASE }] : []),
    { ...to, offset: end / DURATION },
    ...(end < DURATION ? [{ ...to, offset: 1 }] : []),
  ].map((frame, index) => index === 0 && start === 0 ? { ...frame, easing: EASE } : frame)
}

export function useCapabilityTransition({ rootRef, enabled, paused }: Options) {
  const [state, setState] = useState<{ scene: Scene; targetScene: Scene; transitioning: boolean }>({ scene: 0, targetScene: 0, transitioning: false })
  const timeline = useRef<Timeline | null>(null)
  // Survives effect recreation (StrictMode/Fast Refresh) alongside React state.
  const settledScene = useRef<Scene>(0)
  const options = useRef({ enabled, paused })
  useLayoutEffect(() => { options.current = { enabled, paused } }, [enabled, paused])

  useLayoutEffect(() => {
    const root = rootRef.current
    if (!root) return
    const initialScene = settledScene.current
    const animations: Animation[] = []
    const add = (role: string, keyframes: Keyframe[] | ((index: number) => Keyframe[])) => {
      root.querySelectorAll<HTMLElement>(`[data-capability-motion="${role}"]`).forEach((element, index) => {
        const animation = element.animate(typeof keyframes === 'function' ? keyframes(index) : keyframes, {
          duration: DURATION, fill: 'both', easing: 'linear',
        })
        animation.pause()
        animation.currentTime = initialScene * DURATION
        animations.push(animation)
      })
    }
    add('welcome', segment({ opacity: 1, transform: 'translateY(0)' }, { opacity: 0, transform: 'translateY(-18px)' }, 0, 180))
    add('discover', segment({ opacity: 1 }, { opacity: 0 }, 0, 180))
    add('wave', segment({ opacity: 1, transform: 'translateY(0) scale(1)' }, { opacity: 0, transform: 'translateY(8px) scale(.985)' }, 0, 850))
    add('portrait', segment({ opacity: 0, transform: 'translateY(8px) scale(1.015)' }, { opacity: 1, transform: 'translateY(0) scale(1)' }, 0, 850))
    add('light', segment({ opacity: 0 }, { opacity: 1 }, 0, 750))
    add('orbit', segment({ opacity: 0, transform: 'rotate(-8deg) scale(.85)' }, { opacity: 1, transform: 'rotate(0deg) scale(1)' }, 80, 750))
    const cardFrames = (index: number) => segment({ opacity: 0, transform: 'translateY(20px) scale(.96)' }, { opacity: 1, transform: 'translateY(0) scale(1)' }, 120 + index * 40, 660 + index * 40)
    add('card', cardFrames)
    add('card-window', cardFrames)
    add('copy', segment({ opacity: 0, transform: 'translateY(18px)' }, { opacity: 1, transform: 'translateY(0)' }, 80, 700))

    let time = initialScene * DURATION
    let target: Scene = initialScene
    let scene: Scene = initialScene
    let moving = false
    let frame = 0
    let previousTime = 0
    let disposed = false
    const apply = () => {
      animations.forEach(animation => { animation.currentTime = time })
    }
    const stop = () => { cancelAnimationFrame(frame); frame = 0 }
    const settle = () => {
      stop()
      time = target * DURATION
      apply()
      scene = target
      settledScene.current = scene
      moving = false
      setState({ scene, targetScene: target, transitioning: false })
    }
    const advance = (now: number) => {
      time = Math.max(0, Math.min(DURATION, time + (now - previousTime) * (target === 1 ? 1 : -1)))
      previousTime = now
      apply()
    }
    const tick = (now: number) => {
      frame = 0
      if (disposed || !moving) return
      if (options.current.paused || document.hidden) return
      advance(now)
      if (time === target * DURATION) settle()
      else frame = requestAnimationFrame(tick)
    }
    const resume = () => {
      if (disposed || !moving || frame || options.current.paused || document.hidden) return
      previousTime = performance.now()
      frame = requestAnimationFrame(tick)
    }
    const reconcile = () => {
      if (!moving || disposed) return
      if (!options.current.enabled) settle()
      else if (options.current.paused || document.hidden) stop()
      else resume()
    }
    const controller: Timeline = {
      goTo(next) {
        if (disposed || options.current.paused || document.hidden || next === (moving ? target : scene)) return false
        // Account for the elapsed frame in the old direction before reversing
        // this clock; the existing RAF and animation collection keep running.
        if (moving) advance(performance.now())
        target = next
        moving = true
        if (!options.current.enabled || time === target * DURATION) settle()
        else {
          setState({ scene, targetScene: target, transitioning: true })
          resume()
        }
        return true
      },
      reconcile,
      dispose() {
        disposed = true
        stop()
        animations.forEach(animation => animation.cancel())
      },
    }
    // A recreated effect abandons an interrupted transition at the last settled
    // scene, keeping controls, inert content and the fresh animations in sync.
    setState(current => current.scene === initialScene && current.targetScene === initialScene && !current.transitioning
      ? current : { scene: initialScene, targetScene: initialScene, transitioning: false })
    timeline.current = controller
    document.addEventListener('visibilitychange', reconcile)
    return () => {
      controller.dispose()
      document.removeEventListener('visibilitychange', reconcile)
      timeline.current = null
    }
  }, [rootRef])

  useLayoutEffect(() => { timeline.current?.reconcile() }, [enabled, paused])
  const goTo = useCallback((scene: Scene) => timeline.current?.goTo(scene) ?? false, [])
  return { ...state, goTo }
}
