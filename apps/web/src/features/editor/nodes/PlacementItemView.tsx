import { NodeViewWrapper } from '@tiptap/react';
import type { NodeViewProps } from '@tiptap/react';
import type { SectionId } from '@resume/domain';
import { canMovePlacement } from '../placementOrder';
import type { ResumeEditorCallbacks } from '../extensions';

export function PlacementItemView({ node, extension }: NodeViewProps) {
  const opts = extension.options as ResumeEditorCallbacks;
  const placementId = String(node.attrs.placementId ?? '');
  const sectionId = node.attrs.sectionId as SectionId;
  const title = String(node.attrs.title ?? '');
  const timeRange = String(node.attrs.timeRange ?? '');
  const subtitle = String(node.attrs.subtitle ?? '');
  const projectType = String(node.attrs.projectType ?? '');
  const body = String(node.attrs.body ?? '');

  const ordered =
    opts.getSectionPlacementIds?.(sectionId) ?? [placementId];
  const canUp = canMovePlacement(ordered, placementId, 'up');
  const canDown = canMovePlacement(ordered, placementId, 'down');

  return (
    <NodeViewWrapper
      as="article"
      className="editor__placement"
      data-placement-id={placementId}
    >
      <div className="editor__placement-head">
        <strong>{title}</strong>
        <div className="editor__placement-actions">
          {timeRange ? (
            <span className="editor__muted">{timeRange}</span>
          ) : null}
          <button
            type="button"
            className="editor__icon-btn"
            disabled={!canUp}
            title="上移"
            aria-label="上移"
            onClick={() =>
              void opts.onMovePlacement?.(sectionId, placementId, 'up')
            }
          >
            ↑
          </button>
          <button
            type="button"
            className="editor__icon-btn"
            disabled={!canDown}
            title="下移"
            aria-label="下移"
            onClick={() =>
              void opts.onMovePlacement?.(sectionId, placementId, 'down')
            }
          >
            ↓
          </button>
          <button
            type="button"
            className="editor__icon-btn editor__icon-btn--danger"
            title="删除此快照"
            aria-label="删除"
            onClick={() => void opts.onDeletePlacement?.(placementId)}
          >
            删
          </button>
        </div>
      </div>
      {subtitle ? <p className="editor__muted">{subtitle}</p> : null}
      {projectType ? (
        <p className="editor__muted">类型：{projectType}</p>
      ) : null}
      {body ? <pre className="editor__body">{body}</pre> : null}
    </NodeViewWrapper>
  );
}
