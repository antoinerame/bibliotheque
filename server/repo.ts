import { all, get, run, tx } from './db.ts';

export class HttpError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

/* ---------- événements (rafraîchissement en direct) ---------- */
const listeners = new Set<() => void>();
export function onChange(fn: () => void) {
  listeners.add(fn);
  return () => { listeners.delete(fn); };
}
function changed() {
  for (const fn of listeners) fn();
}

/* ---------- types ---------- */
export const BOOK_KINDS = ['essai', 'roman', 'autre'] as const;
export const STATUSES = ['a_lire', 'en_cours', 'lu', 'abandonne'] as const;
export const NOTE_TYPES = ['idee', 'citation', 'note', 'personnage'] as const;
export type BookKind = (typeof BOOK_KINDS)[number];
export type Status = (typeof STATUSES)[number];
export type NoteType = (typeof NOTE_TYPES)[number];

export const STATUS_LABEL: Record<Status, string> = {
  a_lire: 'à lire', en_cours: 'en cours', lu: 'lu', abandonne: 'abandonné',
};
export const NOTE_LABEL: Record<NoteType, string> = {
  idee: 'Idée clé', citation: 'Citation', note: 'Note', personnage: 'Personnage',
};

export interface Book {
  id: number; title: string; subtitle: string; author: string;
  year: number | null; pages: number | null; isbn: string; coverUrl: string; color: string;
  kind: BookKind; status: Status; currentPage: number; rating: number;
  recommendedBy: string; whyRead: string; summary: string; impact: string; disagreements: string;
  startedAt: string | null; finishedAt: string | null; createdAt: string;
  counts: { idee: number; citation: number; note: number; personnage: number; words: number };
}
export interface ThemeRef { id: number; name: string }
export interface Note {
  id: number; bookId: number; bookTitle: string; bookAuthor: string;
  type: NoteType; text: string; comment: string; chapter: string; page: number | null;
  verify: boolean; position: number; themes: ThemeRef[];
  box: number; dueAt: string | null; reviews: number; createdAt: string;
}
export interface Word {
  id: number; word: string; definition: string; etymology: string; example: string; mySentence: string;
  bookId: number | null; bookTitle: string; page: number | null;
  box: number; dueAt: string | null; reviews: number; createdAt: string;
}

export const NOTE_PLURAL: Record<NoteType, string> = {
  idee: 'Idées clés', citation: 'Citations', note: 'Notes', personnage: 'Personnages',
};

/* ---------- utilitaires ---------- */
function need<T>(v: T | undefined, what: string): T {
  if (!v) throw new HttpError(404, `${what} introuvable`);
  return v;
}
const str = (v: unknown, max = 20000) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
function intOrNull(v: unknown): number | null {
  if (v === null || v === undefined || v === '') return null;
  const n = Math.round(Number(v));
  return Number.isFinite(n) && n >= 0 ? n : null;
}
function dateOrNull(v: unknown): string | null {
  if (typeof v !== 'string' || !v.trim()) return null;
  const m = v.trim().match(/^\d{4}(-\d{2}(-\d{2})?)?/);
  if (!m) throw new HttpError(400, `Date invalide : ${v} (format attendu AAAA-MM-JJ)`);
  return m[0].length === 4 ? `${m[0]}-01-01` : m[0].length === 7 ? `${m[0]}-01` : m[0];
}
function oneOf<T extends string>(v: unknown, list: readonly T[], what: string): T {
  if (!list.includes(v as T)) throw new HttpError(400, `${what} invalide : ${String(v)} (valeurs : ${list.join(', ')})`);
  return v as T;
}
const today = () => new Date().toISOString().slice(0, 10);
const has = (o: any, k: string) => o && Object.prototype.hasOwnProperty.call(o, k) && o[k] !== undefined;

