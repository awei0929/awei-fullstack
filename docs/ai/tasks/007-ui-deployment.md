# SPEC-007 前端优化发布记录

- 日期：2026-11-14；用户在本地验收完成后明确要求提交、推送并部署。
- 功能提交：`0b04b1944a36c140a3083e5fee76ef6afedc75b1`，已推送 `main`。
- [Build and deploy 43560815456](https://github.com/awei0929/awei-fullstack/actions/runs/43560815456)，Release：`0b04b1944a36c140a3083e5fee76ef6afedc75b1-43560815456-1`。
- 当前状态：三个job全部成功，13:24:14（Asia/Shanghai）完成发布，13:25:45完成线上只读核验。

## 范围与验证复用

提交包含22个前端源码文件、UI/UX规则及SPEC-007验收记录。原README、STATE其他历史、SPEC-006/P8和模型研究改动继续留在工作区，不混入发布。

前端差异SHA256为`e4df3d3272d0dea95e873902cf2cb71e686cdf8502691b900ae47de2bcb5049a`，与[本地整合验收](007-ui-integration.md)完全一致；相关依赖、构建配置、后端和工作流没有变化。本轮提交沿用已通过的本地lint/build、前端55项定向回归和真实Chrome多视口交互结果，没有为提交重复执行这些检查。

## 本次自动构建结果

- CI前端lint零告警/错误，TypeScript与Vite构建成功。
- CI后端150/150，10套件；部署处理器24/24；共174项通过，无失败、取消、跳过或待办。前端55项为此前本地证据，未在该CI运行。
- 发布包4,393,190字节，SHA256：`8b02f9abbe741c88f87b8cd8c244d0dabfdd88a8ca3d9439082e0a3f4862a470`，与构建打包日志一致。
- 发布包301个成员、263个普通文件，仅含既有白名单，无真实环境文件、依赖目录、链接或越界路径。
- 包内首页666字节，SHA256：`6d934a8da9643fe8d284145376481caf375146c7e833f080415d77f703d52682`；主入口`/assets/index-ConLGEAK.js`。

## 发布前基线

13:15:17（Asia/Shanghai），正常TLS请求正式首页、`/api/site`和`/api/public/stats`，均HTTP200、TLS校验结果0。官网配置仍为v7，SHA256：`6ac585e102ceababdc14083b45ecba9adc173a529e4e3713c504400fa6889f36`。

旧首页SHA256：`b7a24e26979959b417a271ce758eff9b66d3e45b3e7deb188afe3c81ace4ef7d`，主入口`/assets/index-JptDJ25w.js`。原始公开响应留系统临时目录供发布后逐字节比较，不保存截图或生产凭据。

## 上线核验与边界

- Actions：Validate main and release、Build and test、Deploy or roll back全部success；发布job耗时5分4秒。
- 部署日志确认归档校验`OK`，`current`切至本次Release并重启`nest-backend.service`；启动窗口首次健康探针连接拒绝，第二次通过，最终`deployment succeeded`。依赖安装成功，日志有既有argon2安装脚本许可提示；本轮没有修改依赖或安装策略。
- 正常TLS读取`/`、`/admin`、`/tasks`、`/api/site`、`/api/public/stats`以及首页引用的4个JS/CSS资源，共9个GET，均HTTP200、curl退出0、TLS校验结果0。
- 三个SPA入口与发布包内首页逐字节一致，首页4个静态资源也与发布包逐字节一致；正式首页SHA256为`6d934a8da9643fe8d284145376481caf375146c7e833f080415d77f703d52682`，确认切换到本次版本。
- 官网配置仍v7，与本轮发布前响应逐字节一致，SHA256仍为`6ac585e102ceababdc14083b45ecba9adc173a529e4e3713c504400fa6889f36`。

发布包、构建及部署日志均可从上述Actions下载。原始公开响应与逐字节比较摘要保存在系统临时目录，不作为需进入仓库的运行资产。发布完成后仅回写文档，并用`[skip ci]`提交推送，不重复部署相同应用代码。

本轮不改真实环境配置、数据库或媒体，不向生产写入合成聊天/任务/记忆；真实模型性能、生产写入交互和其他浏览器不在本次发布复验范围，本地交互证据的边界仍见整合记录。
