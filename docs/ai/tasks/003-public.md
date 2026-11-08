# SPEC-003 P2 公开官网交接

- 核对日期：2026-11-07，基准82acde8；当前均为未提交改动。
- 范围：`frontend/src/pages/site/index.tsx`、`style.module.less`、`frontend/src/store/site.ts`。
- 已读根AGENT、STATE、前端AGENTS、SPEC-003、架构及三张公开设计图。复用已确认设计，无额外确认/分支/worktree/提交。

## 实现

- 导出SitePage与SiteExperience；后者以content+preview运行，与后台共享同一公开展示。
- 橄榄聚光与纹理舞台、大人物静帧、两段进度；桌面人物头顶115px避导航，下方裁切成半身。精确默认OH, HELLO.拆为两行，手机独立排版。
- 真实分类计数、橙色实体文件夹与奶油纸页；保留API项目顺序、可切换项目索引，隐藏项目不展示，无项目与空分类不伪造。
- 点击直接打开原生dialog阅读；project query直达，about/contact同面板；关闭/Esc/浏览器返回恢复分类、位置与焦点，直达无前序回档案。history归属为每次挂载随机UUID，刷新后不会误退站外。
- 源码/演示只渲染有效非空链接，外链noopener noreferrer；联系空URL过滤，预览未验证URL不执行。
- 独立加载/错误重试/空档案状态，封面失败替代；首屏欢迎文案与人物不等待API。
- 系统reduced-motion与手动关闭环境动效；人物本身没有假动作。原生滚动，不劫持滚轮。
- 预览内部滚动、容器查询手机样式，不改history/localStorage，不锁全局body；非模态阅读面板跟随内部scrollTop，阻止链接带着草稿离开后台。

## 验证

- 本代理最终运行`frontend/node_modules/.bin/oxlint src/pages/site src/store/site.ts`：退出0，本范围无警告。
- 本代理最终运行`npm run check`：退出0，TypeScript通过。
- 较早全前端lint退出0但有api/admin范围警告，已发给配置代理；整合代理随后报告全前端lint/build通过，不将其写成本代理执行结果。
- 浏览器由根整合者负责，本代理未调用浏览器。整合者初次首屏截图发现人物与导航重叠，已按反馈修正桌面比例；最终视觉截图与完整手机/返回/焦点验收由根继续。
- 前端无test脚本，未新增测试框架，未声称自动化交互测试通过。

## 边界

- 透明人物与真实封面由根提供。连续人物动作待真实素材，不在本轮伪造。
- router/global/types/api均未修改。全站SPEC和STATE由整合者更新。
- 待根进行独立审查与浏览器最终验收；代码已可整合。

## 独立审查修复：草稿预览订阅与状态

- 根浏览器修复前重现：标题先改HELLO. FIRST再改HELLO. SECOND，预览仍为FIRST。根因是SiteExperience不是observer，首次dirty导致的父渲染之后不再订阅嵌套草稿。
- 最小修复：SiteExperience包装MobX observer；ProjectImage也独立包装observer，订阅只在该子组件中读取的coverUrl，避免单独换封面遗漏。
- 根整合者修复后实际浏览器确认连续FIRST→SECOND后预览立即为SECOND，并恢复原两行标题，未保存临时测试。本代理未接管浏览器。封面单独修改尚未收到浏览器结果，不声称已验证。
- 根记录开发中组件函数改为observer时旧HMR实例曾报Component not a function；完整reload恢复正常，尚无生产复现。
- 独立前端审查另发现手机菜单按钮打开面板后已隐藏，关闭时对隐藏按钮focus不会生效；增加可见性检查，隐藏的原入口回退到可见菜单按钮。此边界待根手机键盘复核。
- 首次公开请求尚未成功时，关于/联系与项目共用明确加载/失败重试状态，不再把请求失败描述成空资料。
- 上述最终改动后重新执行定向oxlint与TypeScript check，均退出0；未重复全量构建或其他无关检查。
