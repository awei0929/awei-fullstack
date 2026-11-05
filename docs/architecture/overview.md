# 架构概览

核对日期：2026-11-05。类型：当前实现事实；接口细节见 [SPEC-000](../specs/000-current-system.md)。
更新触发：模块关系、存储方式、运行依赖或请求处理链发生变化。

## 结构

单一 Git 仓库包含前后端两个 npm 项目，分别安装依赖、执行命令；根目录没有统一的 npm 工作区脚本。

```text
浏览器
  → React 页面 → MobX Store → API/request
  → Vite /api 代理（开发环境）
  → NestJS Controller → Service → Mongoose → MongoDB

AppModule
  ├─ ConfigModule：读取 backend/.env
  ├─ DatabaseModule：建立 MongoDB 连接
  ├─ TasksModule：任务 Controller / Service / Guard / Schema
  ├─ SystemModule：提供本次运行时长
  └─ StatsModule：导入 TasksModule、SystemModule，组合其服务
```

## 模块与事实依据

| 职责 | 代码入口 |
| --- | --- |
| 应用启动与监听 | [main.ts](../../backend/src/main.ts) |
| /api 前缀、全局输入校验 | [app.setup.ts](../../backend/src/app.setup.ts) |
| 配置、模块、中间件与全局异常过滤器注册 | [app.module.ts](../../backend/src/app.module.ts) |
| 连接配置；MONGODB_URI 缺失时启动失败 | [database.module.ts](../../backend/src/database/database.module.ts) |
| 任务数据库操作与公开响应映射 | [tasks.service.ts](../../backend/src/tasks/tasks.service.ts) |
| 模型注册、服务导出与写入守卫 | [tasks.module.ts](../../backend/src/tasks/tasks.module.ts) |
| 统计聚合 | [stats.service.ts](../../backend/src/stats/stats.service.ts) |
| 页面、请求状态与并发处理 | [页面](../../frontend/src/pages/tasks/index.tsx) / [Store](../../frontend/src/store/tasks.ts) |
| HTTP 请求与错误消息解析 | [http.ts](../../frontend/src/api/http.ts) |

## 数据与运行边界

- 任务保存在 MongoDB 的 tasks 集合，后端通过 Mongoose Model 访问；进程内没有任务数组作为数据源。
- MongoDB 内部 _id 与对外 UUID id 分离；日期在数据库使用 Date，在公开响应中转换为 ISO 字符串。
- 数据库持久化与 Service 单例是不同概念；重启后端保留数据库任务，但运行时长重新计时。
- [Compose](../../compose.yaml) 只启动 MongoDB，前后端在宿主机运行。数据库使用命名卷。
- Compose 的项目名仍为 awei，数据库示例名也是 awei；它们不随工作区目录更名而自动修改。
- 开发后端默认监听 127.0.0.1:3000；前端监听 127.0.0.1:5173，[Vite 配置](../../frontend/vite.config.ts)将 /api 转发到后端。修改后端端口时须同步代理。
- 配置模板为根目录与 backend 各自的 .env.example。真实配置不进入文档或 Git。
- 详细环境准备与命令统一维护在 [README](../../README.md)。

## 请求边界

任务/统计路由经过请求日志中间件；任务写入方法额外经过演示 Guard，再执行输入校验与业务逻辑。
成功响应直接返回业务数据；全局异常过滤器保留 HTTP 异常状态，并补充 path、requestId，未知错误响应不暴露内部详情。
未匹配路由或 JSON 解析失败等请求可能未经过该中间件，过滤器会补充请求编号。

## 当前能力边界

- 写入 Guard 使用公开学习演示值，尚无正式用户登录、用户级权限或任务归属隔离。
- completed 字段存在，但当前接口与页面没有完成状态切换。
- 前端已有构建、类型检查和 lint；未提供自动化交互测试脚本。
- 后端 HTTP 测试使用真实 MongoDB 的独立临时数据库；不能用构建通过替代 HTTP 验证。
- 后端重启保留数据是实现预期；现有测试尚无跨应用重启的专项验收，运行证据见基线与 STATE。
