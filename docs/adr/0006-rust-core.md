# ADR-0006：桌面核心迁入 Rust（Plan C）

- status: Accepted
- date: 2026-09-23
- relates: [ADR-0004](./0004-desktop-path.md)、[ADR-0003](./0003-export-docx.md)、[ADR-0005](./0005-desktop-updater.md)
- detail: [docs/08-plan-c-rust-core.md](../08-plan-c-rust-core.md)

## 背景

首版桌面壳（Tauri 2）通过 sidecar 启动本机 **Node 22+** 运行捆绑的 `server.mjs`（Fastify + SQLite + `docx`）。  
GUI 启动时常找不到 PATH 中的 Node（见 `lib.rs` 的探测逻辑），且要求终端用户安装 Node 增加分发摩擦。  
备选曾考虑捆绑 Node runtime；产品仍处早期，**整核迁入 Rust 的重写成本更低、环境不确定性更小**，故选定 Plan C。

## 决策

1. **目标形态**：单个 Tauri 进程拥有 SQLite、模板渲染、DOCX 导出与对前端的 API；**终端用户零 Node 依赖**。
2. **传输层**：优先 **Tauri commands**（或进程内嵌入 HTTP，如 axum/tiny-http 仅监听 `127.0.0.1`）；与现有 REST 合同保持 JSON 形状兼容，便于分阶段切换 `apps/web` 的 `api/client.ts`。
3. **持久化**：继续同一 SQLite schema（`profile` / `content_module` / `resume` / `section_placement` + 加法迁移）；路径仍为 OS App Data 下的 `resume.db` + `photos/`。**更新与迁移不得清空用户库**。
4. **领域合同**：`packages/domain` 与 `docs/contracts/*` 继续作为类型/行为权威；Rust 侧实现同等校验（类别↔section、snapshot-on-drop、必填 Profile 等）。
5. **DOCX**：优先纯 Rust 产出（或分阶段评估）；仅当 fidelity 不足时再保留**极小** JS 导出 worker（非用户安装的 Node）。详见 Plan C「导出策略」。
6. **热更新**：继续 ADR-0005（GitHub Releases + `latest.json`）；包体去掉 Node/`server.mjs` 后 updater 协议不变。

## 备选（已否决或延后）

| 方案 | 结论 |
|---|---|
| **Plan A**：继续依赖本机 Node + PATH 探测 | 已缓解 Finder PATH 问题，但仍要求用户装 Node |
| **Plan B**：捆绑 Node runtime 进安装包 | 包体大、签名/许可/多平台路径复杂；早期不划算 |
| Electron 全栈 | 与 ADR-0004 一致，仅作 Tauri 阻塞时的后备 |

## 后果

- 实现按 [08-plan-c-rust-core.md](../08-plan-c-rust-core.md) 垂直切片推进；对照基线见 git tag **`snapshot/pre-rust-node-sidecar`**。
- ADR-0004「首版仍依赖本机 Node」已为**历史过渡态**；**Phase 4 起**桌面默认进程内 Rust，安装包零 Node。
- `apps/server` 保留为浏览器 `npm run app`、合同测试与可选 `RESUME_API=node` 开发对照；打包资源**不含** `desktop-resources/server/`。
- CI `desktop-release.yml`：构建机仍用 Node 编前端；用户机器不需要 Node 运行时。

## 非目标（本 ADR / 第一里程碑）

- 重写 TipTap / 左侧画布 React UI
- 云同步、多设备、PDF、JD
- 把开发机 `data/resume.db` 打进安装包
