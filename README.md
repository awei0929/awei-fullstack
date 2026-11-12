# HEY.：个人官网与站主配置

React + NestJS + MongoDB 全栈项目。公开官网展示人物、个人能力与资料，站主登录后维护全站内容；任务应用作为独立练习保留。官网实现合同和验证见 [SPEC-003](docs/specs/003-personal-site.md)。

- `/` 公开官网，`/admin` 站主配置，`/tasks` 任务演示。
- 公开注册关闭；登录使用原有 Session 和 CSRF，配置额外校验唯一站主身份。
- 每个用户只查看和管理自己的任务，任务列表和统计均由后端按用户过滤。
- 使用 MongoDB 保存用户、任务与 Session；不接入验证码、邮箱、短信或自助找回密码。
- 新功能的完整合同、边界和实际验收状态见 [SPEC-001](docs/specs/001-session-auth.md)。当前进度见 [STATE](docs/ai/STATE.md)。

## 开发入口

- [自动构建与部署](docs/deployment.md)：main 推送、构建/部署日志、手动发布和回退。

- [AGENT](AGENT.md) / [AGENTS](AGENTS.md)：项目规范和工具入口。
- [文档导航](docs/README.md) / [架构概览](docs/architecture/overview.md)。
- [SPEC 规范](SPEC.md) / [当前系统基线](docs/specs/000-current-system.md)。
- [OpenSpec 与 Superpowers 配置](docs/ai/TOOLING.md)：引用同一份 SPEC，不维护重复规格。

## 环境准备

使用 Node.js 22.22.3 或更高的兼容版本，安装 Docker。前后端为独立 npm 项目。
从项目根目录准备配置；已有文件不会覆盖：

```bash
test -f .env || cp .env.example .env
test -f backend/.env || cp backend/.env.example backend/.env
npm ci --prefix backend
npm ci --prefix frontend
```

根 `.env` 的 MongoDB 密码与 `backend/.env` 中的 MONGODB_URI 必须对应。已有数据库卷不因修改环境变量自动更换密码。真实配置不进入 Git。

后端还需要 SESSION_SECRET，至少32字符，并在重启间保持稳定。可用以下命令在缺失或仍为模板值时生成随机值到本地文件，不打印密钥：

```bash
python3 - <<'PYSECRET'
from pathlib import Path
import secrets
p = Path('backend/.env')
text = p.read_text()
lines = text.splitlines()
for i, line in enumerate(lines):
    if line.strip().startswith('SESSION_SECRET='):
        value = line.split('=', 1)[1].strip()
        if not value or value == 'replace_with_a_random_secret_at_least_32_characters':
            lines[i] = 'SESSION_SECRET=' + secrets.token_hex(32)
        break
else:
    lines.append('SESSION_SECRET=' + secrets.token_hex(32))
p.write_text('\n'.join(lines) + '\n')
PYSECRET
```

配置名称和默认值以 [backend/.env.example](backend/.env.example) 为准。生产启用 HTTPS 与 Secure Cookie；部署在反向代理后时只信任实际代理，不无条件信任转发来源。

## 启动

```bash
# 若已有可用 MongoDB，可直接复用配置中的连接，不再启动第二个占用相同端口的实例。
docker compose up -d
```

终端一：

```bash
npm run start:dev --prefix backend
```

终端二：

```bash
npm run dev --prefix frontend
```

打开 http://127.0.0.1:5173 。Vite 将 /api 代理到 127.0.0.1:3000。数据库由 Compose 运行，应用在宿主机运行。

### 唯一站主初始化

公开注册已关闭。本站仅允许受控命令初始化账号 `55555`，已有账号必须验证原密码，不重置密码。密码从标准输入读取，不作为命令参数；以下示例由终端隐藏输入密码：

```bash
npm run build --prefix backend
python3 -c 'import getpass,json; print(json.dumps({"account":"55555","password":getpass.getpass("Password: ")}))' | npm run --silent site:owner:init --prefix backend
```

