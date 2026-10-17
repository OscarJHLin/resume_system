import { useCallback, useEffect, useMemo, useState } from 'react';
import type { Category, ContentModule } from '@resume/domain';
import { CATEGORIES } from '@resume/domain';
import { api } from '../../api/client';
import { startModulePointerDrag } from '../dnd/pointerDrag';
import { ModuleEditor } from './ModuleEditor';
import './library.css';

export interface LibrarySidebarProps {
  refreshKey?: number;
  disabled?: boolean;
  onStatus?: (message: string) => void;
  onCountChange?: (count: number) => void;
}

const CATEGORY_LABEL: Record<Category, string> = {
  skill: '技术能力',
  project: '项目经历',
  internship: '实习经历',
  campus: '校园经历',
  award: '获奖证书',
  custom: '自定义',
};

/**
 * Content library: tag filter + drag sources + create/edit form (S4+).
 */
export function LibrarySidebar({
  refreshKey = 0,
  disabled = false,
  onStatus,
  onCountChange,
}: LibrarySidebarProps) {
  const [modules, setModules] = useState<ContentModule[]>([]);
  const [category, setCategory] = useState<string>('');
  const [tag, setTag] = useState('');
  const [q, setQ] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<ContentModule | null>(null);

  const load = useCallback(async () => {
    if (disabled) {
      setError('API 未连接');
      setModules([]);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const list = await api.listModules({
        category: category || undefined,
        tag: tag.trim() || undefined,
        q: q.trim() || undefined,
      });
      setModules(list);
      if (!category && !tag.trim() && !q.trim()) {
        onCountChange?.(list.length);
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(msg);
      onStatus?.(`内容库加载失败: ${msg}`);
    } finally {
      setLoading(false);
    }
  }, [category, tag, q, onStatus, onCountChange, disabled]);

  useEffect(() => {
    void load();
  }, [load, refreshKey]);

  const hint = useMemo(() => {
    if (disabled) return '服务未连接，无法加载内容库。';
    if (modules.length === 0) {
      return '无匹配模块。可「新建模块」或改过滤条件。';
    }
    return `共 ${modules.length} 条 · 拖到右侧 / 点编辑`;
  }, [modules.length, disabled]);

  return (
    <aside className={`library${disabled ? ' library--disabled' : ''}`}>
      <div className="library__title-row">
        <h2 className="library__title">内容库</h2>
        <button
          type="button"
          className="library__new"
          disabled={disabled}
          onClick={() => {
            setEditing(null);
            setEditorOpen(true);
          }}
        >
          新建模块
        </button>
      </div>
      <p className="library__hint">
        按标签检索（无 JD）。新建/编辑入库后可拖拽到简历匹配区块。
      </p>

      <div className="library__filters">
        <label className="library__field">
          <span>大类</span>
          <select
            value={category}
            disabled={disabled}
            onChange={(e) => setCategory(e.target.value)}
          >
            <option value="">全部</option>
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {CATEGORY_LABEL[c]}
              </option>
            ))}
          </select>
        </label>
        <label className="library__field">
          <span>标签</span>
          <input
            type="search"
            placeholder="如 TypeScript"
            value={tag}
            disabled={disabled}
            onChange={(e) => setTag(e.target.value)}
          />
        </label>
        <label className="library__field">
          <span>关键字</span>
          <input
            type="search"
            placeholder="标题/正文"
            value={q}
            disabled={disabled}
            onChange={(e) => setQ(e.target.value)}
          />
        </label>
        <button
          type="button"
          className="library__refresh"
          disabled={loading || disabled}
          onClick={() => void load()}
        >
          {loading ? '加载中…' : '刷新'}
        </button>
      </div>

      <p className="library__meta-line">{error ?? hint}</p>

      {!disabled && modules.length === 0 && !loading && !error && (
        <div className="library__empty">内容库为空或过滤无结果</div>
      )}

      <ul className="library__list">
        {modules.map((m) => (
          <li
            key={m.id}
            className="library__item"
            onDragStart={(e) => e.preventDefault()}
            onPointerDown={(e) => {
              if (disabled) return;
              startModulePointerDrag(
                e,
                { moduleId: m.id, category: m.category },
                m.title,
              );
            }}
          >
            <div className="library__item-top">
              <span className="library__cat">{CATEGORY_LABEL[m.category]}</span>
              <span className="library__item-actions">
                <button
                  type="button"
                  className="library__edit"
                  disabled={disabled}
                  onClick={(e) => {
                    e.stopPropagation();
                    setEditing(m);
                    setEditorOpen(true);
                  }}
                >
                  编辑
                </button>
                <span className="library__drag">拖</span>
              </span>
            </div>
            <strong className="library__item-title">{m.title}</strong>
            {m.timeRange && (
              <p className="library__time">{m.timeRange}</p>
            )}
            {m.tags.length > 0 && (
              <div className="library__tags">
                {m.tags.map((t) => (
                  <button
                    key={t}
                    type="button"
                    className="library__tag"
                    onClick={() => setTag(t)}
                  >
                    {t}
                  </button>
                ))}
              </div>
            )}
          </li>
        ))}
      </ul>

      <ModuleEditor
        open={editorOpen}
        editing={editing}
        onClose={() => setEditorOpen(false)}
        onSaved={() => {
          void load();
        }}
        onStatus={onStatus}
      />
    </aside>
  );
}
