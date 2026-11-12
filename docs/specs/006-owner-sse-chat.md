# SPEC-006：站主后台 SSE 多模型对话

- 编号：006；状态：已验证（本地两轮浏览器与真实GLM/跨会话记忆；线上待验证）；更新日期：2026-11-12。
- 基准：`c6d19ff`；保留原 README、STATE 和 SSE 分析记录。用户已要求实施，确认仅站主后台可用；不提交、推送或部署。
- 前置：[SPEC-001](001-session-auth.md)、[SPEC-003](003-personal-site.md)、[可行性分析](../ai/tasks/sse-chat-feasibility.md)。本规格替代分析中的待定开放对象与模型选择。

## 目标与范围

在站主 `/admin` 增加“AI 对话”分区，默认模型为免费 `glm-4.7-flash`，支持创建/切换会话、持久化历史、安全Markdown展示、逐段输出、停止生成、错误/中断展示、按后端配置选择多个模型，以及手动管理的跨会话长期记忆。默认只有 GLM；API Key 只在服务端环境配置中保存。

本轮不包含游客或普通用户访问、附件/语音/图片、工具调用、联网搜索、知识库、自动提炼记忆、后台续跑、自动重发生成、删除历史、付费模型自动回退、Redis/MQ 或多实例执行。配置其他厂商不代表实际调用验证完成。

## 用户行为

- 复用后台登录与站主权限，AI 对话独立于官网配置草稿，不进入 SiteContent、公开页面或 iframe 预览；切分区不能丢失官网未保存草稿。
- 桌面/手机显示会话列表（可用选择控件）、新对话、模型选择、消息与输入区。空会话引导发送；无可用模型时说明尚未配置并禁用发送。
- 输入保留到请求被确认受理。发送期间不允许重复提交/切模型；提供“停止生成”。切换会话、离开聊天或身份变化取消正在读取的流，不将旧事件写入新会话。
- 每条回复显示其模型及生成中/已完成/已停止/失败/中断状态。刷新从 Mongo 读取历史；失败保留输入或提供复制/重新编辑，禁止隐式重发。
- 流早于终态结束时按中断处理并查询服务端结果；部分文本保留。停止操作以返回的业务终态为准，迟到完成不能覆盖已取消状态。

## 接口与数据契约

所有 `/api/chat` 入口依次验证 Session、站主；写入口另验 CSRF。可信 ownerId 来自 authUser.id，且所有 Mongo 查询均带 ownerId。缺省站主配置拒绝访问。

| 方法/路径 | 输入 | 成功响应 |
| --- | --- | --- |
| GET `/api/chat/models` | 无 | `{models: ChatModel[], defaultModelId: string}` |
| GET `/api/chat/conversations` | 无 | `{conversations: ChatConversation[]}`，最近更新在前，最多50项 |
| POST `/api/chat/conversations` | 空 JSON 对象 | 201，ChatConversation |
| GET `/api/chat/conversations/:id` | UUID | `{conversation: ChatConversation, turns: ChatTurn[]}` |
| POST `/api/chat/conversations/:id/stream` | `{requestId, content, modelId}` | 200 `text/event-stream`，见下方 |
| POST `/api/chat/conversations/:id/turns/:requestId/cancel` | 空 JSON | ChatTurn，重复取消返回已有终态 |

类型：

```ts
type ChatModel = { id: string; label: string; available: boolean }
type ChatConversation = { id: string; title: string; createdAt: string; updatedAt: string }
type ChatStatus = 'streaming' | 'completed' | 'canceled' | 'failed' | 'interrupted'
type ChatTurn = {
  requestId: string; content: string; answer: string; modelId: string; modelLabel: string;
  status: ChatStatus; error: string | null; createdAt: string; updatedAt: string;
}
type ChatEvent =
  | { type: 'start'; conversationId: string; turn: ChatTurn }
  | { type: 'delta'; requestId: string; text: string }
  | { type: 'done'; conversationId: string; turn: ChatTurn }
```

