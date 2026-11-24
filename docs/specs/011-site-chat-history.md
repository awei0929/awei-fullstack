# SPEC-011：公开对话历史与 LangGraph Agent

- 编号：011
- 状态：已实现（本地验证通过，未部署）
- 更新日期：2026-11-24
- 关联任务 / 前置 SPEC / 替代关系：依赖 [SPEC-010](010-editorial-home.md)；替代其中“不包含对话历史持久化、多会话”的边界。
- 当前实现与需求差异：已按本 SPEC 实现；`/chat` 使用服务端会话与 `site_chat_conversations`，`POST /api/site-chat/stream` 先落用户轮次再流式回答，旧 `history` 字段仅保留兼容、不再参与上下文。

## 目标与范围

- 问题与用户目标：访客在 `/chat` 发消息后，后端保存会话与消息；刷新后仍能在侧栏看到多条历史，并能点回某条继续聊。
- 本次包含：
  - 匿名访客标识（浏览器 `localStorage`），按浏览器隔离历史。
  - 会话与轮次的 MongoDB 持久化、列表、详情、删除、TTL。
  - 公开对话改为“服务端读历史”，不再信任前端传来的 `history` 作为上下文。
  - 公开对话使用 LangChain + LangGraph 编排，模型仍由服务端 `ChatConfig` 决定。
  - `/chat` 新对话与 `/chat/:conversationId` 历史会话路由。
- 本次不包含：
  - 登录账号、跨设备同步、多人共享会话。
  - 多 Agent 协作、工具调用、RAG/向量检索、人工介入。
  - 会话重命名、导出、消息编辑或重新生成。
  - 后台查看访客对话、内容审核、敏感信息过滤。
  - 替换站主后台 `/admin` 的 owner chat 或迁移其历史。

## 用户行为

- 首次进入 `/chat`：显示空态与建议问题；侧栏“历史对话”为空。
- 第一次发送：前端生成 `requestId`，调用 `POST /api/site-chat/stream`；后端创建会话、保存用户消息，SSE `start` 返回 `conversationId`；前端把地址替换为 `/chat/:conversationId`。
- 回复中：逐段显示助手文本；停止按钮中断；断开后已收到内容保留，状态为中断。
- 回复完成：侧栏出现该会话，标题取首条用户消息前 24 个码点；列表按最近更新排序。
- 刷新 `/chat/:id`：从后端拉会话详情，恢复用户/助手消息；刷新 `/chat`：只显示空态和新对话，不自动打开最近会话。
- 点击历史：加载该会话，可继续发送；旧会话只带最近 8 轮完成轮次进入模型上下文。
- 删除：侧栏每条会话有删除入口，二次确认后直接删除文档；当前会话被删除则回到 `/chat` 空态。
- 切换浏览器 / 清除站点数据：历史不再可见；这是匿名 `localStorage` 方案的预期行为。
- `localStorage` 不可用：退回 `sessionStorage`；仍不可用则只在内存中保留当前页面标识，并提示“历史仅保留在当前页面”。

## 接口与数据契约

| 方法 / 路径 | 权限与输入 | 成功状态 / 响应 | 失败状态 / 数据影响 |
| --- | --- | --- | --- |
| `GET /api/site-chat/conversations` | 公开；`X-Visitor-Id` 必填 | `200 { conversations: [{ id, title, updatedAt, messageCount, preview }] }`，最多 20 条 | 缺失/非法 visitor：`200 { conversations: [] }`；数据库错误 `503` |
| `GET /api/site-chat/conversations/:id` | 公开；visitor 必须匹配 | `200 { conversation, turns }` | 不存在或不属于该 visitor：`404 SITE_CHAT_CONVERSATION_NOT_FOUND` |
| `POST /api/site-chat/stream` | 公开；`X-Visitor-Id`；body `{ requestId, conversationId?, message }` | `200 text/event-stream`：`start { conversationId, turnId, requestId }`、`delta { text }`、`done { conversationId, turnId }`、`error { code, message }`、空闲 `ping { ts }`；事件格式见下节 | `400` 参数错误；`404` 会话不存在；`409 SITE_CHAT_BUSY`；`429 SITE_CHAT_RATE_LIMITED`；`503 SITE_CHAT_DISABLED/UNAVAILABLE` |
| `DELETE /api/site-chat/conversations/:id` | 公开；visitor 必须匹配 | `204`，直接删除文档 | `404`；不删除其他 visitor 的数据 |

