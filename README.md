# 模块化简历组装系统

本地优先的简历组装系统：**S1 已打通**「个人资料 / 内容库 / 快照组装 / 模板 IR / DOCX 导出」。

> 当前状态：**S2 Ready**（标签库 + 拖拽落入；TipTap 见 S3）。

## 文档入口

| 文档 | 内容 |
|---|---|
| [docs/00-baseline.md](docs/00-baseline.md) | 事实基线与文档权威顺序 |
| [docs/01-requirements.md](docs/01-requirements.md) | 需求 / PRD（中文） |
| [docs/02-architecture.md](docs/02-architecture.md) | 架构、数据模型、流水线 |
| [docs/03-modules.md](docs/03-modules.md) | 模块边界与构建顺序 |
| [docs/04-roadmap.md](docs/04-roadmap.md) | 阶段与垂直切片 |
| [docs/adr/](docs/adr/) | 技术决策（栈 / 编辑器 / 导出 / 桌面路径） |
| [docs/contracts/](docs/contracts/) | 跨模块合同 |

## 技术栈（摘要）

TypeScript monorepo（npm workspaces）· Vite/React · Fastify · **`node:sqlite`** · `docx` 导出。  
近端：本地 Web+API；长期：Tauri 桌面（[ADR-0004](docs/adr/0004-desktop-path.md)）。编辑器 TipTap 在 S2–S3。

## 环境要求

- Node.js **22+**（使用内置 `node:sqlite`；推荐 22/24/26）
- npm 10+（workspaces）

## 快速开始

```bash
cd /Users/linyunhe/ai_project/resume_system
npm install

# 终端 1 — API（默认 http://127.0.0.1:8787，库文件 ./data/resume.db）
npm run dev:server

# 终端 2 — Web（默认 http://127.0.0.1:5173，代理 /api）
npm run dev:web
```

健康检查：`curl http://127.0.0.1:8787/health`  
元信息：`curl http://127.0.0.1:8787/api/meta`

## S2 拖拽演示

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
2. 下一切片：**S3** TipTap 文档壳（见 [docs/04-roadmap.md](docs/04-roadmap.md)）。
3. 不要在未实现层假装 Done；证据绑定命令与产物。

## 已锁定决策

D1 快照 · D2 结构化字段+纯文本 · D3 近端 Web / 长期桌面 · D4 标签检索（无 JD）。  
详见 [docs/01-requirements.md §7](docs/01-requirements.md)。
