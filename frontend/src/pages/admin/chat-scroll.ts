interface ChatScrollOptions {
  area: () => { scrollTop: number; scrollHeight: number } | null
  following: () => boolean
  onFollow: () => void
  requestFrame?: (callback: FrameRequestCallback) => number
  cancelFrame?: (id: number) => void
}

/** 合并同帧增量/尺寸变化；执行时再次检查阅读位置，避免抢回已上翻的用户。 */
export function createChatScroll(options: ChatScrollOptions) {
  // Window 原生方法不能作为 options 的方法调用；在边界保留正确接收者。
  const requestFrame = options.requestFrame ?? ((callback: FrameRequestCallback) => window.requestAnimationFrame(callback))
  const cancelFrame = options.cancelFrame ?? ((id: number) => window.cancelAnimationFrame(id))
  let frame: number | null = null
  return {
    schedule() {
      if (frame !== null) return
      frame = requestFrame(() => {
        frame = null
        const area = options.area()
        if (!area || !options.following()) return
        area.scrollTop = area.scrollHeight
        options.onFollow()
      })
    },
    cancel() {
      if (frame !== null) cancelFrame(frame)
      frame = null
    },
  }
}
