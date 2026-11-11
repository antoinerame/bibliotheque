import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { api, NOTE_LABEL, type Book, type Note, type NoteType, type Word } from './api';
import { ErrorLine, Field } from './ui';

/* ---------- notes ---------- */
const NOTE_HINTS: Record<NoteType, { text: string; comment: string; textLabel: string; commentLabel: string }> = {
  idee: { textLabel: 'L’idée, en quelques mots', text: 'Ex. : L’ancrage', commentLabel: 'Explication, avec mes mots', comment: 'Comme si je l’expliquais à un ami…' },
  citation: { textLabel: 'Citation exacte', text: 'Sans guillemets', commentLabel: 'Pourquoi elle compte', comment: '' },
  note: { textLabel: 'Note', text: 'Ce que je veux retenir de ce passage', commentLabel: 'Complément', comment: '' },
  personnage: { textLabel: 'Nom', text: '', commentLabel: 'Qui est-ce', comment: '' },
};

export function NoteForm({ bookId, type, note, themeNames, onDone, onCancel }: {
  bookId: number; type: NoteType; note?: Note; themeNames: string[]; onDone: () => void; onCancel: () => void;
}) {
  const [text, setText] = useState(note?.text ?? '');
  const [comment, setComment] = useState(note?.comment ?? '');
  const [chapter, setChapter] = useState(note?.chapter ?? '');
  const [page, setPage] = useState(note?.page ? String(note.page) : '');
  const [themes, setThemes] = useState(note?.themes.map((t) => t.name).join(', ') ?? '');
  const [verify, setVerify] = useState(note?.verify ?? false);
  const [error, setError] = useState<string | null>(null);
  const h = NOTE_HINTS[type];
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const body = { type, text, comment, chapter, page, verify, themes: themes.split(',').map((s) => s.trim()).filter(Boolean) };
    try {
      if (note) await api(`/notes/${note.id}`, { method: 'PATCH', body });
      else await api(`/books/${bookId}/notes`, { body });
      onDone();
    } catch (err: any) { setError(err.message); }
  };
  const listId = `themes-${bookId}-${type}-${note?.id ?? 'new'}`;
  return (
    <form className={`form note-form note-form-${type}`} onSubmit={submit}>
      <Field label={h.textLabel}>
        {type === 'idee' || type === 'personnage'
          ? <input className="input" required autoFocus placeholder={h.text} value={text} onChange={(e) => setText(e.target.value)} />
          : <textarea className="textarea" required autoFocus rows={3} placeholder={h.text} value={text} onChange={(e) => setText(e.target.value)} />}
      </Field>
      <Field label={h.commentLabel}>
        <textarea className="textarea" rows={type === 'idee' ? 4 : 2} placeholder={h.comment} value={comment} onChange={(e) => setComment(e.target.value)} />
      </Field>
      {type !== 'personnage' && (
        <div className="form-row">
          <Field label="Chapitre"><input className="input" value={chapter} onChange={(e) => setChapter(e.target.value)} /></Field>
          <Field label="Page"><input className="input input-short" inputMode="numeric" value={page} onChange={(e) => setPage(e.target.value)} /></Field>
        </div>
      )}
      {(type === 'idee' || type === 'citation') && (
        <Field label="Thèmes" hint="Séparés par des virgules. Ils relient les idées de plusieurs livres.">
          <input className="input" list={listId} value={themes} onChange={(e) => setThemes(e.target.value)} placeholder="Ex. : Biais cognitifs" />
          <datalist id={listId}>{themeNames.map((n) => <option key={n} value={n} />)}</datalist>
        </Field>
      )}
      {type === 'citation' && (
        <label className="check">
          <input type="checkbox" checked={verify} onChange={(e) => setVerify(e.target.checked)} />
          <span>À vérifier dans le livre</span>
        </label>
      )}
      <ErrorLine error={error} />
      <div className="form-actions">
        <button type="button" className="btn btn-ghost" onClick={onCancel}>Annuler</button>
        <button type="submit" className="btn btn-primary">{note ? 'Enregistrer' : 'Ajouter'}</button>
      </div>
    </form>
  );
}

