# awei 全栈练习：任务管理与跨模块统计

这是给有前端经验、刚开始学习 NestJS 的开发者准备的全栈练习。前后端在同一个仓库中，各自安装依赖和运行。

- `frontend/`：React 18、TypeScript、Vite、MobX、React Router、Ant Design、Less Modules。
- `backend/`：NestJS、TypeScript、Mongoose、TasksModule、SystemModule、StatsModule。
- 当前支持查询、创建、编辑、删除和任务统计，任务保存在 MongoDB 中，重启后端后仍保留。
- `compose.yaml`：使用 Docker Compose 启动本地 MongoDB，数据保存在命名卷中。

## 目录与改动记录

```text
frontend/                 前端项目
  src/pages/tasks/        任务页面
  src/api/                接口请求
  src/store/              状态管理
backend/                  后端项目
  src/tasks/              任务接口、业务、校验和数据库 Schema
  src/database/           MongoDB 连接
  src/stats/              任务统计
  src/system/             后端运行时长
  src/common/             请求日志、异常处理
  test/                   HTTP 接口测试
compose.yaml              本地数据库配置
.env.example              环境变量示例，不含真实密码
```

在项目根目录查看新增文件、修改和提交记录：

```bash
git status --short --untracked-files=all
git diff --name-status
git log --oneline
```

第一条会列出新文件的完整路径，未跟踪文件标记为 `??`。第二条查看尚未暂存的已跟踪文件改动；已暂存的改动可用 `git diff --cached --name-status` 查看。第三条查看已提交的版本记录。

VS Code 的“源代码管理”中，`U` 表示未跟踪的新文件，`A` 表示已暂存的新文件，`M` 表示已修改文件。Git 记录文件而不单独记录空文件夹；新增文件路径能显示它所在的新文件夹。提交并推送后，也能在 GitHub 的提交记录中查看每次新增和修改的文件。

## 启动

使用 Node.js 22.22.3 或更高的兼容版本，并安装和启动 Docker。首次下载项目后，在项目根目录准备本地配置；已有 `.env` 时不会覆盖：

```bash
test -f .env || cp .env.example .env
test -f backend/.env || cp backend/.env.example backend/.env
```

把根目录 `.env` 中的 `MONGO_PASSWORD` 改为自己生成的随机十六进制密码，并在 `backend/.env` 的 `MONGODB_URI` 中填入相同密码。若修改用户名，两处也要一致。真实 `.env` 文件被 Git 忽略，只上传 `.env.example`。数据库初始化账号只在首次创建数据卷时生效；已有数据库继续使用原配置。

从项目根目录启动数据库并安装依赖：

```bash
docker compose up -d
npm ci --prefix backend
npm ci --prefix frontend
```

终端一从项目根目录启动后端：

```bash
cd backend
npm run start:dev
```

终端二从项目根目录启动前端：

```bash
cd frontend
npm run dev
```

打开 http://localhost:5173 。前端通过 Vite 将 `/api` 代理到 http://127.0.0.1:3000 。
页面可以管理任务并查看后端统计，开发者工具 Network 面板可以看到实际请求。

## 先操作，再跟着请求读代码

1. 打开页面，Network 中会出现 `GET /api/tasks`；数据库中还没有任务时响应是 `[]`。
2. 输入“理解 Controller”，点击创建，观察 `POST /api/tasks`。
3. 请求体是 `{"title":"理解 Controller"}`，成功状态是 `201`。
4. 点击刷新，再次查询能够看到刚刚创建的任务。
5. 刷新浏览器或重启后端后，数据仍在 MongoDB 中。

### 编辑练习

点击任务旁的“编辑”，修改标题后保存。前端调用 `PUT /api/tasks/:id`，id 放在路径，请求体只传 title。成功后更新列表中的对应任务。再次刷新列表，标题仍为修改后的内容，任务数量不变。

编辑接口已经补上具体 DTO 校验、404 异常以及允许修改字段的限制，相关装饰器均附有中文注释。

| 请求情况 | 后端响应 |
| --- | --- |
| id、标题合法，任务存在 | 200，返回更新后的任务 |
| 路径 id 不是 UUID v4 | 400 |
| 编辑或删除缺少路径 id，未匹配路由 | 404 |
| 标题缺失、null、类型错误、空白或过长 | 400 |
| 携带 completed、createdAt 等额外字段 | 400 |
| id 格式合法，任务不存在 | 404，“任务不存在” |

