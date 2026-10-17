# ADR-0001：技术栈与仓库形态

- status: Accepted
- date: 2026-09-23
- note: 近端原型栈；长期桌面见 [ADR-0004](./0004-desktop-path.md)

## 背景

需要可维护的本地 Web 原型：内容库、快照组装、单一模板、DOCX 导出；长期要 Win/Mac 可安装分发，但先求最快验证闭环。

## 决策

| 层 | 选择 |
|---|---|
| 语言 | TypeScript（strict） |
| 仓库 | **npm workspaces** monorepo（当前环境无 pnpm，避免额外工具链） |
| 前端 | Vite + React + TypeScript |
| 编辑器 | TipTap（见 ADR-0002） |
| 后端 | Fastify + TypeScript |
| 存储 | **SQLite 文件**，经 Node 内置 **`node:sqlite`（DatabaseSync）**（无 better-sqlite3 原生编译；schema 仍可迁桌面） |
| 导出 | `docx`（见 ADR-0003） |
| 近端运行 | 本机 Web + API（非最终安装包） |
| 包管理脚本 | 根目录 `npm run dev:web` / `dev:server` |

## 理由

- 单一语言降低模块间合同成本。
- Fastify 轻、类型友好；`node:sqlite` 零原生绑定，文件型库与桌面迁移兼容（ADR-0004）。
- Vite/React 生态与 TipTap 契合。
- npm workspaces 无需再装 pnpm。

## 备选及为何不选（近端）

- **Next.js 全栈**：SSR/路由对本地文档工具收益低。
- **纯 IndexedDB 无后端**：不利于导出测试与桌面迁文件型库。
- **立刻上 Electron/Tauri**：原型阶段过重；桌面作为第二阶段（ADR-0004 首选 Tauri）。
- **Python 导出侧**：双语言会拆散类型合同。

## 后果

- 需要本机 Node；SQLite 原生绑定若安装失败，可临时切 JSON repo（接口不变）。
- 不做云端多租户；不做 JD 服务。
- 安装包、签名、双端分发不在近端范围。
