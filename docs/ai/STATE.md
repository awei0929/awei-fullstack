# 工作区交接状态

## 2026-11-12：AI对话与记忆发布（已上线，GLM间歇繁忙）

- 用户授权提交推送部署与线上验证；功能提交`a681b28`已推送main，[43217636096](https://github.com/awei0929/awei-fullstack/actions/runs/43217636096)三个job成功，CI后端126/126、部署24/24、前端lint/build通过。本地沿用已有126/40项、两轮页面与真实GLM证据，没有为提交重复测试。
- 线上Release=`a681b281e7a530da324f1ff0e6ce51cbbe9d3d7f-43217636096-1`；持久env已配置Key且600，Nginx聊天路由无缓冲/缓存、180秒读取超时。配置均备份，现有数据库/Session/站主/媒体保留；首页与发布包一致，公共配置仍v7且逐字节未变。
- 正式HTTPS Chrome普通对话成功且刷新保留；另一会话准确召回仅在记忆面板保存的随机代号。唯一测试记忆已停用；新会话停用对照及较长回复暂因429未获得可判定成功，不能声称线上全项验收通过。官方同机诊断429/1305“当前访问量过大”，Key/base/env链接与重启已核对；未自动换付费模型或改参数。
- [发布与实际验收](tasks/006-chat-deployment.md)、[SPEC-006](../specs/006-owner-sse-chat.md)。测试历史及停用记忆保留；待供应商恢复后补验线上停用对照、长流与停止。应用实现未因排障修改，原README/STATE的其他历史改动继续留在工作区。

## 2026-11-12：真实GLM与跨会话记忆（20:18–20:19实测成功）

- 用户要求重试真实模型；使用实际项目HTTP/SSE/记忆链路、官方GLM-4.7-Flash和独立27019随机测试库，不改现有聊天/记忆、源码、配置或依赖。
- A普通请求仍429/1305；10秒后B全新会话准确答出仅存于system记忆的随机代号，12个增量、596ms；停用后C另一个新会话仅user消息，回答“未知”，1103ms。D在第二个临时库补验普通问候成功，6个增量、1234ms。成功项均completed/error=null、delta与GET持久化一致。
- 真实链路当前可用，跨会话记忆与停用对照通过；首次繁忙说明仍可能间歇失败，未验证持续稳定、正式Nginx或其他供应商。详情：[真实验收](tasks/006-real-glm-verification.md)、[SPEC-006](../specs/006-owner-sse-chat.md)。
- 两个临时库已清理，剩余测试库计数0，--rm容器/临时运行器已移除；原3000/5173与27018保留。未提交、推送或部署；没有重复此前126/40项本地测试或两轮浏览器验收。

## 2026-11-12：AI聊天设计优化与跨会话记忆（两轮本地验收完成）

- 用户明确补记忆并优化UI；沿用`c6d19ff`原工作区，无提交/推送/部署。合同：[SPEC-006 P4/P5](../specs/006-owner-sse-chat.md)。
- HEY.橄榄/奶油工作区：历史侧栏/搜索、手机抽屉、底部输入、Markdown/代码表格/复制、建议预填、上翻保持位置与返回最新。官网未保存草稿保留。
- 仅站主的Mongo长期记忆：手动添加或回复“记住”，编辑/启停/确认删除，最多20×500码点；启用项发送到本轮模型并跨会话使用。超长回复保留全文手动摘录，无自动提炼/摘要。使用见[README](../../README.md#使用长期记忆)。
- 最终后端126/126、8套件含build；前端40/40、lint/build通过；独立审查三项P2已关闭。Chrome两轮覆盖1440/768/390/320、长内容/滚动/键盘/停止/失败恢复/记忆CRUD与刷新。修复保存焦点、当前会话误停及长内容辅助节点撑祖先导致页面偏移，原路径复验外壳scrollTop0，无横溢出。
- [整合/两轮证据](tasks/006-chat-ui-memory-integration.md)、[工作区](tasks/006-chat-ui-workspace.md)、[Markdown](tasks/006-chat-ui-markdown.md)、[记忆后端](tasks/006-chat-memory-backend.md)、[审查](tasks/006-chat-ui-memory-review.md)。只用27019隔离Mongo和本地模型fixture；测试会话退出、尺寸恢复，临时服务/容器/库/媒体已清理。
- 真实Key沿用此前本地配置，本轮未读取/调用；GLM仍有此前429/1305未成功边界，正式Nginx/真机软键盘/其他浏览器未验。默认后端3000已从build期间watcher缺入口恢复，models/memories匿名401、前端5173后台200，原27018隧道保留。可在本地/admin→AI对话使用，真实模型需平台恢复后再验证。

## 2026-11-12：GLM Key本地配置（已保存，平台暂时过载）

- 用户提供Key并明确授权代为配置。已仅在被Git忽略的backend/.env写入GLM_API_KEY，权限600；保留原数据库、Session、站主及其他配置，不记录密钥值。未配置或部署服务器环境。
- 直接使用项目已构建ChatConfig/ChatCompletionsProvider与官方接口验证，合成短消息不写Mongo：首次429，诊断一次20秒超时，随后响应HTTP429/业务码1305“该模型当前访问量过大，请您稍后再试”。未收到成功的正文或DONE，不能宣称真实对话已验证。
- 原本地服务与SSH隧道未运行；已恢复nest-db隧道并启动后端3000/前端5173。后端编译0错误并成功连接；只读GET公共任务200、匿名chat/models401、后台页面200。入口http://127.0.0.1:5173/admin，站主登录后进入AI对话，待平台恢复再手动发送。
- 应用源码未修改，沿用此前114项后端/15项前端与浏览器证据，未重跑整套测试或写入测试聊天。正式Nginx/上线仍未验证，无提交/推送。

## 2026-11-12：站主后台 SSE 对话（本地已验证，未部署）

- 用户授权免费GLM-4.7-Flash，明确仅站主后台可用；已在/admin增加AI对话，支持白名单多模型、历史、流式输出、停止与错误/中断恢复。合同：[SPEC-006](../specs/006-owner-sse-chat.md)。沿用c6d19ff与原工作区，未提交、推送、部署或改真实.env。
- Nest受控POST SSE + 原生fetch兼容模型、React/MobX、Mongo独立聊天历史，复用Session/Owner/CSRF；Key仅后端，官网草稿保留。修复受理时取消/断开两项竞态，无新增运行依赖。
- 后端114/114、7套件（聊天19项，含build）通过；前端15/15、lint无告警/build通过；独立审查无可复现P1/P2，另164项分块断言通过。Chrome桌面1920/手机390已验发送/部分停止/第二模型/失败/刷新/切会话/离开/普通账号拒绝/草稿保留/无横溢出。
- [整合记录](tasks/006-chat-integration.md)、[后端](tasks/006-chat-backend.md)、[前端](tasks/006-chat-frontend.md)、[审查](tasks/006-chat-review.md)。只用27019一次性Mongo和本地模型fixture；测试账号已退出，viewport恢复，3001/5174、临时库/媒体/容器已清理，原27017/27018与数据未使用。
- 下一步用户按[README](../../README.md#站主后台-ai-对话)申请智谱“模型标准API”Key，在backend/.env填写GLM_API_KEY并重启；真实GLM与正式Nginx未验证。当前本地默认数据库连线上，真模型测试前需明确数据环境；单实例范围，不支持多实例/后台续跑。

## 2026-11-12：SSE 对话可行性分析（历史，实施见SPEC-006）

- 按用户要求直接通过飞书桌面 App 阅读[实现图解](https://my.feishu.cn/wiki/TpTMwwPX2ibMVtkaArec53aFndd)，结合 `c6d19ff` 项目源码与官方协议资料判断：现有 Nest/React/MobX/Mongo 可增量支持流式聊天、历史与取消。
- 建议首版单体 Nest + Mongo，POST + fetch 读取 SSE，复用 Cookie/CSRF；聊天模块、模型接入、流解析和生成状态待新增。Redis/MQ、多智能体、长期记忆及后台续跑不作为首版必要条件；该范围仍是建议，未实施。
- 已核对当前安装 Nest 12.3.2 的 `@Sse` 可指定 POST；前端现有 request 等待整份 JSON，需独立流入口。模型服务/额度、开放对象、后台续跑要求待定；线上代理和真实流式行为未验证。
- 证据与边界：[分析记录](tasks/sse-chat-feasibility.md)。仅桌面阅读、源码/资料核对及文档回写，未运行服务/测试、访问数据库、改业务代码或提交部署；原 README/STATE 改动保留。

## 2026-11-10：上传功能发布（已上线并验证）

- 用户授权提交推送上线。17/17源码与既有验证相同，依赖/构建配置未变；沿用本机结果，81ef221实际推送触发[42761696989](https://github.com/awei0929/awei-fullstack/actions/runs/42761696989)全绿：后端95/95/6套件、部署24/24、前端lint/build，3份构建/部署日志与发布包可下载。
- 当前上线版本81ef221c1364567c930f354ed579e002621366b8-42761696989-1；Nginx备份后设置API25m并reload，持久目录ubuntu可读写。真实Chrome上传PNG/PDF/ZIP/2MiB文本与正文图片/附件，共6文件；匿名GET均200、SHA256一致、UTF-8中文下载名保留，正文图片64×64正常，Chrome实际PDF下载成功。
- 同版本受限入口重启后6文件仍可读、哈希不变。正文只在草稿预览后恢复，公开配置逐字节保持v7，原账号/env/Mongo/媒体保留。用户确认的临时浏览器本地文件权限已关闭。线上保存PUT/真机/多浏览器/精确最大边界未新增实操；六份公开合成验收文件保留，无自动清理。
- 合同/证据：[SPEC-004](../specs/004-disk-file-uploads.md)、[线上发布](tasks/004-disk-uploads-deployment.md)。发布代码与相关文档已提交推送，后续文档回写跳过重复CI；此前其他部署/飞书/数据库笔记仍保留在工作区，不对线上运行测试套件。

## 2026-11-10：自动构建部署（已接入并验证）

- 用户授权代为接入 main 推送后自动部署并交接步骤；合同/清单：[SPEC-005](../specs/005-automatic-deployment.md)，使用方式：[部署手册](../deployment.md)。基准9b12524，现有SPEC-004业务/文档改动保留且不纳入本次发布。
- production仅允许main，部署私钥仅环境Secret，连接Variables已设；用户完成腾讯云MFA并确认受限公钥。原隧道密钥、真实env/Mongo/媒体保留。发布根/srv/nest，systemd与Nginx共用current版本；首次bootstrap权限失败实际恢复旧站，修复重试成功。
- 当轮main推送d0c5ef6触发[42756174781](https://github.com/awei0929/awei-fullstack/actions/runs/42756174781)全成功：Node24.22.2、部署测试24/24、后端76/76与5套件、前端lint/build；3份构建/部署日志及发布包归档可下载。该轮成功版本d0c5ef6a96b09b584b6a9e2324c3a9f6b1bb42c6-42756174781-1，首页与归档逐字节一致、3资源/后台入口/API均HTTPS200；最新上传发布见上方。
- 已验证构建失败不发布、受限命令拒绝、手动回退当前bootstrap的幂等入口；不同目标回退/恶意输入/故障恢复/并发为隔离测试，未冒充线上故障注入。首次SSH上传约6分24秒、依赖安装3秒；CI Mongo有官方临时rseq兼容项。文档回写不改变已验证应用/依赖/工作流，沿用本次结果。
- 当轮仅发布自动部署配置，SPEC-004由用户后续追加授权发布，结果见上方。证据：[整合](tasks/005-deployment-integration.md)、[运行器](tasks/005-deploy-runtime.md)、[工作流](tasks/005-deploy-workflow.md)、[审查](tasks/005-deployment-review.md)。日常提交后推main并查看Actions；回退按部署手册，不自行发布其他未提交功能。

## 2026-11-09：服务器磁盘文件上传（本机已验证，未部署）

- 用户授权图片、PDF、附件上传并告知流程；已确认全公开、仅站主可上传。沿用9b12524及当前分支，保留原README/STATE改动，无提交、推送、部署或真实env改动。合同：[SPEC-004](../specs/004-disk-file-uploads.md)。
- 新POST `/api/site/file-assets`复用Session/Owner/CSRF；图片5MiB、PDF/ZIP/TXT/DOCX/XLSX/PPTX附件20MiB，UUID写盘到SITE_ASSETS_DIR，附件保留安全原下载名并强制下载。旧音频和历史媒体兼容；后台统一上传、封面、公司/项目Markdown入口，上传仅改草稿，文件立即可公开访问。无COS、自动清理或私密下载。
- 后端最终95/95、6套件含build；前端实际模块68/68、Markdown SSR5/5、lint无警告/build通过；独立审查1项P2已修，限定复核58项通过。根Chrome156桌面1440/手机390实际上传/错误重试/中文下载/草稿/保存v3刷新/公开图片及附件/忙状态/10000字保留/重建应用后媒体持久化通过。证据：[整合](tasks/004-disk-uploads-integration.md)、[后端](tasks/004-disk-uploads-backend.md)、[前端](tasks/004-disk-uploads-frontend.md)、[审查](tasks/004-disk-uploads-review.md)。
- 全程测试显式使用原本机Mongo127.0.0.1:27017及随机临时库/媒体，未沿真实backend/.env连接线上。4个明确归属的浏览器fixture库、临时媒体/Cookie/样例/缓存已清理；3001/5174已停，原本机与线上业务数据保留，无截图。
- 下一步按[README接入流程](../../README.md#图片pdf与附件上传接入)发布：确认服务器持久目录与ubuntu读写、已有/api/代理加25m、构建/同步前端并重启后端，再做线上上传验证。服务器配置/HTTPS上传未在本轮实操，真机/多浏览器/断电边界未扩大声明。

## 2026-11-08：个人官网提交交接

- 用户授权提交当前工作区：个人官网、唯一站主后台、能力三卡与履历详情、运行素材、规格与交接文档，以及文档图片清理规则；沿用当前`main`分支，不推送或部署。
- 沿用下方P28记录的后端76/76、前端lint/build与Chrome验收结果；本次仅核对记录对应关系、Git范围与敏感文件，不重复开发验收。真实环境文件、上传媒体、依赖目录及文档截图不纳入提交。
- P28记录的8个SHA256全部匹配；依赖与相关配置未发现验证后变化。敏感文件检查仅命中环境模板的占位连接串，`git diff --check`通过。
- 本次重新核对8个SHA256全部匹配，205个候选文件未发现真实凭据或应排除文件；沿用既有验证。暂存检查另报告3处文档末尾空行与Docker SVG的1处行尾空白，属于格式告警，本次保留原文件内容与素材校验值。
- 本次用户再次授权提交，Git元数据已可写，`git add -A`成功；提交范围为上述已完成工作，提交说明为`feat: 实现个人官网与站主管理后台`。站主真实公司/项目内容与此前未实操的兼容边界仍按下方记录保留；不推送或部署。

## 2026-11-08：文档图片清理与验收规则调整

- 用户要求清理历史图片、不再做图片对比；清理`docs/designs/personal-site/`的7张设计稿与66张验收截图（含PNG/JPG），合计17,552,279字节，约16.74 MiB。保留文字设计、素材提示词、原有验证记录和边界；下方旧图片文件名仅作历史记录，对应文件已删除，不要求恢复。
- 通用规则集中在[AGENT](../../AGENT.md#验收证据与图片管理)，SPEC规范/模板及SPEC-003同步引用或更新：默认不生成/保存设计对比图、验收截图、录屏或视觉快照，不做图片对比；仍按范围做必要浏览器交互/布局验收，用文字记录环境、步骤、DOM数据与实际结果。排障截图只用临时目录，不入Git。
- 根`.gitignore`新增文档图片与evidence目录忽略规则，移除失效图片链接并同步素材来源说明；`frontend/public/`运行素材、应用代码、数据库与开发服务未变。
- 本轮检查通过：docs图片剩余0；52份运行资源清理前后SHA256一致；修改文档的125个本地链接目标存在；73个旧图片路径均命中忽略规则，运行图片不受影响；`git diff --check`通过。独立只读复核未发现遗留有效截图要求或失效图片链接。
- 基准82acde8，保留原有大量未提交改动；开始核对时这些图片均未跟踪，本地所有可见引用的提交历史中也没有`docs/designs/`，无需改写Git历史。仅做文档与文件清理检查，不重复lint/build/HTTP/浏览器验收；未提交/推送/部署。


## 当前任务：P28能力三卡与履历详情（已验证，2026-11-08）

- 用户要求将四技术分类卡改为技术栈/公司背景/公司项目三卡；已实现960px技术四区、公司三目录与项目内切换、安全Markdown、手机全屏。后台技术配置保留，新增公司/项目配置、增删排序/隐藏/封面URL/MD预览及实时iframe弹窗。
- 新capabilityDetails沿用Mongo整站CAS、Session/Owner/CSRF；GET旧分区只读补默认，PUT必填防静默清空；公开服务端剔除隐藏项目。旧独立作品档案/顶层projects/图片上传仍不恢复。真实v6公司与项目为空，未伪造或保存示例经历。
- 本轮后端TDD定向8先红→绿、完整76/76/5套件含build通过；前端最终lint/build通过，实际API19/编辑器8/保存定位4模拟通过。Chrome1440/1920、390/320公开/后台/iframe及隔离fixture UI保存v2与刷新持久化通过；独立审查两个P2已修复关闭，无未关闭阻塞。
- 详细范围/结果/边界见[SPEC-003 P28](../specs/003-personal-site.md)与[整合](tasks/003-capability-details-integration.md)/[后端](tasks/003-capability-details-backend.md)/[配置](tasks/003-capability-details-admin.md)/[审查](tasks/003-capability-details-review.md)。截图evidence/capability-three-cards-v13.jpg、capability-technology-dialog-v13.jpg。
- OS reduce/真机touch软键盘/多浏览器/浏览器断网与409未实操，不扩大声明。根恢复起始缺失的3000开发watch；5173保留。浏览器留正式能力页、viewport reset已调用；测试登录已退出，同host端口Cookie不保证保留原站主登录状态。fixture库/隔离媒体/缓存已清理，3001/5174已停，3000/5173保留。
- 基准82acde8，大量既有未提交改动保留，本轮快照/tmp/nest-capability-details-before；未提交/推送/部署/换分支/worktree。下一步是站主自行填真实公司背景与项目Markdown。


## 2026-11-08：后端停止与502排查

- 13:59实际复现：首页5173为200，代理API为502，3000无监听且直连失败。证据指向旧聊天执行会话于00:24关闭，其托管的后端开发命令同时被工具标记失败结束；关闭触发方与具体信号未知，不能归因为业务崩溃或某人关闭窗口。
- 并行P28聊天于14:03重新执行原开发命令，本排查聊天未启动/重启；本轮直连3000公开统计/官网与5173代理官网均200，官网仍v6。仅新增诊断记录、更新本节，未改应用/真实配置、未跑全量构建测试、未提交推送；不覆盖P28验证状态。证据与边界见[排查记录](tasks/003-backend-stop-diagnosis.md)。

## 当前任务：P27默认动效与欢迎场景恢复（已验证，2026-11-07）

- 用户要求动效默认开/隐藏按钮，指出初次见面不动。已删除公开开关及首页/首载两处site-motion-off旧偏好覆盖；仍尊重后台appearance.motion与系统reduce，音乐独立。P26的Switch合同被本轮覆盖。
- 确认P26收掉柔光/星芒循环导致静置不明显；现恢复受控柔光与星芒内层循环、欢迎人物内层6秒/5px轻呼吸，不虚称真实挥手。新循环仅欢迎空闲端点运行，弹窗/首载/切场/隐藏/reduce暂停或静止，不碰850ms时钟与三环。
- 本轮实际TSX/函数模拟先红1/10→绿10/10，lint/build通过；Chrome桌面人物/星芒矩阵变化、关于暂停/Esc恢复、切场暂停、刷新开场、390手机无开关/无横溢出与后台iframerunning均已确认。独立[审查](tasks/003-welcome-motion-review.md)无P0/P1/P2。详见[SPEC-003 P27](../specs/003-personal-site.md)。
- 真实v6/保存disabled未改，未保存/退出/上传；未提交/推送/部署/换分支/worktree。基准82acde8，源快照/tmp/nest-welcome-motion-before；3000/5173继续运行。截图welcome-motion-*-v12.jpg为390实际首屏；viewport reset已调用但最终读值仍390×844，不声称恢复正常尺寸。OS reduce/真实隐藏/其它浏览器仍是未实操边界。

## 当前任务：P26温暖工作室视觉精修（已验证，2026-11-07）

- 按用户完整风格与参考图，在现有HEY./左文右人物/同人双幕上精修：深橄榄工作室环境、暖奶油金主按钮/深绿圆箭头、极简动效Switch、细导航下划线、能力14px/轻实底。人物/三环/850ms可逆时钟及P24/P25合同保留；没有虚构资料或恢复档案。
- 新增内置imagegen环境WebP1672/768两版共约37KiB；原图来源和最终提示词在frontend/public/site/ASSETS.md。手机因14px双列断词改卡内单列，四组横卡与名单滚动保留。
- 最终前端lint/build通过；Chrome原窗口/1440桌面/390及320公开、后台1440×900/390×844 iframe通过本轮布局与关键交互。正向/反向/中途反向有真实中间帧；用户指出转场消失时已定位为验收临时关闭动效，已恢复on。独立审查reduce箭头瞬移P2已修，无未关闭阻塞。
- 用户真实v6未保存/上传/退出；后端未改不重复HTTP。真实OS reduce/多浏览器/手机touch/长40字和12项新浏览器重造未执行，详见[SPEC-003 P26](../specs/003-personal-site.md)、[整合](tasks/003-warm-studio-integration.md)、[审查](tasks/003-warm-studio-review.md)。截图evidence/warm-studio-*-v11.jpg。
- 基准82acde8，保留既有未提交改动，本次基线/tmp/nest-warm-studio-before。未提交/推送/部署/换分支/worktree。3000/5173保留运行，浏览器留初次见面且动效on，viewport已调用reset。

## 当前任务：P25后台预览布局修复（已验证，2026-11-07）

- 用户指出预览黑边、内部滚条、标题断行和右卡片裁切。已用同源独立iframe与草稿消息替换嵌套div，桌面至少1440×900/手机390×844完整等比适配；外框精确包住画布，CSS/JS读取自己的viewport。保留P24移除档案、能力配置/彩色SVG及三环/850ms转场。
- Chrome1889/1440/1280桌面与390/320后台已验无整页横溢出；桌面标题一行、四卡完整、无内部双滚条/单侧黑边。连续输入/清空昵称同步且场景保持，设备切换、手机菜单、关于/Esc、独立入口等待及公开1440/390回归通过。
- 前端lint/build（含TS）通过，模块36/36+TSX生命周期模拟14/14；独立审查无P0/P1/P2。后端未改，不重复其HTTP检查；真实手机、多浏览器、OS reduce与真实409浏览器本轮未扩大覆盖。合同/证据见[SPEC-003 P25](../specs/003-personal-site.md)、[整合](tasks/003-preview-layout-integration.md)、[诊断](tasks/003-preview-layout-diagnosis.md)、[实现](tasks/003-preview-layout-implementation.md)、[审查](tasks/003-preview-layout-review.md)。
- 所有编辑测试仅随机临时Mongo；3001/5174已停止，两次fixture库/媒体均清理且0残留。真实API仍v6、保存disabled，用户登录保留；3000/5173继续运行。viewport已reset，实际能力预览保留，截图evidence/preview-fixed-final-v10.jpg。
- 基准82acde8；保留全工作区既有改动，无提交/推送/部署/换分支/worktree，未写开发配置。P24作品档案移除仍是有效合同。

## 上一任务：P24作品档案整体移除（已验证，2026-11-07）

- 用户要求整体移除作品档案及站主对应配置；最新合同与AC见[SPEC-003 P24](../specs/003-personal-site.md#p24作品档案整体移除最新合同2026-11-07)，覆盖下方保留档案的旧任务记录。
- 已移除公开档案导航/区块/详情/query、站主作品分区/所有编辑/封面上传、前后端projects合同；首页探索改为我的能力。旧Mongo读取只剔除响应，正常保存替换content；图片POST404，音频与历史媒体GET保留，/tasks不变。
- 三路报告：[后端](tasks/003-remove-archive-backend.md)、[后台与共享合同](tasks/003-remove-archive-admin.md)、[公开页](tasks/003-remove-archive-public.md)，[整合](tasks/003-remove-archive-integration.md)、[独立审查](tasks/003-remove-archive-review.md)。
- 基准82acde8，保留原大量未提交工作；本轮未提交/推送/部署/换分支/worktree，不写开发数据库或删除历史上传文件。代码快照`/tmp/nest-remove-archive-before`区分本次差异。
- 后端本轮70/70、5套件通过（含build），先红5条后实现；前端最终lint/build通过，API21/store17定向模拟通过。Chrome1920/390/320公开/后台只读确认无档案/无横溢出、旧query普通首页、关于/联系与回焦、主按钮/键盘跳能力及反向端点、后台五分区/音乐/预览。独立审查无P0/P1/P2；截图evidence/remove-archive-*.png。
- 开发API实读仍v6；本轮没有保存真实配置、上传或退出用户会话。失败重试仅源码/API-store模拟，未做浏览器断网注入；真机/多浏览器/OS reduce等边界未扩大。前端5173、后端3000保留，浏览器viewport已reset。
- P24冻结验收之后，外部聊天「配置我的能力分类」开始iframe预览重构，改动admin/index、admin/style、site/style及新增预览文件；已保留，文件落盘后根重新build通过。P24后台截图/19文件hash对应该预览重构之前，后续iframe/路由/视觉由该任务继续验收，不覆盖本轮删除合同；详见整合报告。

## 历史交接（P24前，仅供背景）

- 更新时间：2026-11-07（Asia/Shanghai）；代码基准82acde8，当前未提交工作区。
- 当前任务：[SPEC-003](../specs/003-personal-site.md)个人官网与唯一站主配置。首版至第四轮增量已验证；第五轮连续双场景已实现并通过Chrome桌面/手机尺寸验收（其它兼容边界见末节）：首载完整开场、移除跳过/页脚按钮、独立登录提示、背景音乐及音源配置，第一条参考的Splash Cursor柔雾流体背景已接入。档案揭幕仍仅建议，未混入本轮。
- 保留根AGENT.md用户既有规则。此前6680afe、82acde8已推送main；本任务没有提交、推送、换分支、worktree、部署或清库。

## 当前实现

- `/`：橄榄人物舞台、作品档案、分类和阅读面板、关于/联系、手机简化、系统和手动减弱动效。静帧人物不含连续肢体/眼神表演。
- 新增：首页站主入口→舞台内登录面板→`/admin`；手机菜单同入口，后台预览禁用登录。HEY.写完+停留后显影，正常4100ms；首载等待数据与图片、硬刷新重播、同App返回不重复，保留Esc、无跳过/页脚重看按钮；桌面滚动景深、纸页悬停/展开、柔光与鼠标流体。
- `/admin`：真实API配置、全站草稿、上传、原子保存、版本冲突、未保存预览、权限/过期边界。`/tasks`保留原任务演示。
- 技术栈不变：React/MobX/Ant Design/Less Modules + NestJS/MongoDB，路由懒加载，无新增Three/GSAP/视频依赖。
- 唯一站主55555已受控初始化，UUID只在本地忽略backend/.env；服务端Session+Owner+CSRF，缺owner配置拒绝所有管理请求，公开注册API403。密码不入仓库/日志/测试。
- 图片PNG/JPEG/WebP限5MiB，音乐MP3/WAV/OGG限15MiB，实际容器/文件头验证，保存在ignored backend/.data/site-assets；全站version比较原子保存，隐藏项目不公开。
- 真实配置当前v6（用户保存）：前端能力为React/Vite/TypeScript；标题OH,/HELLO.、默认展示名HEY.、真实任务项目及已上传截图。个人简介/联系待填写；音乐disabled/空音源/音量25/循环true，临时QA文案与音源引用已清空。

## 验证与证据

- 后端第一版最终 `npm test --prefix backend`：59/59、5套件、0失败/跳过/取消，含构建。该记录为历史；第四轮音乐变更后的67/67结果见下方。日志 `/tmp/nest-backend-test-email-fix.log`。
- 第二轮最终重新执行前端lint/build均退出0，含TypeScript，无大块警告；前端无test脚本。临时Node生命周期断言intro19/19、login13/13是模拟证据，不冒充浏览器。
- 第一版真实浏览器：站主登录、保存v1、跨窗口409保留输入/载入最新、JPEG上传保存v2/刷新持久化，桌面/390×844手机配置与公开页、分类空态、详情返回、预览连续输入/单独换图同步；临时输入已恢复。
- 第二轮真实浏览器：开场自动结束/skip/Esc/重播/会话一次、手动关闭动效、桌面滚动进度、作品返回；首页登录错误/成功及滚动锁清理，手机菜单/登录布局无溢出。重播焦点P2已修复并验证：结束后首屏logo，下一Tab不跳回页脚。
- 后端、前端与增量动效独立审查均已关闭阻塞。系统OS减少动画、手机软键盘、真实隐藏标签暂停及断网/401浏览器注入未实操；源码、HTTP、模拟与浏览器证据在SPEC分别记录。
- 历史截图已按上方清理记录删除；第一版及第二轮的浏览器操作结果与未验证边界保留在本节和对应SPEC/任务报告中。

## 分工与后续

- [整合](tasks/003-integration.md)、[后端](tasks/003-backend.md)、[公开页](tasks/003-public.md)、[配置](tasks/003-admin.md)、[动效](tasks/003-motion.md)、[登录面板](tasks/003-login-panel.md)、[开场](tasks/003-intro.md)。
- [后端审查](tasks/003-backend-review.md)、[前端审查](tasks/003-frontend-review.md)、[动效增量审查](tasks/003-motion-review.md)。
- 已观看[七的三次方视差视频](https://www.douyin.com/video/7686420711983942964)的演示与制作关键画面：三关键帧→两视频→滚动控制揭幕。建议下一轮优先橙色档案掀开露出作品，详细观察/素材边界见SPEC的P10；不是已实现功能。
- 人物连续动作素材、真实个人介绍/联系待补。用户此前已决定先页面后台、动作后补，不再重复索要密码或自行启用付费视频生成。
- 本地前端5173、后端3000；预览保留首页。测试结束主动退出站主会话，可从首页登录。媒体需与MongoDB一起备份，未保存引用上传目前无自动清理。
- 旧独立浮岛原型已移废纸篓、4177停止；保留原参考照片，不恢复旧方案。两个既有OpenSpec引用未归档。

## 2026-11-07：Unslop 检查

按用户要求安装用户级 `~/.codex/skills/unslop`，完成当前官网桌面/手机实际页面与独立源码审查；[总报告](tasks/003-unslop-audit.md)、[源码报告](tasks/003-unslop-code-review.md)。结论是保留现有橄榄舞台/人物/档案并局部精修，优先按钮对比度、手机小字、重复文案。此次仅安装和检查，建议未实施；未修改产品代码或配置数据，未重跑构建/HTTP，不覆盖上方其它任务的验证记录。


## 当前第三轮增量（已验证）

- P11：intro代理将原重叠时序改为2110ms收笔→740ms完整停留→350ms文字淡出→900ms玻璃显影，总4100ms。已按最新要求移除“跳过开场”按钮，dialog自身接焦点，读屏说明改为自动进入。
- P12：第一条视频约27秒已实际核对为React Bits Splash Cursor，采用官方WebGL流体本地适配，暖金/灰绿背景图层，手机/关闭/隐藏时停止，不模糊或遮挡人物文字。fluid代理只写components/site-fluid；根集成site与浏览器，未引新包。
- 最终增量独立审查无P0/P1/P2；前端lint/build通过。桌面/手机完整签名无skip、自然结束、鼠标实际像素、停止/关闭/登录时隐藏、离屏回收1×1及回首屏恢复已实测。系统reduce/硬件故障/隐藏标签仅源码与模拟证据。此前后端59/59不受影响，未重跑。

## Unslop 三项精修已完成

- 用户授权的按钮对比度、手机字号、重复文案/双标点已修正；本轮只改公开页 `index.tsx` 和 `style.module.less`，保留橄榄舞台、人物及动效实现。
- 最终lint/build通过；浏览器桌面1280×720、手机390×844/320×740验证正文14px/标签12px、阅读返回/关于、无横向溢出；按钮四端点最低4.8936:1。独立审查两处字号遗漏已关闭。多项目与后台预览仅源码验证。
- [交接与截图](tasks/003-unslop-polish.md)、[独立审查](tasks/003-unslop-polish-review.md)。记录两份精修文件哈希；开场浏览器检查后P11继续变化，最新动效验收仍由上方第三轮任务负责，不把本轮结果扩展到并发新动效。
- 交付核对时P12已往公开页集成SiteFluidBackground；精修文案保留、样式哈希未变。此次截图/构建记录对应该集成前的精修验收版本，新背景由P12–P13续验。

- 第三轮报告：[流体实现](tasks/003-fluid.md)、[增量审查](tasks/003-fluid-review.md)、[开场](tasks/003-intro.md)。完整开场与流体过程截图见evidence/home-intro-complete-v3.jpg、home-fluid-desktop-v3.jpg；已保留首页预览。第三轮已完成；最新第四轮结果见下方。


## 当前第四轮增量（已验证）

- 首载：App提前显示开场，懒加载首页与主图decode就绪且文字停留结束才显影；8秒资源降级/12秒可见时间保险，错误可重载。硬刷新完整播放，站内返回不重复；详情query不抢开场dialog。
- 提示与控件：奶油色独立SiteTip复用于登录和音乐，登录红框移除且输入框不位移；页脚重看/回首页两按钮删除。视觉动效与音乐各用明确文字开关。613px鼠标窗口流体已实测可用。
- 音乐：后台外观区支持URL/15MiB音频上传、名称、音量、循环与启用，上传仅改草稿。沿用Session/Owner/CSRF与版本保存；无配置不显示播放器，主动点击才创建Audio。离页/换源/禁用清理，错误使用tips、弹窗期间延后展示。
- 最终后端67/67、5套件通过（含build），日志/tmp/nest-backend-music-final.log；前端lint/build退出0且无lint警告，无新依赖。独立审查P2已关闭；实际模块模拟入口37、登录33、播放器/tip34、API解析23均通过，不能替代浏览器/真实网络覆盖。
- 浏览器已验：首载/完整签名/自然显影、about深链顺序、613px流体、登录空/错误/重复提示/成功、测试WAV上传草稿/保存/播放/暂停、失败提示、手机无横向溢出。临时音乐v3/v4已恢复为空v5，刷新确认，已退出站主会话。系统reduce、真实慢网/隐藏标签仅源码/模拟证据。
- Vite热更新期间一次动态模块加载失败，重启原开发服务后恢复；不伪称为生产加载故障复现。前端5173、后端3000继续运行，最终保留官网预览。未提交、推送、部署。
- [首载报告](tasks/003-cold-entry.md)、[提示报告](tasks/003-login-tips.md)、[音乐配置](tasks/003-music-config.md)、[独立增量审查](tasks/003-entry-tips-player-review.md)。当前截图：evidence/home-intro-v4.jpg、home-login-tip-v4.jpg、admin-music-v4.jpg。后续待用户正式音源、个人介绍/联系与人物动作素材。

## 当前第五轮：双场景规范（已实现，Chrome验收通过）

- [SPEC-003 P18](../specs/003-personal-site.md)：同一首页舞台欢迎/能力，共享1900ms可逆时钟、重复操作锁、端点状态与焦点、系统/手动减弱动效、手机横向技术卡片。新桌前MacBook透明WebP双分辨率预decode，8秒错误降级，9个本地技术SVG；作品档案/旧人物/后台配置保留。
- 最终lint/build通过（`/tmp/nest-capability-final.log`）；真实hook47及页面39定向模拟通过，无新增前端test脚本或依赖。未改后端，未重跑HTTP。
- Chrome1440/768/390/320两场景、正反/快速点击/卡片/键盘/手动reduce通过。修复HMR状态帧不一致、舞台内部滚动、平板低头位、手机文案遮挡/隐藏滚条及320整页横溢出。8张截图`evidence/capability-*-v5.png`；[独立审查/浏览器记录](tasks/003-capability-review.md)、[整合](tasks/003-capability-integration.md)。
- Safari原生工具连接超时，Firefox/Edge/真实手机触摸/OS reduce/慢网断图/真实后台预览未实操，源码/模拟不冒充浏览器；兼容补验边界详见SPEC。Chrome预览留首页，动效开启；临时viewport已请求reset。
- 保留所有已有未提交工作，无提交/推送/部署或数据库写入。后续为上述兼容补验及原先个人资料/正式音源待补，不自行启动新功能。

## P20 光圈动效修正（2026-11-07）
- 已补能力人物椭圆轨道的18秒光点/金色尾迹循环，外层保留原可逆转场；手动/系统reduce静止，切场/弹窗/离开首页/隐藏标签暂停。未改并行P19配置或数据库。
- Chrome实际采样移动、手动off、弹窗暂停、离屏/反向暂停及回来恢复通过；lint/build与共享时钟47断言通过，独立小范围审查无阻塞。图`evidence/capability-orbit-flow-v6.png`，详情SPEC P20；OS reduce/真实隐藏仅源码。Chrome留能力页、动效开，未提交/推送。

## P19 我的能力配置（已实现并验证）

- 最新用户任务：AI/前端/后端/部署四类能力由站主配置，后台四Tab、SVG+名称Select、自定义昵称与排序/删除；公开保留人物和四卡片。合同与实施清单在SPEC-003 P19。
- 图标38可选项+原openai兼容文件共39SVG；后续官方/品牌色增量后约296KiB，来源/固定版本/许可/SHA256见frontend/public/site/tech/SOURCES.md/json；39/39静态验证通过。
- 后端能力合同与兼容已接入，最终真实HTTP72/72、5套件通过，日志/tmp/nest-backend-capabilities-final.log；最终前端lint/build通过，日志/tmp/nest-capability-config-frontend-final.log。API模块22/22、UI模块18/18、保存定位7/7模拟通过，不冒充浏览器。
- Chrome桌面1318、390/320尺寸已验四Tab/搜索/添加/改图标保留昵称/连续预览/跨Tab/排序/删空/保存及公开同步、12项和40字昵称、409保留草稿；后台/公开无横溢出，名单可局部键盘滚到末项。
- 独立审查两个P2已修复复验关闭：隐藏无效昵称保存自动切分类并聚焦（含手机预览回编辑），纵向列表允许水平滚动链给外层横卡。真机touch、软键盘、多浏览器/断网注入未实操，边界见SPEC。
- 所有浏览器测试写入使用localhost:5174/3001独立临时Mongo库，已退出测试会话、停临时服务、清理审计无残留fixture；开发配置仍v5九项。原开发watcher中断后已恢复3000/5173，正式能力页图标全加载并保留预览，动效开。未提交/推送/部署。
- 报告：[图标](tasks/003-capability-icons.md)、[后端](tasks/003-capability-config-backend.md)、[前端](tasks/003-capability-config-frontend.md)、[根整合](tasks/003-capability-config-integration.md)、[审查](tasks/003-capability-config-review.md)。截图evidence/*capabilities*-v7.jpg；后续可从/admin→我的能力维护自己的列表。

### P19后续：导入错误与官方图标（已处理）

- 复现悬空use-orbit-card-windows引用造成TS2307/Vite500；并行P21模块先补齐，后重构为use-orbit-occlusion，当前导入均存在、TS/lint/build通过，模块HTTP200。根未覆盖光圈改动。
- 13SVG（12可选+openai兼容）更新官方来源，含当前九项及Vue/ChatGPT/Cursor；其它26保留开源且明确区分。Codex采用OpenAI官方Blossom fallback，不虚称独立Codex图标。源码path/来源/许可/哈希详见SOURCES和图标报告。
- 官网和Select取消白色滤镜、保留原色并加浅底。39静态SVG与HTTP均通过；Chrome后台四Tab/Select及公开九图已加载、无错误遮罩。仅只读用户v6，未改数据或退出其会话；截图official-svg-admin-v8.jpg，构建日志/tmp/nest-official-svg-final-build.log，独立[复审](tasks/003-capability-official-svg-review.md)通过。未提交/推送/部署。
- 用户继续反馈没有颜色：21项已补齐固定版本原色SVG或可核实的品牌hex，现30项品牌色+8项黑白表示。原13官方文件哈希保持，39SVG共302532B；来源和独立复审已同步。最终build/TS通过（/tmp/nest-brand-colors-final-build.log），沿用未变样式的lint；39SVG与模块HTTP200。Chrome选择器彩色效果、56图加载/filter none/无overlay已验，保存按钮仍disabled，本轮未写用户v6。截图brand-colors-admin-v9.jpg。

## P21–P23 光环与转场迭代（已交付）
- 用户最新要求已覆盖P18/P20旧表现：三条1/.82/.6724等比光环缓慢旋转（无光点尾迹），SVG收紧至最大旋转包络；仅可见人物遮光，卡片及展开说明区域透光，局部坐标遮罩由use-orbit-occlusion管理。保留并行P19配置工作。
- 转场1900→850ms，导航/场景按钮点击即按targetScene选中；未decode不阻塞切换、显示原人物降级；中途可在同一时间轴逆向，重复同目标忽略，卡片端点后才可交互。
- 最终lint/build通过，最新时钟86+遮罩几何37定向断言通过，独立小范围审查无阻塞。Chrome确认active=page时busy=true/settled=0、快速逆向、桌面/768三环/遮罩/部署展开/动效关闭；图evidence/capability-three-rings-fast-v8.png。真机/其它浏览器/OS reduce边界未扩大，详见SPEC最终记录。
- Chrome留我的能力、动效开，viewport已reset。未提交/推送/部署，P19其它任务状态仍按其独立记录。
