# 模块分解与构建顺序

- as_of: 2026-09-23
- 实现时每个模块独立可测；跨模块只依赖 `docs/contracts/*` 与 `packages/domain` 类型。

## 总览

| # | 模块 ID | 路径（建议） | 一句话职责 |
|---|---|---|---|
| 1 | `domain` | `packages/domain` | 共享类型、枚举、兼容矩阵、ResumeIR |
| 2 | `profile` | `apps/server/src/modules/profile` | 个人资料与教育 |
| 3 | `content-library` | `apps/server/src/modules/content-library` | 模块库 CRUD + 检索 |
| 4 | `resume-assembly` | `apps/server/src/modules/resume` | 简历草稿与 placements |
| 5 | `template-engine` | `apps/server/src/modules/template` | Template → ResumeIR |
| 6 | `export-docx` | `apps/server/src/modules/export` | ResumeIR → DOCX |
| 7 | `editor-shell` | `apps/web/src/features/editor` | TipTap 壳 + section |
| 8 | `library-ui` | `apps/web/src/features/library` | 侧栏检索与拖拽源 |
| 9 | `workbench` | `apps/web/src/features/workbench` | 布局与导出入口 |

## 1. `domain`

- **责任**：`Category`、`SectionId`、`ContentModule`、`Profile`、`ResumeDocument`、`ResumeIR`、`categoryAllowedInSection()`。
- **接口**：纯 TypeScript 导出；无 IO。
- **依赖**：无。
- **禁止**：依赖 React / Fastify / sqlite。

## 2. `profile`

- **责任**：读写 Profile、教育列表。
- **API（草案）**：见 `docs/contracts/resume-document.md` 中 profile 段。
- **依赖**：`domain`、SQLite repo。
- **DoD**：可创建/更新并读回；教育条目有序。

## 3. `content-library`

- **责任**：模块 CRUD；**多标签**维护；按 `category` / `tag` / 关键字过滤（**无 JD**）。
- **API**：见 `docs/contracts/content-library.md`。
- **依赖**：`domain`。
- **DoD**：创建带标签模块后，按 tag 过滤命中；非法 category 拒绝。

## 4. `resume-assembly`

- **责任**：简历元数据；section → placements；拖入时 **深拷贝 ModuleSnapshot（D1）**；排序。
- **依赖**：`domain`、`content-library`（读取源模块一次）、`profile`（绑定）。
- **DoD**：添加 placement 后 GET 可见完整 snapshot；改库内模块后简历 snapshot 不变；不兼容 category 返回 4xx。

## 5. `template-engine`

- **责任**：内置 `default-v1`；**分字段**样式（title/subtitle/time/body…）；组装 ResumeIR。
- **接口**：`renderToIR(input: RenderInput): ResumeIR`。
- **依赖**：仅 `domain`。
- **DoD**：给定固定 fixture，IR 快照稳定（正式测试）；不把 body 当 Markdown 解析。

## 6. `export-docx`

- **责任**：`ResumeIR` → `docx` 库文档 → `Buffer`。
- **接口**：`exportDocx(ir: ResumeIR): Promise<Buffer>`。
- **依赖**：`domain`（IR 类型）、`docx`。
- **DoD**：对 fixture IR 产出可被 Word/LibreOffice 打开的非空文件（真实文件证据）。

## 7. `editor-shell`

- **责任**：简历主区 section 落点、展示 placements 快照；接收 drop → `POST .../placements`。S2 为列表式壳；TipTap 在 S3。
- **依赖**：`domain`（`decideModuleDrop`）、Web API client。
- **状态**：S2 Ready（列表壳）
- **DoD**：拖入后主区出现对应条目；不匹配大类拒绝。

## 8. `library-ui`

- **责任**：列表、**标签/大类/关键字过滤**、拖拽 `application/x-resume-module` payload。
- **依赖**：content-library API；`@resume/domain` DnD 合同。
- **状态**：S2 Ready
- **DoD**：按 tag 过滤可见；拖拽数据可被 editor drop zone 解析。
- **不做**：JD 输入框、目标岗位实体 UI。

## 9. `workbench`

- **责任**：页面骨架、种子数据、导出按钮、串联 library + editor。
- **依赖**：上述 UI 模块。
- **状态**：S2 Ready（列表式落点；TipTap→S3）
- **DoD**：单页可完成「搜 → 拖 → 导出」主路径。

---

## 推荐构建顺序

```text
1. domain
2. profile
3. content-library
4. resume-assembly          ← 到此后端事实链打通
5. template-engine
6. export-docx              ← S1 证据：模块→简历→docx
7. library-ui + editor-shell DnD  ← S2
8. TipTap editor-shell       ← S3
9. workbench 打磨
```

**并行建议**：`template-engine` 与 `content-library` 在合同冻结后可并行；`export-docx` 必须等 IR 合同稳定。

**S1** 已完成；**S2** 列表式 DnD 已完成；**S3** 换 TipTap 文档壳。
