# 公开对话历史与 LangGraph Agent 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让 `/chat` 按匿名浏览器保存多条会话历史，并用 LangChain + LangGraph 重写公开对话的模型调用与流式编排。

**Architecture:** 前端用 `localStorage` 生成匿名 visitor UUID，通过 `X-Visitor-Id` 找回自己的会话；后端把会话作为 `site_chat_conversations` 单文档保存，内嵌有界 `turns`，以 `active`/`activeUntil` 单文档锁保证同一会话只有一个流。公开对话的线性 LangGraph 依次加载会话、构建站点上下文、调用 LangChain 模型、写入终态；Mongo 是历史唯一事实来源，不启用 checkpointer。

**Tech Stack:** NestJS 12、Mongoose 9、Node 22.22.3、`@langchain/core@1.5.1`、`@langchain/langgraph@1.7.5`、`@langchain/deepseek@1.1.26`、`@langchain/openai@1.8.5`、React 19、MobX、React Router。

**Spec:** `docs/specs/011-site-chat-history.md`

## Global Constraints

- Node `>=22.22.3`；后端 ESM 源码的相对 import 必须带 `.js` 后缀。
- 后端测试必须显式提供隔离库：`MONGODB_URI=mongodb://127.0.0.1:27019/nest_test_base`；`npm test` 先 `nest build` 再跑真实 HTTP。
- 手写后端源码保留中文学习注释；DTO 用运行时类与 class-validator 装饰器，不用 `Partial<T>` 代替校验。
- 公开响应不得包含 `visitorHash`、系统提示词、模型 Key、上游地址或内部堆栈。
- `X-Visitor-Id` 只接受 UUID v4；服务端只存 `sha256(visitorId)`，它不构成认证。
- 匿名 visitor 上限：20 个会话、每个会话 100 轮、单条用户消息 500 码点、助手正文 16000 字符、最近活动后 30 天 TTL。
- `history` 字段为旧前端兼容保留但服务端忽略；新前端不发送它。
- SSE 协议以 `docs/specs/011-site-chat-history.md` 的「SSE 协议与长连接」为准：唯一 stream 路由、30 秒空闲 ping、45 秒前端 watchdog；后端共享 writer，前端唯一 parser，不得两套格式。
- 不迁移 `backend/src/chat` 的站主 owner chat；公开对话先走 LangChain，owner chat 继续用现有 provider。
- 前端没有 test 脚本；前端验证使用 `npm run check`、`npm run lint`、`npm run build` 与 Chrome 桌面/移动检查。
- 保留工作区原有 resume/queue/tasks/docs 改动；不提交、不推送、不部署，除非用户另行要求。

## Review Focus

- **伪造或缺失 visitor：** 缺失 `X-Visitor-Id` 的 GET 返回空列表而不是 500；用别的 visitor 的会话 ID 访问必须 404，不能泄露标题或正文。
- **崩溃留下的活动锁：** 进程在流式回复中被杀后，`active=true` 且 `activeUntil` 已过；下一次打开或发送必须把旧轮次标成失败并释放锁，而不是永久 409。
- **重复 requestId / 并发发送：** 已完成请求重放不得再次调用上游；生成中的第二个请求必须 409；不产生并行上游调用。
- **上限与 TTL：** 第 21 个会话、第 101 轮必须返回明确错误；`expiresAt` TTL 索引存在且每次活动刷新。
- **旧前端与 localStorage 禁用：** 旧前端仍带 `history` 时请求不 400、字段被忽略；`localStorage` 不可用时前端退回 `sessionStorage`/内存并提示，不能白屏。

---

### Task 1: 匿名访客、会话 Schema 与历史读取 API

**Files:**
- Create: `backend/src/site/chat/schemas/site-chat-conversation.schema.ts`
- Create: `backend/src/site/chat/site-chat.types.ts`
- Create: `backend/src/site/chat/site-chat.repository.ts`
- Modify: `backend/src/site/site-chat.controller.ts`
- Modify: `backend/src/site/site.module.ts`
- Test: `backend/test/site-chat-history.e2e.test.mjs`

**Interfaces:**
- Consumes: `MongooseModule.forFeature`、`createHash`、现有 `SiteModule`。
- Produces:
  - `export type SiteChatTurnStatus = 'streaming' | 'completed' | 'failed' | 'canceled'`
  - `export interface SiteChatTurnView { requestId: string; content: string; answer: string; status: SiteChatTurnStatus; modelId: string; error: string | null; createdAt: string; updatedAt: string }`
  - `export interface SiteChatConversationSummary { id: string; title: string; updatedAt: string; messageCount: number; preview: string }`
  - `export interface SiteChatConversationView { conversation: { id: string; title: string; createdAt: string; updatedAt: string }; turns: SiteChatTurnView[] }`
  - `export function hashVisitor(value: string): string`
  - `export function isVisitorId(value: unknown): value is string`（UUID v4）
  - `export function isUuid(value: unknown): value is string`（UUID v4）
  - `SiteChatRepository.list(visitorHash: string): Promise<SiteChatConversationSummary[]>`
  - `SiteChatRepository.get(visitorHash: string, id: string): Promise<SiteChatConversationView | null>`
  - `SiteChatRepository.remove(visitorHash: string, id: string): Promise<boolean>`
  - `GET /api/site-chat/conversations` → `{ conversations: SiteChatConversationSummary[] }`
  - `GET /api/site-chat/conversations/:id` → `SiteChatConversationView` 或 `404 SITE_CHAT_CONVERSATION_NOT_FOUND`
  - `DELETE /api/site-chat/conversations/:id` → `204` 或 `404`

