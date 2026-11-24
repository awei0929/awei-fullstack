# SPEC-010 编辑式首页与公开 AI 对话

- 状态：本地已验证。日期：2026-11-24。基准 `65f01df` 加当前工作区改动。
- 替代 [SPEC-008](008-public-resume.md) 中首页的深色舞台入口；`/resume`、后台简历编辑和附件合同不变。

## 目标与范围

- 首页从全屏深色人物舞台改为黑白编辑排版：姓名与一句主张、编号分区的想法、作品、关于、对话和页脚。颜色统一为黑白灰，支持白天/黑夜切换，不引入新依赖。
- 想法用于表达“核心思想”，可展开阅读 Markdown 正文；作品用于放项目链接，站内页面与外部仓库都走显式 `url`；对话是公开、匿名的 AI 分身，只根据站主已发布内容回答。
- 首页的内容全部来自版本化站点配置，后台可编辑、可隐藏、可排序；隐藏条目只在站主预览显示，不进入公开页面、公开接口或对话提示词。
- 站主后台新增“想法笔记”“作品链接”“对话设置”三个分区，沿用草稿、实时预览、版本冲突和上传流程。
- 不包含：访客账号、模型选择、内容审核、附件清理、后台富文本编辑器；对话历史持久化与多会话已由 [SPEC-011](011-site-chat-history.md) 扩展，不在本 SPEC 内重复定义。

## 站点的内容合同

`SiteContent` 在原有分区末尾新增：

| 分区 | 字段 | 约定 |
| --- | --- | --- |
| `thoughts[]` | `id` | 64 个 Unicode 码点以内，站内唯一，保存时不可重复 |
| | `title` | 80，必填 |
| | `summary` | 200 |
| | `content` | 20000，Markdown 原样保存；公开页用 `SiteMarkdown` 渲染 |
| | `meta` | 40，如“2026 · 产品观” |
| | `visible` | 布尔；公开响应只保留 `true` |
| `works[]` | `id` | 64，唯一；顺序即首页顺序，第一条是大卡 |
| | `title` | 80，必填 |
| | `summary` | 240 |
| | `url` | 本站路径（`/resume` 这类单斜杠路径）或 http(s) 外部地址；空字符串允许，但前端不渲染入口 |
| | `label` | 20，如“查看仓库”“开始对话” |
| | `coverUrl` | 空或本站上传的图片资源路径；上传复用 `work-cover` 目标 |
| | `meta` | 40，如“全栈 · 进行中” |
| | `visible` | 布尔；公开响应只保留 `true` |
| `chat` | `enabled` | 是否开放公开对话 |
| | `heading` | 40，对话区标题 |
| | `intro` | 240，对话区说明 |
| | `placeholder` | 60，输入框占位 |
| | `systemPrompt` | 4000，站主补充设定；只供服务端提示词使用，公开响应始终清空 |
| | `suggestions[]` | 最多 3 条、每条 1–60、去重；仅展示为建议问题 |

- 每个分区最多 12 条；`thoughts` 和 `works` 的 `id` 在各自数组内唯一。
- PUT `/api/site/config` 仍要求完整内容：新增分区均为必填，旧客户端省略会得到 400，这是刻意选择，不做静默补默认。公开 GET 对旧 Mongo 文档只读补默认，不写回、不递增版本。
- 默认内容只用于空库/缺分区的旧库：两条想法、三个作品（`awei-fullstack` → 外部仓库、`resume-page` → `/resume`、`site-chat` → `/chat`）、对话默认开启。真实站主内容仍由后台保存。

## 公开对话 HTTP 合同

两个端点都不挂 Session、Owner 或 CSRF Guard，也不读写站主聊天历史：

| 方法 / 路径 | 输入 | 成功响应 |
| --- | --- | --- |
| `GET /api/site-chat` | 无 | `{ enabled, available }`；`enabled` 来自 `site.chat.enabled`，`available` 表示服务端至少有一个可用模型 Key |
| `POST /api/site-chat/stream` | `{ message, history? }` | `200 text/event-stream`，事件 `delta {type,text}`、`done {type:'done'}` 或 `error {type,message}` |