成功只输出用户 UUID。将该 UUID 写为本地 `backend/.env` 的 `SITE_OWNER_USER_ID`，重启后端。缺失此变量时所有配置读写和上传均拒绝；不能通过普通登录或客户端指定身份提升权限。真实 `.env`、密码及数据库连接串不进入仓库。

官网内容存 MongoDB；上传的媒体默认在 `backend/.data/site-assets/`，可用 `SITE_ASSETS_DIR` 指向持久目录。迁移或部署时需同时备份媒体目录与数据库。当前版本不自动清理未被最终保存引用的媒体。

### 图片、PDF与附件上传接入

实现与验收合同见 [SPEC-004](docs/specs/004-disk-file-uploads.md)。文件保存到服务器磁盘，不需要开通 COS。

接入链路：

```text
后台选择文件
  → API 用 FormData 的 file 字段发送，并携带 Session Cookie / CSRF token
  → POST /api/site/file-assets：先验证登录、站主、CSRF，再解析文件
  → 校验大小与文件内容，生成 UUID 文件名，写入 SITE_ASSETS_DIR
  → 返回文件 URL、显示名称、类型、大小
  → 后台填入封面或插入 Markdown 草稿
  → 保存全部后，官网使用新链接

访客访问链接 → GET /api/site/assets/:filename → 图片展示 / PDF与附件下载
```

- 支持 JPG/JPEG、PNG、WebP 图片，最大 5 MiB；PDF、ZIP、TXT、DOCX、XLSX、PPTX 附件，最大 20 MiB。音频仍使用原音乐入口，最大15 MiB。
- 进入后台「文件上传」可上传并复制地址/Markdown；「我的能力 → 公司项目」可直接上传封面，公司/项目正文的 Markdown 字段可直接上传并插入图片或附件。
- 文件上传只写磁盘，不会自动更新官网或站点版本；应用到封面/正文后仍要点击「保存全部并更新官网」。
- 用户已选择全部公开：文件上传完成后，拿到链接的人即可访问，即使尚未保存、取消编辑或项目被隐藏。不要上传私密文件。
- 服务器不自动解压或执行附件。ZIP仅支持普通单卷，不支持分卷与ZIP64；Office 仅校验 ZIP 容器与扩展名，不保证文件有效或无病毒。TXT须为UTF-8文本；不支持的类型需明确扩展白名单。

服务器接入与发布流程（当前已接入 main 自动构建部署）：

1. 核对待发布代码和现有验证记录；正式版本由 GitHub Actions 从已推送的提交构建。真实环境文件和媒体目录独立保留，不能用前端构建产物覆盖媒体目录。
2. 在服务器的 `backend/.env` 中确认以下配置，站主 UUID 沿用现值：

   ```dotenv
   SITE_ASSETS_DIR=/home/ubuntu/nest-data/site-assets
   SITE_OWNER_USER_ID=existing_site_owner_uuid
   ```

   上述站主值是占位提示，不要覆盖成该字符串。目录必须在代码/`dist` 之外，后端服务用户须可读写。当前部署以 `ubuntu` 用户运行，可检查：

   ```bash
   sudo -u ubuntu test -r /home/ubuntu/nest-data/site-assets
   sudo -u ubuntu test -w /home/ubuntu/nest-data/site-assets
   ```

   若尚未创建，使用 `sudo install -d -o ubuntu -g ubuntu -m 750 /home/ubuntu/nest-data/site-assets` 创建；不要清空现有目录或修改为所有人可写。
3. 编辑现有 Nginx 站点 `/etc/nginx/sites-available/nest`，在已有 `location /api/` 内加入下行，保留原代理设置：

   ```nginx
   client_max_body_size 25m;
   ```

   25m 为最大20 MiB文件及 multipart 开销留余量；应用仍执行自己的5/20 MiB限制。检查并重载：

   ```bash
   sudo nginx -t && sudo systemctl reload nginx
   ```

