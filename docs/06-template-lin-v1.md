# Template notes: default-v1 (蓝黑简洁简历)

- as_of: 2026-09-23
- Template id（合同）: `default-v1`（内部亦称 lin-v1）
- 用户可见名称: **蓝黑简洁简历**
- 视觉参考: `~/(local-resume-sample)/参考简历模板.docx`（不入库二进制）
- Pack: `templates/blue-black-simple/manifest.json`（v1.2.1）
- 工作台：顶栏「选择简历模板」；**证件照居中置于姓名上方**（有照片时）

## 从参考 DOCX 提取（已复核）

| 元素 | 参考值 | 导出 / 画布 |
|---|---|---|
| 页 | A4 11906×16838 twips；边距 680/1020 | `page` in manifest |
| 证件照 | 首段居中 inline；约 98×131 CSS px（936116×1248156 EMU） | 画布顶部居中；DOCX `ImageRun` 同尺寸 |
| 姓名 | 22pt 黑体 bold 居中；段后 120；行距 560 | H1 + `styles.name` |
| 应聘岗位 | 11pt；前缀「应聘岗位：」加粗 + 值常规；居中 | `styles.tagline` + `Profile.summary` |
| 联系 | 9.5pt 宋体 **bold** 居中，`\|` 分隔 | `styles.contact` |
| 节标题 | 14pt 黑体 + 底边框；段前 200 / 段后 120 | H2 `borderBottom` / `styles.sectionHeading` |
| 教育 / 项目条目 | Tab center **4933** + right **9866**；左黑体加粗；技术栈小一号斜体 | `entryTitle` / `entryTech` / `entryMeta` |
| 实习条目 | Tab center **6520** + right 9866 | `layout.internshipTabCenter` |
| 技术能力 | 无项目符号；「标题：」+ 正文，全加粗；段后 8 | 非 bullet 段落 |
| 条目正文 / 获奖 | 纯段落换行（不自动加 •）；10.5pt 宋体常规 | `styles.body`（`bold: false`） |

## 保真度限制（诚实）

- **证件照**：有照片时画布与 DOCX 均显示在姓名上方；无照片则不占位。
- **超链接**（邮箱/GitHub）：导出为纯文本。
- **正文标记**：不自动注入 `•` / 编号；用户原文中的符号原样保留。
- **字体**：eastAsia=`黑体`/`宋体` + ascii=`Arial`。宿主缺字体时会回退。
- **项目中栏**：`projectType`（技术栈）9.5pt 斜体；`subtitle`（担任的职责）与日期用 `entryMeta`。
- **多模板**：见 [07-template-packs.md](./07-template-packs.md)。

## 工作台字段映射

| 线框 | 领域字段 |
|---|---|
| 基本信息卡 | `Profile`（多卡；含 `statement` 个人陈述） |
| 个人陈述 | `Profile.statement` → 简历栏「个人陈述」（教育背景之上） |
| 教育多段 | `education[]` |
| 技术能力块 | `skills[]`（title 加粗 + body） |
| 项目/实习/获奖 | `ContentModule` → placement 快照 |
| 标签 / 备注 | `Profile.tags` / `notes` |
