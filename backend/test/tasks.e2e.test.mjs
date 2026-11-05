import 'reflect-metadata';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { afterEach, beforeEach, describe, it } from 'node:test';
import { HttpException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { getConnectionToken } from '@nestjs/mongoose';
import { Test } from '@nestjs/testing';
import { createConnection } from 'mongoose';
import { AppModule } from '../dist/app.module.js';
import { configureApp } from '../dist/app.setup.js';
import { TASK_WRITE_DEMO_KEY } from '../dist/tasks/guards/task-write.guard.js';
import { TasksService } from '../dist/tasks/tasks.service.js';

const writeHeaders = { 'X-Learning-Key': TASK_WRITE_DEMO_KEY };

describe('任务 HTTP 接口', () => {
  let app;
  let baseUrl;
  let connection;
  let testDatabaseName;

  beforeEach(async () => {
    app = undefined;
    connection = undefined;
    // 每个用例使用独立的临时数据库，不依赖“重启后内存清空”，也不修改 awei 数据库。
    testDatabaseName = `awei_e2e_${randomUUID().replaceAll('-', '')}`;
    const testingModule = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(getConnectionToken())
      .useFactory({
        inject: [ConfigService],
        factory: async (configService) => {
          connection = await createConnection(configService.getOrThrow('MONGODB_URI'), {
            dbName: testDatabaseName,
            serverSelectionTimeoutMS: 5000,
          }).asPromise();
          return connection;
        },
      })
      .compile();
    app = testingModule.createNestApplication({ logger: false });
    configureApp(app);
    await app.listen(0, '127.0.0.1');
    baseUrl = await app.getUrl();
  });

  afterEach(async () => {
    try {
      if (connection) {
        // 只清理本用例随机生成的数据库，连接不匹配时直接报错。
        assert.equal(connection.name, testDatabaseName);
        await connection.dropDatabase();
      }
    } finally {
      if (app) await app.close();
      else await connection?.close();
    }
  });

  async function createTask(body) {
    return fetch(`${baseUrl}/api/tasks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...writeHeaders },
      body: JSON.stringify(body),
    });
  }

  async function editTask({ id, ...body }) {
    return fetch(`${baseUrl}/api/tasks/${encodeURIComponent(id)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', ...writeHeaders },
      body: JSON.stringify(body),
    });
  }

  async function listTasks() {
    return fetch(`${baseUrl}/api/tasks`).then((response) => response.json());
  }

  async function getStats() {
    const response = await fetch(`${baseUrl}/api/stats`);
    assert.equal(response.status, 200);
    const stats = await response.json();
    assert.ok(Number.isInteger(stats.uptimeSeconds));
    assert.ok(stats.uptimeSeconds >= 0);
    return stats;
  }

  async function deleteTask(id) {
    return fetch(`${baseUrl}/api/tasks/${encodeURIComponent(id)}`, {
      method: 'DELETE',
      headers: writeHeaders,
    });
  }

  async function readError(response, status, path) {
    assert.equal(response.status, status);
    const error = await response.json();
    assert.equal(error.statusCode, status);
    assert.equal(error.path, path);
    assert.match(error.requestId, /^[a-f\d]{8}-[a-f\d]{4}-4[a-f\d]{3}-[89ab][a-f\d]{3}-[a-f\d]{12}$/);
    assert.equal(error.requestId, response.headers.get('x-request-id'));
    return error;
  }

  it('首次查询返回空数组，状态为 200', async () => {
    const response = await fetch(`${baseUrl}/api/tasks`);
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), []);
    assert.equal((await getStats()).total, 0);
  });

  it('缺少或错误的演示密钥拒绝所有任务写入，已有数据和统计保持不变', async () => {
    const original = await createTask({ title: '守卫需要保护的任务' }).then((response) => response.json());

    for (const headers of [{}, { 'X-Learning-Key': 'wrong-key' }]) {
      for (const method of ['POST', 'PUT', 'DELETE']) {
        const path = method === 'POST' ? '/api/tasks' : `/api/tasks/${original.id}`;
        const response = await fetch(`${baseUrl}${path}`, {
          method,
          headers: { 'Content-Type': 'application/json', ...headers },
          ...(method === 'DELETE' ? {} : { body: JSON.stringify({ title: '不应写入' }) }),
        });
        const error = await readError(response, 403, path);
        assert.equal(error.message, 'Forbidden resource');
        // 中间件先于守卫执行，因此拒绝响应也带有请求编号。
        assert.ok(response.headers.get('x-request-id'));
        assert.deepEqual(await listTasks(), [original]);
        assert.equal((await getStats()).total, 1);
      }
    }
  });

  it('守卫先于参数管道执行，放行后才校验请求体和路径 id', async () => {
    for (const headers of [{}, writeHeaders]) {
      const expectedStatus = headers['X-Learning-Key'] ? 400 : 403;
      const invalidBody = await fetch(`${baseUrl}/api/tasks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...headers },
        body: JSON.stringify({ title: 42 }),
      });
      assert.equal(invalidBody.status, expectedStatus);
      await invalidBody.json();

      const invalidId = await fetch(`${baseUrl}/api/tasks/not-a-uuid`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...headers },
        body: JSON.stringify({ title: '验证执行顺序' }),
      });
      assert.equal(invalidId.status, expectedStatus);
      await invalidId.json();
    }
    assert.deepEqual(await listTasks(), []);
  });

  it('全局过滤器为不存在的路由补充请求路径和编号', async () => {
    // 这个地址没有经过任务/统计中间件，验证过滤器的全局范围和编号补充逻辑。
    const path = '/api/filter-missing-route?source=test';
    const response = await fetch(`${baseUrl}${path}`);
    const error = await readError(response, 404, path);
    assert.equal(error.error, 'Not Found');
  });

  it('JSON 解析失败也返回 400、请求路径和编号', async () => {
    const response = await fetch(`${baseUrl}/api/tasks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...writeHeaders },
      body: '{"title":',
    });
    const error = await readError(response, 400, '/api/tasks');
    assert.equal(typeof error.message, 'string');
  });

  it('保留 HttpException 显式指定的状态码和字符串消息', async (t) => {
    t.mock.method(app.get(TasksService), 'findAll', async () => {
      throw new HttpException('任务暂时冲突', 409);
    });
    const response = await fetch(`${baseUrl}/api/tasks`);
    const error = await readError(response, 409, '/api/tasks');
    assert.equal(error.message, '任务暂时冲突');
  });

  it('未知异常返回 500 和定位信息，不向客户端暴露内部错误详情', async (t) => {
    // 仅替换本次测试中的 Service，不在正式接口中增加故障演示入口。
    t.mock.method(app.get(TasksService), 'findAll', async () => {
      throw new Error('模拟内部故障：不应向客户端返回的详情');
    });
    const response = await fetch(`${baseUrl}/api/tasks`);
    const error = await readError(response, 500, '/api/tasks');
    assert.equal(error.message, 'Internal server error');
    assert.equal(JSON.stringify(error).includes('模拟内部故障'), false);
    assert.equal('stack' in error, false);
  });

  it('创建返回 201，随后另一次查询能够读取同一条任务', async () => {
    const response = await createTask({ title: '  学习 Controller  ' });
    assert.equal(response.status, 201);
    const task = await response.json();
    assert.equal(task.title, '学习 Controller');
    assert.equal(task.completed, false);
    assert.match(task.id, /^[a-f\d-]{36}$/);
    assert.ok(Number.isFinite(Date.parse(task.createdAt)));

    const list = await fetch(`${baseUrl}/api/tasks`).then((r) => r.json());
    assert.deepEqual(list, [task]);
  });

  it('连续创建保留两条任务，并分配不同 id', async () => {
    const first = await createTask({ title: '任务一' }).then((r) => r.json());
    const second = await createTask({ title: '任务二' }).then((r) => r.json());
    assert.notEqual(first.id, second.id);
    const list = await fetch(`${baseUrl}/api/tasks`).then((r) => r.json());
    assert.deepEqual(list.map((task) => task.title), ['任务一', '任务二']);
  });

  it('拒绝空标题、错误类型、超长标题，失败请求不会写入数据', async () => {
    for (const input of [{}, { title: '' }, { title: '   ' }, { title: 42 }, { title: 'a'.repeat(121) }]) {
      const response = await createTask(input);
      const error = await readError(response, 400, '/api/tasks');
      assert.ok(Array.isArray(error.message));
    }
    const list = await fetch(`${baseUrl}/api/tasks`).then((r) => r.json());
    assert.deepEqual(list, []);
  });

  it('拒绝客户端提交 id 等未声明字段', async () => {
    const response = await createTask({ title: '任务', id: 'client-id' });
    assert.equal(response.status, 400);
  });

  it('编辑只修改指定任务的标题，并保持 id、创建时间和任务数量', async () => {
    const first = await createTask({ title: '准备编辑的任务' }).then((r) => r.json());
    const second = await createTask({ title: '另一条任务' }).then((r) => r.json());

    const response = await editTask({ id: first.id, title: '  已经编辑的任务  ' });

    assert.equal(response.status, 200);
    const edited = await response.json();
    assert.deepEqual(edited, { ...first, title: '已经编辑的任务' });

    const list = await fetch(`${baseUrl}/api/tasks`).then((r) => r.json());
    assert.deepEqual(list, [edited, second]);
  });

  it('编辑拒绝缺失、null、空白、错误类型和超长标题，并保留原任务', async () => {
    const original = await createTask({ title: '原任务' }).then((response) => response.json());

    for (const title of [undefined, null, '', '   ', 123, false, [], {}, 'a'.repeat(121)]) {
      const response = await editTask({ id: original.id, title });
      assert.equal(response.status, 400);
      const error = await response.json();
      assert.equal(error.statusCode, 400);
      assert.ok(Array.isArray(error.message));
      assert.deepEqual(await listTasks(), [original]);
    }
  });

  it('编辑拒绝格式错误的路径 id，并保留原任务', async () => {
    const original = await createTask({ title: '原任务' }).then((response) => response.json());

    for (const id of ['not-a-uuid', '123', 'null', '00000000-0000-0000-0000-000000000000']) {
      const response = await editTask({ id, title: '新标题' });
      assert.equal(response.status, 400);
      const error = await response.json();
      assert.equal(error.statusCode, 400);
      assert.deepEqual(await listTasks(), [original]);
    }
  });

  it('编辑拒绝 completed、createdAt 等额外字段，服务端字段保持原值', async () => {
    const original = await createTask({ title: '原任务' }).then((response) => response.json());

    for (const extra of [{ completed: true }, { createdAt: '1970-01-01T00:00:00Z' }, { extra: '不允许的字段' }]) {
      const response = await editTask({ id: original.id, title: '新标题', ...extra });
      assert.equal(response.status, 400);
      assert.deepEqual(await listTasks(), [original]);
    }
  });

  it('格式正确但不存在的 id 返回 404 和明确错误，已有数据保持不变', async () => {
    const original = await createTask({ title: '原任务' }).then((response) => response.json());
    const response = await editTask({
      id: '11111111-1111-4111-8111-111111111111',
      title: '新标题',
    });

    assert.equal(response.status, 404);
    const error = await readError(response, 404, `/api/tasks/11111111-1111-4111-8111-111111111111`);
    assert.equal(error.statusCode, 404);
    assert.equal(error.message, '任务不存在');
    assert.deepEqual(await listTasks(), [original]);
  });

  it('编辑接受恰好 120 个字符的标题', async () => {
    const original = await createTask({ title: '原任务' }).then((response) => response.json());
    const response = await editTask({ id: original.id, title: 'a'.repeat(120) });
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { ...original, title: 'a'.repeat(120) });
  });

  it('编辑不接受请求体重复传 id，路径和请求体的职责保持分离', async () => {
    const original = await createTask({ title: '原任务' }).then((response) => response.json());
    const response = await fetch(`${baseUrl}/api/tasks/${original.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', ...writeHeaders },
      body: JSON.stringify({ id: original.id, title: '新标题' }),
    });
    assert.equal(response.status, 400);
    assert.deepEqual(await listTasks(), [original]);
  });

  it('统计模块与任务模块共享数据，创建、编辑、删除后数量正确', async () => {
    const first = await createTask({ title: '任务一' }).then((response) => response.json());
    const second = await createTask({ title: '任务二' }).then((response) => response.json());
    assert.equal((await getStats()).total, 2);

    const edited = await editTask({ id: first.id, title: '修改后的任务一' }).then((response) => response.json());
    assert.equal((await getStats()).total, 2);

    const removed = await deleteTask(first.id);
    assert.equal(removed.status, 200);
    assert.deepEqual(await removed.json(), edited);
    assert.deepEqual(await listTasks(), [second]);
    assert.equal((await getStats()).total, 1);

    const repeatedDelete = await deleteTask(first.id);
    assert.equal(repeatedDelete.status, 404);
    assert.equal((await repeatedDelete.json()).message, '任务不存在');
    assert.deepEqual(await listTasks(), [second]);
    assert.equal((await getStats()).total, 1);

    assert.equal((await deleteTask(second.id)).status, 200);
    assert.deepEqual(await listTasks(), []);
    assert.equal((await getStats()).total, 0);
  });

  it('删除失败时不误删最后一条任务，统计也保持不变', async () => {
    const original = await createTask({ title: '需要保留的任务' }).then((response) => response.json());

    const invalid = await deleteTask('bad-id');
    assert.equal(invalid.status, 400);
    assert.deepEqual(await listTasks(), [original]);

    const missing = await deleteTask('11111111-1111-4111-8111-111111111111');
    assert.equal(missing.status, 404);
    assert.equal((await missing.json()).message, '任务不存在');
    assert.deepEqual(await listTasks(), [original]);
    assert.equal((await getStats()).total, 1);
  });

  it('编辑和删除缺少路径 id 时不匹配路由，返回 404', async () => {
    const original = await createTask({ title: '原任务' }).then((response) => response.json());
    const edit = await fetch(`${baseUrl}/api/tasks`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', ...writeHeaders },
      body: JSON.stringify({ title: '新标题' }),
    });
    const remove = await fetch(`${baseUrl}/api/tasks`, { method: 'DELETE', headers: writeHeaders });
    assert.equal(edit.status, 404);
    assert.equal(remove.status, 404);
    assert.deepEqual(await listTasks(), [original]);
  });

  it('同一统计响应聚合任务模块和系统模块，包含任务数量和非负运行时长', async () => {
    const first = await getStats();
    assert.equal(first.total, 0);
    await createTask({ title: '验证多个服务注入' });
    const second = await getStats();
    assert.equal(second.total, 1);
    assert.ok(second.uptimeSeconds >= first.uptimeSeconds);
    assert.deepEqual(Object.keys(second).sort(), ['total', 'uptimeSeconds']);
  });
});
