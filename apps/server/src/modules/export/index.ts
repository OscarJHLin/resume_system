import {
  AlignmentType,
  BorderStyle,
  Document,
  HeadingLevel,
  ImageRun,
  Packer,
  Paragraph,
  TabStopType,
  TextRun,
} from 'docx';
import type { IrBlock, IrHeading, IrParagraph, IrRun, ResumeIR } from '@resume/domain';

/** A4 + margins from 参考简历模板.docx sectPr (twips). */
const PAGE = {
  width: 11906,
  height: 16838,
  margin: { top: 680, right: 1020, bottom: 680, left: 1020 },
} as const;

/** Content width ≈ 9866; reference tabs at 4933 / 9866. */
const ENTRY_TAB_CENTER = 4933;
const ENTRY_TAB_RIGHT = 9866;

export interface ExportOptions {
  /** Optional portrait bytes for header (lin-v1 photo). */
  photo?: { buffer: Buffer; mime: string } | null;
}

export async function exportDocx(
  ir: ResumeIR,
  options: ExportOptions = {},
): Promise<Buffer> {
  const children: Paragraph[] = [];
  if (options.photo?.buffer?.length) {
    // docx ImageRun supports jpg/png/gif/bmp/svg — coerce webp to jpg type label if needed
    const type =
      options.photo.mime.includes('png')
        ? 'png'
        : options.photo.mime.includes('gif')
          ? 'gif'
          : 'jpg';
    children.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 120 },
        children: [
          new ImageRun({
            type,
            data: options.photo.buffer,
            transformation: { width: 72, height: 96 },
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
  children.push(...ir.blocks.map(blockToParagraph));
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

function blockToParagraph(block: IrBlock): Paragraph {
  if (block.kind === 'heading') {
    return headingParagraph(block);
  }
  return bodyParagraph(block);
}

function headingParagraph(block: IrHeading): Paragraph {
  const level =
    block.level === 1
      ? HeadingLevel.HEADING_1
      : block.level === 2
        ? HeadingLevel.HEADING_2
        : HeadingLevel.HEADING_3;

  return new Paragraph({
    heading: level,
    alignment: mapAlign(block.alignment),
    spacing: {
      before: ptToTwip(block.spacingBeforePt ?? (block.level === 1 ? 0 : 10)),
      after: ptToTwip(block.spacingAfterPt ?? 6),
      line: block.level === 1 ? 560 : 360,
      lineRule: 'exact',
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

function bodyParagraph(block: IrParagraph): Paragraph {
  return new Paragraph({
    alignment: mapAlign(block.alignment),
    spacing: {
      before: ptToTwip(block.spacingBeforePt ?? 0),
      after: ptToTwip(block.spacingAfterPt ?? 4),
      line: 320,
      lineRule: 'exact',
    },
    indent: block.bullet
      ? { left: 340, hanging: 228 }
      : undefined,
    tabStops: block.entryTabs
      ? [
          { type: TabStopType.CENTER, position: ENTRY_TAB_CENTER },
          { type: TabStopType.RIGHT, position: ENTRY_TAB_RIGHT },
        ]
      : undefined,
    children: [
      ...(block.bullet
        ? [
            new TextRun({
              text: '• ',
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

function fontFace(eastAsia: string): {
  ascii: string;
  hAnsi: string;
  eastAsia: string;
  cs: string;
} {
  return {
    ascii: 'Arial',
    hAnsi: 'Arial',
    eastAsia,
    cs: 'Arial',
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

/** Test probe for page geometry. */
export const LIN_V1_PAGE = PAGE;
