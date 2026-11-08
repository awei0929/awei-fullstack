# SPEC-003 P1 后端交接

- 核对日期：2026-11-07（Asia/Shanghai）。基准82acde8；本任务均为未提交改动。
- 范围：backend/ 与本报告；未修改前端、根README、STATE或SPEC，未提交、推送或创建worktree。
- 状态：P1实现与后端验证完成，交整合者进行跨端与独立审查。

## 已完成

- SiteModule独立业务模块：公开读取、受控完整配置、原子保存及媒体上传/公开读取。
- site_documents单站点集合，未保存返回version0且不写库；首次保存唯一key索引裁决并发，后续比较version原子更新；冲突409，隐藏项目只从公开响应过滤，站主仍读完整配置。
- SiteOwnerGuard复用SessionGuard认证用户UUID；缺省SITE_OWNER_USER_ID拒绝所有管理读写和上传。配置写入/上传再验证CSRF。
- 运行时嵌套DTO：未知字段、文本/列表上限、重复项目id、枚举、URL、邮箱、非负安全整数版本；整体JSON上限2MiB，支持规格允许的30个长项目正文。
- 图片限制5MiB（含精确边界），Multer限单文件、拒额外字段；校验PNG/JPEG/WebP实际签名与声明类型匹配，随机UUID文件名、严格公开读取路径与nosniff。默认backend/.data/site-assets，可配置SITE_ASSETS_DIR；已忽略本地媒体目录。
- auth/register始终403，不解析凭据、不建立/改变登录；测试夹具通过UsersService在临时库建号后走真实HTTP登录。
- 403业务code：CSRF_INVALID、SITE_OWNER_REQUIRED、SITE_OWNER_NOT_CONFIGURED、REGISTRATION_DISABLED；409为SITE_VERSION_CONFLICT。原异常过滤器已保留code。
- 所有site响应经configureApp设置no-store；请求日志沿用现有无凭据日志策略。
- 默认内容按整合者合同：HEY.、GOOD TO SEE YOU.、OH, HELLO.；真实任务项目task-manager / interaction / /tasks / /site/task-cover.png，源码与个人资料留空。
- 受控初始化：src/scripts/initialize-site-owner.ts，仅stdin JSON {account,password}，只允许55555；已有账号验证原密码，不重置；成功stdout仅UUID，失败固定无秘密提示。脚本不写.env，整合者负责写入已忽略的本地配置。
- backend/README.md补当前认证、站点模块和测试入口，修复旧TaskWriteGuard链接与“尚无登录”过时说明；后端学习注释同步关闭注册行为。

## 验证证据

- TDD先观察关闭注册测试失败：实际201/409而期望全部403；首次站点读取实际404。随后完整站点红灯8/8失败，日志 `/tmp/nest-site-red.log`。
- 初始化脚本测试先运行，因功能尚未存在退出1；随后真实子进程验证创建、重复验证、错误密码不重置、非法账号/密码拒绝、stdout仅UUID。全程独立临时MongoDB，不使用真实密码。
- 最终执行 `npm test --prefix backend`：构建成功；52项测试、5套件全部通过，0失败/跳过/取消；日志 `/tmp/nest-backend-test-final.log`。无Mongoose弃用警告。
- 站点9项真实HTTP覆盖：公开默认无写库/no-store；匿名/普通用户/缺省站主权限；原子保存与隐藏过滤、重启恢复；首次及后续同版本并发；CSRF与无副作用；非法DTO/URL拒绝；超过100KiB合法正文；精确5MiB/空上传/额外字段；实际PNG读取、伪造媒体/超限/路径穿越拒绝。
- 原认证和任务回归42项继续通过；公开注册旧成功行为替换为关闭合同，其余会话恢复、Cookie、到期、限流、故障处理、任务隔离与CRUD保留。
- `git diff --check -- backend`通过。已恢复并保留原backend/.gitignore条目，只追加.data/。

## 集成与边界

