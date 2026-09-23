# @resume/desktop（拼履 Tauri 壳）

## 当前（snapshot / pre-Plan C）

- Tauri 2 WebView 加载打包的 `apps/web`
- 启动时 **spawn 本机 Node** 运行捆绑 `desktop-resources/server/server.mjs`（Fastify + SQLite + DOCX）
- 用户数据：OS App Data 下 `resume.db` + `photos/`（不打进安装包）
- 热更新：见仓库 `docs/adr/0005-desktop-updater.md`

开发：

```bash
# 仓库根
npm run app:desktop
```

## Plan C（进行中）— Rust 进程内核心

决策与切片：[docs/08-plan-c-rust-core.md](../../docs/08-plan-c-rust-core.md) · [ADR-0006](../../docs/adr/0006-rust-core.md)

对照基线 tag：`snapshot/pre-rust-node-sidecar`

### TODO（实现时勾选）

- [ ] `src/core/`：rusqlite 打开 App Data DB（只读 → CRUD）
- [ ] 嵌入 HTTP 或 Tauri commands，对齐现有 `/api/*` JSON
- [ ] 模板 → ResumeIR → DOCX（优先纯 Rust）
- [ ] Feature flag `RESUME_API=rust|node` 过渡
- [ ] 移除 `spawn_local_server` / `find_node` 与 bundle `server/`
- [ ] CI 安装包冒烟：无 Node 干净机验收

**禁止**：把仓库 `data/resume.db` 打进资源；迁移时 truncate 用户表。
