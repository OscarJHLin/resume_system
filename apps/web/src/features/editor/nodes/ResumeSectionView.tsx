import { useState } from 'react';
import { NodeViewContent, NodeViewWrapper } from '@tiptap/react';
import type { NodeViewProps } from '@tiptap/react';
import type { SectionId } from '@resume/domain';
import { SECTION_LABELS, decideModuleDrop } from '@resume/domain';
import {
  clearModuleDrag,
  dropZoneClassName,
  readModuleDragData,
} from '../../dnd/dragPayload';
import type { ResumeEditorCallbacks } from '../extensions';

export function ResumeSectionView({ node, extension }: NodeViewProps) {
  const sectionId = node.attrs.sectionId as SectionId;
  const placeable = Boolean(node.attrs.placeable);
  const label = String(node.attrs.label || SECTION_LABELS[sectionId] || sectionId);
  const opts = extension.options as ResumeEditorCallbacks;

  const [hover, setHover] = useState(false);
  const [invalid, setInvalid] = useState(false);

  return (
    <NodeViewWrapper
      as="section"
      className="editor__section"
      data-section={sectionId}
    >
      <h2>{label}</h2>
      {placeable ? (
        <div
          className={dropZoneClassName('editor__drop', {
            active: hover,
            invalid: hover && invalid,
          })}
          onDragOver={(e) => {
            e.preventDefault();
            const payload = readModuleDragData(e.dataTransfer);
            if (!payload) {
              e.dataTransfer.dropEffect = 'none';
              return;
            }
            const decision = decideModuleDrop(payload.category, sectionId);
            const ok = decision === 'accept';
            e.dataTransfer.dropEffect = ok ? 'copy' : 'none';
            setHover(true);
            setInvalid(!ok);
          }}
          onDragLeave={() => {
            setHover(false);
            setInvalid(false);
          }}
          onDrop={(e) => {
            e.preventDefault();
            setHover(false);
            setInvalid(false);
            const payload = readModuleDragData(e.dataTransfer);
            clearModuleDrag();
            if (!payload) {
              opts.onStatus?.('无法读取拖拽数据');
              return;
            }
            const decision = decideModuleDrop(payload.category, sectionId);
            if (decision !== 'accept') {
              opts.onStatus?.(
                decision === 'reject-section'
                  ? '该区块不接受模块'
                  : `模块类型 ${payload.category} 不能放入 ${SECTION_LABELS[sectionId]}`,
              );
              return;
            }
            void opts.onDropModule?.(sectionId, payload.moduleId);
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
