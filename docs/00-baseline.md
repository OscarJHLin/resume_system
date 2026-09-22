# 事实基线

- as_of: 2026-09-23
- product: **拼履**（模块拖放组装履历；技术包名仍为 `@resume/*`）
- repository: `/Users/linyunhe/ai_project/resume_system`
- branch / HEAD: 尚未初始化 git（或未 commit）
- worktree: **可验收**：lin-v1 模板、内容库表单、一键 `npm run app` / Tauri 壳
- 环境目标: 近端本地 Web + API + SQLite；Tauri 壳已脚手架（仍依赖本机 Node）

## 当前能力分层

| 类别 | 现状 |
|---|---|
| 已验证（本机） | S1–S4；模块表单 CRUD；lin-v1 导出；`npm test`；`npm run app` |
| 仅设计 / 未做 | 多模板、无 Node 单文件安装包、PDF、JD、证件照导出 |
| 持久化 | `RESUME_DB_PATH` 或 `./data/resume.db`；Tauri→app data dir |
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
7. `README.md` — 如何启动与开发入口

冲突时以上游编号更小的文档为准；实现细节不得偷偷推翻未批准的 ADR。
