# 能力图标素材交接

- 当前结果：2026-11-07 官方来源与品牌色补齐已完成；下方“首轮”仅为首次开源目录准备的历史记录，当前文件与来源以本节和 SOURCES.md/json 为准。
- 本轮依据：用户反馈优先从品牌官网或官方组织仓库拿 SVG，并保留原品牌色；根代理修复 TS 与取消全白 CSS，本代理仍仅处理静态素材和来源，不改变真实配置。用户已将 Vue 改为 Vite 的 v6 保存属于用户操作，本代理未读写数据库。
- 当前仍为 38 个选择项与 1 个旧 openai 兼容文件，共 39 SVG、302532 字节；slug、类别、技术名称均未改。13 个 SVG 已升级到品牌官方来源（12 可选项及 openai 兼容），其余 26 个仍为固定版本开源库来源，其中21个已补齐品牌色，未宣称全 38 项来自官网。

## 品牌色补齐（当前增量）

- 用户追加要求补齐品牌颜色。本轮仅改 21 个开源来源 SVG，保留此前 13 个官网/官方组织来源 SVG 的字节与 SHA-256（包括刚裁窗的 Codex/OpenAI）。
- 17 个 Devicon v2.16.0 original 原文件：JavaScript、HTML5、CSS3、Ant Design、Node.js、Python、FastAPI、Java、Go、MySQL、PostgreSQL、Redis、Kubernetes、Linux、Git、GitHub Actions、Cloudflare。Gemini 改 Lobe Icons 1.102.0 gemini-color.svg。
- Tailwind CSS、Spring Boot、Nginx 继续使用现有独立 mark，仅依据同固定 Simple Icons 元数据的 #06B6D4/#6DB33F/#009639 写为根 fill；原路径不变。Devicon Nginx original 实为细横 wordmark，未采用，避免20px不可读。
- JavaScript 是黄底黑字原版，Python 蓝黄、HTML/CSS 多层盾牌等保留完整色层；没有凭印象创造颜色。Ollama、Express、GitHub、Next.js、Vercel 五个开源黑白品牌表示保持原字节。
- 当前38可选项为30品牌色+8品牌黑白（Codex/ChatGPT/Cursor/Ollama/Express/GitHub/Next.js/Vercel）；另保留黑色OpenAI兼容文件。官方来源13、开源库来源26的边界不变。
- 39 SVG 总302532字节；Linux彩色Tux193922字节为最大单项，其余总108610字节，无新增运行依赖。Go original 的 use 仅引用同文件 #go-original-a，已确认定义存在，没有外部资源请求。
- 新一轮39/39 XML/非零viewBox/被动元素/内部引用/字节/SHA验证通过，13官方文件哈希保持不变；manifest记录每项原色来源、原下载校验值及颜色转换。根代理负责浏览器与构建，不修改用户v6配置。

## 官方优先升级（仍有效）

