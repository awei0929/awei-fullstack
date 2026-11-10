# 架构概览

核对日期：2026-11-08。类型：当前实现结构；官网正在按 [SPEC-003](../specs/003-personal-site.md) 实施，验证以该规格记录为准。原系统摘要见 [SPEC-000](../specs/000-current-system.md)，认证与会话见 [SPEC-001](../specs/001-session-auth.md)，模块整理见 [SPEC-002](../specs/002-auth-module-organization.md)。
更新触发：模块关系、存储方式、运行依赖或请求处理链发生变化。

## 结构

单一 Git 仓库包含前后端两个 npm 项目，分别安装依赖、执行命令；根目录没有统一的 npm 工作区脚本。

```text
浏览器
  → React 页面 → MobX AuthStore / TasksStore → API/request
  → Vite /api 代理（开发环境，同源 Cookie）
  → express-session / connect-mongo → NestJS Guard / Controller / Service
  → Mongoose → MongoDB

AppModule
  ├─ ConfigModule：读取 backend/.env
  ├─ DatabaseModule：建立 MongoDB 连接
  ├─ AuthModule：认证入口、Session、CSRF、认证限流，导入 UsersModule
  │    └─ UsersModule：用户模型、持久化、密码哈希与校验，导出 UsersService
  ├─ SiteModule：公开官网、版本化配置、唯一站主权限与媒体，导入 AuthModule
  ├─ PublicModule：固定只读示例与示例统计，导入 SystemModule
  ├─ TasksModule：个人任务 Controller / Service / Schema，导入 AuthModule
  ├─ SystemModule：提供本次运行时长
  └─ StatsModule：组合 TasksModule、SystemModule，导入 AuthModule
```

## 模块与事实依据

| 职责 | 代码入口 |
| --- | --- |
| 应用启动与监听 | [main.ts](../../backend/src/main.ts) |
| Session 存储 / Cookie、配置检查、/api 前缀、全局输入校验 | [app.setup.ts](../../backend/src/app.setup.ts) |
| 配置、模块、请求日志中间件与全局异常过滤器注册 | [app.module.ts](../../backend/src/app.module.ts) |
| 连接配置；MONGODB_URI 缺失时启动失败 | [database.module.ts](../../backend/src/database/database.module.ts) |
| Session 建立、恢复、到期与销毁 | [auth.service.ts](../../backend/src/auth/auth.service.ts) |
| 用户模型注册、服务导出 | [users.module.ts](../../backend/src/users/users.module.ts) |
| 用户持久化与密码哈希 | [users.service.ts](../../backend/src/users/users.service.ts) |
| 身份 / CSRF 检查与认证限流 | [session.guard.ts](../../backend/src/auth/guards/session.guard.ts) / [csrf.guard.ts](../../backend/src/auth/guards/csrf.guard.ts) / [auth-rate-limit.guard.ts](../../backend/src/auth/guards/auth-rate-limit.guard.ts) |
| 公共示例及统计 | [public.controller.ts](../../backend/src/public/public.controller.ts) |
| 按 ownerId 过滤的任务操作与公开响应映射 | [tasks.service.ts](../../backend/src/tasks/tasks.service.ts) |
| 任务模型注册与服务导出 | [tasks.module.ts](../../backend/src/tasks/tasks.module.ts) |
| 个人统计聚合 | [stats.service.ts](../../backend/src/stats/stats.service.ts) |
| 认证状态与身份版本 | [auth.ts](../../frontend/src/store/auth.ts) |
| 页面、任务请求状态与异步身份隔离 | [页面](../../frontend/src/pages/tasks/index.tsx) / [TasksStore](../../frontend/src/store/tasks.ts) |
| 同源请求、CSRF 头与 HTTP 错误解析 | [http.ts](../../frontend/src/api/http.ts) |