- [x] **Step 1: 写失败的 e2e 测试**

在 `backend/test/site-chat-history.e2e.test.mjs` 写入：

```js
import assert from 'node:assert/strict'
import { createHash, randomUUID } from 'node:crypto'
import { afterEach, beforeEach, describe, it } from 'node:test'
import { startApp, stopApp } from './helpers/app.mjs'
import { modelFixture, collect, events } from './helpers/chat-fixture.mjs'

const visitorA = '11111111-1111-4111-8111-111111111111'
const visitorB = '22222222-2222-4222-8222-222222222222'
const hash = value => createHash('sha256').update(value).digest('hex')

describe('公开对话历史读取', () => {
  let state, upstream
  beforeEach(async () => {
    upstream = await modelFixture()
    state = await startApp({ config: { GLM_API_KEY: 'fixture-key', GLM_BASE_URL: upstream.url, CHAT_MODELS_JSON: '' } })
  })
  afterEach(async () => { await stopApp(state); await upstream.close() })

  const seed = overrides => state.connection.collection('site_chat_conversations').insertOne({
    id: randomUUID(), visitorHash: hash(visitorA), title: '测试会话',
    turns: [{ requestId: randomUUID(), content: '测试', answer: '回答', status: 'completed', modelId: 'glm-4.7-flash', error: null, createdAt: new Date(), updatedAt: new Date() }],
    active: false, activeUntil: null,
    expiresAt: new Date(Date.now() + 86400000),
    createdAt: new Date(), updatedAt: new Date(), ...overrides,
  })

  it('缺少visitor返回空列表且不建数据', async () => {
    const response = await fetch(`${state.baseUrl}/api/site-chat/conversations`)
    assert.equal(response.status, 200)
    assert.deepEqual(await response.json(), { conversations: [] })
    assert.equal(await state.connection.collection('site_chat_conversations').countDocuments(), 0)
  })

  it('只返回当前visitor的会话，按更新时间倒序', async () => {
    await seed({ title: '旧会话', updatedAt: new Date('2026-01-01') })
    await seed({ title: '新会话', updatedAt: new Date('2026-02-01') })
    await seed({ visitorHash: hash(visitorB), title: '别人的会话' })
    const response = await fetch(`${state.baseUrl}/api/site-chat/conversations`, {
      headers: { 'X-Visitor-Id': visitorA },
    })
    assert.equal(response.status, 200)
    const body = await response.json()
    assert.deepEqual(body.conversations.map(item => item.title), ['新会话', '旧会话'])
    assert.equal(JSON.stringify(body).includes('别人的会话'), false)
  })

  it('他人会话详情与删除均为404，自己的删除后204再404', async () => {
    const id = randomUUID()
    await seed({ id })
    assert.equal((await fetch(`${state.baseUrl}/api/site-chat/conversations/${id}`, {
      headers: { 'X-Visitor-Id': visitorB },
    })).status, 404)
    assert.equal((await fetch(`${state.baseUrl}/api/site-chat/conversations/${id}`, {
      method: 'DELETE', headers: { 'X-Visitor-Id': visitorB },
    })).status, 404)
    assert.equal((await fetch(`${state.baseUrl}/api/site-chat/conversations/${id}`, {
      method: 'DELETE', headers: { 'X-Visitor-Id': visitorA },
    })).status, 204)
    assert.equal((await fetch(`${state.baseUrl}/api/site-chat/conversations/${id}`, {
      headers: { 'X-Visitor-Id': visitorA },
    })).status, 404)
  })

  it('建立30天TTL索引与visitor排序索引', async () => {
    const indexes = await state.connection.collection('site_chat_conversations').indexes()
    assert.ok(indexes.some(index => index.key.expiresAt === 1 && index.expireAfterSeconds === 0))
    assert.ok(indexes.some(index => index.key.visitorHash === 1 && index.key.updatedAt === -1))
  })
})
```

- [x] **Step 2: 运行测试，确认失败**

```bash
cd backend
npm run build
MONGODB_URI=mongodb://127.0.0.1:27019/nest_test_base node --test test/site-chat-history.e2e.test.mjs
```

Expected: FAIL，`/api/site-chat/conversations` 返回 404，或 `site_chat_conversations` 集合不存在。

- [x] **Step 3: 实现 schema、types、repository 与只读接口**

`site-chat-conversation.schema.ts` 定义 `SiteChatTurnRecord` 与 `SiteChatConversationRecord`，字段严格按 SPEC-011；`id` 使用 `randomUUID()`、`collection: 'site_chat_conversations'`、`versionKey: false`、`id: false`。索引：

```ts
SiteChatConversationSchema.index({ visitorHash: 1, updatedAt: -1 })
SiteChatConversationSchema.index({ id: 1 }, { unique: true })
SiteChatConversationSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 })
```

`site-chat.types.ts` 定义上面 Interfaces 中的类型；`hashVisitor` 用 `createHash('sha256').update(value).digest('hex')`。

`site-chat.repository.ts` 用 `@InjectModel(SiteChatConversationRecord.name)` 读取；`list` 只取 `turns` 非空、按 `updatedAt` 倒序、最多 20 条，`messageCount = turns.length`，`preview` 取最后一条 `answer || content` 的前 80 个码点；`get` 必须同时匹配 `id` 与 `visitorHash`；`remove` 用 `deleteOne` 并返回 `deletedCount === 1`。

