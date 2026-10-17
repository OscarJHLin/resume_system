import type { ReactNode } from 'react';
import { useMemo, useState } from 'react';
import type {
  Profile,
  ResumeDocument,
  SectionPlacement,
  SkillBlock,
} from '@resume/domain';
import {
  PERSONAL_STATEMENT_LABEL,
  SECTION_LABELS,
  TARGET_ROLE_PREFIX,
  educationTimeRange,
  isBuiltinPlaceableSection,
} from '@resume/domain';
import { dropZoneClassName } from '../dnd/dropTarget';
import { useDropZone } from '../dnd/pointerDrag';
import { placementsForSection } from '../editor/docModel';
import { canMovePlacement } from '../editor/placementOrder';
import { api } from '../../api/client';
import { ConfirmDialog } from '../library/ConfirmDialog';
import { PromptDialog } from '../library/PromptDialog';
import { placementDisplayFields } from './placementDisplay';
import './resumeCanvas.css';

export interface ResumeCanvasProps {
  resume: ResumeDocument | null;
  profile: Profile | null;
  connectionError?: boolean;
  onDropModule: (section: string, moduleId: string) => Promise<void>;
  onDeletePlacement: (placementId: string) => Promise<void>;
  onMovePlacement: (
    section: string,
    placementId: string,
    direction: 'up' | 'down',
  ) => Promise<void>;
  onCreateCustomSection?: (title: string) => Promise<void>;
  onDeleteCustomSection?: (sectionId: string) => Promise<void>;
  onStatus?: (message: string) => void;
}

/**
 * Left column: template preview. Photo shows beside the header when the
 * applied 基本信息 card has an uploaded portrait.
 */
