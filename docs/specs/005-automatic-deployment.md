# SPEC-005：推送后自动构建部署

- 编号：005
- 状态：已验证
- 更新日期：2026-11-10
- 前置：GitHub main、现有 Ubuntu/Nginx/systemd/MongoDB 部署。
- 授权：用户要求代为接入并告知步骤；保留当前分支和已有 SPEC-004 未提交改动，不顺带发布该功能。

## 目标与范围

推送 main 后自动检查、构建、部署，保留可查看和下载的日志；支持手动运行及回退。沿用 Node 24、Nginx、nest-backend.service 和 MongoDB，不修改业务接口或数据。
只提交本次自动部署文件及文档增量，产物从实际 Git 提交构建，不包含本地未提交代码。首次验证使用既有已提交业务代码。

## 用户行为与异常

Actions 显示 Build → Deploy 各步骤输出。构建失败不发布；服务器先安装依赖再切换版本。发布串行，健康检查失败切回旧版并重启，工作流仍标失败。日志记录提交及发布编号，不打印真实 env 或凭据。手动 rollback 指定已安装版本；手动运行同样限制 main。

## 接口与数据契约

不涉及应用 HTTP 或数据库接口变更。部署专用 SSH 公钥使用 restrict 和固定命令入口，仅接受 deploy <release-id> 或 rollback <release-id>。deploy 从标准输入收取 gzip tar；编号仅允许字母、数字和连字符并限制长度。
归档只包含 frontend/dist、backend/dist、backend/package.json、backend/package-lock.json；拒绝路径穿越、绝对路径、链接、特殊文件和白名单外文件，不含 env、node_modules、Git、媒体和数据库。服务器使用 Node 24 执行 npm ci --omit=dev。

## 实现影响与决策

- `.github/workflows/deploy.yml`：Node 24、锁文件、前端 lint/build、后端隔离 Mongo HTTP 测试、归档、SSH 发布、日志及摘要；contents:read 最小权限。
- `scripts/deploy.py`：Python 标准库接收/校验归档、发布锁、独立 releases、current/previous 链接、安装依赖、重启/健康检查与失败回退；NEST_DEPLOY_* 配置支持临时目录验证。
- `scripts/deploy-ssh.sh`：根用户安装的固定入口，校验 SSH_ORIGINAL_COMMAND，调用 deploy.py；禁止任意 shell、转发和终端。
- `scripts/test-deploy.py`：真实临时目录测试成功/失败/回退/并发/恶意归档，外部依赖安装、服务重启和探针通过命令替身模拟，不访问线上。
- `scripts/setup-deploy.sh`：首次接入，备份当前配置及版本，建立 env 引用、systemd drop-in、Nginx 静态根链接与限定重启权限；以实际服务器核对结果为准。
- README、SPEC 索引、STATE：日常发布、日志、回退与验证边界。

发布根 `/srv/nest`，systemd 从 current/backend 启动，`/var/www/nest` 指向 current/frontend/dist。服务器实测 `/home/ubuntu` 为 750，www-data 无法遍历，因此选择 /srv，不扩大 home 权限。原仓库、Mongo 命名卷、外部媒体目录、私有 Compose override 与真实 env 保留。Nginx API 代理、HTTPS 及续期不随发布重建。首次接入先核对真实配置；不绕过 MFA，不扩大原数据库隧道密钥权限。

## 验收条件

| 编号 | 操作 | 预期 | 验证 |
| --- | --- | --- | --- |
| AC-01 | main 推送及手动非 main | main 自动运行，其他分支不发布 | 配置检查及 GitHub 实跑 |
| AC-02 | 构建成功及失败 | 检查/构建有日志，失败不发布 | GitHub 实跑与依赖关系 |
| AC-03 | 发布归档与切换 | 独立版本，保留 env/媒体，首页/API 正常 | 隔离测试及线上只读探针 |
| AC-04 | 安装失败、健康失败、重复/并发 | 旧版可用、串行保护、错误退出 | 临时目录故障模拟 |
| AC-05 | 恶意归档、非法 SSH 命令 | 拒绝且不改变当前版本 | 自动测试 |
| AC-06 | 回退已安装版本 | 检查目标、切换/检查、数据保留 | 临时目录及必要线上演练 |
| AC-07 | 日志与交接 | 分阶段日志/摘要/下载和使用步骤 | GitHub 与文档检查 |