/* ---------- livres ---------- */
function mapBook(r: any): Book {
  return {
    id: r.id, title: r.title, subtitle: r.subtitle, author: r.author,
    year: r.year, pages: r.pages, isbn: r.isbn, coverUrl: r.cover_url, color: r.color,
    kind: r.kind, status: r.status, currentPage: r.current_page, rating: r.rating,
    recommendedBy: r.recommended_by, whyRead: r.why_read,
    summary: r.summary, impact: r.impact, disagreements: r.disagreements,
    startedAt: r.started_at, finishedAt: r.finished_at, createdAt: r.created_at,
    counts: {
      idee: r.n_idee ?? 0, citation: r.n_citation ?? 0, note: r.n_note ?? 0,
      personnage: r.n_personnage ?? 0, words: r.n_words ?? 0,
    },
  };
}
const BOOK_SELECT = `
  SELECT b.*,
    (SELECT COUNT(*) FROM notes n WHERE n.book_id = b.id AND n.type = 'idee') AS n_idee,
    (SELECT COUNT(*) FROM notes n WHERE n.book_id = b.id AND n.type = 'citation') AS n_citation,
    (SELECT COUNT(*) FROM notes n WHERE n.book_id = b.id AND n.type = 'note') AS n_note,
    (SELECT COUNT(*) FROM notes n WHERE n.book_id = b.id AND n.type = 'personnage') AS n_personnage,
    (SELECT COUNT(*) FROM words w WHERE w.book_id = b.id) AS n_words
  FROM books b`;

export function listBooks(filter: { status?: string } = {}): Book[] {
  const rows = filter.status
    ? all(`${BOOK_SELECT} WHERE b.status = ? ORDER BY COALESCE(b.finished_at, b.started_at, b.created_at) DESC, b.id DESC`, filter.status)
    : all(`${BOOK_SELECT} ORDER BY COALESCE(b.finished_at, b.started_at, b.created_at) DESC, b.id DESC`);
  return rows.map(mapBook);
}

export function getBookRow(id: number): Book {
  return mapBook(need(get(`${BOOK_SELECT} WHERE b.id = ?`, id), 'Livre'));
}

export function getBook(id: number) {
  const book = getBookRow(id);
  return { ...book, notes: notesWhere('n.book_id = ?', [id]), words: wordsWhere('w.book_id = ?', [id]) };
}

export function findBookByTitle(title: string): Book | undefined {
  const r = get(`${BOOK_SELECT} WHERE lower(b.title) = lower(?)`, title.trim());
  return r ? mapBook(r) : undefined;
}

