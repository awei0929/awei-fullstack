import assert from 'node:assert/strict';
import { afterEach, beforeEach, describe, it } from 'node:test';
import { randomUUID } from 'node:crypto';
import { ConfigService } from '@nestjs/config';
import { startApp, stopApp, client } from './helpers/app.mjs';
import { modelFixture, collect, eventually } from './helpers/chat-fixture.mjs';

// 对话日志的目标不是重测聊天协议，而是验证每条真实链路都能留下可查询的观测记录：
// 公开入口、站主入口、成功终态、失败终态，以及管理端只允许站主读取。
describe('对话日志真实HTTP', () => {
  let state, upstream, owner;
  const visitor = '77777777-7777-4777-8777-777777777777';

  beforeEach(async () => {
    upstream = await modelFixture();
    state = await startApp({ config: { GLM_API_KEY: 'fixture-key', GLM_BASE_URL: upstream.url, CHAT_MODELS_JSON: '', CHAT_TIMEOUT_MS: '1000' } });
    owner = client(state);
    await owner.seedAndLogin('55555');
    state.app.get(ConfigService).set('SITE_OWNER_USER_ID', owner.user.id);
  });
  afterEach(async () => { await stopApp(state); await upstream.close(); });

  const publicTurn = (message) => fetch(`${state.baseUrl}/api/site-chat/conversations`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Visitor-Id': visitor },
    body: JSON.stringify({ requestId: randomUUID(), message }),
  });

  const ownerTurn = async (conversationId, content) => {
    const response = await owner.request(`/chat/conversations/${conversationId}/stream`, {
      method: 'POST',
      body: { requestId: randomUUID(), content, modelId: 'glm-4.7-flash' },
    });
    assert.equal(response.status, 200);
    return collect(response);
  };

  it('成功与失败轮次都记录提问、回答、耗时、错误，且只允许站主查询', async () => {
    const site = await publicTurn('公开问题');
    assert.equal(site.status, 200);
    await collect(site);

    const created = await owner.request('/chat/conversations', { method: 'POST', body: {} });
    assert.equal(created.status, 201);
    const conversation = await created.json();
    await ownerTurn(conversation.id, '站主问题');

    const failed = await publicTurn('http-500');
    assert.equal(failed.status, 200);
    const failedEvents = await collect(failed);
    assert.equal(failedEvents.at(-1).type, 'error');

    // 终态日志在响应结束前后异步落库，轮询到三条都出现再断言，避免读写在时间上的竞态。
    const page = await eventually(
      () => owner.request('/chat-logs?limit=10').then(response => response.json()),
      value => value.total === 3,
    );
    assert.equal(page.limit, 10);
    assert.equal(page.offset, 0);
    assert.equal(page.logs.length, 3);
    for (const log of page.logs) {
      assert.ok(['site', 'owner'].includes(log.channel));
      assert.ok(typeof log.question === 'string' && log.question.length > 0);
      assert.equal(typeof log.answer, 'string');
      assert.ok(Number.isInteger(log.durationMs) && log.durationMs >= 0);
      assert.ok(!Number.isNaN(Date.parse(log.startedAt)));
      assert.ok(Date.parse(log.finishedAt) >= Date.parse(log.startedAt));
      assert.equal('visitorHash' in log, false);
      assert.equal('ip' in log, false);
    }

    const siteCompleted = page.logs.find(log => log.question === '公开问题');
    assert.equal(siteCompleted.channel, 'site');
    assert.equal(siteCompleted.answer, '你好，世界');
    assert.equal(siteCompleted.status, 'completed');
    assert.equal(siteCompleted.error, null);
    assert.ok(siteCompleted.conversationId);
    assert.ok(siteCompleted.turnId);

    const ownerCompleted = page.logs.find(log => log.question === '站主问题');
    assert.equal(ownerCompleted.channel, 'owner');
    assert.equal(ownerCompleted.answer, '你好，世界');
    assert.equal(ownerCompleted.status, 'completed');
    assert.equal(ownerCompleted.error, null);

    const siteFailed = page.logs.find(log => log.question === 'http-500');
    assert.equal(siteFailed.status, 'failed');
    assert.equal(siteFailed.answer, '');
    assert.ok(siteFailed.error);
    assert.equal(JSON.stringify(siteFailed).includes('secret upstream diagnostic'), false);

    // 详情接口补足列表不返回的执行轨迹；公开对话应由 LangGraph 节点和模型调用组成。
    const siteDetail = await eventually(
      () => owner.request(`/chat-logs/${siteCompleted.id}`).then(response => response.json()),
      value => value.trace?.some(event => event.stage === 'stream' && event.status === 'completed'),
    );
    assert.equal(siteDetail.id, siteCompleted.id);
    assert.ok(siteDetail.modelId);
    assert.ok(siteDetail.requestedModelId);
    assert.ok(siteDetail.trace.some(event => event.stage === 'agent.loadConversation'));
    assert.ok(siteDetail.trace.some(event => event.stage === 'agent.buildContext'));
    assert.ok(siteDetail.trace.some(event => event.stage === 'agent.agent'));
    assert.ok(siteDetail.trace.some(event => event.stage === 'model.request' && event.status === 'completed'));
    assert.ok(siteDetail.trace.some(event => event.stage === 'model.firstToken'));
    for (const event of siteDetail.trace) {
      assert.ok(!Number.isNaN(Date.parse(event.at)));
      assert.ok(['started', 'completed', 'failed'].includes(event.status));
    }

    const ownerDetail = await eventually(
      () => owner.request(`/chat-logs/${ownerCompleted.id}`).then(response => response.json()),
      value => value.trace?.some(event => event.stage === 'stream' && event.status === 'completed'),
    );
    assert.equal(ownerDetail.channel, 'owner');
    assert.ok(ownerDetail.trace.some(event => event.stage === 'model.request'));
    assert.equal(ownerDetail.trace.some(event => event.stage.startsWith('agent.')), false);

    const siteOnly = await owner.request('/chat-logs?channel=site').then(response => response.json());
    assert.equal(siteOnly.total, 2);
    const failedOnly = await owner.request('/chat-logs?status=failed').then(response => response.json());
    assert.equal(failedOnly.total, 1);
    const secondPage = await owner.request('/chat-logs?limit=1&offset=1').then(response => response.json());
    assert.equal(secondPage.total, 3);
    assert.equal(secondPage.logs.length, 1);

    assert.equal((await client(state).request('/chat-logs')).status, 401);
    const outsider = client(state);
    await outsider.seedAndLogin('44444');
    assert.equal((await outsider.request('/chat-logs')).status, 403);
    assert.equal((await owner.request('/chat-logs?limit=0')).status, 400);
    assert.equal((await owner.request('/chat-logs?channel=other')).status, 400);
    assert.equal((await owner.request('/chat-logs/not-a-uuid')).status, 400);
    assert.equal((await client(state).request(`/chat-logs/${siteCompleted.id}`)).status, 401);
  });
});
