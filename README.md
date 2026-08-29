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

Fonctionne à l'identique sur **macOS et Windows** — aucune commande ni
script propre à un système d'exploitation.

Prérequis : [Node.js](https://nodejs.org) 20+ et npm (sur Windows,
l'installeur officiel les fournit tous les deux).

```bash
git clone https://github.com/Forexpaps/propdesk-template.git
cd propdesk-template
npm install
```

Sur Windows, ces commandes fonctionnent aussi bien dans **PowerShell**,
**l'invite de commandes (cmd)** que dans un terminal Git Bash — aucun
terminal Unix n'est requis.

Créer un `.env` à la racine (voir [.env.example](.env.example)) — un fichier
vide suffit, toutes les variables ont un défaut utilisable.

```bash
npm run dev     # http://localhost:3000
npm run lint    # vérification TypeScript (strict)
npm run build   # bundle client + serveur dans dist/
npm start       # sert le build de production
```

Au premier accès à `http://localhost:3000`, l'application affiche un écran
d'installation : choisissez uniquement votre mot de passe (10 caractères
minimum) — pas d'adresse e-mail, pas de nom, pas de photo. Le profil part
vide, à compléter plus tard si vous le souhaitez depuis Profil & Options.

## Déployer pour un usage personnel

Chaque personne qui veut utiliser PropDesk pour elle-même doit déployer **sa
propre instance**, avec sa propre base de données — il n'y a pas de mode
multi-comptes partagé dans une même instance. Usage personnel uniquement,
voir [LICENSE](LICENSE) : la revente du code ou d'un produit basé dessus
n'est pas autorisée.

### 1. Récupérer le code

Cloner ce dépôt, ou cliquer sur **"Use this template"** sur sa page GitHub
pour créer sa propre copie.

### 2. Choisir un hébergeur

L'application tourne sur **n'importe quel hébergeur Node.js** (`npm run
build && npm start`) — un seul critère détermine s'il faut une étape
supplémentaire : **son système de fichiers est-il persistant ?**

- **Oui** (Railway, Render, Fly.io, un VPS, un Docker avec volume monté, une
  machine perso...) → rien à faire, l'application fonctionne directement
  avec sa base SQLite embarquée.
- **Non** (fonctions serverless : Vercel, Netlify, AWS Lambda...) → il faut
  une base accessible en réseau (Postgres ou Turso), voir plus bas.

#### Option A — Railway (recommandé, le plus simple)

Railway a un disque persistant ET une base Postgres en un clic — l'un ou
l'autre fonctionne, au choix.

1. Créer un compte sur [railway.app](https://railway.app), puis **New
   Project → Deploy from GitHub repo**, et choisir votre copie du dépôt.
2. Railway détecte `npm run build`/`npm start` automatiquement (sinon, les
   définir dans Settings → Deploy).
3. Choisir l'une des deux façons de stocker les données :
   - **Le plus simple : rien configurer.** Railway donne un disque
     persistant par défaut au service, la base SQLite embarquée (dans
     `./data`) survit donc aux redémarrages sans rien ajouter.
   - **Ou, si vous préférez une vraie base Postgres gérée** : dans le
     projet Railway, cliquer **+ New → Database → Add PostgreSQL**. Railway
     crée la base et l'attache automatiquement à votre service (variable
     `DATABASE_URL`, visible dans l'onglet **Variables** du service). Il
     suffit alors d'ajouter, dans les variables du service applicatif (pas
     de la base), une variable `POSTGRES_URL` avec la même valeur que
     `DATABASE_URL` (copier-coller, ou une référence Railway
     `${{Postgres.DATABASE_URL}}`) — c'est le nom que `server/db.ts`
     recherche.
4. Une fois déployé, ouvrir l'URL fournie par Railway (onglet
   **Settings → Networking → Generate Domain** si aucune n'est encore
   visible) : le premier accès affiche l'écran d'installation.

#### Option B — un autre hébergeur à disque persistant (Render, Fly.io, VPS...)

1. Créer le service, en pointant vers votre copie du dépôt (build :
   `npm run build`, démarrage : `npm start`).
2. Si l'hébergeur le permet, monter un volume persistant et y faire pointer
   `DATA_DIR` (ex. `DATA_DIR=/data`) — sinon la base par défaut (`./data`)
   suffit tant que le disque du service lui-même survit aux redémarrages.
3. Ouvrir l'URL fournie : le premier accès affiche l'écran d'installation.

#### Option C — un hébergeur serverless (Vercel, Netlify...) : il faut une base externe

**Aucune adaptation de code nécessaire** — `server/db.ts` détecte
automatiquement la base disponible via l'une de ces deux variables
d'environnement :

