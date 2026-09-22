# S1–S4 验收清单

- as_of: 2026-09-23
- 目标：演示简历可读；快照隔离；TipTap 投影与导出同源 placements。

## 前置

```bash
cd /Users/linyunhe/ai_project/resume_system
npm install
npm run typecheck
npm test
npm run dev:server   # :8787
npm run dev:web      # :5173
```

## 清单

| # | 步骤 | 期望 |
|---|---|---|
| 1 | `npm run app` | 单页：左模板 / 右内容库；顶栏 **导出** |
| 2 | 左侧上传 **照片**；编辑姓名/标语/联系方式 | 预览更新；失焦保存 |
| 3 | 右侧 **项目/实习** 标签 + 搜索；点 **+** 新建 | 标题必填；时间/技术栈可留空；保存入库 |
| 4 | 拖卡片到左侧「项目/实习/技术能力」 | 快照落入；↑↓删可用 |
| 5 | **导出** | DOCX 含 lin-v1 版式；有照片则嵌入页眉图 |
| 6 | （可选）演示数据 | 一键样例可读 |

## 自动化证据

- `npm test`：domain DnD、server S1–S4（含 delete/reorder）、web helpers + TipTap doc bridge。
- 同步模型：TipTap = 投影；导出 = placements → ResumeIR → DOCX（ADR-0002）。

## 非目标（本清单不验）

多模板、Tauri、PDF、JD、TipTap 富文本持久化、从库刷新快照。