- 已替换：`codex`、`openai`、`chatgpt`、`claude`、`deepseek`、`react`、`vuedotjs`、`typescript`、`vite`、`nestjs`、`mongodb`、`docker`、`cursor`。
- 官网/品牌下载：OpenAI 官方 CDN logo ZIP 的黑色 Blossom、ChatGPT 官网实际 favicon、Claude 官网 icon.svg、DeepSeek 官网引用的官方 CDN favicon、TypeScript 官网品牌 ZIP 的蓝底白字 mark、Nest 官网红 mark、Docker 官网 ZIP 的 Ocean Blue 独立 mark、Cursor 官网 favicon。
- 官方组织仓库：React 的 facebook/react 固定提交青色 mark；Vue 的 vuejs/art 固定提交双色 mark；Vite 的 VoidZero 官方 community-design-resources 固定提交原色 mark；MongoDB 的官方 LeafyGreen 固定提交 MongoDBLogoMark。
- 没有找到独立可分发 Codex SVG：已检查 OpenAI 品牌页、官方 ZIP、openai/codex 固定版本文件树。`codex.svg` 明确使用所属 OpenAI 官方黑色 Blossom fallback，不把第三方或该 Blossom 声称为独立 Codex 产品图形。`chatgpt.svg` 改为 ChatGPT 官网实际 favicon，来源身份明确，未声称两者有完全不同的独立品牌符号。
- 四项表示转换（五个文件）：ChatGPT 去除深色系统主题变白的 style，固化官网浅色主题默认黑色；Docker 将 CSS class 的 fill/clip-path 解析为同值静态属性并移除 style；MongoDB 从官方 TSX 组件取原始 path/viewBox，并按同提交官方 palette 解析默认深绿 #00684A。所有几何 path 均逐字保留，无手绘或 imagegen。
- Codex/OpenAI 小尺寸收尾：官网 ZIP 只有标准留白版，无紧视窗 mark；仅将两文件 viewBox 裁为 168 168 380 380。精确主体范围约180.499807–535.173927，四边边距12.50–12.83，约主体宽度3.5%；官方 path、原色及 width/height 逐字不变，两个文件保持相同，原始下载 SHA 继续保留。已通知根与审查代理定点复核。
- Vite 官方 mark 包含静态矢量 mask/滤镜，保持官方内容；没有外部资源、动画或新增依赖。各官方项均选黑色/彩色独立 mark，不引入不适合小图标的横向 wordmark。
- 来源说明和清单已更新：明确区分 13 个品牌官方源和 26 个开源库文件，记录原始下载 SHA-256、当前 SHA-256、ZIP 成员与 ZIP 校验值、官方颜色、转换方式及替换前来源。新增 React MIT 和 LeafyGreen Apache-2.0 许可全文，保留旧四份许可。

## 本轮验证与交接

