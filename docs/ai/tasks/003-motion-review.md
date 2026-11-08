# SPEC-003 P6/P7/P9：第二轮增量独立审查

- 核对日期：2026-11-07（Asia/Shanghai）。代码基准 `82acde8`；审查当前未提交源码，不以空提交差异代替新增文件。
- 范围：`frontend/src/pages/site/{index.tsx,style.module.less,use-scene-motion.ts}`、`components/site-login/`、`components/site-intro/`。只读检查依赖的 `store/auth.ts`，未扩展到首版已通过的后端/配置功能。
- 已读：根 AGENT、STATE、架构、frontend/AGENTS、SPEC-003 第二次迭代/P9，以及 P6/P7/P9 报告。首轮源码包 `/tmp/nest-motion-login-review.txt` 的 7 个文件与当时工作区逐文件匹配；P2 修复复核时，仅 page index.tsx 的品牌 ref 声明、绑定与重播 focus 三处发生变化，其余 6 文件仍匹配。
- 审查者仅新增本报告和 `/tmp` 临时验证脚本；未修改产品代码，未使用浏览器、真实认证、子代理、提交或推送。

## 结论

- **规格符合性：通过本轮代码审查。** 首页站主入口、预览禁用认证、真实登录状态、SVG 书写/毛玻璃显影、会话一次/重播/跳过、系统与手动减弱、桌面可逆滚动和手机简化均有对应实现。重播焦点 P2 已完成最小修复并通过定向代码复核；最终真实交互由 P8 整合者确认。
- **实现质量：通过本轮代码审查，阻塞清单已清空。** 事件、rAF、延迟关闭、原生 dialog 与 body overflow 的清理路径完整；没有发现密码持久化、前端假定 owner、公开预览发起认证或破坏原 MobX/history 边界的增量路径。
- **已关闭问题：P2，重播后焦点回到屏外页脚。** `frontend/src/pages/site/index.tsx:312` 先滚到首屏，但未转移仍在页脚的焦点；`frontend/src/components/site-intro/index.tsx:56,59–66` 捕获/恢复该原始焦点。触发：从页脚用键盘进入“重看开场”，Esc 或自然结束；当前视口在首屏，焦点留在屏外页脚，下一次 Tab 又将视口拉到页脚。根代理实际报告 `scrollY=0`、Esc 后 activeElement 为页脚重播按钮，确认并非纯理论问题。修复已在当前 `frontend/src/pages/site/index.tsx:90,245,313` 新增并绑定 `brandRef`，重播严格依次回首屏 → `brandRef.current?.focus({ preventScroll: true })` → 增加 replayKey。组件打开时捕获的是首屏可见 HEY 品牌按钮，Esc/自然结束共用的原生恢复目标随之正确，未改变 intro 通用关闭逻辑。已定向核对相对审查快照的完整差异，修复只含这三处；根代理随后真实验证 Esc/自然结束/Tab 均通过（见下方复核记录）；本审查者未使用浏览器。
- 上述问题在首轮静态/模拟结论形成之后由根代理浏览器反馈确认；本报告据新增证据更新，没有将审查者未执行的浏览器操作写成自身结果。

## 核对依据

| 关注点 | 本轮证据 |
| --- | --- |
| 开场不依赖 API，结束后解除遮挡 | `components/site-intro/index.tsx:39–101` 仅使用 sessionStorage、media、dialog；`style.module.less:23` 为 2600ms clearGlass，`index.tsx:116–118` 接收自身 animationend 并 finish。finish/cleanup 都关闭 dialog。没有 timer/rAF 残留路径。 |
| 会话一次、重播、StrictMode、跳过/Esc | intro 的独立 session key 和内存回退、`index.tsx:41–55` 的 replay/unfinished 区分、`108–117`/`135` 的统一 finish。组件常驻挂载，页脚按钮增加 replayKey（`pages/site/index.tsx:313,332`）。 |
| 隐藏/减弱时不锁死 | intro `77–85` 的 visibility/media 监听与 `96–100` 清理；CSS `31` 暂停全部笔迹与玻璃时间线；`enabled=false` 的 effect 清理关闭 modal。桌面 20px、手机 11px 模糊，reduce 双层兜底。 |
| 登录恢复和密码边界 | login `87–91` 只有 open 才恢复；`124–140` 复用 authenticate(login)，`75–78` 关闭清空、`138` 成功清空，密码只在受控 state/请求参数内，无 URL、日志或 storage 写入。失败保留账号并显示错误。 |
| 已有身份与切换 | login `181–206` 明确区分恢复中、恢复失败、已有用户、匿名；`143–149` 仅 logout 成功才清表单；失败保留 user 和重试按钮。进入 `/admin` 后沿用服务端 owner 权限，不在公开页推断 owner。 |
| 焦点、重复操作和滚动清理 | login `33–53` 关闭/卸载恢复 overflow、可见入口；`61–85` 打开/180ms 关闭及帧/定时器清理；`100–121` busy 阻止关闭及 Tab 捕获；输入/提交/切换按钮禁用共同防重复。手机菜单收起后用可见触发器兜底。 |
| 预览无认证副作用 | `pages/site/index.tsx:191–195` preview 返回；`251,253` 入口禁用；`331–332` 强制 login open=false 与 intro enabled=false。login 在关闭挂载状态不 restore。 |
| 连续滚动可逆、隐藏暂停 | `use-scene-motion.ts:28–69` 由当前 section 几何每次重算 clamp 进度，不积累方向状态，倒滚可恢复；输入合并为单帧，无空闲循环；hidden 取消帧。`86–102` 移除监听、Observer 和样式状态。 |
| 手机与动效关闭 | hook `23,32–46` 手机/preview/disabled 不启用场景变换；CSS `227–245` still 及桌面 sticky 分层，`283–337` 手机减少光点与短阅读入场。motionEnabled 同时组合配置、系统、访客关闭（page `108–121`）。 |
| 保留旧边界 | SiteExperience 和 ProjectImage 继续 observer；page `136–180,204–237` 原分类/URL/history/阅读关闭焦点与 body 清理逻辑仍在，动效只新增纸页来源坐标与展示层。 |

