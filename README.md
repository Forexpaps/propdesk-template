# Académie de Trading Horizon — PropDesk

Plateforme d'académie de trading SMC : modules vidéo, journal d'exécution,
suivi de comptes prop firm, forum, messagerie coach et audits assistés par IA.

## Démarrage

```bash
npm install
```

Créer un `.env` à la racine (voir [.env.example](.env.example)) :

```
GEMINI_API_KEY=votre_clé
```

La clé n'est lue que côté serveur ; elle n'est jamais exposée au navigateur.
Sans elle, l'application fonctionne — seules les fonctions d'audit IA renvoient
une erreur explicite.

```bash
npm run dev     # http://localhost:3000
npm run lint    # vérification TypeScript (strict)
npm run build   # bundle client + serveur dans dist/
npm start       # sert le build de production
```

## Architecture

Un serveur Express unique sert l'API **et** l'application : en développement il
monte Vite en middleware, en production il sert `dist/`. Il n'y a donc qu'un
seul port et aucun proxy à configurer.

```
server.ts              point d'entrée : Express + Vite/statique
server/
  db.ts                connexion SQLite et schéma
  repositories.ts      accès aux données (seul module qui parle à SQLite)
  routes.ts            routes /api/*
  schemas.ts           validation zod des entrées
  seed.ts              amorçage et import d'un état complet
src/
  App.tsx              état applicatif et câblage de toutes les vues
  types.ts             source de vérité des formes de données
  data/mockData.ts     jeu de données d'amorçage
  hooks/               persistance locale et synchronisation serveur
  lib/api.ts           client typé de l'API
  components/          10 vues d'onglets + 9 modales
```

### Navigation

Pas de routeur : `App.tsx` tient un `activeTab` (union `TabType` définie dans
`components/Sidebar.tsx`) et rend la vue correspondante. Il n'y a donc pas
d'URL par écran ni de bouton retour navigateur.

### Persistance

Le serveur est la source de vérité. Au démarrage, le client appelle
`GET /api/state` et reçoit toutes les collections en un aller-retour.

Chaque modification met l'interface à jour immédiatement, puis est envoyée au
serveur après un court délai de regroupement, et recopiée dans `localStorage`.
Si le serveur est injoignable, l'application démarre sur ce cache local et
reste utilisable.

Au tout premier lancement sur une base vide, les données présentes dans
`localStorage` (version antérieure de l'application, qui n'avait pas de
serveur) sont importées automatiquement. À défaut, la base est amorcée avec
`src/data/mockData.ts`.

La base vit dans `DATA_DIR` (`./data` par défaut), hors du dépôt.

> Sur un hébergement à disque éphémère (Cloud Run par exemple), monter un
> volume persistant sur `DATA_DIR`, ou remplacer SQLite par Postgres. Seul
> `server/repositories.ts` est à réécrire : les routes n'y touchent pas.

### API

| Méthode | Route | Rôle |
|---|---|---|
| GET | `/api/health` | sonde de vie |
| GET | `/api/auth/me` | état d'authentification (répond toujours 200) |
| POST | `/api/auth/setup` | première installation, refusée si un compte existe |
| POST | `/api/auth/login` | connexion |
| POST | `/api/auth/logout` | déconnexion |
| GET | `/api/state` | état complet de démarrage |
| PUT | `/api/collections/:name` | remplace une collection |
| PUT | `/api/profile` | profil de l'élève |
| PUT | `/api/quiz-results` | résultats de quiz |
| POST | `/api/state/seed` | amorce avec le jeu de démonstration |
| POST | `/api/state/import` | reprend un état venu de `localStorage` |
| POST | `/api/coach/ai-review` | audit IA d'un trade ou réponse à une question |
| GET | `/api/download-features-pdf` | catalogue PDF des fonctionnalités |

Toutes les routes exigent une session valide, **sauf** `/api/health` et les
quatre routes `/api/auth/*`. Toutes les entrées sont validées (zod).

Trois limitations de débit par IP : `/api/coach/ai-review` 10 par minute (seule
route facturée à l'appel), `/api/auth/login` 10 par quart d'heure, et
`/api/auth/setup` 5 par quart d'heure.

Le PDF est généré hors ligne par `node scripts/generate_pdf.js`.

## Authentification

Un seul compte, protégé par mot de passe.

Au premier démarrage, l'application détecte qu'aucun identifiant n'existe et
affiche un écran d'installation : vous y choisissez une adresse et un mot de
passe (10 caractères minimum). **Les données déjà présentes sont conservées.**

Les mots de passe sont hachés avec `scrypt` (`node:crypto`, aucune dépendance
ajoutée), sel aléatoire par compte, comparaison à temps constant. Les sessions
sont des jetons de 256 bits portés par un cookie `HttpOnly`, valables 30 jours
et prolongés à l'usage. Plusieurs appareils peuvent rester connectés en
parallèle ; se déconnecter ne ferme que la session courante.

### Mot de passe oublié

Il n'y a pas de récupération par e-mail. La seule issue est de supprimer les
identifiants, ce qui ramène l'écran d'installation au prochain chargement :

```bash
sqlite3 data/horizon.db "delete from user_credentials; delete from sessions;"
```

Vos données ne sont pas touchées : seul le mot de passe est à redéfinir.

## Limites connues

- **Le verrou ne protège pas les données déjà en cache.** Si le serveur est
  injoignable, l'application démarre sur le cache `localStorage` sans écran de
  connexion — aucune vérification n'est possible sans serveur. C'est un choix
  assumé : il préserve le filet anti-perte de données. Le cache est effacé à la
  déconnexion volontaire, mais quelqu'un ayant accès physique à la machine et
  coupant le serveur verrait les données. Ce n'est donc pas une protection
  contre un tiers présent devant l'écran.
- **Un seul compte.** Chaque ligne porte déjà un `user_id` et l'unicité des
  emails est en place, donc l'ajout de comptes multiples sera additif — mais le
  cloisonnement des données par utilisateur reste à faire.
- **Les modifications faites hors ligne ne sont pas rejouées** à la reconnexion.
  Elles restent dans le cache local, mais le rechargement suivant reprend l'état
  du serveur.
- **Aucun test automatisé** : le projet n'a pas encore de runner.