`site-chat.controller.ts` 增加：

```ts
@Get('conversations')
list(@Headers('x-visitor-id') visitor?: string) {
  if (!isVisitorId(visitor)) return { conversations: [] }
  return this.repository.list(hashVisitor(visitor))
}

@Get('conversations/:id')
async detail(@Headers('x-visitor-id') visitor: string | undefined, @Param('id') id: string) {
  if (!isVisitorId(visitor) || !isUuid(id)) throw new NotFoundException({ message: '会话不存在', code: 'SITE_CHAT_CONVERSATION_NOT_FOUND' })
  const view = await this.repository.get(hashVisitor(visitor), id)
  if (!view) throw new NotFoundException({ message: '会话不存在', code: 'SITE_CHAT_CONVERSATION_NOT_FOUND' })
  return view
}

@Delete('conversations/:id')
@HttpCode(204)
async remove(...) { ... }
```

将 schema 注册到 `SiteModule` 的 `MongooseModule.forFeature`，并把 `SiteChatRepository`、`SiteChatService` 等加入 providers。

- [x] **Step 4: 重跑测试，确认通过**

```bash
cd backend
npm run build
MONGODB_URI=mongodb://127.0.0.1:27019/nest_test_base node --test test/site-chat-history.e2e.test.mjs
```

Expected: PASS，4/4。

- [x] **Step 5: 提交**

```bash
git add backend/src/site/chat backend/src/site/site-chat.controller.ts backend/src/site/site.module.ts backend/test/site-chat-history.e2e.test.mjs
git commit -m "feat: add anonymous site chat history read api"
```

---

### Task 2: 流式写入、会话锁与历史生命周期

**Files:**
- Modify: `backend/src/site/dto/public-chat.dto.ts`
- Modify: `backend/src/site/chat/site-chat.repository.ts`
- Modify: `backend/src/site/chat/site-chat.service.ts`
- Modify: `backend/src/site/site-chat.controller.ts`
- Test: `backend/test/site-chat-history.e2e.test.mjs`

**Interfaces:**
- Consumes: Task 1 的 `SiteChatRepository`、`hashVisitor`、`SiteChatTurnView`。
- Produces:
  - `PublicChatDto { requestId: string; conversationId?: string; message: string; history?: PublicChatHistoryDto[] }`，`history` 保留但不参与构建。
  - `SiteChatRepository.beginTurn(input: { visitorHash: string; conversationId?: string; requestId: string; content: string; modelId: string; lockMs: number }): Promise<{ conversationId: string; turnId: string; history: ModelMessage[]; answer?: string }>`
  - `SiteChatRepository.appendAnswer(visitorHash: string, conversationId: string, requestId: string, answer: string): Promise<void>`
  - `SiteChatRepository.finishTurn(visitorHash: string, conversationId: string, requestId: string, status: 'completed' | 'failed' | 'canceled', error?: string | null): Promise<void>`
  - `SiteChatRepository.release(visitorHash: string, conversationId: string): Promise<void>`
  - SSE：`start { conversationId, turnId }` → `delta { text }` → `done { conversationId, turnId }`；错误为 `error { message }`。

- [x] **Step 1: 写失败的流式测试**

在同一测试文件追加：

