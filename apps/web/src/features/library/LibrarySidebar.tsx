import { CATEGORY_SECTION_MATRIX } from '@resume/domain';
import './library.css';

/** Content library sidebar stub — search + drag sources in S2. */
export function LibrarySidebar() {
  const categories = Object.keys(CATEGORY_SECTION_MATRIX);

  return (
    <aside className="library">
      <h2 className="library__title">内容库</h2>
      <p className="library__hint">
        按大类/标签检索与拖拽将在 S2 实现（无 JD；检索靠用户标签）。大类预览：
      </p>
      <ul className="library__list">
        {categories.map((c) => (
          <li key={c} className="library__item" draggable={false}>
            <span className="library__cat">{c}</span>
            <span className="library__meta">模块占位</span>
          </li>
        ))}
      </ul>
    </aside>
  );
}
