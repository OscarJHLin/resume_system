/** Domain enums, entities, compatibility matrix, and ResumeIR — no IO. */

/** Experience modules in the content library (not 基本信息). */
export type Category = 'skill' | 'project' | 'internship' | 'award';

/** Library tabs that create modules (技能已并入基本信息卡). */
export type LibraryModuleCategory = 'project' | 'internship' | 'award';

export type SectionId =
  | 'basic'
  | 'education'
  | 'skills'
  | 'projects'
  | 'internships'
  | 'awards';

export const DEFAULT_TEMPLATE_ID = 'default-v1' as const;

/** Template ids are stable strings (see templates/<slug>/manifest.json). */
export type TemplateId = string;

export interface TemplateMeta {
  id: TemplateId;
  label: string;
  description: string;
}

/**
 * Fallback meta when API is unavailable. Runtime source of truth is
 * templates/<slug>/manifest.json loaded by the server (docs/07-template-packs.md).
 */
export const TEMPLATES: readonly TemplateMeta[] = [
  {
    id: DEFAULT_TEMPLATE_ID,
    label: '蓝黑简洁简历',
    description: '对齐参考简历模板：居中证件照→姓名→应聘岗位→联系；三栏条目',
  },
] as const;

export type Gender = '男' | '女';

export type DegreeOption =
  | '小学'
  | '中专'
  | '高中'
  | '大专'
  | '本科'
  | '双学位'
  | '硕士'
  | '博士'
  | '其他';

export const GENDERS: readonly Gender[] = ['男', '女'];

export const DEGREE_OPTIONS: readonly DegreeOption[] = [
  '小学',
  '中专',
  '高中',
  '大专',
  '本科',
  '双学位',
  '硕士',
  '博士',
  '其他',
];

/** category → allowed resume sections (技能由 Profile.skills 渲染，不可拖放) */
export const CATEGORY_SECTION_MATRIX: Record<Category, readonly SectionId[]> = {
  skill: [],
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
  /** ISO date YYYY-MM-DD or empty */
  startDate?: string;
  endDate?: string;
  /** Display range; derived from start/end when present */
  timeRange?: string;
  gpa?: string;
  /** e.g. 专业前 5% */
  rank?: string;
  courses?: string;
}

/** Skill block under 基本信息 — title bold on resume, body as detail. */
export interface SkillBlock {
  id: string;
  title: string;
  body: string;
}

/**
 * Storable 基本信息 card (multi-profile).
 * Required identity: name, gender, email, phone, wechat.
 */
export interface Profile {
  id: string;
  name: string;
  gender?: Gender | '';
  phone?: string;
  email?: string;
  wechat?: string;
  /** Optional */
  qq?: string;
  location?: string;
  /** 应聘岗位 — short target role under the name (stored as summary). */
  summary?: string;
  /** 个人陈述 — plain-text advantage statement shown as its own section. */
  statement?: string;
  education: EducationItem[];
  skills: SkillBlock[];
  tags: string[];
  notes?: string;
  /** True when a local photo file is stored for this profile card. */
  hasPhoto?: boolean;
  createdAt: string;
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
  /** Applied 基本信息 card id; empty string = none (placeholders on canvas). */
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
   * Three-column entry row (title | meta | time) using tab stops.
   * When true, uses default center tab; or pass center position in twips
   * (education/projects: 4933; internships: 6520 in the reference DOCX).
   */
  entryTabs?: boolean | number;
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

/** Profile-driven section rendered above 教育背景 (not a placeable section). */
export const PERSONAL_STATEMENT_LABEL = '个人陈述';

/** Header line prefix for Profile.summary (stored field; UI label 应聘岗位). */
export const TARGET_ROLE_PREFIX = '应聘岗位：';

/** Experience sections that accept drag-drop placements. */
export const PLACEABLE_SECTIONS: readonly SectionId[] = [
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

export const LIBRARY_MODULE_CATEGORIES: readonly LibraryModuleCategory[] = [
  'project',
  'internship',
  'award',
];

export function isCategory(value: string): value is Category {
  return (CATEGORIES as readonly string[]).includes(value);
}

export function isLibraryModuleCategory(
  value: string,
): value is LibraryModuleCategory {
  return (LIBRARY_MODULE_CATEGORIES as readonly string[]).includes(value);
}

export function isSectionId(value: string): value is SectionId {
  return value in SECTION_LABELS;
}

export function isGender(value: string): value is Gender {
  return (GENDERS as readonly string[]).includes(value);
}

export function isDegreeOption(value: string): value is DegreeOption {
  return (DEGREE_OPTIONS as readonly string[]).includes(value);
}

export function isTemplateId(value: string): value is TemplateId {
  return typeof value === 'string' && /^[a-z][a-z0-9._-]*$/i.test(value.trim());
}

/** Build display timeRange from optional date pickers. */
export function educationTimeRange(
  startDate?: string,
  endDate?: string,
  fallback?: string,
): string | undefined {
  const a = startDate?.trim();
  const b = endDate?.trim();
  if (a && b) return `${formatEduDate(a)} - ${formatEduDate(b)}`;
  if (a) return formatEduDate(a);
  if (b) return formatEduDate(b);
  return fallback?.trim() || undefined;
}

function formatEduDate(iso: string): string {
  // YYYY-MM-DD → YYYY.MM ; YYYY-MM → YYYY.MM
  const m = iso.match(/^(\d{4})-(\d{2})(?:-(\d{2}))?/);
  if (m) return `${m[1]}.${m[2]}`;
  return iso;
}

export interface ProfileRequiredFields {
  name: string;
  gender: string;
  email: string;
  phone: string;
  wechat: string;
}

/** Validate required identity fields for a 基本信息 card. */
export function validateProfileRequired(
  input: Partial<ProfileRequiredFields>,
): { ok: true } | { ok: false; error: string } {
  if (!input.name?.trim()) return { ok: false, error: '姓名为必填项' };
  if (!input.gender?.trim() || !isGender(input.gender.trim())) {
    return { ok: false, error: '性别为必填项（男/女）' };
  }
  if (!input.email?.trim()) return { ok: false, error: '邮箱为必填项' };
  if (!input.phone?.trim()) return { ok: false, error: '手机号为必填项' };
  if (!input.wechat?.trim()) return { ok: false, error: '微信号为必填项' };
  return { ok: true };
}

/** Empty education row for guided forms. */
export function emptyEducationItem(id = ''): EducationItem {
  return {
    id,
    school: '',
    degree: '本科',
    major: '',
    startDate: '',
    endDate: '',
    timeRange: '',
    gpa: '',
    rank: '',
    courses: '',
  };
}

/** Empty skill block for guided forms. */
export function emptySkillBlock(id = ''): SkillBlock {
  return { id, title: '', body: '' };
}
