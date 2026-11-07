# awei 前端

React 18 + TypeScript + Vite + MobX + React Router + Ant Design + Less Modules。

## 启动与文档入口

环境要求、MongoDB 配置、依赖安装和前后端启动步骤统一见 [根 README](../README.md)。前端依赖运行中的后端与数据库；开发请求通过 `vite.config.ts` 的 `/api` 代理发送到后端。

- [AI 开发约定](../AGENT.md)：整个工作区的开发流程。
- [前端补充约定](./AGENTS.md)：分层、交互和验证规则。
- [当前工作状态](../docs/ai/STATE.md)：切换会话或模型后的接续入口。
- [当前系统基线](../docs/specs/000-current-system.md)：前后端接口合同和已实现范围。

## 代码入口

- `src/api/auth.ts`、`src/store/auth.ts`：Session 恢复、注册、登录、退出与身份版本。
- `src/api/http.ts`：同源 Cookie 请求、CSRF 请求头与带状态码的 HTTP 错误。
- `src/api/tasks.ts`：公共 / 私有任务 HTTP 请求。
- `src/api/stats.ts`：调用后端统计接口。
- `src/store/tasks.ts`：任务状态、加载与错误处理。
- `src/components/auth-modal.tsx`：同弹窗登录 / 注册、表单校验与提交保护。
- `src/pages/tasks/index.tsx`：游客预览、个人任务、查询、创建、编辑、删除与统计展示。
- `src/router/index.tsx`：路由。
- `vite.config.ts`：`/api` 开发代理。

## 页面行为

页面先调用 `GET /api/auth/session` 恢复身份；网络失败显示重新连接入口，不将失败解释为未登录。游客从 `/api/public/tasks` 和 `/api/public/stats` 查看三条只读示例，创建、编辑或删除只打开登录弹窗，不重放原操作。

账号是 3–5 位数字字符串，保留前导零；密码 8–64 个 Unicode 码点，注册要求确认密码并自动登录。同一弹窗通过底部“立即注册 / 去登录”链接切换，不使用顶部 Tabs；业务错误显示消息提示，字段校验留在输入框旁。失败保留输入，提交中禁止重复操作和关闭。登录成功后只查询个人 `/api/tasks`、`/api/stats`；新账号为空清单。CSRF 令牌来自会话接口，认证和任务写入通过 `X-CSRF-Token` 携带。

任务列表每行提供“编辑”和“删除”。编辑调用 `PUT /api/tasks/:id`，请求体只传 `{ title }`；删除经确认后调用 `DELETE /api/tasks/:id`。成功后更新列表，失败保留弹窗提示，提交期间禁止重复操作。

任务总数来自后端统计，创建、删除后重新查询；刷新列表同时刷新列表和统计。统计加载失败显示明确错误和未知数量，不冒充为 0，也不把已成功的写入描述为失败。

登录、退出和会话失效会立即清空旧身份的列表、统计、错误和编辑 / 删除弹窗。所有异步结果（包括失败、finally 与写入后的统计刷新）同时检查身份版本；旧请求的 401 不能退出新用户。当前身份的 401 返回示例并打开登录弹窗；退出请求失败保留身份，显示可重试错误。

任务由后端保存到 MongoDB，下次登录可继续访问个人任务。当前支持查询、创建、编辑标题和删除；虽然数据结构含 `completed`，尚未提供完成状态切换。HTTP 合同和验收场景见 [SPEC-001](../docs/specs/001-session-auth.md)。

## 验证

在 `frontend/` 目录执行：

```bash
npm run lint
npm run check
npm run build
```

`lint` 运行 Oxlint，`check` 检查 TypeScript，`build` 包含类型检查和 Vite 构建。运行构建时无需重复执行同等类型检查。目前没有前端 `test` 脚本或自动化交互测试；构建通过不代表浏览器交互或持久化已经验证。涉及行为变更时，按照对应 SPEC 验证页面流程并记录结果。
