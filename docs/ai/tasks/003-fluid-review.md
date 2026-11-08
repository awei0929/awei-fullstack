# SPEC-003 P11–P13：流体与开场增量独立审查

- 核对日期：2026-11-07（Asia/Shanghai）；基准 `82acde8`，当前未提交工作区。
- 范围：`frontend/src/components/site-fluid/` 全部文件；`site-intro/` 的4100ms新时序、删除skip、dialog焦点；`pages/site/index.tsx` 的fluid导入、`heroStageRef`及舞台内挂载。其它未提交改动属于前轮或并行任务，没有全面重审。
- 已读取根AGENT、STATE、架构、前端AGENTS、SPEC-003末尾P11–P13及最新移除跳过按钮要求。产品代码只读；未操作浏览器、未新增代理或依赖、未提交。

## 结论与分级

本次限定范围未发现可确认的P0/P1/P2缺陷；没有待修复阻塞项。已定向复核随后落码的卷曲尾迹参数、销毁时缩小默认绘图缓冲，以及取消窗口宽度门槛，结论不变。未把真实GPU编译、浏览器像素、动画观感或实际焦点表现归入静态审查通过范围。

## 已核对路径

- **WebGL初始化与失败：** 只在有效鼠标移动后取得WebGL2；无上下文/扩展、shader编译或program链接失败、buffer/VAO/texture/framebuffer分配失败、不完整RGBA16F目标均返回静态降级。已成功分配的对象加入集合，异常路径调用dispose。shader链接后释放，正常销毁释放8个固定纹理及对应framebuffer/program/buffer/VAO；销毁幂等。
- **渲染与尺寸：** 速度与染色、压力均使用读写交换，逐个核对求解pass的输入纹理和输出目标，没有发现同一pass读写同一目标的反馈环。输出DPR≤1.5、最长边≤1800，模拟/染色长短边比例上限3；小于1像素的尺寸兜底。显示shader输出预乘透明色，零染色仍为透明，不使用黑色不透明清屏。
- **暂停、退出与耗电：** 精确鼠标、hover、系统无reduce及舞台在视口内才监听；触摸事件忽略，不再以窗口宽度判断输入设备。输入按rAF合并，静止2.5秒清场并停止调度。pointerleave、尺寸变化、离屏、隐藏页、能力变化、组件关闭/卸载均取消rAF并释放renderer；失败或context lost完整移除监听和observer，不自旋重试。静止时保留已清空的有限GPU对象，离开/隐藏等路径再释放，符合有限资源边界。
- **集成与图层：** `enabled={motionEnabled && !preview && !panelOpen && !loginOpen}` 精确覆盖预览/关闭/阅读/登录；舞台ref指向实际背景容器。canvas绝对定位、`pointer-events:none`、`aria-hidden`、z=0，仅自身blur；人物z=1、正文和控件z=4，原舞台裁切保留，不对整个页面施加模糊。
- **开场：** 最后下划线1760+350=2110ms收笔，2850ms才开始350ms文字淡出，3200ms再开始900ms玻璃退场，总4100ms；完整字样停留740ms。延迟期间`both`保持首帧，只有玻璃自身animationend结束dialog。无跳过按钮/skip ref/skip样式，读屏说明为自动进入；dialog自身收焦点，Tab留在dialog，Esc调用统一finish。关闭/结束保留原生焦点恢复和无争用时的后备恢复，重播入口已先回首屏并聚焦品牌按钮。隐藏暂停、reduce关闭、会话一次和卸载清理保留。
- **来源与依赖：** SOURCE记录具体上游、改编范围及读取快照hash；LICENSE保留版权及MIT + Commons Clause正文，没有误写纯MIT。`frontend/package.json`与lockfile无差异。本次只核对本地保留状态，未重新访问上游或提供法律合规结论。

## 最后一次参数与缓冲释放定向复核

- 已核对radius `.0017→.0008`、push `4500→6000`、curl `8→22`、velocity dissipation `2.5→2`、canvas blur `4px→2.5px`。没有增加纹理数量、画布上限、帧循环或生命周期；dt范围、长跳距离门限及速度clamp仍保留。具体卷曲观感由整合者真实浏览器最终确认。
- dispose在GPU对象回收后将默认canvas绘图缓冲缩为`1×1`。canvas的CSS宽高明确为`100%`，所处舞台高度明确，修改属性尺寸不改变被ResizeObserver观察的CSS内容盒，因此不会由该缩小反复触发stop/resize。重启读取`clientWidth/clientHeight`重新计算输出尺寸，不依赖缩小后的属性尺寸；每个blit重新设置viewport，新renderer重建program、VAO和纹理。dispose幂等门禁仍在，正常启停和失败降级路径未被破坏。
- 这次只做变更位置和调用链定向审查，没有再次执行全量或重复模拟断言。实现代理反馈修改后生命周期20/20、资源180/180重新通过；该结果归于实现代理，区别于下方本审查代理先前执行记录。

## 613px桌面窗口门控定向复核

- 背景：整合者发现默认浏览器预览窗口宽613px，旧701px门槛将有真实鼠标的窄桌面也禁用。实现代理已从lifecycle移除`min-width:701px`，并从CSS隐藏条件移除`max-width:700px`，两处一致。
- 当前JS保留`hover:hover`、`pointer:fine`、系统`no-preference`以及每个事件的`pointerType==='mouse'`限制；CSS保留无hover、粗指针、reduce时隐藏。真实触屏及混合设备touch事件不会因此进入模拟；能力变化清理、隐藏/离屏清理和resize重建均保留。
- 仅解除设备判断中的宽度假设，后台未保存内容预览的`!preview`集成条件仍在；Codex内嵌浏览器的613px窗口不等于该业务预览属性。
- 本次只读核对两处门控、调用链及SOURCE说明，没有重跑模拟、lint/build或浏览器。默认613px下真实鼠标效果与最终检查由整合者执行。

## 本次执行的验证

- 先阅读现有临时脚本，再执行 `node /tmp/nest-fluid-lifecycle.test.cjs`：20/20通过，退出0。执行当前真实lifecycle模块，DOM、observer、rAF及renderer边界为模拟；覆盖启动、事件合并、相对坐标、静止唤醒、触摸/能力门禁、隐藏、离屏、resize、context lost及幂等清理。
- `node /tmp/nest-fluid-resources.test.cjs`：180/180通过，退出0。执行当前真实renderer和shader源模块，WebGL为分配/失败模拟；覆盖正常资源预算、清空、销毁及各初始化失败位置的部分资源回收。断言数包含逐对象释放检查，不等于180个浏览器用例。
- 发现 `/tmp/nest-intro-review-check.cjs` 仍断言旧skip按钮与2600ms，未运行或引用为第三轮通过证据；此前P9的19/19只能说明当时实现。新的无skip/4100ms自然结束、Esc与焦点由整合者浏览器验证。
- 未重复全量lint/build、后端HTTP或浏览器测试。真实shader编译、GPU渲染、鼠标效果/停下消散、手机布局和真实焦点/标签页暂停仍属本审查的验证局限，由根代理记录最终结果。
- 整合者在审查期间另行反馈的浏览器证据（非本代理执行）：完整HEY及下划线`strokeDashoffset=0`时文字`opacity=1`、玻璃blur20px；无skip且dialog聚焦，随后自然结束；真实WebGL流体像素可见，静止/手动关闭/登录打开后canvas隐藏，登录按钮可用。完整证据和最终参数效果以整合记录为准。
