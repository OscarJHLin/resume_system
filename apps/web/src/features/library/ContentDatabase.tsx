import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ContentModule,
  LibraryModuleCategory,
  Profile,
  displayModuleTimeRange,
} from '@resume/domain';
import { api } from '../../api/client';
import {
  finishModuleDrag,
  pickModuleForPlace,
  setModuleDragData,
} from '../dnd/dragPayload';
import { ConfirmDialog } from './ConfirmDialog';
import { ModuleEditor } from './ModuleEditor';
import { ProfileEditor } from './ProfileEditor';
import { profileCardSummary } from './profileForm';
import {
  deleteModuleConfirmMessage,
  deleteModuleConfirmTitle,
  deleteProfileConfirmMessage,
  deleteProfileConfirmTitle,
  stopCardActionPointer,
} from './libraryDelete';
import './contentDatabase.css';

export interface ContentDatabaseProps {
  refreshKey?: number;
  disabled?: boolean;
  appliedProfileId?: string;
  onStatus?: (message: string) => void;
  onCountChange?: (count: number) => void;
  onApplyProfile?: (profileId: string) => Promise<void>;
  onProfilesChanged?: () => void;
  /** After module create/update — refresh resume so synced snapshots appear. */
  onModulesChanged?: () => void;
}

type TabId = LibraryModuleCategory | 'profile';

type PendingDelete =
  | { kind: 'module'; item: ContentModule }
  | { kind: 'profile'; item: Profile; applied: boolean };

const TABS: Array<{ id: TabId; label: string }> = [
  { id: 'project', label: '项目' },
  { id: 'internship', label: '实习' },
  { id: 'award', label: '获奖与证书' },
  { id: 'profile', label: '基本信息' },
];

/**
 * Right column: 4 tabs — 项目 / 实习 / 获奖与证书 / 基本信息.
 * Active tab drives + create type.
 */
