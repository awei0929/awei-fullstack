# SPEC-006 P6 免费备用与429切换独立审查

核对日期：2026-11-12。基准：`896d358` 加本轮未提交改动。合同：[SPEC-006 P6 / AC-18 至 AC-22](../../specs/006-owner-sse-chat.md)。本分工仅审查代码、测试及接口一致性，并新增本记录；未修改产品源码或测试。

## 结论

在本次已跟踪与未跟踪实现范围内，未发现可复现、需要修复的 P0/P1/P2 缺陷。此结论限于静态代码审查和下述最小诊断；不将测试代码存在当作测试通过，也不替代整合者的浏览器、真实模型与最终回归证据。

## 范围与证据

已读取根 AGENT、当前 STATE、架构、前后端目录规则、SPEC-006 P6，并核对工作区状态和基准。审查包含 `backend/src/chat/` 的改动及相关 Controller/持久化/上游解析链路、新增 `backend/test/chat-fallback.e2e.test.mjs`、现有聊天测试与 fixture 改动，以及前端 types/API/store/ChatPanel/记忆说明和专项测试。原 README 首两处历史改动与 STATE 既有历史增补不纳入本次实现。

| 重点 | 静态核对结果与定位 |
| --- | --- |
| AC-18 固定免费备用 | `backend/src/chat/config/chat.config.ts:14` 内置两模型、保留4.7默认、备用不发 thinking；`:20` 拒绝未知字段/覆盖内置ID，`:28` 仅主模型获得固定备用关系，extras及手动备用不连锁。目录公开映射无Key/地址/环境变量名。 |
| AC-19 可信429与单次尝试 | `backend/src/chat/providers/chat-completions.provider.ts:23` 仅HTTP429构造本地 `ModelRateLimitError`；流内error统一为普通本地错误。`backend/src/chat/chat.service.ts:110` 同时检查错误类型、备用、无正文及未终止，清空备用句柄后第二次 consume 位于原捕获分支之外，无重复start或循环。 |
| 上下文与总时限 | `backend/src/chat/chat.service.ts:68` 受理前读取记忆，`:83` 固定 messages 与 deadline；两次调用复用同一 Run。`:142`、`:145`、`:154` 以及终态前检查原期限，fallback不重建timer。 |
| AC-20 切换与取消竞争 | `backend/src/chat/chat.service.ts:113` 先以owner/会话/runtime/active/期限/streaming/原模型/空正文条件更新，再检查停止状态并发fallback。CAS前取消使更新不命中；CAS后取消/超时由同一 ending 决定终态并禁止新上游。元数据失败不调用备用。持久化终态从数据库回读实际模型，不凭旧内存模型覆盖已切换信息。 |
| 幂等、旧历史与恢复 | `backend/src/chat/chat.service.ts:54` 按 requestedModelId 比较幂等原选择；`:220` 对旧记录只读补字段。Schema新增字段可缺省，恢复逻辑不覆盖模型字段。前端 `api/chat.ts:35` 同时兼容两个requested字段都缺的历史，拒绝半缺/坏字段。 |
| AC-21 SSE契约 | `frontend/src/api/chat.ts:96` 验证同会话/请求、start后、无正文、最多一次、streaming空正文、原选择及轮次内容不变。fallback不会结束读取，仍要求业务done；done允许带权威实际模型，覆盖切换已落库但fallback事件尚未发出时的取消窗口。 |
| UI、停止与身份 | `frontend/src/store/chat.ts:175` 刷新按原选择恢复下拉；`:218` 保留身份/视图/运行句柄与stopping保护；`:231` 仅done释放逻辑完成标记。`ChatPanel`展示实际模型、原模型切换说明及备用提示，记忆面板明确备用也接收启用记忆。 |
| 上下文与密钥边界 | 新增fallback只携带原公开ChatTurn，不含messages、记忆快照、owner、Key或上游URL；原输入与回答仍在授权会话中。未知数据库/网络异常继续统一脱敏，上游错误体不进入对外错误。 |

## 测试审查与本分工执行

- 新增HTTP测试覆盖可信429→成功/失败、非429/流内429/已有正文、手动备用/extras、记忆与历史快照、主模型取消/断开、切换CAS前后取消、CAS未命中/写失败、备用部分取消、共享时限、旧历史及重启。门闩只包裹驱动层真实CAS前后，取消接口和持久化逻辑仍走产品实现。
- 前端专项新增用例覆盖fallback顺序/重复/错误身份及元数据、后续delta/done与EOF、同轮更新和锁、停止/切会话/迟到响应、身份清空、刷新原模型及旧历史。
- 沿用前端分工记录的实际模块51/51、lint/build结果；本审查没有重新运行已有前后端测试或构建。后端最终结果由后端分工及整合者记录，本报告不替其宣称通过。
- 仅执行一次无数据库的回环fixture最小诊断：同步HTTP429正常结束得到 `status=429, calls=1, aborted=0`，排除了新增可控handler把正常429误计为取消的怀疑；不列缺陷。除此以外仅进行文件读取、Git差异/状态和源码定位。

## 审查版本与边界

核心已审文件的Git内容哈希：`chat.service.ts=0da740bf0277bd282c5e2d5eea365a37a66b3cb5`、`frontend/src/api/chat.ts=40f9c27a290d6457ea781721686e6fc614966dfe`、`frontend/src/store/chat.ts=282cde818e5d53fcf19fa2362f0cc5484e0b62d6`。后续若这些行为实现发生变化，应按变化范围复核，不因此重复无关验证。

- 未读取真实 `.env`、真实密钥或真实用户内容；未连接Mongo、线上或供应商，未发真实模型请求。
- 未执行浏览器、窄屏/辅助技术、真实供应商兼容、正式Nginx或持续故障/负载验收。这些结果由整合者独立记录。
- 遵循当前单进程/连接断开停止的既有范围，不扩展为跨实例协调或同平台故障隔离保证。切换元数据先持久化，极窄取消/超时窗口允许终态保留备用模型信息而未发出备用HTTP请求；这与当前CAS顺序及专项断言一致。
- 未提交、推送、部署或修改运行配置。必要修复项：无；剩余交接为整合最终验证与文档状态。