- `X-Visitor-Id`：客户端生成的 UUID v4，服务端校验格式后做 `sha256`，只保存 hash；缺失或非法时不创建数据。它不是认证，不能用于授权；不能读取其他 UUID 的会话。
- `requestId`：UUID v4；同一会话内幂等。相同 `requestId` 已完成时返回该轮 `done`；仍在生成时返回 `409 SITE_CHAT_BUSY`。
- `message`：trim 后 1–500 个 Unicode 码点；拒绝纯空白。
- `conversationId`：可选 UUID；不传则创建新会话，`start` 事件返回新 ID。
- 旧的 `history` 字段：为兼容已缓存的旧前端保留为可选字段，但**服务端忽略**；新前端不再发送。
- 公共响应不包含 `visitorHash`、系统提示词、模型 Key、上游地址或内部错误。

### SSE 协议与长连接

公开对话只有一条 SSE 路由：`POST /api/site-chat/stream`。历史列表、详情、删除都是普通 JSON，不需要第二套 SSE。后端用一个共享 writer，前端用一个共享 parser；两端不允许各自手写事件格式。

响应头：

```http
Content-Type: text/event-stream; charset=utf-8
Cache-Control: no-store, no-transform
Connection: keep-alive
X-Accel-Buffering: no
```

写出头后立即 `res.flushHeaders()`。每个事件：

```text
id: <turnId>:<seq>
event: start | delta | done | error | ping
data: <单行 JSON>

```

事件合同：

| 事件 | data | 说明 |
| --- | --- | --- |
| `start` | `{ type: 'start', conversationId, turnId, requestId }` | 受理成功、锁已拿到；必须在调用模型前写出 |
| `delta` | `{ type: 'delta', text }` | 增量正文；`text` 可空但通常非空 |
| `done` | `{ type: 'done', conversationId, turnId }` | 正常结束；写完立即关闭 |
| `error` | `{ type: 'error', code, message, retryable }` | 失败结束；写完立即关闭 |
| `ping` | `{ type: 'ping', ts }` | 仅空闲时发送，前端不展示 |

- **30 秒空闲 ping**：记录 `lastWriteAt`；定时器每 5 秒检查一次，若距上次写事件已 ≥30 秒，写一个 `ping` 并更新时间。连续 `delta` 期间不 ping。`ping` 不是业务消息，不计入轮次。
- **背压**：`res.write()` 返回 `false` 时等待 `drain`，不能无限堆积。
- **断开**：监听 `req.on('close')` 与 `res.on('close')`；关闭时 abort 上游，调用 `finishTurn('canceled')`，清定时器。
- **超时**：模型调用仍受 `SITE_CHAT_TIMEOUT_MS` 限制；ping 只保连接，不延长模型超时。
- **代理**：Nginx 必须 `proxy_buffering off`，`proxy_read_timeout` 大于 60 秒；30 秒 ping 用于穿过空闲超时。Vite dev proxy 不额外缓冲。
- **id / 重连**：`id` 为 `<turnId>:<seq>`，前端只在内存记录。第一版不做自动重连，因为 `POST` 流不是 `EventSource`；连接中断后重新拉取会话详情，已完成轮次直接显示，生成中的轮次由服务端在锁超时后标为 failed，用户手动重发。重复 `requestId` 由服务端幂等重放，避免重复调用模型。
- **前端读取**：`readSseEvents` 是唯一解析入口，需返回 `{ id?, event, data }`，处理 CRLF、多行 `data`、注释、空行分帧和 256 KiB 上限；不完整帧在流结束时丢弃。
- **连接状态**：前端维护 `idle → connecting → open → streaming → closed/error`；任何事件重置 45 秒 watchdog。超过 45 秒没有 `ping`/`delta` 视为断线，abort 并提示重试。

### 访客身份

