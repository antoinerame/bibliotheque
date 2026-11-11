import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import * as repo from './repo.ts';
import { lookupBooks } from './lookup.ts';

const INSTRUCTIONS = `La Bibliothèque est le site personnel de lecture de l'utilisateur : ses livres (lus, en cours, à lire), ce qu'il en a retenu, et le dictionnaire des mots qu'il a appris. Tu peux tout y lire et tout y écrire : ajouter des livres, des envies de lecture, des résumés, des idées, des citations, des mots.

Structure :
- Livre : status "a_lire" (pile à lire / envie), "en_cours", "lu", "abandonne". kind "essai", "roman" ou "autre".
  - summary = le résumé en trois phrases environ. impact = ce que le livre a changé pour l'utilisateur. disagreements = ses désaccords avec l'auteur.
  - recommended_by / why_read = qui a recommandé le livre et pourquoi le lire (surtout pour les livres à lire).
- Notes d'un livre, quatre types :
  - "idee" : text = intitulé court de l'idée clé ; comment = l'explication AVEC LES MOTS DE L'UTILISATEUR. C'est la paire question/réponse de la révision.
  - "citation" : text = la citation exacte, sans guillemets ; comment = pourquoi elle compte ; page si connue.
  - "note" : remarque libre, rangée par chapitre (chapter).
  - "personnage" : text = nom ; comment = qui il est (pour les romans).
  - themes = thèmes transversaux (ex. « Méritocratie ») qui relient des idées de plusieurs livres. Réutilise les thèmes existants (list_themes) plutôt que d'en créer des variantes.
- Mot du dictionnaire : word, definition, etymology, example (la phrase où il a été rencontré), my_sentence (une phrase de l'utilisateur), livre et page d'origine.
- Révision espacée : les mots définis, les idées expliquées et les citations reviennent à intervalles croissants.

Règles :
1. Avant d'écrire, lis l'existant (list_books, get_book, list_words) pour éviter les doublons et ranger au bon endroit.
2. N'invente JAMAIS une citation ni un numéro de page. Une citation doit venir de l'utilisateur (dictée, photo de page) ou être certaine mot pour mot ; sinon mets verify = true ou propose plutôt une idée reformulée. Sans numéro de page sûr, laisse page vide.
3. C'est la mémoire de l'utilisateur, pas une fiche de lecture générique : fais-le d'abord parler (« qu'en as-tu retenu ? »), puis enregistre ses formulations en les clarifiant. Si tu complètes avec tes propres connaissances du livre, dis-le-lui et fais-le valider.
4. Pour un nouveau livre, lookup_book récupère l'auteur, l'année, le nombre de pages et la couverture ; passe-les ensuite à add_book.
5. Quand un livre est terminé, propose la séance « qu'est-ce que j'ai retenu » : résumé en trois phrases, 3 à 7 idées clés, citations, ce que ça change pour lui, puis update_book et add_notes.
6. find_incomplete liste les fiches à compléter ; get_due_reviews donne les cartes à réviser : interroge l'utilisateur une carte à la fois, sans montrer la réponse, puis record_review.
7. Ne supprime rien sans que l'utilisateur le demande.`;

const text = (t: string) => ({ content: [{ type: 'text' as const, text: t }] });
const fail = (e: unknown) => ({ content: [{ type: 'text' as const, text: `Erreur : ${e instanceof Error ? e.message : String(e)}` }], isError: true });
function safe<A>(fn: (a: A) => string | Promise<string>) {
  return async (a: A) => {
    try { return text(await fn(a)); } catch (e) { return fail(e); }
  };
}