```js
const post = (body, visitor = visitorA, signal) => fetch(`${state.baseUrl}/api/site-chat/stream`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', 'X-Visitor-Id': visitor },
  body: JSON.stringify(body), signal,
})

it('首条消息创建会话并返回start/delta/done，详情可恢复', async () => {
  const requestId = randomUUID()
  const result = await collect(await post({ requestId, message: '你好' }))
  assert.equal(result[0].type, 'start')
  assert.ok(result[0].conversationId)
  assert.equal(result[0].turnId, requestId)
  assert.equal(result.at(-1).type, 'done')
  assert.equal(result.filter(item => item.type === 'delta').map(item => item.text).join(''), '你好，世界')

  const detail = await fetch(`${state.baseUrl}/api/site-chat/conversations/${result[0].conversationId}`, {
    headers: { 'X-Visitor-Id': visitorA },
  }).then(response => response.json())
  assert.equal(detail.conversation.title, '你好')
  assert.deepEqual(detail.turns.map(turn => [turn.content, turn.status]), [['你好', 'completed']])
  assert.equal(detail.turns[0].answer, '你好，世界')
})

it('第二轮使用服务端历史而不是客户端history', async () => {
  const first = await collect(await post({ requestId: randomUUID(), message: '第一句' }))
  const conversationId = first[0].conversationId
  const second = await collect(await post({
    requestId: randomUUID(), conversationId, message: '第二句',
    history: [{ role: 'user', content: '伪造历史' }, { role: 'assistant', content: '伪造回答' }],
  }))
  assert.equal(second[0].conversationId, conversationId)
  const messages = upstream.calls.at(-1).body.messages
  assert.deepEqual(messages.slice(-3).map(item => item.content), ['第一句', '你好，世界', '第二句'])
  assert.equal(JSON.stringify(messages).includes('伪造历史'), false)
})

it('相同requestId已完成时重放done，不再调用上游', async () => {
  const requestId = randomUUID()
  const first = await collect(await post({ requestId, message: '只调用一次' }))
  const calls = upstream.calls.length
  const replay = await collect(await post({ requestId, message: '只调用一次' }))
  assert.equal(replay[0].type, 'start')
  assert.equal(replay.at(-1).type, 'done')
  assert.equal(upstream.calls.length, calls)
  assert.equal(replay[0].conversationId, first[0].conversationId)
  assert.equal(replay.some(item => item.type === 'delta'), true)
})

it('同会话生成中第二个请求返回409，断开后释放锁', async () => {
  let release
  upstream.handle(async ({ response }) => {
    response.writeHead(200, { 'Content-Type': 'text/event-stream' })
    response.write('data: {"choices":[{"delta":{"content":"部分"}}]}\n\n')
    await new Promise(resolve => { release = resolve })
    response.end('data: [DONE]\n\n')
    return true
  })
  const controller = new AbortController()
  const firstResponse = await post({ requestId: randomUUID(), message: '并发' }, visitorA, controller.signal)
  const iterator = events(firstResponse)[Symbol.asyncIterator]()
  const start = (await iterator.next()).value
  assert.equal(start.type, 'start')

  const busy = await post({ requestId: randomUUID(), conversationId: start.conversationId, message: '第二个' }, visitorA)
  assert.equal(busy.status, 409)
  assert.equal((await busy.json()).code, 'SITE_CHAT_BUSY')

  controller.abort()
  release()
  await iterator.return()
  const detail = await fetch(`${state.baseUrl}/api/site-chat/conversations/${start.conversationId}`, {
    headers: { 'X-Visitor-Id': visitorA },
  }).then(response => response.json())
  assert.equal(detail.turns.at(-1).status, 'canceled')
})

it('activeUntil已过期时恢复旧轮次并释放锁', async () => {
  const id = randomUUID()
  await seed({ id, active: true, activeUntil: new Date(Date.now() - 1000), turns: [
    { requestId: randomUUID(), content: '上次', answer: '部分', status: 'streaming', modelId: 'glm-4.7-flash', error: null, createdAt: new Date(), updatedAt: new Date() },
  ] })
  const response = await post({ requestId: randomUUID(), conversationId: id, message: '恢复' })
  assert.equal(response.status, 200)
  await collect(response)
  const detail = await fetch(`${state.baseUrl}/api/site-chat/conversations/${id}`, {
    headers: { 'X-Visitor-Id': visitorA },
  }).then(value => value.json())
  assert.equal(detail.turns[0].status, 'failed')
  assert.equal(detail.turns.at(-1).status, 'completed')
})

it('上游429保留用户消息并把轮次标为failed', async () => {
  const requestId = randomUUID()
  const result = await collect(await post({ requestId, message: 'http-429' }))
  assert.equal(result.at(-1).type, 'error')
  const conversations = await fetch(`${state.baseUrl}/api/site-chat/conversations`, {
    headers: { 'X-Visitor-Id': visitorA },
  }).then(response => response.json())
  const detail = await fetch(`${state.baseUrl}/api/site-chat/conversations/${conversations.conversations[0].id}`, {
    headers: { 'X-Visitor-Id': visitorA },
  }).then(response => response.json())
  assert.equal(detail.turns[0].content, 'http-429')
  assert.equal(detail.turns[0].status, 'failed')
  assert.match(detail.turns[0].error, /模型有点忙|暂时不可用/)
})

it('第21个会话返回明确409且不写数据', async () => {
  for (let index = 0; index < 20; index += 1) await seed({ title: `会话${index}` })
  const response = await post({ requestId: randomUUID(), message: '超出上限' })
  assert.equal(response.status, 409)
  assert.equal((await response.json()).code, 'SITE_CHAT_LIMIT_REACHED')
})

it('第101轮返回明确409', async () => {
  const id = randomUUID()
  await seed({ id, turns: Array.from({ length: 100 }, () => ({
    requestId: randomUUID(), content: '旧问题', answer: '旧回答', status: 'completed',
    modelId: 'glm-4.7-flash', error: null, createdAt: new Date(), updatedAt: new Date(),
  })) })
  const response = await post({ requestId: randomUUID(), conversationId: id, message: '第101轮' })
  assert.equal(response.status, 409)
  assert.equal((await response.json()).code, 'SITE_CHAT_LIMIT_REACHED')
})
```

`collect` 从 `./helpers/chat-fixture.mjs` 引入；测试中的 `seed` 复用 Task 1 的定义。

- [x] **Step 2: 运行测试，确认失败**

```bash
cd backend
npm run build
MONGODB_URI=mongodb://127.0.0.1:27019/nest_test_base node --test test/site-chat-history.e2e.test.mjs
```

Expected: FAIL，`requestId` 校验 400 或 `start` 事件缺失。

- [x] **Step 3: 扩展 DTO 与 repository 生命周期**

`public-chat.dto.ts` 增加 `@IsUUID('4') requestId!: string`、`@IsOptional() @IsUUID('4') conversationId?: string`；`history` 改为 `@IsOptional()` 保留兼容。`message` 仍为 1–500 码点。

Repository 新增方法（全部按 `id + visitorHash` 过滤，避免越权）：

```ts
async beginTurn(input: { visitorHash: string; conversationId?: string; requestId: string; content: string; modelId: string; lockMs: number }): Promise<{ conversationId: string; turnId: string; history: ModelMessage[]; answer?: string }>
async appendAnswer(visitorHash: string, conversationId: string, requestId: string, answer: string): Promise<void>
async finishTurn(visitorHash: string, conversationId: string, requestId: string, status: 'completed' | 'failed' | 'canceled', error?: string | null): Promise<void>
async release(visitorHash: string, conversationId: string): Promise<void>
```

