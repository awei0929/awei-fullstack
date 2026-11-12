import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { registerHooks, stripTypeScriptTypes } from 'node:module'
import { fileURLToPath } from 'node:url'
import { afterEach, test } from 'node:test'

// Use Node's bundled TypeScript erasure; no test framework or runtime dependency.
registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier.startsWith('.') && context.parentURL?.includes('/src/')) {
      const candidate = new URL(`${specifier}.ts`, context.parentURL)
      if (existsSync(candidate)) return { url: candidate.href, shortCircuit: true }
    }
    return nextResolve(specifier, context)
  },
  load(url, context, nextLoad) {
    if (url.endsWith('.ts')) return { format: 'module', source: stripTypeScriptTypes(readFileSync(fileURLToPath(url), 'utf8')), shortCircuit: true }
    return nextLoad(url, context)
  },
})

const originalFetch = globalThis.fetch
const cid = '11111111-1111-4111-8111-111111111111'
const otherCid = '22222222-2222-4222-8222-222222222222'
const rid = '33333333-3333-4333-8333-333333333333'
const date = '2026-11-12T00:00:00.000Z'
const conversation = (id = cid) => ({ id, title: '对话', createdAt: date, updatedAt: date })
const turn = (overrides = {}) => ({ requestId: rid, content: '你好', answer: '', modelId: 'glm-4.7-flash', modelLabel: 'GLM-4.7-Flash', status: 'streaming', error: null, createdAt: date, updatedAt: date, ...overrides })
const fallbackTurn = (overrides = {}) => turn({ requestedModelId: 'glm-4.7-flash', requestedModelLabel: 'GLM-4.7-Flash', modelId: 'glm-4-flash-250414', modelLabel: 'GLM-4-Flash-250414', ...overrides })
const modelCatalog = () => ({ models: [{ id: 'glm-4.7-flash', label: 'GLM-4.7-Flash', available: true, fallbackModelId: 'glm-4-flash-250414' }, { id: 'glm-4-flash-250414', label: 'GLM-4-Flash-250414', available: true }], defaultModelId: 'glm-4.7-flash' })
const event = (type, data) => `event: ${type}\r\ndata: ${JSON.stringify({ type, ...data })}\r\n\r\n`
const json = (data, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } })
const stream = (text) => new ReadableStream({ start(controller) { for (const byte of new TextEncoder().encode(text)) controller.enqueue(Uint8Array.of(byte)); controller.close() } })
let activeStore
afterEach(() => { activeStore?.deactivate(); activeStore = null; globalThis.fetch = originalFetch })

test('SSE decodes split Chinese bytes, CRLF, comments and multiline data', async () => {
  const { readSseEvents } = await import('../src/utils/sse.ts')
  const found = []
  for await (const item of readSseEvents(stream(': 心跳\r\n\r\nevent: delta\r\ndata: {"text":\r\ndata: "你好"}\r\n\r\n'))) found.push(item)
  assert.deepEqual(found, [{ event: 'delta', data: '{"text":\n"你好"}' }])
})

test('SSE bounds a never-terminated event', async () => {
  const { readSseEvents } = await import('../src/utils/sse.ts')
  const body = new ReadableStream({ start(controller) { controller.enqueue(new TextEncoder().encode(`data: ${'x'.repeat(262145)}`)); controller.close() } })
  await assert.rejects(async () => { for await (const item of readSseEvents(body)) void item }, /过大/)
})

test('chat stream requires validated business done, not EOF or DONE', async () => {
  const { consumeChatStream } = await import('../src/api/chat.ts')
  const start = event('start', { conversationId: cid, turn: turn() })
  await assert.rejects(consumeChatStream(stream(start + event('delta', { requestId: rid, text: '部分' })), () => {}, cid, rid), /中断/)
  await assert.rejects(consumeChatStream(stream(start + 'data: [DONE]\n\n'), () => {}, cid, rid))
  const events = []
  await consumeChatStream(stream(start + event('delta', { requestId: rid, text: '你好' }) + event('done', { conversationId: cid, turn: turn({ status: 'completed', answer: '你好' }) })), value => events.push(value), cid, rid)
  assert.equal(events.at(-1).turn.status, 'completed')
  assert.equal(events[1].text, '你好')
})

