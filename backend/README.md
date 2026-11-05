# awei 后端

NestJS 学习项目：任务管理、删除与跨模块统计。

```bash
npm ci
npm run start:dev
```

- `GET /api/tasks`：返回任务数组，成功为 200。
- `POST /api/tasks`：请求体 `{ "title": "学习 NestJS" }`，成功为 201。
- `PUT /api/tasks/:id`：id 放在路径，请求体 `{ "title": "新标题" }`，成功为 200。
- `DELETE /api/tasks/:id`：删除指定任务，成功为 200，返回被删除的任务。
- `GET /api/stats`：统计模块聚合任务模块和系统模块，返回 `{ "total": 任务数量, "uptimeSeconds": 后端运行秒数 }`。
- `src/tasks/tasks.controller.ts`：接收请求。
- `src/tasks/tasks.service.ts`：通过 Mongoose Model 读写 MongoDB 中的任务。
- `src/tasks/tasks.module.ts`：注册并组织 Controller 和 Service。

任务保存在 MongoDB，重启后端后仍然保留。标题两端空白会被去除，长度为 1–120，守卫放行后的非法参数返回 400。

编辑接口要求路径 id 和请求体 title：id 通过 ParseUUIDPipe 校验 UUID v4，title 通过 EditTaskDto 校验。请求体只接受 title；重复传 id 或额外提交 completed、createdAt 等字段会返回 400。合法 id 对应的任务不存在时返回 404。缺少路径 id 时，编辑和删除请求不匹配路由，返回 404。

删除由 `@Delete(':id')` 匹配请求，Service 使用 findOneAndDelete 原子查找并删除；没有找到任务则返回 404。删除失败不会误删其他任务，也不会改变统计数量。

## 守卫学习：控制任务写入

中文文档位置：[概述 → 守卫](https://docs.nestjs.cn/overview/guards/)，重点阅读授权守卫、执行上下文和绑定守卫。

- `src/tasks/guards/task-write.guard.ts`：canActivate 读取请求头，返回 true 放行，false 由 Nest 转换为 403。
- `src/tasks/tasks.module.ts`：在 providers 中注册 TaskWriteGuard。
- `src/tasks/tasks.controller.ts`：用方法级 @UseGuards 绑定创建、编辑、删除接口；查询任务和统计保持开放。
- 任务写入请求需要 `X-Learning-Key: awei-learning`。这是公开学习演示值，用来观察执行流程，后续登录课程再替换为真实凭证校验。
- 前端已在写入请求中携带该请求头；手动 curl 测试时需要自己添加。

先发送不带演示密钥的请求，观察 403 和终端中的“守卫拒绝”日志：

```bash
curl -i -X POST http://127.0.0.1:3000/api/tasks \
  -H 'Content-Type: application/json' \
  -d '{"title":"学习守卫"}'
```

再添加 `-H 'X-Learning-Key: awei-learning'` 发送同样请求，观察 201 和“守卫放行”日志。日志顺序是“中间件请求开始 → 守卫检查 → 中间件请求结束”，通过相同请求编号关联。

把 title 改成数字：不带密钥时先被守卫拒绝为 403；带正确密钥时继续执行 ValidationPipe，返回 400。这说明守卫在管道之前运行。

## 全局异常过滤器学习

中文文档位置：[概述 → 异常过滤器](https://docs.nestjs.cn/overview/exception-filters/)，重点阅读绑定过滤器和捕获所有异常。

1. `src/common/filters/all-exceptions.filter.ts`：@Catch() 接住 HTTP 请求中未被处理的异常；catch 方法保留 HttpException 的状态码和错误字段，补充 path、requestId。
2. `src/app.module.ts`：使用 APP_FILTER 和 useClass 注册全局过滤器，所有 Controller 都生效。
3. `src/common/middleware/request-logger.middleware.ts`：正常复用其中生成的 X-Request-Id；未经过此中间件的错误请求由过滤器补编号，响应头和错误响应体中的编号一致。

成功响应保持原来的数据结构；错误响应保留原来的 message 字符串或数组，前端可以继续使用现有错误处理。未知异常响应 500 和通用错误消息，内部堆栈记录在后端。

可以自行验证：不带演示密钥创建任务返回 403；带正确密钥但 title 为数字返回 400；查询 `/api/not-found` 返回 404。每个错误响应都增加 path、requestId，可以用请求编号关联终端里的日志。

## 多模块阅读顺序

1. `src/tasks/tasks.module.ts`：exports 公开 TasksService。
2. `src/system/system.module.ts`：注册并导出 SystemService，这个模块可以只提供服务。
3. `src/stats/stats.module.ts`：imports 同时导入 TasksModule、SystemModule，只注册自己的 StatsService。
4. `src/stats/stats.service.ts`：构造函数用两个参数分别注入服务，调用 count() 和 getUptimeSeconds()。
5. `src/stats/stats.controller.ts`：GET /api/stats 的 HTTP 入口。
6. `src/app.module.ts`：组合三个模块。

```text
StatsController → StatsService → TasksService.count()
                                 ↑
TasksController → TasksService.create/edit/remove()
```

两条调用链共享同一个 TasksService 实例，所以创建两条任务后统计为 2，编辑后仍为 2，删除一条后为 1。统计模块不额外保存任务数组。

多参数构造函数是标准的依赖注入用法：

```ts
constructor(
  private readonly tasksService: TasksService,
  private readonly systemService: SystemService,
) {}
```

每个参数都会被保存为实例属性。Nest 根据参数类型解析依赖并传入现有的 Service 实例，不是把 Module 类当作参数传入。

装饰器和全局校验配置均已添加中文注释。建议按顺序阅读：`src/tasks/dto/create-task.dto.ts` → `edit-task.dto.ts` → `src/tasks/tasks.controller.ts` → `src/tasks/tasks.service.ts` → `src/app.setup.ts`。

`npm test` 会构建项目并使用独立临时数据库验证实际 HTTP 接口，结束后清理测试数据库；`npm run build` 生成生产构建，`npm run start:prod` 运行构建结果。

默认端口 3000，可用环境变量 PORT 修改。完整课程见上一级 README。
