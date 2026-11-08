# 连续双场景独立审查与浏览器验收

- 核对：2026-11-07（Asia/Shanghai），基准82acde8上的未提交工作区。
- 范围：SPEC-003 P18；只读审查 `frontend/src/pages/site/index.tsx`、`style.module.less`、`use-scene-motion.ts`、`use-capability-transition.ts`、`capability-content.tsx` 和 `capability-content.module.less`。其它大量既有未提交改动不属于本轮审查。
- 操作：本代理未改产品代码，未提交、推送或部署；只写本报告与浏览器截图。产品修正由整合者与实现代理完成。
- 范围：源码、实际hook定向模拟和下述Chrome实测；不扩展到系统reduce、真实触摸、Safari或后台预览等未执行边界。

## 结论与修正复核

当前没有未关闭的P0/P1/P2。源码及浏览器发现均已由整合者修正并复核，下面保留问题依据、关闭证据和验证范围。

1. **P2，已关闭：后台手机预览没有应用卡片横向布局。** 初始 `frontend/src/pages/site/capability-content.module.less:86` 只使用viewport媒体查询。后台在桌面浏览器里以390px内部画布预览手机（`frontend/src/pages/admin/index.tsx:27`），真实viewport仍≥768px，因此卡片未得到手机轨道，影响AC18-5/AC18-6。当前 `capability-content.module.less:86` 提取同一mobileCards mixin，`:118`、`:119` 分别在媒体和容器宽度≤767px时应用；已重新读取源码确认，后台预览本轮未登录实测。
2. **P2，已关闭：后台桌面预览仍沿用旧欢迎人物构图，双姿态脸部锚点明显偏离。** 初始 `frontend/src/pages/site/style.module.less:256` 的 `.preview .heroPortrait` 继续使用left10%/top100px/width90%/height125%，与新能力姿态错位；1040×720预览双眼约(587,382)→(674,307)，约(87,-75)px。当前 `style.module.less:470` 在桌面容器内覆盖为公开舞台的left22.5%/top12%/width80%/height105%，使计算差距缩小至约(11,-16)px。影响AC18-4/AC18-6；已重新读取源码确认。位置均为素材和布局推算，非浏览器观察。
3. **P2，已关闭：手动关闭动效仍保留新卡片hover/focus缩放。** 初始 `frontend/src/pages/site/capability-content.module.less:36` 的hover/focus scale只有系统reduce媒体查询复位，统一 `.still` 未覆盖新卡片，影响AC18-6。当前 `frontend/src/pages/site/style.module.less:467`、`:468` 用 `.still [data-capability-cards] button:hover/:focus-visible` 复位transform，`:471` 也复位新增欢迎按钮hover。已源码复核；真实Chrome关闭后键盘焦点卡片computed transform为none。

4. **P2，已关闭：舞台overflow hidden被滚入视图操作移动。** 初次浏览器中stage rect top0/height900，但scrollTop153（scrollHeight1053），人物与卡片整体上移并碰到导航。当前 `frontend/src/pages/site/style.module.less:108` 使用overflow clip；重复点击、键盘及四种尺寸复验stage.scrollTop均为0。正常文档滚动仍可用。
5. **P2，已关闭：开发热更新后状态与新动画初帧不同步。** 初次观察到scene1/busy false而欢迎仍可见；完整reload恢复，随后定位为effect重建初始化0帧、React状态仍保留1。当前 `frontend/src/pages/site/use-capability-transition.ts:29` 保存已收束场景，`:37`、`:45`、`:58` 据此恢复动画，`:122` 对齐重建状态。最终47断言覆盖端点与中途重建；最终完整reload后浏览器正反正常。未将此开发期现象误写为生产首载P1。
6. **P2，已关闭：能力态SCROLL提示叠在MacBook标志上。** 当前 `frontend/src/pages/site/index.tsx:333` 将提示加入discover角色，hook `:50` 与欢迎一起淡出，能力态移出Tab顺序并aria-hidden。最终桌面能力截图中提示已消失。
7. **P2，已关闭：手机欢迎人物与副标题重叠、脸部锚点偏离。** 初次390截图中头发压住副标题，首次下移又造成脸部位置/尺寸差。最终 `frontend/src/pages/site/style.module.less:451`、`:465` 以67%宽、素材aspect-ratio和bottom160匹配能力态自然尺寸，`:486` 对底部裁切作静态淡出。390与320最终欢迎截图中副标题、CTA清晰；390两姿态脸部尺度和眼线接近，无遮挡。
8. **P2，已关闭：欢迎态遗留隐藏卡片的滚动条与玻璃区域。** 当前 `frontend/src/pages/site/style.module.less:480` 在欢迎端点隐藏整个卡片容器；`capability-content.module.less:95` 禁止纵向溢出。最终手机欢迎截图无遗留轨道，computed visibility为hidden；能力态保留横向浏览。
9. **P2，已关闭：平板人物过小且落至舞台底部。** 当前 `frontend/src/pages/site/style.module.less:473` 至`:477` 单独匹配768–1023的双姿态位置和尺寸，并把上排卡片移高。768×1024双场景截图中面部接近同一锚点、完整可见，卡片未挡脸。
10. **P2，已关闭：320宽模拟出现整页横向滚动条。** viewport320扣除纵向滚动条后clientWidth305，原body min-width320造成scrollWidth320。当前 `frontend/src/pages/site/style.module.less:482` 只对公开官网覆盖body最小宽；真实复验两场景均scrollWidth305==clientWidth305，body min-width0。未改变任务页或后台既有最小宽。