test('chat stream rejects wrong IDs, mismatched event types and nonterminal done', async () => {
  const { consumeChatStream } = await import('../src/api/chat.ts')
  for (const text of [
    event('start', { conversationId: otherCid, turn: turn() }),
    event('start', { conversationId: cid, turn: turn() }) + event('delta', { requestId: otherCid, text: '错误请求' }),
    event('start', { conversationId: cid, turn: turn() }) + event('done', { conversationId: cid, turn: turn() }),
    'event: delta\ndata: {"type":"start"}\n\n',
  ]) await assert.rejects(consumeChatStream(stream(text), () => {}, cid, rid))
})

test('API keeps standard errors and only sends allowed stream fields', async () => {
  const { startChatStream } = await import('../src/api/chat.ts')
  const { HttpError } = await import('../src/api/http.ts')
  globalThis.fetch = async (url, options) => {
    assert.equal(url, `/api/chat/conversations/${cid}/stream`)
    assert.equal(options.headers.get('X-CSRF-Token'), 'token')
    assert.equal(options.credentials, 'same-origin')
    assert.deepEqual(JSON.parse(options.body), { requestId: rid, content: '你好', modelId: 'glm-4.7-flash' })
    return json({ message: '模型尚未配置', code: 'MODEL_UNAVAILABLE' }, 503)
  }
  await assert.rejects(startChatStream(cid, { requestId: rid, content: '你好', modelId: 'glm-4.7-flash' }, 'token', new AbortController().signal, () => {}), error => error instanceof HttpError && error.status === 503)
})

test('turn parsing normalizes old history and preserves requested and actual models independently', async () => {
  const { parseChatTurn } = await import('../src/api/chat.ts')
  const old = parseChatTurn(turn({ status: 'completed', answer: '旧回复' }))
  assert.equal(old.requestedModelId, 'glm-4.7-flash')
  assert.equal(old.requestedModelLabel, 'GLM-4.7-Flash')
  const switched = parseChatTurn(fallbackTurn({ status: 'completed', answer: '备用回复' }))
  assert.equal(switched.requestedModelId, 'glm-4.7-flash')
  assert.equal(switched.requestedModelLabel, 'GLM-4.7-Flash')
  assert.equal(switched.modelId, 'glm-4-flash-250414')
})

test('turn parsing rejects incomplete or malformed requested model metadata', async () => {
  const { parseChatTurn } = await import('../src/api/chat.ts')
  for (const fields of [
    { requestedModelId: 'glm-4.7-flash' },
    { requestedModelLabel: 'GLM-4.7-Flash' },
    { requestedModelId: '', requestedModelLabel: 'GLM-4.7-Flash' },
    { requestedModelId: 'glm-4.7-flash', requestedModelLabel: 42 },
  ]) assert.throws(() => parseChatTurn(turn(fields)), /格式/)
})

test('model catalog supports both built-ins plus ten extras and validates fallback references', async () => {
  const { getChatModels } = await import('../src/api/chat.ts')
  const catalog = modelCatalog()
  for (let index = 0; index < 10; index++) catalog.models.push({ id: `extra-${index}`, label: `模型 ${index}`, available: false })
  globalThis.fetch = async () => json(catalog)
  const parsed = await getChatModels()
  assert.equal(parsed.models.length, 12)
  assert.equal(parsed.models[0].fallbackModelId, 'glm-4-flash-250414')
  assert.equal(parsed.models[1].fallbackModelId, undefined)
  globalThis.fetch = async () => json({ ...catalog, models: [...catalog.models, { id: 'extra-10', label: '过多', available: true }] })
  await assert.rejects(getChatModels(), /格式/)
  for (const fallbackModelId of ['', null, 'missing', 'glm-4.7-flash']) {
    const invalid = modelCatalog(); invalid.models[0].fallbackModelId = fallbackModelId
    globalThis.fetch = async () => json(invalid)
    await assert.rejects(getChatModels(), /格式/)
  }
})

