# SPEC-002：按职责拆分用户与认证模块

- 日期：2026-11-06（Asia/Shanghai）。状态：已验证。
- 基准：bd2b983 + 本轮开始时既有的SPEC-001未提交实现及用户文档改动；不覆盖、不回退既有改动。
- OpenSpec：reorganize-auth-modules。用户已明确授权整理、补规则与验证，无需重新确认设计。
- 前置合同：[SPEC-001](001-session-auth.md)；本次只调整源码职责、依赖和目录，不改变HTTP或页面行为。

## 范围与决定

用户要求UsersModule与AuthModule分离，Guard独立文件并放入guards目录，保留中文学习注释，将约定持久化。

- UsersModule拥有用户Schema、用户服务及用户公开/输入类型，通过exports仅提供UsersService。保留当前注册、密码哈希/验证、索引初始化与查询行为。
- AuthModule导入UsersModule，拥有认证HTTP入口、Session生命周期、认证DTO、CSRF/Session/认证限流Guard。禁止重新注册UsersService或用户Model。
- 依赖方向为AuthModule → UsersModule；用户服务不得反向引用认证DTO、Session类型或Guard。用户服务输入以用户模块自己的UserCredentials纯类型描述；HTTP校验仍由CredentialsDto完成。
- SessionGuard、CsrfGuard、AuthRateLimitGuard三个类分别进入auth/guards/，保留类名、装饰器顺序及限流元数据。
- 认证配置进入auth/config/，会话类型与Express声明合并进入auth/types/。根目录保留模块主要Controller/Service/Module，按职责组织辅助文件，不机械为每个文件创建目录。
- 删除迁移后的旧文件，更新所有源码/测试引用与当前文档链接，不保留重复导出垫片。不增加UsersController、接口、依赖包或数据迁移。

## 目标目录

```text
backend/src/
  users/
    users.module.ts
    users.service.ts
    schemas/user.schema.ts
    types/user.type.ts           # User、UserCredentials；无HTTP/Session依赖
  auth/
    auth.module.ts
    auth.controller.ts
    auth.service.ts
    dto/credentials.dto.ts
    config/auth.config.ts
    types/auth.type.ts           # SessionView及Express/Session声明合并
    guards/session.guard.ts
    guards/csrf.guard.ts
    guards/auth-rate-limit.guard.ts
```

UsersModule通过现有默认Mongo连接注册用户模型；无需在AppModule重复导入已由AuthModule导入的UsersModule。数据库集合名、Schema名称、索引、密码参数、Cookie名称及属性、固定有效期、CSRF/限流、响应状态/结构/文案与任务归属隔离均沿用SPEC-001。

## 验收

| 编号 | 条件 | 验证 |
| --- | --- | --- |
| AC-01 | UsersModule封装用户模型与服务，AuthModule imports复用；users不反向依赖auth | 模块/导入静态审查，应用HTTP测试启动 |
| AC-02 | 三个Guard独立文件且属于auth/guards，配置/类型归组，旧文件无残留引用 | 文件清单及全仓rg、中文注释检查 |
| AC-03 | HTTP、Session、安全边界、数据结构和前端行为不变 | 重构前后原有42项HTTP回归均通过；迁移方法体对比/代码审查，不新增镜像式测试 |
| AC-04 | 规则明确按业务职责划模块及职责目录，不能用最小实现解释平铺；学习注释保留且准确 | AGENT/backend规则与实际结构核对 |
| AC-05 | README、架构、基线与链接更新，保留SPEC-001历史验证语义 | 文档链接/旧路径检查、diff检查 |

## 实施清单

- [x] T1：后端执行者只修改backend/src及必要测试import。迁移用户文件、建立UsersModule与类型，拆Guard、整理配置类型，更新依赖和中文注释。先保存本轮源码快照；验证基线/后置HTTP，报告逻辑对比。记录docs/ai/tasks/002-backend.md。
- [x] T2：主代理更新AGENT.md对最小实现的解释、backend/AGENTS.md目录规则、README/架构/基线/导航/STATE；OpenSpec只保存引用。
- [x] T3：独立审查职责与行为一致性，主代理运行最终HTTP回归、路径/链接/diff检查，回写结果。不提交、推送、归档或清开发库。

## 接口预检

T1与T2不共用代码文件；文档统一采用上方已明确的新路径。UserCredentials仅类型边界变化，CredentialsDto仍结构兼容。T3在T1完成后审查，不能以旧基准commit差异代替本轮工作区对比。

## 验证记录

- 重构前HTTP回归：2026-11-06 执行 `npm test --prefix backend`，42/42通过（0失败，包含构建）；日志为 `/tmp/nest-module-refactor-before.log`，未将历史结果当作本轮通过。
- 重构后HTTP回归：执行者与主代理分别执行 `npm test --prefix backend`，均构建成功、42/42通过，无失败/跳过/取消；主代理最终日志 `/tmp/nest-module-refactor-final.log`。三份原有测试文件与重构前快照逐字节一致。
- 行为对比：保存了重构前完整源码/测试快照，主代理执行 TypeScript AST 比对脚本，43个既有非导入声明一致（仅将服务输入类型名 CredentialsDto / UserCredentials 归一化，AuthModule 装配变化单列）；新增仅 UsersModule 和 UserCredentials。中文注释校正后再次比对通过。细节和证据路径见 [后端任务记录](../ai/tasks/002-backend.md)。
- 静态核对：源码34个TypeScript文件均有中文注释；UsersModule独立注册模型/导出服务，users无反向auth导入；三个Guard文件与原有路由装饰器顺序一致，旧源码路径删除。交接回写后再次核对文档本地链接，144个全部存在，`git diff --check`通过。
- 独立审查：AC-01至AC-05全部通过，代码质量无本轮P1/P2或阻塞项。AuthController与DatabaseModule两处旧模块归属中文注释已修正并复核；70个源码相对导入目标均存在，Guard消费者依赖注入、装饰器顺序及声明合并正确。见 [审查记录](../ai/tasks/002-review.md)。
- 验证边界：本轮未修改前端、测试、依赖与环境配置，没有新增接口或数据迁移；前端工程/浏览器验收沿用SPEC-001的历史记录，本轮未重复执行。未提交、推送、部署、归档或清理开发库。
- 未决项：无。规则、架构、导航、阅读顺序、基线和STATE均已同步；已有功能合同及历史验证记录保留。


## 后续规则变更

2026-11-06用户确认账号收紧为3–5位，前后端与测试同步，验收记录归入SPEC-001“提交前账号规则统一”。本文件的行为保持和快照对比结论仅适用于目录整理完成时的版本。