`beginTurn` 的关键规则：
- 无 `conversationId`：先查该 visitor 会话数，`>=20` 抛 `ConflictException({ code: 'SITE_CHAT_LIMIT_REACHED' })`；创建文档，`title` 取首条消息前 24 个码点，`active=true`、`activeUntil=now+lockMs`、`expiresAt=now+30天`，写入用户轮次和 `streaming` 助手轮次。
- 有 `conversationId`：查找 `id + visitorHash`；不存在 404；若同 `requestId` 已完成返回 `{ answer }` 供重放；若同 `requestId` 仍在生成抛 409；若 `active && activeUntil > now` 抛 409 `SITE_CHAT_BUSY`；若 `active` 已过期，把上一轮 `streaming` 标 `failed` 并释放；再条件更新抢占锁。
- 每会话 `turns.length >= 100` 抛 `ConflictException({ code: 'SITE_CHAT_LIMIT_REACHED' })`。
- 历史只取最近 8 个已完成的 `turns`，映射为 `{ role:'user', content }` 与 `{ role:'assistant', content:answer }`，顺序保持。

`appendAnswer` 用 `$set` + `arrayFilters` 按 `requestId` 更新 `turns.$[turn].answer`、`updatedAt`、`expiresAt`；`finishTurn` 写状态与 `error`、`active:false`、`activeUntil:null`；`release` 只清锁。

- [x] **Step 4: 统一 SSE writer（`backend/src/site/chat/site-chat.sse.ts`）**

新建一个只负责写 HTTP 的 SSE writer，controller 不直接拼字符串：

```ts
export interface SseWriter {
  start(data: { conversationId: string; turnId: string; requestId: string }): Promise<void>
  delta(text: string): Promise<void>
  done(data: { conversationId: string; turnId: string }): Promise<void>
  error(data: { code: string; message: string; retryable?: boolean }): Promise<void>
  close(): void
}
export function createSseWriter(res: Response, options: {
  turnId: string; pingMs?: number; onClose?: () => void
}): SseWriter
```

- 先写 `200` 头和 `Content-Type/Cache-Control/Connection/X-Accel-Buffering`，再 `res.flushHeaders()`。
- 每个帧：`id: ${turnId}:${seq}`、`event: ${event}`、`data: ${JSON.stringify(payload)}`、空行；`seq` 从 1 递增。
- `lastWriteAt` 每次写事件更新；`setInterval` 每 `Math.min(5000, pingMs)` 检查一次，距上次写 ≥`pingMs` 才发 `event: ping`，`data: { type:'ping', ts }`；连续 delta 期间不发。
- `res.write()` 返回 `false` 时 `await once(res, 'drain')`；`res.writableEnded` 后不再写。
- `done`/`error` 写完调用 `res.end()` 并清定时器；`close()` 可被 controller 的 `finally` 调用。
- `pingMs` 来自 `SITE_CHAT_PING_MS`，默认 `30000`，允许范围 `1000–120000`；测试用 `50`，生产不得低于 `10000`。
- controller 的 `req.on('close')`/`res.on('close')` 统一 abort 并 `finishTurn('canceled')`，不能只依赖 `catch`。

补一个 e2e：`SITE_CHAT_PING_MS: 50`、上游用 `modelFixture` 的 `hang` 模式，读到 `start` 后等待 `event: ping`，断言 `data.type==='ping'` 且轮次仍是 `streaming`；随后 abort 并确认锁释放。

- [x] **Step 5: 改 service 与 controller 的 SSE 顺序**

`SiteChatService` 新增：

```ts
async begin(input: PublicChatDto, visitorId: string, ip: string): Promise<{
  conversationId: string; turnId: string; answer?: string;
  model: ModelSettings; history: ModelMessage[]; timeout: number; maxTokens: number;
}>
async *stream(begin: ..., signal: AbortSignal): AsyncGenerator<string>
```

`begin` 还要在通过 visitor 校验后调用 `limiter.consume(visitorHash)` 的独立桶，和现有 IP 桶同时生效，避免同一 IP 多 visitor 绕过；429 仍返回 `SITE_CHAT_RATE_LIMITED`。

Controller 在写 SSE 头前调用 `begin`；受理失败仍返回 JSON 错误。成功后按顺序写 `start`、`delta`、`done`。每个 delta 追加到 `answer`，每 500ms 调用一次 `appendAnswer`；正常结束 `finishTurn('completed')`，客户端 abort 或超时 `finishTurn('canceled')`，上游错误 `finishTurn('failed', message)`。`start` 必须在调用模型前写出，前端才能拿到新会话 ID。

- [x] **Step 6: 重跑并修正**

```bash
cd backend
npm run build
MONGODB_URI=mongodb://127.0.0.1:27019/nest_test_base node --test test/site-chat-history.e2e.test.mjs
```

Expected: PASS；并发测试中第二个请求在 `start` 前收到 409。

- [x] **Step 7: 提交**

```bash
git add backend/src/site backend/test/site-chat-history.e2e.test.mjs
git commit -m "feat: persist site chat turns with anonymous visitor history"
```

---

### Task 3: LangChain 模型工厂与 LangGraph 流式图

