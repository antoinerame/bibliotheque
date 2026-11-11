# Bibliothèque

Mes livres rangés sur des étagères, ce que j'en ai retenu, et le dictionnaire des mots que j'ai appris. Claude peut tout lire et tout compléter grâce à un serveur MCP intégré.

## Ce qu'il y a dedans

- **Étagères** : table de chevet (lectures en cours avec l'avancement), tous les livres lus sur une même étagère, séparés par année, pile à lire, abandonnés. Dos d'épaisseur proportionnelle au nombre de pages. Filtres par genre, année, note et texte ; rangement par date, auteur ou titre.
- **Ajout rapide** : tape un titre ou un ISBN, l'auteur, l'année, le nombre de pages et la couverture sont récupérés sur Open Library. Saisie à la main possible.
- **Fiche d'un livre** : résumé en trois phrases, ce que ça change pour moi, mes désaccords, idées clés, citations avec page, notes par chapitre, personnages (romans), mots appris, note sur 5, dates de lecture, qui l'a recommandé et pourquoi.
- **Dictionnaire** : définition, étymologie, la phrase où le mot a été rencontré (livre et page), une phrase à moi. Parcours alphabétique, recherche, filtre par livre.
- **Réviser** : répétition espacée sur les mots, les idées clés et les citations. Ce qui est raté revient plus vite.
- **Remontée du jour** : chaque jour, l'accueil ressort une idée ou une citation.
- **Thèmes** : un thème relie les idées et citations de plusieurs livres, pour comparer les auteurs.
- **À compléter** : livres lus sans résumé, sans idées ou sans avis, mots sans définition, citations à vérifier.
- **Noter** : capture rapide pensée pour le téléphone, pendant la lecture.
- **Statistiques** : livres et pages par année, objectif annuel.
- **Recherche globale** (Ctrl K), **export / import JSON**, thème clair et sombre.
- **MCP** : Claude ajoute livres, envies de lecture, résumés, notes et mots ; le site se met à jour en direct.

## Brancher Claude

Le point d'accès MCP est `https://ton-domaine/mcp` (Streamable HTTP). Deux façons de s'authentifier :

- en-tête `Authorization: Bearer <MCP_TOKEN>` ;
- ou jeton dans l'adresse : `https://ton-domaine/mcp/<MCP_TOKEN>`.

**claude.ai, appli bureau et mobile** : Réglages → Connecteurs → Ajouter un connecteur personnalisé, avec l'adresse `https://ton-domaine/mcp/<MCP_TOKEN>`.

**Claude Code** :

```bash
claude mcp add --transport http bibliotheque https://ton-domaine/mcp --header "Authorization: Bearer <MCP_TOKEN>"
```

Ensuite, en discussion :

- « Ajoute *La Condition de l'homme moderne* à ma pile à lire, c'est Paul qui me l'a conseillé. »
- « Je viens de finir *Sapiens*. Interroge-moi sur ce que j'en ai retenu, puis enregistre ma fiche. »
- (avec une photo de page) « Garde cette citation dans le livre que je lis en ce moment. »
- « Ajoute "palimpseste" à mon dictionnaire, je l'ai croisé page 112. »
- « Qu'est-ce qui manque dans mes fiches ? » ou « Fais-moi réviser dix cartes. »

Outils exposés : `list_books`, `get_book`, `search`, `lookup_book`, `list_words`, `list_themes`, `get_theme`, `find_incomplete`, `get_stats`, `get_due_reviews`, `add_book`, `update_book`, `delete_book`, `add_notes`, `update_note`, `delete_note`, `add_words`, `update_word`, `delete_word`, `create_theme`, `record_review`.

Règle donnée à Claude : ne jamais inventer une citation ni un numéro de page. En cas de doute, la note est marquée « à vérifier ».

## Installation sur un serveur (Docker)

```bash
cp .env.example .env
```

Remplis `APP_PASSWORD` (mot de passe du site) et `MCP_TOKEN` (jeton pour Claude, par exemple le résultat de `openssl rand -hex 32`), puis :

```bash
docker compose up -d --build
```

Le site écoute sur le port 3100 (modifiable avec `PORT` dans `.env`). Les données vivent dans le volume Docker `bibliotheque-data` (un fichier SQLite).

Place-le derrière ton reverse proxy habituel **en HTTPS** : le mot de passe et le jeton circulent dans les requêtes. Avec nginx, désactive la mise en tampon pour `/api/events` et `/mcp` (`proxy_buffering off;`).

## Développement local

```bash
npm install
```

```bash
npm run dev
```

L'interface est sur http://localhost:5273 (Vite), l'API et le MCP sur http://localhost:3100. Sans `APP_PASSWORD` ni `MCP_TOKEN`, tout est ouvert : à réserver au poste local.

Structure : `server/` (Express, SQLite via `node:sqlite`, MCP), `web/` (React + Vite). Le design « Épure » vit dans `web/src/designs/epure/` (`theme.css` pour le style, `Shelf.tsx` pour les étagères et les couvertures).

## Vie privée

Le seul appel sortant du serveur est la recherche d'un livre sur Open Library (le texte tapé dans « Ajouter un livre » ou passé à `lookup_book`). Les couvertures sont chargées par le navigateur depuis `covers.openlibrary.org`.

## Sauvegarde

Réglages → Exporter tout produit un fichier JSON complet, réimportable (en ajout ou en remplacement). Tu peux aussi sauvegarder directement le volume `bibliotheque-data`.
