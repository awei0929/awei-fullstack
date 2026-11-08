# 能力图标官网素材增量审查

- 核对日期：2026-11-07（Asia/Shanghai）；基准 `82acde8`，当前未提交工作区。
- 范围：公开能力列表与后台 Select 的两处图标样式、官方静态 SVG / SOURCES，以及用户随后要求的 21 项品牌色增量。保留原 38 项 slug 合同与九项默认；不扩审并行 P21 的光圈实现。
- 状态：两处样式、官方资产与 21 项品牌色增量的独立审查完成，**通过，无 P0/P1/P2**。审查者未改产品代码、运行前端 check/构建、提交或推送。

## 双结论

- **规格符合性通过。** 图标原色恢复，12 个可选项与 openai 兼容文件已采用核实的品牌官方源，另外 26 个为开源库来源且明确披露；其中后续 21 项已补齐品牌色。当前 38 可选项为 30 项品牌色、8 项品牌黑白，没有将全 38 项声称为官网直取。Codex 明确使用 OpenAI 官方 Blossom fallback，没有冒充独立 Codex mark。38 项 slug、类别、名称与九项默认不变。
- **代码与资源质量通过。** 两处样式不改变占位、映射和滚动逻辑；39 个文件与清单完整对应，无漏图、错误文件名或清单哈希漂移。官方导入保留原几何路径，静态内部 mask/filter 引用闭合，无活动或外部资源。

## 已核对的样式

- `frontend/src/pages/site/capability-content.module.less:88` 与 `frontend/src/pages/admin/capabilities-editor.module.less:11` 已移除统一 `brightness(0) invert(1)` 和透明度处理，保留 SVG 文件原色。
- 两处均使用 `box-sizing: border-box`、2px 内边距、浅底 `#f7f3ea` 与 `object-fit: contain`；公开图标维持 20px、手机 19px，Select 图标为 20px。小底没有改变外部占位尺寸，不新增长列表溢出或扩大手机行高。
- 后台选项及已选值复用同一 `.option` 图标标签，公开页仍使用相同白名单 URL 生成函数，没有引入外链或 SVG 注入。
- 最终 13 个官方文件均为黑色或彩色 mark；TypeScript 的白字有原蓝色底、Cursor 的浅色箭头有原深色底，没有发现仅靠纯白形状在浅底上显示的素材。MongoDB 为纵向叶片，未误取横向 wordmark。黑色 OpenAI/ChatGPT 在浅底可见；源文件颜色核对不能代替浏览器实际小尺寸视觉验收。

## 官方来源阶段的资产核对

- 独立脚本读取前端目录、后端白名单与 `SOURCES.json.selectableGroups`：三者均为 38 项且集合完全相同。39 条 records 与 39 个本地 `.svg` 一一对应，包含保留的 `openai.svg`。首轮官方升级为 86,284 字节，Codex/OpenAI 视窗修改后为 86,292 字节；下方品牌色增量后的当前总计为 **302,532 字节**。首次 39/39 哈希核对沿用，随后仅对变更项和原官方项定向复核。
- 官方来源文件为 `codex`、`chatgpt`、`claude`、`deepseek`、`cursor`、`react`、`vuedotjs`、`typescript`、`vite`、`nestjs`、`mongodb`、`docker`、`openai`，即 12 个可选项及 1 个兼容文件。`SOURCES.md`、JSON 和图标任务报告的当前章节均明确其余 26 个仍为 Simple Icons / Lobe Icons / Devicon 文件；首轮 61,491 字节及旧 OpenAI 别名记录已明确标为历史。
- 从图标代理保留的 `/tmp/nest-official-*` 原下载件独立比对：13/13 `rawDownloadSha256` 一致，13/13 当前 path 的 `d` 与原 SVG、ZIP 内 SVG 或 MongoDB 官方 TSX 原件逐字相同。审查者未重新下载大 ZIP，没有把临时原件核对说成自己重新联网取证。
- ChatGPT 原件的暗色媒体主题会切换白色，当前固化其原浅色默认 `#000`；Docker 原 `.st1` 是 `#2560ff`、`.st2` 为本地裁切，当前转换为相同属性；MongoDB 默认 `SupportedColors.GreenDark2` 经同提交类型映射到 `palette.green.dark2`，值为 `#00684A`。加上下方 Codex/OpenAI 视窗裁切，最终四项表示转换涉及五文件；来源说明一致，没有重画路径。
- 39/39 XML 可解析且 viewBox 有正尺寸；独立静态检索未见 script、foreignObject、嵌入 image、事件属性、动画、外链、DOCTYPE/实体或 CSS 导入。共 17 处 `url(#id)` 引用均存在于同一文件定义中。Vite 保留官方静态 mask 与滤镜，没有因去掉白色滤镜破坏其内部定义。
- 前端目录、后端白名单、后端默认的审前/审后 SHA-256 完全相同；没有把用户已保存的配置变更误认为默认改变，审查者未读写数据库。

