# PropDesk

Tableau de bord de trading personnel : journal d'exécution, portefeuille,
analyse de rentabilité, calendrier macro, setups, plan de trading et suivi de
mindset. Application **mono-utilisateur** — chaque déploiement n'a qu'un seul
compte, avec ses propres données isolées. Aucune IA n'est utilisée nulle part
dans l'application.

> **⚠️ Usage personnel uniquement — voir [LICENSE](LICENSE).** Vous pouvez
> librement cloner, déployer et modifier ce code pour votre propre usage
> personnel (votre propre plateforme de trading, sur votre propre
> hébergeur). **Toute exploitation commerciale est interdite** : vendre ce
> code, faire payer l'accès à une instance qui en découle, ou l'utiliser
> comme base pour vendre un produit en le présentant comme votre propre
> création. Voir [LICENSE](LICENSE) pour les conditions complètes.

## Démarrage en local

Prérequis : [Node.js](https://nodejs.org) 20+ et npm.

```bash
git clone https://github.com/Forexpaps/propdesk-template.git
cd propdesk-template
npm install
```

Créer un `.env` à la racine (voir [.env.example](.env.example)) — un fichier
vide suffit, toutes les variables ont un défaut utilisable.

```bash
npm run dev     # http://localhost:3000
npm run lint    # vérification TypeScript (strict)
npm run build   # bundle client + serveur dans dist/
npm start       # sert le build de production
```

Au premier accès à `http://localhost:3000`, l'application affiche un écran
d'installation : choisissez votre adresse e-mail et votre mot de passe (10
caractères minimum), c'est le seul compte de cette instance.

## Déployer pour un usage personnel

Chaque personne qui veut utiliser PropDesk pour elle-même doit déployer **sa
propre instance**, avec sa propre base de données — il n'y a pas de mode
multi-comptes partagé dans une même instance. Usage personnel uniquement,
voir [LICENSE](LICENSE) : la revente du code ou d'un produit basé dessus
n'est pas autorisée.

### 1. Récupérer le code

Cloner ce dépôt, ou cliquer sur **"Use this template"** sur sa page GitHub
pour créer sa propre copie.

### 2. Déployer (Railway, recommandé)

Railway convient bien ici car il fournit un disque persistant (nécessaire
pour la base SQLite) :

1. Créer un compte sur [railway.app](https://railway.app) et un nouveau
   projet "Deploy from GitHub repo", en pointant vers votre copie du dépôt.
2. Ajouter un volume persistant monté sur `/data` (Railway → onglet
   "Volumes"), et définir la variable d'environnement `DATA_DIR=/data`.
3. Railway détecte `npm run build` / `npm start` automatiquement. Sinon,
   définir manuellement :
   - Build command : `npm run build`
   - Start command : `npm start`
4. Une fois déployé, ouvrir l'URL fournie : le premier accès affiche l'écran
   d'installation pour créer votre compte.

### 3. Déployer (Vercel)

Vercel fonctionne aussi, à condition de ne **pas** compter sur un disque
persistant classique (le système de fichiers y est éphémère) :

1. Importer le dépôt sur [vercel.com](https://vercel.com).
2. Remplacer le stockage SQLite par une base externe persistante (ex.
   [Turso](https://turso.tech) ou Postgres géré) — voir la note dans
   `server/repositories.ts` : seul ce fichier est à adapter, les routes n'y
   touchent pas.
3. Définir les variables d'environnement nécessaires dans les réglages du
   projet Vercel.

Sans cette adaptation, les données créées sur Vercel seraient perdues à
chaque redéploiement.

### Variables d'environnement utiles

| Variable | Rôle | Défaut |
|---|---|---|
| `PORT` | Port d'écoute du serveur | `3000` |
| `DATA_DIR` | Dossier de la base SQLite | `./data` |

Voir [.env.example](.env.example) pour la liste complète.

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
  components/          vues d'onglets et modales (journal, portefeuille,
                       rentabilité, macro, setups, plan de trading, mindset...)
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
| POST | `/api/auth/change-password` | remplace son propre mot de passe |
| GET | `/api/state` | état complet de démarrage |
| PUT | `/api/collections/:name` | remplace une collection |
| PUT | `/api/profile` | profil |
| POST | `/api/state/seed` | amorce avec le jeu de démonstration |
| POST | `/api/state/import` | reprend un état venu de `localStorage` |

Toutes les routes exigent une session valide, **sauf** `/api/health`,
`/api/auth/me`, `/api/auth/setup`, `/api/auth/login` et `/api/auth/logout`.
Toutes les entrées sont validées (zod).

Limitations de débit par IP : `/api/auth/login` 10 par quart d'heure,
`/api/auth/setup` 5 par quart d'heure.

## Authentification

Cette application est pensée pour un déploiement **mono-utilisateur** : chaque
instance (votre propre Vercel/Railway, votre propre base) n'accueille qu'un
seul compte, celui créé à l'installation. Il n'y a pas de rôles ni de comptes
secondaires — le compte connecté a systématiquement tous les droits sur ses
propres données.

Au premier démarrage, l'application détecte qu'aucun compte n'existe et
affiche un écran d'installation : vous y choisissez une adresse et un mot de
passe (10 caractères minimum). **Les données déjà présentes sont
conservées.**

Les mots de passe sont hachés avec `scrypt` (`node:crypto`, aucune dépendance
ajoutée), sel aléatoire, comparaison à temps constant. Les sessions sont des
jetons de 256 bits portés par un cookie `HttpOnly`, valables 30 jours et
prolongés à l'usage. Plusieurs appareils peuvent rester connectés en
parallèle ; se déconnecter ne ferme que la session courante.

### Mot de passe oublié

Il n'y a pas de récupération par e-mail. La seule issue est de supprimer
directement les identifiants en base, ce qui ramène l'écran d'installation au
prochain chargement :

```bash
sqlite3 data/horizon.db "delete from staff_accounts; delete from sessions;"
```

Vos données ne sont pas touchées : seuls les comptes sont à recréer.

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

## Licence

Usage personnel non commercial — voir [LICENSE](LICENSE). Vous pouvez
librement copier, déployer et modifier ce code pour votre propre usage
personnel. La vente du code, la vente d'accès à une instance qui en découle,
ou son usage comme base pour vendre un produit en le présentant comme votre
propre création sont interdits sans autorisation écrite de Thomas Gauthey.
