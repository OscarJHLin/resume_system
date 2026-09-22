import { NodeViewWrapper } from '@tiptap/react';
import type { NodeViewProps } from '@tiptap/react';

export function DropHintView({ node }: NodeViewProps) {
  const empty = Boolean(node.attrs.empty);
  return (
    <NodeViewWrapper as="div" className="editor__drop-hint-wrap">
      <p className="editor__drop-hint">
        {empty
          ? '将匹配大类的模块拖到此处'
          : '继续拖入更多模块…'}
      </p>
    </NodeViewWrapper>
  );
}
