import { useCallback, useEffect, useState } from 'react';
import type { Profile, ResumeDocument, SectionId } from '@resume/domain';
import { api } from '../../api/client';
import { LibrarySidebar } from '../library/LibrarySidebar';
import { EditorShell } from '../editor/EditorShell';
import './workbench.css';

/**
 * S2 workbench: tag library + section DnD → snapshot placements + DOCX export.
 */
export function Workbench() {
  const [resume, setResume] = useState<ResumeDocument | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [libraryKey, setLibraryKey] = useState(0);
  const [status, setStatus] = useState<string>('就绪');
  const [busy, setBusy] = useState(false);

  const refreshResume = useCallback(async (id: string) => {
    const doc = await api.getResume(id);
    setResume(doc);
    return doc;
  }, []);

  const bootstrap = useCallback(async () => {
    try {
      const [p, list] = await Promise.all([
        api.getProfile(),
        api.listResumes(),
      ]);
      setProfile(p);
      if (list[0]) {
        await refreshResume(list[0].id);
      }
    } catch {
      setStatus('无法连接 API（请先 npm run dev:server）');
    }
  }, [refreshResume]);

  useEffect(() => {
    void bootstrap();
  }, [bootstrap]);

  const seedDemo = useCallback(async () => {
    setBusy(true);
    setStatus('写入演示数据…');
    try {
      const p = await api.putProfile({
        name: '演示候选人',
        phone: '13800000000',
        email: 'demo@example.com',
        location: '上海',
        education: [
          {
            id: '',
            school: '示例大学',
            degree: '本科',
            major: '计算机',
            timeRange: '2018-2022',
          },
        ],
      });
      setProfile(p);

      await api.createModule({
        category: 'project',
        title: '模块化简历系统',
        subtitle: '个人项目',
        projectType: '全栈',
        timeRange: '2026.01 - 2026.09',
        body: '内容库 + 快照组装 + DOCX 导出',
        tags: ['TypeScript', '简历'],
      });
      await api.createModule({
        category: 'skill',
        title: 'TypeScript',
        body: '类型安全与工程化',
        tags: ['TypeScript'],
      });
      await api.createModule({
        category: 'internship',
        title: '示例实习',
        subtitle: '某科技公司',
        timeRange: '2022.06 - 2022.09',
        body: '参与后端接口开发',
        tags: ['实习', '后端'],
      });

      const doc = await api.createResume('S2演示简历');
      // Seed leaves placements empty so DnD can be demonstrated.
      setResume(doc);
      setLibraryKey((k) => k + 1);
      setStatus(`已种子化（空简历，请从左侧拖入）· ${doc.id.slice(0, 8)}…`);
    } catch (e) {
      setStatus(`种子失败: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setBusy(false);
    }
  }, []);

  const onDropModule = useCallback(
    async (section: SectionId, moduleId: string) => {
      if (!resume) {
        setStatus('请先创建或写入演示简历');
        return;
      }
      setBusy(true);
      try {
        await api.addPlacement(resume.id, section, moduleId);
        await refreshResume(resume.id);
        setStatus(`已落入 ${section}（快照）`);
      } catch (e) {
        setStatus(`落入失败: ${e instanceof Error ? e.message : String(e)}`);
      } finally {
        setBusy(false);
      }
    },
    [resume, refreshResume],
  );

  const exportDocx = useCallback(async () => {
    if (!resume) {
      setStatus('请先「写入演示数据」或创建简历');
      return;
    }
    setBusy(true);
    setStatus('导出中…');
    try {
      const blob = await api.exportDocx(resume.id);
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
  }, [resume]);

  return (
    <div className="workbench">
      <header className="workbench__header">
        <div>
          <p className="workbench__brand">简历组装系统</p>
          <p className="workbench__phase">
            S2 · 标签库 + 拖拽 · {status}
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
            disabled={busy || !resume}
            onClick={() => void exportDocx()}
          >
            导出 DOCX
          </button>
        </div>
      </header>
      <div className="workbench__body">
        <LibrarySidebar
          refreshKey={libraryKey}
          onStatus={setStatus}
        />
        <EditorShell
          resume={resume}
          profile={profile}
          onDropModule={onDropModule}
          onStatus={setStatus}
        />
      </div>
    </div>
  );
}