test('fallback updates the same streaming turn then allows deltas and a business terminal event', async () => {
  const { consumeChatStream } = await import('../src/api/chat.ts')
  const events = []
  const body = event('start', { conversationId: cid, turn: turn() })
    + event('fallback', { conversationId: cid, turn: fallbackTurn() })
    + event('delta', { requestId: rid, text: '备用回复' })
    + event('done', { conversationId: cid, turn: fallbackTurn({ status: 'completed', answer: '备用回复' }) })
  await consumeChatStream(stream(body), value => events.push(value), cid, rid)
  assert.deepEqual(events.map(value => value.type), ['start', 'fallback', 'delta', 'done'])
  assert.equal(events[1].turn.requestedModelId, 'glm-4.7-flash')
  assert.equal(events[1].turn.modelId, 'glm-4-flash-250414')
  assert.equal(events[1].turn.status, 'streaming')
  assert.equal(events[3].turn.answer, '备用回复')
})

test('fallback is not a terminal event and EOF still requires reconciliation', async () => {
  const { consumeChatStream } = await import('../src/api/chat.ts')
  const events = []
  const body = event('start', { conversationId: cid, turn: turn() }) + event('fallback', { conversationId: cid, turn: fallbackTurn() })
  await assert.rejects(consumeChatStream(stream(body), value => events.push(value), cid, rid), /中断/)
  assert.deepEqual(events.map(value => value.type), ['start', 'fallback'])
})

test('fallback rejects wrong order, duplicates, partial output and inconsistent turn identity', async () => {
  const { consumeChatStream } = await import('../src/api/chat.ts')
  const start = event('start', { conversationId: cid, turn: turn() })
  const fallback = event('fallback', { conversationId: cid, turn: fallbackTurn() })
  const cases = [
    fallback,
    start + fallback + fallback,
    start + event('delta', { requestId: rid, text: '部分' }) + fallback,
    event('start', { conversationId: cid, turn: turn({ answer: '已保存部分' }) }) + fallback,
    event('start', { conversationId: cid, turn: turn({ status: 'completed' }) }) + fallback,
    start + event('fallback', { conversationId: otherCid, turn: fallbackTurn() }),
    start + event('fallback', { conversationId: cid, turn: fallbackTurn({ requestId: otherCid }) }),
    ...[
      { status: 'completed' }, { answer: '混合正文' }, { error: '错误' },
      { requestedModelId: 'other' }, { requestedModelLabel: '其他模型' },
      { modelId: 'glm-4.7-flash' }, { content: '其他输入' }, { createdAt: '2026-11-13T00:00:00.000Z' },
    ].map(fields => start + event('fallback', { conversationId: cid, turn: fallbackTurn(fields) })),
  ]
  for (const body of cases) await assert.rejects(consumeChatStream(stream(body), () => {}, cid, rid), /格式/)
})

const tick = () => new Promise(resolve => setTimeout(resolve, 0))
async function setup(overrides = {}) {
  activeStore?.deactivate()
  const { authStore } = await import('../src/store/auth.ts')
  const { runInAction } = await import('mobx')
  runInAction(() => { authStore.user = { id: 'owner', account: '12345' }; authStore.status = 'ready'; authStore.csrfToken = 'token'; authStore.loggingOut = false; authStore.identityVersion += 1 })
  const handlers = { models: () => json({ models: [{ id: 'glm-4.7-flash', label: 'GLM-4.7-Flash', available: true }], defaultModelId: 'glm-4.7-flash' }), list: () => json({ conversations: [conversation(), conversation(otherCid)] }), detail: id => json({ conversation: conversation(id), turns: [] }), ...overrides }
  globalThis.fetch = async (url, options = {}) => {
    if (url.endsWith('/models')) return handlers.models()
    if (url.endsWith('/stream')) return handlers.send(url, options)
    if (url.endsWith('/cancel')) return handlers.cancel(url, options)
    if (url === '/api/chat/conversations') return options.method === 'POST' ? json(conversation(), 201) : handlers.list()
    return handlers.detail(url.split('/').at(-1))
  }
  const { ChatStore } = await import('../src/store/chat.ts')
  activeStore = new ChatStore()
  activeStore.activate()
  await tick(); await tick()
  await activeStore.selectConversation(cid)
  return { store: activeStore, authStore, runInAction }
}

