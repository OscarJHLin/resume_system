import { useCallback, useEffect, useMemo, useState } from 'react';
import type { Profile, ResumeDocument, SectionId } from '@resume/domain';
import { api } from '../../api/client';
import { ResumeCanvas } from '../canvas/ResumeCanvas';
import { ContentDatabase } from '../library/ContentDatabase';
import { placementsForSection } from '../editor/docModel';
import { movePlacementId } from '../editor/placementOrder';
import {
  statusLine,
  workbenchBanner,
  type ConnectionState,
} from './workbenchState';
import './workbench.css';

/**
 * Wireframe workbench: left template canvas + right content DB + export.
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
        setStatus(statusLine('就绪', list[0].title));
      } else {
        setStatus(statusLine('就绪', '尚无简历'));
      }
    } catch {
      setConnection('error');
      setStatus(statusLine('错误', '无法连接 API'));
    }
  }, [refreshResume]);

  useEffect(() => {
    void bootstrap();
  }, [bootstrap]);

  const ensureResume = useCallback(async () => {
    if (resume) return resume;
    const doc = await api.createResume('我的简历');
    setResume(doc);
    return doc;
  }, [resume]);

  const seedDemo = useCallback(async () => {
    setBusy(true);
    setStatus('写入演示数据…');
    try {
      const p = await api.putProfile({
        name: '演示候选人',
        phone: '13800000000',
        email: 'demo@example.com',
        location: '示例市',
        summary: '软件工程本科生 · 全栈 / Agent / 工程化',
        education: [
          {
            id: '',
            school: '示例大学',
            degree: '本科',
            major: '软件工程',
            timeRange: '2018.09 - 2022.06',
          },
        ],
      });
      setProfile(p);

      const skill = await api.createModule({
        category: 'skill',
        title: '编程语言',
        body: 'TypeScript、Python、JavaScript',
        tags: ['TypeScript'],
      });
      const project = await api.createModule({
        category: 'project',
        title: '模块化简历系统',
        subtitle: '个人项目',
        projectType: 'TypeScript / Fastify / TipTap',
        timeRange: '2026.01.01 - 2026.09.01',
        body: '内容库标签检索与快照组装。\n导出对齐林氏简历版式。',
        tags: ['TypeScript', '简历'],
      });
      const internship = await api.createModule({
        category: 'internship',
        title: '示例科技有限公司',
        subtitle: '珠海',
        projectType: '实习助理',
        timeRange: '2024.07.01',
        body: '参与展会策划与现场执行。',
        tags: ['实习'],
      });
      await api.createModule({
        category: 'award',
        title: '校级二等奖学金',
        body: '2024',
        tags: ['获奖'],
      });

      const doc = await api.createResume('演示简历');
      await api.addPlacement(doc.id, 'projects', project.id);
      await api.addPlacement(doc.id, 'skills', skill.id);
      await api.addPlacement(doc.id, 'internships', internship.id);
      const full = await refreshResume(doc.id);
      setLibraryKey((k) => k + 1);
      setLibraryCount((c) => (c == null ? 4 : c + 4));
      setConnection('ok');
      setStatus(statusLine('演示', `${full.placements.length} 条已落入`));
    } catch (e) {
      setStatus(`种子失败: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setBusy(false);
    }
  }, [refreshResume]);

  const onDropModule = useCallback(
    async (section: SectionId, moduleId: string) => {
      setBusy(true);
      try {
        const doc = await ensureResume();
        await api.addPlacement(doc.id, section, moduleId);
        await refreshResume(doc.id);
        setStatus(`已落入 ${section}`);
      } catch (e) {
        setStatus(`落入失败: ${e instanceof Error ? e.message : String(e)}`);
      } finally {
        setBusy(false);
      }
    },
    [ensureResume, refreshResume],
  );

  const onDeletePlacement = useCallback(
    async (placementId: string) => {
      if (!resume) return;
      setBusy(true);
      try {
        await api.deletePlacement(resume.id, placementId);
        await refreshResume(resume.id);
        setStatus('已删除条目');
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
        setStatus('已到边界');
        return;
      }
      setBusy(true);
      try {
        const updated = await api.reorderPlacements(resume.id, section, next);
        setResume(updated);
        setStatus(direction === 'up' ? '已上移' : '已下移');
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
      setStatus('请先创建简历或写入演示数据');
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
        <div className="workbench__brand-block">
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
            演示数据
          </button>
          <button
            type="button"
            className="workbench__export"
            disabled={busy || !resume || connection === 'error'}
            onClick={() => void exportDocx()}
          >
            导出
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
      <div className="workbench__body workbench__body--wire">
        <ResumeCanvas
          resume={resume}
          profile={profile}
          connectionError={connection === 'error'}
          onProfileChange={setProfile}
          onDropModule={onDropModule}
          onDeletePlacement={onDeletePlacement}
          onMovePlacement={onMovePlacement}
          onStatus={setStatus}
        />
        <ContentDatabase
          refreshKey={libraryKey}
          disabled={connection === 'error'}
          onStatus={setStatus}
          onCountChange={setLibraryCount}
        />
      </div>
    </div>
  );
}
