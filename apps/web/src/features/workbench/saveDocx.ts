/**
 * Save a DOCX blob with user-chosen folder + filename.
 *
 * Desktop (Tauri): native save panel via `save_docx` — WKWebView's
 * `showSaveFilePicker` rejects instantly with AbortError (no UI), which used
 * to surface as「已取消导出」.
 * Browser (`npm run app`): File System Access API, then prompt + <a download>.
 */

type SaveResult =
  | { mode: 'picker' | 'download' | 'tauri'; name: string }
  | { mode: 'cancelled' };

function normalizeDocxName(suggestedName: string): string {
  const safe =
    suggestedName.trim().replace(/[\\/:*?"<>|]+/g, '_') || 'resume.docx';
  return safe.toLowerCase().endsWith('.docx') ? safe : `${safe}.docx`;
}

function isTauriShell(): boolean {
  if (typeof window === 'undefined') return false;
  const w = window as Window & {
    __TAURI_INTERNALS__?: unknown;
    __TAURI__?: { core?: { invoke?: unknown } };
  };
  return Boolean(w.__TAURI_INTERNALS__ || w.__TAURI__?.core?.invoke);
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
): Promise<SaveResult | null> {
  const w = window as Window & {
    __TAURI__?: {
      core?: {
        invoke: <T>(cmd: string, args?: Record<string, unknown>) => Promise<T>;
      };
    };
  };
  const invoke = w.__TAURI__?.core?.invoke;
  if (!invoke) return null;

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
    try {
      const viaTauri = await saveViaTauri(blob, withExt);
      if (viaTauri) return viaTauri;
    } catch (e) {
      throw new Error(
        `桌面导出保存失败: ${e instanceof Error ? e.message : String(e)}`,
      );
    }
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
