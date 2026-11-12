# SSE 对话可行性分析

- 日期：2026-11-12。
- 状态：分析完成，尚未实施；以下方案为建议，未作为已批准的功能范围。
- 代码基准：`c6d19ff`。开始时已有 `README.md`、`docs/ai/STATE.md` 未提交修改，保留原改动。
- 请求：通过飞书桌面 App 阅读实现文档，判断当前项目能否实现 SSE 对话。
- 方法：主代理阅读飞书桌面文档，两个只读子任务分别核对项目源码和官方协议资料；未启动服务、访问数据库或调用模型。

## 结论

可以在现有 NestJS、React、MobX、MongoDB 架构中增量实现文本流式对话。现有登录、CSRF、用户数据隔离和持久化基础可以复用；聊天模块、模型接入、流式客户端和生成状态仍需新增。

建议首版采用单体 Nest + MongoDB，POST 发送消息并以 SSE 格式返回增量，前端用 fetch 读取。范围可包含聊天历史、停止生成、明确的失败/中断状态和按身份隔离。暂不需要 Redis、RabbitMQ、Mastra、多智能体、长期记忆或内容制作工作流。

若要求关闭页面后继续生成、重连订阅同一任务、多个服务实例共同处理，则应改用“POST 创建运行 + 独立 SSE 订阅/快照查询”的结构，并设计持久任务、调度、恢复和跨实例通知；这些能力不是 SSE 本身提供的。

## 飞书文档依据

