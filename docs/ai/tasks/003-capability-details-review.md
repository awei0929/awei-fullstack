# P28 能力三卡与履历详情独立审查

- 核对日期：2026-11-08（Asia/Shanghai）；基准 `82acde8`，交付仍为大量既有未提交改动的工作区。
- 范围：以 `/tmp/nest-p28-review.diff` 对照 `/tmp/nest-capability-details-before` 的本轮 24 个源码/测试/依赖声明文件为依据，逐项阅读当前源码；另核对当前 `capability-details.module.less` 的最新 Markdown 间距修正、锁文件中的两项新依赖及实现报告。未用空的 Git 提交范围代替新增未跟踪文件审查。
- 已读 `AGENT.md`、`docs/ai/STATE.md`、架构概览、前后端 `AGENTS.md`、SPEC-003 P28 与后端/配置实现报告。本代理只写本报告；未改产品源码、运行测试套件、操作浏览器、写开发 Mongo、提交或推送。

## 发现与定向复审

最终状态：两个 P2 均已修复并完成本代理定向静态复审，当前无未关闭 P0/P1/P2。以下保留初审触发与修复依据。本次复审仅读取 `index.tsx` 与 `capability-details.module.less`，未扩审或重跑套件。

### 已关闭 P2：能力深链在读取失败时显示“尚未公开”，模态中没有错误与重试入口

- 位置：`frontend/src/pages/site/index.tsx:330–334`，`frontend/src/pages/site/capability-details.tsx:45–58`。
- 触发：直接打开 `/?view=company`、`/?view=projects` 或 `/?view=technology`，首次 `/api/site` 请求失败；也可在初次读取失败后从舞台打开能力卡片。
- 静态证据：`SitePage` 无文档时传入 `welcomeContent`，同时传入 `loading/error`；三种能力分支直接渲染 `CapabilityDetails`。只有后面的关于/联系分支检查 `content === welcomeContent && (loading || error)`。能力详情于是把默认空项目/公司当真实发布状态，显示“尚未公开”；真正 `contentStatus` 和重试按钮位于 `showModal()` 背后的惰性页面中。已有文档背景刷新失败应继续展示缓存内容，不在此问题范围内。
- 影响：访客把网络错误误认为站主没有经历，不能在当前模态内重试，且辅助技术被约束在错误空态中。与项目要求区分错误和空数据的规则不符。
- 建议：三种能力详情复用首次无内容时的加载/错误状态和重试操作，保留正确标题、关闭与回焦流程；数据实际载入为空时再显示尚未公开。
- 证据边界：源码路径可确定该分支行为；本代理未做真实断网浏览器注入。
- 修复核对：当前 `index.tsx:336` 三种详情在 `content === welcomeContent && (loading || error)` 时直接显示具备标题 ID 的 `alert/status`、错误正文和 `onRetry` 按钮，仅成功取得内容后渲染 `CapabilityDetails`。对应 `retry` 样式已补齐。已有内容不会被首次空占位替换。
- 根代理验证：执行实际 `SitePage/SiteExperience` TSX 的 SSR，仅替换无关环境 hook，先红于“能力弹窗内必须显示 API 错误”，修复后错误正文、重试按钮、不误报空态断言均绿。此为根代理模块验证，本代理仅静态核对实现；不表述为本代理亲自浏览器断网复验。

### 已关闭 P2：点击实底详情弹窗内部留白会意外关闭

