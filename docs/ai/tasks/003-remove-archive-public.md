# P24-C 公开页移除作品档案

- 核对日期：2026-11-07（Asia/Shanghai）。基准82acde8及任务开始前已有未提交工作；本轮差异对照 `/tmp/nest-remove-archive-before`。
- 当前状态：公开页实现及本地定向静态自审已完成，AC24-01/02的真实浏览器与整体构建由根整合执行；不将源码检查称为浏览器通过。
- 当前合同：[SPEC-003 P24](../../specs/003-personal-site.md#p24作品档案整体移除最新合同2026-11-07)，覆盖其后旧版保留档案约定。

## 修改

- `frontend/src/pages/site/index.tsx`：删除项目类型、分类/列表状态、档案区、卡片/封面替代、详情/翻页、空态与档案导航；仅保留about/contact阅读面板。`?project=<id>`不参与面板解析，普通首页照常显示；打开或关闭保留面板时清理旧project参数。
- 首页主按钮保留可配置buttonLabel但行为进入我的能力；discover改成“探索我的能力”，读屏跳转链接进入能力并在端点聚焦标题，场景进度只负责现有欢迎/能力。清除档案滚动观察状态。
- 面板关闭/Esc、浏览器返回、手机菜单回焦与预览拦截保持；无打开来源的深链面板关闭后回到首页brand。关于页资料空文案去掉作品引导。
- loading/error重试移到首页独立可见提示，仍显示舞台；错误保留重试按钮且可显示错误详情。首页返回到根顶部，提示不依赖已删除区块。
- `frontend/src/pages/site/use-scene-motion.ts`：去除hero/archive参数、滚动/resize几何、ResizeObserver及CSS进出场变量；仅按鼠标输入调节环境光，保留标签隐藏/弹层/开场暂停与清理。
- `frontend/src/pages/site/style.module.less`：删除档案、分类、封面、详情、翻页、独占动画与所有手机/预览覆盖；清掉旧滚动景深和纸页hover。保留阅读纸张、环境光、人物、三环、能力及读屏样式。
- `frontend/src/store/site.ts`原本只有加载/错误/版本保护，不含档案业务，因此保持原样。独立能力内容、共享转场、遮罩模块与其样式均与快照一致。

## 自审与验证

- 对照任务开始快照审查本轮三个源码文件；公开页相关文件检索SiteProject/content.projects/archiveRef/滚动CSS变量/“作品”“档案”/旧SCROLL提示均无命中。唯一project字面量是清理兼容query的`searchParams.delete('project')`。
- 本轮执行：在frontend下定向运行现有oxlint检查`src/pages/site/index.tsx`与`src/pages/site/use-scene-motion.ts`，退出0；使用项目既有Less库编译`style.module.less`成功。
- 未自行新增依赖、测试框架或声称存在前端test脚本。未执行后端测试；未运行全量lint/build和浏览器，留给根整合统一执行并记录。
- 浏览器待验重点：桌面/390/320无档案及横溢出；主按钮/discover/读屏跳转到能力、可逆切换与三环；旧project深链；about/contact直达、按钮/Esc/返回与焦点；首页错误及重试。系统reduce/隐藏标签等实际验证边界以根整合记录为准。
- 未改数据、提交、推送、分支、worktree或部署，保留所有已有用户改动。
