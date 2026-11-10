# SPEC-005 自动部署整合记录

- 日期：2026-11-10，Asia/Shanghai。
- 起始：main/9b12524，SPEC-004 的业务和文档未提交改动保留，不纳入本次代码发布。
- 关联：[SPEC-005](../../specs/005-automatic-deployment.md)、[使用手册](../../deployment.md)、[运行器](005-deploy-runtime.md)、[工作流](005-deploy-workflow.md)、[审查](005-deployment-review.md)。

## 配置与代码

- GitHub CLI 确认当前用户对 awei0929/awei-fullstack 有 admin/push 权限，Actions 已启用；默认 main。
- production Environment 创建 main 唯一部署分支规则。DEPLOY_SSH_KEY 仅保存在该 Environment，已删除接入时暂存的同名 repository Secret；连接参数与已信任 ed25519 known_hosts 为仓库 Variables。未输出私钥或业务真实 env。
- 用户完成腾讯云 OrcaTerm 微信 MFA，另明确确认追加受限部署公钥。原 authorized_keys 保留并备份；原 Mongo 隧道密钥限制不变。
- 904c6b5 仅提交本次10个新文件，17f9c80 仅修复首次 bootstrap 权限；两次初始推送 [skip ci] 用于先准备服务入口，避免未完成接入时尝试发布。
- 本轮根实际执行发布脚本隔离测试24/24，19.518s；actionlint、两份 shell 语法、diff-check 均通过。业务测试由真实 GitHub runner 执行，本机真实 env 不参与。

## 服务器核对与接入

- 实测 Node v24.22.2，/usr/bin/node/npm/python3；原服务用户 ubuntu、原工作目录 /home/ubuntu/apps/nest/backend。真实 env 权限600，媒体为外部持久目录。
- 实测 /home/ubuntu 权限750，www-data 不能遍历；因此发布根采用 /srv/nest，不放宽 home。磁盘39GiB、可用约29GiB。
- 从精确公开提交下载3份脚本，SHA256与本机相符后才执行。首次 setup 在 www-data 读文件检查失败，实际自动恢复旧服务/静态路径；确认旧后端 active、公网可信 HTTPS200。
- namei 定位 bootstrap 中间目录受继承 umask077 影响成为700。修复setup显式检查 current 目标为 releases 直接子目录后 chmod755；限定复核通过。重试成功，前后端路径接入完成，API/HTTPS探针均通过。
- 当前首次 bootstrap：bootstrap-20261110T042334Z；成功接入备份：/srv/nest/setup-backup-20261110T042514Z。原失败接入备份保留，未清理业务目录。
- systemd drop-in 从 /srv/nest/current/backend 启动；/var/www/nest 指向 current/frontend/dist。原 env 以链接保留，Mongo/媒体/私有 Compose override 未改。
- 受限 SSH 实测执行 id 返回64，并输出仅接受 deploy/rollback，证明密钥认证和强制命令已生效；无交互shell/转发权限。

## 真实 Actions 验收

- 手动首次运行 [42755814824](https://github.com/awei0929/awei-fullstack/actions/runs/42755814824)，提交17f9c80：validate成功，Mongo测试容器启动失败，build后续步骤和deploy按依赖跳过，线上未被此失败发布改变。
- Mongo8.0实际错误为Linux kernel 6.19+兼容检查（SERVER-121912），待按官方依据配置CI兼容项；不改线上数据库。容器初始化时自定义日志目录尚不存在，Artifacts API数量0，原生错误日志可查看/下载；已补文档说明这一边界。
- [42756018740](https://github.com/awei0929/awei-fullstack/actions/runs/42756018740) 手动回退入口验证已成功：目标为当前bootstrap，因此实际验证的是幂等回退、GitHub到服务器受限SSH、重启和API/HTTPS双健康检查；未发生旧/新目标切换。构建正确跳过，部署日志归档deploy-logs-42756018740-1实际存在（541字节），未改业务数据。
- CI Mongo service已按官方镜像维护者建议配置临时rseq兼容项，actionlint及格式检查通过，将由main推送实际重验。
- 待补：实际测试/构建、日志及归档、SSH安装/切换、线上探针，和main推送自动触发结果。

## 边界

部署脚本模拟覆盖自动失败恢复、手动回退、并发与恶意输入；不把模拟当作线上故障注入。首次接入失败恢复属于线上实际证据。业务写入、上传功能上线、数据恢复不在本次范围。