`EditTaskDto` 是运行时存在的具体类，继承 CreateTaskDto 的标题转换与校验规则。路径中的 id 由 `@Param('id', new ParseUUIDPipe({ version: '4' }))` 单独校验。两个输入来源分开处理，请求体再传 id 会被视为额外字段而拒绝。

装饰器是带 `@` 的函数调用，作用是登记元数据；Nest 或相关库随后读取元数据来完成具体工作。例如 `@Put()` 登记路由，`@Body()` 指定请求参数来源，`@IsString()` 登记字段校验规则。`Partial<T>` 则属于 TypeScript 类型运算，编译后消失，不会执行网络参数校验。

这一步要练的后端思路：先定义输入边界，再明确成功与失败的响应，最后保证失败请求不改变数据。

### 删除与统计练习

新增接口：

- `DELETE /api/tasks/:id`：删除成功返回 200 和被删除的任务；任务不存在返回 404。
- `GET /api/stats`：返回 `{ "total": 0, "uptimeSeconds": 0 }`，聚合任务模块的数量和系统模块的后端运行时长。

NestJS 的装饰器名为 `@Delete(':id')`，HTTP 方法名为 DELETE。删除服务通过 MongoDB 的 `findOneAndDelete` 删除并返回任务；没有找到时返回 404。

前端删除按钮会先弹出确认框。确认后调用接口，成功时移除列表项并重新请求统计；取消时不发送删除请求。

### 多模块如何协作

```text
AppModule
├─ TasksModule
│  ├─ providers: [TasksService]
│  └─ exports: [TasksService]
├─ SystemModule
│  ├─ providers: [SystemService]
│  └─ exports: [SystemService]
└─ StatsModule
   ├─ imports: [TasksModule, SystemModule]
   ├─ providers: [StatsService]
   └─ StatsService 构造函数分别注入 TasksService、SystemService
```

`TasksModule.exports` 公开任务服务，`StatsModule.imports` 声明依赖，构造函数完成注入。统计模块复用任务模块已创建的服务实例，数据保持一致。

SystemModule 通过同样的方式公开 SystemService。StatsService 可以在构造函数中接收多个参数，在同一个统计方法中分别调用它们。参数属性写法 `private readonly xxxService: XxxService` 会自动把参数保存为 `this.xxxService`。构造参数是 Service 实例，不是 Module 实例。

只在 AppModule 中导入两个模块，并不会自动使它们的服务互相可用。StatsModule 仍然要显式导入 TasksModule。不要再把 TasksService 注册进 StatsModule.providers；应复用 TasksModule 导出的服务，避免重复实例或依赖解析错误。

本课的实际请求链：

```text
GET /api/stats
→ StatsController.getOverview()
→ StatsService.getOverview()
  ├─ TasksService.count()
  └─ SystemService.getUptimeSeconds()
→ 返回当前任务数量和后端运行秒数
```

可以创建两条任务，观察统计为 2；编辑标题，数量仍为 2；删除一条，统计变为 1。这是验证两个模块共享同一份任务服务的直接方法。

任务结构：

```json
{
  "id": "服务端生成的 UUID",
  "title": "理解 Controller",
  "completed": false,
  "createdAt": "ISO 格式的创建时间"
}
```

## Controller、Service、Module 的关系

**Controller 接收 HTTP 请求，Service 管任务业务和数据，Module 声明它们如何组织。**

| 文件 | 这一课中的职责 |
| --- | --- |
| `backend/src/tasks/tasks.controller.ts` | 把 GET、POST、PUT、DELETE 路由映射到方法，提取并校验参数 |
| `backend/src/tasks/tasks.service.ts` | 查询、创建、编辑、删除任务，并提供数量查询方法 |
| `backend/src/tasks/tasks.module.ts` | 注册任务能力，并导出 TasksService |
| `backend/src/stats/stats.module.ts` | 导入 TasksModule，注册统计能力 |
| `backend/src/stats/stats.service.ts` | 同时注入 TasksService、SystemService，聚合两个模块的数据 |
| `backend/src/system/system.service.ts` | 提供后端运行时长 |
| `backend/src/app.module.ts` | 组合 TasksModule、SystemModule 和 StatsModule |
| `backend/src/main.ts` | 创建 Nest 应用并监听端口 |

### Module 在应用启动时组织依赖