- SSE `event` 对应 type，`data` 为上面 JSON；只有成功收到并验证 `done` 才按其业务终态结束。可发送 SSE 注释心跳（15秒）。不依赖传输 EOF 或 SSE id 判断业务完成。
- requestId 为客户端生成 UUID；content trim 后1–4000个Unicode字符；modelId 为后端白名单。未知字段、路径/输入/模型无效400；匿名401、非站主403、不属于站主的资源404；活动运行冲突409或429；模型未配置503。流开始前保持标准JSON错误，流开始后错误转为 failed 的 done，不泄露密钥或上游原始响应。
- 同一会话+requestId只创建一轮、最多调用模型一次；同标识不同内容/模型409。已完成的同请求可重放保存的 start/done，活动重复请求409，不追加用户消息。
- 同一站主最多一个活动生成；每会话最多100轮（达到上限400并提示新建会话），历史展示最新50个会话。不静默删除旧记录。
- Mongo 可用一个独立 conversation 文档内嵌有界 turns；并发受理、完成/取消使用条件更新，避免旧结果覆盖终态。保存阶段性正文（节流）与最终结果；数据库写入失败不能发送 completed。
- 每次模型调用只带最近10轮 completed 的用户/助手对话及当前输入，历史按总32000字符预算从旧到新裁剪、保留当前输入；模型最多输出4096 tokens，应用保存/展示答案最多16000字符。超出按失败/受限结束并保留部分正文，不能伪装完整成功。
- 总生成时限默认120秒，可通过 CHAT_TIMEOUT_MS 设置（1000–300000）；超时或断连 abort 上游，保存 interrupted/failed。持久化过期时间用于重启后将遗留 streaming 识别为 interrupted，不自动重新调用模型。

## 配置与技术决策

- 沿用 Nest 12.3.2、Node fetch、React/MobX、Mongo，无新增运行依赖。实际选择 Nest Controller 中受控 Express SSE：受理持久化完成后才flushHeaders，使前置错误仍返回标准JSON，并将response.close准确绑定上游abort。未采用原候选`@Sse`+Observable，业务事件合同不变，生命周期由HTTP与浏览器测试验证。
- 上游采用 Chat Completions 兼容接口，默认 `https://open.bigmodel.cn/api/paas/v4` + `/chat/completions`，模型 `glm-4.7-flash`，stream=true，默认关闭思考（仅消费 delta.content，不展示 reasoning_content）。解析必须处理UTF-8跨块、CRLF、跨chunk事件、多行data、注释、DONE和异常EOF；限制单事件大小，防止无限缓冲。
- 默认 GLM_API_KEY 留空：应用正常启动，模型 available=false；填入后重启后端生效。可选 GLM_BASE_URL 用于服务端指定兼容地址（默认官方）。绝不接收前端传来的URL、Key、system提示词或任意上游参数。
- `CHAT_MODELS_JSON` 可选，最多10个额外模型，结构 `[{"id":"other-model","label":"其他模型","model":"provider-model-id","baseUrl":"https://provider.example/v1","apiKeyEnv":"OTHER_LLM_API_KEY","disableThinking":false}]`；GLM为内置模型，id不得重复。可用性由引用的环境变量决定，客户端仅得到id/label/available，不返回Key、Key变量名或baseUrl。非兼容协议需后续增加适配器。
- 服务端配置的baseUrl须HTTPS；仅允许回环HTTP作为本地开发/测试模型服务，不跟随跨域重定向转发Authorization。配置错误提供不含原始配置/密钥的明确错误，不能回退付费模型。
- Session只在请求入口检查；生成最长120秒，前端退出/身份变化取消；不承诺跨标签撤销瞬时生效。新增 chat 路由纳入日志和 no-store。复用站主Guard时将其移至已共享Auth职责并保留旧路径兼容，或导出既有Guard；不得复制两套站主判断。
- 不新建分支/worktree，不改真实.env、不读取或输出真实凭据。原本机27017需要认证，本轮另启一次性Mongo容器 `nest-chat-verification-20261112`（--rm），显式使用本机127.0.0.1:27019和随机临时库，不使用连接线上库的backend/.env；根代理验收后清理本次容器。

## 验收条件