const bookFields = {
  subtitle: z.string().optional(),
  author: z.string().optional(),
  year: z.number().int().optional().describe('Année de première parution'),
  pages: z.number().int().optional().describe('Nombre de pages'),
  isbn: z.string().optional(),
  cover_url: z.string().optional().describe('Adresse http(s) de l’image de couverture (fournie par lookup_book)'),
  kind: z.enum(repo.BOOK_KINDS).optional().describe('essai (défaut), roman ou autre'),
  status: z.enum(repo.STATUSES).optional().describe('a_lire (défaut), en_cours, lu, abandonne'),
  current_page: z.number().int().optional().describe('Page où en est l’utilisateur'),
  rating: z.number().int().min(0).max(5).optional().describe('Note de l’utilisateur sur 5 (0 = pas noté). Ne la devine pas.'),
  recommended_by: z.string().optional().describe('Qui a recommandé le livre'),
  why_read: z.string().optional().describe('Pourquoi le lire'),
  summary: z.string().optional().describe('Résumé en trois phrases environ'),
  impact: z.string().optional().describe('Ce que le livre a changé pour l’utilisateur'),
  disagreements: z.string().optional().describe('Ses désaccords avec l’auteur'),
  started_at: z.string().optional().describe('Date de début, AAAA-MM-JJ'),
  finished_at: z.string().optional().describe('Date de fin, AAAA-MM-JJ'),
};
function bookInput(a: any) {
  const map: Record<string, string> = {
    cover_url: 'coverUrl', current_page: 'currentPage', recommended_by: 'recommendedBy',
    why_read: 'whyRead', started_at: 'startedAt', finished_at: 'finishedAt',
  };
  const out: any = {};
  for (const [k, v] of Object.entries(a)) {
    if (v === undefined || k === 'book_id') continue;
    out[map[k] ?? k] = v;
  }
  return out;
}

const noteFields = {
  type: z.enum(repo.NOTE_TYPES).describe('idee, citation, note ou personnage'),
  text: z.string().describe('idee : intitulé court. citation : texte exact sans guillemets. note : la remarque. personnage : son nom.'),
  comment: z.string().optional().describe('idee : explication avec les mots de l’utilisateur. citation : pourquoi elle compte. personnage : qui il est.'),
  chapter: z.string().optional().describe('Chapitre ou partie du livre'),
  page: z.number().int().optional().describe('Numéro de page, seulement s’il est sûr'),
  verify: z.boolean().optional().describe('À vérifier dans le livre (citation ou page incertaine)'),
  themes: z.array(z.string()).optional().describe('Noms des thèmes transversaux. Remplace la liste existante.'),
};

const wordFields = {
  definition: z.string().optional(),
  etymology: z.string().optional(),
  example: z.string().optional().describe('La phrase où le mot a été rencontré'),
  my_sentence: z.string().optional().describe('Une phrase de l’utilisateur avec ce mot'),
  book_id: z.number().int().optional().describe('Livre où le mot a été rencontré'),
  page: z.number().int().optional(),
};
function wordInput(a: any) {
  const out: any = {};
  for (const [k, v] of Object.entries(a)) {
    if (v === undefined || k === 'word_id') continue;
    out[k === 'my_sentence' ? 'mySentence' : k === 'book_id' ? 'bookId' : k] = v;
  }
  return out;
}

const bookLine = (b: repo.Book) => {
  const bits = [repo.STATUS_LABEL[b.status], b.kind];
  if (b.status === 'en_cours' && b.pages) bits.push(`p. ${b.currentPage}/${b.pages}`);
  if (b.rating) bits.push(`${b.rating}/5`);
  const n = b.counts;
  bits.push(`${n.idee} idée(s), ${n.citation} citation(s), ${n.note} note(s), ${n.words} mot(s)`);
  if (b.status === 'lu' && !b.summary) bits.push('SANS RÉSUMÉ');
  return `« ${b.title} »${b.author ? ` — ${b.author}` : ''} (book_id=${b.id}) [${bits.join(' · ')}]`;
};
const noteLine = (n: repo.Note) => {
  const meta = [n.chapter, n.page ? `p. ${n.page}` : '', n.themes.length ? `thèmes : ${n.themes.map((t) => t.name).join(', ')}` : '', n.verify ? 'À VÉRIFIER' : '']
    .filter(Boolean).join(' · ');
  const body = n.type === 'citation' ? `« ${n.text} »` : n.text;
  return `- [${repo.NOTE_LABEL[n.type]} #${n.id}] ${body}${meta ? ` (${meta})` : ''}${n.comment ? `\n    → ${n.comment}` : ''}`;
};
const wordLine = (w: repo.Word, detail = true) => {
  const lines = [`${w.word} (word_id=${w.id})${w.bookTitle ? ` — vu dans « ${w.bookTitle} »${w.page ? `, p. ${w.page}` : ''}` : ''} : ${w.definition || '(pas de définition)'}`];
  if (detail) {
    if (w.etymology) lines.push(`    Étymologie : ${w.etymology}`);
    if (w.example) lines.push(`    Rencontré dans : « ${w.example} »`);
    if (w.mySentence) lines.push(`    Sa phrase : « ${w.mySentence} »`);
  }
  return lines.join('\n');
};

