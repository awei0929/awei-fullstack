# SPEC-006 P4/P5：聊天工作区与长期记忆独立审查

- 核对日期：2026-11-12；基准 `c6d19ff` 加当前未提交工作区，不使用空提交范围代替审查。
- 范围：[SPEC-006 P4/P5](../../specs/006-owner-sse-chat.md)、前后端目录约定、记忆类型/API/Store/面板、后端记忆 CRUD/生成注入、聊天工作区/滚动/焦点、Markdown/复制，以及本轮定向测试。
- 保留开始前的首版聊天与其他未提交改动。审查者未修改应用源码、读取真实 `.env`/Key、访问默认服务或任何数据库、调用真实模型、提交、推送、部署或保存截图。实际模块复现只替代 fetch 边界，使用内存合成响应。
- 当前状态：独立发现的 3 项 P2 均已修复并复核关闭；整合者第二轮浏览器发现的祖先滚动缺陷另完成 CSS 定向静态复核。未发现遗留的可复现 P1/P2；结论不包含真实供应商与正式部署链路。

## 发现与关闭情况

### R1 / P2：首次记忆列表未返回前新增，会隐藏已有记忆（已关闭）

- 旧路径：`ChatMemoryStore.canSave` 不要求完整列表已加载；写入开始使 `loadVersion` 递增，初次列表结果被丢弃，新增成功仅对当前空数组 upsert。
- 实际模块复现：服务端初始列表含“服务端已有记忆”，延迟该 GET；打开预填编辑器新增“本次新增记忆”。旧实现输出 `loading=true/canSave=true`，保存和列表返回后只显示新增项，GET 次数为 1、没有错误提示。数据库旧项仍可能启用并继续发送给模型，管理面板却无法查看/停用。
- 修复：增加 `loaded`，只在当前身份完整列表读取成功后置为 true，重置时清 false；`canSave` 要求已加载。用户仍可打开编辑器、保留长回复并摘录，首次慢读/读取失败时不能保存；读取成功后恢复。
- 复核：检查实际 Store 和新增慢读/初读失败恢复用例；修复后记忆测试通过。已有完整列表上的刷新与写入版本保护仍保留。

### R2 / P2：补取 CSRF 时发现会话已失效，却静默保留旧身份（已关闭）

- 旧路径：`write()` 发现 `/auth/session` 的用户与当前用户不同，直接 `return false`，没有过期处理或错误反馈。
- 实际模块复现：先加载私有记忆，CSRF 为空；会话接口返回 200 与 `user:null`。保存返回 false，但旧 `authStore.user`、管理弹窗、编辑器和私有记忆仍在，`writeError=''`、`canSave=true`，重复点击仍静默失败。
- 修复：先检查旧生命周期并忽略迟到响应；若仍是当前请求而用户不一致，抛出 `HttpError('登录已失效', 401)`，复用既有身份过期清理。
- 复核：新增实际模块回归验证用户变为 null、弹窗关闭、草稿与记忆清空；修复后记忆测试 9/9 通过，包括原有旧身份响应不得清除新身份的用例。

### R3 / P2：点击当前高亮历史项会取消同一会话的生成（已关闭）

- 新历史按钮会对当前已选项也调用页面 `selectConversation(id)`，进而无条件调用 Store 的同名方法；Store 先执行 `detachRun()`，因此并没有切换会话也会中断生成。旧下拉在相同值下通常不触发 onChange，新按钮扩大了这个交互入口。
- 实际模块复现：发送并收到 start，输出 `selected=X/sending=true/aborted=false`；再次选择同一个 X 后，输出 `selected=X/sending=false/aborted=true/cancelCalls=1`。未访问真实服务。
- 修复：页面通过 `selectHistoryConversation` 策略执行历史选择；当前项只关闭历史抽屉并恢复焦点，不重新读取或停止，其他项待读取结束再聚焦。保留 Store 同 ID 读取供明确刷新/结果核对使用。
- 复核：确认 ChatPanel 的实际按钮调用新策略；新增当前项/其他项两条回归通过，实际执行工作区 6 项与记忆 9 项共 15/15 通过。浏览器中的持续生成与焦点由整合者第二轮实操另验。

### R4 / P2：长内容辅助文本撑高祖先，焦点恢复滚动整个工作区（整合者发现，已定向复核）

