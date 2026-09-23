import './confirmDialog.css';

export interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

/** In-app confirm — reliable in Tauri WKWebView where window.confirm is flaky. */
export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = '删除',
  cancelLabel = '取消',
  danger = true,
  busy = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  if (!open) return null;
  return (
    <div
      className="confd__backdrop"
      role="presentation"
      onClick={() => {
        if (!busy) onCancel();
      }}
    >
      <div
        className="confd"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confd-title"
        aria-describedby="confd-msg"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 id="confd-title">{title}</h3>
        <p id="confd-msg" className="confd__msg">
          {message}
        </p>
        <div className="confd__foot">
          <button type="button" disabled={busy} onClick={onCancel}>
            {cancelLabel}
          </button>
          <button
            type="button"
            className={danger ? 'confd__danger' : 'confd__primary'}
            disabled={busy}
            onClick={onConfirm}
          >
            {busy ? '处理中…' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