export function ResumeCanvas({
  resume,
  profile,
  connectionError,
  onDropModule,
  onDeletePlacement,
  onMovePlacement,
  onCreateCustomSection,
  onDeleteCustomSection,
  onStatus,
}: ResumeCanvasProps) {
  const customSectionIds = useMemo(
    () => (resume?.customSections ?? []).map((s) => s.id),
    [resume?.customSections],
  );
  const [newSectionOpen, setNewSectionOpen] = useState(false);
  const [creatingSection, setCreatingSection] = useState(false);

  if (connectionError) {
    return (
      <main className="canvas">
        <div className="canvas__page canvas__empty">
          <h2>服务未连接</h2>
          <p>
            请运行 <code>npm run app</code> 或 <code>npm run dev:server</code>
          </p>
        </div>
      </main>
    );
  }

  if (!resume) {
    return (
      <main className="canvas">
        <div className="canvas__page canvas__empty">
          <h2>尚无简历</h2>
          <p>点击顶部「选择简历模板」初始化左侧空白模板。</p>
        </div>
      </main>
    );
  }

  const name = profile?.name?.trim() || '';
  const summary = profile?.summary?.trim() || '';
  const contactParts = [
    profile?.location,
    profile?.phone,
    profile?.email,
    profile?.wechat ? `微信: ${profile.wechat}` : undefined,
    profile?.expectedSalary?.trim()
      ? `期望薪资: ${profile.expectedSalary.trim()}`
      : undefined,
    profile?.targetCity?.trim()
      ? `目标城市: ${profile.targetCity.trim()}`
      : undefined,
    profile?.hobbies?.trim() ? `爱好: ${profile.hobbies.trim()}` : undefined,
  ].filter(Boolean);
  const showPhoto = Boolean(profile?.hasPhoto && profile.id);
  const customSections = [...(resume.customSections ?? [])].sort(
    (a, b) => a.sortOrder - b.sortOrder,
  );

  const submitNewCustomSection = async (raw: string) => {
    const trimmed = raw.trim();
    if (!trimmed) {
      onStatus?.('栏目标题不能为空');
      return;
    }
    if (!onCreateCustomSection) return;
    setCreatingSection(true);
    try {
      await onCreateCustomSection(trimmed);
      setNewSectionOpen(false);
    } finally {
      setCreatingSection(false);
    }
  };

  return (
    <main className="canvas">
      <div className="canvas__page">
        <header className="canvas__hero">
          {showPhoto && profile && (
            <div className="canvas__photo">
              <img
                src={api.profilePhotoUrl(profile.id, profile.updatedAt)}
                alt="证件照"
              />
            </div>
          )}
          <div className="canvas__identity">
            <p className={`canvas__name${name ? '' : ' canvas__ph'}`}>
              {name || '姓名'}
            </p>
            <p className={`canvas__tagline${summary ? '' : ' canvas__ph'}`}>
              {summary ? (
                <>
                  <strong className="canvas__role-label">
                    {TARGET_ROLE_PREFIX}
                  </strong>
                  <span className="canvas__role-value">{summary}</span>
                </>
              ) : (
                '应聘岗位（在「基本信息」中填写）'
              )}
            </p>
            <p
              className={`canvas__contact${
                contactParts.length ? '' : ' canvas__ph'
              }`}
            >
              {contactParts.length
                ? contactParts.join(' | ')
                : '地区 | 手机 | 邮箱（应用到简历后显示）'}
            </p>
          </div>
        </header>

        <CanvasSection title={PERSONAL_STATEMENT_LABEL}>
          {!profile || !profile.statement?.trim() ? (
            <p className="canvas__hint canvas__ph">
              个人陈述占位 — 在右侧「基本信息」填写并应用到简历
            </p>
          ) : (
            <div className="canvas__statement">
              {profile.statement
                .split(/\n/)
                .map((l) => l.trim())
                .filter(Boolean)
                .map((line, i) => (
                  <p
                    key={`${i}-${line.slice(0, 24)}`}
                    className="canvas__body"
                  >
                    {line}
                  </p>
                ))}
            </div>
          )}
        </CanvasSection>

        <CanvasSection title="教育背景">
          {!profile || profile.education.length === 0 ? (
            <p className="canvas__hint canvas__ph">
              教育背景占位 — 在右侧「基本信息」填写并应用到简历
            </p>
          ) : (
            <div className="canvas__edu">
              {profile.education.map((edu) => {
                const range =
                  edu.timeRange ||
                  educationTimeRange(edu.startDate, edu.endDate);
                const major = [edu.degree, edu.major]
                  .filter(Boolean)
                  .join(' · ');
                const detail = [
                  edu.gpa ? `GPA：${edu.gpa}` : null,
                  edu.rank || null,
                  edu.courses ? `课程：${edu.courses}` : null,
                ]
                  .filter(Boolean)
                  .join('；');
                return (
                  <div key={edu.id} className="canvas__edu-preview">
                    <div className="canvas__entry">
                      <span className="canvas__entry-title">
                        {edu.school || '学校'}
                      </span>
                      <span className="canvas__entry-mid">{major}</span>
                      <span className="canvas__entry-right">{range}</span>
                    </div>
                    {detail && (
                      <p className="canvas__body">{detail}</p>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CanvasSection>

        <CanvasSection title="技术能力">
          {!profile || profile.skills.length === 0 ? (
            <p className="canvas__hint canvas__ph">
              技术能力占位 — 在基本信息中添加「标题 + 正文」能力块
            </p>
          ) : (
            <div className="canvas__skills">
              {profile.skills.map((s: SkillBlock) => (
                <p key={s.id} className="canvas__skill-line">
                  <strong>{s.title}</strong>
                  {s.body ? `：${s.body}` : ''}
                </p>
              ))}
            </div>
          )}
        </CanvasSection>

        <PlaceableSection
          sectionId="projects"
          title={SECTION_LABELS.projects}
          resume={resume}
          customSectionIds={customSectionIds}
          onDropModule={onDropModule}
          onDeletePlacement={onDeletePlacement}
          onMovePlacement={onMovePlacement}
          onStatus={onStatus}
        />
        <PlaceableSection
          sectionId="internships"
          title={SECTION_LABELS.internships}
          resume={resume}
          customSectionIds={customSectionIds}
          onDropModule={onDropModule}
          onDeletePlacement={onDeletePlacement}
          onMovePlacement={onMovePlacement}
          onStatus={onStatus}
        />
        <PlaceableSection
          sectionId="campuses"
          title={SECTION_LABELS.campuses}
          resume={resume}
          customSectionIds={customSectionIds}
          onDropModule={onDropModule}
          onDeletePlacement={onDeletePlacement}
          onMovePlacement={onMovePlacement}
          onStatus={onStatus}
        />
        <PlaceableSection
          sectionId="awards"
          title={SECTION_LABELS.awards}
          resume={resume}
          customSectionIds={customSectionIds}
          onDropModule={onDropModule}
          onDeletePlacement={onDeletePlacement}
          onMovePlacement={onMovePlacement}
          onStatus={onStatus}
        />

        {customSections.map((sec) => (
          <PlaceableSection
            key={sec.id}
            sectionId={sec.id}
            title={sec.title}
            resume={resume}
            customSectionIds={customSectionIds}
            allowAnyPlaceable
            onDropModule={onDropModule}
            onDeletePlacement={onDeletePlacement}
            onMovePlacement={onMovePlacement}
            onStatus={onStatus}
            onDeleteSection={
              onDeleteCustomSection
                ? () => void onDeleteCustomSection(sec.id)
                : undefined
            }
          />
        ))}

        {onCreateCustomSection && (
          <div className="canvas__section-toolbar">
            <button
              type="button"
              className="canvas__new-section"
              onClick={() => setNewSectionOpen(true)}
            >
              新建栏目
            </button>
          </div>
        )}
      </div>

      <PromptDialog
        open={newSectionOpen}
        title="新建栏目"
        label="栏目标题"
        defaultValue="自定义栏目"
        confirmLabel="创建"
        busy={creatingSection}
        onCancel={() => {
          if (!creatingSection) setNewSectionOpen(false);
        }}
        onConfirm={(value) => {
          void submitNewCustomSection(value);
        }}
      />
    </main>
  );
}

function CanvasSection({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="canvas__section">
      <h2>{title}</h2>
      {children}
    </section>
  );
}

function PlaceableSection({
  sectionId,
  title,
  resume,
  customSectionIds,
  allowAnyPlaceable = false,
  onDropModule,
  onDeletePlacement,
  onMovePlacement,
  onStatus,
  onDeleteSection,
}: {
  sectionId: string;
  title: string;
  resume: ResumeDocument;
  customSectionIds: readonly string[];
  allowAnyPlaceable?: boolean;
  onDropModule: (section: string, moduleId: string) => Promise<void>;
  onDeletePlacement: (placementId: string) => Promise<void>;
  onMovePlacement: (
    section: string,
    placementId: string,
    direction: 'up' | 'down',
  ) => Promise<void>;
  onStatus?: (message: string) => void;
  onDeleteSection?: () => void;
}) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const zone = useDropZone<HTMLDivElement>(
    sectionId,
    {
      onAccept: (moduleId) => void onDropModule(sectionId, moduleId),
      onReject: (message) => onStatus?.(message),
    },
    customSectionIds,
  );
  const items = placementsForSection(resume, sectionId);
  const orderedIds = items.map((p) => p.id);

  if (!allowAnyPlaceable && !isBuiltinPlaceableSection(sectionId)) return null;

  return (
    <section className="canvas__section" data-section={sectionId}>
      <div className="canvas__section-head">
        <h2>{title}</h2>
        {onDeleteSection && (
          <button
            type="button"
            className="canvas__section-delete"
            title="删除栏目"
            onClick={() => setConfirmDelete(true)}
          >
            删栏
          </button>
        )}
      </div>
      <ConfirmDialog
        open={confirmDelete}
        title="删除栏目"
        message={`删除栏目「${title}」？其中的条目也会一并移除。`}
        confirmLabel="删除"
        onCancel={() => setConfirmDelete(false)}
        onConfirm={() => {
          setConfirmDelete(false);
          onDeleteSection?.();
        }}
      />
      <div
        ref={zone.ref}
        className={dropZoneClassName('canvas__drop', zone)}
        onClick={(e) => {
          const t = e.target;
          if (
            t instanceof Element &&
            t.closest('.canvas__item-toolbar, button, a, input')
          ) {
            return;
          }
          zone.placePicked();
        }}
      >
        {items.length === 0 ? (
          <p className="canvas__drop-hint">
            将右侧匹配记录拖入此处
          </p>
        ) : (
          items.map((p) => (
            <PlacementRow
              key={p.id}
              placement={p}
              canUp={canMovePlacement(orderedIds, p.id, 'up')}
              canDown={canMovePlacement(orderedIds, p.id, 'down')}
              onUp={() => void onMovePlacement(sectionId, p.id, 'up')}
              onDown={() => void onMovePlacement(sectionId, p.id, 'down')}
              onDelete={() => void onDeletePlacement(p.id)}
            />
          ))
        )}
      </div>
    </section>
  );
}

function PlacementRow({
  placement,
  canUp,
  canDown,
  onUp,
  onDown,
  onDelete,
}: {
  placement: SectionPlacement;
  canUp: boolean;
  canDown: boolean;
  onUp: () => void;
  onDown: () => void;
  onDelete: () => void;
}) {
  const s = placement.snapshot;
  const view = placementDisplayFields(s, placement.section);
  const isWideMid =
    placement.section === 'internships' || placement.section === 'campuses';

  if (view.awardLine !== undefined) {
    return (
      <article className="canvas__item">
        <div
          className="canvas__item-toolbar"
          onPointerDown={(e) => e.stopPropagation()}
          onMouseDown={(e) => e.stopPropagation()}
        >
          <button type="button" disabled={!canUp} onClick={onUp}>
            ↑
          </button>
          <button type="button" disabled={!canDown} onClick={onDown}>
            ↓
          </button>
          <button type="button" onClick={onDelete}>
            删
          </button>
        </div>
        <p className="canvas__body">{view.awardLine}</p>
      </article>
    );
  }

  return (
    <article className="canvas__item">
      <div
        className="canvas__item-toolbar"
        onPointerDown={(e) => e.stopPropagation()}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <button type="button" disabled={!canUp} onClick={onUp}>
          ↑
        </button>
        <button type="button" disabled={!canDown} onClick={onDown}>
          ↓
        </button>
        <button type="button" onClick={onDelete}>
          删
        </button>
      </div>
      <div
        className={
          isWideMid ? 'canvas__entry canvas__entry--intern' : 'canvas__entry'
        }
      >
        <span className="canvas__entry-title">{view.title}</span>
        <span className="canvas__entry-mid">
          {view.projectType ? (
            <span className="canvas__entry-tech">{view.projectType}</span>
          ) : null}
          {view.projectType && view.subtitle ? ' · ' : null}
          {view.subtitle ? (
            <span className="canvas__entry-duty">{view.subtitle}</span>
          ) : null}
        </span>
        <span className="canvas__entry-right">{view.timeRange}</span>
      </div>
      {view.bodyLines.map((line, i) => (
        <p key={`${i}-${line.slice(0, 24)}`} className="canvas__body">
          {line}
        </p>
      ))}
    </article>
  );
}
