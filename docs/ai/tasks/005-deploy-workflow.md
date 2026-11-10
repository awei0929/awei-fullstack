# SPEC-005 任务2：GitHub Actions 构建与发布

- 更新时间：2026-11-10（Asia/Shanghai）。
- 范围：仅 `.github/workflows/deploy.yml` 与本记录；对应 [SPEC-005](../../specs/005-automatic-deployment.md) AC-01、AC-02、AC-07。
- 基准：开始时 HEAD `9b12524`；当前 main 与 SPEC-004 已有未提交改动保留。没有读取真实 `.env`、运行本机业务测试、提交、推送、配置 GitHub 或连接服务器。
- 状态：实现与本机配置验证已完成；GitHub 实跑和线上验证由整合任务继续。

## 实现

- main push 自动运行；手动运行提供 `action=deploy|rollback`，回退时填写 `release_id`。独立 validate job 拒绝非 main、未知操作及非法 ID；所有发布 job 再限制 `refs/heads/main`。
- 顶层 `contents: read`，production 并发组且 `cancel-in-progress: false`；发布使用 `production` Environment。正在执行的发布不会因新 push 被取消，实际服务器串行锁由 deploy.py 负责。
- `ubuntu-24.04` 与 Node 24；checkout 精确使用触发 SHA 且不保存 GitHub 凭据。CI 先执行部署脚本隔离测试，再分别执行前端 `npm ci`、`npm run lint`、`npm run build`，后端 `npm ci`、`npm test`（实际 package.json 中包含 `npm run build`）。没有虚构前端 test 脚本。
- CI MongoDB 使用当前 job 的 `mongo:8.0` 服务，healthcheck 通过后运行测试；显式 `MONGODB_URI=mongodb://127.0.0.1:27017/nest_ci`，公开测试专用 Session 字符串与临时媒体目录。helpers 已核对：每个应用实际连接 `awei_e2e_<UUID>`，清理再次校验名称；CI 如果出现 backend/.env 会直接拒绝，不使用服务器环境文件。
- 产物仅含 backend/dist、backend/package.json、backend/package-lock.json、frontend/dist。打包前拒绝缺失项、env、node_modules、符号链接及特殊文件；生成 gzip tar 与 SHA256。build 成功后上传 artifact，deploy job 下载并校验摘要；远端仍独立校验归档。实际源码来自 Git 提交，不包含本地 SPEC-004 未提交内容。
- 发布 ID 为 `<完整提交SHA>-<run_id>-<run_attempt>`。专用 SSH 仅调用 `deploy <ID>` 并将 tar.gz 送入 stdin；回退跳过 build/download/checksum，调用 `rollback <ID>`，stdin 为 /dev/null。ID 仅允许 ASCII 字母、数字、连字符，长度 1–128。
- 所有动态表达式先进入环境变量，再由带引号的 Shell 参数使用；每段脚本启用 `set -euo pipefail`。SSH 使用 BatchMode、IdentitiesOnly、StrictHostKeyChecking=yes、显式 known_hosts、禁止密码/交互/转发/终端，并设置连接/存活超时。密钥只在临时目录以 600 写入，EXIT 清理；不执行 ssh-keyscan 或绕过主机密钥验证。
- 每个检查、构建、归档、SSH 阶段保留原生实时步骤日志；可控命令通过 tee 同时写入日志，失败保留原退出码。始终上传 build-logs/deploy-logs；构建成功另有 release artifact，保留 14 天。GitHub Summary 给出触发 commit、release、逐阶段结果、在线日志和下载链接。checkout/setup-node 等 action 自身错误以 GitHub 原生日志为准。

## 需要配置

仓库或 production Environment 中配置以下内容；Environment 同名值会覆盖仓库值：

