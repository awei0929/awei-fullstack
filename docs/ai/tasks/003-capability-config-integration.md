# SPEC-003 P19：我的能力配置整合

- 核对日期：2026-11-07（Asia/Shanghai），基准82acde8、当前未提交工作区。保留任务前已有官网/认证/文档改动，以及并行P18/P20人物与光圈更新。本轮无提交、推送、分支/worktree或部署。
- 当前状态：C1–C4完成，独立审查两项P2已关闭；合同、实施与验收在[SPEC-003 P19](../../specs/003-personal-site.md#p19我的能力站主配置2026-11-07)。

## 整合范围

`frontend/src/types/site.ts`增加固定四组能力类型；`config/site-capabilities.ts`提供38项目录、原九项默认和白名单本地URL；`api/site.ts`在运行时严格验证组形状、字段、图标、昵称、数量和组内唯一。旧分区完全缺失才默认，显式空组不回填。两端白名单/默认、38项本地文件存在性通过实际模块断言。

公开`site/index.tsx`仅增加加载占位空组与capabilities传参，保持并行光圈修改；公开卡片直接订阅MobX共享草稿。后台独立编辑器、Tab和Select沿用现有草稿及整站保存。审查修复新增AdminPage保存前昵称定位，让从隐藏Tab/其它分区/手机预览保存都能回到可见昵称输入；内列表只拦纵向滚动，水平交给横卡。

## 实际验证

- 后端：实现者先运行新增真实HTTP红测5项全失败；最终72/72、5套件通过，0失败/跳过/取消，含构建和重启持久化。根读取最终日志确认，后续仅前端变更，未重复后端测试。`/tmp/nest-backend-capabilities-final.log`。
- 根最终重新运行前端lint/build均退出0，无lint警告/大块警告，build含TS；`/tmp/nest-capability-config-frontend-final.log`。前端无test脚本/新测试框架。
- 根实际API模块从红测开始，最终22/22；比较JSON消除测试VM原型差异，未因此改产品代码。`/tmp/nest-capability-config-api.test.cjs`及red/green日志。根重新执行实际UI模块18/18、实际AdminPage保存定位7/7，脚本分别`/tmp/nest-capability-ui-check.mjs`、`/tmp/nest-capability-validation-check.mjs`。模拟使用轻量展示边界替身，不等价DOM/浏览器。
- 图标39/39可解析、viewBox有效、仅被动元素、无活动/外链；38可选+旧兼容文件，来源、固定下载版本、使用说明和SHA256有逐项清单。沿用[图标报告](003-capability-icons.md)，不将其当根重新执行。

浏览器用当前Chrome，真实DOM与原生操作：

| 范围 | 实测结果 |
| --- | --- |
| 编辑与预览 | 独立临时站主登录；四Tab、图标搜索Cursor、明确添加、排序、连续昵称预览、换ChatGPT保留自定义昵称并恢复Codex、跨Tab保留、已用选项禁用 |
| 保存与公开 | 部署删空保留空态，整站保存v1，新的公开访问同步昵称/次序/空组，本地图标全部加载 |
| 并发与边界 | 隔离HTTP另写v2（12项/40字后端名单）；旧后台改昵称保存出现冲突提示，输入保留；后台12项禁用添加 |
| 昵称P2 | AI清空→其它Tab保存无提示，已红复现；修复后桌面从首页保存自动切能力/AI、焦点在可见昵称、原生必填提示；390手机从预览保存自动回编辑/AI并显示同提示 |
| 滚动P2 | 390原列表双轴contain起点水平scroll外层5→5，标题5→493；修复后按实际DOM列表坐标起滑，外层5→493、scrollY不变。原生水平scroll不是实际手机touch |
| 长列表 | 390手机后端12项全在DOM，列表高85/内容284、End后scrollTop199可见末项redis；320无整页横溢出、列表clientWidth=scrollWidth=189；桌面名单高108/内容440、宽129无内横溢出 |
| 正式开发页 | 开发库公开v5未改，四组3/3/2/1，本地九图标全加载；5173能力场景正常，动效开 |

手机尺寸390×844、320×740，桌面当前1318像素宽；视口override重置且所有隔离测试标签关闭，正式官网能力页保留。未测真机触摸/软键盘、Safari/Firefox/Edge、真实断网或会话过期注入；权限/异常/重启证据分别来自真实HTTP和已有store边界，不扩大浏览器覆盖。

## 环境清理与证据

隔离服务localhost:5174/3001使用随机`awei_e2e_`Mongo库和临时空媒体目录，真实测试账号仅属于该库。已从UI退出测试会话并关闭临时标签，停止服务后端口均无监听。信号停机与测试清理重叠导致一次MongoClientClosedError；后续独立审计没有匹配测试fixture的残留库，空媒体目录已删除。原开发watcher在并行构建期间停止监听，重启相同`start:dev`命令后3000/5173均恢复，公开仍v5；未清理或重置开发数据。

历史验收截图已于2026-11-08按用户要求清理；以上编辑、保存、名单长内容与窄屏验收使用隔离测试数据，最终正式开发页只读核对九项内容。文字结果与原有验证边界保留。

独立[审查报告](003-capability-config-review.md)规格/质量均通过，无P0/P1/未关闭P2。README、架构、SPEC、STATE已同步。后续由站主进入`/admin → 我的能力`选择自己的展示列表。

## 后续：导入恢复与品牌色（2026-11-07）

用户报告后台Vite/TS导入错误，真实复现悬空`use-orbit-card-windows`导致TS2307及模块500。并行光圈任务补齐模块后又重构为`use-orbit-occlusion`；根未覆盖其实现，核对当前所有入口相对导入存在，TS/build与模块HTTP200。公开与正式已登录后台均无错误遮罩。

按用户希望直接用官网SVG的要求，将13文件（12选项+openai兼容）升级为品牌官方资源，来源/变换明确记录，不宣称全38都来自官网。Codex仍使用所属OpenAI官方Blossom fallback，只裁紧viewBox保证小尺寸清晰，原路径和颜色不变；ChatGPT用官网favicon。公开/Select两处全白滤镜移除，浅底保留品牌原色并保证黑mark可见。

用户继续反馈无颜色后，再补21项原色表示：固定Devicon original17项、Lobe Gemini color、3项按固定Simple Icons元数据hex着色，保留独立mark而不改横wordmark；13官方文件哈希保持不变。现38项为30品牌色+8黑白，39SVG总302532B。Ollama/Express/GitHub/Next/Vercel与Codex/ChatGPT/Cursor维持黑白表示。

最终build含TS退出0，日志`/tmp/nest-brand-colors-final-build.log`；两处样式未再变化，沿用本轮早先lint通过，未重复后端HTTP。39本地SVG请求全部200且image/svg+xml，首页模块200。Chrome真实后台只读打开四Tab/Select，56技术图均完成加载、filter=none、无overlay、保存按钮disabled；截图`../../designs/personal-site/evidence/brand-colors-admin-v9.jpg`。本轮观察到用户真实配置已自行保存v6（前端React/Vite/TypeScript），没有改其数据或退出其会话。独立[官方/颜色审查](003-capability-official-svg-review.md)与[来源报告](003-capability-icons.md)分别记录静态及浏览器边界；未提交/推送/部署。