- 前端 `frontend/src/utils/visitor.ts` 负责读取/创建 `localStorage['nest.chat.visitor.v1']`；值优先用 `crypto.randomUUID()`，不可用时用 `crypto.getRandomValues` 生成并设置 UUID v4 的 version/variant 位（服务端只接受 UUID v4）。
- 每次请求带 `X-Visitor-Id`；不写 Cookie。
- 安全边界：`localStorage` 可被同源脚本读取，因此 visitor ID 不是认证凭据，只用于“同一浏览器找回自己的历史”。不存任何密钥或个人资料；会话内容按匿名数据处理。
- 限流仍按 IP 的现有 `SiteChatLimiter`；新增按 `visitorHash` 的轻量桶，避免同一 IP 下多个 visitor 绕过。

### MongoDB 文档

新集合 `site_chat_conversations`，单文档内嵌轮次：

```ts
type SiteChatTurnStatus = 'streaming' | 'completed' | 'failed' | 'canceled';

interface SiteChatTurnRecord {
  requestId: string;        // UUID，会话内唯一
  content: string;          // 用户消息，1–500
  answer: string;           // 助手回复，最多 16000
  status: SiteChatTurnStatus;
  modelId: string;          // deepseek-flash / glm-...
  error: string | null;
  createdAt: Date;
  updatedAt: Date;
}

interface SiteChatConversationRecord {
  id: string;               // UUID，全局唯一
  visitorHash: string;      // sha256(visitorId)
  title: string;            // 首条用户消息前 24 个码点；空会话不落库
  turns: SiteChatTurnRecord[];
  active: boolean;          // 同一会话只允许一个流
  activeUntil: Date | null; // 流超时/崩溃恢复
  expiresAt: Date;          // 最近活动 + 30 天，TTL 索引
  createdAt: Date;
  updatedAt: Date;
}
```

- 索引：`{ visitorHash: 1, updatedAt: -1 }`；`{ id: 1 }` 唯一；`{ expiresAt: 1 }` TTL `expireAfterSeconds: 0`。
- 上限：每个 visitor 20 个会话；每个会话 100 轮；用户消息 500 码点；助手回复 16000 字符。
- 标题不调用额外模型，避免多一次费用与延迟。
- 用户消息在调用模型前写入；助手先写空 `streaming`，每 500ms 合并保存一次部分正文；`done`/断开/超时写终态。
- 同一会话 `active` 用条件更新抢占；超过 `activeUntil` 的旧流在读取时标记 `failed` 并释放锁，避免服务重启留下永久锁。
- 删除为直接移除文档；侧栏立即消失，不做回收站；TTL 仍作为兜底清理。

## 实现影响与决策

### 后端

- 新增 `backend/src/site/chat/schemas/site-chat-conversation.schema.ts`。
- 新增 `backend/src/site/chat/site-chat.repository.ts`：列表、详情、创建、抢占、追加、终态、删除。
- 改造 `backend/src/site/chat/site-chat.service.ts`：不再拼 `input.history`；从 repository 读最近 8 轮，拼站点公开资料，调用 agent。
- 改造 `backend/src/site/dto/public-chat.dto.ts`：`requestId`、`conversationId?`、`message`；保留可选 `history` 以兼容旧前端但忽略。
- 改造 `backend/src/site/site-chat.controller.ts`：读取 `X-Visitor-Id`，校验/哈希；SSE `start` 事件带 `conversationId/turnId`。
- 新增 `backend/src/site/chat/agent/site-chat.graph.ts`：LangGraph 线性图。
- 新增 `backend/src/site/chat/agent/site-chat.models.ts`：LangChain `ChatDeepSeek` / `ChatOpenAI` 工厂。
- `backend/package.json` 增加：`@langchain/core`、`@langchain/langgraph`、`@langchain/deepseek`、`@langchain/openai`。当前参考版本：`@langchain/core@1.5.1`、`@langchain/langgraph@1.7.5`、`@langchain/deepseek@1.1.26`、`@langchain/openai@1.8.5`。
- 站主后台 `backend/src/chat` 的 owner chat 暂不迁移，继续用现有自定义 provider；公开对话先走 LangChain，降低回归面。

### LangGraph 图

```text
START
  → loadConversation   // 读 visitor 对应会话与最近 8 个完成轮次
  → buildContext       // 站主公开资料 + system prompt + 历史
  → agent              // ChatDeepSeek / GLM 流式
  → END

轮次持久化不在图内：controller 负责 500ms 增量保存、断连/失败终态。
```

