import { useCallback, useEffect, useMemo, useState } from 'react';
import type { Category, ContentModule } from '@resume/domain';
import { CATEGORIES } from '@resume/domain';
import { api } from '../../api/client';
import { setModuleDragData, clearModuleDrag } from '../dnd/dragPayload';
import './library.css';

export interface LibrarySidebarProps {
  refreshKey?: number;
  onStatus?: (message: string) => void;
}

const CATEGORY_LABEL: Record<Category, string> = {
  skill: '技术能力',
  project: '项目经历',
  internship: '实习经历',
  award: '获奖证书',
};

/**
 * Content library: tag/category/q filter + HTML5 drag sources (S2).
 */
export function LibrarySidebar({ refreshKey = 0, onStatus }: LibrarySidebarProps) {
  const [modules, setModules] = useState<ContentModule[]>([]);
  const [category, setCategory] = useState<string>('');
  const [tag, setTag] = useState('');
  const [q, setQ] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const list = await api.listModules({
        category: category || undefined,
        tag: tag.trim() || undefined,
        q: q.trim() || undefined,
      });
      setModules(list);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(msg);
      onStatus?.(`内容库加载失败: ${msg}`);
    } finally {
      setLoading(false);
    }
  }, [category, tag, q, onStatus]);

  useEffect(() => {
    void load();
  }, [load, refreshKey]);

  const hint = useMemo(
    () =>
      modules.length === 0
        ? '无匹配模块。可改标签过滤，或先「写入演示数据」。'
        : `共 ${modules.length} 条 · 拖到右侧对应区块`,
    [modules.length],
  );

  return (
    <aside className="library">
      <h2 className="library__title">内容库</h2>
      <p className="library__hint">按标签检索（无 JD）。拖拽模块到简历匹配区块。</p>

      <div className="library__filters">
        <label className="library__field">
          <span>大类</span>
          <select
            value={category}
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
            onChange={(e) => setTag(e.target.value)}
          />
        </label>
        <label className="library__field">
          <span>关键字</span>
          <input
            type="search"
            placeholder="标题/正文"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </label>
        <button
          type="button"
          className="library__refresh"
          disabled={loading}
          onClick={() => void load()}
        >
          {loading ? '加载中…' : '刷新'}
        </button>
      </div>

      <p className="library__meta-line">{error ?? hint}</p>

      <ul className="library__list">
        {modules.map((m) => (
          <li
            key={m.id}
            className="library__item"
            draggable
            onDragStart={(e) => {
              setModuleDragData(e.dataTransfer, m.id, m.category);
              onStatus?.(`拖拽中: ${m.title}`);
            }}
            onDragEnd={() => clearModuleDrag()}
          >
            <div className="library__item-top">
              <span className="library__cat">{CATEGORY_LABEL[m.category]}</span>
              <span className="library__drag">拖</span>
            </div>
            <strong className="library__item-title">{m.title}</strong>
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
    </aside>
  );
}
