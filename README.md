# 模块化简历组装系统

本地优先的简历组装系统：**S1–S4 + 内容库表单编辑器 + lin-v1 模板导出 + 一键验收启动**。

> 当前状态：**可验收**。清单 [docs/05-acceptance.md](docs/05-acceptance.md)；模板说明 [docs/06-template-lin-v1.md](docs/06-template-lin-v1.md)。

## 文档入口

| 文档 | 内容 |
|---|---|
| [docs/00-baseline.md](docs/00-baseline.md) | 事实基线与文档权威顺序 |
| [docs/01-requirements.md](docs/01-requirements.md) | 需求 / PRD（中文） |
| [docs/02-architecture.md](docs/02-architecture.md) | 架构、数据模型、流水线 |
| [docs/03-modules.md](docs/03-modules.md) | 模块边界与构建顺序 |
| [docs/04-roadmap.md](docs/04-roadmap.md) | 阶段与垂直切片 |
| [docs/05-acceptance.md](docs/05-acceptance.md) | 验收清单 |
| [docs/06-template-lin-v1.md](docs/06-template-lin-v1.md) | default-v1 ← 参考简历模板.docx |
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

## S4 演示与验收

完整步骤见 **[docs/05-acceptance.md](docs/05-acceptance.md)**。摘要：

1. `npm run app`（或双终端 dev）
2. **写入演示数据** 或 **新建模块**（标题必填；时间/工作站可留空，日期点选）
3. 标签过滤 → 拖入 → ↑↓/删 → **导出 DOCX**（版式见 lin-v1 文档）

## S3 TipTap 演示

```bash
npm run dev:server
npm run dev:web
```

1. 打开 http://127.0.0.1:5173  
2. **写入演示数据**  
3. 左侧按标签过滤，拖模块到右侧 **TipTap** section 落点  
4. 主区应出现只读快照条目；**导出 DOCX**（仍由服务端 placements→IR 生成）

## S2 拖拽演示（同路径）

```bash
npm run dev:server   # :8787
npm run dev:web      # :5173
```

1. 打开 http://127.0.0.1:5173  
2. 点 **写入演示数据**（生成空简历 + 带标签模块）  
3. 左侧可用「标签 / 大类 / 关键字」过滤  
4. 将模块拖到右侧匹配区块（不匹配会拒绝）  
5. **导出 DOCX**

## S1 API 演示（仍可用）

### A. 一键脚本（推荐）

```bash
# 先启动 API
npm run dev:server

# 另开终端
chmod +x scripts/s1-demo.sh
./scripts/s1-demo.sh
# 产出 ./data/s1-demo.docx
```

### B. Web 薄 UI

打开 http://127.0.0.1:5173 → **写入演示数据** → **导出 DOCX**。

### C. 手工 curl

```bash
API=http://127.0.0.1:8787

curl -sS -X PUT "$API/api/profile" -H 'content-type: application/json' \
  -d '{"name":"张三","email":"z@example.com","education":[{"school":"示例大学","degree":"本科","timeRange":"2018-2022"}]}'

MOD=$(curl -sS -X POST "$API/api/modules" -H 'content-type: application/json' \
  -d '{"category":"project","title":"示例项目","subtitle":"基础站","timeRange":"2024-2025","body":"纯文本正文","tags":["React"]}')
MOD_ID=$(node -e "console.log(JSON.parse(process.argv[1]).id)" "$MOD")

RESUME=$(curl -sS -X POST "$API/api/resumes" -H 'content-type: application/json' -d '{"title":"投递稿"}')
RESUME_ID=$(node -e "console.log(JSON.parse(process.argv[1]).id)" "$RESUME")

curl -sS -X POST "$API/api/resumes/$RESUME_ID/placements" -H 'content-type: application/json' \
  -d "{\"section\":\"projects\",\"moduleId\":\"$MOD_ID\"}"

curl -sS -X POST "$API/api/resumes/$RESUME_ID/export" -o resume.docx
```

按标签检索：`curl "$API/api/modules?tag=React"`

### 测试

```bash
npm test
# 或
npm run test -w @resume/server
```

覆盖：快照隔离（改库 ≠ 改简历）、分字段 IR、DOCX `PK` 魔数。

## 主要 API（S1）

| Method | Path | 说明 |
|---|---|---|
| GET/PUT | `/api/profile` | 个人资料（含教育） |
| GET/POST | `/api/modules` | 内容模块；查询 `?category=&tag=&q=` |
| GET/PUT/DELETE | `/api/modules/:id` | 模块详情/更新/删除 |
| GET/POST | `/api/resumes` | 简历列表/创建 |
| GET/PATCH | `/api/resumes/:id` | 详情/改标题 |
| POST | `/api/resumes/:id/placements` | `{ section, moduleId }` → **深拷贝快照** |
| POST | `/api/resumes/:id/export` | 下载 DOCX |

## 开发约定

1. 改行为前先看对应 `docs/contracts/*`。
2. MVP 主路径已完成。后续可选：多模板 / PDF / Tauri（见路线图）。
3. 不要在未实现层假装 Done；证据绑定命令与产物。

## 已锁定决策

D1 快照 · D2 结构化字段+纯文本 · D3 近端 Web / 长期桌面 · D4 标签检索（无 JD）。  
详见 [docs/01-requirements.md §7](docs/01-requirements.md)。