test('unavailable models disable sending; rejected requests retain input', async () => {
  const { store } = await setup({ send: () => json({ message: '尚未配置' }, 503) })
  store.setDraft('你好')
  await store.send()
  assert.equal(store.draft, '你好')
  assert.equal(store.turns.length, 0)
  assert.match(store.sendError, /尚未配置/)
  store.setModel('not-on-the-list')
  assert.equal(store.selectedModelId, 'glm-4.7-flash')
  await setup({ models: () => json({ models: [{ id: 'glm-4.7-flash', label: 'GLM', available: false }], defaultModelId: 'glm-4.7-flash' }) })
  activeStore.setDraft('你好')
  assert.equal(activeStore.canSend, false)
})

test('send is locked before acceptance and input clears only after start', async () => {
  let controller; let requestId; let sends = 0
  const { store } = await setup({ send: (_, options) => { sends++; requestId = JSON.parse(options.body).requestId; return new Response(new ReadableStream({ start(value) { controller = value } }), { headers: { 'Content-Type': 'text/event-stream' } }) } })
  store.setDraft('你好')
  const sent = store.send(); await tick()
  assert.equal(store.draft, '你好')
  await store.send(); assert.equal(sends, 1)
  controller.enqueue(new TextEncoder().encode(event('start', { conversationId: cid, turn: turn({ requestId }) })))
  await tick(); assert.equal(store.draft, '')
  controller.enqueue(new TextEncoder().encode(event('done', { conversationId: cid, turn: turn({ requestId, status: 'completed', answer: '回复' }) })))
  controller.close(); await sent
  assert.equal(store.turns[0].answer, '回复')
  assert.equal(store.busy, false)
})

test('switching conversation aborts and ignores old stream events', async () => {
  let controller; let requestId; let signal
  const { store } = await setup({ send: (_, options) => { requestId = JSON.parse(options.body).requestId; signal = options.signal; return new Response(new ReadableStream({ start(value) { controller = value } }), { headers: { 'Content-Type': 'text/event-stream' } }) }, cancel: () => json(turn({ requestId, status: 'canceled' })) })
  store.setDraft('你好'); const sent = store.send(); await tick()
  controller.enqueue(new TextEncoder().encode(event('start', { conversationId: cid, turn: turn({ requestId }) }))); await tick()
  await store.selectConversation(otherCid)
  assert.equal(signal.aborted, true)
  controller.enqueue(new TextEncoder().encode(event('done', { conversationId: cid, turn: turn({ requestId, status: 'completed', answer: '旧回复' }) }))); controller.close(); await sent
  assert.equal(store.selectedConversationId, otherCid)
  assert.deepEqual(store.turns, [])
})

test('cancel result wins over a late completed event', async () => {
  let controller; let requestId; let finishCancel
  const { store } = await setup({ send: (_, options) => { requestId = JSON.parse(options.body).requestId; return new Response(new ReadableStream({ start(value) { controller = value } }), { headers: { 'Content-Type': 'text/event-stream' } }) }, cancel: () => new Promise(resolve => { finishCancel = () => resolve(json(turn({ requestId, status: 'canceled', answer: '部分' }))) }) })
  store.setDraft('你好'); const sent = store.send(); await tick()
  controller.enqueue(new TextEncoder().encode(event('start', { conversationId: cid, turn: turn({ requestId }) }))); await tick()
  const stopped = store.stop(); await tick()
  controller.enqueue(new TextEncoder().encode(event('done', { conversationId: cid, turn: turn({ requestId, status: 'completed', answer: '迟到' }) }))); controller.close(); await sent
  finishCancel(); await stopped
  assert.equal(store.turns[0].status, 'canceled')
  assert.equal(store.turns[0].answer, '部分')
})

