# 连续场景人物素材

- 日期：2026-11-07（Asia/Shanghai）。任务：SPEC-003 P18 T2素材。未提交工作区，未改页面代码/原有两张人物。
- 使用内置 imagegen（非CLI），参考现有hero/seated身份素材，生成桌前MacBook半身透明图；已在项目中保存PNG、1312px与768px WebP三份。
- 路径：`frontend/public/site/capability-character.png`（1312×1199，1574446B）、`capability-character.webp`（1312×1199，160844B）、`capability-character-768.webp`（768×702，62412B）。均RGBA，alpha范围0–255。
- 视觉检查：圆框眼镜/深分缝发型/深卫衣与参考一致；面部完整可见，Apple标志清晰，人物居中、电脑位于下左、桌缘在最下；背景透明，无文字/UI/椅子。双眼中心约原图(680,400)，用于父任务匹配面部锚点。WebP也已实际查看。
- 最终提示词要点：identity-preserve/stylized-concept；same young friendly male cartoon developer with dark brown voluminous side-parted hair, round black glasses and dark navy charcoal hoodie with pale gray center; seated at a desk behind silver space-gray MacBook with clear white Apple logo; mostly frontal, smiling, slight leftward gaze; complete hair/ears, half-body, transparent background; no environment/text/UI/panels/orbit/legs/chair. 输入两张原图作为身份与渲染风格参考。
- 压缩工具：临时venv安装Pillow，不增加项目依赖；quality88/86，Lanczos768宽。sips不能写WebP，故使用专门临时转换环境。PNG原始输出保留Codex generated_images，不删除。
- 本任务只验证素材；人物最终布局/首切decode/浏览器验证由整合任务完成。