## 实施清单

- [x] 核对需求、架构、Git 状态与权限；设计如上。
- [x] 任务1（AC-03/04/05/06）：先写行为测试并确认失败，再实现 deploy.py、deploy-ssh.sh，隔离测试24/24通过。
- [x] 任务2（AC-01/02/07）：workflow、固定动作版本、隔离测试库、构建归档/日志、受限 SSH 发布/回退；actionlint及29项模拟通过。
- [x] 任务3（AC-03/05）：服务器接入成功；用户完成MFA并确认公钥，production只允许main，私钥仅环境Secret，受限SSH命令拒绝实测通过。
- [x] 任务4（AC-01/02/03/06/07）：独立审查与限定修复完成，仅提交/推送本次范围；main真实推送工作流成功，线上产物核对和使用文档完成。

## 验证记录

- 起始 HEAD 9b12524；SPEC-004 工作区改动保留。GitHub CLI 确认公开仓库、main 默认分支、当前账号有 admin/push 权限且 Actions 已启用。
- 普通 SSH 没有管理凭据；现有 nest-db key 仅限隧道。用户已完成腾讯云 OrcaTerm 微信 MFA，待读取实际会话。
- 根最终隔离24/24（19.518s），限定独立审查无未关闭P1/P2；归档、失败恢复、手动回退、锁、静态权限、SIGTERM/SIGHUP与断线保护有模拟证据。详见运行器/审查任务记录。
- 首次线上setup因umask077下bootstrap父目录700失败，实际恢复原服务与静态路径且HTTPS200；17f9c80修复后重试成功。原env/Mongo/媒体保留，发布根/srv/nest。
- 手动回退当前bootstrap的运行42756018740成功，验证远程SSH、幂等回退、重启、API与HTTPS双探针及实际部署日志归档；不同目标切换仅隔离测试，未宣称线上已做故障注入。
- 首次构建42755814824因Mongo内核兼容失败，deploy正确跳过；按官方维护者建议配置CI临时兼容项后，main推送d0c5ef6自动触发[42756174781](https://github.com/awei0929/awei-fullstack/actions/runs/42756174781)，三个job全部成功。Node24.22.2，部署隔离24/24、后端76/76及5套件、前端lint/build通过；未包含SPEC-004工作区。
- 成功发布版本d0c5ef6a96b09b584b6a9e2324c3a9f6b1bb42c6-42756174781-1，服务依赖安装148项/3秒，切换后第2次API/HTTPS检查通过。跨境SSH收包约6分24秒，曾由2MiB增加到3MiB的只读进程元数据确认持续推进，未误作程序死锁。
- 构建日志、部署日志、发布包3份artifact均实际存在；发布包和部署日志已实际下载核对。线上首页与本次包内index.html逐字节相同，SHA256 c2c6e18900c07e654f5aba9465dedc57cb1cdcabdf63810ed393d2c6d719ac12；3个入口资源、/admin、/api/public/stats可信HTTPS均200。

## 未决与交接

本次范围已验证。非main通过静态/模拟与production环境分支策略核对，未另建远程分支实跑；线上手动回退验证当前bootstrap的幂等操作，不同版本切换与故障注入保留隔离测试边界。后台密码登录、内容保存和上传不属于本次探针，不声称已实操。服务器成功版本不自动清理，应按手册维护磁盘。部署只使用已提交源码，不包含本地SPEC-004功能。详细证据见[整合记录](../ai/tasks/005-deployment-integration.md)，使用见[部署手册](../deployment.md)。
