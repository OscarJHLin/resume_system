import {
  AlignmentType,
  Document,
  HeadingLevel,
  Packer,
  Paragraph,
  TextRun,
} from 'docx';
import type { IrBlock, IrRun, ResumeIR } from '@resume/domain';

export async function exportDocx(ir: ResumeIR): Promise<Buffer> {
  const children = ir.blocks.map(blockToParagraph);
  const doc = new Document({
    sections: [
      {
        properties: {},
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
    const level =
      block.level === 1
        ? HeadingLevel.HEADING_1
        : block.level === 2
          ? HeadingLevel.HEADING_2
          : HeadingLevel.HEADING_3;
    return new Paragraph({
      heading: level,
      spacing: { after: 120 },
      children: block.runs.map(runToTextRun),
    });
  }

  return new Paragraph({
    spacing: {
      after: block.spacingAfterPt ? Math.round(block.spacingAfterPt * 20) : 80,
    },
    alignment: AlignmentType.LEFT,
    children: block.runs.map(runToTextRun),
  });
}

function runToTextRun(run: IrRun): TextRun {
  return new TextRun({
    text: run.text,
    bold: run.style?.bold,
    italics: run.style?.italic,
    size: run.style?.fontSizePt ? Math.round(run.style.fontSizePt * 2) : 21,
    font: 'Microsoft YaHei',
  });
}

export const exportModule = {
  id: 'export-docx' as const,
  status: 'ready' as const,
};
