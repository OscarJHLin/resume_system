import { DEFAULT_TEMPLATE_ID } from '@resume/domain';
import './editor.css';

/**
 * TipTap editor shell stub.
 * Sections mirror resume structure; drop zones + TipTap in S2–S3.
 */
const SECTIONS = [
  { id: 'basic', label: '基本信息', source: 'Profile' },
  { id: 'education', label: '教育背景', source: 'Profile' },
  { id: 'skills', label: '技术能力', source: 'Module: skill' },
  { id: 'projects', label: '项目经历', source: 'Module: project' },
  { id: 'internships', label: '实习经历', source: 'Module: internship' },
] as const;

export function EditorShell() {
  return (
    <main className="editor">
      <div className="editor__page">
        <p className="editor__template">模板 · {DEFAULT_TEMPLATE_ID}</p>
        <h1 className="editor__doc-title">未命名简历</h1>
        {SECTIONS.map((s) => (
          <section key={s.id} className="editor__section" data-section={s.id}>
            <h2>{s.label}</h2>
            <p className="editor__drop">
              落点占位（来源：{s.source}）— 拖拽接入见 roadmap S2
            </p>
          </section>
        ))}
      </div>
    </main>
  );
}