- 位置：`frontend/src/pages/site/index.tsx:330`，`frontend/src/pages/site/capability-details.module.less:1–4`、手机 `.dialog` 规则。
- 触发：打开任一种能力详情，点击弹窗内侧 34px 边缘留白；手机全屏详情内侧 20px 留白同样可触发。
- 静态证据：复用的 `onClick` 仅判断 `event.target === event.currentTarget` 就调用 `closePanel()`。旧阅读面板的 `dialog` 是透明外壳包 `article`，新详情则在实底 `dialog` 上直接设置 padding，并用 Fragment 放内容；这些内部留白的事件 target 就是 dialog 本体，和 backdrop 点击被混为一类。
- 影响：在面板内点击空白或结束文字选择时会直接退出阅读；手机全屏下也存在无可见关闭含义的可点击退出区。
- 建议：能力详情仅将 dialog 边界外的点击识别为 backdrop 关闭（用点击坐标与 `getBoundingClientRect()` 判断），或取消能力详情的留白点击关闭；保留关闭按钮、Esc、历史返回。
- 证据边界：事件与布局静态路径明确；本代理未实操点击坐标。
- 修复核对：当前 `index.tsx:330–335` 先校验直接命中 dialog，再对三种能力详情要求坐标处于 `getBoundingClientRect()` 外才关闭；dialog 内部 padding/边缘不关闭。关于/联系保留透明 paper 外壳原点击规则，关闭按钮/Esc 逻辑不变。
- 根代理浏览器验证：Chrome 1440 下项目 dialog bounds 为 `(220, 32, 1000, 836)`；点击内部坐标 `(225,100)`，修前关闭，修后 `modalStillOpen=true`，并可正常切换到项目 2。此为根代理实测，本代理未亲自浏览器复验。

未发现 P0/P1。上述两个 P2 已关闭，无剩余阻塞。

## 其余重点核对

- 服务端：公开 GET 明确调用 `readPublic()`，按 `visible === true` 过滤完整项目对象；管理 GET/PUT 仍读取完整文档，过滤作用于新克隆对象。PUT 新分区必填且无默认属性，旧请求省略先被 DTO 拒绝，避免清空已保存履历。GET 仅在分区完全缺失时只读补默认，不迁移旧顶层作品。
- 数据边界：API 解析器检查完整分区、嵌套未知字段、项目数量/唯一 ID、Unicode 长度、严格布尔和封面 URL；仅 GET 允许旧文档缺省。保存和响应默认严格。预览协议故意保留未完成文本，仍检查新分区结构/类型；同源且校验父窗口/source。
- Markdown：`react-markdown` 未接 raw HTML 插件且设置 `skipHtml`；链接和图片通过安全 URL 白名单，危险协议无 href/src；外链带 `noopener noreferrer`。图片错误有独立回退；代码与表格局部滚动，正文和长名称有换行边界。最新样式已去掉覆盖 Markdown 标题/段落 margin 的全后代重置。
- 编辑与预览：项目以稳定 ID 选择，排序不换对象内容；删除选择相邻项；选中项被删除/隐藏时公开详情回退首个可见项；空数组有空态。所有编辑落在共享草稿，iframe 序列化订阅深层更新；隐藏对象保留在编辑数据、过滤于公开详情。无效名称/封面保存预检会切 Tab/项目/手机编辑并回焦。
- dialog/动效：原生 `showModal()` 在独立预览 iframe 内约束预览焦点，父编辑页继续可用；关闭、Esc、popstate 和已有回焦逻辑得到复用。全局 `.still` 对新详情后代同样有效，系统 reduce 也有规则。暂停条件仍包含所有 panel；共享切场文件未改，850ms 保持，三张 card 与三个 card-window 成对，三环节点与遮罩逻辑保留。
- 布局静态边界：手机详情为全屏；目录为横滚，正文/grid 子项有 `min-width:0`，表格/代码局部滚动、图片限宽。真实 1440/390/320、长正文滚动和 iframe 交互由根代理浏览器验收，本报告不将静态审查表述为浏览器通过。

## 沿用结果及未实操边界

- 沿用实现报告所记后端 `76/76`（含 build）、前端 lint/build、API/预览 `19/19`、编辑器 `8/8`、保存定位 `4/4`；本代理没有重复运行，也不把其结果冒充本轮独立重验。
- 本代理未实操浏览器、真实断网/409、OS reduce、真实隐藏标签、手机触摸/软键盘、其它浏览器、远程图片可达性或真实站主保存。开发 v6 与真实会话未操作。
