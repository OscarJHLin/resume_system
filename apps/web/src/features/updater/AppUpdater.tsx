import { useCallback, useEffect, useReducer } from 'react';
import { isTauriShell } from '../workbench/saveDocx';
import {
  EVENT_AVAILABLE,
  EVENT_PROGRESS,
  checkUpdate,
  errorMessage,
  installUpdate,
  listenTauri,
  type UpdateProgress,
} from './tauriUpdater';
import {
  bannerVisible,
  initialUpdateState,
  progressPercent,
  updateReducer,
  type UpdateInfo,
  type UpdateState,
} from './updateState';
import './updater.css';

export type AppUpdater = {
  enabled: boolean;
  state: UpdateState;
  check: (manual: boolean) => void;
  install: () => void;
  dismiss: () => void;
  toggleNotes: () => void;
};

const LATEST_TOAST_MS = 4000;

export function useAppUpdater(): AppUpdater {
  const enabled = isTauriShell();
  const [state, dispatch] = useReducer(updateReducer, initialUpdateState);

  const check = useCallback(
    (manual: boolean) => {
      if (!enabled) return;
      dispatch({ type: 'check-start', manual });
      checkUpdate()
        .then((info) => dispatch({ type: 'check-result', info, manual }))
        .catch((e) =>
          dispatch({ type: 'check-failed', message: errorMessage(e), manual }),
        );
    },
    [enabled],
  );

  const install = useCallback(() => {
    if (!enabled) return;
    dispatch({ type: 'install-start' });
    installUpdate().catch((e) =>
      dispatch({ type: 'install-failed', message: errorMessage(e) }),
    );
  }, [enabled]);

  useEffect(() => {
    if (!enabled) return;
    const unlisten: Array<() => void> = [];
    let cancelled = false;
    void Promise.all([
      listenTauri<UpdateInfo>(EVENT_AVAILABLE, (info) =>
        dispatch({ type: 'available-event', info }),
      ),
      listenTauri<UpdateProgress>(EVENT_PROGRESS, (p) =>
        dispatch({
          type: 'progress',
          downloaded: p.downloaded,
          total: p.total ?? null,
        }),
      ),
    ])
      .then((fns) => {
        if (cancelled) fns.forEach((f) => f());
        else unlisten.push(...fns);
      })
      .catch(() => {});
    check(false);
    return () => {
      cancelled = true;
      unlisten.forEach((f) => f());
    };
  }, [enabled, check]);

  useEffect(() => {
    if (state.phase !== 'latest') return;
    const t = window.setTimeout(
      () => dispatch({ type: 'clear-latest' }),
      LATEST_TOAST_MS,
    );
    return () => window.clearTimeout(t);
  }, [state.phase]);

  return {
    enabled,
    state,
    check,
    install,
    dismiss: useCallback(() => dispatch({ type: 'dismiss' }), []),
    toggleNotes: useCallback(() => dispatch({ type: 'toggle-notes' }), []),
  };
}

export function UpdateCheckButton({ updater }: { updater: AppUpdater }) {
  if (!updater.enabled) return null;
  const { phase, info } = updater.state;
  const hasUpdate = phase === 'available' || (phase === 'idle' && !!info?.available);
  return (
    <button
      type="button"
      className={`workbench__secondary updater__check${hasUpdate ? ' updater__check--dot' : ''}`}
      disabled={
        phase === 'checking' || phase === 'downloading' || phase === 'restarting'
      }
      title={info ? `当前版本 v${info.currentVersion}` : undefined}
      onClick={() => updater.check(true)}
    >
      {phase === 'checking' ? '检查中…' : '检查更新'}
    </button>
  );
}

export function UpdateBanner({ updater }: { updater: AppUpdater }) {
  const { state } = updater;
  if (!updater.enabled || !bannerVisible(state)) return null;
  const version = state.info?.version ? `v${state.info.version}` : '';

  if (state.phase === 'latest') {
    return (
      <div className="updater updater--quiet" role="status">
        已是最新版本
        {state.info?.currentVersion ? `（v${state.info.currentVersion}）` : ''}
      </div>
    );
  }

  if (state.phase === 'error') {
    const retry =
      state.errorDuring === 'install'
        ? updater.install
        : () => updater.check(true);
    return (
      <div className="updater updater--error" role="alert">
        <span className="updater__title">
          {state.errorDuring === 'install' ? `更新 ${version} 失败` : '检查更新失败'}
        </span>
        <span className="updater__detail">{state.error}</span>
        <span className="updater__actions">
          <button type="button" className="updater__primary" onClick={retry}>
            重试
          </button>
          <button type="button" className="updater__link" onClick={updater.dismiss}>
            稍后
          </button>
        </span>
      </div>
    );
  }

  if (state.phase === 'downloading' || state.phase === 'restarting') {
    const pct = progressPercent(state.downloaded, state.total);
    return (
      <div className="updater" role="status">
        <span className="updater__title">
          {state.phase === 'restarting'
            ? `正在安装 ${version}，应用将自动重启…`
            : `正在下载 ${version}${pct === null ? '…' : ` ${pct}%`}`}
        </span>
        <span
          className={`updater__bar${pct === null && state.phase === 'downloading' ? ' updater__bar--indeterminate' : ''}`}
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={state.phase === 'restarting' ? 100 : (pct ?? undefined)}
        >
          <span
            className="updater__bar-fill"
            style={{ width: `${state.phase === 'restarting' ? 100 : (pct ?? 30)}%` }}
          />
        </span>
      </div>
    );
  }

  return (
    <div className="updater" role="status">
      <span className="updater__title">发现新版本 {version}</span>
      <span className="updater__actions">
        {state.info?.notes && (
          <button type="button" className="updater__link" onClick={updater.toggleNotes}>
            {state.notesOpen ? '收起更新内容' : '查看更新内容'}
          </button>
        )}
        <button type="button" className="updater__primary" onClick={updater.install}>
          立即更新
        </button>
        <button type="button" className="updater__link" onClick={updater.dismiss}>
          稍后
        </button>
      </span>
      {state.notesOpen && state.info?.notes && (
        <div className="updater__notes">{state.info.notes}</div>
      )}
    </div>
  );
}