**Files:**
- Modify: `backend/package.json`
- Create: `backend/src/site/chat/agent/site-chat.models.ts`
- Create: `backend/src/site/chat/agent/site-chat.graph.ts`
- Create: `backend/src/site/chat/site-chat.prompt.ts`
- Modify: `backend/src/site/chat/site-chat.service.ts`
- Modify: `backend/src/site/site.module.ts`
- Test: `backend/test/site-chat-history.e2e.test.mjs`

**Interfaces:**
- Consumes: Task 2 的 repository、`SiteService.read()`、`ChatConfig.models()`、`ModelSettings`。
- Produces:
  - `createChatModel(settings: ModelSettings, maxTokens: number): BaseChatModel`
  - `SiteChatGraph.stream(input: { visitorHash: string; conversationId: string; requestId: string; model: ModelSettings; maxTokens: number; timeout: number }, signal: AbortSignal): AsyncGenerator<string>`
  - 图状态：`visitorHash`、`conversationId`、`requestId`、`messages`、`history`、`answer`、`modelId`、`error`。

- [x] **Step 1: 安装依赖**

```bash
cd backend
npm install @langchain/core@^1.5.1 @langchain/langgraph@^1.7.5 @langchain/deepseek@^1.1.26 @langchain/openai@^1.8.5
```

- [x] **Step 2: 写失败的模型/图测试**

在 `site-chat-history.e2e.test.mjs` 增加：

```js
it('DeepSeek模型走LangChain适配器并保留流式SSE', async () => {
  const deepseekUpstream = await modelFixture()
  const app = await startApp({ config: {
    DEEPSEEK_API_KEY: 'deepseek-fixture', DEEPSEEK_BASE_URL: deepseekUpstream.url,
    GLM_API_KEY: 'glm-fixture', GLM_BASE_URL: upstream.url, CHAT_MODELS_JSON: '',
  } })
  try {
    const response = await fetch(`${app.baseUrl}/api/site-chat/stream`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Visitor-Id': visitorA },
      body: JSON.stringify({ requestId: randomUUID(), message: '你好' }),
    })
    const events = await collect(response)
    assert.equal(events.filter(item => item.type === 'delta').map(item => item.text).join(''), '你好，世界')
    assert.equal(deepseekUpstream.calls.length, 1)
    assert.equal(deepseekUpstream.calls[0].body.model, 'deepseek-flash')
    assert.deepEqual(deepseekUpstream.calls[0].body.thinking, { type: 'disabled' })
    assert.equal(deepseekUpstream.calls[0].body.max_tokens, 700)
  } finally {
    await stopApp(app); await deepseekUpstream.close()
  }
})
```

- [x] **Step 3: 实现模型工厂**

```ts
import { ChatDeepSeek } from '@langchain/deepseek'
import { ChatOpenAI } from '@langchain/openai'
import type { BaseChatModel } from '@langchain/core/language_models/chat_models'
import type { ModelSettings } from '../../../chat/types/chat.type.js'

export function createChatModel(settings: ModelSettings, maxTokens: number): BaseChatModel {
  if (settings.id === 'deepseek-flash') {
    return new ChatDeepSeek({
      model: settings.model,
      apiKey: settings.apiKey,
      configuration: { baseURL: settings.baseUrl },
      maxTokens,
      streaming: true,
      modelKwargs: { thinking: { type: 'disabled' } },
    })
  }
  return new ChatOpenAI({
    model: settings.model,
    apiKey: settings.apiKey,
    configuration: { baseURL: settings.baseUrl },
    maxTokens,
    streaming: true,
  })
}
```

`site-chat.prompt.ts` 把现有 `buildMessages` 从 service 移出，改为：
`export function buildSiteChatMessages(content: SiteContent, history: ModelMessage[], message: string): ModelMessage[]`；`history` 不再读客户端字段。

- [x] **Step 4: 实现线性图**

用 `Annotation` + `StateGraph`：

```ts
const SiteChatState = Annotation.Root({
  visitorHash: Annotation<string>(),
  conversationId: Annotation<string>(),
  requestId: Annotation<string>(),
  history: Annotation<ModelMessage[]>({ reducer: (_, right) => right, default: () => [] }),
  messages: Annotation<ModelMessage[]>({ reducer: (_, right) => right, default: () => [] }),
  answer: Annotation<string>({ reducer: (_, right) => right, default: () => '' }),
})
```

节点顺序：

```text
START → loadConversation → buildContext → agent → persistTurn → END
```

- `loadConversation`：`repository.history(visitorHash, conversationId, 8)`。
- `buildContext`：`site.read()`，取完整 `chat.systemPrompt`，调用 `buildSiteChatMessages`。
- `agent`：`createChatModel(model, maxTokens)`，转成 `SystemMessage/HumanMessage/AIMessage`，`for await (const chunk of await model.stream(messages))` 累加 `answer`；每个 chunk 由外层 `streamEvents` 捕获。
- `persistTurn`：`repository.finishTurn(..., 'completed')`；失败时由 service 的 catch 写 `failed`。
- `stream()`：

```ts
for await (const event of graph.streamEvents(input, { version: 'v2', signal })) {
  if (event.event === 'on_chat_model_stream') {
    const text = textOf(event.data.chunk?.content)
    if (text) yield text
  }
}
```

`textOf` 处理 `string | MessageContent[]`，只拼 `type === 'text'`；不要输出 reasoning。`persistTurn` 需要答案，`agent` 返回值写入 state。

