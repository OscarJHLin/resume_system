# Template notes: default-v1 (蓝黑简洁简历)

- as_of: 2026-09-23
- Template id（合同）: `default-v1`（内部亦称 lin-v1）
- 用户可见名称: **蓝黑简洁简历**
- 视觉参考: `~/(local-resume-sample)/参考简历模板.docx`（不入库二进制）
- 工作台：顶栏「选择简历模板」初始化空白稿；**无证件照栏**

## 从参考 DOCX 提取

| 元素 | 参考值 | 导出映射 |
|---|---|---|
| 页 | A4 11906×16838 twips；边距 680/1020 | `LIN_V1_PAGE` |
| 姓名 | 22pt 黑体 bold 居中 | H1 + `fontEastAsia: 黑体` |
| 标语 | summary → 11pt 黑体 居中 | tagline 段 |
| 联系 | 9.5pt 宋体 居中，`\|` 分隔 | location \| phone \| email \| 微信 |
| 节标题 | 13pt 黑体 + 底部分隔线 | H2 `borderBottom` |
| 教育 | 学校 / 学历·专业 / 时间；GPA/排名/课程明细行 | Profile.education |
| 技术能力 | 粗体「标题：正文」 | **Profile.skills**（非拖放） |
| 条目行 | 三栏 Tab：标题黑体 / 中栏 / 时间右对齐 | `entryTabs` |
| 正文 | 10.5pt 宋体，项目符号 | `bullet` |
| 节顺序 | 教育→技术→项目→实习→获奖 | profile + SECTION_ORDER |

## 保真度限制（诚实）

- **证件照**：可在「基本信息」卡上传存档；**模板与 DOCX 导出均不含照片栏**（与当前工作台一致）。
- **超链接**（邮箱/GitHub）：导出为纯文本。
- **编号列表**：参考为 Word numbering；我们用 `•` 悬挂缩进近似。
- **字体**：写入 eastAsia=`黑体`/`宋体` + ascii=`Arial`。若宿主缺字体，Word/Pages 会回退。
- **多模板**：仅 `default-v1`（蓝黑简洁简历）一套；选择器已预留扩展。

## 工作台字段映射

| 线框 | 领域字段 |
|---|---|
| 基本信息卡 | `Profile`（多卡） |
| 教育多段 | `education[]`（学校/学历/专业/起止/GPA/排名/课程） |
| 技术能力块 | `skills[]`（title 加粗 + body） |
| 项目/实习/获奖 | `ContentModule` → placement 快照 |
| 标签 / 备注 | `Profile.tags` / `notes` |
