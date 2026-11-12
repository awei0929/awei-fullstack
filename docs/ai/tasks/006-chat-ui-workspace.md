# SPEC-006 P4.1 聊天工作区

- 日期：2026-11-12。基准 `c6d19ff`，当前工作区未提交；保留任务开始前的 SPEC-006 聊天实现及其他用户改动。
- 范围：ChatPanel、后台 chat 专属容器与标题、页面交互辅助函数和必要测试；不改 API、ChatStore、后端、真实环境配置或数据库。不提交、推送、部署。
- 合同：[SPEC-006 P4](../../specs/006-owner-sse-chat.md#p4聊天工作区设计与交互补齐2026-11-12实施中)，对应 AC-11、AC-13；Markdown/复制与记忆由并行模块提供。

## 方向与实现

- 沿用 HEY. 橄榄深色、奶油正文与暖橙选中细线；真实对话是视觉重点，删除空态装饰图标与冗长重复状态。
- 聊天后台外壳固定剩余视口，桌面历史栏 240px，阅读列最大 760px，正文 16px、辅助字至少 12px；输入区常驻工作区底部，消息单独滚动。
- 历史按原标题/更新时间展示，支持去空格、不区分大小写的本地标题搜索。1100px 以下改用原生模态 dialog，明确关闭按钮、Esc、背景关闭、原生焦点隔离与恢复；切换会话/新建后聚焦输入。
- 空态提供官网文案、项目梳理、技术方案三个建议，只填草稿并聚焦，不自动发送。保留重新编辑、停止、刷新、模型白名单与输入上限。
- 用户上翻暂停输出跟随并出现返回最新；切会话与主动发送恢复跟随。输入继续使用 Enter 换行、Ctrl/⌘+Enter 发送，额外兼容中文输入法的 keyCode 229。
- 合并相同 `sendError` 与最新轮次错误。正常完成不再重复状态标签。回复通过独立 ChatMarkdown、ChatCopyButton 展示/复制；记忆入口及回复保存按钮按并行组件接口挂载。
- 手机聊天模式不再显示固定官网保存底栏；顶部保留分区、退出、官网入口。聊天不再显示误导性的已保存 v0，官网有未保存草稿时明确提示保留，原编辑分区与保存行为仍由原 store 负责。

## 验证

- 新增 `frontend/test/chat-workspace.test.mjs`：4 项真实辅助函数测试先红（4 个预期断言失败）后绿，覆盖搜索、滚动阈值/短内容、快捷键/IME、重复错误合并。
- `node --test frontend/test/chat-workspace.test.mjs frontend/test/chat.test.mjs`：19/19 通过（本轮实际执行；Node 输出现有 TypeScript strip 实验提示）。原有 15 项覆盖 SSE/权限/身份/取消/会话竞态。
- `npm run build`：成功，包含 TypeScript 与 Vite 构建。
- 首次整合 `npm run lint` 发现并行记忆面板 1 项 only-export-components 告警；整合者修正后，本轮再次实际运行 `npm run lint` 与 `npm run build` 均通过，lint 无告警。
- `git diff --check`：本轮实际执行通过；最终整合新增改动由整合者再次确认。
- 本代理未执行真实浏览器操作。已通知整合者可开始两轮 Chrome 实操；尺寸、焦点、滚动与功能验收以整合记录为准，不将辅助测试或构建视为浏览器通过。真机软键盘未验证。

## 下一步

根代理执行 1440/768/390/320 两轮页面验收并回传具体问题；本代理按布局/交互问题定向修复。记忆模块、Markdown 安全/复制与最终 lint/build/全测试由整合者统一记录。

## 第一轮审查定向修复

- 审查发现：新的历史行允许点击当前选中项，而页面原处理会无条件调用 `ChatStore.selectConversation`，后者先 `detachRun`，可能无意中止当前生成。
- 修复：页面复用 `selectHistoryConversation` 策略，先关闭历史抽屉；选择相同 ID 时只恢复输入焦点，不重新读取或中止流；真正切换会话仍等待读取完成后聚焦。显式刷新/重试保持原行为，未改布局与 store/API。
- 新增当前项与其他项两条实际策略测试。当前项在修复前确实触发不应发生的 `select` 断言失败；加 ID 条件后通过。`node --test frontend/test/chat-workspace.test.mjs frontend/test/chat.test.mjs` 最新 21/21 通过；`npm run lint` 无告警、`npm run build` 成功。浏览器流式当前项复验交整合者，不冒充已实操。

## 第二轮浏览器布局问题定向修复

- 根代理真实 Chrome 复现：390px 长内容、记忆弹窗关闭、键盘横向滚动代码后切 1440×900，window.scrollY=0，但聊天外壳 scrollTop=381、scrollHeight=9233，工作区 top=-309；仅检查 document.scrollHeight=900 无法发现。消息容器高 565px，消息区外层却贡献约 9085px 的滚动范围。
- 根因核对：回复复制状态使用绝对定位辅助文本；消息容器本身没有定位，最近定位祖先在容器外的 messageRegion，长内容的 static position 让辅助节点越过消息 overflow:auto 边界，撑高祖先；浏览器焦点恢复随后滚动 overflow:hidden 外壳。
- 最小修复仅 CSS：messages 设 position:relative；messageRegion 设 overflow:clip；composer 设 position:relative；chatAdmin 外壳由 overflow:hidden 改 overflow:clip，禁止焦点导致的祖先程序滚动。真正的 messages 滚动保留；原生模态历史进入 top layer，按其定位机制不受祖先裁切，仍交根代理真实打开复验。
- 本轮实际 `npm run lint` 无告警、`npm run build` 成功、`git diff --check` 通过；没有新增 CSS 镜像测试。根代理继续按同一路径复验祖先 scrollTop/scrollHeight 与工作区坐标，结果归整合记录；此处未提前宣称浏览器通过。