- [x] **Step 5: 替换 service 的 provider 流**

`SiteChatService` 删除 `ChatCompletionsProvider` 依赖，改为注入 `SiteChatGraph`；`stream()` 变成消费图并做 500ms 部分保存、终态与超时。保留 `availableModel()` 和限流逻辑；DeepSeek 优先不变。`SiteModule` 注册 `SiteChatGraph`。

- [x] **Step 6: 重跑全套后端测试**

```bash
cd backend
npm run build
MONGODB_URI=mongodb://127.0.0.1:27019/nest_test_base node --test test/site-chat.e2e.test.mjs test/site-chat-history.e2e.test.mjs
```

Expected: PASS；原有 `site-chat.e2e.test.mjs` 中的 `post()` 必须已补 `X-Visitor-Id` 与 `requestId`。

- [x] **Step 7: 提交**

```bash
git add backend/package.json backend/package-lock.json backend/src/site backend/test
git commit -m "feat: run public chat through LangChain and LangGraph"
```

---

### Task 4: 前端 visitor、API 与 MobX store

**Files:**
- Create: `frontend/src/utils/visitor.ts`
- Modify: `frontend/src/api/site-chat.ts`
- Create: `frontend/src/store/site-chat.ts`
- Modify: `frontend/src/pages/site/use-site-chat.ts`
- Test: `frontend` 的 `npm run check` + Chrome localStorage 检查

**Interfaces:**
- Consumes: Task 2/3 的 HTTP 合同。
- Produces:
  - `getVisitorId(): string`：`localStorage['nest.chat.visitor.v1']`；不可用时 `sessionStorage`；再不可用内存变量；值用 `crypto.randomUUID()`，不支持时 `crypto.getRandomValues` 生成 16 字节 hex。
  - `listSiteChatConversations(): Promise<SiteChatConversationSummary[]>`
  - `getSiteChatConversation(id: string): Promise<SiteChatConversationView>`
  - `deleteSiteChatConversation(id: string): Promise<void>`
  - `streamSiteChat(input: { message: string; conversationId?: string }, signal: AbortSignal, onDelta: (text: string) => void, onStart?: (ids: { conversationId: string; turnId: string }) => void): Promise<{ conversationId: string; turnId: string }>`
  - `siteChatStore`：`conversations`、`activeId`、`turns`、`loadingList`、`loadingConversation`、`sending`、`notice`；`loadList()`、`open(id)`、`send(message)`、`stop()`、`remove(id)`、`newChat()`。

- [x] **Step 1: 写 visitor 工具**

```ts
const KEY = 'nest.chat.visitor.v1'
let memory = ''
function create(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID()
  const bytes = new Uint8Array(16)
  crypto.getRandomValues(bytes)
  return Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('')
}
export function getVisitorId(): string { /* localStorage → sessionStorage → memory; try/catch */ }
```

- [x] **Step 2: 扩展 API**

所有请求加 `X-Visitor-Id`；`streamSiteChat` 解析 `start`/`delta`/`done`/`error`/`ping`，返回 `start` 的 ID；`history` 不再作为参数。错误用 `request` 的 `HttpError` 原样抛，429 文案由 server 提供。

同时扩展 `frontend/src/utils/sse.ts`：`SseEvent` 改为 `{ id?: string; event: string; data: string }`，解析 `id:`/`event:`，保留 CRLF、多行 data、注释和 256 KiB 上限；`streamSiteChat` 维护 `idle → connecting → open → streaming → closed/error` 状态，任何帧重置 45 秒 watchdog，超时 abort 并给可重试提示。

- [x] **Step 3: 新建 store**

用 `makeAutoObservable` 与 `runInAction`，所有异步动作用 `try/finally` 复位 loading；`send` 先乐观插入 user + assistant，收到 `start` 后设置 `activeId`，收到 delta 更新 assistant，失败保留 notice 并移除空 assistant；`remove` 成功从列表移除，若 `activeId===id` 调 `newChat()`。

- [x] **Step 4: 改首页 hook**

`useSiteChat` 增加内部 `conversationId` ref；`send` 调用新 API，不再从 messages 构造 history；收到 start 后保存 ID，后续消息传它；`reset` 清空 ID。首页不展示历史，但消息会落库。

- [x] **Step 5: 验证**

```bash
cd frontend
npm run check
npm run lint
```

Expected: 0 errors；Chrome 打开 `/chat` 后 `localStorage` 有 `nest.chat.visitor.v1`，刷新后值不变。

- [x] **Step 6: 提交**

```bash
git add frontend/src/utils/visitor.ts frontend/src/api/site-chat.ts frontend/src/store/site-chat.ts frontend/src/pages/site/use-site-chat.ts
git commit -m "feat: add anonymous chat visitor and history client"
```

---

### Task 5: `/chat/:conversationId` 历史 UI 与移动端

**Files:**
- Modify: `frontend/src/router/index.tsx`
- Modify: `frontend/src/pages/chat/index.tsx`
- Modify: `frontend/src/pages/chat/style.module.less`
- Modify: `frontend/src/pages/site/conversation.tsx`
- Test: Chrome 桌面/390 宽手动验收

**Interfaces:**
- Consumes: Task 4 的 `siteChatStore` 与 API。
- Produces:
  - 路由 `/chat`、`/chat/:conversationId`；`/conversation` 重定向 `/chat`。
  - 侧栏历史项：标题、最近更新、删除按钮，当前项 `aria-current="page"`。
  - 移动端侧栏抽屉：按钮切换，遮罩点击关闭，`Escape` 关闭。

