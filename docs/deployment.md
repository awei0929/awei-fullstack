# 自动构建与部署

本项目使用 GitHub Actions 构建，SSH 发布到现有 Ubuntu 服务器。前后端保留原有 Nginx/systemd 运行方式；MongoDB、真实环境文件、上传文件不随代码发布。实现与实际验证见 [SPEC-005](specs/005-automatic-deployment.md)。

## 日常发布

1. 在本地完成改动并提交需要发布的文件。
2. 推送到 `main`：`git push origin main`。
3. 打开 [Actions](https://github.com/awei0929/awei-fullstack/actions)，进入本次 **Build and deploy**。
4. 等待 Validate、Build and test、Deploy or roll back 全部成功。绿色成功意味着构建、测试、远程发布及健康检查已通过。
5. 打开官网核对本次功能。自动探针只验证服务可访问，不能替代具体功能验收。

只有已提交且推送到 main 的代码会部署。其他分支不自动发布。相邻推送串行部署；运行中的发布不会因新推送中止，排队中的旧运行可能被 GitHub 合并为最新等待运行。

## 查看和下载日志

- Actions → 对应运行 → **Build and test**：依赖安装、前端 lint/build、后端 build/HTTP 测试、发布归档。
- **Deploy or roll back**：归档校验、服务器安装运行依赖、切换版本、重启与健康检查；失败回退过程同样输出在此。
- 运行摘要包含提交号、发布编号、各步骤结果与下载链接。Artifacts 中的 `build-logs-*`、`deploy-logs-*` 可下载；这些额外日志和发布归档保留 14 天。GitHub 原生步骤日志按仓库 Actions 保留设置管理。
- 构建失败不会进入发布。部署后检查失败会尝试恢复上一版，工作流仍显示失败；应先看回退是否成功，不能仅凭红色状态判断网站已停止。
- 如果错误发生在 GitHub 初始化构建机器或测试数据库阶段，自定义日志目录尚未创建，额外日志归档可能不存在；此时查看并下载该运行的 GitHub 原生日志。

## 手动重跑与回退

重新发布当前 main：Actions → **Build and deploy** → **Run workflow** → Branch 选 main，action 选 deploy。

回退：从旧的成功运行摘要复制完整 Release 编号，Run workflow 选择 main、action=rollback、release_id 填该编号。回退跳过构建，使用服务器上已经安装且有完整成功标记的版本；目标不存在或不完整会拒绝。首次接入保存的 `bootstrap-*` 是接入前的线上版本。

回退只切换应用代码，不恢复或清空数据库、媒体和后台保存的内容。回退后下一次 main 推送仍会部署最新提交；需要长期撤销改动时，提交相应代码修复或 git revert 后再推送。

## 服务器结构

```text
/srv/nest/
  releases/<release-id>/
    backend/dist + package.json + package-lock.json + node_modules
    backend/.env -> /home/ubuntu/apps/nest/backend/.env
    frontend/dist
    .nest-release-ready
  current -> releases/<active-id>
  previous -> releases/<previous-id>
  setup-backup-*/
```

- `/var/www/nest` 指向 `/srv/nest/current/frontend/dist`。
- `nest-backend.service` 的 `20-cicd.conf` drop-in 从 `/srv/nest/current/backend` 启动 `/usr/bin/node`；生产 Node 主版本保持 24。
- 根用户安装的 `/usr/local/libexec/nest-deploy.py`、`nest-deploy-ssh.sh` 提供发布入口；`/etc/nest-deploy.env` 保存非敏感的 HTTPS 探针地址。
- 部署公钥是 `restrict,command=...` 固定入口，只接受 deploy/rollback 和受限版本编号，不能用来登录交互 shell、复制任意路径或开隧道。
- 后端生产依赖在服务器通过锁文件安装，避免复制其他平台的 argon2 原生模块。
- 原 `/home/ubuntu/apps/nest` 保留，真实 env 继续放在那里，权限 600。媒体继续使用原 `SITE_ASSETS_DIR`，数据库命名卷与私有 Compose override 保留。
- 成功版本暂不自动清理，便于回退。定期检查磁盘；清理时必须保留 current、previous 和仍需回退的版本，不能清理真实 env、数据库或媒体。

管理员可在服务器用 `readlink /srv/nest/current`、`readlink /srv/nest/previous` 查看版本，用 `sudo journalctl -u nest-backend.service -n 80 --no-pager` 排查应用。不要把可能含请求信息的服务日志公开粘贴。

## 首次接入与迁移

此部分用于维护接入，不是每次发布都要运行。

1. 核对原服务、Nginx、Node 24、原 env 与媒体目录，确认当前应用健康。
2. 本地生成专用 Ed25519 部署密钥，私钥保存为 GitHub production Environment 的 Secret `DEPLOY_SSH_KEY`；公钥经管理员安装。不要提交私钥、真实 env 或把它们打印到日志。密钥只对获准使用该环境的 main 发布任务开放。
3. 在仓库 Actions Variables 配置 `DEPLOY_HOST`、`DEPLOY_USER`、`DEPLOY_PORT`、`DEPLOY_KNOWN_HOSTS`。known_hosts 必须从已核验的服务器公钥记录取得，不关闭 SSH 主机校验。
4. 建立 production Environment，部署分支规则只允许 main。确认 GitHub 执行机器可以连接服务器 SSH 端口。
5. 从已经核验的 Git 提交取得本仓库 scripts 目录，在服务器运行 `sudo bash scripts/setup-deploy.sh /path/to/deploy-key.pub`。脚本先备份原服务/静态目录，保存 bootstrap，再切换服务入口并检查可用性，最后追加受限公钥；原 authorized_keys 保留。
6. 初次配置执行真实 Actions 构建/发布，确认日志、首页/API、部署编号；记录实际结果再向使用者交接。

修改服务器上的发布脚本需要管理员重新安装相应根用户拥有的文件；普通业务发布只更新应用产物，不自动替换发布权限和入口。迁移服务器时同步更新 GitHub Variables、可信主机公钥、服务器探针配置与应用真实 env 的位置。

## 本地验证发布脚本

从项目根目录运行 `python3 scripts/test-deploy.py`。测试只使用随机临时目录，依赖安装、服务重启、HTTP 探针由命令替身模拟；覆盖非法归档、失败恢复、手动回退和发布锁，不读取本机真实 env，不连接线上或数据库。
