import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';

const DATA_DIR = process.env.DATA_DIR || path.resolve(process.cwd(), 'data');
fs.mkdirSync(DATA_DIR, { recursive: true });

export const db = new DatabaseSync(path.join(DATA_DIR, 'bibliotheque.db'));

// kind « texte » = texte court (article, essai bref, chapitre, discours) : rangé à part des livres.
const BOOKS_TABLE = `CREATE TABLE IF NOT EXISTS books (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  subtitle TEXT NOT NULL DEFAULT '',
  author TEXT NOT NULL DEFAULT '',
  year INTEGER,
  pages INTEGER,
  isbn TEXT NOT NULL DEFAULT '',
  cover_url TEXT NOT NULL DEFAULT '',
  color TEXT NOT NULL DEFAULT '',
  publication TEXT NOT NULL DEFAULT '',
  url TEXT NOT NULL DEFAULT '',
  kind TEXT NOT NULL DEFAULT 'essai' CHECK (kind IN ('essai','roman','texte','autre')),
  status TEXT NOT NULL DEFAULT 'a_lire' CHECK (status IN ('a_lire','en_cours','lu','abandonne')),
  current_page INTEGER NOT NULL DEFAULT 0,
  rating INTEGER NOT NULL DEFAULT 0 CHECK (rating BETWEEN 0 AND 5),
  recommended_by TEXT NOT NULL DEFAULT '',
  why_read TEXT NOT NULL DEFAULT '',
  summary TEXT NOT NULL DEFAULT '',
  impact TEXT NOT NULL DEFAULT '',
  disagreements TEXT NOT NULL DEFAULT '',
  started_at TEXT,
  finished_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
)`;

db.exec(`
PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

${BOOKS_TABLE};

-- Tout ce qu'on retient d'un livre : idées clés, citations, notes libres, personnages.
CREATE TABLE IF NOT EXISTS notes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  book_id INTEGER NOT NULL REFERENCES books(id) ON DELETE CASCADE,
  type TEXT NOT NULL DEFAULT 'note' CHECK (type IN ('idee','citation','note','personnage')),
  text TEXT NOT NULL,
  comment TEXT NOT NULL DEFAULT '',
  chapter TEXT NOT NULL DEFAULT '',
  page INTEGER,
  verify INTEGER NOT NULL DEFAULT 0,
  position INTEGER NOT NULL DEFAULT 0,
  box INTEGER NOT NULL DEFAULT 0,
  due_at TEXT,
  reviews INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS words (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  word TEXT NOT NULL,
  definition TEXT NOT NULL DEFAULT '',
  etymology TEXT NOT NULL DEFAULT '',
  example TEXT NOT NULL DEFAULT '',
  my_sentence TEXT NOT NULL DEFAULT '',
  book_id INTEGER REFERENCES books(id) ON DELETE SET NULL,
  page INTEGER,
  box INTEGER NOT NULL DEFAULT 0,
  due_at TEXT,
  reviews INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS themes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE COLLATE NOCASE,
  description TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS note_themes (
  note_id INTEGER NOT NULL REFERENCES notes(id) ON DELETE CASCADE,
  theme_id INTEGER NOT NULL REFERENCES themes(id) ON DELETE CASCADE,
  PRIMARY KEY (note_id, theme_id)
);

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_notes_book ON notes(book_id);
CREATE INDEX IF NOT EXISTS idx_words_book ON words(book_id);
CREATE INDEX IF NOT EXISTS idx_nt_theme ON note_themes(theme_id);
`);

type P = string | number | null;
export const all = <T = any>(sql: string, ...p: P[]) => db.prepare(sql).all(...p) as T[];
export const get = <T = any>(sql: string, ...p: P[]) => db.prepare(sql).get(...p) as T | undefined;
export const run = (sql: string, ...p: P[]) => db.prepare(sql).run(...p);

export function tx<T>(fn: () => T): T {
  db.exec('BEGIN');
  try {
    const r = fn();
    db.exec('COMMIT');
    return r;
  } catch (e) {
    db.exec('ROLLBACK');
    throw e;
  }
}

/**
 * Migration des bases créées avant les textes courts : SQLite ne sait pas modifier une contrainte CHECK,
 * on reconstruit donc la table books (procédure standard : nouvelle table, copie, échange des noms).
 * Les identifiants sont conservés, les notes et les mots restent rattachés à leur livre.
 */
function migrateBooks() {
  const sql = get<{ sql: string }>(`SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'books'`)?.sql ?? '';
  if (sql.includes("'texte'")) return;
  const cols = all<{ name: string }>(`PRAGMA table_info(books)`).map((c) => c.name).join(', ');
  db.exec('PRAGMA foreign_keys = OFF');
  try {
    tx(() => {
      db.exec(BOOKS_TABLE.replace('CREATE TABLE IF NOT EXISTS books', 'CREATE TABLE books_new'));
      db.exec(`INSERT INTO books_new (${cols}) SELECT ${cols} FROM books`);
      db.exec('DROP TABLE books');
      db.exec('ALTER TABLE books_new RENAME TO books');
    });
  } finally {
    db.exec('PRAGMA foreign_keys = ON');
  }
}
migrateBooks();
