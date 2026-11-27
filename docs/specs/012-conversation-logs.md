# SPEC-012：对话日志与后台查看

- 编号：012
- 状态：已验证（本地；未部署）
- 更新日期：2026-11-27
- 关联任务 / 前置 SPEC / 替代关系：依赖 [SPEC-006](006-owner-sse-chat.md) 的站主对话与 [SPEC-011](011-site-chat-history.md) 的公开对话；替代 SPEC-011“本次不包含后台查看访客对话”的边界，但不改变访客侧历史与权限。
- 当前实现与需求差异：已按本 SPEC 实现；公开与站主对话均记录日志，admin 新增“对话日志”分区。

## 目标与范围

- 问题与用户目标：公开对话和站主对话都会产生一轮问答，但此前没有独立、可检索的记录。站主需要一个入口，能看到每轮用户问了什么、答了什么、耗时多久、是否出错。
- 本次包含：
  - 公开对话（`/chat`，匿名访客）每一轮生成一条日志。
  - 站主对话（`/admin` 的 AI 对话）每一轮生成一条日志。
  - 记录用户提问、最终回答、状态、耗时、错误信息、入口、会话/轮次标识。
  - 在站主后台新增“对话日志”分区，支持按入口、状态筛选和分页查看。
- 本次不包含：
  - 在日志中保存访客 UUID、哈希、IP、请求头或模型密钥；这些信息不进入日志。
  - 日志编辑、删除、导出、全文搜索、实时推送和自动清理/TTL。
  - 改变公开对话或站主对话的上下文、模型、限流和会话历史行为。
  - 公开访客查看日志；日志接口只对站主开放。

## 用户行为

- 站主进入 `/admin`，侧栏出现“对话日志”；点击后进入独立的纸白阅读布局，侧栏保留“AI 对话”和“对话日志”两个独立入口。
- 页面顶部显示“全部入口”“全部状态”两个筛选和刷新按钮，右侧显示“共 N 条”；下方按开始时间倒序显示卡片，每页 20 条。
- 每张卡片展示：
  - 开始时间（本地时间，`MM/DD HH:mm:ss`）、入口（公开对话/站主对话）、状态（生成中/已完成/失败/已取消/已中断）、耗时（`N ms` 或 `N.N s`）。
  - “用户提问”原文。
  - “回答”原文；未生成回答时显示“未生成回答”；超过 360 个字符时截断并可“展开全文”。
  - “错误：无错误”或具体错误文案；失败时错误文案显示为红色。
- 切换筛选后从第 1 页重新查询；上一页/下一页在边界禁用；刷新保持当前筛选。
- 加载时保留已有列表；查询失败显示错误 Alert 和“重试”，不把旧数据清空，也不把失败伪装成空列表。
- 空数据时显示“还没有对话日志 / 完成一轮公开或站主对话后，这里会出现记录。”
- 未登录访问日志接口返回 401；已登录但不是站主返回 403。页面只站长可见。
- 对话进行中日志状态为“生成中”，此时耗时为“进行中”；该轮结束后由同一条日志更新为终态，不会新增重复记录。

## 接口与数据契约

| 方法 / 路径 | 权限与输入 | 成功状态 / 响应 | 失败状态 / 数据影响 |
| --- | --- | --- | --- |
| `GET /api/chat-logs` | Session + SiteOwner；query：`channel?=site\|owner`、`status?=streaming\|completed\|failed\|canceled\|interrupted`、`limit?=1..100`（默认 20）、`offset?=0..100000`（默认 0） | `200 { logs, total, limit, offset }`；`logs` 按 `startedAt` 倒序 | 未登录 `401`；非站主 `403`；非法枚举/越界/非数字 `400`；数据库异常 `500`，不返回部分伪造数据 |

单条日志响应结构：

```ts
type ChatLog = {
  id: string;                 // 日志 UUID
  channel: 'site' | 'owner';  // 公开对话 / 站主对话
  conversationId: string | null;
  turnId: string | null;
  question: string;           // 用户提问，最多 4000 码点
  answer: string;             // 最终回答，最多 20000 码点
  status: 'streaming' | 'completed' | 'failed' | 'canceled' | 'interrupted';
  error: string | null;       // 无错误为 null；最多 1000 码点
  durationMs: number | null;  // 开始到终态；生成中为 null
  startedAt: string;          // ISO 时间
  finishedAt: string | null;  // 终态时间
};
```

