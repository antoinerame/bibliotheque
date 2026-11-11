import { Link } from 'react-router-dom';
import { useData, type Incomplete } from '../api';
import { Empty, Loading, PageHead } from '../ui';

const GROUPS: { kind: Incomplete['kind']; title: string }[] = [
  { kind: 'livre', title: 'Livres lus à compléter' },
  { kind: 'note', title: 'Notes à reprendre' },
  { kind: 'mot', title: 'Mots à compléter' },
];

export default function Todo() {
  const { data } = useData<Incomplete[]>('/incomplete');
  if (!data) return <Loading />;
  const link = (i: Incomplete) =>
    i.kind === 'livre' ? `/livre/${i.id}` : i.kind === 'note' ? `/livre/${i.bookId}#note-${i.id}` : `/dictionnaire?mot=${i.id}`;
  return (
    <div className="todo">
      <PageHead title="À compléter" sub="Ce qui manque pour que tes fiches te servent vraiment. Claude peut t’aider à les remplir." />
      {!data.length && <Empty title="Tout est complet"><p>Rien à compléter pour le moment.</p></Empty>}
      {GROUPS.map((g) => {
        const items = data.filter((i) => i.kind === g.kind);
        if (!items.length) return null;
        return (
          <section key={g.kind} className={`todo-group todo-group-${g.kind}`}>
            <h2 className="section-title">{g.title} <span className="section-count">{items.length}</span></h2>
            <ul className="todo-list">
              {items.map((i) => (
                <li key={`${i.kind}-${i.id}`}>
                  <Link to={link(i)} className="todo-item">
                    <span className="todo-label">{i.label}</span>
                    <span className="todo-missing">
                      {i.missing.map((m) => <span key={m} className="tag tag-warn">{m}</span>)}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
