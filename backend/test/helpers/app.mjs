import 'reflect-metadata';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { ConfigService } from '@nestjs/config';
import { getConnectionToken } from '@nestjs/mongoose';
import { Test } from '@nestjs/testing';
import { createConnection } from 'mongoose';
import { AppModule } from '../../dist/app.module.js';
import { configureApp } from '../../dist/app.setup.js';

// 每个用例启动真实Nest应用和独立数据库；port=0交给系统分配空闲端口。
// 数据库名只能是测试前缀+UUID，后续清理前也会重复校验，避免误删开发数据。
export async function startApp({ databaseName = `awei_e2e_${randomUUID().replaceAll('-', '')}`, config = {}, port = 0 } = {}) {
  assert.match(databaseName, /^awei_e2e_[a-f\d]{32}$/);
  let connection;
  let app;
  try {
    // TestingModule沿用真实AppModule，只替换数据库连接这个Provider。
    // 这样Controller、Guard、Service和Session Store仍走正式代码。
    const module = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(getConnectionToken())
      .useFactory({
        inject: [ConfigService],
        factory: async (settings) => {
          connection = await createConnection(settings.getOrThrow('MONGODB_URI'), {
            dbName: databaseName, serverSelectionTimeoutMS: 5000,
          }).asPromise();
          return connection;
        },
      }).compile();
    app = module.createNestApplication({ logger: false });
    // 使用固定测试密钥使“关闭后重建应用”可以验证同一个会话；这些不是部署凭据。
    const settings = app.get(ConfigService);
    settings.set('SESSION_SECRET', 'http-test-secret-fixed-and-at-least-32-characters');
    settings.set('NODE_ENV', 'test');
    settings.set('TRUST_PROXY', '');
    settings.set('SESSION_MAX_AGE_MS', '604800000');
    settings.set('AUTH_RATE_WINDOW_MS', '900000');
    settings.set('AUTH_IP_LIMIT', '1000');
    settings.set('AUTH_ACCOUNT_LIMIT', '1000');
    for (const [key, value] of Object.entries(config)) settings.set(key, value);
    // 与main.ts调用相同配置，测试不能遗漏Session或全局ValidationPipe。
    await configureApp(app);
    await app.listen(port, '127.0.0.1');
    return { app, connection, databaseName, baseUrl: await app.getUrl() };
  } catch (error) {
    if (connection?.readyState === 1) {
      assert.equal(connection.name, databaseName);
      await connection.dropDatabase();
    }
    await app?.close();
    await connection?.close();
    throw error;
  }
}

// drop=false用于专项重启测试：仅关闭应用，保留同一个临时库供新应用恢复。
export async function stopApp(state, { drop = true } = {}) {
  if (!state) return;
  try {
    if (drop) {
      assert.match(state.databaseName, /^awei_e2e_[a-f\d]{32}$/);
      assert.equal(state.connection.name, state.databaseName);
      await state.connection.dropDatabase();
    }
  } finally {
    await state.app.close();
    // 替换后的连接Provider可能不触发原连接所有者的销毁钩子，因此再显式关闭连接。
    await state.connection.close();
  }
}

// 模拟浏览器保存Set-Cookie，并在写请求中发送CSRF令牌。
// 每个client实例独立持有Cookie，A/B用户测试不能共享同一个实例。
export function client(state) {
  return {
    cookie: '', csrfToken: '', user: null,
    async request(path, { method = 'GET', body, headers = {}, csrf = true, ...rest } = {}) {
      const response = await fetch(`${state.baseUrl}/api${path}`, {
        ...rest, method,
        headers: {
          ...(this.cookie ? { Cookie: this.cookie } : {}),
          ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
          ...(csrf && method !== 'GET' ? { 'X-CSRF-Token': this.csrfToken } : {}),
          ...headers,
        },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      });
      const cookie = response.headers.get('set-cookie');
      if (cookie) this.cookie = cookie.split(';')[0];
      return response;
    },
    async session() {
      const response = await this.request('/auth/session');
      assert.equal(response.status, 200);
      const view = await response.json();
      this.csrfToken = view.csrfToken;
      this.user = view.user;
      return view;
    },
    async register(account = '123', password = 'password123') {
      await this.session();
      const response = await this.request('/auth/register', { method: 'POST', body: { account, password } });
      assert.equal(response.status, 201);
      const view = await response.json();
      this.csrfToken = view.csrfToken;
      this.user = view.user;
      return view;
    },
  };
}