4. 完成上述服务器持久目录和 Nginx 限额准备后，提交本功能代码并推送 `main`，按[部署手册](docs/deployment.md)等待 GitHub Actions 的检查、构建和部署成功。流程会发布完整前后端产物并重启服务；当前服务从 `/srv/nest/current/backend` 启动，前端由同一版本的 `frontend/dist` 提供。
5. 通过线上 HTTPS 后台上传一张小图片、一份 PDF 和一个 ZIP，确认地址可在未登录窗口读取、图片显示且附件下载；将图片/附件用于正文并保存，刷新官网核对。重启后端后再次打开原链接，确认文件持久化。413 通常先查 Nginx 限额；401/403 核对会话/站主/CSRF；500 检查服务日志、目录权限与磁盘空间。
6. 备份整份 `SITE_ASSETS_DIR`（含下载名元数据）及 MongoDB；发布和回滚不删除媒体目录。共享Mongo并不会共享磁盘文件，正式文件从线上后台上传。

按实现顺序阅读代码：

- [上传与读取路由](backend/src/site/site.controller.ts)：声明站主/CSRF权限及附件下载响应头。
- [multipart拦截器](backend/src/site/interceptors/site-file-upload.interceptor.ts) → [文件验证](backend/src/site/validation/site-file.ts)：限制文件数量/体积，检查实际内容及文件名。
- [媒体服务](backend/src/site/site-assets.service.ts)：生成UUID、写盘、保存附件原名元数据、失败清理及公开读取。
- [前端API](frontend/src/api/site.ts) → [草稿Store](frontend/src/store/site-admin.ts) → [上传控件](frontend/src/pages/admin/file-upload.tsx)：提交文件、验证响应、维护忙状态和草稿，再由原保存接口发布内容。

## 操作流程

1. 打开官网浏览初次见面、我的能力及关于/联系；独立任务演示位于 `/tasks`。
2. 从首页「站主入口」登录，或直接打开 `/admin`；非站主即使登录也不能读取或修改网站配置。
3. 编辑首页、我的能力、个人资料、联系入口、动效及背景音乐；未保存预览只在编辑页可见。
4. 点击“保存全部并更新官网”，成功后新访问和刷新看到更新；版本冲突保留输入，不能直接覆盖。
5. 任务演示保留游客示例与既有账号的私有任务；公开注册入口和API关闭。

背景音乐在「外观与动效 → 背景音乐」设置：填写直接音频地址，或上传 MP3/WAV/OGG（最大15MiB），可设置名称、0–100%音量、循环和启用。上传只改草稿，点击保存后生效。访客主动点击「音乐」才开始播放；没有音源或未启用时隐藏播放器，音乐与环境动效独立。

原独立作品档案及其配置、旧封面上传接口已移除；新的公司项目位于「我的能力」弹窗，通过新的文件上传接口设置封面，不恢复作品导航或旧项目接口。历史配置读取时剔除作品字段，保留其它配置与版本；读取不改数据库，下一次正常保存采用新合同。旧项目链接显示普通首页，历史上传媒体不自动删除。

「我的能力」分为技术栈、公司背景、公司项目三类入口卡片。技术栈详情集中展示前端、后端、AI、部署四区，后台仍按原四个 Tab 编辑图标、昵称和顺序，每类最多12项；新增技术介绍在技术栈弹窗上方展示。公司背景可配置名称、摘要与公司简介/核心业务/岗位职责；公司项目最多12份，可新增、排序、删除、隐藏并设置封面URL或上传封面。公司正文与项目正文支持 Markdown、表格、代码、图片及附件上传，编辑器可展开预览；不执行原始HTML。保存全部后统一更新，隐藏项目不出现在公开接口。38个图标仅作为可选目录，默认沿用原九项。图标来源与使用说明见[技术图标记录](frontend/public/site/tech/SOURCES.md)。

数字账号为3–5位ASCII数字字符串，保留前导零。未设置可验证的联系方式，第一版没有自助找回密码入口。密码规则、会话期限和错误行为统一见 SPEC-001。

历史无 ownerId 的任务仍保留在数据库，但不会作为示例公开，也不会分配给首个注册用户。若需要迁移，须另行确定归属。

## 请求与模块

