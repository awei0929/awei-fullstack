import assert from 'node:assert/strict';
import { beforeEach, afterEach, describe, it } from 'node:test';
import { randomUUID } from 'node:crypto';
import { ConfigService } from '@nestjs/config';
import { getModelToken } from '@nestjs/mongoose';
import { startApp, stopApp, client } from './helpers/app.mjs';
import { modelFixture, collect, events, eventually } from './helpers/chat-fixture.mjs';

// 生产缺陷目标：错误授权、重复模型调用、终态被迟到结果覆盖、截断误成功和历史泄漏。
// 每例使用随机临时Mongo和回环HTTP模型；不会读取真实模型Key或发送外部模型请求。
describe('站主聊天真实HTTP', () => {
  let state, owner, upstream;
  beforeEach(async () => {
    upstream = await modelFixture();
    state = await startApp({ config: { GLM_API_KEY: 'fixture-key', GLM_BASE_URL: upstream.url, CHAT_MODELS_JSON: '', CHAT_TIMEOUT_MS: '1000' } });
    owner = client(state); await owner.seedAndLogin('55555');
    state.app.get(ConfigService).set('SITE_OWNER_USER_ID', owner.user.id);
  });
  afterEach(async () => { await stopApp(state); await upstream.close(); });
  async function create(user = owner) { const r = await user.request('/chat/conversations', { method: 'POST', body: {} }); assert.equal(r.status, 201); return r.json(); }
  const send = (id, content = '你好', requestId = randomUUID(), extra = {}) => owner.request(`/chat/conversations/${id}/stream`, { method: 'POST', body: { requestId, content, modelId: 'glm-4.7-flash', ...extra } });
  const detail = async id => (await owner.request(`/chat/conversations/${id}`)).json();

  it('全部聊天入口按Session、Owner、CSRF验证且无主配置拒绝访问', async () => {
    const outsider = client(state); await outsider.seedAndLogin('44444'); const id = randomUUID();
    for (const [path, method, body] of [['/chat/models', 'GET'], ['/chat/conversations', 'GET'], ['/chat/conversations', 'POST', {}], [`/chat/conversations/${id}`, 'GET'], [`/chat/conversations/${id}/stream`, 'POST', { requestId: randomUUID(), content: '你好', modelId: 'glm-4.7-flash' }], [`/chat/conversations/${id}/turns/${randomUUID()}/cancel`, 'POST', {}]]) {
      assert.equal((await client(state).request(path, { method, body })).status, 401, path);
      assert.equal((await outsider.request(path, { method, body })).status, 403, path);
      if (method === 'POST') assert.equal((await owner.request(path, { method, body, csrf: false })).status, 403, path);
    }
    state.app.get(ConfigService).set('SITE_OWNER_USER_ID', ''); assert.equal((await owner.request('/chat/models')).status, 403);
    assert.equal(upstream.calls.length, 0);
  });
  it('无Key正常列出不可用模型、发送503且不落轮次，不泄漏配置', async () => {
    state.app.get(ConfigService).set('GLM_API_KEY', ''); const convo = await create();
    const response = await owner.request('/chat/models'); assert.equal(response.status, 200); assert.equal(response.headers.get('cache-control'), 'no-store');
    assert.deepEqual(await response.json(), { models: [{ id: 'glm-4.7-flash', label: 'GLM-4.7-Flash', available: false }], defaultModelId: 'glm-4.7-flash' });
    assert.equal((await send(convo.id)).status, 503); assert.equal((await detail(convo.id)).turns.length, 0);
  });
  it('UTF-8分片、CRLF、多行data与注释生成增量、done并保存历史', async () => {
    const convo = await create(); const requestId = randomUUID(); const response = await send(convo.id, '  问题  ', requestId);
    assert.match(response.headers.get('content-type'), /text\/event-stream/); assert.equal(response.headers.get('x-accel-buffering'), 'no');
    const result = await collect(response); assert.deepEqual(result.map(e => e.type), ['start', 'delta', 'delta', 'done']);
    assert.equal(result.at(-1).turn.answer, '你好，世界'); assert.equal(result.at(-1).turn.status, 'completed'); assert.equal(result[0].turn.content, '问题');
    const view = await detail(convo.id); assert.deepEqual(view.turns, [result.at(-1).turn]); assert.equal(view.conversation.title, '问题');
    assert.deepEqual(upstream.calls[0].body.messages, [{ role: 'user', content: '问题' }]); assert.equal(upstream.calls[0].body.max_tokens, 4096); assert.deepEqual(upstream.calls[0].body.thinking, { type: 'disabled' });
    assert.equal(upstream.calls[0].authorization, 'Bearer fixture-key'); assert.equal(JSON.stringify(result).includes('fixture-key'), false);
  });
  it('已完成requestId重放而不调用上游，不同内容或模型409', async () => {
    const convo = await create(); const requestId = randomUUID(); await collect(await send(convo.id, '你好', requestId));
    const replay = await collect(await send(convo.id, '你好', requestId)); assert.deepEqual(replay.map(e => e.type), ['start', 'done']); assert.equal(upstream.calls.length, 1);
    assert.equal((await send(convo.id, '不同', requestId)).status, 409); assert.equal((await send(convo.id, '你好', requestId, { modelId: 'unknown' })).status, 409);
    assert.equal((await detail(convo.id)).turns.length, 1);
  });
  it('活动重复与跨会话并发被拒绝，取消幂等且上游abort', async () => {
    const convo = await create(); const other = await create(); const requestId = randomUUID(); const iterator = events(await send(convo.id, 'hang', requestId));
    assert.equal((await iterator.next()).value.type, 'start'); assert.equal((await iterator.next()).value.type, 'delta');
    assert.equal((await send(convo.id, 'hang', requestId)).status, 409); assert.equal((await send(other.id)).status, 409);
    const canceled = await owner.request(`/chat/conversations/${convo.id}/turns/${requestId}/cancel`, { method: 'POST', body: {} }).then(r => r.json());
    assert.equal(canceled.status, 'canceled'); assert.equal(canceled.answer, '部分回复');
    assert.equal((await iterator.next()).value.turn.status, 'canceled'); await iterator.return();
    const again = await owner.request(`/chat/conversations/${convo.id}/turns/${requestId}/cancel`, { method: 'POST', body: {} }).then(r => r.json()); assert.deepEqual(again, canceled);
    await eventually(() => upstream.aborted, n => n === 1); assert.equal(upstream.calls.length, 1);
    assert.equal((await detail(convo.id)).turns[0].status, 'canceled');
  });
  it('客户端断开保存interrupted及部分回复，后续可继续发送', async () => {
    const convo = await create(); const controller = new AbortController();
    const response = await owner.request(`/chat/conversations/${convo.id}/stream`, { method: 'POST', body: { requestId: randomUUID(), content: 'hang', modelId: 'glm-4.7-flash' }, signal: controller.signal });
    const iterator = events(response); await iterator.next(); await iterator.next(); controller.abort();
    const view = await eventually(() => detail(convo.id), value => value.turns[0]?.status === 'interrupted'); assert.equal(view.turns[0].answer, '部分回复');
    assert.equal((await collect(await send(convo.id))).at(-1).turn.status, 'completed');
  });
  it('超时abort上游且不永久streaming', async () => {
    const convo = await create(); const result = await collect(await send(convo.id, 'hang'));
    assert.equal(result.at(-1).turn.status, 'interrupted'); assert.match(result.at(-1).turn.error, /超时/); assert.equal((await detail(convo.id)).turns[0].status, 'interrupted');
  });
  it('上游401/429/500、空答、截断、非法JSON与超限都失败且错误脱敏', async () => {
    const convo = await create();
    for (const mode of ['http-401', 'http-429', 'http-500', 'empty', 'truncated', 'bad-json', 'long', 'oversized', 'length', 'redirect']) {
      const result = await collect(await send(convo.id, mode)); const turn = result.at(-1).turn;
      assert.equal(turn.status, 'failed', mode); assert.ok(turn.error); assert.ok(Array.from(turn.answer).length <= 16000); assert.equal(JSON.stringify(result).includes('secret upstream diagnostic'), false);
      if (mode === 'truncated') assert.equal(turn.answer, '部分回复');
    }
  });
  it('路径、未知字段、空白、Unicode长度与非法模型在写头前返回JSON错误', async () => {
    const convo = await create();
    for (const [id, content, extra] of [['bad', 'hello', {}], [convo.id, '', {}], [convo.id, '  ', {}], [convo.id, '😀'.repeat(4001), {}], [convo.id, 'hi', { injected: true }], [convo.id, 'hi', { modelId: 'unknown' }]]) {
      const response = await send(id, content, randomUUID(), extra); assert.equal(response.status, 400); assert.match(response.headers.get('content-type'), /json/);
    }
    assert.equal((await owner.request('/chat/conversations', { method: 'POST', body: { ownerId: 'bad' } })).status, 400);
    assert.equal((await collect(await send(convo.id, '😀'.repeat(4000)))).at(-1).turn.status, 'completed');
  });
  it('所有资源读取和写入均按可信ownerId隔离', async () => {
    const convo = await create(); await state.connection.collection('chat_conversations').updateOne({ id: convo.id }, { $set: { ownerId: randomUUID() } });
    assert.equal((await owner.request(`/chat/conversations/${convo.id}`)).status, 404); assert.equal((await send(convo.id)).status, 404);
    assert.equal((await owner.request(`/chat/conversations/${convo.id}/turns/${randomUUID()}/cancel`, { method: 'POST', body: {} })).status, 404);
    assert.deepEqual((await owner.request('/chat/conversations').then(r => r.json())).conversations, []);
  });
  it('输入按Unicode码点计数，变体选择符不能绕过4000字符上限', async () => {
    const convo = await create(); const boundary = '✈️'.repeat(2000);
    assert.equal(Array.from(boundary).length, 4000);
    assert.equal((await collect(await send(convo.id, boundary))).at(-1).turn.status, 'completed');
    assert.equal((await send(convo.id, `${boundary}字`)).status, 400);
    assert.equal((await detail(convo.id)).turns.length, 1); assert.equal(upstream.calls.length, 1);
  });
  it('第二模型来自服务端白名单，前端不获地址、变量名或Key', async () => {
    const settings = state.app.get(ConfigService); settings.set('SECOND_KEY', 'second-fixture'); settings.set('CHAT_MODELS_JSON', JSON.stringify([{ id: 'second', label: '第二模型', model: 'provider-2', baseUrl: upstream.url, apiKeyEnv: 'SECOND_KEY', disableThinking: false }]));
    const catalog = await owner.request('/chat/models').then(r => r.json()); assert.deepEqual(catalog.models[1], { id: 'second', label: '第二模型', available: true });
    const convo = await create(); const result = await collect(await send(convo.id, '你好', randomUUID(), { modelId: 'second' })); assert.equal(result.at(-1).turn.modelLabel, '第二模型');
    assert.equal(upstream.calls[0].body.model, 'provider-2'); assert.equal(upstream.calls[0].authorization, 'Bearer second-fixture'); assert.equal(upstream.calls[0].body.thinking, undefined);
  });
  it('完成后重建应用保留历史，会回收上次进程及过期streaming而不重调模型', async () => {
    const convo = await create(); await collect(await send(convo.id));
    const databaseName = state.databaseName; const savedOwner = owner.user.id;
    const oldCookie = owner.cookie; const oldToken = owner.csrfToken;
    const stale = { requestId: randomUUID(), content: '旧请求', answer: '旧部分', modelId: 'glm-4.7-flash', modelLabel: 'GLM-4.7-Flash', status: 'streaming', error: null, createdAt: new Date(), updatedAt: new Date() };
    await state.connection.collection('chat_conversations').updateOne({ id: convo.id }, { $push: { turns: stale }, $set: { active: true, runtimeId: 'old-process', expiresAt: new Date(Date.now() + 60000) } });
    await stopApp(state, { drop: false }); state = undefined;
    state = await startApp({ databaseName, config: { SITE_OWNER_USER_ID: savedOwner, GLM_API_KEY: 'fixture-key', GLM_BASE_URL: upstream.url, CHAT_MODELS_JSON: '' } });
    owner = client(state); owner.cookie = oldCookie; owner.csrfToken = oldToken;
    const view = await detail(convo.id); assert.equal(view.turns[0].answer, '你好，世界'); assert.equal(view.turns[1].status, 'interrupted'); assert.equal(view.turns[1].answer, '旧部分'); assert.equal(upstream.calls.length, 1);
    await state.connection.collection('chat_conversations').updateOne({ id: convo.id }, { $set: { active: true, 'turns.1.status': 'streaming', expiresAt: new Date(0) } });
    assert.equal((await detail(convo.id)).turns[1].status, 'interrupted');
  });
  it('历史仅带最近10轮completed并按32000字符裁剪，100轮拒绝追加', async () => {
    const convo = await create();
    const turns = Array.from({ length: 12 }, (_, i) => ({ requestId: randomUUID(), content: `问题${i}`, answer: `答案${i}`, modelId: 'glm-4.7-flash', modelLabel: 'GLM-4.7-Flash', status: 'completed', error: null, createdAt: new Date(), updatedAt: new Date() }));
    turns.push({ ...turns[0], requestId: randomUUID(), status: 'failed', content: '不应进入上下文' });
    await state.connection.collection('chat_conversations').updateOne({ id: convo.id }, { $set: { turns } });
    await collect(await send(convo.id, '新问题')); const messages = upstream.calls[0].body.messages;
    assert.equal(messages.length, 21); assert.deepEqual(messages[0], { role: 'user', content: '问题2' }); assert.deepEqual(messages.at(-1), { role: 'user', content: '新问题' });
    const large = turns.slice(0, 10).map(turn => ({ ...turn, content: '问'.repeat(4000), answer: '答'.repeat(16000) }));
    await state.connection.collection('chat_conversations').updateOne({ id: convo.id }, { $set: { turns: large } });
    await collect(await send(convo.id, '当前')); assert.equal(upstream.calls[1].body.messages.length, 3); assert.equal(upstream.calls[1].body.messages.at(-1).content, '当前');
    const full = Array.from({ length: 100 }, () => ({ ...turns[0], requestId: randomUUID() }));
    await state.connection.collection('chat_conversations').updateOne({ id: convo.id }, { $set: { turns: full } });
    assert.equal((await send(convo.id)).status, 400); assert.equal(upstream.calls.length, 2);
  });
  it('会话列表按最近更新返回50项但不删除更旧历史', async () => {
    const now = Date.now();
    await state.connection.collection('chat_conversations').insertMany(Array.from({ length: 51 }, (_, index) => ({ id: randomUUID(), ownerId: owner.user.id, title: String(index), turns: [], active: false, createdAt: new Date(now + index), updatedAt: new Date(now + index) })));
    const view = await owner.request('/chat/conversations').then(r => r.json()); assert.equal(view.conversations.length, 50); assert.equal(view.conversations[0].title, '50'); assert.equal(view.conversations.at(-1).title, '1');
    assert.equal(await state.connection.collection('chat_conversations').countDocuments({ ownerId: owner.user.id }), 51);
  });
  it('终态数据库写失败不能向浏览器发送completed，错误不泄漏数据库信息', async () => {
    const convo = await create(); const model = state.app.get(getModelToken('ConversationRecord')); const original = model.collection.findOneAndUpdate;
    // 仅在数据库驱动边界注入一次失败，受理、流解析与重试落库仍走真实代码。
    let failed = false;
    model.collection.findOneAndUpdate = async function(filter, update, options) {
      if (!failed && update.$set?.['turns.$.status'] === 'completed') { failed = true; throw new Error('private database diagnostic'); }
      return original.call(this, filter, update, options);
    };
    try { const result = await collect(await send(convo.id)); assert.equal(result.at(-1).turn.status, 'failed'); assert.equal(result.at(-1).turn.answer, '你好，世界'); assert.equal(JSON.stringify(result).includes('private database diagnostic'), false); assert.equal((await detail(convo.id)).turns[0].status, 'failed'); }
    finally { model.collection.findOneAndUpdate = original; }
  });
  it('同一轮完成与取消交错只返回一个终态，已取消不会被后来完成覆盖', async () => {
    for (let index = 0; index < 4; index++) {
      const convo = await create(); const requestId = randomUUID(); const iterator = events(await send(convo.id, '你好', requestId));
      await iterator.next(); await iterator.next();
      const cancelPromise = owner.request(`/chat/conversations/${convo.id}/turns/${requestId}/cancel`, { method: 'POST', body: {} }).then(r => r.json());
      const tail = []; for await (const event of iterator) tail.push(event);
      const canceled = await cancelPromise; assert.equal(tail.at(-1).turn.status, canceled.status); assert.ok(['completed', 'canceled'].includes(canceled.status));
      assert.deepEqual((await detail(convo.id)).turns[0], canceled);
    }
  });
  it('受理写库返回前取消也不启动模型，不会让迟到响应覆盖终态', async () => {
    const convo = await create(); const requestId = randomUUID(); const model = state.app.get(getModelToken('ConversationRecord')); const original = model.collection.findOneAndUpdate;
    let release; let accepted; const gate = new Promise(resolve => { release = resolve; }); const ready = new Promise(resolve => { accepted = resolve; });
    model.collection.findOneAndUpdate = async function(filter, update, options) {
      const result = await original.call(this, filter, update, options);
      if (update.$push?.turns) { accepted(); await gate; }
      return result;
    };
    try {
      const pending = send(convo.id, '你好', requestId); await ready;
      const canceled = await owner.request(`/chat/conversations/${convo.id}/turns/${requestId}/cancel`, { method: 'POST', body: {} }).then(r => r.json()); assert.equal(canceled.status, 'canceled'); release();
      const result = await collect(await pending); assert.equal(result.at(-1).turn.status, 'canceled'); assert.equal(upstream.calls.length, 0);
    } finally { release(); model.collection.findOneAndUpdate = original; }
  });

  it('受理期间连接断开释放活动锁，下一轮不会永久409', async () => {
    const convo = await create(); const model = state.app.get(getModelToken('ConversationRecord')); const original = model.collection.findOneAndUpdate;
    let release; let accepted; const gate = new Promise(resolve => { release = resolve; }); const ready = new Promise(resolve => { accepted = resolve; });
    model.collection.findOneAndUpdate = async function(filter, update, options) {
      const result = await original.call(this, filter, update, options);
      if (update.$push?.turns) { accepted(); await gate; }
      return result;
    };
    const controller = new AbortController();
    try {
      const pending = owner.request(`/chat/conversations/${convo.id}/stream`, { method: 'POST', body: { requestId: randomUUID(), content: '你好', modelId: 'glm-4.7-flash' }, signal: controller.signal }).catch(() => null);
      await ready; controller.abort(); await pending; await new Promise(resolve => setTimeout(resolve, 30)); release();
      await eventually(() => detail(convo.id), value => value.turns[0]?.status === 'interrupted');
      model.collection.findOneAndUpdate = original;
      const response = await send(convo.id); assert.equal(response.status, 200); assert.equal((await collect(response)).at(-1).turn.status, 'completed');
    } finally { release(); model.collection.findOneAndUpdate = original; }
  });

  it('坏白名单、重复ID、非HTTPS与生产回环HTTP均拒绝且不泄漏配置', async () => {
    const settings = state.app.get(ConfigService);
    for (const extra of ['not-json-secret', '{}', JSON.stringify([{ id: 'glm-4.7-flash' }]), JSON.stringify([{ id: 'second', label: '第二', model: 'second', baseUrl: 'http://example.com/v1', apiKeyEnv: 'SECOND_KEY' }]), JSON.stringify([{ id: 'second', label: '第二', model: 'second', baseUrl: 'https://user:private@provider.example/v1', apiKeyEnv: 'SECOND_KEY' }])]) {
      settings.set('CHAT_MODELS_JSON', extra); const response = await owner.request('/chat/models'); assert.equal(response.status, 503); assert.equal((await response.text()).includes('private'), false);
    }
    settings.set('CHAT_MODELS_JSON', ''); settings.set('NODE_ENV', 'production');
    const response = await owner.request('/chat/models'); assert.equal(response.status, 503);
    assert.equal(upstream.calls.length, 0);
  });

});
