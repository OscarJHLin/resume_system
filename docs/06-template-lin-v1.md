# Template notes: default-v1 (蓝黑简洁简历)

- as_of: 2026-09-23
- Template id（合同）: `default-v1`（内部亦称 lin-v1）
- 用户可见名称: **蓝黑简洁简历**
- 视觉参考: `~/(local-resume-sample)/参考简历模板.docx`（不入库二进制）
- Pack: `templates/blue-black-simple/manifest.json`（v1.1.0）
- 工作台：顶栏「选择简历模板」；**证件照居中置于姓名上方**（有照片时）

## 从参考 DOCX 提取（已复核）

| 元素 | 参考值 | 导出 / 画布 |
|---|---|---|
| 页 | A4 11906×16838 twips；边距 680/1020 | `page` in manifest |
| 证件照 | 首段居中 inline；约 98×131 CSS px（936116×1248156 EMU） | 画布顶部居中；DOCX `ImageRun` 同尺寸 |
| 姓名 | 22pt 黑体 bold 居中；段后 120；行距 560 | H1 + `styles.name` |
| 标语 | 11pt 黑体 **bold** 居中 | `styles.tagline` |
| 联系 | 9.5pt 宋体 **bold** 居中，`\|` 分隔 | `styles.contact` |
| 节标题 | 13pt 黑体 + 底边框 single sz=6 space=4；段前 200 / 段后 120 | H2 `borderBottom` |
| 教育 / 项目条目 | Tab center **4933** + right **9866**；左黑体 / 中宋体 / 右宋体 | `entryTabs` + `layout.entryTabCenter` |
| 实习条目 | Tab center **6520** + right 9866 | `layout.internshipTabCenter` |
| 技术能力 | 无项目符号；「标题：」+ 正文，全加粗；段后 8 | 非 bullet 段落 |
| 条目正文 / 获奖 | 编号悬挂 left 340 / hanging 228；10.5pt 宋体 | `bullet` + `layout.bulletIndent` |

## 保真度限制（诚实）

- **证件照**：有照片时画布与 DOCX 均显示在姓名上方；无照片则不占位。
- **超链接**（邮箱/GitHub）：导出为纯文本。
- **编号列表**：参考为 Word numbering；我们用 `•` + hanging indent 近似。
- **字体**：eastAsia=`黑体`/`宋体` + ascii=`Arial`。宿主缺字体时会回退。
- **项目右栏**：参考稿常写「个人项目 / 开发中」；本系统右栏优先 `timeRange`，中栏优先 `projectType`（技术栈）。
- **多模板**：见 [07-template-packs.md](./07-template-packs.md)。

## 工作台字段映射

| 线框 | 领域字段 |
|---|---|
| 基本信息卡 | `Profile`（多卡） |
| 教育多段 | `education[]` |
| 技术能力块 | `skills[]`（title 加粗 + body） |
| 项目/实习/获奖 | `ContentModule` → placement 快照 |
| 标签 / 备注 | `Profile.tags` / `notes` |
