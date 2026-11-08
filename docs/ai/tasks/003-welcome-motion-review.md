# P27 首屏动效诊断与独立审查

- 日期：2026-11-07（Asia/Shanghai）。
- 状态：诊断与P27最终源码独立审查完成；审查范围无P0/P1/P2阻塞。浏览器覆盖由根整合记录，本审查者不代替其实操。
- 基准：`82acde8`及大量既有未提交工作；诊断P26前样式使用`/tmp/nest-warm-studio-before/style.module.less`，P27实现逐项对照`/tmp/nest-welcome-motion-before/{index.tsx,style.module.less,site-entry.tsx}`，不使用HEAD空差异冒充本轮审查。
- 授权边界：只读产品源码，只编辑本报告；未控制浏览器、保存真实配置、修改数据库、运行全量检查、提交或推送。
- 合同：[SPEC-003 P27](../../specs/003-personal-site.md) AC27.1–4；用户要求“动效默认开启、隐藏公开动效按钮、初次见面为什么没有动效”。P27覆盖P26公开Switch合同，站主`appearance.motion`和系统reduce仍有效。

## 诊断

| 项目 | P26前 | P26后/反馈时 | 判断 |
| --- | --- | --- | --- |
| 柔光循环 | 桌面`lightSweep`16秒，手机`mobileLight`18秒 | 两条animation声明移除，伪元素只剩固定低透明度 | 确实删除了可持续运行的柔光循环；关键帧定义还在 |
| 星芒循环 | 声明`glimmer`6秒 | 声明删除，只留固定opacity | 声明被删除；但该外层同时被WAAPI的welcome角色控制opacity/transform，旧CSS动画能否显现不能仅凭声明认定 |
| 尘粒循环 | 4px、12秒、光晕阴影 | 2px、16秒、无阴影，更弱 | 循环未删，显著弱化 |
| 鼠标柔雾/光位 | 桌面指针驱动WebGL、光层drift变量 | 原生命周期与指针监听保留 | 不是自动待机动画；不移动指针时不应据此判断整个页面关闭动效 |
| 人物 | 透明静态图，外层仅用于双幕转场 | 同前 | 原本没有人物持续呼吸、挥手骨骼或连续帧，不属于P26丢失的既有动作 |
| 开场HEY./显影与逐行入场 | `SiteEntryProvider`/`SiteIntro`和`welcomeLine` | 相关规则、就绪等待与4100ms流程保留 | 本轮样式未删；曾有手动关闭状态时会被enabled共同关掉 |
| 欢迎/能力转场 | 850ms共享可逆时钟 | 相同hook、角色选择器和重复操作保护 | 未删；原手动关闭会使enabled=false，直接提交端点，看起来像没有过渡 |

反馈时公开页`motionEnabled = appearance.motion && !reducedMotion && !motionOff`，`motionOff`从`localStorage['site-motion-off']`读取。隐藏按钮后若继续保留该读取，旧值true将成为无法在页面解除的永久覆盖。另`components/site-entry/index.tsx`的`motionAllowed()`独立读取同一键，仅删除公开页读取仍会让旧true跳过首载开场。最终实现已取消两处本地覆盖，未为忽略旧值而改写或清空用户存储。

## 最小恢复与风险

