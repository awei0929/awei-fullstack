# NestJS 后端

本项目提供个人官网、站主配置、会话认证、任务管理与跨模块统计，包含 DTO 校验、写入守卫、请求日志、全局异常处理，以及 MongoDB 持久化。这里保留后端实现的阅读说明，适合已完成 NestJS 基础学习、具有前端经验的开发者。

- [根 README](../README.md)：唯一的环境准备与启动入口，包含 Node.js、Docker Compose、MongoDB 和环境变量配置。
- [系统基线 SPEC](../docs/specs/000-current-system.md)：当前接口、输入输出、状态码、数据规则和验收标准。
- [后端工作约定](./AGENTS.md)：修改后端前需读取的规则。
- [当前工作状态](../docs/ai/STATE.md)：任务进度、验证记录与接续入口。

## 运行前提

启动后端前，先按根 README 准备 MongoDB，并配置 `backend/.env` 中的 `MONGODB_URI`；变量示例见 [`.env.example`](./.env.example)。`DatabaseModule` 使用 `ConfigService.getOrThrow` 取得连接地址，缺少配置会阻止启动，仅安装 npm 依赖并不足以运行后端。

用户、会话、任务和官网内容均存入 MongoDB。任务按会话用户隔离；官网配置仅允许 `SITE_OWNER_USER_ID` 指定的站主读写，未配置时拒绝所有人。公开注册已经关闭，登录与任务合同见 [SPEC-001](../docs/specs/001-session-auth.md)，官网合同与关闭注册覆盖规则见 [SPEC-003](../docs/specs/003-personal-site.md)。

## 请求和数据的职责边界

| 入口 | 职责 |
| --- | --- |
| [site.module.ts](./src/site/site.module.ts) | 组织站点持久化、站主权限、公开读取与媒体上传 |
| [site.service.ts](./src/site/site.service.ts) | 单站点版本原子比较更新、默认内容与历史作品字段只读剔除 |
| [site-assets.service.ts](./src/site/site-assets.service.ts) | 验证音频容器/帧，使用随机文件名持久化并受控读取媒体 |
| [main.ts](./src/main.ts) | 创建 Nest 应用、应用公共配置并监听本机端口 |
| [app.setup.ts](./src/app.setup.ts) | 设置 `/api` 前缀、全局 ValidationPipe 和退出钩子；测试复用此配置 |
| [tasks.controller.ts](./src/tasks/tasks.controller.ts) | 声明 HTTP 路由、参数来源和方法级守卫 |
| [tasks.service.ts](./src/tasks/tasks.service.ts) | 通过 Mongoose Model 查询和修改任务，并映射公开响应 |
| [tasks.module.ts](./src/tasks/tasks.module.ts) | 注册任务模型、Controller、Service 和 Guard，导出 TasksService |
| [database.module.ts](./src/database/database.module.ts) | 根据环境配置建立 MongoDB 连接 |
| [task.schema.ts](./src/tasks/schemas/task.schema.ts) | 定义 MongoDB 文档字段、默认值和模型层校验 |

DTO 描述 HTTP 输入，Schema 描述数据库存储，公开响应描述客户端能够看到的数据。`TasksService.toTask()` 保留公开 UUID 和前端使用的字段，不直接返回 MongoDB 的内部字段。数据库查询是异步的，Controller 返回 Promise 后由 Nest 等待完成并发送响应。

编辑与删除通过路径参数取得任务标识；请求体由具体 DTO 类负责校验。`EditTaskDto` 继承 `CreateTaskDto` 的运行时校验规则，而 `Partial<T>` 仅在 TypeScript 编译阶段存在，不能验证网络输入。输入边界的具体规则统一见系统基线 SPEC。

建议结合源码阅读：[CreateTaskDto](./src/tasks/dto/create-task.dto.ts) → [EditTaskDto](./src/tasks/dto/edit-task.dto.ts) → [Controller](./src/tasks/tasks.controller.ts) → [Service](./src/tasks/tasks.service.ts) → [公共配置](./src/app.setup.ts)。

## 守卫与请求日志

[SessionGuard](./src/auth/guards/session.guard.ts) 恢复并验证会话用户，个人任务读写均要求登录；写请求再经过 [CsrfGuard](./src/auth/guards/csrf.guard.ts)。官网配置与上传额外使用 [SiteOwnerGuard](./src/site/guards/site-owner.guard.ts)，只比较服务端认证后的用户 UUID。公开官网与游客示例使用独立入口。

守卫在参数管道之前执行，因此同一个非法请求可能先被守卫拒绝，只有放行后才进入 DTO 和路径参数校验。这个顺序已由 [HTTP 测试](./test/tasks.e2e.test.mjs) 覆盖。

[RequestLoggerMiddleware](./src/common/middleware/request-logger.middleware.ts) 为请求生成编号，写入 `X-Request-Id` 响应头，记录开始与结束日志。它使用响应的 `finish` 事件获取最终状态码和耗时；调用 `next()` 只是放行，不能据此判断业务已执行完成。

## 全局异常处理

[AllExceptionsFilter](./src/common/filters/all-exceptions.filter.ts) 通过 `@Catch()` 捕获 HTTP 请求中未处理的异常，并在 [AppModule](./src/app.module.ts) 中使用 `APP_FILTER` 注册为全局过滤器。

过滤器保留已知 HTTP 异常的状态码与消息，补充请求路径和请求编号。未知异常的内部堆栈留在后端日志，客户端收到通用错误信息；没有经过请求日志中间件的异常也会补上请求编号。成功响应不经过额外的数据包装。

## 多模块协作

[StatsModule](./src/stats/stats.module.ts) 显式导入 TasksModule 和 SystemModule，只注册自己的 StatsService。[StatsService](./src/stats/stats.service.ts) 分别注入两个模块导出的 Service，聚合任务数量和后端运行时长。

```text
StatsController → StatsService → TasksService.count()
                              └→ SystemService.getUptimeSeconds()
TasksController → TasksService.create/edit/remove()
```

统计与任务接口复用 TasksService，查询同一个 MongoDB 集合。统计模块不保存任务副本，也不重新注册其他模块的 Service。仅在 AppModule 导入这些模块，并不能代替 StatsModule 对其依赖的显式声明。

```ts
constructor(
  private readonly tasksService: TasksService,
  private readonly systemService: SystemService,
) {}
```

这里注入的是 Service 实例，`private readonly` 参数属性将实例保存到当前对象。Module 在启动时组织依赖，不是每次 HTTP 请求都要经过的一层业务处理。

## 验证方式

在 `backend/` 目录执行：

```bash
npm run build
npm test
```

`npm test` 本身会先构建，再用 Node.js 测试运行器执行 `test/*.e2e.test.mjs`（认证、任务、站点与受控初始化）；只需验证 HTTP 行为时直接运行 `npm test`，无需重复构建。`npm run test:e2e` 调用同一测试入口。可用脚本以 [package.json](./package.json) 为准。

测试连接 `MONGODB_URI` 指定的 MongoDB 服务，每个用例使用随机命名的 `awei_e2e_*` 数据库和临时 HTTP 端口。结束时先核对数据库名称，再删除该用例数据库并关闭连接。运行前需要可访问的开发或测试 MongoDB，以及创建和删除这些临时数据库的权限。

现有测试覆盖任务增删改查与隔离、会话与CSRF、关闭注册、站主权限、版本并发保存、重启恢复、输入校验、媒体上传及本地初始化；测试文件的存在不代表本次变更已验证。每次执行的结果和未验证项按根规范记录到对应任务，不能用构建通过代替 HTTP 测试通过。
