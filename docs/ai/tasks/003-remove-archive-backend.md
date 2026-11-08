# P24-A：作品档案后端整体移除

- 核对日期：2026-11-07（Asia/Shanghai）。
- 状态：已实现并通过后端完整检查；对应 [SPEC-003 P24](../../specs/003-personal-site.md) 的 AC24-04、AC24-05。
- 基准：82acde8 上已有大量未提交用户代码；本次按 `/tmp/nest-remove-archive-before` 快照核对任务差异。未提交、推送、换分支、创建 worktree 或部署。
- 范围：仅 `backend/src/site/`、`backend/test/site.e2e.test.mjs` 与本文；全局规格和状态由整合者维护。

## 实现与取舍

- `SiteContent`、默认值和保存 DTO 删除 `projects`、`SiteProject`、项目枚举及封面/演示 URL 专用规则。新的请求携带 `projects`（空数组、有值或 null）都经过现有未知字段校验返回 400。
- `SiteService` 移除公开项目过滤分支，公开和站主使用相同响应映射。映射显式列出当前保留分区，旧 Mongo 文档的作品数据不进入响应；读取没有写库步骤，不改 version 或 updatedAt。正常保存沿用整个 content 原子替换，因此站主下一次保存会移除旧字段。
- 删除图片 `POST /api/site/assets` 路由、图片专用拦截器和签名/存储实现。该路径现在为 404，与是否登录、站主配置、CSRF 无关。
- 音频上传继续使用 Session → Owner → CSRF → 文件解析 → 实际文件头校验的顺序；15MiB 边界、随机文件名、写入互斥及当前媒体读取保持。媒体 GET 保留 PNG/JPEG/WebP 的历史读取，不清理旧文件。
- 测试正常夹具不再携带作品。删除项目列表/标签/封面上传等不适用用例；原有通用 DTO、联系链接与邮箱、能力、音乐、权限、CSRF、并发、重启与任务回归继续覆盖。

## 红灯证据（实现前）

先修改测试，运行 `npm run build && node --test --test-name-pattern=P24 test/site.e2e.test.mjs`（工作目录 backend）。构建成功，5 个真实 HTTP 用例全部按预期失败，退出码 1：

1. 默认响应仍包含 projects：实际 true，预期 false。
2. 不带 projects 保存被旧 DTO 拒绝：实际 400，预期 200。
3. 图片 POST 仍可上传：实际 201，预期 404。
4. 旧 Mongo 内容仍返回 projects：实际 true，预期 false。
5. 携带 projects 的请求仍被接收：实际 200，预期 400。

完整日志：`/tmp/nest-remove-archive-backend-red.log`。随后才修改生产实现。

## 绿灯与覆盖

本次重新运行 `npm test --prefix backend`，退出码 0，含 Nest 构建：**70/70，5 套件，0 失败、取消、跳过**。其中站点套件 26 条；总数减少源于删除作品专用旧合同用例并加入 P24 用例。完整日志：`/tmp/nest-remove-archive-backend-green.log`。

- AC24-04：新库默认公开/站主无 projects、读取不落库；无 projects 保存后的公开/站主/数据库一致；关闭并重建应用后版本和 Session 保留；旧库 v7 读取前后原始文档完全一致，响应无 projects，正常保存变 v8 且数据库 content 不再含该字段；携带 projects 的首次及已有版本请求均 400，原库不变；首次及已有版本并发各一 200、一 409，冲突不覆盖胜者。
- AC24-05：图片 POST 的站主/普通用户/匿名/缺 CSRF/未配置站主/JSON 请求均 404，无媒体或配置写入。临时目录直接放入 PNG/JPG/WebP 历史文件，公开 GET 返回原字节、正确 MIME 和 nosniff；非法名称/路径 400，缺失文件 404。
- 音频 MP3（含 ID3）、WAV、Opus/Vorbis OGG 上传/GET 通过；伪造或高位签名、截断容器、视频 OGG、错误 MIME、空文件、额外表单字段均拒绝。15MiB 精确边界允许，超限拒绝。Session/Owner/CSRF 拒绝均不落媒体或配置。
- 全套原有认证、任务隔离、任务 HTTP 与受控站主初始化均通过；不把该后端证据扩展为前端浏览器验收。

## 隔离与自审

- 每条测试沿用真实 AppModule、正式配置入口与真实 Mongo 连接，数据库名严格限制为 `awei_e2e_` + UUID；重启用例只保留同一个临时库，再由 afterEach 删除。文件都写到 `mkdtemp` 生成的 `nest-site-test-` 临时目录并清理，没有向开发数据库或历史媒体目录写入。
- 自审逐文件对比任务前快照：只修改 7 个站点源码文件、删除 1 个图片拦截器、更新站点测试并新增本文。中文学习注释同步保留；未修改依赖、认证/任务模块、全局配置或前端。
- 检查 `backend/src` 已无 `SiteProject`、`ProjectDto`、`.projects`、`coverUrl`、`demoUrl` 或图片拦截器引用。当前保留图片扩展名只用于历史 GET，符合 P24。
- 自审未发现本次阻塞项。分配范围外 `backend/src/app.setup.ts` 原有 JSON 限制注释仍提“最多30个项目正文”，已告知整合者处理；本代理未修改该文件或 2MiB 既有行为。

## 改动文件

- `backend/src/site/types/site.type.ts`
- `backend/src/site/config/site.defaults.ts`
- `backend/src/site/dto/save-site.dto.ts`
- `backend/src/site/site.service.ts`
- `backend/src/site/site.controller.ts`
- `backend/src/site/site-assets.service.ts`
- `backend/src/site/interceptors/site-audio-upload.interceptor.ts`（仅同步注释）
- 删除 `backend/src/site/interceptors/site-upload.interceptor.ts`
- `backend/test/site.e2e.test.mjs`
- 本报告

## 交接边界

本次未读取或修改开发站点的 content/version，未删除历史媒体。前端合同、公开页面、后台页面、素材和仓库总文档由其他分区整合；本报告只证明上述临时 Mongo HTTP 及源码范围。
