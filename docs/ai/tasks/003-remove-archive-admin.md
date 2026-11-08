# P24-B：移除后台作品档案与共享前端合同

- 核对日期：2026-11-07（Asia/Shanghai）。基准82acde8，未提交工作区；任务差异以`/tmp/nest-remove-archive-before`比对。
- 目标：实现[SPEC-003 P24](../../specs/003-personal-site.md#p24作品档案整体移除最新合同2026-11-07)的P24-B，负责AC24-03源码范围及共享前端合同。P24覆盖同文件后方历史作品约定。
- 已完成实现与定向模拟验证；完整lint/build、真实桌面/手机后台预览由P24-D整合验收。

## 改动

- `frontend/src/types/site.ts`：删除`SiteProject`、`SiteCategory`与`SiteContent.projects`；保留`home.buttonLabel`、能力、音乐及其它内容结构。
- `frontend/src/api/site.ts`：删除项目解析、图片上传`uploadSiteAsset`与`isSafeSiteUrl`的`image/demo`分支。`parseSiteContent`不再要求projects，携带该未知字段会被拒绝。保留严格对象/版本校验、音乐/能力缺失兼容、音频上传`uploadSiteAudio`与音频媒体URL校验。
- `frontend/src/store/site-admin.ts`：删除项目增删排序、封面上传及其状态/错误；busy不再依赖图片。保留音频上传、编辑互斥、dirty、身份版本、401草稿恢复、400/403/409与结果未知处理。
- `frontend/src/pages/admin/`：删除作品分区、图标、全部项目表单、封面预览/上传、排序/删除样式及删除确认分支；共用的联系添加/音乐上传样式保留。场景一览显示初次见面/我的能力，能力图使用`/site/capability-character-768.webp`；外观文案改为欢迎/能力场景。其它编辑、退出/载入最新确认、权限页、草稿预览保留。

## 可执行验证与结果

- API实际模块临时断言：`node --disable-warning=ExperimentalWarning /tmp/nest-remove-archive-api-assertions.mjs`。修改前13/21通过，8项按预期失败（无projects内容被拒绝、旧projects仍被接受、图片上传仍存在等）；修改后21/21通过。脚本直接导入仓库实际TS模块，仅补全Node解析扩展名，没有镜像解析实现或网络替身。
- 草稿实际模块断言：`node --disable-warning=ExperimentalWarning /tmp/nest-remove-archive-store-assertions.mjs`。17/17通过；导入实际SiteAdminStore、AuthStore、API和MobX，仅模拟fetch响应。覆盖无projects加载/保存、buttonLabel保留、dirty、400/409保留输入、核对并显式载入最新、无效音频不发请求、音频上传只改草稿、401同账号恢复及不同账号清理。
- 静态残留核对：在上述责任文件与`pages/admin/`内搜索`SiteProject|SiteCategory|projects|uploadingProjectId|uploadCover|uploadSiteAsset|uploadError|档案|作品|封面|seated-character|orderButtons|deleteButton|coverPreview|coverFallback|onDelete`，无匹配。能力人物文件实际存在。
- 自审：逐项比对开始快照，确认能力编辑器及音乐表单/上传方法无改动，保存冲突/身份处理只移除项目字段依赖；退出与载入最新确认仍存在。无阻塞发现。
- 本分工未执行全局lint/build或真实浏览器，不把上述模拟称为HTTP或浏览器验收；未新建前端测试框架、test脚本或依赖。整合者统一执行P24-D。

## 边界与交接

- 后端负责公开/站主响应剔除旧projects、写入projects为400、图片POST为404；前端严格新合同需与该后端同步上线/重启，本分工未变更数据库或开发配置数据。
- 公开页负责移除project深链与所有`image/demo`调用，并将主按钮改为进入能力。数据库既有home.buttonLabel可能仍含历史文案，不为清理而保存真实配置；公开按钮显示需按P24检查。
- 本分工仅修改types、api、site-admin、pages/admin及本报告。未修改公开页、后端、SPEC、STATE；未提交、推送、换分支、创建worktree、部署或删除历史媒体。