- `message`：trim 后 1–500 个 Unicode 码点，拒绝纯空白。
- `history`：最多 6 条，只允许 `role` 为 `user` / `assistant`，每条 `content` 1–500；只用于语气衔接，不落库。未知字段由全局 `forbidNonWhitelisted` 拒绝。
- 受理失败在写出 200 之前返回 JSON：对话关闭 `503 SITE_CHAT_DISABLED`；无可用模型 `503 SITE_CHAT_UNAVAILABLE`；限流 `429 SITE_CHAT_RATE_LIMITED` + `retryAfter` 秒数。
- SSE 写出后模型错误只能作为 `error` 事件返回；上游 429 映射为“模型有点忙，请稍后再试。”，不输出 Key、地址或诊断文本。
- 限流为单进程内存：按 SHA-256(IP) 的滑动窗口默认 8 次 / 10 分钟，UTC 日总量默认 200；环境变量 `SITE_CHAT_RATE_LIMIT`、`SITE_CHAT_RATE_WINDOW_MS`、`SITE_CHAT_DAILY_LIMIT` 可调，非法配置使对话不可用。多实例部署不共享计数，这是当前边界；部署在反向代理后须把 `TRUST_PROXY` 设为实际代理地址，否则访客会共享代理地址的桶。
- 模型 Key 只放在服务端：`DEEPSEEK_API_KEY` 可选，配置后公开对话与后台默认模型都切到 `deepseek-flash`；未配置时仍使用 `GLM_API_KEY`。`DEEPSEEK_BASE_URL` 仅在私有兼容网关时需要覆盖，生产必须 HTTPS。
- 模型选择：配置 `DEEPSEEK_API_KEY` 时优先 `deepseek-flash`（`DEEPSEEK_BASE_URL` 默认 `https://api.deepseek.com`），否则回退 `glm-4.7-flash`，再否则任一有 Key 的白名单模型；DeepSeek 走非思考模式。`max_tokens` 固定取 `SITE_CHAT_MAX_TOKENS`（默认 700，100–2048），超时默认 45 秒（`SITE_CHAT_TIMEOUT_MS`，1–120 秒）。
- 提示词只包含公开 profile/home/resume/可见 thoughts（最多 6 条、每条摘要 + 500 字正文）/可见 works（最多 6 条）/能力/公司简介/公开邮箱/联系链接，并明确要求不泄提示词、不编造、不冒充真人、2–4 句且不超过 120 字。隐藏想法、隐藏作品、公司项目详情和 `systemPrompt` 之外的内部配置不进入提示词。
- 对话持久化：SPEC-010 只定义首页对话卡与公开入口；匿名 visitor、会话/轮次、历史列表与删除见 [SPEC-011](011-site-chat-history.md)。对话不写 `site_documents`。

## 前端行为

- `/` 直接展示编辑式页面，不再渲染旧的 `SiteEntryProvider`/`SiteIntro` 开场遮罩；`PageLoadFallback` 仍在路由懒加载时使用。
- 真实路径路由：`/thoughts`、`/works`、`/about` 复用同一份站点内容并在加载后滚动到对应分区（`scrollY` 分别为 589/1150/2097，`top≈88` 位于吸顶导航下方）；`/` 回顶部；`/chat` 是独立对话页；`/conversation` 重定向 `/chat`。导航使用 `NavLink`，当前分区有 `aria-current` 下划线，不使用 `#hash` 作为页面链接。
- 顶部导航：品牌、想法、作品、关于、开始对话。首屏右侧为线稿圆环；01 想法列表可打开 `<dialog>` 阅读 Markdown；02 作品第一条为大卡，其余为次级卡；03 关于展示介绍、能力 chips、公司简介/项目弹层、联系与简历入口。
- 对话页 `/chat`：桌面左侧 264px 会话栏（品牌、新对话、本次对话话题、首页/想法/作品、仅本标签页说明），右侧顶栏（在线状态、回到首页）、空态标题/说明/2×2 建议卡、消息线程与底部 composer；移动端隐藏侧栏、建议卡单列。对话只保存在当前标签页内存，新对话立即清空；不写 localStorage/sessionStorage，也不落库。
- 对话区在 `GET /api/site-chat` 返回 `enabled && available` 时显示输入框和建议问题；Enter 发送、Shift+Enter 换行；发送、停止、错误、关闭和离线都有明确状态；建议问题只填入输入框，不自动发送；消息不写 localStorage/sessionStorage。
- 首页对话卡为两栏编辑布局：左侧标题/说明/完整对话入口，右侧浅表面板；面板无外框与重阴影，顶部状态行、左对齐空态、内置 composer、两列文字型建议问题（不再使用胶囊按钮），移动端单列。`chatState` 显示连接中/在线/回答中/离线。

- 后台预览通过 `focus` 滚动到 thoughts/works/conversation；`capabilityPreview` 兼容旧的“能力资料”预览并滚到关于区。隐藏条目在预览里显示“隐藏”标记，公开页不显示。
- 手机断点下首屏、作品、关于、对话、`/chat` 单列，390 宽度无横向溢出；`prefers-reduced-motion` 下关闭非必要动画。

