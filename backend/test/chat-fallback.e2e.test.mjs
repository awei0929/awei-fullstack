import assert from 'node:assert/strict';
import { beforeEach, afterEach, describe, it } from 'node:test';
import { randomUUID } from 'node:crypto';
import { ConfigService } from '@nestjs/config';
import { getModelToken } from '@nestjs/mongoose';
import { startApp, stopApp, client } from './helpers/app.mjs';
import { modelFixture, collect, events, eventually } from './helpers/chat-fixture.mjs';

const PRIMARY = 'glm-4.7-flash'; const BACKUP = 'glm-4-flash-250414';
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
const deferred = () => { let resolve; const promise = new Promise(done => { resolve = done; }); return { promise, resolve }; };
const chunk = text => `data: ${JSON.stringify({ choices: [{ delta: { content: text } }] })}\n\n`;
function busy(response, code = 429) { response.writeHead(code); response.end('private upstream diagnostic'); }
function success(response) { response.writeHead(200, { 'Content-Type': 'text/event-stream' }); response.end(chunk('免费备用回复') + 'data: [DONE]\n\n'); }

// 缺陷目标：把任意错误当429重试、第二次start/轮次、切换丢记忆、取消后仍发请求及历史模型错配。
// 所有模型调用均到回环HTTP替身，Mongo使用app辅助层强制的随机库，绝不读取真实.env。
describe('免费备用单次切换真实HTTP', () => {
  let state, owner, upstream;
  beforeEach(async () => {
    upstream = await modelFixture();
    state = await startApp({ config: { GLM_API_KEY: 'fixture-key', GLM_BASE_URL: upstream.url, CHAT_MODELS_JSON: '', CHAT_TIMEOUT_MS: '2000' } });
    owner = client(state); await owner.seedAndLogin('55555'); state.app.get(ConfigService).set('SITE_OWNER_USER_ID', owner.user.id);
    upstream.handle(({ body, response }) => { if (body.model === PRIMARY) busy(response); else success(response); return true; });
  });
  afterEach(async () => { await stopApp(state); await upstream.close(); });
  async function create() { const response = await owner.request('/chat/conversations', { method: 'POST', body: {} }); assert.equal(response.status, 201); return response.json(); }
  const send = (id, requestId = randomUUID(), modelId = PRIMARY, extra = {}) => owner.request(`/chat/conversations/${id}/stream`, { method: 'POST', body: { requestId, content: '合成测试问题', modelId }, ...extra });
  const detail = async id => (await owner.request(`/chat/conversations/${id}`)).json();
  const cancel = async (id, requestId) => (await owner.request(`/chat/conversations/${id}/turns/${requestId}/cancel`, { method: 'POST', body: {} })).json();

  it('目录默认4.7，固定免费备用和10个extras安全公开；不可覆盖内置模型', async () => {
    const settings = state.app.get(ConfigService); const extra = index => ({ id: `extra-${index}`, label: `额外${index}`, model: `vendor-${index}`, baseUrl: upstream.url, apiKeyEnv: 'EXTRA_KEY' });
    settings.set('EXTRA_KEY', 'extra-secret'); settings.set('CHAT_MODELS_JSON', JSON.stringify(Array.from({ length: 10 }, (_, i) => extra(i))));
    const catalog = await owner.request('/chat/models').then(response => response.json());
    assert.equal(catalog.defaultModelId, PRIMARY); assert.equal(catalog.models.length, 12);
    assert.deepEqual(catalog.models.slice(0, 2), [{ id: PRIMARY, label: 'GLM-4.7-Flash', available: true, fallbackModelId: BACKUP }, { id: BACKUP, label: 'GLM-4-Flash-250414', available: true }]);
    assert.ok(catalog.models.slice(1).every(model => !('fallbackModelId' in model)));
    assert.equal(JSON.stringify(catalog).includes('secret'), false); assert.equal(JSON.stringify(catalog).includes(upstream.url), false);
    for (const entries of [[...Array.from({ length: 11 }, (_, i) => extra(i))], [{ ...extra(0), id: BACKUP }], [{ ...extra(0), id: PRIMARY }], [{ ...extra(0), fallbackModelId: BACKUP }]]) {
      settings.set('CHAT_MODELS_JSON', JSON.stringify(entries)); assert.equal((await owner.request('/chat/models')).status, 503);
    }
    settings.set('CHAT_MODELS_JSON', ''); settings.set('GLM_API_KEY', '');
    const unavailable = await owner.request('/chat/models').then(response => response.json()); assert.ok(unavailable.models.every(model => !model.available));
    const conversation = await create(); assert.equal((await send(conversation.id)).status, 503); assert.equal((await send(conversation.id, randomUUID(), BACKUP)).status, 503); assert.equal(upstream.calls.length, 0);
  });

  it('HTTP429仅切一次，先持久化再fallback，只有一个start/轮次，备用不发thinking', async () => {
    const conversation = await create(); const requestId = randomUUID(); const iterator = events(await send(conversation.id, requestId));
    const start = (await iterator.next()).value; assert.equal(start.type, 'start'); assert.equal(start.turn.requestedModelId, PRIMARY);
    const switched = (await iterator.next()).value; assert.equal(switched.type, 'fallback'); assert.equal(switched.conversationId, conversation.id);
    assert.equal(switched.turn.modelId, BACKUP); assert.equal(switched.turn.modelLabel, 'GLM-4-Flash-250414'); assert.equal(switched.turn.requestedModelId, PRIMARY); assert.equal(switched.turn.requestedModelLabel, 'GLM-4.7-Flash');
    assert.equal(switched.turn.answer, ''); assert.equal(switched.turn.status, 'streaming'); assert.equal(switched.turn.requestId, requestId);
    assert.equal((await detail(conversation.id)).turns[0].modelId, BACKUP);
    const tail = []; for await (const event of iterator) tail.push(event); assert.deepEqual(tail.map(event => event.type), ['delta', 'done']);
    assert.equal(tail.at(-1).turn.status, 'completed'); assert.equal(tail.at(-1).turn.answer, '免费备用回复'); assert.deepEqual((await detail(conversation.id)).turns, [tail.at(-1).turn]);
    assert.deepEqual(upstream.calls.map(call => call.body.model), [PRIMARY, BACKUP]);
    assert.deepEqual(upstream.calls[0].body.thinking, { type: 'disabled' }); assert.equal(upstream.calls[1].body.thinking, undefined); assert.equal(upstream.calls[1].authorization, 'Bearer fixture-key');
    assert.deepEqual(upstream.calls[0].body.messages, upstream.calls[1].body.messages);
    const replay = await collect(await send(conversation.id, requestId)); assert.deepEqual(replay.map(event => event.type), ['start', 'done']); assert.deepEqual(replay.at(-1).turn, tail.at(-1).turn); assert.equal(upstream.calls.length, 2);
    assert.equal((await send(conversation.id, requestId, BACKUP)).status, 409);
  });

  it('备用仍429、鉴权失败或流内失败均结束该轮，不循环、不泄漏上游内容', async () => {
    const conversation = await create();
    for (const mode of [429, 401, 'stream']) {
      upstream.handle(({ body, response }) => {
        if (body.model === PRIMARY || mode !== 'stream') busy(response, body.model === PRIMARY ? 429 : mode);
        else { response.writeHead(200, { 'Content-Type': 'text/event-stream' }); response.end('data: {"error":{"code":429,"message":"private diagnostic"}}\n\n'); } return true;
      });
      const before = upstream.calls.length; const result = await collect(await send(conversation.id));
      assert.deepEqual(result.map(event => event.type), ['start', 'fallback', 'done']); assert.equal(result.at(-1).turn.status, 'failed'); assert.equal(result.at(-1).turn.modelId, BACKUP); assert.equal(result.at(-1).turn.requestedModelId, PRIMARY); assert.equal(upstream.calls.length - before, 2); assert.equal(JSON.stringify(result).includes('private'), false);
    }
  });

  it('非429、网络断开、流内429及部分正文后错误不切换', async () => {
    const conversation = await create();
    for (const mode of [401, 403, 500, 'network', 'stream', 'partial']) {
      upstream.handle(({ response }) => {
        if (typeof mode === 'number') busy(response, mode);
        else if (mode === 'network') response.destroy();
        else { response.writeHead(200, { 'Content-Type': 'text/event-stream' }); response.end((mode === 'partial' ? chunk('保留部分') : '') + 'data: {"error":{"code":429}}\n\n'); } return true;
      });
      const before = upstream.calls.length; const result = await collect(await send(conversation.id));
      assert.equal(result.some(event => event.type === 'fallback'), false, String(mode)); assert.equal(result.at(-1).turn.status, 'failed'); assert.equal(result.at(-1).turn.modelId, PRIMARY); assert.equal(result.at(-1).turn.answer, mode === 'partial' ? '保留部分' : ''); assert.equal(upstream.calls.length - before, 1);
    }
  });

  it('手动选备用或额外白名单模型遇429均不触发自动切换', async () => {
    const settings = state.app.get(ConfigService); settings.set('CHAT_MODELS_JSON', JSON.stringify([{ id: 'extra', label: '额外', model: 'vendor-extra', baseUrl: upstream.url, apiKeyEnv: 'GLM_API_KEY' }]));
    upstream.handle(({ response }) => { busy(response); return true; }); const conversation = await create();
    for (const modelId of [BACKUP, 'extra']) {
      const result = await collect(await send(conversation.id, randomUUID(), modelId)); assert.deepEqual(result.map(event => event.type), ['start', 'done']); assert.equal(result.at(-1).turn.status, 'failed'); assert.equal(result.at(-1).turn.requestedModelId, modelId); assert.equal(result.at(-1).turn.modelId, modelId);
    }
    assert.equal(upstream.calls.length, 2);
  });

  it('两次调用共享受理时的历史和记忆快照，生成期间编辑只影响下一轮', async () => {
    const memory = await owner.request('/chat/memories', { method: 'POST', body: { content: '旧合成记忆' } }).then(response => response.json());
    const conversation = await create(); upstream.handle(({ response }) => { success(response); return true; }); await collect(await send(conversation.id));
    const arrived = deferred(); const gate = deferred();
    upstream.handle(async ({ body, response }) => { if (body.model === PRIMARY) { arrived.resolve(); await gate.promise; busy(response); } else success(response); return true; });
    try {
      const pending = collect(await send(conversation.id)); await arrived.promise;
      await owner.request(`/chat/memories/${memory.id}`, { method: 'PATCH', body: { content: '新的合成记忆' } }); gate.resolve(); await pending;
      const first = upstream.calls[1].body.messages; const second = upstream.calls[2].body.messages;
      assert.deepEqual(second, first); assert.match(first[0].content, /旧合成记忆/); assert.equal(JSON.stringify(first).includes('新的合成记忆'), false); assert.equal(first.length, 4); assert.equal(first[2].content, '免费备用回复');
      await collect(await send(conversation.id)); assert.match(upstream.calls[3].body.messages[0].content, /新的合成记忆/);
    } finally { gate.resolve(); }
  });

  it('主模型429到达前取消或断开均不发备用请求', async () => {
    for (const action of ['cancel', 'disconnect']) {
      const conversation = await create(); const requestId = randomUUID(); const arrived = deferred(); const gate = deferred();
      upstream.handle(async ({ response }) => { arrived.resolve(); await gate.promise; if (!response.destroyed) busy(response); return true; });
      const controller = new AbortController(); const before = upstream.calls.length;
      try {
        const iterator = events(await send(conversation.id, requestId, PRIMARY, { signal: controller.signal })); await iterator.next(); await arrived.promise;
        if (action === 'cancel') { assert.equal((await cancel(conversation.id, requestId)).status, 'canceled'); gate.resolve(); assert.equal((await iterator.next()).value.turn.status, 'canceled'); await iterator.return(); }
        // 客户端abort通知经网络送到服务端；先观察终态再释放429，不能把两端时钟当同步事件。
        else { controller.abort(); await eventually(() => detail(conversation.id), result => result.turns[0]?.status === 'interrupted'); gate.resolve(); }
        await delay(30); assert.equal(upstream.calls.length - before, 1); assert.equal((await detail(conversation.id)).turns[0].modelId, PRIMARY);
      } finally { gate.resolve(); }
    }
  });

  // 驱动层门闩只控制真实CAS的前后时机，取消接口与持久化副作用不被替换。
  for (const position of ['before', 'after']) it(`切换元数据写库${position}窗口取消不启动备用且终态模型与数据库一致`, async () => {
    const conversation = await create(); const requestId = randomUUID(); const model = state.app.get(getModelToken('ConversationRecord')); const original = model.collection.findOneAndUpdate;
    const arrived = deferred(); const gate = deferred();
    model.collection.findOneAndUpdate = async function(filter, update, options) {
      const isSwitch = update.$set?.['turns.$.modelId'] === BACKUP;
      if (isSwitch && position === 'before') { arrived.resolve(); await gate.promise; }
      const result = await original.call(this, filter, update, options);
      if (isSwitch && position === 'after') { arrived.resolve(); await gate.promise; }
      return result;
    };
    try {
      const pending = collect(await send(conversation.id, requestId)); await arrived.promise;
      const canceled = await cancel(conversation.id, requestId); gate.resolve(); const result = await pending;
      assert.deepEqual(result.map(event => event.type), ['start', 'done']); assert.deepEqual(result.at(-1).turn, canceled); assert.deepEqual((await detail(conversation.id)).turns[0], canceled);
      assert.equal(canceled.modelId, position === 'after' ? BACKUP : PRIMARY); assert.equal(canceled.requestedModelId, PRIMARY); assert.equal(upstream.calls.length, 1);
    } finally { gate.resolve(); model.collection.findOneAndUpdate = original; }
  });

  it('切换CAS已被其他终态抢先或元数据保存失败时都不启动备用', async () => {
    const model = state.app.get(getModelToken('ConversationRecord')); const original = model.collection.findOneAndUpdate;
    for (const mode of ['canceled', 'write-error']) {
      const conversation = await create(); const requestId = randomUUID(); const before = upstream.calls.length;
      model.collection.findOneAndUpdate = async function(filter, update, options) {
        if (update.$set?.['turns.$.modelId'] === BACKUP) {
          if (mode === 'write-error') throw new Error('private database diagnostic');
          await original.call(this, { id: conversation.id, 'turns.requestId': requestId }, { $set: { active: false, 'turns.$.status': 'canceled' } }, options);
        }
        return original.call(this, filter, update, options);
      };
      try {
        const result = await collect(await send(conversation.id, requestId)); assert.deepEqual(result.map(event => event.type), ['start', 'done']); assert.equal(result.at(-1).turn.status, mode === 'canceled' ? 'canceled' : 'failed'); assert.equal(upstream.calls.length - before, 1); assert.equal(JSON.stringify(result).includes('private'), false); assert.deepEqual((await detail(conversation.id)).turns[0], result.at(-1).turn);
      } finally { model.collection.findOneAndUpdate = original; }
    }
  });

  it('备用流取消会abort，保留备用部分文本与原选择且可重放', async () => {
    upstream.handle(({ body, response }) => { if (body.model === PRIMARY) busy(response); else { response.writeHead(200, { 'Content-Type': 'text/event-stream' }); response.write(chunk('备用部分')); } return true; });
    const conversation = await create(); const requestId = randomUUID(); const iterator = events(await send(conversation.id, requestId));
    assert.equal((await iterator.next()).value.type, 'start'); assert.equal((await iterator.next()).value.type, 'fallback'); assert.equal((await iterator.next()).value.type, 'delta');
    const canceled = await cancel(conversation.id, requestId); assert.equal(canceled.status, 'canceled'); assert.equal(canceled.answer, '备用部分'); assert.equal(canceled.modelId, BACKUP); assert.equal(canceled.requestedModelId, PRIMARY);
    assert.deepEqual((await iterator.next()).value.turn, canceled); await iterator.return(); await eventually(() => upstream.aborted, count => count === 1);
    assert.deepEqual((await collect(await send(conversation.id, requestId))).at(-1).turn, canceled); assert.equal(upstream.calls.length, 2);
  });

  it('主模型和备用共享1000ms总时限，切换不重置超时', async () => {
    state.app.get(ConfigService).set('CHAT_TIMEOUT_MS', '1000');
    upstream.handle(async ({ body, response }) => { await delay(650); if (!response.destroyed) { if (body.model === PRIMARY) busy(response); else success(response); } return true; });
    const conversation = await create(); const result = await collect(await send(conversation.id));
    assert.deepEqual(result.map(event => event.type), ['start', 'fallback', 'done']); assert.equal(result.at(-1).turn.status, 'interrupted'); assert.match(result.at(-1).turn.error, /超时/); assert.equal(result.at(-1).turn.answer, ''); assert.equal(result.at(-1).turn.modelId, BACKUP); assert.equal(upstream.calls.length, 2);
  });

  it('切换元数据写库等到总时限后不得发fallback或启动备用', async () => {
    state.app.get(ConfigService).set('CHAT_TIMEOUT_MS', '1000'); const conversation = await create(); const model = state.app.get(getModelToken('ConversationRecord')); const original = model.collection.findOneAndUpdate;
    model.collection.findOneAndUpdate = async function(filter, update, options) { const result = await original.call(this, filter, update, options); if (update.$set?.['turns.$.modelId'] === BACKUP) await delay(1100); return result; };
    try {
      const result = await collect(await send(conversation.id)); assert.deepEqual(result.map(event => event.type), ['start', 'done']); assert.equal(result.at(-1).turn.status, 'interrupted'); assert.equal(result.at(-1).turn.modelId, BACKUP); assert.equal(upstream.calls.length, 1); assert.deepEqual((await detail(conversation.id)).turns[0], result.at(-1).turn);
    } finally { model.collection.findOneAndUpdate = original; }
  });

  it('旧历史回补原选择，重启恢复保留切换模型且不重新调用上游', async () => {
    const conversation = await create(); const complete = (await collect(await send(conversation.id))).at(-1).turn;
    const old = { requestId: randomUUID(), content: '旧问题', answer: '旧回复', modelId: PRIMARY, modelLabel: 'GLM-4.7-Flash', status: 'completed', error: null, createdAt: new Date(), updatedAt: new Date() };
    const stale = { ...old, requestId: randomUUID(), answer: '', status: 'streaming', modelId: BACKUP, modelLabel: 'GLM-4-Flash-250414', requestedModelId: PRIMARY, requestedModelLabel: 'GLM-4.7-Flash' };
    await state.connection.collection('chat_conversations').updateOne({ id: conversation.id }, { $push: { turns: { $each: [old, stale] } }, $set: { active: true, runtimeId: 'previous-runtime', expiresAt: new Date(Date.now() + 60000) } });
    const databaseName = state.databaseName; const ownerId = owner.user.id; const cookie = owner.cookie; const csrfToken = owner.csrfToken;
    await stopApp(state, { drop: false }); state = undefined;
    state = await startApp({ databaseName, config: { SITE_OWNER_USER_ID: ownerId, GLM_API_KEY: 'fixture-key', GLM_BASE_URL: upstream.url, CHAT_MODELS_JSON: '' } }); owner = client(state); owner.cookie = cookie; owner.csrfToken = csrfToken;
    const view = await detail(conversation.id); assert.deepEqual(view.turns[0], complete); assert.equal(view.turns[1].requestedModelId, PRIMARY); assert.equal(view.turns[1].requestedModelLabel, 'GLM-4.7-Flash'); assert.equal(view.turns[2].status, 'interrupted'); assert.equal(view.turns[2].modelId, BACKUP); assert.equal(view.turns[2].requestedModelId, PRIMARY); assert.equal(upstream.calls.length, 2);
    const raw = await state.connection.collection('chat_conversations').findOne({ id: conversation.id }); assert.equal(raw.turns[1].requestedModelId, undefined);
  });
});