## 已核对的证据

- 共享时间轴：所有角色只创建一组原生WAAPI动画，RAF统一设置 `currentTime`，逆向以同一时间变量递减；1900ms、分段延迟、端点更新与同步ref锁均在源码中可追溯。
- 独立执行 `node /tmp/test-capability-transition.cjs`：最初36断言通过，最终实际hook47断言通过，增加端点与中途effect重建覆盖。执行的是读取真实hook的React/WAAPI/RAF定向模拟，不等于真实浏览器通过。
- 临时页面诊断曾实际读取11个动画在同一时刻277.3ms及端点1900ms，computed opacity符合阶段；最后增加discover为12个角色节点，最终文件未保留调试属性。CUA只读DOM代理不支持getAnimations，未声称直接通过代理读取最终12个Animation。
- 系统reduce、手动关闭动效和站点关闭动效共用 `motionEnabled`，hook在运行中关闭时收束到请求端点；窗口resize不会重建固定像素位移动画，人物大小由容器样式重新排布。
- 切换前焦点转至持久场景按钮，两组内容在切换中及非活动时inert；能力卡片还使用原生disabled。状态通过role=status文本播报，场景按钮可原生键盘激活。
- 能力人物预加载使用与DOM一致的srcset/sizes，load后decode，错误或8秒超时使用原欢迎人物；失败不会无限阻止进入能力场景。仍需浏览器慢图、坏图、resize后候选图片切换实测。
- 手机卡片容器阻止touchstart/touchend向父级传播，父场景手势也排除 `[data-capability-cards], button, a` 起点，源码上避免卡片横滑触发场景切换。
- 动画、监听器、预加载超时均具备卸载清理；每个预览实例使用独立ref与useId，未发现全局时间轴串扰。
- 整合者最终lint/build通过，本审查读取 `/tmp/nest-capability-final.log` 核对记录，未重复执行，不将其写为独立运行结果。

## Chrome实际浏览器验收

使用CUA专用标签2053951620操作UI；未使用外部Playwright或注入页面控制代码。只读evaluate用于DOM、computed style、尺寸和焦点取证。

| 实际viewport | 两场景视觉 | 最终横溢出与内部滚动 |
| --- | --- | --- |
| 1440×900 | 已观察，人物、四组卡片与固定导航无遮挡 | clientWidth1425，scrollWidth1425，stage scrollTop0 |
| 768×1024 | 已观察并复验人物锚点修正 | clientWidth753，scrollWidth753，stage scrollTop0 |
| 390×844 | 已观察并复验文案、人物与横向卡片 | clientWidth375，scrollWidth375，stage scrollTop0 |
| 320×740 | 已观察并复验最小宽修正 | clientWidth305，scrollWidth305，stage scrollTop0；820高舞台需正常纵向浏览 |

实际交互已验证：

- 完整开场结束后进入欢迎；桌面前进与反向；切换途中快速请求01/02仍按最初请求到端点，不交错开启第二次转场。
- AI卡片点击展开、再次折叠；Tab移至前端卡片时显示详情；焦点在可访问按钮，未留在inert子树。
- 手机Enter激活持久场景按钮，01→02→01通过，状态文字与端点一致；未把状态文字检查等同于读屏软件测试。
- 反向途中手动关闭动效立即到01；关闭状态立即进入02；关闭时键盘卡片transform none；测试后恢复动效为开。
- 手机卡片横向wheel使scrollLeft从5到493，scene仍为1；点击卡片正常展开。**这是实际横向滚轮浏览，不是真实TouchEvent滑动**；触摸排除与stopPropagation只做源码/整合者模拟核对。
- 最后实际观察为Chrome01欢迎、动效开。随后顺序调用viewport.reset、getAXState、markDeliverable、Safari getApp；Safari超时导致整段输出未返回，前3步未抛错但reset后的画面不计作独立可见证据。

## 历史图片清理

2026-11-08按用户要求删除桌面、平板、390及320双场景的8张历史截图；以上浏览器实测、DOM数据和未执行边界保留，不再依赖图片对比或要求恢复截图。

## 工具阻塞与未执行边界

- 首次getState成功，旧官网tab属于整合者会话无法绑定；原生Chrome getApp一次30.04秒超时。之后新建独立Chrome标签恢复，完成上述实测；首次阻塞不再作为当前Chrome未验理由。
- Safari原生getApp一次30.05秒超时并重置kernel，按要求停止，**Safari未验收**；未延长尝试或绕过CUA。
- 系统OS reduce、真实触摸场景横滑、隐藏标签期间恢复、慢图/坏图/断网、真实屏幕阅读器、后台登录与双尺寸预览本轮未实测。相关源码或模拟不能替代浏览器覆盖。
