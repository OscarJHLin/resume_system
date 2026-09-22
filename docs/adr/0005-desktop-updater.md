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
4. 应用启动后后台 `check → download_and_install → restart`
5. 用户数据仍在 OS App Data（SQLite），**更新不覆盖用户库**

公钥写入 `tauri.conf.json`；私钥仅存在 GitHub Secret：`TAURI_SIGNING_PRIVATE_KEY`（及可选 password）。

## 后果

- 发布流程：`git tag vX.Y && git push origin vX.Y` → Actions 出双端包 + updater 元数据
- 已安装用户下次打开即可热更新到 `latest`
- 丢失私钥会导致无法再签更新包（需轮换公钥并强制用户重装一次）

## 非目标

- 仅热更前端资源、不动 Tauri 壳（可用后续「资源热补丁」切片，非本 ADR）
- 差分补丁 / 灰度 / 强制更新策略 UI
