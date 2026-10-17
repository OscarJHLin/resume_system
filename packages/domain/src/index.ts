/** Domain enums, entities, compatibility matrix, and ResumeIR — no IO. */

/** Experience modules in the content library (not 基本信息). */
export type Category =
  | 'skill'
  | 'project'
  | 'internship'
  | 'campus'
  | 'award'
  | 'custom';

/** Library tabs that create modules (技能已并入基本信息卡). */
export type LibraryModuleCategory =
  | 'project'
  | 'internship'
  | 'campus'
  | 'award'
  | 'custom';

/** Builtin resume sections (profile-driven + placeable). */
export type SectionId =
  | 'basic'
  | 'education'
  | 'skills'
  | 'projects'
  | 'internships'
  | 'campuses'
  | 'awards';

/** Builtin sections that accept drag-drop placements. */
export type BuiltinPlaceableSection =
  | 'projects'
  | 'internships'
  | 'campuses'
  | 'awards';

/**
 * Placement target: builtin placeable section id, or a resume-owned custom
 * section uuid (`resume_custom_section.id`).
 */
export type PlacementSectionId = string;
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
    description: '蓝黑简洁：居中证件照→姓名→应聘岗位→联系；三栏条目',
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

/** category → allowed builtin resume sections (技能/自定义不进此矩阵) */
export const CATEGORY_SECTION_MATRIX: Record<
  Category,
  readonly BuiltinPlaceableSection[]
> = {
  skill: [],
  project: ['projects'],
  internship: ['internships'],
  campus: ['campuses'],
  award: ['awards'],
  custom: [],
};

export function categoryAllowedInSection(
  category: Category,
  section: string,
): boolean {
  if (category === 'custom') return false;
  return (CATEGORY_SECTION_MATRIX[category] as readonly string[]).includes(
    section,
  );
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
  /** 期望薪资 */
  expectedSalary?: string;
  /** 目标城市 */
  targetCity?: string;
  /** 爱好 */
  hobbies?: string;
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

/** User-defined resume section (title + drop zone for `custom` modules). */
export interface ResumeCustomSection {
  id: string;
  title: string;
  sortOrder: number;
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
  /** Builtin placeable section or custom section uuid. */
  section: PlacementSectionId;
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
  /** User-created custom sections on this resume (ordered). */
  customSections: ResumeCustomSection[];
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
  customSections?: ResumeCustomSection[];
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

/**
 * Client-side drop gate before calling POST /placements.
 * Custom modules only land on custom section uuids; builtins keep the matrix.
 * When `customSectionIds` is provided, custom targets must be in that set.
 */
export function decideModuleDrop(
  category: Category,
  section: string,
  customSectionIds?: readonly string[],
): DropDecision {
  if (category === 'custom') {
    if (!isCustomSectionId(section)) return 'reject-section';
    if (customSectionIds && !customSectionIds.includes(section)) {
      return 'reject-section';
    }
    return 'accept';
  }
  if (!isBuiltinPlaceableSection(section)) return 'reject-section';
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
  campuses: '校园经历',
  awards: '获奖与证书',
};

/** Profile-driven section rendered above 教育背景 (not a placeable section). */
export const PERSONAL_STATEMENT_LABEL = '个人陈述';

/** Header line prefix for Profile.summary (stored field; UI label 应聘岗位). */
export const TARGET_ROLE_PREFIX = '应聘岗位：';

/** Builtin experience sections that accept drag-drop placements. */
export const PLACEABLE_SECTIONS: readonly BuiltinPlaceableSection[] = [
  'projects',
  'internships',
  'campuses',
  'awards',
];

/** @deprecated Use `isBuiltinPlaceableSection`. */
export function isPlaceableSection(section: string): boolean {
  return isBuiltinPlaceableSection(section);
}

export function isBuiltinPlaceableSection(
  section: string,
): section is BuiltinPlaceableSection {
  return (PLACEABLE_SECTIONS as readonly string[]).includes(section);
}

/** UUID (any version) — custom section ids are minted as UUIDs. */
const CUSTOM_SECTION_ID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isCustomSectionId(value: string): boolean {
  return CUSTOM_SECTION_ID_RE.test(value);
}

export const CATEGORIES: readonly Category[] = [
  'skill',
  'project',
  'internship',
  'campus',
  'award',
  'custom',
];

export const LIBRARY_MODULE_CATEGORIES: readonly LibraryModuleCategory[] = [
  'project',
  'internship',
  'campus',
  'award',
  'custom',
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
  if (a) return `${formatEduDate(a)} - 至今`;
  if (b) return formatEduDate(b);
  return fallback?.trim() || undefined;
}

const PRESENT_LABEL = '至今';

/**
 * Normalize stored module timeRange for canvas / DOCX.
 * Start-only (no range separator) → `… - 至今`.
 */
export function displayModuleTimeRange(timeRange?: string | null): string {
  if (!timeRange?.trim()) return '';
  const raw = timeRange.trim();
  if (raw.includes(PRESENT_LABEL)) return raw;
  if (/\s*[-–—]\s*/.test(raw)) return raw;
  return `${raw} - ${PRESENT_LABEL}`;
}

/**
 * Award / certificate time is a single point (not a range).
 * Legacy values like `2025.06.01 - 至今` collapse to the first date.
 */
export function displayModuleTimePoint(timeRange?: string | null): string {
  if (!timeRange?.trim()) return '';
  const raw = timeRange.trim();
  const parts = raw.split(/\s*[-–—]\s*/).map((p) => p.trim()).filter(Boolean);
  if (parts.length === 0) return '';
  if (parts.length === 1) return parts[0]!;
  if (parts[1] === PRESENT_LABEL) return parts[0]!;
  return parts[0]!;
}

const LIST_MARKER_RE = /^[0-9一二三四五六七八九十]+$/;

/**
 * Body lines for canvas / DOCX.
 * Always splits on newlines. For `campuses`, also treats `、` as a line break
 * (keeping numbering like `1、` attached to the following clause).
 */
export function moduleBodyLines(
  body: string | null | undefined,
  section: string,
): string[] {
  const raw = body ?? '';
  const paragraphs = raw
    .split(/\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  if (section !== 'campuses') return paragraphs;

  const out: string[] = [];
  for (const paragraph of paragraphs) {
    const parts = paragraph.split('、');
    let pendingMarker = '';
    for (let i = 0; i < parts.length; i++) {
      const part = parts[i] ?? '';
      const trimmed = part.trim();
      if (
        LIST_MARKER_RE.test(trimmed) &&
        i < parts.length - 1 &&
        !pendingMarker
      ) {
        pendingMarker = `${trimmed}、`;
        continue;
      }
      const line = `${pendingMarker}${part}`.trim();
      pendingMarker = '';
      if (line) out.push(line);
    }
    if (pendingMarker) out.push(pendingMarker.replace(/、$/, ''));
  }
  return out;
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