- 保持P26新环境、当前素材、首载就绪链和850ms时钟；移除公开Switch及本地开关的读取/写入，动效只受站主配置与系统reduce控制。音乐入口和主动播放逻辑继续独立。
- 柔光循环放在`.stageGlow::before`，外层`.stageGlow`仍专供鼠标漂移。人物呼吸只放在欢迎人物的内层`.wavingPortrait > .heroCharacter`，不动有`data-capability-motion="wave"`的WAAPI外层，也不匹配能力人物或其失败回退图。
- 星芒外层由WAAPI welcome控制，循环应放内层span；直接给外层恢复transform/opacity关键帧会与同属性WAAPI竞争。
- 新循环默认暂停，仅在动效可用、首载结束、欢迎端点、未转场、无关于/联系或登录面板时运行。保留`data-page-hidden`重要性暂停与系统reduce/`.still`的animation取消，防止隐藏标签或用户关闭系统动效后继续运行。
- 注意CSS顺序：新的running选择器如果与原`data-motion-paused`暂停选择器同权重且后出现，会覆盖暂停。运行条件需排除首载/弹窗/转场/能力；隐藏暂停保留更高优先级。
- 人物呼吸是整张静帧的低幅位移/缩放，不应描述为连续挥手或骨骼动作。欢迎图内层呼吸与能力遮罩无直接绑定，只要进入转场时冻结且能力fallback不匹配该循环，就不会改变能力人物遮罩几何。

## 最终实现复核

- 默认开启：公开`motionEnabled`现仅由`appearance.motion && !reducedMotion`决定，`SiteEntryProvider.motionAllowed()`现仅检查系统reduce。全`frontend/src`检索无`site-motion-off`、`motionOff`、`toggleMotion`、旧Switch类名引用。按钮、handler、state与CSS一并移除，音乐节点/props未改；旧true存储值不会再阻断开场或双幕动效。
- 运行条件：`index.tsx:247`以动效可用、`!entering`、`!panelOpen`、`!loginOpen`、`!capabilities`、`!switching`生成`data-welcome-running`，仅欢迎端点放行。新三种循环默认paused，未借用或改写850ms时钟。正向起步和反向途中均被`switching`挡住，欢迎端点恢复；首载/关于/联系/登录均暂停。
- CSS职责：柔光12秒循环仅在`::before`，外层指针漂移transform保留；人物6秒循环仅匹配`.wavingPortrait > .heroCharacter`，位移0至−5px、缩放1至1.006；星芒8秒循环只在新增`.sparkMotion`内层。三者均避开WAAPI写入的角色外层，能力人物及失败回退图不匹配呼吸选择器，未改能力遮罩。
- 暂停/静止：新增`experience[data-motion-paused] .heroStage`暂停选择器在running之后且权重更高。原隐藏标签`animation-play-state:paused !important`覆盖所有内层；`.still`与系统reduce的`animation:none !important`覆盖新增animation，即使系统变更尚未完成React重渲染也会静止。现有`useSceneMotion`的visibility监听继续维护隐藏标记并清理，不增加常驻JS循环。
- 兼容：新增span无交互或焦点，保留外层`aria-hidden`；当前人物/星芒布局、手机规则、三环节点、首载资源等待、后台iframe/草稿协议、登录与面板流程均未改变。人物是整张静帧呼吸效果，不是连续肢体动画。
- 执行：本审查者重新编译当前公开页Less退出0，生成29,660字节CSS；核对compiled running规则后确有更高权重paused规则，未残留Switch样式。未重复全量检查。根通报实际TSX/函数定向模拟先红1/10至最终10/10、lint/build通过；此为沿用根通报，不写成审查者自行执行。
- 根另通报Chrome首屏人物/星芒running且transform样本变化、关于暂停/Esc恢复、切能力busy期间欢迎循环paused、刷新开场dialog及无开关已确认。上述浏览器由根执行；本审查者未操作浏览器，不以源码结论扩大为390手机、真实OS reduce、真实隐藏标签或其它浏览器全部通过。

## 审查落点哈希

| 文件 | SHA256 |
| --- | --- |
| `pages/site/index.tsx` | `ef0b57d1e0a745710b76d44c1bd9e47ecc829c77e1f9d10db3ad31798106ec30` |
| `pages/site/style.module.less` | `a22122aa71e50c1f93ac7dfc048fcf78a22b589458375a189f9d421ceec1c269` |
| `components/site-entry/index.tsx` | `2d4f9160223d607f80972e9179a364269c4f230efcd5cbcd68d0848814ffcce0` |
