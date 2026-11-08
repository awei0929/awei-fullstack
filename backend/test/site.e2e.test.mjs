import assert from 'node:assert/strict';
import { beforeEach, afterEach, describe, it } from 'node:test';
import { ConfigService } from '@nestjs/config';
import { mkdtemp, rm, readdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { startApp, stopApp, client } from './helpers/app.mjs';

// 独立写出冻结合同的九项默认值，不调用生产默认函数生成预期，避免默认回填错误也自证通过。
const capabilityDefaults = () => ({
  ai: [{ icon: 'codex', name: 'Codex' }, { icon: 'claude', name: 'Claude' }, { icon: 'deepseek', name: 'DeepSeek' }],
  frontend: [{ icon: 'react', name: 'React' }, { icon: 'vuedotjs', name: 'Vue' }, { icon: 'typescript', name: 'TypeScript' }],
  backend: [{ icon: 'nestjs', name: 'NestJS' }, { icon: 'mongodb', name: 'MongoDB' }],
  deployment: [{ icon: 'docker', name: 'Docker' }],
});
// 与生产实现分开写出详情默认，验证读取旧文档只补响应，不伪造公司/项目。
const capabilityDetailsDefaults = () => ({
  technology: { introduction: '围绕前端、后端、AI 工具与部署，持续积累完整交付的能力。' },
  company: { name: '', summary: '', introduction: '', business: '', responsibilities: '' },
  projects: [],
});
const detailProject = (id = 'project_1', extra = {}) => ({
  id, name: `项目 ${id}`, summary: '项目简介', content: '# 负责模块\n\n- 接口与页面\n', coverUrl: '', visible: true, ...extra,
});
// 使用手写合同数据、真实HTTP、独立Mongo库及临时上传目录，避免把正式数据当测试夹具。
const content = () => ({
  profile: { name: '站主', tagline: '', bio: '' },
  home: { eyebrow: '初次见面', title: '你好', subtitle: '', buttonLabel: '查看我的能力' },
  contact: { email: '', links: [{ label: '外链', url: 'https://example.com/' }] },
  appearance: { motion: true, character: 'classic' },
  music: { enabled: false, title: '', sourceUrl: '', volume: 25, loop: true },
  capabilities: capabilityDefaults(),
  capabilityDetails: capabilityDetailsDefaults(),
});
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aS4cAAAAASUVORK5CYII=', 'base64');

// 最小音频容器夹具只验证HTTP的格式边界，不把解码器播放成功作为上传承诺。
function wav(size = 48) {
  const data = Buffer.alloc(size);
  data.write('RIFF'); data.writeUInt32LE(size - 8, 4); data.write('WAVEfmt ', 8);
  data.writeUInt32LE(16, 16); data.writeUInt16LE(1, 20); data.writeUInt16LE(1, 22);
  data.writeUInt32LE(8000, 24); data.writeUInt32LE(16000, 28); data.writeUInt16LE(2, 32); data.writeUInt16LE(16, 34);
  data.write('data', 36); data.writeUInt32LE(size - 44, 40); return data;
}
function ogg(codec = 'opus') {
  const packet = codec === 'opus' ? Buffer.from('4f707573486561640101000080bb0000000000', 'hex')
    : codec === 'vorbis' ? Buffer.from('01766f72626973000000000144ac0000000000000000000000000000b801', 'hex')
      : Buffer.from('807468656f72610000000000000000000000000000000000000000000000', 'hex');
  const page = Buffer.alloc(28); page.write('OggS'); page[5] = 2; page[26] = 1; page[27] = packet.length;
  return Buffer.concat([page, packet]);
}
const mp3 = Buffer.alloc(834); Buffer.from([0xff, 0xfb, 0x90, 0x00]).copy(mp3); Buffer.from([0xff, 0xfb, 0x90, 0x00]).copy(mp3, 417);

describe('单站点配置、权限、持久化与媒体 HTTP', () => {
  let state, owner, outsider, directory;
  beforeEach(async () => {
    directory = await mkdtemp(join(tmpdir(), 'nest-site-test-'));
    state = await startApp({ config: { SITE_ASSETS_DIR: directory } });
    owner = client(state); outsider = client(state);
    await owner.seedAndLogin('55555'); await outsider.seedAndLogin('44444');
    state.app.get(ConfigService).set('SITE_OWNER_USER_ID', owner.user.id);
  });
  afterEach(async () => { await stopApp(state); await rm(directory, { recursive: true, force: true }); });
  const save = (user, value = content(), version = 0, extra = {}) => user.request('/site/config', { method: 'PUT', body: { version, content: value }, ...extra });
  const removedImageUpload = (user, extra = {}) => {
    const form = new FormData(); form.append('file', new Blob([png], { type: 'image/png' }), '../../untrusted.png');
    return fetch(`${state.baseUrl}/api/site/assets`, { method: 'POST', body: form, headers: { Cookie: user.cookie, 'X-CSRF-Token': user.csrfToken, ...extra } });
  };
  const uploadAudio = (user, bytes = wav(), mime = 'audio/wav', extra = {}) => {
    const form = new FormData(); form.append('file', new Blob([bytes], { type: mime }), '../../untrusted.mp3');
    return fetch(`${state.baseUrl}/api/site/audio-assets`, { method: 'POST', body: form, headers: { Cookie: user.cookie, 'X-CSRF-Token': user.csrfToken, ...extra } });
  };

  it('详情新库及旧分区缺失只读补默认，原能力和历史记录版本时间均不改变', async () => {
    for (const path of ['/site', '/site/config']) {
      const response = await owner.request(path); assert.equal(response.status, 200);
      const document = await response.json();
      assert.equal(document.version, 0); assert.equal(document.updatedAt, null);
      assert.deepEqual(document.content.capabilityDetails, capabilityDetailsDefaults());
    }
    const collection = state.connection.collection('site_documents');
    assert.equal(await collection.countDocuments(), 0);
    const legacy = content(); delete legacy.capabilityDetails;
    legacy.capabilities.frontend = [{ icon: 'react', name: '已有昵称' }];
    legacy.projects = [{ id: 'old-archive', visible: true, content: '旧作品不自动复活' }];
    const updatedAt = new Date('2026-10-01T12:00:00.000Z');
    await collection.insertOne({ key: 'main', version: 7, updatedAt, content: legacy });
    const original = await collection.findOne({ key: 'main' });
    for (const path of ['/site', '/site/config']) {
      const document = await owner.request(path).then(r => r.json());
      assert.equal(document.version, 7); assert.equal(document.updatedAt, updatedAt.toISOString());
      assert.deepEqual(document.content.capabilityDetails, capabilityDetailsDefaults());
      assert.deepEqual(document.content.capabilities, legacy.capabilities);
      assert.equal(Object.hasOwn(document.content, 'projects'), false);
    }
    assert.deepEqual(await collection.findOne({ key: 'main' }), original);
  });

  it('详情PUT必填，旧请求省略分区返回400且不会清空已保存履历', async () => {
    const legacy = content(); delete legacy.capabilityDetails;
    assert.equal((await save(owner, legacy)).status, 400);
    const collection = state.connection.collection('site_documents');
    assert.equal(await collection.countDocuments(), 0);
    const value = content(); value.capabilityDetails.company.name = '已经保存的公司';
    value.capabilityDetails.projects = [detailProject('private', { visible: false })];
    const response = await save(owner, value); assert.equal(response.status, 200);
    const saved = await response.json(), original = await collection.findOne({ key: 'main' });
    legacy.profile.name = '旧客户端只改昵称';
    assert.equal((await save(owner, legacy, 1)).status, 400);
    assert.deepEqual(await owner.request('/site/config').then(r => r.json()), saved);
    assert.deepEqual(await collection.findOne({ key: 'main' }), original);
  });

  it('详情Markdown原样原子保存，公开隐藏项目完全剔除，站主与重启读取保留全部', async () => {
    const value = content();
    const markdown = '# 公司\n\n- 业务\n\n| 模块 | 负责 |\n| --- | --- |\n| API | 我 |\n\n```ts\nconst x = 1\n```\n\n[链接](https://example.com/)\n\n![图片](https://example.com/a.png)\n\n<script>alert(1)</script>\n';
    value.capabilityDetails = {
      technology: { introduction: '  技术介绍保持原文\n第二行  ' },
      company: { name: '示例公司', summary: '公司简介', introduction: markdown, business: `业务\n${markdown}`, responsibilities: `岗位\n${markdown}` },
      projects: [detailProject('second', { content: markdown, coverUrl: 'https://example.com/two.png' }),
        detailProject('hidden-secret', { name: '隐藏名称-secret', summary: '隐藏简介-secret', content: '隐藏正文-secret', coverUrl: 'https://example.com/hidden-secret.png', visible: false }),
        detailProject('first', { coverUrl: '/api/site/assets/00000000-0000-4000-8000-000000000001.webp' })],
    };
    const response = await save(owner, value); assert.equal(response.status, 200);
    const saved = await response.json(); assert.deepEqual(saved.content, value);
    assert.deepEqual((await state.connection.collection('site_documents').findOne({ key: 'main' })).content, value);
    const expectedPublic = structuredClone(saved); expectedPublic.content.capabilityDetails.projects.splice(1, 1);
    const publicResponse = await client(state).request('/site'); assert.equal(publicResponse.status, 200);
    const publicView = await publicResponse.json(); assert.deepEqual(publicView, expectedPublic);
    assert.equal(JSON.stringify(publicView).includes('secret'), false);
    assert.deepEqual(await owner.request('/site/config').then(r => r.json()), saved);
    const previous = state, userId = owner.user.id, cookie = owner.cookie;
    await stopApp(previous, { drop: false });
    state = await startApp({ databaseName: previous.databaseName, config: { SITE_OWNER_USER_ID: userId, SITE_ASSETS_DIR: directory } });
    const restored = client(state); restored.cookie = cookie;
    assert.deepEqual(await restored.request('/site/config').then(r => r.json()), saved);
    assert.deepEqual(await client(state).request('/site').then(r => r.json()), expectedPublic);
  });

  it('详情项目排序、全隐藏与显式清空均保留，空字段不补回默认', async () => {
    const value = content();
    value.capabilityDetails.projects = [detailProject('b', { visible: false }), detailProject('a', { visible: false })];
    let response = await save(owner, value); assert.equal(response.status, 200);
    assert.deepEqual((await response.json()).content.capabilityDetails, value.capabilityDetails);
    assert.deepEqual((await client(state).request('/site').then(r => r.json())).content.capabilityDetails.projects, []);
    value.capabilityDetails.projects.reverse(); value.capabilityDetails.projects.forEach(project => { project.visible = true; });
    response = await save(owner, value, 1); assert.equal(response.status, 200);
    assert.deepEqual((await client(state).request('/site').then(r => r.json())).content.capabilityDetails.projects.map(project => project.id), ['a', 'b']);
    value.capabilityDetails.technology.introduction = ''; value.capabilityDetails.projects = [];
    response = await save(owner, value, 2); assert.equal(response.status, 200);
    assert.deepEqual((await response.json()).content.capabilityDetails, value.capabilityDetails);
    assert.deepEqual((await client(state).request('/site').then(r => r.json())).content, value);
  });

  it('详情Unicode最大文本、十二项目、64位ID与2048封面边界可在2MiB请求内完整保存', async () => {
    const value = content();
    value.capabilityDetails.technology.introduction = '🚀'.repeat(2000);
    value.capabilityDetails.company = { name: '🚀'.repeat(80), summary: '🚀'.repeat(300), introduction: '🚀'.repeat(10000), business: '🚀'.repeat(10000), responsibilities: '🚀'.repeat(10000) };
    const coverUrl = `https://example.com/${'a'.repeat(2048 - 'https://example.com/'.length)}`;
    value.capabilityDetails.projects = Array.from({ length: 12 }, (_, index) => detailProject(`${index}_-${'A'.repeat(62 - String(index).length)}`, { name: '🚀'.repeat(80), summary: '🚀'.repeat(300), content: '🚀'.repeat(20000), coverUrl }));
    assert.ok(Buffer.byteLength(JSON.stringify({ version: 0, content: value })) < 2 * 1024 * 1024);
    assert.ok(value.capabilityDetails.projects.every(project => project.id.length === 64));
    const response = await save(owner, value); assert.equal(response.status, 200);
    assert.deepEqual((await response.json()).content, value);
    const urls = ['', 'http://example.com/cover.jpg', 'https://example.com/cover.png', ...['png', 'jpg', 'webp'].map(extension => `/api/site/assets/00000000-0000-4000-8000-000000000001.${extension}`)];
    const small = content(); small.capabilityDetails.projects = urls.map((url, index) => detailProject(`url_${index}`, { coverUrl: url }));
    assert.equal((await save(owner, small, 1)).status, 200);
  });

  it('详情拒绝非法嵌套、重复ID、超限与危险封面，失败不改任何分区或版本', async () => {
    const value = content(); value.capabilityDetails.projects = [detailProject()];
    const initial = await save(owner, value); assert.equal(initial.status, 200);
    const original = await state.connection.collection('site_documents').findOne({ key: 'main' });
    const mutations = [
      c => { delete c.capabilityDetails; }, c => { c.capabilityDetails = null; }, c => { c.capabilityDetails = []; }, c => { c.capabilityDetails = 'text'; },
      c => { c.capabilityDetails.extra = true; },
      ...['technology', 'company', 'projects'].map(key => c => { delete c.capabilityDetails[key]; }),
      ...['technology', 'company'].flatMap(key => [c => { c.capabilityDetails[key] = null; }, c => { c.capabilityDetails[key] = []; }, c => { c.capabilityDetails[key].extra = true; }]),
      c => { delete c.capabilityDetails.technology.introduction; }, c => { c.capabilityDetails.technology.introduction = 1; },
      c => { c.capabilityDetails.technology.introduction = '🚀'.repeat(2001); },
      ...['name', 'summary', 'introduction', 'business', 'responsibilities'].flatMap(key => [c => { delete c.capabilityDetails.company[key]; }, c => { c.capabilityDetails.company[key] = null; }]),
      ...Object.entries({ name: 80, summary: 300, introduction: 10000, business: 10000, responsibilities: 10000 }).map(([key, max]) => c => { c.capabilityDetails.company[key] = '🚀'.repeat(max + 1); }),
      c => { c.capabilityDetails.projects = null; }, c => { c.capabilityDetails.projects = {}; }, c => { c.capabilityDetails.projects = [[]]; },
      c => { c.capabilityDetails.projects = [[detailProject()]]; }, c => { c.capabilityDetails.projects = [null]; }, c => { c.capabilityDetails.projects = ['text']; },
      c => { c.capabilityDetails.projects.push(detailProject()); },
      c => { c.capabilityDetails.projects = Array.from({ length: 13 }, (_, index) => detailProject(`p_${index}`)); },
      ...['id', 'name', 'summary', 'content', 'coverUrl', 'visible'].map(key => c => { delete c.capabilityDetails.projects[0][key]; }),
      c => { c.capabilityDetails.projects[0].extra = true; },
      ...['', 'a'.repeat(65), '中文', 'two words', '../bad', 'x.y', '🚀'].map(id => c => { c.capabilityDetails.projects[0].id = id; }),
      ...['', ' \t\n　', '🚀'.repeat(81), null, 123].map(name => c => { c.capabilityDetails.projects[0].name = name; }),
      c => { c.capabilityDetails.projects[0].summary = '🚀'.repeat(301); }, c => { c.capabilityDetails.projects[0].content = '🚀'.repeat(20001); },
      c => { c.capabilityDetails.projects[0].content = {}; }, c => { c.capabilityDetails.projects[0].summary = []; },
      ...['false', 0, null].map(visible => c => { c.capabilityDetails.projects[0].visible = visible; }),
      ...['javascript:alert(1)', 'data:image/png;base64,a', '//example.com/a.png', '/site/a.png', '/api/site/assets/../a.png',
        '/api/site/assets/00000000-0000-4000-8000-000000000001.mp3', '/api/site/assets/not-uuid.png',
        'https://user:password@example.com/a.png', 'https://example.com/a\\b', 'https://example.com/a\nb', 'https://example.com/a b',
        `https://example.com/${'a'.repeat(2049 - 'https://example.com/'.length)}`, null].map(coverUrl => c => { c.capabilityDetails.projects[0].coverUrl = coverUrl; }),
    ];
    for (const mutate of mutations) {
      const invalid = structuredClone(value); mutate(invalid);
      assert.equal((await save(owner, invalid, 1)).status, 400, mutate.toString());
      assert.deepEqual(await state.connection.collection('site_documents').findOne({ key: 'main' }), original);
    }
  });

  it('能力缺失时返回九项默认；新库只读不写，旧请求可保存，旧库读取不改版本或原文档', async () => {
    for (const path of ['/site', '/site/config']) {
      const response = await owner.request(path); assert.equal(response.status, 200);
      const document = await response.json();
      assert.equal(document.version, 0); assert.equal(document.updatedAt, null);
      assert.deepEqual(document.content.capabilities, capabilityDefaults());
    }
    assert.equal(await state.connection.collection('site_documents').countDocuments(), 0);
    const legacy = content(); delete legacy.capabilities;
    const response = await save(owner, legacy); assert.equal(response.status, 200);
    const saved = await response.json(); assert.deepEqual(saved.content.capabilities, capabilityDefaults());
    assert.deepEqual((await state.connection.collection('site_documents').findOne({ key: 'main' })).content.capabilities, capabilityDefaults());
    await state.connection.collection('site_documents').updateOne({ key: 'main' }, { $unset: { 'content.capabilities': '' } });
    const oldRecord = await state.connection.collection('site_documents').findOne({ key: 'main' });
    for (const path of ['/site', '/site/config']) {
      const document = await owner.request(path).then(r => r.json());
      assert.deepEqual(document.content.capabilities, capabilityDefaults());
      assert.equal(document.version, saved.version); assert.equal(document.updatedAt, saved.updatedAt);
    }
    assert.deepEqual(await state.connection.collection('site_documents').findOne({ key: 'main' }), oldRecord);
  });

  it('能力保存保持次序、自定义昵称及空组；同图标可跨类，Unicode四十字符与重启读取均保留', async () => {
    const value = content();
    value.capabilities = {
      ai: [{ icon: 'redis', name: '我的缓存搭档' }, { icon: 'codex', name: '🚀'.repeat(40) }],
      frontend: [{ icon: 'codex', name: '  编程助手  ' }], backend: [], deployment: [],
    };
    const response = await save(owner, value); assert.equal(response.status, 200);
    const saved = await response.json(); assert.deepEqual(saved.content.capabilities, value.capabilities);
    assert.deepEqual((await client(state).request('/site').then(r => r.json())).content.capabilities, value.capabilities);
    const previous = state, userId = owner.user.id, cookie = owner.cookie;
    await stopApp(previous, { drop: false });
    state = await startApp({ databaseName: previous.databaseName, config: { SITE_OWNER_USER_ID: userId, SITE_ASSETS_DIR: directory } });
    const restored = client(state); restored.cookie = cookie;
    assert.deepEqual(await restored.request('/site/config').then(r => r.json()), saved);
    assert.deepEqual((await client(state).request('/site').then(r => r.json())).content.capabilities, value.capabilities);
  });

  it('三十八个本地图标均可配置，每类十二项边界和四类全空允许且不会补回默认', async () => {
    const icons = ['codex', 'chatgpt', 'claude', 'deepseek', 'gemini', 'cursor', 'ollama', 'react', 'vuedotjs', 'typescript', 'javascript', 'html5', 'css3', 'vite', 'nextdotjs', 'antdesign', 'tailwindcss', 'nodedotjs', 'nestjs', 'express', 'python', 'fastapi', 'java', 'springboot', 'go', 'mongodb', 'mysql', 'postgresql', 'redis', 'docker', 'kubernetes', 'nginx', 'linux', 'git', 'github', 'githubactions', 'vercel', 'cloudflare'];
    const value = content();
    for (const [index, category] of ['ai', 'frontend', 'backend', 'deployment'].entries()) {
      value.capabilities[category] = icons.slice(index * 12, (index + 1) * 12).map(icon => ({ icon, name: icon }));
    }
    const first = await save(owner, value); assert.equal(first.status, 200);
    assert.deepEqual((await first.json()).content.capabilities, value.capabilities);
    // 四类都分别走十二项边界，避免某个分组漏装饰器而只被其他分组的测试掩盖。
    for (const category of ['ai', 'frontend', 'backend', 'deployment']) value.capabilities[category] = icons.slice(0, 12).map(icon => ({ icon, name: icon }));
    const maximum = await save(owner, value, 1); assert.equal(maximum.status, 200);
    assert.deepEqual((await maximum.json()).content.capabilities, value.capabilities);
    value.capabilities = { ai: [], frontend: [], backend: [], deployment: [] };
    const empty = await save(owner, value, 2); assert.equal(empty.status, 200);
    assert.deepEqual((await empty.json()).content.capabilities, value.capabilities);
    for (const path of ['/site', '/site/config']) assert.deepEqual((await owner.request(path).then(r => r.json())).content.capabilities, value.capabilities);
  });

  it('能力拒绝错误形状、未知字段和图标、同类重复、超限、超长Unicode和纯空白，失败保留原值', async () => {
    const initial = await save(owner); assert.equal(initial.status, 200);
    const original = await initial.json();
    const mutations = [
      c => { c.capabilities = null; }, c => { c.capabilities = []; }, c => { c.capabilities = 'ai'; }, c => { c.capabilities = 0; }, c => { c.capabilities = {}; },
      ...['ai', 'frontend', 'backend', 'deployment'].map(category => c => { delete c.capabilities[category]; }),
      c => { c.capabilities.other = []; }, c => { c.capabilities.ai = null; }, c => { c.capabilities.ai = {}; }, c => { c.capabilities.ai = 'codex'; },
      c => { c.capabilities.ai = [null]; }, c => { c.capabilities.ai = [[]]; }, c => { c.capabilities.ai = [[c.capabilities.ai[0]]]; },
      c => { c.capabilities.ai = [1]; }, c => { c.capabilities.ai = ['codex']; }, c => { c.capabilities.ai = [{}]; },
      c => { delete c.capabilities.ai[0].icon; }, c => { delete c.capabilities.ai[0].name; }, c => { c.capabilities.ai[0].extra = true; },
      c => { c.capabilities.ai[0].icon = 'openai'; }, c => { c.capabilities.ai[0].icon = '../codex'; }, c => { c.capabilities.ai[0].icon = 'Codex'; }, c => { c.capabilities.ai[0].icon = 1; },
      ...['ai', 'frontend', 'backend', 'deployment'].flatMap(category => [
        c => { c.capabilities[category].push({ ...c.capabilities[category][0], name: '同图标别名' }); },
        c => { c.capabilities[category] = ['codex', 'chatgpt', 'claude', 'deepseek', 'gemini', 'cursor', 'ollama', 'react', 'vuedotjs', 'typescript', 'javascript', 'html5', 'css3'].map(icon => ({ icon, name: icon })); },
        c => { c.capabilities[category] = [[]]; },
      ]),
      c => { c.capabilities.ai[0].name = '🚀'.repeat(41); }, c => { c.capabilities.ai[0].name = ''; }, c => { c.capabilities.ai[0].name = ' \t\n　\u00a0'; },
      c => { c.capabilities.ai[0].name = null; }, c => { c.capabilities.ai[0].name = 123; },
    ];
    for (const mutate of mutations) {
      const value = content(); mutate(value);
      assert.equal((await save(owner, value, 1)).status, 400, mutate.toString());
      assert.deepEqual(await owner.request('/site/config').then(r => r.json()), original);
    }
  });

  it('能力与详情沿用Session、Owner、CSRF与版本冲突保护，拒绝请求不覆盖已保存配置', async () => {
    const initial = await save(owner); assert.equal(initial.status, 200);
    const original = await initial.json();
    const value = content(); value.capabilities.ai = [{ icon: 'cursor', name: '新草稿' }];
    value.capabilityDetails.company.name = '不应发布的新公司';
    value.capabilityDetails.projects = [detailProject('private', { content: '不应发布的新项目', visible: false })];
    assert.equal((await save(client(state), value, 1)).status, 401);
    assert.equal((await save(outsider, value, 1)).status, 403);
    for (const token of ['', 'wrong']) {
      const response = await save(owner, value, 1, { csrf: false, headers: { 'X-CSRF-Token': token } });
      assert.equal(response.status, 403); assert.equal((await response.json()).code, 'CSRF_INVALID');
    }
    state.app.get(ConfigService).set('SITE_OWNER_USER_ID', '');
    assert.equal((await save(owner, value, 1)).status, 403);
    state.app.get(ConfigService).set('SITE_OWNER_USER_ID', owner.user.id);
    const conflict = await save(owner, value, 0); assert.equal(conflict.status, 409);
    assert.equal((await conflict.json()).code, 'SITE_VERSION_CONFLICT');
    assert.deepEqual(await owner.request('/site/config').then(r => r.json()), original);
  });

  it('音乐默认关闭，旧输入和旧数据库文档补默认，新响应始终包含完整music', async () => {
    const defaults = { enabled: false, title: '', sourceUrl: '', volume: 25, loop: true };
    assert.deepEqual((await client(state).request('/site').then(r => r.json())).content.music, defaults);
    const legacy = content(); delete legacy.music;
    const saved = await save(owner, legacy); assert.equal(saved.status, 200);
    assert.deepEqual((await saved.json()).content.music, defaults);
    await state.connection.collection('site_documents').updateOne({ key: 'main' }, { $unset: { 'content.music': '' } });
    for (const path of ['/site', '/site/config']) assert.deepEqual((await owner.request(path).then(r => r.json())).content.music, defaults);
  });

  it('音乐音源和0–100音量可原子保存，非法形状、未知字段及危险音源不污染原配置', async () => {
    const original = content(); original.music = { enabled: true, title: '我的音乐', sourceUrl: 'https://example.com/music.mp3', volume: 0, loop: false };
    let saved = await save(owner, original).then(r => r.json()); assert.equal(saved.version, 1);
    const mutations = [
      c => { c.music.volume = -1; }, c => { c.music.volume = 101; }, c => { c.music.volume = 1.5; }, c => { c.music.volume = '25'; },
      c => { c.music.title = '曲'.repeat(81); }, c => { c.music.enabled = 'true'; }, c => { c.music.loop = 1; },
      c => { c.music.sourceUrl = ''; }, c => { c.music.sourceUrl = '//evil.example/song.mp3'; }, c => { c.music.sourceUrl = 'javascript:alert(1)'; },
      c => { c.music.sourceUrl = '/api/site/assets/00000000-0000-4000-8000-000000000000.png'; },
      c => { c.music.sourceUrl = '/api/site/assets/../private.mp3'; }, c => { c.music.sourceUrl = 'https://user:secret@example.com/song.mp3'; },
      c => { c.music.extra = true; }, c => { c.music = null; }, c => { c.music = []; }, c => { c.music = [[c.music]]; },
      c => { delete c.music.loop; }, c => { c.unexpected = true; },
    ];
    for (const mutate of mutations) { const value = structuredClone(original); mutate(value); assert.equal((await save(owner, value, 1)).status, 400, mutate.toString()); }
    assert.deepEqual(await owner.request('/site/config').then(r => r.json()), saved);
    original.music.sourceUrl = '/api/site/assets/00000000-0000-4000-8000-000000000000.ogg'; original.music.volume = 100;
    const updated = await save(owner, original, 1); assert.equal(updated.status, 200); saved = await updated.json();
    assert.deepEqual((await client(state).request('/site').then(r => r.json())).content.music, saved.content.music);
  });

  it('音频上传沿用Session、Owner和CSRF，权限拒绝时不写媒体或配置', async () => {
    assert.equal((await uploadAudio(client(state))).status, 401);
    assert.equal((await uploadAudio(outsider)).status, 403);
    for (const token of ['', 'wrong']) assert.equal((await uploadAudio(owner, wav(), 'audio/wav', { 'X-CSRF-Token': token })).status, 403);
    state.app.get(ConfigService).set('SITE_OWNER_USER_ID', '');
    assert.equal((await uploadAudio(owner)).status, 403);
    assert.deepEqual(await readdir(directory), []); assert.equal(await state.connection.collection('site_documents').countDocuments(), 0);
  });

  it('MP3含ID3或MPEG帧、WAV和音频OGG按实际格式保存，GET类型正确且上传不发布', async () => {
    const id3 = Buffer.concat([Buffer.from('49443304000000000000', 'hex'), mp3]);
    for (const [bytes, mime, extension, expectedMime] of [[wav(), 'audio/wav', 'wav', 'audio/wav'], [mp3, 'audio/mpeg', 'mp3', 'audio/mpeg'], [id3, 'audio/mp3', 'mp3', 'audio/mpeg'], [ogg(), 'audio/ogg', 'ogg', 'audio/ogg'], [ogg('vorbis'), 'application/ogg', 'ogg', 'audio/ogg']]) {
      const response = await uploadAudio(owner, bytes, mime); assert.equal(response.status, 201);
      const { url } = await response.json(); assert.match(url, new RegExp(`^/api/site/assets/[a-f\\d-]{36}\\.${extension}$`));
      const file = await fetch(`${state.baseUrl}${url}`); assert.equal(file.status, 200);
      assert.equal(file.headers.get('content-type'), expectedMime); assert.equal(file.headers.get('x-content-type-options'), 'nosniff');
      assert.deepEqual(Buffer.from(await file.arrayBuffer()), bytes);
    }
    assert.equal((await owner.request('/site/config').then(r => r.json())).version, 0);
    assert.equal((await readdir(directory)).length, 5);
  });

  it('音频拒绝伪造头、截断容器、视频OGG、错误MIME、空文件及额外表单字段', async () => {
    const badRiff = wav(); badRiff.write('WEBP', 8);
    const invalid = [
      [Buffer.from('ID3'), 'audio/mpeg'], [Buffer.from('4944330400007f7f7f7f', 'hex'), 'audio/mpeg'],
      [Buffer.from([0xff, 0xfb, 0x90, 0x00]), 'audio/mpeg'], [Buffer.alloc(32, 0xff), 'audio/mpeg'],
      [badRiff, 'audio/wav'], [wav().subarray(0, 42), 'audio/wav'], [ogg('theora'), 'audio/ogg'], [ogg().subarray(0, 30), 'audio/ogg'],
      [Buffer.concat([ogg(), ogg('theora')]), 'audio/ogg'],
      [png, 'audio/wav'], [wav(), 'audio/mpeg'], [Buffer.alloc(0), 'audio/wav'], [wav(), 'text/html'],
    ];
    for (const [bytes, mime] of invalid) assert.equal((await uploadAudio(owner, bytes, mime)).status, 400);
    const headers = { Cookie: owner.cookie, 'X-CSRF-Token': owner.csrfToken };
    assert.equal((await fetch(`${state.baseUrl}/api/site/audio-assets`, { method: 'POST', body: new FormData(), headers })).status, 400);
    const form = new FormData(); form.append('file', new Blob([wav()], { type: 'audio/wav' }), 'sound.wav'); form.append('enabled', 'true');
    assert.equal((await fetch(`${state.baseUrl}/api/site/audio-assets`, { method: 'POST', body: form, headers })).status, 400);
    assert.deepEqual(await readdir(directory), []);
  });

  it('音频签名按原始字节比较，不能把高位字符当作ASCII容器头', async () => {
    for (const [bytes, mime] of [[wav(), 'audio/wav'], [ogg(), 'audio/ogg']]) {
      bytes[0] |= 0x80;
      assert.equal((await uploadAudio(owner, bytes, mime)).status, 400);
    }
    assert.deepEqual(await readdir(directory), []);
  });

  it('WAV支持常见A-law和μ-law编码，不把合法音频误拒为格式错误', async () => {
    for (const format of [6, 7]) {
      // 非PCM WAV含fmt扩展长度与fact采样数；这是两种常见压扩编码的独立合同夹具。
      const data = Buffer.alloc(74);
      data.write('RIFF'); data.writeUInt32LE(66, 4); data.write('WAVEfmt ', 8);
      data.writeUInt32LE(18, 16); data.writeUInt16LE(format, 20); data.writeUInt16LE(1, 22);
      data.writeUInt32LE(8000, 24); data.writeUInt32LE(8000, 28); data.writeUInt16LE(1, 32); data.writeUInt16LE(8, 34);
      data.write('fact', 38); data.writeUInt32LE(4, 42); data.writeUInt32LE(16, 46);
      data.write('data', 50); data.writeUInt32LE(16, 54); data.fill(format === 6 ? 0xd5 : 0xff, 58);
      const response = await uploadAudio(owner, data); assert.equal(response.status, 201);
      const { url } = await response.json(); const file = await fetch(`${state.baseUrl}${url}`);
      assert.equal(file.headers.get('content-type'), 'audio/wav'); assert.deepEqual(Buffer.from(await file.arrayBuffer()), data);
    }
  });

  it('音频15MiB精确边界允许，超限拒绝且不产生额外文件', async () => {
    assert.equal((await uploadAudio(owner, wav(15 * 1024 * 1024))).status, 201);
    assert.equal((await uploadAudio(owner, wav(15 * 1024 * 1024 + 1))).status, 400);
    assert.equal((await uploadAudio(owner, wav(16 * 1024 * 1024))).status, 400);
    assert.equal((await readdir(directory)).length, 1);
  });

  it('[P24] 默认公开与站主响应不含projects且不落库；no-store保持', async () => {
    const response = await client(state).request('/site');
    assert.equal(response.status, 200); assert.equal(response.headers.get('cache-control'), 'no-store');
    const document = await response.json();
    assert.equal(document.version, 0); assert.equal(document.updatedAt, null);
    assert.equal(Object.hasOwn(document.content, 'projects'), false);
    assert.equal(await state.connection.collection('site_documents').countDocuments(), 0);
    const config = await owner.request('/site/config');
    assert.equal(config.headers.get('cache-control'), 'no-store');
    assert.equal(Object.hasOwn((await config.json()).content, 'projects'), false);
  });

  it('匿名401，普通用户403且无配置，缺省站主拒绝读写与上传', async () => {
    for (const user of [client(state), outsider]) {
      const expected = user === outsider ? 403 : 401;
      for (const response of [await user.request('/site/config'), await save(user), await uploadAudio(user)]) {
        assert.equal(response.status, expected);
        assert.equal('content' in await response.json(), false);
      }
    }
    state.app.get(ConfigService).set('SITE_OWNER_USER_ID', '');
    for (const response of [await owner.request('/site/config'), await save(owner), await uploadAudio(owner)]) {
      assert.equal(response.status, 403); assert.equal((await response.json()).code, 'SITE_OWNER_NOT_CONFIGURED');
    }
    assert.deepEqual(await readdir(directory), []);
  });

  it('[P24] 无projects原子保存完整文档，公开与站主一致且重启后版本与数据保留', async () => {
    const response = await save(owner); assert.equal(response.status, 200);
    const saved = await response.json(); assert.equal(saved.version, 1); assert.ok(Number.isFinite(Date.parse(saved.updatedAt)));
    assert.deepEqual(saved.content, content());
    const publicView = await client(state).request('/site').then(r => r.json());
    assert.deepEqual(publicView, saved);
    assert.equal(Object.hasOwn(saved.content, 'projects'), false);
    const stored = await state.connection.collection('site_documents').findOne({ key: 'main' });
    assert.deepEqual(stored.content, content());
    assert.equal(Object.hasOwn(stored.content, 'projects'), false);
    const userId = owner.user.id, cookie = owner.cookie, previous = state;
    await stopApp(previous, { drop: false });
    state = await startApp({ databaseName: previous.databaseName, config: { SITE_OWNER_USER_ID: userId, SITE_ASSETS_DIR: directory } });
    const restored = client(state); restored.cookie = cookie;
    assert.deepEqual(await restored.request('/site/config').then(r => r.json()), saved);
  });

  it('详情与能力首次及已有版本的同版本并发只有一次成功，冲突不混合或覆盖胜者', async () => {
    for (const version of [0, 1]) {
      const payloads = ['甲', '乙'].map((name, index) => {
        const value = content(); value.profile.name = name;
        value.capabilities.ai = [{ icon: index ? 'claude' : 'codex', name }];
        value.capabilityDetails.company.name = `公司${name}`;
        value.capabilityDetails.projects = [detailProject(`winner_${index}`, { name: `项目${name}`, content: `正文${name}`, visible: false })];
        return value;
      });
      const responses = await Promise.all(payloads.map(value => save(owner, value, version)));
      assert.deepEqual(responses.map(r => r.status).sort(), [200, 409]);
      const winner = await responses.find(r => r.status === 200).json();
      assert.equal(winner.version, version + 1);
      assert.ok(payloads.some(value => JSON.stringify(value) === JSON.stringify(winner.content)));
      assert.deepEqual(await owner.request('/site/config').then(r => r.json()), winner);
      assert.deepEqual((await state.connection.collection('site_documents').findOne({ key: 'main' })).content, winner.content);
      assert.deepEqual((await client(state).request('/site').then(r => r.json())).content.capabilityDetails.projects, []);
    }
  });

  it('缺失或错误CSRF拒绝写入与上传，错误码可区分权限失败', async () => {
    for (const csrfToken of ['', 'wrong']) {
      const response = await save(owner, content(), 0, { csrf: false, headers: { 'X-CSRF-Token': csrfToken } });
      assert.equal(response.status, 403); assert.equal((await response.json()).code, 'CSRF_INVALID');
      assert.equal((await uploadAudio(owner, wav(), 'audio/wav', { 'X-CSRF-Token': csrfToken })).status, 403);
    }
    assert.equal(await state.connection.collection('site_documents').countDocuments(), 0);
    assert.deepEqual(await readdir(directory), []);
  });

  it('拒绝未知字段、超限、危险URL与错误类型且原文档不变', async () => {
    const original = await save(owner).then(r => r.json());
    const mutations = [
      c => { c.profile.role = 'owner'; }, c => { c.profile.name = ' '; }, c => { c.profile.name = 'a'.repeat(61); },
      c => { c.home.title = ''; }, c => { c.home.subtitle = 'a'.repeat(241); },
      c => { c.contact.links[0].url = 'javascript:alert(1)'; }, c => { c.contact.links[0].url = '/tasks'; },
      c => { c.contact.links[0].url = '//evil.example/'; }, c => { c.contact.links[0].url = 'data:text/html,test'; },
      c => { c.contact.links[0].url = 'https://example.com/\nunsafe'; }, c => { c.contact.links[0].url = 'https://user:secret@example.com/'; },
      c => { c.contact.links[0].label = ' '; }, c => { c.contact.links = Array(9).fill(c.contact.links[0]); },
      c => { c.contact.email = 'wrong'; }, c => { c.contact.links[0].url = 'file:///etc/passwd'; },
      c => { c.appearance.character = 'other'; }, c => { c.appearance.motion = 1; },
    ];
    for (const mutate of mutations) {
      const value = content(); mutate(value);
      assert.equal((await save(owner, value, 1)).status, 400, mutate.toString());
    }
    for (const body of [{ version: -1, content: content() }, { version: 1.5, content: content() }, { version: '1', content: content() }, { version: 1, content: content(), updatedAt: new Date().toISOString() }, { version: 1, content: null }]) {
      assert.equal((await owner.request('/site/config', { method: 'PUT', body })).status, 400);
    }
    assert.deepEqual(await owner.request('/site/config').then(r => r.json()), original);
  });

  // 每种非法形状使用独立测试库，先前意外保存不会让后面的用例只得到版本冲突。
  for (const [label, mutate] of [
    ['links:[[]]', c => { c.contact.links = [[]]; }],
    ['links:[[合法对象]]', c => { c.contact.links = [[c.contact.links[0]]]; }],
  ]) {
    it(`每一项必须是对象：${label}不得绕过DTO校验或污染已保存内容`, async () => {
      const original = await save(owner).then(r => r.json());
      const value = content(); mutate(value);
      // ValidateNested会递归遍历数组，必须额外拒绝“数组里还是数组”。
      assert.equal((await save(owner, value, 1)).status, 400);
      assert.deepEqual(await owner.request('/site/config').then(r => r.json()), original);
    });
  }

  it('联系邮箱仅接受前端支持的常见无空白格式，拒绝引号空格邮箱且不修改内容', async () => {
    const original = await save(owner).then(r => r.json());
    const invalid = content(); invalid.contact.email = '"foo bar"@example.com';
    assert.equal((await save(owner, invalid, 1)).status, 400);
    assert.deepEqual(await owner.request('/site/config').then(r => r.json()), original);
    const valid = content(); valid.contact.email = 'hello+site@example.com';
    const response = await save(owner, valid, 1);
    assert.equal(response.status, 200);
    assert.equal((await response.json()).content.contact.email, valid.contact.email);
    valid.contact.email = '';
    assert.equal((await save(owner, valid, 2)).status, 200);
  });

  it('联系和能力显式空列表允许，通用文本完整保存', async () => {
    const value = content(); value.contact = { email: '', links: [] };
    value.profile.bio = '介'.repeat(4000);
    value.capabilities = { ai: [], frontend: [], backend: [], deployment: [] };
    const response = await save(owner, value); assert.equal(response.status, 200);
    assert.deepEqual((await response.json()).content, value);
  });

  // 历史媒体通过隔离目录直接布置，证明删除上传入口不会删除或禁止已有媒体读取。
  it('[P24] 图片POST入口为404且不写文件，历史图片GET与路径防护保留', async () => {
    for (const user of [owner, outsider, client(state)]) {
      const response = await removedImageUpload(user); assert.equal(response.status, 404);
    }
    assert.equal((await removedImageUpload(owner, { 'X-CSRF-Token': '' })).status, 404);
    state.app.get(ConfigService).set('SITE_OWNER_USER_ID', '');
    assert.equal((await removedImageUpload(owner)).status, 404);
    assert.equal((await owner.request('/site/assets', { method: 'POST', body: { ignored: true } })).status, 404);
    assert.deepEqual(await readdir(directory), []);
    assert.equal(await state.connection.collection('site_documents').countDocuments(), 0);
    const historical = [
      ['00000000-0000-4000-8000-000000000001.png', png, 'image/png'],
      ['00000000-0000-4000-8000-000000000002.jpg', Buffer.from([255, 216, 255, 217]), 'image/jpeg'],
      ['00000000-0000-4000-8000-000000000003.webp', Buffer.from('historical-image-bytes'), 'image/webp'],
    ];
    for (const [filename, bytes, mime] of historical) {
      await writeFile(join(directory, filename), bytes);
      const file = await fetch(`${state.baseUrl}/api/site/assets/${filename}`);
      assert.equal(file.status, 200); assert.equal(file.headers.get('content-type'), mime);
      assert.equal(file.headers.get('x-content-type-options'), 'nosniff');
      assert.deepEqual(Buffer.from(await file.arrayBuffer()), bytes);
    }
    assert.equal((await fetch(`${state.baseUrl}/api/site/assets/not-a-uuid.png`)).status, 400);
    assert.equal((await fetch(`${state.baseUrl}/api/site/assets/00000000-0000-4000-8000-000000000000.png`)).status, 404);
    assert.equal((await fetch(`${state.baseUrl}/api/site/assets/%2E%2E%2F.env`)).status, 400);
    assert.equal((await readdir(directory)).length, 3);
  });

  it('[P24] 旧Mongo文档只读剔除projects且不改版本；下一次正常保存整体替换内容', async () => {
    // 通过原生集合放入历史数据，绕开新DTO；这只影响每用例独立临时库。
    const legacy = { ...content(), projects: [{ id: 'legacy-visible', visible: true }, { id: 'legacy-hidden', visible: false }] };
    const updatedAt = new Date('2026-10-01T12:00:00.000Z');
    await state.connection.collection('site_documents').insertOne({ key: 'main', version: 7, updatedAt, content: legacy });
    const original = await state.connection.collection('site_documents').findOne({ key: 'main' });
    for (const path of ['/site', '/site/config']) {
      const response = await owner.request(path); assert.equal(response.status, 200);
      const document = await response.json();
      assert.equal(document.version, 7); assert.equal(document.updatedAt, updatedAt.toISOString());
      assert.equal(Object.hasOwn(document.content, 'projects'), false); assert.deepEqual(document.content, content());
    }
    assert.deepEqual(await state.connection.collection('site_documents').findOne({ key: 'main' }), original);
    const value = content(); value.profile.name = '正常更新';
    const response = await save(owner, value, 7); assert.equal(response.status, 200);
    const saved = await response.json(); assert.equal(saved.version, 8); assert.deepEqual(saved.content, value);
    const stored = await state.connection.collection('site_documents').findOne({ key: 'main' });
    assert.equal(Object.hasOwn(stored.content, 'projects'), false); assert.deepEqual(stored.content, value);
  });

  it('[P24] projects无论为空或有值都作为未知字段400，拒绝不写库不改版本', async () => {
    const collection = state.connection.collection('site_documents');
    for (const projects of [[], [{ id: 'old' }], null]) {
      const response = await save(owner, { ...content(), projects }); assert.equal(response.status, 400);
      assert.equal(await collection.countDocuments(), 0);
    }
    const response = await save(owner); assert.equal(response.status, 200);
    const original = await collection.findOne({ key: 'main' });
    for (const projects of [[], [{ id: 'old' }], null]) {
      assert.equal((await save(owner, { ...content(), projects }, 1)).status, 400);
      assert.deepEqual(await collection.findOne({ key: 'main' }), original);
    }
  });
});
