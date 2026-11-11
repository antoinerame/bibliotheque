import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, type Card, type CardKind } from '../api';
import { Empty, Loading, PageHead } from '../ui';

type Filter = '' | CardKind;
const FILTERS: [Filter, string][] = [['', 'Tout'], ['mot', 'Mots'], ['idee', 'Idées'], ['citation', 'Citations']];
const PROMPT: Record<CardKind, string> = {
  mot: 'Que veut dire ce mot ?',
  idee: 'Explique cette idée avec tes mots.',
  citation: 'D’où vient cette citation, et qu’en retiens-tu ?',
};

export default function Review() {
  const [filter, setFilter] = useState<Filter>('');
  const [cards, setCards] = useState<Card[] | null>(null);
  const [index, setIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [score, setScore] = useState([0, 0, 0]);
  const [extra, setExtra] = useState(false);

  const load = useCallback(async (kind: Filter, all: boolean) => {
    setCards(null); setIndex(0); setRevealed(false); setScore([0, 0, 0]);
    setCards(await api<Card[]>(`/review?limit=20${kind ? `&kind=${kind}` : ''}${all ? '&all=1' : ''}`));
  }, []);
  useEffect(() => { load(filter, extra); }, [load, filter, extra]);

  const card = cards?.[index];
  const grade = async (g: number) => {
    if (!card) return;
    await api('/review', { body: { kind: card.kind, id: card.id, grade: g } });
    setScore((s) => s.map((v, i) => (i === g ? v + 1 : v)));
    setRevealed(false);
    setIndex((i) => i + 1);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).closest('input, textarea, select')) return;
      if (!revealed && (e.key === ' ' || e.key === 'Enter')) { e.preventDefault(); setRevealed(true); }
      else if (revealed && ['1', '2', '3'].includes(e.key)) grade(Number(e.key) - 1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const done = cards && index >= cards.length;
  return (
    <div className="review">
      <PageHead title="Réviser" sub="Les mots, idées et citations reviennent à intervalles croissants. Ce que tu rates revient plus vite." />
      <div className="chips" role="group" aria-label="Type de cartes">
        {FILTERS.map(([k, l]) => (
          <button key={k} type="button" className={`chip${filter === k ? ' chip-on' : ''}`} aria-pressed={filter === k} onClick={() => setFilter(k)}>{l}</button>
        ))}
      </div>

      {!cards && <Loading />}
      {cards && !cards.length && (
        <Empty title="Rien à réviser pour le moment">
          <p>Tout est à jour. Tu peux quand même t’entraîner sur des cartes déjà vues.</p>
          {!extra && <button type="button" className="btn btn-primary" onClick={() => setExtra(true)}>S’entraîner quand même</button>}
        </Empty>
      )}
      {done && cards.length > 0 && (
        <div className="review-done">
          <p className="review-done-title">Séance terminée</p>
          <p className="review-score">
            <span className="score score-good">{score[2]} su{score[2] > 1 ? 's' : ''}</span>
            <span className="score score-mid">{score[1]} hésitant{score[1] > 1 ? 's' : ''}</span>
            <span className="score score-bad">{score[0]} raté{score[0] > 1 ? 's' : ''}</span>
          </p>
          <div className="form-actions">
            <button type="button" className="btn btn-primary" onClick={() => load(filter, extra)}>Continuer</button>
            <Link to="/" className="btn btn-ghost">Retour aux étagères</Link>
          </div>
        </div>
      )}
      {card && (
        <div className="review-stage">
          <p className="review-count">{index + 1} / {cards!.length}</p>
          <div className={`flashcard flashcard-${card.kind}${revealed ? ' is-revealed' : ''}`}>
            <p className="flashcard-prompt">{PROMPT[card.kind]}</p>
            <p className="flashcard-front">{card.kind === 'citation' ? `« ${card.front} »` : card.front}</p>
            {card.kind === 'idee' && <p className="flashcard-context">{card.bookTitle}</p>}
            {revealed && (
              <div className="flashcard-answer">
                <p className="flashcard-back">{card.back}</p>
                {card.extra && <p className="flashcard-extra">{card.extra}</p>}
                {card.kind === 'mot' && card.bookTitle && <p className="flashcard-context">Vu dans {card.bookTitle}</p>}
              </div>
            )}
          </div>
          {!revealed ? (
            <button type="button" className="btn btn-primary review-reveal" onClick={() => setRevealed(true)}>Voir la réponse</button>
          ) : (
            <div className="review-grades">
              <button type="button" className="btn grade grade-bad" onClick={() => grade(0)}>Raté <kbd className="kbd">1</kbd></button>
              <button type="button" className="btn grade grade-mid" onClick={() => grade(1)}>Hésitant <kbd className="kbd">2</kbd></button>
              <button type="button" className="btn grade grade-good" onClick={() => grade(2)}>Su <kbd className="kbd">3</kbd></button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
