# 拼履

本地优先的模块化简历工具：**内容库拼进模板 → 画布预览 → DOCX 导出**。

产品名取「拼履」——「拼」对应模块拖放组装，「履」指履历；短、好记，区别于泛称「简历组装系统」。

> 当前状态：**可验收**。清单 [docs/05-acceptance.md](docs/05-acceptance.md)；模板说明 [docs/06-template-lin-v1.md](docs/06-template-lin-v1.md) / [docs/07-template-packs.md](docs/07-template-packs.md)。

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
| [docs/adr/](docs/adr/) | 技术决策（栈 / 编辑器 / 导出 / 桌面路径） |
| [docs/contracts/](docs/contracts/) | 跨模块合同 |

## 技术栈（摘要）

TypeScript monorepo · Vite/React · TipTap · Fastify · `node:sqlite` · `docx` · **Tauri 2 壳（可选）**。

## 环境要求

- Node.js **22+**（`node:sqlite`）
- npm 10+
- 桌面壳另需：Rust/Cargo（已装则可 `npm run app:desktop`）

## 一键验收（推荐，无需双终端）

```bash
cd /Users/linyunhe/ai_project/resume_system
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
| **macOS** | `拼履_x.y.z_*.dmg` 或 `.app` | 打开 DMG，拖到「应用程序」 |
| **Windows** | `拼履_x.y.z_x64-setup.exe`（NSIS） | 双击安装 |

**热更新：** 从 v1.2 起，已安装的桌面端会在启动时检查 Release 的 `latest.json`，有新版本则自动下载并重启（见 [ADR-0005](docs/adr/0005-desktop-updater.md)）。用户 SQLite 数据保留在 App Data，不被覆盖。

**运行要求：** 本机安装 [Node.js 22+](https://nodejs.org)（拼履桌面壳会拉起内置 API；**不**附带开发者 `data/`）。

**用户数据目录（独立于仓库）：**
- macOS: `~/Library/Application Support/com.pinlu.desktop/resume.db`
- Windows: `%APPDATA%\com.pinlu.desktop\resume.db`

发布：`git tag v1.2 && git push origin v1.2` → Actions 构建双端安装包并上传 `latest.json`。

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
