# Template notes: default-v1 (lin-v1)

- as_of: 2026-09-23
- Template id（合同）: `default-v1`
- 视觉参考: `~/(local-resume-sample)/参考简历模板.docx`（不入库二进制）

## 从参考 DOCX 提取

| 元素 | 参考值 | 导出映射 |
|---|---|---|
| 页 | A4 11906×16838 twips；边距 680/1020 | `LIN_V1_PAGE` |
| 姓名 | 22pt 黑体 bold 居中 | H1 + `fontEastAsia: 黑体` |
| 标语 | summary → 11pt 黑体 居中 | tagline 段 |
| 联系 | 9.5pt 宋体 居中，`\|` 分隔 | location \| phone \| email |
| 节标题 | 13pt 黑体 + 底部分隔线 | H2 `borderBottom` |
| 条目行 | 三栏 Tab：标题黑体 / 中栏 / 时间右对齐 | `entryTabs` |
| 正文 | 10.5pt 宋体，项目符号 | `bullet` |
| 技能 | 粗体「标题：正文」行 | skills 专用映射 |
| 节顺序 | 教育→技术→项目→实习→获奖 | profile edu + SECTION_ORDER |

## 保真度限制（诚实）

- **证件照**：未导出（MVP 无头像字段）。
- **超链接**（邮箱/GitHub）：导出为纯文本。
- **编号列表**：参考为 Word numbering；我们用 `•` 悬挂缩进近似。
- **字体**：写入 eastAsia=`黑体`/`宋体` + ascii=`Arial`。若宿主缺字体，Word/Pages 会回退（macOS 常见 Songti SC / Heiti SC）。
- **多模板**：延后；仅此默认一套。
