import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { Link, NavLink, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { api, useData, NOTE_LABEL, type Home, type SearchResult } from './api';
import { ErrorLine, Loading, Modal } from './ui';
import Library from './pages/Library';
import BookPage from './pages/Book';
import AddBook from './pages/AddBook';
import Dictionary from './pages/Dictionary';
import Review from './pages/Review';
import Themes from './pages/Themes';
import Todo from './pages/Todo';
import StatsPage from './pages/Stats';
import Capture from './pages/Capture';
import Settings from './pages/Settings';

interface Me { authRequired: boolean; authed: boolean; mcpTokenSet: boolean }

export default function App() {
  const [me, setMe] = useState<Me | null>(null);
  const loadMe = useCallback(() => { api<Me>('/me').then(setMe).catch(() => setMe({ authRequired: true, authed: false, mcpTokenSet: false })); }, []);
  useEffect(() => {
    loadMe();
    window.addEventListener('biblio:logout', loadMe);
    return () => window.removeEventListener('biblio:logout', loadMe);
  }, [loadMe]);

  if (!me) return <div className="app-loading"><Loading /></div>;
  if (!me.authed) return <Login onDone={loadMe} />;
  return <Shell me={me} onLogout={loadMe} />;
}

function Login({ onDone }: { onDone: () => void }) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    try { await api('/login', { body: { password } }); onDone(); } catch (err: any) { setError(err.message); }
  };
  return (
    <main className="login">
      <form className="login-card" onSubmit={submit}>
        <h1 className="brand">Bibliothèque</h1>
        <p className="login-sub">Mes livres, mes notes, mes mots.</p>
        <label className="field">
          <span className="field-label">Mot de passe</span>
          <input type="password" className="input" autoFocus autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
        </label>
        <ErrorLine error={error} />
        <button className="btn btn-primary" type="submit">Entrer</button>
      </form>
    </main>
  );
}

function Shell({ me, onLogout }: { me: Me; onLogout: () => void }) {
  const { data: home } = useData<Home>('/home');
  const [adding, setAdding] = useState(false);
  const [searching, setSearching] = useState(false);
  const location = useLocation();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); setSearching(true); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
  useEffect(() => { window.scrollTo(0, 0); }, [location.pathname]);

  const due = home?.dueCount ?? 0;
  const todo = home?.incompleteCount ?? 0;
  return (
    <div className="app">
      <header className="topbar">
        <Link to="/" className="brand" aria-label="Bibliothèque, accueil">Bibliothèque</Link>
        <nav className="nav" aria-label="Navigation principale">
          <NavLink to="/" end className="nav-link"><span className="nav-label">Étagères</span></NavLink>
          <NavLink to="/dictionnaire" className="nav-link"><span className="nav-label">Dictionnaire</span></NavLink>
          <NavLink to="/reviser" className="nav-link">
            <span className="nav-label">Réviser</span>{due > 0 && <span className="badge" aria-label={`${due} à réviser`}>{due}</span>}
          </NavLink>
          <NavLink to="/themes" className="nav-link"><span className="nav-label">Thèmes</span></NavLink>
          <NavLink to="/a-completer" className="nav-link">
            <span className="nav-label">À compléter</span>{todo > 0 && <span className="badge badge-quiet" aria-label={`${todo} à compléter`}>{todo}</span>}
          </NavLink>
          <NavLink to="/stats" className="nav-link"><span className="nav-label">Statistiques</span></NavLink>
        </nav>
        <div className="topbar-actions">
          <button type="button" className="btn btn-ghost search-trigger" onClick={() => setSearching(true)}>
            <span className="search-trigger-label">Rechercher</span><kbd className="kbd">Ctrl K</kbd>
          </button>
          <Link to="/noter" className="btn btn-ghost capture-link">Noter</Link>
          <button type="button" className="btn btn-primary add-book" onClick={() => setAdding(true)}>
            <span aria-hidden="true">+</span> Livre
          </button>
          <NavLink to="/reglages" className="btn btn-ghost settings-link" aria-label="Réglages">Réglages</NavLink>
        </div>
      </header>

      <main className="main">
        <Routes>
          <Route path="/" element={<Library home={home} onAdd={() => setAdding(true)} />} />
          <Route path="/livre/:id" element={<BookPage />} />
          <Route path="/dictionnaire" element={<Dictionary />} />
          <Route path="/reviser" element={<Review />} />
          <Route path="/themes" element={<Themes />} />
          <Route path="/themes/:id" element={<Themes />} />
          <Route path="/a-completer" element={<Todo />} />
          <Route path="/stats" element={<StatsPage />} />
          <Route path="/noter" element={<Capture />} />
          <Route path="/reglages" element={<Settings me={me} onLogout={onLogout} />} />
          <Route path="*" element={<p className="empty-title">Page introuvable. <Link to="/">Retour aux étagères</Link></p>} />
        </Routes>
      </main>

      {/* Barre du bas sur téléphone : les designs choisissent de l'afficher ou non. */}
      <nav className="tabbar" aria-label="Navigation mobile">
        <NavLink to="/" end className="tab">Étagères</NavLink>
        <NavLink to="/dictionnaire" className="tab">Mots</NavLink>
        <NavLink to="/noter" className="tab tab-capture">Noter</NavLink>
        <NavLink to="/reviser" className="tab">Réviser{due > 0 && <span className="badge">{due}</span>}</NavLink>
        <NavLink to="/reglages" className="tab">Plus</NavLink>
      </nav>

      {adding && <AddBook onClose={() => setAdding(false)} />}
      {searching && <SearchPalette onClose={() => setSearching(false)} />}
    </div>
  );
}

