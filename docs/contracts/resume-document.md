# Contract: Profile & Resume Document

- version: 0.1.1
- owner: `profile` + `resume-assembly`
- decisions: D1（SNAPSHOT）、D2（结构化字段 + 纯文本 body）

## Profile

```ts
interface EducationItem {
  id: string;
  school: string;
  degree?: string;
  major?: string;
  timeRange?: string;
}

interface Profile {
  id: string;
  name: string;
  phone?: string;
  email?: string;
  location?: string;
  summary?: string;       // 应聘岗位（页眉；存 summary 列）
  statement?: string;     // 个人陈述（教育背景之上独立栏）
  education: EducationItem[];
  updatedAt: string;
}
```

栏顺序：个人陈述 → 教育背景 → 技术能力 → 项目经历 → 实习经历 → 获奖与证书。

| Method | Path |
|---|---|
| GET | `/api/profile` |
| PUT | `/api/profile` |

MVP 单用户单 Profile（无登录）。

## ResumeDocument

```ts
type SectionId =
  | 'basic'
  | 'education'
  | 'skills'
  | 'projects'
  | 'internships'
  | 'awards';

/**
 * D1：拖入时从 ContentModule 深拷贝的字段快照。
 * 之后库内模块变更不自动更新本对象。
 * sourceModuleId 仅溯源，非实时外键同步。
 */
interface ModuleSnapshot {
  sourceModuleId: string;
  category: Category;
  title: string;
  subtitle?: string;
  projectType?: string;
  timeRange?: string;
  body: string;             // 纯文本
  tags: string[];           // 快照时的标签副本
  snapshottedAt: string;
}

interface SectionPlacement {
  id: string;
  section: SectionId;
  sortOrder: number;
  snapshot: ModuleSnapshot; // 权威内容在此，不存 live moduleId 外键联表
}

interface ResumeDocument {
  id: string;
  title: string;
  templateId: string; // MVP: "default-v1"
  profileId: string;
  placements: SectionPlacement[];
  updatedAt: string;
}
```

## HTTP（草案）

| Method | Path | 说明 |
|---|---|---|
| GET | `/api/resumes` | 列表 |
| POST | `/api/resumes` | 创建草稿 |
| GET | `/api/resumes/:id` | 详情（含完整 snapshots） |
| PATCH | `/api/resumes/:id` | 更新 title 等 |
| POST | `/api/resumes/:id/placements` | body: `{ section, moduleId }` → 读库模块 → **深拷贝快照** → 追加 |
| PATCH | `/api/resumes/:id/placements/reorder` | body: `{ section, orderedPlacementIds }` |
| DELETE | `/api/resumes/:id/placements/:placementId` | 移除该快照条目 |

`basic` / `education` **不接受** placement；内容来自 Profile。

MVP **不**提供「从库刷新该 placement 快照」接口（可后做）。

## 不变量

- `placements[].snapshot` 含完整结构化字段；渲染/导出只读 snapshot，不回查库内最新模块。
- `placements[].snapshot.category` 必须被 `section` 允许。
- 同一 resume 的 `templateId` MVP 固定 `default-v1`。
- 无 TargetJob / JD 字段或关联。