test('unexpected EOF preserves partial answer and queries saved result', async () => {
  let requestId; let reads = 0
  const { store } = await setup({ detail: id => { reads++; return json({ conversation: conversation(id), turns: requestId ? [turn({ requestId, status: 'interrupted', answer: '部分', error: '连接中断' })] : [] }) }, send: (_, options) => { requestId = JSON.parse(options.body).requestId; return new Response(stream(event('start', { conversationId: cid, turn: turn({ requestId }) }) + event('delta', { requestId, text: '部分' })), { headers: { 'Content-Type': 'text/event-stream' } }) } })
  store.setDraft('你好'); const before = reads; await store.send()
  assert.ok(reads > before)
  assert.equal(store.turns[0].status, 'interrupted')
  assert.equal(store.turns[0].answer, '部分')
  assert.equal(store.busy, false)
})

test('identity change clears content, cancels reading and ignores stale unauthorized result', async () => {
  let release; let signal
  const { store, authStore, runInAction } = await setup({ send: (_, options) => { signal = options.signal; return new Promise(resolve => { release = () => resolve(json({ message: '过期' }, 401)) }) } })
  store.setDraft('私密输入'); const sent = store.send(); await tick()
  runInAction(() => { authStore.user = { id: 'new-owner', account: '23456' }; authStore.identityVersion += 1 })
  assert.equal(signal.aborted, true)
  assert.equal(store.draft, '')
  release(); await sent
  assert.equal(authStore.user.id, 'new-owner')
  assert.deepEqual(store.turns, [])
})

test('current 401 expires identity, owner 403 clears history, CSRF 403 preserves input', async () => {
  const { store, authStore } = await setup({ send: () => json({ message: '安全校验已更新', code: 'CSRF_INVALID' }, 403) })
  store.setDraft('你好'); await store.send()
  assert.equal(store.draft, '你好')
  assert.equal(authStore.csrfToken, '')
  assert.equal(store.forbidden, false)
  await setup({ send: () => json({ message: '没有站主权限' }, 403) })
  activeStore.setDraft('你好'); await activeStore.send()
  assert.equal(activeStore.forbidden, true)
  assert.deepEqual(activeStore.conversations, [])
  await setup({ send: () => json({ message: '登录过期' }, 401) })
  activeStore.setDraft('你好'); await activeStore.send()
  assert.equal(authStore.user, null)
  assert.equal(activeStore.draft, '')
})

test('a loaded streaming turn blocks new generation and can be stopped', async () => {
  const { store } = await setup({ detail: id => json({ conversation: conversation(id), turns: [turn()] }), cancel: () => json(turn({ status: 'canceled', answer: '部分' })) })
  store.setDraft('下一轮')
  assert.equal(store.canSend, false)
  await store.stop()
  assert.equal(store.turns[0].status, 'canceled')
  assert.equal(store.canSend, true)
})

test('stopping before request acceptance prevents a delayed create from sending', async () => {
  let releaseCreate; let sendCalls = 0
  const { store } = await setup({ list: () => json({ conversations: [] }), send: () => { sendCalls++; return json({}, 503) } })
  // Start a genuinely empty view and delay its initial conversation creation.
  store.deactivate(); const oldFetch = globalThis.fetch
  globalThis.fetch = (url, options = {}) => url === '/api/chat/conversations' && options.method === 'POST' ? new Promise(resolve => { releaseCreate = () => resolve(json(conversation(), 201)) }) : oldFetch(url, options)
  const { ChatStore } = await import('../src/store/chat.ts')
  activeStore = new ChatStore(); activeStore.activate(); await tick(); await tick()
  activeStore.setDraft('你好'); const sent = activeStore.send(); await tick()
  await activeStore.stop(); releaseCreate(); await sent
  assert.equal(sendCalls, 0)
  assert.equal(activeStore.draft, '你好')
  assert.equal(activeStore.busy, false)
})

