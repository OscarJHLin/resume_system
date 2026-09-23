# 事实基线

- as_of: 2026-09-23
- product: **拼履**（模块拖放组装履历；技术包名仍为 `@resume/*`）
- repository: `/Users/linyunhe/ai_project/resume_system`
- pre-Rust snapshot: tag **`snapshot/pre-rust-node-sidecar`** @ `a9fc8f0422bc4f05646f3feabf2e19d97889f24d`
- worktree: **可验收**：蓝黑简洁模板、内容库四标签、`npm run app` / Tauri 壳（Node sidecar）
- 环境目标: 近端本地 Web + API + SQLite；桌面壳已分发（依赖本机 Node）；**下一步 Plan C** 迁 Rust 核心（[08-plan-c-rust-core.md](./08-plan-c-rust-core.md)）

## 当前能力分层

| 类别 | 现状 |
|---|---|
| 已验证（本机） | S1–S5；模块表单 CRUD；证件照；DOCX 导出；`npm test`；`npm run app`；Tauri 安装包 + 热更新 |
| 进行中 / 已决策 | Plan C：Rust 进程内核心，消除终端用户 Node（ADR-0006） |
| 仅设计 / 未做 | 多模板设计器、PDF、JD |
| 持久化 | `RESUME_DB_PATH` 或 `./data/resume.db`；Tauri→app data dir（更新不擦库） |
| 被阻塞 | 无 |

## 已锁定产品决策（摘要）

| ID | 锁定结论 |
|---|---|
| D1 | 拖入 → ModuleSnapshot（非实时引用） |
| D2 | 结构化字段 + 纯文本 body；模板分字段样式 |
| D3 | 近端本地 Web+SQLite；长期 Tauri 桌面 |
| D4 | 无 JD 实体；标签 CRUD + 标签检索 |

详见 `docs/01-requirements.md` §7。

## 文档权威顺序

1. `docs/01-requirements.md` — 需求与 MVP 范围
2. `docs/02-architecture.md` — 架构与技术栈
3. `docs/adr/*` — 关键决策
4. `docs/contracts/*` — 跨边界合同
5. `docs/03-modules.md` — 模块边界
6. `docs/04-roadmap.md` — 垂直切片与开发顺序
7. `docs/08-plan-c-rust-core.md` — 桌面 Rust 核心迁移（Plan C）
8. `README.md` — 如何启动与开发入口

冲突时以上游编号更小的文档为准；实现细节不得偷偷推翻未批准的 ADR。
