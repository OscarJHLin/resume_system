import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { SectionId, TemplateMeta, TextStyle } from '@resume/domain';
import { DEFAULT_TEMPLATE_ID } from '@resume/domain';

export interface TemplatePageSpec {
  width: number;
  height: number;
  margin: { top: number; right: number; bottom: number; left: number };
}

export interface TemplateStyles {
  name: TextStyle;
  tagline: TextStyle;
  contact: TextStyle;
  sectionHeading: TextStyle;
  entryTitle: TextStyle;
  /** projectType / tech stack — typically one size smaller + italic. */
  entryTech: TextStyle;
  entryMeta: TextStyle;
  skillLine: TextStyle;
  body: TextStyle;
}

export interface TemplatePhotoSpec {
  placement: 'above-name-center' | 'header-right';
  widthPx: number;
  heightPx: number;
}

export interface TemplateLayoutSpec {
  entryTabCenter: number;
  internshipTabCenter: number;
  entryTabRight: number;
  bulletIndent: { left: number; hanging: number };
}

export interface TemplateDefinition {
  id: string;
  slug: string;
  displayName: string;
  version: string;
  description: string;
  photoInTemplate: boolean;
  photo?: TemplatePhotoSpec;
  layout: TemplateLayoutSpec;
  sectionOrder: SectionId[];
  page: TemplatePageSpec;
  styles: TemplateStyles;
}

interface ManifestFile {
  id: string;
  slug: string;
  displayName: string;
  version: string;
  description?: string;
  photoInTemplate: boolean;
  photo?: TemplatePhotoSpec;
  layout?: Partial<TemplateLayoutSpec>;
  sectionOrder: SectionId[];
  page: TemplatePageSpec;
  styles: Omit<TemplateStyles, 'entryTech'> & { entryTech?: TextStyle };
}

const DEFAULT_LAYOUT: TemplateLayoutSpec = {
  entryTabCenter: 4933,
  internshipTabCenter: 6520,
  entryTabRight: 9866,
  bulletIndent: { left: 340, hanging: 228 },
};

const SECTION_IDS = new Set<SectionId>([
  'basic',
  'education',
  'skills',
  'projects',
  'internships',
  'awards',
]);

let cache: Map<string, TemplateDefinition> | null = null;
let templatesDirResolved: string | null = null;

/** Repo root: …/resume_system (walks up from this file or cwd). */
export function resolveTemplatesDir(
  override: string | undefined = process.env.RESUME_TEMPLATES_DIR,
): string {
  if (override?.trim()) return path.resolve(override.trim());
  if (templatesDirResolved) return templatesDirResolved;

  const candidates: string[] = [];
  try {
    const here = path.dirname(fileURLToPath(import.meta.url));
    // apps/server/src/modules/template → repo root
    candidates.push(path.resolve(here, '../../../../../templates'));
  } catch {
    /* ignore */
  }
  candidates.push(path.resolve(process.cwd(), 'templates'));
  candidates.push(path.resolve(process.cwd(), '../../templates'));

  for (const dir of candidates) {
    if (fs.existsSync(dir) && fs.statSync(dir).isDirectory()) {
      templatesDirResolved = dir;
      return dir;
    }
  }
  templatesDirResolved = path.resolve(process.cwd(), 'templates');
  return templatesDirResolved;
}

function validateManifest(raw: unknown, folder: string): ManifestFile {
  if (!raw || typeof raw !== 'object') {
    throw new Error(`Invalid manifest in ${folder}`);
  }
  const m = raw as ManifestFile;
  if (!m.id?.trim()) throw new Error(`manifest missing id: ${folder}`);
  if (!m.slug?.trim()) throw new Error(`manifest missing slug: ${folder}`);
  if (!m.displayName?.trim()) {
    throw new Error(`manifest missing displayName: ${folder}`);
  }
  if (!m.version?.trim()) throw new Error(`manifest missing version: ${folder}`);
  if (!m.page?.width || !m.styles?.name) {
    throw new Error(`manifest incomplete page/styles: ${folder}`);
  }
  if (!Array.isArray(m.sectionOrder) || m.sectionOrder.length === 0) {
    throw new Error(`manifest sectionOrder empty: ${folder}`);
  }
  for (const s of m.sectionOrder) {
    if (!SECTION_IDS.has(s)) {
      throw new Error(`unknown sectionOrder entry "${s}" in ${folder}`);
    }
  }
  return m;
}

export function loadTemplateRegistry(
  templatesDir: string = resolveTemplatesDir(),
): Map<string, TemplateDefinition> {
  const map = new Map<string, TemplateDefinition>();
  if (!fs.existsSync(templatesDir)) {
    throw new Error(`templates directory missing: ${templatesDir}`);
  }
  for (const name of fs.readdirSync(templatesDir)) {
    const folder = path.join(templatesDir, name);
    if (!fs.statSync(folder).isDirectory()) continue;
    const manifestPath = path.join(folder, 'manifest.json');
    if (!fs.existsSync(manifestPath)) continue;
    const raw = JSON.parse(fs.readFileSync(manifestPath, 'utf8')) as unknown;
    const m = validateManifest(raw, folder);
    if (map.has(m.id)) {
      throw new Error(`duplicate template id "${m.id}" in ${folder}`);
    }
    map.set(m.id, {
      id: m.id,
      slug: m.slug,
      displayName: m.displayName,
      version: m.version,
      description: m.description ?? '',
      photoInTemplate: Boolean(m.photoInTemplate),
      photo: m.photo,
      layout: {
        ...DEFAULT_LAYOUT,
        ...(m.layout ?? {}),
        bulletIndent: {
          ...DEFAULT_LAYOUT.bulletIndent,
          ...(m.layout?.bulletIndent ?? {}),
        },
      },
      sectionOrder: m.sectionOrder,
      page: m.page,
      styles: {
        ...m.styles,
        entryTech:
          m.styles.entryTech ?? {
            bold: false,
            italic: true,
            fontSizePt: Math.max(
              8,
              (m.styles.entryMeta?.fontSizePt ?? 10.5) - 1,
            ),
            fontEastAsia: m.styles.entryMeta?.fontEastAsia ?? '宋体',
          },
      },
    });
  }
  if (map.size === 0) {
    throw new Error(`no template manifests found under ${templatesDir}`);
  }
  if (!map.has(DEFAULT_TEMPLATE_ID)) {
    throw new Error(
      `default template id "${DEFAULT_TEMPLATE_ID}" missing under ${templatesDir}`,
    );
  }
  cache = map;
  return map;
}

export function getTemplateRegistry(): Map<string, TemplateDefinition> {
  if (!cache) return loadTemplateRegistry();
  return cache;
}

/** Reset cache (tests). */
export function resetTemplateRegistryCache(): void {
  cache = null;
  templatesDirResolved = null;
}

export function getTemplate(id: string): TemplateDefinition | undefined {
  return getTemplateRegistry().get(id);
}

export function listTemplateMeta(): TemplateMeta[] {
  return [...getTemplateRegistry().values()].map((t) => ({
    id: t.id,
    label: t.displayName,
    description: t.description,
  }));
}

export function isRegisteredTemplateId(id: string): boolean {
  return getTemplateRegistry().has(id);
}
