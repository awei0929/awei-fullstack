# 后台官网预览布局：静态根因诊断

- 核对日期：2026-11-07；基准82acde8，当前大量未提交工作区。已读根AGENT、STATE、前端AGENTS、SPEC-003 P19及P21–P23。
- 范围：只读源码与几何推导；仅新增本报告，未修改产品代码，未跑测试、浏览器、提交、部署或读写数据库。截图现象由根任务实际复验，本报告不把推导描述为浏览器证据。
- 状态：根因与最小修复方向已回传整合者。STATE与SPEC由根任务统一维护。

## 已确认的根因

### 固定宽画布没有建立独立viewport

`frontend/src/pages/admin/index.tsx:19–35`直接把`SiteExperience`挂在后台document中，设置桌面1040/手机390的元素宽度，再用transform缩放。元素宽度改变百分比布局和容器查询，**不会改变vw、vh、svh、媒体查询或window.matchMedia使用的后台viewport**。

公开页目前是媒体查询与部分容器查询的混合方案：`site/style.module.less:189–207、271–290、334–388`对preview补部分尺寸，但能力字号和桌面卡片宽仍取外窗vw。`capability-content.module.less:147–148`同时有media/container手机版，无法使其它vw自然变成画布宽。

### “我的能 / 力”换行可由精确尺寸解释

- `site/style.module.less:307–310`：copy宽28%；h2是`clamp(40px,5.2vw,76px)`，字距`-.04em`。
- 外窗1889、画布1040时，copy至多291.2px，h2已封顶76px。4个全宽汉字含4份字距约291.84px，超过291.2px；若预览竖滚条再减少可用宽，超宽更明显。中文允许逐字折行，得到截图中的三字加一字。
- **直接公开页1040时，不存在这一相同的vw错配**：5.2vw=54.08px，4字约207.67px，小于291.2px。即使扣15px滚动条，字仍应放下。768–1023还会命中独立44px字号规则（334–336）。本结论是源码推导，仍需根任务实际浏览器确认。

### 右侧卡片必然超出1040舞台

- `capability-content.module.less:12`：宽`clamp(112px,13vw,210px)`；1889外窗时取210px。
- `:20–21`：后端left82%，部署left83%。画布1040时右边分别为1062.8/1073.2px，即至少超出22.8/33.2px；舞台有`overflow:clip`（site/style:106–116），因此被裁。竖滚条会进一步增加裁切量。
- 真1040 viewport时卡片宽135.2px，部署右边998.4px，能放下。hover放大1.025仍有余量。
- 未发现桌面卡片或公开页存在强制1040最小宽。全局body最小320（`styles/global.less:11`）与此问题无关；公开页已有`body:has(.experience:not(.preview)){min-width:0}`（site/style:381）。

### 右侧空白来自外框和画布的尺寸合同不一致

- `admin/style.module.less:85`把外框设为width100%，但`admin/index.tsx:28–32`把画布锁在1040且scale最大1，桌面不居中（marginInline=0）。
- 1889宽时，侧栏205、编辑栏400（admin/style:7、127）、预览左右padding各40（:78），预览可用宽约1204，而画布仍1040，右侧自然留约160px空区。
- 只换iframe并保持原1040/scale上限/外框满宽，不会自行消除这块空白。应统一外框与实际缩放后画布尺寸，或让桌面逻辑viewport随可用宽变化；不要只给右侧背景补色。

### 竖滚条是当前高度设计的必然结果；横滚条需浏览器定位实际滚动节点

- `admin/index.tsx:30`将桌面视框封顶560px；`site/style.module.less:192`将preview.hero固定720px，且preview根`height:100%;overflow:auto`（:190）。宽窗口scale=1时至少有160px纵向溢出。
- 外层`admin/style:86 .previewScale`又是overflow:auto，形成两层可滚动容器，给内部横/竖滚条和滚动链增加机会。
- CSS能确定“重复滚动容器”及“纵向溢出”；仅凭源码不能严谨断定截图横滚条究竟属于previewScale、experience还是其它节点。根任务应记录这几层client/scroll尺寸再确认，避免把卡片裁切（hero clip）直接等同为外框横向滚动来源。

