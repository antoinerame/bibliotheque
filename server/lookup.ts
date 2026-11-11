import { HttpError } from './repo.ts';

export interface LookupResult {
  title: string; subtitle: string; author: string;
  year: number | null; pages: number | null; isbn: string; coverUrl: string;
}

/** Cherche un livre par titre, auteur ou ISBN dans Open Library (seule la requête de recherche sort du serveur). */
export async function lookupBooks(query: string): Promise<LookupResult[]> {
  const q = query.trim();
  if (q.length < 2) return [];
  const digits = q.replace(/[-\s]/g, '');
  const isIsbn = /^(\d{9}[\dXx]|\d{13})$/.test(digits);
  const url = new URL('https://openlibrary.org/search.json');
  url.searchParams.set('q', isIsbn ? `isbn:${digits}` : q);
  url.searchParams.set('limit', '8');
  url.searchParams.set('fields', 'title,subtitle,author_name,first_publish_year,number_of_pages_median,isbn,cover_i');
  let data: any;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(10000), headers: { 'User-Agent': 'bibliotheque-perso/1.0' } });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    data = await res.json();
  } catch (e) {
    throw new HttpError(502, `Open Library ne répond pas (${e instanceof Error ? e.message : 'erreur'}). Tu peux saisir le livre à la main.`);
  }
  return (Array.isArray(data?.docs) ? data.docs : []).map((d: any): LookupResult => {
    const isbns: string[] = Array.isArray(d.isbn) ? d.isbn : [];
    return {
      title: String(d.title ?? ''),
      subtitle: String(d.subtitle ?? ''),
      author: Array.isArray(d.author_name) ? d.author_name.slice(0, 3).join(', ') : '',
      year: Number.isInteger(d.first_publish_year) ? d.first_publish_year : null,
      pages: Number.isInteger(d.number_of_pages_median) ? d.number_of_pages_median : null,
      isbn: isIsbn ? digits : (isbns.find((i) => i.length === 13) ?? isbns[0] ?? ''),
      coverUrl: d.cover_i ? `https://covers.openlibrary.org/b/id/${d.cover_i}-L.jpg` : '',
    };
  }).filter((r: LookupResult) => r.title);
}
