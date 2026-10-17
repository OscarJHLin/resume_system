import type { Category, ContentModule } from '@resume/domain';
import {
  formatTimePoint,
  formatTimeRange,
  parseTimePoint,
  parseTimeRange,
  validateTimePoint,
  validateTimeRangeParts,
  type TimeRangeParts,
} from './timeRange';

export interface ModuleFormValues {
  category: Category;
  title: string;
  /** 担任的职责 / 副标题 — optional → API subtitle */
  workstation: string;
  /** 项目类型 / 岗位 — optional */
  projectType: string;
  timeStart: string;
  timeEnd: string;
  body: string;
  /** Comma or newline separated in UI; normalized to tags[] */
  tagsText: string;
}

export interface ModuleFormLabels {
  title: string;
  workstation: string;
  projectType: string;
  time: string;
  body: string;
  tags: string;
  showWorkstation: boolean;
  showProjectType: boolean;
  showTime: boolean;
  /** Awards use a single date; other experience modules use start–end. */
  timeMode: 'range' | 'point';
}

/**
 * Wireframe field mapping for library cards (项目/实习):
 * - 标题 → title
 * - 时间 → timeRange (optional date range)
 * - 担任的职责 → subtitle (optional)
 * - 技术栈 → projectType (plain text; e.g. "Flutter / Riverpod")
 * - 正文 → body
 * - 标签 → tags[]
 * Form order: 大类 → 标题 → 时间 → 担任的职责 → 技术栈 → 正文 → 标签
 */
export function labelsForCategory(category: Category): ModuleFormLabels {
  switch (category) {
    case 'project':
      return {
        title: '标题',
        workstation: '担任的职责（可留空）',
        projectType: '技术栈（可留空）',
        time: '时间（可留空）',
        body: '正文',
        tags: '标签',
        showWorkstation: true,
        showProjectType: true,
        showTime: true,
        timeMode: 'range',
      };
    case 'internship':
      return {
        title: '标题',
        workstation: '部门 / 地点（可留空）',
        projectType: '技术栈 / 岗位（可留空）',
        time: '时间（可留空）',
        body: '正文',
        tags: '标签',
        showWorkstation: true,
        showProjectType: true,
        showTime: true,
        timeMode: 'range',
      };
    case 'campus':
      return {
        title: '社团 / 组织 / 活动',
        workstation: '部门 / 地点（可留空）',
        projectType: '职位 / 角色（可留空）',
        time: '时间（可留空）',
        body: '正文',
        tags: '标签',
        showWorkstation: true,
        showProjectType: true,
        showTime: true,
        timeMode: 'range',
      };
    case 'skill':
      return {
        title: '能力项标题',
        workstation: '补充说明（可留空）',
        projectType: '类型（可留空）',
        time: '时间（可留空）',
        body: '详情正文',
        tags: '标签',
        showWorkstation: false,
        showProjectType: false,
        showTime: false,
        timeMode: 'range',
      };
    case 'award':
      return {
        title: '奖项 / 证书名称',
        workstation: '颁发机构（可留空）',
        projectType: '级别（可留空）',
        time: '获奖时间（可留空）',
        body: '补充说明（可留空）',
        tags: '标签',
        showWorkstation: true,
        showProjectType: true,
        showTime: true,
        timeMode: 'point',
      };
    case 'custom':
      return {
        title: '标题',
        workstation: '',
        projectType: '',
        time: '时间（可留空）',
        body: '正文',
        tags: '标签',
        showWorkstation: false,
        showProjectType: false,
        showTime: true,
        timeMode: 'range',
      };
  }
}

export function emptyForm(category: Category = 'project'): ModuleFormValues {
  return {
    category,
    title: '',
    workstation: '',
    projectType: '',
    timeStart: '',
    timeEnd: '',
    body: '',
    tagsText: '',
  };
}

export function moduleToForm(mod: ContentModule): ModuleFormValues {
  const labels = labelsForCategory(mod.category);
  if (labels.timeMode === 'point') {
    return {
      category: mod.category,
      title: mod.title,
      workstation: mod.subtitle ?? '',
      projectType: mod.projectType ?? '',
      timeStart: parseTimePoint(mod.timeRange),
      timeEnd: '',
      body: mod.body,
      tagsText: mod.tags.join(', '),
    };
  }
  const t = parseTimeRange(mod.timeRange);
  return {
    category: mod.category,
    title: mod.title,
    workstation: mod.subtitle ?? '',
    projectType: mod.projectType ?? '',
    timeStart: t.start,
    timeEnd: t.end,
    body: mod.body,
    tagsText: mod.tags.join(', '),
  };
}

export function parseTagsText(text: string): string[] {
  return text
    .split(/[,，\n]/)
    .map((t) => t.trim())
    .filter(Boolean);
}

export interface ModuleFormPayload {
  category: Category;
  title: string;
  subtitle?: string;
  projectType?: string;
  timeRange?: string;
  body: string;
  tags: string[];
}

export function validateModuleForm(
  values: ModuleFormValues,
): { ok: true; payload: ModuleFormPayload } | { ok: false; error: string } {
  const title = values.title.trim();
  if (!title) {
    return { ok: false, error: '标题为必填项' };
  }
  const labels = labelsForCategory(values.category);
  let timeRange: string | undefined;
  if (labels.showTime) {
    if (labels.timeMode === 'point') {
      const timeErr = validateTimePoint(values.timeStart);
      if (timeErr) return { ok: false, error: timeErr };
      timeRange = formatTimePoint(values.timeStart);
    } else {
      const timeParts: TimeRangeParts = {
        start: values.timeStart,
        end: values.timeEnd,
      };
      const timeErr = validateTimeRangeParts(timeParts);
      if (timeErr) return { ok: false, error: timeErr };
      timeRange = formatTimeRange(timeParts);
    }
  }

  const workstation = values.workstation.trim();
  const projectType = values.projectType.trim();

  return {
    ok: true,
    payload: {
      category: values.category,
      title,
      subtitle:
        labels.showWorkstation && workstation ? workstation : undefined,
      projectType:
        labels.showProjectType && projectType ? projectType : undefined,
      timeRange,
      body: values.body, // may be empty string
      tags: parseTagsText(values.tagsText),
    },
  };
}
