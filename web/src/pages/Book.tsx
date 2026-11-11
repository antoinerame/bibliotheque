import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { api, useData, KIND_LABEL, STATUS_LABEL, type BookFull, type BookKind, type Note, type NoteType, type Status, type Theme, type Word } from '../api';
import { useDesign } from '../designs';
import { NoteForm, NoteItem, WordCard, WordForm } from '../parts';
import { AutoText, ErrorLine, Field, Loading, Modal, Stars, formatDate } from '../ui';

const SECTIONS: { type: NoteType; title: string; add: string; empty: string }[] = [
  { type: 'idee', title: 'Idées clés', add: 'Ajouter une idée', empty: 'Aucune idée clé notée. Quelles sont les trois choses à retenir de ce livre ?' },
  { type: 'citation', title: 'Citations', add: 'Ajouter une citation', empty: 'Aucune citation pour le moment.' },
  { type: 'note', title: 'Notes au fil des chapitres', add: 'Ajouter une note', empty: 'Aucune note pour le moment.' },
  { type: 'personnage', title: 'Personnages', add: 'Ajouter un personnage', empty: 'Aucun personnage noté.' },
];

export default function BookPage() {
  const id = Number(useParams().id);
  const { data: book, error } = useData<BookFull>(`/books/${id}`);
  const { data: themes } = useData<Theme[]>('/themes');
  const { BookCover } = useDesign();
  const location = useLocation();
  const [adding, setAdding] = useState<NoteType | 'mot' | null>(null);
  const [editingWord, setEditingWord] = useState<Word | null>(null);
  const [details, setDetails] = useState(false);
  const themeNames = useMemo(() => (themes ?? []).map((t) => t.name), [themes]);

  // Arrivée depuis la recherche ou la remontée du jour : on défile jusqu'à la note.
  const loaded = !!book;
  useEffect(() => {
    if (!loaded || !location.hash) return;
    const el = document.getElementById(location.hash.slice(1));
    if (el) { el.scrollIntoView({ block: 'center' }); el.classList.add('is-target'); }
  }, [loaded, location.hash]);

  if (error) return <p className="error">{error} <Link to="/">Retour aux étagères</Link></p>;
  if (!book) return <Loading />;

  const patch = (body: Partial<Record<keyof BookFull, unknown>>) => api(`/books/${id}`, { method: 'PATCH', body });
  const pct = book.pages ? Math.min(100, Math.round((book.currentPage / book.pages) * 100)) : 0;
  const sections = SECTIONS.filter((s) => s.type !== 'personnage' || book.kind === 'roman' || book.counts.personnage > 0);
  const meta = [KIND_LABEL[book.kind], book.year, book.pages && `${book.pages} pages`].filter(Boolean).join(' · ');

  return (
    <article className={`book book-${book.status} book-kind-${book.kind}`}>
      <Link to="/" className="back">← Étagères</Link>

      <header className="book-head">
        <div className="book-cover"><BookCover book={book} size="lg" /></div>
        <div className="book-id">
          <h1 className="book-title">{book.title}</h1>
          {book.subtitle && <p className="book-subtitle">{book.subtitle}</p>}
          {book.author && <p className="book-author">{book.author}</p>}
          <p className="book-meta">{meta}</p>

          <div className="book-state">
            <label className="book-status">
              <span className="sr-only">Statut</span>
              <select className="select" value={book.status} onChange={(e) => patch({ status: e.target.value as Status })}>
                {Object.entries(STATUS_LABEL).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
              </select>
            </label>
            <Stars value={book.rating} onChange={(rating) => patch({ rating })} />
            <button type="button" className="btn btn-ghost btn-small" onClick={() => setDetails(true)}>Modifier la fiche</button>
          </div>

          {book.status === 'en_cours' && (
            <div className="book-progress">
              <span className="progress" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label="Avancement">
                <span className="progress-fill" style={{ width: `${pct}%` }} />
              </span>
              <PageInput value={book.currentPage} pages={book.pages} onSave={(currentPage) => patch({ currentPage })} />
            </div>
          )}
          <p className="book-dates">
            {book.startedAt && <span>Commencé le {formatDate(book.startedAt)}</span>}
            {book.finishedAt && <span>Terminé le {formatDate(book.finishedAt)}</span>}
          </p>
          {(book.recommendedBy || book.whyRead) && (
            <p className="book-why">
              {book.recommendedBy && <span className="book-reco">Recommandé par {book.recommendedBy}. </span>}
              {book.whyRead}
            </p>
          )}
        </div>
      </header>

      <section className="book-essence" aria-label="L’essentiel">
        <div className="essence essence-summary">
          <h2 className="essence-title">En trois phrases</h2>
          <AutoText label="Résumé en trois phrases" value={book.summary} onSave={(summary) => patch({ summary })} placeholder="De quoi parle ce livre, et que défend-il ?" />
        </div>
        <div className="essence essence-impact">
          <h2 className="essence-title">Ce que ça change pour moi</h2>
          <AutoText label="Ce que ça change pour moi" value={book.impact} onSave={(impact) => patch({ impact })} placeholder="Ce que je pense ou fais différemment depuis." />
        </div>
        <div className="essence essence-disagree">
          <h2 className="essence-title">Mes désaccords</h2>
          <AutoText label="Mes désaccords avec l’auteur" value={book.disagreements} onSave={(disagreements) => patch({ disagreements })} placeholder="Là où l’auteur ne m’a pas convaincu." />
        </div>
      </section>

      {sections.map((s) => {
        const notes = book.notes.filter((n) => n.type === s.type);
        return (
          <section key={s.type} className={`book-section book-section-${s.type}`}>
            <header className="section-head">
              <h2 className="section-title">{s.title} {notes.length > 0 && <span className="section-count">{notes.length}</span>}</h2>
              <button type="button" className="btn btn-ghost btn-small" onClick={() => setAdding(s.type)}>+ {s.add}</button>
            </header>
            {adding === s.type && (
              <NoteForm bookId={id} type={s.type} themeNames={themeNames} onDone={() => setAdding(null)} onCancel={() => setAdding(null)} />
            )}
            {!notes.length && adding !== s.type && <p className="section-empty">{s.empty}</p>}
            {s.type === 'note'
              ? byChapter(notes).map(([chapter, list]) => (
                <div key={chapter} className="chapter">
                  {chapter && <h3 className="chapter-title">{chapter}</h3>}
                  <ul className="notes">{list.map((n) => <NoteItem key={n.id} note={n} themeNames={themeNames} hideChapter />)}</ul>
                </div>
              ))
              : notes.length > 0 && <ul className={`notes notes-${s.type}`}>{notes.map((n) => <NoteItem key={n.id} note={n} themeNames={themeNames} />)}</ul>}
          </section>
        );
      })}

      <section className="book-section book-section-words">
        <header className="section-head">
          <h2 className="section-title">Mots appris {book.words.length > 0 && <span className="section-count">{book.words.length}</span>}</h2>
          <button type="button" className="btn btn-ghost btn-small" onClick={() => setAdding('mot')}>+ Ajouter un mot</button>
        </header>
        {!book.words.length && <p className="section-empty">Aucun mot appris dans ce livre.</p>}
        <div className="words">
          {book.words.map((w) => <WordCard key={w.id} word={w} showBook={false} onEdit={() => setEditingWord(w)} />)}
        </div>
      </section>

      {(adding === 'mot' || editingWord) && (
        <Modal title={editingWord ? 'Modifier le mot' : 'Nouveau mot'} onClose={() => { setAdding(null); setEditingWord(null); }}>
          <WordForm
            word={editingWord ?? undefined} books={[{ id: book.id, title: book.title }]} defaultBookId={book.id}
            onDone={() => { setAdding(null); setEditingWord(null); }} onCancel={() => { setAdding(null); setEditingWord(null); }}
          />
        </Modal>
      )}
      {details && <DetailsModal book={book} onClose={() => setDetails(false)} />}
    </article>
  );
}

function byChapter(notes: Note[]): [string, Note[]][] {
  const map = new Map<string, Note[]>();
  for (const n of notes) {
    if (!map.has(n.chapter)) map.set(n.chapter, []);
    map.get(n.chapter)!.push(n);
  }
  return [...map.entries()];
}

function PageInput({ value, pages, onSave }: { value: number; pages: number | null; onSave: (v: number) => void }) {
  const [draft, setDraft] = useState(String(value));
  useEffect(() => setDraft(String(value)), [value]);
  const commit = () => { const n = Number(draft); if (Number.isFinite(n) && n !== value) onSave(Math.max(0, Math.round(n))); };
  return (
    <label className="page-input">
      <span>Page</span>
      <input
        className="input input-short" inputMode="numeric" value={draft} aria-label="Page en cours"
        onChange={(e) => setDraft(e.target.value)} onBlur={commit}
        onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
      />
      {pages ? <span>sur {pages}</span> : null}
    </label>
  );
}

function DetailsModal({ book, onClose }: { book: BookFull; onClose: () => void }) {
  const navigate = useNavigate();
  const [f, setF] = useState({
    title: book.title, subtitle: book.subtitle, author: book.author,
    year: book.year ? String(book.year) : '', pages: book.pages ? String(book.pages) : '',
    kind: book.kind, coverUrl: book.coverUrl, color: book.color,
    startedAt: book.startedAt ?? '', finishedAt: book.finishedAt ?? '',
    recommendedBy: book.recommendedBy, whyRead: book.whyRead,
  });
  const [error, setError] = useState<string | null>(null);
  const set = (p: Partial<typeof f>) => setF((x) => ({ ...x, ...p }));
  const save = async (e: FormEvent) => {
    e.preventDefault();
    try { await api(`/books/${book.id}`, { method: 'PATCH', body: f }); onClose(); } catch (err: any) { setError(err.message); }
  };
  const remove = async () => {
    if (!window.confirm(`Supprimer « ${book.title} » et toutes ses notes ? C’est définitif.`)) return;
    await api(`/books/${book.id}`, { method: 'DELETE' });
    navigate('/');
  };
  return (
    <Modal title="Modifier la fiche" onClose={onClose} wide>
      <form className="form" onSubmit={save}>
        <div className="form-grid">
          <Field label="Titre"><input className="input" required value={f.title} onChange={(e) => set({ title: e.target.value })} /></Field>
          <Field label="Auteur"><input className="input" value={f.author} onChange={(e) => set({ author: e.target.value })} /></Field>
          <Field label="Sous-titre"><input className="input" value={f.subtitle} onChange={(e) => set({ subtitle: e.target.value })} /></Field>
          <div className="form-row">
            <Field label="Année"><input className="input" inputMode="numeric" value={f.year} onChange={(e) => set({ year: e.target.value })} /></Field>
            <Field label="Pages"><input className="input" inputMode="numeric" value={f.pages} onChange={(e) => set({ pages: e.target.value })} /></Field>
          </div>
          <Field label="Genre">
            <select className="select" value={f.kind} onChange={(e) => set({ kind: e.target.value as BookKind })}>
              {Object.entries(KIND_LABEL).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
            </select>
          </Field>
          <div className="form-row">
            <Field label="Commencé le"><input className="input" type="date" value={f.startedAt} onChange={(e) => set({ startedAt: e.target.value })} /></Field>
            <Field label="Terminé le"><input className="input" type="date" value={f.finishedAt} onChange={(e) => set({ finishedAt: e.target.value })} /></Field>
          </div>
          <Field label="Recommandé par"><input className="input" value={f.recommendedBy} onChange={(e) => set({ recommendedBy: e.target.value })} /></Field>
          <Field label="Pourquoi le lire"><input className="input" value={f.whyRead} onChange={(e) => set({ whyRead: e.target.value })} /></Field>
          <Field label="Image de couverture (adresse)"><input className="input" type="url" value={f.coverUrl} onChange={(e) => set({ coverUrl: e.target.value })} /></Field>
          <Field label="Couleur du dos" hint="Laisse vide pour laisser l’étagère choisir.">
            <span className="color-field">
              <input type="color" className="color-input" value={f.color || '#7c2f2a'} onChange={(e) => set({ color: e.target.value })} aria-label="Couleur du dos" />
              {f.color && <button type="button" className="btn btn-ghost btn-small" onClick={() => set({ color: '' })}>Automatique</button>}
            </span>
          </Field>
        </div>
        <ErrorLine error={error} />
        <div className="form-actions">
          <button type="button" className="btn btn-ghost btn-danger" onClick={remove}>Supprimer le livre</button>
          <span className="form-spacer" />
          <button type="button" className="btn btn-ghost" onClick={onClose}>Annuler</button>
          <button type="submit" className="btn btn-primary">Enregistrer</button>
        </div>
      </form>
    </Modal>
  );
}
