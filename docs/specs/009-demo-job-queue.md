# SPEC-009 演示作业异步队列

- 编号：009
- 状态：就绪
- 更新日期：2026-11-20
- 基准：`65f01df` 加当前工作区未提交的 SPEC-008 简历页改动；本规格不修改那份改动。
- 关联 / 前置：沿用 [SPEC-000](000-current-system.md) 的 Session/CSRF 与个人数据隔离；不改变 [SPEC-001](001-session-auth.md) 的认证合同。

## 目标与范围

- 问题与用户目标：当前任务页的提交、处理、展示都在一次 HTTP 请求内完成。用户希望学习并验证一个真正异步的作业队列：请求受理后立刻返回，后台逐步处理，前端可观察进度与结果，并且进程重启后未完成作业不会丢失。
- 本次包含：独立的 `QueueModule`、MongoDB `demo_jobs` 集合、同进程 Worker、租约领取、启动恢复、两个私有 HTTP 接口、任务页的提交与进度展示、HTTP 测试与工程检查。
- 本次不包含：Redis/BullMQ 等新依赖；多实例部署或独立 Worker 进程；聊天断线后台续跑；取消正在运行的作业；作业优先级、重试次数上限、定时/延迟队列；对现有 `/api/tasks` CRUD 合同的修改。

## 用户行为

- 已登录用户在 `/tasks` 的「异步作业演示」区填写标签并提交。提交成功立即得到 `jobId`，页面出现该作业并显示 `pending/running` 状态与百分比进度；轮询到 `done` 后显示结果，失败显示原因。刷新页面后仍可看到本人最近作业。
- 未登录用户看到登录入口，不能提交或读取作业。提交期间按钮禁用，避免重复提交；身份切换时旧身份的作业列表与轮询计时器立即清空，旧响应不能写回新身份。
- 空列表显示简洁空态；读取失败提供重试；作业失败保留失败记录与错误信息，不自动重试。
- 服务端进程重启后，遗留的超时 `running` 作业回到 `pending` 并由新进程继续处理；已 `done` 的作业不再执行。

## 接口与数据契约

| 方法 / 路径 | 权限与输入 | 成功状态 / 响应 | 失败状态 / 数据影响 |
| --- | --- | --- | --- |
| `POST /api/jobs` | SessionGuard + CsrfGuard；JSON `{ label }`，label 为 trim 后 1–80 字符的字符串 | `202 Accepted`，返回作业视图（含 `id`、`status: 'pending'`、`progress: 0`） | 401/403/400；不写入作业 |
| `GET /api/jobs` | SessionGuard；无请求体 | `200`，当前用户最近 20 条作业视图，按创建时间倒序 | 401；不返回其他用户作业 |

- 作业视图字段：`id`、`label`、`status`（`pending | running | done | failed`）、`progress`（0–100 整数）、`result`、`error`、`createdAt`、`startedAt`、`finishedAt`。日期为 ISO 字符串；不暴露 `_id`、`ownerId`、租约、尝试次数等内部字段。
- 输入校验沿用全局 `ValidationPipe`：转换时 trim，额外字段返回 400。作业归属只从会话取得。
- 持久化集合为 `demo_jobs`。文档含公开 UUID `id`、`ownerId`、`label`、状态、进度、结果、错误、租约截止时间、开始/结束时间、尝试次数与 timestamps。索引覆盖唯一 `id` 与 `(status, leaseUntil, createdAt)` 领取查询。
- Worker 使用原子 `findOneAndUpdate` 领取作业：把 `pending` 或租约已过期的 `running` 转为 `running`，设置租约并递增尝试次数。处理过程中按固定步数写回进度；结束写 `done` 与结果，异常写 `failed` 与错误。优雅关闭时释放运行中作业的租约，重新标记为 `pending`。
- 配置：`QUEUE_WORKER_ENABLED`（默认开启）、`QUEUE_POLL_INTERVAL_MS`、`QUEUE_JOB_STEP_MS`、`QUEUE_JOB_STEPS`、`QUEUE_JOB_LEASE_MS`、`QUEUE_CONCURRENCY`。均为非负/正整数配置，默认适配演示；测试可关闭自动轮询并手动驱动一次领取。
- 数据迁移与回滚：无历史数据迁移；移除模块后接口消失，`demo_jobs` 集合需管理员按需要单独清理，不自动删除业务数据。

