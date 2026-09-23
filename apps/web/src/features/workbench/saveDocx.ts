/**
 * Save a DOCX blob with user-chosen folder + filename.
 *
 * Desktop (Tauri): native save panel via `save_docx` — WKWebView's
 * `showSaveFilePicker` rejects instantly with AbortError (no UI), which used
 * to surface as「已取消导出」. WebView2 may expose the picker but still abort
 * or lack FS Access permissions after we navigate to http://127.0.0.1.
 *
 * Prefer `__TAURI_INTERNALS__.invoke` on remote pages (withGlobalTauri wrapper
 * can be missing); never fall through to the browser picker inside Tauri.
 *
 * Browser (`npm run app`): File System Access API, then prompt + <a download>.
 */

export type SaveResult =
  | { mode: 'picker' | 'download' | 'tauri'; name: string }
  | { mode: 'cancelled' };

type TauriInvoke = <T>(
  cmd: string,
  args?: Record<string, unknown>,
) => Promise<T>;

export function normalizeDocxName(suggestedName: string): string {
  const safe =
    suggestedName.trim().replace(/[\\/:*?"<>|]+/g, '_') || 'resume.docx';
  return safe.toLowerCase().endsWith('.docx') ? safe : `${safe}.docx`;
}

/** True when running inside a Tauri WebView (packaged or `tauri dev`). */
export function isTauriShell(
  win: Window & {
    __TAURI_INTERNALS__?: { invoke?: unknown };
    __TAURI__?: { core?: { invoke?: unknown } };
  } = typeof window !== 'undefined'
    ? (window as Window & {
        __TAURI_INTERNALS__?: { invoke?: unknown };
        __TAURI__?: { core?: { invoke?: unknown } };
      })
    : ({} as Window),
): boolean {
  return Boolean(
    win.__TAURI_INTERNALS__?.invoke || win.__TAURI__?.core?.invoke,
  );
}

/**
 * Resolve IPC invoke for remote http://127.0.0.1 UI.
 * Internals first — withGlobalTauri is flaky after location.replace on WebView2.
 */
export function resolveTauriInvoke(
  win: Window & {
    __TAURI_INTERNALS__?: { invoke?: TauriInvoke };
    __TAURI__?: { core?: { invoke?: TauriInvoke } };
  } = typeof window !== 'undefined'
    ? (window as Window & {
        __TAURI_INTERNALS__?: { invoke?: TauriInvoke };
        __TAURI__?: { core?: { invoke?: TauriInvoke } };
      })
    : ({} as Window),
): TauriInvoke | null {
  const internals = win.__TAURI_INTERNALS__?.invoke;
  if (typeof internals === 'function') {
    return internals.bind(win.__TAURI_INTERNALS__) as TauriInvoke;
  }
  const global = win.__TAURI__?.core?.invoke;
  if (typeof global === 'function') {
    return global.bind(win.__TAURI__?.core) as TauriInvoke;
  }
  return null;
}

async function blobToBase64(blob: Blob): Promise<string> {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

async function saveViaTauri(
  blob: Blob,
  withExt: string,
): Promise<SaveResult> {
  const invoke = resolveTauriInvoke();
  if (!invoke) {
    throw new Error(
      '桌面导出通道不可用（Tauri IPC 未注入）。请重启应用或重装最新版。',
    );
  }

  const dataBase64 = await blobToBase64(blob);
  const saved = await invoke<string | null>('save_docx', {
    suggestedName: withExt,
    dataBase64,
  });
  if (saved === null) return { mode: 'cancelled' };
  return { mode: 'tauri', name: saved || withExt };
}

export async function saveDocxWithPicker(
  blob: Blob,
  suggestedName: string,
): Promise<SaveResult> {
  const withExt = normalizeDocxName(suggestedName);

  // Packaged / `tauri dev` WebView — never use showSaveFilePicker (false AbortError).
  if (isTauriShell()) {
    return saveViaTauri(blob, withExt);
  }

  const w = window as Window & {
    showSaveFilePicker?: (options: {
      suggestedName?: string;
      types?: Array<{
        description?: string;
        accept: Record<string, string[]>;
      }>;
    }) => Promise<FileSystemFileHandle>;
  };

  if (typeof w.showSaveFilePicker === 'function') {
    try {
      const handle = await w.showSaveFilePicker({
        suggestedName: withExt,
        types: [
          {
            description: 'Word 文档',
            accept: {
              'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
                ['.docx'],
            },
          },
        ],
      });
      const writable = await handle.createWritable();
      await writable.write(blob);
      await writable.close();
      return { mode: 'picker', name: handle.name || withExt };
    } catch (e) {
      // Real user cancel in Chromium. Do NOT treat AbortError as cancel in
      // environments that reject without a panel — those skip this branch via
      // isTauriShell() above; here AbortError is genuine cancel.
      if (e instanceof DOMException && e.name === 'AbortError') {
        return { mode: 'cancelled' };
      }
      // Fall through to download fallback for unsupported / denied
    }
  }

  const typed = window.prompt('保存为文件名（可改）', withExt);
  if (typed === null) return { mode: 'cancelled' };
  const name = typed.trim().toLowerCase().endsWith('.docx')
    ? typed.trim()
    : `${typed.trim() || 'resume'}.docx`;

  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
  return { mode: 'download', name };
}