- **`POSTGRES_URL`** — une base Postgres, **n'importe quel fournisseur** :
  - Postgres natif de l'hébergeur si disponible (ex. onglet **Storage** →
    **Create Database → Postgres** sur Vercel : la base est créée et
    `POSTGRES_URL` définie automatiquement, rien à copier) ;
  - ou un service Postgres géré indépendant si l'hébergeur n'en propose
    pas — par exemple [neon.com](https://neon.com) (offre gratuite) :
    créer un compte, un projet, puis copier la « Connection string »
    fournie dans la variable `POSTGRES_URL` du projet.
- **`TURSO_DATABASE_URL`** + **`TURSO_AUTH_TOKEN`** — alternative
  SQLite-compatible via [Turso](https://turso.tech) (offre gratuite) :
  ```bash
  curl -sSfL https://get.tur.so/install.sh | bash
  turso auth login
  turso db create propdesk
  turso db show propdesk --url          # → TURSO_DATABASE_URL
  turso db tokens create propdesk        # → TURSO_AUTH_TOKEN
  ```

Définir l'une des deux dans les variables d'environnement du projet, puis
déployer/redéployer — le premier accès à l'URL fournie affiche l'écran
d'installation.

Sans aucune des deux, l'application bascule sur un fichier SQLite local —
inutilisable sur ce type d'hébergeur (d'où l'écran « Serveur injoignable »
si vous déployez sans configurer l'une d'elles), mais c'est exactement ce
qui permet à `npm run dev` de fonctionner en local sans aucun compte
externe.

### Variables d'environnement utiles

| Variable | Rôle | Défaut |
|---|---|---|
| `PORT` | Port d'écoute du serveur | `3000` |
| `DATA_DIR` | Dossier de la base SQLite locale (ignoré si `POSTGRES_URL` ou `TURSO_DATABASE_URL` est défini) | `./data` |
| `POSTGRES_URL` | URL d'une base Postgres, tout fournisseur | absent = mode fichier local |
| `TURSO_DATABASE_URL` | URL de la base Turso distante, si utilisée à la place de Postgres | absent = mode fichier local |
| `TURSO_AUTH_TOKEN` | Jeton d'authentification Turso | absent = mode fichier local |

Ordre de priorité si plusieurs sont définies : `POSTGRES_URL` d'abord, puis
`TURSO_DATABASE_URL`, sinon fichier local.

Voir [.env.example](.env.example) pour la liste complète.

## Architecture

Un serveur Express unique sert l'API **et** l'application : en développement il
monte Vite en middleware, en production il sert `dist/`. Il n'y a donc qu'un
seul port et aucun proxy à configurer.

```
server.ts              point d'entrée : Express + Vite/statique
server/
  db.ts                connexion base (fichier local, Postgres ou Turso) et schéma
  repositories.ts      accès aux données (seul module qui parle à la base)
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

La base vit soit dans un fichier local (`DATA_DIR`, `./data` par défaut, hors
du dépôt), soit dans une base Postgres ou Turso distante selon la variable
d'environnement définie — voir « Choisir un hébergeur » plus haut.
`server/db.ts` choisit automatiquement le bon moteur, sans aucun autre
changement de code.

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
instance (quel que soit l'hébergeur, votre propre base) n'accueille qu'un
seul compte, celui créé à l'installation. Il n'y a pas de rôles ni de comptes
secondaires — le compte connecté a systématiquement tous les droits sur ses
propres données.

Au premier démarrage, l'application détecte qu'aucun compte n'existe et
affiche un écran d'installation : vous y choisissez uniquement un mot de
passe (10 caractères minimum) — aucune adresse e-mail n'est demandée, la
connexion se fait par mot de passe seul, ce compte étant le seul de cette
instance. **Les données déjà présentes sont conservées.**

Les mots de passe sont hachés avec `scrypt` (`node:crypto`, aucune dépendance
ajoutée), sel aléatoire, comparaison à temps constant. Les sessions sont des
jetons de 256 bits portés par un cookie `HttpOnly`, valables 30 jours et
prolongés à l'usage. Plusieurs appareils peuvent rester connectés en
parallèle ; se déconnecter ne ferme que la session courante.

### Mot de passe oublié

Il n'y a pas de récupération par e-mail. La seule issue est de supprimer
directement les identifiants en base, ce qui ramène l'écran d'installation au
prochain chargement.

En local (mode fichier), avec la CLI `sqlite3` si elle est installée
(présente par défaut sur macOS, à installer séparément sur Windows) :

```bash
sqlite3 data/horizon.db "delete from staff_accounts; delete from sessions;"
```

Sans cette CLI (notamment sur Windows) — un script `npx tsx` ponctuel
fonctionne de façon identique sur macOS et Windows, en réutilisant la même
librairie que le serveur (`@libsql/client`, déjà installée) :

```bash
npx tsx -e "import {createClient} from '@libsql/client'; (async () => { const db = createClient({url: 'file:data/horizon.db'}); await db.execute('DELETE FROM staff_accounts'); await db.execute('DELETE FROM sessions'); })();"
```

Sur Postgres, quel que soit le fournisseur (souvent aussi accessible depuis
une console SQL fournie par l'hébergeur) :

```bash
psql "$POSTGRES_URL" -c "delete from staff_accounts; delete from sessions;"
```

Sur Turso (si utilisé à la place de Postgres) :

```bash
turso db shell propdesk "delete from staff_accounts; delete from sessions;"
```

Vos données ne sont pas touchées : seuls les comptes sont à recréer.

## Limites connues

- **Le verrou ne protège pas les données déjà en cache.** Si le serveur
  devient injoignable APRÈS qu'une authentification a déjà réussi sur ce
  navigateur, l'application redémarre sur le cache `localStorage` sans écran
  de connexion — aucune vérification n'est possible sans serveur. C'est un
  choix assumé : il préserve le filet anti-perte de données. Le cache est
  effacé à la déconnexion volontaire, mais quelqu'un ayant accès physique à
  la machine et coupant le serveur verrait les données. Ce n'est donc pas une
  protection contre un tiers présent devant l'écran. **Un navigateur qui n'a
  jamais authentifié** sur cette instance (aucune trace locale) et qui tombe
  sur un serveur injoignable voit en revanche un écran d'erreur explicite,
  jamais l'application — voir `AuthStatus["server-error"]`,
  `src/hooks/useAuth.ts`.
- **Un seul compte.** Chaque ligne porte déjà un `user_id`, donc l'ajout de
  comptes multiples sera additif — mais le cloisonnement des données par
  utilisateur reste à faire. La connexion se fait par mot de passe seul
  (aucune identification par email), cohérent avec ce modèle mono-compte.
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
