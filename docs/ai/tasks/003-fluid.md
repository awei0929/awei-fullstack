# SPEC-003 P12：首屏鼠标流体背景

- 核对日期：2026-11-07（Asia/Shanghai）。基准82acde8，当前未提交工作区。
- 范围：只新增 `frontend/src/components/site-fluid/` 与本文。未修改 site 页面、后台、API、根文档；未提交、推送、创建分支/worktree或安装依赖。
- 目标：用户参考中的鼠标拖动、卷曲、消散柔雾。使用真实速度场/压力场/染色场的WebGL2流体；不是普通跟随圆圈。参考视频由整合者实际观看，本代理没有重复观看或声称自己完成视频验证。

## 接口与整合

```ts
export function SiteFluidBackground(props: {
  enabled: boolean
  containerRef: RefObject<HTMLDivElement>
})
```

入口 `frontend/src/components/site-fluid/index.tsx`。放在heroStage中并传入该容器ref，整合者负责提供 `enabled = motionEnabled && !preview && !panelOpen && !loginOpen`。canvas `absolute / inset:0 / z-index:0 / pointer-events:none / aria-hidden`；人物与文案层级由现有页面保持。blur只作用canvas，未给文字、人物或整页施加滤镜。

## 实现

- 官方React Bits SplashCursor源码阅读后裁剪：保留平流、散度、旋度、压力、梯度和连续线段注入。9个着色程序、8个固定半浮点纹理；模拟短边96、染色短边256、10次压力迭代，长短边比例最多3；DPR≤1.5且输出最长边≤1800。
- 限灰绿/暖金/奶油；无辉光链、彩虹、点击爆炸、自动初始注入、触摸或多指。当前canvas opacity .85 / blur2.5px；真实视觉需整合者浏览器验收。
- 第一次pointermove仅记起点，后续真实移动才首次创建renderer；逐帧合并高频事件，每帧至多注入一个连续轨迹。坐标相对canvas，移动距离为0不触发；超长跳变不铺一条跨屏烟雾。
- 组件内部按hover:hover、pointer:fine、prefers-reduced-motion:no-preference门控，不再限制窗口最小宽度；窄桌面/内嵌预览仍可使用。明确只接mouse，真实触屏与混合设备上的touch事件同样忽略。输入只绑hero容器。
- IntersectionObserver离屏、document.hidden、能力变化、pointerleave都会停止rAF并释放纹理/FBO/程序/缓冲/VAO，默认绘图缓冲缩为1×1。resize丢弃旧GPU资源，下一次移动按新尺寸惰性重建；固定监听不重复添加。禁用由React effect清理全部监听与observer。
- 静止2500ms后清掉画面和全部模拟场并停止rAF；再次移动唤醒，不复活旧染色。context loss、初始化失败或绘制抛错静默清理并回静态舞台；无需阻断页面。
- `SOURCE.md`记录官方链接、裁剪范围与原始下载快照SHA-256。`LICENSE.md`保留上游完整 **MIT + Commons Clause License Condition v1.0**及David Haz版权声明；未将其误写成纯MIT。

## 本代理实际验证

- 临时断言 `/tmp/nest-fluid-lifecycle.test.cjs`：先执行得到“eligible hero listens for pointer movement”失败（功能尚不存在），实现后20项通过。运行真实lifecycle.ts代码，DOM/observer/rAF和renderer边界模拟；覆盖相对坐标、逐帧合并、无初始注入、2500ms停止/再次唤醒、touch/能力、离开、hidden、离屏、resize、context loss与幂等完整清理。不是真实浏览器/GPU验证。
- `/tmp/nest-fluid-resources.test.cjs`：真实renderer.ts运行在模拟WebGL分配边界；11种初始化失败回退、部分分配回收、正常/重复dispose、8纹理与默认缓冲上限及全部场清理，共180个断言通过。没有验证GLSL编译或实际像素。
- `npm run check --prefix frontend`退出0；`./frontend/node_modules/.bin/oxlint frontend/src/components/site-fluid`退出0。第一次lint发现上游函数名`use`被React Hooks规则识别，已改为`bindProgram`并复查。
- 本代理未运行最终全量lint/build，未进行真实鼠标视觉、真实标签页隐藏、实际WebGL丢失或手机浏览器验收；由整合者执行与记录。前端没有test脚本，未新增测试框架。

## 待整合者完成

1. 接heroStageRef与已有开关组合；确认canvas低于人物/文字、登录和阅读弹层可点。
2. 实际浏览器检查鼠标产生可见卷曲/消散、停下消失与再移动唤醒、手机/手动关闭/弹层禁用；需要时仅调整renderer颜色强度与样式。
3. 最终lint/build、独立审查、实际验证回写SPEC/STATE。本文不代替整合验收。

## 整合视觉反馈后的单次微调

整合者已在真实浏览器看到WebGL像素，人物/文字保持清晰；其截图 `docs/designs/personal-site/evidence/home-fluid-desktop-v3.jpg` 中轨迹偏宽柔光团。本代理实际查看该图后定向调整：注入radius系数.0017→.0008、推力4500→6000、旋度8→22、速度耗散2.5→2、canvas blur4→2.5px；颜色、透明度、染色耗散、2500ms停止和GPU预算未变。目标是收窄注入并加强反向拖动的卷曲尾迹；调整后的实际视觉仍由整合者复查，截图不能证明整段动画效果。

## 窄桌面能力适配

整合者恢复用户预览后实际测得窗口613px，原min-width701使精确鼠标也被禁用。本次按整合决定仅移除lifecycle的最小宽度条件与CSS的max-width700隐藏条件；保留hover/精确指针/减少动态能力门控与mouse事件限定，renderer参数未变。613px真实视觉验证和最终lint/build由整合者执行；本代理仅核对这两处门控与说明一致，不把原模拟断言扩大成窄窗口真实验证。
