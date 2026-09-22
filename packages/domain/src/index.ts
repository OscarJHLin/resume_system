/** Domain enums, entities, compatibility matrix, and ResumeIR — no IO. */

export type Category = 'skill' | 'project' | 'internship' | 'award';

export type SectionId =
  | 'basic'
  | 'education'
  | 'skills'
  | 'projects'
  | 'internships'
  | 'awards';

export const DEFAULT_TEMPLATE_ID = 'default-v1' as const;

export type TemplateId = typeof DEFAULT_TEMPLATE_ID;

/** category → allowed resume sections */
export const CATEGORY_SECTION_MATRIX: Record<Category, readonly SectionId[]> = {
  skill: ['skills'],
  project: ['projects'],
  internship: ['internships'],
  award: ['awards'],
};

export function categoryAllowedInSection(
  category: Category,
  section: SectionId,
): boolean {
  return CATEGORY_SECTION_MATRIX[category].includes(section);
}

export interface EducationItem {
  id: string;
  school: string;
  degree?: string;
  major?: string;
  timeRange?: string;
}

export interface Profile {
  id: string;
  name: string;
  phone?: string;
  email?: string;
  location?: string;
  summary?: string;
  education: EducationItem[];
  /** True when a local photo file is stored for this profile. */
  hasPhoto?: boolean;
  updatedAt: string;
}

export interface ContentModule {
  id: string;
  category: Category;
  title: string;
  subtitle?: string;
  projectType?: string;
  timeRange?: string;
  /** Plain text only (newlines OK). Not Markdown/HTML. */
  body: string;
  /** User-maintained tags — primary retrieval (no JD entity). */
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

/**
 * Deep copy taken when a module is placed on a resume (D1).
 * Library edits do not mutate existing snapshots.
 * `sourceModuleId` is provenance only — not a live sync FK.
 */
export interface ModuleSnapshot {
  sourceModuleId: string;
  category: Category;
  title: string;
  subtitle?: string;
  projectType?: string;
  timeRange?: string;
  /** Plain text snapshot of body. */
  body: string;
  tags: string[];
  snapshottedAt: string;
}

export interface SectionPlacement {
  id: string;
  section: SectionId;
  sortOrder: number;
  snapshot: ModuleSnapshot;
}

export interface ResumeDocument {
  id: string;
  title: string;
  templateId: TemplateId;
  profileId: string;
  placements: SectionPlacement[];
  updatedAt: string;
}

export interface TextStyle {
  bold?: boolean;
  fontSizePt?: number;
  italic?: boolean;
  /** CJK face hint from template (e.g. 黑体 / 宋体). */
  fontEastAsia?: string;
}

export interface IrRun {
  text: string;
  style?: TextStyle;
}

export interface IrParagraph {
  kind: 'paragraph';
  runs: IrRun[];
  spacingAfterPt?: number;
  spacingBeforePt?: number;
  alignment?: 'left' | 'center' | 'right';
  /** Resume body bullet (hanging indent). */
  bullet?: boolean;
  /**
   * Three-column entry row (title | meta | time) using tab stops,
   * matching reference DOCX ResumeEntry layout.
   */
  entryTabs?: boolean;
}

export interface IrHeading {
  kind: 'heading';
  level: 1 | 2 | 3;
  runs: IrRun[];
  alignment?: 'left' | 'center' | 'right';
  spacingBeforePt?: number;
  spacingAfterPt?: number;
  /** Section underline rule (reference Heading1 bottom border). */
  borderBottom?: boolean;
}

export type IrBlock = IrHeading | IrParagraph;

export interface ResumeIR {
  templateId: string;
  templateVersion: string;
  blocks: IrBlock[];
  meta: {
    title: string;
    generatedAt: string;
  };
}

export interface RenderInput {
  templateId: TemplateId;
  profile: Profile;
  placements: SectionPlacement[];
}

/** Drag payload MIME for library → editor */
export const MODULE_DRAG_MIME = 'application/x-resume-module';

export interface ModuleDragPayload {
  moduleId: string;
  category: Category;
}

export function serializeModuleDragPayload(payload: ModuleDragPayload): string {
  return JSON.stringify(payload);
}

export function parseModuleDragPayload(raw: string): ModuleDragPayload | null {
  try {
    const data = JSON.parse(raw) as Partial<ModuleDragPayload>;
    if (
      typeof data.moduleId !== 'string' ||
      !data.moduleId ||
      typeof data.category !== 'string' ||
      !isCategory(data.category)
    ) {
      return null;
    }
    return { moduleId: data.moduleId, category: data.category };
  } catch {
    return null;
  }
}

export type DropDecision = 'accept' | 'reject-section' | 'reject-category';

/** Client-side drop gate before calling POST /placements. */
export function decideModuleDrop(
  category: Category,
  section: SectionId,
): DropDecision {
  if (!isPlaceableSection(section)) return 'reject-section';
  if (!categoryAllowedInSection(category, section)) return 'reject-category';
  return 'accept';
}

/** Deep-copy ContentModule fields into a placement snapshot (D1). */
export function snapshotFromModule(
  mod: ContentModule,
  snapshottedAt: string = new Date().toISOString(),
): ModuleSnapshot {
  return {
    sourceModuleId: mod.id,
    category: mod.category,
    title: mod.title,
    subtitle: mod.subtitle,
    projectType: mod.projectType,
    timeRange: mod.timeRange,
    body: mod.body,
    tags: [...mod.tags],
    snapshottedAt,
  };
}

export const SECTION_LABELS: Record<SectionId, string> = {
  basic: '基本信息',
  education: '教育背景',
  skills: '技术能力',
  projects: '项目经历',
  internships: '实习经历',
  awards: '获奖与证书',
};

export const PLACEABLE_SECTIONS: readonly SectionId[] = [
  'skills',
  'projects',
  'internships',
  'awards',
];

export function isPlaceableSection(section: SectionId): boolean {
  return (PLACEABLE_SECTIONS as readonly string[]).includes(section);
}

export const CATEGORIES: readonly Category[] = [
  'skill',
  'project',
  'internship',
  'award',
];

export function isCategory(value: string): value is Category {
  return (CATEGORIES as readonly string[]).includes(value);
}

export function isSectionId(value: string): value is SectionId {
  return value in SECTION_LABELS;
}