| 编号 | 场景 | 预期与验证 |
| --- | --- | --- |
| AC-01 | 匿名、普通用户、站主、无CSRF | 401/403/成功/403；HTTP验证全部聊天入口与归属过滤 |
| AC-02 | 无Key、GLM配置、第二兼容模型、非法模型 | 未配置可见但禁发；模型选择只发送白名单参数；Key不出现在响应/错误；真实HTTP+本地模型服务 |
| AC-03 | 中文UTF-8跨字节、CRLF、多行data、注释、截断EOF | 前后端都正确解析且不将截断当完成；定向模块与HTTP测试 |
| AC-04 | 新建、发送、多轮、刷新 | 增量实时可见，完成后保存，按既定历史窗口送上游，刷新内容/模型/终态保持；HTTP+浏览器 |
| AC-05 | 停止、断连、超时、重启遗留、完成/取消竞争 | abort上游、正确终态、保留部分内容、无永久生成中；HTTP模拟上游+浏览器 |
| AC-06 | 双击、同requestId重试、并发、新旧请求交错 | 不重复调用或新增轮次，不覆盖终态；HTTP+前端状态验证 |
| AC-07 | 切会话/离开/退出/身份过期 | 不串消息、不泄漏旧会话，取消流并清理监听；浏览器与定向模块 |
| AC-08 | 桌面/390px手机后台与官网草稿 | 聊天可用、无横溢出，官网编辑保存/预览不受影响；真实浏览器 |
| AC-09 | 模型401/429/500、空答、长度上限、DB持久化失败 | 安全明确错误，保留部分回复或输入，不假完成；HTTP与模块验证 |
| AC-10 | 申请Key/配置多模型/部署说明 | README与.env.example准确；不含真实Key；官方链接与本地示例核对 |

## 实施清单

### P1 后端与HTTP验证
- [x] 在 `backend/test/chat.e2e.test.mjs` 先建立隔离Mongo+本地流式模型fixture，证明现有路由缺失，再实现AC-01至06/09。
- [x] 新增 `backend/src/chat/` module/controller/service、config、dto、types、schemas和providers/stream解析；注册AppModule、no-store和共享站主Guard，更新backend/.env.example。
- [x] 按合同实现模型目录、消息持久化、幂等/并发、取消与超时，执行构建和完整后端HTTP套件；证据记录 `docs/ai/tasks/006-chat-backend.md`。

### P2 前端聊天与验证
- [x] 读取P1相同合同，新增 `frontend/src/types/chat.ts`、`api/chat.ts`、流解析工具、`store/chat.ts`、后台ChatPanel与Less模块；先用现有Node/TS能力测试解析和状态失败场景，不增设测试框架。
- [x] API层复用http请求与错误解析，另增流读取；store隔离身份/会话/运行；后台加入chat分区并独立于编辑预览布局，完成AC-02至08。
- [x] 执行lint/build及有意义的流解析/状态检查；证据记录 `docs/ai/tasks/006-chat-frontend.md`。

### P3 整合、说明和验收
- [x] 根代理提供API Key申请与多模型配置文档、更新SPEC索引与系统基线/架构/STATE。
- [x] 独立审查跟踪及未跟踪变更，按发现修复；隔离Mongo与本地模型服务进行真实Chrome桌面/手机验收。
- [x] 记录本地模拟上游通过与真实GLM调用/线上Nginx未验证的边界；若用户配置Key再在明确安全的数据环境验证真实模型。

## 验证记录

2026-11-12，`c6d19ff` 加本轮未提交改动；macOS/Node22.23.4，专用127.0.0.1:27019临时Mongo、本地模型fixture，真实Chrome桌面1920×958/手机390×844。分项证据：[后端](../ai/tasks/006-chat-backend.md)、[前端](../ai/tasks/006-chat-frontend.md)、[整合/浏览器](../ai/tasks/006-chat-integration.md)、[独立审查](../ai/tasks/006-chat-review.md)。

| 范围 | 实际结果 |
| --- | --- |
| AC-01/02 | 全聊天路由匿名401/非站主403/CSRF403、归属隔离、无Key503与模型目录/白名单/第二模型通过真实HTTP；Chrome站主可用、普通账号拒绝、多模型切换通过。无Key页面由实际模块检查，未额外浏览器实操。 |
| AC-03 | HTTP与实际前端模块验证UTF-8/CRLF/多行/注释/EOF/事件大小；独立审查补164个二分切点断言与非法UTF-8拒绝，两端通过。 |
| AC-04/05/06/09 | 后端聊天专项19/19，含持久化/上下文预算/限额、重启恢复、停止/断连/超时/错误、Mongo终态写失败、幂等和受理竞态；完整后端114/114、7套件（含build）通过且退出0。两处受理竞态均先红后绿。 |
| AC-04/05/07/08 | Chrome逐段正文、停止保留部分、刷新恢复、429与断流失败、切会话不串流、离开分区中断、退出/普通账号拒绝、官网未保存草稿保留均通过；390px无横溢出、输入16px。最终后端build额外复验立即停止/续聊/切会话。 |
| AC-06/07 | 前端实际API/Store/解析测试15/15通过，包含迟到响应、身份/会话/刷新交错与受理前停止；lint无告警、build通过。独立审查无可复现P1/P2。 |
| AC-10 | 官方标准Key申请/分类、GLM模型/免费定价核对；README、.env.example、多模型格式和Nginx说明与代码核对，无真实凭据。 |

