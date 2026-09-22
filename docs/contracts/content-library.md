# Contract: Content Library

- version: 0.2.0
- owner: `content-library`
- decisions: D2（纯文本 + 结构化字段）、D4（标签检索，无 JD）

## Category ↔ Section 兼容矩阵

| Category | 允许落入的 SectionId |
|---|---|
| `skill` | （已弃用拖放；技术能力改由 Profile.skills） |
| `project` | `projects` |
| `internship` | `internships` |
| `award` | `awards` |

工作台库标签仅：`项目` / `实习` / `获奖与证书` / `基本信息`。

## 资源：ContentModule

字段必须分离存储与读写；**禁止**用单一 Markdown/HTML blob 承载标题+时间+正文。

```ts
type Category = 'skill' | 'project' | 'internship' | 'award';

interface ContentModule {
  id: string;
  category: Category;
  title: string;
  subtitle?: string;
  projectType?: string;
  timeRange?: string;
  body: string;
  tags: string[];
  createdAt: string;
  updatedAt: string;
}
```

## 资源：Profile（基本信息卡，可多张）

必填：`name` / `gender`（男|女）/ `email` / `phone` / `wechat`  
选填：`qq` / `location` / `summary`（标语）/ `statement`（个人陈述）/ `photo` / `tags` / `notes`  
嵌套：`education[]`（学校、学历〔小学/中专/高中/大专/本科/双学位/硕士/博士/其他〕、专业、起止、GPA、排名、课程）、`skills[]`（标题加粗 + 正文）

| Method | Path | 说明 |
|---|---|---|
| GET | `/api/profiles?q=&tag=` | 列表 |
| POST | `/api/profiles` | 创建（校验必填） |
| PUT | `/api/profiles/:id` | 更新 |
| DELETE | `/api/profiles/:id` | 删除；简历 profileId 置空 |
| PUT/GET/DELETE | `/api/profiles/:id/photo` | 照片存档（导出不含） |

## HTTP：Modules

| Method | Path | 说明 |
|---|---|---|
| GET | `/api/modules?category=&q=&tag=` | 检索 |
| POST/PUT/DELETE | `/api/modules…` | CRUD |

落库时服务端按 `moduleId` 读取模块并生成 **ModuleSnapshot**；payload 本身不是权威内容。
