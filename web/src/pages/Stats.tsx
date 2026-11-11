import { useData, type Stats } from '../api';
import { Loading, PageHead } from '../ui';

const fmt = (n: number) => n.toLocaleString('fr-FR');

export default function StatsPage() {
  const { data: s } = useData<Stats>('/stats');
  if (!s) return <Loading />;
  const t = s.totals;
  const max = Math.max(1, ...s.byYear.map((y) => y.books));
  const pct = s.goal ? Math.min(100, Math.round((s.thisYear.books / s.goal) * 100)) : 0;
  const tiles: [string, number][] = [
    ['Livres lus', t.read], ['Pages lues', t.pagesRead], ['En cours', t.reading], ['À lire', t.toRead],
    ['Idées clés', t.ideas], ['Citations', t.quotes], ['Mots appris', t.words], ['Mots maîtrisés', t.wordsMastered],
  ];
  return (
    <div className="stats">
      <PageHead title="Statistiques" />
      <section className="stats-goal">
        <h2 className="section-title">Objectif {s.year}</h2>
        <p className="goal-figure">
          <strong className="goal-count">{s.thisYear.books}</strong>
          {s.goal > 0 && <span className="goal-total"> / {s.goal}</span>}
          <span className="goal-unit"> {s.thisYear.books > 1 ? 'livres lus' : 'livre lu'}, {fmt(s.thisYear.pages)} pages</span>
        </p>
        {s.goal > 0 ? (
          <span className="progress progress-large" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label="Objectif de l’année">
            <span className="progress-fill" style={{ width: `${pct}%` }} />
          </span>
        ) : <p className="section-empty">Fixe un objectif annuel dans les réglages.</p>}
      </section>

      <section className="stats-tiles" aria-label="Totaux">
        {tiles.map(([label, value]) => (
          <div key={label} className="tile">
            <span className="tile-value">{fmt(value)}</span>
            <span className="tile-label">{label}</span>
          </div>
        ))}
      </section>

      {s.byYear.length > 0 && (
        <section className="stats-years">
          <h2 className="section-title">Par année</h2>
          <ul className="year-bars">
            {s.byYear.map((y) => (
              <li key={y.year} className="year-bar">
                <span className="year-label">{y.year}</span>
                <span className="year-track"><span className="year-fill" style={{ width: `${(y.books / max) * 100}%` }} /></span>
                <span className="year-value">{y.books} {y.books > 1 ? 'livres' : 'livre'} · {fmt(y.pages)} p.</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
