import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { NOTE_LABEL, type Book, type BookKind, type Home } from '../api';
import { useDesign, type ShelfGroup } from '../designs';
import { Empty, Loading } from '../ui';

type Filter = 'tous' | BookKind;
type Sort = 'date' | 'auteur' | 'titre';

export default function Library({ home, onAdd }: { home: Home | null; onAdd: () => void }) {
  const { Shelf } = useDesign();
  const [filter, setFilter] = useState<Filter>('tous');
  const [sort, setSort] = useState<Sort>('date');
  const [year, setYear] = useState('');
  const [minRating, setMinRating] = useState(0);
  const [q, setQ] = useState('');

  const years = useMemo(
    () => [...new Set((home?.books ?? []).filter((b) => b.status === 'lu' && b.finishedAt).map((b) => b.finishedAt!.slice(0, 4)))].sort().reverse(),
    [home],
  );

  const groups = useMemo(() => {
    const text = q.trim().toLowerCase();
    // « Tous » : les textes courts quittent les étagères de livres pour leur propre étagère, plus bas.
    const matches = (home?.books ?? []).filter((b) =>
      (filter === 'tous' || b.kind === filter)
      && (!minRating || b.rating >= minRating)
      && (!text || `${b.title} ${b.subtitle} ${b.author} ${b.publication}`.toLowerCase().includes(text)));
    const books = filter === 'tous' ? matches.filter((b) => b.kind !== 'texte') : matches;
    const by = (s: Book['status']) => books.filter((b) => b.status === s);
    const sorted = (list: Book[]) => sort === 'date' ? list
      : [...list].sort((a, b) => (sort === 'auteur' ? lastName(a.author).localeCompare(lastName(b.author), 'fr') : 0) || a.title.localeCompare(b.title, 'fr'));
    const textList = filter === 'tous' ? matches.filter((b) => b.kind === 'texte' && (!year || (b.finishedAt ?? '').startsWith(year))) : [];
    const textGroups: ShelfGroup[] = ([['en_cours', 'En cours'], ['lu', 'Lus'], ['a_lire', 'À lire'], ['abandonne', 'Abandonnés']] as const)
      .map(([s, label]) => ({ label, books: sorted(textList.filter((b) => b.status === s)) }))
      .filter((g) => g.books.length);
    const read = sorted(by('lu').filter((b) => !year || (b.finishedAt ?? '').startsWith(year)));
    // Tous les livres lus sur une seule étagère ; triés par date, un séparateur ouvre chaque année.
    const readGroups: ShelfGroup[] = [];
    if (sort === 'date') {
      for (const b of read) {
        const label = b.finishedAt?.slice(0, 4) ?? 'Sans date';
        const g = readGroups.find((x) => x.label === label);
        if (g) g.books.push(b); else readGroups.push({ label, books: [b] });
      }
    }
    // Un filtre par année ne concerne que les livres lus : les autres étagères se retirent.
    const others = !year;
    return {
      read, readGroups,
      texts: textGroups.flatMap((g) => g.books), textGroups,
      reading: others ? sorted(by('en_cours')) : [],
      toRead: others ? sorted(by('a_lire')) : [],
      dropped: others ? sorted(by('abandonne')) : [],
    };
  }, [home, filter, sort, year, minRating, q]);

  const filtered = filter !== 'tous' || !!year || minRating > 0 || !!q.trim();
  const reset = () => { setFilter('tous'); setYear(''); setMinRating(0); setQ(''); };
  const nothing = !groups.read.length && !groups.reading.length && !groups.toRead.length && !groups.dropped.length && !groups.texts.length;

  if (!home) return <Loading />;
  const { stats, daily } = home;
  const goalPct = stats.goal ? Math.min(100, Math.round((stats.thisYear.books / stats.goal) * 100)) : 0;

  if (!home.books.length) {
    return (
      <Empty title="Ta bibliothèque est vide">
        <p>Ajoute ton premier livre, ou demande à Claude de le faire pour toi.</p>
        <button type="button" className="btn btn-primary" onClick={onAdd}>Ajouter un livre</button>
      </Empty>
    );
  }

  return (
    <div className="library">
      <section className="library-top" aria-label="Aujourd’hui">
        {daily && (
          <Link to={`/livre/${daily.bookId}#note-${daily.id}`} className={`daily daily-${daily.type}`}>
            <span className="daily-eyebrow">Remontée du jour · {NOTE_LABEL[daily.type]}</span>
            <span className="daily-text">{daily.type === 'citation' ? `« ${daily.text} »` : daily.text}</span>
            {daily.type === 'idee' && daily.comment && <span className="daily-comment">{daily.comment}</span>}
            <span className="daily-source">{[daily.bookAuthor, daily.bookTitle].filter(Boolean).join(', ')}</span>
          </Link>
        )}
        <div className="library-side">
          <Link to="/stats" className="goal">
            <span className="goal-eyebrow">{stats.year}</span>
            <span className="goal-figure">
              <strong className="goal-count">{stats.thisYear.books}</strong>
              {stats.goal > 0 && <span className="goal-total"> / {stats.goal}</span>}
              <span className="goal-unit"> {stats.thisYear.books > 1 ? 'livres lus' : 'livre lu'}</span>
            </span>
            {stats.goal > 0 && (
              <span className="progress" role="progressbar" aria-valuenow={goalPct} aria-valuemin={0} aria-valuemax={100} aria-label="Objectif de l’année">
                <span className="progress-fill" style={{ width: `${goalPct}%` }} />
              </span>
            )}
          </Link>
          <Link to="/reviser" className={`due${home.dueCount ? ' due-active' : ''}`}>
            <strong className="due-count">{home.dueCount}</strong>
            <span className="due-label">{home.dueCount > 1 ? 'cartes à réviser' : 'carte à réviser'}</span>
          </Link>
        </div>
      </section>

      <div className="library-toolbar">
        <div className="chips" role="group" aria-label="Filtrer par genre">
          {(['tous', 'essai', 'roman', 'texte', 'autre'] as Filter[]).map((f) => (
            <button key={f} type="button" className={`chip${filter === f ? ' chip-on' : ''}`} aria-pressed={filter === f} onClick={() => setFilter(f)}>
              {f === 'tous' ? 'Tous' : f === 'essai' ? 'Essais' : f === 'roman' ? 'Romans' : f === 'texte' ? 'Textes courts' : 'Autres'}
            </button>
          ))}
        </div>
        <div className="library-filters">
          <input
            className="input library-search" type="search" placeholder="Titre ou auteur…" aria-label="Filtrer par titre ou auteur"
            value={q} onChange={(e) => setQ(e.target.value)}
          />
          <label className="sort">
            <span className="sort-label">Année</span>
            <select className="select" value={year} onChange={(e) => setYear(e.target.value)}>
              <option value="">toutes</option>
              {years.map((y) => <option key={y} value={y}>{y}</option>)}
            </select>
          </label>
          <label className="sort">
            <span className="sort-label">Note</span>
            <select className="select" value={minRating} onChange={(e) => setMinRating(Number(e.target.value))}>
              <option value={0}>toutes</option>
              <option value={5}>★★★★★</option>
              <option value={4}>★★★★ et plus</option>
              <option value={3}>★★★ et plus</option>
            </select>
          </label>
          <label className="sort">
            <span className="sort-label">Ranger par</span>
            <select className="select" value={sort} onChange={(e) => setSort(e.target.value as Sort)}>
              <option value="date">date de lecture</option>
              <option value="auteur">auteur</option>
              <option value="titre">titre</option>
            </select>
          </label>
          {filtered && <button type="button" className="btn btn-ghost btn-small library-reset" onClick={reset}>Réinitialiser</button>}
        </div>
      </div>

      <div className="bookcase">
        {groups.reading.length > 0 && (
          <Shelf title="Table de chevet" hint={count(groups.reading.length, 'lecture en cours', 'lectures en cours')} variant="en_cours" books={groups.reading} />
        )}
        {groups.read.length > 0 && (
          <Shelf
            title={year ? `Lus en ${year}` : 'Lus'} hint={count(groups.read.length, 'livre', 'livres')} variant="lu"
            books={groups.read} groups={groups.readGroups.length ? groups.readGroups : undefined}
          />
        )}
        {nothing && <p className="library-none">Aucun livre ne correspond à ces filtres.</p>}
        {(!filtered || groups.toRead.length > 0) && (
          <Shelf
            title="Pile à lire" hint={count(groups.toRead.length, 'livre', 'livres')} variant="a_lire" books={groups.toRead}
            empty="Aucune envie de lecture pour le moment."
          />
        )}
        {groups.dropped.length > 0 && (
          <Shelf title="Abandonnés" hint={count(groups.dropped.length, 'livre', 'livres')} variant="abandonne" books={groups.dropped} />
        )}
        {groups.texts.length > 0 && (
          <Shelf
            title="Textes courts" hint={count(groups.texts.length, 'texte', 'textes')} variant="lu"
            books={groups.texts} groups={groups.textGroups}
          />
        )}
      </div>
    </div>
  );
}

const count = (n: number, one: string, many: string) => `${n} ${n > 1 ? many : one}`;
const lastName = (author: string) => author.split(',')[0].trim().split(' ').pop() ?? '';
