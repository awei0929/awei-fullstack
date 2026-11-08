# SPEC-003 P14：首载开场交接

- 核对日期：2026-11-07（Asia/Shanghai）。基准提交 `82acde8`，保留已有未提交工作区；未提交、推送、换分支或创建 worktree。
- 状态：入口与生命周期实现完成，已交根代理整合与真实浏览器验收；最终全量 lint/build 由根代理记录。
- 范围：`frontend/src/App.tsx`、`router/index.tsx`、`components/site-entry/`、`components/site-intro/`；未改首页主体、认证、后台或 API。

## 根因与实现

原 `RouterProvider` 在首页 lazy 模块下载期间只显示纯色背景上的 HEY.，真正的 `SiteIntro` 必须等首页挂载才存在。旧开场又在 `showModal()` 当场写入 sessionStorage，即使动画中断也已消费“看过”状态，同一标签刷新不再播放。

新 `SiteEntryProvider` 与单个 `SiteIntro` 由 App 静态导入并置于路由外，三个页面继续 lazy；没有把首页主体、流体、登录或后台提前并入入口依赖。入口只依赖 React、现有小型 SVG/CSS 和一个主图预加载请求，无新依赖。

- 仅初始文档路径 `/` 自动开场；初始 `/admin`、`/tasks` 不播放，之后站内切入首页也不追加开场。
- 删除 sessionStorage seen 机制。已结束/主动关闭状态仅存当前 App 的 React 内存：同 App 返回首页不重复，硬刷新得到新实例可重播；卸载不会写持久标记。
- 立即开始书写：2110ms 收笔，完整停留至 2850ms。首页内容请求已结束且主图完成 decode 后，才开始 350ms 文字淡出与其后的 900ms 毛玻璃显影。正常总时长约 4100ms；慢加载期间保留完整签名。
- 图片错误也视为终态，由公开页自己的图片降级展示承接。等待公开数据/主图最多 8 秒，随后退出遮罩；缺失 CSS completion 事件另有 12 秒**可见时间**保险。隐藏标签暂停 CSS 与保险时钟，回来继续书写。
- 主页 lazy 模块超 8 秒仍未完成时，底层显示加载说明和“重新载入”；模块拒绝/页面异常有友好的错误页与同一重载入口，避免永久纯色占位与默认技术栈错误页。
- 本地 `site-motion-off`、系统 reduce 在首帧决定是否播放；加载到站点动效关闭配置后也会退出。保留 Esc，没有可见跳过/重播按钮。开场自身接收焦点，清理 listener、timer 与预加载回调。

## 根代理集成接口

首页移除旧 `SiteIntro` import/JSX、`introReplayKey` 与页脚重播/回首屏按钮，使用：

```tsx
import { useSiteEntryReady } from '../../components/site-entry'

const entering = useSiteEntryReady({ enabled: motionEnabled, ready: !loading, preview })
```

Hook 的就绪上报始终执行，不受 `entering` 返回值阻断，因此没有“等开场结束才报告 ready”的死锁。`preview` 不上报，也固定返回 false。

为防 `/?project=...`、`?view=about` 深链的阅读 dialog 抢到开场之上的原生 top-layer，阅读面板 showModal effect 在 `entering` 时暂缓打开，并把 `entering` 加入依赖；开场结束/Esc 后按原逻辑打开面板。根代理已接受该集成方案。普通站内打开面板不受影响。

## 本代理验证

- 使用 systematic-debugging 追踪路由 fallback → 首页 lazy → showModal/session 写入顺序，并按现有无前端 test 脚本的项目约定做定向生命周期模拟。
- 修改前临时断言真实旧 TSX，`starting the entrance must not consume a session seen flag` 明确失败；修改后通过。
- `node /tmp/nest-cold-entry.test.cjs`：37/37。真实模块经 TypeScript 编译，hooks/DOM/Image/时钟为定向模拟；覆盖首次未 ready 开播、完整停留后释放、不可冒泡误关、StrictMode、隐藏暂停、Esc/reduce、卸载、同 App 不重播/新实例可播、图片 decode/error、API/图片 8 秒上限、12 秒事件丢失保险、路径与动效开关、加载恢复入口和清理。
- 指定四个 TSX 的 `frontend/node_modules/.bin/oxlint ...` 退出 0。
- 两次 `npm run check --prefix frontend` 已实际执行，但全量检查当时仍失败于并行音乐字段整合；最新一次仅 `src/api/site.ts:81` 缺 `music`。本入口模块未报告类型错误。不得将其记为全量类型检查通过，交根代理整合完成后验证。
- 本代理未执行真实浏览器、全量 build 或后端 HTTP；根代理负责浏览器首载/刷新/深链/错误降级和最终集成检查。模拟断言不等于 CSS 真实计时或真实网络故障覆盖。
