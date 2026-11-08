# SPEC-003 P15：登录浮层提示

- 核对日期：2026-11-07（Asia/Shanghai）；基准 `82acde8`，当前未提交工作区。
- 范围：`frontend/src/components/site-login/` 与新 `frontend/src/components/site-tip/`。没有修改公开页、App/router、admin、认证 store 或 API。
- 依据：[SPEC-003 第四轮 P15](../../specs/003-personal-site.md#第四轮用户反馈首载控件语义提示与音乐2026-11-07实施中)，细化 AC02、AC07。
- 已读取 AGENT、STATE、架构、前端约定、当前 SPEC、系统调试/TDD/完成前验证技能；复用已经明确的 UI 方向，不创建规格副本、worktree 或提交。

## 实现与接口

- 根因是表单内错误 `<p>` 参与布局，并将服务端认证错误映射成两个字段同时无效。现改为独立的奶油白消息浮层，橄榄图标与文字、暖橙错误状态；移除红错误块及输入框的错误红边样式。
- `site-tip/index.ts` 导出 `SiteTip`、`useSiteTip`、`SiteTipMessage`、`SiteTipTone`。使用：

```tsx
const { tip, showTip, dismissTip, clearTip } = useSiteTip()
showTip('音频暂时无法播放', 'error')
<SiteTip tip={tip} onClose={dismissTip} reducedMotion={reducedMotion} />
```

- `showTip(message, tone?)`：tone 为 `info | success | error`，默认 info。同文案再次调用会生成新消息标识并重启唯一计时器；4500ms 自动退出，退出动画160ms。`dismissTip()` 手动退出；`clearTip()` 立即清空消息及全部 timer；卸载取消 timer，过期回调不会继续更新卸载状态。
- `SiteTip` 可选 `className` 控制容器位置，默认视口顶部居中。错误使用 `role="alert"`，其它状态使用 `role="status"`；关闭按钮可通过键盘访问。出现时不调用 focus；提示退出时仅当关闭按钮正在持有焦点才还原之前的元素。系统与手动 reduce 均取消消息动画。
- 登录把组件放在原生 dialog 内，并用 sticky、零高度容器悬浮在内容上方；不使用 body portal，因此不依赖 z-index 穿越浏览器 top layer。左右给弹层关闭按钮留空间，消息不影响表单或 dialog 高度。
- 本地无效输入显示同一消息；保留 `aria-invalid`、隐藏读屏描述及首个无效字段焦点。服务端登录失败不会把两个输入字段都标为无效；账号密码原样保留，不记录日志、URL 或本地存储。
- 恢复失败与切换失败同样走消息。恢复失败保留静态说明及“重新连接”，提示消失后仍可重试；即使连续快速失败返回相同状态/文案，也会重新显示。原有请求互斥、焦点捕获、滚动锁、切换重试保留。
- 关闭/成功清消息；通过面板打开周期标识忽略外部关闭后的迟到登录/切换结果，防止重新弹错或误导航。

## 本次验证

- 先用真实登录模块转译、模拟 Hook/DOM/认证响应复现：失败断言为“登录错误不应插入改变布局的 alert 段落”，原实现失败。修正后同断言通过。
- `/tmp/nest-login-tips-check.cjs`：33/33 定向断言通过。覆盖本地校验/重复校验、服务端同错重复提示、失败输入保留、无内联 alert/全字段无效、4500ms+160ms 生命周期、手动关闭、提交/关闭互斥、切换失败与重试、恢复失败与提示过期后重试、相同恢复错误、父级关闭后的迟到结果、成功清理、卸载 timer 和滚动锁。
- 这些是实际组件/hook 代码的模拟环境证据，不是浏览器、真实网络认证或正式前端测试套件；项目无 `test` 脚本，未新增框架或依赖。
- `oxlint src/components/site-login src/components/site-tip`：通过，无告警。
- 使用项目现有 Less API 编译两份样式：通过；提示2257字符、登录10147字符 CSS。
- `git diff --check`：通过。
- 尝试 `npm run check`：未通过，唯一输出为并行 P17 尚未补完的 `src/api/site.ts:81` 返回对象缺必填 `music`；没有 P15 文件错误。已通知根整合，由音乐接口收口后统一复验，不把此结果写成 TypeScript 已通过。
- 全量 lint/build 与真实桌面/手机浏览器由根整合统一执行；本代理未执行，不能把上述检查扩展为已通过浏览器布局或读屏验收。服务端行为不变，未重跑历史 HTTP 套件。

## 交接

- 导出接口已经通知整合代理，可供音乐控件复用。后续音乐错误与登录提示各持有自己的 hook，不共享消息状态或 timer。
- 根浏览器重点：错误提示在原生 dialog 中可见；错误前后账号/密码/按钮纵坐标不变；错误输入保留；同错重复可提示；4.66秒消失及手动关闭；关闭后重开无旧提示；390px/320px 和低高度手机可见且无溢出；Tab 能抵达消息关闭按钮。
- 当前没有已确认的代码阻塞；无提交、推送、部署、worktree。