## 实现影响与决策

- 后端：`backend/src/queue/` 新增 `queue.module.ts`、`jobs.controller.ts`、`jobs.service.ts`、`jobs.worker.ts`、`queue.config.ts`、`dto/create-job.dto.ts`、`schemas/job.schema.ts`、`types/job.type.ts`；`app.module.ts` 注册模块与请求日志；`app.setup.ts` 把 `/api/jobs` 纳入 `no-store`。
- 前端：`frontend/src/api/jobs.ts`、`frontend/src/types/job.ts`、`frontend/src/store/jobs.ts`；扩展 `frontend/src/pages/tasks/index.tsx` 与 `style.module.less`。
- 测试：`backend/test/jobs.e2e.test.mjs`，沿用隔离临时 MongoDB 与真实 AppModule。
- 决策：背景是当前单实例部署且只有 MongoDB；选择 Mongo 集合 + 同进程 Worker + 租约恢复；理由是不新增基础设施即可满足学习与重启恢复，原子领取也避免同一作业被并发处理两次。影响是消费仍与 API 同进程，若将来部署多实例，需要明确 Worker 开关或独立 Worker 进程；本次通过 `QUEUE_WORKER_ENABLED` 留出控制位但不实施多实例部署。

## 验收条件

| 编号 | 前置条件 / 操作 | 预期结果 | 验证方式 |
| --- | --- | --- | --- |
| AC-01 | 登录，POST 合法 label，随后 GET 作业列表并驱动处理 | 202 + jobId；作业属于当前用户；进度最终 100、`done`、结果非空；GET 不含内部字段 | `jobs.e2e.test.mjs` |
| AC-02 | 匿名 POST/GET；登录但缺 CSRF、错 CSRF、非法 label、额外字段 | 分别 401/403/400，未写入作业，已有作业不变 | `jobs.e2e.test.mjs` |
| AC-03 | 用户 A 创建作业，用户 B 查询 | B 的列表为空；猜测 A 的 jobId 也不能通过列表读取 | `jobs.e2e.test.mjs` |
| AC-04 | 在临时库写入模拟遗留 `running` 且租约过期作业，关闭应用后用同库重启 | 新进程恢复该作业并完成；已完成作业不重复执行 | 重启专项 HTTP 测试 |
| AC-05 | 浏览器登录任务页，提交作业并观察，切换账号/退出后返回 | 状态与进度可见，完成显示结果；身份切换清空旧列表并停止旧轮询；刷新仍见本人作业 | 真实浏览器操作 |
| AC-06 | 运行 `npm test --prefix backend`、前端 lint/build 与 `git diff --check` | 全部通过；未验证边界如实记录 | 命令输出 |

## 实施清单

- [x] 范围与契约明确，未决问题已处理
- [ ] 完成后端队列模块与 HTTP 测试
- [ ] 完成前端提交与进度展示
- [ ] 完成必要验证并回写结果

## 验证记录

代码基准：`65f01df` 加工作区未提交改动；工作目录：项目根目录。

| 日期 | 验收编号 | 命令 / 人工操作 | 实际结果 |
| --- | --- | --- | --- |
| 待填写 | 待填写 | 待填写 | 未运行 |

## 未决事项与交接

- 当前已完成：规格与接口边界。
- 当前未验证：所有 AC 均尚未运行。
- 下一步：按实施清单完成后端、前端和验证；不触碰 SPEC-008 的未提交文件。
- 需求变化：用户明确选择「学习/演示作业」和「重启可恢复」，因此不实现聊天后台续跑或多实例部署。
