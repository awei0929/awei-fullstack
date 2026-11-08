import { useLayoutEffect } from 'react'
import type { RefObject } from 'react'

const SVG_NS = 'http://www.w3.org/2000/svg'
const TRANSITION_LIMIT = 250

// Align the person silhouette and visible card windows in the local light SVG.
// The shared timeline animates each containing group with its HTML counterpart.
export function useOrbitOcclusion(rootRef: RefObject<HTMLDivElement>, motionEnabled: boolean): void {
  useLayoutEffect(() => {
    const root = rootRef.current
    const cards = root?.querySelector<HTMLElement>('[data-capability-cards]')
    const overlay = root?.querySelector<SVGSVGElement>('[data-orbit-overlay]')
    if (!root || !cards || !overlay) return
    const person = root.querySelector<HTMLElement>('[data-capability-portrait]')
    const personCutout = root.querySelector<SVGGElement>('[data-orbit-person-cutout]')
    const personMask = root.querySelector<SVGImageElement>('[data-orbit-person-mask]')
    const groups = Array.from(root.querySelectorAll<SVGGElement>('[data-capability-motion="card-window"]'))
    if (!groups.length) return

    let disposed = false
    let frame = 0
    let transitionDeadline = 0
    const transitioning = new Set<Element>()
    const observed = new Set<Element>()
    let panels = new Set<Element>()
    const resizeObserver = new ResizeObserver(() => sync())

    function sync() {
      if (disposed) return
      const stageBounds = root!.getBoundingClientRect()
      const stageScaleX = stageBounds.width / root!.clientWidth
      const stageScaleY = stageBounds.height / root!.clientHeight
      if (!(stageScaleX > 0) || !(stageScaleY > 0)) return
      const overlayBounds = overlay!.getBoundingClientRect()
      const overlayOriginX = (overlayBounds.left - stageBounds.left) / stageScaleX
      const overlayOriginY = (overlayBounds.top - stageBounds.top) / stageScaleY
      const wrappers = Array.from(root!.querySelectorAll<HTMLElement>('[data-capability-motion="card"]'))
      const nextObserved = new Set<Element>([root!, overlay!])
      if (person) nextObserved.add(person)
      if (person && personCutout && personMask) {
        const bounds = person.getBoundingClientRect()
        const computed = getComputedStyle(person)
        const matrix = new DOMMatrixReadOnly(computed.transform === 'none' ? undefined : computed.transform)
        const origin = computed.transformOrigin.split(/\s+/).map(Number.parseFloat)
        const originX = Number.isFinite(origin[0]) ? origin[0] : person.offsetWidth / 2
        const originY = Number.isFinite(origin[1]) ? origin[1] : person.offsetHeight / 2
        const baseLeft = (bounds.left - stageBounds.left) / stageScaleX - matrix.e - originX * (1 - matrix.a)
        const baseTop = (bounds.top - stageBounds.top) / stageScaleY - matrix.f - originY * (1 - matrix.d)
        personMask.setAttribute('x', String(baseLeft - overlayOriginX))
        personMask.setAttribute('y', String(baseTop - overlayOriginY))
        personMask.setAttribute('width', String(person.offsetWidth))
        personMask.setAttribute('height', String(person.offsetHeight))
        personCutout.style.transformOrigin = `${baseLeft + originX - overlayOriginX}px ${baseTop + originY - overlayOriginY}px`
        const image = person.querySelector('img')
        const objectPosition = image ? getComputedStyle(image).objectPosition : 'center bottom'
        const verticalPosition = objectPosition.trim().split(/\s+/)[1]
        const alignedTop = objectPosition.includes('top') || verticalPosition === '0%' || verticalPosition === '0px'
        personMask.setAttribute('preserveAspectRatio', alignedTop ? 'xMidYMin' : 'xMidYMax')
      }
      panels = new Set()

      groups.forEach((group, index) => {
        const wrapper = wrappers[index]
        if (!wrapper) { group.replaceChildren(); return }
        nextObserved.add(wrapper)
        const panel = wrapper.firstElementChild
        const details = Array.from(wrapper.children).filter(element => element.tagName === 'P')
        const surfaces = [panel, ...details.filter(element => !element.hasAttribute('hidden'))]
          .filter((element): element is HTMLElement => element instanceof HTMLElement)
        if (panel) panels.add(panel)
        if (panel) nextObserved.add(panel)
        details.forEach(detail => nextObserved.add(detail))

        const wrapperBounds = wrapper.getBoundingClientRect()
        const transform = getComputedStyle(wrapper).transform
        const matrix = new DOMMatrixReadOnly(transform === 'none' ? undefined : transform)
        const scaleX = matrix.a
        const scaleY = matrix.d
        const width = wrapper.offsetWidth
        const height = wrapper.offsetHeight
        if (!(scaleX > 0) || !(scaleY > 0)) { group.replaceChildren(); return }
        const originOffsetX = width * (1 - scaleX) / 2
        const originOffsetY = height * (1 - scaleY) / 2
        const baseLeft = (wrapperBounds.left - stageBounds.left) / stageScaleX - matrix.e - originOffsetX
        const baseTop = (wrapperBounds.top - stageBounds.top) / stageScaleY - matrix.f - originOffsetY
        group.style.transformOrigin = `${baseLeft + width / 2 - overlayOriginX}px ${baseTop + height / 2 - overlayOriginY}px`

        let count = 0
        surfaces.forEach(surface => {
          const bounds = surface.getBoundingClientRect()
          const surfaceWidth = bounds.width / stageScaleX / scaleX
          const surfaceHeight = bounds.height / stageScaleY / scaleY
          if (!(surfaceWidth > 0) || !(surfaceHeight > 0)) return
          const x = baseLeft + ((bounds.left - stageBounds.left) / stageScaleX - baseLeft - matrix.e - originOffsetX) / scaleX
          const y = baseTop + ((bounds.top - stageBounds.top) / stageScaleY - baseTop - matrix.f - originOffsetY) / scaleY
          const radius = Number.parseFloat(getComputedStyle(surface).borderRadius) || 0
          const radiusX = surface.offsetWidth > 0 ? radius * surfaceWidth / surface.offsetWidth : 0
          const radiusY = surface.offsetHeight > 0 ? radius * surfaceHeight / surface.offsetHeight : 0
          let rectangle = group.children[count] as SVGRectElement | undefined
          if (!rectangle) {
            rectangle = document.createElementNS(SVG_NS, 'rect')
            rectangle.setAttribute('fill', 'white')
            group.appendChild(rectangle)
          }
          rectangle.setAttribute('x', String(x - overlayOriginX))
          rectangle.setAttribute('y', String(y - overlayOriginY))
          rectangle.setAttribute('width', String(surfaceWidth))
          rectangle.setAttribute('height', String(surfaceHeight))
          rectangle.setAttribute('rx', String(radiusX))
          rectangle.setAttribute('ry', String(radiusY))
          count += 1
        })
        while (group.children.length > count) group.children[group.children.length - 1].remove()
      })

      observed.forEach(element => {
        if (!nextObserved.has(element)) { resizeObserver.unobserve(element); observed.delete(element) }
      })
      nextObserved.forEach(element => {
        if (!observed.has(element)) { observed.add(element); resizeObserver.observe(element) }
      })
    }

    function stopMeasuring() {
      cancelAnimationFrame(frame)
      frame = 0
    }
    function measureTransition(now: number) {
      frame = 0
      if (disposed) return
      sync()
      if (transitioning.size && now < transitionDeadline) frame = requestAnimationFrame(measureTransition)
      else transitioning.clear()
    }
    function onTransitionRun(event: TransitionEvent) {
      if (event.propertyName !== 'transform' || !(event.target instanceof Element) || !panels.has(event.target)) return
      sync()
      if (!motionEnabled) return
      transitioning.add(event.target)
      transitionDeadline = performance.now() + TRANSITION_LIMIT
      if (!frame) frame = requestAnimationFrame(measureTransition)
    }
    function onTransitionStop(event: TransitionEvent) {
      if (event.propertyName !== 'transform' || !(event.target instanceof Element) || !panels.has(event.target)) return
      transitioning.delete(event.target)
      sync()
      if (!transitioning.size) stopMeasuring()
    }

    // Only watch the HTML cards: observing our SVG writes would feed sync back
    // into itself. ResizeObserver also catches content wrapping and font changes.
    const mutationObserver = new MutationObserver(() => sync())
    mutationObserver.observe(cards, { childList: true, subtree: true, attributes: true, attributeFilter: ['hidden', 'data-expanded'] })
    root.addEventListener('transitionrun', onTransitionRun)
    root.addEventListener('transitionend', onTransitionStop)
    root.addEventListener('transitioncancel', onTransitionStop)
    sync()

    return () => {
      disposed = true
      stopMeasuring()
      transitioning.clear()
      resizeObserver.disconnect()
      mutationObserver.disconnect()
      root.removeEventListener('transitionrun', onTransitionRun)
      root.removeEventListener('transitionend', onTransitionStop)
      root.removeEventListener('transitioncancel', onTransitionStop)
      groups.forEach(group => group.replaceChildren())
    }
  }, [rootRef, motionEnabled])
}
