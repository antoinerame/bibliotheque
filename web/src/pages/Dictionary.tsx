import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useData, type Book, type Word } from '../api';
import { WordCard, WordForm } from '../parts';
import { Empty, Loading, Modal, PageHead } from '../ui';

const letterOf = (w: string) => {
  const c = w.trim().charAt(0).normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase();
  return /[A-Z]/.test(c) ? c : '#';
};

export default function Dictionary() {
  const { data: words } = useData<Word[]>('/words');
  const { data: books } = useData<Book[]>('/books');
  const [params] = useSearchParams();
  const [q, setQ] = useState('');
  const [bookId, setBookId] = useState('');
  const [editing, setEditing] = useState<Word | 'new' | null>(null);

  const groups = useMemo(() => {
    const s = q.trim().toLowerCase();
    const list = (words ?? []).filter((w) =>
      (!s || w.word.toLowerCase().includes(s) || w.definition.toLowerCase().includes(s)) && (!bookId || String(w.bookId) === bookId));
    const map = new Map<string, Word[]>();
    for (const w of list) {
      const l = letterOf(w.word);
      if (!map.has(l)) map.set(l, []);
      map.get(l)!.push(w);
    }
    return [...map.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [words, q, bookId]);

  const target = params.get('mot');
  const ready = !!words;
  useEffect(() => {
    if (!ready || !target) return;
    const el = document.getElementById(`mot-${target}`);
    if (el) { el.scrollIntoView({ block: 'center' }); el.classList.add('is-target'); }
  }, [ready, target]);

  if (!words) return <Loading />;
  const withWords = (books ?? []).filter((b) => b.counts.words > 0);

  return (
    <div className="dictionary">
      <PageHead
        title="Dictionnaire"
        sub={`${words.length} ${words.length > 1 ? 'mots appris' : 'mot appris'}`}
        actions={<button type="button" className="btn btn-primary" onClick={() => setEditing('new')}>+ Mot</button>}
      />
      {!words.length ? (
        <Empty title="Aucun mot pour le moment">
          <p>Note ici les mots que tu croises en lisant, avec la phrase où tu les as rencontrés.</p>
        </Empty>
      ) : (
        <>
          <div className="dictionary-toolbar">
            <input className="input" placeholder="Chercher un mot…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Chercher un mot" />
            {withWords.length > 0 && (
              <select className="select" value={bookId} onChange={(e) => setBookId(e.target.value)} aria-label="Filtrer par livre">
                <option value="">Tous les livres</option>
                {withWords.map((b) => <option key={b.id} value={b.id}>{b.title}</option>)}
              </select>
            )}
          </div>
          <nav className="letters" aria-label="Aller à une lettre">
            {groups.map(([l]) => <a key={l} href={`#lettre-${l}`} className="letter-link">{l}</a>)}
          </nav>
          {!groups.length && <p className="section-empty">Aucun mot ne correspond.</p>}
          {groups.map(([l, list]) => (
            <section key={l} className="letter" id={`lettre-${l}`}>
              <h2 className="letter-title">{l}</h2>
              <div className="words">
                {list.map((w) => <WordCard key={w.id} word={w} onEdit={() => setEditing(w)} />)}
              </div>
            </section>
          ))}
        </>
      )}
      {editing && (
        <Modal title={editing === 'new' ? 'Nouveau mot' : 'Modifier le mot'} onClose={() => setEditing(null)}>
          <WordForm word={editing === 'new' ? undefined : editing} books={books ?? []} onDone={() => setEditing(null)} onCancel={() => setEditing(null)} />
        </Modal>
      )}
    </div>
  );
}
