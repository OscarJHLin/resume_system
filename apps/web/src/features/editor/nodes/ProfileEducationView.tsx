import { NodeViewWrapper } from '@tiptap/react';
import type { NodeViewProps } from '@tiptap/react';

export function ProfileEducationView({ node }: NodeViewProps) {
  let lines: string[] = [];
  try {
    const parsed = JSON.parse(String(node.attrs.linesJson ?? '[]')) as unknown;
    if (Array.isArray(parsed)) {
      lines = parsed.map(String);
    }
  } catch {
    lines = [];
  }

  if (lines.length === 0) {
    return (
      <NodeViewWrapper as="div">
        <p className="editor__muted">暂无教育经历</p>
      </NodeViewWrapper>
    );
  }

  return (
    <NodeViewWrapper as="div">
      <ul className="editor__edu">
        {lines.map((line) => (
          <li key={line}>{line}</li>
        ))}
      </ul>
    </NodeViewWrapper>
  );
}
