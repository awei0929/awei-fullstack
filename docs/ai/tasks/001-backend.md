# 001 backend

- 日期：2026-11-05（Asia/Shanghai）。
- 基准：bd2b983；本轮未提交。SPEC：[001](../../specs/001-session-auth.md)。
- 状态：T1实现及后端验证完成，独立审查修复已复核通过，等待主代理最终整合。
- 范围：仅 backend/** 与本记录；保留其他代理改动；未提交、推送或清开发库。

## 已完成

- 新增 auth 模块：1–5位ASCII数字字符串账号、Argon2id（19456KiB/2/1）、唯一索引并发注册、自动登录、统一登录错误、Session/CSRF Guard、Mongo原子窗口计数。
- express-session + connect-mongo 复用 Mongoose MongoClient 与实际 connection.name；connect-mongo 6 和 Mongoose 9 使用同一 mongodb 7.7.0，无客户端类型强转。main与测试都 await configureApp。
- 固定最长7天Session、登录/注册换ID及令牌、退出销毁、no-store、生产Secure Cookie、明确可信代理配置；resave/saveUninitialized/rolling均false。有效会话读取不save，connect-mongo touch不upsert，已测退出并发旧读取不能复活认证。
- 任务 ownerId 创建/列表/count/原子改删全链隔离；无主历史记录保留且不可见。新增独立常量公共三任务及统计，删除演示Guard。
- 更新.env.example及依赖；仅在忽略的backend/.env新增固定随机SESSION_SECRET，未输出值。无真实连接串写入文档。
- 原22组任务HTTP回归迁移认证fixture，新增20组认证/配置HTTP用例，总计42组。
- fixture：backend/test/helpers/app.mjs 导出 startApp({port=0,databaseName?,config?})、stopApp(state,{drop=true})、client(state)。端口默认随机，可供浏览器验收指定3100。只接收 awei_e2e_<32位hex> 库名，清库前匹配名称，异常启动也清理本次临时库。关闭应用后显式关闭被override的Mongoose连接。

## 验证证据

| 操作 | 实际结果 |
| --- | --- |
| 环境检查 | 只打印配置键，未输出凭据；原27017 MongoDB可连接。尝试Compose启动遇到端口已占用，未停止原服务、未清库；测试复用现有URI并覆盖随机dbName |
| 首次 `node --test --test-name-pattern='游客只看到' backend/test/auth.e2e.test.mjs` | RED：200 ≠ 401，证明原个人查询无身份保护 |
| 首次 `node --test backend/test/auth.e2e.test.mjs` | RED：13组失败，认证端点404 ≠ 200；未增加生产实现前执行 |
| 第一次构建/HTTP执行 | 定位并修复Argon2选项字面量类型、Mongoose Connection应为type-only导入；未将这些错误记为功能失败证据 |
| `npm test --prefix backend`（首轮） | GREEN：35/35，原22组+新13组；含真正关闭/新建Nest实例及Mongo连接后恢复原cookie/任务 |
| 配置边界新增用例 | RED：超过7天配置未被拒绝；收紧期限为正整数且≤7天 |
| `npm test --prefix backend`（最终） | GREEN：38/38，3 suites，0失败/跳过/取消；构建成功，约2.4秒HTTP执行 |
| `npm audit --omit=dev --json` | 生产依赖0漏洞 |
| `npm audit --json` | 开发链@nestjs/cli→minimatch共2个moderate；建议修复为CLI大版本降级，未混入本功能 |

HTTP实际覆盖：游客/无主数据/公共稳定三例；账号与密码边界/非法类型/额外字段；顺序及并发重名；换SID/CSRF和公开字段；错误登录；A/B CRUD/count；所有写入CSRF缺失/错误/异会话；过期（TTL尚存）；退出并发读；IP/账号原子限流和伪造转发头；真正应用重启；存储读取/退出故障；配置及Secure Cookie；原CRUD/错误格式/排序回归。

## 交接与限制

- 浏览器行为及前端实现由主代理/T2验收；本记录不将HTTP覆盖表述为浏览器通过。
- 密码采用自定义ValidateBy，显式Array.from(value).length计算Unicode码点；包含变体选择符，与前端一致。
- 数据库仍需可用，应用重启恢复需要保留同一数据库与SESSION_SECRET。
- 未修改根README/架构/SPEC/STATE，由主代理集中整合；未执行发布、提交或迁移无主任务。

## 独立审查修复（2026-11-05）

- P2：新Session显式save失败时，express-session可能在500响应结束自动再save并发送Cookie。新增真实HTTP用例先复现注册500带Set-Cookie。修复为save失败时先调用Session.destroy同步删除request.session，再尽力销毁新SID；持续存储故障时仍不发送该SID，抛出原保存错误。
- 回归覆盖register/login/匿名session初始化，分别注入首次set失败、实际写入完成但回调报错，共6条路径；验证500、无Set-Cookie、失败SID已删除、下一次恢复匿名。
- P2：class-validator Length会忽略部分变体选择符，与前端Unicode码点计数不一致。新增4个❤️注册用例先失败400≠201；改自定义ValidateBy，明确Array.from码点计数。4/32个❤️注册与登录成功，3/33个拒绝400。
- 最终 `npm test --prefix backend`：40/40通过，3 suites、0失败/跳过/取消；HTTP约2.7秒；`git diff --check -- backend docs/ai/tasks/001-backend.md`通过。
- 已通知主代理浏览器3100后端进程需重启加载最新dist，并请求独立审查代理复查。


## 路径别名审查修复（2026-11-05）

- P2：Express接受大小写与尾斜杠路由，旧request.path.endsWith('/login')判断可被别名绕过账号限流；旧no-store正则也不匹配大写API路径。
- 新增HTTP red：三个登录别名实际[401,401,401]而应[401,401,429]；/API/AUTH/SESSION实际Cache-Control=null而应no-store。
- 修复：登录handler显式@SetMetadata标记，AuthRateLimitGuard使用Reflector取得标记，不再按URL字符串识别登录。no-store正则增加大小写不敏感，与Express实际路由匹配一致。
- 用例覆盖/api/auth/login、/api/auth/login/、/API/AUTH/LOGIN共享账号计数，以及认证/任务/统计大小写、尾斜杠等价路径的no-store。
- 本轮最终 `npm test --prefix backend`：42/42通过，3 suites、0失败/跳过/取消；`git diff --check`通过。已请独立审查代理复核。

- 独立审查代理最终反馈：保存失败、Unicode码点、路径别名三项后端修复均复核通过；当前无剩余P1/P2发现。

## 主代理最终整合（2026-11-05）

浏览器验收、42项后端HTTP回归、前端lint/build、独立代码审查及中文注释核对已完成；最新完整证据与限制以[SPEC-001](../../specs/001-session-auth.md)及[STATE](../STATE.md)为准。后续追加的源码注释只改注释，已验证去注释代码一致。


## 提交前规则更新（2026-11-07）

用户已确认将账号统一为3–5位ASCII数字字符串，替代本记录历史1–5位描述。前导零保留；后端DTO/Schema/限流及前端表单/响应解析同步，HTTP42/42和前端lint/build通过。最新边界与兼容说明见SPEC-001末尾；已获提交推送授权。