function SearchPalette({ onClose }: { onClose: () => void }) {
  const [q, setQ] = useState('');
  const [res, setRes] = useState<SearchResult | null>(null);
  const navigate = useNavigate();
  const seq = useRef(0);
  useEffect(() => {
    if (q.trim().length < 2) { setRes(null); return; }
    const mine = ++seq.current;
    const t = setTimeout(() => {
      api<SearchResult>(`/search?q=${encodeURIComponent(q)}`).then((r) => { if (seq.current === mine) setRes(r); }).catch(() => {});
    }, 180);
    return () => clearTimeout(t);
  }, [q]);
  const go = (to: string) => { onClose(); navigate(to); };
  const none = res && !res.books.length && !res.notes.length && !res.words.length && !res.themes.length;
  return (
    <Modal title="Rechercher" onClose={onClose} wide>
      <div className="search">
        <input
          className="input search-input" autoFocus placeholder="Un livre, une idée, une citation, un mot…"
          value={q} onChange={(e) => setQ(e.target.value)} aria-label="Recherche"
        />
        <div className="search-results">
          {none && <p className="search-none">Aucun résultat pour « {q} ».</p>}
          {!!res?.books.length && <h3 className="search-group">Livres</h3>}
          {res?.books.map((b) => (
            <button key={`b${b.id}`} type="button" className="search-item" onClick={() => go(`/livre/${b.id}`)}>
              <span className="search-item-main">{b.title}</span><span className="search-item-sub">{b.author}</span>
            </button>
          ))}
          {!!res?.words.length && <h3 className="search-group">Dictionnaire</h3>}
          {res?.words.map((w) => (
            <button key={`w${w.id}`} type="button" className="search-item" onClick={() => go(`/dictionnaire?mot=${w.id}`)}>
              <span className="search-item-main">{w.word}</span><span className="search-item-sub">{w.definition}</span>
            </button>
          ))}
          {!!res?.themes.length && <h3 className="search-group">Thèmes</h3>}
          {res?.themes.map((t) => (
            <button key={`t${t.id}`} type="button" className="search-item" onClick={() => go(`/themes/${t.id}`)}>
              <span className="search-item-main">{t.name}</span>
            </button>
          ))}
          {!!res?.notes.length && <h3 className="search-group">Notes</h3>}
          {res?.notes.map((n) => (
            <button key={`n${n.id}`} type="button" className="search-item" onClick={() => go(`/livre/${n.bookId}#note-${n.id}`)}>
              <span className="search-item-main">{n.text}</span>
              <span className="search-item-sub">{NOTE_LABEL[n.type]} · {n.bookTitle}</span>
            </button>
          ))}
        </div>
      </div>
    </Modal>
  );
}
