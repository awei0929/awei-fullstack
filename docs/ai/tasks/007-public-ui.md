# SPEC-007 公开页与登录精修

- 日期：2026-11-14；代码基准 `8b263ad` 与当前未提交工作区。
- 状态：本分工实现与定向静态检查完成；真实浏览器和整合验证由主代理执行。
- 合同：[SPEC-007](../../specs/007-ui-clarity.md) AC-01/05/06；已读取根 AGENT、frontend/AGENTS、SPEC-003 P28/P27 与 SPEC-001。
- 范围：仅 `frontend/src/pages/site/capability-details.tsx`、`capability-details.module.less`、`capability-content.tsx`、`capability-content.module.less`、`frontend/src/components/site-login/index.tsx`、`style.module.less`。保留原有其它未提交改动，无提交、推送、部署、截图或数据库操作。

## 实际改动

- 能力详情去除英文眉题、默认介绍口号和尾部口号，标题简化为技术栈/公司背景/公司项目。保留 HEY.、原图标配色、技术四分区及描述，站主填写的技术介绍/公司摘要/所有 Markdown 正文和项目数据均继续渲染。
- 公司目录保留栏目名称；项目目录保留单一编号与名称，移除重复编号、解释和暗示外链的箭头。选中背景与描边、`aria-pressed`、原切换处理保留。目录由225px收至200px，移动端按内容宽度横向排列，桌面最小高度48px、移动44px；6px内边距为既有焦点轮廓留空间。
- 空项目不再显示空目录，改为单个全宽空态“项目经历尚未公开”；空公司栏目不再叠加“公司与业务”标题与通用说明。空态不再声称内容正在整理，去除无操作的箭头并缩减空面板高度。已有外层详情加载/失败使用的 `.empty p` 样式保留。
- 三卡继续保留名称、副标题、介绍、图标和打开能力详情行为；底部仅显示真实公司名、可见项目数量或原技术图标，无数据时只留右对齐的进入箭头。
- 登录保留原人物主视觉，去掉微小英文、字段双语标签和口号脚注，说明改为“管理官网内容与 AI 对话”，加载状态保留单一有效提示。保留中文字段、错误关联、独立 SiteTip、重试、切换账号、忙状态和焦点逻辑；增加字段/说明/主按钮至14px，手机输入仍为16px，桌面面板540px收至480px，配合分组间距调整。
- 清理上述已删除节点的专属样式。首页 `site/index.tsx`、开场、欢迎/能力转场、音乐与公共配置数据未由本分工修改。

## 本次实际验证

- 定向 `oxlint src/pages/site/capability-details.tsx src/pages/site/capability-content.tsx src/components/site-login/index.tsx` 退出0，无输出告警。
- 通过项目已安装 `less.render` 实际编译三份改动样式，三份均成功；输出CSS长度依次为7807、5002、8965字符。未向仓库写入编译产物。
- 六份代码文件的 `git diff --check` 退出0；静态检查确认删除的文案与专属样式不再引用，表单 `label/htmlFor`、输入 `aria-describedby/aria-invalid`、dialog标题关联、目录选中状态与正文数据引用保留。
- 曾尝试使用 TypeScript `transpileModule` 作独立语法检查，当前安装包未提供旧枚举API，临时命令在读取 `JsxEmit.ReactJSX` 时失败；该命令未执行转换、未写文件。已改用实际TSX定向oxlint；完整TypeScript/build由主代理统一执行，本分工不将该尝试算为通过。

## 待整合验证与边界

- 未执行真实浏览器、截图、全量构建或数据库/API回归；没有新增镜像文案测试。不能将静态样式尺寸声明视为真实布局验收。
- 主代理按 AC-01/05 复核1440/768/390/320：三卡与详情打开/关闭、公司与多项目目录切换、空态、长标题/正文、目录横滚、键盘焦点；登录账号/密码标签、校验浮层、关闭回焦、主按钮与手机输入。
- 根统一 lint/build、受影响既有回归、差异审查与 STATE/SPEC 回写；本文件仅报告公开页分工的实际改动和证据。
