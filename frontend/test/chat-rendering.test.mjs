import assert from 'node:assert/strict'
import { existsSync } from 'node:fs'
import { test } from 'node:test'

async function scrollController() {
  const url = new URL('../src/pages/admin/chat-scroll.ts', import.meta.url)
  assert.ok(existsSync(url), 'stream scrolling must schedule and cancel frame-bound work')
  return (await import(url.href)).createChatScroll
}

function fixture(createChatScroll) {
  let top = 0
  let writes = 0
  let following = true
  let completed = 0
  let nextId = 0
  const frames = new Map()
  const area = { scrollHeight: 1000, get scrollTop() { return top }, set scrollTop(value) { top = value; writes++ } }
  const scroll = createChatScroll({
    area: () => area,
    following: () => following,
    onFollow: () => completed++,
    requestFrame: callback => { frames.set(++nextId, callback); return nextId },
    cancelFrame: id => frames.delete(id),
  })
  return { scroll, area, frames, setFollowing: value => { following = value }, get writes() { return writes }, get completed() { return completed }, frame() { const callbacks = [...frames.values()]; frames.clear(); callbacks.forEach(callback => callback(0)) } }
}

test('rapid stream updates share one frame and scroll to the newest committed height', async () => {
  const f = fixture(await scrollController())
  f.scroll.schedule(); f.scroll.schedule(); f.scroll.schedule()
  assert.equal(f.writes, 0)
  assert.equal(f.frames.size, 1)
  f.area.scrollHeight = 1500
  f.frame()
  assert.equal(f.writes, 1)
  assert.equal(f.area.scrollTop, 1500)
  assert.equal(f.completed, 1)
  f.scroll.schedule(); f.frame()
  assert.equal(f.writes, 2)
})

test('scrolling upward before a pending frame prevents the stream from moving the reader', async () => {
  const f = fixture(await scrollController())
  f.scroll.schedule()
  f.setFollowing(false)
  f.frame()
  assert.equal(f.writes, 0)
  assert.equal(f.completed, 0)
  f.scroll.schedule(); f.frame()
  assert.equal(f.writes, 0)
  f.setFollowing(true)
  f.scroll.schedule(); f.frame()
  assert.equal(f.area.scrollTop, 1000)
})

test('leaving the conversation cancels pending scroll work', async () => {
  const f = fixture(await scrollController())
  f.scroll.schedule()
  f.scroll.cancel()
  assert.equal(f.frames.size, 0)
  f.frame()
  assert.equal(f.writes, 0)
  f.scroll.schedule(); f.frame()
  assert.equal(f.writes, 1)
})

test('browser frame scheduling and cancellation preserve the native Window receiver', async () => {
  const createChatScroll = await scrollController()
  const originalWindow = Object.getOwnPropertyDescriptor(globalThis, 'window')
  const frames = new Map()
  let lastId = 0
  const browser = {
    requestAnimationFrame(callback) {
      if (this !== browser) throw new TypeError('Illegal invocation')
      frames.set(++lastId, callback)
      return lastId
    },
    cancelAnimationFrame(id) {
      if (this !== browser) throw new TypeError('Illegal invocation')
      frames.delete(id)
    },
  }
  Object.defineProperty(globalThis, 'window', { value: browser, configurable: true })
  try {
    const area = { scrollTop: 0, scrollHeight: 800 }
    const scroll = createChatScroll({ area: () => area, following: () => true, onFollow: () => {} })
    scroll.schedule()
    assert.equal(frames.size, 1)
    scroll.cancel()
    assert.equal(frames.size, 0)
    assert.equal(area.scrollTop, 0)
    scroll.schedule()
    const callback = frames.get(lastId)
    frames.clear()
    callback(0)
    assert.equal(area.scrollTop, 800)
  } finally {
    if (originalWindow) Object.defineProperty(globalThis, 'window', originalWindow)
    else delete globalThis.window
  }
})