- 初始化命令先构建：`node backend/dist/scripts/initialize-site-owner.js`；或`npm run --silent site:owner:init --prefix backend`。由受控调用方通过stdin输入JSON，不把密码写入shell参数或仓库。
- 整合者已通知真实站主初始化与本地UUID绑定完成；本代理未读取或打印真实密码/连接串，未写本地.env。
- 上传图片属于本机持久文件，部署需持久卷或备份；当前无自动删除未引用图片的清理任务。上传本身不发布配置，只有保存全部后官网引用新URL。
- 文件校验按规格验证签名，未引入图像解码/重编码库；PNG完整读取已HTTP验证，JPEG/WebP签名分支已实现但本套未用独立实际文件逐一验收。
- 本报告不代表前端交互、浏览器视觉或人物动画验证；由P2–P5负责。

## 联调范围扩展：历史短账号会话（2026-11-07）

- 整合者浏览器联调发现 `/tasks` 提示“登录状态响应无效”，同样会阻碍 `/admin` 登录入口。按 systematic-debugging 追踪服务端 `AuthService.currentUser` 与前端 `parseSession` 边界：前者只检查用户存在，后者要求账号3–5位ASCII数字。
- 使用独立临时库构造有效会话，再通过测试原始集合写入历史1–2位账号。修复前真实HTTP失败：`GET /auth/session`仍返回1位账号对象，而不是可恢复登录的匿名状态。红灯日志 `/tmp/nest-legacy-session-red.log`。
- 最小修复在 `currentUser`复核当前账号合同，无效历史身份返回null；`session()`沿用现有逻辑销毁旧会话并轮换匿名Cookie/CSRF。不会重命名或删除历史账号及任务，不迁移真实数据。
- 新测试覆盖历史1位与2位账号、匿名响应、Cookie/CSRF轮换、旧Cookie401、历史用户和任务仍保留，以及同一浏览器使用新令牌成功登录站主账号。
- 最新验证 `npm test --prefix backend` 构建成功，53/53测试、5套件全部通过，0失败/跳过/取消；日志 `/tmp/nest-backend-test-legacy-fix.log`。`git diff --check`通过。该结果覆盖并替代此前52项的验证结果。
- 未读取或输出真实Session、密码、数据库连接串；浏览器重试由整合者执行。

## 独立审查修复：嵌套数组与空标签（2026-11-07）

- 审查指出 `ValidateNested({each:true})` 会递归数组，不能保证数组项是对象；隔离HTTP可提交 `projects:[[]]`、`contact.links:[[]]`并保存非法结构。
- 先新增4个独立测试库用例，覆盖项目/联系链接的空嵌套数组及包裹合法对象的嵌套数组；另补标签空串/纯空白拒绝用例。修复前5项全部失败（实际200，期望400），红灯日志 `/tmp/nest-site-array-red.log`。
- 在项目与链接列表上补 `IsObject({each:true})`，再执行嵌套字段校验；标签改为1–30字符并拒绝纯空白，空标签列表仍允许。所有失败用例验证原文档与版本不变。
- 修改限 `backend/src/site/dto/save-site.dto.ts` 与 `backend/test/site.e2e.test.mjs`。保留整合者已改的默认封面 `/site/task-cover.jpg`。
- 最新 `npm test --prefix backend` 构建成功，58/58测试、5套件全部通过，0失败/跳过/取消；日志 `/tmp/nest-backend-test-array-fix.log`。`git diff --check`通过。该结果覆盖并替代此前53项验证。
- 已向独立审查代理发送上述修改范围与日志，交其窄复核；规格标签合同由整合者同步。

## 跨端邮箱合同修复（2026-11-07）

- 前端独立审查发现标准 `isEmail` 接受 `"foo bar"@example.com`，而前端解析明确拒绝空白，可能使已保存内容无法完整加载。
- 按整合者确认的产品子集，在后端标准邮箱校验之外增加与前端相同的 `/^[^\s@]+@[^\s@]+\.[^\s@]+$/`，要求无空白、单个@、域名含点；空邮箱仍允许。
- 先HTTP红测试复现带引号空格邮箱返回200（期望400），日志 `/tmp/nest-site-email-red.log`。修复后验证400且文档/版本不变，同时普通加号邮箱与空值保存成功。
- 最新 `npm test --prefix backend` 构建通过，59/59测试、5套件全部通过，0失败/跳过/取消；日志 `/tmp/nest-backend-test-email-fix.log`。`git diff --check`通过。该结果覆盖此前58项验证。
- 修改限后端DTO、site HTTP测试与本报告；未更改前端或依赖。已通知前端审查代理针对本问题窄核，SPEC由整合者同步。
