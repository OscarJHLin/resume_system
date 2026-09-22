import { NodeViewWrapper } from '@tiptap/react';
import type { NodeViewProps } from '@tiptap/react';

export function ProfileBasicView({ node }: NodeViewProps) {
  if (node.attrs.loading) {
    return (
      <NodeViewWrapper className="editor__profile" as="div">
        <p className="editor__muted">加载个人资料…</p>
      </NodeViewWrapper>
    );
  }
  const name = String(node.attrs.name ?? '');
  const contact = String(node.attrs.contact ?? '');
  const summary = String(node.attrs.summary ?? '');
  return (
    <NodeViewWrapper className="editor__profile" as="div">
      <p className="editor__name">{name}</p>
      {contact ? <p className="editor__muted">{contact}</p> : null}
      {summary ? <p>{summary}</p> : null}
    </NodeViewWrapper>
  );
}
