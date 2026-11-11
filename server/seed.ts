import * as repo from './repo.ts';

/** Quelques livres d'exemple au premier lancement (SEED_DEMO=0 pour démarrer vide). */
export function seedIfEmpty() {
  if (process.env.SEED_DEMO === '0' || !repo.isEmpty()) return;

  const y = new Date().getFullYear();
  const add = (b: any) => repo.createBook(b).id;

  const sisyphe = add({
    title: 'Le Mythe de Sisyphe', author: 'Albert Camus', year: 1942, pages: 187, kind: 'essai', status: 'lu',
    rating: 5, startedAt: `${y}-01-08`, finishedAt: `${y}-01-21`,
    summary: 'Camus part du sentiment de l’absurde : l’homme réclame du sens, le monde ne répond pas. Il refuse à la fois le suicide et la fuite dans la croyance. Reste la révolte : vivre pleinement, lucidement, sans espoir de consolation.',
    impact: 'Fiche d’exemple : remplace ce texte par ce que le livre a changé pour toi.',
  });
  repo.createNotes(sisyphe, [
    { type: 'idee', text: 'L’absurde naît d’une confrontation', comment: 'Ni l’homme ni le monde ne sont absurdes seuls : c’est la rencontre entre notre besoin de sens et le silence du monde qui l’est.', themes: ['Sens de la vie'] },
    { type: 'idee', text: 'Le « suicide philosophique »', comment: 'Se réfugier dans une croyance qui donne un sens tout fait, c’est esquiver le problème au lieu de le regarder en face.', themes: ['Sens de la vie'] },
    { type: 'citation', text: 'Il faut imaginer Sisyphe heureux.', comment: 'Dernière phrase du livre : le bonheur vient de la lutte elle-même, pas de son résultat.', themes: ['Sens de la vie'] },
  ]);

  const prince = add({
    title: 'Le Petit Prince', author: 'Antoine de Saint-Exupéry', year: 1943, pages: 96, kind: 'roman', status: 'lu',
    rating: 4, finishedAt: `${y - 1}-11-02`,
    summary: 'Un aviateur en panne dans le désert rencontre un enfant venu d’une autre planète. À travers ses voyages, le petit prince regarde les adultes et leurs obsessions avec étonnement. Le livre parle d’attachement, de responsabilité et de ce qui compte vraiment.',
  });
  repo.createNotes(prince, [
    { type: 'citation', text: 'On ne voit bien qu’avec le cœur. L’essentiel est invisible pour les yeux.', comment: 'Le secret que le renard confie au petit prince.', themes: ['Sens de la vie'] },
    { type: 'personnage', text: 'Le renard', comment: 'Il apprend au petit prince ce que veut dire « apprivoiser » : créer des liens.' },
    { type: 'personnage', text: 'La rose', comment: 'Orgueilleuse et fragile ; c’est le temps passé pour elle qui la rend unique.' },
  ]);

  const kahneman = add({
    title: 'Système 1 / Système 2', subtitle: 'Les deux vitesses de la pensée', author: 'Daniel Kahneman',
    year: 2011, pages: 560, kind: 'essai', status: 'en_cours', currentPage: 212, startedAt: `${y}-02-03`,
    recommendedBy: 'Exemple', whyRead: 'Comprendre les biais qui faussent mes jugements.',
  });
  repo.createNotes(kahneman, [
    { type: 'idee', text: 'Deux systèmes de pensée', comment: 'Le Système 1 est rapide, intuitif et automatique ; le Système 2 est lent, délibéré et coûteux en effort. On croit décider avec le second alors que le premier fait l’essentiel du travail.', chapter: 'Première partie', themes: ['Biais cognitifs'] },
    { type: 'idee', text: 'Ancrage', comment: 'Un chiffre vu juste avant une estimation la tire vers lui, même s’il n’a aucun rapport.', chapter: 'Deuxième partie', themes: ['Biais cognitifs'] },
    { type: 'note', text: 'Penser à relier le biais de disponibilité aux débats sur l’insécurité.', chapter: 'Deuxième partie' },
  ]);

  add({ title: 'Sapiens', subtitle: 'Une brève histoire de l’humanité', author: 'Yuval Noah Harari', year: 2011, pages: 512, kind: 'essai', status: 'lu', rating: 4, finishedAt: `${y - 1}-06-14` });
  add({ title: 'L’Étranger', author: 'Albert Camus', year: 1942, pages: 184, kind: 'roman', status: 'lu', rating: 5, finishedAt: `${y - 1}-03-09` });
  add({ title: '1984', author: 'George Orwell', year: 1949, pages: 400, kind: 'roman', status: 'lu', rating: 5, finishedAt: `${y - 2}-08-20` });
  add({ title: 'Mémoires d’Hadrien', author: 'Marguerite Yourcenar', year: 1951, pages: 364, kind: 'roman', status: 'lu', rating: 4, finishedAt: `${y - 2}-12-01` });
  add({ title: 'La Peste', author: 'Albert Camus', year: 1947, pages: 336, kind: 'roman', status: 'lu', rating: 4, finishedAt: `${y}-03-02` });
  add({ title: 'Germinal', author: 'Émile Zola', year: 1885, pages: 592, kind: 'roman', status: 'abandonne', currentPage: 140 });
  add({ title: 'Les Misérables', author: 'Victor Hugo', year: 1862, pages: 1500, kind: 'roman', status: 'a_lire', whyRead: 'Le grand classique que je repousse depuis trop longtemps.' });
  add({ title: 'De la démocratie en Amérique', author: 'Alexis de Tocqueville', year: 1835, pages: 630, kind: 'essai', status: 'a_lire', recommendedBy: 'Exemple', whyRead: 'Pour la notion de tyrannie de la majorité.' });
  add({ title: 'Le Capital au XXIe siècle', author: 'Thomas Piketty', year: 2013, pages: 976, kind: 'essai', status: 'a_lire' });

  repo.createWord({ word: 'Palimpseste', definition: 'Manuscrit dont on a effacé le premier texte pour en écrire un nouveau ; par extension, œuvre qui laisse deviner des couches plus anciennes.', etymology: 'Du grec palin (de nouveau) et psêstos (gratté).', mySentence: 'Cette ville est un palimpseste : chaque époque a écrit par-dessus la précédente.' });
  repo.createWord({ word: 'Apophtegme', definition: 'Parole mémorable, brève et frappante, attribuée à un personnage illustre.', etymology: 'Du grec apophthegma, « sentence ».' });
  repo.createWord({ word: 'Heuristique', definition: 'Raccourci mental qui permet de juger vite, au prix d’erreurs prévisibles.', bookId: kahneman, mySentence: 'Juger un candidat à sa poignée de main est une heuristique, pas une analyse.' });
  repo.createWord({ word: 'Absurde', definition: 'Chez Camus : le divorce entre l’appel humain au sens et le silence du monde.', bookId: sisyphe });

  repo.setSettings({ yearlyGoal: 12 });
}
