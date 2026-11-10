# SPEC-005 独立部署审查

- 日期：2026-11-10。
- 基准：HEAD `9b12524`；沿用起始 `main` 工作区。已有 SPEC-004 后端、前端、README/STATE 等改动不在审查范围，不改这些文件。
- 范围：自动部署脚本、workflow、首次迁移与失败恢复；只读审查，独立证据仅写本文件。未操作服务器、提交、推送或读取真实 `.env`。
- 约定依据：`AGENT.md`、`docs/ai/STATE.md`、`docs/architecture/overview.md`、`docs/specs/005-automatic-deployment.md`。

## 已确认问题（初审，待修复复核）

1. **P1：首次静态根切换失败后不恢复原目录**。初审 `scripts/setup-deploy.sh:101-103` 先移动 `/var/www/nest`，成功创建链接后才设置 `changed_web=1`；链接创建失败时恢复函数跳过恢复，静态根消失。隔离执行原69–112行，令 `ln` 返回44，实测退出44、`web_exists=false`、`backup/frontend.before`仍在。建议移动成功即记恢复状态，并容忍待创建链接不存在。
2. **P2：systemd drop-in 部分写入失败未恢复**。初审 `scripts/setup-deploy.sh:92-98` 写完文件后才设置 `changed_service=1`；写失败时旧文件已截断，恢复函数跳过恢复。隔离执行同段，令 `cat` 输出部分内容后返回66，实测退出66、drop-in保留部分坏内容。建议临时文件原子替换，并在覆盖前记录恢复状态。

## 待核对

- Nginx 的 `www-data` 能否遍历 `/home/ubuntu/apps/nest-deploy/current/frontend/dist` 全部祖先；初稿只保证新建目录755，不能保证home/apps可遍历。根代理正在取得服务器权限证据。
- `deploy.py`、`deploy-ssh.sh`、workflow仍由其它代理编写；待完成后审查归档白名单、路径/链接、锁、失败回退、main限制、日志和Node24兼容。
- 当前仅静态分析与临时目录故障注入；未将真实线上配置、真实依赖安装或完整发布称为通过。

## 第一轮整体审查

- 原16项 `python3 scripts/test-deploy.py` 全通过（17.495s），覆盖成功安装/切换、失败恢复、手动回退、重复ID、并发锁、路径/链接/特殊文件及非法SSH命令。该轮仍发现以下测试外风险。
- **P1：候选release的0700阻断Nginx**。初审 `deploy.py:236,244` 将 `tempfile.mkdtemp` 的0700目录直接提升为最终release，API健康检查无法发现前端403。已反馈根代理/实现者，待修复复核。
- **P2：GNU sparse绕过解压体积限制**。初审 `deploy.py:193-202` 的 `extractfile` 会将GNU稀疏成员逻辑空洞补零，gzip解开的tar体积限制不能限制实际写出大小。隔离构造407字节gzip，展开tar限制20480字节，PAX `GNU.sparse.map=0,1`、`GNU.sparse.size=65536`，实际写出65536字节。默认1GiB限制同样可被绕过至磁盘耗尽。建议拒绝稀疏成员并累计成员逻辑大小。
- **P1：SSH日志断开可使current悬空**。初审 `deploy.py:247-261` 在切换后日志抛 `BrokenPipeError`，`recover` 开头日志再次抛错，跳过链接恢复；`finally`再删除候选目录。隔离先发布old，随后令current=new时的日志抛BrokenPipe，实测 `current -> releases/new`、current不存在、old仍在、new被删除。建议让日志错误不阻断恢复，且删除候选前确认current不再指向它。

## setup修复复核

- 已见当前setup将发布根改为 `/srv/nest`；根代理从服务器确认 `/home/ubuntu` 为750，`www-data`无遍历权限，原home路径风险有真实依据。审查者未操作服务器。
- `changed_web`已移至成功mv后、ln前；`changed_service`已移至drop-in写入前。针对同一原脚本段重新故障注入：ln失败44、cat部分写入66两种情况均恢复旧web/index及原drop-in，初审两项问题已关闭。
- 外部env仍以符号链接指向原repo路径，脚本未复制内容或修改真实env/媒体；实际服务器env与媒体路径保留情况由根代理核对，不以此静态结论代替线上核对。

