import { useEffect, useId, useRef, useState } from 'react';
import './confirmDialog.css';

export interface PromptDialogProps {
  open: boolean;
  title: string;
  label?: string;
  defaultValue?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  busy?: boolean;
  onConfirm: (value: string) => void;
  onCancel: () => void;
}

/** In-app text prompt — reliable in Tauri WKWebView where window.prompt is blocked. */
export function PromptDialog({
  open,
  title,
  label = '标题',
  defaultValue = '',
  confirmLabel = '确定',
  cancelLabel = '取消',
  busy = false,
  onConfirm,
  onCancel,
}: PromptDialogProps) {
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [value, setValue] = useState(defaultValue);

  useEffect(() => {
    if (!open) return;
    setValue(defaultValue);
    const t = window.setTimeout(() => {
      inputRef.current?.focus();
      inputRef.current?.select();
    }, 0);
    return () => window.clearTimeout(t);
  }, [open, defaultValue]);

  if (!open) return null;

  const submit = () => {
    if (busy) return;
    onConfirm(value);
  };

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
        role="dialog"
        aria-modal="true"
        aria-labelledby={`${inputId}-title`}
        onClick={(e) => e.stopPropagation()}
      >
        <h3 id={`${inputId}-title`}>{title}</h3>
        <label className="confd__field" htmlFor={inputId}>
          <span className="confd__field-label">{label}</span>
          <input
            ref={inputRef}
            id={inputId}
            type="text"
            value={value}
            disabled={busy}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                submit();
              } else if (e.key === 'Escape') {
                e.preventDefault();
                if (!busy) onCancel();
              }
            }}
          />
        </label>
        <div className="confd__foot">
          <button type="button" disabled={busy} onClick={onCancel}>
            {cancelLabel}
          </button>
          <button
            type="button"
            className="confd__primary"
            disabled={busy}
            onClick={submit}
          >
            {busy ? '处理中…' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
