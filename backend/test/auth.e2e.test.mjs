import assert from 'node:assert/strict';
import { beforeEach, afterEach, describe, it } from 'node:test';
import { randomUUID } from 'node:crypto';
import { startApp, stopApp, client } from './helpers/app.mjs';

// 通过真实HTTP请求覆盖完整链路，检查的不只是Service返回值，还包括Cookie、Guard与状态码。
// 每个用例使用独立临时库，afterEach即使断言失败也会执行清理。
describe('真实会话、认证和任务隔离 HTTP', () => {
  let state;
  beforeEach(async () => { state = await startApp(); });
  afterEach(async () => { await stopApp(state); });

  it('游客只看到稳定三条示例，个人接口先拒绝身份且历史无主任务保留', async () => {
    const visitor = client(state);
    const legacy = { id: randomUUID(), title: '历史私有内容', completed: false, createdAt: new Date() };
    await state.connection.collection('tasks').insertOne(legacy);
    for (const path of ['/tasks', '/stats']) assert.equal((await visitor.request(path)).status, 401);
    assert.equal((await visitor.request('/tasks/bad', { method: 'PUT', body: { title: 1 } })).status, 401);
    const publicTasks = await visitor.request('/public/tasks').then(r => r.json());
    assert.equal(publicTasks.length, 3);
    assert.ok(publicTasks.every(t => t.completed === false && t.id !== legacy.id));
    assert.deepEqual(await visitor.request('/public/tasks').then(r => r.json()), publicTasks);
    assert.equal((await visitor.request('/public/stats').then(r => r.json())).total, 3);
    await visitor.register();
    assert.deepEqual(await visitor.request('/tasks').then(r => r.json()), []);
    assert.equal(await state.connection.collection('tasks').countDocuments({ id: legacy.id }), 1);
  });

  it('匿名令牌、注册换ID/令牌、Cookie属性、恢复和公开字段符合合同', async () => {
    const a = client(state);
    const initial = await a.request('/auth/session');
    assert.equal(initial.status, 200);
    const view = await initial.json();
    assert.deepEqual(Object.keys(view).sort(), ['csrfToken', 'user']);
    assert.equal(view.user, null);
    assert.ok(view.csrfToken.length >= 32);
    const cookie = initial.headers.get('set-cookie');
    assert.match(cookie, /^nest\.sid=/);
    assert.match(cookie, /HttpOnly/);
    assert.match(cookie, /SameSite=Lax/);
    assert.match(cookie, /Path=\//);
    assert.doesNotMatch(cookie, /Domain=/);
    assert.equal(initial.headers.get('cache-control'), 'no-store');
    const oldCookie = a.cookie;
    a.csrfToken = view.csrfToken;
    const response = await a.request('/auth/register', { method: 'POST', body: { account: '00123', password: '  pass word  ' } });
    assert.equal(response.status, 201);
    const registered = await response.json();
    assert.equal(registered.user.account, '00123');
    assert.deepEqual(Object.keys(registered.user).sort(), ['account', 'id']);
    assert.match(registered.user.id, /^[a-f\d-]{36}$/);
    assert.notEqual(a.cookie, oldCookie);
    assert.notEqual(registered.csrfToken, view.csrfToken);
    assert.deepEqual(await a.session(), registered);
    assert.equal((await client(state).request('/tasks', { headers: { Cookie: oldCookie } })).status, 401);
    const stored = await state.connection.collection('users').findOne({ account: '00123' });
    assert.match(stored.passwordHash, /^\$argon2id\$v=19\$m=19456,t=2,p=1\$/);
    assert.equal('password' in stored, false);
  });

  it('接受3/4/5位和前导零不同账号以及8/64字符密码边界', async () => {
    // 123 与 00123 是不同账号；同时覆盖最短、最长及中间长度，不能把账号转成数字。
    for (const [account, password] of [['123', 'a'.repeat(8)], ['00123', 'b'.repeat(64)], ['1234', 'password123'], ['12345', ' abcdef ']]) {
      const a = client(state);
      assert.equal((await a.register(account, password)).user.account, account);
    }
    assert.equal(await state.connection.collection('users').countDocuments(), 4);
  });

  it('账号/密码非法类型、空格、Unicode、长度和额外字段全部400且不创建用户', async () => {
    const a = client(state);
    await a.session();
    const invalid = [
      ...['', '1', '12', '123456', ' 123', '123 ', '１２３', '١٢٣', '+12', '1.2', 123, null].map(account => ({ account, password: 'password123' })),
      ...['', 'a'.repeat(7), 'a'.repeat(65), 12345678, null].map(password => ({ account: '123', password })),
      { account: '123', password: 'password123', role: 'admin' }, {},
    ];
    for (const body of invalid) {
      for (const endpoint of ['register', 'login']) {
        const response = await a.request(`/auth/${endpoint}`, { method: 'POST', body });
        assert.equal(response.status, 400, JSON.stringify(body));
      }
    }
    assert.equal(await state.connection.collection('users').countDocuments(), 0);
    assert.equal((await a.session()).user, null);
  });

  it('顺序与并发重复注册只有一个成功，失败不建立登录', async () => {
    const users = Array.from({ length: 5 }, () => client(state));
    // 同时注册同一个账号，验证Mongo唯一索引真正处理并发，而不是只测试先查再写的顺序场景。
    await Promise.all(users.map(a => a.session()));
    const results = await Promise.all(users.map(a => a.request('/auth/register', { method: 'POST', body: { account: '222', password: 'password123' } })));
    assert.deepEqual(results.map(r => r.status).sort(), [201, 409, 409, 409, 409]);
    const loser = users[results.findIndex(r => r.status === 409)];
    assert.equal((await loser.session()).user, null);
    assert.equal((await loser.request('/auth/register', { method: 'POST', body: { account: '222', password: 'password123' } })).status, 409);
    assert.equal(await state.connection.collection('users').countDocuments({ account: '222' }), 1);
  });

  it('错误登录统一401，正确登录重建会话且密码不trim', async () => {
    await client(state).register('001', ' password ');
    const a = client(state);
    await a.session();
    for (const body of [{ account: '001', password: 'password' }, { account: '999', password: 'password' }]) {
      const response = await a.request('/auth/login', { method: 'POST', body });
      assert.equal(response.status, 401);
      assert.equal((await response.json()).message, '账号或密码错误');
    }
    const oldCookie = a.cookie;
    const oldToken = a.csrfToken;
    const response = await a.request('/auth/login', { method: 'POST', body: { account: '001', password: ' password ' } });
    assert.equal(response.status, 200);
    const view = await response.json();
    assert.equal(view.user.account, '001');
    assert.notEqual(a.cookie, oldCookie);
    assert.notEqual(view.csrfToken, oldToken);
  });

  it('所有认证与任务写接口拒绝缺失、错误和另一会话的CSRF', async () => {
    const a = client(state), b = client(state);
    await a.register(); await b.session();
    const task = await a.request('/tasks', { method: 'POST', body: { title: '保留' } }).then(r => r.json());
    const writes = [
      ['/auth/register', 'POST', { account: '456', password: 'password123' }],
      ['/auth/login', 'POST', { account: '123', password: 'password123' }],
      ['/auth/logout', 'POST'], ['/tasks', 'POST', { title: '拒绝' }],
      [`/tasks/${task.id}`, 'PUT', { title: '拒绝' }], [`/tasks/${task.id}`, 'DELETE'],
    ];
    for (const token of [null, 'wrong', b.csrfToken]) {
      for (const [path, method, body] of writes) {
        const r = await a.request(path, { method, body, csrf: false, headers: token ? { 'X-CSRF-Token': token } : {} });
        assert.equal(r.status, 403, `${path} ${token}`);
        assert.equal(r.headers.get('cache-control'), 'no-store');
      }
    }
    assert.deepEqual(await a.request('/tasks').then(r => r.json()), [task]);
    assert.equal(await state.connection.collection('users').countDocuments(), 1);
  });

  it('A/B CRUD和统计隔离；外来任务404；伪造归属400', async () => {
    const a = client(state), b = client(state);
    await a.register('101'); await b.register('202');
    const own = await a.request('/tasks', { method: 'POST', body: { title: 'A' } }).then(r => r.json());
    const other = await b.request('/tasks', { method: 'POST', body: { title: 'B' } }).then(r => r.json());
    assert.deepEqual(await a.request('/tasks').then(r => r.json()), [own]);
    assert.deepEqual(await b.request('/tasks').then(r => r.json()), [other]);
    for (const method of ['PUT', 'DELETE']) assert.equal((await a.request(`/tasks/${other.id}`, { method, ...(method === 'PUT' ? { body: { title: 'steal' } } : {}) })).status, 404);
    for (const extra of [{ ownerId: b.user.id }, { userId: b.user.id }, { role: 'admin' }]) {
      assert.equal((await a.request('/tasks', { method: 'POST', body: { title: 'forge', ...extra } })).status, 400);
      assert.equal((await a.request(`/tasks/${own.id}`, { method: 'PUT', body: { title: 'forge', ...extra } })).status, 400);
    }
    assert.equal((await a.request('/stats').then(r => r.json())).total, 1);
    assert.equal((await b.request('/stats').then(r => r.json())).total, 1);
    assert.equal((await a.request(`/tasks/${own.id}`, { method: 'DELETE' })).status, 200);
    assert.equal((await a.request('/stats').then(r => r.json())).total, 0);
    assert.deepEqual(await b.request('/tasks').then(r => r.json()), [other]);
  });

  it('退出销毁服务端会话；旧cookie拒绝；已开始的只读请求不能复活会话', async (t) => {
    const { TasksService } = await import('../dist/tasks/tasks.service.js');
    const a = client(state); await a.register();
    let release, entered;
    const started = new Promise(resolve => { entered = resolve; });
    const delayed = new Promise(resolve => { release = resolve; });
    const service = state.app.get(TasksService);
    const findAll = service.findAll.bind(service);
    t.mock.method(service, 'findAll', async (...args) => { entered(); await delayed; return findAll(...args); });
    const oldCookie = a.cookie;
    const pending = a.request('/tasks');
    await started;
    const logout = await a.request('/auth/logout', { method: 'POST' });
    assert.equal(logout.status, 200);
    assert.deepEqual(await logout.json(), { success: true });
    assert.match(logout.headers.get('set-cookie'), /Expires=Thu, 01 Jan 1970/);
    release(); await pending;
    assert.equal((await client(state).request('/tasks', { headers: { Cookie: oldCookie } })).status, 401);
    assert.equal((await a.session()).user, null);
  });

  it('绝对有效期到期即拒绝，即使Mongo TTL尚未清理', async () => {
    const a = client(state); await a.register();
    const collection = state.connection.collection('sessions');
    const record = await collection.findOne({});
    const data = typeof record.session === 'string' ? JSON.parse(record.session) : record.session;
    const before = data.authExpiresAt;
    assert.ok(before > Date.now() + 6 * 86400000);
    await a.request('/tasks');
    const after = await collection.findOne({ _id: record._id });
    assert.equal((typeof after.session === 'string' ? JSON.parse(after.session) : after.session).authExpiresAt, before);
    data.authExpiresAt = Date.now() - 1;
    await collection.updateOne({ _id: record._id }, { $set: { session: typeof record.session === 'string' ? JSON.stringify(data) : data, expires: new Date(Date.now() + 86400000) } });
    assert.equal((await a.request('/tasks')).status, 401);
    assert.equal((await a.session()).user, null);
  });

  it('关闭并重建应用和Mongo连接后原会话、令牌与任务仍恢复', async () => {
    const a = client(state); const view = await a.register();
    const task = await a.request('/tasks', { method: 'POST', body: { title: '重启保留' } }).then(r => r.json());
    const previous = state;
    await stopApp(previous, { drop: false });
    state = await startApp({ databaseName: previous.databaseName });
    const restored = client(state); restored.cookie = a.cookie;
    assert.deepEqual(await restored.session(), view);
    assert.deepEqual(await restored.request('/tasks').then(r => r.json()), [task]);
    assert.notEqual(state.app, previous.app);
    assert.notEqual(state.connection, previous.connection);
  });

  it('IP登录/注册合计原子限流且伪造转发头无法绕过', async () => {
    state.app.get((await import('@nestjs/config')).ConfigService).set('AUTH_IP_LIMIT', '3');
    const a = client(state); await a.session();
    const results = await Promise.all(Array.from({ length: 6 }, (_, i) => a.request(i % 2 ? '/auth/login' : '/auth/register', {
      method: 'POST', body: { account: 'invalid', password: 'password123' }, headers: { 'X-Forwarded-For': `192.0.2.${i}` },
    })));
    assert.deepEqual(results.map(r => r.status).sort(), [400, 400, 400, 429, 429, 429]);
    for (const r of results.filter(r => r.status === 429)) assert.ok(Number(r.headers.get('retry-after')) > 0);
  });

  it('存储读取与退出失败返回500；不能伪装匿名或退出成功', async (t) => {
    const { default: MongoStore } = await import('connect-mongo');
    const a = client(state); await a.register();
    const cookie = a.cookie;
    const get = t.mock.method(MongoStore.prototype, 'get', (_id, callback) => callback(new Error('storage offline')));
    const restore = await a.request('/auth/session');
    assert.equal(restore.status, 500);
    assert.equal((await restore.json()).message, 'Internal server error');
    get.mock.restore();
    const destroy = t.mock.method(MongoStore.prototype, 'destroy', (_id, callback) => callback(new Error('storage offline')));
    const logout = await a.request('/auth/logout', { method: 'POST' });
    assert.equal(logout.status, 500);
    assert.equal(logout.headers.get('set-cookie'), null);
    destroy.mock.restore();
    a.cookie = cookie;
    assert.equal((await a.session()).user.account, '123');
  });

  it('Session首次保存失败不会被响应结束自动重试，已落库后回调失败也撤销身份', async (t) => {
    const { default: MongoStore } = await import('connect-mongo');
    await client(state).register('123');
    for (const endpoint of ['/auth/register', '/auth/login', '/auth/session']) {
      for (const writeBeforeError of [false, true]) {
        const a = client(state);
        if (endpoint !== '/auth/session') await a.session();
        const realSet = MongoStore.prototype.set;
        let failedSid;
        const patch = t.mock.method(MongoStore.prototype, 'set', function (sid, data, callback) {
          if (failedSid) return realSet.call(this, sid, data, callback);
          failedSid = sid;
          if (writeBeforeError) {
            return realSet.call(this, sid, data, error => callback(error ?? new Error('write acknowledgement lost')));
          }
          callback(new Error('transient write failed'));
        });
        const response = await a.request(endpoint, endpoint === '/auth/session' ? {} : {
          method: 'POST', body: { account: endpoint === '/auth/register' ? (writeBeforeError ? '457' : '456') : '123', password: 'password123' },
        });
        patch.mock.restore();
        assert.equal(response.status, 500, endpoint);
        assert.equal(response.headers.get('set-cookie'), null, `${endpoint}: failed save must not issue cookie`);
        assert.equal(await state.connection.collection('sessions').countDocuments({ _id: failedSid }), 0, `${endpoint}: failed session must be removed`);
        assert.equal((await a.session()).user, null, `${endpoint}: response failure must not log in`);
      }
    }
  });

  it('密码按Unicode码点计数，变体选择符不被合并或删除', async () => {
    for (const [account, password] of [['401', '❤️'.repeat(4)], ['402', '❤️'.repeat(32)]]) {
      const a = client(state);
      await a.register(account, password);
      const b = client(state); await b.session();
      assert.equal((await b.request('/auth/login', { method: 'POST', body: { account, password } })).status, 200);
    }
    const c = client(state); await c.session();
    for (const password of ['❤️'.repeat(3), '❤️'.repeat(33)]) {
      assert.equal((await c.request('/auth/register', { method: 'POST', body: { account: '403', password } })).status, 400);
    }
    assert.equal(await state.connection.collection('users').countDocuments({ account: '403' }), 0);
  });

  it('登录路径大小写和尾斜杠别名共享账号限流，不能绕过第三次限制', async () => {
    state.app.get((await import('@nestjs/config')).ConfigService).set('AUTH_ACCOUNT_LIMIT', '2');
    const a = client(state); await a.session();
    const paths = ['/api/auth/login', '/api/auth/login/', '/API/AUTH/LOGIN'];
    const statuses = [];
    for (const path of paths) {
      const response = await fetch(`${state.baseUrl}${path}`, {
        method: 'POST', headers: { Cookie: a.cookie, 'X-CSRF-Token': a.csrfToken, 'Content-Type': 'application/json' },
        body: JSON.stringify({ account: '999', password: 'password123' }),
      });
      statuses.push(response.status);
    }
    assert.deepEqual(statuses, [401, 401, 429]);
  });

  it('认证与私有路由大小写/尾斜杠别名均禁止缓存', async () => {
    const a = client(state); await a.register();
    for (const path of ['/api/auth/session', '/api/auth/session/', '/API/AUTH/SESSION', '/API/TASKS', '/api/tasks/', '/API/STATS', '/api/stats/']) {
      const response = await fetch(`${state.baseUrl}${path}`, { headers: { Cookie: a.cookie } });
      assert.equal(response.status, 200, path);
      assert.equal(response.headers.get('cache-control'), 'no-store', path);
    }
  });

  it('登录账号计数原子限流，窗口过期后恢复', async () => {
    const config = state.app.get((await import('@nestjs/config')).ConfigService);
    config.set('AUTH_ACCOUNT_LIMIT', '2');
    config.set('AUTH_RATE_WINDOW_MS', '200');
    const a = client(state); await a.session();
    const request = () => a.request('/auth/login', { method: 'POST', body: { account: '999', password: 'password123' } });
    const results = await Promise.all([request(), request(), request(), request()]);
    assert.deepEqual(results.map(r => r.status).sort(), [401, 401, 429, 429]);
    await new Promise(resolve => setTimeout(resolve, 250));
    assert.equal((await request()).status, 401);
  });
});


// 配置同样属于安全边界：启动失败、生产Secure Cookie与代理信任均需实际启动验证。
describe('认证配置边界', () => {
  it('拒绝缺失/短密钥、非法正整数、超过7天期限与宽泛代理布尔配置', async () => {
    for (const config of [
      { SESSION_SECRET: '' }, { SESSION_SECRET: 'short' },
      { SESSION_MAX_AGE_MS: '0' }, { SESSION_MAX_AGE_MS: '604800001' },
      { AUTH_IP_LIMIT: '-1' }, { AUTH_ACCOUNT_LIMIT: '1.5' },
      { AUTH_RATE_WINDOW_MS: 'not-a-number' }, { TRUST_PROXY: 'true' },
    ]) {
      let unexpected;
      try { await assert.rejects(async () => { unexpected = await startApp({ config }); }); }
      finally { if (unexpected) await stopApp(unexpected); }
    }
  });

  it('生产Cookie仅在显式可信HTTPS代理下发送并带Secure', async () => {
    const app = await startApp({ config: { NODE_ENV: 'production', TRUST_PROXY: 'loopback' } });
    try {
      const a = client(app);
      assert.equal((await a.request('/auth/session')).headers.get('set-cookie'), null);
      const response = await a.request('/auth/session', { headers: { 'X-Forwarded-Proto': 'https' } });
      assert.equal(response.status, 200);
      assert.match(response.headers.get('set-cookie'), /; Secure/);
      assert.match(response.headers.get('set-cookie'), /; HttpOnly/);
    } finally { await stopApp(app); }
  });
});
