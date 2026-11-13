# SPEC-006 P7.3：阶段保存与流式消费分离

- 日期：2026-11-12至13（Asia/Shanghai）；基准：`5379a08`加本轮未提交实现。合同：[SPEC-006 P7 / AC-25、AC-26](../../specs/006-owner-sse-chat.md#p7纸白聊天工作区与流式体验2026-11-12)。
- 状态：后端实现完成，初始6项专项先红后绿；独立审查P1补3条红测并修复，专项最终10/10、完整后端150/150通过。未提交、推送或部署；浏览器与线上验收由根整合继续。
- 前置证据：[流式排查](006-stream-diagnosis.md)。本任务仅改`backend/src/chat/chat.service.ts`和新增`backend/test/chat-checkpoint.e2e.test.mjs`，无依赖、API、Key或环境配置变更。

## 实现

- 原先每250ms在消费上游的循环中等待Mongo保存，慢写会令后续增量积压成簇。现将阶段保存独立推进，收到正文后立即发delta并继续读上游。
- 每轮最多一个在途阶段保存，期间只保留最新完整正文快照；不按token排队。快写保持250ms节流，慢写完成后可继续保存合并后的最新快照；完成、取消、断连或超时后不启动新的阶段写入。
- 所有终态先同步锁定并abort上游，再等待已经开始的阶段保存，最后使用完整正文和原streaming条件做终态CAS，防止旧快照覆盖取消或完成。
- 阶段写失败主动终止仍在挂起的上游并保存明确失败。即使模型DONE已先到、完成流程正在等保存，也会改为failed，不能误报completed。已经锁定的取消/超时决定保持优先，错误不泄露数据库原始信息。
- 恢复遗留记录时，仅排除本进程仍持有运行句柄的会话及当前runtime，防止结算跨截止时间时读查询用旧正文抢先结束；重启后的旧runtime与无运行句柄的孤立过期记录仍正常恢复。
- 保留默认主模型、仅429/无正文的单次免费回退、消息/记忆快照、总时限和原幂等合同。无新的计时器、公开字段或运行依赖。

## TDD与HTTP验证

测试使用根代理提供的专用`nest-chat-redesign-test`容器（127.0.0.1:27019）；每例由现有辅助层创建随机`awei_e2e_<UUID>`数据库并清理，设置NODE_ENV=test，禁止读取默认`.env`。模型仅为回环HTTP fixture。

驱动边界只用门闩延迟阶段保存，原Mongo执行与Nest/Guard/Service/Controller均真实运行。延迟期间是否继续出字、终态顺序和保存后的结果是被测业务效果，不以源码字符串或模拟对象存在作为通过依据。

| 专项 | 实际结果 |
| --- | --- |
| 阶段保存悬挂时继续出字 | 门闩未释放，客户端已收到“甲乙丙”；没有提前done，Mongo仍streaming。释放后completed全文与GET一致。 |
| 单在途与最新快照合并 | 第一保存悬挂时“乙丙丁”继续到达，只有一写；释放后第二次只保存“甲乙丙丁”，没有逐字旧快照排队；最大并发1。末字“戊”进入最终全文。 |
| DONE早于保存失败 | 客户端已收“甲乙”，模型DONE到达后仍不提前done；门闩释放为写失败，最终failed且全文保留，错误不含底层信息。 |
| 上游挂起时保存失败 | 写失败主动abort上游并发failed，未等总超时或下一token；GET与终态一致。 |
| 取消竞争 | 保存悬挂期间仍收“甲乙”；取消立即abort上游，终态Mongo调用次数仍0；释放保存后仅一次canceled全文，重复取消幂等。 |
| 超时竞争 | 1秒时限立即abort上游，但终态等待在途保存；释放后interrupted/超时，全文“甲乙”保留，不继续发送积压正文。 |
| 恢复竞争（3项） | 模型在1秒截止前已DONE，阶段保存仍挂起；真实expiresAt到期后分别调用detail/list/cancel，恢复逻辑不能抢占正在结算的轮次。放行后completed全文“甲乙”与GET一致，迟到取消返回已有完成决定。 |
| 孤立过期对照 | 保留当前实例runtime但移除活动句柄后制造过期streaming，详情读取仍转interrupted并保留已存正文，不重调模型，防止修复过度跳过同runtime全部记录。 |

命令与结果：

- 红测：在未改产品代码的已有dist上执行`MONGODB_URI=mongodb://127.0.0.1:27019/redesign_test node --test test/chat-checkpoint.e2e.test.mjs`，6/6均因阶段保存悬挂期间收不到后续delta失败；无缺依赖或语法错误。日志`/tmp/nest-redesign-iJ3i0y/checkpoint-red.log`。
- 实现后`npm run build`通过，专项6/6通过，0失败/跳过/取消；日志`/tmp/nest-redesign-iJ3i0y/checkpoint-green.log`。
- 首次完整`MONGODB_URI=mongodb://127.0.0.1:27019/redesign_test npm test`为146/146、10套件通过；日志`/tmp/nest-redesign-iJ3i0y/backend-final.log`。这是独立审查P1修正之前的历史结果。
- 审查修正后最终同命令退出0，包含Nest build及全部HTTP：**150/150，10套件，0失败/跳过/取消**，测试约12.2秒；日志`/tmp/nest-redesign-iJ3i0y/backend-final-recover.log`。原429、权限、持久化失败、取消、旧runtime恢复与记忆套件均在其中。

## 独立审查P1修正（2026-11-13）

审查者复现：第一阶段保存门闩挂起，模型在截止前发完“甲乙”与DONE，等待保存期间数据库expiresAt到期；此时GET/list/cancel入口调用recover，它把仍由本进程持有的轮次抢先设为interrupted，并沿用尚未保存的空正文。门闩放行后阶段写和终态CAS都不再匹配，已收“甲乙”丢失。

补3条对应入口的真实HTTP红测，均以`expected streaming / actual interrupted`失败，另加1条同runtime孤立过期记录对照先通过；日志`checkpoint-recover-red.log`。修复没有跳过整个owner或所有本进程runtime，只通过`$nor`排除当前内存run的conversationId与runtimeId组合，让同一finish负责完整正文结算。其余查询仍包含owner、active及过期/旧runtime条件。

修正后10项专项全部通过，日志`checkpoint-recover-green.log`；随后执行上述150项完整回归。源码与测试哈希更新如下，替代首次交付的哈希。独立复审结果由根审查报告记录，本报告不自行宣称审查关闭。

## 同条件时序对比

修正前后均使用实际构建后的`ChatService.consume`、每20ms产生一个字符的内存ReadableStream，共40个增量；只注入120ms阶段保存延迟。没有真实数据库或网络请求。

| 条件 | 最大相邻delta间隔 | 小于2ms的成簇增量 | delta总数 | 阶段保存最大并发 |
| --- | --- | --- | --- | --- |
| 修正前 | 122ms | 10 | 40 | 原同步保存 |
| 修正后 | 23ms | 0 | 40 | 1 |

修正后前12次delta时点为`22,45,67,89,111,133,156,178,199,221,243,265ms`，消费约870ms。此证据证明应用已移除该保存阻塞；120ms是合成注入值，不能据此声称生产Mongo延迟、真实模型首字耗时或浏览器帧率。

## 交接与边界

- 构建前根已停止默认3000 watcher，本任务不自行恢复或操作它；最终build完成已通知根启动隔离浏览器fixture。27019容器保留供根后续验收，不能提前停止。
- 未读取真实Key、访问默认Mongo或调用真实模型；测试临时库由辅助层清理。未改前端、服务器配置或原README/STATE历史差异。
- 后端阶段写故障依然依赖Mongo驱动最终返回；本改动移除其对增量消费的阻塞，不承诺数据库永久挂起时终态可立即持久化。停止操作会即时abort上游，但终态需等待已经开始的保存以维持顺序。
- 浏览器持续输出、长历史渲染、四轮页面与正式HTTPS验证由本轮整合报告覆盖，不能用本报告替代。

实现完成时SHA256（独立审查定位用）：

- `backend/src/chat/chat.service.ts`：`3f69969758efd525eb1543f3c2a16ebe6e3382818f6f04d95fdbbd86f36d6917`
- `backend/test/chat-checkpoint.e2e.test.mjs`：`b220264ea3afc44ad48a848416c637618b9962801bd98e106ce5769c1497dc65`
