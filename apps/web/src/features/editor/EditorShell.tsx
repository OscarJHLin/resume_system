import { useEffect, useMemo, useRef } from 'react';
import { EditorContent, useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import type {
  Profile,
  ResumeDocument,
  SectionId,
} from '@resume/domain';
import { buildResumeTipTapDoc, placementsForSection } from './docModel';
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
  connectionError?: boolean;
  onDropModule: (section: SectionId, moduleId: string) => Promise<void>;
  onDeletePlacement: (placementId: string) => Promise<void>;
  onMovePlacement: (
    section: SectionId,
    placementId: string,
    direction: 'up' | 'down',
  ) => Promise<void>;
  onStatus?: (message: string) => void;
}

/**
 * TipTap document shell (ADR-0002): projection of ResumeDocument.
 * Mutations go through placement APIs; then parent refreshes resume → setContent.
 */
export function EditorShell({
  resume,
  profile,
  connectionError = false,
  onDropModule,
  onDeletePlacement,
  onMovePlacement,
  onStatus,
}: EditorShellProps) {
  const callbacksRef = useRef({
    onDropModule,
    onDeletePlacement,
    onMovePlacement,
    onStatus,
    resume,
  });
  callbacksRef.current = {
    onDropModule,
    onDeletePlacement,
    onMovePlacement,
    onStatus,
    resume,
  };

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
      PlacementItem.configure({
        onDeletePlacement: (placementId) =>
          callbacksRef.current.onDeletePlacement(placementId),
        onMovePlacement: (section, placementId, direction) =>
          callbacksRef.current.onMovePlacement(
            section,
            placementId,
            direction,
          ),
        getSectionPlacementIds: (section) =>
          placementsForSection(callbacksRef.current.resume, section).map(
            (p) => p.id,
          ),
        onStatus: (message) => callbacksRef.current.onStatus?.(message),
      }),
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
        {connectionError ? (
          <div className="editor__empty" role="alert">
            <h2>服务未连接</h2>
            <p>启动 API 后刷新：<code>npm run dev:server</code></p>
          </div>
        ) : !resume ? (
          <div className="editor__empty">
            <h2>尚无简历</h2>
            <p>点击顶部「写入演示数据」生成带资料与预置条目的样例草稿。</p>
          </div>
        ) : editor ? (
          <EditorContent editor={editor} />
        ) : (
          <p className="editor__muted">加载编辑器…</p>
        )}
      </div>
    </main>
  );
}