以上行号对应本报告核对时工作区，不保证后续修改后仍相同。

## 本轮实际验证

- `/tmp/nest-intro-review-check.cjs`：执行真实组件 TSX 的转译结果，轻量模拟 React hooks、DOM/dialog 与媒体事件，**19/19 断言通过**，退出 0。覆盖 disabled 无副作用、首次播放、session key、隐藏/显示、Tab、忽略冒泡动画事件、结束、重播、Esc、跳过、运行中 reduce、手动关闭、新挂载会话一次、StrictMode setup/cleanup、卸载及 2600ms CSS/暂停规则。
- `/tmp/nest-login-review-check.cjs`：执行真实组件 TSX 的转译结果，模拟 hooks、AuthStore 返回值与 DOM，**13/13 断言通过**，退出 0。覆盖关闭不恢复、打开恢复/锁滚动、失败不导航且保留输入、Esc 关闭清密码、手机可见入口兜底、已有账号状态、切换失败/重试、切换成功、登录成功只导航 `/admin`、卸载释放滚动。
- 脚本使用已有 backend TypeScript 转译库，没有添加依赖或前端测试框架。初次 harness 的 frontend TypeScript 库路径不可导入，以及跨 VM async 只等待单次 microtask 的问题，均修正于临时脚本后重跑；不是产品代码失败。
- 这些是生命周期/状态定向断言，**没有运行真实浏览器渲染、原生焦点算法、实际 CSS 时钟、手机软键盘或真实认证请求**。不能替代 P8 浏览器验收。
- 已有 P6/P7/P9 lint/check 与第一版后端 59/59 结果按报告沿用；本审查未重跑 lint/check/build/HTTP，未将沿用结果表述为本次执行。

## P2 修复定向复核

- 本次只检查与首轮 7 文件快照的差异；确认变化仅有 `brandRef` 声明、首屏 HEY 按钮绑定与重播中同步 focus。首屏品牌在桌面/手机样式均可见，focus 使用 preventScroll，不引入新滚动或异步竞态。
- 该顺序发生在事件 handler 内、更新 replayKey 前；intro 的 useLayoutEffect 随后捕获当前焦点，因此结束和 Esc 都会返回首屏品牌。原 modal/认证/scroll hook 未变，沿用本轮已通过 19/13 项定向断言，不重跑无关检查。
- 根代理回传修后真实浏览器证据：重播 → Esc 后 activeElement 的 aria-label 为“返回初次见面”、scrollY=0；下一次 Tab 聚焦“初次见面”、scrollY=0；另一次重播自然结束同样恢复首屏 logo、scrollY=0。P2 的代码与浏览器证据均已闭环。
- 根代理回传最终 frontend lint/build 均退出 0。本审查者未重跑；与本报告自身定向断言分开记录。

## 整合交接

根代理继续其已安排的浏览器范围：首页清晰结束与重播/skip/Esc、桌面/手机登录失败和成功、关闭焦点/滚动恢复、自然滚动往返、手动关闭后清晰可读、作品详情历史返回、后台预览禁用。系统 OS reduce、隐藏标签页暂停或手机软键盘若未实操，最终记录应继续区分源码/模拟证据与浏览器证据。
