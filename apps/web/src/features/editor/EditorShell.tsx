import { useState } from 'react';
import type {
  Profile,
  ResumeDocument,
  SectionId,
  SectionPlacement,
} from '@resume/domain';
import {
  DEFAULT_TEMPLATE_ID,
  SECTION_LABELS,
  decideModuleDrop,
  isPlaceableSection,
} from '@resume/domain';
import {
  dropZoneClassName,
  readModuleDragData,
  clearModuleDrag,
} from '../dnd/dragPayload';
import './editor.css';

const SECTION_ORDER: SectionId[] = [
  'basic',
  'education',
  'skills',
  'projects',
  'internships',
  'awards',
];

export interface EditorShellProps {
  resume: ResumeDocument | null;
  profile: Profile | null;
  onDropModule: (section: SectionId, moduleId: string) => Promise<void>;
  onStatus?: (message: string) => void;
}

/**
 * Resume canvas with section drop zones (list-style; TipTap in S3).
 */
export function EditorShell({
  resume,
  profile,
  onDropModule,
  onStatus,
}: EditorShellProps) {
  const [hoverSection, setHoverSection] = useState<SectionId | null>(null);
  const [hoverInvalid, setHoverInvalid] = useState(false);

  return (
    <main className="editor">
      <div className="editor__page">
        <p className="editor__template">
          模板 · {resume?.templateId ?? DEFAULT_TEMPLATE_ID}
        </p>
        <h1 className="editor__doc-title">
          {resume?.title ?? '未命名简历'}
        </h1>

        {SECTION_ORDER.map((sectionId) => {
          const placeable = isPlaceableSection(sectionId);
          const placements =
            resume?.placements
              .filter((p) => p.section === sectionId)
              .sort((a, b) => a.sortOrder - b.sortOrder) ?? [];

          return (
            <section
              key={sectionId}
              className="editor__section"
              data-section={sectionId}
            >
              <h2>{SECTION_LABELS[sectionId]}</h2>

              {sectionId === 'basic' && (
                <ProfileBasicBlock profile={profile} />
              )}
              {sectionId === 'education' && (
                <ProfileEducationBlock profile={profile} />
              )}

              {placeable && (
                <div
                  className={dropZoneClassName('editor__drop', {
                    active: hoverSection === sectionId,
                    invalid: hoverSection === sectionId && hoverInvalid,
                  })}
                  onDragOver={(e) => {
                    e.preventDefault();
                    const payload = readModuleDragData(e.dataTransfer);
                    if (!payload) {
                      e.dataTransfer.dropEffect = 'none';
                      return;
                    }
                    const decision = decideModuleDrop(
                      payload.category,
                      sectionId,
                    );
                    const ok = decision === 'accept';
                    e.dataTransfer.dropEffect = ok ? 'copy' : 'none';
                    setHoverSection(sectionId);
                    setHoverInvalid(!ok);
                  }}
                  onDragLeave={() => {
                    setHoverSection(null);
                    setHoverInvalid(false);
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    setHoverSection(null);
                    setHoverInvalid(false);
                    const payload = readModuleDragData(e.dataTransfer);
                    clearModuleDrag();
                    if (!payload) {
                      onStatus?.('无法读取拖拽数据');
                      return;
                    }
                    const decision = decideModuleDrop(
                      payload.category,
                      sectionId,
                    );
                    if (decision !== 'accept') {
                      onStatus?.(
                        decision === 'reject-section'
                          ? '该区块不接受模块'
                          : `模块类型 ${payload.category} 不能放入 ${SECTION_LABELS[sectionId]}`,
                      );
                      return;
                    }
                    void onDropModule(sectionId, payload.moduleId);
                  }}
                >
                  {placements.length === 0 ? (
                    <p className="editor__drop-hint">
                      将匹配大类的模块拖到此处
                    </p>
                  ) : (
                    <ul className="editor__placements">
                      {placements.map((p) => (
                        <PlacementCard key={p.id} placement={p} />
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </section>
          );
        })}
      </div>
    </main>
  );
}

function ProfileBasicBlock({ profile }: { profile: Profile | null }) {
  if (!profile) {
    return <p className="editor__muted">加载个人资料…</p>;
  }
  const contact = [profile.phone, profile.email, profile.location]
    .filter(Boolean)
    .join(' · ');
  return (
    <div className="editor__profile">
      <p className="editor__name">{profile.name}</p>
      {contact && <p className="editor__muted">{contact}</p>}
      {profile.summary && <p>{profile.summary}</p>}
    </div>
  );
}

function ProfileEducationBlock({ profile }: { profile: Profile | null }) {
  if (!profile?.education.length) {
    return <p className="editor__muted">暂无教育经历</p>;
  }
  return (
    <ul className="editor__edu">
      {profile.education.map((e) => (
        <li key={e.id}>
          {[e.school, e.degree, e.major, e.timeRange]
            .filter(Boolean)
            .join(' · ')}
        </li>
      ))}
    </ul>
  );
}

function PlacementCard({ placement }: { placement: SectionPlacement }) {
  const s = placement.snapshot;
  return (
    <li className="editor__placement">
      <div className="editor__placement-head">
        <strong>{s.title}</strong>
        {s.timeRange && (
          <span className="editor__muted">{s.timeRange}</span>
        )}
      </div>
      {s.subtitle && <p className="editor__muted">{s.subtitle}</p>}
      {s.projectType && (
        <p className="editor__muted">类型：{s.projectType}</p>
      )}
      {s.body && (
        <pre className="editor__body">{s.body}</pre>
      )}
    </li>
  );
}
