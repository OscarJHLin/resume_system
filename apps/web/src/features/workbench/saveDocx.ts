/**
 * Save a DOCX blob with user-chosen folder + filename when the browser supports
 * the File System Access API; otherwise fall back to download + optional rename.
 */

export async function saveDocxWithPicker(
  blob: Blob,
  suggestedName: string,
): Promise<{ mode: 'picker' | 'download'; name: string } | { mode: 'cancelled' }> {
  const safe =
    suggestedName.trim().replace(/[\\/:*?"<>|]+/g, '_') || 'resume.docx';
  const withExt = safe.toLowerCase().endsWith('.docx')
    ? safe
    : `${safe}.docx`;

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
      // User cancelled the picker
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
