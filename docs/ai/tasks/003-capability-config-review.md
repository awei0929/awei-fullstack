# SPEC-003 P19：能力配置独立审查

- 核对日期：2026-11-07（Asia/Shanghai）；基准 `82acde8`，审查对象为当前未提交工作区的 P19 增量。
- 已读取根 AGENT、STATE、前后端 AGENTS、架构概览、SPEC-003/P19、前后端实施报告与图标报告。官网主体是任务前已有的大量未跟踪改动，本审查未用空的提交差异代替工作区审查，也未把整个官网归为本次变更。
- 状态：首轮发现 2 项 P2，均已由原实施者修复、定向源码复审及根整合浏览器复验关闭；隐藏昵称定位的手机预览补充覆盖由根整合继续记录。未修改产品代码、提交、推送或重跑已通过的检查。

## 双结论

- **规格符合性：通过本次审查，无未关闭的确认问题。** 后端能力合同、旧库只读补默认、全局 38 项白名单、每类 12 项和唯一性、Unicode 昵称、显式空组，以及前端运行时解析与共享草稿接入符合 P19。两项 P2 均已修复并复验通过。实际桌面/手机与保存流程完整验收由根整合记录，源码审查不替代浏览器。
- **代码质量：通过本次审查。** 新增配置、DTO、独立编辑器与公开卡片职责清晰，复用版本化整站保存/权限/草稿，没有新增接口或依赖。未发现 P0/P1；两处修复均经定向源码复审，未见新增缺陷，无未关闭 P2。

## 确认问题

### P2：隐藏分类的无效昵称使保存静默中断

- 位置：`frontend/src/pages/admin/capabilities-editor.tsx:73`、`:87`；调用链为 `frontend/src/pages/admin/index.tsx:119` 的 `saveAll()`（初审时为第107行）。
- 触发：在「我的能力」的 AI Tab 清空任意昵称，切到前端 Tab，再点「保存全部」。AI 表单仍留在 DOM 中，但 Tab 内容已隐藏。
- 原因：新增 `required`/`pattern` 昵称输入参与外层 `form.checkValidity()`；Ant Tabs 默认不销毁已访问的隐藏 pane。`saveAll()` 校验失败只调用 `reportValidity()` 后返回，没有打开包含无效项的 Tab 或显示保存错误。浏览器不能聚焦隐藏的无效输入。
- 实际影响：保存被正确阻止，但当前仍停在前端 Tab，没有可见错误，也不能直接定位需要修正的 AI 昵称。用户需自行查找各分类才能恢复保存。
- 证据：本审查核对当前安装的 `@rc-component/tabs` 源码，默认 `removeOnLeave=false`；根整合随后真实浏览器确认“AI 空昵称→前端 Tab→保存仍在前端且无提示”，DOM 无效输入 `visible:false`。此处浏览器结果来自根整合，不冒充审查者亲自执行。
- 修复方向：保存前根据共享草稿定位无效昵称，切到「我的能力」及对应分类，待该 pane 可见后聚焦昵称并给出明确反馈；保留全站草稿校验，不仅以销毁隐藏 pane 绕过原生校验。
- 修复复审：`admin/index.tsx:119` 先从整份共享草稿检查昵称并切换分区、分类与手机编辑面板，`:86` 的 effect 在提交后以 RAF 聚焦并触发原生提示；`capabilities-editor.tsx:87` 受控 `activeKey`、关闭 Tab 动画且 `forceRender` 保证目标可定位。隐藏类别或离开能力分区后的空白昵称均覆盖，未销毁 pane 绕过校验；未见修复引入新缺陷。
- 浏览器复验：根整合在桌面 HMR 后保留无效 AI 草稿并停留首页场景，点保存自动转到「我的能力 / AI」，原生“请填写此字段。”提示出现，`document.activeElement` 为「展示昵称」、值为空且 `visible:true`。改为有效昵称后用旧版本保存，真实触发 409 提示且保留新昵称。
- 状态：**已关闭**。手机隐藏分类及预览→编辑定位为根整合后续补充覆盖，不把桌面证据写成手机实操。

### P2：手机技术列表拦截外层卡片的水平滚动

