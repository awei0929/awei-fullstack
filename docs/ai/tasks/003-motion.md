# SPEC-003 P6：公开页动效与入口整合

- 核对日期：2026-11-07；基准 `82acde8`，当前未提交工作区。
- 范围：`frontend/src/pages/site/index.tsx`、`style.module.less`、新增 `use-scene-motion.ts`。未改 API、store、认证、后台或路由；未提交、未换分支/worktree。
- 依据：SPEC-003 第二次实现迭代 P6、P9；保持已选人物/橄榄舞台/奶油纸张/橙色档案，人物仍为静帧。

## 已实现

- 桌面自然滚动：首屏短暂 sticky，文案向上退场、人物整幅缩放与位移形成景深，档案标题、纸夹和静帧坐姿按滚动进度分层进入。滚动监听 passive，不拦截 wheel、不强迫滚动，不增加库。
- 档案纸页 hover/键盘聚焦时前页抬升、后两层纸错开；阅读面板按打开纸页的位置入场，0.55 秒完成，交互立即可用，不改变历史返回逻辑。
- 环境柔光缓慢移动、4 个小光点；指针仅带动柔光，不驱动人物肢体。手机没有 sticky/滚动透视，减少到两个光点，阅读仅 0.28 秒轻位移。
- `useSceneMotion` 将 scroll、resize、pointer 输入合并到一个 rAF；不在空闲时持续 JS 循环。隐藏时取消已排队 rAF，CSS 动画暂停；重新可见重算。ResizeObserver、事件监听和帧均有卸载清理。
- 系统 reduced motion、站主全站关闭和访客手动关闭共同关闭新增场景/纸页/开场动画；背景动画在阅读或登录打开时暂停。
- 桌面 header 和手机菜单新增“站主入口”，始终挂载 `SiteLoginPanel({open,onClose,reducedMotion})`。桌面入口和手机菜单按钮提供 `data-site-login-trigger`，供组件关闭后恢复可见焦点。后台预览禁用入口并注明。
- 始终挂载 `SiteIntro({enabled: !preview && motionEnabled, replayKey})`；公开页脚“重看开场”先回首屏再递增 replayKey。动效关闭时重播禁用并说明原因。组件由 P7/P9 独立代理实现。
- 保留原 observer 实时预览、分类、真实 API 错误/重试/空态、URL 与浏览器返回、手机隐藏导航焦点兜底。

## 实际验证

- `npm run lint`：通过。
- `npm run check`：通过。
- Less 编译器直接编译页面样式：通过，滚动 `calc` 表达式保持；正式生产构建由整合者执行。
- 临时 Node 执行实际 hook 代码，最小 DOM/事件环境断言通过：100 次 scroll 与 pointer 共用一帧、0/0.5/1 进度边界、隐藏取消/不排帧/返回恢复、空闲无帧、卸载事件/Observer/样式清理、disabled/preview/mobile 不开场景转换、面板暂停时不跟随指针。这是调度逻辑断言，不是浏览器交互测试，也未增设测试框架。
- `git diff --check`：已跟踪改动无空白错误；本目录为本任务新增未跟踪文件，另核对源码。
- 浏览器未由本代理执行；root 独占浏览器。待 root 确认真实桌面/手机视觉、纸页 hover/打开/返回、关闭动效、开场重播与登录焦点。第一版 HTTP 59/59 不受本次页面变更影响，不重复执行。

## 交接

静态实现可供实时预览。若浏览器视觉出现布局/滚动问题，只调整本页面范围，不用角色静帧冒充肢体动作。SPEC、STATE 和整体浏览器证据由 root 整合。

## 独立审查修正：重播后的焦点（P2）

- 核对旧 handler：只滚回首屏，焦点仍留页脚“重看开场”；SiteIntro 因此会把页脚按钮记作返回目标，结束/跳过/Esc 后下一次 Tab 会回到页脚附近。
- 最小修正：给首屏 HEY. 品牌按钮添加 ref，重播依次立即滚回首页、`focus({ preventScroll: true })` 到品牌按钮，再递增 replayKey。通用 Intro 焦点恢复逻辑不变。
- 本次仅修改页面 `index.tsx` 和此报告；静态核对执行顺序完成。root 负责真实浏览器复验（结束/跳过/Esc 后焦点及下一次 Tab）和最终 lint/build；本代理未重复执行全量检查。
