# SPEC-006 P6.2 免费备用模型前端

核对日期：2026-11-12。基准：`896d358` 加本轮未提交改动。范围：[SPEC-006 P6 / AC-18 至 AC-22](../../specs/006-owner-sse-chat.md)。本分工完成前端实现与实际模块验证；整合者负责后端、浏览器验收、独立审查和总状态。

## 已完成

- `ChatModel` 接收可选 `fallbackModelId`；目录允许 2 个内置模型和最多 10 个额外模型，拒绝不存在/自身/格式错误的备用引用。
- `ChatTurn` 分离原选择 `requestedModelId/requestedModelLabel` 与实际尝试 `modelId/modelLabel`。两个 requested 字段都缺时归一为原 model 字段；只有一个存在或字段异常时拒绝响应，兼容旧历史而不掩盖部分损坏数据。
- SSE 接收 `fallback`，要求同一会话/请求、已收到 streaming start、尚无正文、最多一次、空正文的 streaming turn、无错误、原选择保持一致、实际模型改变，且输入/创建时间保持同一轮。fallback 之后仍要求业务 done；EOF 仍走中断核对。done 保持服务端权威终态，不额外限制其模型必须等于最近事件，以兼容持久化切换与取消之间的竞争窗口。
- store 用 fallback 更新同一轮，不设置 run.done，保持发送锁与继续读取。切会话仍发送取消，身份变化和停止继续过滤迟到事件；加载/刷新会话按 requestedModelId 恢复原选择。
- HEY. 工作区消息标题显示实际模型，切换消息显示“因限流自动切换自…”；输入区根据服务端关系显示免费备用说明，可在目录直接选择备用。仅增加两处小字说明样式，保留现有整体布局。
- 记忆面板明确启用记忆也会发给自动切换的备用模型，当前免费备用同属智谱。

## 验证

环境：本机 Node 自带 TypeScript 擦除、真实 API/Store 模块与受控 fetch/SSE 响应；不连接数据库或模型，不添加依赖/测试框架。

| 项目 | 实际结果 |
| --- | --- |
| TDD 初次 `node --test frontend/test/chat.test.mjs` | 26 项，17 通过、9 失败；失败对应旧历史字段未归一、部分 requested 元数据未拒绝、12 模型限制、fallback 未识别及刷新选中备用。生产实现前已观察失败。 |
| 实现后同一专项命令 | 26/26 通过；覆盖 fallback→delta→done、EOF、顺序/重复/错误标识/已有正文/元数据不一致、停止/迟到完成、切会话取消、身份隔离、原选择刷新与旧历史。 |
| `node --test frontend/test/*.test.mjs` | 51/51 通过，0 失败/取消/跳过。Node 输出已有实验性 `stripTypeScriptTypes` 提示，无测试错误。 |
| `npm run lint --prefix frontend` | 退出 0，无告警。 |
| `npm run build --prefix frontend` | 退出 0；TypeScript 与 Vite 构建通过，1837 模块，无大块告警。 |
| `git diff --check` | 退出 0。 |

## 边界与交接

- 本分工未启动浏览器；真实 DOM/窄屏布局、事件切换提示、停止/刷新与旧历史浏览器操作由整合者补验，不能将模块测试视为浏览器结果。输入区提示使用 12px 与可换行文本；需在 320/390 宽度确认消息可用高度及无横向溢出。
- 未读取真实 `.env`、凭据或真实用户数据，未调用线上/真实模型，未新增分支/worktree/提交/推送/部署。
- 编辑仅限 `frontend/src/types/chat.ts`、`api/chat.ts`、`store/chat.ts`、`pages/admin/chat-panel.tsx`、对应 Less、`chat-memory-panel.tsx` 的披露文案、`frontend/test/chat.test.mjs` 和本报告；原 README/STATE 等改动及后端并行工作保持原样。
