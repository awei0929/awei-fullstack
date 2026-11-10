# 004 T2：文件上传前端

- 核对日期：2026-11-09；基准 `9b12524` 加本轮未提交改动。
- 状态：前端实现、定向模块检查、lint/build 已完成；真实浏览器验收由根任务使用独立本机 fixture 完成，不将模块模拟写成浏览器通过。
- 范围：仅 `frontend/` 与本文；保留原 README/STATE 等改动，没有改真实环境配置、连接数据库、登录真实站主、提交、推送或部署。
- 权威合同：[SPEC-004](../../specs/004-disk-file-uploads.md)，对应 AC04–06，并支撑 AC05 的安全 Markdown 展示。

## 实现

- `api/site.ts`：新增 `uploadSiteFile`，只向 `/site/file-assets` 发送一个 multipart `file`，沿用同源 Cookie、CSRF 和错误解析；不手工设置 multipart Content-Type。`parseSiteFileAsset` 对精确字段、UUID v4 本站路径、显示文件名、kind/MIME/扩展名对应关系、整数大小和 5/20 MiB 上限作运行时验证。
- `config/site-files.ts`、`utils/site-files.ts`：集中允许扩展名、MIME 与大小限制；客户端依据扩展名和大小提前提示，不把客户端 MIME 当作文件内容校验。空 MIME 图片可以交给服务端核验。通过 `Object.hasOwn` 排除原型属性扩展名。文件名生成 Markdown 时转义特殊符号。
- `store/site-admin.ts`：文件上传纳入现有 busy 互斥、CSRF 恢复、站主权限错误和身份版本机制；上传中禁止保存、其它上传、草稿编辑和刷新。成功只改对应公司字段或稳定项目 id 的草稿，不改站点版本。失败保留原封面/正文；页面停用或身份变化丢弃迟到结果；停用后不接受新上传。
- 公司三段正文和项目正文提供图片/附件上传，成功追加至对应正文末尾。超出 10000/20000 字时原文完整保留，同时展示可复制的上传地址和 Markdown。封面入口只允许图片。按入口预期类型复核成功响应，类型不符时不改原内容。
- `pages/admin/file-upload.tsx` 与样式：复用统一上传控件和只读可选择的上传结果；新增「文件上传」分区，说明支持格式、大小、文件公开可访问、未保存/隐藏也不保密、引用仍需保存全部及不提供文件清理。各内嵌入口也保留公开访问与保存提示。
- `isSafeSiteUrl`：专用 `markdown` 类型允许严格本站图片/附件 UUID 路径，默认 `link` 类型继续只接受 HTTP(S)，保持联系入口合同；图片和音频各自的路径白名单保持独立。原音频上传入口及合同保留；Markdown 继续禁用原始 HTML，附件路径不能作为图片加载。

## 实际验证

没有新增测试框架、依赖或前端 `test` 脚本。临时 Node 脚本使用现有源码与 Node `stripTypeScriptTypes` 加载 API、helper、store，使用真实 MobX，只替换网络响应；不发真实请求。

1. 实施前运行 `node --disable-warning=ExperimentalWarning /tmp/nest-upload-frontend-check.mjs`：**0 通过 / 3 失败**。失败分别是本站附件链接被拒、文件结果解析器缺失、store 上传方法缺失，属于预期缺失行为。
2. 扩展检查后，整合者指出 `a.constructor` 可能命中白名单原型：先调用实际 `siteFileValidationError` 得到 **62 通过 / 1 失败**，期望格式错误但返回空字符串；改为自有属性检查后转绿。
3. 自查追加「停用 store 新上传」与「附件入口收到图片结果」反例，实际得到 **63 通过 / 2 失败**；分别补活动状态前置判断与对称的预期类型校验后，最终 **65 通过 / 0 失败**，退出 0。
4. 上述 65 项包括严格结果解析、恶意/外部/非 UUID/查询参数路径、所有六种附件链接与图片/音频隔离、边界大小、扩展名与 MIME、Markdown 文件名转义、唯一 multipart 字段及 CSRF、统一区不改草稿/版本、公司/项目定向插入、封面定向替换、失败保留与重试、长正文不截断并保留上传结果、busy 互斥、页面停用/身份变化迟到保护、CSRF 失败保留草稿、目标缺失不写其它项目。
5. `node /tmp/nest-upload-markdown-check.mjs`：通过 Vite `ssrLoadModule` 加载实际 `SiteMarkdown` 与 helper，再用 React 的服务端渲染检查，**5 通过 / 0 失败**。确认恶意形状文件名只渲染一个正确下载链接、本站图片正常、附件不能成为 img、HTML/JavaScript 不执行、任意相对链接不成为可点击链接。该验证是实际组件渲染，不是浏览器操作。
6. `npm run lint`（frontend）：最终退出 0，无警告。初次的 observer 组件识别及控制字符正则警告已清理。
7. `npm run build`（frontend）：最终退出 0，包含 TypeScript 检查与 Vite 生产构建。
8. `git diff --check`：退出 0。

### 独立审查 P2 修复

- 根审查发现最初把本站附件路径加进默认 `link` 白名单，联系入口也复用该类型，造成前端解析通过但后端保存 400。先对实际 `parseSiteContent` 添加“contact.links 包含本站 PDF 路径必须拒绝”的反例，得到 **65 通过 / 1 失败**（Missing expected exception），确认问题。
- 改为独立 `markdown` URL 类型，仅 `SiteMarkdown` 的 href 使用；联系入口默认 `link` 恢复 HTTP(S)。更新原附件安全 URL 用例使用 `markdown`，补默认 link 拒绝本站图片及联系入口 HTTP(S) 兼容检查。
- 修复后实际 API/helper/store 检查最终 **68 通过 / 0 失败**；实际 Markdown SSR **5 通过 / 0 失败**；再次 lint 无警告、build 与 `git diff --check` 均退出 0。仅修改 URL 类型边界与 Markdown 调用，没有修改上传控件、store、后端或数据。

## 交接与未验证边界

- 根任务仍需桌面/390 手机真实浏览器验证统一入口、项目封面、公司/项目正文、取消选择、忙状态与错误重试、长正文可选择复制、保存/刷新公开展示及真实附件下载。本文不代替根验收记录。
- 本任务没有操作浏览器剪贴板；界面提供只读文本框，聚焦后全选，用户可自行复制。没有自动下载文件列表或后台资产管理。
- 与后端代理已核对 MIME：TXT JSON 返回 `text/plain`，GET 允许响应额外 charset；JPEG 统一 `.jpg`；其它严格 MIME 与小写 UUID4 URL 一致。
- 未运行后端套件，没有访问线上站主或实际服务器媒体目录。正式目录权限、Nginx 限额、部署及线上上传仍属于交付说明/后续发布范围。
