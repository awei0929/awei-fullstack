# P24 作品档案整体移除：独立审查

- 核对日期：2026-11-07（Asia/Shanghai）。
- 结论：**本轮源码符合P24合同，代码质量审查通过；未发现确定的P0、P1或P2问题。** 浏览器验收范围单独以下述边界及根整合记录为准，不把源码审查表述为全部浏览器场景通过。
- 基准：82acde8及任务开始前已有大量未提交用户改动；审查对象为`/tmp/nest-remove-archive-before`到当前文件的任务差异及重新生成的`/tmp/nest-remove-archive-review.diff`（1907行），不是相对Git HEAD的全部差异。
- 已读取根AGENT.md、STATE、架构、两端AGENTS.md、SPEC-003顶部P24及三路实施/根整合报告。审查只新增本文，未编辑产品代码、提交、推送、换分支、创建worktree、启动子代理或写开发数据库。

## 规格符合性

| 合同 | 审查依据与判断 |
| --- | --- |
| AC24-01 公开移除与能力保留 | `frontend/src/pages/site/index.tsx:17`只保留about/contact面板；原档案DOM、分类/列表/封面/详情/翻页/空态及状态均删除。`:241`导航与`:276`首页主按钮进入欢迎/能力舞台；`:283`三环与原能力内容仍在。公开样式删除对应档案及滚动变量/动画，没有新增替代的作品入口。源码符合。 |
| AC24-02 旧链接、面板与重试 | `index.tsx:36`不再解析project，`:42`在面板链接生成时清理旧参数；`:155`保留有效打开来源回焦与手机菜单fallback，无来源深链回根顶部brand；`:168`、`:208`、`:219`保留历史返回、Esc、dialog/滚动锁生命周期。`:237`跳转能力并在端点聚焦标题；`:251`保留页面可见loading/error/retry，`:331`保留直达面板加载错误与重试。源码符合。 |
| AC24-03 后台及共享前端合同 | `frontend/src/types/site.ts:7`及`frontend/src/api/site.ts:49`不再包含projects，严格运行时解析继续拒绝未知字段。`pages/admin/sections.ts:1`、`editors.tsx:9`及`index.tsx:61`删除作品分区、编辑/图片上传、删除确认及样式；场景一览为欢迎/能力。未保存预览仍复用SiteExperience，联系添加和音频上传共用样式保留。源码符合。 |
| AC24-04 后端合同与旧文档 | `backend/src/site/site.service.ts:36`显式映射保留分区，旧projects不进入公开或站主响应，读取路径无写操作；`:19`沿用整体content原子保存和version比较。`dto/save-site.dto.ts:83`删除projects定义，配合现有全局forbidNonWhitelisted将含projects请求拒绝为400。默认值、前后端类型及调用一致。真实临时Mongo HTTP证据覆盖新库、旧库只读、正常保存清理旧字段、400不改库、409、重启。符合。 |
| AC24-05 媒体与任务 | `backend/src/site/site.controller.ts:24`只保留音频POST及原Session→Owner→CSRF顺序，图片POST及独占拦截器删除。`site-assets.service.ts:32`继续提供历史PNG/JPG/WebP及音频GET、文件名白名单和MIME；没有清理历史媒体。独立/tasks及任务实现不在本轮差异内，后端完整套件继续包含任务HTTP回归。符合。 |

## 质量与回归重点

- API→store→page、Controller→Service→DTO的职责保持；采用删除已失效分支和显式响应映射完成移除，没有新增框架、依赖或多余抽象。
- `frontend/src/store/site-admin.ts:41`、`:105`、`:173`、`:221`、`:268`的dirty、401身份恢复、版本冲突/结果未知、显式载入最新及音频上传互斥继续存在。本轮只删除项目相关字段、方法和busy依赖；音乐配置和音频上传不是被误删的共用分支。
- `frontend/src/pages/site/use-scene-motion.ts:11`删除档案几何与滚动监听，保留按指针输入申请帧、隐藏标签/开场/弹层暂停以及卸载清理。不存在失效的archiveRef或CSS滚动变量依赖。
- 能力内容、可逆转场、遮罩，以及后台能力编辑器/其样式已逐字节对照任务前快照，均保持原文件；无需为本次删除重新改动这些模块。
- 图片上传专用拦截器及无引用的`seated-character.png`、`task-cover.jpg`确认不存在；公开和后台运行源码中作品/档案类型、DOM及文案检索无残留。README、架构、素材说明与新合同一致；app.setup仅同步2MiB请求体说明，未改变限制行为。历史SPEC/设计/证据中的作品描述明确作为历史保留，不构成运行入口。

## 验证证据与执行归属

- **本审查重新执行**：逐文件阅读新版任务diff及当前源码、残留引用/样式引用检查、独占文件删除检查；`shasum -a 256 -c /tmp/nest-remove-archive-final-sha256.txt`的19个现存责任文件全部OK，审查与整合冻结版本一致。
- **沿用后端实施结果，未重跑**：`/tmp/nest-remove-archive-backend-red.log`为实现前5个P24 HTTP用例按预期全红；`/tmp/nest-remove-archive-backend-green.log`最终70/70、5套件、0失败/跳过，含构建。已核对日志与当前测试差异，临时Mongo/媒体目录隔离逻辑保留。
- **沿用根最终检查，未重跑**：前端lint/build退出0，日志`/tmp/nest-remove-archive-frontend-lint.log`及`/tmp/nest-remove-archive-frontend-build.log`；已核对构建成功输出及最终源码hash。前端没有test脚本，本审查未新建或声称存在测试框架。
- **沿用后台分工定向模拟，未重跑**：API实际模块21/21、store实际模块17/17；覆盖无projects合同、dirty、400/409保留输入、音频只改草稿、401同账号恢复/不同账号清理。该证据不等于真实浏览器或HTTP验证。
- **浏览器由根验收，本审查未操作浏览器**：审查交接时根已报告桌面旧project/主按钮/about/contact/返回焦点及390手机菜单无档案、无横溢出通过；320、后台只读与最终验收结果由[根整合](003-remove-archive-integration.md)和SPEC的实际验证记录确认。

## 边界与未纳入新缺陷的事项

- 320手机、后台只读预览、真实失败重试等尚未收到根最终记录的场景属于验收待回写，不认定为已经发生的产品缺陷，也不据源码推断为浏览器已通过。
- OS减少动画、其他浏览器、真机触摸/软键盘及真实隐藏标签等历史未实操兼容边界沿用原记录；本轮没有扩大这些验证结论。
- 前后端需使用同一新合同：旧客户端继续携带projects时按P24明确要求返回400，旧服务器仍返回projects时新解析器拒绝。滚动部署兼容层不在本次合同内。
- 没有执行数据库迁移、开发配置保存或历史上传文件清理；这些操作不属于本次范围。用户自定义的home.buttonLabel继续保留，主按钮行为已转为我的能力，不为改旧文案而写开发数据库。

## 确定问题

P0：无。P1：无。P2：无。独立审查无阻塞，最终完成状态由整合者结合浏览器验收及文档回写确认。