- `requestId` 不作为响应字段暴露；它只用于写入幂等。唯一索引为 `{ channel, requestKey }`，同一入口同一 `requestId` 的重试复用同一条日志。
- 查询不返回 `requestKey`、访客哈希、IP、模型 Key、系统提示词或上游地址。
- 写入字段：`id`、`channel`、`requestKey`、`conversationId`、`turnId`、`question`、`answer`、`status`、`error`、`durationMs`、`startedAt`、`finishedAt`；MongoDB 集合为 `chat_logs`。
- 索引：唯一 `{ channel: 1, requestKey: 1 }`；普通 `{ startedAt: -1 }`、`{ channel: 1, startedAt: -1 }`、`{ status: 1, startedAt: -1 }`。
- 状态只允许 `streaming → completed|failed|canceled|interrupted`；终态写入是条件更新，重复写不会覆盖已有终态。
- 数据迁移：不涉及。旧对话不会补写日志；上线后新产生的轮次开始记录。日志当前不设 TTL，删除与保留策略留待后续需求。

## 实现影响与决策

- 后端模块 / 文件：
  - 新增 `backend/src/chat-logs/`：`chat-logs.module.ts`、`chat-logs.controller.ts`、`chat-logs.service.ts`、`schemas/chat-log.schema.ts`、`dto/list-chat-logs.dto.ts`、`types/chat-log.type.ts`、`error-message.ts`。
  - `backend/src/site/site-chat.controller.ts`：访客校验后开始记录；`begin` 失败写失败日志；成功 attach 会话/轮次；正常、取消、异常、幂等重放都在 finally 收口。
  - `backend/src/chat/chat.controller.ts`：`prepare` 前开始记录；失败写失败日志；SSE 结束后按最后一轮状态写终态、回答、错误和耗时；无终态兜底为 failed。
  - `backend/src/app.module.ts`、`backend/src/site/site.module.ts`、`backend/src/chat/chat.module.ts`：接入 `ChatLogsModule`；`app.setup.ts` 的 no-store 路径加入 `chat-logs`。
- 前端 API / Store / 页面：
  - `frontend/src/types/chat-log.ts`、`frontend/src/api/chat-logs.ts`：请求与运行时响应校验，非法响应统一报“对话日志格式无效，请稍后重试”。
  - `frontend/src/store/chat-logs.ts`：筛选、分页、加载版本、身份版本、401 过期会话、失败保留旧列表。
  - `frontend/src/pages/admin/logs-panel.tsx`、`logs-panel.module.less`：日志卡片、筛选、分页、错误重试与空态。
  - `frontend/src/pages/admin/sections.ts`、`fields.tsx`、`index.tsx`：新增“对话日志”分区、图标与独立布局；`standalone` 统一控制窄侧栏、移动端控件和隐藏保存按钮。
- 配置、依赖与其他影响：不新增环境变量或依赖；沿用 MongoDB、NestJS、React/MobX/Ant Design。
- 决策：
  - 日志独立集合而非内嵌会话：访客删除会话或 30 天 TTL 清理后，站主仍能追溯；也避免把后台字段带进公开响应。
  - 旁路写入：`ChatLogsService` 内部捕获写入/查询异常并只记后端 warn，日志失败不阻断对话；启动时索引失败也不阻断应用。
  - 以 `requestId` 幂等：SSE 重试、刷新重放不会产生重复日志；同一条日志从 streaming 更新到终态。
  - 公开与站主共表：用 `channel` 区分，后台可筛选；两者字段一致，避免两套页面和接口。
  - 不记录访客身份：日志只需回答“问了什么、答了什么、多久、是否失败”，不扩大匿名数据的留存面。

## 验收条件

| 编号 | 前置条件 / 操作 | 预期结果 | 验证方式 |
| --- | --- | --- | --- |
| AC-01 | 公开对话成功完成一轮 | `chat_logs` 新增一条 `channel=site`、`status=completed`，question/answer 与页面一致，`durationMs >= 0`，`error=null` | `chat-logs.e2e.test.mjs`；本地浏览器样例 |
| AC-02 | 站主对话成功完成一轮 | 新增一条 `channel=owner`、`status=completed`，question/answer 一致，耗时与错误字段可读 | 同上 |
| AC-03 | 模型返回 HTTP 500，公开对话失败 | 仍产生一条日志；`status=failed`、answer 为空、error 非空且不泄露上游诊断；访客仍只看到安全文案 | `chat-logs.e2e.test.mjs` |
| AC-04 | 公开对话在生成中断开 | 日志收口为 `canceled`，保留已生成回答，耗时非空 | 定向测试/代码路径核对（本轮未单独构造断连） |
| AC-05 | 站主对话 `prepare` 失败（如非法模型） | 仍产生 failed 日志并写错误；接口仍返回原 4xx | 代码路径核对（本轮未单独构造） |
| AC-06 | 站主打开 `/admin` 的“对话日志” | 显示筛选、总数、卡片；每张卡片含时间、入口、状态、耗时、提问、回答、错误；“无错误”明确显示 | 本地 headless Chrome 1440×900 |
| AC-07 | 按入口 `site`、按状态 `failed`、`limit=1&offset=1` 查询 | 过滤与分页结果正确，`total` 为过滤后的总数 | `chat-logs.e2e.test.mjs` |
| AC-08 | 匿名、普通用户、非法参数访问日志接口 | 分别 401、403、400；不返回日志数据 | `chat-logs.e2e.test.mjs` |
| AC-09 | 日志写入/索引失败 | 对话主流程不被阻断；只记录后端告警 | 代码路径核对；启动索引失败已改为 warn |