export function ContentDatabase({
  refreshKey = 0,
  disabled = false,
  appliedProfileId,
  onStatus,
  onCountChange,
  onApplyProfile,
  onProfilesChanged,
  onModulesChanged,
}: ContentDatabaseProps) {
  const [modules, setModules] = useState<ContentModule[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [tab, setTab] = useState<TabId>('project');
  const [q, setQ] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<ContentModule | null>(null);
  const [createCategory, setCreateCategory] =
    useState<LibraryModuleCategory>('project');
  const [profileEditorOpen, setProfileEditorOpen] = useState(false);
  const [editingProfile, setEditingProfile] = useState<Profile | null>(null);
  const [highlightProfileId, setHighlightProfileId] = useState<string | null>(
    null,
  );
  const [pendingDelete, setPendingDelete] = useState<PendingDelete | null>(
    null,
  );
  const [deleteBusy, setDeleteBusy] = useState(false);

  const load = useCallback(async () => {
    if (disabled) {
      setError('API 未连接');
      setModules([]);
      setProfiles([]);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      if (tab === 'profile') {
        const list = await api.listProfiles({ q: q.trim() || undefined });
        setProfiles(list);
        setModules([]);
        onCountChange?.(list.length);
      } else {
        const list = await api.listModules({
          category: tab,
          q: q.trim() || undefined,
        });
        setModules(list);
        setProfiles([]);
        onCountChange?.(list.length);
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(msg);
      onStatus?.(`内容库加载失败: ${msg}`);
    } finally {
      setLoading(false);
    }
  }, [disabled, tab, q, onCountChange, onStatus]);

  useEffect(() => {
    void load();
  }, [load, refreshKey]);

  useEffect(() => {
    if (!highlightProfileId || tab !== 'profile') return;
    const el = document.querySelector(
      `[data-profile-id="${CSS.escape(highlightProfileId)}"]`,
    );
    if (el instanceof HTMLElement) {
      el.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
    const t = window.setTimeout(() => setHighlightProfileId(null), 2400);
    return () => window.clearTimeout(t);
  }, [highlightProfileId, profiles, tab]);

  const emptyHint = useMemo(() => {
    if (disabled) return '服务未连接';
    if (loading) return '加载中…';
    if (tab === 'profile') {
      if (profiles.length === 0) return '无基本信息卡。点 + 新建。';
      return `${profiles.length} 张卡 · 点「应用到简历」填充左侧`;
    }
    if (modules.length === 0) return '无记录。点 + 新建，或切换标签。';
    return `${modules.length} 条 · 拖到左侧模板`;
  }, [disabled, loading, tab, modules.length, profiles.length]);

  const openCreate = () => {
    if (tab === 'profile') {
      setEditingProfile(null);
      setProfileEditorOpen(true);
      return;
    }
    setCreateCategory(tab);
    setEditing(null);
    setEditorOpen(true);
  };

  const askDeleteModule = (m: ContentModule) => {
    if (disabled || deleteBusy) return;
    setPendingDelete({ kind: 'module', item: m });
  };

  const askDeleteProfile = (p: Profile) => {
    if (disabled || deleteBusy) return;
    setPendingDelete({
      kind: 'profile',
      item: p,
      applied: appliedProfileId === p.id,
    });
  };

  const executePendingDelete = async () => {
    if (!pendingDelete || deleteBusy) return;
    setDeleteBusy(true);
    try {
      if (pendingDelete.kind === 'module') {
        const m = pendingDelete.item;
        await api.deleteModule(m.id);
        setModules((list) => list.filter((x) => x.id !== m.id));
        if (editing?.id === m.id) {
          setEditorOpen(false);
          setEditing(null);
        }
        onStatus?.(
          `已删除模块：${m.title}（简历上已拖入的条目仍保留快照）`,
        );
        setPendingDelete(null);
        await load();
        onModulesChanged?.();
      } else {
        const p = pendingDelete.item;
        const applied = pendingDelete.applied;
        await api.deleteProfile(p.id);
        setProfiles((list) => list.filter((x) => x.id !== p.id));
        if (editingProfile?.id === p.id) {
          setProfileEditorOpen(false);
          setEditingProfile(null);
        }
        onStatus?.(
          applied
            ? `已删除基本信息卡：${p.name}（已从简历解除应用）`
            : `已删除基本信息卡：${p.name}`,
        );
        setPendingDelete(null);
        await load();
        onProfilesChanged?.();
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      onStatus?.(
        pendingDelete.kind === 'module'
          ? `删除模块失败: ${msg}`
          : `删除基本信息失败: ${msg}`,
      );
    } finally {
      setDeleteBusy(false);
    }
  };

  const onCopyProfile = async (p: Profile) => {
    if (disabled) return;
    try {
      const copy = await api.copyProfile(p.id);
      onStatus?.(`已复制基本信息卡：${copy.name}`);
      await load();
      setHighlightProfileId(copy.id);
      onProfilesChanged?.();
    } catch (e) {
      onStatus?.(
        `复制基本信息失败: ${e instanceof Error ? e.message : String(e)}`,
      );
    }
  };

  const confirmTitle =
    pendingDelete?.kind === 'module'
      ? deleteModuleConfirmTitle()
      : deleteProfileConfirmTitle();
  const confirmMessage =
    pendingDelete?.kind === 'module'
      ? deleteModuleConfirmMessage(pendingDelete.item.title)
      : pendingDelete
        ? deleteProfileConfirmMessage(
            pendingDelete.item.name || '未命名',
            pendingDelete.applied,
          )
        : '';

  return (
    <aside className={`cdb${disabled ? ' cdb--disabled' : ''}`}>
      <div className="cdb__chrome">
        <div className="cdb__search">
          <span className="cdb__search-icon" aria-hidden>
            ⌕
          </span>
          <input
            type="search"
            placeholder="搜索"
            value={q}
            disabled={disabled}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>

        <div className="cdb__tabs">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              className={
                tab === t.id ? 'cdb__tab cdb__tab--active' : 'cdb__tab'
              }
              disabled={disabled}
              onClick={() => setTab(t.id)}
            >
              {t.label}
            </button>
          ))}
          <button
            type="button"
            className="cdb__add"
            disabled={disabled}
            title="新建"
            aria-label="新建"
            onClick={openCreate}
          >
            +
          </button>
        </div>

        <p className="cdb__meta">{error ?? emptyHint}</p>
      </div>

      <div className="cdb__scroll">
        {tab === 'profile' ? (
          <ul className="cdb__list">
            {profiles.map((p) => (
              <li
                key={p.id}
                data-profile-id={p.id}
                className={`cdb__card cdb__card--profile${
                  highlightProfileId === p.id ? ' cdb__card--highlight' : ''
                }`}
              >
                <div className="cdb__card-row">
                  <div className="cdb__profile-head">
                    {p.hasPhoto ? (
                      <img
                        className="cdb__photo-thumb"
                        src={api.profilePhotoUrl(p.id, p.updatedAt)}
                        alt=""
                      />
                    ) : (
                      <span className="cdb__photo-thumb cdb__photo-thumb--empty">
                        无
                      </span>
                    )}
                    <span className="cdb__field cdb__title">{p.name}</span>
                  </div>
                  {appliedProfileId === p.id && (
                    <span className="cdb__badge">已应用</span>
                  )}
                </div>
                <div className="cdb__field cdb__stack">
                  {profileCardSummary(p)}
                </div>
                {p.notes && (
                  <div className="cdb__field cdb__body">{p.notes}</div>
                )}
                <div className="cdb__tags">
                  {(p.tags.length ? p.tags : ['标签']).map((t) => (
                    <span key={t} className="cdb__tag">
                      {t}
                    </span>
                  ))}
                </div>
                <div
                  className="cdb__card-actions"
                  onPointerDown={stopCardActionPointer}
                  onMouseDown={stopCardActionPointer}
                >
                  <button
                    type="button"
                    className="cdb__edit"
                    draggable={false}
                    disabled={disabled}
                    onClick={() => {
                      setEditingProfile(p);
                      setProfileEditorOpen(true);
                    }}
                  >
                    编辑
                  </button>
                  <button
                    type="button"
                    className="cdb__edit"
                    draggable={false}
                    disabled={disabled}
                    onClick={() => {
                      void onCopyProfile(p);
                    }}
                  >
                    复制
                  </button>
                  <button
                    type="button"
                    className="cdb__edit cdb__edit--primary"
                    draggable={false}
                    disabled={disabled || !onApplyProfile}
                    onClick={() => {
                      void onApplyProfile?.(p.id);
                    }}
                  >
                    应用到简历
                  </button>
                  <button
                    type="button"
                    className="cdb__edit cdb__edit--danger"
                    draggable={false}
                    disabled={disabled}
                    onClick={() => askDeleteProfile(p)}
                  >
                    删除
                  </button>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <ul className="cdb__list">
            {modules.map((m) => (
              <li
                key={m.id}
                className="cdb__card"
                draggable={!disabled}
                onDragStart={(e) => {
                  if (disabled) return;
                  const t = e.target;
                  if (
                    t instanceof Element &&
                    t.closest('.cdb__card-actions, button, a, input')
                  ) {
                    e.preventDefault();
                    return;
                  }
                  setModuleDragData(e.dataTransfer, m.id, m.category);
                  onStatus?.(`拖拽中: ${m.title}`);
                }}
                onDragEnd={() => finishModuleDrag()}
              >
                <div className="cdb__card-row">
                  <span className="cdb__field cdb__title">{m.title}</span>
                  <span className="cdb__field cdb__time">
                    {displayModuleTimeRange(m.timeRange) || '时间'}
                  </span>
                </div>
                <div className="cdb__field cdb__stack">
                  {[m.projectType, m.subtitle].filter(Boolean).join(' · ') ||
                    '技术栈 / 职责'}
                </div>
                <div className="cdb__field cdb__body">
                  {m.body.trim() || '正文'}
                </div>
                <div className="cdb__tags">
                  {(m.tags.length ? m.tags : ['标签']).map((t) => (
                    <span key={t} className="cdb__tag">
                      {t}
                    </span>
                  ))}
                </div>
                <div
                  className="cdb__card-actions"
                  onPointerDown={stopCardActionPointer}
                  onMouseDown={stopCardActionPointer}
                >
                  <button
                    type="button"
                    className="cdb__edit cdb__edit--place"
                    draggable={false}
                    disabled={disabled}
                    title="拖拽不可用时：点此选中，再点击左侧简历区块放入"
                    onClick={(e) => {
                      e.stopPropagation();
                      pickModuleForPlace(m.id, m.category);
                      onStatus?.(
                        `已选中「${m.title}」— 点击左侧对应区块放入（也可直接拖拽）`,
                      );
                    }}
                  >
                    放入
                  </button>
                  <button
                    type="button"
                    className="cdb__edit"
                    draggable={false}
                    disabled={disabled}
                    onClick={(e) => {
                      e.stopPropagation();
                      setEditing(m);
                      setEditorOpen(true);
                    }}
                  >
                    编辑
                  </button>
                  <button
                    type="button"
                    className="cdb__edit cdb__edit--danger"
                    draggable={false}
                    disabled={disabled}
                    onClick={(e) => {
                      e.stopPropagation();
                      askDeleteModule(m);
                    }}
                  >
                    删除
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <ModuleEditor
        open={editorOpen}
        editing={editing}
        defaultCategory={createCategory}
        onClose={() => setEditorOpen(false)}
        onSaved={() => {
          void load();
          onModulesChanged?.();
        }}
        onStatus={onStatus}
      />

      <ProfileEditor
        open={profileEditorOpen}
        editing={editingProfile}
        onClose={() => setProfileEditorOpen(false)}
        onSaved={() => {
          void load();
          onProfilesChanged?.();
        }}
        onStatus={onStatus}
      />

      <ConfirmDialog
        open={pendingDelete !== null}
        title={confirmTitle}
        message={confirmMessage}
        busy={deleteBusy}
        onCancel={() => {
          if (!deleteBusy) setPendingDelete(null);
        }}
        onConfirm={() => {
          void executePendingDelete();
        }}
      />
    </aside>
  );
}
