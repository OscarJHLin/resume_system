# ADR-0005：桌面热更新（Tauri Updater）

- status: Accepted
- date: 2026-09-23
- relates: [ADR-0004](./0004-desktop-path.md)

## 背景

安装包分发后，需要在不强制用户手动下安装包的前提下升级到新版本（Win + Mac）。

## 决策

使用 **Tauri 2 官方 Updater**：

1. 构建时 `createUpdaterArtifacts: true`，由签名私钥生成 `.sig`
2. CI（`desktop-release.yml`）在 tag `v*` 时构建 macOS/Windows，上传安装包 + `latest.json`
3. 客户端 `plugins.updater.endpoints` 指向  
   `https://github.com/OscarJHLin/resume_system/releases/latest/download/latest.json`
4. **应用内更新（v1.5.3 之后）**：不再静默安装，改为「通知 + 用户确认」
   - Rust 命令（`src/updater.rs`，权限 `allow-app-updater`，远程 `http://127.0.0.1` 页面经 `__TAURI_INTERNALS__.invoke` 调用）：
     - `check_update` → `{ available, currentVersion, version, notes, date }`
     - `install_update` → 下载 + 验签 + 安装，期间发 `update://progress` `{ downloaded, total }`，完成后重启
   - 启动 5s 后及每 6 小时后台检查，有新版本时发 `update://available`（同上结构）；前端挂载时也静默检查一次
   - UI：工作台顶栏「检查更新」按钮（无更新时提示「已是最新版本」）；顶栏下方横幅「发现新版本 vX.Y.Z」+「查看更新内容」（`latest.json` 的 `notes`）+「立即更新」+「稍后」，下载进度条，失败可重试；浏览器开发模式不渲染
   - Windows：NSIS `installMode: passive`（仅进度窗，无需点击），插件退出进程后由安装器重启应用；macOS：替换 `.app.tar.gz` 后 `restart`
5. 用户数据仍在 OS App Data（SQLite），**更新不覆盖用户库**

### 旧版本升级路径

≤ v1.5.3 内置的是旧的静默更新器：它们检测到下一版后会**静默**下载、安装并重启（无 UI）。从该版本起，后续每次更新都走应用内横幅，由用户点击「立即更新」。

公钥写入 `tauri.conf.json`；私钥仅存在 GitHub Secret：`TAURI_SIGNING_PRIVATE_KEY`（及可选 password）。

## 后果

- 发布流程：`git tag vX.Y && git push origin vX.Y` → Actions 出双端包 + updater 元数据
- 已安装用户打开后（或运行中每 6 小时）看到新版本横幅，点击「立即更新」升级到 `latest`
- 丢失私钥会导致无法再签更新包（需轮换公钥并强制用户重装一次）

## 非目标

- 仅热更前端资源、不动 Tauri 壳（可用后续「资源热补丁」切片，非本 ADR）
- 差分补丁 / 灰度 / 强制更新策略
