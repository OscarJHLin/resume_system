# 拼履项目私密归档 · 2026-10-25

本分支为独立归档，不替换 main。含个人简历与照片的历史材料，仅限该私密仓库。

- `archive-20261025.tar.gz.part000` 等三个分片（合并为 `archive-20261025.tar.gz`）：`workspace/` 是清理前 Documents/ChatGPT/拼履 的历史工作材料（排除可用 lockfile 重建的 node_modules/ 与 target/ 缓存）；`repository-old/` 是源码目录中的临时验证材料和 1.3.0 旧安装包；`latest-source/` 是 HEAD da4632704a84bcd4fe181732b5b90ee9b1668dd0 加原有未提交/未跟踪源码和 AOCI 资产的逐文件快照。
- `source-history.bundle`：本地全部 Git 引用和历史（包括尚未推到 main 的两个提交）；使用 `git bundle verify source-history.bundle` 检查。
- `source-status.txt`、`uncommitted-changes.patch`：清理前的源码工作树状态和已跟踪文件差异。
- `installed-startup-fix.patch`：已安装 1.6.1 所用的原生启动导航修复。该修复原本只在 local-build 副本，未擅自回写主源码；在与快照匹配的源码目录可先 `git apply --check /path/to/installed-startup-fix.patch`，再选择应用。完整已安装版本源码副本也在 workspace/local-build。
- `manifest.json`：每个归档成员的路径、字节数、模式、SHA-256 或符号链接目标。
- `SHA256SUMS`：归档文件、历史包和清单等的校验和。

## 恢复

1. 克隆此归档分支到空目录：`git clone --single-branch --branch archive/2026-10-25-slimdown https://github.com/OscarJHLin/resume_system.git pinlu-archive`。
2. 在克隆目录运行 `shasum -a 256 -c SHA256SUMS`。
3. 运行 `cat archive-20261025.tar.gz.part* > archive-20261025.tar.gz`，然后 `shasum -a 256 -c ARCHIVE.sha256` 核对合并结果。新建空目录 `restored`，运行 `tar -xzf archive-20261025.tar.gz -C restored`。不要直接覆盖正在使用的数据库或应用。
4. 历史恢复：`git clone source-history.bundle history-repo`。该步骤只恢复提交，未提交的最新字节位于 `restored/latest-source/`，也可结合补丁与状态清单恢复。
5. 最新源码的开发依赖可以在源仓库运行 `npm ci` 重建；应用构建使用 `npm run app:desktop:build`。

## 本地保留范围

主源码仓库、未提交改动、autofill-extension、AOCI 资产、data/ 开发数据库与照片，以及正在运行的 dist-app/拼履.app 均保留。桌面正式数据库位于系统 Application Support/com.pinlu.desktop，不属于本次删除或上传范围。工作目录保留导入后数据库快照、小型报告、导入脚本和启动修复补丁。

默认并行测试在临时照片目录出现竞争；串行服务测试的实际结果由本地清理报告记录。归档完整性验证不等同于重新验收应用功能。
