import '@fontsource-variable/geist/index.css';
import '@fontsource-variable/geist-mono/index.css';
import { useState, type CSSProperties } from 'react';
import { Link } from 'react-router-dom';
import type { Book } from '../../api';
import type { BookCoverProps, ShelfProps } from '../index';

/* Design « Épure » : des volumes nets posés sur des tablettes au trait fin.
   Les teintes sont des neutres travaillés, à peine colorés : clarté, chroma, teinte (OKLCH). */
const TONES: [number, number, number][] = [
  [0.27, 0.012, 255], // graphite
  [0.36, 0.045, 255], // encre
  [0.50, 0.030, 245], // ardoise
  [0.72, 0.015, 240], // brume
  [0.90, 0.012, 90],  // os
  [0.80, 0.030, 80],  // sable
  [0.53, 0.055, 45],  // argile
  [0.40, 0.040, 50],  // terre d'ombre
  [0.64, 0.035, 150], // sauge
  [0.38, 0.040, 165], // pin
  [0.95, 0.004, 100], // craie
  [0.63, 0.020, 260], // acier
];
const INK_DARK = 'oklch(0.2 0.01 255)';
const INK_LIGHT = 'oklch(0.97 0.003 255)';

function hash(s: string) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}

/** Teinte du volume et couleur de son lettrage. Une couleur choisie par l'utilisateur prime, adoucie vers le gris. */
function tone(book: Book): { bg: string; ink: string } {
  const m = /^#?([0-9a-f]{6})$/i.exec(book.color ?? '');
  if (m) {
    const n = parseInt(m[1], 16);
    const rgb = [n >> 16, (n >> 8) & 255, n & 255].map((c) => Math.round(c * 0.72 + 124 * 0.28));
    const lin = rgb.map((c) => { const v = c / 255; return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; });
    const lum = 0.2126 * lin[0] + 0.7152 * lin[1] + 0.0722 * lin[2];
    return { bg: `rgb(${rgb.join(' ')})`, ink: lum > 0.26 ? INK_DARK : INK_LIGHT };
  }
  const [l, c, h] = TONES[hash(book.title + book.author) % TONES.length];
  return { bg: `oklch(${l} ${c} ${h})`, ink: l >= 0.62 ? INK_DARK : INK_LIGHT };
}
function toneStyle(book: Book, extra?: Record<string, string | number>): CSSProperties {
  const t = tone(book);
  return { '--tone': t.bg, '--ink': t.ink, ...extra } as CSSProperties;
}

/** Épaisseur du dos en pixels, selon le nombre de pages. */
function spineWidth(book: Book) {
  return Math.round(20 + Math.min(book.pages ?? 260, 1200) / 19);
}
/** Hauteur du dos : varie un peu d'un livre à l'autre, de façon stable. */
function spineHeight(book: Book) {
  return 146 + (hash(book.title) % 6) * 9;
}
const catalog = (book: Book) => String(book.id).padStart(3, '0');
const fullLabel = (b: Book) =>
  [b.title, b.author, b.rating > 0 ? `noté ${b.rating} sur 5` : ''].filter(Boolean).join(', ');

function Spine({ book, onActive }: { book: Book; onActive: (b: Book | null) => void }) {
  const w = spineWidth(book);
  const size = w >= 58 ? ' spine-wide' : w >= 40 ? ' spine-mid' : ' spine-thin';
  return (
    <Link
      to={`/livre/${book.id}`}
      className={`spine${size}`}
      aria-label={fullLabel(book)}
      style={toneStyle(book, { '--w': `${w}px`, '--h': `${spineHeight(book)}px` })}
      onMouseEnter={() => onActive(book)} onMouseLeave={() => onActive(null)}
      onFocus={() => onActive(book)} onBlur={() => onActive(null)}
    >
      <span className="spine-text">
        <span className="spine-title">{book.title}</span>
        {book.author && <span className="spine-author">{book.author}</span>}
      </span>
      <span className="spine-no" aria-hidden="true">{catalog(book)}</span>
    </Link>
  );
}