## SVG边界核对

- `site/style.module.less:315`光环盒是left35%、width62%的正方形，右端97%。1040舞台时宽644.8px。720高时top54%=388.8，translateY(-50%)后纵向约66.4–711.2px，主体盒仍在舞台内。三条椭圆最长半径498/1000留在该旋转包络内（index:290–293）。
- 因此这次右侧大片空白/右卡片裁切已有明确的admin画布/vw来源，无需扩大/移动SVG来遮掩。外层SVG及内层rings的overflow:visible是现有P22旋转策略（style:315、393），不能仅因浏览器检查框有方形空余就认定是错误。
- `use-orbit-occlusion.ts:31–37、75–109`把DOM矩形除以舞台scale再转局部SVG坐标，已考虑外层缩放。需保留人物/卡片共享时钟、白色卡片窗口及ResizeObserver；它们不是本次vw错配根因。

## 最小修复建议与影响

优先把预览改为**同源iframe中的独立预览入口**，iframe内部仍渲染原`SiteExperience content={draft} preview`。iframe CSS尺寸提供真实桌面/手机viewport，再在iframe外统一缩放。这样vw、媒体查询、资源sizes及JS matchMedia都对应预览设备，无需持续复制全部公开页响应式规则。

需要同时解决外框/缩放/高度：只保留一个明确的滚动责任，外框按实际视觉画布宽高收紧或居中；若要求完整舞台，则把720/手机舞台高度纳入缩放，而不是保留560高窗口截取720场景。若保留滚动浏览，应仅有iframe内一个纵向滚动区。

保留草稿与交互的条件：

1. iframe不能直接加载普通`/`后读取已保存公开配置。独立预览入口接收父页面的草稿快照；每次内容编辑只更新props，不刷新iframe或更换组件key，保留场景/卡片展开/滚动状态。
2. 草稿传递可使用同源消息或同源专用桥。消息同时校验origin与source；load/ready后发送最新快照，避免首帧竞态。不要把草稿写入公开API、localStorage或URL。
3. 保留preview=true现有合同：禁登录、静音/无流体、链接不离开编辑页、面板不改父history、无首载开场；手机菜单、能力按钮、卡片及关于/联系仍可交互。409最新版本弹窗复用同一预览组件。
4. 影响范围主要是admin Preview、一个只读预览入口及消息桥，不需要改后端、数据合同、图标、人物或光环造型。

**跨realm陷阱**：只把父React树portal进iframe并不等价于iframe独立启动。父模块词法全局仍是父window/document：

- `site/use-scene-motion.ts:16、36`仍读取外窗matchMedia/innerWidth；
- `site/use-orbit-occlusion.ts:70`的`element instanceof HTMLElement`会拒绝iframe内元素，卡片透光窗口丢失，137/145同理；
- `site/index.tsx:112、171、227`的document.activeElement、instanceof HTMLElement/Element会错过子文档焦点和链接拦截。

若选portal，必须把相关DOM全局、构造器、getComputedStyle及事件目标判断统一绑定到root.ownerDocument/defaultView；范围和风险都比独立预览入口大。独立入口在iframe自己的realm执行原代码，可自然避开这些问题。

备选是不引iframe，给公开舞台统一建立容器，并把所有布局vw改cqw、media响应式改container、所有window尺寸判断改容器/文档测量；但这会触及公开页，不能只补h2和两张右卡片，否则手机/平板仍持续出现分叉。若只做局部热修，至少同步修字体、卡片宽、预览外框尺寸、滚动层级，并明确它不是完整设备预览。

## 根任务待验证

- 1889后台桌面预览：外框无右侧残余空区、仅预期滚动、能力四字一行、四卡片完整；同时比对独立1040公开页。
- 390与320后台预览：真正命中手机版导航/人物/横卡策略，四类12项与40字昵称可达；进入能力、反向切换、展开部署/关于/联系仍正常。
- 连续输入/跨Tab/更换图标能同步草稿；iframe尺寸切换不误请求保存；父草稿与公开版本均不受浏览预览影响。
- 光环可见/人物遮光/展开卡片透光与850ms中途反向正常；独立入口不能倒退P21–P23。
