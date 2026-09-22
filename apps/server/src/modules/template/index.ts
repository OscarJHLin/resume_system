import type {
  IrBlock,
  IrParagraph,
  ModuleSnapshot,
  Profile,
  RenderInput,
  ResumeIR,
  SectionId,
  SectionPlacement,
} from '@resume/domain';
import {
  DEFAULT_TEMPLATE_ID,
  SECTION_LABELS,
} from '@resume/domain';

export class UnknownTemplateError extends Error {
  constructor(templateId: string) {
    super(`Unknown template: ${templateId}`);
    this.name = 'UnknownTemplateError';
  }
}

const STYLE = {
  name: { bold: true, fontSizePt: 16 },
  contact: { fontSizePt: 10.5 },
  sectionHeading: { bold: true, fontSizePt: 12 },
  title: { bold: true, fontSizePt: 11 },
  subtitle: { fontSizePt: 10.5 },
  projectType: { fontSizePt: 10.5 },
  timeRange: { fontSizePt: 10.5 },
  body: { fontSizePt: 10.5 },
  education: { fontSizePt: 10.5 },
} as const;

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
    runs: [{ text: profile.name, style: STYLE.name }],
  });

  const contact = [profile.phone, profile.email, profile.location]
    .filter(Boolean)
    .join(' · ');
  if (contact) {
    blocks.push(para([{ text: contact, style: STYLE.contact }], 6));
  }
  if (profile.summary?.trim()) {
    blocks.push(para([{ text: profile.summary, style: STYLE.body }], 8));
  }

  if (profile.education.length > 0) {
    blocks.push({
      kind: 'heading',
      level: 2,
      runs: [{ text: SECTION_LABELS.education, style: STYLE.sectionHeading }],
    });
    for (const edu of profile.education) {
      const line = [edu.school, edu.degree, edu.major, edu.timeRange]
        .filter(Boolean)
        .join(' · ');
      if (line) {
        blocks.push(para([{ text: line, style: STYLE.education }], 4));
      }
    }
  }

  for (const section of SECTION_ORDER) {
    const items = placements
      .filter((p) => p.section === section)
      .sort((a, b) => a.sortOrder - b.sortOrder);
    if (items.length === 0) continue;

    blocks.push({
      kind: 'heading',
      level: 2,
      runs: [{ text: SECTION_LABELS[section], style: STYLE.sectionHeading }],
    });

    for (const item of items) {
      blocks.push(...renderSnapshot(item));
    }
  }

  return {
    templateId: DEFAULT_TEMPLATE_ID,
    templateVersion: '1',
    blocks,
    meta: {
      title: profile.name,
      generatedAt: clock(),
    },
  };
}

function renderSnapshot(placement: SectionPlacement): IrBlock[] {
  const s: ModuleSnapshot = placement.snapshot;
  const out: IrBlock[] = [];

  const titleLine: IrParagraph['runs'] = [
    { text: s.title, style: STYLE.title },
  ];
  if (s.timeRange) {
    titleLine.push({ text: `  ${s.timeRange}`, style: STYLE.timeRange });
  }
  out.push(para(titleLine, 2));

  if (s.subtitle) {
    out.push(para([{ text: s.subtitle, style: STYLE.subtitle }], 2));
  }
  if (s.projectType) {
    out.push(
      para([{ text: `类型：${s.projectType}`, style: STYLE.projectType }], 2),
    );
  }

  if (s.body.trim()) {
    for (const line of s.body.split(/\n/)) {
      out.push(para([{ text: line, style: STYLE.body }], 2));
    }
  }

  return out;
}

function para(
  runs: IrParagraph['runs'],
  spacingAfterPt?: number,
): IrParagraph {
  return { kind: 'paragraph', runs, spacingAfterPt };
}
