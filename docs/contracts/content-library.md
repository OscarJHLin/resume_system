# Contract: Content Library

- version: 0.1.1
- owner: `content-library`
- decisions: D2（纯文本 + 结构化字段）、D4（标签检索，无 JD）

## Category ↔ Section 兼容矩阵

| Category | 允许落入的 SectionId |
|---|---|
| `skill` | `skills` |
| `project` | `projects` |
| `internship` | `internships` |
| `award` | `awards`（MVP UI 可隐藏） |

其它组合必须拒绝（API 400 / 前端 drop 拒绝）。

## 资源：ContentModule

字段必须分离存储与读写；**禁止**用单一 Markdown/HTML blob 承载标题+时间+正文。

```ts
type Category = 'skill' | 'project' | 'internship' | 'award';

interface ContentModule {
  id: string;
  category: Category;
  title: string;            // 结构化：标题
  subtitle?: string;        // 结构化：副标题 / 工作站·基础站（可留空）
  projectType?: string;     // 结构化：项目类型 / 岗位（可留空）
  timeRange?: string;       // 结构化：时间；表单用日期选择器，可留空；存 `YYYY.MM.DD` 或起止
  body: string;             // 纯文本正文（保留 \n；非 MD / 非 HTML）
  tags: string[];           // 用户维护的多标签；检索主入口
  createdAt: string;        // ISO
  updatedAt: string;
}
```

### 标签（D4）

- 用户在撰写/编辑经历后可为模块添加**多个** tags。
- 检索：`tag`（精确/包含）与可选 `q`（匹配 title/body/tags 文本）。
- **不提供** TargetJob / JD 资源或「按 JD 匹配」API。
- 关联推荐检索属未来增强，不在本版本合同。

## HTTP（草案）

| Method | Path | 说明 |
|---|---|---|
| GET | `/api/modules?category=&q=&tag=` | 检索；`tag` 过滤标签；`q` 匹配 title/body/tags |
| GET | `/api/modules/:id` | 详情 |
| POST | `/api/modules` | 创建（含 tags[]） |
| PUT | `/api/modules/:id` | 全量更新（含 tags[]） |
| DELETE | `/api/modules/:id` | 删除库内模块；**不**级联删除已写入简历的快照 |

### 错误

- `400` 校验失败（缺 title、非法 category、body 非字符串等）
- `404` 不存在
- `409` 预留（并发版本）

## DnD Payload（前端）

```ts
// MIME: application/x-resume-module
interface ModuleDragPayload {
  moduleId: string;
  category: Category;
}
```

落库时服务端按 `moduleId` 读取模块并生成 **ModuleSnapshot**（见 resume-document 合同）；payload 本身不是权威内容。
