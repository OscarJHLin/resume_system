import {
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
} from 'react';
import { createPortal } from 'react-dom';
import {
  MONTH_OPTIONS,
  buildIsoDate,
  dayOptions,
  formatIsoDateLabel,
  nextDateStep,
  parseIsoDateParts,
  yearOptions,
  type DateStep,
} from './stepDate';
import './stepDatePicker.css';

export interface StepDatePickerProps {
  /** YYYY-MM-DD or '' */
  value: string;
  onChange: (iso: string) => void;
  label?: string;
  /** Optional field — show 清空 */
  allowClear?: boolean;
  disabled?: boolean;
  id?: string;
}

/**
 * Cascading date picker: click → 年 → 月 → 日.
 *
 * Panel is portaled to document.body with position:fixed so it is not clipped
 * by modal `overflow: auto` (WebView2 / Chromium) and stays clickable.
 */
export function StepDatePicker({
  value,
  onChange,
  label,
  allowClear = true,
  disabled = false,
  id,
}: StepDatePickerProps) {
  const autoId = useId();
  const fieldId = id ?? autoId;
  const rootRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [step, setStep] = useState<DateStep>('closed');
  const [draftYear, setDraftYear] = useState<number | null>(null);
  const [draftMonth, setDraftMonth] = useState<number | null>(null);
  const [panelStyle, setPanelStyle] = useState<CSSProperties>({});

  const parts = parseIsoDateParts(value);

  const updatePanelPosition = () => {
    const el = rootRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const width = Math.max(rect.width, 240);
    let left = rect.left;
    let top = rect.bottom + 4;
    const margin = 8;
    if (left + width > window.innerWidth - margin) {
      left = Math.max(margin, window.innerWidth - width - margin);
    }
    const approxHeight = 260;
    if (top + approxHeight > window.innerHeight - margin) {
      top = Math.max(margin, rect.top - approxHeight - 4);
    }
    setPanelStyle({
      position: 'fixed',
      top,
      left,
      width,
      zIndex: 80,
    });
  };

  useLayoutEffect(() => {
    if (step === 'closed') return;
    updatePanelPosition();
  }, [step]);

  useEffect(() => {
    if (step === 'closed') return;
    const onDoc = (e: PointerEvent) => {
      const t = e.target as Node;
      if (rootRef.current?.contains(t) || panelRef.current?.contains(t)) {
        return;
      }
      setStep('closed');
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setStep('closed');
    };
    const onReposition = () => updatePanelPosition();
    document.addEventListener('pointerdown', onDoc, true);
    document.addEventListener('keydown', onKey);
    window.addEventListener('resize', onReposition);
    window.addEventListener('scroll', onReposition, true);
    return () => {
      document.removeEventListener('pointerdown', onDoc, true);
      document.removeEventListener('keydown', onKey);
      window.removeEventListener('resize', onReposition);
      window.removeEventListener('scroll', onReposition, true);
    };
  }, [step]);

  const open = () => {
    if (disabled) return;
    const p = parseIsoDateParts(value);
    setDraftYear(p.year);
    setDraftMonth(p.month);
    setStep('year');
  };

  const pickYear = (y: number) => {
    setDraftYear(y);
    setDraftMonth(null);
    setStep(nextDateStep('year'));
  };

  const pickMonth = (m: number) => {
    setDraftMonth(m);
    setStep(nextDateStep('month'));
  };

  const pickDay = (d: number) => {
    const iso = buildIsoDate(draftYear, draftMonth, d);
    onChange(iso);
    setStep('closed');
  };

  const clear = () => {
    onChange('');
    setDraftYear(null);
    setDraftMonth(null);
    setStep('closed');
  };

  const years = yearOptions();
  const days =
    draftYear != null && draftMonth != null
      ? dayOptions(draftYear, draftMonth)
      : [];

  const panel =
    step !== 'closed'
      ? createPortal(
          <div
            className="sdp__panel"
            role="listbox"
            ref={panelRef}
            style={panelStyle}
          >
            <div className="sdp__steps">
              <span
                className={
                  step === 'year' ? 'sdp__chip sdp__chip--on' : 'sdp__chip'
                }
              >
                年
              </span>
              <span
                className={
                  step === 'month' ? 'sdp__chip sdp__chip--on' : 'sdp__chip'
                }
              >
                月
              </span>
              <span
                className={
                  step === 'day' ? 'sdp__chip sdp__chip--on' : 'sdp__chip'
                }
              >
                日
              </span>
            </div>

            {step === 'year' && (
              <div className="sdp__grid sdp__grid--years">
                {years.map((y) => (
                  <button
                    key={y}
                    type="button"
                    className={
                      y === (draftYear ?? parts.year)
                        ? 'sdp__opt sdp__opt--active'
                        : 'sdp__opt'
                    }
                    onClick={() => pickYear(y)}
                  >
                    {y}
                  </button>
                ))}
              </div>
            )}

            {step === 'month' && (
              <div className="sdp__grid sdp__grid--months">
                <p className="sdp__context">{draftYear} 年</p>
                {MONTH_OPTIONS.map((m) => (
                  <button
                    key={m.value}
                    type="button"
                    className={
                      m.value === (draftMonth ?? parts.month)
                        ? 'sdp__opt sdp__opt--active'
                        : 'sdp__opt'
                    }
                    onClick={() => pickMonth(m.value)}
                  >
                    {m.label}
                  </button>
                ))}
                <button
                  type="button"
                  className="sdp__back"
                  onClick={() => setStep('year')}
                >
                  ← 重选年份
                </button>
              </div>
            )}

            {step === 'day' && draftYear != null && draftMonth != null && (
              <div className="sdp__grid sdp__grid--days">
                <p className="sdp__context">
                  {draftYear} 年 {draftMonth} 月
                </p>
                {days.map((d) => (
                  <button
                    key={d}
                    type="button"
                    className={
                      d === parts.day &&
                      draftYear === parts.year &&
                      draftMonth === parts.month
                        ? 'sdp__opt sdp__opt--active'
                        : 'sdp__opt'
                    }
                    onClick={() => pickDay(d)}
                  >
                    {d}
                  </button>
                ))}
                <button
                  type="button"
                  className="sdp__back"
                  onClick={() => setStep('month')}
                >
                  ← 重选月份
                </button>
              </div>
            )}
          </div>,
          document.body,
        )
      : null;

  return (
    <div
      className={`sdp${disabled ? ' sdp--disabled' : ''}`}
      ref={rootRef}
    >
      {label && (
        <label className="sdp__label" htmlFor={fieldId}>
          {label}
        </label>
      )}
      <div className="sdp__row">
        <button
          type="button"
          id={fieldId}
          className={`sdp__trigger${value ? '' : ' sdp__trigger--empty'}`}
          disabled={disabled}
          aria-haspopup="listbox"
          aria-expanded={step !== 'closed'}
          onClick={open}
        >
          {value ? formatIsoDateLabel(value) : '选择日期（年 → 月 → 日）'}
        </button>
        {allowClear && value && !disabled && (
          <button type="button" className="sdp__clear" onClick={clear}>
            清空
          </button>
        )}
      </div>
      {panel}
    </div>
  );
}
