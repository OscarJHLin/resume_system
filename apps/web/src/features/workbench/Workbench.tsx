import { useCallback, useEffect, useMemo, useState } from 'react';
import type {
  Profile,
  ResumeDocument,
  SectionId,
  TemplateMeta,
} from '@resume/domain';
import { DEFAULT_TEMPLATE_ID } from '@resume/domain';
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
 * Workbench: template picker + left lin-v1 canvas + right 4-tab content DB.
 */
export function Workbench() {
  const [resume, setResume] = useState<ResumeDocument | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [templates, setTemplates] = useState<TemplateMeta[]>([]);
  const [libraryCount, setLibraryCount] = useState<number | null>(null);
  const [libraryKey, setLibraryKey] = useState(0);
  const [connection, setConnection] = useState<ConnectionState>('loading');
  const [status, setStatus] = useState<string>('就绪');
  const [busy, setBusy] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);

  const refreshResume = useCallback(async (id: string) => {
    const doc = await api.getResume(id);
    setResume(doc);
    if (doc.profileId) {
      try {
        const p = await api.getProfile(doc.profileId);
        setProfile(p);
      } catch {
        setProfile(null);
      }
    } else {
      setProfile(null);
    }
    return doc;
  }, []);

  const bootstrap = useCallback(async () => {
    setConnection('loading');
    try {
      const [list, mods, tpls] = await Promise.all([
        api.listResumes(),
        api.listModules(),
        api.listTemplates(),
      ]);
      setTemplates(tpls);
      setLibraryCount(mods.length);
      setConnection('ok');
      if (list[0]) {
        await refreshResume(list[0].id);
        setStatus(statusLine('就绪', list[0].title));
      } else {
        setResume(null);
        setProfile(null);
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

  const selectTemplate = useCallback(
    async (templateId: string = DEFAULT_TEMPLATE_ID) => {
      setBusy(true);
      setPickerOpen(false);
      setStatus('初始化模板…');
      try {
        if (resume) {
          const updated = await api.patchResume(resume.id, { templateId });
          setResume(updated);
          setStatus(statusLine('模板', updated.title));
        } else {
          const doc = await api.createResume({
            title: '我的简历',
            templateId,
          });
          setResume(doc);
          setProfile(null);
          setStatus(statusLine('就绪', doc.title));
        }
      } catch (e) {
        setStatus(
          `模板失败: ${e instanceof Error ? e.message : String(e)}`,
        );
      } finally {
        setBusy(false);
      }
    },
    [resume],
  );

  const onApplyProfile = useCallback(
    async (profileId: string) => {
      if (!resume) {
        setStatus('请先选择简历模板');
        return;
      }
      setBusy(true);
      try {
        const updated = await api.patchResume(resume.id, { profileId });
        setResume(updated);
        const p = await api.getProfile(profileId);
        setProfile(p);
        setStatus(`已应用基本信息：${p.name}`);
      } catch (e) {
        setStatus(
          `应用失败: ${e instanceof Error ? e.message : String(e)}`,
        );
      } finally {
        setBusy(false);
      }
    },
    [resume],
  );

  const onDropModule = useCallback(
    async (section: SectionId, moduleId: string) => {
      if (!resume) {
        setStatus('请先选择简历模板');
        return;
      }
      setBusy(true);
      try {
        await api.addPlacement(resume.id, section, moduleId);
        await refreshResume(resume.id);
        setStatus(`已落入 ${section}`);
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
      setStatus('请先选择简历模板');
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

  const templateLabel =
    templates.find((t) => t.id === (resume?.templateId ?? DEFAULT_TEMPLATE_ID))
      ?.label ?? '林氏简历 lin-v1';

  return (
    <div className="workbench">
      <header className="workbench__header">
        <div className="workbench__brand-block">
          <p className="workbench__brand">简历组装系统</p>
          <p className="workbench__phase">{status}</p>
        </div>
        <div className="workbench__actions">
          <div className="workbench__picker-wrap">
            <button
              type="button"
              className="workbench__secondary"
              disabled={busy || connection === 'error'}
              onClick={() => setPickerOpen((o) => !o)}
            >
              选择简历模板
            </button>
            {pickerOpen && (
              <div className="workbench__picker" role="listbox">
                {(templates.length
                  ? templates
                  : [
                      {
                        id: DEFAULT_TEMPLATE_ID,
                        label: '林氏简历 lin-v1',
                        description: '',
                      },
                    ]
                ).map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    className="workbench__picker-item"
                    onClick={() => void selectTemplate(t.id)}
                  >
                    <strong>{t.label}</strong>
                    {t.description && <span>{t.description}</span>}
                  </button>
                ))}
              </div>
            )}
          </div>
          {resume && (
            <span className="workbench__template-chip">{templateLabel}</span>
          )}
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
          onDropModule={onDropModule}
          onDeletePlacement={onDeletePlacement}
          onMovePlacement={onMovePlacement}
          onStatus={setStatus}
        />
        <ContentDatabase
          refreshKey={libraryKey}
          disabled={connection === 'error'}
          appliedProfileId={resume?.profileId}
          onStatus={setStatus}
          onCountChange={setLibraryCount}
          onApplyProfile={onApplyProfile}
          onProfilesChanged={() => {
            setLibraryKey((k) => k + 1);
            if (resume?.profileId) {
              void api.getProfile(resume.profileId).then(setProfile).catch(() => undefined);
            }
          }}
        />
      </div>
    </div>
  );
}
