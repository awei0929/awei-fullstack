# SPEC-003 Unslop 三项精修独立审查

- 核对日期：2026-11-07（Asia/Shanghai）；Git 基准 `82acde8`，本轮为未提交工作区。
- 当前任务：仅审查 SPEC-003 的 U1–U4、U-P1–3；不扩大到另行追加的 P11–P13 动效任务。
- 审查基准：任务开始准确副本 `/var/folders/1k/z1yp6ch92z73ym4l833kyk6r0000gn/T/nest-unslop-polish-4nd8ikdk/frontend/src/`。使用副本与当前 `pages/site/` 的文件差异，未以 Git commit diff 代替未跟踪文件审查。
- 已读取 AGENT、STATE、架构概览、前端约定及 SPEC-003。仅本报告由审查代理修改；未读 `.env`、操作浏览器、修改产品、提交或增设测试框架。
- 最终复核 `pages/site/index.tsx` SHA-256：`cf8eb8298c4e77d3ece6d7c2a232dc9533a58a2b47e7e58b61e031c10228cce9`；`style.module.less`：`fc374787a8262c63268d06ba50ebc961f36650ed097e74ffccffecdeef264e8f`。初次样式哈希为 `159f9b80c927d8266cbf668b6f69e747fc68bfc67ee5f8ab6af08c8577c2bfc1`，下方两项发现已由根代理修正并重新审查。

## 结论与已关闭发现

两项 P2 均已在源码复核中关闭；在 U1–U4 限定范围内未发现遗留阻塞。运行效果仍需根代理的浏览器与构建证据。

### P2：多项目目录未达到手机辅助信息 12px 目标——已关闭

位置：[公开页样式第 323 行](../../../frontend/src/pages/site/style.module.less#L323)，基础值在[第 191 行](../../../frontend/src/pages/site/style.module.less#L191)；条件渲染见[公开页第 307 行](../../../frontend/src/pages/site/index.tsx#L307)。

初审发现：手机规则只调整 `.projectIndex` 间距和 padding，名称仍继承 11px，编号仍继承 9px。当分类至少有两个项目时才会出现该目录，单项目页面不足以暴露此遗漏。

修正复核：基础目录名称和编号均已为 12px；按钮增加 `max-width: 100%`、`overflow-wrap: anywhere`，目录仍允许换行。后续手机与预览规则没有再次降低这些字号。源码问题已关闭，多项目实际换行仍归根代理浏览器检查。

### P2：后台手机预览保留较小计数与页码，高优先级规则覆盖手机字号——已关闭

位置：[公开页样式第 254 行](../../../frontend/src/pages/site/style.module.less#L254)的 `.preview` 与[第 360 行](../../../frontend/src/pages/site/style.module.less#L360)起的窄容器规则；预览实现见[后台第 18 行](../../../frontend/src/pages/admin/index.tsx#L18)。

后台在同一文档中将 `SiteExperience` 放入宽 390px 的容器，并未使用独立手机视口。在桌面窗口切到“手机”预览时，`@media (max-width: 700px)` 不匹配；初审时窄容器规则没有补齐以下字号：

| 内容 | 初审基础字号 | 修正后的基础字号及位置 |
| --- | --- | --- |
| 分类计数 | 10px | 12px，`.categoryTabs button > span`，第 174 行 |
| 档案页码 | 11px | 12px，`.folderControls`，第 187 行 |
| 阅读页码 | 11px | 12px，`.detailPagination`，第 214 行 |
| 场景页码 | 10px | 12px，`.sceneProgress > p`，第 154 行 |

初审的 `.preview .eyebrow { font-size: 9px }`、`.preview .heroSubtitle { font-size: 12px }` 比公共手机规则优先级高，会覆盖新字号。最终预览眉题已为 12px，简介已为 14px，窄容器副标题同步为 14px；摘要与技术栈维持 14px/12px。分类计数和三类页码以基础规则补齐，后续预览规则不再缩小。源码问题已关闭。

同时复核窄预览分类的 `min-width: 0`、4px gap、取消字距与页脚换行；本报告评估 CSS 声明字号，后台原有整体 `transform: scale(...)` 的物理缩放不计作本轮新增缺陷。

## 已确认的正向结果

- U1：`.primaryLink` 已使用 `#211d14 !important`，保留原默认、hover 渐变与按钮动作。按 sRGB 相对亮度独立计算四端点对比度，均超过 4.5:1：

  | 状态及背景端点 | 对比度 |
  | --- | --- |
  | 默认 `#eda029` | 7.7258:1 |
  | 默认 `#cc7510` | 4.8936:1 |
  | hover `#f0af46` | 8.7368:1 |
  | hover `#cf7f1b` | 5.3615:1 |

  这是声明色值的端点计算，未作截图逐像素测量，也不是全站对比度审计。
- U2：公开手机的项目编号/类别、技术栈、打开入口、分类计数、档案与阅读页码、返回入口均有至少 12px 规则；项目摘要与正文为至少 14px。预览内本轮显式修改的 `.projectMeta p` 与 `.paperBottom` 不再缩回旧 10px/7px。
- U3：仅删固定侧边问候、档案重复英文、人物旁标语、阅读页眉/页脚冗余及手机伪元素标语；配置提供的首屏标题、眉题、简介、资料与项目内容仍从原字段渲染。关于标题使用 ``你好，我是${content.profile.name}``，不追加句号；输入 `HEY.` 对应“你好，我是HEY.”。
- U4：快照差异没有改动状态管理、事件处理、历史返回、焦点恢复、数据加载、链接安全判断、登录入口或后台业务。人物 DOM/素材、`SiteIntro` 集成、重播/跳过路径、手动动效开关、场景 hook、纸页悬停/阅读动画保留。删除的 `.heroAside` 动画仅服务于同轮已删除的固定侧文案。
- `pages/site/use-scene-motion.ts` 与 `components/site-login/` 相对本轮快照无差异。审查时 `components/site-intro/style.module.less` 已出现另一代理的时序调整；不属于这两份 Unslop 产品文件的差异，本报告不评价其正确性。

## 320px 源码空间核对

- 公开手机档案内宽约为 `320 × 88% = 281.6px`；分类容器扣掉 16px 水平 padding 与三段 4px gap 后，四按钮各约 63.4px。两字类别、12px 的双位计数及当前 padding/gap 可容纳，`min-width: 0` 允许收缩。未从本轮差异发现必然横向溢出的分类规则。
- `.paperBottom` 已改为纵向、技术栈允许 `overflow-wrap: anywhere` 且最大宽度 100%；手机目录纸页顶线允许换行。档案页脚与操作组都允许 `flex-wrap`，场景进度与按钮组放不下一行时可整体换到下一行。
- 这些是静态规则与空间推导，不代替真实字体、布局结果、点击可达性或 `scrollWidth` 测量。390×844 和 320px 浏览器验收、真实计算样式、lint/build 由根代理执行。

## 验证边界与下一步

本代理完成 Git 状态/基准核对、任务开始快照比较、相关源码/层叠检查、四端点纯色对比度计算，并复核关闭两项 P2。未运行浏览器、lint/build、后端测试；未把已有第二轮结果当成本轮新执行证据。结论仅适用于上述最终哈希及本报告限定范围；下一步由根代理合并真实浏览器字号/布局/交互检查与 lint/build 结果。
