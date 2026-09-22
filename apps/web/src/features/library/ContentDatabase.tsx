import { useCallback, useEffect, useMemo, useState } from 'react';
import type {
  ContentModule,
  LibraryModuleCategory,
  Profile,
} from '@resume/domain';
import { api } from '../../api/client';
import { clearModuleDrag, setModuleDragData } from '../dnd/dragPayload';
import { ModuleEditor } from './ModuleEditor';
import { ProfileEditor } from './ProfileEditor';
import { profileCardSummary } from './profileForm';
import './contentDatabase.css';

export interface ContentDatabaseProps {
  refreshKey?: number;
  disabled?: boolean;
  appliedProfileId?: string;
  onStatus?: (message: string) => void;
  onCountChange?: (count: number) => void;
  onApplyProfile?: (profileId: string) => Promise<void>;
  onProfilesChanged?: () => void;
}

type TabId = LibraryModuleCategory | 'profile';

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

  return (
    <aside className={`cdb${disabled ? ' cdb--disabled' : ''}`}>
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

      {tab === 'profile' ? (
        <ul className="cdb__list">
          {profiles.map((p) => (
            <li key={p.id} className="cdb__card cdb__card--profile">
              <div className="cdb__card-row">
                <span className="cdb__field cdb__title">{p.name}</span>
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
              <div className="cdb__card-actions">
                <button
                  type="button"
                  className="cdb__edit"
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
                  className="cdb__edit cdb__edit--primary"
                  disabled={disabled || !onApplyProfile}
                  onClick={() => {
                    void onApplyProfile?.(p.id);
                  }}
                >
                  应用到简历
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
                setModuleDragData(e.dataTransfer, m.id, m.category);
                onStatus?.(`拖拽中: ${m.title}`);
              }}
              onDragEnd={() => clearModuleDrag()}
            >
              <div className="cdb__card-row">
                <span className="cdb__field cdb__title">{m.title}</span>
                <span className="cdb__field cdb__time">
                  {m.timeRange || '时间'}
                </span>
              </div>
              <div className="cdb__field cdb__stack">
                {m.projectType || m.subtitle || '技术栈'}
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
              <button
                type="button"
                className="cdb__edit"
                disabled={disabled}
                onClick={(e) => {
                  e.stopPropagation();
                  setEditing(m);
                  setEditorOpen(true);
                }}
              >
                编辑
              </button>
            </li>
          ))}
        </ul>
      )}

      <ModuleEditor
        open={editorOpen}
        editing={editing}
        defaultCategory={createCategory}
        onClose={() => setEditorOpen(false)}
        onSaved={() => {
          void load();
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
    </aside>
  );
}
