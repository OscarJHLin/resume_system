# Contract: DOCX Export

- version: 0.1.0
- owner: `export-docx`

## 接口

```ts
function exportDocx(ir: ResumeIR): Promise<Buffer>;
```

## HTTP

| Method | Path | 响应 |
|---|---|---|
| POST | `/api/resumes/:id/export` | `200`，`Content-Type: application/vnd.openxmlformats-officedocument.wordprocessingml.document`，`Content-Disposition: attachment; filename="*.docx"` |

服务端流程：`load resume+profile` → `renderToIR` → `exportDocx` → 返回字节。

## 验收

- Buffer 长度 > 0
- 文件头符合 ZIP/DOCX（`PK\x03\x04`）
- 用 LibreOffice/Word 打开可见姓名与至少一个模块标题（S1 正式证据）

## 明确不做（本版本）

- PDF
- 嵌入宏
- 完美多栏报纸布局