## Codex/OpenAI 小尺寸收尾复核

- 根浏览器已确认公开页原色、后台 Select 与开发错误浮层消失，正式 v6 仅只读。随后发现官方 Blossom 原 716×716 视窗留白较大，20px 盒内主体约 8px；本次补审仅覆盖 `codex.svg`、`openai.svg` 与对应清单/文档，没有重跑全套。
- 两文件均仅将 `viewBox="0 0 716 716"` 改为 `viewBox="168 168 380 380"`。将此字符串反向替换后可逐字恢复官方 ZIP 原 SVG；path、原黑色、width/height 及其它字节没有变化。两文件仍逐字相同，均为 2,419 字节，当前 SHA-256 均为 `36534272c22b5403b6011a2ad8bab6e233dd4aa517718c37a55de82a79a96c6a`，与 manifest 一致。
- 独立解析全部 M/L/H/V/C/Z 命令，所有端点及三次贝塞尔控制点的凸包都位于 `(174.957,174.956)–(540.716,540.717)`，完整落在新视窗 `[168,548]²` 内，证明没有裁掉实际路径。清单记录的精确曲线边界与约 12.50–12.83 单位留边相符；在 16px 内容区域内主体宽度推算约 14.9px，此为尺寸推算，不冒充浏览器像素采样。
- `SOURCES.json` 保留原下载 SHA 与 `preCropSha256`，新增 `viewportCrop`、当前 bytes/SHA 和第四项转换；`SOURCES.md` 与图标任务报告均同步解释仅裁视窗、Codex fallback 身份及 86,292 字节总量。
- **该小尺寸问题已关闭；未发现新增 P0/P1/P2。**

## 后续 21 项品牌色增量复审