/** Table de chevet : les lectures en cours, couverture de face et avancement. */
function Bedside({ books }: { books: Book[] }) {
  return (
    <div className="bedside">
      {books.map((b) => {
        const pct = b.pages ? Math.min(100, Math.round((b.currentPage / b.pages) * 100)) : 0;
        return (
          <Link key={b.id} to={`/livre/${b.id}`} className="bedside-item" aria-label={fullLabel(b)}>
            <BookCover book={b} size="md" />
            <span className="bedside-body">
              <span className="bedside-eyebrow">En cours · N° {catalog(b)}</span>
              <span className="bedside-title">{b.title}</span>
              {b.author && <span className="bedside-author">{b.author}</span>}
              <span className="bedside-progress">
                <span className="progress" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label="Avancement">
                  <span className="progress-fill" style={{ width: `${pct}%` }} />
                </span>
                <span className="bedside-figures">
                  <span className="bedside-pages">p. {b.currentPage}{b.pages ? ` / ${b.pages}` : ''}</span>
                  {b.pages ? <span className="bedside-pct">{pct} %</span> : null}
                </span>
              </span>
            </span>
          </Link>
        );
      })}
    </div>
  );
}

/** Pile à lire : les volumes couchés, empilés par petites piles. */
const PILE_SIZE = 6;
function Piles({ books, onActive }: { books: Book[]; onActive: (b: Book | null) => void }) {
  const piles: Book[][] = [];
  for (let i = 0; i < books.length; i += PILE_SIZE) piles.push(books.slice(i, i + PILE_SIZE));
  return (
    <div className="piles">
      {piles.map((pile, i) => (
        <div key={i} className="pile">
          {pile.map((b) => {
            const h = hash(b.title);
            const thick = Math.round(24 + Math.min(b.pages ?? 260, 1200) / 46);
            return (
              <Link
                key={b.id} to={`/livre/${b.id}`} className="slab" aria-label={fullLabel(b)}
                style={toneStyle(b, { '--t': `${thick}px`, '--len': `${78 + (h % 5) * 5}%`, '--shift': `${(h >> 3) % 4 * 5}px` })}
                onMouseEnter={() => onActive(b)} onMouseLeave={() => onActive(null)}
                onFocus={() => onActive(b)} onBlur={() => onActive(null)}
              >
                <span className="slab-title">{b.title}</span>
                <span className="slab-no" aria-hidden="true">{catalog(b)}</span>
              </Link>
            );
          })}
        </div>
      ))}
    </div>
  );
}

export function Shelf({ title, hint, variant, books, groups, empty }: ShelfProps) {
  const [active, setActive] = useState<Book | null>(null);
  return (
    <section className={`shelf shelf-${variant}${books.length ? '' : ' shelf-is-empty'}`}>
      <header className="shelf-head">
        <h2 className="shelf-title">{title}</h2>
        {/* Cartel : le volume survolé ou atteint au clavier, en clair. */}
        <p className={`shelf-readout${active ? ' is-on' : ''}`} aria-hidden="true">
          {active && (
            <>
              <span className="readout-title">{active.title}</span>
              {active.author && <span className="readout-author">{active.author}</span>}
              {active.rating > 0 && <span className="readout-rating">{'★'.repeat(active.rating)}<i>{'★'.repeat(5 - active.rating)}</i></span>}
              {active.pages ? <span className="readout-pages">{active.pages} p.</span> : null}
            </>
          )}
        </p>
        {hint && <span className="shelf-hint">{hint}</span>}
      </header>
      {!books.length ? (
        <p className="shelf-empty">{empty ?? 'Rien ici pour le moment.'}</p>
      ) : variant === 'en_cours' ? (
        <Bedside books={books} />
      ) : variant === 'a_lire' ? (
        <Piles books={books} onActive={setActive} />
      ) : (
        <div className="shelf-row">
          {groups?.length
            ? groups.map((g) => g.books.map((b, i) => i === 0 ? (
              // Le séparateur reste attaché au premier livre de son groupe : jamais seul en bout de rangée.
              <span key={b.id} className="shelf-group-start">
                <span className="shelf-sep" aria-hidden="true"><span className="shelf-sep-label">{g.label}</span></span>
                <Spine book={b} onActive={setActive} />
              </span>
            ) : <Spine key={b.id} book={b} onActive={setActive} />))
            : books.map((b) => <Spine key={b.id} book={b} onActive={setActive} />)}
        </div>
      )}
    </section>
  );
}

export function BookCover({ book, size = 'md' }: BookCoverProps) {
  return book.coverUrl ? (
    <img className={`cover cover-${size}`} src={book.coverUrl} alt={`Couverture de ${book.title}`} loading="lazy" />
  ) : (
    <div className={`cover cover-${size} cover-generated`} style={toneStyle(book)}>
      <span className="cover-no" aria-hidden="true">N° {catalog(book)}</span>
      <span className="cover-title">{book.title}</span>
      <span className="cover-author">{book.author}</span>
    </div>
  );
}
