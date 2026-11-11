import type { Book } from '../api';
import { BookCover, Shelf } from './epure/Shelf';

/** Le rôle d'une étagère. */
export type ShelfVariant = 'en_cours' | 'lu' | 'a_lire' | 'abandonne';
export interface ShelfGroup { label: string; books: Book[] }
export interface ShelfProps {
  /** Titre de l'étagère, ex. « Table de chevet » ou « Lus ». */
  title: string;
  /** Petite précision à côté du titre, ex. « 12 livres ». */
  hint?: string;
  variant: ShelfVariant;
  books: Book[];
  /** Découpage des mêmes livres en groupes (par année de lecture) : un séparateur vertical étiqueté ouvre chaque groupe. */
  groups?: ShelfGroup[];
  /** Texte affiché quand l'étagère est vide. */
  empty?: string;
}
export interface BookCoverProps { book: Book; size?: 'sm' | 'md' | 'lg' }

const design = { Shelf, BookCover };
export function useDesign() {
  return design;
}

export type ThemeMode = 'auto' | 'light' | 'dark';
export function getThemeMode(): ThemeMode {
  const t = document.documentElement.dataset.theme;
  return t === 'light' || t === 'dark' ? t : 'auto';
}
export function setThemeMode(mode: ThemeMode) {
  if (mode === 'auto') delete document.documentElement.dataset.theme;
  else document.documentElement.dataset.theme = mode;
  try {
    if (mode === 'auto') localStorage.removeItem('theme');
    else localStorage.setItem('theme', mode);
  } catch { /* stockage indisponible */ }
}
