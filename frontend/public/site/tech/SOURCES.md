# 能力场景技术标志

核对与下载日期：2026-11-07。38 个可选项（AI 7、前端 10、后端 12、部署 9）及 1 个旧 openai.svg 兼容文件，共 39 个本地 SVG、302532 字节。所有资源由本地 /site/tech/<slug>.svg 提供，运行时不依赖远端图标服务，不新增 npm 依赖。

## 当前来源边界

本轮按用户要求优先使用品牌官方公开资源：13 个 SVG（12 个可选项及 openai.svg 兼容文件）改为官网/CDN品牌下载包、官网实际图标或品牌官方组织仓库；其余 26 个仍为固定版本开源图标库来源，其中 21 个本轮补齐可核实的品牌原色，5 个保留品牌本来的黑白表示。开源图标库的“官方仓库”只表示该图标库自身维护者，不能称为对应品牌官网来源。下表明确区分。

- 品牌官方来源：Codex 所用 OpenAI fallback、ChatGPT、Claude、DeepSeek、React、Vue、TypeScript、Vite、NestJS、MongoDB、Docker、Cursor，另含 OpenAI 兼容文件。优先选择黑色或品牌原色独立 mark，不用横向 wordmark。
- Codex：检查 [OpenAI 品牌页](https://openai.com/brand/)、[官方 logo 下载包](https://cdn.openai.com/brand/openai-logos.zip)和 [openai/codex 固定版本仓库](https://github.com/openai/codex/tree/efdacaf46ff54660a239189a6d62434c5db33d2c)，本次未找到独立可分发的 Codex 产品 SVG；因此 codex.svg 明确使用所属 OpenAI 官方黑色 Blossom 替代，不把它称为独立 Codex 图形。
- ChatGPT：直接使用 [ChatGPT 官网实际 favicon](https://chatgpt.com/cdn/assets/favicon.6a33781f61.svg)。它是 ChatGPT 官网资源；与 Codex 的来源语义区分，不能据此声称两者有完全不同的独立品牌符号。
- 保留开源来源：其余 26 个项目仍来自 Simple Icons、Lobe Icons 或 Devicon，未宣称全部 38 项均从品牌官网下载。首次下载的固定版本与许可文件继续保留。

## 导入处理与品牌颜色

多数官方 SVG 原始字节直接落盘，保留品牌色、路径和 viewBox。为保证浅色图标底板可见且仅保留被动 SVG，有四项做了确定性的表示转换（共五个文件），几何路径均逐字一致：

- ChatGPT：去除官网 favicon 随系统主题切换黑/白的 style，将其官方浅色主题默认黑色 #000 固定为属性，避免系统暗色模式在浅色底板上变成白色。
- Docker：从官网 ZIP 选择 Ocean Blue 独立鲸鱼 mark，将 CSS class 内 fill/clip-path 解析为原值属性并去除 style，保留 #2560FF、原始 path、viewBox 与内部裁切。
- MongoDB：从官方 LeafyGreen 的 MongoDBLogoMark 组件导出原始 path 和 viewBox，按同提交 Logo.types 与 palette 的组件默认值固化 #00684A。没有重画形状或从第三方图标反推。
- Codex/OpenAI：官方 ZIP 没有紧视窗 Blossom。仅把两个相同文件的 viewBox 从 0 0 716 716 裁为 168 168 380 380；精确 path 包围盒约为 (180.499807, 180.499943)–(535.173327, 535.173926)，四边保留约 12.50–12.83 单位边距（约主体宽度 3.5%）。path、颜色和 width/height 均未改，避免原图留白令20px图标的主体过小。

Vite 官方资源含静态矢量 mask 和滤镜，保持原样；没有脚本、动画、外部资源引用或新增运行库。保留黑白的可选项为 Codex、ChatGPT、Cursor、Ollama、Express、GitHub、Next.js、Vercel，共 8 项；它们不为追求彩色而任意染色。另有旧 OpenAI 黑色兼容图。

## 许可、署名与使用说明

- 官网品牌素材遵循各自品牌页的商标与使用说明；不因下载为本地文件而把品牌素材改称 CC0/MIT。
- React 官方仓库为 MIT，保留 [许可全文](LICENSE-REACT.txt)；MongoDB LeafyGreen 官方仓库为 Apache-2.0，保留 [许可全文](LICENSE-LEAFYGREEN.txt)，品牌使用另以 MongoDB 官方品牌页为准。
- Vue.js artworks 原作 Evan You，遵循 [CC BY-NC-SA 4.0及官方附加条件](https://github.com/vuejs/art/blob/a1c78b74569b70a25300925b4eacfefcc143b8f6/README.md)。Git logo 原作 Jason Long，遵循 [CC BY 3.0](https://creativecommons.org/licenses/by/3.0/)及[官方说明](https://git-scm.com/community/logos)。JavaScript logo 原作 Christopher Williams，附 [MIT 许可](LICENSE-LOGO-JS.txt)。
- 开源图标素材的库级许可保留：[Simple Icons CC0](LICENSE-SIMPLE-ICONS.txt)、[Lobe Icons MIT](LICENSE-LOBE-ICONS.txt)、[Devicon MIT](LICENSE-DEVICON.txt)。[Simple Icons 官方声明](https://github.com/simple-icons/simple-icons/blob/c8a98c7099c33a8ef8461dd97263235f348e7077/DISCLAIMER.md)明确库级许可不能代替每个品牌图形的独立许可与商标规则；下表逐项记录其固定版本元数据与品牌来源。
- 所有名称和标志属于各自权利人，只用于说明涉及的技术，不表示合作、赞助或背书。

## 品牌官方来源的 13 个本地 SVG

完整原始下载 SHA-256、ZIP 内文件名、ZIP 校验值、转换说明及原来源历史见 [SOURCES.json](SOURCES.json)。

| slug / 名称 | 官方下载或仓库源 | 原始颜色 | 许可或使用说明 | 本地结果 |
| --- | --- | --- | --- | --- |
| codex / Codex | [源文件](https://cdn.openai.com/brand/openai-logos.zip) | black | OpenAI 官方商标与品牌使用条款；黑色 Blossom；Codex 未找到独立可下载 SVG，以所属 OpenAI 品牌图形替代；[品牌/仓库说明](https://openai.com/brand/) | 2419 B；官方资源已本地化 |
| chatgpt / ChatGPT | [源文件](https://chatgpt.com/cdn/assets/favicon.6a33781f61.svg) | #000 | ChatGPT 官网原始 favicon；遵循 OpenAI 品牌条款；[品牌/仓库说明](https://chatgpt.com/) | 4094 B；官方资源已本地化 |
| claude / Claude | [源文件](https://claude.com/icon.svg) | #D97757 | Claude 官网产品图形；Anthropic/Claude 商标；保留原始 #D97757；[品牌/仓库说明](https://claude.com/) | 2558 B；官方资源已本地化 |
| deepseek / DeepSeek | [源文件](https://fe-static.deepseek.com/chat/favicon.svg) | #4D6BFE | DeepSeek 官网引用的官方 CDN favicon；品牌识别使用；保留原始 #4D6BFE；[品牌/仓库说明](https://chat.deepseek.com/) | 3642 B；官方资源已本地化 |
| cursor / Cursor | [源文件](https://cursor.com/favicon.svg) | #14120b, #edecec | Cursor 官网 favicon；品牌识别使用；保留官方黑色与浅色；[品牌/仓库说明](https://cursor.com/) | 4190 B；官方资源已本地化 |
| react / React | [源文件](https://raw.githubusercontent.com/facebook/react/d71b537241d26861df496413db2142c7ba192c25/fixtures/dom/public/react-logo.svg) | #61dafb | React 官方组织仓库；MIT，附 LICENSE-REACT.txt；保留 #61DAFB；[品牌/仓库说明](https://github.com/facebook/react) | 2883 B；官方资源已本地化 |
| vuedotjs / Vue | [源文件](https://raw.githubusercontent.com/vuejs/art/a1c78b74569b70a25300925b4eacfefcc143b8f6/logo.svg) | #35495e, #42b883 | Vue.js artworks 原作 Evan You；CC BY-NC-SA 4.0 及官方附加条件；保留双色；[品牌/仓库说明](https://github.com/vuejs/art/blob/a1c78b74569b70a25300925b4eacfefcc143b8f6/README.md) | 261 B；官方资源已本地化 |
| typescript / TypeScript | [源文件](https://www.typescriptlang.org/branding/typescript-design-assets.zip) | #3178c6, #fff | TypeScript 官网品牌素材及使用说明；蓝底白字原版；[品牌/仓库说明](https://www.typescriptlang.org/branding/) | 1747 B；官方资源已本地化 |
| vite / Vite | [源文件](https://raw.githubusercontent.com/voidzero-dev/community-design-resources/55902097229cf01cf2a4ceb376f992f5cf306756/brand-assets/vite/vite-icon-color-bracketless.svg) | #00C2FF, #8900FF, #9135FF, #EEE6FF, black | VoidZero 官方组织品牌资源；保留官方颜色、静态矢量 mask 与滤镜；未套用 Simple Icons 的项目许可；[品牌/仓库说明](https://github.com/voidzero-dev/community-design-resources) | 10098 B；官方资源已本地化 |
| nestjs / NestJS | [源文件](https://nestjs.com/img/logo-small.svg) | #e0234e | NestJS 官网原始 mark；品牌识别使用；保留 #E0234E；[品牌/仓库说明](https://nestjs.com/) | 11624 B；官方资源已本地化 |
| mongodb / MongoDB | [源文件](https://raw.githubusercontent.com/mongodb/leafygreen-ui/be0774c73ce70d359d112f3be7790c9ed0dce4a6/packages/logo/src/Logos/MongoDBLogoMark.tsx) | #00684A | MongoDB 官方组织 LeafyGreen 仓库，Apache-2.0 附 LICENSE-LEAFYGREEN.txt；商标遵循官方品牌规则；[品牌/仓库说明](https://www.mongodb.com/company/newsroom/brand-resources) | 709 B；官方资源已本地化 |
| docker / Docker | [源文件](https://www.docker.com/static/Docker-Logos-1.zip) | #2560ff | Docker 官网品牌素材及使用规则；Ocean Blue 独立鲸鱼 mark，保留 #2560FF；[品牌/仓库说明](https://www.docker.com/company/newsroom/media-resources/) | 899 B；官方资源已本地化 |
| openai / OpenAI（既有兼容文件） | [源文件](https://cdn.openai.com/brand/openai-logos.zip) | black | OpenAI 官方商标与品牌使用条款；黑色 Blossom；Codex 未找到独立可下载 SVG，以所属 OpenAI 品牌图形替代；[品牌/仓库说明](https://openai.com/brand/) | 2419 B；官方资源已本地化 |

## 开源图标库的 26 个本地文件

本轮补齐其中 21 项的品牌原色：17 项取 Devicon v2.16.0 的 original 文件，Gemini 取 Lobe Icons 1.102.0 的 color 文件；Tailwind CSS、Spring Boot、Nginx 仅使用固定 Simple Icons 元数据中的品牌 hex。Devicon 的 Nginx original 是横向 wordmark，未用于小图标；保留原有六边形 N mark。Tailwind 保留现有独立波形，避免多余留白影响20px显示。

JavaScript 使用黄底黑字的完整多色原版，Python 为蓝黄双色，HTML/CSS 为原层次盾牌；没有把整个轮廓随意涂成一种亮色。Go 为同版本原彩色 Gopher，Linux 为同版本完整彩色 Tux（193922 B）。

Ollama、Express、GitHub、Next.js、Vercel 五项原文件保持不变。这些素材继续明确为开源库来源，没有改称为品牌官网文件。原始下载和当前文件哈希、完整色值及前版本来源见 [SOURCES.json](SOURCES.json)。

| slug / 名称 | 固定开源图标源 | 原色与处理 | 许可或使用说明 / 品牌原始来源 | 实际结果 |
| --- | --- | --- | --- | --- |
| gemini / Gemini | [SVG](https://unpkg.com/@lobehub/icons-static-svg@1.102.0/icons/gemini-color.svg) | 原色文件；#08B962, #3186FF, #F94543, #FABC12 | Lobe Icons MIT；保留原色版和许可全文；[品牌来源](https://gemini.google/) | 品牌色已本地化，2836 B |
| ollama / Ollama | [SVG](https://unpkg.com/@lobehub/icons-static-svg@1.102.0/icons/ollama.svg) | 原黑白品牌表示；本轮未改 | Lobe Icons MIT；保留上游许可全文；[品牌来源](https://ollama.com/) | 保留原文件，3290 B |
| javascript / JavaScript | [SVG](https://raw.githubusercontent.com/devicons/devicon/v2.16.0/icons/javascript/javascript-original.svg) | 原色文件；#323330, #F0DB4F | Devicon 库级 MIT；品牌及原作权利仍遵循品牌来源说明；JavaScript logo 原作 Christopher Williams，附 MIT 许可；[品牌来源](https://github.com/voodootikigod/logo.js/blob/1544bdeed6d618a6cfe4f0650d04ab8d9cfa76d9/js.svg) | 品牌色已本地化，1144 B |
| html5 / HTML5 | [SVG](https://raw.githubusercontent.com/devicons/devicon/v2.16.0/icons/html5/html5-original.svg) | 原色文件；#E44D26, #EBEBEB, #F16529, #fff | Devicon 库级 MIT；品牌及原作权利仍遵循品牌来源说明；[品牌来源](https://www.w3.org/html/logo/) | 品牌色已本地化，607 B |
| css3 / CSS3 | [SVG](https://raw.githubusercontent.com/devicons/devicon/v2.16.0/icons/css3/css3-original.svg) | 原色文件；#1572B6, #33A9DC, #EBEBEB, #fff | Devicon 库级 MIT；品牌及原作权利仍遵循品牌来源说明；[品牌来源](https://www.w3.org/html/logo/) | 品牌色已本地化，778 B |
| nextdotjs / Next.js | [SVG](https://raw.githubusercontent.com/simple-icons/simple-icons/c8a98c7099c33a8ef8461dd97263235f348e7077/icons/nextdotjs.svg) | 原黑白品牌表示；本轮未改 | Simple Icons CC0；元数据未列独立许可；遵循对应品牌使用说明；[品牌来源](https://vercel.com/design/brands#next-js) | 保留原文件，322 B |
| antdesign / Ant Design | [SVG](https://raw.githubusercontent.com/devicons/devicon/v2.16.0/icons/antdesign/antdesign-original.svg) | 原色文件；#0a60ff, #148eff, #29cdff, #2ec7ff, #4285eb, #f51d2c, #f74a5c, #fa816e 等 | Devicon 库级 MIT；品牌及原作权利仍遵循品牌来源说明；[品牌来源](https://ant.design) | 品牌色已本地化，3026 B |
| tailwindcss / Tailwind CSS | [SVG](https://raw.githubusercontent.com/simple-icons/simple-icons/c8a98c7099c33a8ef8461dd97263235f348e7077/icons/tailwindcss.svg) | 现独立 mark；固定元数据 #06B6D4 根 fill | Simple Icons CC0；元数据未列独立许可；遵循对应品牌使用说明；[品牌来源](https://tailwindcss.com/brand) | 品牌色已本地化，617 B |
| nodedotjs / Node.js | [SVG](https://raw.githubusercontent.com/devicons/devicon/v2.16.0/icons/nodejs/nodejs-original.svg) | 原色文件；#3DA92E, #3DAE2B, #3E9638, #3F873F, #3F8B3D, #52A044, #64B749, #6ABF4B | Devicon 库级 MIT；品牌及原作权利仍遵循品牌来源说明；[品牌来源](https://nodejs.org/en/about/branding) | 品牌色已本地化，1806 B |
| express / Express | [SVG](https://raw.githubusercontent.com/simple-icons/simple-icons/c8a98c7099c33a8ef8461dd97263235f348e7077/icons/express.svg) | 原黑白品牌表示；本轮未改 | Simple Icons CC0；元数据未列独立许可；遵循对应品牌使用说明；[品牌来源](https://github.com/openjs-foundation/artwork/blob/3816245ebbf4707bdafde748350ac8476b6b5b62/projects/express/express-icon-black.svg) | 保留原文件，959 B |
| python / Python | [SVG](https://raw.githubusercontent.com/devicons/devicon/v2.16.0/icons/python/python-original.svg) | 原色文件；#306998, #5A9FD4, #7F7F7F, #B8B8B8, #FFD43B, #FFE873 | Devicon 库级 MIT；品牌及原作权利仍遵循品牌来源说明；[品牌来源](https://www.python.org/community/logos/) | 品牌色已本地化，2300 B |
| fastapi / FastAPI | [SVG](https://raw.githubusercontent.com/devicons/devicon/v2.16.0/icons/fastapi/fastapi-original.svg) | 原色文件；#049688 | Devicon 库级 MIT；品牌及原作权利仍遵循品牌来源说明；[品牌来源](https://github.com/tiangolo/fastapi/blob/ffb4f77a11f83132b521ba0aac6c95792c19e797/docs/en/docs/img/icon-white.svg) | 品牌色已本地化，3065 B |
| java / Java | [SVG](https://raw.githubusercontent.com/devicons/devicon/v2.16.0/icons/java/java-original.svg) | 原色文件；#0074BD, #EA2D2E | Devicon 库级 MIT；品牌及原作权利仍遵循品牌来源说明；[品牌来源](https://www.java.com/) | 品牌色已本地化，1540 B |
| springboot / Spring Boot | [SVG](https://raw.githubusercontent.com/simple-icons/simple-icons/c8a98c7099c33a8ef8461dd97263235f348e7077/icons/springboot.svg) | 现独立 mark；固定元数据 #6DB33F 根 fill | Simple Icons CC0；元数据未列独立许可；遵循对应品牌使用说明；[品牌来源](https://spring.io/projects) | 品牌色已本地化，1001 B |
| go / Go | [SVG](https://raw.githubusercontent.com/devicons/devicon/v2.16.0/icons/go/go-original.svg) | 原色文件；#231F20, #6AD7E5, #C6B198, #F6D2A2, #fff | Devicon 库级 MIT；品牌及原作权利仍遵循品牌来源说明；[品牌来源](https://blog.golang.org/go-brand) | 品牌色已本地化，8965 B |
| mysql / MySQL | [SVG](https://raw.githubusercontent.com/devicons/devicon/v2.16.0/icons/mysql/mysql-original.svg) | 原色文件；#00618A | Devicon 库级 MIT；品牌及原作权利仍遵循品牌来源说明；[品牌来源](https://www.mysql.com/about/legal/logos.html) | 品牌色已本地化，2765 B |
| postgresql / PostgreSQL | [SVG](https://raw.githubusercontent.com/devicons/devicon/v2.16.0/icons/postgresql/postgresql-original.svg) | 原色文件；#336791, #fff | Devicon 库级 MIT；品牌及原作权利仍遵循品牌来源说明；[品牌来源](https://www.postgresql.org/about/policies/trademarks/) | 品牌色已本地化，9178 B |
| redis / Redis | [SVG](https://raw.githubusercontent.com/devicons/devicon/v2.16.0/icons/redis/redis-original.svg) | 原色文件；#7A0C00, #A41E11, #AD2115, #D82C20, #fff | Devicon 库级 MIT；品牌及原作权利仍遵循品牌来源说明；[品牌来源](https://redis.io/brand-guidelines) | 品牌色已本地化，1728 B |
| kubernetes / Kubernetes | [SVG](https://raw.githubusercontent.com/devicons/devicon/v2.16.0/icons/kubernetes/kubernetes-original.svg) | 原色文件；#326ce5, #fff | Devicon 库级 MIT；品牌及原作权利仍遵循品牌来源说明；[品牌来源](https://github.com/kubernetes/kubernetes/tree/cac53883f4714452f3084a22e4be20d042a9df33/logo) | 品牌色已本地化，8951 B |
| nginx / Nginx | [SVG](https://raw.githubusercontent.com/simple-icons/simple-icons/c8a98c7099c33a8ef8461dd97263235f348e7077/icons/nginx.svg) | 现独立 mark；固定元数据 #009639 根 fill | Simple Icons CC0；元数据未列独立许可；遵循对应品牌使用说明；[品牌来源](https://www.nginx.com/press/) | 品牌色已本地化，428 B |
| linux / Linux | [SVG](https://raw.githubusercontent.com/devicons/devicon/v2.16.0/icons/linux/linux-original.svg) | Devicon 原彩色 Tux（黑白黄及原渐变）；原字节 | Devicon 库级 MIT；品牌及原作权利仍遵循品牌来源说明；[品牌来源](https://www.linuxfoundation.org/the-linux-mark/) | 品牌色已本地化，193922 B |
| git / Git | [SVG](https://raw.githubusercontent.com/devicons/devicon/v2.16.0/icons/git/git-original.svg) | 原色文件；#F34F29 | Devicon 库级 MIT；品牌及原作权利仍遵循品牌来源说明；Git logo 原作 Jason Long，CC BY 3.0；[品牌来源](https://git-scm.com/community/logos) | 品牌色已本地化，778 B |
| github / GitHub | [SVG](https://raw.githubusercontent.com/simple-icons/simple-icons/c8a98c7099c33a8ef8461dd97263235f348e7077/icons/github.svg) | 原黑白品牌表示；本轮未改 | Simple Icons CC0；元数据未列独立许可；遵循对应品牌使用说明；[品牌来源](https://github.com/logos) | 保留原文件，822 B |
| githubactions / GitHub Actions | [SVG](https://raw.githubusercontent.com/devicons/devicon/v2.16.0/icons/githubactions/githubactions-original.svg) | 原色文件；#2088ff, #79b8ff | Devicon 库级 MIT；品牌及原作权利仍遵循品牌来源说明；[品牌来源](https://github.com/features/actions) | 品牌色已本地化，2854 B |
| vercel / Vercel | [SVG](https://raw.githubusercontent.com/simple-icons/simple-icons/c8a98c7099c33a8ef8461dd97263235f348e7077/icons/vercel.svg) | 原黑白品牌表示；本轮未改 | Simple Icons CC0；元数据未列独立许可；遵循对应品牌使用说明；[品牌来源](https://vercel.com/geist/brands) | 保留原文件，132 B |
| cloudflare / Cloudflare | [SVG](https://raw.githubusercontent.com/devicons/devicon/v2.16.0/icons/cloudflare/cloudflare-original.svg) | 原色文件；#F38020, #FAAE40, #FFF | Devicon 库级 MIT；品牌及原作权利仍遵循品牌来源说明；[品牌来源](https://www.cloudflare.com/trademark/) | 品牌色已本地化，1175 B |

## 实际验证

- 当前 38 个可选技术为 30 项可核实的品牌色表示、8 项品牌黑白表示；不声称全部图形来自品牌官网。13 个上一轮官方文件（含已裁窗 Codex/OpenAI）本轮 SHA-256 完全不变。
- 21 项品牌色导入/转换均有固定来源和原始下载校验值；17 个 Devicon original 与 Gemini color 为原始字节直接落盘，3 个元数据单色品牌转换保留原路径。
- 39/39 SVG 可被 XML 解析，viewBox 均为非零；39 条 manifest 字节数与 SHA-256 对应当前文件。
- 13 个官方导入文件的 path 与其官方源逐字一致。13 项原始下载校验值及 4 项表示转换（5 个文件）均已记录；Codex fallback 身份明确。
- 只保留静态矢量/内部定义/静态滤镜元素；无 script、foreignObject、事件属性、href/src 外部引用、CSS 导入、DOCTYPE/实体、嵌入图片或活动元素。所有 url(#id) 仅引用本文件存在的定义；Go 的 use href 也仅引用同文件存在的 #go-original-a，无网络请求。
- 源码/格式检查不替代浏览器；选择器、公开页的原色可见性与配置数据由集成任务验收。此次没有更改选择 slug、技术名称、配置内容、TS 或 LESS。