未提供真实API Key；真实GLM、其他供应商、正式Nginx、其他浏览器/真机软键盘、实际断电和持续Mongo故障未验证。没有部署或修改真实.env。本次临时服务/库/媒体/容器已清理；未保存验收图片。

## 决策与交接

- 用户已指定免费GLM-4.7-Flash并要求实施，且明确仅站主后台使用。多人聊天、公开入口和其他付费模型未授权启用。
- 原生fetch兼容协议减少依赖并使供应商可替换；业务事件协议统一，模型适配不进入页面。
- 首版连接与生成绑定，断线停止；后续若需要后台续跑，应单独扩展持久运行与订阅结构。


### 后续：2026-11-12 本地Key配置与真实接口探测

用户明确授权后，将Key仅写入被Git忽略的backend/.env（权限600），保留其他现有配置；未修改应用代码或服务器环境。通过项目实际已构建的ChatConfig/ChatCompletionsProvider发起合成短消息，未导入AppModule、未写Mongo聊天：首次HTTP429；一次诊断请求20秒超时；后续官方端点明确返回HTTP429、业务码1305、文案“该模型当前访问量过大，请您稍后再试”。尚未收到成功正文/DONE，真实GLM流式兼容与业务链路仍待平台恢复后验证，不将已配置冒充已调用成功。

本地原有nest-db隧道已恢复，后端3000/前端5173启动成功；启动编译0错误、GET公共任务200、匿名聊天目录401、后台HTML200。未使用已有真实账号做自动登录或写入聊天；用户可在http://127.0.0.1:5173/admin进入AI对话。未部署服务器，完整测试沿用此前已通过且代码未变的结果。本次只更新本地Key与配置/探测记录，不保存密钥明文到文档、代码或日志。

## P4：聊天工作区设计与交互补齐（2026-11-12，已验证）

用户要求按现有整体思路优化AI对话UI、补齐此前遗漏，并做两轮页面验收。“两轮眼熟”按两轮页面验收执行；用户已明确遗漏项为记忆，实施见P5。本增量不自动启用原首版排除的多智能体、Redis/MQ、知识库、附件或后台续跑。

### 设计与范围

- 产品：站主用于整理官网内容、写作和技术讨论的私有工作区。
- 性格：温暖、专注、克制；沿用HEY.、橄榄色/奶油色/暖橙、现有中文字体，不另造品牌。
- 视觉来源：官网创作台；安静的深色工作区、清晰的阅读行宽和留白。颜色集中在新对话/发送与选中位置，不做光晕或装饰卡片。
- 内容重点：真实消息与代码/表格排版；空态提供贴合站主工作的可编辑提问，点击只填输入，不直接调用模型。
- 特征：沿用官网暖橙细线作为当前会话标记；字体/间距/边框统一，正文桌面15–16px、手机16px，辅助文案至少12px。
- 桌面使用会话侧栏（约240px，标题/日期/搜索）与弹性聊天区，主阅读列约760px；输入区固定在工作区底部、消息区独立滚动。手机会话列表收进可关闭的抽屉，压缩全站栏，输入与停止/发送不能被页脚遮挡。
- 补齐安全Markdown/GFM表格与代码块、复制整条回复/代码（失败有提示）、用户上翻时不抢滚动并提供回到最新、清晰的加载/无Key/错误/停止状态、输入聚焦与既有Ctrl/⌘+Enter/中文输入法边界。只展示文本，不自动加载模型提供的远程图片或执行HTML。
- 保留历史、重新编辑、模型白名单、停止、身份/会话隔离、官网草稿和已有CSRF流程。重复错误合并展示；重试通过重新编辑后手动发送，不隐式重复调用。
- 方案取舍：采用完整聊天工作区解决会话发现和输入可达问题；单纯改色/圆角无法解决布局问题，另建公开聊天路由会偏离站主后台范围。本选择由实现者据现有产品作出，可随用户明确缺项修订。

### 实施与验收

