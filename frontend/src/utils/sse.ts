interface SseEvent { event: string; data: string }

// Bound both unfinished lines and accumulated multiline events.
const MAX_EVENT_SIZE = 256 * 1024

export async function* readSseEvents(body: ReadableStream<Uint8Array>): AsyncGenerator<SseEvent> {
  const reader = body.getReader()
  const decoder = new TextDecoder('utf-8', { fatal: true })
  let buffer = ''
  let event = ''
  let data: string[] = []
  let size = 0
  try {
    while (true) {
      const chunk = await reader.read()
      buffer += decoder.decode(chunk.value, { stream: !chunk.done })
      let index: number
      while ((index = buffer.search(/[\r\n]/)) >= 0) {
        if (buffer[index] === '\r' && index === buffer.length - 1 && !chunk.done) break
        const line = buffer.slice(0, index)
        buffer = buffer.slice(index + (buffer[index] === '\r' && buffer[index + 1] === '\n' ? 2 : 1))
        size += line.length + 1
        if (size > MAX_EVENT_SIZE) throw new Error('流事件过大，已停止读取')
        if (!line) {
          if (data.length) yield { event: event || 'message', data: data.join('\n') }
          event = ''; data = []; size = 0
        } else if (!line.startsWith(':')) {
          const colon = line.indexOf(':')
          const field = colon < 0 ? line : line.slice(0, colon)
          const value = colon < 0 ? '' : line.slice(colon + 1).replace(/^ /, '')
          if (field === 'event') event = value
          else if (field === 'data') data.push(value)
        }
      }
      if (size + buffer.length > MAX_EVENT_SIZE) throw new Error('流事件过大，已停止读取')
      if (chunk.done) break
    }
    // An event without its terminating blank line is deliberately not dispatched.
  } finally {
    await reader.cancel().catch(() => {})
    reader.releaseLock()
  }
}