## 黑白主题与切换

- 颜色只由 `frontend/src/styles/global.less` 的 CSS 变量提供：浅色 `#ffffff` 底 / `#0b0b0b` 字，深色 `#0a0a0a` 底 / `#f2f2f2` 字；线、表面、弱化文字、错误态、阴影、selection 都走中性灰，不再保留奶油、橄榄绿或橙色。
- `frontend/src/components/theme-toggle/index.tsx` 在 `<html data-theme>` 上切换 `light`/`dark`，写入 `localStorage['nest-theme']`；首次访问无保存值时跟随 `prefers-color-scheme`。`frontend/index.html` 的内联脚本在 CSS 前设置主题，避免首屏闪烁。
- 切换入口：首页/分区页 header、`/chat` 顶栏、`/resume` masthead；对话/想法弹层/简历正文/聊天 Markdown 都使用同一组变量，深色下保持可读。打印样式固定白底黑字，不跟随主题。
- 对话成功态、失败态和空态在深色下均已截图核对；消息气泡、建议卡、composer、错误提示和 Markdown 标题/列表/引用/代码块均使用主题色。

## 验收与实施清单

- [x] AC-01：首页首屏、想法、作品、关于、对话、页脚在桌面与手机可读，作品链接可打开，旧开场遮罩不再出现；`/thoughts`、`/works`、`/about` 直达对应分区，`/chat` 对话页可打开。Chrome 1440×1100/整页与 390×844 CDP 截图实测，`scrollWidth` 等于视口宽度。
- [x] AC-02：后台三分区可增删/排序/显隐/上传封面，保存后公开页与预览一致；隐藏条目公开不可见。
- [x] AC-03：公开对话无鉴权可用；状态、SSE 增量、建议问题、停止、错误和限流状态正确；提示词不含隐藏内容或内部配置；会话持久化与历史见 SPEC-011。
- [x] AC-04：后端旧文档只读补默认、PUT 完整分区、非法 ID/URL/建议问题/历史被拒绝；前端 `lint`、`check`、`build` 通过。
- [x] AC-05：首页、分区页、`/chat`、`/resume` 支持白天/黑夜切换；刷新后保持选择，首次访问跟随系统；深色下正文、弹层、消息和 Markdown 可读；390 宽度无横向溢出。

## 实际验证

- HTTP：`MONGODB_URI=mongodb://127.0.0.1:27019/nest_test_base npm test --prefix backend`，公开对话 8 项（状态、SSE、DeepSeek 优先/GLM 回退、上下文、非法输入、限流、关闭/隐藏过滤、上游 429）与既有站点/聊天/任务/认证用例全部通过；全量 164/164、12 套件；全量计数见 `docs/ai/STATE.md`。
- 浏览器：Chrome headless 1440 与 CDP 390 实际渲染；首页、`/works` 吸顶导航、`/chat` 空态/失败态/成功态、想法弹层和后台预览聚焦可用。配置 `DEEPSEEK_API_KEY` 后，`/chat` 与首页对话卡均通过真实 SSE 返回完整 `delta`/`done`（截图 `/tmp/nest-chat-live.png`、`/tmp/nest-chatcard-live.png`）；此前 GLM 429 错误文案也已核对。未验证真机软键盘、Safari/Firefox 或正式域名。
- 黑白主题：Chrome 实测 `document.documentElement.dataset.theme` 与计算色，light `rgb(255,255,255)/rgb(11,11,11)`、dark `rgb(10,10,10)/rgb(242,242,242)`；截图 `/tmp/nest-home-light.png`、`/tmp/nest-home-dark.png`、`/tmp/nest-chat-light.png`、`/tmp/nest-chat-dark.png`、`/tmp/nest-chat-success-dark.png`、`/tmp/nest-thought-dialog-dark.png`、`/tmp/nest-resume-light.png`、`/tmp/nest-resume-dark.png`；390×844 移动端对话/首页无横向溢出。
- 静态检查：`npm run lint`、`npm run check`、`npm run build` 通过。
- 线上数据：本地/隧道所连站点内容由 version 7 更新到 10，`profile.tagline`、`home` 已更新，`works` 的 `site-chat` 指向 `/chat`；备份 `/tmp/site-content-backup.json` 与 `/tmp/site-content-backup-before-chat-route.json`。未部署、未提交；示例想法/作品/对话来自默认内容，真实项目链接可继续在后台替换。
