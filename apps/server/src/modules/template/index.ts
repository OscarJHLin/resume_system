import type {
  IrBlock,
  IrParagraph,
  ModuleSnapshot,
  Profile,
  RenderInput,
  ResumeIR,
  SectionId,
  SectionPlacement,
  TextStyle,
} from '@resume/domain';
import { DEFAULT_TEMPLATE_ID, SECTION_LABELS } from '@resume/domain';
import {
  getTemplate,
  type TemplateDefinition,
  type TemplateStyles,
} from './registry.js';

/**
 * Template-driven IR renderer. Typography and section order come from
 * templates/<slug>/manifest.json (see docs/07-template-packs.md).
 * Photo column: shown on canvas/DOCX when the applied profile has a photo
 * (manifest photoInTemplate documents that the pack supports portraits).
 */
export class UnknownTemplateError extends Error {
  constructor(templateId: string) {
    super(`Unknown template: ${templateId}`);
    this.name = 'UnknownTemplateError';
  }
}

export function renderToIR(
  input: RenderInput,
  clock: () => string = () => new Date().toISOString(),
): ResumeIR {
  const def = getTemplate(input.templateId);
  if (!def) {
    throw new UnknownTemplateError(input.templateId);
  }

  const STYLE = def.styles;
  const blocks: IrBlock[] = [];
  const { profile, placements } = input;

  blocks.push({
    kind: 'heading',
    level: 1,
    alignment: 'center',
    spacingAfterPt: 6,
    runs: [{ text: profile.name || '姓名', style: STYLE.name }],
  });

  if (profile.summary?.trim()) {
    blocks.push(
      para([{ text: profile.summary.trim(), style: STYLE.tagline }], {
        alignment: 'center',
        spacingAfterPt: 4,
      }),
    );
  }

  const contact = [
    profile.location,
    profile.phone,
    profile.email,
    profile.wechat ? `微信: ${profile.wechat}` : undefined,
  ]
    .filter(Boolean)
    .join(' | ');
  if (contact) {
    blocks.push(
      para([{ text: contact, style: STYLE.contact }], {
        alignment: 'center',
        spacingAfterPt: 0,
      }),
    );
  }

  if (profile.education.length > 0) {
    blocks.push(sectionHeading(SECTION_LABELS.education, STYLE));
    for (const edu of profile.education) {
      const major = [edu.degree, edu.major].filter(Boolean).join(' · ');
      blocks.push(
        entryLine(
          STYLE,
          edu.school || '学校',
          major || undefined,
          edu.timeRange,
          { spacingAfterPt: 0.8 },
        ),
      );
      const detail = [
        edu.gpa ? `GPA：${edu.gpa}` : null,
        edu.rank ? edu.rank : null,
        edu.courses ? `课程：${edu.courses}` : null,
      ]
        .filter(Boolean)
        .join('；');
      if (detail) {
        blocks.push(
          para([{ text: detail, style: STYLE.body }], {
            spacingAfterPt: 0.8,
            bullet: true,
          }),
        );
      }
    }
  }

  if (profile.skills.length > 0) {
    blocks.push(sectionHeading(SECTION_LABELS.skills, STYLE));
    for (const skill of profile.skills) {
      const line = skill.body.trim()
        ? `${skill.title}：${skill.body.trim().replace(/\n/g, '；')}`
        : skill.title;
      if (!line.trim()) continue;
      blocks.push(
        para([{ text: line, style: STYLE.skillLine }], {
          spacingAfterPt: 0.4,
          bullet: true,
        }),
      );
    }
  }

  for (const section of def.sectionOrder) {
    if (section === 'skills') continue;
    const items = placements
      .filter((p) => p.section === section)
      .sort((a, b) => a.sortOrder - b.sortOrder);
    if (items.length === 0) continue;

    blocks.push(sectionHeading(SECTION_LABELS[section], STYLE));
    for (const item of items) {
      blocks.push(...renderSnapshot(STYLE, item, section));
    }
  }

  return {
    templateId: def.id,
    templateVersion: def.version,
    blocks,
    meta: {
      title: profile.name || 'resume',
      generatedAt: clock(),
    },
  };
}

function sectionHeading(text: string, STYLE: TemplateStyles): IrBlock {
  return {
    kind: 'heading',
    level: 2,
    borderBottom: true,
    spacingBeforePt: 10,
    spacingAfterPt: 6,
    runs: [{ text, style: STYLE.sectionHeading }],
  };
}

