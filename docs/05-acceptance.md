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
| 1 | 打开应用（`npm run app` 或桌面壳） | 单窗口/单页可用；API 健康 |
| 2 | 点击 **写入演示数据** | 可读样例简历 + 内容库模块 |
| 3 | **新建模块**：填标题/标签；时间与工作站可留空；保存 | 出现在库列表；可按标签过滤 |
| 4 | **编辑**已有模块，改时间（日期选择器）后保存 | 库内更新；已落入简历的快照不变（D1） |
| 5 | 拖模块到匹配区块；不匹配拒绝 | TipTap 投影出现条目 |
| 6 | ↑↓ / 删 | 排序与删除后 rehydrate |
| 7 | **导出 DOCX** | 非空；版式接近林氏模板（见 [06-template-lin-v1.md](./06-template-lin-v1.md)） |
| 8 | （可选）停掉 API 再打开 | 错误横幅提示 |

## 自动化证据

- `npm test`：domain DnD、server S1–S4（含 delete/reorder）、web helpers + TipTap doc bridge。
- 同步模型：TipTap = 投影；导出 = placements → ResumeIR → DOCX（ADR-0002）。

## 非目标（本清单不验）

多模板、Tauri、PDF、JD、TipTap 富文本持久化、从库刷新快照。
