# SPEC-004 上传功能线上发布

- 日期：2026-11-10，Asia/Shanghai。
- 授权：用户要求提交未提交上传功能，推送main上线，并确认自动部署和线上上传。
- 起始：main/77d70f7；待发布内容为SPEC-004代码/测试/模板及相关文档，保留任务开始前的其他README/STATE部署笔记。

## 发布前核对

- 独立只读核对17/17应用源码SHA256与`.local/upload-tests/final-source-hashes.json`相同；9b12524以来两端package/lock、tsconfig、Nest/Vite配置无变化，环境模板仅增加上传说明。
- 沿用已有后端95/95与6套件、前端实际模块68/68、Markdown SSR5/5、lint/build及审查结果，没有把沿用结果说成本次重新执行。测试文件未包含在该哈希快照中，但修改时间早于最终快照约10分钟，CI将执行实际提交的完整套件。
- 限定候选敏感扫描仅命中`.env.example`显式占位值，未发现私钥/token/真实env或凭据文件；不提交忽略的本机测试脚本或实际环境文件。
- 官网后台已登录，进入时显示已保存v7。此次使用合成64×64 PNG、有效PDF、非空ZIP和2MiB UTF-8文本，不使用个人资料作为上传样例。

## 服务器、CI与线上验收

- 用户已完成腾讯云微信MFA。实际SITE_ASSETS_DIR=/home/ubuntu/nest-data/site-assets，目录ubuntu/755且ubuntu读写成功；站主ID保持配置，没有输出真实env或修改账号。
- 原API代理没有单独上传限额；已备份到/etc/nginx/sites-available/nest.before-uploads-20261110T052251Z，仅在原location /api/加入client_max_body_size 25m，nginx -t成功并reload，代理/HTTPS/证书配置保留。
- 已提交并推送81ef221c1364567c930f354ed579e002621366b8，自动push运行[42761696989](https://github.com/awei0929/awei-fullstack/actions/runs/42761696989)三job全部成功：Node24.22.2、部署脚本24/24、后端95/95/6套件、前端lint/build。Release=81ef221c1364567c930f354ed579e002621366b8-42761696989-1。
- SSH上传约92秒，生产依赖148项/3秒，亚洲上海时间13:25:19切换并重启、13:25:21第2次健康检查通过。生产依赖审计0漏洞，仍有argon2安装脚本提示；CI两端各2个既有moderate提示，本次未升级依赖。
- 三份Artifacts均实际存在：[发布包](https://github.com/awei0929/awei-fullstack/actions/runs/42761696989/artifacts/13737269903)、[构建日志](https://github.com/awei0929/awei-fullstack/actions/runs/42761696989/artifacts/13737558632)、[部署日志](https://github.com/awei0929/awei-fullstack/actions/runs/42761696989/artifacts/13737553390)。归档SHA256为8cb46f3367a9f6e501e713a6147cfc188c87173bc802930005d640805769ad97；实际下载并确认线上index与包内逐字节一致，SHA256 b8b6b3cafafb72e3d8bd09970e7a04f7b71559874006322615444e13ce4c04eb。

## 真实Chrome与HTTPS上传验收

- 使用当前已登录站主会话，刷新后出现文件上传分区，仍为已保存v7。首次自动选文件受浏览器扩展本地文件权限限制；原生选择器也未完成。用户明确批准临时开启后，完成全部上传，最后已把允许访问文件网址关闭并收起设置页；没有重启Chrome、改其他扩展权限或使用真实私人文件。
- 文件上传分区依次上传PNG、有效PDF、非空ZIP、2MiB UTF-8文本，均显示成功和可复制的URL/Markdown。真实图片上传期间退出/文件控件disabled，完成后恢复。
- 公司简介原文为空。正文入口直接上传PNG/PDF后，分别自动追加图片和链接Markdown，草稿dirty但公开配置未变化；展开预览，DOM实测图片complete=true、naturalWidth/Height=64。点击PDF预览链接，Chrome下载记录显示604 B完成，实际中文文件名为上线验收文档.pdf，字节SHA256与样例一致。下载事件监听因链接新窗口未捕获，不将该工具超时冒充文件下载失败。
- 验收后恢复原空公司简介，页面恢复已保存v7、保存按钮disabled，没有点击保存全部。公开/api/site与验收前响应逐字节一致；本次仅验证草稿插入/预览及已上传文件公开访问，不宣称在线保存PUT。
- 使用不加载curl配置且显式无Cookie的匿名请求核对6文件：全部HTTP200、字节SHA256与源样例一致；PNG=image/png，PDF/ZIP/TXT类型正确且Content-Disposition为attachment及UTF-8中文下载名。另匿名2MiB上传POST得到401，说明仍受登录保护且经过Nginx较大请求体限额。
- 经受限SSH入口对当前同一版本执行幂等rollback（实际仅重启），退出0、API/HTTPS第2轮通过；重启后6文件再次匿名GET且SHA256相同。原公开配置仍逐字节保持v7，真实Mongo与原媒体未清空/初始化。

| 样例 | 字节 | 新增UUID文件名 |
| --- | --- | --- |
| 上传区PNG | 209 | 5dc7565b-8df2-4a6f-91f1-2baf3d05f942.png |
| 上传区PDF | 604 | 5c7f09a1-db19-4a76-92f9-460405fc3d6b.pdf |
| 上传区ZIP | 168 | fee93b63-eda4-4e00-b350-fcca4e691670.zip |
| 上传区2MiB文本 | 2097152 | efbbe8f6-8c57-42ee-84f2-219a8091b095.txt |
| 正文PNG | 209 | 8f6a652d-1970-4ef7-8d67-ce89582c0d61.png |
| 正文PDF | 604 | 25b567e8-ebd6-4397-8104-efecc69742f0.pdf |

六文件均在本站/api/site/assets/路径下，作为公开合成验收文件保留，不写入真实官网正文；未自动删除它们或其他媒体。

## 验证边界

自动测试保持隔离Mongo，不运行线上套件；原账号、数据、媒体保留。保存PUT、手机真机、多浏览器、线上精确5/20MiB边界、Office实际打开与磁盘故障没有新增实操，不扩大声明。仅文档回写提交跳过重复CI，应用代码/依赖/工作流与成功运行相同。其他既有README/STATE部署笔记继续保留在工作区。
