# SPEC-003 P3 配置后台交接

- 核对日期：2026-11-07；基准 82acde8，本任务未提交，不改分支/worktree。
- 范围：frontend/src/types/site.ts、api/site.ts、store/site-admin.ts、pages/admin/{index,fields,editors,sections,style.module}；api/http.ts 兼容添加 HttpError.code。未改 authStore、router 或全局样式。
- 已实现：严格 SiteDocument / SiteContent 运行时解析、完整 API 与 URL 安全；站主登录/会话恢复/服务端权限判断，非站主不显示配置；五分区共享草稿；项目新增删除、排序、隐藏精选、标签、封面上传；关于、联系方式、固定经典角色和轻量动效配置；桌面与手机预览/编辑切换；全站保存及版本提示。
- 权限/并发：所有异步操作核对身份版本与请求版本；401 遮蔽编辑，保留同一用户草稿，其他身份清空；包括其他 store 触发的全局过期。403 权限清空并阻断；CSRF_INVALID 获取新 token 后可重试。保存/上传互斥，期间禁止输入。409 保留草稿并显式查看/载入最新；继续编辑不更新基准版本，不静默覆盖。网络结果未知先查最新，内容一致则确认成功，版本未变则允许重试。
- 离开与失败：站内路由阻断、刷新 beforeunload、dirty 退出确认；退出失败保留草稿。配置读取失败不生成空配置。上传为可见不定进度，失败保留旧图，成功只更新草稿。
- 复用：预览直接使用 SiteExperience(content, preview)，它在容器内独立滚动与响应手机宽度；未接入人物连续动作或虚构动作选择。

## 本次验证

- `npm run check --prefix frontend`：通过。
- `npm run lint --prefix frontend`：通过，零警告。
- 临时 Node 断言，先确认缺失 parser 的失败，再实现：12 组响应解析边界通过（有效文档、负版本、重复项目 id、空展示名、非法邮箱、未知字段、javascript URL、协议相对 URL、原始/编码路径穿越、错误布尔、错误日期）。未增设前端测试框架或声称有 test 脚本。
- 临时 Node 状态断言：10 个场景通过，涵盖加载、409、查看/载入最新、401、同账号恢复、不同账号清除、外部会话过期、保存期间修改/重复提交拒绝、网络结果未知与核对后确认。
- 该状态断言通过编译后的真实 store/API、mock fetch 响应执行，不等同浏览器交互验收。临时断言位于 /tmp/nest-site-api-check.mjs、/tmp/nest-site-store-check.cjs，没有写入仓库。
- 本代理未运行浏览器；整合者负责真实登录/保存/冲突/手机与视觉验收、前端最终构建、SPEC 和 STATE 汇总。

## 已知限制与后续

- 409 选择继续保留草稿时仍使用原基准版本；要再次成功保存需载入最新并重新应用修改，符合不静默强覆盖原则。
- 上传使用 request/fetch，可见上传中与失败状态，没有虚构百分比。
- 人物连续动作依用户要求后补。
