# 004 后端：磁盘公开文件上传

- 核对日期：2026-11-09；基准：`9b12524` 加本轮未提交改动。
- 状态：T1 实现与后端 HTTP 验证完成，交根整合/独立审查；整项任务状态以 [SPEC-004](../../specs/004-disk-file-uploads.md) 和 [STATE](../STATE.md) 为准。
- 范围：仅修改 `backend/**` 与本报告，保留开始前 README/STATE 的用户改动；未提交、推送或部署。

## 结果与工程取舍

- 在原 `SiteModule` 增加 `POST /api/site/file-assets`，沿用 `SessionGuard → SiteOwnerGuard → CsrfGuard`，Guard 之后才解析唯一 multipart `file`。缺文件、额外字段、重复文件、未知字段、非法内容/大小统一 400。
- `SiteFileUploadInterceptor` 只做内存解析与 20MiB 总上限，`validation/site-file.ts` 负责白名单、实际内容签名及显示原名；`SiteAssetsService` 校验后写盘。未新增依赖或通用存储抽象。
- 响应为严格 `{url,name,mimeType,size,kind}`，字节数来自 Buffer；MIME 由后端判定，不要求浏览器提供特定 MIME。扩展名需与内容一致，JPEG/JPG 统一存为 `.jpg`。图片 5MiB，附件 20MiB，等于上限允许。
- 文件继续存于 `SITE_ASSETS_DIR`，URL 仍是 `/api/site/assets/<UUID v4>.<ext>`。上传不会调用配置保存或改变 Mongo 站点文档/版本，公开链接立即可访问。
- 数据文件使用独占 `wx` 和随机 UUID，附件原名存在同目录 `<随机文件名>.json`；文件与元数据写入/关闭失败时，只清理本请求已创建的文件。碰撞不会覆盖或删除原资产。
- GET 只接受 UUID v4 和明确扩展名，不跟随最终文件/元数据的符号链接。图片和旧音频维持媒体返回，附件设置正确 MIME、`nosniff` 和 `Content-Disposition: attachment`。ASCII 回退名移除引号/反斜杠，UTF-8 参数独立编码，不能将原名直接拼接到请求头。
- 原名恢复浏览器 multipart 的 UTF-8，去除目录、控制字符和双向覆盖符，最多 150 Unicode 字符并保留扩展名；损坏 Unicode 正规化，防止下载头编码失败。元数据缺失、损坏、超大（大于4096字节）、类型错误或不可读时，用随机文件名下载。
- 原音频上传合同、无元数据历史图片/音频及旧 `POST /api/site/assets` 的 404 保留。`.env.example` 说明媒体格式、持久目录和整目录备份；未读取或修改真实 `.env`。

## 文件

- `backend/src/site/site.controller.ts`：新增上传路由与安全附件响应头。
- `backend/src/site/site-assets.service.ts`：验证后写盘、元数据、失败回滚及公开读取。
- `backend/src/site/interceptors/site-file-upload.interceptor.ts`：唯一 file、内存解析上限。
- `backend/src/site/validation/site-file.ts`：格式白名单、签名与原名清理。
- `backend/src/site/types/site.type.ts`：上传原名与公开结果类型。
- `backend/.env.example`：持久目录与备份注释。
- `backend/test/site-files.e2e.test.mjs`：19 个真实 HTTP 用例，独立临时 Mongo 库/媒体目录。

## 验证证据

全部数据库测试通过 `.local/upload-tests/run-local.mjs`。该包装器仅复用切换线上前的本机配置，先核对目标严格为 `127.0.0.1:27017` 并 ping，再向子进程注入 `MONGODB_URI`；未沿当前 `backend/.env` 的线上隧道连接运行测试。各用例继续沿用 `startApp/stopApp` 的随机 `awei_e2e_<UUID>` 库名校验与清理。

| 阶段 / 命令 | 实际结果 |
| --- | --- |
| 先新增最小真实 HTTP 用例：`node .local/upload-tests/run-local.mjs node --test backend/test/site-files.e2e.test.mjs` | 1项失败，预期201、实际404，证明接口尚缺失；之后才写实现 |
| 扩展缺失行为用例再执行同命令 | 12项失败，主要为 `/file-assets` 缺失404；后续补上重启用例的显式上传状态断言，避免无URL造成次生错误 |
| 审查提醒对象原型白名单后：`node .local/upload-tests/run-local.mjs node --test --test-name-pattern=对象原型 backend/test/site-files.e2e.test.mjs` | 先观察 `fake.constructor` ZIP 被接受201、预期400；改为只读 `Object.hasOwn` 白名单，随后通过 |
| 补损坏元数据：`node .local/upload-tests/run-local.mjs node --test --test-name-pattern=损坏Unicode backend/test/site-files.e2e.test.mjs` | 先观察孤立 surrogate 造成 GET500、预期200；原名正规化后通过 |
| 构建与最终定向：`npm run build --prefix backend`，然后包装器运行 `node --test backend/test/site-files.e2e.test.mjs` | build退出0，19/19、1套件通过 |
| 最终完整：`node .local/upload-tests/run-local.mjs npm test --prefix backend` | 退出0，含构建，95/95、6套件，0失败/跳过；完整日志 `/tmp/nest-disk-upload-backend-final.log` |
| `git diff --check` | 退出0 |

19项用例覆盖：图片/PDF/ZIP/TXT/三种Office、空/通用客户端MIME、内容和GET字节一致、无站点文档/版本变动；游客401/普通用户403/缺站主403/错误CSRF403；空文件、错签名、扩展名不匹配、危险/未知类型、二进制TXT、原型键扩展名、非法multipart与控制字符；PNG精确5MiB/PDF精确20MiB允许、各+1及21MiB拒绝；8次同名并发路径独立；长中文名、路径清理/安全下载头；同库同目录关闭重建应用后仍可读、历史图片/WAV和旧POST404；路径穿越、元数据端点不可访问；损坏/超大/Unicode元数据、符号链接拒绝；真实目录不可写500后可重试、真实元数据创建冲突回滚、固定UUID碰撞不覆盖旧文件。

固定 UUID 的一项测试只替换随机数源以布置可重复磁盘冲突，HTTP、Guard、文件写入与回滚都走真实实现，并在 finally 恢复；其余用例不替换存储。磁盘权限测试在当前本机普通用户环境执行，证明该环境权限失败路径，未泛化为所有操作系统/运行账号。

## 已知边界与交接

- 本轮没有图片解码、PDF解析、压缩包解压或病毒扫描；图片/PDF按签名/容器关键标记验证，Office仅验证ZIP容器和扩展名，不能保证可打开或安全执行。TXT要求有效UTF-8，允许换行/制表符，拒绝二进制控制字符。
- ZIP当前只接受普通单卷ZIP，核对尾记录、中央目录及本地头边界；拒绝分卷和ZIP64，不验证每项CRC或解压后的数据。已用独立生成的非空ZIP、损坏目录/分卷/ZIP64 HTTP反例验证。
- 文件与sidecar为两次磁盘写入，正常I/O错误已验证回滚；进程被杀/断电或清理权限同时丢失可能留下孤立文件，不承诺跨文件事务或自动回收。元数据缺失仍能安全下载。
- 本轮未新增列表、删除、未引用清理或私密访问；上传失败通常不写盘，已成功上传的未引用文件继续保留。部署/回滚/备份须保留整个媒体目录。
- 真实服务器磁盘权限、Nginx请求体限制、正式HTTPS上传及跨系统文件权限未实操；交根提供接入步骤并记录。浏览器、前端安全Markdown与保存后的公开行为由T2/T3负责，不能以本报告HTTP结果代替。
