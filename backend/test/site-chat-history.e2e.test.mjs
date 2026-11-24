import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { afterEach, beforeEach, describe, it } from 'node:test';
import { startApp, stopApp } from './helpers/app.mjs';
import { collect, eventually, events, modelFixture } from './helpers/chat-fixture.mjs';

const visitorA = '11111111-1111-4111-8111-111111111111';
const visitorB = '22222222-2222-4222-8222-222222222222';
const hash = value => createHash('sha256').update(value).digest('hex');

describe('公开对话历史读取', () => {
  let state, upstream;
  beforeEach(async () => {
    upstream = await modelFixture();
    state = await startApp({ config: { GLM_API_KEY: 'fixture-key', GLM_BASE_URL: upstream.url, CHAT_MODELS_JSON: '' } });
  });
  afterEach(async () => { await stopApp(state); await upstream.close(); });

  const seed = overrides => state.connection.collection('site_chat_conversations').insertOne({
    id: randomUUID(), visitorHash: hash(visitorA), title: '测试会话',
    turns: [{ requestId: randomUUID(), content: '测试', answer: '回答', status: 'completed', modelId: 'glm-4.7-flash', error: null, createdAt: new Date(), updatedAt: new Date() }],
    active: false, activeUntil: null,
    expiresAt: new Date(Date.now() + 86400000),
    createdAt: new Date(), updatedAt: new Date(), ...overrides,
  });

  const post = (body, visitor = visitorA, signal) => fetch(`${state.baseUrl}/api/site-chat/stream`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Visitor-Id': visitor },
    body: JSON.stringify(body), signal,
  })

  it('缺少visitor返回空列表且不建数据', async () => {
    const response = await fetch(`${state.baseUrl}/api/site-chat/conversations`);
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { conversations: [] });
    assert.equal(await state.connection.collection('site_chat_conversations').countDocuments(), 0);
  });

  it('只返回当前visitor的会话，按更新时间倒序', async () => {
    await seed({ title: '旧会话', updatedAt: new Date('2026-01-01') });
    await seed({ title: '新会话', updatedAt: new Date('2026-02-01') });
    await seed({ visitorHash: hash(visitorB), title: '别人的会话' });
    const response = await fetch(`${state.baseUrl}/api/site-chat/conversations`, {
      headers: { 'X-Visitor-Id': visitorA },
    });
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.deepEqual(body.conversations.map(item => item.title), ['新会话', '旧会话']);
    assert.equal(JSON.stringify(body).includes('别人的会话'), false);
  });

  it('他人会话详情与删除均为404，自己的删除后204再404', async () => {
    const id = randomUUID();
    await seed({ id });
    assert.equal((await fetch(`${state.baseUrl}/api/site-chat/conversations/${id}`, {
      headers: { 'X-Visitor-Id': visitorB },
    })).status, 404);
    assert.equal((await fetch(`${state.baseUrl}/api/site-chat/conversations/${id}`, {
      method: 'DELETE', headers: { 'X-Visitor-Id': visitorB },
    })).status, 404);
    assert.equal((await fetch(`${state.baseUrl}/api/site-chat/conversations/${id}`, {
      method: 'DELETE', headers: { 'X-Visitor-Id': visitorA },
    })).status, 204);
    assert.equal((await fetch(`${state.baseUrl}/api/site-chat/conversations/${id}`, {
      headers: { 'X-Visitor-Id': visitorA },
    })).status, 404);
  });

  it('建立30天TTL索引与visitor排序索引', async () => {
    const indexes = await state.connection.collection('site_chat_conversations').indexes();
    assert.ok(indexes.some(index => index.key.expiresAt === 1 && index.expireAfterSeconds === 0));
    assert.ok(indexes.some(index => index.key.visitorHash === 1 && index.key.updatedAt === -1));
  });

  it('首条消息创建会话并返回start/delta/done，详情可恢复', async () => {
    const requestId = randomUUID()
    const result = await collect(await post({ requestId, message: '你好' }))
    assert.equal(result[0].type, 'start')
    assert.ok(result[0].conversationId)
    assert.equal(result[0].turnId, requestId)
    assert.equal(result.at(-1).type, 'done')
    assert.equal(result.filter(item => item.type === 'delta').map(item => item.text).join(''), '你好，世界')

    const detail = await fetch(`${state.baseUrl}/api/site-chat/conversations/${result[0].conversationId}`, {
      headers: { 'X-Visitor-Id': visitorA },
    }).then(response => response.json())
    assert.equal(detail.conversation.title, '你好')
    assert.deepEqual(detail.turns.map(turn => [turn.content, turn.status]), [['你好', 'completed']])
    assert.equal(detail.turns[0].answer, '你好，世界')
  })

  it('第二轮使用服务端历史而不是客户端history', async () => {
    const first = await collect(await post({ requestId: randomUUID(), message: '第一句' }))
    const conversationId = first[0].conversationId
    const second = await collect(await post({
      requestId: randomUUID(), conversationId, message: '第二句',
      history: [{ role: 'user', content: '伪造历史' }, { role: 'assistant', content: '伪造回答' }],
    }))
    assert.equal(second[0].conversationId, conversationId)
    const messages = upstream.calls.at(-1).body.messages
    assert.deepEqual(messages.slice(-3).map(item => item.content), ['第一句', '你好，世界', '第二句'])
    assert.equal(JSON.stringify(messages).includes('伪造历史'), false)
  })

  it('相同requestId已完成时重放done，不再调用上游', async () => {
    const requestId = randomUUID()
    const first = await collect(await post({ requestId, message: '只调用一次' }))
    const calls = upstream.calls.length
    const replay = await collect(await post({ requestId, message: '只调用一次' }))
    assert.equal(replay[0].type, 'start')
    assert.equal(replay.at(-1).type, 'done')
    assert.equal(upstream.calls.length, calls)
    assert.equal(replay[0].conversationId, first[0].conversationId)
    assert.equal(replay.some(item => item.type === 'delta'), true)
  })

  it('同会话生成中第二个请求返回409，断开后释放锁', async () => {
    let release
    upstream.handle(async ({ response }) => {
      response.writeHead(200, { 'Content-Type': 'text/event-stream' })
      response.write('data: {"choices":[{"delta":{"content":"部分"}}]}\n\n')
      await new Promise(resolve => { release = resolve })
      response.end('data: [DONE]\n\n')
      return true
    })
    const controller = new AbortController()
    const firstResponse = await post({ requestId: randomUUID(), message: '并发' }, visitorA, controller.signal)
    const iterator = events(firstResponse)[Symbol.asyncIterator]()
    const start = (await iterator.next()).value
    assert.equal(start.type, 'start')

    const busy = await post({ requestId: randomUUID(), conversationId: start.conversationId, message: '第二个' }, visitorA)
    assert.equal(busy.status, 409)
    assert.equal((await busy.json()).code, 'SITE_CHAT_BUSY')

    await eventually(() => release, Boolean)
    controller.abort()
    // 先等服务端感知断连并写入 canceled，再放行上游；否则上游完成会先落成 completed。
    await iterator.return().catch(() => undefined)
    try {
      const detail = await eventually(async () => fetch(`${state.baseUrl}/api/site-chat/conversations/${start.conversationId}`, {
        headers: { 'X-Visitor-Id': visitorA },
      }).then(response => response.json()), value => value.turns.at(-1)?.status === 'canceled')
      assert.equal(detail.turns.at(-1).status, 'canceled')
    } finally {
      release()
    }
  })

  it('activeUntil已过期时恢复旧轮次并释放锁', async () => {
    const id = randomUUID()
    await seed({ id, active: true, activeUntil: new Date(Date.now() - 1000), turns: [
      { requestId: randomUUID(), content: '上次', answer: '部分', status: 'streaming', modelId: 'glm-4.7-flash', error: null, createdAt: new Date(), updatedAt: new Date() },
    ] })
    const response = await post({ requestId: randomUUID(), conversationId: id, message: '恢复' })
    assert.equal(response.status, 200)
    await collect(response)
    const detail = await fetch(`${state.baseUrl}/api/site-chat/conversations/${id}`, {
      headers: { 'X-Visitor-Id': visitorA },
    }).then(value => value.json())
    assert.equal(detail.turns[0].status, 'failed')
    assert.equal(detail.turns.at(-1).status, 'completed')
  })

  it('上游429保留用户消息并把轮次标为failed', async () => {
    const requestId = randomUUID()
    const result = await collect(await post({ requestId, message: 'http-429' }))
    assert.equal(result.at(-1).type, 'error')
    const conversations = await fetch(`${state.baseUrl}/api/site-chat/conversations`, {
      headers: { 'X-Visitor-Id': visitorA },
    }).then(response => response.json())
    const detail = await fetch(`${state.baseUrl}/api/site-chat/conversations/${conversations.conversations[0].id}`, {
      headers: { 'X-Visitor-Id': visitorA },
    }).then(response => response.json())
    assert.equal(detail.turns[0].content, 'http-429')
    assert.equal(detail.turns[0].status, 'failed')
    assert.match(detail.turns[0].error, /模型有点忙|暂时不可用/)
  })

  it('第21个会话返回明确409且不写数据', async () => {
    for (let index = 0; index < 20; index += 1) await seed({ title: `会话${index}` })
    const response = await post({ requestId: randomUUID(), message: '超出上限' })
    assert.equal(response.status, 409)
    assert.equal((await response.json()).code, 'SITE_CHAT_LIMIT_REACHED')
  })

  it('第101轮返回明确409', async () => {
    const id = randomUUID()
    await seed({ id, turns: Array.from({ length: 100 }, () => ({
      requestId: randomUUID(), content: '旧问题', answer: '旧回答', status: 'completed',
      modelId: 'glm-4.7-flash', error: null, createdAt: new Date(), updatedAt: new Date(),
    })) })
    const response = await post({ requestId: randomUUID(), conversationId: id, message: '第101轮' })
    assert.equal(response.status, 409)
    assert.equal((await response.json()).code, 'SITE_CHAT_LIMIT_REACHED')
  })


  it('空闲超过阈值发送ping且轮次保持streaming', async () => {
    const pingUpstream = await modelFixture()
    const pingApp = await startApp({ config: {
      GLM_API_KEY: 'fixture-key', GLM_BASE_URL: pingUpstream.url, CHAT_MODELS_JSON: '',
      SITE_CHAT_PING_MS: '50', SITE_CHAT_TIMEOUT_MS: '5000',
    } })
    let release
    pingUpstream.handle(async ({ response }) => {
      response.writeHead(200, { 'Content-Type': 'text/event-stream' })
      await new Promise(resolve => { release = resolve })
      response.end('data: [DONE]\n\n')
      return true
    })
    const controller = new AbortController()
    try {
      const response = await fetch(`${pingApp.baseUrl}/api/site-chat/stream`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Visitor-Id': visitorA },
        body: JSON.stringify({ requestId: randomUUID(), message: 'ping测试' }),
        signal: controller.signal,
      })
      const iterator = events(response)[Symbol.asyncIterator]()
      const start = (await iterator.next()).value
      const ping = (await iterator.next()).value
      assert.equal(start.type, 'start')
      assert.equal(ping.type, 'ping')
      const record = await pingApp.connection.collection('site_chat_conversations').findOne({ id: start.conversationId })
      assert.equal(record.turns.at(-1).status, 'streaming')
      controller.abort()
      await iterator.return().catch(() => undefined)
      await eventually(async () => pingApp.connection.collection('site_chat_conversations').findOne({ id: start.conversationId }), value => value.turns.at(-1)?.status === 'canceled')
    } finally {
      release?.()
      await stopApp(pingApp)
      await pingUpstream.close()
    }
  })

});
