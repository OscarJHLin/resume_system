# 事实基线

- as_of: 2026-09-23
- repository: `/Users/linyunhe/ai_project/resume_system`
- branch / HEAD: 尚未初始化 git（或未 commit）
- worktree: **S3 已实现**（TipTap 投影壳 + S2 DnD + snapshot 导出）
- 环境目标: 近端本地 Web + API + SQLite；长期 Win/Mac 桌面（ADR-0004）

## 当前能力分层

| 类别 | 现状 |
|---|---|
| 已验证（本机） | S1–S3：API/导出、标签 DnD、TipTap 投影桥接；`npm test` |
| 仅设计 / 未做 | 多模板、桌面壳、PDF、JD、placement 排序删除 UI |
| 持久化 | `node:sqlite` 文件（默认 `./data/resume.db`） |
| 被阻塞 | 无；下一步 S4 |

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
7. `README.md` — 如何启动与开发入口

冲突时以上游编号更小的文档为准；实现细节不得偷偷推翻未批准的 ADR。
