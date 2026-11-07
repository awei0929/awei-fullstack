# awei：个人任务管理

React + NestJS + MongoDB 全栈练习。游客可以浏览只读示例；注册或登录后管理自己的任务。

- 单一普通用户角色，数字账号、密码注册登录；登录与注册使用同一个弹窗。
- 注册成功自动登录；页面刷新恢复会话；退出后回到公共示例。
- 每个用户只查看和管理自己的任务，任务列表和统计均由后端按用户过滤。
- 使用 MongoDB 保存用户、任务与 Session；不接入验证码、邮箱、短信或自助找回密码。
- 新功能的完整合同、边界和实际验收状态见 [SPEC-001](docs/specs/001-session-auth.md)。当前进度见 [STATE](docs/ai/STATE.md)。

## 开发入口

- [AGENT](AGENT.md) / [AGENTS](AGENTS.md)：项目规范和工具入口。
- [文档导航](docs/README.md) / [架构概览](docs/architecture/overview.md)。
- [SPEC 规范](SPEC.md) / [当前系统基线](docs/specs/000-current-system.md)。
- [OpenSpec 与 Superpowers 配置](docs/ai/TOOLING.md)：引用同一份 SPEC，不维护重复规格。

## 环境准备

使用 Node.js 22.22.3 或更高的兼容版本，安装 Docker。前后端为独立 npm 项目。
从项目根目录准备配置；已有文件不会覆盖：

```bash
test -f .env || cp .env.example .env
test -f backend/.env || cp backend/.env.example backend/.env
npm ci --prefix backend
npm ci --prefix frontend
```

根 `.env` 的 MongoDB 密码与 `backend/.env` 中的 MONGODB_URI 必须对应。已有数据库卷不因修改环境变量自动更换密码。真实配置不进入 Git。

后端还需要 SESSION_SECRET，至少32字符，并在重启间保持稳定。可用以下命令在缺失或仍为模板值时生成随机值到本地文件，不打印密钥：

```bash
python3 - <<'PYSECRET'
from pathlib import Path
import secrets
p = Path('backend/.env')
text = p.read_text()
lines = text.splitlines()
for i, line in enumerate(lines):
    if line.strip().startswith('SESSION_SECRET='):
        value = line.split('=', 1)[1].strip()
        if not value or value == 'replace_with_a_random_secret_at_least_32_characters':
            lines[i] = 'SESSION_SECRET=' + secrets.token_hex(32)
        break
else:
    lines.append('SESSION_SECRET=' + secrets.token_hex(32))
p.write_text('\n'.join(lines) + '\n')
PYSECRET
```

配置名称和默认值以 [backend/.env.example](backend/.env.example) 为准。生产启用 HTTPS 与 Secure Cookie；部署在反向代理后时只信任实际代理，不无条件信任转发来源。

## 启动

```bash
# 若已有可用 MongoDB，可直接复用配置中的连接，不再启动第二个占用相同端口的实例。
docker compose up -d
```

终端一：

```bash
npm run start:dev --prefix backend
```

终端二：

```bash
npm run dev --prefix frontend
```

打开 http://127.0.0.1:5173 。Vite 将 /api 代理到 127.0.0.1:3000。数据库由 Compose 运行，应用在宿主机运行。

## 操作流程

1. 未登录时看到标记为“示例任务”的三条默认数据。
2. 点击“登录 / 注册”，或点击示例的创建、编辑、删除入口，打开登录弹窗。
3. 点击“立即注册”，输入数字账号、密码与确认密码；成功后进入个人任务区，初始为空。
4. 创建、编辑标题、确认删除任务；取消删除不发送请求，创建/删除后刷新个人统计。
5. 刷新页面恢复登录；点击退出回到示例。登录过期会清除私有数据并提示重新登录。

数字账号为3–5位ASCII数字字符串，保留前导零。未设置可验证的联系方式，第一版没有自助找回密码入口。密码规则、会话期限和错误行为统一见 SPEC-001。

历史无 ownerId 的任务仍保留在数据库，但不会作为示例公开，也不会分配给首个注册用户。若需要迁移，须另行确定归属。

## 请求与模块

```text
浏览器
  → API / MobX Store / 登录注册弹窗与任务页
  → Vite /api 代理
  → NestJS Session、认证与 CSRF 检查
  → Controller → Service → Mongoose → MongoDB
```

