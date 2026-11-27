# SPEC-000：当前任务管理系统基线

- 类型：存量功能基线，记录当前实现；详细新增需求与认证合同以 [SPEC-001](001-session-auth.md) 为准。
- 状态：已验证（2026-11-06；模块整理见SPEC-002；3–5位账号规则与最终42项HTTP回归见SPEC-001；认证实现时的前端工程与浏览器证据见SPEC-001，历史记录保留原状态）。
- 更新日期：2026-11-27（同步 SPEC-012 对话日志并完成线上部署；此前已同步 SPEC-010 编辑式首页、SPEC-011 对话历史与 LangGraph；原基线历史验证不改写）。
- 前端信息精简与交互打磨见 [SPEC-007](007-ui-clarity.md)：公开详情/登录、官网编辑与预览、聊天/记忆及任务页减少重复辅助文字，以分组和状态表达操作；接口、持久化及权限合同不变。验证与上线边界以该规格为准。
- 首页简历入口、公开 `/resume` 和后台简历编辑见 [SPEC-008](008-public-resume.md)。2026-11-24 起简历支持可选结构化技能/工作/项目/教育分区，旧四字段合同兼容；公开页采用文档式排版，并与首页共用黑白主题、导航与字体尺度；支持 A4 打印导出 PDF。旧能力场景仅在站主预览展示。
- 编辑式首页、想法/作品内容分区与匿名公开 AI 对话见 [SPEC-010](010-editorial-home.md)：首页改为黑白编辑排版并支持白天/黑夜切换，新增 `thoughts/works/chat`；公开对话不挂 Session/Owner/CSRF，按 IP 内存限流，只使用公开资料；优先 GLM，配置 `DEEPSEEK_API_KEY` 时仅作为首个 token 前失败/空输出的备用，未配置时 GLM 自带 4-Flash 备用。
- 公开对话历史与 LangGraph Agent 见 [SPEC-011](011-site-chat-history.md)：匿名 `localStorage` visitor、`site_chat_conversations` 单文档会话、20 会话/100 轮与 30 天 TTL、SSE `start/delta/done/error/ping`、LangChain `ChatDeepSeek` + LangGraph 线性图；前端 `/chat` 与 `/chat/:conversationId` 共享历史侧栏。
- 对话日志见 [SPEC-012](012-conversation-logs.md)：公开与站主每轮问答写入独立 `chat_logs`，记录提问、回答、状态、耗时、错误、实际/请求模型、备用切换、首 token、token 用量与最多 50 条执行轨迹；`GET /api/chat-logs` 返回轻量列表，`GET /api/chat-logs/:id` 返回含轨迹的详情，仅 Session + SiteOwner 可读；后台 `/admin` 的“对话日志”分区可筛选、分页并打开详情抽屉。日志不保存访客身份、IP、提示词或推理正文。基础版随 `52f8012` 上线，详情版待部署，验证边界见该规格。
- 前端路径：`/`、`/thoughts`、`/works` 为站点内容入口（后两者复用同一份内容并滚动到对应分区），`/resume` 为独立简历页，`/about` 已移除并回退首页，`/chat` 为独立对话页，`/chat/:conversationId` 恢复历史会话，`/conversation` 重定向 `/chat`；不再用 `#hash` 作为页面导航。
- 官网增量合同以[SPEC-003](003-personal-site.md)为准；P24整体移除作品档案、项目详情与站主项目配置，不影响本基线的独立`/tasks`、认证和任务数据隔离。
- 图片、PDF与附件上传增量见[SPEC-004](004-disk-file-uploads.md)，沿用站主/Session/CSRF和独立磁盘媒体；不改变本基线任务与认证合同。
- 站主后台SSE聊天增量见[SPEC-006](006-owner-sse-chat.md)：独立ChatModule/Mongo历史，默认GLM-4.7-Flash，未输出时遇429仅尝试一次免费GLM-4-Flash-250414，保存原选/实际模型；按后端白名单扩展其他兼容模型，复用Session/Owner/CSRF；不进入公开官网配置或个人任务集合。工作区支持历史标题搜索、上翻暂停跟随/返回最新、安全Markdown及回复/代码复制，窄屏历史抽屉与底部输入区独立于官网编辑布局。
- SPEC-006手动长期记忆另存Mongo，最多20条、每条trim后1–500个Unicode码点；可管理或从回复“记住”，支持编辑、启停、确认删除，超限内容由用户摘录。每次生成将启用项作为背景发送给当轮使用的模型（含自动备用），跨会话可用，修改只影响后续请求；不自动提取或摘要。上述聊天增量的实际验收、真实模型与线上部署边界按SPEC-006记录，不沿用本基线历史验证结论。
- 代码基准：bd2b983 加当前 SPEC-001 / SPEC-002 未提交改动；原 d688983 基线验证保留在历史记录中。
- 依据：[任务 Controller](../../backend/src/tasks/tasks.controller.ts)、[Service](../../backend/src/tasks/tasks.service.ts)、[认证 Controller](../../backend/src/auth/auth.controller.ts)、[公共 Controller](../../backend/src/public/public.controller.ts)、[任务 HTTP 测试](../../backend/test/tasks.e2e.test.mjs)、[认证 HTTP 测试](../../backend/test/auth.e2e.test.mjs)。
- 结构：用户模型与服务属于 UsersModule；AuthModule 导入它，负责认证入口、会话与独立 Guard。目录整理及其验证见 [SPEC-002](002-auth-module-organization.md)，HTTP 与数据合同不变。
- 范围：任务 CRUD、统计、数字账号注册登录、MongoDB Session、用户隔离、游客示例、输入边界、CSRF、错误格式及前端交互。
- 不包含：管理员、分享、验证码、密码找回、任务完成状态切换、分页、搜索及生产部署。

