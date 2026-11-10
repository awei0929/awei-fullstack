# 004：磁盘文件上传独立审查

- 核对日期：2026-11-09；基准 `9b12524` 加本轮未提交工作区。
- 审查状态：首轮完成；发现的 1 项 P2 已修复并通过限定复核关闭，当前无未关闭 P0/P1/P2。
- 范围：按 [SPEC-004](../../specs/004-disk-file-uploads.md) 审查本轮所有跟踪及未跟踪文件，包含新验证器、拦截器、HTTP 测试、前端上传配置/helper/UI/style 与两份实施报告；没有把 `git diff` 未显示的新文件排除。任务前只有 README/STATE 的部署与数据库交接属于既有改动，已与本轮上传接入段落区分并保留。
- 仅新增本报告；未改应用代码，未提交、推送或部署，未连接数据库或线上，没有重跑完整测试、lint/build 或浏览器验收。

## 发现

### R1 / P2：Markdown 的本站文件白名单同时放宽了联系入口校验（已关闭）

- 位置：首轮发现位于 [frontend/src/api/site.ts:34](../../../frontend/src/api/site.ts#L34)。修复前该默认 `link` 分支也用于 `parseSiteContent` 内的 `contact.links[].url`；后端 [LinkDto](../../../backend/src/site/dto/save-site.dto.ts#L46) 仍使用 `SiteUrl('external')`，只允许空串或 HTTP(S)。
- 触发：上传一份 PDF，复制 `/api/site/assets/<uuid>.pdf` 到「联系入口」的链接地址，再保存全部。
- 首轮实际：前端 `isSafeSiteUrl` 与完整 `parseSiteContent` 均接受这个相对路径，后端 DTO 拒绝 `contact.links[0].url`，整站保存会返回 400。新增安全链接能力扩散到配置合同，前后端接受范围不一致。
- 影响：用户依照上传区「复制到相应字段」的操作使用附件链接时，当前草稿无法保存；虽然草稿保留，但错误没有定位到联系入口。SPEC 约定仅为 Markdown 链接增加本站附件路径，应把 Markdown 与默认配置链接的校验上下文分开。
- 独立证据：在无网络请求、无数据库的 Node 脚本中，用 Vite `ssrLoadModule` 加载真实前端 `api/site.ts`，以真实后端 `defaultSiteContent()` 构造数据；插入上述 PDF 链接后，`isSafeSiteUrl=true`，`parseSiteContent` 返回成功。随后对同份数据执行 `validateSync(plainToInstance(SiteContentDto, content))`，得到唯一 `contact → links → 0 → url → siteUrl` 错误。后端 DTO 来自本轮已经构建的 `backend/dist`，并与当前源文件规则核对一致。
- 修复：原前端代理新增独立 `markdown` URL 上下文，把本站文件路径白名单移到该上下文；`SiteMarkdown` 的 href 显式使用 `markdown`，默认 `link`/联系入口恢复 HTTP(S)。修复仅涉及两处前端文件，不改上传/store/后端合同；实施者先红后绿的回归及最终 68/68、SSR 5/5、lint/build 结果见 [前端报告](004-disk-uploads-frontend.md#独立审查-p2-修复)。
- 限定复核：审阅上述两处修复后，独立运行 `node /tmp/nest-disk-upload-r1-review.mjs`，**58 项断言通过、退出 0**。使用 Vite 加载实际 API 与 Markdown 组件、真实后端默认值/DTO，确认全部 9 个本站图片/附件扩展名只在 Markdown 放行、默认链接与联系配置拒绝；图片/音频上下文保持隔离；Markdown 拒绝音频、未知后缀、查询参数、非 UUID、相对路径及 JavaScript；HTTP(S) 联系入口前后端均接受；实际组件 SSR 保留 PDF 下载链接、阻止 PDF 成为 img，PNG 正常为 img。没有 HTTP 请求、数据库连接或全量检查。
- 工具边界：首次通过 Node stdin 执行该限定脚本时，Less 的 SSR 处理受 `--input-type=module` 运行方式影响，报 `require is not defined`，当次未得出应用断言结论；改为普通临时 `.mjs` 文件执行后，上述 58 项全部通过。未因此修改应用或扩大测试范围。

除此之外，首轮范围未发现其它 P0/P1/P2。

## 规格符合性

- **后端 AC01–03/05 静态符合**：新路由显式 Session → Owner → CSRF，Nest Guard 先于 multipart interceptor；只解析一个 `file`，限制文件数/额外字段和 20 MiB 上限，服务按实际 Buffer 判断精确 5/20 MiB。扩展名白名单只取自有项，图片/PDF/ZIP 关键标记及 UTF-8 TXT 校验不依赖客户端 MIME。
- **磁盘与下载静态符合**：随机 UUID4、`wx` 禁覆盖；附件 sidecar 失败只清理本请求创建的文件。GET 文件名和扩展名受控，拒绝最终符号链接，附件正确 MIME、`nosniff`、强制下载；名称正规化、ASCII 回退及 RFC5987 编码避免头注入。缺失/损坏/超大元数据回退随机名，无元数据历史图片/音频不变，旧 POST 404 保留。进程终止留下孤立文件的边界在报告中如实说明。
- **前端 AC04–06 静态符合，R1 已关闭**：API 严格解析精确字段、UUID4 URL、MIME/kind/扩展名、正整数大小与上限；页面经 API → store 调用。统一入口、项目封面、公司/项目 Markdown 入口齐备；独立图片/附件 URL 边界与 Markdown 文件名转义保留。上传纳入 busy，阻止保存/编辑/重复上传/退出；身份版本与 active 保护迟到结果；项目按稳定 id 定位；超限在插入前判断，保留全文与可复制的上传结果。
- **接入文档 AC07 静态符合**：README 说明现有目录、读写权限、站主配置、Nginx `client_max_body_size 25m`、前后端构建和发布、后端重启、线上验证、整个媒体目录及 Mongo 备份、共享 Mongo 不共享文件。后台分区名称/入口与实现一致，明确本轮不部署。架构、SPEC/STATE 最终状态由根整合；本报告不把实施中的占位状态视作完成记录。

## 代码质量与验证边界

- 职责延续当前 SiteModule、验证器、interceptor、service 和前端分层，未增加无用途依赖或通用存储层；中文学习注释覆盖请求顺序、信任边界、失败清理与历史兼容。
- 审阅了后端报告的 19 项定向 HTTP、95/95 完整套件及前端报告最终 68 项模块、5 项实际 Markdown 渲染、lint/build 证据；这些为实施者本轮执行结果，本审查未重新运行或冒称独立复测。
- 本审查仅增加 R1 的实际源码/DTO 定向复现与修复后的 58 项直接边界断言。根独立完成随机本机库的真实浏览器验收；真实服务器权限、Nginx 与正式 HTTPS 上传未在本轮实操，不能由静态审查或本机测试推定已生效。
- 结论：R1 已修复并经独立限定复核关闭，当前无未关闭 P0/P1/P2；已审查实现与当前规格相符。复核没有扩大为新一轮全量检查。
