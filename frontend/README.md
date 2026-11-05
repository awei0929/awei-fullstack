# awei 前端

React 18 + TypeScript + Vite + MobX + React Router + Ant Design + Less Modules。

## 启动与文档入口

环境要求、MongoDB 配置、依赖安装和前后端启动步骤统一见 [根 README](../README.md)。前端依赖运行中的后端与数据库；开发请求通过 `vite.config.ts` 的 `/api` 代理发送到后端。

- [AI 开发约定](../AGENT.md)：整个工作区的开发流程。
- [前端补充约定](./AGENTS.md)：分层、交互和验证规则。
- [当前工作状态](../docs/ai/STATE.md)：切换会话或模型后的接续入口。
- [当前系统基线](../docs/specs/000-current-system.md)：前后端接口合同和已实现范围。

## 代码入口

- `src/api/tasks.ts`：任务 HTTP 请求。
- `src/api/stats.ts`：调用后端统计接口。
- `src/store/tasks.ts`：任务状态、加载与错误处理。
- `src/pages/tasks/index.tsx`：任务查询、创建、编辑、删除，以及统计展示。
- `src/router/index.tsx`：路由。
- `vite.config.ts`：`/api` 开发代理。

## 页面行为

任务列表每行提供“编辑”和“删除”。编辑调用 `PUT /api/tasks/:id`，请求体只传 `{ title }`；删除经确认后调用 `DELETE /api/tasks/:id`。成功后更新列表，失败时保留弹窗提示，提交期间禁止重复操作。

页面的任务总数来自 `GET /api/stats`，而不是前端直接读取数组长度。创建、删除后自动重新请求统计；刷新列表同时刷新列表和统计。统计加载失败时显示明确错误和未知数量，不冒充为 0。

同一统计响应也返回 SystemModule 提供的后端运行秒数，页面展示上次统计时的值；点击刷新列表会更新它。

任务由后端保存到 MongoDB，刷新浏览器或重启后端后仍保留。当前支持查询、创建、编辑标题和删除；虽然数据结构含 `completed`，尚未提供完成状态切换。

## 验证

在 `frontend/` 目录执行：

```bash
npm run lint
npm run check
npm run build
```

`lint` 运行 Oxlint，`check` 检查 TypeScript，`build` 包含类型检查和 Vite 构建。运行构建时无需重复执行同等类型检查。目前没有前端 `test` 脚本或自动化交互测试；构建通过不代表浏览器交互或持久化已经验证。涉及行为变更时，按照对应 SPEC 验证页面流程并记录结果。