```text
浏览器
  → API / MobX Store / 官网、站主配置与任务页
  → Vite /api 代理
  → NestJS Session、认证与 CSRF 检查
  → Controller → Service → Mongoose → MongoDB
```

- 首次 GET /api/auth/session 恢复身份并取得 CSRF 令牌；匿名状态也可以取得登录所需令牌。
- POST 登录成功后重新生成 Session ID，并返回用户和新的 CSRF 令牌；公开注册返回403。
- 浏览器通过 HttpOnly Cookie 携带会话，写请求在 X-CSRF-Token 中携带当前令牌。
- 公共示例由 /api/public/tasks 与 /api/public/stats 提供；个人 /api/tasks 与 /api/stats 要求登录。
- 创建任务时 ownerId 由服务端当前用户决定，编辑/删除使用 id 与 ownerId 联合过滤。前端隐藏操作不能代替后端权限检查。
- 已移除 X-Learning-Key 学习演示头；它不再提供写入权限。
- 错误响应保留 HTTP 状态及 message，并补充 path/requestId；未知错误不暴露内部信息。

### 工程边界

Controller 处理 HTTP 输入，Service 处理业务，Module 组织依赖。UsersModule 管理用户模型、持久化与密码校验，导出 UsersService；AuthModule 导入它，负责认证入口和 Session 生命周期。StatsModule 复用任务服务提供的用户级统计，不重复注册服务。

