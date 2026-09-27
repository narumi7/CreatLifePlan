import { useEffect, useId, useState, type ReactNode } from 'react';

type Unit = '円' | '万円' | '%' | '歳' | '年' | 'か月' | '倍';

const SCALE: Record<Unit, number> = { 円: 1, 万円: 10_000, '%': 0.01, 歳: 1, 年: 1, か月: 1, 倍: 1 };

function format(v: number, unit: Unit): string {
  const x = v / SCALE[unit];
  return String(Math.round(x * 1000) / 1000);
}

interface NumberFieldProps {
  label: string;
  value: number;
  onChange: (v: number) => void;
  unit: Unit;
  hint?: ReactNode;
  min?: number;
  max?: number;
  step?: number;
  disabled?: boolean;
}

/** 数値入力。value は内部単位（円・小数）で持ち、画面では unit に換算して表示する */
export function NumberField({ label, value, onChange, unit, hint, min, max, step, disabled }: NumberFieldProps) {
  const id = useId();
  const [text, setText] = useState(format(value, unit));
  useEffect(() => {
    const parsed = Number(text) * SCALE[unit];
    if (!Number.isFinite(parsed) || Math.abs(parsed - value) > 1e-9) setText(format(value, unit));
  }, [value, unit]);
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <div className="input-unit">
        <input
          id={id}
          type="number"
          inputMode="decimal"
          value={text}
          min={min}
          max={max}
          step={step ?? 'any'}
          disabled={disabled}
          onChange={(e) => {
            setText(e.target.value);
            const n = Number(e.target.value);
            if (e.target.value !== '' && Number.isFinite(n)) onChange(n * SCALE[unit]);
          }}
          onBlur={() => setText(format(value, unit))}
        />
        <span className="unit">{unit}</span>
      </div>
      {hint && <small className="hint">{hint}</small>}
    </div>
  );
}

export function TextField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  const id = useId();
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <input id={id} type="text" value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}

export function SelectField<T extends string>({
  label,
  value,
  options,
  onChange,
  hint,
}: {
  label: string;
  value: T;
  options: { value: T; label: string }[] | Record<T, string>;
  onChange: (v: T) => void;
  hint?: ReactNode;
}) {
  const id = useId();
  const opts = Array.isArray(options)
    ? options
    : (Object.entries(options) as [T, string][]).map(([v, l]) => ({ value: v, label: l }));
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <select id={id} value={value} onChange={(e) => onChange(e.target.value as T)}>
        {opts.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      {hint && <small className="hint">{hint}</small>}
    </div>
  );
}

export function Toggle({ label, checked, onChange, hint }: { label: string; checked: boolean; onChange: (v: boolean) => void; hint?: ReactNode }) {
  return (
    <div className="field toggle-field">
      <label className="toggle">
        <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
        <span>{label}</span>
      </label>
      {hint && <small className="hint">{hint}</small>}
    </div>
  );
}

export function Card({ title, children, actions, className }: { title?: ReactNode; children: ReactNode; actions?: ReactNode; className?: string }) {
  return (
    <section className={`card ${className ?? ''}`}>
      {(title || actions) && (
        <header className="card-head">
          {title && <h2>{title}</h2>}
          {actions && <div className="card-actions">{actions}</div>}
        </header>
      )}
      {children}
    </section>
  );
}

export function Grid({ children }: { children: ReactNode }) {
  return <div className="grid">{children}</div>;
}

export function Note({ children }: { children: ReactNode }) {
  return <p className="note">{children}</p>;
}
