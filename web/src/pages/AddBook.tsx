import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, KIND_LABEL, STATUS_LABEL, type Book, type BookKind, type LookupResult, type Status } from '../api';
import { ErrorLine, Field, Modal } from '../ui';

const blank = { title: '', subtitle: '', author: '', year: '', pages: '', isbn: '', coverUrl: '', publication: '', url: '', kind: 'essai' as BookKind, status: 'a_lire' as Status, recommendedBy: '', whyRead: '' };

export default function AddBook({ onClose }: { onClose: () => void }) {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<LookupResult[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<typeof blank | null>(null);
  const set = (patch: Partial<typeof blank>) => setForm((f) => ({ ...(f ?? blank), ...patch }));

  const search = async (e: FormEvent) => {
    e.preventDefault();
    if (query.trim().length < 2) return;
    setBusy(true); setError(null);
    try { setResults(await api<LookupResult[]>(`/lookup?q=${encodeURIComponent(query)}`)); }
    catch (err: any) { setError(err.message); setResults([]); }
    finally { setBusy(false); }
  };
  const pick = (r: LookupResult) => setForm({
    ...blank, title: r.title, subtitle: r.subtitle, author: r.author, year: r.year ? String(r.year) : '',
    pages: r.pages ? String(r.pages) : '', isbn: r.isbn, coverUrl: r.coverUrl,
  });
  const save = async (e: FormEvent) => {
    e.preventDefault();
    if (!form) return;
    setBusy(true); setError(null);
    try {
      const book = await api<Book>('/books', { body: form });
      onClose();
      navigate(`/livre/${book.id}`);
    } catch (err: any) { setError(err.message); setBusy(false); }
  };

  return (
    <Modal title="Ajouter un livre" onClose={onClose} wide>
      {!form ? (
        <div className="addbook">
          <form className="addbook-search" onSubmit={search}>
            <input className="input" autoFocus placeholder="Titre, auteur ou ISBN" value={query} onChange={(e) => setQuery(e.target.value)} aria-label="Chercher un livre" />
            <button className="btn btn-primary" type="submit" disabled={busy}>{busy ? 'Recherche…' : 'Chercher'}</button>
          </form>
          <ErrorLine error={error} />
          {results && !results.length && !error && <p className="addbook-none">Aucun résultat. Tu peux le saisir à la main.</p>}
          <ul className="lookup-list">
            {results?.map((r, i) => (
              <li key={i}>
                <button type="button" className="lookup-item" onClick={() => pick(r)}>
                  {r.coverUrl ? <img className="lookup-cover" src={r.coverUrl.replace('-L.jpg', '-S.jpg')} alt="" /> : <span className="lookup-cover lookup-cover-none" aria-hidden="true" />}
                  <span className="lookup-text">
                    <span className="lookup-title">{r.title}</span>
                    <span className="lookup-meta">{[r.author, r.year, r.pages && `${r.pages} p.`].filter(Boolean).join(' · ')}</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
          <button type="button" className="btn btn-ghost" onClick={() => setForm({ ...blank, title: query })}>Saisir à la main</button>
        </div>
      ) : (
        <form className="form addbook-form" onSubmit={save}>
          <div className="form-grid">
            <Field label="Titre"><input className="input" required autoFocus value={form.title} onChange={(e) => set({ title: e.target.value })} /></Field>
            <Field label="Auteur"><input className="input" value={form.author} onChange={(e) => set({ author: e.target.value })} /></Field>
            <Field label="Sous-titre"><input className="input" value={form.subtitle} onChange={(e) => set({ subtitle: e.target.value })} /></Field>
            <div className="form-row">
              <Field label="Année"><input className="input" inputMode="numeric" value={form.year} onChange={(e) => set({ year: e.target.value })} /></Field>
              <Field label="Pages"><input className="input" inputMode="numeric" value={form.pages} onChange={(e) => set({ pages: e.target.value })} /></Field>
            </div>
            <Field label="Genre">
              <select className="select" value={form.kind} onChange={(e) => set({ kind: e.target.value as BookKind })}>
                {Object.entries(KIND_LABEL).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
              </select>
            </Field>
            {form.kind === 'texte' && (
              <>
                <Field label="Paru dans" hint="Revue, journal ou recueil"><input className="input" value={form.publication} onChange={(e) => set({ publication: e.target.value })} /></Field>
                <Field label="Lien"><input className="input" type="url" value={form.url} onChange={(e) => set({ url: e.target.value })} /></Field>
              </>
            )}
            <Field label="Où le ranger">
              <select className="select" value={form.status} onChange={(e) => set({ status: e.target.value as Status })}>
                {Object.entries(STATUS_LABEL).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
              </select>
            </Field>
            {form.status === 'a_lire' && (
              <>
                <Field label="Recommandé par"><input className="input" value={form.recommendedBy} onChange={(e) => set({ recommendedBy: e.target.value })} /></Field>
                <Field label="Pourquoi le lire"><input className="input" value={form.whyRead} onChange={(e) => set({ whyRead: e.target.value })} /></Field>
              </>
            )}
          </div>
          <ErrorLine error={error} />
          <div className="form-actions">
            <button type="button" className="btn btn-ghost" onClick={() => setForm(null)}>Retour</button>
            <button type="submit" className="btn btn-primary" disabled={busy}>Ajouter à la bibliothèque</button>
          </div>
        </form>
      )}
    </Modal>
  );
}
