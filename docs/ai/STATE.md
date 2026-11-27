## 2026-11-27：对话日志与 admin 查看（本地已验证，未部署）

- 背景（m00001）：用户要求每一轮对话都可观察，记录用户提问、回答、耗时与错误，并在 admin 页面展示；日志要覆盖公开对话与站主对话的完整链路。
- 后端：新增 `backend/src/chat-logs/`（集合 `chat_logs`、`ChatLogsService`、`GET /api/chat-logs`、DTO/类型/错误文案）。公开入口在访客校验后开始记录，`begin` 失败、断连、幂等重放、正常完成都收口；站主入口在 `prepare` 前开始记录，以 SSE done 的轮次为终态，异常兜底 failed。日志为旁路，写入/索引失败只 warn，不阻断对话；`requestId` 幂等，终态只允许 streaming→终态。
- 前端：新增 `frontend/src/types/chat-log.ts`、`api/chat-logs.ts`、`store/chat-logs.ts`、`pages/admin/logs-panel.tsx` 与样式；admin 侧栏新增“对话日志”，页内可按入口/状态筛选、分页、刷新，卡片展示时间、入口、状态、耗时、提问、回答、错误（无错误显示“无错误”），失败保留旧列表并显示重试。
- 文档：新增 `docs/specs/012-conversation-logs.md`；更新 `SPEC.md` 索引（补 010/011/012）、`docs/specs/011-site-chat-history.md` 的后台边界、`docs/specs/000-current-system.md` 的当日基线与数据说明。
- 验证（本地）：backend `npm run build` 通过；全量 `npm test` 181/181 通过（Mongo 27018 隔离库）；新增 `backend/test/chat-logs.e2e.test.mjs` 通过，覆盖公开/站主成功、公开 500 失败、筛选分页、401/403/400。frontend `npm run check`、`npm run lint`（0/0，91 files）、`npm run build` 均通过。headless Chrome 1440×900 登录 owner 打开 `/admin` → “对话日志”：3 张卡片、筛选/分页/耗时/错误展示正常，无横向溢出。
- 修复：`ChatLogsService.onModuleInit` 的 `records.init()` 改为 try/catch，避免索引构建失败阻断启动；此前全量测试 owner-init 并发建索引偶发失败，修复后全量通过。
- 影响文件：`backend/src/chat-logs/*`、`backend/src/site/site-chat.controller.ts`、`backend/src/chat/chat.controller.ts`、`backend/src/{app.module.ts,site/site.module.ts,chat/chat.module.ts,app.setup.ts}`、`backend/test/chat-logs.e2e.test.mjs`、`frontend/src/{types/chat-log.ts,api/chat-logs.ts,store/chat-logs.ts}`、`frontend/src/pages/admin/{logs-panel.tsx,logs-panel.module.less,sections.ts,fields.tsx,index.tsx}`、`docs/specs/012-conversation-logs.md`、`SPEC.md`、`docs/specs/000-current-system.md`、`docs/specs/011-site-chat-history.md`。
- 未提交/推送/部署；用户原有 `.gitignore` 改动保留。待办：AC-04 公开断连、AC-05 站主 prepare 失败尚未构造真实请求；生产 MongoDB 索引与真实模型链路待部署验证；日志暂不设 TTL。

## 2026-11-26：简历页改回结构化正文（按最新 PDF 重建，PDF 仅下载）

- 背景（m01353）：PDF 正文模式首屏要加载 1.2 MB pdf.js worker + 851 KB PDF，`/resume` 打开明显慢；用户要求「按最新简历生成页面结构」，PDF 只作附件。
- 内容：按 2026-11-25 最新 PDF 全量重建 `content.resume`（线上 version 18 → 19）：role 全栈 Agent 开发工程师、6 组技能、4 条个人优势、2 段工作、5 个项目、江西理工大学；保留 `pdfUrl`，不公开手机号与期望薪资。备份 `/tmp/site-backup.json`，结构化内容源 `/tmp/resume-new.json`。
- 前端：`frontend/src/pages/resume/index.tsx` 删除 pdfMode 分支，正文恒为结构化内容并新增「个人优势」分区；删除 `pdf-document.tsx`；`style.module.less` 清理 PDF 容器/骨架屏样式；`npm uninstall pdfjs-dist`；工具栏 `pdfUrl` 存在时「下载 PDF」，否则「导出 PDF」。
- 数据契约：`strengths?: string[]`（≤8 条×240 字）加入 `frontend/src/types/site.ts`、`backend/src/site/types/site.type.ts`、`backend/src/site/dto/save-site.dto.ts`、`frontend/src/api/site.ts` 读取解析、后台编辑器「个人优势」。
- 验证（本地）：frontend lint 0 警告、check、build 通过；backend build 通过；本地 dist + 反代线上 API，`/resume` 标题「李武伟-全栈 Agent 开发工程师-简历」，分区依次 专业技能/个人优势/工作经历/项目经历/教育经历；390×844@2x 手机单列无溢出；「下载 PDF」指向原文件。
- 影响文件：`frontend/src/pages/resume/{index.tsx,style.module.less}`（删除 `pdf-document.tsx`）、`frontend/src/api/site.ts`、`frontend/src/types/site.ts`、`frontend/src/pages/admin/editors.tsx`、`backend/src/site/types/site.type.ts`、`backend/src/site/dto/save-site.dto.ts`、`frontend/package.json`、`frontend/package-lock.json`、`docs/specs/008-public-resume.md`、`SPEC.md`。
- 上线：提交 `6ed7c0f`，因 GitHub Actions 仍未恢复，用受限 SSH 手工发布 `<sha>-manual-1795657901`。线上复验：`/resume` 标题「李武伟-全栈 Agent 开发工程师-简历」、五个分区、390@2x 无横向滚动、「下载 PDF」200/851733B；`/api/site-chat/conversations` 仍正常流式。
- 备注：线上 HTML 响应没有 `Cache-Control`（只有 ETag/Last-Modified），旧标签页可能缓存旧 index 并引用已删除的旧 bundle；后续可在 nginx 对 `index.html` 加 `no-cache`。
- 待办：确认 GitHub Actions 恢复；真机复验。

## 2026-11-25：修复新对话首条消息卡死 + 简历加载与提示样式

- 背景（m00851）：新对话首条消息一直停在打字态，必须手动停止再发一遍；tips 提示黑白底色；简历页加载慢。
- 根因：主模型 GLM 偶发长时间不返回任何字节，服务端只有 45s 总超时，期间不会切备用模型，页面就一直转圈。另一方面 `main.ts` 没设置 `trust proxy`，nginx 反代下 `request.ip` 恒为 127.0.0.1，所有访客共用一个 IP 限流桶（会互相挤掉）。
- 修复：`SiteChatService.stream()` 为每次模型尝试单独 AbortController，新增首 token 看门狗（`SITE_CHAT_FIRST_TOKEN_MS`，默认 8000ms）——超时即中止主模型并切 `deepseek-flash`，备用也受同一看门狗约束；总超时仍由 `SITE_CHAT_TIMEOUT_MS` 控制。`main.ts` 增加 `app.set('trust proxy', …)`（默认 `loopback`，可用 `TRUST_PROXY` 覆盖），限流按真实访客 IP 计数。
- 提示样式：全站错误提示 `.api-error-tip` 由反色（黑底白字/白底黑字）改为单一纯色卡面（`--theme-surface` 背景 + 常规文字 + 细边框）。
- 简历加载：加载态改为纸张尺寸骨架屏（shimmer）、第 1 页优先渲染、其余页延后 200ms；`/api/site/assets/:filename` 增加一年 `immutable` 缓存。
- 验证（本地）：`npm run build` 通过；用只 accept 不回包的假上游（127.0.0.1:3199）验证 8.0s 触发切换、9.0s 出首个 delta、9.5s 完成；后端 e2e `site-chat-history` 12/13 通过（`上游429` 用例因本机 .env 有 DEEPSEEK_API_KEY 会切备用而失败，CI 无该 Key 时符合预期）；前端 lint/check/build 通过。
- 影响文件：`backend/src/main.ts`、`backend/src/site/chat/site-chat.service.ts`、`backend/src/site/chat/site-chat.config.ts`、`backend/src/site/site.controller.ts`、`frontend/src/pages/resume/pdf-document.tsx`、`frontend/src/pages/resume/style.module.less`、`frontend/src/styles/global.less`、`docs/specs/008-public-resume.md`、`docs/specs/010-editorial-home.md`。
- 待办：线上验证（真实移动网络、浏览器）；tips 若另有所指需再确认。

## 2026-11-25：简历页改为直接展示上传的 PDF（已上线）

- 用户需求（m00404、m00445）：在方案 A/B 中选 A——以后只维护简历 PDF，替换并保存后 `/resume` 正文直接变成新 PDF，不再重录结构化字段。
- 新增 `frontend/src/pages/resume/pdf-document.tsx`：用 `pdfjs-dist` 6.5.438 渲染（worker 以 `?url` 资源输出，路由级懒加载），每页 canvas 固定 2 倍分辨率；加载失败显示「重新加载 / 下载 PDF」，单页渲染失败给提示。
- `frontend/src/pages/resume/index.tsx`：有合法 `pdfUrl` 时正文切换为 PDF，工具栏「导出 PDF」换成「下载 PDF」，标签页标题改为「姓名-简历」；无 PDF 时完整回退原结构化页面。`style.module.less` 增加 PDF 容器、状态卡、手机、后台预览与打印样式（每页一张 A4）。
- 后台「简历 PDF」分区补充说明：保存后公开页直接使用该 PDF，结构化字段仅在无 PDF 时回退。
- 验证：前端 `lint`（0 警告）、`check`、`build` 通过，`pdf.worker.min-*.mjs` 产物存在且 pdfjs 只进入 resume 分块；本地 `dist` + 反向代理线上只读 API，Chrome 桌面 1440 显示 3 页 canvas、手机 390×844@2x 满宽、深色主题白纸、打印 3 页 A4（209.9×297.0mm）、移除 `pdfUrl` 回退结构化页、PDF 502 错误态均通过，无控制台报错。
- 影响文件：`frontend/src/pages/resume/{index.tsx,pdf-document.tsx,style.module.less}`、`frontend/src/pages/admin/editors.tsx`、`frontend/package.json`、`frontend/package-lock.json`、`docs/specs/008-public-resume.md`。
- 上线：`928d4a2`、`a294864` 推送到 main，GitHub Actions 45636376413、45638969942 均成功；首次上线发现生产 nginx 把 `.mjs` 当 `application/octet-stream`，pdf.js 模块 worker 被拒，改用 `?worker&url` 由 Vite 输出 `.js` 后恢复，不再依赖服务器 MIME。
- 线上验证：入口 `index-Drk-Hehu.js`；`/resume` 在 1440 与 390×844@2x 均渲染 3 页 canvas、无 PDF/worker 报错；worker `application/javascript`；PDF 附件 200/851733B；`/favicon.svg` 200。
- PDF 内的手机号、期望薪资会随页面直接展示，如不想公开需在导出 PDF 时处理；真机未单独复验。

## 2026-11-25：补齐浏览器标签页图标（本地已验证）

- 问题：`frontend/index.html` 没有任何 favicon 链接，`frontend/public/` 下也没有图标文件，浏览器标签页只显示默认地球。
- 新增 `frontend/public/favicon.svg`（黑底白字衬线 H 圆形，与站内 `.brandMark` 视觉一致）、`favicon-32.png`、`apple-touch-icon.png`（180px 满版黑底，供 iOS 圆角遮罩）。
- `frontend/index.html` 增加 svg、32px png、apple-touch-icon 三个 link。
- 验证：`npm run build` 通过，三个文件都复制进 `frontend/dist/`；`vite preview` 实测 `/favicon.svg`、`/favicon-32.png`、`/apple-touch-icon.png` 均 200 且 content-type 正确。
- 未提交/推送/部署。

## 2026-11-25：移动端输入框聚焦放大修复（本地已验证）

- 用户反馈（m00074）：手机上点输入框后页面放大，看不到发送按钮。
- 根因：iOS Safari 聚焦字号 <16px 的输入控件时自动整页放大；`frontend/src/pages/chat/style.module.less` 桌面 14px、≤900px 13px，`frontend/src/pages/site/home.module.less` 14px，放大后 `.composerFoot` 右侧发送按钮被移出可视区。
- 修复：对话页与首页对话卡 textarea 统一 16px（`chat/style.module.less` 基础规则与移动端规则、`home.module.less` 基础规则），并加 `@media (hover: none) and (pointer: coarse)` 兜底触屏平板/横屏；不改 viewport 的 maximum-scale，保留访客缩放能力。
- 验证：前端 `lint`、`check`、`build` 通过；未做真机验证，建议 iPhone Safari 复核聚焦不放大、发送按钮可见。
- 未提交/推送/部署。

## 2026-11-24：对话页侧边栏优化（本地已验证）

- 历史对话：272px 侧栏；标题旁显示会话数量；列表改为圆角行，active 行浅色卡片 + 左侧 2px 标记；删除按钮默认隐藏，hover/focus/active 时显示，触屏设备常显；元信息保持“相对时间 · 轮数”。
- 底部「首页 / 想法 / 作品」由纯文字行改为三等分胶囊按钮，hover 反色描边；说明改为「历史只保存在这台浏览器」。
- 验证：1440/390/320 无横向溢出，当前会话 active 态与删除按钮正常；前端 check/lint 通过。
- 未提交/推送/部署。

## 2026-11-24：后台预览不同步修复（本地已验证）

