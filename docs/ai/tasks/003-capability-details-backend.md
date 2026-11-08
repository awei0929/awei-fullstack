# 能力三卡改版：后端实现与验证

## 当前状态

- 核对日期：2026-11-08（Asia/Shanghai）；基准提交 `82acde8`，交付为当前未提交工作区，本轮差异对照 `/tmp/nest-capability-details-before`。
- 状态：SPEC-003 P28/T1 后端实现和真实 HTTP 验证完成；根整合与最终独立审查继续进行。本报告不将后端结果扩展为前端安全渲染或浏览器验收结论。
- 已读根 AGENT、STATE、架构、backend/AGENTS、SPEC 规范及 SPEC-003 P28；应用 TDD、executing-plans、verification-before-completion。遵循项目适配约定，沿用当前分支、既有改动及任务报告，不新建 worktree、自动提交或使用依赖 commit range 的脚本。
- 只修改下面列出的五个后端源码入口、`backend/test/site.e2e.test.mjs` 和本报告；未修改其它模块、Schema、上传服务、依赖、SPEC 或 STATE。
- 没有连接/写入开发站点配置、恢复旧作品、提交/推送/部署/换分支；HTTP 写入仅由现有测试辅助层在随机 `awei_e2e_<UUID>` 临时 Mongo 与临时媒体目录执行。

## 最终合同与实现

保留 `SiteContent.capabilities` 原四类技术配置、昵称与顺序，增加必需的 `capabilityDetails`：

```ts
{
  technology: { introduction: string },
  company: { name: string, summary: string, introduction: string, business: string, responsibilities: string },
  projects: [{ id: string, name: string, summary: string, content: string, coverUrl: string, visible: boolean }]
}
```

- 技术介绍最多 2000 Unicode 码点；公司名可空、最多 80，简介最多 300，三个 Markdown 正文各最多 10000；项目最多 12 项，ID 为 1–64 个 ASCII 字母数字/下划线/连字符且列表内唯一，名称 1–80 码点且不可纯空白，简介最多 300、正文最多 20000。所有字段均严格按类型校验，`visible` 只接受布尔值，数组顺序保持。
- 公司三正文与项目 `content` 原样存字符串，不转换 HTML、不删改换行或 Markdown。技术介绍为纯文本。安全 Markdown 渲染属于前端边界，HTTP 原文回显不能作为 XSS 已防护证据。
- 封面最多 2048 字符，空串、合法 HTTP(S)、`/api/site/assets/<约定v4-uuid>.png|jpg|webp` 可用；禁止其它本地路径、音频路径、`data:`/`javascript:`/协议相对 URL、凭据、空白、控制字符、反斜杠和路径穿越。不请求或抓取远程图片。
- 旧 Mongo 完全缺失详情时 GET 只读补完整默认：技术介绍「围绕前端、后端、AI 工具与部署，持续积累完整交付的能力。」；公司字段全空；项目 `[]`。每次创建独立默认对象，不写库、不改 version/updatedAt，不从旧顶层 `projects` 迁移。显式空内容保留。
- PUT 必须提交完整详情；省略、`null`、部分对象、错误形状、嵌套数组、未知字段返回 400，不改任何分区与版本。此处不使用默认属性，避免旧客户端整站保存清空已经配置的履历。
- GET `/api/site` 调用独立 `readPublic()`，服务端严格只保留 `visible === true` 项目，隐藏 ID/名称/简介/正文/封面完整剔除，保留可见项目原顺序。站主 GET 和 PUT 返回全部项目。公开投影基于每次独立读取的文档，不写入数据库或影响后续站主响应。
- 继续使用原整站原子版本比较、首次唯一 key 竞争以及 Session→Owner→CSRF。旧顶层 `content.projects` 仍禁止写入并在历史读取时剔除；图片 POST 仍 404，音频 POST 与历史媒体 GET 保留。

## 本轮文件

| 文件 | 修改 |
| --- | --- |
| [site.type.ts](../../../backend/src/site/types/site.type.ts) | 新增 `SiteCapabilityProject`、`SiteCapabilityDetails` 和内容字段。 |
| [site.defaults.ts](../../../backend/src/site/config/site.defaults.ts) | 独立详情默认工厂及首次未保存响应。 |
| [save-site.dto.ts](../../../backend/src/site/dto/save-site.dto.ts) | 四个嵌套 DTO、码点长度/ID唯一/逐项对象/严格布尔/封面 URL 校验；详情 PUT 必填。 |
| [site.service.ts](../../../backend/src/site/site.service.ts) | 旧详情缺失只读补默认，新增公开过滤；整站原子写入逻辑不变。 |
| [site.controller.ts](../../../backend/src/site/site.controller.ts) | 公开 GET 使用公开投影，站主 GET/PUT 保持完整文档。 |
| [site.e2e.test.mjs](../../../backend/test/site.e2e.test.mjs) | 手写默认与完整新夹具、6 条新详情用例；增强现有权限与并发用例，将详情纳入失败原子性断言。 |

`SiteRecord.content` 已为 Mixed，新增分区无需 Schema 迁移、新增 Module、项目 CRUD 或 Markdown 后端依赖。

## 实际验证

