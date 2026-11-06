# 拼履｜秋招投 100 家，我不想再手填 100 遍教育经历

> **本地优先的模块化简历工具。** 内容库拼进模板 → 画布预览 → DOCX 导出。简历数据只存在你自己的电脑里，不上传云端，一个字都不用交给在线简历平台。

## 秋招最折磨人的几件事，拼履想管

| 你的痛 | 拼履怎么办 |
|---|---|
| 同一份项目经历，投产品、开发、数据要改 N 个版本，文件名叫“终版-真终版-最终2” | **模块化内容库**：项目 / 实习 / 获奖与证书 / 基本信息各存一份，投递时像拼积木一样**拖进模板**，导出 DOCX |
| 每改一次排版就牵一发动全身 | **模板与内容分离**：内容是结构化字段 + 纯文本，模板只管排版；拖进简历的是**快照**，改库不会悄悄改掉你已经定稿的版本 |
| 不想把简历交给陌生网站 | **本地优先**：数据在本机 SQLite；桌面安装包双击即用，**不需要装 Node** |
| 想要照片又怕 DOCX 乱 | 照片只做存档，导出的 DOCX 不含照片，ATS 友好 |
| 想换个风格 | `templates/` 是模板包格式，加第二套模板不用改核心代码 |

## 亮点

- **拖放组装**：右侧四个标签（项目 / 实习 / 获奖与证书 / 基本信息），一键新建，拖到左侧画布即成简历；基本信息卡“应用到简历”自动填姓名、教育、技术能力。
- **桌面端 Rust 核心**：Tauri 2 + Rust 进程内 API，macOS / Windows 安装包开箱即用；浏览器开发模式用 Fastify。
- **应用内更新**：发现新版本时给出横幅提示、带进度下载并重启，用户数据保留在系统 App Data。
- **文档诚实**：需求、架构、模块边界、路线图、验收清单、ADR 决策都在 `docs/` 里，行为改动先看合同再动手；不拿“测试通过”冒充“已验收”。
- **可读的工程样本**：TypeScript monorepo（Vite/React · TipTap · Fastify）+ Rust 桌面核心，适合想看一个完整本地优先产品怎么落地的开发者。

## 适合谁

- 2027 届 / 2026 届秋招、春招，要海投几十家的同学
- 一份简历要拆成多个岗位版本的人
- 不想把简历数据放在线上的人
- 想参考 Tauri + Rust + React 完整项目结构的开发者

## 许可

本项目采用 [PolyForm Noncommercial License 1.0.0](LICENSE)：个人学习、研究、求职自用等**非商业用途**可自由使用与修改；**未经作者书面许可，不得用于商业目的**。Copyright © 2026 OscarJHLin。

## 下载使用