- 位置：`frontend/src/pages/site/capability-content.module.less:65`，尤其 `:71` 的 `overflow-y: auto` 与 `:72` 的 `overscroll-behavior: contain`；外层横向卡片滚动在 `:122`。
- 触发：390px 手机布局下，将指针放在某张卡片的技术名单区域进行水平滚动；同样的操作改从卡片标题开始即可移动到后面的卡片。
- 原因：列表开启纵向滚动后，另一轴的 computed `overflow-x` 为 `auto`；两轴 `overscroll-behavior: contain` 将无水平滚动范围的内层也作为水平边界，不把水平滚动链传到外层 `.cards`。
- 实际影响：技术名单占据卡片主要面积，用户在最自然的起点水平浏览四类卡片时没有反应，只能从标题或空白处操作；属于新增长列表滚动对 AC19-3 的回归。
- 证据：根整合实际浏览器在 390px 下以原生 horizontal scroll 复现：列表区域起点时 `.cards.scrollLeft` 为 `5→5`，标题区域同操作为 `5→493`；computed `overflow-x:auto`、`overscroll-behavior:contain`。这是原生滚动证据，不能写成真实手机触摸验收。
- 修复方向：列表仅保留纵轴 overscroll contain，横轴允许向外层传递；四类卡片的触摸事件隔离继续保留。
- 修复复审：`.technologies` 现仅 `overscroll-behavior-y: contain`，横轴明确为 `auto`；源码修改与定位原因一致。根整合重新读取滚动后实际列表边界（`rect.y=263`），从列表内 `[120,282]` 开始原生水平滚动，外层 `scrollLeft 5→493`，页面 `scrollY=378` 不变，computed 横轴 `auto`、纵轴 `contain`。第一次复验沿用滚动前坐标，没有命中列表；纠正坐标后通过。
- 状态：**已关闭**。证据为 Chrome 手机尺寸的原生水平滚动，仍未实操真实手机触摸。

## 审查覆盖

- 后端：`types/site.type.ts`、`config/site.capabilities.ts`、`config/site.defaults.ts`、`dto/save-site.dto.ts`、`site.service.ts`，以及 `test/site.e2e.test.mjs` 的前五条新增能力 HTTP 用例。DTO 对根/组/逐项形状分别约束；组内唯一、跨类重复允许；仅整个分区缺失才使用默认。服务读取补默认不写库或改变版本。
- 前端合同：`types/site.ts`、`config/site-capabilities.ts`、`api/site.ts`。38 项和九项默认与后端一致；拒绝显式 null/半对象/额外字段/未知图标；昵称同按 Unicode 码点与非空白规则校验。图标 URL 由白名单生成固定本地路径。
- 后台：`sections.ts`、`fields.tsx`、`editors.tsx`、新增能力编辑器和样式；交叉核对既有 `store/site-admin.ts`、`pages/admin/index.tsx` 的草稿、忙碌禁用、预览、失败/409 保留链路。分类列表直接修改同一份草稿；新增、换图标、排序、删除均通过 `store.edit()`，数量及重复同时有 UI/状态边界。
- 公开页：`capability-content.tsx` 与样式、`site/index.tsx` 的空组占位及 prop 接入。列表是纯文本 React 输出和静态 `<img>`，显式空组显示“暂未配置”；长名单有局部纵向滚动与键盘焦点，昵称可换行，手机/窄预览转横向卡片；卡片 touch 起止事件不传播至场景切换。
- 图标：阅读 `frontend/public/site/tech/SOURCES.md`、`SOURCES.json` 的来源/许可边界及图标代理报告，人工检索 SVG 活动内容未见匹配；39/39 XML、viewBox、元素/属性和校验值结果沿用图标代理记录，没有重复声明为本轮新跑。

## 验证边界与后续

- 沿用后端报告已完成的 72/72 真实 HTTP 和根整合给出的 API 实际模块 22/22；本审查未重跑它们。
- lint/build、实际后台/公开页、320/390 手机长名称与 12 项滚动、临时数据恢复，由根整合负责；这些检查不能由本报告的源码结论替代。
- 两项 P2 的定向源码复审与核心浏览器复验已闭环。根整合随后完成最终lint/build与390手机「AI昵称清空→前端Tab→预览→保存」补验：自动回编辑/AI，昵称输入可见且接收焦点，原生必填提示出现；完整证据见[整合报告](003-capability-config-integration.md)。审查者未重复这些检查，不将根的浏览器操作描述成审查者亲自执行。
