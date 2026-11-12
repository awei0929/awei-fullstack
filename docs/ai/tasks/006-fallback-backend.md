# P6.1 免费备用模型后端

- 日期：2026-11-12；基准：`896d358`，当前main未提交工作区。
- 任务：按[SPEC-006 P6](../../specs/006-owner-sse-chat.md#p6免费备用模型与429自动切换2026-11-12) AC-18～20、22实现后端；前端与整合由其他任务负责。
- 范围：`backend/src/chat/`、`backend/test/chat*.e2e.test.mjs`、`backend/test/helpers/chat-fixture.mjs`、`backend/.env.example`及本文；未改真实.env、README、STATE、SPEC或前端，未提交/推送/部署。

## 实现

- 模型目录增加`glm-4-flash-250414`（GLM-4-Flash-250414），共用GLM Key/base，不发送thinking；4.7仍默认且只有它公开固定`fallbackModelId`。保留最多10额外模型，两个内置id都不允许覆盖，额外配置不接受备用关系。
- 上游适配器只有收到HTTP429才抛本地`ModelRateLimitError`；流内错误、鉴权/其他HTTP、网络故障不伪装为429。
- 一轮内最多切换一次，复用同一requestId、消息/记忆快照、AbortController及截止时间。仅无正文且尚未结束时允许切换；切换CAS要求active、当前runtime、未过期、原模型、空正文和streaming。先保存实际模型，再发`fallback`，不产生第二个start或第二轮；CAS失败/写入失败、取消/断开/超时不会发新请求。
- 新轮次保存`requestedModelId/requestedModelLabel`与实际`modelId/modelLabel`；幂等比较原选择。旧历史响应只读回补原字段，查询和重启恢复保留实际模型。
- 流处理在上游和写库await返回后再次检查共同截止时间，减少计时器尚未调度时的迟到动作；取消与终态继续使用既有CAS。

## 验证

所有HTTP测试显式传入`MONGODB_URI=mongodb://127.0.0.1:27019/fallback_test`，app辅助层为每例生成并清理`awei_e2e_<UUID>`库，`NODE_ENV=test`忽略真实.env。模型仅回环HTTP替身，未调用真实供应商、默认27018数据库或线上服务。

1. TDD先红：新写`chat-fallback.e2e.test.mjs`后，构建旧实现，按名称选择4项实际执行，0/4通过；失败分别是目录11≠12、缺requested字段、缺fallback事件、手选备用400，符合功能尚不存在的预期。
2. 实现后定向聊天/记忆三套件45项：44通过、1失败。失败是新增“主模型429到达前取消或断开”测试同时abort客户端和放行429，不能保证服务端先收到断开；实际仅切换元数据、无备用请求，属于用例时序歧义。改为观察服务端interrupted后再释放429，业务代码未因此改动。
3. 备用专项复验14/14通过。覆盖目录/10额外模型/缺Key、429成功/备用429与401及流内失败、非429/网络/流内429/部分文本拒绝切换、手动备用和额外模型、同历史记忆快照、幂等、取消主请求/断连、切换CAS前后取消、CAS败给已取消/元数据写失败、备用部分流取消、1000ms共享总时限、写库等待超时、旧历史及重启。
4. 最终唯一一轮全量：在backend运行`MONGODB_URI=mongodb://127.0.0.1:27019/fallback_test npm test`，**140/140、9套件、0失败/取消/跳过**，含`nest build`成功；测试执行约12.06秒。运行日志`/tmp/nest-fallback-backend-final-test.log`为临时诊断材料，不入库。
5. `git diff --check`通过。没有新增依赖。

## 边界与交接

- 本子任务未做真实模型/正式Nginx/浏览器验证；浏览器、独立审查及文档整合由root继续。
- 备用与主模型属于同一供应商，不保证供应商整体故障时仍可用；只在HTTP429时单次尝试，备用失败正常保存failed。
- 持续Mongo不可用仍沿用既有“保存回复失败，请刷新确认结果”降级；不能据注入一次写库失败的测试宣称持久化在全面故障时可保证成功。
- 构建会刷新dist，可能影响原3000开发watch进程；root负责恢复原开发服务并清理独立浏览器fixture/测试Mongo容器。
