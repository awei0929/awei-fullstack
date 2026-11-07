# 后端工作约定

开始后端任务前，先读取并遵循 [根目录 AGENT.md](../AGENT.md) 和 [当前工作状态](../docs/ai/STATE.md)。本文件仅补充 `backend/` 的约定；相关 SPEC、任务状态和交接按根规范维护。

- 项目主要用于学习 NestJS，用户有前端经验。所有手写后端源码须保留中文学习注释：说明文件/类职责、模块依赖与注入、请求执行顺序、关键业务和安全设计原因；修改逻辑时同步注释。测试辅助代码同样解释隔离与验证目的；不改第三方依赖或生成文件，也不逐行翻译显而易见的赋值。
- 环境配置与启动以 [根 README](../README.md) 为准；当前接口合同以 [系统基线 SPEC](../docs/specs/000-current-system.md) 为准，不在本文件重复维护。
- 任务已通过 Mongoose 持久化到 MongoDB。不要沿用旧版“内存存储、重启清空”的假设；检查实际代码和当前 SPEC。
- 使用 TypeScript ESM，本地模块导入保留 `.js` 扩展名；区分运行时导入与 `import type`。
- Controller 处理 HTTP 输入和路由，Service 处理业务，Module 组织依赖。跨模块通过 `imports` / `exports` 复用服务，不在 StatsModule 重新注册 TasksService 或 SystemService。
- DTO 使用运行时类及校验装饰器；路径参数与请求体分别校验，不能用 `Partial<T>` 等类型运算替代运行时校验。DTO、数据库 Schema、公开响应各有边界。
- 保持 `configureApp` 为启动和 HTTP 测试共用的配置入口；涉及公开行为的修改，同步相关 SPEC 与必要测试。
- 在 `backend/` 执行现有检查：`npm run build` 构建，`npm test` 构建后验证真实 HTTP 接口，`npm run test:e2e` 是同一测试入口。不要假定存在 lint 或独立 typecheck 脚本。
- HTTP 测试依赖 `MONGODB_URI`，会创建并清理独立临时数据库；使用开发或测试 MongoDB，保留数据库名称核对与清理逻辑。未运行、失败、受环境阻塞的检查须如实记录。

## 模块与目录组织

- 先按业务职责划分 Nest Module，再整理模块内目录。用户模型、用户持久化及密码哈希/校验属于 `UsersModule`；认证 HTTP 入口、Session 生命周期与认证 Guard 属于 `AuthModule`。不要因注册/登录会使用用户数据，就把用户模块放进认证目录。
- 模块根目录保留主要的 `*.module.ts`、`*.controller.ts`、`*.service.ts`；辅助文件按职责放入 `dto/`、`schemas/`、`guards/`、`config/`、`types/` 等目录，存在对应职责时再创建，不建空目录、不把辅助文件全部平铺到模块根。
- 每个 Guard 独立一个 `*.guard.ts` 文件。本项目的 `SessionGuard`、`CsrfGuard`、`AuthRateLimitGuard` 分别放在 `auth/guards/session.guard.ts`、`csrf.guard.ts`、`auth-rate-limit.guard.ts`；不合并为 `auth.guards.ts`。Guard 归所属业务模块；只有已有跨业务通用用途时才考虑公共目录。
- `UsersModule` 注册用户 Schema、提供并导出 `UsersService`；`AuthModule` 通过 `imports: [UsersModule]` 使用它，不重复注册用户 Model 或 `UsersService`。依赖方向为 `AuthModule → UsersModule`，用户模块不得反向依赖认证 DTO、Session 类型或 Guard。
- HTTP DTO 的运行时校验留在接口所属模块；跨模块服务输入使用所属业务模块的类型。公开用户类型放在 `users/types/`，会话类型放在 `auth/types/`，避免仅为共享类型制造循环依赖。
- 移动或拆分文件时同步更新 import、模块依赖、中文学习注释和当前文档链接；保留行为的整理须用已有相关测试回归。后续新增代码沿用这些约定，不能借“最小实现”重新平铺。