test('newer conversation reads win and failed done retains partial answer for editing', async () => {
  let releaseRead; let requestId
  const { store } = await setup({ send: (_, options) => { requestId = JSON.parse(options.body).requestId; return new Response(stream(event('start', { conversationId: otherCid, turn: turn({ requestId }) }) + event('done', { conversationId: otherCid, turn: turn({ requestId, status: 'failed', answer: '部分结果', error: '上游暂时不可用' }) })), { headers: { 'Content-Type': 'text/event-stream' } }) } })
  const oldFetch = globalThis.fetch
  globalThis.fetch = (url, options) => url === `/api/chat/conversations/${cid}` ? new Promise(resolve => { releaseRead = () => resolve(json({ conversation: conversation(cid), turns: [turn({ status: 'completed', answer: '旧记录' })] })) }) : oldFetch(url, options)
  const old = store.selectConversation(cid)
  await store.selectConversation(otherCid); releaseRead(); await old
  assert.equal(store.selectedConversationId, otherCid)
  assert.deepEqual(store.turns, [])
  store.setDraft('你好'); await store.send()
  assert.equal(store.turns[0].status, 'failed')
  assert.equal(store.turns[0].answer, '部分结果')
  store.editTurn(store.turns[0]); assert.equal(store.draft, '你好')
})

test('store keeps fallback busy, appends output to one turn and retains the original selection', async () => {
  let controller; let requestId
  const { store } = await setup({ models: () => json(modelCatalog()), send: (_, options) => {
    requestId = JSON.parse(options.body).requestId
    return new Response(new ReadableStream({ start(value) { controller = value } }), { headers: { 'Content-Type': 'text/event-stream' } })
  } })
  store.setDraft('你好'); const sent = store.send(); await tick()
  controller.enqueue(new TextEncoder().encode(event('start', { conversationId: cid, turn: turn({ requestId }) }) + event('fallback', { conversationId: cid, turn: fallbackTurn({ requestId }) })))
  await tick()
  assert.equal(store.turns.length, 1)
  assert.equal(store.turns[0].modelId, 'glm-4-flash-250414')
  assert.equal(store.turns[0].status, 'streaming')
  assert.equal(store.busy, true)
  assert.equal(store.sendError, '')
  assert.equal(store.selectedModelId, 'glm-4.7-flash')
  store.setModel('glm-4-flash-250414')
  assert.equal(store.selectedModelId, 'glm-4.7-flash')
  controller.enqueue(new TextEncoder().encode(event('delta', { requestId, text: '备用的' }))); await tick()
  assert.equal(store.turns[0].answer, '备用的')
  controller.enqueue(new TextEncoder().encode(event('delta', { requestId, text: '回复' }) + event('done', { conversationId: cid, turn: fallbackTurn({ requestId, status: 'completed', answer: '备用的回复' }) })))
  controller.close(); await sent
  assert.equal(store.turns.length, 1)
  assert.equal(store.turns[0].answer, '备用的回复')
  assert.equal(store.turns[0].requestedModelId, 'glm-4.7-flash')
  assert.equal(store.busy, false)
})

test('leaving after fallback still cancels the active generation and ignores its delayed output', async () => {
  let controller; let requestId; let signal; let cancels = 0
  const { store } = await setup({ models: () => json(modelCatalog()), send: (_, options) => {
    requestId = JSON.parse(options.body).requestId; signal = options.signal
    return new Response(new ReadableStream({ start(value) { controller = value } }), { headers: { 'Content-Type': 'text/event-stream' } })
  }, cancel: () => { cancels++; return json(fallbackTurn({ requestId, status: 'canceled' })) } })
  store.setDraft('你好'); const sent = store.send(); await tick()
  controller.enqueue(new TextEncoder().encode(event('start', { conversationId: cid, turn: turn({ requestId }) }) + event('fallback', { conversationId: cid, turn: fallbackTurn({ requestId }) }))); await tick()
  await store.selectConversation(otherCid)
  assert.equal(cancels, 1)
  assert.equal(signal.aborted, true)
  controller.enqueue(new TextEncoder().encode(event('delta', { requestId, text: '迟到回复' }) + event('done', { conversationId: cid, turn: fallbackTurn({ requestId, status: 'completed', answer: '迟到回复' }) }))); controller.close(); await sent
  assert.equal(store.selectedConversationId, otherCid)
  assert.deepEqual(store.turns, [])
})

