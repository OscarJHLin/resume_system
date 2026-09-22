import { useCallback, useEffect, useMemo, useState } from 'react';
import type { Profile, ResumeDocument, SectionId } from '@resume/domain';
import { api } from '../../api/client';
import { LibrarySidebar } from '../library/LibrarySidebar';
import { EditorShell } from '../editor/EditorShell';
import { placementsForSection } from '../editor/docModel';
import { movePlacementId } from '../editor/placementOrder';
import {
  statusLine,
  workbenchBanner,
  type ConnectionState,
} from './workbenchState';
import './workbench.css';

/**
 * S4 workbench: empty/error polish + placement delete/reorder + TipTap projection.
 */
export function Workbench() {
  const [resume, setResume] = useState<ResumeDocument | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [libraryCount, setLibraryCount] = useState<number | null>(null);
  const [libraryKey, setLibraryKey] = useState(0);
  const [connection, setConnection] = useState<ConnectionState>('loading');
  const [status, setStatus] = useState<string>('就绪');
  const [busy, setBusy] = useState(false);

  const refreshResume = useCallback(async (id: string) => {
    const doc = await api.getResume(id);
    setResume(doc);
    return doc;
  }, []);

  const bootstrap = useCallback(async () => {
    setConnection('loading');
    try {
      const [p, list, modules] = await Promise.all([
        api.getProfile(),
        api.listResumes(),
        api.listModules(),
      ]);
      setProfile(p);
      setLibraryCount(modules.length);
      setConnection('ok');
      if (list[0]) {
        await refreshResume(list[0].id);
        setStatus(statusLine('S4', `已加载简历 ${list[0].id.slice(0, 8)}…`));
      } else {
        setStatus(statusLine('S4', '就绪 · 尚无简历'));
      }
    } catch {
      setConnection('error');
      setStatus(statusLine('S4', '无法连接 API'));
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
        summary: '关注工程化与可组装简历系统。',
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

      const project = await api.createModule({
        category: 'project',
        title: '模块化简历系统',
        subtitle: '个人项目',
        projectType: '全栈',
        timeRange: '2026.01 - 2026.09',
        body: '内容库 + 快照组装 + TipTap 投影 + DOCX 导出',
        tags: ['TypeScript', '简历'],
      });
      const skill = await api.createModule({
        category: 'skill',
        title: 'TypeScript',
        body: '类型安全与工程化',
        tags: ['TypeScript'],
      });
      const internship = await api.createModule({
        category: 'internship',
        title: '示例实习',
        subtitle: '某科技公司',
        timeRange: '2022.06 - 2022.09',
        body: '参与后端接口开发',
        tags: ['实习', '后端'],
      });
      // Extra module left unplaced so DnD remains demonstrable.
      await api.createModule({
        category: 'award',
        title: '优秀奖学金',
        body: '校级二等奖学金',
        tags: ['获奖'],
      });

      const doc = await api.createResume('S4演示简历');
      await api.addPlacement(doc.id, 'projects', project.id);
      await api.addPlacement(doc.id, 'skills', skill.id);
      await api.addPlacement(doc.id, 'internships', internship.id);
      const full = await refreshResume(doc.id);

      setLibraryKey((k) => k + 1);
      setLibraryCount((c) => (c == null ? 4 : c + 4));
      setConnection('ok');
      setStatus(
        statusLine(
          'S4',
          `已种子化可读简历（${full.placements.length} 条）· 可拖入/删除/排序`,
        ),
      );
    } catch (e) {
      setStatus(`种子失败: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setBusy(false);
    }
  }, [refreshResume]);

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

  const onDeletePlacement = useCallback(
    async (placementId: string) => {
      if (!resume) return;
      setBusy(true);
      try {
        await api.deletePlacement(resume.id, placementId);
        await refreshResume(resume.id);
        setStatus('已删除快照条目');
      } catch (e) {
        setStatus(`删除失败: ${e instanceof Error ? e.message : String(e)}`);
      } finally {
        setBusy(false);
      }
    },
    [resume, refreshResume],
  );

  const onMovePlacement = useCallback(
    async (
      section: SectionId,
      placementId: string,
      direction: 'up' | 'down',
    ) => {
      if (!resume) return;
      const ordered = placementsForSection(resume, section).map((p) => p.id);
      const next = movePlacementId(ordered, placementId, direction);
      if (!next) {
        setStatus('已到边界，无法继续移动');
        return;
      }
      setBusy(true);
      try {
        const updated = await api.reorderPlacements(resume.id, section, next);
        setResume(updated);
        setStatus(`已${direction === 'up' ? '上移' : '下移'}条目`);
      } catch (e) {
        setStatus(`排序失败: ${e instanceof Error ? e.message : String(e)}`);
      } finally {
        setBusy(false);
      }
    },
    [resume],
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

  const banner = useMemo(
    () =>
      workbenchBanner({
        connection,
        hasResume: Boolean(resume),
        placementCount: resume?.placements.length ?? 0,
        libraryCount,
      }),
    [connection, resume, libraryCount],
  );

  return (
    <div className="workbench">
      <header className="workbench__header">
        <div>
          <p className="workbench__brand">简历组装系统</p>
          <p className="workbench__phase">{status}</p>
        </div>
        <div className="workbench__actions">
          <button
            type="button"
            className="workbench__secondary"
            disabled={busy || connection === 'error'}
            onClick={() => void seedDemo()}
          >
            写入演示数据
          </button>
          <button
            type="button"
            className="workbench__export"
            disabled={busy || !resume || connection === 'error'}
            onClick={() => void exportDocx()}
          >
            导出 DOCX
          </button>
        </div>
      </header>
      {banner && (
        <div
          className={`workbench__banner workbench__banner--${banner.tone}`}
          role={banner.tone === 'error' ? 'alert' : 'status'}
        >
          {banner.message}
        </div>
      )}
      <div className="workbench__body">
        <LibrarySidebar
          refreshKey={libraryKey}
          onStatus={setStatus}
          onCountChange={setLibraryCount}
          disabled={connection === 'error'}
        />
        <EditorShell
          resume={resume}
          profile={profile}
          connectionError={connection === 'error'}
          onDropModule={onDropModule}
          onDeletePlacement={onDeletePlacement}
          onMovePlacement={onMovePlacement}
          onStatus={setStatus}
        />
      </div>
    </div>
  );
}