function renderSnapshot(
  STYLE: TemplateStyles,
  placement: SectionPlacement,
  section: SectionId,
): IrBlock[] {
  const s: ModuleSnapshot = placement.snapshot;
  const out: IrBlock[] = [];

  if (section === 'awards') {
    const line = [s.title, s.timeRange, s.body.trim()]
      .filter(Boolean)
      .join('，');
    out.push(
      para([{ text: line, style: STYLE.body }], {
        spacingAfterPt: 0.8,
        bullet: true,
      }),
    );
    return out;
  }

  const meta = [s.subtitle, s.projectType].filter(Boolean).join(' · ');
  out.push(
    entryLine(STYLE, s.title, meta || undefined, s.timeRange, {
      spacingAfterPt: 0.8,
      spacingBeforePt: placement.sortOrder > 0 ? 6.5 : 0,
    }),
  );

  if (s.body.trim()) {
    for (const line of s.body.split(/\n/).map((l) => l.trim()).filter(Boolean)) {
      out.push(
        para([{ text: line, style: STYLE.body }], {
          spacingAfterPt: 0.8,
          bullet: true,
        }),
      );
    }
  }

  return out;
}

function entryLine(
  STYLE: TemplateStyles,
  title: string,
  middle: string | undefined,
  time: string | undefined,
  opts: { spacingAfterPt?: number; spacingBeforePt?: number } = {},
): IrParagraph {
  const runs: IrParagraph['runs'] = [
    { text: title, style: STYLE.entryTitle },
  ];
  if (middle || time) {
    runs.push({ text: '\t', style: STYLE.entryMeta });
    runs.push({ text: middle ?? '', style: STYLE.entryMeta });
  }
  if (time) {
    runs.push({ text: '\t', style: STYLE.entryMeta });
    runs.push({ text: time, style: STYLE.entryMeta });
  }
  return para(runs, {
    spacingAfterPt: opts.spacingAfterPt,
    spacingBeforePt: opts.spacingBeforePt,
    entryTabs: true,
  });
}

function para(
  runs: IrParagraph['runs'],
  opts: {
    spacingAfterPt?: number;
    spacingBeforePt?: number;
    alignment?: IrParagraph['alignment'];
    bullet?: boolean;
    entryTabs?: boolean;
  } = {},
): IrParagraph {
  return {
    kind: 'paragraph',
    runs,
    spacingAfterPt: opts.spacingAfterPt,
    spacingBeforePt: opts.spacingBeforePt,
    alignment: opts.alignment,
    bullet: opts.bullet,
    entryTabs: opts.entryTabs,
  };
}

/** Exported for tests — probe default pack styles from registry. */
export function styleProbeFor(
  templateId: string = DEFAULT_TEMPLATE_ID,
): {
  namePt: number;
  sectionPt: number;
  bodyPt: number;
  contactPt: number;
  heiti: string;
  song: string;
  sectionOrder: readonly SectionId[];
  photoInTemplate: boolean;
} {
  const def = requireTemplate(templateId);
  return {
    namePt: def.styles.name.fontSizePt ?? 0,
    sectionPt: def.styles.sectionHeading.fontSizePt ?? 0,
    bodyPt: def.styles.body.fontSizePt ?? 0,
    contactPt: def.styles.contact.fontSizePt ?? 0,
    heiti: def.styles.name.fontEastAsia ?? '',
    song: def.styles.body.fontEastAsia ?? '',
    sectionOrder: def.sectionOrder,
    photoInTemplate: def.photoInTemplate,
  };
}

/** @deprecated use styleProbeFor — kept for existing tests */
export const LIN_V1_STYLE_PROBE = new Proxy(
  {} as ReturnType<typeof styleProbeFor>,
  {
    get(_t, prop) {
      return styleProbeFor(DEFAULT_TEMPLATE_ID)[
        prop as keyof ReturnType<typeof styleProbeFor>
      ];
    },
  },
);

function requireTemplate(id: string): TemplateDefinition {
  const def = getTemplate(id);
  if (!def) throw new UnknownTemplateError(id);
  return def;
}

/** Placeholder profile when resume has no applied 基本信息 card. */
export function placeholderProfile(): Profile {
  return {
    id: '',
    name: '',
    gender: '',
    education: [],
    skills: [],
    tags: [],
    createdAt: '',
    updatedAt: '',
  };
}

/** Re-export TextStyle for callers that need style typing. */
export type { TextStyle };