UsersModule 只向外导出 UsersService，AuthModule 不重复注册用户模型或服务；用户模块不依赖认证 DTO 或 Session。AuthModule 的主文件保留在模块根，Guard、配置、类型与 DTO 分别放入 `guards/`、`config/`、`types/`、`dto/`。目录约定统一见 [后端规则](../../backend/AGENTS.md#模块与目录组织)。

## 数据与运行边界

- 用户、会话、认证限流计数和任务均保存到 MongoDB；Session Store 复用 Mongoose 当前连接的客户端与数据库，测试会话不能写入开发库。
- 个人任务在 tasks 集合保存 ownerId，查询、统计、原子编辑和删除均按当前会话用户过滤。历史无 ownerId 的任务原样保留，公共与个人端点都不返回它们。
- 公共示例是独立的三条固定常量，每次返回新对象，不查询真实任务集合；注册不复制这些示例。
- MongoDB 内部 _id 与对外 UUID id 分离；日期在数据库使用 Date，在公开响应中转换为 ISO 字符串。公开任务响应不含 ownerId，用户响应不含密码哈希。
- 数据库持久化与 Service 单例是不同概念；数据库与 SESSION_SECRET 不变、会话未过期时，应用重启后可以恢复身份和个人任务。运行时长重新计时，仍由统计 API 返回；当前页面只展示任务统计与可见性说明。
- SESSION_SECRET 必须固定配置且至少 32 字符；会话使用 HttpOnly、SameSite=Lax Cookie，生产环境启用 Secure。期限、CSRF 与显式代理信任等细则见 [SPEC-001](../specs/001-session-auth.md#http-与数据契约)。
- [Compose](../../compose.yaml) 只启动 MongoDB，前后端在宿主机运行。数据库使用命名卷。
- Compose 的项目名仍为 awei，数据库示例名也是 awei；它们不随工作区目录更名而自动修改。
- 开发后端默认监听 127.0.0.1:3000；前端监听 127.0.0.1:5173，[Vite 配置](../../frontend/vite.config.ts)将 /api 转发到后端。修改后端端口时须同步代理。
- 配置模板为根目录与 backend 各自的 .env.example。真实配置不进入文档或 Git；详细准备与命令统一见 [README](../../README.md)。

## 请求边界

认证、公开、官网、任务和统计 Controller 经过请求日志中间件。个人任务和统计先通过 SessionGuard，任务写入再通过 CsrfGuard，随后执行 DTO / 路径校验与业务逻辑。登录、退出要求会话绑定的 CSRF token，登录额外限流；公开注册始终403。官网配置依次校验 Session、SiteOwner，写入再校验 CSRF；公开与站主配置响应均不包含作品字段。原 X-Learning-Key 演示 Guard 已移除。

成功响应直接返回业务数据；认证和个人接口返回 Cache-Control: no-store。全局异常过滤器保留 HTTP 异常状态，并补充 path、requestId，未知错误响应不暴露内部详情。未匹配路由或 JSON 解析失败等请求可能未经过日志中间件，过滤器会补充请求编号。

前端先恢复身份，恢复失败显示重试；游客只查询公共示例，管理操作打开认证弹窗。切换身份时清空旧数据与表单，读取、写入、错误、finally 和后续统计刷新均校验发起时的身份版本；当前会话 401 返回公共示例并提示登录，旧身份 401 被忽略。退出失败保留身份并提供重试；退出请求的互斥锁独立于身份失效，在请求完成前阻止新认证，避免迟到退出响应清除新登录 Cookie。

## 当前能力边界

- 公开注册关闭；保留登录、个人任务隔离和游客任务演示。单份官网配置由 SITE_OWNER_USER_ID 绑定的站主管理，缺省拒绝；无验证码、密码找回或第三方登录。
- completed 字段存在，但当前接口与页面没有完成状态切换。
- 前端已有构建、类型检查和 lint；未提供正式自动化交互测试脚本。静态检查不代替浏览器验证。
- 后端 HTTP 测试使用真实 MongoDB 的独立临时数据库，包含关闭 / 重建应用后的 Session 和任务恢复场景；测试存在不代表最新改动已经通过。
- 认证实现证据维护在 [SPEC-001](../specs/001-session-auth.md)，模块整理的回归证据见 [SPEC-002](../specs/002-auth-module-organization.md)，当前交接见 [STATE](../ai/STATE.md)；认证改造前的历史结果保留于 [基线](../specs/000-current-system.md#历史验证记录认证改造前)。

官网入口动画由 App 的 SiteEntryProvider 提前显示，懒加载公开页报告内容就绪，角色图片解码后且文字写完才显影。独立 SiteTip 被登录和音乐复用，原生弹窗内提示留在弹窗层。背景音乐配置存入同一版本化站点文档，音频通过站主专用 `/api/site/audio-assets` 上传（15MiB）；服务器校验并存文件，不抓取外部音源。公开播放器只在用户点击时创建 Audio，离页或换源释放；后台预览静音。

官网首页舞台包含欢迎与能力两个状态，共享`use-capability-transition`的850ms进度。原生Web Animations保持同一组关键帧，由活动期间单一RAF采样，返回反向采样；停止动效直接提交端点。`CapabilityContent`展示技术栈/公司背景/公司项目三卡，点击由`SiteExperience`的原生dialog生命周期管理；`CapabilityDetails`展示技术四分区或目录/Markdown正文。手机三卡横向排列，详情全屏，后台独立iframe共用同一展示。能力人物使用本地WebP两种分辨率，提前decode，8秒超时或加载失败后保留旧人物降级。原独立作品档案、详情与站主作品编辑已整体移除，首页按钮进入我的能力。公司项目为P28新增的能力详情。

`SiteContent`顶层不再包含projects，后端从旧Mongo文档映射响应时只读剔除历史字段，不写库或改变version；下一次版本化保存替换content。含projects的写入按未知字段400处理。旧作品封面图片POST已删除；音频上传与受控媒体GET继续服务音乐和历史媒体，已有文件不自动删除。SPEC-004另增file-assets接口服务当前公司项目/正文，不恢复独立作品档案或旧POST。

能力列表现纳入同一版本化 `SiteContent.capabilities`，固定 AI/前端/后端/部署四类。后台独立能力编辑器通过共享草稿维护 SVG 标识和昵称；图标目录在前端本地配置，后端使用同一38项白名单校验，不接受原始SVG或外部图标地址。旧文档完全缺少分区时只读补原九项，不写库或改变版本；显式空组保留。保存沿用整站版本比较与 Session/Owner/CSRF，不新增能力专用接口。详情与验证见 SPEC-003 P19。

首页导航使用targetScene即时高亮，scene仅用于端点交互；转场可在同一时间轴中途反向。`use-orbit-occlusion`按人物与可见卡片表面生成局部SVG遮罩，三条等比椭圆在最大旋转包络内旋转；资源decode不阻塞导航，未就绪时显示已加载的原人物。

能力详情集中在`SiteContent.capabilityDetails`：技术介绍、公司三个Markdown栏目、最多12份公司项目。读取历史缺失分区只补响应；PUT要求完整分区，避免旧页面静默清空履历。`readPublic`在服务端仅投影visible=true项目，站主读取与保存仍返回全部数据，沿用整站版本CAS与Session/Owner/CSRF。Markdown使用react-markdown和remark-gfm，关闭原始HTML并限制URL；封面支持安全URL与SPEC-004的新图片上传入口。后台技术栈/公司/项目Tab共享原草稿与iframe消息协议，弹窗仅约束iframe内焦点与滚动，不阻塞父页编辑。详情见SPEC-003 P28。

服务器磁盘上传合同见[SPEC-004](../specs/004-disk-file-uploads.md)。`POST /api/site/file-assets`复用Session/Owner/CSRF，multipart唯一file，图片5MiB、PDF/ZIP/TXT/DOCX/XLSX/PPTX附件20MiB；音频原接口15MiB保留。文件校验、随机命名、写盘与公开读取保留在SiteModule资产业务，文件与附件下载名元数据位于同一`SITE_ASSETS_DIR`，不新增Mongo集合或存储依赖。GET仅接受UUID文件名与白名单扩展名，附件强制下载并保留安全原名；上传不改站点版本。后台独立上传区、封面、公司/项目Markdown共享上传状态和身份保护，结果只改草稿；Markdown专用URL类型允许本站附件路径，联系配置仍仅HTTP(S)。全部文件上传完成即可公开访问，不随隐藏项目变私密；部署与回滚保留媒体目录，备份需同时包含磁盘与Mongo。
