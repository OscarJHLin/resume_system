/** Pure state for the in-app updater banner (ADR-0005). */

export type UpdateInfo = {
  available: boolean;
  currentVersion: string;
  version?: string | null;
  notes?: string | null;
  date?: string | null;
};

export type UpdateState = {
  phase:
    | 'idle'
    | 'checking'
    | 'latest'
    | 'available'
    | 'downloading'
    | 'restarting'
    | 'error';
  /** Set when the user explicitly clicked「检查更新」. */
  manual: boolean;
  info: UpdateInfo | null;
  notesOpen: boolean;
  downloaded: number;
  total: number | null;
  error: string | null;
  /** Error came from install (retry = install) vs. check (retry = check). */
  errorDuring: 'check' | 'install' | null;
  /** 「稍后」hides this version until the next manual check. */
  dismissedVersion: string | null;
};

export type UpdateAction =
  | { type: 'check-start'; manual: boolean }
  | { type: 'check-result'; info: UpdateInfo; manual: boolean }
  | { type: 'check-failed'; message: string; manual: boolean }
  | { type: 'available-event'; info: UpdateInfo }
  | { type: 'toggle-notes' }
  | { type: 'dismiss' }
  | { type: 'install-start' }
  | { type: 'progress'; downloaded: number; total: number | null }
  | { type: 'install-failed'; message: string }
  | { type: 'clear-latest' };

export const initialUpdateState: UpdateState = {
  phase: 'idle',
  manual: false,
  info: null,
  notesOpen: false,
  downloaded: 0,
  total: null,
  error: null,
  errorDuring: null,
  dismissedVersion: null,
};

function parts(v: string): number[] {
  return v
    .trim()
    .replace(/^v/i, '')
    .split(/[-+]/)[0]!
    .split('.')
    .map((p) => Number.parseInt(p, 10) || 0);
}

/** Semver-ish compare on major.minor.patch (pre-release suffix ignored). */
export function compareVersions(a: string, b: string): number {
  const pa = parts(a);
  const pb = parts(b);
  for (let i = 0; i < Math.max(pa.length, pb.length, 3); i += 1) {
    const d = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (d !== 0) return d > 0 ? 1 : -1;
  }
  return 0;
}

export function isNewer(info: UpdateInfo | null | undefined): boolean {
  return Boolean(
    info?.available &&
      info.version &&
      compareVersions(info.version, info.currentVersion) > 0,
  );
}

export function progressPercent(
  downloaded: number,
  total: number | null,
): number | null {
  if (!total || total <= 0) return null;
  return Math.min(100, Math.round((downloaded / total) * 100));
}

const busy = (s: UpdateState) =>
  s.phase === 'downloading' || s.phase === 'restarting';

export function updateReducer(
  state: UpdateState,
  action: UpdateAction,
): UpdateState {
  switch (action.type) {
    case 'check-start':
      if (busy(state)) return state;
      return {
        ...state,
        phase: action.manual ? 'checking' : state.phase,
        manual: action.manual,
        error: null,
        errorDuring: null,
        dismissedVersion: action.manual ? null : state.dismissedVersion,
      };
    case 'check-result':
    case 'available-event': {
      if (busy(state)) return state;
      const manual = action.type === 'check-result' && action.manual;
      if (!isNewer(action.info)) {
        if (state.phase === 'available' && !manual) return state;
        return {
          ...state,
          phase: manual ? 'latest' : 'idle',
          manual,
          info: action.info,
          error: null,
          errorDuring: null,
        };
      }
      const sameVersion = state.info?.version === action.info.version;
      if (!manual && state.dismissedVersion === action.info.version) {
        return { ...state, phase: 'idle', info: action.info };
      }
      return {
        ...state,
        phase: 'available',
        manual,
        info: action.info,
        notesOpen: sameVersion ? state.notesOpen : false,
        error: null,
        errorDuring: null,
      };
    }
    case 'check-failed':
      if (busy(state)) return state;
      if (!action.manual) {
        return state.phase === 'checking' ? { ...state, phase: 'idle' } : state;
      }
      return {
        ...state,
        phase: 'error',
        manual: true,
        error: action.message,
        errorDuring: 'check',
      };
    case 'toggle-notes':
      return { ...state, notesOpen: !state.notesOpen };
    case 'dismiss':
      if (busy(state)) return state;
      return {
        ...state,
        phase: 'idle',
        notesOpen: false,
        error: null,
        errorDuring: null,
        dismissedVersion: state.info?.version ?? state.dismissedVersion,
      };
    case 'install-start':
      if (busy(state) || !isNewer(state.info)) return state;
      return {
        ...state,
        phase: 'downloading',
        downloaded: 0,
        total: null,
        error: null,
        errorDuring: null,
      };
    case 'progress':
      if (state.phase !== 'downloading') return state;
      if (action.total && action.downloaded >= action.total) {
        return {
          ...state,
          phase: 'restarting',
          downloaded: action.downloaded,
          total: action.total,
        };
      }
      return { ...state, downloaded: action.downloaded, total: action.total };
    case 'install-failed':
      return {
        ...state,
        phase: 'error',
        error: action.message,
        errorDuring: 'install',
      };
    case 'clear-latest':
      return state.phase === 'latest' ? { ...state, phase: 'idle' } : state;
  }
}

/** Banner is rendered for these phases; everything else is header-only. */
export function bannerVisible(state: UpdateState): boolean {
  return (
    state.phase === 'available' ||
    state.phase === 'downloading' ||
    state.phase === 'restarting' ||
    state.phase === 'error' ||
    state.phase === 'latest'
  );
}
