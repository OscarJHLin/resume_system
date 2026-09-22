import { useEffect, useId, useRef, useState } from 'react';
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
  const [step, setStep] = useState<DateStep>('closed');
  const [draftYear, setDraftYear] = useState<number | null>(null);
  const [draftMonth, setDraftMonth] = useState<number | null>(null);

  const parts = parseIsoDateParts(value);

  useEffect(() => {
    if (step === 'closed') return;
    const onDoc = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) {
        setStep('closed');
      }
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
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

      {step !== 'closed' && (
        <div className="sdp__panel" role="listbox">
          <div className="sdp__steps">
            <span className={step === 'year' ? 'sdp__chip sdp__chip--on' : 'sdp__chip'}>
              年
            </span>
            <span className={step === 'month' ? 'sdp__chip sdp__chip--on' : 'sdp__chip'}>
              月
            </span>
            <span className={step === 'day' ? 'sdp__chip sdp__chip--on' : 'sdp__chip'}>
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
        </div>
      )}
    </div>
  );
}