到 [Releases](https://github.com/OscarJHLin/resume_system/releases) 下载最新版：

| 平台 | 文件 | 安装 |
|---|---|---|
| macOS（Apple Silicon） | `Pinlu_*_aarch64.dmg` | 打开 DMG，拖到“应用程序” |
| Windows | `Pinlu_*_x64-setup.exe` | 双击安装 |

请使用 **v1.6.0 及以上**；早期 v1.0（Node sidecar）在没有本机 Node 时会启动即崩。

## 从源码运行

```bash
git clone https://github.com/OscarJHLin/resume_system.git
cd resume_system
npm install
npm run app          # 构建 Web → 启动本地 API → 打开浏览器
```

---

# 以下为项目技术文档

> 当前状态：**正式版（GA）v1.6.1**。清单 [docs/05-acceptance.md](docs/05-acceptance.md)；模板说明 [docs/06-template-lin-v1.md](docs/06-template-lin-v1.md) / [docs/07-template-packs.md](docs/07-template-packs.md)。

## 文档入口

| 文档 | 内容 |
|---|---|
| [docs/00-baseline.md](docs/00-baseline.md) | 事实基线与文档权威顺序 |
| [docs/01-requirements.md](docs/01-requirements.md) | 需求 / PRD（中文） |
| [docs/02-architecture.md](docs/02-architecture.md) | 架构、数据模型、流水线 |
| [docs/03-modules.md](docs/03-modules.md) | 模块边界与构建顺序 |
| [docs/04-roadmap.md](docs/04-roadmap.md) | 阶段与垂直切片 |
| [docs/05-acceptance.md](docs/05-acceptance.md) | 验收清单 |
| [docs/06-template-lin-v1.md](docs/06-template-lin-v1.md) | default-v1 / 蓝黑简洁简历 notes |
| [docs/07-template-packs.md](docs/07-template-packs.md) | `templates/` 包格式（如何加第二套模板） |
| [docs/08-plan-c-rust-core.md](docs/08-plan-c-rust-core.md) | **Plan C**：桌面核心迁 Rust（消除用户 Node） |
| [docs/adr/](docs/adr/) | 技术决策（栈 / 编辑器 / 导出 / 桌面 / Updater / Rust 核心） |
| [docs/contracts/](docs/contracts/) | 跨模块合同 |

## 技术栈（摘要）

TypeScript monorepo · Vite/React · TipTap · Fastify（浏览器开发）· **Tauri 2 + Rust 核心（桌面）**。

## 环境要求

- **浏览器开发 / `npm run app`：** Node.js **22+**、npm 10+（Fastify `apps/server`）
- **桌面安装包：** 无需 Node；双击即用（Rust 进程内 API）
- **本地构建桌面壳：** 另需 Rust/Cargo（`npm run app:desktop`）

## 一键验收（推荐，无需双终端）

```bash
cd <repo-root>
npm install
npm run app
```

会：构建 Web → 启动 API（同进程托管静态页）→ 打开浏览器。  
本地数据持久化在仓库根目录 `data/resume.db`（**路径固定，不随启动目录变化**；首次启动自动创建）。高级场景可用 `RESUME_DB_PATH` 覆盖。  
**重启服务 / 重建前端不会清空该库**；桌面安装包使用系统 App Data 下的独立库，同样自动持久化。

### 桌面安装包（Mac / Windows）

正式安装包见 GitHub Releases：https://github.com/OscarJHLin/resume_system/releases

| 平台 | 下载 | 安装 |
|---|---|---|
| **macOS** | `Pinlu_1.6.0_aarch64.dmg` / `Pinlu.app`（Finder / 菜单栏显示 **拼履**） | 打开 DMG，拖到「应用程序」 |
| **Windows** | `Pinlu_1.6.0_x64-setup.exe`（NSIS） | 双击安装 |

**应用内更新：** 从 v1.6.0 起，桌面端启动时检查 Release 的 `latest.json`，发现新版本会显示「发现新版本」横幅，点「立即更新」下载（带进度）并重启；顶栏「检查更新」可手动检查。≤ v1.5.3 升级到 v1.6.0 时仍会**静默**更新一次（旧更新器），之后的更新都走横幅（见 [ADR-0005](docs/adr/0005-desktop-updater.md)）。用户 SQLite 数据保留在 App Data，不被覆盖。

**显示名 / 包名限制：** Tauri 热更新只替换 `.app` **内部**二进制与资源，**不会**把磁盘上的 `/Applications/Pinlu.app` 重命名为 `拼履.app`，也不会清掉 Dock / Launchpad / Spotlight 里的旧名缓存。若 Finder 仍显示 **Pinlu**，请用新版 DMG **整包拖入「应用程序」一次**（建议目标名为 `拼履.app`，并删掉旧的 `Pinlu.app`）；必要时从 Dock 移除旧图标后重新拖入。改 `CFBundleDisplayName` / `bundleName` 同理，不能单靠热更新生效。

**勿用旧版：** GitHub Releases 上的 **v1.0**（Node sidecar）在无本机 Node / Finder PATH 时会启动即崩；请只用 **v1.6.0+**（进程内 Rust API，无需 Node）。v1.2 / v1.3 / v1.5.x 为过渡包：若侧栏拖不到画布或 Windows 导出/日期异常，请升级到 v1.6.0。

**运行要求：** 安装包**不需要**本机 Node（Plan C Phase 4：进程内 Rust API）。**不**附带开发者 `data/`。

**用户数据目录（独立于仓库）：**
- macOS: `~/Library/Application Support/com.pinlu.desktop/resume.db`
- Windows: `%APPDATA%\com.pinlu.desktop\resume.db`

发布：`git tag -a v1.6 -m "拼履 v1.6.0" && git push origin v1.6` → Actions 构建双端安装包并上传 `latest.json`。

### 本地构建桌面壳

```bash
npm run app:desktop          # 开发：准备 bundle + Tauri 窗口
npm run app:desktop:build    # 本机产出安装包（macOS：.app / .dmg）
```

产物在 `apps/desktop/src-tauri/target/release/bundle/`（可复制到 `dist-app/`，勿提交）。  
Windows 安装包由 CI（`.github/workflows/desktop-release.yml`）在 `windows-latest` 构建并挂到 Release。

## 开发双终端（可选）

健康检查：`curl http://127.0.0.1:8787/health`  
元信息：`curl http://127.0.0.1:8787/api/meta`

## S5 演示与验收

完整步骤见 **[docs/05-acceptance.md](docs/05-acceptance.md)**。摘要：

1. `npm run app` → http://127.0.0.1:8787/（**勿** `SKIP_WEB_BUILD`）
2. 顶栏 **选择简历模板** → 蓝黑简洁简历（左空白稿，无照片栏）
3. 右四标签：项目 / 实习 / 获奖与证书 / 基本信息；+ 按当前标签新建
4. 基本信息卡 **应用到简历** → 左填姓名/教育/技术能力
5. 拖项目/实习/获奖到左 → **导出**（DOCX 不含照片）

## S3 TipTap 演示（遗留投影）

```bash
npm run dev:server
npm run dev:web
```

TipTap 壳仍在代码中，主路径为左侧模板画布。

## S1 API 演示

```bash
npm run dev:server
./scripts/s1-demo.sh   # 创建基本信息卡 + 项目 + 导出
```

### 测试

```bash
npm test
```

## 主要 API

| Method | Path | 说明 |
|---|---|---|
| GET/POST | `/api/profiles` | 基本信息卡列表/创建 |
| GET/PUT/DELETE | `/api/profiles/:id` | 卡详情/更新/删除 |
| PUT/GET/DELETE | `/api/profiles/:id/photo` | 照片存档（导出不含） |
| GET | `/api/templates` | 模板列表（目前仅 lin-v1） |
| GET/POST | `/api/modules` | 经历模块；`?category=&tag=&q=` |
| GET/POST | `/api/resumes` | 简历；POST 可带 `templateId`/`profileId` |
| PATCH | `/api/resumes/:id` | 改标题 / 应用 profileId / templateId |
| POST | `/api/resumes/:id/placements` | `{ section, moduleId }` → 快照 |
| POST | `/api/resumes/:id/export` | 下载 DOCX（无照片） |

## 开发约定

1. 改行为前先看对应 `docs/contracts/*`。
2. MVP 主路径已完成。后续可选：多模板 / PDF / Tauri（见路线图）。
3. 不要在未实现层假装 Done；证据绑定命令与产物。

## 已锁定决策

D1 快照 · D2 结构化字段+纯文本 · D3 近端 Web / 长期桌面 · D4 标签检索（无 JD）。  
详见 [docs/01-requirements.md §7](docs/01-requirements.md)。
