# P28 配置与前端合同

- 核对日期：2026-11-08（Asia/Shanghai）。基准 `82acde8`，大量既有未提交改动已保留；本轮范围按 SPEC-003 P28 T2。
- 状态：T2 实现及模块/静态验证完成；真实浏览器与隔离 fixture 保存验收由整合者继续执行。本代理未写真实 Mongo、未操作用户会话、未提交/推送/换分支/worktree。
- 依据：[SPEC-003 P28](../../specs/003-personal-site.md)、[前端约定](../../../frontend/AGENTS.md)。对应 AC-P28-01/04/05；公开三卡和共享 Markdown 由根代理并行实现。

## 已完成

- `SiteContent` 新增 `SiteCapabilityDetails` / `SiteCompanyProject`，独立默认工厂每次创建新对象；技术默认与后端一致，公司与项目保持真实空态，不重置原四类 `capabilities`。
- 仅 `getSite` / `getSiteConfig` 调用允许整个新分区缺失的兼容解析；`parseSiteContent` / `parseSiteDocument` 默认严格，保存输入及响应均要求完整新分区。显式 null、缺字段、未知字段、类型错误、重复/非法项目 ID、纯空白名称、超界正文/数量、危险封面拒绝。
- `isSafeSiteUrl` 扩展 `image`，允许安全 HTTP(S) 与 `/api/site/assets/<uuid-v4>.png|jpg|webp`；不恢复图片上传。保存始终携带完整 `capabilityDetails`。
- 后台「我的能力」新增技术栈/公司背景/公司项目三个顶层 Tab。技术栈包含技术介绍和原四分类编辑；公司包含名称、摘要及简介/业务/职责 Markdown；项目支持目录选择、新增/删除/上移/下移/公开开关/封面 URL/正文及主动插入空标题结构（最多12项）。Markdown 编辑提供展开预览，复用根代理的安全 `SiteMarkdown`。
- 保存先定位所有技术昵称和公司项目的无效名称/封面，自动回到对应顶层 Tab、分类/项目、手机编辑面板并聚焦；不会让隐藏字段静默阻塞。封面自定义校验随项目切换刷新，避免继承前一项目的错误。
- iframe 草稿协议要求新分区完整结构及正确字段类型；允许空名称和输入一半的 URL，保持连续草稿预览。隐藏项目完整留在草稿，由公开详情过滤。

## 实际验证

1. `/tmp/nest-capability-details-api.check.cjs`：执行真实 TypeScript API/预览协议模块，经现有后端 TypeScript 编译器临时转译，HTTP 边界以 `fetch` 响应替身隔离。修改前 **12通过/7失败**（缺新默认、正常新分区被拒、图片路径不支持、旧PUT未提前拒绝、新预览结构未校验）；实现后 **19/19通过**。覆盖旧 GET 默认/对象隔离/原昵称保持、完整空值、null/部分/未知/错误类型、重复/非法 ID、空白名称、13项/20001字拒绝、80个 emoji 及20000字边界、安全图片URL、PUT缺分区不发请求与完整携带、新预览结构及未完成草稿。
2. `/tmp/nest-capability-details-editor.check.cjs`：执行实际编辑器函数和事件，**8/8通过**。覆盖新增与选中、12项上限、排序保内容、隐藏保正文、删除后选相邻项目、公司 Markdown 修改及预览、Unicode80字及空白校验、切换项目清除旧封面校验。
3. `/tmp/nest-capability-details-save.check.cjs`：执行实际 `AdminPage` 函数，模拟 hooks/表单焦点边界，**4/4通过**。覆盖隐藏项目名/危险封面跨 Tab 选中聚焦、原技术昵称定位、有效内容继续整站保存。
4. 最终重新执行 `npm run lint --prefix frontend` **退出0，无警告**；`npm run build --prefix frontend` **退出0**（含 TypeScript，1819 modules）。根代理 Markdown 与公开页已集成。

以上临时 Node 检查是定向模块/行为模拟，不是正式前端测试框架、真实浏览器或真实网络证据。未新增测试框架；本代理未执行浏览器与真实保存/刷新/409/断网验收，留给整合者的隔离 fixture。

## 涉及文件

- `frontend/src/types/site.ts`、`frontend/src/api/site.ts`、`frontend/src/config/site-capability-details.ts`
- `frontend/src/pages/admin/{editors.tsx,index.tsx,capabilities-editor.tsx,sections.ts,capability-details-editor.tsx,capability-details-editor.module.less,preview-protocol.ts}`
- 本报告。未修改公开页、共享 Markdown、依赖、store、后端或 STATE。
