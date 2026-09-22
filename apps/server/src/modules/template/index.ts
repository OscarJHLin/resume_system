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
  SECTION_LABELS,
} from '@resume/domain';

/**
 * `default-v1` typography from 参考简历模板.docx (lin-v1):
 * - Name 22pt 黑体 bold centered
 * - Tagline 11pt 黑体 centered
 * - Contact 9.5pt 宋体 centered (phone | email | wechat | location)
 * - Section 13pt 黑体 bold + bottom rule
 * - Entry 10.5pt 黑体 title + 宋体 meta/time (tab columns)
 * - Skills from Profile.skills as bold「标题：正文」
 * - Body 10.5pt 宋体 bullets
 * Photo column removed from template + DOCX export.
 */
export class UnknownTemplateError extends Error {
  constructor(templateId: string) {
    super(`Unknown template: ${templateId}`);
    this.name = 'UnknownTemplateError';
  }
}

const HEITI = '黑体';
const SONG = '宋体';

const STYLE = {
  name: { bold: true, fontSizePt: 22, fontEastAsia: HEITI } satisfies TextStyle,
  tagline: { fontSizePt: 11, fontEastAsia: HEITI } satisfies TextStyle,
  contact: { fontSizePt: 9.5, fontEastAsia: SONG } satisfies TextStyle,
  sectionHeading: {
    bold: true,
    fontSizePt: 13,
    fontEastAsia: HEITI,
  } satisfies TextStyle,
  entryTitle: {
    bold: true,
    fontSizePt: 10.5,
    fontEastAsia: HEITI,
  } satisfies TextStyle,
  entryMeta: { fontSizePt: 10.5, fontEastAsia: SONG } satisfies TextStyle,
  skillLine: {
    bold: true,
    fontSizePt: 10.5,
    fontEastAsia: SONG,
  } satisfies TextStyle,
  body: { fontSizePt: 10.5, fontEastAsia: SONG } satisfies TextStyle,
} as const;

/** Module sections after profile header (matches reference DOCX order). */
const SECTION_ORDER: SectionId[] = [
  'skills',
  'projects',
  'internships',
  'awards',
];

export function renderToIR(
  input: RenderInput,
  clock: () => string = () => new Date().toISOString(),
): ResumeIR {
  if (input.templateId !== DEFAULT_TEMPLATE_ID) {
    throw new UnknownTemplateError(input.templateId);
  }

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
    blocks.push(sectionHeading(SECTION_LABELS.education));
    for (const edu of profile.education) {
      const major = [edu.degree, edu.major].filter(Boolean).join(' · ');
      blocks.push(
        entryLine(edu.school || '学校', major || undefined, edu.timeRange, {
          spacingAfterPt: 0.8,
        }),
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

  // 技术能力 from profile.skills (not placements)
  if (profile.skills.length > 0) {
    blocks.push(sectionHeading(SECTION_LABELS.skills));
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

  for (const section of SECTION_ORDER) {
    if (section === 'skills') continue; // rendered from profile
    const items = placements
      .filter((p) => p.section === section)
      .sort((a, b) => a.sortOrder - b.sortOrder);
    if (items.length === 0) continue;

    blocks.push(sectionHeading(SECTION_LABELS[section]));
    for (const item of items) {
      blocks.push(...renderSnapshot(item, section));
    }
  }

  return {
    templateId: DEFAULT_TEMPLATE_ID,
    templateVersion: '1.2-lin',
    blocks,
    meta: {
      title: profile.name || 'resume',
      generatedAt: clock(),
    },
  };
}

function sectionHeading(text: string): IrBlock {
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

  // projects / internships: entry row + body bullets
  const meta = [s.subtitle, s.projectType].filter(Boolean).join(' · ');
  out.push(
    entryLine(s.title, meta || undefined, s.timeRange, {
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

/** Exported for tests — style constants derived from reference DOCX. */
export const LIN_V1_STYLE_PROBE = {
  namePt: STYLE.name.fontSizePt,
  sectionPt: STYLE.sectionHeading.fontSizePt,
  bodyPt: STYLE.body.fontSizePt,
  contactPt: STYLE.contact.fontSizePt,
  heiti: HEITI,
  song: SONG,
  sectionOrder: SECTION_ORDER,
  photoInTemplate: false,
} as const;

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
