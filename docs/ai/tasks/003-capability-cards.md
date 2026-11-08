# SPEC-003：能力技术卡片

- 更新时间：2026-11-07（Asia/Shanghai）。基准 `82acde8`，当前工作区既有大量未提交改动，本子任务未提交或修改其他代理负责文件。
- 依据：[SPEC-003 P18](../../specs/003-personal-site.md#p18连续双场景完整实施计划替代p14初版2026-11-07)，覆盖 AC18-2 技术标志、AC18-5 横向卡片与键盘/触摸、AC18-6 禁用态；人物素材与父级时间轴由其他任务负责。
- 文件：`frontend/src/pages/site/capability-content.tsx`、`capability-content.module.less`，以及 `frontend/public/site/tech/` 的九个 SVG 和独立来源记录。未改 `index.tsx` / `style.module.less` / `ASSETS.md`。

## 已完成

- 导出 `CapabilityContent({ disabled })`，分类与 DOM 顺序为 AI、前端、后端、部署；九项技术均有可辨识的真实 SVG。Codex 使用 OpenAI 品牌图形，来源说明见 [SOURCES](../../../frontend/public/site/tech/SOURCES.md)。
- wrapper 提供 `data-capability-cards`，四个外层卡片提供 `data-capability-motion="card"`，用于父级共享时间轴；hover/focus 的轻量缩放只作用于内层 button，不覆盖父动画 transform。
- hover 与键盘 focus 可临时查看说明；点击/触摸固定展开，再次点击关闭，`aria-expanded` 与实际说明同步，`aria-controls` / `aria-describedby` 关联说明。隐藏阶段使用 inert、aria-hidden 和 disabled 禁止交互。
- 桌面左卡片宽度约 13vw，左上 35%/20%、左中 34%/53%，右侧 82%/20% 与 83%/55%。父布局可覆盖 `--cap-ai-left/top` 等四组定位变量。
- 小于 768px 卡片宽 232px、默认高 108px，在底部 80px 的横向 scroll-snap 区域中展示；同一移动布局同时通过 media 和 container query 应用于真实手机与后台手机预览。展开说明位于卡片上方，保留 88px 说明空间。卡片区阻止 touch 冒泡，避免横滑误触父级场景切换。

## 验证

- 本次执行定向 `npm run lint -- --deny-warnings src/pages/site/capability-content.tsx`：退出 0。
- 本次执行 `npm run check`：退出 0。
- 审查后补齐后台手机预览 container query；最终 Less 模块通过本地 `less.render` 编译（4483 字符 CSS），确认输出包含对应 container query。九个 SVG 均通过 XML / 24×24 viewBox / path 检查，未含 script 元素。
- 无新增依赖或前端测试框架；前端没有 test 脚本。此可逆展示组件按项目规则使用现有静态检查与父级真实浏览器验收。
- 桌面/手机的实际卡片位置、正反时间轴、触摸横滑、点击展开与焦点流程：交由整合任务在父组件接入后实测，当前不能声称已完成浏览器验收。

## 交接

父组件可直接导入 `CapabilityContent`，传入场景隐藏或切换期间的禁用状态。整合者负责更新 SPEC 与 STATE 的 T2/T4 状态及最终证据。本文不覆盖其他子任务验证结论。
