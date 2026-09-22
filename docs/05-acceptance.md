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
| 1 | 打开 http://127.0.0.1:5173（API 未启时） | 顶部错误横幅提示 `dev:server`；导出/种子禁用 |
| 2 | 启动 API 后刷新 | 连接成功；若无简历，提示写入演示数据 |
| 3 | 点击 **写入演示数据** | Profile + 模块入库；简历含预置 skill/project/internship；奖项模块在库中可拖 |
| 4 | 主区 TipTap | 分 section；预置条目只读展示 title/time/body；空区块有落点提示 |
| 5 | 左侧按标签 `TypeScript` 过滤 | 仅相关模块；可点标签快捷过滤 |
| 6 | 拖「优秀奖学金」到获奖区块 | 落入成功；TipTap 出现新条目（snapshot） |
| 7 | 拖 skill 到 projects | 拒绝并状态提示不匹配 |
| 8 | 条目 **↑ / ↓ / 删** | 同 section 内排序变化；删除后条目消失且再导出无该条 |
| 9 | **导出 DOCX** | 下载非空 `.docx`（ZIP/`PK`）；Word/LibreOffice 可开；字段分样式可读 |
| 10 | （可选）改库内模块标题后再导出 | 已组简历条目标题不变（D1 快照隔离） |

## 自动化证据

- `npm test`：domain DnD、server S1–S4（含 delete/reorder）、web helpers + TipTap doc bridge。
- 同步模型：TipTap = 投影；导出 = placements → ResumeIR → DOCX（ADR-0002）。

## 非目标（本清单不验）

多模板、Tauri、PDF、JD、TipTap 富文本持久化、从库刷新快照。