1. **先红**：只新增/增强 HTTP 测试与共享测试夹具，生产实现尚未修改。构建通过后执行 `node --test --test-name-pattern='详情' backend/test/site.e2e.test.mjs`，真实临时 Mongo 定向 **0/8，8 失败**。失败符合缺失功能：默认 `undefined`，省略详情仍 200，合法新字段被未知字段校验拒绝 400，并发请求均 400。日志 `/tmp/nest-capability-details-backend-red.log`；前置构建日志 `/tmp/nest-capability-details-backend-red-build.log`。
2. **定向绿**：完成实现后，同一构建与定向 HTTP 命令退出 0，**8/8，1 套件，0 失败/跳过/取消**。日志 `/tmp/nest-capability-details-backend-focused.log`，duration 2161.842875ms。
3. **最终全套**：根目录 `npm test --prefix backend` 退出 0，含 Nest 构建，**76/76，5 套件，0 失败/跳过/取消**。日志 `/tmp/nest-capability-details-backend-final.log`，duration 7641.771291ms。认证、任务、初始化、媒体、版本保存与旧顶层字段合同共同通过。
4. `git diff --check` 退出 0；本轮源码全为此前已存在的未跟踪文件，已额外对照本轮快照自审 DTO、公开投影及文件范围，编译/HTTP 覆盖新增正文。

HTTP 具体覆盖：新库公开/站主默认及零记录；旧 v7 原能力保留、旧作品不迁移、原记录/version/updatedAt 不变；旧请求缺分区首次与既有履历均 400 不写；公司三正文/项目 Markdown 代码块、表格、图片、原始 HTML 等原字符串保存；混合可见/隐藏顺序、公开 JSON 无隐藏标记、站主完整；全隐藏公开 `[]`、排序、显式清空；重启同临时库/Session恢复且公开继续过滤；各字段 Unicode 最大边界、12项目、64位ID、2048封面；最大文本组合实际 HTTP 保存成功且编码后请求小于 2MiB；HTTP(S)及三种本地图片扩展名正例；根/嵌套/数组/逐项非法形状、缺字段、未知字段、重复ID、错误布尔、危险封面、文本/数量超限均400且Mongo原记录不变；Session/Owner/CSRF/409不覆盖；首次0版本及已有版本并发均一200一409，数据库完整等于胜者而不混合分区，隐藏胜者仍不公开。

测试沿用 [helpers/app.mjs](../../../backend/test/helpers/app.mjs)：每例真实 Nest、随机独立库与系统分配端口，清理前核对 `awei_e2e_` 前缀；本站媒体用临时目录并在 afterEach 删除。未使用真实账户密码、未修改开发 v6 或其上传文件，没有以模拟代替 HTTP。

## 交接与剩余边界

- 根整合需将 P28/T1 清单与状态标记到实际结果，并让前端默认介绍与本报告保持一致；新客户端始终提交完整详情。
- T2/T3 应另行验证前端解析、编辑/预览草稿、隐藏Tab错误定位、Markdown安全渲染与图片失败，后台 iframe 必须保留隐藏项目编辑数据同时在公开详情过滤。
- 后端不检验远程封面可访问性、不迁移旧作品、不恢复图片上传、不处理媒体保密访问；历史媒体依原合同有公开GET，项目隐藏仅保证公开站点文档不泄漏对应配置内容。
- 本任务不包含浏览器/手机/动效验证，最终独立审查由根整合派发。

## 浏览器验收临时环境（2026-11-08，已验收并清理）

- 根代理追加授权后，已用现有 `startApp({port:3001})` 创建随机临时库 `awei_e2e_788e159674f04b1fae50725f4cddaf9e`，种临时站主与完整配置 v1。独立 Vite 5174 代理 3001，使用独立 `/tmp` 缓存目录；主 3000/5173 保留。
- 夹具：3 个可见项目+1 个隐藏项目、公司三个 QA Markdown 栏目、表格/长代码/正常图/故意404图/原始HTML与危险URL字符串；前端组12项及40字昵称，其它技术组保持默认，动效开启。所有文案明确 QA 临时示例，不代表真实经历。
- 启动时真实 HTTP 已确认站主有4项目、公开只有3项且JSON不含隐藏标记；经5174代理同样只返回3项。凭据、库/媒体/缓存目录、进程与启动会话ID、清理步骤仅在权限0600的 `/tmp/nest-p28-fixture-info`，脚本仅在 `/tmp/nest-p28-fixture-server.mjs`。
- 根代理 Chrome 实操：在此临时库保存 v2 技术介绍、公司名称与公司 Markdown，添加一个项目并上移后保存；公开读取 v2 为4个可见项目，仍无隐藏项目；刷新后台确认公司资料持久化。测试会话已通过 UI 退出。本代理负责环境与清理，不把转述的浏览器记录称为自身实操。
- 运行会话ID `22935` 已收到 `cleanup` 并退出0，输出 `P28_FIXTURE_CLEANED`。脚本实际关闭Vite、调用原`stopApp(state)`并经临时库前缀断言drop、删除隔离媒体与Vite缓存；清理时间 `2026-11-08T06:15:35.468Z`。随后独立只读Mongo `listDatabases` 精确匹配核查，目标库不存在；首次启动后立即清理的另一临时库也不存在，日志 `/tmp/nest-p28-fixture-cleanup-audit.json`，核查时间 `2026-11-08T06:16:45.518Z`。
- 文件系统核查媒体与缓存目录 `exists=false`；端口核查3001/5174无监听，主3000/5173原进程仍监听。`/tmp/nest-p28-fixture-info` 保留无密码清理元数据，临时启动脚本已删除。未再运行完整测试，未改正式配置或产品源码。
