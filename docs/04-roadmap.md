# 路线图与垂直切片

- as_of: 2026-09-23
- 状态约定：`Designed` → `Ready` → `In Progress` → `Partial` → `Done`（需证据）

## 阶段总览

| 阶段 | 目标 | 出口证据 | 状态 |
|---|---|---|---|
| P0 地基 | 文档 + monorepo 可安装启动 | `npm install` + web/server dev | Done |
| P1 内容事实 | Profile + ContentModule CRUD/检索 | API + SQLite | Done（并入 S1） |
| P2 组装 | Resume placements + 兼容矩阵 | 拒绝链 + 正常链 | Done（并入 S1） |
| P3 模板 | `default-v1` → ResumeIR | IR 测试 | Done（并入 S1） |
| P4 导出 | DOCX 下载 | 真实 `.docx` | Done（并入 S1） |
| P5 编辑器+DnD | TipTap 壳 + 拖入 | 浏览器主路径 | Done（S2 DnD + S3 TipTap 投影） |
| P6 打磨 | 空态/错误、演示数据 | 验收清单 | Done（S4） |

## 垂直切片卡片

### S0 — 仓库可运行地基

- **状态**: Done（脚手架 + 文档）
- **可观察结果**：按 README 启动 web 与 server，看到占位工作台与 `/health`。

### S1 — 模块入库并导出（无编辑器）

- **状态**: Done（2026-09-23，证据：`npm test` 4/4）
- **可观察结果**：通过 API / `scripts/s1-demo.sh` / Web「写入演示数据」创建带结构化字段 + tags 的模块，写入简历 **snapshot placement**，下载 docx 非空。
- **已验证**：改库内模块后已组简历 snapshot 不变；模板按 title/time/body 等字段分别出 IR；DOCX 以 `PK\x03\x04` 开头。
- **不做（仍属后续）**：TipTap、拖拽、JD、桌面壳、从库刷新快照。

### S2 — 内容库侧栏 + 拖拽落入

- **状态**: Done（2026-09-23）
- **可观察结果**：浏览器中按**标签**/大类/关键字过滤，拖模块到匹配 section；落库为 snapshot；刷新后仍在；可导出 DOCX。
- **依赖**：S1 placement API；`MODULE_DRAG_MIME` + `decideModuleDrop`（domain）。
- **证据**：`npm test`（domain DnD 合同 + server 标签过滤/快照回归 + web query/class helpers）。
- **不做**：TipTap、富文本 body、JD UI。

### S3 — TipTap 文档感编辑壳

- **状态**: Done（2026-09-23）
- **可观察结果**：主区为 TipTap 文档（section / placement / profile 节点）；条目只读展示快照字段；S2 DnD 仍写入 snapshot。
- **同步模型**：TipTap = 投影；导出 = placements → ResumeIR（见 ADR-0002）。
- **证据**：`npm test`（web `s3.docModel` 桥接 +既有 S1/S2）。
- **不做**：富文本 body、TipTap→DOCX 直出、多模板设计器。

### S4 — 打磨与演示数据

- **状态**: Done（2026-09-23）
- **可观察结果**：一键种子生成**可读**样例简历；空态/API 错误横幅；placement **删除/同 section 排序**；验收清单见 [05-acceptance.md](./05-acceptance.md)。
- **证据**：`npm test`（server delete/reorder + web banner/order helpers）。
- **不做**：多模板、桌面壳、PDF、JD、TipTap 作导出 SoT。

## 影响矩阵（需求 → 处置）

| 需求 | 用户流 | API | 数据 | UI | 处置 |
|---|---|---|---|---|---|
| 模块库检索 | 侧栏按标签搜索 | content-library | modules/tags | library-ui | 新增 |
| 拖拽组装 | 拖入 → 快照 | resume placements | placements 快照 JSON | editor DnD | 新增 |
| 模板排版 | 分字段预览一致 | render IR | template 分字段规则 | 预览只读 | 新增 |
| DOCX | 导出按钮 | export | 无额外表 | workbench | 新增 |
| JD / 目标岗位 | — | — | — | — | **不做（D4）** |
| 桌面安装包 | — | — | SQLite 迁路径 | — | **延后（ADR-0004）** |
| PDF | — | — | — | — | 延后 |
| 多模板 | — | — | — | — | 延后 |

## 建议下一步（唯一）

**桌面 Plan C（Rust 核心）**：按 [08-plan-c-rust-core.md](./08-plan-c-rust-core.md) / [ADR-0006](./adr/0006-rust-core.md) 垂直切片推进；对照 tag `snapshot/pre-rust-node-sidecar`。勿与多模板 / PDF / JD 并行发散。
