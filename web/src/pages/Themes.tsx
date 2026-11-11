import { useMemo, useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api, useData, type Note, type Theme, type ThemeFull } from '../api';
import { NoteItem } from '../parts';
import { AutoText, Empty, ErrorLine, Loading, PageHead } from '../ui';

export default function Themes() {
  const params = useParams();
  const id = params.id ? Number(params.id) : null;
  const { data: themes } = useData<Theme[]>('/themes');
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  const create = async (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    try {
      const t = await api<{ id: number }>('/themes', { body: { name } });
      setName(''); setError(null);
      navigate(`/themes/${t.id}`);
    } catch (err: any) { setError(err.message); }
  };

  if (!themes) return <Loading />;
  return (
    <div className="themes">
      <PageHead title="Thèmes" sub="Les idées qui se répondent d’un livre à l’autre." />
      <div className="themes-layout">
        <aside className="themes-list">
          <ul className="theme-links">
            {themes.map((t) => (
              <li key={t.id}>
                <Link to={`/themes/${t.id}`} className={`theme-link${t.id === id ? ' is-active' : ''}`} aria-current={t.id === id ? 'page' : undefined}>
                  <span className="theme-name">{t.name}</span>
                  <span className="theme-count">{t.noteCount} {t.noteCount > 1 ? 'notes' : 'note'} · {t.bookCount} {t.bookCount > 1 ? 'livres' : 'livre'}</span>
                </Link>
              </li>
            ))}
          </ul>
          <form className="theme-new" onSubmit={create}>
            <input className="input" placeholder="Nouveau thème" value={name} onChange={(e) => setName(e.target.value)} aria-label="Nom du nouveau thème" />
            <button type="submit" className="btn btn-ghost">Créer</button>
          </form>
          <ErrorLine error={error} />
        </aside>
        <div className="themes-detail">
          {id ? <ThemeDetail id={id} themeNames={themes.map((t) => t.name)} /> : (
            <Empty title={themes.length ? 'Choisis un thème' : 'Aucun thème pour le moment'}>
              <p>Ajoute un thème à une idée ou une citation depuis la fiche d’un livre : toutes les notes qui le partagent se retrouvent ici, livre par livre.</p>
            </Empty>
          )}
        </div>
      </div>
    </div>
  );
}

function ThemeDetail({ id, themeNames }: { id: number; themeNames: string[] }) {
  const { data: theme, error } = useData<ThemeFull>(`/themes/${id}`);
  const navigate = useNavigate();
  const byBook = useMemo(() => {
    const map = new Map<number, Note[]>();
    for (const n of theme?.notes ?? []) {
      if (!map.has(n.bookId)) map.set(n.bookId, []);
      map.get(n.bookId)!.push(n);
    }
    return [...map.values()];
  }, [theme]);

  if (error) return <p className="error">{error}</p>;
  if (!theme) return <Loading />;
  const remove = async () => {
    if (!window.confirm(`Supprimer le thème « ${theme.name} » ? Les notes restent dans leurs livres.`)) return;
    await api(`/themes/${id}`, { method: 'DELETE' });
    navigate('/themes');
  };
  return (
    <article className="theme">
      <header className="theme-head">
        <h2 className="theme-title">{theme.name}</h2>
        <button type="button" className="btn btn-ghost btn-small btn-danger" onClick={remove}>Supprimer le thème</button>
      </header>
      <AutoText
        label="Description du thème" value={theme.description} placeholder="Ce que ce thème recouvre, la question qu’il pose…"
        onSave={(description) => api(`/themes/${id}`, { method: 'PATCH', body: { description } })}
      />
      {!byBook.length && <p className="section-empty">Aucune note rattachée à ce thème pour le moment.</p>}
      {byBook.map((notes) => (
        <section key={notes[0].bookId} className="theme-book">
          <h3 className="theme-book-title">
            <Link to={`/livre/${notes[0].bookId}`}>{notes[0].bookTitle}</Link>
            {notes[0].bookAuthor && <span className="theme-book-author"> {notes[0].bookAuthor}</span>}
          </h3>
          <ul className="notes">{notes.map((n) => <NoteItem key={n.id} note={n} themeNames={themeNames} />)}</ul>
        </section>
      ))}
    </article>
  );
}
