# 项目文档导航

采用按职责分层的精简结构：稳定原则在根 AGENT，编码约定在各目录，架构、功能规格和当前进度各有一个入口。
暂不创建空的 constitution、guides 或 runbook 目录；出现可复用内容后再扩展。

| 需要了解什么 | 入口 |
| --- | --- |
| AI 如何开始、执行、验证和交接 | [AGENT](../AGENT.md) |
| 工具读取入口 | [AGENTS](../AGENTS.md) |
| OpenSpec / Superpowers 安装范围、版本与使用 | [工具配置](ai/TOOLING.md) |
| 环境配置、启动和检查命令 | [项目 README](../README.md) |
| 系统结构与模块边界 | [架构概览](architecture/overview.md) |
| 后端/前端具体约定 | [后端](../backend/AGENTS.md) / [前端](../frontend/AGENTS.md) |
| 如何编写功能规格 | [SPEC 规范](../SPEC.md) / [模板](specs/TEMPLATE.md) |
| 当前接口与行为基线 | [SPEC-000](specs/000-current-system.md) |
| 弹窗注册登录、会话与私有任务 | [SPEC-001](specs/001-session-auth.md) |
| 用户/认证模块边界与目录组织 | [SPEC-002](specs/002-auth-module-organization.md) |
| 个人官网、唯一站主配置与表现力迭代 | [SPEC-003](specs/003-personal-site.md) |
| 当前进度、已验证事项与下一步 | [STATE](ai/STATE.md) |

项目事实变化时更新对应文档，再更新 STATE 的摘要与核对日期。
接口以当前基线及后续生效 SPEC 为约定，实际实现仍须检查源码与测试；发现不一致时记录差异。
文档中的相对链接与命令以文件位置或明确标注的项目根目录为准，不依赖开发者电脑的绝对路径。