- 来源：整合者第二轮真实 Chrome 发现，非本审查者亲自浏览器复现。390px 长代码键盘横向滚动、记忆弹窗开关后切 1440×900，聊天外壳出现 `scrollHeight=9233/scrollTop=381`、工作区顶部负坐标；document 高度检查无法反映内部外壳已被滚动。
- 根因与变更：复制控件的 `srOnly` 使用绝对定位，原消息滚动区没有定位，其包含块位于消息区外；长内容中辅助节点的静态位置贡献外层滚动范围，随后焦点恢复可滚动 `overflow:hidden` 外壳。修复仅四处 CSS：`.messages` 与 `.composer` 增加 `position:relative`，`.messageRegion` 使用 `overflow:clip`，`.chatAdmin` 由 hidden 改 clip。
- 独立静态核对：两处定位分别约束回复状态和输入标签/状态；消息的 `overflow-y:auto`、代码/表格的局部 `overflow:auto` 与焦点入口保留，外层 clip 不替代实际阅读容器。返回最新按钮仍定位在消息区内；历史使用 `showModal()` 的原生顶层 dialog；记忆 Modal 未配置内联容器，已核对安装依赖默认 Portal 挂载到 body。未发现本修复把弹层、阅读滚动或官网编辑布局一并裁切的代码路径，官网编辑不带 `chatAdmin` 类。
- 沿用整合者报告的浏览器复验：390px 长代码 ArrowRight → 记忆预填/取消/关闭 → 历史抽屉打开/Esc → 1440×900；最终外壳 `scrollTop=0/scrollHeight=900/clientHeight=900`，工作区 top=72/bottom=900，输入 bottom=801。320px、768px 外壳也为 `scrollTop=0` 且 scrollHeight 与 clientHeight 相等。这些是整合者实操数据，不记作本审查者新跑。
- 检查范围：沿用工作区实施者本次 CSS 修复后 lint/build 通过记录；本审查仅重新读四处规则、相关 DOM/弹层实现并检查文档差异，不重复全量测试或访问服务。其他浏览器与真机软键盘仍不扩展声明。

## 审查覆盖

- 后端：所有记忆路由复用 Session/Owner，写入另验 CSRF；ownerId 只来自 `authUser`。独立 owner 唯一文档、原子检查 `items.19` 后 push 保证 20 条上限，更新只 set 目标字段，删除只 pull 目标项；UUID/未知字段/trim/Unicode 码点/null/空 PATCH 有运行时校验。公开投影不含 owner、Key 或模型配置。
- 生成注入：读取启用项发生在受理写库之前，失败不会产生无记忆半受理轮次；单条 system 背景明确当前用户要求优先。每轮使用快照，编辑只影响后续请求；无启用项时保持原 messages，原最近 10 轮与 32000 字符上下文预算独立保留，已完成请求重放不重新读取/调用。
- 前端：响应运行时校验、身份/生命周期/列表版本、写入互斥、失败输入保留、非乐观启停/删除、删除确认、500 字不静默截断。两项读写/身份交错缺陷如上已修复。
- Markdown：使用已有 react-markdown/remark-gfm，禁原始 HTML；危险/协议相对/普通相对 URL 被拒绝，安全外链包含 noopener/noreferrer；图片变为说明，不产生自动加载元素。代码/表格局部滚动可聚焦，未闭合围栏保留代码与复制控件。
- 复制：仅用户点击调用 writeText，精确保留传入文本，不读剪贴板；缺失 API、非安全上下文、权限拒绝均有可见反馈，重复点击保护与卸载清理存在。
- 布局/输入：聊天专属高度、消息独立滚动、移除聊天的官网固定保存底栏、保留分区/退出；上翻暂停跟随与返回最新、Ctrl/⌘+Enter、isComposing/229 保护、历史原生 dialog 焦点隔离与关闭路径均已静态核对。真实尺寸/焦点/软键盘行为由整合者两轮 Chrome 验收负责，不能以源码或纯函数测试替代。

## 本审查实际执行

| 检查 | 实际结果 |
| --- | --- |
| `node --test test/chat.test.mjs test/chat-memory.test.mjs test/chat-markdown.test.mjs test/chat-workspace.test.mjs`（frontend） | 首次审查版本 36/36 通过；这组测试当时没有覆盖 R1/R2，不能据此认定交错不存在。 |
| 独立内存脚本加载实际 API/Store | 实际复现 R1、R2、R3；仅替代 fetch，未连数据库或服务。 |
| `node --test test/chat-memory.test.mjs`（frontend，R1/R2 修复后） | 9/9 通过；仅 Node 原有 TypeScript strip 实验提示。 |
| `node --test frontend/test/chat-workspace.test.mjs frontend/test/chat-memory.test.mjs`（根目录，全部修复后） | 15/15 通过；工作区 6 项与记忆 9 项，涵盖三项发现的回归。 |
| `git diff --check` | 全部修复后实际执行通过。 |

未重跑后端 HTTP、全量 lint/build 或浏览器；后端新增 11 项 HTTP 测试的源码已审查，运行结果由对应实施记录/整合者提供。正式 GLM、线上 Nginx、真实数据库、其他浏览器与真机软键盘不在本审查验证范围。
