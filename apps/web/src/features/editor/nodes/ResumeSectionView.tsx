import { NodeViewContent, NodeViewWrapper } from '@tiptap/react';
import type { NodeViewProps } from '@tiptap/react';
import type { SectionId } from '@resume/domain';
import { SECTION_LABELS } from '@resume/domain';
import { dropZoneClassName } from '../../dnd/dropTarget';
import { useDropZone } from '../../dnd/pointerDrag';
import type { ResumeEditorCallbacks } from '../extensions';

export function ResumeSectionView({ node, extension }: NodeViewProps) {
  const sectionId = node.attrs.sectionId as SectionId;
  const placeable = Boolean(node.attrs.placeable);
  const label = String(node.attrs.label || SECTION_LABELS[sectionId] || sectionId);
  const opts = extension.options as ResumeEditorCallbacks;

  const zone = useDropZone<HTMLDivElement>(sectionId, {
    onAccept: (moduleId) => void opts.onDropModule?.(sectionId, moduleId),
    onReject: (message) => opts.onStatus?.(message),
  });

  return (
    <NodeViewWrapper
      as="section"
      className="editor__section"
      data-section={sectionId}
    >
      <h2>{label}</h2>
      {placeable ? (
        <div
          ref={zone.ref}
          className={dropZoneClassName('editor__drop', zone)}
          onClick={(e) => {
            const t = e.target;
            if (
              t instanceof Element &&
              t.closest('button, a, input, .editor__item-toolbar')
            ) {
              return;
            }
            zone.placePicked();
          }}
        >
          <NodeViewContent className="editor__section-content" />
        </div>
      ) : (
        <NodeViewContent className="editor__section-content" />
      )}
    </NodeViewWrapper>
  );
}
