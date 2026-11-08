# SPEC-003 第四轮：入口、提示与公开播放器审查

- 核对日期：2026-11-07（Asia/Shanghai）；基准 `82acde8` 加当前未提交工作区。
- 范围：P14–P16 与 P17 公开播放集成，包括 App/router、site-entry/intro、site-login/tip、site-music、公开页相关接入。后台音乐字段与音频上传由音乐配置任务另行审查。
- 结论：**当前范围没有未关闭的 P0/P1/P2。** 两处审查中发现的问题已由整合代理修改并复核。此报告不是全量浏览器、真实音频解码或后端验证结论。
- 本审查未修改产品文件、真实配置或数据，未提交、推送、部署；仅新增本报告与 `/tmp` 临时断言。

## 审查独立性

- 入口最初由本审查代理实现，因此本代理对 entry/intro 的检查标为自查；另派独立只读代理复核入口、时间边界和深链集成，独立结论为未发现 P0–P2。
- login/tip 与 site-music 并非本审查代理实现，按独立源码审查执行；播放器与消息视图的临时断言由本审查代理独立编写。登录复用了实现代理的临时断言，并在当前源码上重新执行，不能把这些断言的编写归属写为独立。

## 已关闭发现

1. **P2：音乐异步错误可能被原生弹窗遮住并过期。** 点击音乐后立即打开阅读/登录，原先音乐 SiteTip 在普通 utilityDock 下，无法越过浏览器 modal top-layer，4.66 秒后即消失。整合代理增加 `obscured={panelOpen || loginOpen}`：音乐失败在遮挡期间存于当前播放会话，关闭弹窗后再显示；换源/卸载丢弃旧会话错误。最新实际模块断言覆盖该分支，已关闭。
2. **P2：接入 obscured 时误传给 SiteLoginPanel。** 中途 `pages/site/index.tsx` 曾同时给不接受此字段的登录组件传入，构建类型检查会失败；已告知整合代理并核对删除，只保留在 SiteMusicPlayer 上，已关闭。

## 审查要点与结果

### 冷启动与深链

- 单个入口动画由 App 静态导入，主页、配置页、任务页仍 lazy；只初始 `/` 文档有资格播放，初始后台/任务和其后的客户端切换不追加开场。
- 不再在开始时写 sessionStorage；硬刷新新 App 可播放，同 App 完成/退出后不重复。读取本地关闭与系统 reduce，服务端关闭配置到达后也能终止开场。
- 完整书写与停留结束才允许显影；公共数据和主图 decode 就绪后释放。资源等待 8 秒、CSS 完成事件缺失时 12 秒可见时间保险均有清理；隐藏时 CSS 与保险时间暂停。
- `useSiteEntryReady` 无条件报告非预览首页的 ready，返回 entering 不反向阻断准备状态。公开页阅读 dialog 在 entering 期间延后 showModal，退出开场后继续打开；场景动效与流体也在 entering 时暂停。
- lazy 拒绝与过长等待有重载入口。新加入的 Vite DEV 错误诊断仅输出 error.message；不改变生产错误提示。

### 登录和提示

- 错误不再以参与表单布局的 alert 段落出现，仍保留输入、本地字段校验、首次错误焦点和隐藏读屏说明。登录失败不会把两个字段一律标为无效。
- SiteTip 放在登录原生 dialog 内，sticky 零高度容器不撑开表单；没有企图以 body portal 的 z-index 穿透 top-layer。
- 同错误重复产生新消息编号，替换唯一显示/退出计时器；4500ms 后退出，160ms 后清除。清理、关闭和卸载均取消计时器，关闭后迟到登录结果不重新显示或跳转。
- 恢复失败提示过期后，重新连接入口仍存在；切换失败保留身份与重试入口。消息出现不抢焦点，仅在退出时关闭按钮仍持有焦点才恢复原焦点。
- 消息作为普通 React 文本渲染，错误 alert、普通 status、atomic 与关闭按钮语义存在；系统/手动减少动画有对应样式。

### 音乐

- 未启用、无音源、后台预览均不出现假入口；Audio 仅在访客点击时创建，没有挂载即下载或自动播放。
- sourceUrl 作为 MusicSession key；换源、禁用和离开公开页会卸载旧会话，暂停并移除音源/事件，作废在途 play Promise。换源不自动恢复播放。
- 请求编号和当前 Audio 引用共同阻断取消、失败、卸载后的迟到 Promise。失败可重试，已有媒体错误的元素会释放后重建；正在加载时再次点击能够取消。
- 开始与播放中再次 buffering 都有 12 秒上限；成功播放、暂停、失败、自然结束与卸载清理等待计时器。音量与循环修改作用于当前 Audio。
- 音乐是独立的“音乐 · 开/关/加载中”控件；环境动效按钮明确为“动效 · 开/关”，页脚旧重播与回首屏操作已删除。
- 读取的音源与音量来自已有 API 运行时校验；公开页不承担上传、下载代理或权限判断。

## 本轮实际验证

- `/tmp/nest-player-review.cjs`：**34/34**，其中音乐28条、SiteTip视图6条。运行真实 TSX 与 useSiteTip 模块，模拟 React hooks、Audio、DOM、timer；覆盖禁止自动播放、取消/重试、迟到 resolve/reject、媒体错误、后续 buffering、超时、源切换、卸载、StrictMode、遮挡期间延期提示及提示焦点/ARIA。
- `/tmp/nest-login-tips-check.cjs`：本轮重跑 **33/33**；真实登录组件与 hook，认证响应/DOM为模拟。这里沿用测试脚本，不沿用旧执行结果。
- 独立入口代理 `/tmp/nest-entry-independent-review.test.cjs`：当前模块 **37/37**。原临时 CommonJS VM 脚本不识别新增 `import.meta.env.DEV`；独立临时副本仅将构建环境常量替换为 false 后执行，未改产品代码。
- `git diff --check`：本轮执行退出 0。
- 未重跑全量 lint/build、后端 HTTP，未操作根代理正在使用的浏览器；这些由整合代理记录。上述模拟不能当作真实 HTMLMediaElement 解码、实际网络故障、原生 top-layer/手机键盘或屏幕阅读器覆盖。

## 审查时文件指纹

| 文件 | SHA-256 |
| --- | --- |
| `components/site-music/index.tsx` | `b96fe9ecfca2b3057304a7d1bd12e91b41a9bd57dc6770cc14f4df0afa5ff71a` |
| `components/site-tip/use-site-tip.ts` | `ff7c3e5135ac265fd5768e676cb7e557d79db38ac34c414237842744ef664842` |
| `components/site-tip/site-tip.tsx` | `0fcc05c49b633aa0f9a4b73d63a65fa1e154e705434c87c8cb8f8c84b7ecb77f` |
| `components/site-login/index.tsx` | `7b64e01910daa7e4e85b0d164df1184a1b8c11da2c6f362d99b38130f24b4698` |
| `components/site-entry/index.tsx` | `ec89e995df22d1af808d9804b77669beccb63e461f6f596d898c7b7c2feacb53` |
| `components/site-intro/index.tsx` | `3852b0a9cbb1050b6f7eb76cf8f7fa51f95042867cedafd24313dd77f08fd3cb` |
| `pages/site/index.tsx` | `93056e0417ff575669e57e881124d0222d46823f70c76ec550c5300fe3d7d92d` |

路径均相对 `frontend/src/`。后续相关源码变化需核对受影响边界，不能把本报告自动扩展到未审版本。
