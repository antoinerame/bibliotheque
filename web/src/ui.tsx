import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';

export function Loading() {
  return <p className="loading">Chargement…</p>;
}
export function ErrorLine({ error }: { error: string | null }) {
  return error ? <p className="error" role="alert">{error}</p> : null;
}

export function formatDate(d: string | null) {
  if (!d) return '';
  const date = new Date(d.length === 10 ? `${d}T12:00:00` : d);
  return Number.isNaN(date.getTime()) ? d : date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
}

export function Modal({ title, onClose, children, wide }: { title: string; onClose: () => void; children: ReactNode; wide?: boolean }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div className="modal-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className={`modal${wide ? ' modal-wide' : ''}`} role="dialog" aria-modal="true" aria-label={title}>
        <header className="modal-head">
          <h2 className="modal-title">{title}</h2>
          <button type="button" className="btn btn-ghost modal-close" onClick={onClose} aria-label="Fermer">✕</button>
        </header>
        <div className="modal-body">{children}</div>
      </div>
    </div>
  );
}

export function Stars({ value, onChange }: { value: number; onChange?: (v: number) => void }) {
  return (
    <span className={`stars${onChange ? ' stars-editable' : ''}`} role={onChange ? 'radiogroup' : 'img'} aria-label={`Note : ${value} sur 5`}>
      {[1, 2, 3, 4, 5].map((n) => onChange ? (
        <button
          key={n} type="button" className={`star${n <= value ? ' star-on' : ''}`}
          aria-label={`${n} sur 5`} aria-checked={n === value} role="radio"
          onClick={() => onChange(n === value ? 0 : n)}
        >★</button>
      ) : (
        <span key={n} className={`star${n <= value ? ' star-on' : ''}`} aria-hidden="true">★</span>
      ))}
    </span>
  );
}

/** Zone de texte qui grandit avec son contenu et s'enregistre quand on la quitte. */
export function AutoText({ value, onSave, placeholder, label, className }: {
  value: string; onSave: (v: string) => void | Promise<void>; placeholder?: string; label: string; className?: string;
}) {
  const [draft, setDraft] = useState(value);
  const [focused, setFocused] = useState(false);
  const ref = useRef<HTMLTextAreaElement>(null);
  useEffect(() => { if (!focused) setDraft(value); }, [value, focused]);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight + 2}px`;
  }, [draft]);
  return (
    <textarea
      ref={ref} rows={2} className={`autotext${className ? ` ${className}` : ''}`}
      aria-label={label} placeholder={placeholder} value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onFocus={() => setFocused(true)}
      onBlur={() => { setFocused(false); if (draft.trim() !== value) onSave(draft.trim()); }}
    />
  );
}

export function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return (
    <label className="field">
      <span className="field-label">{label}</span>
      {children}
      {hint && <span className="field-hint">{hint}</span>}
    </label>
  );
}

export function Empty({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="empty">
      <p className="empty-title">{title}</p>
      {children && <div className="empty-body">{children}</div>}
    </div>
  );
}

export function PageHead({ title, sub, actions }: { title: string; sub?: ReactNode; actions?: ReactNode }) {
  return (
    <header className="page-head">
      <div className="page-head-text">
        <h1 className="page-title">{title}</h1>
        {sub && <p className="page-sub">{sub}</p>}
      </div>
      {actions && <div className="page-actions">{actions}</div>}
    </header>
  );
}