- 用户反馈（m03958）：在 admin 更新内容后看不到官网预览变化。
- 根因一：`frontend/src/pages/admin/preview-protocol.ts` 的 `isSitePreviewContent` 仍要求简历只有 `name/role/body/pdfUrl` 四个字段；结构化简历加入 `summary/skills/experience/projects/education` 后，父页发来的每份草稿都被拒绝，iframe 停在旧内容/“等待官网预览”。
- 根因二：直接打开 `/admin/preview` 时没有父页面，原逻辑只等待 postMessage；页面组件未订阅 `siteStore`，加载完成也不刷新。
- 修复：预览协议改为校验可选结构化简历字段，并补 `thoughts/works/chat`；`SitePreviewPage` 在顶层打开时加载已保存公开内容并用 `observer` 订阅；官网 `SitePage` 在标签页重新聚焦/可见时重新 `siteStore.load()`，已打开的官网标签页会更新。
- 预览页根容器原是 `position:fixed; inset:0; overflow:clip`，把超出设备高度的文档直接裁掉；改为 `min-height:100vh`，iframe 内部恢复滚动，右侧显示全局 6px 滚动条。
- 验证：用 live `/api/site?include=resume` 内容调用 `isSitePreviewContent` 返回 true；CDP 中父页 iframe 收到 draft 后渲染出李武伟简历；直接打开 `/admin/preview?view=resume` 显示已保存简历。前端 check/lint 通过。
- 未提交/推送/部署。

## 2026-11-24：对话入口、问答导流与首页圆环动效（本地已验证）

- 用户要求（m03756）：发送时先插入乐观消息并滚到底部；简历/项目/想法问答给出页面入口；首页去掉圆环说明文字与「写信给我」，并增强圆环；简历在后台更新。
- `frontend/src/pages/chat/index.tsx`：输入框在提交时立即清空并插入乐观轮次，不再等流结束；滚动 effect 依赖 `turns.length`、最后一条 `answer.length`、`status`，用户主动上滚后不强行拉回。
- 问答完成后按用户问题追加确定性入口：简历 → `/resume`、项目/作品 → `/works`、想法 → `/thoughts`（`turnAction()`）；`backend/src/site/chat/site-chat.prompt.ts` 增加规则，禁止模型输出 URL/Markdown 链接/站内路径，由界面给入口。
- 首页 `frontend/src/pages/site/index.tsx` 与 `home.module.less`：移除 `READ · THINK · MAKE` 圆环说明和 hero「写信给我」；圆环只保留居中「想法」，增加 halo、核心环、旋转 sweep、虚线轨道、轨道点与脉冲，`prefers-reduced-motion` 下全部停止；删除 heroRule，区块之间只保留单条分隔线；想法列表底部不再额外留出一行空白。
- 首页 composer 下方提示文案改为可点击按钮，点击时用当前 draft 直接创建会话并跳 `/chat`；`frontend/src/pages/site/conversation.tsx` 移除邮件 CTA。
- 验证：前端 `check`、`lint`、`build` 通过；Chrome 实测首页提示点击进入 `/chat/:id` 且输入清空；真实 GLM/DeepSeek 回答「简历」时显示「查看简历」入口，回答中不再输出 `/resume`；390 宽无横向溢出。
- 未提交/推送/部署；后端 prompt 改动随 dev watch 生效。

## 2026-11-24：滚动条改为默认淡灰、hover 淡蓝（本地已验证）

- 用户反馈滚动条太丑，要求默认淡灰色、hover 淡蓝色。
- `frontend/src/styles/global.less`：浅色 `--theme-scrollbar:#d9d9d9`、`--theme-scrollbar-hover:#93c5fd`；深色 `--theme-scrollbar:#3f3f3f`、hover 同为 `#93c5fd`；仍为 6px、透明 track、圆角 thumb，Firefox 用 `scrollbar-color` 兜底。
- 验证：Chrome 计算值确认 light thumb `rgb(217,217,217)`、dark `rgb(63,63,63)`；`::-webkit-scrollbar-thumb:hover` 规则为 `#93c5fd`。前端 check/lint/build 通过；未提交/推送/部署。

## 2026-11-24：公开对话 API 资源化 + MobX 请求去重（本地已验证）

- 用户反馈（m03562）：`/chat` 首次打开会重复请求 `GET /api/site-chat/conversations`，且 `/api/site-chat/stream` 不像资源接口。
- 后端路由改为资源式：`POST /api/site-chat/conversations` 创建会话并发送首条消息；`POST /api/site-chat/conversations/:conversationId/messages` 追加消息；两者都返回 SSE。删除 `POST /api/site-chat/stream`；`PublicChatDto` 移除 body 里的 `conversationId`，路径是唯一来源；`SiteChatController` 抽 `streamTurn()`，非法/越权会话统一 404。
- 前端 `frontend/src/api/site-chat.ts` 按 `conversationId` 选择上述路径，body 只发 `{message, requestId}`；`frontend/src/store/site-chat.ts` 新增 `initialize()`，`loadStatus/loadList/open` 做 in-flight + 1 秒缓存去重，移除 `send()` 内所有 `loadList()`，改由 `start`/`done` 事件在 MobX 本地插入或更新会话摘要；`ChatPage` 只调用一次 `initialize()`。
- 验证：`site-chat` + `site-chat-history` 23/23；全量后端 180/180、13 套件；前端 check/lint 通过。Chrome 实测 `/chat` 首次仅 1 次列表请求；首条发送走 `POST /conversations`，追加走 `POST /conversations/:id/messages`；同一 visitor 下详情只请求 1 次，发送后不再额外拉列表。前端 `check`/`lint`/`build` 通过；全量后端 180/180、13 套件。
- 未提交、推送或部署；工作区既有 resume/主题/队列改动保留。

## 2026-11-24：公开对话改为 GLM 优先、DeepSeek 备用（本地已验证）

- 用户要求（m03372）：「优先 GLM 失败或错误再切换deepSeek」；后台默认模型同步回到 GLM，不再因为配置了 DeepSeek Key 而默认 DeepSeek。
- `backend/src/chat/config/chat.config.ts`：`glm-4.7-flash` 的 `fallbackModelId` 在有 `DEEPSEEK_API_KEY` 时指向 `deepseek-flash`，否则仍为 `glm-4-flash-250414`；`catalog().defaultModelId` 优先 GLM，其次 DeepSeek，最后 GLM。
- `backend/src/site/chat/site-chat.service.ts`：`PreparedPublicChat` 增加 `fallback`；`availableModels()` 优先 GLM，DeepSeek 只作为备用；`stream()` 仅在首个 token 前失败、或正常结束但没有任何正文时切换，已输出正文后不重试。`backend/src/site/chat/site-chat.repository.ts` 新增 `switchModel()`，把同一轮次的 modelId 更新为实际模型。
- `backend/src/site/chat/agent/site-chat.models.ts`：`ChatOpenAI` 与 `ChatDeepSeek` 均设 `maxRetries: 0`；否则 LangChain 默认重试会把 GLM 500 拖到超时，备用来不及启动。
- 测试：`backend/test/site-chat.e2e.test.mjs` 改为「GLM/DeepSeek 同时配置时仍优先 GLM」，新增「GLM 首 token 前 500 时切 DeepSeek 完成同一轮」（GLM 1 次、DeepSeek 1 次、落库 modelId 为 deepseek-flash、max_tokens 700、thinking disabled）。`site-chat.e2e.test.mjs` 10/10；全量 `MONGODB_URI=mongodb://127.0.0.1:27019/nest_test_base npm test` 180/180、13 套件；`npm run build` 通过。
- 文档：README、`backend/.env.example`、SPEC-010、SPEC-000 与实现计划同步为 GLM 优先、DeepSeek 备用；公开页/后台默认模型文案一致。
- 真实请求：GLM 直连返回 `429 / 1305`；公开流自动切到 `deepseek-flash`，SSE `start/delta/done` 正常，落库 `turn.modelId=deepseek-flash`，确认备用链路生效。
- 仍在 dev watch 运行期间误执行 `npm run build`，再次触发 `dist/main` 缺失与 3000 端口断开；已停止旧 watch，最终验证后单独重启。未提交、未推送、未部署。

## 2026-11-24：全站 API 错误改为统一 tips，502 后端恢复（本地已验证）

- 用户反馈（m03171）：服务 502；页面错误提示必须使用统一拦截和 tips，不允许在页面内显示。
- 后端 502 根因：`nest start --watch` 运行期间又执行了 `npm run build`，build 重写 `backend/dist`，watch 重启时找不到 `dist/main` 与 `dist/site/config/site.defaults.js`，同时残留进程抢占 `127.0.0.1:3000`。已停止旧 watch job，清理 3000 端口，确认 SSH 隧道 `nest-db` 可用，重启 dev watch（job `bash-1fcdec24710f4b9d`）；`GET /api/site` 与 `/api/site-chat` 均 200。教训：dev watch 运行期间不要并行 build。
- 新增 `frontend/src/utils/error-tips.ts`：全站错误提示总线，同一文案 2 秒内去重，订阅者未挂载时暂存一条。
- 新增 `frontend/src/components/api-tips/index.tsx`：用 Ant Design `message.useMessage()` 渲染统一 tips；`frontend/src/App.tsx` 在 `ConfigProvider` 内挂载。
- `frontend/src/api/http.ts`：网络异常、429、5xx 与非 JSON 响应统一 `notifyError`；`frontend/src/store/site-chat.ts` 的 `loadStatus/loadList/open/send/remove` 也统一走 tips，移除 `notice` 状态。
- 移除公开页内联错误：`frontend/src/pages/site/index.tsx` 的 `errorBanner`、`frontend/src/pages/chat/index.tsx` 的连接/内容/notice/turn error 文案、`frontend/src/pages/resume/index.tsx` 的加载失败块、`frontend/src/pages/site/conversation.tsx` 的 `status==='error'` 提示；后台表单字段校验与任务页面原有错误流程未改。
- `frontend/src/styles/global.less` 增加 `.api-error-tip` 主题样式：浅色黑底白字、深色白底黑字，与全站黑白主题一致。
- 验证：`npm run check`、`npm run lint`（0 warnings/0 errors，87 files）、`npm run build` 通过；Chrome 拦截 `/api/site*` 返回 502 时页面顶部出现统一 tips，公开页不再出现“内容加载失败/连接对话服务失败”内联文案；浅色、深色 tips 计算色分别为 `rgb(11,11,11)/rgb(255,255,255)` 与 `rgb(242,242,242)/rgb(10,10,10)`；截图 `/tmp/nest-api-tip-light.png`、`/tmp/nest-api-tip-dark.png`、`/tmp/nest-api-tip-chat.png`。后端未改，沿用限流修复后的 179/179。
- 未提交、未推送、未部署。

## 2026-11-24：公开对话限流日总量改为按请求计数（本地已验证）

- 问题：`site-chat.service.ts` 用 `consume(ip) ?? consume(visitor)` 调用两次；`consume()` 每次成功都 `daily += 1`，导致一次正常请求日总量加 2，默认 200 实际约 100 次；被 visitor 桶拒绝的请求还会只扣 1。
- 修复：`backend/src/site/chat/site-chat.limiter.ts` 的 `consume(keys: string[])` 改为一次检查 IP/visitor 全部桶，任一超限直接返回且不写入；全部通过后统一写入各桶，并只 `daily += 1`。`backend/src/site/chat/site-chat.service.ts` 改为传入 `[sha256(ip), visitor:${visitorHash}]` 数组，不再用 `??` 串两次调用。
- 测试：`backend/test/site-chat.e2e.test.mjs` 新增「日总量按请求计数一次，达到上限后返回429」：`SITE_CHAT_RATE_LIMIT=100`、`SITE_CHAT_DAILY_LIMIT=2`，前两次 200，第三次 429 `SITE_CHAT_RATE_LIMITED` 且 `retryAfter>=1`、上游只调用 2 次。旧实现第一次请求即把日总量加到 2，该用例会失败。
- 验证：后端全量 `MONGODB_URI=mongodb://127.0.0.1:27019/nest_test_base npm test` 179/179、13 套件；前端未改。未提交、未推送、未部署。

## 2026-11-24：首页对话改为固定高度文本域 + 新建会话跳转（本地已验证）

- 用户要求（m02907）：首页点击发送或建议问题时，直接创建一条新会话并跳转到对话页生成，不在首页内联生成；随后（m03078）要求文本域固定高度、支持内部滚动，并把全局滚动条统一为 6px 天蓝色、hover 灰色。
- 已实现：`frontend/src/pages/site/conversation.tsx` 使用固定高度 `<textarea rows={3}>`（`height:78px`、`resize:none`、`overflow-y:auto`），只负责收问题；发送/Enter/建议问题调用 `setPendingPrompt()` 后 `navigate('/chat')`。Shift+Enter 换行。新增 `frontend/src/pages/site/chat-pending.ts`（sessionStorage + 内存降级）传递一次待发送问题。
- `frontend/src/pages/chat/index.tsx` 在 `/chat` 状态 ready 后读取 pending，延迟一拍避开 StrictMode 双挂载，再调用 `siteChatStore.send()`；start 后 URL 替换为 `/chat/:id`。删除已无引用的 `frontend/src/pages/site/use-site-chat.ts`。
- `frontend/src/styles/global.less` 增加 `--theme-scrollbar:#38bdf8`、`--theme-scrollbar-hover:#9ca3af` 与全局 `*` 滚动条规则：6px 宽/高、透明 track、圆角天蓝 thumb、hover 灰；Firefox 用 `scrollbar-width:thin` + `scrollbar-color`。
- 验证：Chrome 实测 `tagName=TEXTAREA`、`clientHeight=78`、`scrollHeight=235`、`overflowY=auto`、`::-webkit-scrollbar` 宽 `6px`、thumb `rgb(56,189,248)`；点击发送与建议问题都跳到 `/chat/:id`，真实 DeepSeek 返回并落库；390 宽无横向溢出；截图 `/tmp/nest-chatcard-scroll.png`、`/tmp/nest-chatcard-new.png`、`/tmp/nest-chatcard-mobile.png`。前端 check/lint/build 通过；后端未改，沿用 178/178。未提交、未推送、未部署。