- [x] P4.1 更新ChatPanel及后台chat专属容器，建立历史侧栏/搜索、移动抽屉、持续可达输入、空态建议、滚动状态与焦点。
- [x] P4.2 独立ChatMarkdown/Copy控件复用现有react-markdown/remark-gfm，无新运行依赖；验证HTML/危险URL、远程图片、宽代码/表格、复制和流式未闭合文本。
- [x] P4.3 第一轮Chrome实操：桌面1440/手机390，空态、历史、发送、增量、停止、Markdown与复制、错误、草稿保留；记录发现并修正。
- [x] P4.4 第二轮Chrome复验：1440/768/390/320，长内容/滚动/键盘/抽屉焦点/失败恢复/横溢出/停止控件；独立审查与必要lint/build/定向测试。
- [x] P4.5 回写实际证据与清理。测试用独立27019随机Mongo和本地模型fixture，不读取真实Key、不写线上聊天；本轮不提交、推送或部署。

验收编号：AC-11工作区/手机输入可达；AC-12Markdown安全与复制；AC-13历史搜索/空态建议/滚动与键盘；AC-14两轮有记录的真实浏览器验收，区分视口模拟与真机软键盘。

### P5：用户追加跨会话长期记忆（2026-11-12，已验证）

用户已明确遗漏项为“记忆功能”。本增量替代首版“不含长期记忆”的范围限制；原最近10轮只是短期会话上下文，不冒充长期记忆。实现者选择显式可控记忆：站主手动添加，或从一条回复保存；查看/编辑/启停/确认删除，后续会话使用启用项。暂不自动抽取/摘要、不新增向量库/Embedding或额外付费调用。

合同：
- 仅站主，沿用/api/chat的Session/Owner/CSRF/no-store。ownerId仅取authUser，每次Mongo读写带ownerId；独立记忆集合/文档，不放SiteContent或前端localStorage。
- `ChatMemory={id:string,content:string,enabled:boolean,createdAt:string,updatedAt:string}`，UUID，ISO时间；content trim后1–500个Unicode字符，每站主最多20条，启用项文本总量自然不超过10000字符。
- GET `/api/chat/memories` → `{memories:ChatMemory[]}`（updatedAt降序）；POST同路径`{content}` →201 ChatMemory（默认enabled=true）；PATCH `/api/chat/memories/:id` `{content?,enabled?}`至少一项 →200 ChatMemory；DELETE同路径 →200 `{id}`。坏字段400，无权401/403、无CSRF403、不属于站主404、超限400；不能客户端指定id/ownerId。
- 通过一个owner唯一文档+有界items数组或等价原子方案，保护20条并发上限；修改/删除只命中目标项，不丢并行修改。
- 每次新生成受理前读取已启用记忆，作为一条system上下文加入兼容模型messages，再带原最近10轮completed/32000字符预算和本次输入；记忆项只供相关回答参考，当前用户明确要求优先。无记忆时保持原messages形状。生成途中更改仅影响后续请求；已保存答案不被改写，不自动重发模型。
- 记忆信息将发送至当轮选择的模型，界面在管理面板明示。Key/URL不进入记忆响应。保存整条回复超过500字时打开编辑框让用户摘录，绝不静默截断或自动总结；保存失败保留输入。
- 前端新增独立memory API/Store（身份版本和读取请求保护、写入互斥）；聊天入口组件 `ChatMemoryPanel`（自含按钮/弹窗），消息操作组件 `MemorySaveButton({content:string})` 打开同一管理表单预填回复。退出或换身份清除旧数据/编辑器，迟到请求不得污染新身份；删除需明确确认，失败保留弹窗/记录。

实施：
- [x] P5.1 后端memory类型/DTO/schema/service、controller路由、生成注入；先写隔离HTTP红测再实现；真实HTTP检验权限、并发上限、CRUD、启停/删除对上下文影响、应用重启持久化与原聊天兼容。
- [x] P5.2 前端 `types/chat-memory.ts`、`api/chat-memory.ts`、`store/chat-memory.ts`、`pages/admin/chat-memory-panel.tsx`与Less；实际模块测试身份隔离/错误/互斥与UI管理。两轮页面验收包含记忆新增/编辑/启停/删除/跨会话注入。
- [x] P5.3 根整合独立审查、必要检查与文档/STATE更新；只用独立27019临时库与本地模型fixture，真实Key与线上聊天不参与验收。

新增验收：AC-15记忆CRUD/权限/限额/重启；AC-16跨会话启用记忆注入及编辑/停用/删除后的请求变化；AC-17记忆UI、身份隔离、删除确认和错误保留。原AC-14的两轮验收包含这些交互。


