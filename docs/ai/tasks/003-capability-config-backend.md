# SPEC-003 P19/C2：我的能力配置后端

- 核对日期：2026-11-07（Asia/Shanghai）。基准提交 `82acde8`；交付为当前未提交工作区。
- 状态：后端实施和真实 HTTP 验证完成，供根整合与独立审查。SPEC/STATE、前端和浏览器验收由整合者负责，本报告不将后端结果扩展为整轮交付。
- 已读取根 AGENT、STATE、架构概览、backend/AGENTS 及 SPEC-003/P19；应用 TDD、verification-before-completion。已有前后端与文档未提交改动均保留；没有新建分支/worktree、提交、推送、部署、清理开发库或新增依赖。

## 实现与接口边界

- `SiteContent.capabilities` 固定包含 `ai`、`frontend`、`backend`、`deployment` 四个数组；项为 `{ icon: string, name: string }`。原有 PUT `/api/site/config` 整份文档与版本保存，未新增端点。
- `name` 复用现有 Unicode 码点计数校验，允许 1–40 个字符，拒绝空串及纯空白；不修剪用户合法昵称。每类最多 12 项，同类 `icon` 唯一；跨类可重复同一图标，顺序原样保存。
- 白名单固定 38 项：`codex chatgpt claude deepseek gemini cursor ollama react vuedotjs typescript javascript html5 css3 vite nextdotjs antdesign tailwindcss nodedotjs nestjs express python fastapi java springboot go mongodb mysql postgresql redis docker kubernetes nginx linux git github githubactions vercel cloudflare`。`openai` 不在白名单。服务端不按类别限制图标，不接受 SVG、外部图标地址或路径。
- 每个分组使用真实嵌套 DTO、数组/逐项对象/唯一性规则；显式 null、数组代替分区、不完整分组、未知字段、未知图标及嵌套数组均拒绝。
- 仅整个 `capabilities` 缺失时兼容旧客户端和旧库：`defaultSiteCapabilities()` 返回当前九项（AI: Codex/Claude/DeepSeek；前端: React/Vue/TypeScript；后端: NestJS/MongoDB；部署: Docker）。默认每次创建独立对象；显式空组和四类全空均保留。
- 历史库的默认在返回边界补齐，不写库、不改 version/updatedAt；旧客户端保存会将完整默认随整份内容持久化。沿用 Session→Owner→CSRF 和数据库原子版本比较。
- 手写业务及测试新增处保留中文学习注释，解释默认兼容、DTO 嵌套实例、全局白名单和边界测试目的。

## 本次修改范围

- [公开类型](../../../backend/src/site/types/site.type.ts)：能力项类型和 SiteContent 字段。
- [图标白名单](../../../backend/src/site/config/site.capabilities.ts)：38 项全局标识。
- [默认内容](../../../backend/src/site/config/site.defaults.ts)：九项能力默认和首次未保存响应。
- [保存 DTO](../../../backend/src/site/dto/save-site.dto.ts)：四类严格嵌套校验及缺失兼容。
- [站点服务](../../../backend/src/site/site.service.ts)：历史文档读取回填。
- [HTTP 测试](../../../backend/test/site.e2e.test.mjs)：五条能力用例、多个正常/异常场景断言；现有共享夹具补完整 capabilities。
- 本报告。未改后端 Schema、Controller、Guard、上传逻辑或其他模块；未改前端、SPEC、STATE。

## 实际验证

1. **先红**：仅新增测试，未写能力生产实现；在 `backend/` 执行 `npm run build && node --test --test-name-pattern='能力|三十八' test/site.e2e.test.mjs`，输出记录 `/tmp/nest-backend-capabilities-red.log`。退出 1，5/5 失败；可直接观察公开默认 `undefined` 与预期九项不符、合法保存返回 400（未实现字段被拒绝），属于预期缺失行为。
2. **定向绿**：同一构建和 HTTP 命令退出 0，5/5 通过，日志 `/tmp/nest-backend-capabilities-focused.log`。随后补强四类各自的数量、唯一性与逐项对象边界断言。
3. **最终全套**：在 `backend/` 执行 `npm test`（等价根目录 `npm test --prefix backend`），含 Nest 构建及真实临时 MongoDB HTTP 测试，最终退出 0：**72/72，5 套件，0 失败/取消/跳过**。最终日志 `/tmp/nest-backend-capabilities-final.log`，末尾 duration 7312.3565ms；没有以模拟结果替代 HTTP。
4. `git diff --check` 退出 0。此命令不检查未跟踪文件正文；新增能力文件另经编译、HTTP 和人工范围核对。

HTTP 覆盖：新库公开/站主管理读取默认且集合为零；旧请求保存完整默认；旧库移除整个能力分区后两入口补默认且 Mongo 原记录、版本和时间均不变；自定义昵称、空组、数组次序、40 个非 BMP Unicode 字符、跨类重复和跨类选择图标；38 项图标均可保存、四类各 12 项边界与全空；重启应用后同库数据/版本/会话恢复；四类缺失、错误根/组/项形状、未知分区/项字段、缺失 icon/name、`openai`/危险路径/大小写未知图标、同类重复、13 项、41 个非 BMP 字符、空白或错误类型昵称均 400 且保留原配置；匿名、非站主、缺失站主配置、错误/缺失 CSRF 和陈旧版本 409 均不覆盖配置。既有认证、任务、媒体上传/读取及同版本并发回归随完整套件通过。

测试沿用现有 `startApp`，每例创建真实 Nest 应用、随机 `awei_e2e_*` 独立库和临时媒体目录；清理前核对库名前缀。只连接现有配置指向的 MongoDB，不打印真实连接串或凭据。

## 整合交接

- 前端应对照相同 38 项标识与九项默认；仅 capabilities 整体缺失兼容，显式空组不可重填默认，昵称不能用 UTF-16 长度代替 Unicode 码点。
- 公开页/配置草稿/预览的运行时解析、图标素材许可、桌面手机视觉与独立审查不属于此后端任务，根整合继续覆盖 AC19-1–5。
