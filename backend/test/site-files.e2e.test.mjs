import assert from 'node:assert/strict';
import { beforeEach, afterEach, describe, it, mock } from 'node:test';
import crypto from 'node:crypto';
import { syncBuiltinESMExports } from 'node:module';
import { ConfigService } from '@nestjs/config';
import { chmod, mkdir, mkdtemp, readdir, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { startApp, stopApp, client } from './helpers/app.mjs';

// 测试只用随机临时数据库和磁盘目录，真实HTTP贯穿Guard、multipart解析、校验与写盘。
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aS4cAAAAASUVORK5CYII=', 'base64');
const jpeg = Buffer.from('ffd8ffe000104a46494600010100000100010000ffd9', 'hex');
const webp = Buffer.from('524946461a000000574542505650384c0d0000002f00000000071011118888fe0700', 'hex');
const zip = Buffer.from('504b0506000000000000000000000000000000000000', 'hex');
// 此固定ZIP由Python标准库写出一个未压缩note.txt（内容hello），独立于生产校验实现。
const populatedZip = Buffer.from('UEsDBBQAAAAAAAAAIVyGphA2BQAAAAUAAAAIAAAAbm90ZS50eHRoZWxsb1BLAQIUAxQAAAAAAAAAIVyGphA2BQAAAAUAAAAIAAAAAAAAAAAAAACAAQAAAABub3RlLnR4dFBLBQYAAAAAAQABADYAAAArAAAAAAA=', 'base64');
// 边界夹具保留真实容器签名；上传不承诺完整解码/文档可打开，测试也不把它伪装成解码验收。
const pdf = (size = 32) => { const bytes = Buffer.alloc(size, 32); bytes.write('%PDF-1.7\n'); bytes.write('\n%%EOF', size - 6); return bytes; };
const sizedPng = size => { const bytes = Buffer.alloc(size); png.copy(bytes); return bytes; };
const mediaPath = /^\/api\/site\/assets\/[a-f\d]{8}-[a-f\d]{4}-4[a-f\d]{3}-[89ab][a-f\d]{3}-[a-f\d]{12}\.[a-z\d]+$/;
describe('统一公开文件上传 HTTP', () => {
  let state, owner, directory;
  beforeEach(async () => {
    directory = await mkdtemp(join(tmpdir(), 'nest-site-files-'));
    state = await startApp({ config: { SITE_ASSETS_DIR: directory } });
    owner = client(state); await owner.seedAndLogin('55555');
    state.app.get(ConfigService).set('SITE_OWNER_USER_ID', owner.user.id);
  });
  afterEach(async () => { await stopApp(state); await rm(directory, { recursive: true, force: true }); });
  const upload = (bytes = png, name = 'cover.png', mime = 'image/png', user = owner, headers = {}) => {
    const form = new FormData(); form.append('file', new Blob([bytes], { type: mime }), name);
    return fetch(`${state.baseUrl}/api/site/file-assets`, { method: 'POST', body: form,
      headers: { ...(user.cookie ? { Cookie: user.cookie } : {}), 'X-CSRF-Token': user.csrfToken, ...headers } });
  };
  const anonymousGet = path => fetch(`${state.baseUrl}${path}`);
  it('站主可上传PNG，匿名GET字节一致且不创建站点文档', async () => {
    const form = new FormData(); form.append('file', new Blob([png], { type: 'image/png' }), 'cover.png');
    const response = await fetch(`${state.baseUrl}/api/site/file-assets`, { method: 'POST', body: form,
      headers: { Cookie: owner.cookie, 'X-CSRF-Token': owner.csrfToken } });
    assert.equal(response.status, 201);
    const result = await response.json();
    assert.match(result.url, /^\/api\/site\/assets\/[a-f\d-]{36}\.png$/);
    assert.deepEqual(result, { url: result.url, name: 'cover.png', mimeType: 'image/png', size: png.length, kind: 'image' });
    const download = await fetch(`${state.baseUrl}${result.url}`);
    assert.equal(download.status, 200); assert.deepEqual(Buffer.from(await download.arrayBuffer()), png);
    assert.equal(await state.connection.collection('site_documents').countDocuments(), 0);
  });

  it('JPG/JPEG、PNG与WebP按内容判断类型，忽略空或通用客户端MIME', async () => {
    for (const [bytes, name, mime, extension, expectedMime] of [
      [jpeg, 'photo.JPEG', '', 'jpg', 'image/jpeg'], [jpeg, 'photo.jpg', 'application/octet-stream', 'jpg', 'image/jpeg'],
      [png, 'cover.png', 'application/octet-stream', 'png', 'image/png'], [webp, 'cover.webp', 'text/plain', 'webp', 'image/webp'],
    ]) {
      const response = await upload(bytes, name, mime); assert.equal(response.status, 201, name);
      const result = await response.json(); assert.match(result.url, mediaPath); assert.ok(result.url.endsWith(`.${extension}`));
      assert.deepEqual(result, { url: result.url, name, mimeType: expectedMime, size: bytes.length, kind: 'image' });
      const file = await anonymousGet(result.url); assert.equal(file.headers.get('content-type'), expectedMime);
      assert.equal(file.headers.get('content-disposition'), null); assert.equal(file.headers.get('x-content-type-options'), 'nosniff');
      assert.deepEqual(Buffer.from(await file.arrayBuffer()), bytes);
    }
  });

  it('PDF、ZIP、TXT和三种Office附件匿名下载，返回正确MIME与下载头', async () => {
    for (const [bytes, name, mime] of [
      [pdf(), '说明.pdf', 'application/pdf'], [zip, 'files.zip', 'application/zip'], [Buffer.from('\ufeff你好\n说明\tOK\r\n'), '说明.txt', 'text/plain'],
      [zip, 'report.docx', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
      [zip, 'report.xlsx', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'],
      [zip, 'report.pptx', 'application/vnd.openxmlformats-officedocument.presentationml.presentation'],
    ]) {
      const response = await upload(bytes, name, 'application/octet-stream'); assert.equal(response.status, 201, name);
      const result = await response.json();
      assert.deepEqual(result, { url: result.url, name, mimeType: mime, size: bytes.length, kind: 'attachment' });
      const file = await anonymousGet(result.url); assert.equal(file.status, 200);
      assert.equal(file.headers.get('content-type').split(';')[0], mime);
      assert.equal(file.headers.get('x-content-type-options'), 'nosniff');
      assert.match(file.headers.get('content-disposition'), /^attachment; /);
      assert.ok(file.headers.get('content-disposition').includes(`filename*=UTF-8''${encodeURIComponent(name)}`));
      assert.deepEqual(Buffer.from(await file.arrayBuffer()), bytes);
    }
    assert.equal(await state.connection.collection('site_documents').countDocuments(), 0);
    assert.equal((await owner.request('/site').then(r => r.json())).version, 0);
  });

  it('Session→Owner→CSRF拒绝游客、普通用户、未配置站主与错误令牌，拒绝前不写盘', async () => {
    const outsider = client(state); await outsider.seedAndLogin('44444');
    assert.equal((await upload(png, 'a.png', 'image/png', client(state))).status, 401);
    assert.equal((await upload(png, 'a.png', 'image/png', outsider)).status, 403);
    for (const value of ['', 'wrong']) assert.equal((await upload(png, 'a.png', 'image/png', owner, { 'X-CSRF-Token': value })).status, 403);
    state.app.get(ConfigService).set('SITE_OWNER_USER_ID', '');
    assert.equal((await upload()).status, 403);
    assert.deepEqual(await readdir(directory), []);
  });

  it('空、错签名、扩展名不匹配、未知类型与二进制伪装TXT均400且无残留', async () => {
    const wrongRiff = Buffer.from(webp); wrongRiff[0] = 0xd2;
    for (const [bytes, name] of [
      [Buffer.alloc(0), 'empty.txt'], [png, 'image.jpg'], [jpeg, 'image.png'], [png, 'image.webp'], [wrongRiff, 'image.webp'],
      [Buffer.from('%PDF'), 'fake.pdf'], [Buffer.from('PK\x03\x04fake'), 'fake.zip'], [Buffer.from('PK\x03\x04fake'), 'fake.docx'],
      [Buffer.from('plain text'), 'fake.pdf'], [Buffer.from('<svg/>'), 'image.svg'], [Buffer.from('<html>'), 'index.html'],
      [Buffer.from('MZ executable'), 'program.exe'], [zip, 'legacy.doc'], [Buffer.from('readme'), 'no-extension'],
      [Buffer.from([0xff, 0xfe, 0x41]), 'bad.txt'], [Buffer.from([0, 65]), 'nul.txt'], [Buffer.from([65, 27, 66]), 'escape.txt'],
    ]) assert.equal((await upload(bytes, name)).status, 400, name);
    assert.deepEqual(await readdir(directory), []);
  });

  it('ZIP不能借对象原型名称扩展名绕过附件白名单', async () => {
    for (const name of ['fake.constructor', 'fake.__proto__']) assert.equal((await upload(zip, name)).status, 400, name);
    assert.deepEqual(await readdir(directory), []);
  });

  it('普通非空ZIP容器通过，损坏中央目录、分卷和ZIP64均400不写盘', async () => {
    const response = await upload(populatedZip, 'real.zip'); assert.equal(response.status, 201);
    const before = await readdir(directory);
    const broken = Buffer.from(populatedZip); broken[43] = 0;
    const split = Buffer.from(zip); split.writeUInt16LE(1, 4);
    const zip64 = Buffer.from(zip); zip64.writeUInt16LE(0xffff, 8); zip64.writeUInt16LE(0xffff, 10);
    for (const bytes of [broken, split, zip64]) assert.equal((await upload(bytes, 'broken.zip')).status, 400);
    assert.deepEqual(await readdir(directory), before);
  });

  it('multipart必须恰好一个file，不接受额外字段、重复或错误字段及JSON', async () => {
    const headers = { Cookie: owner.cookie, 'X-CSRF-Token': owner.csrfToken };
    for (const form of [new FormData(), (() => { const f = new FormData(); f.append('other', new Blob([png]), 'a.png'); return f; })(),
      (() => { const f = new FormData(); f.append('file', new Blob([png]), 'a.png'); f.append('file', new Blob([png]), 'b.png'); return f; })(),
      (() => { const f = new FormData(); f.append('file', new Blob([png]), 'a.png'); f.append('caption', 'bad'); return f; })()]) {
      assert.equal((await fetch(`${state.baseUrl}/api/site/file-assets`, { method: 'POST', body: form, headers })).status, 400);
    }
    assert.equal((await owner.request('/site/file-assets', { method: 'POST', body: { file: 'fake' } })).status, 400);
    assert.deepEqual(await readdir(directory), []);
  });

  it('图片精确5MiB、附件精确20MiB允许，+1或更大统一400且无多余文件', async () => {
    for (const [bytes, name] of [[sizedPng(5 * 1024 * 1024), 'cover.png'], [pdf(20 * 1024 * 1024), 'large.pdf']]) {
      const response = await upload(bytes, name); assert.equal(response.status, 201);
      const result = await response.json(); assert.equal(result.size, bytes.length);
      assert.deepEqual(Buffer.from(await (await anonymousGet(result.url)).arrayBuffer()), bytes);
    }
    const before = await readdir(directory);
    for (const [bytes, name] of [[sizedPng(5 * 1024 * 1024 + 1), 'cover.png'], [pdf(20 * 1024 * 1024 + 1), 'large.pdf'], [pdf(21 * 1024 * 1024), 'larger.pdf']]) {
      assert.equal((await upload(bytes, name)).status, 400);
    }
    assert.deepEqual(await readdir(directory), before);
  });

  it('同名并发上传使用不同随机路径，不覆盖内容或下载名', async () => {
    const expected = Array.from({ length: 8 }, (_, i) => Buffer.from(`第${i}份内容`));
    const results = await Promise.all(expected.map(async bytes => {
      const response = await upload(bytes, 'same.txt'); assert.equal(response.status, 201); return response.json();
    }));
    assert.equal(new Set(results.map(r => r.url)).size, 8);
    for (const [index, result] of results.entries()) {
      assert.match(result.url, mediaPath); assert.deepEqual(Buffer.from(await (await anonymousGet(result.url)).arrayBuffer()), expected[index]);
    }
  });

  it('清理原名目录和控制字符、限制150字符，下载头安全保留Unicode', async () => {
    // 原始multipart保留双向覆盖符，证明清理发生在服务端，不靠浏览器预先清理文件名。
    const boundary = 'test-safe-filename';
    const raw = Buffer.concat([Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="../../报\u202e告.txt"\r\nContent-Type: text/plain\r\n\r\n`), Buffer.from('你好'), Buffer.from(`\r\n--${boundary}--\r\n`)]);
    const response = await fetch(`${state.baseUrl}/api/site/file-assets`, { method: 'POST', body: raw,
      headers: { Cookie: owner.cookie, 'X-CSRF-Token': owner.csrfToken, 'Content-Type': `multipart/form-data; boundary=${boundary}` } });
    assert.equal(response.status, 201); const result = await response.json(); assert.equal(result.name, '报告.txt');
    const file = await anonymousGet(result.url); assert.ok(file.headers.get('content-disposition').includes("filename*=UTF-8''%E6%8A%A5%E5%91%8A.txt"));
    const long = await upload(Buffer.from('long name'), `${'长'.repeat(200)}.txt`); assert.equal(long.status, 201);
    assert.ok(Array.from((await long.json()).name).length <= 150);
  });

  it('multipart头中的非法控制字符拒绝400，不生成文件', async () => {
    const boundary = 'test-control-filename';
    const raw = Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="bad\u0001.txt"\r\n\r\nhello\r\n--${boundary}--\r\n`);
    const response = await fetch(`${state.baseUrl}/api/site/file-assets`, { method: 'POST', body: raw,
      headers: { Cookie: owner.cookie, 'X-CSRF-Token': owner.csrfToken, 'Content-Type': `multipart/form-data; boundary=${boundary}` } });
    assert.equal(response.status, 400); assert.deepEqual(await readdir(directory), []);
  });

  it('关闭重建应用后文件和下载名仍存在，无元数据历史图片/音频仍可读', async () => {
    const uploadedResponse = await upload(pdf(), '持久下载名.pdf'); assert.equal(uploadedResponse.status, 201);
    const uploaded = await uploadedResponse.json();
    const historical = [['00000000-0000-4000-8000-000000000001.png', png, 'image/png'],
      ['00000000-0000-4000-8000-000000000002.wav', Buffer.from('historical-audio'), 'audio/wav']];
    for (const [name, bytes] of historical) await writeFile(join(directory, name), bytes);
    const databaseName = state.databaseName;
    await stopApp(state, { drop: false }); state = undefined;
    state = await startApp({ databaseName, config: { SITE_ASSETS_DIR: directory } });
    const file = await anonymousGet(uploaded.url); assert.equal(file.status, 200);
    assert.ok(file.headers.get('content-disposition').includes(`filename*=UTF-8''${encodeURIComponent('持久下载名.pdf')}`));
    for (const [name, bytes, mime] of historical) {
      const old = await anonymousGet(`/api/site/assets/${name}`); assert.equal(old.status, 200); assert.equal(old.headers.get('content-type'), mime);
      assert.deepEqual(Buffer.from(await old.arrayBuffer()), bytes);
    }
    assert.equal((await fetch(`${state.baseUrl}/api/site/assets`, { method: 'POST', body: new FormData() })).status, 404);
  });

  it('非法GET路径、元数据名与不存在文件拒绝且响应不泄漏目录', async () => {
    for (const path of ['not-a-uuid.txt', '00000000-0000-4000-8000-000000000000.html', '%2E%2E%2F.env',
      '00000000-0000-4000-8000-000000000000.txt.json']) {
      const response = await anonymousGet(`/api/site/assets/${path}`); assert.equal(response.status, 400);
      assert.ok(!(await response.text()).includes(directory));
    }
    assert.equal((await anonymousGet('/api/site/assets/00000000-0000-4000-8000-000000000000.pdf')).status, 404);
  });

  it('附件元数据缺失、损坏、超大或恶意名字安全回退，历史附件仍强制下载', async () => {
    const filename = '00000000-0000-4000-8000-000000000003.txt';
    await writeFile(join(directory, filename), 'legacy text');
    for (const metadata of [null, '{broken json', JSON.stringify({ name: 42 }), ' '.repeat(5000)]) {
      if (metadata !== null) await writeFile(join(directory, `${filename}.json`), metadata);
      const response = await anonymousGet(`/api/site/assets/${filename}`); assert.equal(response.status, 200);
      assert.ok(response.headers.get('content-disposition').includes(`filename="${filename}"`));
      assert.equal(await response.text(), 'legacy text');
    }
    await writeFile(join(directory, `${filename}.json`), JSON.stringify({ name: '../../报告\r\n"\\evil.txt' }));
    const safe = await anonymousGet(`/api/site/assets/${filename}`); assert.equal(safe.status, 200);
    assert.ok(!safe.headers.get('content-disposition').includes('\r')); assert.ok(!safe.headers.get('content-disposition').includes('\n'));
  });

  it('损坏Unicode元数据不会让已有附件下载失败', async () => {
    const filename = '00000000-0000-4000-8000-000000000004.txt';
    await writeFile(join(directory, filename), 'legacy');
    await writeFile(join(directory, `${filename}.json`), JSON.stringify({ name: '\ud800.txt' }));
    const response = await anonymousGet(`/api/site/assets/${filename}`); assert.equal(response.status, 200);
    assert.equal(await response.text(), 'legacy');
  });

  it('附件元数据不能跟随符号链接，媒体符号链接不能读取目录外文件', async () => {
    const filename = '00000000-0000-4000-8000-000000000005.txt';
    const privateDirectory = await mkdtemp(join(tmpdir(), 'nest-file-private-')), target = join(privateDirectory, 'private-target');
    try {
      await writeFile(target, 'private'); await symlink(target, join(directory, filename));
      assert.equal((await anonymousGet(`/api/site/assets/${filename}`)).status, 404);
      await rm(join(directory, filename)); await writeFile(join(directory, filename), 'public');
      await symlink(target, join(directory, `${filename}.json`));
      const response = await anonymousGet(`/api/site/assets/${filename}`); assert.equal(response.status, 200);
      assert.equal(await response.text(), 'public');
      assert.ok(response.headers.get('content-disposition').includes(`filename="${filename}"`));
    } finally { await rm(privateDirectory, { recursive: true, force: true }); }
  });

  it('下载名元数据创建失败回滚新文件，随机名碰撞不覆盖已有文件', async () => {
    // 只固定低层UUID以可靠安排真实磁盘冲突；Guard、multipart、文件写入及失败回滚都不替换。
    const fixed = '00000000-0000-4000-8000-000000000006', filename = `${fixed}.txt`;
    const stub = mock.method(crypto, 'randomUUID', () => fixed); syncBuiltinESMExports();
    try {
      await mkdir(join(directory, `${filename}.json`));
      assert.equal((await upload(Buffer.from('must rollback'), 'name.txt')).status, 500);
      assert.deepEqual(await readdir(directory), [`${filename}.json`]);
      await rm(join(directory, `${filename}.json`), { recursive: true });
      await writeFile(join(directory, filename), 'old asset');
      assert.equal((await upload(Buffer.from('new asset'), 'name.txt')).status, 500);
      assert.deepEqual(await readdir(directory), [filename]);
      assert.equal(await (await anonymousGet(`/api/site/assets/${filename}`)).text(), 'old asset');
    } finally { stub.mock.restore(); syncBuiltinESMExports(); }
  });

  it('真实磁盘不可写时500且无残留、不泄漏目录，恢复权限后可重试', async () => {
    await chmod(directory, 0o500);
    try {
      const response = await upload(Buffer.from('write failure'), 'failure.txt'); assert.equal(response.status, 500);
      assert.ok(!(await response.text()).includes(directory)); assert.deepEqual(await readdir(directory), []);
    } finally { await chmod(directory, 0o700); }
    assert.equal((await upload(Buffer.from('retry'), 'retry.txt')).status, 201);
  });
});
