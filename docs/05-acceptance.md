# S5 验收清单（工作台 UX）

- as_of: 2026-09-23
- 目标：模板选择 → 左空白稿 → 右四标签内容库；基本信息卡应用到简历；有照片时页眉/导出显示。

## 前置

```bash
cd /Users/linyunhe/ai_project/resume_system
npm install
npm run typecheck
npm test
npm run app   # :8787，完整 web build（勿 SKIP_WEB_BUILD）
```

## 清单

| # | 步骤 | 期望 |
|---|---|---|
| 1 | 打开 http://127.0.0.1:8787/ | 左模板 / 右内容库；顶栏 **选择简历模板** + **导出**（无演示数据） |
| 2 | 点 **选择简历模板** → 蓝黑简洁简历 | 左侧出现空白稿：姓名/联系/教育/技术为占位提示；有照片则显示在页眉右侧 |
| 3 | 右「基本信息」+ → 填必填项与教育/技术（日期点选：年→月→日）→ 保存 → **应用到简历** | 左侧姓名/教育/技术能力被填充；本机 `data/resume.db` 保留 |
| 4 | 「项目 / 实习 / 获奖与证书」各 + 新建；拖入左侧对应区 | 快照落入；↑↓删可用 |
| 5 | **导出** | DOCX 为蓝黑简洁版式；有照片则嵌入证件照 |

## 自动化证据

- `npm test`：domain 校验与 DnD、profile cards API、template skills-from-profile、web profileForm / banners。

## 非目标

多模板视觉变体、PDF、JD、从库刷新快照、TipTap 富文本持久化。