## 2026-11-24：移除关于页与 03 ABOUT 分区（本地已验证）

- 用户要求（m02848）：「这个内容和页面要去掉」；截图为首页 `03 ABOUT / 把复杂的事做简单。` 区块。
- 已删除：`frontend/src/router/index.tsx` 的 `/about` 路由；`frontend/src/pages/site/index.tsx` 的 `03 ABOUT` 分区、`about` 分区文案/引用/能力 chips/公司项目弹层/联系行；首页与简历页导航的「关于」；`SiteExperience` 的 `capabilityPreview` 预览参数及滚动逻辑；`frontend/src/pages/site/home.module.less` 中仅该区使用的 about/capability/project 样式。`/about` 由通配路由回退到 `/`。
- 保留：后台「能力资料」编辑数据（作为 AI 上下文/未来内容），公开页不再展示；后台预览不再滚到关于区。
- 验证：前端 `npm run check`、`npm run lint`（0 warnings/0 errors，85 files）通过；Chrome 首页 1440 宽 `scrollHeight≈3094`，导航为想法/作品/简历，`#about` 不存在，`/about` 最终路径 `/`；截图 `/tmp/nest-home-no-about.png`。后端未改，沿用 178/178。未提交、未推送、未部署。

## 2026-11-24：简历文档式排版与主页风格统一（本地已验证）

- 用户要求（m02698）：「有点丑啊 能不能设计成docx文档那种 支持转PDF」；随后（m02724）指出「而且你简历页面和主页风格不一致啊」。
- 公开页：`frontend/src/pages/resume/index.tsx` + `frontend/src/pages/resume/style.module.less` 改为 A4 文档式纸张；顶部复用首页 HEY. 品牌、想法/作品/简历/关于导航、ThemeToggle，右侧「导出 PDF」；纸张随主题（浅色白纸、深色深纸），打印时强制白底黑字。`@page size:A4`、`window.print()` 导出；`PDF 附件` 保留原上传文件。
- 首页：`frontend/src/pages/site/index.tsx` 顶部导航与页脚增加「简历」入口，指向 `/resume`。
- 验证：`npm run check`、`npm run lint`（0 warnings/0 errors，85 files）、`npm run build` 通过；后端 `MONGODB_URI=mongodb://127.0.0.1:27019/nest_test_base npm test` 178/178、13 套件。Chrome 1440/390/320 无横向溢出，浅色/深色、sticky 正常；`Page.printToPDF` 导出 `/tmp/nest-resume-export.pdf` 3 页、约 654K；截图 `/tmp/nest-resume-unified-light.png`、`/tmp/nest-resume-unified-dark.png`、`/tmp/nest-resume-unified-mobile.png`。
- 未提交、未推送、未部署；真实站主登录后的后台保存/预览与正式域名未验证。

# 工作区交接状态

## 2026-11-24：可配置结构化简历（本地已验证）

- 用户要求（m02518）：「这个后续可以做为一个小demo来实现项目作品。先不管。我们需要先完善简历页面。也是一样需要统一UI样式 这是我的简历。这个页面我希望可以做出可配置的。可以方便站主随时更换更新简历。@/Users/awei/Desktop/李武伟简历-5年.pdf」。
- 数据：`frontend/src/types/site.ts`、`backend/src/site/types/site.type.ts` 的 `resume` 新增可选 `summary/meta/skills/experience/projects/education`；`backend/src/site/dto/save-site.dto.ts` 增加对应嵌套 DTO 与 `TextList` 上限。旧 `{name,role,body,pdfUrl}` 仍可读写；`backend/src/site/site.service.ts` 的 `cleanResume()` 会剔除可选字段的 null/undefined，避免旧编辑器写入 BSON null 导致读取失败。
- 后台：`frontend/src/pages/admin/fields.tsx` 新增 `LinesField`；`frontend/src/pages/admin/editors.tsx` 的简历分区支持技能组、工作经历、项目经历、教育经历、补充 Markdown 与 PDF。
- 公开页：`frontend/src/pages/resume/index.tsx` + `frontend/src/pages/resume/style.module.less` 重写为与首页一致的黑白编辑版式（sticky masthead、RESUME 眉题、大号姓名、CONTACT/PDF、01–04 分区、页脚），无结构化内容时回退 Markdown；深色/移动端/打印已验证。该版式后续已被顶部「简历文档式排版与主页风格统一」条目的 A4 文档式排版取代。
- 数据：站点 version 11，写入真实简历（6 个技能组、2 段工作、4 个项目、1 条教育），`contact.email=IUya0929@163.com`，PDF 写入 `backend/.data/site-assets/cfc300e3-7e3f-4501-a133-34df46e98745.pdf`；备份 `/tmp/site-content-backup-before-resume.json`。
- 验证：后端 `MONGODB_URI=mongodb://127.0.0.1:27019/nest_test_base npm test` 178/178、13 套件；`site.e2e.test.mjs` 35/35（新增结构化字段保存/公开/非法条目拒绝）；前端 `npm run check`、`npm run lint`（0 warnings/0 errors，85 files）、`npm run build` 通过。Chrome 1440/390/320 无横向溢出，深色/浅色、sticky 与打印样式通过；截图 `/tmp/nest-resume-light.png`、`/tmp/nest-resume-dark.png`、`/tmp/nest-resume-mobile.png`、`/tmp/nest-resume-mobile-dark.png`。
- 未提交、未推送、未部署；真实站主登录后的后台保存/预览与正式域名未验证。

## 2026-11-24：公共确认弹窗（AntD，本地已验证）

- 用户要求（m02420）：「这个弹窗前端接入 antd 自主封装实现一个公共的弹窗 要和主题保持一致」；截图显示 `/chat` 删除会话仍使用浏览器原生 `window.confirm`。
- 新增 `frontend/src/components/confirm-dialog/index.tsx` + `style.module.less`：`ConfirmProvider` 在 `frontend/src/App.tsx` 的 `ConfigProvider` 内挂载，导出 `useConfirm(options) => Promise<boolean>`；用 AntD `Modal` 承接焦点/遮罩/键盘/Esc，标题、正文、按钮、关闭图标全部走 `--theme-*` 变量，主按钮黑白反色、次按钮透明描边，圆角胶囊；`ConfigProvider` 增加 `button={{ autoInsertSpace: false }}`，避免「取消/删除」被插入空格。
- `frontend/src/pages/chat/index.tsx` 的删除处理改为 `await confirm({ title:'删除这段对话？', description:'删除后无法恢复。', confirmText:'删除' })`，确认后调用 `siteChatStore.remove`；取消不删，删除当前会话回 `/chat`。
- 验证：前端 `npm run check`、`npm run lint`（0 warnings/0 errors，85 files）通过；Chrome 实测原生 dialog 不再出现，AntD 弹窗 light `rgb(255,255,255)/rgb(11,11,11)`、dark `rgb(17,17,17)/rgb(242,242,242)`，取消保留会话、确认删除并回 `/chat`，390 宽度无横向溢出；截图 `/tmp/nest-confirm-light.png`、`/tmp/nest-confirm-dark.png`、`/tmp/nest-confirm-mobile-dark.png`。
- 未提交、未推送；前端 `npm run build` 通过（新增 modal chunk），后端未改。

## 2026-11-24：公开对话历史、多会话与 LangGraph Agent（本地已验证）

- 用户要求（m01564）：「会话历史呢。咱们的架构是。 前端点击发送。调用后端接口。此时后端保存当前会话和当前消息。要支持多历史记录啊。 请你先设计一下agent架构。我想使用 LangGraph / langchain。」；m01640 明确接受浏览器 `localStorage` 匿名标识，不做登录/跨设备；m01797「开始执行」。依据 [SPEC-011](../specs/011-site-chat-history.md) 与 `docs/superpowers/plans/2026-11-24-site-chat-history-agent.md`。此条取代本文件同日两条里的“公开对话不持久化/无历史”边界。
- 后端：新集合 `site_chat_conversations`（单文档内嵌 `turns`，`visitorHash` 索引、`expiresAt` 30 天 TTL、20 会话/100 轮上限、`activeUntil` 锁）；`X-Visitor-Id` 只接受 UUID v4 并 SHA-256 入库；`GET/DELETE /api/site-chat/conversations`、`GET /conversations/:id`；`POST /api/site-chat/stream` 先写用户轮次，SSE `start/delta/done/error/ping`，30 秒空闲 ping（`SITE_CHAT_PING_MS`），每 500ms 持久化部分正文，断连写 `canceled`，上游失败写 `failed`，重复 `requestId` 幂等重放。公开对话从自定义 provider 切到 LangChain `ChatDeepSeek`（GLM 回退 `ChatOpenAI`）+ LangGraph `START → loadConversation → buildContext → agent → END`；Mongo turns 为唯一事实来源，不用 checkpointer。owner chat 不迁移。
- 前端：`frontend/src/utils/visitor.ts` 提供 localStorage → sessionStorage → 内存的 visitor UUID；`frontend/src/api/site-chat.ts` 带 `X-Visitor-Id`、解析 `start/delta/ping`、45 秒 watchdog；新增 `frontend/src/store/site-chat.ts` 管理列表/活动会话/轮次/发送/停止/删除/新对话；`/chat` 与 `/chat/:conversationId` 共用页面，历史侧栏、当前项、删除确认、移动端抽屉；首页对话卡开始落库，「打开完整对话」带当前 ID。
- 验证：后端全量 `MONGODB_URI=mongodb://127.0.0.1:27019/nest_test_base npm test` 177/177、13 套件；`site-chat-history` 13/13、`site-chat` 8/8；前端 `npm run check`、`npm run lint`（0 warnings/0 errors，84 files）、`npm run build` 通过。Chrome 实测历史列表/详情/刷新恢复/删除当前回到 `/chat`/停止生成；390、320 宽度 `scrollWidth` 等于视口；真实 DeepSeek 经 LangGraph 返回并落库（截图 `/tmp/nest-chat-history-desktop.png`、`/tmp/nest-chat-history-mobile.png`、`/tmp/nest-chat-history-active.png`、`/tmp/nest-chat-mobile-topbar.png`）。
- 分支与提交：`feat/site-chat-history-agent`；Task 1 `b7e2ec0`、Task 2 `f98bd75`、Task 3 `d54511a`/`d3f76be`、Task 4 `ac41a38`、Task 5 `69cd440`。未推送、未部署；文档随 Task 6 一并提交。工作区原有 resume/queue/tasks 等改动保留。
- 安全：本机 `backend/.env` 的 DeepSeek Key 权限 600、已被 Git 忽略；该 Key 曾在对话中明文出现，仍建议在 DeepSeek 控制台撤销并轮换，新 Key 只写 `.env`。真实发布前需核对 Nginx `proxy_buffering off` 与 `proxy_read_timeout`。

## 2026-11-24：首页对话卡优化与 DeepSeek 接入（本地真实请求已验证）

- 用户要求（m01232）：「不弄主题了把这个优化一下 并接入DeepSeek api」。停止配色/主题探索，保留现有黑白主题，只改首页对话卡与公开对话模型。
- UI：`frontend/src/pages/site/conversation.tsx` 改为两栏编辑布局，左侧标题/说明/完整对话入口，右侧浅表面板；去掉外框与重阴影、胶囊建议按钮与装饰火花，空态左对齐，建议问题改为两列文字行，新增 `chatState`（连接中/在线/回答中/离线）。`frontend/src/pages/site/home.module.less` 同步重写 `.conversation`/`.chatCard`/`.chatEmpty`/`.composer`/`.suggestions` 及 900/600 断点。截图 `/tmp/nest-chatcard-new.png`（1440）、`/tmp/nest-chatcard-mobile.png`（390）、`/tmp/nest-chatcard-live.png`（真实回答）、`/tmp/nest-chat-live.png`（`/chat` 真实回答）。
- 旧规则（已被本页顶部「公开对话改为 GLM 优先」取代）：`backend/src/chat/config/chat.config.ts` 在存在 `DEEPSEEK_API_KEY` 时加入内置模型 `deepseek-flash`（`https://api.deepseek.com`，非思考模式），未配置时不出现、保持旧 GLM 白名单数量；`backend/src/site/chat/site-chat.service.ts` 优先选 DeepSeek，未配置回退 GLM；`backend/src/chat/providers/chat-completions.provider.ts` 增加 402 额度错误。`backend/.env.example` 增加 `DEEPSEEK_API_KEY` / `DEEPSEEK_BASE_URL` 说明。
- 旧测试（已改名）：`backend/test/site-chat.e2e.test.mjs` 新增「配置 DeepSeek 时优先 deepseek-flash、未配置保持 GLM」，并还原 `ConfigService.set` 写入的 `process.env`，避免后续用例串上游；全量 `MONGODB_URI=mongodb://127.0.0.1:27019/nest_test_base npm test` 164/164、12 套件；前端 check/lint/build 通过。
- 用户已在本机 `backend/.env` 配置 `DEEPSEEK_API_KEY`（文件权限 600，已被 Git 忽略，未入库）；重启后 `ChatConfig.catalog().defaultModelId` 为 `deepseek-flash`，公开对话真实 SSE 返回 delta 与 done，前端 `/chat` 与首页对话卡均拿到完整回答。该 Key 曾在对话中明文出现，按安全流程应尽快在 DeepSeek 控制台撤销并换新 Key，再只写入 `.env`。未提交、未推送、未部署；站点数据仍 version 10。

