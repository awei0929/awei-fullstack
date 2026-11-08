import assert from 'node:assert/strict';
import { afterEach, beforeEach, describe, it } from 'node:test';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { ConfigService } from '@nestjs/config';
import { startApp, stopApp, client } from './helpers/app.mjs';

// 真实运行本地初始化命令，但连接串强制替换为已核对的隔离测试库；密码仅为测试常量。
// stdin传输输入而非命令参数，断言标准输出只包含UUID，错误也不泄漏输入内容。
describe('受控站主初始化命令', () => {
  let state;
  beforeEach(async () => { state = await startApp(); });
  afterEach(async () => { await stopApp(state); });
  async function initialize(input) {
    assert.match(state.databaseName, /^awei_e2e_[a-f\d]{32}$/);
    const original = state.app.get(ConfigService).getOrThrow('MONGODB_URI');
    const uri = new URL(original); uri.pathname = `/${state.databaseName}`;
    return new Promise((resolve, reject) => {
      const process = spawn(globalThis.process.execPath, ['dist/scripts/initialize-site-owner.js'], {
        cwd: fileURLToPath(new URL('..', import.meta.url)),
        env: { ...globalThis.process.env, MONGODB_URI: uri.toString(), NODE_ENV: 'test' },
        stdio: ['pipe', 'pipe', 'pipe'],
      });
      let output = '', error = '';
      process.stdout.on('data', chunk => { output += chunk; });
      process.stderr.on('data', chunk => { error += chunk; });
      process.on('error', reject);
      process.on('close', code => resolve({ code, output, error }));
      process.stdin.end(JSON.stringify(input));
    });
  }
  it('仅55555可初始化，重复时验证原密码，错误密码不重置且输出不含凭据', async () => {
    const credentials = { account: '55555', password: 'test-owner-password123' };
    const created = await initialize(credentials);
    assert.equal(created.code, 0, created.error);
    assert.match(created.output, /^[a-f\d-]{36}\n$/);
    const id = created.output.trim();
    const stored = await state.connection.collection('users').findOne({ account: '55555' });
    assert.equal(stored.id, id); assert.equal('password' in stored, false);
    const repeated = await initialize(credentials);
    assert.equal(repeated.code, 0); assert.equal(repeated.output.trim(), id);
    const denied = await initialize({ ...credentials, password: 'wrong-owner-password' });
    assert.notEqual(denied.code, 0); assert.equal(denied.output, '');
    assert.equal(denied.error.includes('wrong-owner-password'), false);
    assert.equal((await state.connection.collection('users').findOne({ account: '55555' })).passwordHash, stored.passwordHash);
    assert.equal((await initialize({ account: '44444', password: 'test-other-password' })).code, 1);
    assert.equal((await initialize({ account: '55555', password: 'short' })).code, 1);
    const user = client(state); await user.session();
    assert.equal((await user.request('/auth/login', { method: 'POST', body: credentials })).status, 200);
  });
});
