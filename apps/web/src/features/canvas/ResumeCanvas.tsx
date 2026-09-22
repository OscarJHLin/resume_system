import { useRef, useState, type ReactNode } from 'react';
import type {
  Profile,
  ResumeDocument,
  SectionId,
  SectionPlacement,
} from '@resume/domain';
import {
  SECTION_LABELS,
  decideModuleDrop,
  isPlaceableSection,
} from '@resume/domain';
import { api } from '../../api/client';
import {
  clearModuleDrag,
  dropZoneClassName,
  readModuleDragData,
} from '../dnd/dragPayload';
import { placementsForSection } from '../editor/docModel';
import { canMovePlacement } from '../editor/placementOrder';
import './resumeCanvas.css';

export interface ResumeCanvasProps {
  resume: ResumeDocument | null;
  profile: Profile | null;
  connectionError?: boolean;
  onProfileChange: (profile: Profile) => void;
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
 * Left column: lin-v1-looking resume template surface (wireframe).
 * Export SoT remains placements → IR; this canvas is interactive preview + profile edit.
 */
export function ResumeCanvas({
  resume,
  profile,
  connectionError,
  onProfileChange,
  onDropModule,
  onDeletePlacement,
  onMovePlacement,
  onStatus,
}: ResumeCanvasProps) {
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

  if (!resume || !profile) {
    return (
      <main className="canvas">
        <div className="canvas__page canvas__empty">
          <h2>尚无简历</h2>
          <p>点击顶部「演示数据」生成样例，或先在右侧新建模块。</p>
        </div>
      </main>
    );
  }

  return (
    <main className="canvas">
      <div className="canvas__page">
        <header className="canvas__hero">
          <PhotoBlock
            profile={profile}
            onProfileChange={onProfileChange}
            onStatus={onStatus}
          />
          <div className="canvas__identity">
            <input
              className="canvas__name"
              value={profile.name}
              aria-label="姓名"
              onBlur={(e) =>
                void saveProfile(
                  { ...profile, name: e.target.value },
                  onProfileChange,
                  onStatus,
                )
              }
              onChange={(e) =>
                onProfileChange({ ...profile, name: e.target.value })
              }
            />
            <input
              className="canvas__tagline"
              value={profile.summary ?? ''}
              placeholder="标语 / 定位（可留空）"
              aria-label="标语"
              onBlur={(e) =>
                void saveProfile(
                  { ...profile, summary: e.target.value },
                  onProfileChange,
                  onStatus,
                )
              }
              onChange={(e) =>
                onProfileChange({ ...profile, summary: e.target.value })
              }
            />
            <div className="canvas__contact-row">
              <input
                placeholder="城市"
                value={profile.location ?? ''}
                onBlur={(e) =>
                  void saveProfile(
                    { ...profile, location: e.target.value },
                    onProfileChange,
                    onStatus,
                  )
                }
                onChange={(e) =>
                  onProfileChange({ ...profile, location: e.target.value })
                }
              />
              <span>|</span>
              <input
                placeholder="电话"
                value={profile.phone ?? ''}
                onBlur={(e) =>
                  void saveProfile(
                    { ...profile, phone: e.target.value },
                    onProfileChange,
                    onStatus,
                  )
                }
                onChange={(e) =>
                  onProfileChange({ ...profile, phone: e.target.value })
                }
              />
              <span>|</span>
              <input
                placeholder="邮箱"
                value={profile.email ?? ''}
                onBlur={(e) =>
                  void saveProfile(
                    { ...profile, email: e.target.value },
                    onProfileChange,
                    onStatus,
                  )
                }
                onChange={(e) =>
                  onProfileChange({ ...profile, email: e.target.value })
                }
              />
            </div>
          </div>
        </header>

        <CanvasSection title="基本信息">
          <p className="canvas__hint">上方姓名 / 标语 / 联系方式即基本信息，修改后自动保存。</p>
        </CanvasSection>

        <CanvasSection title="教育背景">
          <EducationEditor
            profile={profile}
            onProfileChange={onProfileChange}
            onStatus={onStatus}
          />
        </CanvasSection>

        <PlaceableSection
          sectionId="skills"
          title="技术能力"
          resume={resume}
          onDropModule={onDropModule}
          onDeletePlacement={onDeletePlacement}
          onMovePlacement={onMovePlacement}
          onStatus={onStatus}
        />
        <PlaceableSection
          sectionId="projects"
          title="项目"
          resume={resume}
          onDropModule={onDropModule}
          onDeletePlacement={onDeletePlacement}
          onMovePlacement={onMovePlacement}
          onStatus={onStatus}
        />
        <PlaceableSection
          sectionId="internships"
          title="实习"
          resume={resume}
          onDropModule={onDropModule}
          onDeletePlacement={onDeletePlacement}
          onMovePlacement={onMovePlacement}
          onStatus={onStatus}
        />
        <PlaceableSection
          sectionId="awards"
          title={SECTION_LABELS.awards}
          resume={resume}
          onDropModule={onDropModule}
          onDeletePlacement={onDeletePlacement}
          onMovePlacement={onMovePlacement}
          onStatus={onStatus}
        />
      </div>
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

function PhotoBlock({
  profile,
  onProfileChange,
  onStatus,
}: {
  profile: Profile;
  onProfileChange: (p: Profile) => void;
  onStatus?: (m: string) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const src = profile.hasPhoto
    ? api.profilePhotoUrl(profile.updatedAt)
    : undefined;

  return (
    <div className="canvas__photo">
      {src ? (
        <img src={src} alt="证件照" />
      ) : (
        <button
          type="button"
          className="canvas__photo-ph"
          onClick={() => inputRef.current?.click()}
        >
          照片
        </button>
      )}
      <div className="canvas__photo-actions">
        <button
          type="button"
          disabled={busy}
          onClick={() => inputRef.current?.click()}
        >
          上传
        </button>
        {profile.hasPhoto && (
          <button
            type="button"
            disabled={busy}
            onClick={() => {
              void (async () => {
                setBusy(true);
                try {
                  const p = await api.clearProfilePhoto();
                  onProfileChange(p);
                  onStatus?.('已移除照片');
                } catch (e) {
                  onStatus?.(
                    `移除失败: ${e instanceof Error ? e.message : String(e)}`,
                  );
                } finally {
                  setBusy(false);
                }
              })();
            }}
          >
            清除
          </button>
        )}
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        hidden
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = '';
          if (!file) return;
          void (async () => {
            setBusy(true);
            try {
              const dataUrl = await readFileAsDataUrl(file);
              const p = await api.uploadProfilePhoto(dataUrl, file.type);
              onProfileChange(p);
              onStatus?.('照片已保存');
            } catch (err) {
              onStatus?.(
                `上传失败: ${err instanceof Error ? err.message : String(err)}`,
              );
            } finally {
              setBusy(false);
            }
          })();
        }}
      />
    </div>
  );
}

function EducationEditor({
  profile,
  onProfileChange,
  onStatus,
}: {
  profile: Profile;
  onProfileChange: (p: Profile) => void;
  onStatus?: (m: string) => void;
}) {
  const list = profile.education;

  const persist = (education: Profile['education']) =>
    void saveProfile({ ...profile, education }, onProfileChange, onStatus);

  return (
    <div className="canvas__edu">
      {list.length === 0 && (
        <p className="canvas__hint">暂无教育经历，点击下方添加。</p>
      )}
      {list.map((edu, idx) => (
        <div key={edu.id || idx} className="canvas__edu-row">
          <input
            placeholder="学校"
            value={edu.school}
            onChange={(e) => {
              const next = [...list];
              next[idx] = { ...edu, school: e.target.value };
              persist(next);
            }}
          />
          <input
            placeholder="学位 / 专业"
            value={[edu.degree, edu.major].filter(Boolean).join(' · ')}
            onChange={(e) => {
              const parts = e.target.value.split('·').map((s) => s.trim());
              const next = [...list];
              next[idx] = {
                ...edu,
                degree: parts[0] || undefined,
                major: parts.slice(1).join(' · ') || undefined,
              };
              persist(next);
            }}
          />
          <input
            placeholder="时间"
            value={edu.timeRange ?? ''}
            onChange={(e) => {
              const next = [...list];
              next[idx] = { ...edu, timeRange: e.target.value };
              persist(next);
            }}
          />
          <button
            type="button"
            className="canvas__mini"
            onClick={() => persist(list.filter((_, i) => i !== idx))}
          >
            删
          </button>
        </div>
      ))}
      <button
        type="button"
        className="canvas__mini"
        onClick={() =>
          persist([
            ...list,
            { id: '', school: '', degree: '', major: '', timeRange: '' },
          ])
        }
      >
        + 教育经历
      </button>
    </div>
  );
}

function PlaceableSection({
  sectionId,
  title,
  resume,
  onDropModule,
  onDeletePlacement,
  onMovePlacement,
  onStatus,
}: {
  sectionId: SectionId;
  title: string;
  resume: ResumeDocument;
  onDropModule: (section: SectionId, moduleId: string) => Promise<void>;
  onDeletePlacement: (placementId: string) => Promise<void>;
  onMovePlacement: (
    section: SectionId,
    placementId: string,
    direction: 'up' | 'down',
  ) => Promise<void>;
  onStatus?: (message: string) => void;
}) {
  const [hover, setHover] = useState(false);
  const [invalid, setInvalid] = useState(false);
  const items = placementsForSection(resume, sectionId);
  const orderedIds = items.map((p) => p.id);

  if (!isPlaceableSection(sectionId)) return null;

  return (
    <section className="canvas__section" data-section={sectionId}>
      <h2>{title}</h2>
      <div
        className={dropZoneClassName('canvas__drop', {
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
          const ok = decideModuleDrop(payload.category, sectionId) === 'accept';
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
            onStatus?.('无法读取拖拽数据');
            return;
          }
          if (decideModuleDrop(payload.category, sectionId) !== 'accept') {
            onStatus?.(`不能将 ${payload.category} 放入「${title}」`);
            return;
          }
          void onDropModule(sectionId, payload.moduleId);
        }}
      >
        {items.length === 0 ? (
          <p className="canvas__drop-hint">将右侧匹配记录拖入此处</p>
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
  return (
    <article className="canvas__item">
      <div className="canvas__item-head">
        <strong>{s.title}</strong>
        <span className="canvas__muted">{s.timeRange}</span>
        <span className="canvas__item-actions">
          <button type="button" disabled={!canUp} onClick={onUp}>
            ↑
          </button>
          <button type="button" disabled={!canDown} onClick={onDown}>
            ↓
          </button>
          <button type="button" onClick={onDelete}>
            删
          </button>
        </span>
      </div>
      {(s.subtitle || s.projectType) && (
        <p className="canvas__muted">
          {[s.subtitle, s.projectType].filter(Boolean).join(' · ')}
        </p>
      )}
      {s.body && <pre className="canvas__body">{s.body}</pre>}
    </article>
  );
}

async function saveProfile(
  draft: Profile,
  onProfileChange: (p: Profile) => void,
  onStatus?: (m: string) => void,
) {
  try {
    const saved = await api.putProfile({
      name: draft.name || '未命名',
      phone: draft.phone,
      email: draft.email,
      location: draft.location,
      summary: draft.summary,
      education: draft.education,
    });
    onProfileChange(saved);
  } catch (e) {
    onStatus?.(`保存资料失败: ${e instanceof Error ? e.message : String(e)}`);
  }
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error ?? new Error('read failed'));
    reader.readAsDataURL(file);
  });
}
