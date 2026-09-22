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
import {
  DEFAULT_TEMPLATE_ID,
  PERSONAL_STATEMENT_LABEL,
  SECTION_LABELS,
  TARGET_ROLE_PREFIX,
} from '@resume/domain';
import {
  getTemplate,
  type TemplateDefinition,
  type TemplateStyles,
} from './registry.js';

/**
 * Template-driven IR renderer. Typography / tabs / photo placement come from
 * templates/<slug>/manifest.json (see docs/07-template-packs.md).
 * Blue-black-simple: centered photo above name,
 * three-column entry tabs, skill/body lines without auto bullets.
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
  const layout = def.layout;
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
      para(
        [
          { text: TARGET_ROLE_PREFIX, style: STYLE.tagline },
          {
            text: profile.summary.trim(),
            style: { ...STYLE.tagline, bold: false },
          },
        ],
        {
          alignment: 'center',
          spacingAfterPt: 4,
        },
      ),
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

  if (profile.statement?.trim()) {
    blocks.push(sectionHeading(PERSONAL_STATEMENT_LABEL, STYLE));
    for (const line of profile.statement
      .split(/\n/)
      .map((l) => l.trim())
      .filter(Boolean)) {
      blocks.push(
        para([{ text: line, style: STYLE.body }], {
          spacingAfterPt: 0.8,
        }),
      );
    }
  }

  if (profile.education.length > 0) {
    blocks.push(sectionHeading(SECTION_LABELS.education, STYLE));
    for (const edu of profile.education) {
      const major = [edu.degree, edu.major].filter(Boolean).join(' · ');
      blocks.push(
        entryLine(
          STYLE,
          edu.school || '学校',
          { text: major || undefined },
          edu.timeRange,
          {
            spacingAfterPt: 0.8,
            entryTabCenter: layout.entryTabCenter,
          },
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
          }),
        );
      }
    }
  }

  if (profile.skills.length > 0) {
    blocks.push(sectionHeading(SECTION_LABELS.skills, STYLE));
    for (const skill of profile.skills) {
      const title = skill.title.trim();
      const body = skill.body.trim().replace(/\n/g, '；');
      if (!title && !body) continue;
      const runs =
        title && body
          ? [
              { text: `${title}：`, style: STYLE.skillLine },
              { text: body, style: STYLE.skillLine },
            ]
          : [{ text: title || body, style: STYLE.skillLine }];
      blocks.push(
        para(runs, {
          spacingAfterPt: 0.4,
          bullet: false,
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
      blocks.push(...renderSnapshot(STYLE, layout, item, section));
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
  layout: TemplateDefinition['layout'],
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
      }),
    );
    return out;
  }

  // projects: title | 技术栈 · 担任的职责 | dates
  // internships: company | 岗位 · 部门 | dates — show every saved field
  const tech = (s.projectType ?? '').trim() || undefined;
  const duty = (s.subtitle ?? '').trim() || undefined;
  const right = s.timeRange || undefined;
  const tabCenter =
    section === 'internships'
      ? layout.internshipTabCenter
      : layout.entryTabCenter;

  out.push(
    entryLine(
      STYLE,
      s.title,
      { tech, text: duty },
      right,
      {
        spacingAfterPt: 0.8,
        spacingBeforePt: placement.sortOrder > 0 ? 6.5 : 0,
        entryTabCenter: tabCenter,
      },
    ),
  );

  if (s.body.trim()) {
    for (const line of s.body.split(/\n/).map((l) => l.trim()).filter(Boolean)) {
      out.push(
        para([{ text: line, style: STYLE.body }], {
          spacingAfterPt: 0.8,
        }),
      );
    }
  }

  return out;
}

function entryLine(
  STYLE: TemplateStyles,
  title: string,
  mid: { tech?: string; text?: string } | undefined,
  time: string | undefined,
  opts: {
    spacingAfterPt?: number;
    spacingBeforePt?: number;
    entryTabCenter?: number;
  } = {},
): IrParagraph {
  const tech = mid?.tech?.trim() || undefined;
  const text = mid?.text?.trim() || undefined;
  const hasMid = Boolean(tech || text);
  const runs: IrParagraph['runs'] = [
    { text: title, style: STYLE.entryTitle },
  ];
  if (hasMid || time) {
    runs.push({ text: '\t', style: STYLE.entryMeta });
    if (tech) {
      runs.push({ text: tech, style: STYLE.entryTech });
    }
    if (tech && text) {
      runs.push({ text: ' · ', style: STYLE.entryMeta });
    }
    if (text) {
      runs.push({ text, style: STYLE.entryMeta });
    }
    if (!hasMid) {
      runs.push({ text: '', style: STYLE.entryMeta });
    }
  }
  if (time) {
    runs.push({ text: '\t', style: STYLE.entryMeta });
    runs.push({ text: time, style: STYLE.entryMeta });
  }
  return para(runs, {
    spacingAfterPt: opts.spacingAfterPt,
    spacingBeforePt: opts.spacingBeforePt,
    entryTabs: opts.entryTabCenter ?? true,
  });
}

function para(
  runs: IrParagraph['runs'],
  opts: {
    spacingAfterPt?: number;
    spacingBeforePt?: number;
    alignment?: IrParagraph['alignment'];
    bullet?: boolean;
    entryTabs?: boolean | number;
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
  photoPlacement?: string;
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
    photoPlacement: def.photo?.placement,
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

export type { TextStyle };
