import { useCallback, useEffect, useRef, useState } from 'react';

export type BookKind = 'essai' | 'roman' | 'autre';
export type Status = 'a_lire' | 'en_cours' | 'lu' | 'abandonne';
export type NoteType = 'idee' | 'citation' | 'note' | 'personnage';
export type CardKind = 'mot' | 'idee' | 'citation';

export interface Book {
  id: number; title: string; subtitle: string; author: string;
  year: number | null; pages: number | null; isbn: string; coverUrl: string;
  /** Couleur de dos choisie par l'utilisateur (#rrggbb) ou '' : au design de choisir. */
  color: string;
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
export interface BookFull extends Book { notes: Note[]; words: Word[] }
export interface Theme { id: number; name: string; description: string; noteCount: number; bookCount: number }
export interface ThemeFull { id: number; name: string; description: string; notes: Note[] }
export interface Card {
  kind: CardKind; id: number; front: string; back: string; extra: string;
  bookId: number | null; bookTitle: string; box: number; isNew: boolean;
}
export interface Incomplete { kind: 'livre' | 'mot' | 'note'; id: number; bookId: number | null; label: string; missing: string[] }
export interface YearStat { year: string; books: number; pages: number }
export interface Stats {
  year: string; goal: number; thisYear: YearStat; byYear: YearStat[];
  totals: {
    books: number; read: number; reading: number; toRead: number; pagesRead: number;
    ideas: number; quotes: number; notes: number; words: number; wordsMastered: number; themes: number;
  };
}
export interface Home { books: Book[]; daily: Note | null; dueCount: number; incompleteCount: number; stats: Stats }
export interface LookupResult {
  title: string; subtitle: string; author: string; year: number | null; pages: number | null; isbn: string; coverUrl: string;
}
export interface SearchResult { books: Book[]; notes: Note[]; words: Word[]; themes: Theme[] }

export const STATUS_LABEL: Record<Status, string> = { a_lire: 'À lire', en_cours: 'En cours', lu: 'Lu', abandonne: 'Abandonné' };
export const KIND_LABEL: Record<BookKind, string> = { essai: 'Essai', roman: 'Roman', autre: 'Autre' };
export const NOTE_LABEL: Record<NoteType, string> = { idee: 'Idée clé', citation: 'Citation', note: 'Note', personnage: 'Personnage' };

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) { super(message); this.status = status; }
}

export async function api<T = any>(path: string, opts: { method?: string; body?: unknown } = {}): Promise<T> {
  const res = await fetch('/api' + path, {
    method: opts.method ?? (opts.body !== undefined ? 'POST' : 'GET'),
    headers: opts.body !== undefined ? { 'Content-Type': 'application/json' } : undefined,
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    if (res.status === 401 && path !== '/login') window.dispatchEvent(new Event('biblio:logout'));
    throw new ApiError(res.status, data?.error || `Erreur ${res.status}`);
  }
  return data as T;
}

/* Rafraîchissement en direct : le serveur prévient quand quelque chose change (y compris via Claude). */
const liveListeners = new Set<() => void>();
let source: EventSource | null = null;
function ensureSource() {
  if (source || typeof EventSource === 'undefined') return;
  source = new EventSource('/api/events');
  source.onmessage = () => { for (const fn of liveListeners) fn(); };
}
export function useLive(cb: () => void) {
  const ref = useRef(cb);
  ref.current = cb;
  useEffect(() => {
    ensureSource();
    const fn = () => ref.current();
    liveListeners.add(fn);
    return () => { liveListeners.delete(fn); };
  }, []);
}

export function useData<T>(path: string | null, live = true) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const current = useRef(path);
  current.current = path;
  const reload = useCallback(async () => {
    if (!path) return;
    try {
      const d = await api<T>(path);
      if (current.current === path) { setData(d); setError(null); }
    } catch (e: any) {
      if (current.current === path) setError(e.message);
    }
  }, [path]);
  useEffect(() => { setData(null); setError(null); reload(); }, [reload]);
  useLive(() => { if (live) reload(); });
  return { data, error, reload };
}
