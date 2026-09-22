# Contract: Template Engine & ResumeIR

- version: 0.1.1
- owner: `template-engine`
- decisions: D2（分字段排版；body 纯文本）

## 输入

```ts
interface RenderInput {
  templateId: 'default-v1';
  profile: Profile;
  placements: SectionPlacement[]; // 使用其中的 ModuleSnapshot 字段
}
```

模板消费的是 **snapshot 上的分离字段**（title / subtitle / projectType / timeRange / body / …），不得把 `body` 当 HTML/Markdown 解析做主排版。

## 分字段样式规则（Template 必须定义）

每个可渲染字段对应独立样式，而非整段统一样式：

| 字段来源 | 规则职责（示例） |
|---|---|
| Profile.name | 字号、加粗 |
| Profile 联系方式行 | 字号、分隔符 |
| Section 标题 | 字号、加粗 |
| snapshot.title | 加粗、字号 |
| snapshot.subtitle | 常规/斜体、字号 |
| snapshot.projectType | 字号、前缀文案 |
| snapshot.timeRange | 展示格式（如 `YYYY.MM - YYYY.MM`）、对齐 |
| snapshot.body | 正文字号；`\n` → 换段或 soft break |

## 输出 ResumeIR（导出与预览共用）

```ts
interface TextStyle {
  bold?: boolean;
  fontSizePt?: number;
  italic?: boolean;
}

interface IrRun {
  text: string;
  style?: TextStyle;
}

interface IrParagraph {
  kind: 'paragraph';
  runs: IrRun[];
  spacingAfterPt?: number;
}

interface IrHeading {
  kind: 'heading';
  level: 1 | 2 | 3;
  runs: IrRun[];
}

type IrBlock = IrHeading | IrParagraph;

interface ResumeIR {
  templateId: string;
  templateVersion: string;
  blocks: IrBlock[];
  meta: {
    title: string;
    generatedAt: string;
  };
}
```

## 函数合同

```ts
function renderToIR(input: RenderInput): ResumeIR;
```

- 纯函数；相同输入 → 相同 blocks（`generatedAt` 可除外，测试时可注入时钟）。
- `default-v1` 规则（MVP 草图）：
  - 姓名：heading L1，加粗，16pt
  - 联系方式行：段落，10.5pt
  - Section 标题：heading L2，加粗，12pt
  - 项目 title：加粗 11pt；subtitle/担任的职责：常规 10.5pt；projectType：10.5pt；timeRange：同条或旁路 runs
  - body：段落，10.5pt，按换行拆段，**不**解析 Markdown

## 错误

- 未知 `templateId` → 抛 `UnknownTemplateError`