test('stopping a fallback turn preserves actual model and partial output over a late completion', async () => {
  let controller; let requestId; let finishCancel
  const { store } = await setup({ models: () => json(modelCatalog()), send: (_, options) => {
    requestId = JSON.parse(options.body).requestId
    return new Response(new ReadableStream({ start(value) { controller = value } }), { headers: { 'Content-Type': 'text/event-stream' } })
  }, cancel: () => new Promise(resolve => { finishCancel = () => resolve(json(fallbackTurn({ requestId, status: 'canceled', answer: '备用部分' }))) }) })
  store.setDraft('你好'); const sent = store.send(); await tick()
  controller.enqueue(new TextEncoder().encode(event('start', { conversationId: cid, turn: turn({ requestId }) }) + event('fallback', { conversationId: cid, turn: fallbackTurn({ requestId }) }) + event('delta', { requestId, text: '备用部分' }))); await tick()
  assert.equal(store.turns[0].answer, '备用部分')
  const stopped = store.stop(); await tick()
  controller.enqueue(new TextEncoder().encode(event('done', { conversationId: cid, turn: fallbackTurn({ requestId, status: 'completed', answer: '迟到完成' }) }))); controller.close(); await sent
  finishCancel(); await stopped
  assert.equal(store.turns[0].status, 'canceled')
  assert.equal(store.turns[0].answer, '备用部分')
  assert.equal(store.turns[0].modelId, 'glm-4-flash-250414')
  assert.equal(store.turns[0].requestedModelId, 'glm-4.7-flash')
  assert.equal(store.busy, false)
})

test('refresh restores requested selection for fallback history and supports old history and manual backup choice', async () => {
  let saved = fallbackTurn({ status: 'completed', answer: '保存回复' })
  const { store } = await setup({ models: () => json(modelCatalog()), detail: id => json({ conversation: conversation(id), turns: [saved] }) })
  assert.equal(store.turns[0].modelId, 'glm-4-flash-250414')
  assert.equal(store.selectedModelId, 'glm-4.7-flash')
  store.setModel('glm-4-flash-250414')
  assert.equal(store.selectedModelId, 'glm-4-flash-250414')
  await store.refresh()
  assert.equal(store.selectedModelId, 'glm-4.7-flash')
  saved = turn({ modelId: 'glm-4-flash-250414', modelLabel: 'GLM-4-Flash-250414', status: 'completed', answer: '旧备用回复' })
  await store.refresh()
  assert.equal(store.selectedModelId, 'glm-4-flash-250414')
  assert.equal(store.turns[0].requestedModelId, 'glm-4-flash-250414')
})

test('identity changes ignore delayed fallback events and clear the former model choice', async () => {
  let controller; let requestId; let signal
  const { store, authStore, runInAction } = await setup({ models: () => json(modelCatalog()), send: (_, options) => {
    requestId = JSON.parse(options.body).requestId; signal = options.signal
    return new Response(new ReadableStream({ start(value) { controller = value } }), { headers: { 'Content-Type': 'text/event-stream' } })
  }, cancel: () => json(turn({ requestId, status: 'canceled' })) })
  store.setDraft('你好'); const sent = store.send(); await tick()
  controller.enqueue(new TextEncoder().encode(event('start', { conversationId: cid, turn: turn({ requestId }) }))); await tick()
  runInAction(() => { authStore.user = null; authStore.identityVersion += 1 })
  assert.equal(signal.aborted, true)
  controller.enqueue(new TextEncoder().encode(event('fallback', { conversationId: cid, turn: fallbackTurn({ requestId }) }) + event('done', { conversationId: cid, turn: fallbackTurn({ requestId, status: 'completed', answer: '旧身份回复' }) }))); controller.close(); await sent
  assert.deepEqual(store.turns, [])
  assert.deepEqual(store.models, [])
  assert.equal(store.selectedModelId, '')
  assert.equal(store.busy, false)
})
