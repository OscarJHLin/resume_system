import { useCallback, useEffect, useState } from 'react';
import { LibrarySidebar } from '../library/LibrarySidebar';
import { EditorShell } from '../editor/EditorShell';
import './workbench.css';

type ResumeSummary = { id: string; title: string };

/**
 * S1 workbench: optional seed + DOCX download. DnD/TipTap arrive in S2–S3.
 */
export function Workbench() {
  const [resumeId, setResumeId] = useState<string | null>(null);
  const [status, setStatus] = useState<string>('就绪');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void (async () => {
      try {
        const list = (await fetch('/api/resumes').then((r) => r.json())) as ResumeSummary[];
        if (list[0]) setResumeId(list[0].id);
      } catch {
        setStatus('无法连接 API（请先 npm run dev:server）');
      }
    })();
  }, []);

  const seedDemo = useCallback(async () => {
    setBusy(true);
    setStatus('写入演示数据…');
    try {
      await fetch('/api/profile', {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          name: '演示候选人',
          phone: '13800000000',
          email: 'demo@example.com',
          location: '上海',
          education: [
            {
              school: '示例大学',
              degree: '本科',
              major: '计算机',
              timeRange: '2018-2022',
            },
          ],
        }),
      });

      const project = await fetch('/api/modules', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          category: 'project',
          title: '模块化简历系统',
          subtitle: '个人项目',
          projectType: '全栈',
          timeRange: '2026.01 - 2026.09',
          body: '内容库 + 快照组装 + DOCX 导出',
          tags: ['TypeScript', '简历'],
        }),
      }).then((r) => r.json() as Promise<{ id: string }>);

      const skill = await fetch('/api/modules', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          category: 'skill',
          title: 'TypeScript',
          body: '类型安全与工程化',
          tags: ['TypeScript'],
        }),
      }).then((r) => r.json() as Promise<{ id: string }>);

      const resume = await fetch('/api/resumes', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ title: 'S1演示简历' }),
      }).then((r) => r.json() as Promise<{ id: string }>);

      await fetch(`/api/resumes/${resume.id}/placements`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ section: 'projects', moduleId: project.id }),
      });
      await fetch(`/api/resumes/${resume.id}/placements`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ section: 'skills', moduleId: skill.id }),
      });

      setResumeId(resume.id);
      setStatus(`已种子化 resume=${resume.id}`);
    } catch (e) {
      setStatus(`种子失败: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setBusy(false);
    }
  }, []);

  const exportDocx = useCallback(async () => {
    if (!resumeId) {
      setStatus('请先「写入演示数据」或创建简历');
      return;
    }
    setBusy(true);
    setStatus('导出中…');
    try {
      const res = await fetch(`/api/resumes/${resumeId}/export`, {
        method: 'POST',
      });
      if (!res.ok) {
        throw new Error(`export ${res.status}`);
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'resume.docx';
      a.click();
      URL.revokeObjectURL(url);
      setStatus('已下载 resume.docx');
    } catch (e) {
      setStatus(`导出失败: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setBusy(false);
    }
  }, [resumeId]);

  return (
    <div className="workbench">
      <header className="workbench__header">
        <div>
          <p className="workbench__brand">简历组装系统</p>
          <p className="workbench__phase">
            S1 · API 已通 · {status}
            {resumeId ? ` · ${resumeId.slice(0, 8)}…` : ''}
          </p>
        </div>
        <div className="workbench__actions">
          <button
            type="button"
            className="workbench__secondary"
            disabled={busy}
            onClick={() => void seedDemo()}
          >
            写入演示数据
          </button>
          <button
            type="button"
            className="workbench__export"
            disabled={busy || !resumeId}
            onClick={() => void exportDocx()}
          >
            导出 DOCX
          </button>
        </div>
      </header>
      <div className="workbench__body">
        <LibrarySidebar />
        <EditorShell />
      </div>
    </div>
  );
}
