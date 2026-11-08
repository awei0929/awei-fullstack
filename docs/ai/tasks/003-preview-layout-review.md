# 后台官网预览布局：独立审查

- 核对日期：2026-11-07；基准 `82acde8`，当前未提交工作区。
- 读取：根 `AGENT.md`、`STATE`、前端 `AGENTS.md`、架构概览、SPEC-003「P25：后台预览布局修复」及静态诊断报告。
- 范围：新增 `admin/site-preview.tsx`、`preview-page.tsx`、`preview-protocol.ts`、`preview-geometry.ts`、`site-preview.module.less`，以及后台入口、路由与两份样式的本次整合。官网整体及大量未跟踪文件是既有工作，不以空提交差异代替本次审查，也不把前轮作品档案删除纳入本次问题。
- 本次没有精确CSS修改前快照；整合者明确的编辑范围为替换旧 `.preview` 块、删除5个含 `.preview` 的容器块及配套注释、移除后台旧Frame/Scale与手机高度上限。本报告据此结合现源码核对，未把其它任务备份当成本次前态。
- 本轮仅阅读源码并新增此报告；未修改产品代码，未运行浏览器、测试、lint/build、提交、部署或数据库操作。

## 双结论

**规格符合性：本次实现通过静态审查。** 独立 iframe、完整缩放包框、同源内存草稿、空输入、场景保持及预览限制均与 P25 合同一致。AC25-1/2 的真实尺寸与视觉结果、AC25-3 的实际连续输入、AC25-4 的浏览器及公开页回归仍由根任务记录，不能由本报告的静态结论替代。

**代码质量：通过；未发现需要修复的 P0/P1/P2。** 结构分为父宿主、独立预览入口、协议和几何计算，未新增依赖、保存通道或跨模块状态。下述结论仅覆盖本次范围。

## 合同核对

| 项目 | 源码依据与结论 |
| --- | --- |
| 独立 viewport 与 JS realm | `site-preview.tsx:46–52` 使用 `/admin/preview` 的真实 iframe；`router/index.tsx:6` 独立启动 `SitePreviewPage`，由子文档渲染原 `SiteExperience`，没有父 React portal。因此原 `window.matchMedia`、`document`、`HTMLElement` 和 `getComputedStyle` 使用子 realm。 |
| 桌面与手机几何 | `preview-geometry.ts:3–7` 采用桌面至少1440×900、更宽时等比扩展、手机390×844；父 `site-preview.tsx:43–51` 同时使用逻辑画布和缩放后包框尺寸；新样式没有旧560/620/700固定高截断或第二层 `overflow:auto`。DOM实际尺寸待根任务确认。 |
| 初次握手与最新快照 | `preview-page.tsx:10–19` 先监听再 ready；父 `site-preview.tsx:33–41、52` 同时支持 ready、load 和内容变化补发。`snapshotRef` 每次渲染更新，延迟握手读取最新草稿；首份消息即使早于子监听，也可由 ready 重发。 |
| 来源及坏结构 | `preview-protocol.ts:35–45` 同时验证 origin、指定父/子 window、消息类型；`17–32` 校验渲染使用的嵌套对象、字符串、数组和布尔值，拒绝缺字段及错误类型，音乐音量要求有限且在0–100。校验有意允许空文案/空昵称，保存约束仍归原保存流程。 |
| 草稿与场景保持 | 父深层 JSON 快照订阅 MobX 草稿并发送普通对象（`site-preview.tsx:14–20`）；子仅 `setDraft`（`preview-page.tsx:12–14`），渲染无内容 key；切换设备只修改原 iframe 的尺寸，连续输入不刷新 src、重建 iframe 或重挂载场景。 |
| 多实例与清理 | 后台普通预览和409最新内容预览复用组件（`admin/index.tsx:150、161`），各自校验自己的 `contentWindow`，不会接收另一实例的 ready。父 ResizeObserver、父消息监听、子消息监听分别在 `site-preview.tsx:30、38` 和 `preview-page.tsx:19` 清理。隐藏宿主的0宽测量不会替换已有几何，重新显示由 ResizeObserver 更新。 |
| 直接路由与数据边界 | 预览入口没有调用 `siteStore.load`、`restoreSession` 或保存API；顶层直接打开时显示等待说明（`preview-page.tsx:11、22–26`）。草稿只在父快照/消息/子 state 中，不进入URL、localStorage或公开API。App的开场提供器在该路径不激活。 |
| 登录、音频、外链及面板 | 子仍明确传 `preview`（`preview-page.tsx:23`）；原 `SiteExperience` 禁用站主入口和登录、拦截链接正常点击、隐藏播放器/动效控件、关闭流体及首载开场。关于/联系使用预览内状态而不改父history（`site/index.tsx:168–184、195–199、219–235、245–247、270、337–343`），保留场景、卡片和面板交互。 |
| CSS影响范围 | 旧预览布局与仅预览容器补丁已清理；`site/style.module.less:190–193、324` 仅保留预览根高度/裁剪和预览header定位。字体、人物、卡片和光圈继续使用公开页规则，未通过改动公开页能力字号/卡片位置掩盖旧viewport错配。 |

## 验证证据与边界

- 根任务提供的旧浏览器证据与静态诊断相符：外窗1920时旧frame1220×560、canvas1040×560、site1025×560且内容高720，能力标题76px/两行，部署卡片越出舞台。该证据用于确认修复针对实际根因，本审查没有重跑。
- 沿用根任务通知的实际helper模块36项断言、lint及构建成功结果；已阅读 `/tmp/nest-preview-layout-build.log`，其中TypeScript和Vite构建完成。此处不把这些检查说成本审查重新执行。
- 审查时实现报告尚未落盘；源码审查不依赖该报告的自述。根任务交付前仍需补齐实现报告、浏览器几何/截图与公开页回归、SPEC/STATE最终记录。真实手机触摸、多浏览器和OS减少动画不在本次静态审查新增验证范围内。

- 整合归档注：本任务编号统一为P25，避免与并行P24作品档案移除冲突；根任务最终浏览器与清理记录见[整合报告](003-preview-layout-integration.md)。本报告的独立审查/模拟范围不因此扩大。