export function buildMcpServer() {
  const server = new McpServer({ name: 'bibliotheque', version: '1.0.0' }, { instructions: INSTRUCTIONS });
  const ro = { readOnlyHint: true };

  /* ----- lecture ----- */
  server.registerTool('list_books', {
    title: 'Lister les livres',
    description: 'Liste les livres de la bibliothèque avec leur statut et ce qui a été noté pour chacun. Filtrable par statut (a_lire = pile à lire et envies).',
    inputSchema: { status: z.enum(repo.STATUSES).optional() },
    annotations: ro,
  }, safe(({ status }) => {
    const books = repo.listBooks({ status });
    if (!books.length) return status ? `Aucun livre avec le statut ${status}.` : 'La bibliothèque est vide. Ajoute un livre avec add_book.';
    return books.map(bookLine).join('\n');
  }));

  server.registerTool('get_book', {
    title: 'Lire la fiche d’un livre',
    description: 'Renvoie la fiche complète d’un livre : métadonnées, résumé, avis, idées clés, citations, notes par chapitre, personnages et mots appris. À appeler avant d’ajouter quoi que ce soit à ce livre.',
    inputSchema: { book_id: z.number().int() },
    annotations: ro,
  }, safe(({ book_id }) => {
    const b = repo.getBook(book_id);
    const out = [bookLine(b)];
    if (b.subtitle) out.push(`Sous-titre : ${b.subtitle}`);
    const meta = [b.year && `paru en ${b.year}`, b.pages && `${b.pages} pages`, b.startedAt && `commencé le ${b.startedAt}`, b.finishedAt && `fini le ${b.finishedAt}`].filter(Boolean);
    if (meta.length) out.push(meta.join(' · '));
    if (b.recommendedBy) out.push(`Recommandé par : ${b.recommendedBy}`);
    if (b.whyRead) out.push(`Pourquoi le lire : ${b.whyRead}`);
    out.push(`\nRésumé : ${b.summary || '(vide)'}`);
    out.push(`Ce que ça a changé pour lui : ${b.impact || '(vide)'}`);
    out.push(`Désaccords avec l’auteur : ${b.disagreements || '(vide)'}`);
    for (const t of repo.NOTE_TYPES) {
      const notes = b.notes.filter((n) => n.type === t);
      if (notes.length) out.push(`\n${repo.NOTE_PLURAL[t]} :\n${notes.map(noteLine).join('\n')}`);
    }
    if (b.words.length) out.push(`\nMots appris dans ce livre :\n${b.words.map((w) => `- ${wordLine(w, false)}`).join('\n')}`);
    return out.join('\n');
  }));

  server.registerTool('search', {
    title: 'Rechercher',
    description: 'Recherche plein texte dans les livres, les notes (idées, citations…), les mots du dictionnaire et les thèmes.',
    inputSchema: { query: z.string() },
    annotations: ro,
  }, safe(({ query }) => {
    const r = repo.search(query);
    const out: string[] = [];
    for (const b of r.books) out.push(`Livre : ${bookLine(b)}`);
    for (const t of r.themes) out.push(`Thème : ${t.name} (theme_id=${t.id})`);
    for (const w of r.words) out.push(`Mot : ${wordLine(w, false)}`);
    for (const n of r.notes) out.push(`${noteLine(n).slice(2)} — dans « ${n.bookTitle} » (book_id=${n.bookId})`);
    return out.length ? out.join('\n') : 'Aucun résultat.';
  }));

  server.registerTool('lookup_book', {
    title: 'Chercher un livre en ligne',
    description: 'Cherche un livre par titre, auteur ou ISBN dans Open Library et renvoie auteur, année, nombre de pages, ISBN et couverture, à passer ensuite à add_book. Les données peuvent être incomplètes ou concerner une autre édition.',
    inputSchema: { query: z.string().describe('Titre (avec l’auteur si possible) ou ISBN') },
    annotations: { readOnlyHint: true, openWorldHint: true },
  }, safe(async ({ query }) => {
    const res = await lookupBooks(query);
    if (!res.length) return 'Aucun résultat sur Open Library. Ajoute le livre avec ce que tu sais de sûr.';
    return res.map((r, i) => `${i + 1}. « ${r.title} »${r.subtitle ? ` : ${r.subtitle}` : ''} — ${r.author || 'auteur inconnu'}`
      + `${r.year ? `, ${r.year}` : ''}${r.pages ? `, ${r.pages} p.` : ''}${r.isbn ? `, ISBN ${r.isbn}` : ''}${r.coverUrl ? `\n   cover_url : ${r.coverUrl}` : ''}`).join('\n');
  }));

  server.registerTool('list_words', {
    title: 'Lire le dictionnaire',
    description: 'Liste les mots du dictionnaire personnel, avec définition, étymologie et phrases. Filtrable par texte ou par livre.',
    inputSchema: { query: z.string().optional(), book_id: z.number().int().optional() },
    annotations: ro,
  }, safe(({ query, book_id }) => {
    const words = repo.listWords({ q: query, bookId: book_id });
    return words.length ? words.map((w) => wordLine(w)).join('\n') : 'Aucun mot.';
  }));

  server.registerTool('list_themes', {
    title: 'Lister les thèmes',
    description: 'Liste les thèmes transversaux et le nombre d’idées et de livres rattachés à chacun.',
    annotations: ro,
  }, safe(() => {
    const t = repo.listThemes();
    return t.length
      ? t.map((x) => `${x.name} (theme_id=${x.id}) — ${x.noteCount} note(s) dans ${x.bookCount} livre(s)${x.description ? ` — ${x.description}` : ''}`).join('\n')
      : 'Aucun thème pour le moment.';
  }));

  server.registerTool('get_theme', {
    title: 'Lire un thème',
    description: 'Renvoie toutes les idées et citations rattachées à un thème, regroupées par livre. Utile pour comparer ce que disent plusieurs auteurs.',
    inputSchema: { theme_id: z.number().int() },
    annotations: ro,
  }, safe(({ theme_id }) => {
    const t = repo.getTheme(theme_id);
    const out = [`Thème : ${t.name}${t.description ? ` — ${t.description}` : ''}`];
    let last = -1;
    for (const n of t.notes) {
      if (n.bookId !== last) { out.push(`\n« ${n.bookTitle} »${n.bookAuthor ? ` — ${n.bookAuthor}` : ''} (book_id=${n.bookId})`); last = n.bookId; }
      out.push(noteLine(n));
    }
    if (!t.notes.length) out.push('(aucune note rattachée)');
    return out.join('\n');
  }));

  server.registerTool('find_incomplete', {
    title: 'Trouver les fiches à compléter',
    description: 'Liste les livres lus sans résumé, sans idées clés ou sans avis, les mots sans définition ou sans phrase, et les notes marquées « à vérifier ». Propose à l’utilisateur de les compléter avec lui.',
    annotations: ro,
  }, safe(() => {
    const items = repo.incomplete();
    if (!items.length) return 'Tout est complet.';
    return items.map((i) => {
      const ref = i.kind === 'livre' ? `book_id=${i.id}` : i.kind === 'mot' ? `word_id=${i.id}` : `note_id=${i.id}, book_id=${i.bookId}`;
      return `[${i.kind}] ${i.label} (${ref}) — manque : ${i.missing.join(', ')}`;
    }).join('\n');
  }));

  server.registerTool('get_stats', {
    title: 'Statistiques de lecture',
    description: 'Livres et pages lus par année, objectif annuel, nombre d’idées, de citations et de mots.',
    annotations: ro,
  }, safe(() => {
    const s = repo.stats();
    const t = s.totals;
    return [
      `${s.year} : ${s.thisYear.books} livre(s) lu(s)${s.goal ? ` sur un objectif de ${s.goal}` : ''}, ${s.thisYear.pages} pages.`,
      `En tout : ${t.read} lus, ${t.reading} en cours, ${t.toRead} à lire ; ${t.pagesRead} pages lues.`,
      `${t.ideas} idées clés, ${t.quotes} citations, ${t.notes} notes, ${t.words} mots (${t.wordsMastered} maîtrisés), ${t.themes} thèmes.`,
      ...s.byYear.map((y) => `  ${y.year} : ${y.books} livre(s), ${y.pages} pages`),
    ].join('\n');
  }));

  server.registerTool('get_due_reviews', {
    title: 'Cartes à réviser',
    description: 'Renvoie les cartes dues en révision espacée (mots, idées clés, citations) avec question et réponse. Interroge l’utilisateur une carte à la fois sans lui montrer la réponse, puis enregistre le résultat avec record_review.',
    inputSchema: {
      kind: z.enum(['mot', 'idee', 'citation']).optional(),
      book_id: z.number().int().optional(),
      limit: z.number().int().min(1).max(50).optional().describe('Défaut : 10'),
    },
    annotations: ro,
  }, safe(({ kind, book_id, limit }) => {
    const cards = repo.dueCards({ kind, bookId: book_id, limit: limit ?? 10 });
    if (!cards.length) return 'Rien à réviser pour le moment.';
    return cards.map((c) => {
      const q = c.kind === 'mot' ? `Que veut dire « ${c.front} » ?`
        : c.kind === 'idee' ? `Dans « ${c.bookTitle} », explique l’idée : ${c.front}`
        : `D’où vient cette citation et qu’en retient-il ? « ${c.front} »`;
      return `[${c.kind} id=${c.id}${c.isNew ? ', jamais révisée' : `, boîte ${c.box}`}]\n  Question : ${q}\n  Réponse : ${c.back}${c.extra ? `\n  Complément : ${c.extra.replace(/\n/g, ' / ')}` : ''}`;
    }).join('\n\n');
  }));

  /* ----- écriture ----- */
  server.registerTool('add_book', {
    title: 'Ajouter un livre',
    description: 'Ajoute un livre à la bibliothèque : une envie ou un livre à lire (status a_lire, défaut), une lecture en cours, ou un livre déjà lu. Utilise lookup_book avant pour récupérer couverture et métadonnées.',
    inputSchema: { title: z.string(), ...bookFields },
  }, safe((a) => {
    const dup = repo.findBookByTitle(a.title);
    if (dup) return `Ce livre existe déjà : ${bookLine(dup)}. Utilise update_book pour le modifier.`;
    return `Livre ajouté : ${bookLine(repo.createBook(bookInput(a)))}`;
  }));

  server.registerTool('update_book', {
    title: 'Modifier un livre',
    description: 'Modifie la fiche d’un livre : statut (commencé, terminé…), page en cours, résumé, avis, désaccords, note sur 5, etc. Seuls les champs fournis changent. Passer status à "lu" date la fin de lecture à aujourd’hui si elle est vide.',
    inputSchema: { book_id: z.number().int(), title: z.string().optional(), ...bookFields },
  }, safe((a) => `Livre mis à jour : ${bookLine(repo.updateBook(a.book_id, bookInput(a)))}`));

  server.registerTool('delete_book', {
    title: 'Supprimer un livre',
    description: 'Supprime un livre et toutes ses notes (ses mots restent dans le dictionnaire). Seulement à la demande explicite de l’utilisateur.',
    inputSchema: { book_id: z.number().int() },
    annotations: { destructiveHint: true },
  }, safe(({ book_id }) => {
    const b = repo.getBookRow(book_id);
    repo.deleteBook(book_id);
    return `Livre supprimé : « ${b.title} ».`;
  }));

  server.registerTool('add_notes', {
    title: 'Ajouter des notes à un livre',
    description: 'Ajoute en un appel plusieurs idées clés, citations, notes ou personnages à un livre. C’est l’outil principal pour enregistrer ce que l’utilisateur a retenu.',
    inputSchema: { book_id: z.number().int(), notes: z.array(z.object(noteFields)).min(1).max(60) },
  }, safe(({ book_id, notes }) => {
    const created = repo.createNotes(book_id, notes);
    return `${created.length} note(s) ajoutée(s) à « ${created[0].bookTitle} » :\n${created.map(noteLine).join('\n')}`;
  }));

  server.registerTool('update_note', {
    title: 'Modifier une note',
    description: 'Modifie une idée, citation, note ou personnage. Seuls les champs fournis changent.',
    inputSchema: {
      note_id: z.number().int(),
      type: noteFields.type.optional(), text: z.string().optional(), comment: noteFields.comment,
      chapter: noteFields.chapter, page: noteFields.page, verify: noteFields.verify, themes: noteFields.themes,
    },
  }, safe(({ note_id, ...patch }) => `Note mise à jour :\n${noteLine(repo.updateNote(note_id, patch))}`));

  server.registerTool('delete_note', {
    title: 'Supprimer une note',
    description: 'Supprime une note. Seulement à la demande explicite de l’utilisateur.',
    inputSchema: { note_id: z.number().int() },
    annotations: { destructiveHint: true },
  }, safe(({ note_id }) => { repo.deleteNote(note_id); return 'Note supprimée.'; }));

  server.registerTool('add_words', {
    title: 'Ajouter des mots au dictionnaire',
    description: 'Ajoute un ou plusieurs mots au dictionnaire personnel. Les mots déjà présents sont signalés et non dupliqués.',
    inputSchema: { words: z.array(z.object({ word: z.string(), ...wordFields })).min(1).max(60) },
  }, safe(({ words }) => {
    const out: string[] = [];
    for (const w of words) {
      const ex = repo.findWord(w.word);
      if (ex) { out.push(`Déjà présent : ${wordLine(ex, false)}`); continue; }
      out.push(`Ajouté : ${wordLine(repo.createWord(wordInput(w)), false)}`);
    }
    return out.join('\n');
  }));

  server.registerTool('update_word', {
    title: 'Modifier un mot',
    description: 'Modifie ou complète un mot du dictionnaire. Seuls les champs fournis changent.',
    inputSchema: { word_id: z.number().int(), word: z.string().optional(), ...wordFields },
  }, safe((a) => `Mot mis à jour :\n${wordLine(repo.updateWord(a.word_id, wordInput(a)))}`));

  server.registerTool('delete_word', {
    title: 'Supprimer un mot',
    description: 'Supprime un mot du dictionnaire. Seulement à la demande explicite de l’utilisateur.',
    inputSchema: { word_id: z.number().int() },
    annotations: { destructiveHint: true },
  }, safe(({ word_id }) => { repo.deleteWord(word_id); return 'Mot supprimé.'; }));

  server.registerTool('create_theme', {
    title: 'Créer un thème',
    description: 'Crée un thème transversal avec une description. (Un thème se crée aussi tout seul quand on le cite dans les themes d’une note.)',
    inputSchema: { name: z.string(), description: z.string().optional() },
  }, safe((a) => {
    const t = repo.createTheme(a);
    return `Thème créé : ${t.name} (theme_id=${t.id})`;
  }));

  server.registerTool('record_review', {
    title: 'Enregistrer une révision',
    description: 'Enregistre le résultat d’une carte révisée avec l’utilisateur : grade 0 = raté (revient tout de suite), 1 = hésitant (revient demain), 2 = su (intervalle allongé).',
    inputSchema: {
      kind: z.enum(['mot', 'idee', 'citation']),
      id: z.number().int(),
      grade: z.number().int().min(0).max(2),
    },
  }, safe(({ kind, id, grade }) => {
    const r = repo.gradeCard(kind, id, grade);
    return `Enregistré. Prochaine révision le ${r.dueAt.slice(0, 10)} (boîte ${r.box}).`;
  }));

  return server;
}