## 2026-11-24：黑白主题与黑夜/白天切换（本地已验证）

- 用户要求（m00930）：「我希望你在黑白配色。可以切换黑夜/白天模式。」公开页面改为纯黑白灰，不再保留奶油/橄榄/橙色；新增主题开关，覆盖首页/分区页、`/chat`、`/resume`。
- 主题实现：`frontend/src/styles/global.less` 提供 `--theme-*` 变量（light `#ffffff/#0b0b0b`，dark `#0a0a0a/#f2f2f2`）；`frontend/src/components/theme-toggle/index.tsx` 切换 `<html data-theme>` 并写 `localStorage['nest-theme']`，无保存值时跟随 `prefers-color-scheme`；`frontend/index.html` 内联脚本在 CSS 前设置主题，避免闪烁。首页 header、`/chat` 顶栏、`/resume` masthead 均挂开关。
- 样式范围：`frontend/src/pages/site/home.module.less`、`frontend/src/pages/chat/style.module.less`、`frontend/src/pages/resume/style.module.less`、`frontend/src/components/site-markdown/style.module.less`（`.paper`）、`frontend/src/components/chat-markdown/style.module.less` 全部改为中性主题变量；想法弹层、对话成功/错误/空态、简历与 Markdown 深色可读；打印样式固定白底黑字。
- 验证：前端 `npm run check`、`npm run lint`（0 warnings/0 errors）、`npm run build` 通过；Chrome light/dark 计算色分别为 `rgb(255,255,255)/rgb(11,11,11)`、`rgb(10,10,10)/rgb(242,242,242)`；截图 `/tmp/nest-home-light.png`、`/tmp/nest-home-dark.png`、`/tmp/nest-chat-light.png`、`/tmp/nest-chat-dark.png`、`/tmp/nest-chat-success-dark.png`、`/tmp/nest-thought-dialog-dark.png`、`/tmp/nest-resume-light.png`、`/tmp/nest-resume-dark.png`；390×844 移动端首页/对话无横向溢出。后端未改，沿用 163/163。
- 数据与交付：站点内容仍为 version 10，未改数据库；未提交、推送或部署；工作区原有 resume/queue/tasks 改动保留。

## 2026-11-24：编辑式首页、真实路径与独立对话页（本地已验证）

- 用户要求把官网改成 zhiqiang.chat 式页面（核心思想、项目链接、对话式回答）；依据 [SPEC-010](../specs/010-editorial-home.md)，基准 `65f01df` 加当前工作区改动。旧 `SiteEntryProvider/SiteIntro` 不再挂在 `/`，首页直接显示浅色编辑排版；新增 `/thoughts`、`/works`、`/about` 真实路径（复用首页内容并滚动到分区）与独立 `/chat` 对话页，`/conversation` 重定向 `/chat`；`/resume`、后台简历与附件合同不变。
- 新数据分区 `thoughts/works/chat`：想法 12 条（Markdown 正文、显隐）、作品 12 条（站内/外链、封面、显隐、首条大卡）、对话设置（开关、标题/介绍/占位、最多 3 条建议、补充提示词）。公开读只保留 `visible`，`chat.systemPrompt` 公开响应清空；旧 Mongo 缺失分区只读补默认，PUT 仍要求完整分区。后台新增「想法笔记/作品链接/对话设置」，预览按 `focus` 滚动，`work-cover` 上传复用现有媒体。
- 公开对话：`GET /api/site-chat` 与匿名 `POST /api/site-chat/stream`（手动 SSE `delta/done/error`），不挂 Session/Owner/CSRF，不持久化；按 SHA-256(IP) 内存限流默认 8 次/10 分钟、UTC 日 200，模型固定短答 `max_tokens=700`、45 秒超时，提示词只含公开资料并过滤隐藏想法/作品。单实例内存限流、无审核/多轮持久化是当前边界。
- 对话页：`frontend/src/pages/chat/index.tsx` 与 `frontend/src/pages/site/use-site-chat.ts` 共享会话逻辑；桌面侧栏 + 空态建议卡 + 消息线程 + 固定 composer，移动端单列；消息只在当前标签页内存，新对话即清空。「新对话」不再因空会话禁用，发送受理后立即清空输入；失败保留错误提示。
- 验证：后端 `MONGODB_URI=mongodb://127.0.0.1:27019/nest_test_base npm test --prefix backend` 163/163、12 套件（含 build）通过，新增 `backend/test/site-chat.e2e.test.mjs` 7 项；前端 `npm run check`、`npm run lint`（0 warnings/0 errors）、`npm run build` 通过。Chrome 1440×1100 整页与 CDP 390×844 实际渲染，`scrollWidth` 分别等于视口，无横向溢出；想法弹层、作品卡、对话卡与后台预览聚焦可用。真实模型浏览器实测本轮返回 429，前端正确显示「模型有点忙，请稍后再试。」，不宣称真实回答成功；fixture SSE 已覆盖成功路径。
- 路由与 UI：首页导航与页脚改用 `NavLink/Link`；`/works` 等路径在内容加载后滚到对应分区，吸顶导航在 `overflow-x: clip` 下正常，当前分区有 `aria-current` 下划线；hero「往下看看」按钮重置了浏览器默认样式。
- 数据：本地隧道所连站点内容 version 7→10：`profile.tagline`、`home` 已更新，默认作品 `site-chat` 从 `/#conversation` 改为 `/chat`；备份 `/tmp/site-content-backup.json`、`/tmp/site-content-backup-before-chat-route.json`。期间一次直接改 `updatedAt` 为字符串导致 Mongoose CastError，已恢复为 Date 并清掉被误写成空数组的 `content.works`，读时补回 3 个默认作品。未提交、推送或部署；工作区原有 resume/queue/tasks 等改动保留。真机软键盘、Safari/Firefox、多实例限流未验证。

## 2026-11-16：首页入口与公开简历页（本地已验证）

- 基准 `65f01df`，[SPEC-008](../specs/008-public-resume.md)。首页导航和首屏主按钮直达 `/resume`，旧能力场景和直达面板在公开首页隐藏。后台「简历」编辑姓名、岗位、Markdown 和 PDF，复用版本化保存、隔离预览与附件下载；旧能力资料保留站主编辑和预览。旧 API 调用方保持现有响应格式。
- 后端 152/152，前端 lint/build/diff 检查通过。Chrome 1440×960、320×568、390×844 验证入口、空态、错误重试、正文、权限编辑、草稿隔离、预览及附件下载/替换/移除。独立审查的问题已修正。
- 已将提供的 `mdContent` 整理至本地预览，保留邮箱及职业信息，原稿中的手机、出生年份、性别与薪资未进入网页。隔离预览保留 `127.0.0.1:5173/resume`、后端 3000 和 `nest-resume-mongo` 27019，验收 PDF 已清理。真实 PDF 待提供，未触及正式数据，无提交、推送或部署。

## 2026-11-16：首页网页简历调研