### P4/P5 最终验证与交接（2026-11-12）

基准仍为`c6d19ff`及未提交工作区；无提交/推送/部署。证据：[整合与两轮页面验收](../ai/tasks/006-chat-ui-memory-integration.md)、[工作区](../ai/tasks/006-chat-ui-workspace.md)、[Markdown](../ai/tasks/006-chat-ui-markdown.md)、[记忆后端](../ai/tasks/006-chat-memory-backend.md)、[独立审查](../ai/tasks/006-chat-ui-memory-review.md)。

| 验收 | 实际结果 |
| --- | --- |
| AC-11/13/14 第一轮 | Chrome1440×900/390×844，历史搜索/建议预填聚焦、Markdown排版/代码复制、记忆新增编辑停用与新会话注入、官网草稿保留、抽屉/Escape焦点通过。发现保存记忆后焦点丢失并修复。 |
| AC-11/12/13/14 第二轮 | Chrome1440/768/390/320，Enter换行/Ctrl+Enter发送、当前会话不误停、停止保留正文、429单错误/重新编辑续聊、上翻保持位置/返回最新、宽代码和表格局部滚动、回复复制通过。模型外部图片DOM数量0。 |
| AC-14 布局修复复验 | 长内容复制辅助文本逃逸导致外壳scrollTop381；修正定位容器与clip边界后，按长代码键盘滚动→记忆关闭→抽屉→resize原路径复验。四尺寸均外壳scrollTop0且scrollHeight=clientHeight；1440工作区top72/bottom900、输入bottom801，320输入bottom639，抽屉正常。 |
| AC-15/16 | 后端全量126/126、8套件含build通过。记忆权限/归属、CRUD、20条并发上限、500码点、跨会话/编辑/停用/删除注入变化、生成快照、应用重启持久化均为隔离HTTP证据。浏览器实际观察启用记忆进入上游请求、停用后不进入、刷新后保留。 |
| AC-17 | 浏览器回复预填保存/编辑/启停/删除取消与确认/刷新/超500保留全文禁保存通过；模块验证失败保留、写入互斥、初始加载与写入交错、身份变化/迟到响应和CSRF过期。 |
| 最终检查 | 前端实际模块40/40、lint无告警、build通过；最终仅CSS修复后再跑lint/build通过，未变模块复用40项结果。后端126项沿用最终实现后的结果，不重复测试。独立审查三项P2均关闭，浏览器新增布局问题修复通过。 |

只使用27019一次性Mongo、本地模型fixture和合成账号/内容；测试账号退出、viewport恢复，3001/5174/27019、临时数据库/容器/媒体/运行器已清理。原3000默认开发服务在并行build导致watcher缺入口后已恢复，匿名models/memories401、5173后台200；保留原配置与27018隧道。本轮未读取真实Key、调用供应商或写线上测试聊天。真实GLM仍沿用此前429/1305未成功边界；正式Nginx、多浏览器、真机软键盘未新增验证。没有截图或视觉快照。


### 后续：2026-11-12 20:18–20:19 真实GLM与记忆对照

用户要求再次验证，复用当前实现与已配置Key，在独立27019一次性Mongo和合成账号上走实际登录/CSRF/聊天/记忆HTTP链路，直接调用官方GLM-4.7-Flash，不使用模型替身、不改默认真实数据。完整证据见[真实验收记录](../ai/tasks/006-real-glm-verification.md)。

- 首次普通A仍返回官方429/1305，业务SSE正确保存failed、无正文；10秒后B新会话只在system中收到新保存的随机代号，准确返回，12个delta、596ms。
- 停用记忆后另一个全新C仅user消息，无代号/旧会话历史，成功回答“未知”，1103ms。由随机答案不在用户问题、新会话为空与上游角色快照排除短期上下文误判。
- D在第二个独立临时库补验普通聊天成功，6个delta、1234ms，回复“你好！祝你今天愉快！”。所有成功项completed/error=null，delta拼接等于done.answer且GET持久化逐字段一致。
- 本轮确认真实SSE业务链路及跨会话记忆召回/停用行为；首次繁忙仍说明平台可能间歇失败，不能宣称持续稳定。当前“从未成功”的边界被本记录替代，正式Nginx、其他供应商、线上环境仍未验。
- 临时库计数0，测试容器/运行器已清理，原3000/5173/27018与配置保留。没有改应用源码/配置、重复全量测试或新增浏览器验收，没有提交、推送或部署。
