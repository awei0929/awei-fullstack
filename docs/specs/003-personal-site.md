# SPEC-003：个人官网与站主配置

> 2026-11-09：用户新要求的图片、PDF与附件上传由 [SPEC-004](004-disk-file-uploads.md) 约定；其生效后替代本文 P24/P28「不提供新图片上传」的限制。独立作品档案仍不恢复，旧图片 POST 仍为404。

- 状态：P28能力三卡与详情已验证；P27默认动效与欢迎场景恢复、P26温暖工作室视觉精修、P25后台预览布局修复、P24作品档案移除已验证；旧合同被明确覆盖的部分仅为历史；2026-11-07。
- 用户授权：先实现页面和后台，人物动作后补；多Agent协作。唯一站主账号`55555`，关闭公开注册。密码不进源码、文档或日志。
- 基准82acde8。保留原有未提交工作，不提交/推送/换分支/worktree/部署；认证Session、任务隔离、CSRF沿用[SPEC-001](001-session-auth.md)，关闭注册以本规格为准。

> 2026-11-08验收方式调整：历史设计稿和验收图片已清理，下面旧文件名仅作历史记录，不再作为验收材料或要求恢复；保留原有文字验证及未验证边界。后续按 [AGENT](../../AGENT.md#验收证据与图片管理) 记录实际操作、布局数据与结果，不做图片对比。

## P28：能力三卡与可配置履历弹窗（2026-11-08，已验证）

本节是最新合同，替代P19/P26的公开四技术卡布局；P24移除独立作品档案仍有效。新增公司项目仅属于「我的能力」详情，不恢复作品导航、旧projects字段或旧封面上传接口。用户已给出三卡和弹窗方案，按AGENT直接细化实施，无额外批准环节。

### 目标与设计

- 舞台保留人物、温暖橄榄背景、850ms可逆切场与三环，入口改为三张：技术栈 / AI 全栈开发，公司背景 / 业务与成长，公司项目 / 工程实践。三卡各有介绍、线性图标和明确进入箭头，金/绿/淡紫作克制区分。
- 技术栈详情桌面最大960px：上方技术介绍，下方前端开发/后端服务/AI开发工具/部署工程四区，继续展示原capabilities的SVG、昵称和顺序以及分类说明，不重置站主已有配置。
- 公司背景：左目录「公司简介 / 核心业务 / 岗位职责」，右侧安全Markdown；公司项目：左项目目录、右封面/名称/简介/Markdown正文，首个可见项目默认选中，切换不关闭弹窗。正文可用标题组织业务背景、负责模块、技术栈、难点、贡献。
- 详情使用独立原生dialog复用现有关闭/历史/回焦流程，背景降低亮度并模糊；从点击卡片方向轻微缩放进入，遵守appearance.motion与系统reduce。关闭按钮/Esc/浏览器返回均可返回；弹窗期间暂停舞台动效。手机详情全屏、目录横向滚动、正文独立可读，无整页横溢出。
- 公司和项目为空显示真实空态，不添加虚构经历。Markdown支持标题、列表、链接、表格、代码块与图片；不执行原始HTML，链接/图片限制安全URL，长代码与表格只在局部滚动，图片失败有提示。

### 数据、权限与兼容

`SiteContent.capabilities`不变，新增`capabilityDetails`：

```ts
{
  technology: { introduction: string }, // 最多2000字，纯文本
  company: {
    name: string, // 最多80字，可空
    summary: string, // 最多300字，可空，供入口与正文简介
    introduction: string, business: string, responsibilities: string // 各10000字Markdown，可空
  },
  projects: Array<{
    id: string, // 1–64个ASCII字母、数字、下划线或连字符，分区内唯一
    name: string, // 1–80字，拒绝纯空白
    summary: string, // 最多300字
    content: string, // 最多20000字Markdown
    coverUrl: string, // 空或安全HTTP(S)，或约定本站uuid.png/jpg/webp图片路径，最多2048字符
    visible: boolean
  }> // 最多12项，顺序即目录顺序
}
```

- 只在整个分区缺失时只读补默认：技术介绍为通用能力描述，公司全空、项目空；显式null/部分对象/未知字段/错误类型拒绝，不写数据库或改变version。旧capabilities原值保留。
- GET `/api/site`只返回visible=true的公司项目，隐藏正文/名称/封面均不可泄漏；GET/PUT `/api/site/config`保留完整配置。仍采用原Session/Owner/CSRF与整站version原子保存，失败/409保留草稿。
- 新分区为PUT必填字段；旧客户端省略返回400并提示重载，避免将已经保存的履历静默清空。只读旧文档仍补默认。旧顶层projects仍400。现有2MiB请求体上限足以覆盖本次上限，不新增接口，不抓取图片、不恢复图片上传。
- 站主「我的能力」里保留技术栈四分类编辑，新增技术介绍/公司背景/公司项目编辑入口，项目支持新增/删除/上下排序/公开开关、封面URL、Markdown编辑与预览；示例结构仅用户主动插入草稿，不默认发布。iframe连续草稿同步，预览保留隐藏项目编辑数据但公开弹窗过滤隐藏项。
- 选择：沿用同一版本化内容文档，避免为12项以内履历新增CRUD与关联查询；使用react-markdown与remark-gfm安全渲染正文，避免自制不完整Markdown解析器。沿用既有素材，无需生成位图。

### 验收条件

- AC-P28-01：公开能力场景恰好三卡；原技术配置全部在技术弹窗按四分区呈现，支持空组/12项/长昵称，无整页溢出。
- AC-P28-02：三卡点击可开对应详情；技术桌面宽不超过960px，公司/项目不超过1000px，背景模糊变暗；关闭、Esc、浏览器返回和焦点恢复可用，切换项目保持弹窗打开。
- AC-P28-03：公司三目录与多项目切换/空态正确，Markdown标题/列表/表格/代码/图片可读；原始HTML与javascript/data等不安全URL不执行，坏图片有回退。
- AC-P28-04：站主可编辑技术介绍、公司正文和项目；增删/排序/隐藏、实时预览、版本保存/刷新持久化有效；失败与409保留草稿，未保存不影响公开内容。
- AC-P28-05：真实HTTP覆盖缺失分区默认且不写库、完整保存/重启读取、公开隐藏过滤、DTO边界/重复ID/嵌套非法/URL校验、权限及版本冲突。
- AC-P28-06：桌面1440、手机390/320与后台iframe验证无横溢出；手机全屏、目录可用；动效暂停与系统reduce/appearance.motion关闭可正常操作，切场仍正反可逆。

### 实施清单（writing-plans）

- [x] T1 后端合同（AC04/05）：修改`backend/src/site/{types/site.type.ts,config/site.defaults.ts,dto/save-site.dto.ts,site.service.ts,site.controller.ts}`；先在`backend/test/site.e2e.test.mjs`新增失败HTTP场景，再实现默认/校验/公开投影，运行`npm test --prefix backend`。只使用随机临时Mongo，不写开发配置。报告`docs/ai/tasks/003-capability-details-backend.md`。
- [x] T2 配置与前端合同（AC01/04/05）：修改`frontend/src/{types/site.ts,api/site.ts,pages/admin/{editors.tsx,index.tsx,capabilities-editor.tsx,preview-protocol.ts}}`，新增`config/site-capability-details.ts`与`pages/admin/capability-details-editor.*`。先用现有Node/TypeScript工具检查实际API解析器拒绝非法分区/重复ID/不安全封面并兼容缺省，再接站主编辑；错误能定位隐藏Tab的无效项目名。报告`docs/ai/tasks/003-capability-details-admin.md`。
- [x] T3 公开三卡与详情（AC01/02/03/06）：改`pages/site/{capability-content.*,index.tsx}`，新增`capability-details.*`和共享`components/site-markdown/`；恰好三个card motion和card-window节点；保持850ms时钟与三环遮罩。先验证当前公开三卡/打开详情断言失败，再实现；依赖仅新增Markdown两包。使用现有浏览器实操及安全Markdown静态渲染断言。
- [x] T4 整合验收（全部AC）：运行前端lint/build、必要后端HTTP；用独立临时fixture核对保存与预览，不覆盖开发v6。独立审查仅本次快照差异（含未跟踪文件），修复阻塞项；更新README/架构/STATE与本节实际结果。

### 实际验证记录

- 2026-11-08：基准82acde8+本轮未提交工作，开始前快照`/tmp/nest-capability-details-before`，保留既有改动/分支；无提交、推送、部署或开发Mongo内容写入。主API仍v6，公司与项目空；真实履历留给站主填写。
- 后端TDD定向8/8先红后绿，完整76/76、5套件、0失败/跳过，含build（由后端代理实际运行，相关源码后续未变）；前端最终lint无警告、build退出0。实际API解析19/19、编辑器8/8、保存定位4/4模块模拟通过，无新增测试框架或不存在的前端test脚本。
- 根实际TSX静态渲染旧四卡先红4!=3→当前三卡绿；四技术区、Markdown标题/列表/表格/代码、HTML/危险URL拦截、安全外链、hidden空态通过。深链失败分支实际SitePage/SiteExperience SSR先红→绿，模态内有错误与重试，不误报为空；只mock无关环境hook，非真实断网浏览器。
- Chrome1920/1440主开发数据：三卡、真实技术配置、960px技术modal、背景blur、Esc/关闭/浏览器返回及回焦/动效暂停通过。公司/项目无数据展示空态。Chrome390/320：全屏详情、横目录、12项与40字技术昵称、长代码局部滚动，无页面/dialog横溢出；390后台编辑/手机iframe预览正常。
- Chrome隔离5174/3001：公司目录/三份项目切换、不安全链接无可点地址、HTML不渲染、坏图回退、hidden不出目录；父页编辑时iframe弹窗实时保持。UI新增/上移/填Markdown并保存v2、跨Tab无效名称定位、刷新持久化通过；公开API只4个可见项目且无hidden-secret。真实409浏览器注入未重跑，服务端HTTP与保存定位模拟为本轮覆盖依据。
- 独立审查发现并关闭两个P2：首次失败错误被空态覆盖、dialog padding点击误关闭。后者Chrome坐标实测先红后绿；复审无未关闭P0/P1/P2。报告与完整证据：[整合](../ai/tasks/003-capability-details-integration.md)、[后端](../ai/tasks/003-capability-details-backend.md)、[配置](../ai/tasks/003-capability-details-admin.md)、[审查](../ai/tasks/003-capability-details-review.md)。
- 最终三卡与技术详情的浏览器验收结果见上文，历史截图已清理。浏览器留正式能力页，viewport reset已调用，测试账号已退出。OS级reduce/真实touch与软键盘/多浏览器/浏览器断网未实操；reduce为静态证据，不冒充完整兼容验收。
- fixture清理已完成：随机Mongo库、隔离媒体与Vite缓存均不存在，测试3001/5174已停，主3000/5173保留；清理审计见后端报告。


## P27：默认动效与欢迎场景恢复（2026-11-07，已验证）

用户要求动效默认开启、隐藏按钮，并指出初次见面缺少动效；本节覆盖P26公开Switch合同，保留后台外观配置、系统reduce与音乐独立控制。

诊断：P26移除了首屏柔光/星芒CSS循环，人物一直是静态透明素材；浏览器确认still=false但柔光/人物/星芒computed animationName均none。另页面与SiteEntryProvider都读取旧site-motion-off，隐藏按钮前必须同步移除此旧偏好覆盖，不能仅藏UI。

### 设计、验收与实施清单（writing-plans）

- AC27.1：公开与首载均不再读取/写入site-motion-off，不渲染视觉动效开关。默认启用，后台appearance.motion和系统reduce仍有效；音乐按钮不变。
- AC27.2：初次见面恢复克制的柔光、内层星芒循环，静态人物增加小幅呼吸；不虚称真实手臂/眼神动画，不改850ms可逆时钟和三环。
- AC27.3：新循环默认暂停，仅欢迎端点且资源入场结束、无关于/联系/登录、非转场时运行；隐藏标签暂停，系统reduce静止。人物/星芒循环在独立内层，避开WAAPI外层transform/opacity与遮罩。
- AC27.4：Chrome桌面和390手机默认开启、无开关、欢迎有连续中间帧；正反切场、弹窗暂停/恢复、后台预览不受影响。保留真实配置v6，不保存数据。
- [x] `pages/site/index.tsx`移除本地off state/handler/按钮，增加data-welcome-running及星芒内层；`components/site-entry/index.tsx`同步去旧偏好（AC27.1/3）。
- [x] `pages/site/style.module.less`移除无用Switch样式，恢复受控柔光/星芒和人物内层轻呼吸，保留pause/reduce和当前构图（AC27.2/3）。
- [x] 实际TSX/函数定向模拟先红后绿，验证旧偏好/系统reduce/后台开关/转场/登录暂停；lint/build与真实Chrome动作/像素验证（AC27.1–4），独立审查本次差异，记录STATE。

本轮基线`/tmp/nest-welcome-motion-before`，不提交/推送/部署/换分支或改数据库。

### 实际验证

- `/tmp/nest-default-motion.check.cjs`执行实际TSX与motionAllowed函数、模拟hooks/DOM。修改前1/10（旧偏好关闭页面/首载、按钮仍在、新暂停条件缺失）；最终10/10：旧off被忽略、无按钮、欢迎端点运行、转场/能力态/登录暂停、系统reduce/后台外观开关有效、首载忽略旧off且尊重系统reduce。不是浏览器或正式前端测试框架。
- 本轮前端lint/build退出0，TypeScript和1562模块构建通过；无新依赖，后端未改不重跑HTTP。
- Chrome桌面确认无开关、still=false、welcome-running=true。人物矩阵从scale1.00488/y−4.06316变化到scale1.00393/y−3.27359，星芒矩阵也变化；关于打开后两者paused/welcome-running=false，Esc返回恢复；切能力时busy=true且welcome循环暂停。刷新实际看到开场dialog，之后自然进入欢迎。
- 390×844手机无开关/横溢出，scrollWidth390，人物running；后台桌面iframe欢迎状态true/人物running，保存disabled/v6，未保存配置。系统reduce、站主关动效仅定向模拟/源码验证；实际隐藏标签/OS设置/其它浏览器/真机touch本轮未实操。850ms核心时钟未修改，中途逆向沿用P26对应未变模块证据。
- 独立审查[报告](../ai/tasks/003-welcome-motion-review.md)无P0/P1/P2，确认CSS内外层隔离与暂停/reduce优先级。截图`evidence/welcome-motion-mobile-v12.jpg`与`welcome-motion-final-v12.jpg`均为390尺寸的无开关首屏证据，不冒称动态录像。
- 结束保留初次见面/默认动效，原服务3000/5173运行。多次调用viewport reset后最终公开采样仍390×844，另一次set1440也未影响该页，原生界面恢复尝试在派发前中止；未声称已恢复原窗口尺寸，截图按实际390记录。没有修改浏览器账户、真实配置或登录状态。

## P26：温暖工作室视觉精修（2026-11-07，已验证）

用户给出明确风格与参考图，要求在现有首页优化。保留 HEY.、左文右人物、欢迎/能力双幕及现有功能；本节覆盖之前按钮与环境的视觉描述，P24移除档案、P25独立预览和P23可逆850ms时钟继续有效。

### 设计与选择

- 产品：AI全栈开发者的个人数字空间，内容来自现有配置，不虚构经历、项目或成果。
- 性格：温暖、克制、有亲和力。
- 环境：深橄榄绿工作室、木桌、台灯、绿植；真实位图承担空间质感，界面保持安静。
- 视觉中心：保留现有同一角色挥手/桌前两张透明素材与电影式侧逆光；静态分层过渡，不声称骨骼动作。
- 品牌细节：HEY.金色句点、细导航下划线与主按钮深绿圆箭头。
- 采用现有React/Less分层合成，新增环境WebP；保留背景失败时纯CSS橄榄底。新3D模型/视频会改变资产与运行成本，不在本次引入；整屏扁平重绘不符合保留现有结构要求。

### 验收条件

- AC26.1：主背景#20291F/辅助#343B2C、主字#FFF0D2、次字#C5BEA9、点缀#F4BD58；背景具有工作室景深且文字/人物清晰，无新增密集装饰或虚构内容。
- AC26.2：保留左文右人物、品牌及粗体OH,/HELLO.；桌面主按钮暖奶油金填充、深绿字/圆箭头，悬停约300ms上浮1px、箭头平移4px，减弱动画时静止。导航改“联系我”“进入空间”，仍使用原关于/联系与站主入口流程。
- AC26.3：视觉动效控制为明确“动效”标签+极简Switch轨道，保留现有aria标签/pressed状态、系统reduce与音乐独立逻辑；不添加新的持久化开关。
- AC26.4：能力四组保持站主配置、空态/长昵称/名单滚动与键盘展开，视觉减少玻璃感、细线与空间分布；现有三环与850ms可逆转场不变。
- AC26.5：Chrome桌面1440级、390及320手机无整页横溢出，首屏主按钮可用；两幕正反切换、关于/联系Esc、手机导航及后台桌面/手机iframe预览可用；只读验收不保存真实配置。

### 实施清单（writing-plans）

- [x] 根：`public/site/studio-environment-v1.webp`与768版本、`ASSETS.md`记录内置imagegen来源与提示词；环境仅CSS背景不影响内容就绪等待（AC26.1）。
- [x] 根：`pages/site/index.tsx`保留业务逻辑，精修导航文案、主按钮箭头及动效Switch；`style.module.less`按间距/配色/排版/细节/环境/动效调整，复用现有转场钩子（AC26.1–3）。
- [x] 子代理：只精修`capability-content.module.less`，保留数据/结构/响应式/可访问性与滚动，报告`003-warm-capabilities.md`（AC26.4）。
- [x] 根：lint/build；通过真实Chrome验证AC26.5、交互与Switch；独立审查本次差异（基线`/tmp/nest-warm-studio-before`，不能用HEAD空差异代替）；记录证据并更新STATE（全部AC）。

纯视觉与语义文案修改不新增测试框架/镜像CSS的测试；以构建、真实浏览器交互和DOM布局/样式数据的文字记录为依据，不要求基线截图或图片对比。后端、API与真实Mongo配置不变，不重复HTTP测试。不提交/推送/部署/换分支/worktree。

### 实际验证

实施前核对82acde8与已有大量未提交改动，截图确认原首页为橄榄抽象舞台、描边主按钮、胶囊动效按钮。

- 最终前端`npm run lint`、`npm run build`均退出0（含TypeScript，1562模块）；不新增测试框架。后端、API、真实配置未改，未重跑后端HTTP。
- Chrome原窗口、1440×900桌面与390×844/320×740手机完成首屏/能力布局检查，无整页横溢出；320实际client可用宽305、CTA216×56且x24.39/y618，可在740高首屏点击。1440四组完整、技术SVG全加载；390横卡232×156、局部横滚。
- 手机14px字体使原双列出现DeepSeek/TypeScript断词，依据截图改卡内单列，保留四组横向浏览与名单88px纵滚。后台390独立iframe实测名称完整显示。长40字/12项/空组本轮仅源码保留检查，没有编辑真实配置重造这些状态。
- 主按钮正向、品牌反向、同一时钟中途反向与手动开关实测；转场中busy=true、挥手opacity0.969396/桌前0.0306037，快速反向另采到0.181345，端点busy=false。用户在验收中发现动效消失，核对是根临时手动关闭尚未恢复；已恢复on，未修改850ms时钟或引入新动画。
- 关于面板、联系空态/Esc与回焦、320手机菜单与进入空间打开已登录面板通过；未提交登录/切账号/退出。后台保存仍disabled/v6，桌面iframe1440×900与手机390×844宽=scrollWidth，公开样式和背景同步。
- 独立审查发现reduce时CTA箭头仍4px瞬移，已同时在手动still和系统media清除transform并复核。系统OS reduce、其它浏览器、真机touch及断图未实操；不扩大既有覆盖结论。
- 证据`evidence/warm-studio-desktop-v11.jpg`、`warm-studio-capabilities-v11.jpg`、`warm-studio-mobile-capabilities-v11.jpg`。报告：[根整合](../ai/tasks/003-warm-studio-integration.md)、[能力样式](../ai/tasks/003-warm-capabilities.md)、[独立审查](../ai/tasks/003-warm-studio-review.md)。结束保留首页初次见面、动效on并调用viewport reset；3000/5173继续运行。没有提交/推送/部署/换分支/worktree或数据写入。

## P24：作品档案整体移除（最新合同，2026-11-07）

用户明确要求整体删除作品档案，并删除站主配置中的相关功能。本节覆盖下方旧版设计、接口、验收与保留档案的历史约定。

### 范围与实现选择

- 公开页移除作品导航、档案区、分类、封面、项目列表/详情/翻页、空态、滚动动效与作品引导文案。保留初次见面/我的能力两个可逆舞台、三环、关于/联系、登录、开场、流体与音乐。首页主按钮改为进入我的能力。
- `/?project=<id>`旧链接显示普通首页，不再打开任何档案面板；原about/contact参数、关闭/Esc/浏览器返回与焦点恢复保留。加载/失败重试移到保留页面可见位置。
- 后台删除作品分区及添加/删除/排序/隐藏/精选/标签/封面上传和确认弹窗；场景一览改为欢迎/能力，外观文案去除档案。保留其它编辑、未保存预览、版本冲突、权限和音乐。
- 前后端SiteContent不再含projects，删除SiteProject和相关枚举/DTO/解析。默认/公开/站主响应均无projects；旧Mongo文档在响应映射时剔除，读取不写库不改version，下一次站主正常保存替换content。含projects写入为未知字段400，失败不改数据。
- 图片POST `/api/site/assets`仅用于封面，一并删除并返回404；音乐POST `/api/site/audio-assets`及媒体GET保留。只清理无引用的仓库素材，不删除历史媒体、数据库或改动开发配置数据。独立`/tasks`保留。
- 固定现有React/MobX/Ant Design/Less与NestJS/MongoDB，无新依赖，不提交/推送/部署/换分支或worktree。工作区已有大量未提交改动必须保留；本轮源码快照`/tmp/nest-remove-archive-before`用于区分任务差异。

### 验收条件

| 编号 | 验证 |
| --- | --- |
| AC24-01 | 桌面/手机公开页无档案入口、区块、详情与空态；首页主按钮进入我的能力，欢迎/能力可逆且三环保留；浏览器 |
| AC24-02 | 旧project链接按首页处理，关于/联系与关闭/Esc/返回/焦点可用；加载失败仍有重试；浏览器及源码 |
| AC24-03 | 后台完全无作品编辑、封面上传和相关文案；其它分区与未保存预览保留；浏览器及源码 |
| AC24-04 | 默认/公开/站主响应无projects；旧文档只读剔除不改版本/数据库；无projects保存成功，携带projects为400且不改版本；原409、重启持久化正常；真实临时Mongo HTTP |
| AC24-05 | 图片上传POST为404；音频上传/读取及Session/Owner/CSRF正常，/tasks保留；HTTP及静态核对 |

### 实施清单（writing-plans，分区并行执行）

- [x] P24-A 后端：先调整`backend/test/site.e2e.test.mjs`验证AC24-04/05并观察预期失败；再清理site/types、config、dto、service、controller、assets及图片拦截器。真实独立临时Mongo全套HTTP、自审，报告`docs/ai/tasks/003-remove-archive-backend.md`。
- [x] P24-B 配置及共享前端：清理`types/site.ts`、`api/site.ts`、`store/site-admin.ts`、`pages/admin/`全部项目合同/操作/样式/分区；保留home.buttonLabel与音乐。报告`docs/ai/tasks/003-remove-archive-admin.md`。
- [x] P24-C 公开页：仅`pages/site/`、`store/site.ts`清理档案及project分支/样式，use-scene-motion去除档案依赖并保留环境光和隐藏暂停；首页按钮进入我的能力，同步导航/跳转/进度/焦点。报告`docs/ai/tasks/003-remove-archive-public.md`。
- [x] P24-D 根整合：清理档案独占素材；更新README、架构、STATE及旧规格当前合同；lint/build、桌面/390/320公开与后台只读浏览器验收、project旧链接/关于/联系/主按钮；独立审查任务差异并修复复验。前端无test脚本，不新建框架或虚构测试。

### 实际验证

2026-11-07，基准82acde8及未提交工作区；代码任务差异对照开始快照，未覆盖原工作。

- 后端先观察5个P24真实HTTP用例按预期失败，再重新执行`npm test --prefix backend`：70/70，5套件，0失败/取消/跳过，含构建。覆盖默认/公开/站主不含projects、旧文档v7读取原始记录不变、正常保存v8剔除旧字段、携带projects为400且不写入、图片POST404、历史媒体GET、音频及权限/CSRF/409/重启/任务回归。日志`/tmp/nest-remove-archive-backend-{red,green}.log`，[后端报告](../ai/tasks/003-remove-archive-backend.md)。
- 前端最终冻结后重新执行lint/build均退出0，TypeScript与Vite通过；日志`/tmp/nest-remove-archive-frontend-{lint,build}.log`。实际API模块21/21、真实store配合网络响应模拟17/17；这是临时定向断言，不是浏览器或正式前端test脚本。[配置报告](../ai/tasks/003-remove-archive-admin.md)。
- Chrome桌面1920、390/320尺寸确认无档案入口/文字/DOM与横向溢出；主按钮进入能力，三环人物保留；旧project链接只显示普通首页。about直达关闭回brand，桌面关于Esc/联系浏览器返回恢复原按钮，手机菜单打开关于关闭回菜单按钮。后台同三尺寸只读验证五个分区、欢迎/能力场景一览、音乐配置及手机预览；保持v6已保存且保存按钮禁用，无开发配置写入。
- 开发服务公开API实读仍v6，content只有profile/home/contact/appearance/music/capabilities，无projects。仅删除仓库中无引用的seated-character.png、task-cover.jpg及图片专用拦截器，不删除历史上传媒体。源码残留只有清除旧project参数及历史字段映射说明。
- 浏览器验收的历史图片已清理，文字结果保留：最终键盘跳转端点聚焦能力H2、反向回欢迎端点通过，三条ellipse保留；独立规格/质量审查无P0/P1/P2。[整合报告](../ai/tasks/003-remove-archive-integration.md)、[审查报告](../ai/tasks/003-remove-archive-review.md)。
- 边界：首页加载失败/重试分支仅源码和实际API/store模拟核对，未注入真实浏览器断网；后台浏览器为只读，没有为此向开发库保存临时内容。没有补验多浏览器、真机触摸、软键盘、OS reduce或真实后台标签暂停；未扩大原动效验证边界。
- 收尾时外部聊天「配置我的能力分类」开始独立iframe预览修复，变更后台index/style与公开style；根保留其文件，文件落盘后重新build通过。P24后台截图/hash与独立审查对应该预览重构前的冻结版本，后续iframe/路由/视觉由并行任务验收，不把其未完成结果混成本次通过。作品移除相关源码未重新出现，后端仍为本轮验证版本。

## 设计与范围

在当前 React/MobX/Ant Design/Less Modules + NestJS/MongoDB 项目实现单份个人官网。职业背景用于质量要求，不转成首页职业口号。保持用户选定橄榄色舞台、奶油纸张和圆框眼镜立体人物，依据第二条抖音参考；不恢复被否定浮岛或暖白钴蓝风格。P24移除橙色作品档案。

历史设计说明见[设计记录](../designs/personal-site/README.md)，相关图片已清理。功能与验收以本规格及后续生效的合同为准，不依赖旧设计图。

本次人物静帧，不声称已实现转头/挥手/落座。实现场景、个人资料阅读面板与轻量背景回应，遵守系统reduced-motion和手动关闭；不引入Three.js/GSAP/付费视频生成。人物连续动作以后接入真实素材。

## UI 与流程合同

1. `/` 保留初次见面与我的能力两个可逆舞台场景，主按钮进入我的能力；无作品档案滚动区域。
2. 无作品导航、分类、列表、封面、项目详情或作品空态。
3. `/?project=<id>` 旧链接显示普通首页；关于/联系使用原panel参数，关闭/返回/Esc/浏览器返回恢复位置与焦点。
4. 关于/联系采用同一阅读面板，空资料不造数据，不再引导查看作品。原真实任务应用作为独立 `/tasks` 保留。
5. 公开API加载、失败重试与真空态区分；图片错误有替代。首屏文字/人物尽早展示。手机顺序排版、键盘focus、弹层焦点管理与恢复、减少动效。
6. `/admin` 恢复会话→站主登录（无注册）→服务端权限→加载配置；非站主无编辑数据，仅切换账号/返回。加载失败不产生空白可保存配置。
7. 分区：首页场景、我的能力、个人资料、联系入口、外观与动效，共享编辑草稿。右侧未保存预览；手机编辑/预览切换。固定classic角色方案，不提供虚假动作生成或场景排序。
8. “保存全部并更新官网”原子保存所有区块，服务端确认成功后清dirty并显示新版本；新访客/刷新读新内容，不强推已打开访客。保存期间禁止编辑/重复提交。本地内存草稿，无服务端草稿/发布系统。
9. dirty离开/刷新/退出提醒；401遮蔽编辑重新登录，仅同一用户恢复草稿，不同身份清除；400保留输入并提示；403区分CSRF和权限。409保留本地并可查看最新，用户选择载入最新或继续编辑，不能静默强覆写。网络异常结果未知时提示核对最新版本。
10. 音频上传只更新本地草稿，保存后才使用；作品封面图片上传已移除。手机后台单列分区选择+底部保存。实现细节不塞公众页面。

## 冻结接口与类型

```ts
type SiteContent = {
  profile: { name: string; tagline: string; bio: string };
  home: { eyebrow: string; title: string; subtitle: string; buttonLabel: string };
  contact: { email: string; links: { label: string; url: string }[] };
  appearance: { motion: boolean; character: 'classic' };
  music: { enabled: boolean; title: string; sourceUrl: string; volume: number; loop: boolean };
  capabilities: Record<'ai' | 'frontend' | 'backend' | 'deployment', { icon: string; name: string }[]>;
};
type SiteDocument = { version: number; updatedAt: string | null; content: SiteContent };
```

| 接口 | 合同 |
| --- | --- |
| GET /api/site | 公开SiteDocument，无projects；no-store；未保存返回默认内容version0无需写库 |
| GET /api/site/config | SessionGuard+SiteOwnerGuard，完整SiteDocument；401未登录，403非站主/未配置 |
| PUT /api/site/config | Session+SiteOwner+CSRF，输入`{version,content}`，原子比较版本，成功返回新文档version+1；409旧版本，不部分修改 |
| POST /api/site/assets | 图片上传已随作品档案移除，404；音乐上传使用POST /api/site/audio-assets |
| GET /api/site/assets/:filename | 公开受控目录媒体，严格文件名，无路径穿越，正确类型+nosniff |
| POST /api/auth/register | 关闭注册，403，不创建用户或建立登录，不依赖UI开关 |

验证：拒绝未知字段（含projects）、非法枚举、超限文本/列表与危险URL，文本不渲染HTML。name1–60，tagline0–160，bio0–4000；home eyebrow/title/buttonLabel非空上限80/80/30，subtitle240。links最多8、label非空50。URL最长2048、空或http/https，禁止协议相对/javascript/data；音源另外允许受控音频资源路径。email空或常见无空格、单@且域名含点的有效邮箱；不支持带空格的引号本地部分。version非负整数，updatedAt不能客户端指定。

MongoDB独立单站点集合。`SITE_OWNER_USER_ID`绑定已核对现有用户UUID，缺省拒绝所有配置；普通身份不能提升。提供受控本地初始化命令，通过stdin读取密码（不回显，不作参数），创建55555并将UUID写入本地忽略backend/.env，不保存明文密码；存在账号不静默重置。真实密码不用于测试，测试使用临时独立库与夹具。

## 验收条件

| 编号 | 验证 |
| --- | --- |
| AC01 | 桌面/手机符合选定人物视觉；我的能力、关于联系可用，无档案入口；浏览器 |
| AC02 | 匿名配置401，页面登录；注册API403且UI无入口；HTTP+浏览器 |
| AC03 | 非站主与未配置站主读写上传403，不泄漏配置；HTTP |
| AC04 | 站主原子保存、新版本、不返回作品字段、重启持久化；HTTP+浏览器 |
| AC05 | 非法字段/URL/音频400、缺CSRF403不改数据；过期不漏草稿，失败保留；HTTP+前端 |
| AC06 | 同版本并发仅一成功，另一409，前端不静默覆盖；HTTP+浏览器 |
| AC07 | 手机后台、键盘焦点/Esc/返回/减弱动效、加载失败空态；浏览器 |
| AC08 | 原/tasks保留（关闭注册），Session/任务隔离/CSRF回归；HTTP与现有检查 |

## 历史实施计划：writing-plans / subagent-driven-development（P24前）

用户选择多Agent。独立文件分区并行，按上方合同交接；公共文件整合者负责。代理读AGENT、STATE、目录AGENTS、本文。报告写docs/ai/tasks，无重复规格。不用技能默认提交/worktree步骤。

- [x] P0 两轮UI/流程审查，明确两个主场景+详情子状态、全局保存、权限/冲突/手机与返回。
- [x] P1 后端代理：backend/src/site/{dto,schemas,guards,types,config}与module/controller/service；backend/test/site.e2e.test.mjs。关闭注册并将原测试建号改受控夹具；本地站主初始化脚本、.env.example。先HTTP失败测试再实现，跑全套。AC02–06、08。
- [x] P2 公开页代理：frontend/src/pages/site/与store/site.ts，SitePage默认页面及命名export SiteExperience（props: content:SiteContent; preview?:boolean），供后台预览。使用types/site.ts与api/site.ts（P3负责），两场景/详情/URL/手机/动效。静帧`/site/hero-character.png`、`/site/seated-character.png`由根代理提供。AC01、07。
- [x] P3 配置代理：frontend/src/types/site.ts、api/site.ts运行时解析（export getSite/getSiteConfig/saveSiteConfig/uploadSiteAsset），store/site-admin.ts、pages/admin/命名export AdminPage。先产出types/api再UI；复用authStore，预览用SiteExperience。不改router/global。AC02、04–07。
- [x] P4 根整合：router / /admin /tasks、原AuthModal关闭注册入口、必要global调整、人物静帧、真实任务封面；本地账号初始化不泄露；README/架构/STATE。前端lint/build、浏览器桌面手机/登录保存刷新返回；后端P1跑HTTP。
- [x] P5 独立审查规格+质量，修复后浏览器视觉验收并打开预览。人物动作待补，不虚构完成。

重点审查：真实关闭注册；站主权限缺省拒绝；身份变化草稿/迟到响应；初次保存并发原子性；手机遮挡/详情返回。前端无test脚本，不虚构测试或擅自添加框架。

## 决策和验证

- 旧独立浮岛已移废纸篓，4177停止，保留原参考照片。
- 公开/后台两名独立审查代理指出并修正入口返回、保存作用域、权限、状态、移动端问题；静态图不能证明运行行为，后续补测试。
- 用户同意先页面后台、后动作；不用未连接Weave或付费生成。
- 唯一55555并关闭注册为最新要求，替代此前普通注册开放合同。
- 开发开始前产品代码无改动，旧基准HTTP42/42与前端lint/build仅历史证据。新结果实施后追加。

## 待补内容

展示名、个人介绍、公开联系方式由站主配置；初始不编造。人物连续动作素材后补，无源码地址隐藏按钮。

## 第二次实现迭代：主页登录与表现力（用户最新反馈）

第一版后端59/59、前端lint/build通过，公开/后台独立审查阻塞已全部关闭。实际浏览器完成站主登录/保存v2/JPEG上传/409恢复/手机/焦点验收；用户现场反馈动效太弱、首页缺站主入口，要求继续改进。当前任务继续，不视为仅咨询。

- 用户确认：首页右上角“站主入口”→同一人物舞台内展开登录面板→成功进入/admin；手机菜单同样有入口。保留/admin直达登录以支持原入口/过期草稿恢复。
- 登录视觉：首页橄榄背景与暖聚光、现有卡通人物、奶油控件及橙色主按钮；面板真实表单，账号密码不写入URL/持久存储/日志，无注册入口。复用AuthStore、CSRF与当前校验。已登录则提供进入配置和切换账号，不在前端假定owner；服务端依然拒绝非owner。
- 登录打开/关闭有连贯转场、Esc/焦点捕获及恢复；恢复失败可重试，登录失败保留账号并明确提示。预览中入口仅提示/禁用登录，不从后台预览导航离开或产生新认证请求。
- 增强动效：桌面两场景随滚动连续衔接（首屏文案退场、舞台景深/档案进场），档案纸页的hover展开和点击阅读入场；环境柔光/少量漂浮光点。角色仍为静帧，只做画面景深与构图过渡，不虚构眼神/肢体表演。
- 不劫持滚轮，不强制自动滚动，不引入Three.js/GSAP新依赖；持续动画只影响transform/opacity优先，requestAnimationFrame管理滚动更新，页面隐藏暂停。手机简化；系统reduce和手动关闭同时覆盖新增动画；阅读交互不等待长动画。
- 不把全部内容铺成平直静态区块；同时保留真实DOM、键盘、公开数据失败重试、历史返回与草稿安全。

### 迭代任务

- [x] P6 公开动效代理：仅pages/site与必要store/site.ts；实现上述场景/档案动效，保留已修observer/焦点/异常逻辑；集成P7导出的SiteLoginPanel({open,onClose})，header与手机入口。登录组件由另一代理编写，双方接口冻结。
- [x] P7 登录代理：frontend/src/components/site-login/{index.tsx,style.module.less}，命名export SiteLoginPanel；只在open激活AuthStore恢复，重用已有认证，成功useNavigate('/admin')；登录/恢复/已登录/切换失败全状态。与公开页代理协调motion关闭props（新增可选reducedMotion:boolean），勿改public/index与admin。
- [x] P8 根整合：桌面/手机登录入口、登录失败/成功/关闭焦点，真实滚动动画与手动减弱、作品详情返回，最终lint/build与独立审查；保留第一版HTTP证据，接口无变化不重跑59项。

### P9 用户补充：连线书写与毛玻璃显影

用户要求进入网站有类似连线写字开头，主页按毛玻璃逐渐清晰，并要求推荐动态效果。确定组合：HEY.线条书写约2秒→磨砂玻璃逐渐退去显露当前真实首页→档案纸页交互。必须有跳过/重播，会话内默认一次；系统reduce或手动关闭直接显示清晰内容，非假加载百分比。动效不依赖API返回，故障时仍可见错误与重试。手机减轻模糊量，隐藏标签页暂停，清理timer/rAF；仅静态人物，无假眼神/肢体表演。

P9 intro代理仅新增components/site-intro/{index.tsx,style.module.less}，export SiteIntro({enabled:boolean,replayKey?:number})。首次会话或replayKey变化触发，sessionStorage使用独立key；组件自身管理结束、跳过与必要焦点恢复，不访问认证/公开API。P6集成该组件(enabled=!preview&&motionEnabled)、页脚“重看开场”（点击replayKey+1）及登录入口。P7登录组件保持独立。

### P10 后续参考视频分析（先完成本轮再观看）

用户要求本轮开场/登录/动效完成后观看新的抖音参考：七的三次方，《用AI做视差滚动网站，直接把海掀了》，短链接 https://v.douyin.com/-fTgl98H3lg/ 。分析分层、滚动控制、海面拉开揭示隐藏场景的体验原理，并提炼适合当前人物+档案官网的改进建议。用户描述不能替代实际观看证据；如果视频访问失败如实说明。此项首先是观看分析与建议，不自动把海洋/章鱼主题移植到网站。

## 第一版实际验证汇总（2026-11-07，未提交）

- 后端最终 `npm test --prefix backend`：构建成功，59/59，5套件，0失败/跳过/取消；`/tmp/nest-backend-test-email-fix.log`。覆盖注册关闭、站主缺省拒绝、非站主、CSRF、初次/后续并发、重启持久化、图片/路径、受控初始化、旧短账号会话迁移、嵌套数组与邮箱/标签边界。
- 前端 `npm run lint --prefix frontend`、`npm run build --prefix frontend`：通过，最终分块无旧680KB单块警告；包含TypeScript，不存在前端test脚本。另API12边界、store10状态是临时Node断言，不等同浏览器。
- 浏览器真实本地：55555登录；将首屏标题改成两行并全站保存v1；另一窗口旧版本保存409，输入保留，查看并载入最新后清dirty；上传真实任务页JPEG，保存v2，公开页读取上传URL；刷新后版本与内容保留。临时测试文案未保存。
- 桌面与390×844手机：首页/配置布局、项目封面与阅读、分类空态、Esc/浏览器返回及项目焦点恢复、手机菜单关于关闭焦点回可见菜单按钮、无横向溢出、编辑预览切换、跨分区草稿、dirty离开提醒已实操。
- 真实浏览器修复前/后：连续标题FIRST→SECOND原预览停FIRST，observer修复后变SECOND；只改封面地址，预览img.src同步更新。测试后恢复原内容，dirty清除。
- 审查：后端与前端独立报告所有阻塞已关闭；报告见docs/ai/tasks/003-*-review.md。系统reduce的真实OS偏好、断网/401浏览器注入没有执行；对应CSS/分支、HTTP/临时状态断言分别验证，不能概括全部场景浏览器通过。
- UI证据：`docs/designs/personal-site/evidence/`，首页桌面/手机、项目桌面/手机、后台桌面/手机、保存冲突。新动效迭代会更新首页最终证据，首版截图仅对应当时实现。
- 当前已有记录：用户账号受控创建、UUID写本地.env；密码未写仓库；媒体在ignored目录。没有提交、推送、部署、清库。


## 第二轮实际验证与参考分析（2026-11-07，未提交）

- P6–P9完成。当前分支与技术栈不变，无服务端接口改动；后端沿用上文59/59有效结果，没有重复运行。
- 最终重新执行 `npm run lint --prefix frontend` 与 `npm run build --prefix frontend`，均退出0；TypeScript通过，Vite构建无大块警告。
- 真实浏览器：首次开场显影后自动结束、会话内刷新不重播、页脚重播、Esc和跳过、手动关闭后重播禁用；桌面滚动的CSS进度随位置变化，首屏回退恢复；作品阅读与浏览器返回、焦点/滚动恢复通过。
- 首页站主入口：真实已有身份→切换账号→错误密码提示→正确登录进入/admin，路由切换后body滚动锁已解除；后台预览入口禁用且无开场。390×844手机菜单入口、登录表单、关闭与跳过、无横向溢出已检查。最后测试主动退出会话，预览保留公开首页。
- 独立审查报告 `docs/ai/tasks/003-motion-review.md`：1项P2重播焦点问题已修。重播先回首屏并聚焦HEY按钮，再启动动画；根实测Esc/自然结束后焦点在首屏，下一次Tab仍在首屏，scrollY保持0。规格和质量审查均无遗留阻塞。
- 临时真实组件转译+模拟生命周期断言：intro19/19、login13/13；与浏览器证据分开。没有新增测试框架；系统OS减少动画、手机软键盘、实际后台标签暂停未进行浏览器实操，不扩大通过范围。
- 第二轮证据：`evidence/home-desktop-v2.jpg`、`home-mobile-v2.jpg`、`home-login-desktop.jpg`、`home-login-mobile.jpg`、`home-intro-desktop.jpg`，均位于设计目录。开场截图是过程的一帧，完整动画以运行预览为准。

### P10 视频已实际访问，建议不等于已实现

原链接解析为 [七的三次方·第26集](https://www.douyin.com/video/7686420711983942964)。浏览器实际播放并定位观看00:00、约00:21、00:29、00:44、00:46–48的视觉画面，核对页面作者说明；不是根据分享文案假称已看。没有提取音频逐字稿，也没有进入视频里的成品网站直接操作。

观察：首屏左侧大衬线标题、右侧触手和完整海面；随后海面像幕布被抬起，暖光建筑与蓝色海底逐渐露出，标题退场。制作画面展示三张关键帧和两段视频，页面说明明确用滚动控制视频进度并可前进/回退。视频中的连续形变依赖预制动作素材，不能仅靠现有静态人物缩放获得。

对本项目的提炼（下一轮建议，未开发）：

1. 优先做橙色档案封面随滚动揭开，露出奶油色真实作品内容；倒滚合拢。当前人物静帧可复用，封面与纸页用网页图层完成。
2. 将人物舞台、档案和文字排成连续镜头：前景纸页移动更快，人物和背景更慢，文字按阶段退场/入场；仅在首屏至档案短区间使用，后续阅读恢复普通滚动。
3. 人物亲手打开档案、转身落座需要统一角色的三关键帧及两段动作素材，继续遵守用户“人物动作后补”的决定。视频只负责视觉表演，文字、登录、分类、项目内容仍为真实DOM并接当前服务端配置。

本轮已有书写/磨砂显影、景深过渡、档案悬停与阅读展开；不把上述更强的揭幕建议写成已完成能力。

## Unslop 设计审查（2026-11-07，仅检查）

用户要求安装 unslop 并检查当前官网。已安装用户级技能并按其审查流程检查当前未提交实现；[总报告](../ai/tasks/003-unslop-audit.md)含真实桌面/手机截图、DOM 样式证据和五行设计方向，[独立源码报告](../ai/tasks/003-unslop-code-review.md)含定位与对比度计算。主要建议为修正演示按钮对比度、手机微小标签字号、重复标语和双标点；保留已选橄榄舞台/人物/档案与用户指定动效。建议尚未实施，不改变现有合同或其它任务的完成状态；本次未重跑产品测试。

## Unslop 三项精修（2026-11-07，用户已授权实施）

目标：改善演示入口对比度、手机信息字号和重复文案，保留橄榄舞台、两个人物素材、档案材质、书写/毛玻璃、滚动景深、悬停纸页及手动减弱动效。复用上述已确认设计，不再重新选择方向。

范围与验收（细化 AC01、AC07）：

- U1：演示按钮使用深墨色 `#211d14`，保留橙色渐变及 hover；当前默认/hover 四个渐变端点的文字对比度均至少 4.5:1。
- U2：手机项目标签、技术栈、分类计数、页码与返回等有效辅助信息至少 12px，项目摘要/正文至少 14px。技术栈与打开入口可分行；减少纯装饰微小英文。390×844 检查首屏、档案和阅读面板，不出现横向溢出；320px 宽补查分类与底部操作换行。
- U3：保留配置提供的首屏标题、眉题及简介，减少固定的侧边问候、重复档案英文、人物侧标语和阅读页脚标语；关于标题不再自动给名字追加句号，当前应显示“你好，我是HEY.”。不编造介绍，不写数据库配置。
- U4：桌面与手机可进入作品详情并返回、打开关于页；开场重播/跳过、动效开关及滚动层次保持。登录和后台业务逻辑不改。

实施清单（writing-plans / executing-plans）：

- [x] U-P1：修改 `frontend/src/pages/site/style.module.less` 的按钮颜色与文字尺度，处理窄屏技术栈、分类和底部操作的可用空间；同步同组件后台预览的文字尺度，避免仍被旧缩放规则覆盖。
- [x] U-P2：修改 `frontend/src/pages/site/index.tsx` 的固定装饰文案和关于标题；清理对应失效样式，保留人物/动画/数据/交互结构。
- [x] U-P3：独立代理按任务开始快照审查本轮差异；根执行前端 lint/build、浏览器桌面及390×844/320px手机检查、读取实际字号与按钮样式，用文字记录结果并回写本规格和 STATE。

验证范围：前次审查已复现低对比度、7px技术标签及双标点，本轮开始源码仍相同。此次是可逆样式/文案精修，不添加测试框架或镜像实现的测试；使用真实浏览器复核和现有静态检查，不把它称为前端自动化测试。后端/API无变化，沿用已有59/59结果，不重复运行。

实际完成：最终前端 lint/build（含TypeScript）均退出0；按钮四端点最低4.8936:1。真实桌面1280×720、手机390×844及320×740检查通过本轮内容/阅读/返回/关于/布局范围，标签实际12px、正文14px，无横向溢出。独立审查发现两处目录/预览字号覆盖，已修复关闭；后台预览和多项目目录仅做源码检查，不冒充浏览器验证。[交接与截图](../ai/tasks/003-unslop-polish.md)、[独立审查](../ai/tasks/003-unslop-polish-review.md)记录详情与源码哈希。开场检查后另一个任务继续修改P11时序/跳过入口；保留其并发改动，最新开场验收由P11–P13记录，本轮不重复认领。

## 第三轮增量：完整书写后退场与鼠标雾面波纹（2026-11-07）

用户明确要求开场等文字写完再消失，并希望鼠标移动时背景出现参考视频式模糊波浪。本轮沿用既定人物/橄榄舞台；只修改前台表现，不改后台权限、数据、API或项目主题。新反馈优先于旧2600ms同时显影时序。

根因：原最后下划线结束于2110ms，签名淡出从1976ms开始，玻璃从1248ms开始变清晰，存在时序重叠。

实施选择：开场使用现有SVG/CSS分阶段时序；鼠标效果采用视频中已核对的React Bits Splash Cursor流体方案，放在独立背景图层形成柔雾流动与扩散波纹，沿移动轨迹出现并自行消散。避免全页持续模糊、文字/控件失焦和跟随鼠标的硬圆圈。触摸、预览、手动关闭、系统reduce、打开阅读/登录和页面隐藏时停止；装饰不拦截点击。保留既有静帧人物，无新依赖。

- [x] P11 开场代理仅改components/site-intro的样式/必要组件：所有笔画和下划线完成约2110ms后保留约700ms，再淡出文字，随后玻璃解散；总时长约4秒，按最新要求移除可见skip，保留Esc/session一次/replay/焦点与隐藏暂停。报告补003-intro.md，根浏览器验证完整书写停留与退场顺序。
- [x] P12 流体代理实现、根集成局部模糊波纹：检查第一条参考与现有图层，新建局部背景组件/样式或hook并集成site，限制同时存在的波纹、输入节流、离开/隐藏/关闭清理；仅桌面精确指针启用。验证真实鼠标移动、停下消散、离开清理、关闭动效、登录点击与手机无溢出。
- [x] P13 增量独立审查上述时序/生命周期/性能边界，必要修复后前端lint/build与桌面/手机浏览器验证；后端无变化沿用59/59。更新STATE并打开预览。

本轮是已授权UI细化；不重复确认已有设计，不创建分支/worktree，不提交或部署。后续视频驱动档案揭幕仍仅为建议，未混入本轮范围。


P12参考核对：浏览器实际定位第一条[AI教练振轩视频](https://www.douyin.com/video/7667416314029411594)约27秒，画面明确为React Bits Splash Cursor，随后32秒是Gradient Blinds，用户所述移动模糊波浪按前者实施。[官方页面](https://reactbits.dev/animations/splash-cursor)确认流体鼠标效果。实现采用官方源码本地适配，保留MIT+Commons Clause许可；不引新运行依赖、不启用默认彩虹色/点击喷溅/初始随机运动。首页人物和文本在其上层保持清晰。与最初仅CSS波纹设想相比，此路线能保留用户参考中的流动卷曲。


P11最新用户追加：去掉可见“跳过开场”按钮，文字完整写完并短暂停留后自动进入首页。该要求覆盖此前P9显示skip入口的合同；保留原生Esc退出、系统减少动画、手动关闭动效与页脚重播。移除按钮后dialog自身接收焦点，屏幕阅读说明改为自动进入，不留下不可用焦点或错误操作提示。


### P11–P13实际验证（2026-11-07，当前未提交工作区）

- 已去掉可见跳过按钮和对应样式/ref/操作提示；dialog自身接收焦点。最终时序：0–2110ms写字/收笔，完整停留到2850ms，2850–3200ms文字淡出，3200–4100ms玻璃显影，随后自动关闭。重播和Esc保留。
- 真实桌面/手机浏览器观看：完整HEY.与下划线已完成时，artwork opacity仍为1、glass仍blur20px（桌面），之后自然进入首页；开场AX中无按钮。Tab在开场内，结束回首屏；390×844手机完整字样与磨砂阶段可见，页面无横向溢出。
- 鼠标背景已接入heroStage，使用暖金/灰绿流体canvas，人物/文本在上层。真实鼠标拖动触发了WebGL像素；初版雾团偏宽，经一次定向调参收窄半径、增强旋度、降低滤镜模糊，保留柔雾外观。
- 实操验证：停止输入后canvas hidden；手动关闭后鼠标不再触发；打开站主登录后canvas hidden、表单可正常打开；滚入档案后绘图缓冲回1×1且hidden，返回首页移动后恢复1265×800并visible。手机display:none。最终浏览器无error/warn日志。后台、认证和存储未改，不重复站主保存/HTTP全流程。
- 最终重新执行 `npm run lint --prefix frontend`、`npm run build --prefix frontend`，均退出0，含TypeScript与生产构建。站点JS块54.39KB（gzip17.48KB），无新增依赖或大块警告。
- [独立审查](../ai/tasks/003-fluid-review.md)未发现确认的P0/P1/P2。生命周期20/20与GPU分配/失败180/180为真实模块+模拟DOM/GPU的定向断言；不是浏览器或真实硬件全覆盖。系统reduce、实际隐藏标签、WebGL硬件丢失未在浏览器注入，按源码/模拟证据记录。
- 最终效果截图：`docs/designs/personal-site/evidence/home-intro-complete-v3.jpg`（完整签名、无跳过按钮）、`home-fluid-desktop-v3.jpg`（流体过程的一帧）。动态以本地预览为准。
- 保留同工作区的Unslop精修及其报告，本轮最终构建包含已集成结果，没有覆盖或回滚其文案/样式。未提交、推送、部署。

## 第四轮用户反馈：首载、控件语义、提示与音乐（2026-11-07，已验证）

用户实际截图显示首次进入停留在RouterProvider纯色HEY占位，登录错误红框挤占表单。明确要求删除页脚重看/回首屏两按钮，将登录错误改message式独立tips；另已明确选择加入背景音乐及音源配置。沿用现有UI风格与单站主权限，不改注册/账号规则。

- P14 首载代理：调查冷启动的路由懒加载、intro与主图准备时序，用轻量、能立即显示的开场替代纯色HEY占位；完整写完+停留再显影，无跳过按钮。避免session标记在失败/未完成前被消费；同站内返回不反复阻塞，硬刷新可重新有完整入场。主要改App/router/site-intro及必要新启动组件，先给根接口以避免改site冲突。验证加载完成、失败/降级、减少动画、无双重开场。
- P15 tips代理：新增独立SiteTip组件/消息API或hook，奶油/橄榄底与暖色状态图标、短文案、出现/消失、自动关闭与可手动关闭，支持屏幕阅读与reduce。原生dialog里也必须可见（注意top-layer），不得通过全局z-index假定覆盖dialog。登录本地校验/认证失败改浮层提示，移除撑开表单的大错误框；失败保留输入、重复失败能再提示、忙碌互斥及恢复/切换失败仍可处理。只写components/site-login/site-tip。
- P16 根：删除页脚两个操作按钮及无用状态；把播放/暂停图标改成明确“动效 开/关”。集成启动/tips/音乐并进行浏览器验收，不回滚并行Unslop精修或流体组件。
- P17 音乐配置：用户已选择加入。新增可保存的音源配置与音量，站主权限/CSRF/原子版本保存沿用；无配置时不显示假播放入口。音频不默认自动播放，访客主动打开后播放；独立音乐控件，不把动效开关当播放器；后台预览不自动出声。格式与实现接口由根冻结后追加。

先处理已明确范围，必要检查按新增代码风险执行；后端仅在音乐合同变更后重跑相关HTTP。没有提交/部署授权。

P17冻结合同：SiteContent增加`music: { enabled:boolean; title:string; sourceUrl:string; volume:number; loop:boolean }`，默认false/空/空/25/true；volume为0–100整数，title最多80。sourceUrl空或安全http/https或本站音频资产路径，enabled=true要求非空音源。旧数据库记录和旧客户端缺失music时补默认以兼容；新返回始终有music，未知字段仍拒绝。新增站主音频上传入口`POST /api/site/audio-assets`（Session+Owner+CSRF），MP3/WAV/OGG限15MiB，实际文件头与安全随机文件名，GET沿用受控媒体目录并返回正确音频类型/nosniff。后台“外观与动效”内新增音乐区（音源URL/文件上传、名称、音量、循环、启用），全站草稿统一保存，文件上传本身不发布。服务端不代理下载外部音源。公开播放由访客主动点击开始，加载/播放失败使用SiteTip，暂停/导航/配置变更清理；未配置不出现假按钮，后台预览静音不自动播放。管理员可后续提供自己的音频，不编造已选音乐。


### P14–P17实际验证（2026-11-07，未提交工作区）

- P14完成：入口静态导入，路由继续懒加载；移除原纯色HEY占位与session seen机制。硬刷新播放、同App内返回不重复；完整书写到2110ms、停留到2850ms后才准许淡出/显影，首页数据与主图decode未准备好继续保持，资源8秒降级、CSS异常12秒可见时间兜底。有页面重试入口，深链阅读面板等待开场结束再showModal。
- P15–P16完成：移除页脚「重看开场」「回到初次见面」两按钮；无可见跳过按钮。视觉效果明确「动效 · 开/关」，音乐单独控制。登录错误采用独立奶油色SiteTip、自动/手动关闭，在原生dialog内浮动；无撑开表单红框。音乐异步错误遇到原生弹窗时暂存，关闭后再提示。
- P17完成：音乐配置/上传、兼容默认、权限与草稿原子保存已接通；无默认音乐。具体合同与格式边界见上段及[实现报告](../ai/tasks/003-music-config.md)。上传音频必须由浏览器实际解码，容器识别不保证每个文件均能播放。
- 最终前端 `npm run lint --prefix frontend` 与 `npm run build --prefix frontend` 均退出0、无lint警告、含TS。站点JS56.23KB（gzip18.07KB），无新增依赖。后台音量滑杆补橙色主题，React18图片优先级属性改兼容写法。
- 音乐代理最终 `npm test --prefix backend` 含构建：67/67、5套件、0失败/跳过/取消。新增8条HTTP覆盖音乐默认/严格校验/权限/CSRF/大小/签名与读取；WAV A-law/μ-law独立审查遗漏已补正例修复。日志 `/tmp/nest-backend-music-final.log`，根已核对。
- [独立增量审查](../ai/tasks/003-entry-tips-player-review.md)已关闭P2，无未关闭P0–P2。实际TSX/hook模拟：播放器/提示34、登录33、独立入口37；音乐API解析23。以上是定向模拟与静态审查，不作为真实浏览器覆盖；根另重跑播放器/提示34/34。
- 真实浏览器：新标签初次即开场，完整HEY/下划线、模糊背景保持，随后自然进入；`?view=about`刷新先开场再阅读dialog，Tab不穿透开场。后台/官网客户端切换无重复开场。613px精确鼠标窗口移动后canvas可见598×800；非手机宽度硬禁用已移除，触摸/系统reduce仍禁用。
- 登录空提交浮层可见，输入框top406.57px、height47px前后不变；实际密码错误及重复错误均可再提示/关闭、保留输入，正确登录进入后台。测试结束退出会话。
- 真实音乐链路：上传原创4秒WAV测试音→草稿→启用保存v3→公开默认暂停→点击播放成功→暂停；390px音乐/动效并列且无横向溢出。临时无效音源保存v4，播放失败使用同一SiteTip且返回可重试。最后清空名称/地址并关闭保存v5，刷新确认持久化；真实个人/作品内容保持原样，临时文件不再被配置引用。
- 配置桌面与390px手机均检查上传/音源/音量/循环/启用区；没有用默认曲目替代用户选择。手机软键盘、系统reduce切换、真实隐藏标签和长时间慢网未注入浏览器，按模拟/源码证据记录。
- 浏览器过程中捕获Vite旧热更新动态模块加载失败（模块HTTP探测均200），重启原开发进程后新载入恢复；生产构建独立通过。错误页保留仅开发环境message诊断。此过程不表述为已模拟生产网络故障。
- 完整开场、登录独立提示、音乐配置与手机播放器的文字验证见上文，历史截图已清理。手机播放器当时使用临时QA音源，仅为功能验收，最终配置无音乐。

## 能力场景初版（2026-11-07，历史记录；已由P18替代）
用户提供双场景连续转场规范V1.0。保留原舞台和作品档案，在首屏增加能力文案、坐姿人物、四组技术、轨道、01/02按钮与触摸切换。当前为初步CSS交叉淡入实现，1900ms互斥，支持inert与系统reduce。
验证：前端build、lint通过。浏览器未执行。尚未达到完整验收：共享可逆时间轴、人物面部匹配、资源提前解码、技术标志、手动减弱动效一致性和桌面/手机实际视觉仍待完成。本轮不得视为规范全部交付。

### P18：连续双场景完整实施计划（替代P14初版，2026-11-07）
目标：同一heroStage内欢迎→能力，保留独立作品档案与配置能力。技术栈React/Less，使用原生Web Animations共享时钟，不新增动画库。
验收AC18-1原欢迎视觉与固定导航；AC18-2能力文案/AI、前端、后端、部署技术标志及人物；AC18-3共用1900ms时间轴正反播放、互斥；AC18-4人物面部连续/无遮挡/图片解码和失败降级；AC18-5手机横向卡片/滑动/键盘/状态播报；AC18-6系统及手动reduce/后台预览；AC18-7桌面手机浏览器与静态检查。
- [x] T1：`pages/site/use-capability-transition.ts`及定向测试：同一动画集合currentTime正向与反向采样、同步互斥、reduce途中直接到端点、卸载清理。先失败断言，再实现验证，不安装测试框架。
- [x] T2：`pages/site/capability-content.tsx`及对应Less模块：分类/技术SVG标志、focus/click详情、移动横向卡片，素材桌前MacBook透明人物与WebP；不改旧档案人物。
- [x] T3：`pages/site/index.tsx`/`style.module.less`接入共享时钟，原欢迎样式保持，导航/底部/焦点/触摸、资源预decode、失败后原人物降级。手动关闭动效也跳至端点。
- [x] T4：lint/build、桌面1440×900/平板/390及320手机、正反/重复点击/卡片触摸/reduce浏览器；独立审查本轮文件，结果写回本节与STATE。
重点风险：手机卡片横滑误触场景、焦点留在inert子树、慢图/坏图、preview重复挂载、reduce中途切换。不得提交/推送/发布；保留已有未提交改动。


P18实现与验证（2026-11-07，未提交）：
- 新增独立能力卡片与共享时钟hook，文字/人物/局部光照/轨道/卡片/发现提示全部从同一1900ms进度采样，反向复用。同步ref互斥，停止/系统reduce立即到请求端点；隐藏/弹窗暂停，卸载取消，无空闲RAF。
- 人物采用imagegen参考现有两张身份图生成桌前MacBook关键帧（Apple标志），PNG原图保留，1312/768宽透明WebP约157/61KiB；srcSet与预decode使用相同sizes。8秒终态，错误用旧人物降级。没有新增3D/动画运行依赖。
- 本地SVG技术标志+名称全覆盖，Codex采用OpenAI所属品牌图形；鼠标/焦点/点击说明，卡片内层缩放不覆盖外层时钟transform。手机/窄预览为横向snap，排除卡片手势；持续控制接收焦点，隐藏内容inert，端点后更新状态播报。
- 根最终重新运行lint/build均退出0，无lint警告，含TS。实际hook模拟47断言、实际页面TSX整合模拟39断言通过；明确非浏览器覆盖。没有前端test脚本或新增测试框架。本轮未改后端，未重跑后端HTTP。
- 独立审查发现三项预览/reduce P2已关闭。实际Chrome发现开发HMR端点恢复缺陷（状态1/动画0），新增先红后绿重建用例修复；另把heroStage overflow:hidden改clip，避免焦点/自动scrollIntoView把舞台内部滚动153px；发现提示纳入时间轴避免覆盖Apple。浏览器最终矩阵正在复验，截图以最终版本为准。
- 任务证据：[时间轴/页面模拟](../ai/tasks/003-capability-transition.md)、[人物素材](../ai/tasks/003-capability-asset.md)、[技术卡片](../ai/tasks/003-capability-cards.md)、[集成](../ai/tasks/003-capability-integration.md)、[独立审查与浏览器](../ai/tasks/003-capability-review.md)。

## P25：后台预览布局修复（2026-11-07，已验证）

用户指出后台预览右侧空白、内外滚动条、能力标题断行和卡片裁切。根因：1040px嵌套div画布读取外层浏览器的vw/vh/media/matchMedia；scale上限1导致宽框内留白，560px框装720px预览舞台且两层overflow:auto。修复保留用户全部草稿、真实配置和P21–23光圈/850ms转场。

采用同源独立iframe预览入口，使CSS与JS真正读取预览自身viewport；不是父React portal跨realm挂载。桌面以1440×900为基础，在更宽预览区使用等比宽度，画布完整等比适配外框；手机390×844居中并等比缩小。移除旧.preview场景布局覆盖，不改变公开页视觉规则。外框精确包裹缩放后的画布，没有框内单侧黑边或因固定高度截去舞台；页面正常纵向滚动仍可保留，阅读弹窗和能力名单保留各自必要滚动。

草稿只通过同源、匹配父子window的postMessage内存传递，不放URL/存储、不自动保存。接收方校验消息与数据结构，允许编辑中的空文案/空昵称；不重新挂载场景来同步每次输入。预览仍禁用站主登录/音频/外链离开，保留场景和关于/联系交互。

验收：AC25-1桌面1889/1440/1280后台的预览画布与外框尺寸一致，无横向溢出、单侧黑边、标题异常折行或卡片越界；AC25-2手机预览及390后台可切换、完整看到场景控制，CSS/JS均使用iframe尺寸；AC25-3连续草稿输入即时同步且不重置场景，坏来源/错误结构消息忽略，旧草稿与用户会话保留；AC25-4真实浏览器操作、DOM几何与lint/build通过，文字记录实际结果，公开页场景回归，不修改开发数据库。

实施清单：
- [x] D1 独立静态诊断：`docs/ai/tasks/003-preview-layout-diagnosis.md`，定位viewport错配与跨realm边界。
- [x] D2 预览代理：新建admin的`site-preview.tsx`（父）、`preview-page.tsx`（子）、`preview-protocol.ts`/必要几何辅助与独立Less；先失败断言再实现尺寸计算/消息来源/空草稿同步。只改新文件，报告`docs/ai/tasks/003-preview-layout-implementation.md`。
- [x] D3 根整合：替换admin/index.tsx本地Preview，router接`/admin/preview`，清理site/style.module.less只作用preview的布局补丁；1889/1440/1280/390浏览器及公开页回归、lint/build、独立审查，更新STATE。

验证记录（2026-11-07）：

- 原浏览器红证据：1920外窗时预览框1220×560、画布1040×560，内容720高；标题76px/两行，右卡片越界，内外两层滚动。独立同源iframe修复viewport与JS realm，移除旧preview专属布局补丁；未改公开页尺寸规则。
- 新几何/消息模块36项、实际TSX生命周期边界模拟14项均通过；这些不是浏览器测试。前端lint与build退出0（含TypeScript），无新依赖/测试框架。后端未改，未重复HTTP全套；[独立审查](../ai/tasks/003-preview-layout-review.md)无P0/P1/P2。
- Chrome桌面1889/1440/1280下画布宽与外框宽分别一致为1189/790.89/638.56；对应子viewport始终1440×900、文档scroll同尺寸。标题89.859px高/89.856px行高，仅一行；四卡全部在舞台内，预览无单侧黑边、内部横纵滚条、卡片裁切或整页横溢出。桌面最终默认1920时框/画布均1220×762.5。
- 手机设备390×844、居中并适配窄框；390/320后台的可见预览335×724.97/280×605.95，子文档始终390×844且无整页横溢出。手机技术卡片仍按原公开合同横向浏览，未禁用名单/阅读面板必要滚动。
- 独立临时Mongo与localhost:5174/3001：能力昵称连续改为测试文案、清空、恢复Codex，子内容即时更新且场景保持1；切设备/后台分区不重置场景，手机导航、关于面板、Esc关闭通过，预览站主登录禁用。坏origin/source/结构由36项模块断言验证，未做浏览器消息注入。直接打开/admin/preview显示等待说明。
- 公开页1440/390两场景及终态、无横向溢出已回归；最终实际后台只读用户v6、保存按钮disabled。临时服务已停止，两次启动涉及的随机测试库和媒体目录均清理，审计0残留；未写真实配置/退出用户会话/提交/推送/部署。viewport已reset并保留修正页面。
- [根整合证据](../ai/tasks/003-preview-layout-integration.md)，截图evidence/preview-fixed-{1889,1440,1280,mobile390,mobile320,real1889,final}-v10.jpg及preview-regression-public{1440,390}-v10.jpg。真实iOS/Android触摸、Safari/Firefox、系统减少动画、断网/真实409面板本轮未新增浏览器验证；多实例和握手仅源码/模拟覆盖，不扩大成功范围。

## P19：我的能力站主配置（2026-11-07）

用户要求把已有 AI、前端、后端、部署四类能力接入前后端配置，并搜索全栈开发常用品牌图标。沿用当前人物、场景时间轴和四块公开卡片；后台新增「我的能力」分区，以四个 Tab 作为固定类型，选择项展示本地 SVG 和名称。技术目录是可选素材，不表示站主掌握全部技术；默认继续展示当前九项，不自动扩充公开技能。

设计选择：在现有版本化 SiteContent 中增加 `capabilities: { ai: SiteCapabilityItem[]; frontend: SiteCapabilityItem[]; backend: SiteCapabilityItem[]; deployment: SiteCapabilityItem[] }`，`SiteCapabilityItem = { icon: string; name: string }`。本地图标白名单代替任意 SVG 字符串或第三方热链；不新增依赖、上传 SVG 或独立发布接口。名称可自定义昵称，纯文本 1–40 个 Unicode 字符且不可纯空白；每类最多 12 项，同类 icon 唯一，顺序即展示顺序。四类始终存在且可为空；空态明确显示未配置，不回填默认。只有整个 capabilities 缺失时补原九项默认，兼容旧库和旧客户端；显式 null、数组、不完整对象、未知字段、未知图标均拒绝。

验收：
- AC19-1：后台「我的能力」四个 Tab，按类别提供可搜索的图标+名称 Select，可添加、改图标、编辑昵称、排序、删除；类别间草稿保留，同类不重复，12 项上限，空态可恢复添加。
- AC19-2：编辑进入现有共享草稿和未保存预览；保存全部后公开 API/刷新同步，失败和409保留草稿，沿用 Session/Owner/CSRF 与原子版本保存。旧库读取补默认不写库、不改版本；保存持久化并可经应用重启读取。
- AC19-3：公开四块卡片仅展示配置列表，本地 SVG+昵称；空列表明确提示，长名称/12项不遮挡人物和场景控件，桌面及320/390手机可读、可操作。卡片不引发场景横滑。
- AC19-4：图标来自全网搜索核实的品牌/开源来源，落地本地静态 SVG，记录来源与许可；不执行注入 SVG。保留现有默认九项，不伪造新技能。
- AC19-5：HTTP覆盖兼容、合法保存/排序/空列表、未知字段/图标/重复/超长/超限/错误形状、权限与版本冲突、重启；前端运行时解析与后端同合同，lint/build及桌面/手机浏览器分别记录实际结果。

实施清单（writing-plans；沿用当前分支和工作区，无提交/部署）：
- [x] C1 图标代理：`frontend/public/site/tech/` 搜索下载与来源记录，校验静态 SVG；报告 `docs/ai/tasks/003-capability-icons.md`。AC19-4。
- [x] C2 后端代理：`backend/src/site/{types,config,dto}` 与 `site.service.ts` 加入能力类型、白名单、缺失兼容和校验；`backend/test/site.e2e.test.mjs` 先失败HTTP测试，再实现，全套测试；报告 `docs/ai/tasks/003-capability-config-backend.md`。AC19-2、05。
- [x] C3 前端代理：新建独立能力编辑器与样式，修改admin分区/图标入口及公开能力卡片，接入共享草稿，移动列表滚动与昵称换行；报告 `docs/ai/tasks/003-capability-config-frontend.md`。AC19-1–3。
- [x] C4 根整合：`frontend/src/types/site.ts`、能力目录/默认与API运行时解析；检查图标目录/两端合同，lint/build、HTTP与浏览器验证，独立审查；更新README、架构及STATE。AC19-1–5。

审查重点：缺失与显式空值区别、跨类/跨Tab草稿、未知图标不可拼接外部URL、较长列表的卡片高度、预览dirty及保存互斥。前端无测试框架，使用现有静态检查及实际模块定向断言、真实浏览器，不新增框架。

### P19实际验证与交付

- 后端先运行新增HTTP红测5/5失败，再实现；最终 `npm test --prefix backend` 对应完整72/72、5套件、0失败/跳过/取消，包含构建、独立真实Mongo、重启持久化及权限/CSRF/409。日志 `/tmp/nest-backend-capabilities-final.log`。本轮后续修复只涉及前端，未重复后端测试。
- 最终前端lint退出0、无警告；build退出0、含TypeScript、无大块警告，日志 `/tmp/nest-capability-config-frontend-final.log`。实际API模块22/22、实际UI模块18/18、保存定位7/7定向断言通过；前端没有test脚本，这些模拟不替代浏览器。
- Chrome桌面1318像素、390×844及320×740：四Tab/搜索图标/明确添加/改图标保留昵称/连续输入预览/跨类草稿/排序/删空与公开空态/保存版本1/公开新访问同步；版本2十二项与40字昵称边界；旧版本保存409保留输入。后台12项时添加禁用。390和320后台/公开整页无横溢出；桌面后端列表高108/内容440、手机高85/内容284，12项均存在、End可滚到最后redis（scrollTop199）。
- 独立审查两项P2已修复复审：全站保存预检共享草稿无效昵称，自动切能力分区/目标Tab/手机编辑面板并聚焦可见输入，桌面从其它分区及手机从预览保存均实际显示必填提示；内列表仅纵轴contain，实际从技术列表区域水平滚动外层scrollLeft5→493且页面位置不变。原生水平滚动不是手机真机触摸；触摸分流另有源码和模拟证据。
- 图标38可选项+旧openai兼容文件共39个，约60KiB；固定版本来源、许可、逐项下载/校验值在 `frontend/public/site/tech/SOURCES.md/json`，39/39 XML与静态元素验证通过。默认保持原九项，不自动把可选目录变成公开技能。
- 浏览器写入只发生在localhost:5174/3001的随机临时Mongo库；测试退出后服务停止、临时库清理审计无残留fixture、空媒体目录删除。关闭临时服务时驱动报告一次MongoClientClosedError（信号关闭与测试清理重叠）；独立审计确认库已删除，开发库未变。原开发watch进程在并行构建中停止监听，已重启相同开发命令，3000/5173恢复，公开配置仍v5、九项且图标全部加载。
- [根整合报告](../ai/tasks/003-capability-config-integration.md)、[独立审查](../ai/tasks/003-capability-config-review.md)；截图 `evidence/admin-capabilities-{desktop,mobile}-v7.jpg`、`capabilities-{current,desktop,list-mobile,list-320}-v7.jpg`。最后保留正式5173能力页，动效开，临时尺寸已reset/临时标签已关闭。未提交/推送/部署。
- 边界：此次未实操真实iOS/Android触摸、软键盘、Safari/Firefox/Edge、真实断网或会话过期注入；相关权限/异常由HTTP及现有store边界覆盖，不宣称跨浏览器或真机全覆盖。

### P19后续：导入报错与官方SVG（2026-11-07）

用户反馈后台Vite错误及要求直接使用官网SVG。已复现 `use-orbit-card-windows` 尚未落地时引用导致TS2307及开发模块HTTP500；该模块由并行P21补齐后，根重新执行TS检查通过、模块请求200。P21后续又将入口改用实际存在的 `use-orbit-occlusion`，根核对当前首页所有相对导入无缺失、构建通过。根未覆盖并行光圈实现。

图标优先使用官网公开下载或品牌官方仓库的静态SVG；仅替换实际核实下载的项，无官方独立图形时明确说明替代来源，不把所有图标宣称官方直取。保留本地slug与38项配置合同，来源/许可/哈希同步SOURCES。公开与后台Select移除统一白色滤镜，保留原文件颜色，增加浅色小底保证黑色品牌图形可见；本次无接口或数据变化，验证限前端静态/构建、SVG资源和实际页面。

本次结果：13个SVG文件（12个可选项+openai兼容文件）升级为品牌官网/官方CDN或官方组织资源，覆盖用户当前可见九项；26个文件仍为原开源库来源，边界逐项记录。Codex未找到独立可分发SVG，使用OpenAI官方黑色Blossom替代并明确标记；所有path保留原始几何。静态SVG、原始来源/转换与哈希由图标代理及独立审查核对，见对应报告。

本轮重新执行TypeScript检查、lint、build均通过（`/tmp/nest-official-svg-final-build.log`，一次并行构建存在耗时提示，不影响成功结果）；39个本地SVG的真实HTTP均200且类型正确。Chrome正式后台已登录页面、四Tab和图标Select正常，公开当前九图全加载且computed filter=none，无Vite错误遮罩；本轮只读观察用户v6（React/Vite/TypeScript），未保存、退出用户会话或改数据库。截图 `evidence/official-svg-admin-v8.jpg`；当前光圈并行功能由P21负责，不以本轮图标检查扩展其视觉验收。

用户继续指出图标没有颜色：除了原全白滤镜，剩余开源文件也大多是单色版。补齐有标准彩色表示的图标，优先固定版本Devicon original及Lobe color原始SVG；仅确为单色的品牌图形按同版本Simple Icons官方元数据hex设置颜色，不凭记忆指定色值。保留13个已核实官方来源文件；Codex/ChatGPT/Cursor及Ollama/Express/GitHub/Next.js/Vercel等黑白表示保留原样。仍不新增选项、修改slug/数据合同或改变用户配置。

颜色补齐已完成：21项更新（17个Devicon原色SVG、Gemini原色版，Nginx/Tailwind/SpringBoot保留独立mark按固定元数据上色），38项中30有品牌色、8保留黑白。Nginx未使用小尺寸难读的横wordmark，JS保留黄底黑字、Python保留蓝黄等多色。13个官方文件哈希未受本次颜色补齐影响；Codex/OpenAI兼容图另仅裁紧viewBox，路径不变。39文件总302532B，来源、转换、字节和哈希已同步SOURCES，原色资源与静态内部引用经独立复审。

最终构建（含TS）退出0，日志 `/tmp/nest-brand-colors-final-build.log`；样式在前次lint后无变化，沿用该lint通过结果。39SVG HTTP均200、类型正确，首页模块200。Chrome后台前端Tab的选择器实际显示彩色JS/HTML/CSS/Vite等，页面内56张技术图片全部加载且filter=none、无错误遮罩，保存按钮仍disabled、用户配置仍v6（本轮未写入）。截图 `evidence/brand-colors-admin-v9.jpg`；本轮不重复后端HTTP或将未测试真机/多浏览器描述为新覆盖。


P18最终验收边界：
- 最终代码的前端lint/build均通过，日志`/tmp/nest-capability-final.log`；hook47与页面39定向模拟通过。源码/样式独立审查发现的问题已修复，未增加后端行为或依赖。
- Chrome实际浏览器：1440×900、768×1024、390×844、320×740两场景；正反、快速重复点击、卡片点击展开/折叠、Tab详情、手机尺寸Enter往返与焦点不落inert内；反向中途关闭动效立即到01、关动效进入02、关闭动效卡片不缩放，最后恢复动效。clip后舞台内部scrollTop=0。320扣滚动条后clientWidth=305且scrollWidth=305，无整页横向溢出。
- 390/320人物按源图裁切比例匹配双眼位置及尺寸，欢迎文案与头发不再重叠；欢迎端点隐藏卡片容器与滚动条，能力轨道没有竖滚条；768人物改为靠上定位，上下技术卡片避开眼睛和发型主区域。手机卡片实际横向wheel滚动scrollLeft5→493且scene保持1。触摸事件分流另由39条页面模拟覆盖，不把wheel称为真机滑动。
- 8张最终Chrome证据为`evidence/capability-{welcome-,}{desktop,tablet,mobile,mobile-320}-v5.png`，均在设计证据目录。Chrome预览留在首页、动效开启，临时viewport已请求reset。
- 验证限制：Safari原生工具单次30秒连接超时，未能实测；Firefox/Edge、真实iOS/Android设备触摸、系统OS reduce开关、真实慢网/断图注入、后台真实登录预览未实操。系统reduce/图失败/超时/卸载与预览容器逻辑有源码和模拟证据；不把这些描述成浏览器全覆盖。实现及Chrome验收已交付，跨浏览器/真机补验仍属后续兼容验证边界。
- 初次根CUA会话超时，经独立新Chrome标签恢复验收；开发HMR恢复与内部scrollIntoView问题均已在真实浏览器复验修正。不将工具连接超时描述成产品故障。

### P20：光圈停留动效修正（2026-11-07）
用户指出能力人物周围光圈进入场景后没有动效。原因：P18共享时间轴只负责650–1300ms展开并停在端点，原轨道与三个光点没有持续动画。
范围：仅公开舞台光圈SVG高光与样式，不改并行P19配置/图标/API。
验收：能力端点沿既有椭圆缓慢流动金色光点；正反转场保持共享时钟；动效关/系统reduce/切换/弹窗/离开首页/页面隐藏暂停或静止，人物与卡片位置不变。
实施：先检查浏览器光点偏移在时间间隔内不变（红）；增加独立SVG描边dashoffset循环与显式运行条件；检查运行/暂停实际样式及时间采样，lint/build，独立小范围审查，回写STATE。

P20完成与验证：
- 外层光圈继续由P18共享时钟控制展开/收回；内层SVG pathLength=100的金色尾迹/奶油色光点使用18秒dashoffset线性循环，三个光点沿椭圆流动，不旋转人物/卡片，无新增JS空闲帧或依赖。清理不再渲染的旧静态i样式。
- 明确运行条件为动效开、能力端点、首页可见、非切换/非开场/非弹窗，隐藏标签用已有visibility状态暂停，系统reduce/手动off禁用循环。手机仍按P18隐藏轨道，不新增遮挡。
- 先在Chrome确认原轨道与三个i的animationName全部none/duration0s；修改后两条描边同步从-59.5336px变为-81.3884px且running，实际截图可见移动光点。手动off后animation none/offset0；阅读面板打开时两次采样均-1.57666px且paused；作品档案时running=false/paused，反向切换也paused；回到能力后恢复running（-34.2627px）。动效最终恢复开，Chrome留在能力页。
- 最终lint/build通过；原共享时间轴47断言回归通过。独立小范围源码审查无P0/P1/P2。截图`evidence/capability-orbit-flow-v6.png`。OS reduce与真实隐藏标签此次未操作，源码策略复用P18，不扩大浏览器证据。
- 本轮同时观察到并行P19配置工作期间公开API502/技术列表占位；未改API/数据/配置，光圈运行/暂停验证不依赖其成功。未提交/推送/部署。

### P21：光圈仅被人物遮挡（2026-11-07）
用户明确：流动光点经过技术卡片不应消失，只在人物轮廓后消失。P20旧层级光圈1/人物2/卡片5使部署面板盖住光点；Chrome修前断言lightAboveCards=false已复现。
实现：不改P19卡片和数据，将光圈独立为全舞台SVG光效层（卡片上方），SVG mask按人物透明alpha扣除轮廓；mask图与人物使用相同响应式尺寸/对齐与共享portrait时间轴，内层轨道继续原orbit时间轴。透明区域不遮光，不用人物矩形框代替轮廓。SVG全层pointer-events:none。
验收：部署/其它卡片上持续可见，头发/面部/衣服/电脑背后隐藏；桌面和平板轮廓位置对应，返回和减少动画保持，卡片点击不受影响。仅本修复，不触碰并行P19配置/API。完成后检查真实浏览器层级与DOM状态、lint/build与时间轴回归、独立审查，用文字记录结果。

P21细化：遮挡依据是“可见人物”。平板部署面板覆盖衣袖，不能让面板下不可见的袖子继续遮光。因此在人物alpha黑孔后追加四组可见卡片/展开说明的白色圆角窗口，按真实DOM表面测量，随卡片共享同一错峰时钟；卡片仍保持原层级与交互。窗口单独使用card-window角色，不混入原card索引。ResizeObserver/卡片内容变化和短暂hover过渡更新测量，空闲不额外轮询；卸载清理。

### P22：三光环等比旋转（2026-11-07，用户最新修订）
替代P20单轨道三光点/尾迹造型：三条不同倾角的细金色椭圆，长短轴同时按1、0.82、0.6724等比缩放（公比0.82），只做30秒缓慢旋转，中环反向；无闪烁/脉冲/光点尾迹。
光效SVG盒改为最大光环完整旋转所需的正方形包络：left35%、中心y54%、width62%、aspect-ratio1，不再占满舞台。旋转时最外椭圆长轴决定正方形包络，所以边界包含旋转余量；人物/卡片遮罩坐标从舞台转换到此局部SVG空间。延续P21“仅可见人物遮挡、卡片不挡光”与原转场/暂停/减弱动态策略。

### P23：即时导航反馈与加速转场（2026-11-07，用户最新修订）
用户指出导航高亮要等能力整屏出现才切换、原1.9秒转场过慢且不丝滑，覆盖P18的慢节奏/端点后导航策略。
- 导航与场景按钮立即反映targetScene，scene仍用于端点交互/读屏内容/三环运行，忙状态播报目标。
- 转场缩为850ms，文字/人物/卡片更早重叠进入，缓动改为cubic-bezier(.4,0,.2,1)。人物与遮罩、卡片与白窗口继续共钟。
- 同目标重复点击忽略；相反目标可在同一条时间轴立即逆播，不叠动画、不重新从头播放，导航不再整段禁用。
- 不因能力图decode而禁用导航/探索；资源未就绪时保留已加载的原人物，decode成功后显示新人物，失败/超时仍降级。mask与当前展示图统一来源，卡片数据读取仍沿用现有store，不引入切场请求。
验证：先红后绿时间轴模拟即时目标/850ms/同帧逆向/暂停reduce/重建；实际浏览器点击后的active与busy同时检查、反向可操作及光环/遮罩，lint/build与独立审查。真机/跨浏览器边界不扩大。

P21–P23最终交付（2026-11-07，未提交工作区）：
- 人物alpha遮罩扣除可见人物轮廓，实际卡片与展开说明白色圆角窗口恢复透光，避免卡片背后不可见衣袖遮光；窗口、人物与共享时钟同步。`use-orbit-occlusion.ts`测量局部SVG坐标、剔除wrapper变换；布局/内容变化与短暂hover同步，空闲无新增测量RAF，卸载清理。
- 3条光环长短轴公比0.82（1/0.82/0.6724），各有初始倾角，30秒旋转、中环反向；不再有P20光点尾迹。光效层为最大旋转包络（宽62%舞台的正方形），不再铺满舞台；转动椭圆需要方形包络的四周余量。关闭动效保留初始倾角。
- 转场1.9秒→0.85秒。targetScene在点击被接受时立即更新顶部导航和场景按钮；scene在端点更新可交互内容。相反目标先补算旧方向帧间时间后沿当前进度逆播，同目标忽略，复用同组动画和单RAF。新P23时钟86断言替代旧P18 47/54断言中的1900ms与整段互斥预期。
- Chrome实测：点击我的能力后aria-current=page且busy=true、settled=0（即时导航）；同段能力→初次见面→能力快速往返后正确到02，无禁用等待。768与桌面三环显示/旋转、局部盒466.86×466.86（768视口）、人物不穿光、卡片仍透光；部署展开时窗口数[1,1,1,2]，再次收起正常。中间帧人物g与DIV同矩阵/opacity，源人物/遮罩同步；关闭动效后3环animation none且静态倾角保留，随后恢复动效开。图`evidence/capability-three-rings-fast-v8.png`。
- 最终前端lint/build退出0；`node /tmp/test-fast-capability-timeline.cjs`86断言、`node /tmp/nest-orbit-card-windows.test.cjs`37条实际模块定向几何/生命周期断言通过。独立小范围审查无P0/P1/P2。没有新增测试框架/依赖/后端变更，未提交/推送/部署。P19卡片与图标配置的并行改动保留，未将其测试纳入本修复结论。
- 本轮重点实操Chrome桌面/768；手机此前策略仍隐藏轨道，未重新扩大到真机触摸、Safari/Firefox、OS reduce/真实隐藏标签/慢网，相关边界沿用既有源码与模拟证据。预览留在我的能力、动效开，临时viewport已reset并实际观察默认尺寸。