模块根目录保留主要 Controller / Service / Module，DTO、Schema、Guard、配置与类型按职责归入子目录；每个 Guard 独立文件。具体约定见 [后端规则](backend/AGENTS.md#模块与目录组织)，本次整理与验证见 [SPEC-002](docs/specs/002-auth-module-organization.md)。

DTO、数据库 Schema 与公开响应独立；用户及密码哈希不直接序列化为响应。会话过期由服务端校验，MongoDB TTL 仅负责清理。

前端在身份切换时清空数据并使旧回调失效；旧请求即使完成，也不能覆盖新用户的页面。取消请求不能撤销已经在服务端执行的操作。

## 站主后台 AI 对话

在 `/admin` 的“AI 对话”分区使用，只有 `SITE_OWNER_USER_ID` 对应的已登录站主可访问。聊天历史与手动保存的跨会话记忆独立保存到 MongoDB，不进入公开官网配置或预览；切换后台分区保留官网草稿。默认模型为 `glm-4.7-flash`。合同、实际验收与未验证边界见 [SPEC-006](docs/specs/006-owner-sse-chat.md)。

### 使用聊天工作区

- 桌面从历史侧栏选择会话，窄屏通过“历史”打开抽屉；搜索匹配最近50个已加载会话的标题。新对话的建议只填入输入框，编辑后再发送。
- 输入区保留在工作区底部，Enter 换行，Ctrl / ⌘ + Enter 发送。回复逐段显示，可停止生成；向上阅读时暂停自动跟随，点击“返回最新”回到底部。
- 回复支持 Markdown、表格和代码块，可复制整条回复或代码；代码与宽表格在局部滚动。原始 HTML 不执行，模型提供的图片只显示说明，不自动加载。
- GLM-4.7-Flash在尚未输出正文时收到429，会自动尝试一次免费GLM-4-Flash-250414；界面显示实际模型和切换说明。两者仍属同一平台，不能保证避开平台整体故障。
- 其他失败或中断保留已收到的正文，可重新编辑问题后手动发送；已有正文时不会切换拼接答案，也不会无限重试。

### 使用长期记忆

点击聊天顶部“记忆”管理偏好与背景，或在一条回复下点击“记住”，编辑后保存。支持查看、编辑、启用/停用和确认删除。每位站主最多20条，每条去除首尾空白后为1–500个Unicode码点；回复超过上限时保留全文供手动摘录，不静默截断。

启用项在每次新生成前读取，作为背景发送给**当轮使用的模型（含自动切换的备用模型）**，新会话也可使用。记忆修改、停用或删除只影响后续请求，不改写已有回复；当前生成与备用尝试继续使用开始时的同一份记忆。最近10轮聊天上下文与长期记忆分别维护，记忆不会自动从对话提取或生成摘要。

### 申请并配置 GLM API Key

1. 在[智谱开放平台](https://open.bigmodel.cn/)注册登录，按控制台要求完成账号开通。
2. 打开[标准 API Key 页面](https://bigmodel.cn/usercenter/proj-mgmt/apikeys)，创建“模型标准 API”用途的 Key。个人/团队 Coding Plan 的新 Key 与标准 API Key 分开管理，不能直接混用；参见[官方申请说明](https://docs.bigmodel.cn/cn/guide/start/quick-start)及[分类说明](https://docs.bigmodel.cn/cn/coding-plan/notice/api-key-management)。
3. 在已有 `backend/.env` 中增加下面配置，保留原数据库、会话密钥和站主 ID：

```dotenv
# 只填写在后端真实.env；这里是占位符，不是可用密钥。
GLM_API_KEY=替换为你创建的标准API密钥
# 不填地址时使用以下官方默认值。
GLM_BASE_URL=https://open.bigmodel.cn/api/paas/v4
# 单轮最长生成时间，单位毫秒；默认120秒。
CHAT_TIMEOUT_MS=120000
```

4. 重启后端，登录站主后台 → AI 对话 → 选择 GLM-4.7-Flash → 新建对话并发送消息。Key 留空时官网照常运行，聊天显示模型未配置并禁用发送。

截至2026-11-12，[官方定价](https://docs.bigmodel.cn/cn/guide/start/pricing)将 GLM-4.7-Flash 与 GLM-4-Flash-250414 输入、输出标为免费；两者复用同一标准API Key，无需另申请备用Key。账号的并发、速率和开通条件以控制台为准；当前免费不代表未来价格或持续可用性保证。应用仅在4.7收到429且没有正文时自动切换一次4-Flash，两次尝试共享原总时限，不切付费模型，不启用另收费的搜索或其他工具。

真实 Key 不写进前端、`VITE_` 环境变量、README、聊天消息或 Git。生产环境需要单独配置服务器持久环境文件，自动发布不会把本机 `.env` 上传。配置完成后的真实模型可用性仍需实际发送验证。

### 配置多个模型

后端使用 Node 原生 `fetch` 调用 Chat Completions 兼容接口，再转换为本项目 SSE 事件；前端使用 `fetch` 流式读取，MobX 管理状态。模型目录由服务端控制，页面不能提交任意模型地址或 Key。

两个GLM免费模型为内置项，4.7仍是默认选择；也可手动选择4-Flash直接对话。可以在 `backend/.env` 增加最多10个其他兼容模型；下面是配置格式示例，需替换为供应商真实信息：

```dotenv
OTHER_LLM_API_KEY=替换为其他供应商密钥
CHAT_MODELS_JSON='[{"id":"other-model","label":"另一个兼容模型","model":"provider-model-id","baseUrl":"https://provider.example/v1","apiKeyEnv":"OTHER_LLM_API_KEY","disableThinking":false}]'
```

- `id` 是本项目的唯一模型标识，不能与内置 `glm-4.7-flash` 或 `glm-4-flash-250414` 重复；`model` 是供应商实际模型名。
- `baseUrl` 填接口根路径，代码追加 `/chat/completions`；生产使用HTTPS，本地测试可使用回环HTTP。
- `apiKeyEnv` 指向保存Key的环境变量名，不能直接放Key。未配置对应Key的模型不可发送。
- 重启后端后，后台下拉列表显示模型，可在下一轮发送前切换；历史回复保留原选择和实际使用的模型名称。额外模型不参与自动切换，避免意外触发收费；手动选4-Flash失败也不会回切4.7。
- 此扩展适用于兼容 Chat Completions 的文本流接口。其他协议需要新增后端适配；不同模型的参数、额度、收费和回答效果须各自验证。

### 运行边界与排查

- 当前同时只允许站主的一轮生成；重复请求标识不重复调用。每会话最多100轮，达到上限后新建会话。
- “停止生成”会请求后端取消模型调用并保存状态；切会话、离开聊天或断网也会中断当前流。刷新能读取已经保存的历史，不承诺关闭页面后继续生成。
- 无Key先检查后端环境变量并重启；401/403先重新登录并核对站主；4.7限流时按上述规则尝试备用，备用也失败则保留当前结果，稍后手动重试。请求鉴权失败、网络错误、已输出后的异常都不触发切换。
- 正式发布前按[部署手册](docs/deployment.md#sse-对话部署检查)核对Nginx缓冲/超时。服务器重启会中断活动生成，遗留运行会按过期时间转为中断状态。
- 本地连接线上数据库时，对话与记忆管理会直接写入线上数据。开发与浏览器测试必须另外使用隔离Mongo，不能直接运行默认开发服务当测试环境。

## 验证

从项目根目录运行，要求隔离测试 MongoDB 可用。测试必须显式指定连接地址，不读取真实 `backend/.env`；不要使用线上数据库或本机的线上隧道地址：

```bash
# 示例指向本机一次性测试Mongo；先确认该实例已启动。
MONGODB_URI=mongodb://127.0.0.1:27019/nest_test_base npm test --prefix backend
node --test frontend/test/*.test.mjs
npm run lint --prefix frontend
npm run build --prefix frontend
```

后端测试构建实际代码，并使用随机 awei_e2e_ 数据库启动真实 HTTP 服务，结束后只清理对应测试库。测试覆盖认证、CSRF、限流、用户隔离、任务原有边界、聊天流/取消/模型错误和跨应用重启；聊天上游为本机模拟服务，不调用真实模型。实际结果以 SPEC 验证记录为准。

前端 build 包含 TypeScript 检查，不需要重复运行 check。当前没有前端 test 脚本；浏览器验收单独记录，构建成功不代表交互全部通过。

## NestJS 学习阅读顺序

后端手写源码带有中文学习注释，建议沿一次请求阅读：

1. [main.ts](backend/src/main.ts) → [app.module.ts](backend/src/app.module.ts)：应用启动、模块组装、依赖注入。
2. [app.setup.ts](backend/src/app.setup.ts)：Session 中间件、全局管道与测试共用配置。
3. [auth.controller.ts](backend/src/auth/auth.controller.ts) → [session.guard.ts](backend/src/auth/guards/session.guard.ts) / [csrf.guard.ts](backend/src/auth/guards/csrf.guard.ts) / [auth-rate-limit.guard.ts](backend/src/auth/guards/auth-rate-limit.guard.ts)：HTTP 路由、身份、CSRF 与认证限流。
4. [auth.module.ts](backend/src/auth/auth.module.ts) → [users.module.ts](backend/src/users/users.module.ts)，再读 [auth.service.ts](backend/src/auth/auth.service.ts) → [users.service.ts](backend/src/users/users.service.ts)：跨模块依赖注入、会话生命周期、密码哈希与用户持久化。
5. [tasks.controller.ts](backend/src/tasks/tasks.controller.ts) → [tasks.service.ts](backend/src/tasks/tasks.service.ts)：参数校验、按用户隔离的数据库操作、公开响应映射。
6. [HTTP 测试辅助](backend/test/helpers/app.mjs)：如何用 TestingModule 替换连接，验证真实请求且保护开发数据。

## 目录

```text
backend/src/users/       用户模型、持久化、密码哈希与校验
backend/src/auth/        认证入口、Session与认证守卫
  guards/               Session、CSRF、限流，各自独立文件
  config/               认证配置
  types/                会话响应与请求类型扩展
  dto/                  注册登录输入校验
backend/src/tasks/       私有任务CRUD
backend/src/chat/        站主聊天、模型适配、流式与历史
backend/src/stats/       用户级任务统计
backend/src/database/    MongoDB连接
backend/test/            隔离数据库HTTP验证
frontend/src/api/        HTTP与认证API
frontend/src/store/      身份、任务、官网草稿及聊天状态
frontend/src/pages/      官网、后台与任务页
frontend/test/           实际聊天模块的Node定向验证
openspec/changes/        变更引用，正文位于docs/specs/
docs/ai/STATE.md         当前状态与接续入口
```
