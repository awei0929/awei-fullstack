# P28 能力三卡与详情整合

- 日期：2026-11-08；基准提交82acde8，大量既有未提交改动保留。
- 本次开始前源码快照：`/tmp/nest-capability-details-before`。
- 权威范围与实施清单：SPEC-003 P28。沿用用户明确的三卡与弹窗设计，不重复设计批准；保持当前分支和工作区，不提交、推送、部署，不改开发数据库。
- 分工：根代理负责公开三卡、详情弹窗、共享Markdown与整体浏览器验收；后端代理负责DTO/兼容/公开投影及HTTP；配置代理负责前端类型/API/预览合同/站主编辑器。各代理只改约定文件。
- 状态：已验证，临时fixture已清理，文档已回写。

## 本轮实现

- 公开三卡、独立技术四区与公司/项目目录详情；原技术配置/昵称/排序保留。独立iframe使用原生modal，父页可继续编辑，dialog本体局部留白不关闭，背景外侧/按钮/Esc/历史返回仍可关闭。
- Markdown使用react-markdown+remark-gfm，原HTML忽略；URL与图片限制HTTP(S)/受控本站图片。SVG logo加奶油背板，卡片层级在轨道上方以保护正文；共享850ms时钟/三环保留，窗口数同步减为3。
- 同一Mongo版本化配置新增详情，PUT必填、旧GET只读默认，公开端服务端剔除隐藏项目。主开发API本轮前后均v6、公司空/项目空，未写真实内容。

## 实际验证（2026-11-08）

- 后端TDD定向8项先红后绿，最终76/76、5套件、0失败/跳过，含build；结果由后端代理运行，源文件之后未改。详见后端报告与/tmp/nest-capability-details-backend-final.log。
- 前端最终lint无警告、build退出0；实际API19/19、编辑器8/8、保存定位4/4模块模拟通过（不是浏览器）。根重跑API19与编辑器8均通过。当前无正式前端test脚本。
- 旧源码快照的实际CapabilityContent静态渲染断言三卡先红4!=3，当前变绿；实际Markdown静态渲染标题/列表/表格/代码、原HTML/危险协议拦截、安全外链与hidden空态通过；脚本/tmp/nest-p28-render-check.cjs。
- 深链API错误回归：实际SitePage/SiteExperience TSX SSR只mock无关环境hook，先红“能力弹窗内必须显示API错误”，实现后绿：模态内错误/重试且不误报为空。脚本/tmp/nest-p28-load-check.cjs；不冒充真实断网浏览器。
- Chrome主开发1920与1440：恰好三卡、真实九项技术仍保留、技术modal宽960px无横溢出、blur backdrop、打开暂停三环、Esc关闭回焦已实测。公司背景/项目空态可读。
- Chrome隔离5174/3001：公司Markdown三目录切换、项目默认首项/切第二项保持弹窗、hidden不见、坏图fallback、表格与长代码局部滚动；技术12项与40字昵称均可读取。
- Chrome390×844/320×740：详情坐标0,0且充满viewport，目录可横向滚动，页面/dialog无横溢出；390能力人物/横卡、390后台三Tab/项目列表和预览无横溢出。
- Chrome后台1440：iframe内开技术modal后，父页连续改介绍，modal内容实时更新且不关闭。公司名/公司MD、项目新增/填写MD/上移在UI保存v2成功；切其它Tab后保存空项目名自动回公司项目并聚焦；刷新读回公司内容。公开HTTP读v2四可见项目且无hidden-secret。
- 审查两处P2已修复并定向关闭：错误态误作空态；dialog padding误关闭。后者Chrome点225,100（dialog bounds220,32,1000,836）修前关闭→修后modalStillOpen=true。无未关闭P0/P1/P2，报告见003-capability-details-review.md。
- npm安装后audit报告2个moderate均来自既有react-router(-dom)，新增Markdown包无对应审计项；未混入路由升级。

## 边界与清理

- 未实操OS级reduce、真实手机touch/软键盘、多浏览器、浏览器断网/409注入；reduce静态核对，错误与409由HTTP/实际模块模拟证据覆盖，不扩大成浏览器全覆盖。
- fixture仅随机awei_e2e库与隔离媒体；测试后台会话已UI退出。浏览器cookie按host而非端口隔离，本轮127.0.0.1临时登录不保证保留原站主登录状态，未读取或重建原凭据/会话；正式v6内容无变化。
- 未提交/推送/部署/换分支/worktree，保留全部既有用户改动。主3000起始未监听导致502，根已恢复开发watch服务；5173原服务保留。

- 清理已完成：fixture会话22935退出0并输出P28_FIXTURE_CLEANED；只读Mongo审计确认随机库不存在，隔离媒体与Vite缓存不存在，3001/5174无监听；主3000/5173仍运行。审计/tmp/nest-p28-fixture-cleanup-audit.json，详细清理见后端报告。
- 最终截图已保存为evidence/capability-three-cards-v13.jpg与capability-technology-dialog-v13.jpg，均主v6真实内容；浏览器保留正式能力页，viewport reset已调用。SPEC/README/架构/STATE及任务报告链接已核对，git diff --check通过。

## 最终源码校验值

本轮验证后记录SHA256，不包含旧功能的所有文件：

- `frontend/src/pages/site/index.tsx`：`fc8f3a37b9df5b6660f5c0968e6005a35aa0e2f4bade9f74842a8ac18aa171af`
- `frontend/src/pages/site/capability-content.tsx`：`9cf851b5975b8cbb8638c93e6622bcfd6f0dd88ff940f055939429ee634bc17d`
- `frontend/src/pages/site/capability-details.tsx`：`7ef0883eead31ae925772a7a50f415a2cc2c2ca1a07be69107b029ae9d3d2680`
- `frontend/src/components/site-markdown/index.tsx`：`a8f92ea5fde7da43a9deb88e4e8100ba197ce0860a0c00c949c9192f5665623c`
- `frontend/src/api/site.ts`：`77eea839188e4ead62ecf9072159f1c25129dce5f93db1681347d555b2562379`
- `frontend/src/pages/admin/capability-details-editor.tsx`：`3721d776fb257517d6f70980efcba95ad6afc16d22b2d2f1b5581c4940d5873a`
- `backend/src/site/site.service.ts`：`ba0dc79d84c5b15134c497c044b860101bd61c8ef015957834ea6f659f2e21a0`
- `backend/test/site.e2e.test.mjs`：`acb810d927c24bfd84ad375db048ced26e98568ada7697617ac8f130546e0a99`
