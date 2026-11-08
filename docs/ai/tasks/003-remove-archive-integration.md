# P24 作品档案移除：根整合

- 日期：2026-11-07；基准82acde8，原工作区大量未提交个人站改动全部保留。
- 规格：[SPEC-003 P24](../../specs/003-personal-site.md#p24作品档案整体移除最新合同2026-11-07)。本轮旧代码快照`/tmp/nest-remove-archive-before`。
- 执行：后端、站主与共享前端合同、公开页三路按固定合同与独占文件并行；根整合文档、独占素材、浏览器、最终静态检查及独立审查。没有提交/推送/部署/数据库写入。

## 任务状态

- [x] 后端AC24-04/05红绿与HTTP
- [x] 站主配置与共享合同AC24-03
- [x] 公开页AC24-01/02
- [x] 集成lint/build及残留引用检查
- [x] 桌面/手机公开与后台只读浏览器验收
- [x] 独立规格与质量审查、修复复验
- [x] 规格/架构/README/STATE与素材说明一致

## 验证记录

- 后端真实HTTP先红5/5，再全套70/70、5套件通过（含构建）；日志`/tmp/nest-remove-archive-backend-red.log`及`...-green.log`，根已读取末尾统计核对。具体边界见[后端报告](003-remove-archive-backend.md)。
- 集成前端lint/build首次退出0。公开代理最后增加skip端点聚焦与根顶部错误提示布局后，最终冻结再次lint/build退出0；日志`/tmp/nest-remove-archive-frontend-lint.log`、`...-build.log`。最终19个现存责任文件SHA256清单`/tmp/nest-remove-archive-final-sha256.txt`核对全部OK。
- 实际API模块21/21、实际store网络响应模拟17/17通过，分别保留400/409/401、dirty、音频只改草稿等；不称为浏览器或真实网络。[后台报告](003-remove-archive-admin.md)。
- Chrome默认1920桌面：首页无作品/档案文字或相关DOM，主按钮进入能力且三环人物可见；旧`?project=task-manager`无打开dialog；关于按钮打开→Esc关闭恢复关于焦点、联系打开→浏览器返回恢复联系焦点；`?view=about`直达关闭回brand。首载自然结束正常。
- Chrome390/320：无横溢出、无档案文字/入口；390菜单关于关闭回菜单按钮、主按钮进入能力；320能力展示与反向目标反馈正常。后台320选项只有首页/能力/资料/联系/外观，390能力四Tab及预览正常、音乐表单只有音频上传；1920后台导航/场景一览/预览与图片加载正常。没有触碰任何内容输入、上传或保存，始终已保存v6，保留用户原会话。
- 公开开发API读到v6、仅六个保留分区，无projects。仅删仓库无引用旧坐姿图与任务封面；历史上传文件和Mongo记录保留。独立能力内容、转场与遮罩模块未改。
- 截图：`docs/designs/personal-site/evidence/remove-archive-{capabilities-desktop,mobile-390,admin-desktop,admin-mobile}.png`。浏览器新建独立验收标签，未覆盖用户原后台输入。
- 最终键盘：Enter激活「跳到我的能力」，端点scene1/busy=false、焦点H2「我的能力」、三条ellipse；反向点击初次见面后端点scene0/busy=false。最终首页截图`remove-archive-home-desktop.png`，临时viewport已reset，保留首页标签。
- [独立审查](003-remove-archive-review.md)规格和质量均通过，无P0/P1/P2；根已读取完整报告。任务冻结19文件hash与审查当时一致，`git diff --check`通过。

## 收尾发现的外部并行改动

- 完成P24冻结验收后，另一个活跃聊天「配置我的能力分类」正在修复预览视口（已通过只读聊天状态核对），修改admin/index、admin/style及site/style，并新增site-preview等文件。初次观察到导入先落盘而文件尚未创建导致Vite缺失模块提示；随后文件已创建、根重新build退出0。未覆盖、回滚或抢改该任务代码。
- 上方后台预览截图和19文件hash对应P24冻结版本；后续iframe预览实现、路由接线及其最终视觉验收由该并行任务负责。本轮移除合同、后台五分区及公开项目剔除未被重引入。后端验证不受这些前端并行变更影响。
- 文件落盘后重新加载官网，实际DOM确认Vite错误遮罩不存在、无作品/档案文案、1920无横溢出；最终首页截图已重新保存。没有改动并行预览实现或其路由。

## 未决与边界

- 读取旧Mongo作品字段只做响应剔除；下一次正常保存替换content，本轮不迁移或清库。
- 历史上传媒体GET保留，封面图片POST上传删除；音频媒体正常。
- 前端无test脚本，不新增测试框架。最终浏览器证据与静态/HTTP结果分别记录。
- 本轮没有浏览器断网注入，首页失败重试仅源码和API/store模拟核对；多浏览器/真机touch/OS reduce/后台真实隐藏暂停维持此前未实操边界。
