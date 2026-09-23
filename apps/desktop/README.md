# @resume/desktop（拼履 Tauri 壳）

## 当前（正式版 GA · Plan C Phase 4）

- 产品版本 **1.5.1**（GitHub tag `v1.5.1`）— Windows WebView2 UX 补丁（导出 / 拖拽 / 日期）
- Tauri 2 WebView 加载打包的 `apps/web`
- **默认**进程内 axum（CRUD + 照片 + DOCX `docx-rs`）——**无需本机 Node**
- 可选开发对照：`RESUME_API=node` → monorepo 内 `npm run start -w @resume/server`（仅仓库开发；安装包拒绝）
- 用户数据：OS App Data 下 `resume.db` + `photos/`（不打进安装包）
- 热更新：见仓库 `docs/adr/0005-desktop-updater.md`
- 打包资源：`web-dist` + `templates/`（**不含** `server/`）

开发：

```bash
# 仓库根 — 默认 Rust 进程内 API（零 Node 运行时依赖）
npm run app:desktop

# 开发对照：仍走 Node Fastify（需本机 Node 22+）
RESUME_API=node npm run app:desktop

# 无 Tauri 的 curl 对照（Rust 默认 8788）
cd apps/desktop/src-tauri
RESUME_DB_PATH=../../../data/resume.db RESUME_TEMPLATES_DIR=../../../templates \
  PORT=8788 cargo run --bin resume_api
```

浏览器验收（仍用 `apps/server`）：`npm run app`（与桌面壳无关）。

## Plan C — Rust 进程内核心

决策与切片：[docs/08-plan-c-rust-core.md](../../docs/08-plan-c-rust-core.md) · [ADR-0006](../../docs/adr/0006-rust-core.md)

对照基线 tag：`snapshot/pre-rust-node-sidecar`

### TODO（实现时勾选）

- [x] `src/core/`：rusqlite 打开 App Data DB（只读 GET）
- [x] 嵌入 HTTP（axum），对齐现有 `/api/*` JSON（读路径）
- [x] Feature flag `RESUME_API=rust|node` 过渡（**默认 rust** — Phase 4）
- [x] CRUD 写入迁 Rust — Phase 2（profiles / modules / resumes / placements / photo）
- [x] 模板 → ResumeIR → DOCX（纯 Rust `docx-rs`）— Phase 3
- [x] 移除 `find_node` / 打包 `server.mjs`；默认进程内 Rust — Phase 4
- [x] CI Windows smoke：typecheck / tests / cargo / headless API — Phase 5（见 `.github/workflows/windows-smoke.yml`）

**禁止**：把仓库 `data/resume.db` 打进资源；迁移时 truncate 用户表。

## Windows 手工验收清单（安装包）

在干净 Windows 10/11 + WebView2 上安装 `Pinlu_*_x64-setup.exe` 后：

1. **导出** — 打开任意简历 →「导出 DOCX」→ 应弹出系统「另存为」对话框；选路径后状态栏显示「已保存 …」（不应出现「已取消导出」且无对话框）。
2. **拖拽** — 内容库拖一条项目经历到左侧「项目经历」区块；若拖拽失灵，点卡片「放入」再点左侧对应区块。
3. **日期** — 编辑模块 → 点「开始」日期 → 年/月/日面板应完整可见可点，选完后字段显示中文日期。
4. **数据** — 关闭重开后内容仍在 `%APPDATA%\com.pinlu.desktop\resume.db`（勿删用户库做验收）。
