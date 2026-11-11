import { useEffect, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { api, useData, type Book } from '../api';
import { ErrorLine, Field, Loading, PageHead } from '../ui';

type Kind = 'note' | 'citation' | 'idee' | 'mot';
const KINDS: [Kind, string][] = [['note', 'Note'], ['citation', 'Citation'], ['idee', 'Idée'], ['mot', 'Mot']];
const TEXT_LABEL: Record<Kind, string> = { note: 'Ma note', citation: 'La citation exacte', idee: 'L’idée, en quelques mots', mot: 'Le mot' };
const MORE_LABEL: Record<Kind, string> = { note: 'Complément', citation: 'Pourquoi elle compte', idee: 'Explication, avec mes mots', mot: 'Définition' };

/** Capture rapide, pensée pour le téléphone pendant la lecture. */
export default function Capture() {
  const { data: books } = useData<Book[]>('/books');
  const [bookId, setBookId] = useState('');
  const [kind, setKind] = useState<Kind>('note');
  const [text, setText] = useState('');
  const [more, setMore] = useState('');
  const [page, setPage] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<{ label: string; bookId: string } | null>(null);

  // Par défaut : le livre en cours.
  useEffect(() => {
    if (bookId || !books?.length) return;
    try {
      const last = localStorage.getItem('capture-book');
      if (last && books.some((b) => String(b.id) === last && b.status === 'en_cours')) { setBookId(last); return; }
    } catch { /* stockage indisponible */ }
    const reading = books.find((b) => b.status === 'en_cours');
    if (reading) setBookId(String(reading.id));
  }, [books, bookId]);

  if (!books) return <Loading />;
  const ordered = [...books].sort((a, b) => Number(b.status === 'en_cours') - Number(a.status === 'en_cours'));

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      if (kind === 'mot') {
        await api('/words', { body: { word: text, definition: more, bookId, page } });
      } else {
        if (!bookId) { setError('Choisis d’abord un livre.'); return; }
        await api(`/books/${bookId}/notes`, { body: { type: kind, text, comment: more, page } });
      }
      try { localStorage.setItem('capture-book', bookId); } catch { /* idem */ }
      setSaved({ label: KINDS.find(([k]) => k === kind)![1], bookId });
      setText(''); setMore('');
    } catch (err: any) { setError(err.message); }
  };

  return (
    <div className="capture">
      <PageHead title="Noter" sub="Une note, une citation ou un mot, sans quitter ta lecture." />
      <form className="form capture-form" onSubmit={submit}>
        <Field label="Livre">
          <select className="select" value={bookId} onChange={(e) => setBookId(e.target.value)}>
            <option value="">{kind === 'mot' ? 'Aucun livre' : 'Choisir un livre'}</option>
            {ordered.map((b) => <option key={b.id} value={b.id}>{b.status === 'en_cours' ? '● ' : ''}{b.title}</option>)}
          </select>
        </Field>
        <div className="chips capture-kinds" role="group" aria-label="Type">
          {KINDS.map(([k, l]) => (
            <button key={k} type="button" className={`chip${kind === k ? ' chip-on' : ''}`} aria-pressed={kind === k} onClick={() => setKind(k)}>{l}</button>
          ))}
        </div>
        <Field label={TEXT_LABEL[kind]}>
          {kind === 'mot' || kind === 'idee'
            ? <input className="input" required value={text} onChange={(e) => setText(e.target.value)} />
            : <textarea className="textarea" required rows={4} value={text} onChange={(e) => setText(e.target.value)} />}
        </Field>
        <Field label={MORE_LABEL[kind]} hint={kind === 'mot' ? 'Tu peux la laisser vide et demander à Claude de compléter.' : undefined}>
          <textarea className="textarea" rows={2} value={more} onChange={(e) => setMore(e.target.value)} />
        </Field>
        <Field label="Page"><input className="input input-short" inputMode="numeric" value={page} onChange={(e) => setPage(e.target.value)} /></Field>
        <ErrorLine error={error} />
        <button type="submit" className="btn btn-primary capture-save">Enregistrer</button>
        {saved && (
          <p className="capture-saved" role="status">
            {saved.label} enregistré{saved.label === 'Mot' ? '' : 'e'}.{' '}
            {saved.bookId ? <Link to={`/livre/${saved.bookId}`}>Voir le livre</Link> : <Link to="/dictionnaire">Voir le dictionnaire</Link>}
          </p>
        )}
      </form>
    </div>
  );
}
