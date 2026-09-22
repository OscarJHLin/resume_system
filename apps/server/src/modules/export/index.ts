import {
  AlignmentType,
  BorderStyle,
  Document,
  ImageRun,
  Packer,
  Paragraph,
  TabStopType,
  TextRun,
} from 'docx';
import type { IrBlock, IrHeading, IrParagraph, IrRun, ResumeIR } from '@resume/domain';
import { DEFAULT_TEMPLATE_ID } from '@resume/domain';
import { getTemplate } from '../template/registry.js';

/** Content width ≈ 9866; reference tabs at 4933 / 9866. */
const ENTRY_TAB_CENTER = 4933;
const ENTRY_TAB_RIGHT = 9866;

function pageForTemplate(templateId: string) {
  const def = getTemplate(templateId) ?? getTemplate(DEFAULT_TEMPLATE_ID);
  if (!def) {
    return {
      width: 11906,
      height: 16838,
      margin: { top: 680, right: 1020, bottom: 680, left: 1020 },
    };
  }
  return def.page;
}

export interface ExportOptions {
  /** Optional portrait bytes for header (when template allows photo). */
  photo?: { buffer: Buffer; mime: string } | null;
}

export async function exportDocx(
  ir: ResumeIR,
  options: ExportOptions = {},
): Promise<Buffer> {
  const PAGE = pageForTemplate(ir.templateId);
  const def = getTemplate(ir.templateId) ?? getTemplate(DEFAULT_TEMPLATE_ID);
  const photoSpec = def?.photo ?? {
    placement: 'above-name-center' as const,
    widthPx: 98,
    heightPx: 131,
  };
  const layout = def?.layout;
  const children: Paragraph[] = [];
  if (options.photo?.buffer?.length) {
    const type =
      options.photo.mime.includes('png')
        ? 'png'
        : options.photo.mime.includes('gif')
          ? 'gif'
          : 'jpg';
    // Do NOT use exact line spacing here — it clips the image in Word/WPS.
    children.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 120, line: 276, lineRule: 'auto' },
        children: [
          new ImageRun({
            type,
            data: options.photo.buffer,
            transformation: {
              width: photoSpec.widthPx,
              height: photoSpec.heightPx,
            },
            altText: {
              title: '证件照',
              description: '简历证件照',
              name: 'photo',
            },
          }),
        ],
      }),
    );
  }
  children.push(
    ...ir.blocks.map((b) => blockToParagraph(b, layout)),
  );
  const doc = new Document({
    sections: [
      {
        properties: {
          page: {
            size: {
              width: PAGE.width,
              height: PAGE.height,
            },
            margin: { ...PAGE.margin },
          },
        },
        children:
          children.length > 0
            ? children
            : [new Paragraph({ children: [new TextRun('')] })],
      },
    ],
  });
  return Buffer.from(await Packer.toBuffer(doc));
}

function blockToParagraph(
  block: IrBlock,
  layout?: {
    entryTabCenter: number;
    internshipTabCenter: number;
    entryTabRight: number;
    bulletIndent: { left: number; hanging: number };
  },
): Paragraph {
  if (block.kind === 'heading') {
    return headingParagraph(block);
  }
  return bodyParagraph(block, layout);
}

function headingParagraph(block: IrHeading): Paragraph {
  // Avoid Word/WPS built-in Heading styles (they force Calibri / theme fonts).
  // Render as a normal paragraph with our eastAsia typography only.
  return new Paragraph({
    alignment: mapAlign(block.alignment),
    spacing: {
      before: ptToTwip(block.spacingBeforePt ?? (block.level === 1 ? 0 : 10)),
      after: ptToTwip(block.spacingAfterPt ?? 6),
      line: block.level === 1 ? 560 : 360,
      lineRule: 'auto',
    },
    border: block.borderBottom
      ? {
          bottom: {
            style: BorderStyle.SINGLE,
            size: 6,
            color: '000000',
            space: 4,
          },
        }
      : undefined,
    children: block.runs.map(runToTextRun),
  });
}

function bodyParagraph(
  block: IrParagraph,
  layout?: {
    entryTabCenter: number;
    internshipTabCenter: number;
    entryTabRight: number;
    bulletIndent: { left: number; hanging: number };
  },
): Paragraph {
  const tabRight = layout?.entryTabRight ?? ENTRY_TAB_RIGHT;
  const defaultCenter = layout?.entryTabCenter ?? ENTRY_TAB_CENTER;
  const centerPos =
    typeof block.entryTabs === 'number' ? block.entryTabs : defaultCenter;
  const bulletInd = layout?.bulletIndent ?? { left: 340, hanging: 228 };

  return new Paragraph({
    alignment: mapAlign(block.alignment),
    spacing: {
      before: ptToTwip(block.spacingBeforePt ?? 0),
      after: ptToTwip(block.spacingAfterPt ?? 0.8),
      line: block.bullet ? 320 : block.alignment === 'center' ? 280 : 320,
      lineRule: 'auto',
    },
    indent: block.bullet
      ? { left: bulletInd.left, hanging: bulletInd.hanging }
      : undefined,
    tabStops: block.entryTabs
      ? [
          { type: TabStopType.CENTER, position: centerPos },
          { type: TabStopType.RIGHT, position: tabRight },
        ]
      : undefined,
    children: [
      ...(block.bullet
        ? [
            new TextRun({
              text: '• ',
              bold: true,
              font: fontFace('宋体'),
              size: 21,
            }),
          ]
        : []),
      ...block.runs.map(runToTextRun),
    ],
  });
}

function runToTextRun(run: IrRun): TextRun {
  const eastAsia = run.style?.fontEastAsia ?? '宋体';
  return new TextRun({
    text: run.text,
    bold: run.style?.bold,
    italics: run.style?.italic,
    size: run.style?.fontSizePt
      ? Math.round(run.style.fontSizePt * 2)
      : 21,
    font: fontFace(eastAsia),
  });
}

/**
 * Use one CJK face for ascii/hAnsi/eastAsia so Latin + Chinese stay consistent
 * in WPS/Word (avoids Arial/Calibri mixed with 宋体).
 */
function fontFace(eastAsia: string): {
  ascii: string;
  hAnsi: string;
  eastAsia: string;
  cs: string;
} {
  const face = eastAsia.trim() || '宋体';
  return {
    ascii: face,
    hAnsi: face,
    eastAsia: face,
    cs: face,
  };
}

function mapAlign(
  alignment: 'left' | 'center' | 'right' | undefined,
): (typeof AlignmentType)[keyof typeof AlignmentType] | undefined {
  if (alignment === 'center') return AlignmentType.CENTER;
  if (alignment === 'right') return AlignmentType.RIGHT;
  if (alignment === 'left') return AlignmentType.LEFT;
  return undefined;
}

function ptToTwip(pt: number): number {
  return Math.round(pt * 20);
}

export const exportModule = {
  id: 'export-docx' as const,
  status: 'ready' as const,
};

/** Test probe for page geometry (default pack). */
export const LIN_V1_PAGE = pageForTemplate(DEFAULT_TEMPLATE_ID);
