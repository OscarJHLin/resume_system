import { NodeViewWrapper } from '@tiptap/react';
import type { NodeViewProps } from '@tiptap/react';

export function PlacementItemView({ node }: NodeViewProps) {
  const title = String(node.attrs.title ?? '');
  const timeRange = String(node.attrs.timeRange ?? '');
  const subtitle = String(node.attrs.subtitle ?? '');
  const projectType = String(node.attrs.projectType ?? '');
  const body = String(node.attrs.body ?? '');

  return (
    <NodeViewWrapper
      as="article"
      className="editor__placement"
      data-placement-id={String(node.attrs.placementId ?? '')}
    >
      <div className="editor__placement-head">
        <strong>{title}</strong>
        {timeRange ? <span className="editor__muted">{timeRange}</span> : null}
      </div>
      {subtitle ? <p className="editor__muted">{subtitle}</p> : null}
      {projectType ? (
        <p className="editor__muted">类型：{projectType}</p>
      ) : null}
      {body ? <pre className="editor__body">{body}</pre> : null}
    </NodeViewWrapper>
  );
}
