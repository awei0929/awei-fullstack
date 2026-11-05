# 后端工作约定

开始后端任务前，先读取并遵循 [根目录 AGENT.md](../AGENT.md) 和 [当前工作状态](../docs/ai/STATE.md)。本文件仅补充 `backend/` 的约定；相关 SPEC、任务状态和交接按根规范维护。

- 用户已完成 NestJS 基础学习，具有前端经验。解释新增后端概念时使用中文，保留有助理解设计理由的注释，避免重复入门讲解。
- 环境配置与启动以 [根 README](../README.md) 为准；当前接口合同以 [系统基线 SPEC](../docs/specs/000-current-system.md) 为准，不在本文件重复维护。
- 任务已通过 Mongoose 持久化到 MongoDB。不要沿用旧版“内存存储、重启清空”的假设；检查实际代码和当前 SPEC。
- 使用 TypeScript ESM，本地模块导入保留 `.js` 扩展名；区分运行时导入与 `import type`。
- Controller 处理 HTTP 输入和路由，Service 处理业务，Module 组织依赖。跨模块通过 `imports` / `exports` 复用服务，不在 StatsModule 重新注册 TasksService 或 SystemService。
- DTO 使用运行时类及校验装饰器；路径参数与请求体分别校验，不能用 `Partial<T>` 等类型运算替代运行时校验。DTO、数据库 Schema、公开响应各有边界。
- 保持 `configureApp` 为启动和 HTTP 测试共用的配置入口；涉及公开行为的修改，同步相关 SPEC 与必要测试。
- 在 `backend/` 执行现有检查：`npm run build` 构建，`npm test` 构建后验证真实 HTTP 接口，`npm run test:e2e` 是同一测试入口。不要假定存在 lint 或独立 typecheck 脚本。
- HTTP 测试依赖 `MONGODB_URI`，会创建并清理独立临时数据库；使用开发或测试 MongoDB，保留数据库名称核对与清理逻辑。未运行、失败、受环境阻塞的检查须如实记录。