- 实际重新运行 XML、安全、viewBox、字节数、SHA-256 检查：39/39 通过；所有 url(#id) 仅引用同文件已存在的定义，无 script/foreignObject/事件属性/外部引用/DOCTYPE/实体/嵌入图片/CSS 导入。
- 13 个官方导入的 path 与各自官网 SVG、ZIP 内 SVG 或 MongoDB 官方组件源逐字一致；所有官方来源下载已成功，未用错误页冒充 SVG。
- 38 个选择项仍分 4 类，每类≤12 且 slug 唯一；来源 Markdown/任务交接的本地链接均核对存在。
- 本轮未修改 TS/LESS/后端/SPEC/STATE，不运行构建或写数据库。根代理负责当前 TS、原色底板及真实浏览器验收，审查代理已收到资产完成通知。未提交、推送、部署或切换分支。
- 官网来源边界：以下26项仍为开源图标库来源，其中21项已按上方增量补齐品牌色，并非全部保持首轮文件：Gemini、Ollama、JavaScript、HTML5、CSS3、Next.js、Ant Design、Tailwind CSS、Node.js、Express、Python、FastAPI、Java、Spring Boot、Go、MySQL、PostgreSQL、Redis、Kubernetes、Nginx、Linux、Git、GitHub、GitHub Actions、Vercel、Cloudflare。该边界已明确，不扩张为逐项全网追溯任务。

## 首轮基线（历史）

- 更新时间：2026-11-07（Asia/Shanghai）。
- 基准：`82acde8`，本次工作区原有大量未提交改动，已核对并保留。
- 对应目标：SPEC-003 能力场景与本轮站主配置；AI、前端、后端、部署四类技术可通过图标及昵称选择。
- 本代理范围：仅 `frontend/public/site/tech/` 本地资产、来源文档和本交接文件；未修改页面、TS、后端、SPEC、STATE，未提交、推送、切换分支、部署或清库。

## 首轮已完成（历史）

- 实际联网搜索并核对 Simple Icons、Lobe Icons、Devicon 官方开源仓库、固定版本文件和许可证。
- 准备 38 个可选技术，分组上限均不超过 12。AI 7 项、前端 10 项、后端 12 项、部署 9 项。最终清单和根代理前后端白名单保持一致。
- `frontend/public/site/tech/` 共 39 个 SVG、61491 字节：已有 9 个逐一与固定上游字节比对相同并保留；新增 30 个 SVG。额外 `openai.svg` 保留作为旧版本兼容资产，不列入新增选择项。
- Codex、ChatGPT 分别使用 `codex.svg`、`chatgpt.svg`，两者是经核对的 `openai.svg` 字节相同本地别名，便于配置中以不同 slug 选择。名称区分产品，图形沿用所属 OpenAI 品牌，不称为独立产品标志。
- 新增/更新 [来源说明](../../../frontend/public/site/tech/SOURCES.md) 与 [逐项来源及 SHA-256 清单](../../../frontend/public/site/tech/SOURCES.json)，每项记录 slug、名称、固定下载 URL、品牌原始来源、许可或使用说明、下载/保留结果、字节数和校验值。
- 本地附四份上游许可全文：Simple Icons CC0、Lobe Icons MIT、Devicon MIT、JavaScript 原作 MIT。修正旧来源说明将所有图形笼统表述为 CC0 的问题；Vue、Git、JavaScript 的独立许可和署名单列。

## 固定选择清单（保持不变）

- AI：`codex`、`chatgpt`、`claude`、`deepseek`、`gemini`、`cursor`、`ollama`。
- 前端：`react`、`vuedotjs`、`typescript`、`javascript`、`html5`、`css3`、`vite`、`nextdotjs`、`antdesign`、`tailwindcss`。
- 后端：`nodedotjs`、`nestjs`、`express`、`python`、`fastapi`、`java`、`springboot`、`go`、`mongodb`、`mysql`、`postgresql`、`redis`。
- 部署：`docker`、`kubernetes`、`nginx`、`linux`、`git`、`github`、`githubactions`、`vercel`、`cloudflare`。

## 首轮来源与取舍（历史）

- 常规技术使用 [Simple Icons](https://github.com/simple-icons/simple-icons)，固定提交 `c8a98c7099c33a8ef8461dd97263235f348e7077`，与已有八个常规技术 SVG 相同。当前提交已移除 CSS3、OpenAI，二者固定使用历史发行版 `13.21.0`，不伪造或手绘图形。
- Gemini、Cursor、Ollama 使用 [Lobe Icons 官方静态 SVG 包](https://github.com/lobehub/lobe-icons/tree/ea434b96e75813517b377825e01c0df61dee8836/packages/static-svg) `1.102.0`；仓库固定提交与发布版本一致，MIT 许可。
- Java 使用 [Devicon](https://github.com/devicons/devicon/blob/v2.16.0/icons/java/java-plain.svg) `v2.16.0` 静态图形，MIT 许可。没有引入 React 图标组件包或额外运行依赖。
- Vue.js artworks 原作 Evan You，CC BY-NC-SA 4.0 与官方附加条件；Git logo 原作 Jason Long，CC BY 3.0；JavaScript logo 原作 Christopher Williams，MIT。具体固定链接和许可全文见来源说明。
- 资源仅作技术识别并保留上游几何路径；所有下载文件在仓库本地提供，运行时可离线展示。

## 首轮验证与边界（历史）

- Python XML/静态属性检查通过 39/39：全部 SVG 可解析、根元素为 svg、有非零 viewBox，实际仅包含 svg/path/title；无 script、foreignObject、事件处理属性、href/src 外部引用、CSS url 外链/@import、DOCTYPE/实体、嵌入图片或活动元素。
- 逐项下载后校对字节数及 SHA-256，Codex/ChatGPT/OpenAI 三文件完全一致；现有 9 个 SVG 与固定上游一致。
- 来源 Markdown 的本地链接、39 条 manifest 文件大小、四份许可文件存在性检查通过。
- 未运行 lint/build 或浏览器；本代理仅添加静态资产和文档。站主选择、保存与公开页渲染验收交由根代理集成执行，不把静态检查写成浏览器验收。
- 后续：根代理按上述固定分组接入前后端白名单及 select，检查所有项可选、昵称可保存、公开页本地图片加载与窄屏布局。没有图标资产阻塞项。