- 首次 GET /api/auth/session 恢复身份并取得 CSRF 令牌；匿名状态也可以取得注册/登录所需令牌。
- POST 注册/登录成功后重新生成 Session ID，并返回用户和新的 CSRF 令牌。
- 浏览器通过 HttpOnly Cookie 携带会话，写请求在 X-CSRF-Token 中携带当前令牌。
- 公共示例由 /api/public/tasks 与 /api/public/stats 提供；个人 /api/tasks 与 /api/stats 要求登录。
- 创建任务时 ownerId 由服务端当前用户决定，编辑/删除使用 id 与 ownerId 联合过滤。前端隐藏操作不能代替后端权限检查。
- 已移除 X-Learning-Key 学习演示头；它不再提供写入权限。
- 错误响应保留 HTTP 状态及 message，并补充 path/requestId；未知错误不暴露内部信息。

### 工程边界

Controller 处理 HTTP 输入，Service 处理业务，Module 组织依赖。UsersModule 管理用户模型、持久化与密码校验，导出 UsersService；AuthModule 导入它，负责认证入口和 Session 生命周期。StatsModule 复用任务服务提供的用户级统计，不重复注册服务。

模块根目录保留主要 Controller / Service / Module，DTO、Schema、Guard、配置与类型按职责归入子目录；每个 Guard 独立文件。具体约定见 [后端规则](backend/AGENTS.md#模块与目录组织)，本次整理与验证见 [SPEC-002](docs/specs/002-auth-module-organization.md)。

DTO、数据库 Schema 与公开响应独立；用户及密码哈希不直接序列化为响应。会话过期由服务端校验，MongoDB TTL 仅负责清理。

前端在身份切换时清空数据并使旧回调失效；旧请求即使完成，也不能覆盖新用户的页面。取消请求不能撤销已经在服务端执行的操作。

## 验证

从项目根目录运行，要求本地 MongoDB 可用：

```bash
npm test --prefix backend
npm run lint --prefix frontend
npm run build --prefix frontend
```

后端测试构建实际代码，并使用随机 awei_e2e_ 数据库启动真实 HTTP 服务，结束后只清理对应测试库。测试覆盖认证、CSRF、限流、用户隔离、任务原有边界和跨应用重启；实际结果以 SPEC 验证记录为准。

前端 build 包含 TypeScript 检查，不需要重复运行 check。当前没有前端 test 脚本；浏览器验收单独记录，构建成功不代表交互全部通过。

## NestJS 学习阅读顺序

后端手写源码带有中文学习注释，建议沿一次请求阅读：

1. [main.ts](backend/src/main.ts) → [app.module.ts](backend/src/app.module.ts)：应用启动、模块组装、依赖注入。
2. [app.setup.ts](backend/src/app.setup.ts)：Session 中间件、全局管道与测试共用配置。
3. [auth.controller.ts](backend/src/auth/auth.controller.ts) → [session.guard.ts](backend/src/auth/guards/session.guard.ts) / [csrf.guard.ts](backend/src/auth/guards/csrf.guard.ts) / [auth-rate-limit.guard.ts](backend/src/auth/guards/auth-rate-limit.guard.ts)：HTTP 路由、身份、CSRF 与认证限流。
4. [auth.module.ts](backend/src/auth/auth.module.ts) → [users.module.ts](backend/src/users/users.module.ts)，再读 [auth.service.ts](backend/src/auth/auth.service.ts) → [users.service.ts](backend/src/users/users.service.ts)：跨模块依赖注入、会话生命周期、密码哈希与用户持久化。
5. [tasks.controller.ts](backend/src/tasks/tasks.controller.ts) → [tasks.service.ts](backend/src/tasks/tasks.service.ts)：参数校验、按用户隔离的数据库操作、公开响应映射。
6. [HTTP 测试辅助](backend/test/helpers/app.mjs)：如何用 TestingModule 替换连接，验证真实请求且保护开发数据。

## 目录

```text
backend/src/users/       用户模型、持久化、密码哈希与校验
backend/src/auth/        认证入口、Session与认证守卫
  guards/               Session、CSRF、限流，各自独立文件
  config/               认证配置
  types/                会话响应与请求类型扩展
  dto/                  注册登录输入校验
backend/src/tasks/       私有任务CRUD
backend/src/stats/       用户级任务统计
backend/src/database/    MongoDB连接
backend/test/            隔离数据库HTTP验证
frontend/src/api/        HTTP与认证API
frontend/src/store/      身份及任务状态
frontend/src/pages/      任务页和交互
openspec/changes/        变更引用，正文位于docs/specs/
docs/ai/STATE.md         当前状态与接续入口
```
