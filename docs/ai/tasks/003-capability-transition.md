# 双场景共享时间轴

- 核对：2026-11-07（Asia/Shanghai），基准82acde8上的未提交工作区。
- 范围：SPEC-003 P18 T1，新增 `frontend/src/pages/site/use-capability-transition.ts`；未修改页面、样式或既有用户改动。
- 接口：`useCapabilityTransition({rootRef, enabled, paused}) → {scene:0|1, transitioning, goTo(scene):boolean}`。root内data-capability-motion按welcome/wave/portrait/light/orbit/card/copy查询，支持每类多个节点。
- 实现：原生WAAPI暂停动画，同一个活动RAF采样全部动画currentTime；固定1900ms、分段cubic-bezier(.65,0,.35,1)。逆向复用完全相同动画集合与时间，端点才更新scene状态。ref互斥同步拦截同事件循环重复点击；idle无RAF。
- 时序：welcome0–300；人物150–900；光影400–1100；轨道650–1300；四card800+100i–1250+100i；copy1000–1700ms。
- 降低动态效果（enabled=false）立即采样请求端点，包含切换中关闭。paused/隐藏文档暂停并保留进度，恢复时继续剩余时长；卸载取消全部动画与RAF、解除监听。

## 验证

- TDD红：先建立 `/tmp/test-capability-transition.cjs`，运行 `node /tmp/test-capability-transition.cjs`，失败于缺失共享时间轴hook。
- 绿：相同脚本读取并擦除实际TS类型、在小型React/WAAPI/RAF定向模拟中执行实际hook，最终36断言通过。覆盖正反共用时钟、四card、端点更新、重复请求同步锁、reduce初始/正向途中/逆向途中、暂停/恢复、隐藏/恢复、卸载取消与禁止再次启动。
- `npm run check --prefix frontend`：hook实现后首次退出0；最后一次复验遇到根并发整合尚未落地的 `./capability-content` 引用而TS2307失败，最终整合检查由根执行。
- `npm run lint --prefix frontend`：最终退出0，无警告。首次lint对render中更新options ref提示，已移至layout effect后复验。
- 以上为实际hook定向模拟与静态检查；浏览器视觉/真实WAAPI行为由根整合验收，不把模拟表述为浏览器测试。
- 未提交、推送或部署。

## 页面整合定向模拟（2026-11-07）

根浏览器连接排障期间，追加 `/tmp/nest-capability-page.test.cjs`，通过后端既有TypeScript transpileModule载入实际 `pages/site/index.tsx`，仅模拟React生命周期/DOM/Image与共享timeline接口，无产品代码修改。

- `node /tmp/nest-capability-page.test.cjs`：39断言通过。
- 覆盖：能力WebP响应式预加载只执行一次；load后decode成功才放行；load/decode失败与8秒deadline使用原人物降级且开放入口；deadline后迟到decode不覆盖；unmount清理handlers/timeout并忽略迟到Promise。
- 覆盖：探索/底部返回调用共享timeline，切换中和同端点无重复启动；焦点先移到持久控制、后调用goTo与设置inert；完成状态正确设置aria-pressed。
- 覆盖：水平左/右滑前进返回、垂直优先/短距离/多指/取消触摸无切换、cards及button目标不触发场景滑动。
- 这不是浏览器证据；WAAPI时钟与真实视觉仍由根整合验证。

## 浏览器反馈后的重建修复与discover（2026-11-07）

根浏览器发现开发HMR重建动画effect会保留React scene=1但把视觉采样重置为0。新增 `settledScene` ref保存已完成端点；effect重新创建以该端点初始化动画，若中途重建则回上一个已完成端点并解除transitioning，保证状态与视觉一致。删除临时data-timeline-debug写入。

新增data-capability-motion=discover：0–300ms仅opacity淡出，保留CSS translateX居中；逆向沿相同时间轴恢复，避免能力场景中心提示遮住MacBook。

- RED：新增effect重建模拟，复现scene1而动画time0，断言失败。
- GREEN：已完成scene1后重建保持1900ms且可逆；中途重建恢复已完成端点、解锁并可重新进入；36条原覆盖保留，最终共47断言通过。
- discover先新增节点计数和opacity-only检查，复现缺失参与元素而失败；实现后同钟/无transform覆盖通过。
- `npm run lint --prefix frontend`、`npm run check --prefix frontend` 最终均退出0、无警告。真实浏览器由根reload再验收。
