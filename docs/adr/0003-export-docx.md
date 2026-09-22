# ADR-0003：DOCX 导出路径

- status: Accepted
- date: 2026-09-23

## 背景

MVP 仅需 DOCX；导出必须反映模板字段样式，且可测。

## 决策

1. `template-engine` 将 Profile + placements 映射为 **ResumeIR**（与预览同源）。
2. `export-docx` 使用 npm 包 **`docx`**，把 ResumeIR 转成段落/标题/间距，输出 `Buffer`。
3. **禁止** Playwright 截图转 PDF/DOCX、禁止整页 HTML 糊进 Word 作为主路径。

## 理由

- `docx` 对段落、粗体、字号、间距控制足够覆盖单模板 MVP。
- IR 中间层让编辑器预览与导出一致，并便于快照测试。
- 结构化导出比 HTML→DOCX 转换链更可预测。

## 备选

| 方案 | 结论 |
|---|---|
| `docxtemplater` + 预置 .docx | 适合强设计稿套用；改字段样式要改模板文件，MVP 单模板也行，但与「规则引擎」叙事弱于 IR |
| LibreOffice headless HTML→DOCX | 运维重，CI 难 |
| PDF 优先 | 明确延后 |

## 后果

- 复杂装饰（多栏、绝对定位）能力有限；若未来要像素级设计稿，再评估 `docxtemplater` 或排版引擎（新 ADR）。
- 中文字体：导出环境需可引用系统字体或嵌入策略（S1 实现时记录限制）。
