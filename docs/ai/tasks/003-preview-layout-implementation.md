# P25-D2：独立官网预览实现

- 核对日期：2026-11-07；基准82acde8，保留已有全部未提交与并行移除作品档案改动。未提交、换分支/worktree、部署或写配置/数据库。
- 范围：仅新增`frontend/src/pages/admin/{site-preview.tsx,preview-page.tsx,preview-protocol.ts,preview-geometry.ts,site-preview.module.less}`与本报告。后台入口/路由整合、公开页preview旧布局清理、SPEC与STATE由根任务负责。
- 状态：模块已实现并自查；实际浏览器与全前端检查交根任务统一验收，本文不把模拟断言作为浏览器证据。

## 实现

- `SitePreview`保持`{ content: SiteContent; device: 'desktop' | 'mobile' }`接口和named export。iframe入口为`/admin/preview`，标题区分“官网桌面预览”与“官网手机预览”。真实子页面执行自己的JS模块，不使用父React portal。
- 独立100%宽host负责测量；`useLayoutEffect`首帧读取实际宽度，ResizeObserver继续观察并忽略0/非有限宽。桌面画布为`max(1440, round(width)) × round(canvasWidth×900/1440)`，外框精确等于缩放后完整画布。手机固定390×844、窄区等比缩小、宽区居中。iframe绝对定位且左上缩放，无560px限高或新的滚动包装层。
- 父组件observer在render中`JSON.stringify`读取整个草稿，发送JSON纯快照，支持同一MobX对象的深层字段变化。load、ready与内容变化发送当前草稿；改设备只改iframe尺寸，不加key、不刷新iframe或重挂SiteExperience。
- 消息统一type常量，两端都校验当前window引用与同源origin。子先注册监听再ready；只接受同源parent的完整结构草稿，空必填文案、空能力昵称、正在编辑的暂空音源仍可同步。profile/home/contact/appearance/music/四类capabilities及每个列表元素均检查运行时类型，坏数据忽略并保留最后有效草稿。
- `SitePreviewPage`固定inset0铺满自身viewport，只渲染收到的`<SiteExperience content={draft} preview />`；直接打开仅显示等待说明。新增模块不读写URL/localStorage，不调用公开或管理API；登录/音乐/外链禁用继续复用原preview合同。

## 验证证据

1. TDD红：实现前实际运行Node断言`existsSync('frontend/src/pages/admin/preview-geometry.ts')`，按预期退出1，指出缺少独立1440×900画布模块。原问题的实际浏览器红证据由根任务记录（1220×560外框/1040画布/内部720内容/标题两行/右卡片超界）。
2. 实际几何与消息协议模块：**36/36通过**。覆盖1220宽桌面→1440×900缩为1220×762.5、1889宽自适应、宽度取整与不放大、390×844及320等比缩小；同源/source/未知type/空消息限制、允许空草稿，以及20种缺失/错误嵌套字段忽略。脚本`/tmp/nest-preview-geometry-protocol-check.mjs`，日志`/tmp/nest-preview-geometry-protocol-check.log`。
3. 实际TSX经项目现有Vite转换，最小hooks/DOM边界模拟：**14/14通过**。执行实际父/子组件逻辑，检查host测量、frame布局、load/ready补发、深层草稿变化、0宽保护、设备切换、RO/listener清理、子先监听后ready、坏消息保留已有草稿、直接打开等待。脚本`/tmp/nest-preview-component-check.mjs`；这是生命周期模拟，未声称真实React挂载、MobX调度或浏览器布局已验。
4. 自查当前SiteContent完整形状、SiteExperience的preview分支及SiteStore构造过程：预览入口不触发SitePage.load；preview不报告首载、不打开登录、无音乐组件/音频实例、链接默认行为被拦截；几何/消息文件无新增依赖。

复验命令：

```bash
node --experimental-strip-types /tmp/nest-preview-geometry-protocol-check.mjs
node --experimental-strip-types /tmp/nest-preview-component-check.mjs
```

## 根任务待整合验收

- 用`SitePreview as Preview`替换后台本地组件，添加`/admin/preview`独立路由，移除旧preview缩放与场景尺寸覆盖。
- 统一lint/build；真实桌面/390/320后台检查标题/卡片/三环完整、无黑边和重复滚条、手机居中及外层纵向可达。
- 真实浏览器连续草稿/跨Tab/换图标、设备切换保留场景与展开状态、about/contact及409最新版本预览。独立入口检查无公开/管理配置请求；继续保持未保存草稿与公开配置隔离。

## 整合后模块复验

2026-11-07，根任务完成入口/路由/样式整合后，重新执行上述两个实际模块脚本：几何协议36/36、组件生命周期模拟14/14，均退出0。只读复核当前父/子模块及后台/路由/preview样式整合，未发现阻塞问题。本次仅更新本报告；未重复全量lint/build，未操作产品、STATE/SPEC、数据库或浏览器。最终浏览器与全量检查证据以根任务记录为准。

- 整合归档注：本任务编号统一为P25，避免与并行P24作品档案移除冲突；根任务最终浏览器与清理记录见[整合报告](003-preview-layout-integration.md)。本报告的独立审查/模拟范围不因此扩大。
