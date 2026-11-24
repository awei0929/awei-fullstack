import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { afterEach, beforeEach, describe, it } from 'node:test';
import { startApp, stopApp } from './helpers/app.mjs';
import { modelFixture } from './helpers/chat-fixture.mjs';

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
});