- 基准 `65f01df`。已核对首页双场景、公司与项目详情、公开配置类型及 [PDF 上传下载合同](../specs/004-disk-file-uploads.md)，并对照 [Brittany Chiang 首页](https://brittanychiang.com/) 和 [Bama Charan Chhandogi 简历页](https://www.bamacharan.com/resume) 的内容结构。
- 当时建议首页首屏突出姓名、岗位与简历入口，下面用网页正文展示经历和代表项目，PDF 复用现有附件下载。该轮只核对资料与源码，随后按用户决定改为独立简历页。

## 2026-11-14：手机修复（已上线并复验通过）

- 用户授权修复M-01至M-07并在验证后提交、推送、部署；基准`a6c7db9`，合同[SPEC-007](../specs/007-ui-clarity.md#手机复查修复2026-11-14)。导航层级/手机内容流和预览滚动、任务入口与点击范围、冗余装饰说明均已调整；不改API、模型或依赖。
- 最终前端lint/build/diff通过，已有Node回归55/55，独立审查无可确认P1/P2。Chrome320/390短屏实际命中、登录、长文案/预览/反向、任务创建18→19及编辑/取消和1440两栏通过。[整合记录](tasks/007-mobile-fix-integration.md)、[审查](tasks/007-mobile-fix-review.md)、[后台](tasks/007-mobile-admin-fix.md)、[任务](tasks/007-mobile-tasks-fix.md)、[环境](tasks/007-mobile-fix-fixture.md)。
- 功能`9ea3d20`已推送main，[Actions 43592797262](https://github.com/awei0929/awei-fullstack/actions/runs/43592797262)三job成功，CI后端150/150、部署24/24、前端lint/build通过。[发布记录](tasks/007-mobile-fix-deployment.md)：首页/后台/任务和4入口静态资源匹配包内，正常TLS/健康检查通过，公开配置v7逐字节未变。
- Chrome线上320/390短屏菜单原重叠路径、实际入口、44px关闭、首屏按钮、后台精简及任务入口/按钮间距复验通过，任务仍18条；未写生产内容或调用模型。隔离前后端/模型/库/容器已清理，原27017保留，浏览器标签关闭、视口恢复。真机/软键盘/其他浏览器未覆盖，无剩余修复或部署待办；发布记录随本次docs-only提交归档（跳过CI）。

## 2026-11-14：线上手机复查（检查完成，发现待修复项）

- 用户要求再次检查线上手机布局/交互与冗余说明；基准`a6c7db9`，线上应用仍为`0b04b19`。Chrome320/390宽、568/667/740/844代表高度实际检查公开页、站主入口、后台/聊天/记忆和任务页，详细证据见[手机复查](tasks/007-mobile-production-audit.md)。
- 确认M-01/P2：矮屏能力场景下滚252px后，卡片盖住导航“进入空间”，实际点击误开项目；320/390×568中心命中复现，键盘进入正常，原因是header与卡片层级关系。另有矮屏首屏入口偏低、静态风格块/英文眉题/键盘说明冗余、小按钮及任务创建入口位置建议；后台窄屏保存栏未裁切。
- 本轮仅检查与记录，未改应用/生产内容，未运行测试或构建、未提交推送部署。现有站主登录保留，临时标签关闭、视口恢复，无截图；未验证真机软键盘或访客登录表单。

## 2026-11-14：历史文档整理与 P8 取消

- 用户决定不再接入新模型；[SPEC-006 P8](../specs/006-owner-sse-chat.md#p8更快免费主模型接入已取消2026-11-14)仅保留取消原因与现状，移除接入计划、验收待办及未提交调研草稿。现有GLM主备模型、自动切换和记忆保持，不再继续P8。
- 整理[本地连接线上数据库说明](../../README.md#本地连接线上数据库)，保留此前服务器部署/HTTPS、隧道连接、站主密码重置与飞书部署手册的完成记录；历史记录不表示本轮重新执行或验证。
- 用户已授权将这批文档提交并推送，基准`b519fa2`。文档差异检查、链接/锚点、脚本名称与忽略规则核对通过，P8无残留待办或失效研究链接。应用代码未变，未重跑测试、构建或浏览器验收；使用`[skip ci]`跳过重复部署。

## 2026-11-14：前端信息精简与交互打磨（已上线并验证）

- 用户要求按新 UI/UX 原则检查并修改当前前端；[SPEC-007](../specs/007-ui-clarity.md) 记录范围/设计/验收。沿用官网与聊天品牌，精简重复说明并打磨分组、布局和操作区。
- 基准 `8b263ad`；22个前端文件精修，最终lint/build/diff检查通过，聊天相关55/55回归通过；Chrome桌面/平板/390/320按范围验证目录/登录/草稿保护/预览/保存、聊天流/停止/失败/回退/历史/记忆与任务创建，独立审查重要问题已闭环。
- [整合验收与边界](tasks/007-ui-integration.md)、[公开页](tasks/007-public-ui.md)、[聊天](tasks/007-chat-ui.md)、[审查](tasks/007-ui-review.md)、[隔离环境](tasks/007-ui-fixture.md)。临时前后端/模型/库/容器已清理，原27017保留；测试标签关闭、视口重置。未新增真实模型、生产写入交互、多浏览器或真机软键盘验收。
- 用户追加授权后，沿用已验证源码与本地结果，功能`0b04b19`已推送main；[Actions 43560815456](https://github.com/awei0929/awei-fullstack/actions/runs/43560815456)三job成功，CI后端150/150、部署24/24、前端lint/build通过。线上首页/后台/任务入口及首页4个静态资源与发布包一致，正常TLS与公共接口通过，官网v7逐字节未变；[发布记录](tasks/007-ui-deployment.md)。仅提交本次规则/前端/验收文档，当时未纳入的README和历史记录在本轮文档整理中一并归档，P8已按用户决定取消；应用版本不变。

## 2026-11-14：前端 UI/UX 原则补充

- 按用户要求在 [AGENTS 入口](../../AGENTS.md) 增加 [前端 UI/UX 原则](../../AGENT.md#前端-uiux-原则) 引用，正文统一维护在 AGENT.md：减少不必要的辅助标签与说明，让布局表达内容关系，重视 UI/UX 打磨。
- 本次仅改规则与交接文档，基准 `8b263ad`；当时保留其他未提交文档，无应用代码变更。
- 已核对新增条文与前端交互约定一致，新增文件与章节链接有效，`git diff --check` 通过；纯文档改动未运行应用测试。

## 2026-11-13：AI对话整体重设计与流式调优（已上线，四轮验收完成）

- 用户选纸白阅读区＋深色导航，全权委托设计，授权3–5轮验收与部署；基准`5379a08`，合同[SPEC-006 P7](../specs/006-owner-sse-chat.md)。重做窄导航、白色AI阅读卡、用户便笺、输入/空态/历史/记忆浅色样式；旧回复独立订阅/memo，滚动按帧。
- 后端单在途阶段保存/合并快照消除消费await，终态等待保存并守护当前run不被过期恢复抢占；已关闭独立审查P1。注入120ms保存最大增量间隔122→23ms、成簇10→0，不是生产Mongo测量。官方备用基线首段356ms、441delta/782字、总14256ms，节奏仍有374ms间隔。
- 最终后端150/150、10套件含build，前端55/55、lint/build通过；审查P1/P2全闭环。R1桌面1440、R2平板768/390/320、R3长历史/连续与成批流/回退/断流/双429/停止刷新/记忆启停/草稿通过。修正退出裁切、浅色小字对比、原生帧API绑定，最终可见正文6→668→1300，停止刷新1338一致。
- [整合三轮](tasks/006-chat-redesign-integration.md)、[前端](tasks/006-chat-redesign-frontend.md)、[后端](tasks/006-stream-backend.md)、[诊断](tasks/006-stream-diagnosis.md)、[审查](tasks/006-chat-redesign-review.md)。测试账号退出、tab关闭/视口重置、27019专用容器及临时库移除，原3000watcher恢复，5173/27018保留；原README23行/STATE30行无关历史差异未混入。功能`529a742`已推送main，[Actions 43372961685](https://github.com/awei0929/awei-fullstack/actions/runs/43372961685)三job成功，健康通过、首页匹配发布包；[发布记录](tasks/006-chat-redesign-deployment.md)。R4真实4.7逐步输出至12条/345可见字符；下一轮自然429回退、停止14字符整页刷新一致。记忆面板2条均停用，官网v7逐字节未变；新增1会话/2轮合成记录保留。首字观察约7.7秒，免费模型节奏仍有限制。

## 2026-11-12：免费备用与429自动切换（已上线并验证）

- 用户追加免费备用模型与429自动切换；[SPEC-006 P6](../specs/006-owner-sse-chat.md)为合同。功能提交`8ffd678`已推送main，[Actions 43224243478](https://github.com/awei0929/awei-fullstack/actions/runs/43224243478)三个job成功：CI后端140/140、部署24/24、前端lint/build通过。线上首页与发布包一致，官网配置仍v7且逐字节未变。
- 仅4.7在尚无正文的可信上游HTTP429后尝试一次备用，共享上下文/记忆快照、轮次/幂等与总超时；原选和实际模型分别保存，前端明确显示。TDD后端140/140、9套件含build，前端51/51与lint/build通过；独立审查无P0/P1/P2。Chrome桌面/390/320切换→增量→完成、停止/刷新/旧历史/手选备用/错误恢复通过。
- 免费备用`glm-4-flash-250414`复用现有Key，无服务器凭据或Nginx变更。正式HTTPS Chrome三次自然429切换完成普通回答、跨会话随机记忆召回、停用后“未知”；另验主模型直接完成与手选备用的增量/停止，刷新保留实际模型、切换来源与停止正文。新增4会话/5轮及1条测试记忆保留，最终2条记忆均停用，未改官网配置；同平台仍可能共同繁忙。
- [生产发布验收](tasks/006-fallback-deployment.md)、[本地整合](tasks/006-fallback-integration.md)、[后端](tasks/006-fallback-backend.md)、[前端](tasks/006-fallback-frontend.md)、[审查](tasks/006-fallback-review.md)。本地27019隔离测试容器/库/媒体已清理，原3000/5173与27018隧道保留；Chrome留正式后台，站主登录保留。原README/STATE无关历史改动未混入提交。此前线上停用对照与停止受429阻塞的边界已补齐，持续稳定与独立供应商容灾未验证。

## 2026-11-12：AI对话与记忆发布（已上线，GLM间歇繁忙）

- 用户授权提交推送部署与线上验证；功能提交`a681b28`已推送main，[43217636096](https://github.com/awei0929/awei-fullstack/actions/runs/43217636096)三个job成功，CI后端126/126、部署24/24、前端lint/build通过。本地沿用已有126/40项、两轮页面与真实GLM证据，没有为提交重复测试。
- 线上Release=`a681b281e7a530da324f1ff0e6ce51cbbe9d3d7f-43217636096-1`；持久env已配置Key且600，Nginx聊天路由无缓冲/缓存、180秒读取超时。配置均备份，现有数据库/Session/站主/媒体保留；首页与发布包一致，公共配置仍v7且逐字节未变。
- 正式HTTPS Chrome普通对话成功且刷新保留；另一会话准确召回仅在记忆面板保存的随机代号。唯一测试记忆已停用；新会话停用对照及较长回复暂因429未获得可判定成功，不能声称线上全项验收通过。官方同机诊断429/1305“当前访问量过大”，Key/base/env链接与重启已核对；未自动换付费模型或改参数。
- [发布与实际验收](tasks/006-chat-deployment.md)、[SPEC-006](../specs/006-owner-sse-chat.md)。测试历史及停用记忆保留；待供应商恢复后补验线上停用对照、长流与停止。应用实现未因排障修改，原README/STATE的其他历史改动继续留在工作区。

## 2026-11-12：真实GLM与跨会话记忆（20:18–20:19实测成功）

- 用户要求重试真实模型；使用实际项目HTTP/SSE/记忆链路、官方GLM-4.7-Flash和独立27019随机测试库，不改现有聊天/记忆、源码、配置或依赖。
- A普通请求仍429/1305；10秒后B全新会话准确答出仅存于system记忆的随机代号，12个增量、596ms；停用后C另一个新会话仅user消息，回答“未知”，1103ms。D在第二个临时库补验普通问候成功，6个增量、1234ms。成功项均completed/error=null、delta与GET持久化一致。
- 真实链路当前可用，跨会话记忆与停用对照通过；首次繁忙说明仍可能间歇失败，未验证持续稳定、正式Nginx或其他供应商。详情：[真实验收](tasks/006-real-glm-verification.md)、[SPEC-006](../specs/006-owner-sse-chat.md)。
- 两个临时库已清理，剩余测试库计数0，--rm容器/临时运行器已移除；原3000/5173与27018保留。未提交、推送或部署；没有重复此前126/40项本地测试或两轮浏览器验收。

## 2026-11-12：AI聊天设计优化与跨会话记忆（两轮本地验收完成）

- 用户明确补记忆并优化UI；沿用`c6d19ff`原工作区，无提交/推送/部署。合同：[SPEC-006 P4/P5](../specs/006-owner-sse-chat.md)。
- HEY.橄榄/奶油工作区：历史侧栏/搜索、手机抽屉、底部输入、Markdown/代码表格/复制、建议预填、上翻保持位置与返回最新。官网未保存草稿保留。
- 仅站主的Mongo长期记忆：手动添加或回复“记住”，编辑/启停/确认删除，最多20×500码点；启用项发送到本轮模型并跨会话使用。超长回复保留全文手动摘录，无自动提炼/摘要。使用见[README](../../README.md#使用长期记忆)。
- 最终后端126/126、8套件含build；前端40/40、lint/build通过；独立审查三项P2已关闭。Chrome两轮覆盖1440/768/390/320、长内容/滚动/键盘/停止/失败恢复/记忆CRUD与刷新。修复保存焦点、当前会话误停及长内容辅助节点撑祖先导致页面偏移，原路径复验外壳scrollTop0，无横溢出。
- [整合/两轮证据](tasks/006-chat-ui-memory-integration.md)、[工作区](tasks/006-chat-ui-workspace.md)、[Markdown](tasks/006-chat-ui-markdown.md)、[记忆后端](tasks/006-chat-memory-backend.md)、[审查](tasks/006-chat-ui-memory-review.md)。只用27019隔离Mongo和本地模型fixture；测试会话退出、尺寸恢复，临时服务/容器/库/媒体已清理。
- 真实Key沿用此前本地配置，本轮未读取/调用；GLM仍有此前429/1305未成功边界，正式Nginx/真机软键盘/其他浏览器未验。默认后端3000已从build期间watcher缺入口恢复，models/memories匿名401、前端5173后台200，原27018隧道保留。可在本地/admin→AI对话使用，真实模型需平台恢复后再验证。

## 2026-11-12：GLM Key本地配置（已保存，平台暂时过载）

- 用户提供Key并明确授权代为配置。已仅在被Git忽略的backend/.env写入GLM_API_KEY，权限600；保留原数据库、Session、站主及其他配置，不记录密钥值。未配置或部署服务器环境。
- 直接使用项目已构建ChatConfig/ChatCompletionsProvider与官方接口验证，合成短消息不写Mongo：首次429，诊断一次20秒超时，随后响应HTTP429/业务码1305“该模型当前访问量过大，请您稍后再试”。未收到成功的正文或DONE，不能宣称真实对话已验证。
- 原本地服务与SSH隧道未运行；已恢复nest-db隧道并启动后端3000/前端5173。后端编译0错误并成功连接；只读GET公共任务200、匿名chat/models401、后台页面200。入口http://127.0.0.1:5173/admin，站主登录后进入AI对话，待平台恢复再手动发送。
- 应用源码未修改，沿用此前114项后端/15项前端与浏览器证据，未重跑整套测试或写入测试聊天。正式Nginx/上线仍未验证，无提交/推送。

## 2026-11-12：站主后台 SSE 对话（本地已验证，未部署）

- 用户授权免费GLM-4.7-Flash，明确仅站主后台可用；已在/admin增加AI对话，支持白名单多模型、历史、流式输出、停止与错误/中断恢复。合同：[SPEC-006](../specs/006-owner-sse-chat.md)。沿用c6d19ff与原工作区，未提交、推送、部署或改真实.env。
- Nest受控POST SSE + 原生fetch兼容模型、React/MobX、Mongo独立聊天历史，复用Session/Owner/CSRF；Key仅后端，官网草稿保留。修复受理时取消/断开两项竞态，无新增运行依赖。
- 后端114/114、7套件（聊天19项，含build）通过；前端15/15、lint无告警/build通过；独立审查无可复现P1/P2，另164项分块断言通过。Chrome桌面1920/手机390已验发送/部分停止/第二模型/失败/刷新/切会话/离开/普通账号拒绝/草稿保留/无横溢出。
- [整合记录](tasks/006-chat-integration.md)、[后端](tasks/006-chat-backend.md)、[前端](tasks/006-chat-frontend.md)、[审查](tasks/006-chat-review.md)。只用27019一次性Mongo和本地模型fixture；测试账号已退出，viewport恢复，3001/5174、临时库/媒体/容器已清理，原27017/27018与数据未使用。
- 下一步用户按[README](../../README.md#站主后台-ai-对话)申请智谱“模型标准API”Key，在backend/.env填写GLM_API_KEY并重启；真实GLM与正式Nginx未验证。当前本地默认数据库连线上，真模型测试前需明确数据环境；单实例范围，不支持多实例/后台续跑。

## 2026-11-12：SSE 对话可行性分析（历史，实施见SPEC-006）

- 按用户要求直接通过飞书桌面 App 阅读[实现图解](https://my.feishu.cn/wiki/TpTMwwPX2ibMVtkaArec53aFndd)，结合 `c6d19ff` 项目源码与官方协议资料判断：现有 Nest/React/MobX/Mongo 可增量支持流式聊天、历史与取消。
- 建议首版单体 Nest + Mongo，POST + fetch 读取 SSE，复用 Cookie/CSRF；聊天模块、模型接入、流解析和生成状态待新增。Redis/MQ、多智能体、长期记忆及后台续跑不作为首版必要条件；该范围仍是建议，未实施。
- 已核对当前安装 Nest 12.3.2 的 `@Sse` 可指定 POST；前端现有 request 等待整份 JSON，需独立流入口。模型服务/额度、开放对象、后台续跑要求待定；线上代理和真实流式行为未验证。
- 证据与边界：[分析记录](tasks/sse-chat-feasibility.md)。仅桌面阅读、源码/资料核对及文档回写，未运行服务/测试、访问数据库、改业务代码或提交部署；原 README/STATE 改动保留。

## 2026-11-10：上传功能发布（已上线并验证）

- 用户授权提交推送上线。17/17源码与既有验证相同，依赖/构建配置未变；沿用本机结果，81ef221实际推送触发[42761696989](https://github.com/awei0929/awei-fullstack/actions/runs/42761696989)全绿：后端95/95/6套件、部署24/24、前端lint/build，3份构建/部署日志与发布包可下载。
- 当前上线版本81ef221c1364567c930f354ed579e002621366b8-42761696989-1；Nginx备份后设置API25m并reload，持久目录ubuntu可读写。真实Chrome上传PNG/PDF/ZIP/2MiB文本与正文图片/附件，共6文件；匿名GET均200、SHA256一致、UTF-8中文下载名保留，正文图片64×64正常，Chrome实际PDF下载成功。
- 同版本受限入口重启后6文件仍可读、哈希不变。正文只在草稿预览后恢复，公开配置逐字节保持v7，原账号/env/Mongo/媒体保留。用户确认的临时浏览器本地文件权限已关闭。线上保存PUT/真机/多浏览器/精确最大边界未新增实操；六份公开合成验收文件保留，无自动清理。
- 合同/证据：[SPEC-004](../specs/004-disk-file-uploads.md)、[线上发布](tasks/004-disk-uploads-deployment.md)。发布代码与相关文档已提交推送，后续文档回写跳过重复CI；此前其他部署/飞书/数据库笔记仍保留在工作区，不对线上运行测试套件。

## 2026-11-10：自动构建部署（已接入并验证）

- 用户授权代为接入 main 推送后自动部署并交接步骤；合同/清单：[SPEC-005](../specs/005-automatic-deployment.md)，使用方式：[部署手册](../deployment.md)。基准9b12524，现有SPEC-004业务/文档改动保留且不纳入本次发布。
- production仅允许main，部署私钥仅环境Secret，连接Variables已设；用户完成腾讯云MFA并确认受限公钥。原隧道密钥、真实env/Mongo/媒体保留。发布根/srv/nest，systemd与Nginx共用current版本；首次bootstrap权限失败实际恢复旧站，修复重试成功。
- 当轮main推送d0c5ef6触发[42756174781](https://github.com/awei0929/awei-fullstack/actions/runs/42756174781)全成功：Node24.22.2、部署测试24/24、后端76/76与5套件、前端lint/build；3份构建/部署日志及发布包归档可下载。该轮成功版本d0c5ef6a96b09b584b6a9e2324c3a9f6b1bb42c6-42756174781-1，首页与归档逐字节一致、3资源/后台入口/API均HTTPS200；最新上传发布见上方。
- 已验证构建失败不发布、受限命令拒绝、手动回退当前bootstrap的幂等入口；不同目标回退/恶意输入/故障恢复/并发为隔离测试，未冒充线上故障注入。首次SSH上传约6分24秒、依赖安装3秒；CI Mongo有官方临时rseq兼容项。文档回写不改变已验证应用/依赖/工作流，沿用本次结果。
- 当轮仅发布自动部署配置，SPEC-004由用户后续追加授权发布，结果见上方。证据：[整合](tasks/005-deployment-integration.md)、[运行器](tasks/005-deploy-runtime.md)、[工作流](tasks/005-deploy-workflow.md)、[审查](tasks/005-deployment-review.md)。日常提交后推main并查看Actions；回退按部署手册，不自行发布其他未提交功能。

## 2026-11-09：飞书部署手册（已保存）

- 用户要求总结部署流程，并指定直接操作飞书 App。在已登录飞书的“我的文档库”新建[个人官网服务器部署与维护手册](https://my.feishu.cn/wiki/JQeHw48nGiH4KxkVS2Gcace7nXg)，已确认云端保存。12章、28个命令或配置代码块，覆盖首次部署、迁移、Mongo临时兼容项、systemd、Nginx、IP HTTPS续期、验收、日常发布备份、本地隧道及排障。
- 命令带中文注释，区分Mac/服务器及首次初始化/日常操作；不包含真实密码、Session密钥、私钥、哈希或完整真实连接串。明确以已上线9b12524为基准，含后续登录验证，未冒充线上保存/上传已验；并行SPEC-004仍按其单独发布流程处理。已核对飞书目录、关键代码换行、续期和发布命令、正文首尾与保存状态；没有修改其它文档、分享权限或服务器。保留现有代码和文档改动，不提交或推送。

## 2026-11-09：服务器磁盘文件上传（本机已验证，未部署）

- 用户授权图片、PDF、附件上传并告知流程；已确认全公开、仅站主可上传。沿用9b12524及当前分支，保留原README/STATE改动，无提交、推送、部署或真实env改动。合同：[SPEC-004](../specs/004-disk-file-uploads.md)。
- 新POST `/api/site/file-assets`复用Session/Owner/CSRF；图片5MiB、PDF/ZIP/TXT/DOCX/XLSX/PPTX附件20MiB，UUID写盘到SITE_ASSETS_DIR，附件保留安全原下载名并强制下载。旧音频和历史媒体兼容；后台统一上传、封面、公司/项目Markdown入口，上传仅改草稿，文件立即可公开访问。无COS、自动清理或私密下载。
- 后端最终95/95、6套件含build；前端实际模块68/68、Markdown SSR5/5、lint无警告/build通过；独立审查1项P2已修，限定复核58项通过。根Chrome156桌面1440/手机390实际上传/错误重试/中文下载/草稿/保存v3刷新/公开图片及附件/忙状态/10000字保留/重建应用后媒体持久化通过。证据：[整合](tasks/004-disk-uploads-integration.md)、[后端](tasks/004-disk-uploads-backend.md)、[前端](tasks/004-disk-uploads-frontend.md)、[审查](tasks/004-disk-uploads-review.md)。
- 全程测试显式使用原本机Mongo127.0.0.1:27017及随机临时库/媒体，未沿真实backend/.env连接线上。4个明确归属的浏览器fixture库、临时媒体/Cookie/样例/缓存已清理；3001/5174已停，原本机与线上业务数据保留，无截图。
- 下一步按[README接入流程](../../README.md#图片pdf与附件上传接入)发布：确认服务器持久目录与ubuntu读写、已有/api/代理加25m、构建/同步前端并重启后端，再做线上上传验证。服务器配置/HTTPS上传未在本轮实操，真机/多浏览器/断电边界未扩大声明。

## 2026-11-08：站主密码重置（已验证）

- 用户明确授权重置线上账号 55555 为其指定密码；通过已配置隧道仅更新该站主的 Argon2id passwordHash 与 updatedAt，应用 id、账号及官网内容保留。明文密码与哈希未写入项目文件、文档或输出日志。
- 已核对保存后的哈希验证成功，并定向撤销该账号 1 个旧登录会话。正式 HTTPS 接口实测：新密码登录 200、站主配置读取 200、官网仍 v6；随后测试会话退出 200。本地后端共用线上数据库，使用同一新密码；原独立本机数据库未在本轮修改。无应用源码改动、未运行集成测试、未提交或推送。

## 2026-11-08：本地项目切换线上数据库（已配置并验证）

- 用户授权本地项目改用线上数据库，并明确确认安装项目专用 SSH 公钥及将服务器连接信息同步至本机忽略配置。沿用 `9b12524`，保留上轮已有 STATE 修改，不提交、推送或改应用源码。
- 本机 `~/.ssh/config` 新增 `nest-db`，密钥 `~/.ssh/nest-mongodb-tunnel_ed25519` 私钥留本机；隧道 `127.0.0.1:27018 → 159.75.18.65 → 127.0.0.1:27017` 已在后台运行，可用 `ssh -O check nest-db` 检查、`ssh -fN nest-db` 建立。服务器公钥以 restrict/permitopen 限制正向目的地，禁止交互终端、agent/X11 和远程命令；保留原 authorized_keys 并备份。
- 本地 `backend/.env` 已改用服务器现有认证信息与隧道端口，仅更换 MONGODB_URI；原 SESSION_SECRET 与 SITE_OWNER_USER_ID 保留（站主应用 id 已比对一致），本地 NODE_ENV 未设 production。环境备份 `.local/db-connection/.env.before-remote` 权限 600 且被 Git 忽略；服务器及本机的一次性凭据传输文件均已删除，未输出密码或真实连接串。
- 原生 MongoClient 只读验证：隧道连接成功、ping 成功、`awei` 官网单例 v6、账号 55555 的应用 id 与服务器配置及本机原配置一致；改完后直接读取最终 `backend/.env` 再验证通过，文件权限 600、无进程环境变量覆盖、SESSION_SECRET 与备份相同、传输临时文件已删除。SSH 隧道仍运行，专用密钥远程命令执行按预期被拒绝。未启动 Nest 或写入业务数据，不对线上实例运行集成测试或站主初始化；本地后端下次启动即读取此连接。
- 使用方式与边界写入 [README](../../README.md#本地连接线上数据库)：本地写入会直接影响线上，Session/限流共享；媒体文件不会随数据库同步，正式媒体经线上后台上传。本地 MongoDB 和原数据保留用于回退；电脑重启或断网后需先重建隧道。独立只读复核未发现实质文档问题，`git diff --check` 通过；本轮仅 README/STATE 为跟踪文件改动。

## 2026-11-08：服务器部署与 HTTPS（已完成）

- 用户先逐步自行部署，随后授权代为配置 Nginx；已明确同意 Let’s Encrypt v1.8 协议、IP 证书测试/正式签发与自动续期，以及将 HTTPS 443 从单个来源 IP 扩大至所有 IPv4。部署代码基准 `9b12524`，本轮未改应用源码或重新提交/推送。
- 腾讯云 Ubuntu 26.04，服务器代码 `/home/ubuntu/apps/nest`；Node 24、Docker/Compose、Nginx 已安装。`nest-backend.service` 以 ubuntu 用户启动 `backend/dist/main.js`，仅监听 `127.0.0.1:3000`；MongoDB Compose 服务 `mongodb`、命名卷 `awei_mongodb_data`，仅映射 `127.0.0.1:27017`。真实环境文件留服务器、权限 600，不进入仓库。
- 用户原 `awei` 数据库备份已恢复（报告 0 文档失败），原站主以应用 `id` 关联，公开配置仍 v6；媒体恢复至 `/home/ubuntu/nest-data/site-assets`，图片及 WAV 各一份。迁移备份在 `/home/ubuntu/nest-migration`；账号密码未重置，现有数据未覆盖或重新初始化。
- Nginx 静态站点 `/var/www/nest`，配置 `/etc/nginx/sites-available/nest`；`/api/` 保留 URI 代理后端，`/admin` 与 `/admin/preview` 走 SPA。80 的 ACME 路径使用 `/var/www/letsencrypt`，其余跳转 HTTPS。正式地址 `https://159.75.18.65/`，后台 `/admin`；443 已按用户确认公开，3000/27017 未公开。
- Certbot 5.9.0 独立安装于 `/opt/certbot`，生产 IP 证书 `nest-ip` 已签发（本次到期 2026-11-15）；`nest-certbot-renew.timer` 已启用且有下次执行时间，每天两次并随机延迟一小时内，成功续期后检查并重载 Nginx。`renew --cert-name nest-ip --dry-run --run-deploy-hooks --no-random-sleep-on-renew` 完整演练成功，部署 hook 的 Nginx 检查与重载通过；短期证书依赖该定时器，80 挑战路径须持续可用。
- 已实测：`nginx -t` 成功；Nginx、后端、续期 timer 均 active；服务器内可信 HTTPS 首页/后台入口与构建文件一致、API v6、媒体可读、Cookie Secure/HttpOnly/SameSite=Lax。公网 curl HTTPS 200 且 TLS 校验结果 0、HTTP 301 到 HTTPS、API v6、`/admin/preview` 200；Chrome 真实打开首页、切换能力场景、打开/关闭技术详情与站主登录面板，页面图片加载完成。原 HTTP 的 `crypto.randomUUID` 错误由 HTTPS 解决，未修改源码降级。
- MongoDB 镜像当前 `mongo:8.0`（8.0.34）误拦 Ubuntu `uname`；实际 `/proc/version_signature` 上游为已修复的 7.0.14。服务器私有 `compose.override.yaml` 临时设 `GLIBC_TUNABLES=glibc.pthread.rseq=1` 后 healthy；这是镜像维护者的临时兼容办法，待 MongoDB 官方包含 SERVER-131779 的修复版本实际发布后再评估移除，不把尚未发布的 8.0.37 当作可用镜像。
- 收尾实测 Nginx、后端、Docker、续期 timer 均 enabled/active，MongoDB healthy，3000/27017 只绑定回环；本轮公开探针已删除，续期目录保留。Chrome HTTPS 页面无本轮新增错误，最终保留官网首页；本地仅更新本交接文档，`git diff --check` 通过。
- 以上为首次部署时的历史证据；当时未验证服务器站主实际密码登录、后台保存/上传。后续登录、上传和自动发布结果以本文件较新记录及对应SPEC为准，不把旧记录作为当前待办。

## 2026-11-08：个人官网提交交接

- 用户授权提交当前工作区：个人官网、唯一站主后台、能力三卡与履历详情、运行素材、规格与交接文档，以及文档图片清理规则；沿用当前`main`分支，不推送或部署。
- 沿用下方P28记录的后端76/76、前端lint/build与Chrome验收结果；本次仅核对记录对应关系、Git范围与敏感文件，不重复开发验收。真实环境文件、上传媒体、依赖目录及文档截图不纳入提交。
- P28记录的8个SHA256全部匹配；依赖与相关配置未发现验证后变化。敏感文件检查仅命中环境模板的占位连接串，`git diff --check`通过。
- 本次重新核对8个SHA256全部匹配，205个候选文件未发现真实凭据或应排除文件；沿用既有验证。暂存检查另报告3处文档末尾空行与Docker SVG的1处行尾空白，属于格式告警，本次保留原文件内容与素材校验值。
- 本次用户再次授权提交，Git元数据已可写，`git add -A`成功；提交范围为上述已完成工作，提交说明为`feat: 实现个人官网与站主管理后台`。站主真实公司/项目内容与此前未实操的兼容边界仍按下方记录保留；不推送或部署。

## 2026-11-08：文档图片清理与验收规则调整

- 用户要求清理历史图片、不再做图片对比；清理`docs/designs/personal-site/`的7张设计稿与66张验收截图（含PNG/JPG），合计17,552,279字节，约16.74 MiB。保留文字设计、素材提示词、原有验证记录和边界；下方旧图片文件名仅作历史记录，对应文件已删除，不要求恢复。
- 通用规则集中在[AGENT](../../AGENT.md#验收证据与图片管理)，SPEC规范/模板及SPEC-003同步引用或更新：默认不生成/保存设计对比图、验收截图、录屏或视觉快照，不做图片对比；仍按范围做必要浏览器交互/布局验收，用文字记录环境、步骤、DOM数据与实际结果。排障截图只用临时目录，不入Git。
- 根`.gitignore`新增文档图片与evidence目录忽略规则，移除失效图片链接并同步素材来源说明；`frontend/public/`运行素材、应用代码、数据库与开发服务未变。
- 本轮检查通过：docs图片剩余0；52份运行资源清理前后SHA256一致；修改文档的125个本地链接目标存在；73个旧图片路径均命中忽略规则，运行图片不受影响；`git diff --check`通过。独立只读复核未发现遗留有效截图要求或失效图片链接。
- 基准82acde8，保留原有大量未提交改动；开始核对时这些图片均未跟踪，本地所有可见引用的提交历史中也没有`docs/designs/`，无需改写Git历史。仅做文档与文件清理检查，不重复lint/build/HTTP/浏览器验收；未提交/推送/部署。


## 当前任务：P28能力三卡与履历详情（已验证，2026-11-08）

- 用户要求将四技术分类卡改为技术栈/公司背景/公司项目三卡；已实现960px技术四区、公司三目录与项目内切换、安全Markdown、手机全屏。后台技术配置保留，新增公司/项目配置、增删排序/隐藏/封面URL/MD预览及实时iframe弹窗。
- 新capabilityDetails沿用Mongo整站CAS、Session/Owner/CSRF；GET旧分区只读补默认，PUT必填防静默清空；公开服务端剔除隐藏项目。旧独立作品档案/顶层projects/图片上传仍不恢复。真实v6公司与项目为空，未伪造或保存示例经历。
- 本轮后端TDD定向8先红→绿、完整76/76/5套件含build通过；前端最终lint/build通过，实际API19/编辑器8/保存定位4模拟通过。Chrome1440/1920、390/320公开/后台/iframe及隔离fixture UI保存v2与刷新持久化通过；独立审查两个P2已修复关闭，无未关闭阻塞。
- 详细范围/结果/边界见[SPEC-003 P28](../specs/003-personal-site.md)与[整合](tasks/003-capability-details-integration.md)/[后端](tasks/003-capability-details-backend.md)/[配置](tasks/003-capability-details-admin.md)/[审查](tasks/003-capability-details-review.md)。截图evidence/capability-three-cards-v13.jpg、capability-technology-dialog-v13.jpg。
- OS reduce/真机touch软键盘/多浏览器/浏览器断网与409未实操，不扩大声明。根恢复起始缺失的3000开发watch；5173保留。浏览器留正式能力页、viewport reset已调用；测试登录已退出，同host端口Cookie不保证保留原站主登录状态。fixture库/隔离媒体/缓存已清理，3001/5174已停，3000/5173保留。
- 基准82acde8，大量既有未提交改动保留，本轮快照/tmp/nest-capability-details-before；未提交/推送/部署/换分支/worktree。下一步是站主自行填真实公司背景与项目Markdown。


## 2026-11-08：后端停止与502排查

- 13:59实际复现：首页5173为200，代理API为502，3000无监听且直连失败。证据指向旧聊天执行会话于00:24关闭，其托管的后端开发命令同时被工具标记失败结束；关闭触发方与具体信号未知，不能归因为业务崩溃或某人关闭窗口。
- 并行P28聊天于14:03重新执行原开发命令，本排查聊天未启动/重启；本轮直连3000公开统计/官网与5173代理官网均200，官网仍v6。仅新增诊断记录、更新本节，未改应用/真实配置、未跑全量构建测试、未提交推送；不覆盖P28验证状态。证据与边界见[排查记录](tasks/003-backend-stop-diagnosis.md)。

## 当前任务：P27默认动效与欢迎场景恢复（已验证，2026-11-07）

- 用户要求动效默认开/隐藏按钮，指出初次见面不动。已删除公开开关及首页/首载两处site-motion-off旧偏好覆盖；仍尊重后台appearance.motion与系统reduce，音乐独立。P26的Switch合同被本轮覆盖。
- 确认P26收掉柔光/星芒循环导致静置不明显；现恢复受控柔光与星芒内层循环、欢迎人物内层6秒/5px轻呼吸，不虚称真实挥手。新循环仅欢迎空闲端点运行，弹窗/首载/切场/隐藏/reduce暂停或静止，不碰850ms时钟与三环。
- 本轮实际TSX/函数模拟先红1/10→绿10/10，lint/build通过；Chrome桌面人物/星芒矩阵变化、关于暂停/Esc恢复、切场暂停、刷新开场、390手机无开关/无横溢出与后台iframerunning均已确认。独立[审查](tasks/003-welcome-motion-review.md)无P0/P1/P2。详见[SPEC-003 P27](../specs/003-personal-site.md)。
- 真实v6/保存disabled未改，未保存/退出/上传；未提交/推送/部署/换分支/worktree。基准82acde8，源快照/tmp/nest-welcome-motion-before；3000/5173继续运行。截图welcome-motion-*-v12.jpg为390实际首屏；viewport reset已调用但最终读值仍390×844，不声称恢复正常尺寸。OS reduce/真实隐藏/其它浏览器仍是未实操边界。

## 当前任务：P26温暖工作室视觉精修（已验证，2026-11-07）

- 按用户完整风格与参考图，在现有HEY./左文右人物/同人双幕上精修：深橄榄工作室环境、暖奶油金主按钮/深绿圆箭头、极简动效Switch、细导航下划线、能力14px/轻实底。人物/三环/850ms可逆时钟及P24/P25合同保留；没有虚构资料或恢复档案。
- 新增内置imagegen环境WebP1672/768两版共约37KiB；原图来源和最终提示词在frontend/public/site/ASSETS.md。手机因14px双列断词改卡内单列，四组横卡与名单滚动保留。
- 最终前端lint/build通过；Chrome原窗口/1440桌面/390及320公开、后台1440×900/390×844 iframe通过本轮布局与关键交互。正向/反向/中途反向有真实中间帧；用户指出转场消失时已定位为验收临时关闭动效，已恢复on。独立审查reduce箭头瞬移P2已修，无未关闭阻塞。
- 用户真实v6未保存/上传/退出；后端未改不重复HTTP。真实OS reduce/多浏览器/手机touch/长40字和12项新浏览器重造未执行，详见[SPEC-003 P26](../specs/003-personal-site.md)、[整合](tasks/003-warm-studio-integration.md)、[审查](tasks/003-warm-studio-review.md)。截图evidence/warm-studio-*-v11.jpg。
- 基准82acde8，保留既有未提交改动，本次基线/tmp/nest-warm-studio-before。未提交/推送/部署/换分支/worktree。3000/5173保留运行，浏览器留初次见面且动效on，viewport已调用reset。

## 当前任务：P25后台预览布局修复（已验证，2026-11-07）

- 用户指出预览黑边、内部滚条、标题断行和右卡片裁切。已用同源独立iframe与草稿消息替换嵌套div，桌面至少1440×900/手机390×844完整等比适配；外框精确包住画布，CSS/JS读取自己的viewport。保留P24移除档案、能力配置/彩色SVG及三环/850ms转场。
- Chrome1889/1440/1280桌面与390/320后台已验无整页横溢出；桌面标题一行、四卡完整、无内部双滚条/单侧黑边。连续输入/清空昵称同步且场景保持，设备切换、手机菜单、关于/Esc、独立入口等待及公开1440/390回归通过。
- 前端lint/build（含TS）通过，模块36/36+TSX生命周期模拟14/14；独立审查无P0/P1/P2。后端未改，不重复其HTTP检查；真实手机、多浏览器、OS reduce与真实409浏览器本轮未扩大覆盖。合同/证据见[SPEC-003 P25](../specs/003-personal-site.md)、[整合](tasks/003-preview-layout-integration.md)、[诊断](tasks/003-preview-layout-diagnosis.md)、[实现](tasks/003-preview-layout-implementation.md)、[审查](tasks/003-preview-layout-review.md)。
- 所有编辑测试仅随机临时Mongo；3001/5174已停止，两次fixture库/媒体均清理且0残留。真实API仍v6、保存disabled，用户登录保留；3000/5173继续运行。viewport已reset，实际能力预览保留，截图evidence/preview-fixed-final-v10.jpg。
- 基准82acde8；保留全工作区既有改动，无提交/推送/部署/换分支/worktree，未写开发配置。P24作品档案移除仍是有效合同。

## 上一任务：P24作品档案整体移除（已验证，2026-11-07）

- 用户要求整体移除作品档案及站主对应配置；最新合同与AC见[SPEC-003 P24](../specs/003-personal-site.md#p24作品档案整体移除最新合同2026-11-07)，覆盖下方保留档案的旧任务记录。
- 已移除公开档案导航/区块/详情/query、站主作品分区/所有编辑/封面上传、前后端projects合同；首页探索改为我的能力。旧Mongo读取只剔除响应，正常保存替换content；图片POST404，音频与历史媒体GET保留，/tasks不变。
- 三路报告：[后端](tasks/003-remove-archive-backend.md)、[后台与共享合同](tasks/003-remove-archive-admin.md)、[公开页](tasks/003-remove-archive-public.md)，[整合](tasks/003-remove-archive-integration.md)、[独立审查](tasks/003-remove-archive-review.md)。
- 基准82acde8，保留原大量未提交工作；本轮未提交/推送/部署/换分支/worktree，不写开发数据库或删除历史上传文件。代码快照`/tmp/nest-remove-archive-before`区分本次差异。
- 后端本轮70/70、5套件通过（含build），先红5条后实现；前端最终lint/build通过，API21/store17定向模拟通过。Chrome1920/390/320公开/后台只读确认无档案/无横溢出、旧query普通首页、关于/联系与回焦、主按钮/键盘跳能力及反向端点、后台五分区/音乐/预览。独立审查无P0/P1/P2；截图evidence/remove-archive-*.png。
- 开发API实读仍v6；本轮没有保存真实配置、上传或退出用户会话。失败重试仅源码/API-store模拟，未做浏览器断网注入；真机/多浏览器/OS reduce等边界未扩大。前端5173、后端3000保留，浏览器viewport已reset。
- P24冻结验收之后，外部聊天「配置我的能力分类」开始iframe预览重构，改动admin/index、admin/style、site/style及新增预览文件；已保留，文件落盘后根重新build通过。P24后台截图/19文件hash对应该预览重构之前，后续iframe/路由/视觉由该任务继续验收，不覆盖本轮删除合同；详见整合报告。

## 历史交接（P24前，仅供背景）

- 更新时间：2026-11-07（Asia/Shanghai）；代码基准82acde8，当前未提交工作区。
- 当前任务：[SPEC-003](../specs/003-personal-site.md)个人官网与唯一站主配置。首版至第四轮增量已验证；第五轮连续双场景已实现并通过Chrome桌面/手机尺寸验收（其它兼容边界见末节）：首载完整开场、移除跳过/页脚按钮、独立登录提示、背景音乐及音源配置，第一条参考的Splash Cursor柔雾流体背景已接入。档案揭幕仍仅建议，未混入本轮。
- 保留根AGENT.md用户既有规则。此前6680afe、82acde8已推送main；本任务没有提交、推送、换分支、worktree、部署或清库。

## 当前实现

- `/`：橄榄人物舞台、作品档案、分类和阅读面板、关于/联系、手机简化、系统和手动减弱动效。静帧人物不含连续肢体/眼神表演。
- 新增：首页站主入口→舞台内登录面板→`/admin`；手机菜单同入口，后台预览禁用登录。HEY.写完+停留后显影，正常4100ms；首载等待数据与图片、硬刷新重播、同App返回不重复，保留Esc、无跳过/页脚重看按钮；桌面滚动景深、纸页悬停/展开、柔光与鼠标流体。
- `/admin`：真实API配置、全站草稿、上传、原子保存、版本冲突、未保存预览、权限/过期边界。`/tasks`保留原任务演示。
- 技术栈不变：React/MobX/Ant Design/Less Modules + NestJS/MongoDB，路由懒加载，无新增Three/GSAP/视频依赖。
- 唯一站主55555已受控初始化，UUID只在本地忽略backend/.env；服务端Session+Owner+CSRF，缺owner配置拒绝所有管理请求，公开注册API403。密码不入仓库/日志/测试。
- 图片PNG/JPEG/WebP限5MiB，音乐MP3/WAV/OGG限15MiB，实际容器/文件头验证，保存在ignored backend/.data/site-assets；全站version比较原子保存，隐藏项目不公开。
- 真实配置当前v6（用户保存）：前端能力为React/Vite/TypeScript；标题OH,/HELLO.、默认展示名HEY.、真实任务项目及已上传截图。个人简介/联系待填写；音乐disabled/空音源/音量25/循环true，临时QA文案与音源引用已清空。

## 验证与证据

- 后端第一版最终 `npm test --prefix backend`：59/59、5套件、0失败/跳过/取消，含构建。该记录为历史；第四轮音乐变更后的67/67结果见下方。日志 `/tmp/nest-backend-test-email-fix.log`。
- 第二轮最终重新执行前端lint/build均退出0，含TypeScript，无大块警告；前端无test脚本。临时Node生命周期断言intro19/19、login13/13是模拟证据，不冒充浏览器。
- 第一版真实浏览器：站主登录、保存v1、跨窗口409保留输入/载入最新、JPEG上传保存v2/刷新持久化，桌面/390×844手机配置与公开页、分类空态、详情返回、预览连续输入/单独换图同步；临时输入已恢复。
- 第二轮真实浏览器：开场自动结束/skip/Esc/重播/会话一次、手动关闭动效、桌面滚动进度、作品返回；首页登录错误/成功及滚动锁清理，手机菜单/登录布局无溢出。重播焦点P2已修复并验证：结束后首屏logo，下一Tab不跳回页脚。
- 后端、前端与增量动效独立审查均已关闭阻塞。系统OS减少动画、手机软键盘、真实隐藏标签暂停及断网/401浏览器注入未实操；源码、HTTP、模拟与浏览器证据在SPEC分别记录。
- 历史截图已按上方清理记录删除；第一版及第二轮的浏览器操作结果与未验证边界保留在本节和对应SPEC/任务报告中。

## 分工与后续

- [整合](tasks/003-integration.md)、[后端](tasks/003-backend.md)、[公开页](tasks/003-public.md)、[配置](tasks/003-admin.md)、[动效](tasks/003-motion.md)、[登录面板](tasks/003-login-panel.md)、[开场](tasks/003-intro.md)。
- [后端审查](tasks/003-backend-review.md)、[前端审查](tasks/003-frontend-review.md)、[动效增量审查](tasks/003-motion-review.md)。
- 已观看[七的三次方视差视频](https://www.douyin.com/video/7686420711983942964)的演示与制作关键画面：三关键帧→两视频→滚动控制揭幕。建议下一轮优先橙色档案掀开露出作品，详细观察/素材边界见SPEC的P10；不是已实现功能。
- 人物连续动作素材、真实个人介绍/联系待补。用户此前已决定先页面后台、动作后补，不再重复索要密码或自行启用付费视频生成。
- 本地前端5173、后端3000；预览保留首页。测试结束主动退出站主会话，可从首页登录。媒体需与MongoDB一起备份，未保存引用上传目前无自动清理。
- 旧独立浮岛原型已移废纸篓、4177停止；保留原参考照片，不恢复旧方案。两个既有OpenSpec引用未归档。

## 2026-11-07：Unslop 检查

按用户要求安装用户级 `~/.codex/skills/unslop`，完成当前官网桌面/手机实际页面与独立源码审查；[总报告](tasks/003-unslop-audit.md)、[源码报告](tasks/003-unslop-code-review.md)。结论是保留现有橄榄舞台/人物/档案并局部精修，优先按钮对比度、手机小字、重复文案。此次仅安装和检查，建议未实施；未修改产品代码或配置数据，未重跑构建/HTTP，不覆盖上方其它任务的验证记录。


## 当前第三轮增量（已验证）

- P11：intro代理将原重叠时序改为2110ms收笔→740ms完整停留→350ms文字淡出→900ms玻璃显影，总4100ms。已按最新要求移除“跳过开场”按钮，dialog自身接焦点，读屏说明改为自动进入。
- P12：第一条视频约27秒已实际核对为React Bits Splash Cursor，采用官方WebGL流体本地适配，暖金/灰绿背景图层，手机/关闭/隐藏时停止，不模糊或遮挡人物文字。fluid代理只写components/site-fluid；根集成site与浏览器，未引新包。
- 最终增量独立审查无P0/P1/P2；前端lint/build通过。桌面/手机完整签名无skip、自然结束、鼠标实际像素、停止/关闭/登录时隐藏、离屏回收1×1及回首屏恢复已实测。系统reduce/硬件故障/隐藏标签仅源码与模拟证据。此前后端59/59不受影响，未重跑。

## Unslop 三项精修已完成

- 用户授权的按钮对比度、手机字号、重复文案/双标点已修正；本轮只改公开页 `index.tsx` 和 `style.module.less`，保留橄榄舞台、人物及动效实现。
- 最终lint/build通过；浏览器桌面1280×720、手机390×844/320×740验证正文14px/标签12px、阅读返回/关于、无横向溢出；按钮四端点最低4.8936:1。独立审查两处字号遗漏已关闭。多项目与后台预览仅源码验证。
- [交接与截图](tasks/003-unslop-polish.md)、[独立审查](tasks/003-unslop-polish-review.md)。记录两份精修文件哈希；开场浏览器检查后P11继续变化，最新动效验收仍由上方第三轮任务负责，不把本轮结果扩展到并发新动效。
- 交付核对时P12已往公开页集成SiteFluidBackground；精修文案保留、样式哈希未变。此次截图/构建记录对应该集成前的精修验收版本，新背景由P12–P13续验。

- 第三轮报告：[流体实现](tasks/003-fluid.md)、[增量审查](tasks/003-fluid-review.md)、[开场](tasks/003-intro.md)。完整开场与流体过程截图见evidence/home-intro-complete-v3.jpg、home-fluid-desktop-v3.jpg；已保留首页预览。第三轮已完成；最新第四轮结果见下方。


## 当前第四轮增量（已验证）

- 首载：App提前显示开场，懒加载首页与主图decode就绪且文字停留结束才显影；8秒资源降级/12秒可见时间保险，错误可重载。硬刷新完整播放，站内返回不重复；详情query不抢开场dialog。
- 提示与控件：奶油色独立SiteTip复用于登录和音乐，登录红框移除且输入框不位移；页脚重看/回首页两按钮删除。视觉动效与音乐各用明确文字开关。613px鼠标窗口流体已实测可用。
- 音乐：后台外观区支持URL/15MiB音频上传、名称、音量、循环与启用，上传仅改草稿。沿用Session/Owner/CSRF与版本保存；无配置不显示播放器，主动点击才创建Audio。离页/换源/禁用清理，错误使用tips、弹窗期间延后展示。
- 最终后端67/67、5套件通过（含build），日志/tmp/nest-backend-music-final.log；前端lint/build退出0且无lint警告，无新依赖。独立审查P2已关闭；实际模块模拟入口37、登录33、播放器/tip34、API解析23均通过，不能替代浏览器/真实网络覆盖。
- 浏览器已验：首载/完整签名/自然显影、about深链顺序、613px流体、登录空/错误/重复提示/成功、测试WAV上传草稿/保存/播放/暂停、失败提示、手机无横向溢出。临时音乐v3/v4已恢复为空v5，刷新确认，已退出站主会话。系统reduce、真实慢网/隐藏标签仅源码/模拟证据。
- Vite热更新期间一次动态模块加载失败，重启原开发服务后恢复；不伪称为生产加载故障复现。前端5173、后端3000继续运行，最终保留官网预览。未提交、推送、部署。
- [首载报告](tasks/003-cold-entry.md)、[提示报告](tasks/003-login-tips.md)、[音乐配置](tasks/003-music-config.md)、[独立增量审查](tasks/003-entry-tips-player-review.md)。当前截图：evidence/home-intro-v4.jpg、home-login-tip-v4.jpg、admin-music-v4.jpg。后续待用户正式音源、个人介绍/联系与人物动作素材。

## 当前第五轮：双场景规范（已实现，Chrome验收通过）

- [SPEC-003 P18](../specs/003-personal-site.md)：同一首页舞台欢迎/能力，共享1900ms可逆时钟、重复操作锁、端点状态与焦点、系统/手动减弱动效、手机横向技术卡片。新桌前MacBook透明WebP双分辨率预decode，8秒错误降级，9个本地技术SVG；作品档案/旧人物/后台配置保留。
- 最终lint/build通过（`/tmp/nest-capability-final.log`）；真实hook47及页面39定向模拟通过，无新增前端test脚本或依赖。未改后端，未重跑HTTP。
- Chrome1440/768/390/320两场景、正反/快速点击/卡片/键盘/手动reduce通过。修复HMR状态帧不一致、舞台内部滚动、平板低头位、手机文案遮挡/隐藏滚条及320整页横溢出。8张截图`evidence/capability-*-v5.png`；[独立审查/浏览器记录](tasks/003-capability-review.md)、[整合](tasks/003-capability-integration.md)。
- Safari原生工具连接超时，Firefox/Edge/真实手机触摸/OS reduce/慢网断图/真实后台预览未实操，源码/模拟不冒充浏览器；兼容补验边界详见SPEC。Chrome预览留首页，动效开启；临时viewport已请求reset。
- 保留所有已有未提交工作，无提交/推送/部署或数据库写入。后续为上述兼容补验及原先个人资料/正式音源待补，不自行启动新功能。

## P20 光圈动效修正（2026-11-07）
- 已补能力人物椭圆轨道的18秒光点/金色尾迹循环，外层保留原可逆转场；手动/系统reduce静止，切场/弹窗/离开首页/隐藏标签暂停。未改并行P19配置或数据库。
- Chrome实际采样移动、手动off、弹窗暂停、离屏/反向暂停及回来恢复通过；lint/build与共享时钟47断言通过，独立小范围审查无阻塞。图`evidence/capability-orbit-flow-v6.png`，详情SPEC P20；OS reduce/真实隐藏仅源码。Chrome留能力页、动效开，未提交/推送。

## P19 我的能力配置（已实现并验证）

- 最新用户任务：AI/前端/后端/部署四类能力由站主配置，后台四Tab、SVG+名称Select、自定义昵称与排序/删除；公开保留人物和四卡片。合同与实施清单在SPEC-003 P19。
- 图标38可选项+原openai兼容文件共39SVG；后续官方/品牌色增量后约296KiB，来源/固定版本/许可/SHA256见frontend/public/site/tech/SOURCES.md/json；39/39静态验证通过。
- 后端能力合同与兼容已接入，最终真实HTTP72/72、5套件通过，日志/tmp/nest-backend-capabilities-final.log；最终前端lint/build通过，日志/tmp/nest-capability-config-frontend-final.log。API模块22/22、UI模块18/18、保存定位7/7模拟通过，不冒充浏览器。
- Chrome桌面1318、390/320尺寸已验四Tab/搜索/添加/改图标保留昵称/连续预览/跨Tab/排序/删空/保存及公开同步、12项和40字昵称、409保留草稿；后台/公开无横溢出，名单可局部键盘滚到末项。
- 独立审查两个P2已修复复验关闭：隐藏无效昵称保存自动切分类并聚焦（含手机预览回编辑），纵向列表允许水平滚动链给外层横卡。真机touch、软键盘、多浏览器/断网注入未实操，边界见SPEC。
- 所有浏览器测试写入使用localhost:5174/3001独立临时Mongo库，已退出测试会话、停临时服务、清理审计无残留fixture；开发配置仍v5九项。原开发watcher中断后已恢复3000/5173，正式能力页图标全加载并保留预览，动效开。未提交/推送/部署。
- 报告：[图标](tasks/003-capability-icons.md)、[后端](tasks/003-capability-config-backend.md)、[前端](tasks/003-capability-config-frontend.md)、[根整合](tasks/003-capability-config-integration.md)、[审查](tasks/003-capability-config-review.md)。截图evidence/*capabilities*-v7.jpg；后续可从/admin→我的能力维护自己的列表。

### P19后续：导入错误与官方图标（已处理）

- 复现悬空use-orbit-card-windows引用造成TS2307/Vite500；并行P21模块先补齐，后重构为use-orbit-occlusion，当前导入均存在、TS/lint/build通过，模块HTTP200。根未覆盖光圈改动。
- 13SVG（12可选+openai兼容）更新官方来源，含当前九项及Vue/ChatGPT/Cursor；其它26保留开源且明确区分。Codex采用OpenAI官方Blossom fallback，不虚称独立Codex图标。源码path/来源/许可/哈希详见SOURCES和图标报告。
- 官网和Select取消白色滤镜、保留原色并加浅底。39静态SVG与HTTP均通过；Chrome后台四Tab/Select及公开九图已加载、无错误遮罩。仅只读用户v6，未改数据或退出其会话；截图official-svg-admin-v8.jpg，构建日志/tmp/nest-official-svg-final-build.log，独立[复审](tasks/003-capability-official-svg-review.md)通过。未提交/推送/部署。
- 用户继续反馈没有颜色：21项已补齐固定版本原色SVG或可核实的品牌hex，现30项品牌色+8项黑白表示。原13官方文件哈希保持，39SVG共302532B；来源和独立复审已同步。最终build/TS通过（/tmp/nest-brand-colors-final-build.log），沿用未变样式的lint；39SVG与模块HTTP200。Chrome选择器彩色效果、56图加载/filter none/无overlay已验，保存按钮仍disabled，本轮未写用户v6。截图brand-colors-admin-v9.jpg。

## P21–P23 光环与转场迭代（已交付）
- 用户最新要求已覆盖P18/P20旧表现：三条1/.82/.6724等比光环缓慢旋转（无光点尾迹），SVG收紧至最大旋转包络；仅可见人物遮光，卡片及展开说明区域透光，局部坐标遮罩由use-orbit-occlusion管理。保留并行P19配置工作。
- 转场1900→850ms，导航/场景按钮点击即按targetScene选中；未decode不阻塞切换、显示原人物降级；中途可在同一时间轴逆向，重复同目标忽略，卡片端点后才可交互。
- 最终lint/build通过，最新时钟86+遮罩几何37定向断言通过，独立小范围审查无阻塞。Chrome确认active=page时busy=true/settled=0、快速逆向、桌面/768三环/遮罩/部署展开/动效关闭；图evidence/capability-three-rings-fast-v8.png。真机/其它浏览器/OS reduce边界未扩大，详见SPEC最终记录。
- Chrome留我的能力、动效开，viewport已reset。未提交/推送/部署，P19其它任务状态仍按其独立记录。