export function NoteItem({ note, themeNames, showBook, hideChapter }: {
  note: Note; themeNames: string[]; showBook?: boolean;
  /** Le chapitre est déjà affiché en titre de groupe : on ne le répète pas sous la note. */
  hideChapter?: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const remove = async () => {
    if (window.confirm(`Supprimer cette ${NOTE_LABEL[note.type].toLowerCase()} ?`)) await api(`/notes/${note.id}`, { method: 'DELETE' });
  };
  if (editing) {
    return (
      <li className="note note-editing" id={`note-${note.id}`}>
        <NoteForm bookId={note.bookId} type={note.type} note={note} themeNames={themeNames} onDone={() => setEditing(false)} onCancel={() => setEditing(false)} />
      </li>
    );
  }
  const meta = [hideChapter ? '' : note.chapter, note.page ? `p. ${note.page}` : ''].filter(Boolean).join(' · ');
  return (
    <li className={`note note-${note.type}${note.verify ? ' note-verify' : ''}`} id={`note-${note.id}`}>
      <div className="note-main">
        {note.type === 'citation'
          ? <blockquote className="note-text note-quote">{note.text}</blockquote>
          : <p className="note-text">{note.text}</p>}
        {note.comment && <p className="note-comment">{note.comment}</p>}
        <div className="note-meta">
          {showBook && <Link to={`/livre/${note.bookId}#note-${note.id}`} className="note-book">{note.bookTitle}</Link>}
          {meta && <span className="note-where">{meta}</span>}
          {note.verify && <span className="tag tag-warn">À vérifier</span>}
          {note.type === 'idee' && !note.comment && <span className="tag tag-warn">À expliquer</span>}
          {note.themes.map((t) => <Link key={t.id} to={`/themes/${t.id}`} className="tag tag-theme">{t.name}</Link>)}
        </div>
      </div>
      <div className="note-actions">
        <button type="button" className="btn btn-ghost btn-small" onClick={() => setEditing(true)}>Modifier</button>
        <button type="button" className="btn btn-ghost btn-small btn-danger" onClick={remove}>Supprimer</button>
      </div>
    </li>
  );
}

/* ---------- mots ---------- */
export function WordForm({ word, books, defaultBookId, onDone, onCancel }: {
  word?: Word; books: Pick<Book, 'id' | 'title'>[]; defaultBookId?: number | null; onDone: () => void; onCancel: () => void;
}) {
  const [f, setF] = useState({
    word: word?.word ?? '', definition: word?.definition ?? '', etymology: word?.etymology ?? '',
    example: word?.example ?? '', mySentence: word?.mySentence ?? '',
    bookId: String(word?.bookId ?? defaultBookId ?? ''), page: word?.page ? String(word.page) : '',
  });
  const [error, setError] = useState<string | null>(null);
  const set = (p: Partial<typeof f>) => setF((x) => ({ ...x, ...p }));
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    try {
      if (word) await api(`/words/${word.id}`, { method: 'PATCH', body: f });
      else await api('/words', { body: f });
      onDone();
    } catch (err: any) { setError(err.message); }
  };
  return (
    <form className="form word-form" onSubmit={submit}>
      <Field label="Mot"><input className="input" required autoFocus value={f.word} onChange={(e) => set({ word: e.target.value })} /></Field>
      <Field label="Définition"><textarea className="textarea" rows={2} value={f.definition} onChange={(e) => set({ definition: e.target.value })} /></Field>
      <Field label="Étymologie"><input className="input" value={f.etymology} onChange={(e) => set({ etymology: e.target.value })} /></Field>
      <Field label="La phrase où je l’ai rencontré"><textarea className="textarea" rows={2} value={f.example} onChange={(e) => set({ example: e.target.value })} /></Field>
      <Field label="Ma phrase" hint="L’employer soi-même est le meilleur moyen de le retenir.">
        <textarea className="textarea" rows={2} value={f.mySentence} onChange={(e) => set({ mySentence: e.target.value })} />
      </Field>
      <div className="form-row">
        <Field label="Livre">
          <select className="select" value={f.bookId} onChange={(e) => set({ bookId: e.target.value })}>
            <option value="">Aucun</option>
            {books.map((b) => <option key={b.id} value={b.id}>{b.title}</option>)}
          </select>
        </Field>
        <Field label="Page"><input className="input input-short" inputMode="numeric" value={f.page} onChange={(e) => set({ page: e.target.value })} /></Field>
      </div>
      <ErrorLine error={error} />
      <div className="form-actions">
        <button type="button" className="btn btn-ghost" onClick={onCancel}>Annuler</button>
        <button type="submit" className="btn btn-primary">{word ? 'Enregistrer' : 'Ajouter'}</button>
      </div>
    </form>
  );
}

const LEVELS = ['Nouveau', 'Vu', 'En cours', 'Acquis', 'Acquis', 'Maîtrisé', 'Maîtrisé'];

export function WordCard({ word, onEdit, showBook = true }: { word: Word; onEdit: () => void; showBook?: boolean }) {
  const remove = async () => {
    if (window.confirm(`Supprimer « ${word.word} » du dictionnaire ?`)) await api(`/words/${word.id}`, { method: 'DELETE' });
  };
  return (
    <article className="word" id={`mot-${word.id}`}>
      <header className="word-head">
        <h3 className="word-term">{word.word}</h3>
        <span className={`word-level word-level-${Math.min(word.box, 6)}`}>{word.reviews ? LEVELS[Math.min(word.box, 6)] : 'Nouveau'}</span>
      </header>
      {word.definition ? <p className="word-def">{word.definition}</p> : <p className="word-def word-missing">Pas encore de définition.</p>}
      {word.etymology && <p className="word-etym"><span className="word-label">Étymologie</span> {word.etymology}</p>}
      {word.example && <p className="word-example"><span className="word-label">Rencontré</span> « {word.example} »</p>}
      {word.mySentence && <p className="word-mine"><span className="word-label">Ma phrase</span> « {word.mySentence} »</p>}
      <footer className="word-foot">
        {showBook && word.bookId && (
          <Link to={`/livre/${word.bookId}`} className="word-book">{word.bookTitle}{word.page ? `, p. ${word.page}` : ''}</Link>
        )}
        <span className="word-actions">
          <button type="button" className="btn btn-ghost btn-small" onClick={onEdit}>Modifier</button>
          <button type="button" className="btn btn-ghost btn-small btn-danger" onClick={remove}>Supprimer</button>
        </span>
      </footer>
    </article>
  );
}