## 实施清单

- [x] 范围与契约明确，重要未决问题已处理
- [x] 完成后端日志模块与两条对话链路接入
- [x] 完成 admin 日志分区、筛选、分页与错误/空态
- [x] 完成构建、lint、e2e 与本地浏览器验证
- [ ] 全量后端测试稳定通过
- [x] 同步 SPEC-011 边界、SPEC 索引、系统基线与 STATE

## 验证记录

代码基准：`f54f0e3` + 未提交改动（`backend/src/chat-logs/*`、`backend/src/site/site-chat.controller.ts`、`backend/src/chat/chat.controller.ts`、`frontend/src/{types,api,store}/chat-log*`、`frontend/src/pages/admin/{logs-panel*,sections,fields,index}.tsx`、`backend/test/chat-logs.e2e.test.mjs` 及文档）。工作目录：项目根目录。

前置条件：隔离 MongoDB `mongodb://127.0.0.1:27018/<临时库>`；e2e 使用随机 `awei_e2e_<uuid>` 库并清理；本地浏览器环境使用独立库与临时 owner，不记录凭据。

| 日期 | 验收编号 | 命令 / 人工操作 | 实际结果与证据 |
| --- | --- | --- | --- |
| 2026-11-27 | AC-01/02/03/07/08 | `cd backend && npm run build && MONGODB_URI=mongodb://127.0.0.1:27018/nest_test_base node --test test/chat-logs.e2e.test.mjs` | 通过：1/1，483ms；覆盖公开成功、站主成功、公开 500 失败、筛选分页、401/403/400 |
| 2026-11-27 | 构建 | `cd backend && npm run build` | 通过（nest build 无报错） |
| 2026-11-27 | 前端静态检查 | `cd frontend && npm run check`；`npm run lint` | 通过：tsc 无输出；lint 0 warnings / 0 errors，91 files |
| 2026-11-27 | 前端构建 | `cd frontend && npm run build` | 通过：1840 modules；admin JS 257.07 kB（gzip 78.63 kB），CSS 49.68 kB |
| 2026-11-27 | AC-06 | 本地后端 3000 + Vite 5173；headless Chrome 登录 owner，打开 `/admin` 并点击“对话日志”；1440×900 | 通过：标题“对话日志”、共 3 条、3 张卡片、两个筛选、3 种耗时展示、“无错误”与失败错误均正确；`scrollWidth=innerWidth=1440`，无横向溢出；无错误 Alert |
| 2026-11-27 | 全量回归（修复前） | `MONGODB_URI=mongodb://127.0.0.1:27018/nest_test_base npm test` | 失败：181 tests / 14 suites，180 pass，1 fail。`test/owner-init.e2e.test.mjs:41` 的 `created.code` 期望 0、实际 1；其余套件全通过。原因为日志模块启动建索引与初始化脚本并发，`records.init()` 抛错阻断脚本 |
| 2026-11-27 | 全量回归（修复后） | `cd backend && MONGODB_URI=mongodb://127.0.0.1:27018/nest_test_base npm test` | 通过：181 tests / 14 suites，181 pass，0 fail，23.87s；owner-init 并发建索引场景恢复正常 |
| 2026-11-27 | AC-04/05/09 | 静态核对对应控制器/service 分支 | 静态通过；未构造真实断连与 prepare 失败请求 |

## 未决事项与交接

- 当前已完成：日志采集、存储、受保护查询接口、admin 展示、公开/站主两条链路接入、定向 e2e、全量回归与浏览器验收。
- 当前阻塞 / 未验证：AC-04/AC-05 尚未用真实请求覆盖；生产 MongoDB 索引与真实模型链路未验证。
- 下一步：
  1. 视需要为公开断连、站主非法模型 prepare 失败补定向 e2e，覆盖 AC-04/AC-05。
  2. 部署前确认生产 MongoDB 允许创建 `chat_logs` 索引；日志不设 TTL，后续按数据量决定保留策略。
- 最近需求或决策变化及原因：用户要求“admin 查看日志”，因此 SPEC-011 原先排除后台查看访客对话的边界由本规格替代；日志仍不暴露访客身份，只展示问答与运行结果。