通过飞书桌面 App 打开并确认 URL 为用户指定的 [AI 智能体平台核心流程与实现图解](https://my.feishu.cn/wiki/TpTMwwPX2ibMVtkaArec53aFndd)。重点阅读第 1–5、5B、8 节及附录 B/C，并查看第 8 节图解；文档停留在第 8 节，没有修改正文。

- 原方案为 API 接收、RabbitMQ 投递、queue-chat 执行、Redis 广播、API 转发 SSE，MongoDB 保存业务事实。
- 聊天事件包括 processCreate、stageDelta、textDelta、processComplete。HTTP 受理、流结束、业务完成是不同概念。
- Redis Pub/Sub 不提供离线回放；刷新和重连应查询消息。seq 只能在约定作用域比较，Message.version 是协议版本，isEnd 不能代替业务终态。
- 用户停止与服务退出采用不同状态；取消记录写入成功不证明上游模型已停止。数据库完成与取消需要原子条件裁决，避免迟到结果覆盖取消状态。
- 文档明确缺少 queue-chat 源码和最终模型请求；长期记忆如何筛选、裁剪及放入模型上下文仍未确定，不能当成可直接复制的完整实现。
- 多智能体、长期记忆、内容制作、计费属于额外业务范围，基础 SSE 对话不必同时建设。

## 当前项目核对

| 部分 | 已有基础 | 需要补充 |
| --- | --- | --- |
| 后端 | 锁定 Nest 12.3.2、Express、RxJS | 新建独立 chat 业务模块及模型流式调用适配 |
| 身份 | SessionGuard、CsrfGuard、可信 authUser.id | 聊天读写按 ownerId 校验，明确开放人群及生成限额 |
| 前端 | React、MobX、同源 Cookie、身份版本隔离 | 流式 API、SSE 解析、生成状态、取消与过期响应隔离 |
| 存储 | MongoDB、Mongoose 模块化 Schema | 会话、消息、运行标识/状态及防重复提交约束 |
| 展示 | 已有安全 Markdown 渲染方式 | 持续增长正文、生成中/失败/停止状态及输出长度控制 |
| 部署 | Nginx + 单实例 systemd 发布 | 核对代理缓冲、心跳/空闲超时及重启后的未完成状态 |

关键源码定位：

- [后端依赖](../../../backend/package.json)、[锁文件](../../../backend/package-lock.json)。本机安装与锁文件一致；本机 `@nestjs/common/decorators/http/sse.decorator.d.ts:7` 已提供 `SseOptions.method`，`sse.decorator.js:28` 默认 GET 且允许 POST。
- [AuthModule](../../../backend/src/auth/auth.module.ts)、[SessionGuard](../../../backend/src/auth/guards/session.guard.ts)、[CsrfGuard](../../../backend/src/auth/guards/csrf.guard.ts)。
- [前端 request](../../../frontend/src/api/http.ts) 第 34 行等待 `response.json()`，不能原样用于流读取。
- [任务服务的归属过滤](../../../backend/src/tasks/tasks.service.ts)、[前端身份隔离范式](../../../frontend/src/store/tasks.ts)、[Markdown 渲染](../../../frontend/src/components/site-markdown/index.tsx)。
- [AppModule](../../../backend/src/app.module.ts) 的日志路由及 [configureApp](../../../backend/src/app.setup.ts) 的 no-store 路径集合需覆盖新增聊天入口。
- [异常过滤器](../../../backend/src/common/filters/all-exceptions.filter.ts) 在响应开始后直接结束；聊天流需要定义自己的业务错误与终态事件，不能把 EOF 当成功。
- [部署脚本](../../../scripts/deploy.py) 重启单个后端服务，当前不具备聊天后台任务自动恢复能力。

以上是源码静态核对，不表示聊天功能已经存在或已经通过运行验证。

## 建议的最小链路

1. 前端发送携带 Cookie、CSRF 和稳定请求标识的 POST；后端完成身份、归属、输入与额度检查。
2. 保存本轮用户消息和助手运行记录，调用支持流式输出的模型服务。模型凭据仅保留在服务端。
3. 通过 SSE 发送创建、文字增量、业务完成/失败等事件；前端按运行标识和事件顺序更新当前会话。
4. 完成正文及终态落库成功后再通知业务完成。失败或中断时保留可恢复的已保存内容与明确状态。
5. 用户停止时传递取消到模型请求并持久化状态；正常完成、错误、用户取消和网络断开需要分别判断。
6. 首版断线后查询历史和状态，再由用户决定重试；不承诺关闭页面继续执行或从任意 token 续写。启动时或查询时应识别过期未完成运行，不能永久显示生成中。

协议细节：fetch 的一个网络 chunk 不等于一条 SSE 事件，需要处理 UTF-8 跨块、跨块行/事件及多行 data；重复 POST 不应再次触发同一生成。不要为每个 token 都写 Mongo，可按受控间隔保存阶段性正文并在终态保存完整结果，具体频率属于实施设计。

## 官方资料与版本边界

- [Nest SSE](https://docs.nestjs.com/http/server-sent-events)：当前安装版本可使用 `@Sse(path, { method: RequestMethod.POST })` 与 Observable；取消订阅和信号需继续传到上游模型调用。
- [Nest signal lifetime](https://docs.nestjs.com/http/server-sent-events#signal-lifetime)：正常结束、错误和断连都会触发生命周期清理，不能仅凭 signal.aborted 或 finalize 判断用户主动取消。
- [EventSource 标准](https://html.spec.whatwg.org/multipage/server-sent-events.html#the-eventsource-interface)：原生 EventSource 的构造参数不提供 POST 请求体或自定义 CSRF 头。可选 POST 创建后 GET 订阅；首版建议 POST + fetch 读取 SSE。
- [Fetch 读取流](https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API/Using_Fetch)、[SSE 解析](https://html.spec.whatwg.org/multipage/server-sent-events.html#parsing-an-event-stream)、[Last-Event-ID](https://html.spec.whatwg.org/multipage/server-sent-events.html#the-last-event-id-header)：重连游标不会自动保存或重放业务事件。
- [Nginx proxy_buffering](https://nginx.org/en/docs/http/ngx_http_proxy_module.html#proxy_buffering)、[proxy_read_timeout](https://nginx.org/en/docs/http/ngx_http_proxy_module.html#proxy_read_timeout)：核对 `proxy_buffering off` 或未被忽略的 `X-Accel-Buffering: no`；读取超时衡量上游两次读取间的空闲时间，可配合心跳。当前本机 Nest SSE 已设置禁用缓冲的响应头，但线上配置未读取、效果未测试。
- [Nest Streaming responses](https://docs.nestjs.com/http/streaming-responses) 的普通路由直接返回 async generator/ReadableStream/Response 要求 core >=12.4.0，不能直接套用到本项目 12.3.2；本次没有升级依赖。

## 待定事项与验证边界

- 实施前明确模型服务、模型名称、可用凭据与调用额度，以及聊天对站主、现有登录用户还是游客开放。当前公开注册关闭，已有登录限流不等于模型用量限制。
- 明确是否要求后台续跑；若要求，首版连接绑定方案应调整。长期记忆和知识库是独立能力，不由保存聊天历史自动获得。
- SessionGuard 仅在请求入口检查身份；应限制单次生成时长并处理退出/切换身份。跨标签退出立即撤销既有流需要额外设计。
- 未验证模型可达性、真实上游取消、费用、正式 HTTPS 首段延迟、代理超时或任何 SSE 运行行为。
- 未运行测试、构建或线上操作。后续实现测试应使用独立临时 Mongo；[README](../../../README.md) 记录本地后端配置连接线上数据库，不能沿真实配置执行集成测试。
- 后续必要验收包括中文跨块解析、完成/错误/停止/中断、重复提交、跨用户隔离、刷新查历史、重启后的未完成状态以及真实 Nginx 链路的逐段到达。
- 本轮仅新增本记录并更新 STATE 索引，保留已有工作区修改；不提交、推送或部署。
