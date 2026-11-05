# OpenSpec 与 Superpowers 安装说明

核对日期：2026-11-05。协作规则只维护在 [AGENT](../../AGENT.md#openspec-与-superpowers-协作)，规格归属见 [SPEC](../../SPEC.md#openspec-引用模式)。本文记录安装、命令、验证与维护方式。

## 定位与影响范围

安装前已读取根 AGENTS → AGENT → STATE、SPEC/模板、架构和两端 AGENTS，并核对 Git。已有文档治理改动尚未提交，基准为 `main / d688983`；本次在其基础上增补，没有重置或提交既有成果。

| 位置 | 用途与作用域 |
| --- | --- |
| 当前 Node 22.23.4 的 npm 全局前缀 | 安装 `@fission-ai/openspec@1.16.0`，提供 `openspec` 命令；不自动初始化其它项目。用 `npm prefix -g` 查看机器上的具体位置 |
| [项目技能](../../.agents/skills/) | OpenSpec core 的 6 个技能，加 Superpowers 7.0.2 的 15 个技能；仅在以本仓库或其子目录为工作区时被发现 |
| [OpenSpec 配置](../../openspec/config.yaml) | 选择项目自定义 `nest-existing-spec` schema，注入现有规则入口 |
| [schema](../../openspec/schemas/nest-existing-spec/schema.yaml) / [模板](../../openspec/schemas/nest-existing-spec/templates/spec-reference.md) | 每次变更只生成 `spec-reference.md`，引用原有 `docs/specs/` 文档 |
| [来源清单](../../.agents/skill-sources.json) | 固定版本、源提交、技能列表及安装方式 |

Superpowers 固定于 `v7.0.2` / `22f0b463e7a5e579904dd6211a520321035526f7`，通过 Skill Installer 的 `--ref`、`--dest` 安装完整技能目录。它是项目级技能副本，不是插件市场安装；上游 `superpowers:writing-plans` 等名称在本项目对应本地 `writing-plans` 等技能。上游技能未改写，许可证保留在 `.agents/`。

本次未修改用户级 Codex 配置或技能目录，没有安装插件 hook，也未改动前后端源码、依赖、数据库或启动配置。技能可按任务描述触发，但执行方式须遵守 AGENT 的项目适配规则。

## 开始使用

先以包含本文件的仓库根目录打开工作区。2026-11-05 已将 Codex 的“AI 全栈 (nest)”项目主目录修正为 `/Users/awei/Desktop/nest`，并从桌面项目列表和本地项目记录回读确认。旧聊天仍可能保留创建时的 `/Users/awei/Desktop/awei` 工作目录；本次旧聊天即属于此情况。后续从已修正的项目开始新聊天，不能只凭项目名称或侧栏显示 nest 就断言旧聊天已切换运行目录。

Codex 桌面端可从 Skills 中选择技能；CLI / IDE 可用下面的 `$技能名`。如果技能列表尚未刷新，在正确工作区开始下一轮，必要时重新打开客户端。

| 目的 | 技能 / 提示 |
| --- | --- |
| 需求尚不明确 | `openspec-explore`，只澄清影响结果的问题 |
| 建立变更与规格引用 | `$openspec-propose <变更名>` |
| 实施已有变更 | `$openspec-apply-change <变更名>` |
| 修订需求、方案或验收 | 明确要求更新所引用的当前 SPEC；原生 `openspec-update-change` 只修改变更目录中的产物，在此 schema 下主要用于修订引用，不能假定它会更新外部 SPEC |
| 审查与验证 | 使用相关 Superpowers 审查及 `verification-before-completion` 技能，逐项核对当前 SPEC 的 AC、实际检查结果和未验证项 |
| 完成后归档 | `$openspec-archive-change <变更名>`；先核对真实 SPEC 和 STATE，再整理引用目录 |

可直接给 Codex 这样的任务：

```text
请按 AGENT.md 的协作约定处理以下需求：<具体需求>。
用 OpenSpec 建立变更并引用现有体系中的 SPEC，
用相关 Superpowers 技能细化该 SPEC 的实施清单、实现、审查与验证，
最后回写同一 SPEC 和 STATE。复用已明确的要求，不重复创建规格和计划。
```

这段示例不是当前活动业务任务。已有能力和未验证事项仍以 STATE 及 SPEC-000 为准。

## 引用模式的边界

本项目没有迁移到 OpenSpec 默认的 `spec-driven` 目录布局。`openspec/specs/` 不承担业务合同，`openspec-sync-specs` 虽随 core 安装，但当前 schema 没有 `specs` 产物，无需执行同步。

`apply.tracks: null`：OpenSpec CLI 不扫描外部 SPEC 的 checkbox。产物齐全后 `instructions apply` 返回 `ready` 和空 `tasks`，而非业务完成；执行者必须读取引用目标中的实施清单。`status`、`list` 的产物完成或 0 个任务，以及归档成功，均不证明验收通过。

引用文件中的路径相对项目根目录；移入 archive 后仍能定位原规格。归档不移动、合并或覆盖原 SPEC。项目的完成条件由 AGENT/SPEC 约定和真实验证证据判断，工具配置不是自动化验收闸门。

当前未启用扩展 `openspec-verify-change`；默认 verify 对外部规格的覆盖不能作保证。结构检查和业务验收分开进行：

```bash
# 在项目根目录：检查工具版本、schema 和活动变更。
openspec --version
openspec schema validate nest-existing-spec --json
openspec list --json

# 有活动变更时：读取准备状态与包含项目规则的实施指令。
openspec status --change <变更名> --json
openspec instructions apply --change <变更名> --json
```

业务检查按 [根 README](../../README.md#验证) 与涉及目录的 AGENTS 执行。当前前端没有 `test` 脚本，静态检查不能替代交互验收。

## 安装验收

- `openspec --version` 返回 `1.16.0`；schema 验证通过，无问题。
- `.agents/skills/` 包含 6 个生成的 OpenSpec 技能、15 个固定提交的 Superpowers 技能；无同名冲突。
- 80 个 Superpowers 文件与固定提交逐字节一致；恢复了 ZIP 安装遗漏的 10 个上游可执行位。9 个 Bash 脚本和 3 个 JS/CJS 脚本通过静态语法检查，必需的跨技能脚本均已安装。
- 在仓库外临时目录复制配置进行 7 条 CLI 命令的生命周期验证：`spec-reference.md` 文件未生成时 apply 为 `blocked`；文件存在时为 `ready`；实际 SPEC 的未勾选项保留，CLI 返回空任务不等于完成。CLI 不检查引用目标的真实性，执行者仍须按 schema 指令检查目标路径、内容与验收状态。
- 产物 context/rules、apply/archive 的项目指导均能读取；临时变更归档成功，原 SPEC 字节内容不变，未生成第二套主规格。
- 仓库中没有创建测试用变更或虚构业务 SPEC。安装不代表业务基线原有未验证项已通过。

`writing-skills` 的可选 Graphviz 图片渲染需要 `dot`，本机未安装；这不影响本次配置的开发流程。未为可选图片输出增装系统依赖。

2026-11-05 补充运行时检查：使用本机 Codex `0.166.0-alpha.5.1`，在根目录及 `backend/`、`frontend/` 分别调用独立临时 app-server 的 `skills/list`（`forceReload: true`），均返回 21 个项目技能、全部启用且无错误；三个目录的 `codex -C <cwd> debug prompt-input` 均包含这些技能和适用的 AGENTS 入口。未创建新的可见聊天或发起业务任务。

根 `AGENTS.md` 会注入输入，但其中的 Markdown 链接不会自动展开整个 `AGENT.md`；代理必须继续读取规则正文。独立代理按入口恢复后，正确处理了空任务不等于验收完成、复用明确授权、审查未提交工作区、前端没有 test 脚本这四类情景。这验证了发现与规则恢复路径，不是所有未来行为的自动强制保障。

本轮其它实际检查和旧聊天目录限制见 [STATE](STATE.md)。

## 维护与回退

OpenSpec CLI 与项目技能分开管理。升级 CLI 后才运行 `openspec update` 刷新项目技能；先确认全局 profile，避免意外增加其它工作流。自定义 schema 与 AGENT 适配单独审查，更新来源清单并重做结构和生命周期验证。切换 Node 版本后若找不到命令，应在新 Node 环境安装来源清单所记录的 CLI 版本。

Superpowers 升级时，用 Skill Installer 将审阅过的新提交先安装到临时目录，比较后再替换对应技能；不要直接覆盖未知改动，也不要因上游默认流程改写项目规则或全局模型配置。

需要回退时，只移除来源清单列出的本次技能及 OpenSpec 配置/schema，撤回本次新增的文档段落；保留原有 AGENT、SPEC、STATE 和业务文档。已有实际变更时先保留其引用记录。确认没有其它项目依赖当前 CLI 后，才卸载 npm 全局包。不要用 `git reset --hard` 或整目录删除来处理安装前已存在的未提交文档。

官方依据：[OpenSpec 自定义工作流](https://github.com/Fission-AI/OpenSpec/blob/main/docs/customization.md)、[工具适配](https://github.com/Fission-AI/OpenSpec/blob/main/docs/supported-tools.md)、[Superpowers 固定版本](https://github.com/obra/superpowers/tree/v7.0.2)、[Codex 技能范围](https://learn.chatgpt.com/docs/build-skills#where-codex-loads-local-skills)。