| 类型 | 名称 | 用途 |
| --- | --- | --- |
| Secret | `DEPLOY_SSH_KEY` | 部署专用私钥，只对应服务器 restrict + forced-command 公钥；不复用 Mongo 隧道密钥 |
| Variable | `DEPLOY_HOST` | 服务器 IP 或主机名 |
| Variable | `DEPLOY_USER` | 受限部署账号，当前方案 ubuntu |
| Variable | `DEPLOY_PORT` | SSH 端口，必须显式填写 1–65535 |
| Variable | `DEPLOY_KNOWN_HOSTS` | 经已信任服务器会话核对的 OpenSSH known_hosts 完整行；非默认端口使用 `[host]:port` 格式 |

不能把未经核验的网络扫描结果当作主机身份依据；真实私钥、env、数据库连接串不放入文档、仓库或日志。服务器固定入口、Node 24、生产目录、systemd/Nginx 接入由任务1/3完成。

## 官方动作与核验来源

2026-11-10 通过只读 GitHub API 查询官方仓库的 latest release、对应提交与 action.yml；以下固定提交均确认 `runs.using: node24`，本机没有写 GitHub API。

| 动作 | 官方 release | 固定提交与官方源码 |
| --- | --- | --- |
| actions/checkout | [v7.0.1](https://github.com/actions/checkout/releases/tag/v7.0.1) | [3d3c42e5aac5ba805825da76410c181273ba90b1](https://github.com/actions/checkout/blob/3d3c42e5aac5ba805825da76410c181273ba90b1/action.yml) |
| actions/setup-node | [v7.1.0](https://github.com/actions/setup-node/releases/tag/v7.1.0) | [949feb2413d6458794dcd2491c4babbbce0c15c1](https://github.com/actions/setup-node/blob/949feb2413d6458794dcd2491c4babbbce0c15c1/action.yml) |
| actions/upload-artifact | [v7.0.2](https://github.com/actions/upload-artifact/releases/tag/v7.0.2) | [cf430e030ddbb5b0abf93d22962f4752f3646cd9](https://github.com/actions/upload-artifact/blob/cf430e030ddbb5b0abf93d22962f4752f3646cd9/action.yml) |
| actions/download-artifact | [v8.0.2](https://github.com/actions/download-artifact/releases/tag/v8.0.2) | [9000827ccba6bdab643e8b6fd33ac0654aef8333](https://github.com/actions/download-artifact/blob/9000827ccba6bdab643e8b6fd33ac0654aef8333/action.yml) |

## 本机验证与边界

- 原机器没有 actionlint；只从 [rhysd/actionlint v1.7.12 官方 release](https://github.com/rhysd/actionlint/releases/tag/v1.7.12) 下载至 `/tmp/nest-actionlint-005`，核对官方 checksums 后运行。Darwin arm64 归档 SHA256 `aba9ced2dee8d27fecca3dc7feb1a7f9a52caefa1eb46f3271ea66b6e0e6953f` 匹配。
- `actionlint .github/workflows/deploy.yml` 通过；首次检查发现 job env 不能使用 runner context，已将媒体目录移到后端 test step env，最终检查无告警。机器没有 ShellCheck；另外将实际 workflow 的 14 段 run 逐一交给 `bash -n`，全部通过。
- 从实际 workflow 提取脚本，在系统临时目录执行 29 项断言：main/非 main、未知操作、空/128/129字符/分号/换行/路径/命令替换回退 ID；安全归档成员与 SHA256；env/node_modules/链接/FIFO 拒绝；SSH deploy/rollback 的命令及 stdin；BatchMode/严格主机检查/600密钥；远端退出码23经 tee 仍失败；非法服务器参数及缺配置在调用前拒绝；成功/失败均清理密钥目录。全部通过。SSH 使用本机命令替身，没有实际联网，也没有真实凭据或数据库。
- 新 workflow 只有静态及隔离验证，尚未在 GitHub runner 执行 npm 安装/业务测试/构建，也未做真实 artifact 传递、专用 SSH 或线上健康检查；这些不是已完成验收。

## 下一步

整合者复核服务器入口与上述配置，确保 scripts/test-deploy.py 可无参数运行。仅提交本次部署文件和文档增量，排除 SPEC-004；推送后跟进首次 main 工作流，记录 run URL、commit、release、构建/SSH/日志下载和线上只读探针结果，再验证手动回退与非 main 拒绝行为。
