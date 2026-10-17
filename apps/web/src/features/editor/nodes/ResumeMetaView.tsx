import { NodeViewWrapper } from '@tiptap/react';
import type { NodeViewProps } from '@tiptap/react';

export function ResumeMetaView({ node }: NodeViewProps) {
  return (
    <NodeViewWrapper className="editor__meta" as="div">
      <p className="editor__template">模板 · {String(node.attrs.templateId)}</p>
      <h1 className="editor__doc-title">{String(node.attrs.title)}</h1>
    </NodeViewWrapper>
  );
}
