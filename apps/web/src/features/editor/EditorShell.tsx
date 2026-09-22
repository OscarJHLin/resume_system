import { useEffect, useMemo, useRef } from 'react';
import { EditorContent, useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import type {
  Profile,
  ResumeDocument,
  SectionId,
} from '@resume/domain';
import { buildResumeTipTapDoc } from './docModel';
import {
  DropHint,
  PlacementItem,
  ProfileBasic,
  ProfileEducation,
  ResumeMeta,
  ResumeSection,
} from './extensions';
import './editor.css';

export interface EditorShellProps {
  resume: ResumeDocument | null;
  profile: Profile | null;
  onDropModule: (section: SectionId, moduleId: string) => Promise<void>;
  onStatus?: (message: string) => void;
}

/**
 * TipTap document shell (ADR-0002): projection of ResumeDocument.
 * DnD writes via placement API; export uses placements → ResumeIR (not TipTap JSON).
 */
export function EditorShell({
  resume,
  profile,
  onDropModule,
  onStatus,
}: EditorShellProps) {
  const callbacksRef = useRef({ onDropModule, onStatus });
  callbacksRef.current = { onDropModule, onStatus };

  const extensions = useMemo(
    () => [
      StarterKit.configure({
        heading: false,
        blockquote: false,
        bold: false,
        italic: false,
        strike: false,
        code: false,
        codeBlock: false,
        bulletList: false,
        orderedList: false,
        listItem: false,
        horizontalRule: false,
        hardBreak: false,
        dropcursor: false,
        gapcursor: false,
      }),
      ResumeMeta,
      ResumeSection.configure({
        onDropModule: (section, moduleId) =>
          callbacksRef.current.onDropModule(section, moduleId),
        onStatus: (message) => callbacksRef.current.onStatus?.(message),
      }),
      PlacementItem,
      ProfileBasic,
      ProfileEducation,
      DropHint,
    ],
    [],
  );

  const editor = useEditor({
    extensions,
    content: buildResumeTipTapDoc({ resume: null, profile: null }),
    editable: false,
    immediatelyRender: false,
    editorProps: {
      attributes: {
        class: 'editor__prose',
        'aria-label': '简历文档（TipTap 投影）',
      },
    },
  });

  useEffect(() => {
    if (!editor || editor.isDestroyed) return;
    const next = buildResumeTipTapDoc({ resume, profile });
    const current = JSON.stringify(editor.getJSON());
    const incoming = JSON.stringify(next);
    if (current === incoming) return;
    editor.commands.setContent(next, { emitUpdate: false });
  }, [editor, resume, profile]);

  return (
    <main className="editor">
      <div className="editor__page">
        {editor ? (
          <EditorContent editor={editor} />
        ) : (
          <p className="editor__muted">加载编辑器…</p>
        )}
      </div>
    </main>
  );
}
