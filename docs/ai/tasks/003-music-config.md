# P17 音乐配置与音频上传

- 核对日期：2026-11-07；基准82acde8，保留现有未提交工作区；未提交、推送、切换分支或worktree。
- 范围：backend/src/site、backend/test/site.e2e.test.mjs；frontend/src/types/site.ts、api/site.ts、store/site-admin.ts、pages/admin/editors.tsx。
- 依据：SPEC-003 第四轮P17冻结合同；公开音乐播放器由整合者处理，本报告不宣称播放器或浏览器验收完成。

## 已实现

- SiteContent.music五字段：enabled/title/sourceUrl/volume/loop，默认false/空/空/25/true。后端DTO与前端解析器严格验证；只允许整个music缺失的旧客户端/旧记录补默认，null、嵌套数组、不完整对象和未知字段拒绝。读取旧数据库记录不写回、不变更version。
- 启用须非空安全音源，支持http(s)或本服务UUID音频资产路径；音量0–100整数、名称最多80码点。保留全站原子版本保存、Owner/CSRF与隐藏项目过滤。
- POST /api/site/audio-assets使用Session→Owner→CSRF，独立15MiB上传上限，不扩大原图片5MiB限制。不获取外链。音频按实际MP3帧/ID3、RIFF WAVE与音频Ogg标识及结构检查，MIME须匹配；随机UUID文件名写受控资产目录。GET沿用原路由、音频MIME、nosniff和严格文件名。
- Ogg每个BOS必须是Vorbis或Opus，拒绝Theora及混合视频。WAV检查块边界和音频格式块，支持PCM、浮点、A-law、μ-law和扩展格式。MP3检查ID3长度与合法完整MPEG Layer III帧，不能仅凭ID3三字节放行。
- 后台“外观与动效”新增音乐名称、URL/音频上传、音量、循环与启用。上传只替换草稿URL，统一保存后公开；独立音频错误状态，沿用canEdit、busy、身份版本与异步响应保护。没有默认曲目或假试听。

## 验证结果

- 已按test-driven-development先写6组真实HTTP用例并观察6/6预期失败（缺music默认/音频404），实现后6/6通过。
- 加入原始字节签名用例后出现201≠400，定位Node ASCII解码去掉高位；改用latin1保留字节后相关2/2通过，最终全套也包含该回归。
- 临时前端解析器测试编译实际api/site.ts；23项定向断言先默认缺失失败，再23/23通过，覆盖旧内容默认、严格对象/字段/音量与音源路径。该测试不是浏览器、不是新增正式测试框架。脚本/tmp/nest-site-music-parser.mjs。
- 独立审查发现一处P2：WAV编码白名单遗漏A-law/μ-law。新增fmt18+fact+data合法容器HTTP正例，先得到400≠201，再将允许编码补6/7；最终全套已验证上传成功及GET字节一致。其余审查范围未发现确认P0/P1/P2。编码依据：[Microsoft WAVEFORMATEX](https://learn.microsoft.com/en-us/windows/win32/api/mmreg/ns-mmreg-waveformatex)。
- 后端最终重新执行 `npm test --prefix backend`（含build）：**67/67、5套件、0失败/跳过/取消，退出0**。新增8条测试；权限/CSRF、原子保存、数据库重启、原图片5MiB和任务认证一起通过。最终日志 `/tmp/nest-backend-music-final.log`。
- 定向日志：/tmp/nest-site-music-red.log、/tmp/nest-site-music-green.log、/tmp/nest-site-music-signature-red.log、/tmp/nest-site-music-signature-green.log、/tmp/nest-site-music-wave-red.log。
- `git diff --check`通过；最终前端解析器临时23/23通过。前端最终lint/build、公开播放与后台浏览器验收由根整合者执行，本子任务未执行浏览器验收。

## 风险与边界

- 文件验证是容器与帧头识别，不是完整音频解码或可播放性保证；浏览器仍须报告不可解码/网络失败。
- 外链可能受来源服务器与浏览器策略限制；服务器不代理下载。
- 上传成功未保存引用的文件沿用当前资产行为，不自动清理。
- 测试只使用现有helper生成并核对的awei_e2e_UUID临时库与临时资产目录；没有读取或修改真实用户/站点文档，没有打印或修改真实凭据与开发配置。
