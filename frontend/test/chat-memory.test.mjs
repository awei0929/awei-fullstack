import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { registerHooks, stripTypeScriptTypes } from 'node:module'
import { fileURLToPath } from 'node:url'
import { afterEach, test } from 'node:test'
registerHooks({
  resolve(specifier, context, next) {
    if (specifier.startsWith('.') && context.parentURL?.includes('/src/')) {
      const path = new URL(`${specifier}.ts`, context.parentURL)
      if (existsSync(path)) return { url: path.href, shortCircuit: true }
    }
    return next(specifier, context)
  },
  load(url, context, next) {
    if (url.endsWith('.ts')) return { format: 'module', source: stripTypeScriptTypes(readFileSync(fileURLToPath(url), 'utf8')), shortCircuit: true }
    return next(url, context)
  },
})
const originalFetch = globalThis.fetch
const id = '11111111-1111-4111-8111-111111111111'
const date = '2026-11-12T00:00:00.000Z'
const memory = (change = {}) => ({ id, content: '偏好简洁中文回答', enabled: true, createdAt: date, updatedAt: date, ...change })
const json = (value, status = 200) => new Response(JSON.stringify(value), { status, headers: { 'Content-Type': 'application/json' } })
const tick = () => new Promise(resolve => setImmediate(resolve))
let activeStore
afterEach(() => { activeStore?.deactivate(); activeStore = null; globalThis.fetch = originalFetch })
async function setup(handler = () => json({ memories: [] })) {
  const { authStore } = await import('../src/store/auth.ts')
  const { runInAction } = await import('mobx')
  runInAction(() => { authStore.user = { id: 'memory-owner', account: '55555' }; authStore.status = 'ready'; authStore.identityVersion++; authStore.csrfToken = 'test-csrf'; authStore.loggingOut = false })
  globalThis.fetch = handler
  const { ChatMemoryStore } = await import('../src/store/chat-memory.ts')
  activeStore = new ChatMemoryStore(); activeStore.activate(); await tick(); await tick()
  return { store: activeStore, authStore, runInAction }
}
test('memory API rejects malformed/duplicate responses and sends only intended fields with CSRF', async () => {
  const api = await import('../src/api/chat-memory.ts')
  globalThis.fetch = async () => json({ memories: [memory(), memory()] })
  await assert.rejects(api.getChatMemories(), /格式/)
  globalThis.fetch = async () => json({ memories: [memory({ enabled: 'yes' })] })
  await assert.rejects(api.getChatMemories(), /格式/)
  globalThis.fetch = async (url, options) => {
    assert.equal(url, `/api/chat/memories/${id}`); assert.equal(options.method, 'PATCH')
    assert.equal(options.headers.get('X-CSRF-Token'), 'token')
    assert.deepEqual(JSON.parse(options.body), { enabled: false })
    return json(memory({ enabled: false }))
  }
  assert.equal((await api.updateChatMemory(id, { enabled: false }, 'token')).enabled, false)
})
test('new memory preserves overlength content until user edits and never silently truncates', async () => {
  const { store } = await setup()
  const value = '记'.repeat(501)
  store.openManager(value)
  assert.equal(store.draft, value); assert.equal(store.canSave, false)
  store.setDraft('😀'.repeat(500)); assert.equal(store.canSave, true)
})
test('save waits for acceptance, rejects duplicate writes, and invalidates an earlier list read', async () => {
  let releaseSave, releaseList; let writes = 0
  const { store } = await setup((_, options = {}) => options.method === 'POST' ? (writes++, new Promise(resolve => { releaseSave = () => resolve(json(memory(), 201)) })) : json({ memories: [] }))
  globalThis.fetch = (_, options = {}) => options.method === 'POST' ? (writes++, new Promise(resolve => { releaseSave = () => resolve(json(memory(), 201)) })) : new Promise(resolve => { releaseList = () => resolve(json({ memories: [] })) })
  const read = store.load(); store.openManager('偏好简洁中文回答')
  const save = store.save(); await tick(); await store.save()
  assert.equal(writes, 1); assert.equal(store.draft, '偏好简洁中文回答')
  releaseSave(); await save; releaseList(); await read
  assert.equal(store.memories.length, 1); assert.equal(store.editorOpen, false)
})
test('failed save preserves editor and content; disabling uses server result without optimism', async () => {
  const { store } = await setup((_, options = {}) => options.method ? json({ message: '暂时无法保存' }, 503) : json({ memories: [memory()] }))
  store.openManager(); store.edit(memory()); store.setDraft('新偏好')
  assert.equal(await store.save(), false); assert.equal(store.draft, '新偏好'); assert.equal(store.editorOpen, true)
  await store.toggle(memory()); assert.equal(store.memories[0].enabled, true); assert.match(store.writeError, /暂时无法保存/)
})
test('deletion requires explicit target confirmation and failure retains record/confirmation', async () => {
  let deletes = 0
  const { store } = await setup((_, options = {}) => options.method === 'DELETE' ? (deletes++, json({ message: '删除失败' }, 500)) : json({ memories: [memory()] }))
  await store.remove(); assert.equal(deletes, 0)
  store.askDelete(id); store.cancelDelete(); await store.remove(); assert.equal(deletes, 0)
  store.askDelete(id); await store.remove(); assert.equal(deletes, 1); assert.equal(store.deleteId, id); assert.equal(store.memories.length, 1)
})
test('old identity write failure cannot erase new identity state or expire its session', async () => {
  let release
  const { store, authStore, runInAction } = await setup((_, options = {}) => options.method === 'POST' ? new Promise(resolve => { release = () => resolve(json({ message: '旧身份过期' }, 401)) }) : json({ memories: [] }))
  store.openManager('旧身份记忆'); const saving = store.save(); await tick()
  runInAction(() => { authStore.identityVersion++; authStore.user = { id: 'new-owner', account: '44444' } })
  assert.equal(store.open, false); assert.equal(store.draft, '')
  release(); await saving
  assert.equal(authStore.user.id, 'new-owner'); assert.equal(store.writeError, ''); assert.equal(store.busy, false)
})
test('current unauthorized clears private memories; CSRF failure keeps editing content', async () => {
  const { store, authStore } = await setup((_, options = {}) => options.method === 'POST' ? json({ message: '安全令牌已更新', code: 'CSRF_INVALID' }, 403) : json({ memories: [memory()] }))
  store.openManager('保留输入'); await store.save(); assert.equal(store.draft, '保留输入'); assert.equal(authStore.csrfToken, '')
  globalThis.fetch = async () => json({ message: '无权访问' }, 403)
  await store.load(); assert.deepEqual(store.memories, []); assert.equal(store.forbidden, true); assert.equal(store.open, false)
})

test('initial slow or failed read blocks saving until existing memories are known', async () => {
  let release
  const { store } = await setup(() => new Promise(resolve => { release = () => resolve(json({ memories: [memory()] })) }))
  store.openManager('本次新增记忆')
  assert.equal(store.canSave, false)
  release(); await tick(); await tick()
  assert.equal(store.canSave, true); assert.equal(store.memories[0].content, '偏好简洁中文回答')
  store.deactivate(); store.activate()
  globalThis.fetch = async () => json({ message: '读取失败' }, 503)
  await store.load()
  store.openManager('保留但不提交'); assert.equal(store.canSave, false)
  globalThis.fetch = async () => json({ memories: [memory()] })
  await store.load(); assert.equal(store.canSave, true)
})

test('refreshing a missing CSRF token expires the current identity if session changed', async () => {
  const { store, authStore, runInAction } = await setup()
  store.openManager('待保存的旧身份内容')
  runInAction(() => { authStore.csrfToken = '' })
  globalThis.fetch = async () => json({ user: null, csrfToken: 'anonymous-csrf' })
  assert.equal(await store.save(), false)
  assert.equal(authStore.user, null)
  assert.equal(store.open, false); assert.equal(store.draft, ''); assert.deepEqual(store.memories, [])
})