- 状态：`message`、`visitorHash`、`conversationId`、`history`、`messages`、`model`、`maxTokens`、`answer`。
- 第一版不使用 checkpointer：Mongo 的 `turns` 是唯一事实来源，避免 LangGraph checkpoint 与业务数据双写。以后需要断点续跑时再加 `@langchain/langgraph-checkpoint-mongodb`，`thread_id = conversationId`。
- 第一版不加工具节点。站点内容较小，直接放进 system prompt；想法/作品多到装不下时再加 `retrieve` 节点和工具。
- 流式：用 `graph.streamEvents(..., { version: 'v2', signal })` 取 `on_chat_model_stream`，映射为现有 SSE `delta`；图不直接写 HTTP。
- 超时与中止：沿用 `SITE_CHAT_TIMEOUT_MS`（默认 45 秒）；客户端断开时 abort，图终止并保存已收到正文。

### LangChain 模型

- DeepSeek：`new ChatDeepSeek({ model: 'deepseek-flash', apiKey, maxTokens: 700, streaming: true, modelKwargs: { thinking: { type: 'disabled' } } })`。
- GLM 回退：`new ChatOpenAI({ model: 'glm-4.7-flash', apiKey, configuration: { baseURL }, maxTokens: 700, streaming: true })`。
- 选择逻辑仍由 `ChatConfig` 与 `SiteChatService.availableModel()` 决定；客户端不能传模型 ID。
- 保留现有 `ChatCompletionsProvider` 供 owner chat 使用；公开对话走 LangChain 后，SSE 合同不变。

### 前端

- 新增 `frontend/src/utils/visitor.ts`。
- `frontend/src/api/site-chat.ts`：请求统一带 `X-Visitor-Id`；新增 `listConversations`、`getConversation`、`deleteConversation`；`streamSiteChat` 支持 `conversationId`，解析 `start`。
- 新增 `frontend/src/store/site-chat.ts`（MobX）：`conversations`、`activeId`、`turns`、`loadingList`、`sending`、`notice`；动作 `loadList`、`open`、`send`、`stop`、`remove`、`newChat`。
- `frontend/src/pages/chat/index.tsx`：改用 store；`/chat` 空态、`/chat/:conversationId` 历史；侧栏列表、当前项高亮、删除；移动端抽屉。
- 路由 `frontend/src/router/index.tsx` 增加 `/chat/:conversationId`。
- 页面刷新时通过 URL 恢复会话；刷新 `/chat` 不自动打开最近会话。
- 不再把全量消息写 `localStorage`；`localStorage` 只存 visitor ID。

## 验收条件

| 编号 | 前置条件 / 操作 | 预期结果 | 验证方式 |
| --- | --- | --- | --- |
| AC-01 | 新浏览器打开 `/chat`，发送第一条消息 | SSE `start` 返回会话 ID；刷新 `/chat/:id` 后用户消息与助手回复仍在 | e2e + Chrome |
| AC-02 | 同一 visitor 创建第二个会话 | 侧栏出现两条历史，按最近更新排序；点击可切换 | e2e + Chrome |
| AC-03 | 两个不同 `X-Visitor-Id` | 互相看不到对方会话；直接访问对方 ID 返回 404 | e2e |
| AC-04 | 回复中断开 / 超时 / 上游失败 | 用户消息保留；助手部分正文或失败状态落库；锁释放 | e2e |
| AC-05 | 同会话并发发送 | 第二个请求 409；不产生并行上游调用 | e2e |
| AC-06 | 重复 `requestId` | 已完成时返回原轮次；生成中返回 409 | e2e |
| AC-07 | 删除会话 | 侧栏消失；详情 404；其他 visitor 不受影响 | e2e |
| AC-08 | `localStorage` 被禁用 | 退回 sessionStorage 或内存，页面仍可对话；有提示 | Chrome |
| AC-09 | 旧前端仍发送 `history` | 请求不 400；后端忽略该字段 | e2e |
| AC-10 | 30 天 TTL / 20 会话 / 100 轮上限 | 超限返回明确错误；TTL 索引存在 | 单元/索引检查 |
| AC-11 | LangGraph + DeepSeek 真实请求 | `/chat` 与首页对话卡都能流式返回并落库 | 人工 + e2e fixture |
| AC-12 | 上游 30 秒无输出 | 客户端收到 `event: ping`；连接不断；`ping` 不写入轮次 | e2e（缩短 ping 间隔） |
| AC-13 | 客户端 45 秒无任何 SSE 帧 | 前端 abort、显示断线提示；重新打开会话可读到已落库的部分/失败轮次 | Chrome |