```text
main.ts 调用 NestFactory.create(AppModule)
  └─ AppModule.imports: [TasksModule, SystemModule, StatsModule]
       ├─ TasksModule 注册并导出 TasksService
       ├─ SystemModule 注册并导出 SystemService
       └─ StatsModule 导入上面两个模块
            └─ StatsService 构造函数依赖 TasksService、SystemService
```

Nest 读取模块声明，创建 TasksService，并把它注入 TasksController。
你在 Controller 中声明“我需要 TasksService”，而不是手动 `new TasksService()`。

`@Injectable()` 让一个类能够参与依赖注入；它还需要在模块的 `providers` 中注册。
当前 Service 在默认作用域下是单例；任务数据由 MongoDB 持久化保存，不依赖 Service 实例或进程内数组。

**Module 不是每次请求都依次经过的中间处理步骤。它主要负责组织模块和依赖。**

### GET 查询请求怎样流转

```text
浏览器打开页面
  → frontend/src/pages/tasks/index.tsx 中的 useEffect
  → frontend/src/store/tasks.ts 的 loadTasks()
  → frontend/src/api/tasks.ts 的 getTasks()
  → fetch('/api/tasks')
  → Vite 代理到后端
  → TasksController.findAll()（@Get）
  → TasksService.findAll()
  → 通过 Mongoose 查询 MongoDB 的 tasks 集合
  → Nest 把返回值序列化为 JSON，状态 200
  → MobX 更新 tasks
  → observer 组件重新渲染
```

`main.ts` 中配置的 `/api` 前缀，加上 `@Controller('tasks')` 和 `@Get()`，组合为 `GET /api/tasks`。

### POST 创建请求怎样流转

```text
填写标题，提交表单
  → frontend store.createTask(title)
  → POST /api/tasks，携带 JSON 请求体
  → Nest 解析 JSON，匹配 Controller 路由
  → @Body() 取得请求体，ValidationPipe 按 CreateTaskDto 校验
  → TasksController.create(input)
  → TasksService.create(input)
  → Mongoose 按 Schema 生成 id 和时间，把任务写入 MongoDB
  → Nest 返回新任务，状态 201
  → MobX 将新任务加入列表
  → 页面显示新任务
```

本课已加上最小输入校验：标题会去除两端空白，长度 1–120，拒绝多余字段。
DTO 和 Pipe 可以留到下一课细读。TypeScript 类型本身不能校验网络请求。

## 用终端直接验证 HTTP

```bash
curl -i http://localhost:3000/api/tasks

curl -i http://localhost:3000/api/tasks \
  -H 'Content-Type: application/json' \
  -H 'X-Learning-Key: awei-learning' \
  -d '{"title":"理解 Service"}'
```

GET 返回 200，成功 POST 返回 201。写入接口需要上述公开的学习演示请求头；缺少时返回 403，通过守卫后空白标题会返回 400。

## 本课建议阅读顺序

1. `backend/src/tasks/tasks.controller.ts`
2. `backend/src/tasks/tasks.service.ts`
3. `backend/src/tasks/tasks.module.ts`
4. `backend/src/app.module.ts`
5. `backend/src/main.ts`
6. 最后回到前端 `api`、`store` 和页面，把完整请求串起来。

## 独立练习

先预测结果，再实际操作：

1. 把 `@Controller('tasks')` 改成 `@Controller('todos')`，前端会发生什么？哪些地方需要一起修改？
2. 创建任务后，刷新页面、重启后端，分别会发生什么？为什么？
3. 从 `TasksModule.providers` 中移除 `TasksService`，应用为什么启动失败？完成后恢复配置。

练习完成的标准：能解释 Controller 如何拿到 Service，以及 Module 为什么没有出现在运行时请求链中。

## 验证

```bash
# 从项目根目录执行，MongoDB 需已启动且本地配置可用。
npm test --prefix backend
npm run build --prefix frontend
```

后端测试会构建实际代码，在临时端口启动 HTTP 服务，验证查询、创建、数据共享和非法输入。
它不会占用开发服务器的 3000 端口；每个用例使用独立的临时数据库，完成后清理，不修改开发数据库。

## 官方参考

- [Controllers](https://docs.nestjs.com/controllers)
- [Providers 与依赖注入](https://docs.nestjs.com/providers)
- [Modules](https://docs.nestjs.com/modules)
