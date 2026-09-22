# ADR-0002：文档编辑器选用 TipTap

- status: Accepted
- date: 2026-09-23

## 背景

MVP 需要「文档编辑器观感」+ section 落点 + 后续可扩展节点；优先开源方案。

## 决策

采用 **TipTap（基于 ProseMirror）** 作为 `editor-shell` 内核。

简历主数据仍以服务端 `ResumeDocument` / placements 为准；TipTap 文档是**投影**，不是唯一权威源（避免 HTML 与领域模型漂移）。

## 理由

- 自定义 Node（section、module-item）成本可控。
- 扩展与 React 集成成熟（`@tiptap/react`）。
- 社区活跃；拖放可通过 ProseMirror plugin / 外部 HTML5 DnD 桥接。
- 比从零做 contenteditable 安全；比直接上完整 Word 引擎轻。

## 备选

| 方案 | 结论 |
|---|---|
| Lexical | 可行；生态与「简历分节节点」示例少于 TipTap，团队若更熟 Lexical 可再评估 |
| Plate / Slate | 可，但迁移与插件质量参差 |
| OnlyOffice / 嵌入 Word | 过重，与模块库拖拽模型不合 |
| 纯 div 列表冒充文档 | 可作 S2 过渡，但非目标体验 |

## 后果

- 需定义 TipTap JSON ↔ placements 的同步策略（建议：drop/reorder 写 API，再 hydrate 编辑器）。
- MVP 正文为**纯文本**（D2）；TipTap 用于文档壳与 section/条目节点，不为 body 做富文本编辑。