## 最终代码复核（本机）

- **结论：本轮已报告的5项实质问题全部修复并复核关闭，当前无未关闭P1/P2。** setup首次切换两项之外，runtime已修复release/静态权限、GNU sparse/成员逻辑大小预算及日志断管恢复；保留候选清理前的current指向检查，避免恢复本身失败时删除仍在引用的目录。
- `python3 scripts/test-deploy.py`：**21/21通过，16.653s**。新增实际stdout管道关闭后仍完整发布、SIGTERM切换后恢复、严格umask下完整前端路径755/文件644、API正常但HTTPS首页失败时回退、恶意GNU sparse拒绝。外部npm/服务/curl均为临时目录替身，不访问真实业务环境。
- `/tmp/nest-actionlint-005/actionlint .github/workflows/deploy.yml` 无告警；`bash -n scripts/setup-deploy.sh`、`sh -n scripts/deploy-ssh.sh`通过，两个Python脚本内存编译通过（不创建缓存文件）。
- workflow静态核对：push和手动均限制main；精确checkout触发SHA；build成功才发布；回退跳过构建但保留main校验；输入经环境变量传入并校验，SSH固定命令/严格host key/禁转发，artifact校验SHA256、失败日志上传和摘要路径一致。官方actions固定SHA已由workflow代理联网核验，审查者未重复网络查询。
- setup当前将发布根设为`/srv/nest`，对bootstrap前端显式755/644，切换前用`runuser -u www-data`验证入口可读，并进行API和HTTPS首页探针；后端env仅建立原路径引用。SSH专用公钥带restrict及固定入口；gate在命令校验后读取root拥有的`/etc/nest-deploy.env`，目前只设置固定首页URL，未将SSH输入交给shell执行。
- 仍须由整合者完成并记录：Ubuntu26.04/Node24真实`npm ci --omit=dev`、bootstrap服务与Nginx实际切换、真实env/媒体路径保留、GitHub完整workflow/artifact/SSH与线上回退。隔离成功不替代这些线上证据。未验证SIGKILL/断电边界，也未将其描述为可自动恢复。

本次复核文件SHA256：

```text
274b8210e4fc0baf2f78c9d35bf0e95c860294322b3f8d5365b7b74eea554e8e  scripts/deploy.py
24615dd8ed37c0d3413e0bf51dfa2c0ce37d69798dcb2b6a705016adb481ba69  scripts/deploy-ssh.sh
3879c9c2504ac9e6eb75e89f973bca6803bcaf1999f1a66c0c30e545588aa347  scripts/test-deploy.py
550dc533adacafc32f966cca477ea51bd879b8c5b7d80b811166d087c92174a7  scripts/setup-deploy.sh
9fd4f3bc1f8efd127251dc418c71556579989fbad9fb03b796f6513bee4146a0  .github/workflows/deploy.yml
```

## 首次真实setup后的限定复核

- 整合者在线上首次执行发现GNU `install -d -m755`在umask077下可令中间bootstrap根目录保持0700；真实`namei`定位到`/srv/nest/releases/bootstrap-20261110T042334Z`，而frontend/dist/index其余权限正确。`www-data`可读检查失败触发ERR恢复，整合者确认原后端active与HTTPS200。此为整合者提供的服务器证据，审查者未操作服务器。
- 限定审查当前`setup-deploy.sh:64-69`新增公共修复：位于首次bootstrap分支之外；`readlink -f`规范化最终目录，要求dirname严格等于`/srv/nest/releases`，检查ready标记与静态入口存在后，只将当前release根改为755。覆盖首次接入与本次失败重试，不放宽backend/env/home权限，不改current指向。就已定位的单个中间目录0700故障而言修复完整，无新增实质问题。
- 本次只重新运行`bash -n scripts/setup-deploy.sh`，通过；未重复runtime测试。前述21项runtime结果继续沿用，setup旧SHA256已被这次7行增量替代；首次迁移重试与线上结果由整合者继续验证。
