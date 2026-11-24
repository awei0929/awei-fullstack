import 'reflect-metadata';
import assert from 'node:assert/strict';
import { afterEach, beforeEach, describe, it } from 'node:test';
import { startApp, stopApp, client } from './helpers/app.mjs';
import { JobsWorker } from '../dist/queue/jobs.worker.js';

// 关闭自动轮询但保留快速处理节奏，测试可用 pollOnce() 精确驱动作业推进。
const manualConfig = {
  QUEUE_WORKER_ENABLED: 'false',
  QUEUE_POLL_INTERVAL_MS: '100000',
  QUEUE_JOB_STEP_MS: '50',
  QUEUE_JOB_STEPS: '4',
  QUEUE_JOB_LEASE_MS: '5000',
};

// 重启恢复用：打开自动轮询，新进程应主动领取遗留作业。
const autoConfig = {
  QUEUE_WORKER_ENABLED: 'true',
  QUEUE_POLL_INTERVAL_MS: '10',
  QUEUE_JOB_STEP_MS: '50',
  QUEUE_JOB_STEPS: '4',
  QUEUE_JOB_LEASE_MS: '5000',
};

async function listJobs(viewer) {
  const response = await viewer.request('/jobs');
  assert.equal(response.status, 200);
  return response.json();
}

async function waitForJob(viewer, id, expected = 'done') {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    const jobs = await listJobs(viewer);
    const job = jobs.find((item) => item.id === id);
    if (job?.status === expected) return job;
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
  assert.fail(`作业 ${id} 未在限定时间内达到 ${expected}`);
}

// 这些测试沿用真实 AppModule、Session、CSRF 与临时 MongoDB，不绕过守卫或 Service。
describe('异步作业队列 HTTP 接口', () => {
  let state;
  let app;
  let user;

  beforeEach(async () => {
    state = await startApp({ config: manualConfig });
    app = state.app;
    user = client(state);
    await user.seedAndLogin();
  });

  afterEach(async () => { await stopApp(state); });

  it('受理返回 202，作业按 pending → running → done 推进且视图不含内部字段', async () => {
    const response = await user.request('/jobs', { method: 'POST', body: { label: '  演示作业  ' } });
    assert.equal(response.status, 202);
    assert.equal(response.headers.get('cache-control'), 'no-store');
    const created = await response.json();
    assert.equal(created.label, '演示作业');
    assert.equal(created.status, 'pending');
    assert.equal(created.progress, 0);
    assert.match(created.id, /^[a-f\d-]{36}$/);
    for (const internal of ['ownerId', 'leaseUntil', 'attempt', '_id']) {
      assert.equal(internal in created, false);
    }
    assert.deepEqual(await listJobs(user), [created]);

    await app.get(JobsWorker).pollOnce();
    const running = await waitForJob(user, created.id, 'running');
    assert.ok(running.startedAt);
    assert.ok(running.progress >= 0 && running.progress < 100);

    const done = await waitForJob(user, created.id);
    assert.equal(done.progress, 100);
    assert.equal(done.error, null);
    assert.match(done.result, /演示作业/);
    assert.ok(done.finishedAt);
  });

  it('匿名访问、错误 CSRF 与非法输入均被拒绝且不写入作业', async () => {
    const anonymous = client(state);
    assert.equal((await anonymous.request('/jobs')).status, 401);
    assert.equal((await anonymous.request('/jobs', { method: 'POST', body: { label: 'x' }, csrf: false })).status, 401);

    assert.equal((await user.request('/jobs', { method: 'POST', body: { label: 'x' }, csrf: false })).status, 403);
    assert.equal((await user.request('/jobs', {
      method: 'POST', body: { label: 'x' }, headers: { 'X-CSRF-Token': 'wrong-token' },
    })).status, 403);

    for (const body of [
      {}, { label: '' }, { label: '   ' }, { label: 42 }, { label: 'a'.repeat(81) }, { label: 'x', ownerId: 'other' },
    ]) {
      const response = await user.request('/jobs', { method: 'POST', body });
      assert.equal(response.status, 400);
      await response.json();
    }
    assert.deepEqual(await listJobs(user), []);
  });

  it('作业只属于提交者，另一个账号无法读取', async () => {
    const created = await user.request('/jobs', { method: 'POST', body: { label: '账号 A 的作业' } }).then((r) => r.json());
    const other = client(state);
    await other.seedAndLogin('456', 'password456');
    assert.deepEqual(await listJobs(other), []);
    // 列表接口不提供按 id 查询，其他用户不能通过猜测 id 获取内容。
    assert.equal((await other.request('/jobs')).status, 200);
    assert.equal((await listJobs(user)).some((job) => job.id === created.id), true);
  });

  it('模拟遗留的过期 running 作业，重启后继续处理且已完成作业不重复执行', async () => {
    const created = await user.request('/jobs', { method: 'POST', body: { label: '重启恢复作业' } }).then((r) => r.json());
    const collection = state.connection.collection('demo_jobs');
    assert.equal((await collection.findOne({ id: created.id })).attempt, 0);

    // 直接写入遗留状态，模拟进程被强杀时来不及释放租约的场景。
    await collection.updateOne(
      { id: created.id },
      { $set: { status: 'running', leaseUntil: new Date(Date.now() - 1000), startedAt: new Date(), progress: 20 } },
    );
    const original = state;
    await stopApp(original, { drop: false });

    state = await startApp({ databaseName: original.databaseName, config: autoConfig });
    app = state.app;
    const resumed = client(state);
    resumed.cookie = user.cookie;
    await resumed.session();

    const done = await waitForJob(resumed, created.id);
    assert.equal(done.status, 'done');
    assert.equal(done.progress, 100);
    assert.equal((await state.connection.collection('demo_jobs').findOne({ id: created.id })).attempt, 1);

    // 再驱动一次轮询，终态作业不应被重新领取。
    await app.get(JobsWorker).pollOnce();
    await new Promise((resolve) => setTimeout(resolve, 40));
    assert.equal((await state.connection.collection('demo_jobs').findOne({ id: created.id })).attempt, 1);
  });
});
