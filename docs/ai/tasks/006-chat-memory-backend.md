# SPEC-006 P5.1 长期记忆后端

- 日期：2026-11-12；状态：实现与隔离HTTP验证完成，待根任务整合/页面验收/独立审查。
- 基准：`c6d19ff`及已有未提交SSE功能；保留原工作区、分支和其他代理修改，无提交、推送或部署。
- 合同：[SPEC-006 P5](../../specs/006-owner-sse-chat.md)；对应AC-15、AC-16。

## 实现

- `backend/src/chat/`新增`chat-memory.service.ts`、`dto/chat-memory.dto.ts`、`schemas/chat-memory.schema.ts`、`types/chat-memory.type.ts`；原ChatController注册GET/POST `/api/chat/memories`与PATCH/DELETE `/api/chat/memories/:id`。
- 复用Session→SiteOwner→写请求CSRF，以及现有聊天no-store。每次数据库查询/修改含可信ownerId；HTTP响应只含id、content、enabled、createdAt、updatedAt。
- `chat_memories`以ownerId唯一文档保存最多20条items；首次upsert唯一键竞争后仍执行有界原子push。PATCH仅原子修改目标子项明确传入字段，DELETE原子pull，不读改整数组。
- content先trim，再以Unicode码点严格限制1–500；PATCH至少一个字段，null/错误类型/未知字段拒绝，enabled默认true。GET按updatedAt降序。
- 新生成在受理写库前读取启用记忆一次，合并为一条system上下文，说明只供相关回答参考、当前用户明确要求优先；无启用项不加入system。原最近10轮completed/32000字符历史预算和本轮输入保持。生成中编辑只影响后续请求，终态重放不重调模型。
- 静态复核发现通用Length会合并Unicode变体选择符；记忆DTO以失败HTTP用例修复。经整合者追加授权，同一SPEC新聊天输入的4000码点边界也用独立红绿用例修复，未扩大到其他业务。

## 验证证据

环境：macOS、Node v22.23.4；所有命令在`backend/`执行，显式`MONGODB_URI=mongodb://127.0.0.1:27019/nest_test_base`。实际各用例由helper创建/清理`awei_e2e_<UUID>`库，NODE_ENV=test忽略真实.env。模型上游是回环HTTP合成fixture，没有读取真实Key、调用供应商或写线上数据。

| 检查 | 实际结果 |
| --- | --- |
| TDD初始红测 | `node --test test/chat-memory.e2e.test.mjs`，10项失败，均因缺记忆路由404（包括权限期望401、CRUD期望200/201、非法输入期望400）；实现前运行。 |
| 初始绿测 | build通过；记忆10+原聊天19，共29/29通过。 |
| 首次完整后端 | `npm test`含build，124/124、8套件通过；随后继续修复复核发现的Unicode边界。 |
| 记忆Unicode红绿 | 新增变体选择符用例，501码点原返回201而期望400；修复后记忆11/11通过，500码点完整保留。 |
| 聊天Unicode红绿 | 新增变体选择符用例，4001码点原返回200而期望400；修复后两个Unicode定向用例2/2通过，4000码点成功且超限不落轮次/不调用上游。 |
| 最终完整后端 | `MONGODB_URI=mongodb://127.0.0.1:27019/nest_test_base npm test`：build成功，126/126、8套件、fail=0、skip=0、退出0；包含记忆11项与聊天20项。 |
| 权限/归属/DTO | 全4路由匿名401、非站主403、写操作缺CSRF403、站主配置缺失403；外来ID404且不注入，未知字段/空白/null/类型/空PATCH/坏UUID/Unicode边界通过。 |
| 并发 | 空库同时28次创建，20次201、8次400，owner文档唯一、20个唯一item；删除后释放名额。并行同项不同字段编辑、另项删除/编辑和新增均保留对应修改。 |
| 记忆生命周期 | 单system、跨会话启用、编辑替换、停用移除、重新启用、删除移除均观察本地模型收到的实际messages；原已存回答不变、无记忆保持原形状。 |
| 生成与历史 | 生成中改记忆保留本次快照、下次生效；重放不增加模型调用；记忆不挤占10轮/32000预算；原停止/断连/受理竞态/错误/幂等测试均通过。 |
| 重启持久化 | 保留临时库并重建完整Nest应用与Mongo连接，原Cookie/CSRF可读取原记忆与停用状态，并在新会话实际注入启用记忆。 |

## 交接与边界

- 最新dist已构建；根任务可重启其隔离浏览器fixture使用路由。测试自动关闭自己的应用/模型并清理自己的临时库；27019共享测试容器仍保留给根浏览器验收。
- 未使用或停止默认3000后端，未访问27018隧道，未读改真实.env，未保存凭据、截图或验收媒体。
- 本记录不宣称前端/真实GLM/线上Nginx/真实故障断电验证完成；页面与最终独立审查由整合者记录。没有自动记忆提炼、向量库或额外模型调用。