- 本次仅复核新增 21 项文件/来源转换/静态引用、原 13 官方文件不变与文档声明，没有扩大到应用代码或重复构建。
- 17 项 Devicon `v2.16.0` original 为 JavaScript、HTML5、CSS3、Ant Design、Node.js、Python、FastAPI、Java、Go、MySQL、PostgreSQL、Redis、Kubernetes、Linux、Git、GitHub Actions、Cloudflare；Gemini 为 Lobe Icons `1.102.0` 的 `gemini-color.svg`。18 项当前文件与 `/tmp/nest-brand-color-*` 原下载件逐字一致，bytes/SHA 与 manifest 相符，未修改几何或颜色。
- Tailwind CSS / Spring Boot / Nginx 保留原独立 mark，仅增加根 `fill`。独立核对固定 Simple Icons 元数据原件 SHA `565d768fec23d53f3aa7984110867dc0165a49329e2cf7c1e00c3955a4bb3c19`，三项 hex 分别为 `#06B6D4` / `#6DB33F` / `#009639`，均与根 fill 和清单一致。去掉该新增属性即可恢复原下载 SHA，确认路径及其它字节不变；没有用宽横向 Nginx wordmark 代替小 mark。
- 21/21 文件可解析、具备 viewBox 且哈希/大小匹配，无 script、foreignObject、事件属性、动画、嵌入 image、外部 href/src、DOCTYPE/实体或 CSS 导入。所有局部渐变/裁切引用均存在同文件定义；Go 的唯一 `use href="#go-original-a"` 指向同文件 path，不产生外部请求或递归自引用。
- 原 13 官方文件独立按上一轮已核对哈希逐项比较，**13/13 不变**，包括已裁窗 Codex/OpenAI。当前 39 SVG 共 **302,532 字节**；Linux 彩色 Tux 为 **193,922 字节**、最大单项，清单已如实记录原版体积，没有新增运行依赖。
- `SOURCES.md` / JSON / 图标任务报告明确：38 可选项为 30 品牌色 + 8 品牌黑白（Codex、ChatGPT、Cursor、Ollama、Express、GitHub、Next.js、Vercel），另有黑色 OpenAI 兼容图；“13 官方文件 + 26 开源库文件”来源边界不变。三项元数据上色明确标为转换，没有冒充官网下载原始彩色文件。
- 根整合补充最终证据：正式 v6 只读打开前端 Tab 与 Select，56 个技术 `<img>` 全加载、`filter=none`、Vite overlay 不存在、保存按钮 disabled；截图为 `docs/designs/personal-site/evidence/brand-colors-admin-v9.jpg`，可见 JS 黄底黑字 / HTML 橙 / CSS 蓝 / Vite 紫。39 SVG 与模块 HTTP 均为 200；最终 build/TS 通过，日志 `/tmp/nest-brand-colors-final-build.log`，未改样式沿用此前 lint。
- **本轮颜色增量通过，无新增 P0/P1/P2。** 上述浏览器/build/HTTP 为根整合提供的证据，本审查未重复执行或冒充自己完成。

## 合同与既有报错边界

- 本轮不改变 `CAPABILITY_CATALOG`、后端白名单或默认项；`capabilityIconUrl()` 仍由已知 slug 构造固定 `/site/tech/<slug>.svg` 本地路径。
- 根整合已复现 `use-orbit-card-windows` 文件未落地时 TS2307 / Vite 模块 500，随后并行 P21 补齐该文件；根提供的恢复结果为 check 退出 0、模块 HTTP 200。本报告沿用该结果，未重跑 check，也未把此文件的全部行为纳入图标审查。

## 版本记录

- 公开样式 SHA-256：`5bf16c9f3698aaa2c4421d6a223044482aa808c7ba8c777d3af6e6ca82c412b6`。
- 后台样式 SHA-256：`6712d74e70e5178c4847f38a3b122a3677011839f0865eba9f67fb449b20c00e`。
- 前端目录 SHA-256：`922e4ff7ac5f956b231fdcd47d5ed57553011198738213acee94f3591ddb9538`。
- 后端白名单 SHA-256：`bf2307e49ddb9e50758d62aa92da24b9a1acdf7d533e97789ea322d4835a8ed8`。
- 后端默认 SHA-256：`824e762b995a28823ea2611a58945d335fc9cee7e61c96938518e08ef87dfef8`。

## 验证边界

- 本次新执行的是文件/清单集合、字节/SHA、原下载件 path、XML/静态引用、源码样式及新增 21 项颜色/元数据核对；没有重跑根已通过的 TS check/构建，也未启动后端检查。
- 真实公开页/后台 Select 的加载、原色与浅底视觉已由根整合验收通过；本报告没有把这些结果说成审查者亲自完成的浏览器覆盖。末次视窗修正的补审为两文件与清单的定向源码/几何核对。
- 未重查并行 P21 光圈的全部逻辑，未回退其新模块或改动真实配置。