- [x] **Step 1: 注册路由**

在 `router/index.tsx` 增加：

```tsx
{ path: '/chat/:conversationId', errorElement: <PageLoadError />, lazy: async () => ({ Component: (await import('../pages/chat')).ChatPage }) },
```

- [x] **Step 2: 接入 store**

`ChatPage` 用 `useParams`；无 id 时 `newChat()`，有 id 时 `open(id)`；`send` 成功后 `navigate(`/chat/${activeId}`, { replace: true })`；删除当前会话后 `navigate('/chat', { replace: true })`。

- [x] **Step 3: 侧栏历史**

把“本次对话”改成“历史对话”；列表来自 `siteChatStore.conversations`，每条显示标题、`updatedAt` 相对时间、删除按钮（`aria-label={`删除 ${title}`}`）；点击 `open`；当前项高亮；空列表显示“还没有对话”。移动端用 `aside` 抽屉，顶部“历史”按钮打开。

- [x] **Step 4: 首页对话卡**

`useSiteChat` 返回 `conversationId`；`Conversation` 的“打开完整对话”链接在有 ID 时指向 `/chat/${id}`，否则 `/chat`。不改变现有视觉。

- [x] **Step 5: 手动验收**

```bash
cd frontend
npm run check
npm run lint
npm run build
```

Chrome：首条消息后 URL 变为 `/chat/:id`；刷新恢复；新建第二条；侧栏两条按时间排序；删除当前回到 `/chat`；390 宽无横向溢出；`localStorage` 只有 visitor ID，没有消息数组。

- [x] **Step 6: 提交**

```bash
git add frontend/src/router frontend/src/pages/chat frontend/src/pages/site/conversation.tsx
git commit -m "feat: add chat history sidebar and conversation routes"
```

---

### Task 6: 全量回归、文档与边界收尾

**Files:**
- Modify: `frontend/src/pages/site/use-site-chat.ts`（若 Task 4 未完成首页 ID）
- Modify: `docs/specs/011-site-chat-history.md`
- Modify: `docs/specs/010-editorial-home.md`
- Modify: `docs/specs/000-current-system.md`
- Modify: `docs/ai/STATE.md`

- [x] **Step 1: 全量后端测试**

```bash
cd backend
MONGODB_URI=mongodb://127.0.0.1:27019/nest_test_base npm test
```

Expected: 全部通过，记录实际 `pass` 数量。

- [x] **Step 2: 前端三命令**

```bash
cd frontend
npm run check
npm run lint
npm run build
```

Expected: 0 warnings/0 errors，build 成功。

- [x] **Step 3: 浏览器验收**

Chrome 桌面 + 390 宽：发消息、刷新恢复、第二条历史、删除、`localStorage` 禁用（DevTools 阻止 storage）仍能对话；截图放入 `/tmp`，不入库。

- [x] **Step 4: 更新文档**

- `011`：状态改「实施中/已实现」，补验证记录与未决事项。
- `010`：把“不包含对话历史”改为“历史见 SPEC-011”。
- `000`：加入 SPEC-011 入口。
- `STATE`：记录新增依赖、集合、API、测试数与未提交状态。

- [x] **Step 5: 最终提交**

```bash
git diff --check
git add docs backend frontend
git commit -m "docs: record public chat history architecture and verification"
```

---

## Self-Review

- **Spec coverage:** AC-01/02 由 Task 2 + 5；AC-03 由 Task 1；AC-04 由 Task 2；AC-05/06 由 Task 2；AC-07 由 Task 1；AC-08 由 Task 4/5；AC-09 由 Task 2；AC-10 由 Task 1/2；AC-11 由 Task 3 + 6。
- **Step scan:** 每个实现步骤给出文件、签名、关键字段或测试断言；未写完整业务方法体。
- **Type consistency:** `requestId` 同时作为 `turnId`；`SiteChatRepository` 方法名在 Task 1/2/3 一致；`streamSiteChat` 的 `onStart` 在 Task 4 与 Task 2 的 `start` 事件一致。
- **Review Focus mapping:** 伪造 visitor → Task 1；崩溃锁 → Task 2；并发/幂等 → Task 2；上限/TTL → Task 1/2；旧 history/localStorage → Task 2/4/5。
- **Known deliberate gaps:** 会话重命名、导出、跨设备、审核、owner chat 迁移不在本次范围；`persistTurn` 节点与 service 的部分保存需要实现时避免重复写终态（`finishTurn` 幂等）。

## 执行记录（2026-11-24）

- Task 1–5 已实现并提交：`b7e2ec0`、`f98bd75`、`d54511a`/`d3f76be`、`ac41a38`、`69cd440`。
- 后端全量 177/177、13 套件；`site-chat-history` 13/13、`site-chat` 8/8；前端 check/lint/build 通过；Chrome 真实验收通过。
- Task 3 Step 2 未新增单独的模型/图单测；由现有 `site-chat.e2e.test.mjs` 的 DeepSeek 优先用例与真实请求回归覆盖，计划中的“失败测试先写”未照做。
- 30 秒 ping 已由 `site-chat-history.e2e.test.mjs` 的 `SITE_CHAT_PING_MS=50` 用例覆盖；45 秒前端 watchdog 由代码实现，Chrome 实测停止生成，未单独做 45 秒断线自动化。
