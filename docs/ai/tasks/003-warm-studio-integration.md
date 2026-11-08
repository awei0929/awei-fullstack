# P26 温暖工作室视觉精修：根整合

- 核对日期：2026-11-07；基准82acde8，未提交工作区；本轮源基线`/tmp/nest-warm-studio-before`，保留原有全部改动。
- 目标与验收：[SPEC-003 P26](../../specs/003-personal-site.md)。根负责环境/首页/Switch/整合验收，子代理负责能力样式，独立代理审查本次差异；没有分支、提交或部署操作。
- 修改：`frontend/src/pages/site/index.tsx`、`style.module.less`、`capability-content.module.less`；新增两张`public/site/studio-environment-v1*.webp`，素材说明/来源/提示词在`public/site/ASSETS.md`。未修改转场、遮罩、MobX、API、后台编辑器或数据库。
- 最终前端lint/build退出0，1562模块；真实浏览器覆盖与未覆盖详见P26实际验证。Chrome读到原配置v6且保存disabled，没有编辑/保存配置。
- 两处检查后修订：独立审查发现reduce只清transition仍允许箭头瞬移，补still和系统media清transform；手机截图显示14px双列断词，改卡内单列（232×156卡/88px局部纵滚）。两项均在最终lint/build之前落盘。
- 动效误报定位：根在验证手动off后未立即恢复，用户看到切场直接端点；恢复on后真实采样busy=true及0与1之间人物opacity，正反与中途反向正常。时钟代码没有改动，结束保留on。
- 结束：公开首页初次见面、动效on；后台仍v6/保存disabled/登录保留；调用viewport reset，未开启新服务，原3000/5173继续运行。

最终源码SHA256：

```text
ee53cd7105fd2fd8cd82fb1e4ec8307dcb4b1f11388222286b06ab07234ecea9  index.tsx
7000c1f9ded318f36564d6910efed3fb8358613891523052ad8918f670ba33f8  style.module.less
1272278339909ba8f6d3a6b8a4dcb790561dfdb308eeee061cc1a85f008b4384  capability-content.module.less
c204e33704e9f45726f780d181b8e22d85a74bf6a2566906accb55ea5b3d2888  studio-environment-v1-768.webp
643290d437d3c1de9676b9c9a0f10c745423b06512be84f34cc35861d0611929  studio-environment-v1.webp
```
