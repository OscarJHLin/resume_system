# 模块化简历组装系统

本地优先的简历组装系统：**S5 工作台（模板选择 + 四标签内容库 + 多基本信息卡）+ lin-v1 导出**。

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
SQLite 默认：`./data/resume.db`（可用 `RESUME_DB_PATH` / `RESUME_DATA_DIR` 覆盖）。  
**该目录已 gitignore，重启/重建不会清空**；Tauri 安装包使用系统 app data 下的独立库，不携带开发者数据。

### 桌面窗口（Tauri）

```bash
npm run app:desktop          # 开发：起本地服务 + Tauri 窗口
npm run app:desktop:build    # 产出 macOS .app（不入库）
```

构建产物（本机，勿提交；默认复制到 `dist-app/`）：

```bash
npm run app:desktop:build
# → dist-app/简历组装系统.app   （若设置了 CARGO_TARGET_DIR 则见该目录下 release/bundle/macos/）
open dist-app/简历组装系统.app
```

打包后的 `.app` 仍需本机 **Node/npm 在 PATH**，并建议在仓库根执行或设置 `RESUME_ROOT` 指向本仓库（服务从 monorepo 启动）。纯离线无 Node 的安装包未做。

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
