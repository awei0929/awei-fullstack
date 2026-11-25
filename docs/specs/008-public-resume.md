# SPEC-008 公开简历页

- 状态：待验证（PDF 正文模式；本地 Chrome 桌面/手机/深色/打印已通过，真机与正式域名未验证）。日期：2026-11-25（原 2026-11-24 结构化简历扩展、2026-11-16 版本保留在下方实际验证）。
- 首页以「查看简历」替代能力场景入口。本文替代 [SPEC-003 P28](003-personal-site.md#p28能力三卡与可配置履历弹窗2026-11-08已验证) 和 [SPEC-007](007-ui-clarity.md) 中的公开能力展示约定。

## 行为与数据

- 首页导航和主按钮直达 `/resume`。公开首页移除能力场景、切换控件、滑动触发与能力图片预载；旧 `?view=technology/company/projects` 显示首页。关于、联系、站主入口沿用既有流程。能力资料保留在后台及其独立预览，原 API 投影继续按项目公开开关过滤。
- `/resume` 可直访和刷新。存在 `resume.pdfUrl` 时，页面正文直接渲染该 PDF：顶部保留 HEY. 品牌、想法/作品/简历导航与主题切换，工具栏右侧为「下载 PDF」，正文区按页渲染 PDF（桌面 A4 纸宽、手机满宽、深色主题下保持白纸），打印时每页一张 A4。没有 `pdfUrl` 时回退为结构化内容：姓名、岗位、一句话介绍、补充信息、联系邮箱、技能组、工作经历、项目经历、教育经历，再回退 Markdown 正文，仍无内容时显示真实空态。正文无原始 HTML，手机单列，打印白底黑字；PDF 加载失败可重试或下载，读取失败可重试。
- 后台「简历」通过原版本化官网草稿保存，右侧预览展示同一页面。PDF 复用 [SPEC-004](004-disk-file-uploads.md) 上传，20 MiB，成功后写入草稿，可替换或清除引用。上传后文件即公开，页面引用在保存后生效。失败保留草稿和现有链接。
- 两个 GET 通过 `?include=resume` 返回 `resume`。基础四字段保持不变：`{ name, role, body, pdfUrl }`，旧文档缺失时只读补四个空字符串；新增结构化字段全部可选，旧编辑器省略时不会被写入，读取端回退为空数组/空串。
- 结构化字段及上限：`summary` 600 字、`meta` 60 字；`skills` ≤12 组（`label` 40 字、`items` ≤20 条×60 字）；`experience` ≤12 段（`company`/`role` 80 字、`period` 40 字、`summary` 600 字、`highlights` ≤12 条×240 字）；`projects` ≤12 个（`name` 100 字、`role` 80 字、`period` 40 字、`summary` 600 字、`tech` ≤16 条×40 字、`highlights` ≤12 条×300 字）；`education` ≤8 条（`school` 100 字、`major` 80 字、`period` 40 字）。
- PUT 分区存在时须完整，姓名最多 60 个 Unicode 码点、岗位最多 80、正文最多 20000，PDF 地址须为空或本站 UUID v4 `.pdf` 附件路径。含简历的 PUT 返回更新后的简历，旧编辑器省略分区时保留已存简历和旧响应格式。保存/读取时会剔除结构化字段中的 `null/undefined`，避免旧客户端把可选字段写成 BSON null。Guard、版本 409、Mongo 集合和媒体服务复用。

## 验收与实施清单

- [x] AC-01：首页导航、主按钮、手机菜单与浏览器返回到位；公开旧能力直达链接和手势均无法打开场景。修改 `frontend/src/pages/site` 和路由，浏览器桌面与窄屏实测。
- [x] AC-02：直达 `/resume`，空态、正文、联系、文件及加载失败重试正确。新增 `frontend/src/pages/resume`，复用站点状态和 Markdown；浏览器读正文和下载。
- [x] AC-03：后台录入、预览、上传、替换或清除、保存和刷新。扩展 `frontend/src/pages/admin` 与文件上传草稿目标，验证未保存时公开页无变化。
- [x] AC-04：在隔离 MongoDB 中验证旧记录只读默认、旧客户端保存保留字段、完整保存、非法字段、权限和下载。先扩展 `backend/test/site.e2e.test.mjs`，确认失败后实现 `backend/src/site`；运行后端 HTTP、前端 lint/build 和差异检查。
- [x] AC-05：后台可维护结构化简历（技能/工作/项目/教育/补充正文），保存后公开页与预览同步；旧四字段简历仍可读取、保存与展示；非法空条目/超长条目被拒绝。浏览器桌面/手机/深色与打印样式已验证。
- [ ] AC-06：上传并保存新 PDF 后，访问 `/resume` 无需重新录入结构化字段即可看到新 PDF 的每一页；手机满宽可读、深色主题正常、打印每页一张 A4、「下载 PDF」拿到原文件；清除 `pdfUrl` 后回退结构化内容；PDF 加载失败显示重试与下载入口。本地 Chrome 已验证，真机与正式域名待验证。

## 实际验证

- HTTP（AC-04）：隔离 MongoDB `127.0.0.1:27019`。新增测试先在无简历及无旧客户端兼容版本失败。最终 `MONGODB_URI=mongodb://127.0.0.1:27019 npm test --prefix backend` 152/152，10 套通过，覆盖只读默认、旧请求保留、版本冲突、非法分区与 PDF 路径，以及现有权限和附件边界。
- Chrome（AC-01/02）：1440×960 首页主按钮、浏览器返回、关于弹窗，三个历史能力直达链接不打开场景且未请求能力图片。1440×900 默认动效下用首页导航进入。320×568、390×844 通过手机菜单直达，一列正文可滚至末尾，两种宽度无全页横溢出，返回首页可用。简历直接访问、标题焦点、初始空态、失败重试及刷新通过。
- Chrome（AC-02/03）：隔离站主登录后填写真实简历正文和公开邮箱，预览实时出现，保存前公开页保持空白。拒绝 TXT 后上传合成 PDF，保存后浏览器下载正确中文名且字节一致。替换与移除引用保存、刷新通过。能力资料的站主预览正常打开。合成测试附件已清理。
- 静态检查：前端 lint/build、`git diff --check` 通过。独立审查发现的旧响应、历史作品字段清理与 Markdown 缩进保真问题已修正。
- 站主提供的正文采用 `mdContent`，保留两段经历、四个项目、技能和教育。姓名、岗位与公开邮箱进入本地预览。手机号、出生年份、性别及薪资留在原稿。正文独立保存在本地，实际内容仅写入隔离预览库。真实 PDF 待提供，未验证真机、其他浏览器或正式域名。

## 2026-11-25 PDF 作为简历正文

- 问题：后台替换简历 PDF 并保存后，公开页正文仍来自结构化字段，只有下载链接变化；用户需要「换一份 PDF，整页跟着变」。
- 决策：采用「PDF 即正文」而不是「PDF 解析回结构化字段」。结构化字段保留为 `pdfUrl` 为空或清除引用时的回退，后台仍可编辑，但不再驱动有 PDF 时的页面。
- 实现：新增 `frontend/src/pages/resume/pdf-document.tsx`，用 `pdfjs-dist` 6.5.438（路由级懒加载，worker 以 `?url` 资源输出）把 PDF 渲染为 canvas，固定 2 倍分辨率；`frontend/src/pages/resume/index.tsx` 按 `pdfMode` 切换正文与工具栏动作，`style.module.less` 增加 PDF 容器、手机、预览、打印样式。PDF 地址仍走 SPEC-004 上传与 `isSiteResumePdf` 校验，接口和数据结构未变。
- 取舍：页面不再输出简历文字（SEO 与文本选择交给 PDF 本身），深色主题下 PDF 保持白纸；PDF 内的手机号、期望薪资等内容会随文件一起公开展示，需在导出 PDF 时自行处理。后台「简历 PDF」分区补充说明，提示上传保存后正文直接使用 PDF。
- 影响文件：`frontend/src/pages/resume/index.tsx`、`frontend/src/pages/resume/pdf-document.tsx`、`frontend/src/pages/resume/style.module.less`、`frontend/src/pages/admin/editors.tsx`、`frontend/package.json`（新增 `pdfjs-dist`）。
- 验证（静态）：`npm run lint` 0 警告 0 错误；`npm run check` 通过；`npm run build` 通过，`pdf.worker.min-*.mjs` 产物存在，PDF 代码只进入 `resume` 分块。
- 验证（Chrome，本地 `dist` + 反向代理线上只读 API）：1440 宽显示 3 页 canvas（1192×1686）；390×844@2x 手机满宽、工具栏不溢出；深色主题白纸正常；打印为 3 页 A4（209.9×297.0mm）；移除 `pdfUrl` 回退结构化页（标题、导出 PDF、技能/经历分区正常）；无控制台报错。

## 2026-11-24 结构化简历扩展

- 数据来源：`/Users/awei/Desktop/李武伟简历-5年.pdf`（3 页）；公开站保留姓名、岗位、学校/专业、工作与项目内容、邮箱，不写入手机号、性别/出生年份与期望薪资。
- 后台新增技能组、工作经历、项目经历、教育经历与补充 Markdown 编辑；`frontend/src/pages/admin/fields.tsx` 的 `LinesField` 负责多行条目，失焦提交避免输入被父级重渲染吞掉。
- 公开页 `frontend/src/pages/resume/index.tsx` 与 `frontend/src/pages/resume/style.module.less` 改为文档式排版：A4 纸张宽度、白纸/深色纸张随主题、页边距、姓名/岗位/联系/摘要、专业技能/工作/项目/教育分区、页脚；顶部复用首页的 HEY. 品牌、想法/作品/简历/关于导航、主题切换，右侧为「导出 PDF」。`导出 PDF` 调用 `window.print()`，`@page size:A4` 与打印样式输出白底黑字；`PDF 附件` 仍指向已上传原文件。打印版为 3 页。
- 数据：站点 version 11，`resume` 已填充 6 个技能组、2 段工作、4 个项目、1 条教育，`contact.email=IUya0929@163.com`；PDF 已复制到 `backend/.data/site-assets/cfc300e3-7e3f-4501-a133-34df46e98745.pdf`，公开地址 `/api/site/assets/cfc300e3-7e3f-4501-a133-34df46e98745.pdf`。备份 `/tmp/site-content-backup-before-resume.json`。
- 验证：`site.e2e.test.mjs` 35/35（新增结构化字段保存/公开/非法条目测试）；后端 178/178、13 套件；前端 check/lint/build 通过（85 files）；Chrome 1440/390/320 无横向溢出，深色/浅色、sticky 与打印样式通过；打印导出 `/tmp/nest-resume-export.pdf` 为 3 页、约 654K；截图 `/tmp/nest-resume-unified-light.png`、`/tmp/nest-resume-unified-dark.png`、`/tmp/nest-resume-unified-mobile.png`。
- 边界：真实站主登录后的后台编辑器保存/预览尚未在本轮浏览器验证；PDF 上传替换与正式域名未验证。