const BOOK_FIELDS: Record<string, { col: string; conv: (v: unknown) => string | number | null }> = {
  title: { col: 'title', conv: (v) => str(v, 300) },
  subtitle: { col: 'subtitle', conv: (v) => str(v, 300) },
  author: { col: 'author', conv: (v) => str(v, 300) },
  year: { col: 'year', conv: intOrNull },
  pages: { col: 'pages', conv: intOrNull },
  isbn: { col: 'isbn', conv: (v) => str(v, 20).replace(/[^0-9Xx]/g, '') },
  coverUrl: { col: 'cover_url', conv: (v) => { const s = str(v, 1000); return /^https?:\/\//.test(s) ? s : ''; } },
  color: { col: 'color', conv: (v) => { const s = str(v, 9); return /^#[0-9a-fA-F]{6}$/.test(s) ? s : ''; } },
  kind: { col: 'kind', conv: (v) => oneOf(v, BOOK_KINDS, 'Genre') },
  status: { col: 'status', conv: (v) => oneOf(v, STATUSES, 'Statut') },
  currentPage: { col: 'current_page', conv: (v) => intOrNull(v) ?? 0 },
  rating: { col: 'rating', conv: (v) => Math.max(0, Math.min(5, intOrNull(v) ?? 0)) },
  recommendedBy: { col: 'recommended_by', conv: (v) => str(v, 300) },
  whyRead: { col: 'why_read', conv: (v) => str(v, 2000) },
  summary: { col: 'summary', conv: (v) => str(v) },
  impact: { col: 'impact', conv: (v) => str(v) },
  disagreements: { col: 'disagreements', conv: (v) => str(v) },
  startedAt: { col: 'started_at', conv: dateOrNull },
  finishedAt: { col: 'finished_at', conv: dateOrNull },
};

export function createBook(input: any): Book {
  const title = str(input?.title, 300);
  if (!title) throw new HttpError(400, 'Le titre est obligatoire');
  const id = Number(run(`INSERT INTO books (title) VALUES (?)`, title).lastInsertRowid);
  const { title: _t, ...rest } = input;
  applyBookPatch(id, { status: 'a_lire', ...rest });
  changed();
  return getBookRow(id);
}

function applyBookPatch(id: number, patch: any) {
  const before: any = need(get(`SELECT * FROM books WHERE id = ?`, id), 'Livre');
  const sets: string[] = [];
  const vals: (string | number | null)[] = [];
  for (const [key, f] of Object.entries(BOOK_FIELDS)) {
    if (!has(patch, key)) continue;
    const v = f.conv(patch[key]);
    if (key === 'title' && !v) throw new HttpError(400, 'Le titre est obligatoire');
    sets.push(`${f.col} = ?`);
    vals.push(v);
  }
  // Dates automatiques quand le statut change.
  if (has(patch, 'status') && patch.status !== before.status) {
    if (patch.status === 'en_cours' && !before.started_at && !has(patch, 'startedAt')) {
      sets.push(`started_at = ?`); vals.push(today());
    }
    if (patch.status === 'lu') {
      if (!before.finished_at && !has(patch, 'finishedAt')) { sets.push(`finished_at = ?`); vals.push(today()); }
      if (before.pages && !has(patch, 'currentPage')) { sets.push(`current_page = ?`); vals.push(before.pages); }
    }
  }
  if (!sets.length) return;
  run(`UPDATE books SET ${sets.join(', ')}, updated_at = datetime('now') WHERE id = ?`, ...vals, id);
}

export function updateBook(id: number, patch: any): Book {
  applyBookPatch(id, patch ?? {});
  changed();
  return getBookRow(id);
}

export function deleteBook(id: number) {
  need(get(`SELECT id FROM books WHERE id = ?`, id), 'Livre');
  run(`DELETE FROM books WHERE id = ?`, id);
  changed();
}

/* ---------- notes (idées, citations, notes, personnages) ---------- */
function notesWhere(where: string, params: (string | number | null)[], order = 'n.position, n.id'): Note[] {
  const rows = all(`
    SELECT n.*, b.title AS book_title, b.author AS book_author
    FROM notes n JOIN books b ON b.id = n.book_id
    WHERE ${where} ORDER BY ${order}`, ...params);
  if (!rows.length) return [];
  const links = all(`
    SELECT nt.note_id, t.id, t.name FROM note_themes nt JOIN themes t ON t.id = nt.theme_id
    WHERE nt.note_id IN (${rows.map(() => '?').join(',')}) ORDER BY t.name`, ...rows.map((r: any) => r.id));
  const byNote = new Map<number, ThemeRef[]>();
  for (const l of links) {
    if (!byNote.has(l.note_id)) byNote.set(l.note_id, []);
    byNote.get(l.note_id)!.push({ id: l.id, name: l.name });
  }
  return rows.map((r: any) => ({
    id: r.id, bookId: r.book_id, bookTitle: r.book_title, bookAuthor: r.book_author,
    type: r.type, text: r.text, comment: r.comment, chapter: r.chapter, page: r.page,
    verify: !!r.verify, position: r.position, themes: byNote.get(r.id) ?? [],
    box: r.box, dueAt: r.due_at, reviews: r.reviews, createdAt: r.created_at,
  }));
}

export function getNote(id: number): Note {
  return need(notesWhere('n.id = ?', [id])[0], 'Note');
}

function themeIdByName(name: string): number {
  const n = str(name, 100);
  if (!n) throw new HttpError(400, 'Nom de thème vide');
  const ex: any = get(`SELECT id FROM themes WHERE name = ?`, n);
  if (ex) return ex.id;
  return Number(run(`INSERT INTO themes (name) VALUES (?)`, n).lastInsertRowid);
}

function setNoteThemes(noteId: number, names: unknown) {
  if (!Array.isArray(names)) return;
  run(`DELETE FROM note_themes WHERE note_id = ?`, noteId);
  for (const name of names) {
    if (typeof name !== 'string' || !name.trim()) continue;
    run(`INSERT OR IGNORE INTO note_themes (note_id, theme_id) VALUES (?, ?)`, noteId, themeIdByName(name));
  }
}

function insertNote(bookId: number, input: any): number {
  const text = str(input?.text);
  if (!text) throw new HttpError(400, 'Le texte de la note est vide');
  const type = has(input, 'type') ? oneOf(input.type, NOTE_TYPES, 'Type de note') : 'note';
  const pos: any = get(`SELECT COALESCE(MAX(position), -1) + 1 AS p FROM notes WHERE book_id = ?`, bookId);
  const id = Number(run(
    `INSERT INTO notes (book_id, type, text, comment, chapter, page, verify, position) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    bookId, type, text, str(input.comment), str(input.chapter, 200), intOrNull(input.page), input.verify ? 1 : 0, pos.p,
  ).lastInsertRowid);
  setNoteThemes(id, input.themes);
  return id;
}

export function createNote(bookId: number, input: any): Note {
  need(get(`SELECT id FROM books WHERE id = ?`, bookId), 'Livre');
  const id = tx(() => insertNote(bookId, input));
  changed();
  return getNote(id);
}

export function createNotes(bookId: number, inputs: any[]): Note[] {
  need(get(`SELECT id FROM books WHERE id = ?`, bookId), 'Livre');
  const ids = tx(() => inputs.map((i) => insertNote(bookId, i)));
  changed();
  return ids.map(getNote);
}

export function updateNote(id: number, patch: any): Note {
  need(get(`SELECT id FROM notes WHERE id = ?`, id), 'Note');
  tx(() => {
    const sets: string[] = [];
    const vals: (string | number | null)[] = [];
    if (has(patch, 'text')) {
      const t = str(patch.text);
      if (!t) throw new HttpError(400, 'Le texte de la note est vide');
      sets.push('text = ?'); vals.push(t);
    }
    if (has(patch, 'type')) { sets.push('type = ?'); vals.push(oneOf(patch.type, NOTE_TYPES, 'Type de note')); }
    if (has(patch, 'comment')) { sets.push('comment = ?'); vals.push(str(patch.comment)); }
    if (has(patch, 'chapter')) { sets.push('chapter = ?'); vals.push(str(patch.chapter, 200)); }
    if (has(patch, 'page')) { sets.push('page = ?'); vals.push(intOrNull(patch.page)); }
    if (has(patch, 'verify')) { sets.push('verify = ?'); vals.push(patch.verify ? 1 : 0); }
    if (sets.length) run(`UPDATE notes SET ${sets.join(', ')}, updated_at = datetime('now') WHERE id = ?`, ...vals, id);
    if (has(patch, 'themes')) setNoteThemes(id, patch.themes);
  });
  changed();
  return getNote(id);
}

export function deleteNote(id: number) {
  need(get(`SELECT id FROM notes WHERE id = ?`, id), 'Note');
  run(`DELETE FROM notes WHERE id = ?`, id);
  changed();
}

/* ---------- dictionnaire ---------- */
function wordsWhere(where: string, params: (string | number | null)[]): Word[] {
  return all(`
    SELECT w.*, COALESCE(b.title, '') AS book_title FROM words w LEFT JOIN books b ON b.id = w.book_id
    WHERE ${where} ORDER BY w.word COLLATE NOCASE`, ...params).map((r: any) => ({
    id: r.id, word: r.word, definition: r.definition, etymology: r.etymology,
    example: r.example, mySentence: r.my_sentence,
    bookId: r.book_id, bookTitle: r.book_title, page: r.page,
    box: r.box, dueAt: r.due_at, reviews: r.reviews, createdAt: r.created_at,
  }));
}

export function listWords(filter: { q?: string; bookId?: number } = {}): Word[] {
  const conds = ['1 = 1'];
  const params: (string | number)[] = [];
  if (filter.q?.trim()) {
    conds.push(`(w.word LIKE ? OR w.definition LIKE ?)`);
    params.push(`%${filter.q.trim()}%`, `%${filter.q.trim()}%`);
  }
  if (filter.bookId) { conds.push(`w.book_id = ?`); params.push(filter.bookId); }
  return wordsWhere(conds.join(' AND '), params);
}

export function getWord(id: number): Word {
  return need(wordsWhere('w.id = ?', [id])[0], 'Mot');
}

export function findWord(word: string): Word | undefined {
  return wordsWhere('lower(w.word) = lower(?)', [word.trim()])[0];
}

function bookIdOrNull(v: unknown): number | null {
  const n = intOrNull(v);
  if (n === null) return null;
  need(get(`SELECT id FROM books WHERE id = ?`, n), 'Livre');
  return n;
}

export function createWord(input: any): Word {
  const word = str(input?.word, 200);
  if (!word) throw new HttpError(400, 'Le mot est obligatoire');
  const ex = findWord(word);
  if (ex) throw new HttpError(409, `« ${ex.word} » est déjà dans le dictionnaire (word_id=${ex.id})`);
  const id = Number(run(
    `INSERT INTO words (word, definition, etymology, example, my_sentence, book_id, page) VALUES (?, ?, ?, ?, ?, ?, ?)`,
    word, str(input.definition), str(input.etymology), str(input.example), str(input.mySentence),
    bookIdOrNull(input.bookId), intOrNull(input.page),
  ).lastInsertRowid);
  changed();
  return getWord(id);
}

export function updateWord(id: number, patch: any): Word {
  need(get(`SELECT id FROM words WHERE id = ?`, id), 'Mot');
  const sets: string[] = [];
  const vals: (string | number | null)[] = [];
  if (has(patch, 'word')) {
    const w = str(patch.word, 200);
    if (!w) throw new HttpError(400, 'Le mot est obligatoire');
    const ex = findWord(w);
    if (ex && ex.id !== id) throw new HttpError(409, `« ${ex.word} » est déjà dans le dictionnaire`);
    sets.push('word = ?'); vals.push(w);
  }
  for (const [k, col] of [['definition', 'definition'], ['etymology', 'etymology'], ['example', 'example'], ['mySentence', 'my_sentence']]) {
    if (has(patch, k)) { sets.push(`${col} = ?`); vals.push(str(patch[k])); }
  }
  if (has(patch, 'bookId')) { sets.push('book_id = ?'); vals.push(bookIdOrNull(patch.bookId)); }
  if (has(patch, 'page')) { sets.push('page = ?'); vals.push(intOrNull(patch.page)); }
  if (sets.length) run(`UPDATE words SET ${sets.join(', ')}, updated_at = datetime('now') WHERE id = ?`, ...vals, id);
  changed();
  return getWord(id);
}

export function deleteWord(id: number) {
  need(get(`SELECT id FROM words WHERE id = ?`, id), 'Mot');
  run(`DELETE FROM words WHERE id = ?`, id);
  changed();
}

/* ---------- thèmes transversaux ---------- */
export function listThemes() {
  return all(`
    SELECT t.id, t.name, t.description,
      (SELECT COUNT(*) FROM note_themes nt WHERE nt.theme_id = t.id) AS note_count,
      (SELECT COUNT(DISTINCT n.book_id) FROM note_themes nt JOIN notes n ON n.id = nt.note_id WHERE nt.theme_id = t.id) AS book_count
    FROM themes t ORDER BY t.name COLLATE NOCASE`).map((r: any) => ({
    id: r.id, name: r.name, description: r.description, noteCount: r.note_count, bookCount: r.book_count,
  }));
}

export function getTheme(id: number) {
  const t: any = need(get(`SELECT * FROM themes WHERE id = ?`, id), 'Thème');
  const notes = notesWhere(
    `n.id IN (SELECT note_id FROM note_themes WHERE theme_id = ?)`, [id], 'b.title COLLATE NOCASE, n.position, n.id');
  return { id: t.id, name: t.name, description: t.description, notes };
}

export function createTheme(input: any) {
  const name = str(input?.name, 100);
  if (!name) throw new HttpError(400, 'Le nom du thème est obligatoire');
  if (get(`SELECT id FROM themes WHERE name = ?`, name)) throw new HttpError(409, `Le thème « ${name} » existe déjà`);
  const id = Number(run(`INSERT INTO themes (name, description) VALUES (?, ?)`, name, str(input.description)).lastInsertRowid);
  changed();
  return { id, name };
}

export function updateTheme(id: number, patch: any) {
  need(get(`SELECT id FROM themes WHERE id = ?`, id), 'Thème');
  if (has(patch, 'name')) {
    const name = str(patch.name, 100);
    if (!name) throw new HttpError(400, 'Le nom du thème est obligatoire');
    const ex: any = get(`SELECT id FROM themes WHERE name = ?`, name);
    if (ex && ex.id !== id) throw new HttpError(409, `Le thème « ${name} » existe déjà`);
    run(`UPDATE themes SET name = ? WHERE id = ?`, name, id);
  }
  if (has(patch, 'description')) run(`UPDATE themes SET description = ? WHERE id = ?`, str(patch.description), id);
  changed();
}

export function deleteTheme(id: number) {
  need(get(`SELECT id FROM themes WHERE id = ?`, id), 'Thème');
  run(`DELETE FROM themes WHERE id = ?`, id);
  changed();
}

/* ---------- révision espacée ---------- */
const INTERVAL_DAYS = [1, 3, 7, 16, 35, 90];
export type CardKind = 'mot' | 'idee' | 'citation';
export interface Card {
  kind: CardKind; id: number; front: string; back: string; extra: string;
  bookId: number | null; bookTitle: string; box: number; isNew: boolean;
}

const REVIEWABLE_NOTE = `((n.type = 'idee' AND n.comment <> '') OR n.type = 'citation')`;
const REVIEWABLE_WORD = `w.definition <> ''`;
const DUE = (a: string) => `(${a}.due_at IS NULL OR ${a}.due_at <= ?)`;

export function dueCount(): number {
  const now = new Date().toISOString();
  const n: any = get(`SELECT COUNT(*) AS c FROM notes n WHERE ${REVIEWABLE_NOTE} AND ${DUE('n')}`, now);
  const w: any = get(`SELECT COUNT(*) AS c FROM words w WHERE ${REVIEWABLE_WORD} AND ${DUE('w')}`, now);
  return n.c + w.c;
}

export function dueCards(opts: { kind?: string; bookId?: number; limit?: number; all?: boolean } = {}): Card[] {
  const now = new Date().toISOString();
  const cards: (Card & { due: string | null })[] = [];
  const wantWords = !opts.kind || opts.kind === 'mot';
  const wantNotes = !opts.kind || opts.kind === 'idee' || opts.kind === 'citation';
  if (wantWords) {
    const conds = [REVIEWABLE_WORD];
    const params: (string | number)[] = [];
    if (!opts.all) { conds.push(DUE('w')); params.push(now); }
    if (opts.bookId) { conds.push('w.book_id = ?'); params.push(opts.bookId); }
    for (const w of wordsWhere(conds.join(' AND '), params)) {
      cards.push({
        kind: 'mot', id: w.id, front: w.word, back: w.definition,
        extra: [w.example && `« ${w.example} »`, w.etymology && `Étymologie : ${w.etymology}`].filter(Boolean).join('\n'),
        bookId: w.bookId, bookTitle: w.bookTitle, box: w.box, isNew: w.reviews === 0, due: w.dueAt,
      });
    }
  }
  if (wantNotes) {
    const conds = [REVIEWABLE_NOTE];
    const params: (string | number)[] = [];
    if (opts.kind === 'idee' || opts.kind === 'citation') { conds.push('n.type = ?'); params.push(opts.kind); }
    if (!opts.all) { conds.push(DUE('n')); params.push(now); }
    if (opts.bookId) { conds.push('n.book_id = ?'); params.push(opts.bookId); }
    for (const n of notesWhere(conds.join(' AND '), params)) {
      const source = [n.bookAuthor, n.bookTitle].filter(Boolean).join(', ') + (n.page ? `, p. ${n.page}` : '');
      cards.push(n.type === 'idee'
        ? { kind: 'idee', id: n.id, front: n.text, back: n.comment, extra: '', bookId: n.bookId, bookTitle: n.bookTitle, box: n.box, isNew: n.reviews === 0, due: n.dueAt }
        : { kind: 'citation', id: n.id, front: n.text, back: source, extra: n.comment, bookId: n.bookId, bookTitle: n.bookTitle, box: n.box, isNew: n.reviews === 0, due: n.dueAt });
    }
  }
  // Les plus en retard d'abord, puis les nouvelles.
  cards.sort((a, b) => Number(a.due === null) - Number(b.due === null) || (a.due ?? '').localeCompare(b.due ?? '') || a.id - b.id);
  return cards.slice(0, Math.max(1, Math.min(opts.limit ?? 20, 100))).map(({ due: _d, ...c }) => c);
}

/** grade : 0 = raté, 1 = hésitant, 2 = su. */
export function gradeCard(kind: string, id: number, grade: number) {
  const table = kind === 'mot' ? 'words' : kind === 'idee' || kind === 'citation' ? 'notes' : null;
  if (!table) throw new HttpError(400, `Type de carte invalide : ${kind}`);
  if (![0, 1, 2].includes(grade)) throw new HttpError(400, 'Note invalide (0 = raté, 1 = hésitant, 2 = su)');
  const row: any = need(get(`SELECT id, box FROM ${table} WHERE id = ?`, id), 'Carte');
  let box = row.box;
  let due: Date;
  if (grade === 0) {
    box = 0;
    due = new Date(Date.now() + 10 * 60 * 1000);
  } else if (grade === 1) {
    box = Math.max(box, 1);
    due = new Date(Date.now() + 24 * 3600 * 1000);
  } else {
    box = Math.min(box + 1, INTERVAL_DAYS.length);
    due = new Date(Date.now() + INTERVAL_DAYS[box - 1] * 24 * 3600 * 1000);
  }
  run(`UPDATE ${table} SET box = ?, due_at = ?, reviews = reviews + 1 WHERE id = ?`, box, due.toISOString(), id);
  changed();
  return { box, dueAt: due.toISOString() };
}

/* ---------- réglages ---------- */
export function getSettings() {
  const rows = all(`SELECT key, value FROM settings`);
  const m = Object.fromEntries(rows.map((r: any) => [r.key, r.value]));
  return { yearlyGoal: Number(m.yearlyGoal) || 0 };
}
export function setSettings(patch: any) {
  if (has(patch, 'yearlyGoal')) {
    const n = Math.max(0, Math.min(1000, intOrNull(patch.yearlyGoal) ?? 0));
    run(`INSERT INTO settings (key, value) VALUES ('yearlyGoal', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value`, String(n));
  }
  changed();
  return getSettings();
}

/* ---------- fiches incomplètes ---------- */
export interface Incomplete {
  kind: 'livre' | 'mot' | 'note'; id: number; bookId: number | null; label: string; missing: string[];
}
export function incomplete(): Incomplete[] {
  const out: Incomplete[] = [];
  for (const b of listBooks({ status: 'lu' })) {
    const missing: string[] = [];
    if (!b.summary) missing.push('résumé');
    if (b.kind !== 'roman' && b.counts.idee === 0) missing.push('idées clés');
    if (!b.rating) missing.push('note sur 5');
    if (!b.impact) missing.push('ce que j’en retiens pour moi');
    if (missing.length) out.push({ kind: 'livre', id: b.id, bookId: b.id, label: b.title, missing });
  }
  for (const w of wordsWhere('1 = 1', [])) {
    const missing: string[] = [];
    if (!w.definition) missing.push('définition');
    if (!w.example) missing.push('phrase d’origine');
    if (!w.mySentence) missing.push('ma phrase');
    if (missing.length) out.push({ kind: 'mot', id: w.id, bookId: w.bookId, label: w.word, missing });
  }
  for (const n of notesWhere(`n.verify = 1 OR (n.type = 'idee' AND n.comment = '')`, [])) {
    const missing: string[] = [];
    if (n.verify) missing.push('à vérifier dans le livre');
    if (n.type === 'idee' && !n.comment) missing.push('explication avec mes mots');
    out.push({ kind: 'note', id: n.id, bookId: n.bookId, label: `${n.bookTitle} : ${n.text.slice(0, 90)}`, missing });
  }
  return out;
}

/* ---------- accueil et statistiques ---------- */
export function stats() {
  const books = listBooks();
  const read = books.filter((b) => b.status === 'lu');
  const byYear = new Map<string, { year: string; books: number; pages: number }>();
  for (const b of read) {
    const y = (b.finishedAt ?? '').slice(0, 4) || 'Sans date';
    const e = byYear.get(y) ?? { year: y, books: 0, pages: 0 };
    e.books++;
    e.pages += b.pages ?? 0;
    byYear.set(y, e);
  }
  const c = (sql: string) => (get(sql) as any).c as number;
  const year = String(new Date().getFullYear());
  return {
    year,
    goal: getSettings().yearlyGoal,
    thisYear: byYear.get(year) ?? { year, books: 0, pages: 0 },
    byYear: [...byYear.values()].sort((a, b) => b.year.localeCompare(a.year)),
    totals: {
      books: books.length,
      read: read.length,
      reading: books.filter((b) => b.status === 'en_cours').length,
      toRead: books.filter((b) => b.status === 'a_lire').length,
      pagesRead: read.reduce((s, b) => s + (b.pages ?? 0), 0),
      ideas: c(`SELECT COUNT(*) AS c FROM notes WHERE type = 'idee'`),
      quotes: c(`SELECT COUNT(*) AS c FROM notes WHERE type = 'citation'`),
      notes: c(`SELECT COUNT(*) AS c FROM notes WHERE type = 'note'`),
      words: c(`SELECT COUNT(*) AS c FROM words`),
      wordsMastered: c(`SELECT COUNT(*) AS c FROM words WHERE box >= 3`),
      themes: c(`SELECT COUNT(*) AS c FROM themes`),
    },
  };
}

export function home() {
  // « Remontée du jour » : une idée ou une citation, la même toute la journée.
  const pool = all(`SELECT id FROM notes WHERE type IN ('idee','citation') ORDER BY id`);
  const day = Math.floor(Date.now() / 86400000);
  const daily = pool.length ? getNote(pool[(day * 7919) % pool.length].id) : null;
  return {
    books: listBooks(),
    daily,
    dueCount: dueCount(),
    incompleteCount: incomplete().length,
    stats: stats(),
  };
}

/* ---------- recherche ---------- */
export function search(q: string) {
  const s = q.trim();
  if (s.length < 2) return { books: [], notes: [], words: [], themes: [] };
  const like = `%${s}%`;
  return {
    books: all(`${BOOK_SELECT} WHERE b.title LIKE ? OR b.author LIKE ? OR b.subtitle LIKE ? OR b.summary LIKE ? LIMIT 15`, like, like, like, like).map(mapBook),
    notes: notesWhere(`n.text LIKE ? OR n.comment LIKE ? OR n.chapter LIKE ?`, [like, like, like]).slice(0, 30),
    words: wordsWhere(`w.word LIKE ? OR w.definition LIKE ?`, [like, like]).slice(0, 20),
    themes: listThemes().filter((t) => (t.name + ' ' + t.description).toLowerCase().includes(s.toLowerCase())),
  };
}

/* ---------- export / import ---------- */
export function exportAll() {
  return {
    app: 'bibliotheque', version: 1, exportedAt: new Date().toISOString(),
    settings: getSettings(),
    themes: all(`SELECT name, description FROM themes ORDER BY id`),
    books: listBooks().reverse().map((b) => {
      const { id, counts: _c, ...rest } = b;
      return {
        ...rest,
        notes: notesWhere('n.book_id = ?', [id]).map((n) => ({
          type: n.type, text: n.text, comment: n.comment, chapter: n.chapter, page: n.page, verify: n.verify,
          themes: n.themes.map((t) => t.name), box: n.box, dueAt: n.dueAt, reviews: n.reviews,
        })),
        words: wordsWhere('w.book_id = ?', [id]).map(exportWord),
      };
    }),
    words: wordsWhere('w.book_id IS NULL', []).map(exportWord),
  };
}
function exportWord(w: Word) {
  return {
    word: w.word, definition: w.definition, etymology: w.etymology, example: w.example,
    mySentence: w.mySentence, page: w.page, box: w.box, dueAt: w.dueAt, reviews: w.reviews,
  };
}

export function importAll(data: any, mode: 'merge' | 'replace') {
  if (!data || data.app !== 'bibliotheque' || !Array.isArray(data.books)) {
    throw new HttpError(400, 'Fichier non reconnu : ce n’est pas un export de la Bibliothèque');
  }
  const count = { books: 0, notes: 0, words: 0 };
  tx(() => {
    if (mode === 'replace') {
      run(`DELETE FROM note_themes`); run(`DELETE FROM notes`); run(`DELETE FROM words`);
      run(`DELETE FROM books`); run(`DELETE FROM themes`);
    }
    for (const t of Array.isArray(data.themes) ? data.themes : []) {
      const name = str(t?.name, 100);
      if (!name) continue;
      const id = themeIdByName(name);
      if (t.description) run(`UPDATE themes SET description = ? WHERE id = ? AND description = ''`, str(t.description), id);
    }
    const keepReview = (table: string, id: number, src: any) => run(
      `UPDATE ${table} SET box = ?, due_at = ?, reviews = ? WHERE id = ?`,
      Math.max(0, Math.min(INTERVAL_DAYS.length, Number(src.box) || 0)),
      typeof src.dueAt === 'string' ? src.dueAt : null, Number(src.reviews) || 0, id);
    const addWord = (w: any, bookId: number | null) => {
      const word = str(w?.word, 200);
      if (!word || findWord(word)) return;
      const id = Number(run(
        `INSERT INTO words (word, definition, etymology, example, my_sentence, book_id, page) VALUES (?, ?, ?, ?, ?, ?, ?)`,
        word, str(w.definition), str(w.etymology), str(w.example), str(w.mySentence), bookId, intOrNull(w.page)).lastInsertRowid);
      keepReview('words', id, w);
      count.words++;
    };
    for (const b of data.books) {
      const title = str(b?.title, 300);
      if (!title) continue;
      const id = Number(run(`INSERT INTO books (title) VALUES (?)`, title).lastInsertRowid);
      const { title: _t, notes, words, ...rest } = b;
      // Les dates sont posées telles quelles, sans les automatismes de changement de statut.
      applyBookPatch(id, { ...rest, startedAt: rest.startedAt ?? null, finishedAt: rest.finishedAt ?? null, currentPage: rest.currentPage ?? 0 });
      count.books++;
      for (const n of Array.isArray(notes) ? notes : []) {
        if (!str(n?.text)) continue;
        keepReview('notes', insertNote(id, n), n);
        count.notes++;
      }
      for (const w of Array.isArray(words) ? words : []) addWord(w, id);
    }
    for (const w of Array.isArray(data.words) ? data.words : []) addWord(w, null);
    if (data.settings?.yearlyGoal && mode === 'replace') {
      run(`INSERT INTO settings (key, value) VALUES ('yearlyGoal', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
        String(intOrNull(data.settings.yearlyGoal) ?? 0));
    }
  });
  changed();
  return count;
}

export function isEmpty() {
  return (get(`SELECT COUNT(*) AS c FROM books`) as any).c === 0;
}
