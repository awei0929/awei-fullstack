# P26 温暖工作室独立审查

- 日期：2026-11-07（Asia/Shanghai）。
- 结论：本轮发现的1项P2已修复并经源码/CSS编译复核；当前审查范围无未关闭P0/P1/P2。浏览器尺寸与交互由根整合验收，本报告不替代其实际操作证据。
- 合同：[SPEC-003 P26](../../specs/003-personal-site.md)，同时核对P19能力配置、P21–23三环/850ms可逆时钟与P25独立iframe预览。
- 基准：`82acde8`及当前大量既有未提交工作。已运行Git状态、差异统计和最新提交核对；整个官网目录原为未跟踪文件，实际逐项对比`/tmp/nest-warm-studio-before/{index.tsx,style.module.less,capability-content.module.less}`与当前对应文件，未用HEAD空差异充当审查。
- 边界：只读产品文件，仅新增本报告；未控制浏览器、保存配置、修改数据库、提交、推送或部署。

## 已关闭问题

### P2：减弱动效时主按钮箭头仍位移

初审发现`style.module.less`新增主按钮悬停箭头`translateX(4px)`，原`.still`仅清理外层按钮变换；取消`transition`不能清理最终`transform`，系统或手动减弱动效时仍会瞬移，违反AC26.2的静止要求。

根已增加`.still .heroStage .exploreButton:hover > span .arrow { transform: none; }`，并在独立`prefers-reduced-motion: reduce`规则中同时清理按钮和箭头变换，覆盖系统偏好变更至React更新前的窗口。当前源码339–344行与实际Less编译结果均已复核，覆盖规则权重高于普通悬停规则。此项已关闭；真实OS偏好未由本审查者操作。

## 可由本轮源码验证的事实

- `index.tsx`本轮变更集中于Arrow方向、新文案、装饰环境节点与Switch外观；转场hook调用、targetScene即时高亮、端点inert/disabled、decode失败降级、焦点与关于/联系历史流程保留。时钟源码仍为850ms，重复目标忽略、中途反向与reduce直接提交端点分支仍存在。
- 三条等比ellipse、人物轮廓mask及四个卡片窗口节点保留，仅降低三环视觉不透明度。`use-orbit-occlusion`按可见卡面和展开说明实测尺寸/圆角生成窗口，ResizeObserver与hidden/data-expanded监听可接收卡片字号、156px手机卡高和4px圆角变化；未引入固定旧高度。
- 新工作室节点为`aria-hidden`、`pointer-events:none`，处于文字和人物下方；CSS背景不加入内容/人物decode等待。资源失效时舞台仍有`#20291F`底色。两张WebP存在，尺寸/字节数为1672×941/27,760与768×432/10,070，来源和归一提示词已写入`frontend/public/site/ASSETS.md`；本地目视背景无人、无界面文字。
- CTA保留原`switchCapabilities(true)`事件与可聚焦button。新色值源码计算对比度：深绿字/默认金色背景约9.93:1，悬停约10.97:1；能力主字/实底约10.31:1，次字/实底约6.26:1。此为不透明CSS端点计算，不是整页背景像素采样。
- Switch仍由原`motionEnabled`驱动，保留动态aria-label、aria-pressed、系统/后台禁用条件和原localStorage键；无新增持久化状态，音乐逻辑独立。`.still`与系统reduce全局规则取消轨道/拇指transition；能力卡片已移除悬停放大，手动reduce也通过父级规则取消颜色transition。
- “联系我”“进入空间”仍分别调用原`openPanel(contact)`与`openLogin`；手机与桌面入口均保持，预览登录仍禁用；未改登录认证行为。
- 能力TSX未变，仍直接读取四类配置、空组显示“暂未配置”、长昵称`overflow-wrap:anywhere`、列表`tabIndex`与纵向滚动、卡片标题键盘展开及说明滚动。新增14px字号未移除最大高度；手机名单纵轴contain和横轴auto、外层横卡滚动链保留。
- 后台仍通过同源`/admin/preview`iframe渲染同一`SiteExperience`，消息校验来源window与origin，草稿深读快照同步；P26没有改消息协议、缩放几何、独立视口或iframe外框。背景绝对路径在同源iframe内仍可解析。

## 本轮执行与未执行

- 执行：任务快照差异审查、相关hook/能力/预览源码阅读、WebP尺寸与本地目视、当前两份Less独立编译退出0（29,846与5,558字节CSS）、reduce覆盖规则检查与上述颜色端点计算。
- 沿用根通报的前端lint/build退出0；本审查者未重新执行全量检查，也未把其结果写成自行运行。无后端/API改动，不重复HTTP测试。
- 未由本审查者实操：1440/390/320页面布局与CTA点击、快速正反切换、手机导航/关于/联系/Esc、后台桌面/手机iframe、12项/40字昵称/空组和80字标题/30字按钮文案的浏览器布局、系统OS reduce、真机触摸、软键盘或其它浏览器。根整合执行的实际结果应独立记录；源码兼容判断不扩大为这些场景全部通过。

## 审查落点哈希

| 文件 | SHA256 |
| --- | --- |
| `pages/site/index.tsx` | `ee53cd7105fd2fd8cd82fb1e4ec8307dcb4b1f11388222286b06ab07234ecea9` |
| `pages/site/style.module.less` | `7000c1f9ded318f36564d6910efed3fb8358613891523052ad8918f670ba33f8` |
| `pages/site/capability-content.module.less` | `7abf6c063401c83f9b1d4e2acf9580371e5994239cbb02625a2366bebd8552fc` |
| `public/site/studio-environment-v1.webp` | `643290d437d3c1de9676b9c9a0f10c745423b06512be84f34cc35861d0611929` |
| `public/site/studio-environment-v1-768.webp` | `c204e33704e9f45726f780d181b8e22d85a74bf6a2566906accb55ea5b3d2888` |
# 根整合补充（2026-11-07）

审查后根依据手机实拍将手机能力卡内双列改为单列，未改数据、交互或卡尺寸；最终lint/build退出0、后台390 iframe显示完整名称。最终hash见[根整合](003-warm-studio-integration.md)，下方审查时hash保留为当时证据。

