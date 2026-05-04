import type { InputHTMLAttributes } from 'react';

type Props = {
  label: string;
  hint?: string;
} & InputHTMLAttributes<HTMLInputElement>;

export function Field({ label, hint, id, className = '', ...rest }: Props) {
  const fieldId = id ?? rest.name;
  return (
    <div>
      <div className="flex items-center justify-between">
        <label
          htmlFor={fieldId}
          className="font-mono text-[11px] uppercase tracking-[0.2em] text-ink-300"
        >
          {label}
        </label>
        {hint && (
          <span className="font-mono text-[11px] text-ink-400">{hint}</span>
        )}
      </div>
      <input
        id={fieldId}
        className={`mt-2 block w-full rounded-md border border-base-700 bg-base-950 px-3.5 py-2.5 text-[15px] text-white placeholder:text-ink-400 outline-none transition-colors focus:border-amber-500 ${className}`}
        {...rest}
      />
    </div>
  );
}
