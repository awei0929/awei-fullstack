# 002 后端职责整理

- 日期：2026-11-06（Asia/Shanghai）。状态：T1实现与自查完成；主代理最终回归、独立审查及整合已通过。
- 规格：[SPEC-002](../../specs/002-auth-module-organization.md)。
- 基准：本轮开始时未提交的SPEC-001完整实现（含中文学习注释），不是HEAD。保留其他代理/用户改动；未提交、开分支或清开发库。
- 修改范围：backend/src及本记录。测试、前端、依赖包、配置和其他文档未修改。

## 实现

- 新建 `users/users.module.ts`，仅在此模块注册用户模型、提供并导出UsersService；AuthModule仅通过imports复用，不重复注册模型/服务；AppModule无需重复导入UsersModule。
- 用户Schema与UsersService迁入users；User及新增UserCredentials纯类型属于users/types。用户服务不再引用认证DTO、会话类型或Guard。
- SessionGuard、CsrfGuard、AuthRateLimitGuard分别迁入auth/guards独立文件，保留装饰器、类名与登录限流元数据。
- 认证配置迁入auth/config，SessionView及Express/Session声明合并迁入auth/types。更新认证/任务/统计Controller、AuthService和configureApp的导入。
- 迁移保留中文学习注释，并更新模块职责、模型注册归属与类型边界说明。6个旧源码路径已删除，无兼容导出垫片/空目录。
- 决定：按SPEC使用原42项HTTP回归和本轮源码快照对比验证纯重构，不添加只重复实现结构的测试。服务输入只作类型归属调整；HTTP DTO与运行时校验不变。

## 本轮证据

临时证据根目录：`/tmp/nest-spec002-backend-dzt5eawo`。全部在修改前保存，不包含环境密钥。

| 证据 | 路径/实际结果 |
| --- | --- |
| 重构前源码快照 | `before-src/`，完整backend/src |
| 重构前测试快照 | `before-test/`，完整backend/test |
| 本轮迁移差异 | `migration.diff`，对before-src与当前src生成；714行原始增删差异，包含文件迁移 |
| 声明结构对比脚本 | `compare-declarations.mjs`，TypeScript AST去注释、排除import后逐声明比较 |
| 结构对比结果 | `declaration-comparison.json`：43个既有声明一致；仅AuthModule装配变化被明确单列，UsersService的CredentialsDto→UserCredentials类型名按计划归一化；新增仅UsersModule与UserCredentials；15个声明迁移路径 |
| 重构前HTTP | 主代理执行 `npm test --prefix backend`，日志 `/tmp/nest-module-refactor-before.log`；本代理已读取结尾确认42/42、0失败/跳过/取消 |
| 重构后HTTP | 本代理执行 `npm test --prefix backend`，完整日志 `after-test.log`；构建成功，42/42、3 suites、0失败/跳过/取消，HTTP约3.2秒 |
| 测试保留 | 原3个测试文件与快照逐字节一致；无需调整测试import |
| 旧引用/依赖方向 | backend/src及backend/test旧路径rg无匹配；users所有import无auth反向依赖；模型与服务仅在UsersModule注册 |
| 格式检查 | `git diff --check -- backend/src`通过 |

## 交接

- 未改变集合、Schema、索引、密码参数、Session/CSRF/限流、响应状态/结构/消息、任务归属过滤及前端行为；方法与相关顶层声明对比、原HTTP回归提供本轮证据。
- 根规则/README/架构/基线/SPEC/STATE由主代理统一更新。临时快照与差异保留供独立审查；不能用HEAD差异替代本轮比较。
- 无已知阻塞项；独立审查与最终集成验证已通过，见 [审查记录](002-review.md) 和 [SPEC-002](../../specs/002-auth-module-organization.md)。

- 整合审查补充：校正AuthController关于UsersService注入来源，以及DatabaseModule关于用户业务所属模块的中文注释；重新执行声明比较仍43项一致，未改业务。
