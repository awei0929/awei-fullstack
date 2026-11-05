# awei 前端

React 18 + TypeScript + Vite + MobX + React Router + Ant Design + Less Modules。

```bash
npm ci
npm run dev
```

本机地址：http://localhost:5173 。后端需在 3000 端口启动。

- `src/api/tasks.ts`：任务 HTTP 请求。
- `src/api/stats.ts`：调用后端统计接口。
- `src/store/tasks.ts`：任务状态、加载与错误处理。
- `src/pages/tasks/index.tsx`：任务查询、创建、编辑、删除，以及统计展示。
- `src/router/index.tsx`：路由。
- `vite.config.ts`：`/api` 开发代理。

执行 `npm run build` 验证类型和构建。完整课程见上一级 README。

任务列表每行提供“编辑”和“删除”。编辑调用 `PUT /api/tasks/:id`，请求体只传 `{ title }`；删除经确认后调用 `DELETE /api/tasks/:id`。成功后更新列表，失败时保留弹窗提示，提交期间禁止重复操作。

页面的任务总数来自 `GET /api/stats`，而不是前端直接读取数组长度。创建、删除后自动重新请求统计；刷新列表同时刷新列表和统计。统计加载失败时显示明确错误和未知数量，不冒充为 0。

同一统计响应也返回 SystemModule 提供的后端运行秒数，页面展示上次统计时的值；点击刷新列表会更新它。