## 实施清单

- [x] 设计确认（匿名 localStorage + 单文档 + 线性 LangGraph）
- [x] 后端 schema/repository/DTO/controller 改造
- [x] 统一 SSE writer：`start/delta/done/error/ping`、30 秒空闲 ping、背压与断开清理
- [x] 前端 `readSseEvents` 扩展 `id/event/data` 与 45 秒 watchdog（连接状态机简化为请求内 watchdog）
- [x] LangChain 模型工厂 + LangGraph 线性图
- [x] 前端 visitor、API、store、`/chat/:id`、侧栏历史
- [x] 后端 e2e：持久化、隔离、并发、幂等、失败、删除
- [x] 前端 check/lint/build 与桌面/移动截图
- [x] 更新 SPEC-010 的“不包含”边界、`docs/specs/000-current-system.md`、`docs/ai/STATE.md`

## 验证记录

代码基准：分支 `feat/site-chat-history-agent`；Task 1 `b7e2ec0`、Task 2 `f98bd75`、Task 3 `d54511a`/`d3f76be`、Task 4 `ac41a38`、Task 5 `69cd440`。

| 日期 | 验收编号 | 命令 / 人工操作 | 实际结果与证据 |
| --- | --- | --- | --- |
| 2026-11-24 | AC-01/02/07/11 | backend 全量 `MONGODB_URI=mongodb://127.0.0.1:27019/nest_test_base npm test` | 177/177、13 套件通过；Chrome 真实 DeepSeek 发送、刷新恢复、侧栏历史、删除当前回到 `/chat` |
| 2026-11-24 | AC-03/05/06/09/10 | `site-chat-history.e2e.test.mjs` | 13/13：visitor 隔离、并发 409、幂等、旧 history 忽略、20/100 上限、TTL 索引 |
| 2026-11-24 | AC-04 | `site-chat.e2e.test.mjs` + Chrome | 8/8；上游 429/中止/失败保留轮次；Chrome 实测停止生成 |
| 2026-11-24 | AC-12 | `site-chat-history.e2e.test.mjs` | 13/13；空闲超过 `SITE_CHAT_PING_MS=50` 时收到 `event: ping`，轮次仍为 `streaming`，中止后转 `canceled` |
| 2026-11-24 | AC-13 | 前端实现 + Chrome | `WATCHDOG_MS=45_000`，任何帧重置；Chrome 实测停止生成；45 秒断线未单独做自动化测试 |
| 2026-11-24 | AC-08 | 代码检查 | `getVisitorId` 按 localStorage → sessionStorage → 内存回退；未做浏览器禁用实测 |
| 2026-11-24 | 前端 | `npm run check`、`npm run lint`、`npm run build` | 通过；84 files、0 warnings/0 errors |

## 未决事项与交接

- 当前已完成：匿名 visitor、Mongo 单文档会话、历史 REST、SSE 持久化、30s ping、LangGraph + LangChain、`/chat/:id` 与侧栏历史、移动端抽屉、全量回归与文档。
- 当前阻塞 / 未验证：真实 DeepSeek Key 已在对话中暴露，建议轮换；`/chat` 的 45 秒断线恢复只做提示与详情重拉，不做自动重连；多实例限流/Safari/Firefox/真机软键盘未覆盖。
- 下一步：按 Task 6 收尾文档与最终截图；提交后如部署，需核对 Nginx `proxy_buffering off` 与 `proxy_read_timeout`。
- 最近需求或决策变化及原因：最初考虑 httpOnly Cookie；用户明确希望用 `localStorage`，且接受“换浏览器不同步”，因此改为客户端 UUID + `X-Visitor-Id`，换取实现简单和无需 Cookie 同意提示。
