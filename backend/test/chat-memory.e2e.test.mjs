import assert from 'node:assert/strict';
import { beforeEach, afterEach, describe, it } from 'node:test';
import { randomUUID } from 'node:crypto';
import { ConfigService } from '@nestjs/config';
import { startApp, stopApp, client } from './helpers/app.mjs';
import { modelFixture, collect, events } from './helpers/chat-fixture.mjs';

// 缺陷目标：越权记忆泄漏、DTO绕过、并发越界/覆盖，以及修改后仍使用过期记忆。
// 只访问显式指定的隔离Mongo和回环模型，合成记忆不会发送到真实供应商。
describe('站主长期记忆真实HTTP', () => {
  let state, owner, upstream;
  beforeEach(async () => {
    upstream = await modelFixture();
    state = await startApp({ config: { GLM_API_KEY: 'fixture-key', GLM_BASE_URL: upstream.url, CHAT_MODELS_JSON: '', CHAT_TIMEOUT_MS: '5000' } });
    owner = client(state); await owner.seedAndLogin('55555');
    state.app.get(ConfigService).set('SITE_OWNER_USER_ID', owner.user.id);
  });
  afterEach(async () => { await stopApp(state); await upstream.close(); });
  async function add(content) {
    const response = await owner.request('/chat/memories', { method: 'POST', body: { content } });
    assert.equal(response.status, 201); return response.json();
  }
  const list = async () => (await owner.request('/chat/memories')).json();
  const patch = (id, body) => owner.request(`/chat/memories/${id}`, { method: 'PATCH', body });
  const remove = id => owner.request(`/chat/memories/${id}`, { method: 'DELETE' });
  async function conversation() {
    const response = await owner.request('/chat/conversations', { method: 'POST', body: {} });
    assert.equal(response.status, 201); return response.json();
  }
  const send = (id, content = '当前问题', requestId = randomUUID()) => owner.request(`/chat/conversations/${id}/stream`, { method: 'POST', body: { requestId, content, modelId: 'glm-4.7-flash' } });

  it('全部记忆入口要求Session、Owner、写请求CSRF且没有站主配置时拒绝', async () => {
    const outsider = client(state); await outsider.seedAndLogin('44444'); const id = randomUUID();
    for (const [path, method, body] of [['/chat/memories', 'GET'], ['/chat/memories', 'POST', { content: '合成偏好' }], [`/chat/memories/${id}`, 'PATCH', { enabled: false }], [`/chat/memories/${id}`, 'DELETE']]) {
      assert.equal((await client(state).request(path, { method, body })).status, 401, path);
      assert.equal((await outsider.request(path, { method, body })).status, 403, path);
      if (method !== 'GET') assert.equal((await owner.request(path, { method, body, csrf: false })).status, 403, path);
    }
    state.app.get(ConfigService).set('SITE_OWNER_USER_ID', '');
    assert.equal((await owner.request('/chat/memories')).status, 403);
    assert.equal(upstream.calls.length, 0);
  });

  it('新增默认启用、trim、公开字段与no-store，编辑排序及删除结果符合合同', async () => {
    const empty = await owner.request('/chat/memories'); assert.equal(empty.status, 200);
    assert.equal(empty.headers.get('cache-control'), 'no-store'); assert.deepEqual(await empty.json(), { memories: [] });
    const first = await add('  回答使用简体中文  '); const second = await add('保留技术术语');
    assert.deepEqual(Object.keys(first).sort(), ['content', 'createdAt', 'enabled', 'id', 'updatedAt']);
    assert.match(first.id, /^[a-f\d-]{36}$/); assert.equal(first.content, '回答使用简体中文'); assert.equal(first.enabled, true);
    assert.equal(new Date(first.createdAt).toISOString(), first.createdAt);
    // 固定旧时间后再编辑，以真实HTTP验证排序而不依赖毫秒级调度巧合。
    await state.connection.collection('chat_memories').updateOne({ ownerId: owner.user.id, 'items.id': first.id }, { $set: { 'items.$.updatedAt': new Date(0) } });
    assert.deepEqual((await list()).memories.map(item => item.id), [second.id, first.id]);
    const response = await patch(first.id, { content: '  优先使用中文  ', enabled: false });
    assert.equal(response.status, 200); assert.equal(response.headers.get('cache-control'), 'no-store');
    const edited = await response.json(); assert.equal(edited.content, '优先使用中文'); assert.equal(edited.enabled, false); assert.equal(edited.createdAt, first.createdAt);
    assert.equal((await list()).memories[0].id, first.id);
    const deleted = await remove(first.id); assert.equal(deleted.status, 200); assert.deepEqual(await deleted.json(), { id: first.id });
    assert.equal((await remove(first.id)).status, 404); assert.equal((await patch(first.id, { enabled: true })).status, 404);
    assert.deepEqual((await list()).memories.map(item => item.id), [second.id]);
  });

  it('拒绝未知字段、空白、错误类型、空PATCH、坏UUID，500个Unicode字符有效', async () => {
    for (const body of [{}, { content: '' }, { content: '  \n ' }, { content: null }, { content: 1 }, { content: ['x'] }, { content: '😀'.repeat(501) }, { content: 'x', enabled: false }, { content: 'x', ownerId: randomUUID() }, { content: 'x', id: randomUUID() }]) {
      assert.equal((await owner.request('/chat/memories', { method: 'POST', body })).status, 400, JSON.stringify(body).slice(0, 80));
    }
    const memory = await add(`  ${'😀'.repeat(500)}  `); assert.equal(Array.from(memory.content).length, 500);
    for (const body of [{}, { content: '' }, { content: null }, { content: '😀'.repeat(501) }, { enabled: null }, { enabled: 'false' }, { enabled: 0 }, { ownerId: randomUUID() }, { id: randomUUID() }]) {
      assert.equal((await patch(memory.id, body)).status, 400, JSON.stringify(body).slice(0, 80));
    }
    assert.equal((await patch('bad', { enabled: false })).status, 400); assert.equal((await remove('bad')).status, 400);
    assert.equal((await patch(randomUUID(), { enabled: false })).status, 404); assert.equal((await remove(randomUUID())).status, 404);
    assert.deepEqual((await list()).memories, [memory]);
  });

  it('每次读写按可信owner隔离，其他归属记忆不返回也不注入', async () => {
    const memory = await add('其他站主的合成偏好');
    await state.connection.collection('chat_memories').updateOne({ ownerId: owner.user.id }, { $set: { ownerId: randomUUID() } });
    assert.deepEqual(await list(), { memories: [] });
    assert.equal((await patch(memory.id, { content: '篡改' })).status, 404); assert.equal((await remove(memory.id)).status, 404);
    const own = await add('本站主偏好'); assert.deepEqual((await list()).memories, [own]);
    const convo = await conversation(); await collect(await send(convo.id));
    assert.match(upstream.calls[0].body.messages[0].content, /本站主偏好/);
    assert.equal(JSON.stringify(upstream.calls[0].body.messages).includes('其他站主的合成偏好'), false);
  });

  it('Unicode变体选择符按独立码点计数，不能让500字上限放宽到1000码点', async () => {
    // 通用Length会合并字符与变体选择符；合同和前端计数使用Array.from的Unicode码点。
    const boundary = '✈️'.repeat(250); const tooLong = `${boundary}字`;
    const memory = await add(boundary); assert.equal(Array.from(memory.content).length, 500);
    assert.equal((await owner.request('/chat/memories', { method: 'POST', body: { content: tooLong } })).status, 400);
    assert.equal((await patch(memory.id, { content: tooLong })).status, 400);
    assert.deepEqual((await list()).memories, [memory]);
  });

  it('首次并发新增最多20条，单owner唯一文档；删除后释放一个名额', async () => {
    const results = await Promise.all(Array.from({ length: 28 }, (_, index) => owner.request('/chat/memories', { method: 'POST', body: { content: `合成记忆${index}` } })));
    assert.equal(results.filter(response => response.status === 201).length, 20);
    assert.equal(results.filter(response => response.status === 400).length, 8);
    const memories = (await list()).memories; assert.equal(memories.length, 20); assert.equal(new Set(memories.map(item => item.id)).size, 20);
    assert.equal(await state.connection.collection('chat_memories').countDocuments({ ownerId: owner.user.id }), 1);
    await remove(memories[0].id); await add('回收名额'); assert.equal((await list()).memories.length, 20);
  });

  it('并行编辑只改目标字段与目标项，不覆盖其他请求的修改或删除', async () => {
    const first = await add('原内容'); const second = await add('待删除'); const third = await add('另一项');
    const responses = await Promise.all([patch(first.id, { content: '编辑后' }), patch(first.id, { enabled: false }), remove(second.id), patch(third.id, { content: '另一项编辑' }), add('并发新增')]);
    assert.ok(responses.slice(0, 4).every(response => response.status === 200));
    const memories = (await list()).memories; assert.equal(memories.length, 3);
    assert.equal(memories.find(item => item.id === first.id).content, '编辑后'); assert.equal(memories.find(item => item.id === first.id).enabled, false);
    assert.equal(memories.some(item => item.id === second.id), false); assert.equal(memories.find(item => item.id === third.id).content, '另一项编辑');
  });

  it('跨会话只注入一条启用system记忆，编辑、启停与删除只影响后续生成', async () => {
    const memory = await add('合成偏好：简洁回答'); const disabled = await add('不应注入的停用项'); await patch(disabled.id, { enabled: false });
    const first = await conversation(); const second = await conversation();
    const original = (await collect(await send(first.id, '第一问'))).at(-1).turn;
    let messages = upstream.calls.at(-1).body.messages;
    assert.equal(messages.length, 2); assert.equal(messages[0].role, 'system'); assert.match(messages[0].content, /合成偏好：简洁回答/);
    assert.match(messages[0].content, /当前用户.*优先/); assert.equal(messages[0].content.includes('不应注入的停用项'), false);
    await collect(await send(second.id, '另一会话')); assert.match(upstream.calls.at(-1).body.messages[0].content, /合成偏好：简洁回答/);
    await patch(memory.id, { content: '合成偏好：详细解释' }); await collect(await send(first.id, '第二问'));
    messages = upstream.calls.at(-1).body.messages;
    assert.equal(messages.filter(item => item.role === 'system').length, 1); assert.match(messages[0].content, /合成偏好：详细解释/); assert.equal(messages[0].content.includes('简洁回答'), false);
    assert.deepEqual(messages.slice(1), [{ role: 'user', content: '第一问' }, { role: 'assistant', content: '你好，世界' }, { role: 'user', content: '第二问' }]);
    await patch(memory.id, { enabled: false }); await collect(await send(second.id, '停用后'));
    assert.equal(upstream.calls.at(-1).body.messages.some(item => item.role === 'system'), false);
    await patch(memory.id, { enabled: true }); await collect(await send(second.id, '恢复后')); assert.equal(upstream.calls.at(-1).body.messages[0].role, 'system');
    await remove(memory.id); const third = await conversation(); await collect(await send(third.id, '删除后'));
    assert.deepEqual(upstream.calls.at(-1).body.messages, [{ role: 'user', content: '删除后' }]);
    const detail = await owner.request(`/chat/conversations/${first.id}`).then(response => response.json()); assert.deepEqual(detail.turns[0], original);
  });

  it('生成期间修改保留本轮记忆快照，重放已完成轮次不重新调用模型', async () => {
    const memory = await add('生成开始时的记忆'); const convo = await conversation(); const requestId = randomUUID();
    const iterator = events(await send(convo.id, 'hang', requestId)); await iterator.next(); await iterator.next();
    await patch(memory.id, { content: '生成期间的新记忆' });
    assert.match(upstream.calls[0].body.messages[0].content, /生成开始时的记忆/);
    await owner.request(`/chat/conversations/${convo.id}/turns/${requestId}/cancel`, { method: 'POST', body: {} });
    for await (const event of iterator) assert.equal(event.type, 'done');
    await collect(await send(convo.id, '下一轮')); assert.match(upstream.calls[1].body.messages[0].content, /生成期间的新记忆/);
    await collect(await send(convo.id, 'hang', requestId)); assert.equal(upstream.calls.length, 2);
  });

  it('记忆不挤占原最近10轮和32000字符历史预算', async () => {
    await add('参照记忆'); const convo = await conversation();
    const turns = Array.from({ length: 12 }, (_, index) => ({ requestId: randomUUID(), content: `问题${index}`, answer: `答案${index}`, modelId: 'glm-4.7-flash', modelLabel: 'GLM-4.7-Flash', status: 'completed', error: null, createdAt: new Date(), updatedAt: new Date() }));
    turns.push({ ...turns[0], requestId: randomUUID(), status: 'failed', content: '不带失败项' });
    await state.connection.collection('chat_conversations').updateOne({ ownerId: owner.user.id, id: convo.id }, { $set: { turns } });
    await collect(await send(convo.id, '新问题')); let messages = upstream.calls.at(-1).body.messages;
    assert.equal(messages.length, 22); assert.equal(messages[0].role, 'system'); assert.deepEqual(messages[1], { role: 'user', content: '问题2' });
    const large = turns.slice(0, 10).map(turn => ({ ...turn, content: '问'.repeat(4000), answer: '答'.repeat(16000) }));
    await state.connection.collection('chat_conversations').updateOne({ ownerId: owner.user.id, id: convo.id }, { $set: { turns: large } });
    await collect(await send(convo.id, '当前')); messages = upstream.calls.at(-1).body.messages;
    assert.equal(messages.length, 4); assert.equal(messages[0].role, 'system'); assert.equal(messages[1].content.length + messages[2].content.length, 20000);
  });

  it('关闭并重建应用后记忆、启用状态与同一登录会话仍恢复并用于新会话', async () => {
    const first = await add('持久化合成记忆'); const second = await add('持久化停用项'); await patch(second.id, { enabled: false });
    const expected = await list(); const databaseName = state.databaseName; const savedOwner = owner.user.id; const cookie = owner.cookie; const csrfToken = owner.csrfToken;
    await stopApp(state, { drop: false }); state = undefined;
    state = await startApp({ databaseName, config: { SITE_OWNER_USER_ID: savedOwner, GLM_API_KEY: 'fixture-key', GLM_BASE_URL: upstream.url, CHAT_MODELS_JSON: '' } });
    owner = client(state); owner.cookie = cookie; owner.csrfToken = csrfToken;
    assert.deepEqual(await list(), expected); const convo = await conversation(); await collect(await send(convo.id));
    assert.match(upstream.calls[0].body.messages[0].content, /持久化合成记忆/); assert.equal(upstream.calls[0].body.messages[0].content.includes('持久化停用项'), false);
    assert.equal((await remove(first.id)).status, 200);
  });
});