## 公开数据与持久化

Task 响应字段保持不变：

| 字段 | 约定 |
| --- | --- |
| id | 服务端生成的 UUID v4，编辑时保持不变 |
| title | 字符串，输入 trim 后长度 1–120 |
| completed | 布尔值，创建默认为 false；当前无修改入口 |
| createdAt | 创建时间的 ISO 字符串，编辑时保持不变 |

MongoDB 内部 _id、ownerId、updatedAt 不进入公开任务响应。个人列表按 ownerId 过滤，再按 createdAt、_id 升序查询；创建时 ownerId 来自会话，不能由客户端指定。编辑和删除同时按任务 id 与 ownerId 过滤，访问他人任务与访问不存在的任务都返回 404。

用户、Session、认证限流计数与任务持久化至 MongoDB。历史无主任务原样保留且不可见；公共示例为三条独立常量，不读取真实任务集合，不自动复制给新用户。后端正常重启不清空任务；同一数据库和密钥下，未过期 Session 可恢复。删除数据库卷不属于正常重启保证。对话日志独立持久化到 `chat_logs`，按“入口 + requestId”幂等；它不随访客删除会话而删除，也不进入公开对话响应。

账号为保留前导零的 3–5 位 ASCII 数字字符串，密码按 Unicode 码点计数（包含变体选择符），长度 8–64 且不 trim；密码哈希不进入响应。会话结构、Cookie、有效期、限流和配置要求统一见 [SPEC-001](001-session-auth.md#http-与数据契约)。

## HTTP 契约摘要

所有路径带 /api 前缀。原 X-Learning-Key 及演示 Guard 已移除；个人路由要求有效 Session，所有认证和任务写入要求会话绑定的 X-CSRF-Token。完整的认证 / 公共 / 私有端点合同以 [SPEC-001](001-session-auth.md#http-与数据契约) 为唯一正文，下表保留任务接口摘要。

| 方法 / 路径 | 输入与权限 | 成功响应 |
| --- | --- | --- |
| GET /api/tasks | 已登录 | 200，仅本人 Task[] |
| POST /api/tasks | 已登录 + CSRF；JSON { title } | 201，创建的 Task |
| PUT /api/tasks/:id | 已登录 + CSRF；UUID v4 路径 id；JSON { title } | 200，更新后的 Task |
| DELETE /api/tasks/:id | 已登录 + CSRF；UUID v4 路径 id | 200，被删除的 Task |
| GET /api/stats | 已登录 | 200，{ total: 本人任务数, uptimeSeconds: 非负整数 } |
| GET /api/public/tasks | 无需登录 | 200，三条固定示例 Task[] |
| GET /api/public/stats | 无需登录 | 200，{ total: 3, uptimeSeconds: 非负整数 } |

- 已匹配的个人路由缺失 / 过期会话返回 401；已登录写入缺失或错误 CSRF 返回 403，再执行 DTO / 路径参数管道。
- 守卫放行后，非法 UUID、缺失/null/非字符串/空白/过长标题、额外请求字段返回 400。
- PUT 只修改 title；请求体重复传 id，或提交 completed、createdAt、ownerId 等额外字段均不接受。
- 守卫放行且输入合法时，编辑 / 删除不存在或不属于本人的任务返回 404，message 为“任务不存在”。
- PUT/DELETE 缺少路径 id 不匹配路由，返回 404。错误 JSON 在解析阶段返回 400，不应误解为所有错误都先过 Guard。
- 被拒绝的写入不修改已有任务或统计；编辑不改变任务数；创建 / 删除分别增减本人任务数。
- 错误体包含 statusCode、path、requestId；常见 HTTP 错误的 message 为字符串或字符串数组，error 等原字段可保留。
- 错误响应头 X-Request-Id 与响应体 requestId 一致。未知异常返回 500 与通用消息，内部详情留在后端日志。
- 成功响应保持原始业务结构，不额外套一层 data；认证与个人响应禁止缓存。

## 前端行为

- 全站 API/SSE 错误由 `frontend/src/api/http.ts`、`frontend/src/utils/error-tips.ts` 与 `frontend/src/components/api-tips/` 统一转成 Ant Design tips；公开页面不再渲染错误横幅或内联错误文案，表单字段校验仍就地显示。

依据：[认证 Store](../../frontend/src/store/auth.ts)、[任务 Store](../../frontend/src/store/tasks.ts)、[认证弹窗](../../frontend/src/components/auth-modal.tsx)、[页面](../../frontend/src/pages/tasks/index.tsx)。

- 首屏先恢复 Session；恢复失败显示重试，不将网络 / 存储故障误当未登录。
- 游客显示三条“示例任务”和只读标记，点击创建 / 编辑 / 删除只打开同一登录 / 注册弹窗；登录后不重放原操作。
- 账号用文本输入保留前导零；注册确认密码并自动登录。默认登录，底部“还没有账号？立即注册”切到注册，注册底部“已有账号？去登录”返回；不使用页签。业务失败用 Ant Design message 提示，字段错误显示在输入旁；失败保留输入，切换模式清理无关错误；提交期间禁止关闭和重复提交，成功 / 取消清除密码。
- 登录后只展示本人的任务，新账号清单为空；查询、创建、编辑标题、删除，删除需确认，取消不发删除请求。
- 写入进行中避免重复提交；编辑 / 删除成功后才关闭弹窗，失败保留输入和重试入口。
- 删除成功使用响应任务的 id 更新列表，因此依赖删除返回 Task 的契约。
- 创建 / 删除后重新查询统计，刷新列表同时刷新统计；统计失败显示未知值，不冒充 0，不把已成功写入描述为失败。运行时长仍在 API 返回，当前页面展示任务数和可见性说明，不展示后端时长或实现流程。
- 身份变化立即清空旧列表、统计、错误和编辑 / 删除弹窗；所有读取、写入、错误、finally 与后续统计刷新校验身份版本。列表与统计另有请求版本号，写入会作废此前读取。
- 当前私有请求 401 返回公共示例并打开登录提示，旧身份 401 不退出新用户；退出失败保留身份并显示可重试错误。退出请求未结束时，即使身份已经失效也保持互斥，避免新登录被迟到的退出响应清除 Cookie。
- 当前未提供完成状态切换，页面不再固定展示“待完成”标签。上述并发实现的实际浏览器证据见 SPEC-001，不以静态核对替代验收。

## 验收条件与映射

下表将原任务 CRUD 验收映射到当前认证前提；新增认证细则与编号见 [SPEC-001 验收条件](001-session-auth.md#验收条件)。测试存在不代表本轮已经通过。

| 编号 | 条件与预期 | 当前验证方式 |
| --- | --- | --- |
| AC-01 | 已登录新用户查询为 []；创建 201，后续查询可读到，多个任务 id 不同 | tasks HTTP 测试；SPEC-001 AC-10/13 |
| AC-02 | 个人路由先校验 Session，写入再校验 CSRF，之后校验 DTO / 路径；拒绝不改数据 | tasks/auth HTTP 测试；SPEC-001 AC-05/07；替代原演示头验收 |
| AC-03 | 非法标题、额外字段返回 400，原数据不变；120 字符标题可编辑 | tasks HTTP 测试；SPEC-001 AC-13 |
| AC-04 | 编辑只改本人任务 title，保留 id、createdAt、completed 与任务数 | tasks/auth HTTP 测试；SPEC-001 AC-06/13 |
| AC-05 | UUID 不合法 400，不存在或他人任务 404；缺少路径 id 404 | tasks/auth HTTP 测试；SPEC-001 AC-06/13 |
| AC-06 | 删除返回被删除任务，失败不误删；本人创建 / 编辑 / 删除统计正确 | tasks/auth HTTP 测试；SPEC-001 AC-06/13 |
| AC-07 | 错误保留状态/message并补 path/requestId；未知错误不泄漏详情 | tasks HTTP 测试；SPEC-001 AC-13 |
| AC-08 | stats 同时包含本人任务数量和非负运行秒数；公共统计固定为 3 | tasks/auth HTTP 测试；SPEC-001 AC-01/06/13 |
| AC-09 | 前端确认/取消、错误重试、统计未知值、重复操作和身份切换符合约定 | 浏览器操作；SPEC-001 AC-01/02/03/05/11/12；无正式自动化交互套件 |
| AC-10 | 创建后关闭并重建后端与 Mongo 连接，原 Cookie 可恢复身份和任务 | auth HTTP 重启专项测试；SPEC-001 AC-09 |

## 当前验证记录

认证功能实现时的命令、浏览器操作、逐项验收与限制集中记录在 [SPEC-001](001-session-auth.md)、[后端任务记录](../ai/tasks/001-backend.md)、[前端任务记录](../ai/tasks/001-frontend.md)，由主代理整合核对。后续模块整理的当前回归证据维护在 [SPEC-002](002-auth-module-organization.md)。下节保留认证改造前的历史结果，不作为当前代码已经通过的证据。

## 历史验证记录（认证改造前）

以下记录对应原 d688983 基线和规范落地时的代码，范围是未引入正式认证的任务系统。后端测试使用独立 awei_e2e_<UUID> 数据库并在结束时清理；构建 / lint / 类型检查只提供工程检查证据，不代替当时的 AC-09、AC-10。

| 日期 | 范围 | 命令 / 操作 | 当时的实际结果 |
| --- | --- | --- | --- |
| 2026-11-05 | 基线文档 | 对照源码和测试逐项核对 | 静态核对完成 |
| 2026-11-05 | 原 AC-01 至 AC-08 | npm test --prefix backend | 通过：22 个测试，0 失败；包含后端构建 |
| 2026-11-05 | 前端工程检查 | npm run lint --prefix frontend；npm run build --prefix frontend | 均通过；build 已包含 tsc 类型检查，未重复单独执行 check。Vite 提示压缩后部分 chunk 超过 500 kB，构建仍成功 |
| 2026-11-05 | 原 AC-09 | 浏览器确认、取消、错误与重复操作 | 未运行 |
| 2026-11-05 | 原 AC-10 | 后端重启后的数据查询 | 未运行 |

## 影响与交接

SPEC-001 已替代旧演示 Guard 与无用户隔离的访问边界；历史无主数据保留且隔离，不迁移归属。回滚不能直接恢复无 ownerId 过滤的旧接口，以免公开个人数据；本轮不执行数据清理或回滚。

后续功能变更继续创建新 SPEC，并同步本基线的当前事实。整体验收状态以对应规格与 [STATE](../ai/STATE.md) 为准，历史检查结果不推导当前版本已验证。
