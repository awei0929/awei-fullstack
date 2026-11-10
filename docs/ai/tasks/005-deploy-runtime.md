# SPEC-005：发布运行器

- 核对日期：2026-11-10。
- 基准：`9b12524` 加本任务未提交文件；保留任务开始前的 SPEC-004 和其他工作区改动。
- 状态：任务1实现及本机隔离验证完成。实际服务器安装、GitHub 运行与线上验收由整合任务记录。
- 范围：`scripts/deploy.py`、`scripts/deploy-ssh.sh`、`scripts/test-deploy.py` 及本文；未修改业务代码、读取真实 env、访问线上、提交或推送。

## 实现与接口

Python 标准库运行器接受 `deploy RELEASE_ID`（stdin 为 gzip tar）或 `rollback RELEASE_ID`。ID 仅字母、数字、连字符，1–128 字符；非法命令退出64，发布错误退出非零。`fcntl` 非阻塞锁同时保护安装、切换、健康检查和回退。

默认发布根为 `/srv/nest`：服务器核对发现 `/home/ubuntu` 权限750，Nginx 用户无法遍历，因此不放宽 home，而将发布目录移至 `/srv`。归档先限流接收，再限流 gzip 解压，校验所有成员后手动写入独立暂存目录。只允许前后端 dist、后端 package/lock 和必要父目录；拒绝穿越、绝对路径、隐藏文件、反斜杠、链接、特殊/稀疏文件、重复和文件目录冲突。上限为压缩512MiB、解压1GiB、100000成员，同时累计成员逻辑大小；限制配置只能缩小。

暂存版本建立 `backend/.env` 外部绝对符号链接，执行 `npm ci --omit=dev`。完成安装后将发布顶层及 frontend 目录固定755、资源644，避免暂存目录0700或 umask 导致 Nginx 403。安装通过才提升为 `releases/<ID>` 并原子切换 `current -> releases/<ID>`。重启固定执行 `sudo -n /usr/bin/systemctl restart nest-backend.service`，重试 API 及可选首页探针。成功后写普通文件 `.nest-release-ready`，内容严格为 `<ID>\n`，再更新 `previous`。

自动失败恢复旧 current、重启并再次检查，最终仍退出失败；恢复探针失败也保留旧链接。失败候选清理且不能作为手动回退目标。若链接恢复本身失败而 current 仍指向候选，则保留目录防止悬空，但移除 ready 标记。手动回退仅接受本发布根内、标记匹配且具备完整构建和外部 env 链接的真实版本目录，不重新安装依赖。SIGTERM/SIGHUP 走同一恢复路径；stdout 管道关闭不会阻断发布或恢复。

固定 SSH gate 仅接受上述两种命令，拒绝额外参数、shell 语法、空白变体与非法 ID。校验后读取可选 root-owned `/etc/nest-deploy.env`，调用固定 `/usr/bin/python3 /usr/local/libexec/nest-deploy.py`。部署时 gate/运行器由 root 安装、ubuntu 执行；sudo 仅授权重启这一服务，由 setup 负责落地。

配置只读取 `NEST_DEPLOY_*`：

| 名称 | 默认及用途 |
| --- | --- |
| `NEST_DEPLOY_ROOT` | `/srv/nest`，发布根 |
| `NEST_DEPLOY_ENV_FILE` | `/home/ubuntu/apps/nest/backend/.env`，仅建立链接，不打开内容 |
| `NEST_DEPLOY_HEALTH_URL` | `http://127.0.0.1:3000/api/public/stats` |
| `NEST_DEPLOY_SITE_URL` | 空时跳过首页探针；生产 setup 写入真实 HTTPS 首页 |
| `NEST_DEPLOY_HEALTH_ATTEMPTS` | 15，范围1–120 |
| `NEST_DEPLOY_HEALTH_DELAY` | 2秒，范围0–60 |
| `NEST_DEPLOY_MAX_ARCHIVE_BYTES` | 512MiB，可缩小用于隔离验证 |
| `NEST_DEPLOY_MAX_EXPANDED_BYTES` | 1GiB，可缩小用于隔离验证 |

## 验证与证据

先写行为测试并实际运行红灯：首轮16项测试中成功发布等因运行器/gate不存在失败（含子用例共25处失败）。实现后16/16通过。审查增量先复现 restrictive umask 导致0700、仅首页失败不回退、SIGTERM不回退和稀疏归档突破预算（4项、7处失败），以及实际关闭 stdout 后 BrokenPipe/退出120（1项失败），修复后21/21通过。最后 SIGHUP 增量先复现 current 仍为 broken（1处失败），再加入相同信号处理。

最终当前版本重新执行：

- `python3 scripts/test-deploy.py`：24/24通过，18.589秒，无失败；信号项同时覆盖 SIGTERM/SIGHUP。
- `sh -n scripts/deploy-ssh.sh`：退出0。
- Python `compile()` 对两个 `.py` 文件语法检查：退出0，不产生工作区缓存。
- 独立审查对阶段性21项测试重新执行21/21通过，并关闭目录权限、稀疏归档、日志断管三项问题；后续仅增加失败边界断言及 SIGHUP 同类处理。

测试在独立临时目录运行实际脚本，真实断言归档文件、符号链接、安装/切换顺序、ready 标记、退出状态及清理。仅外部 npm、sudo/systemctl、curl 由 PATH 替身代替；包含成功/二次发布、安装/重启/API/首页/恢复失败、首发失败、手动/失败回退、重复、锁及真实重叠发布、显式目录归档、恶意成员/缺少构建/大小/稀疏限制、非法SSH命令、断管及SSH信号。所有 env 均为临时 fixture，无线上或真实业务数据访问。

## 交接

整合者按上述目录、ready 标记和 env 链接格式建立 bootstrap；`node_modules` 内 npm 安装产生的合法链接不在回退扫描范围。工作流归档可直接包含 `backend/dist` 和 `frontend/dist` 及两个 package 文件，不必包含父目录。实际安装依赖、Nginx/systemd、专用密钥与公网 HTTPS 探针尚需服务器和 GitHub 验证；本地替身证据不代表线上已通过。
