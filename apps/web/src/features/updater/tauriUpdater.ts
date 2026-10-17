import { resolveTauriInvoke } from '../workbench/saveDocx';
import type { UpdateInfo } from './updateState';

export const EVENT_AVAILABLE = 'update://available';
export const EVENT_PROGRESS = 'update://progress';

export type UpdateProgress = { downloaded: number; total: number | null };

type TauriEvent<T> = { event: string; id: number; payload: T };
type Unlisten = () => void;

type TauriWindow = Window & {
  __TAURI_INTERNALS__?: {
    invoke?: unknown;
    transformCallback?: (cb: (e: unknown) => void, once?: boolean) => number;
  };
  __TAURI__?: {
    event?: {
      listen?: <T>(
        event: string,
        cb: (e: TauriEvent<T>) => void,
      ) => Promise<Unlisten>;
    };
  };
};

function tauriWindow(): TauriWindow {
  return (typeof window !== 'undefined' ? window : {}) as TauriWindow;
}

export function checkUpdate(): Promise<UpdateInfo> {
  const invoke = resolveTauriInvoke();
  if (!invoke) return Promise.reject(new Error('Tauri IPC 不可用'));
  return invoke<UpdateInfo>('check_update');
}

/** Resolves only on failure paths — success restarts the app. */
export function installUpdate(): Promise<void> {
  const invoke = resolveTauriInvoke();
  if (!invoke) return Promise.reject(new Error('Tauri IPC 不可用'));
  return invoke<void>('install_update');
}

/**
 * Subscribe to a Rust-emitted event on the remote http://127.0.0.1 page.
 * Uses the global event API when injected, else the same IPC call
 * `@tauri-apps/api/event` makes (`plugin:event|listen`).
 */
export async function listenTauri<T>(
  event: string,
  cb: (payload: T) => void,
): Promise<Unlisten> {
  const win = tauriWindow();
  const globalListen = win.__TAURI__?.event?.listen;
  if (typeof globalListen === 'function') {
    return globalListen<T>(event, (e) => cb(e.payload));
  }
  const invoke = resolveTauriInvoke();
  const transform = win.__TAURI_INTERNALS__?.transformCallback;
  if (!invoke || typeof transform !== 'function') return () => {};
  const handler = transform.call(win.__TAURI_INTERNALS__, (e) =>
    cb((e as TauriEvent<T>).payload),
  );
  const eventId = await invoke<number>('plugin:event|listen', {
    event,
    target: { kind: 'Any' },
    handler,
  });
  return () => {
    void invoke('plugin:event|unlisten', { event, eventId }).catch(() => {});
  };
}

export function errorMessage(e: unknown): string {
  if (typeof e === 'string') return e;
  if (e instanceof Error) return e.message;
  return '未知错误';
}
