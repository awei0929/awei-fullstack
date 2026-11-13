import assert from 'node:assert/strict';
import { beforeEach, afterEach, describe, it } from 'node:test';
import { randomUUID } from 'node:crypto';
import { ConfigService } from '@nestjs/config';
import { getModelToken } from '@nestjs/mongoose';
import { startApp, stopApp, client } from './helpers/app.mjs';
import { modelFixture, events, eventually } from './helpers/chat-fixture.mjs';

const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
const deferred = () => { let resolve; const promise = new Promise(done => { resolve = done; }); return { promise, resolve }; };
const chunk = text => `data: ${JSON.stringify({ choices: [{ delta: { content: text } }] })}\n\n`;

// 缺陷目标：阶段保存阻塞增量、保存任务无界并发、旧快照覆盖终态，以及保存失败被误报完成。
// 真正的HTTP、鉴权、Service和Mongo均保留；只在Mongo驱动边界用门闩延迟阶段保存。
// app辅助层强制随机测试库，环境显式使用27019，模型只到回环fixture，不读取真实.env。
describe('阶段保存与流式消费隔离真实HTTP', () => {
  let state, owner, upstream, response, record, originalUpdate, originalTerminal;
  const releases = [];
  beforeEach(async () => {
    upstream = await modelFixture();
    state = await startApp({ config: { GLM_API_KEY: 'fixture-key', GLM_BASE_URL: upstream.url, CHAT_MODELS_JSON: '', CHAT_TIMEOUT_MS: '5000' } });
    owner = client(state); await owner.seedAndLogin('55555'); state.app.get(ConfigService).set('SITE_OWNER_USER_ID', owner.user.id);
    record = state.app.get(getModelToken('ConversationRecord'));
    originalUpdate = record.collection.updateOne; originalTerminal = record.collection.findOneAndUpdate;
    upstream.handle(({ response: output }) => { response = output; output.writeHead(200, { 'Content-Type': 'text/event-stream' }); output.write(chunk('甲')); return true; });
  });
  afterEach(async () => {
    for (const release of releases.splice(0)) release();
    record.collection.updateOne = originalUpdate; record.collection.findOneAndUpdate = originalTerminal;
    await stopApp(state); await upstream.close();
  });
  function gate() { const value = deferred(); releases.push(value.resolve); return value; }
  async function start() {
    const created = await owner.request('/chat/conversations', { method: 'POST', body: {} });
    const conversation = await created.json(); const requestId = randomUUID(); const seen = [];
    const source = await owner.request(`/chat/conversations/${conversation.id}/stream`, { method: 'POST', body: { requestId, content: '阶段保存验收', modelId: 'glm-4.7-flash' } });
    const complete = (async () => { for await (const event of events(source)) seen.push(event); return seen; })();
    await eventually(() => seen.some(event => event.type === 'delta'), Boolean);
    return { conversation, requestId, seen, complete, answer: () => seen.filter(event => event.type === 'delta').map(event => event.text).join('') };
  }
  const detail = async id => (await owner.request(`/chat/conversations/${id}`)).json();
  const cancel = async run => (await owner.request(`/chat/conversations/${run.conversation.id}/turns/${run.requestId}/cancel`, { method: 'POST', body: {} })).json();
  function holdFirstSave({ fail = false } = {}) {
    const entered = gate(); const held = gate(); let count = 0;
    record.collection.updateOne = async function(filter, update, options) {
      if (typeof update.$set?.['turns.$.answer'] === 'string') {
        count++;
        if (count === 1) { entered.resolve(); await held.promise; if (fail) throw new Error('private database checkpoint failure'); }
      }
      return originalUpdate.call(this, filter, update, options);
    };
    return { entered, held, count: () => count };
  }

  it('阶段保存被门闩阻塞时后续增量仍到客户端，完成等待保存后落库全文', async () => {
    const save = holdFirstSave(); const run = await start(); await save.entered.promise;
    try {
      response.write(chunk('乙')); response.end(chunk('丙') + 'data: [DONE]\n\n');
      await eventually(run.answer, value => value === '甲乙丙', 700);
      assert.equal(run.seen.some(event => event.type === 'done'), false);
      assert.equal((await detail(run.conversation.id)).turns[0].status, 'streaming');
    } finally { save.held.resolve(); }
    const result = await run.complete; const last = result.at(-1).turn;
    assert.equal(last.status, 'completed'); assert.equal(last.answer, '甲乙丙');
    assert.deepEqual((await detail(run.conversation.id)).turns[0], last);
  });

  it('慢保存期间只保留最新快照，至多一个保存进行中且不回放每个旧增量', async () => {
    const first = gate(), second = gate(), entered = gate(); const snapshots = [];
    let active = 0, maximum = 0;
    record.collection.updateOne = async function(filter, update, options) {
      const answer = update.$set?.['turns.$.answer'];
      if (typeof answer !== 'string') return originalUpdate.call(this, filter, update, options);
      snapshots.push(answer); active++; maximum = Math.max(maximum, active);
      try {
        if (snapshots.length === 1) { entered.resolve(); await first.promise; }
        if (snapshots.length === 2) await second.promise;
        return await originalUpdate.call(this, filter, update, options);
      } finally { active--; }
    };
    const run = await start(); await entered.promise;
    try {
      response.write(chunk('乙')); response.write(chunk('丙')); response.write(chunk('丁'));
      await eventually(run.answer, value => value === '甲乙丙丁', 700);
      // 这里只跨过已约定250ms保存间隔；是否继续输出由上面的门闩断言验证。
      await delay(280); assert.deepEqual(snapshots, ['甲']);
      first.resolve(); await eventually(() => snapshots.length, value => value === 2);
      assert.deepEqual(snapshots, ['甲', '甲乙丙丁']); assert.equal(maximum, 1);
      response.end(chunk('戊') + 'data: [DONE]\n\n');
      await eventually(run.answer, value => value === '甲乙丙丁戊');
      assert.equal(run.seen.some(event => event.type === 'done'), false);
    } finally { first.resolve(); second.resolve(); }
    const result = await run.complete;
    assert.equal(result.at(-1).turn.answer, '甲乙丙丁戊'); assert.equal(result.at(-1).turn.status, 'completed');
    assert.equal(maximum, 1); assert.equal(snapshots.length, 2);
    assert.deepEqual((await detail(run.conversation.id)).turns[0], result.at(-1).turn);
  });

  it('上游已DONE但在途阶段保存失败时明确failed，不能先发completed或丢已收正文', async () => {
    const save = holdFirstSave({ fail: true }); const run = await start(); await save.entered.promise;
    try {
      response.end(chunk('乙') + 'data: [DONE]\n\n');
      await eventually(run.answer, value => value === '甲乙', 700);
      assert.equal(run.seen.some(event => event.type === 'done'), false);
    } finally { save.held.resolve(); }
    const result = await run.complete; const last = result.at(-1).turn;
    assert.equal(last.status, 'failed'); assert.equal(last.answer, '甲乙'); assert.match(last.error, /保存/);
    assert.equal(JSON.stringify(result).includes('private database'), false);
    assert.deepEqual((await detail(run.conversation.id)).turns[0], last);
  });

  it('上游仍挂起时阶段保存失败立即停止上游并发送失败终态', async () => {
    const save = holdFirstSave({ fail: true }); const run = await start(); await save.entered.promise;
    response.write(chunk('乙'));
    try { await eventually(run.answer, value => value === '甲乙', 700); } finally { save.held.resolve(); }
    await eventually(() => run.seen.find(event => event.type === 'done'), Boolean, 1000);
    const result = await run.complete;
    assert.equal(result.at(-1).turn.status, 'failed'); assert.equal(result.at(-1).turn.answer, '甲乙');
    await eventually(() => upstream.aborted, value => value === 1);
    assert.deepEqual((await detail(run.conversation.id)).turns[0], result.at(-1).turn);
  });

  it('保存悬挂时取消立即abort上游，终态等保存结束且旧快照不覆盖取消正文', async () => {
    const save = holdFirstSave(); const run = await start(); await save.entered.promise;
    let terminalCalls = 0;
    record.collection.findOneAndUpdate = async function(filter, update, options) {
      if (update.$set?.['turns.$.status']) terminalCalls++;
      return originalTerminal.call(this, filter, update, options);
    };
    response.write(chunk('乙'));
    let canceled;
    try {
      await eventually(run.answer, value => value === '甲乙', 700);
      canceled = cancel(run);
      await eventually(() => upstream.aborted, value => value === 1);
      assert.equal(terminalCalls, 0, '终态不能越过进行中的阶段保存');
      assert.equal(run.seen.some(event => event.type === 'done'), false);
    } finally { save.held.resolve(); }
    const last = await canceled; const result = await run.complete;
    assert.equal(last.status, 'canceled'); assert.equal(last.answer, '甲乙'); assert.equal(terminalCalls, 1);
    assert.deepEqual(result.at(-1).turn, last); assert.deepEqual((await detail(run.conversation.id)).turns[0], last);
    assert.deepEqual(await cancel(run), last);
  });

  it('超时优先锁定终态并abort，等待旧保存后不继续发送积压增量', async () => {
    state.app.get(ConfigService).set('CHAT_TIMEOUT_MS', '1000');
    const save = holdFirstSave(); const run = await start(); await save.entered.promise;
    try {
      response.write(chunk('乙')); await eventually(run.answer, value => value === '甲乙', 700);
      await eventually(() => upstream.aborted, value => value === 1, 1600);
      assert.equal(run.seen.some(event => event.type === 'done'), false);
    } finally { save.held.resolve(); }
    const result = await run.complete; const last = result.at(-1).turn;
    assert.equal(last.status, 'interrupted'); assert.match(last.error, /超时/); assert.equal(last.answer, '甲乙');
    assert.deepEqual((await detail(run.conversation.id)).turns[0], last);
  });

  for (const entry of ['detail', 'list', 'cancel']) it(`终态等待保存跨截止时间时${entry}恢复检查不抢占本进程结算或丢正文`, async () => {
    state.app.get(ConfigService).set('CHAT_TIMEOUT_MS', '1000');
    const save = holdFirstSave(); const run = await start(); await save.entered.promise;
    let canceled; const originalRecover = record.collection.updateMany;
    try {
      response.end(chunk('乙') + 'data: [DONE]\n\n');
      await eventually(run.answer, value => value === '甲乙', 700);
      // 必须让数据库expiresAt真实到期，复现读/取消入口误将仍在结算的本进程run视为遗留记录。
      const stored = await state.connection.collection('chat_conversations').findOne({ id: run.conversation.id });
      await delay(Math.max(0, stored.expiresAt.getTime() - Date.now()) + 80);
      if (entry === 'detail') await detail(run.conversation.id);
      else if (entry === 'list') assert.equal((await owner.request('/chat/conversations')).status, 200);
      else {
        const reached = gate();
        record.collection.updateMany = async function(...args) { const result = await originalRecover.apply(this, args); reached.resolve(); return result; };
        canceled = cancel(run); await reached.promise;
      }
      const settling = await state.connection.collection('chat_conversations').findOne({ id: run.conversation.id });
      assert.equal(settling.turns[0].status, 'streaming', 'recover不能越过本进程已经锁定的终态');
      assert.equal(run.seen.some(event => event.type === 'done'), false);
    } finally { record.collection.updateMany = originalRecover; save.held.resolve(); }
    const result = await run.complete; const last = result.at(-1).turn;
    assert.equal(last.status, 'completed'); assert.equal(last.answer, '甲乙'); assert.equal(last.error, null);
    if (canceled) assert.deepEqual(await canceled, last, '先到的完成决定优于迟到取消');
    assert.deepEqual((await detail(run.conversation.id)).turns[0], last);
  });

  it('本进程没有运行句柄的孤立过期记录仍会恢复，保留已存正文且不重调模型', async () => {
    const run = await start(); response.end('data: [DONE]\n\n'); await run.complete;
    // 保留该实例写下的runtimeId，只制造没有内存run的过期记录，防止修复误跳过同runtime的全部恢复。
    await state.connection.collection('chat_conversations').updateOne({ id: run.conversation.id }, { $set: { active: true, expiresAt: new Date(0), 'turns.0.status': 'streaming', 'turns.0.answer': '孤立记录正文', 'turns.0.error': null } });
    const found = (await detail(run.conversation.id)).turns[0];
    assert.equal(found.status, 'interrupted'); assert.equal(found.answer, '孤立记录正文'); assert.match(found.error, /中断/);
    assert.equal(upstream.calls.length, 1);
  });
});
