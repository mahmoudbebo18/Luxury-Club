// Form field wrapper using the site's .field styles (label, control, error).
import type { ReactNode } from 'react';

type Props = { label: string; htmlFor: string; error?: string; full?: boolean; hint?: string; children: ReactNode };

export function Field({ label, htmlFor, error, full, hint, children }: Props) {
  return (
    <div className={['field', full && 'field--full', error && 'has-error'].filter(Boolean).join(' ')}>
      <label htmlFor={htmlFor}>{label}</label>
      {children}
      {hint && !error && <span className="field-hint">{hint}</span>}
      {error && <span className="field-error field-error--show">{error}</span>}
    </div>
  );
}

export function FormStatus({ tone, children }: { tone: 'success' | 'error'; children: ReactNode }) {
  return <div className={`form-status is-${tone}`} role={tone === 'error' ? 'alert' : 'status'}>{children}</div>;
}
