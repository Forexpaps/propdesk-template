# PropDesk

Tableau de bord de trading personnel : journal d'exécution, portefeuille,
analyse de rentabilité, calendrier macro, setups et plan de trading.
Application **mono-utilisateur** — un seul compte, avec ses propres données
isolées. Aucune IA n'est utilisée nulle part dans l'application.

## Démarrage en local

Fonctionne à l'identique sur **macOS et Windows** — aucune commande ni
script propre à un système d'exploitation.

### Première installation (une seule fois)

Prérequis : [Node.js](https://nodejs.org) 20+ et npm (sur Windows,
l'installeur officiel les fournit tous les deux).

```bash
git clone https://github.com/Forexpaps/journal-de-trading.git
cd journal-de-trading
npm install
```

Sur Windows, ces commandes fonctionnent aussi bien dans **PowerShell**,
**l'invite de commandes (cmd)** que dans un terminal Git Bash — aucun
terminal Unix n'est requis.

Créer un `.env` à la racine (voir [.env.example](.env.example)) — un fichier
vide suffit, toutes les variables ont un défaut utilisable.

### Relancer le projet soi-même (à chaque fois, une fois déjà installé)

Une fois `npm install` fait une première fois, plus besoin de le refaire —
`node_modules` reste sur le disque. Pour retravailler dessus ou simplement
l'utiliser :

1. Ouvrir un terminal (macOS : app **Terminal** ou **iTerm** ; Windows :
   **PowerShell**, l'invite de commandes, ou le terminal intégré de
   l'éditeur utilisé).
2. Se placer dans le dossier du projet :
   ```bash
   cd chemin/vers/le/dossier-du-projet
   ```
3. Démarrer le serveur :
   ```bash
   npm run dev
   ```
4. Ouvrir **http://localhost:3000** dans un navigateur.
5. Pour arrêter le serveur : retourner dans le terminal et appuyer sur
   **Ctrl+C**.

Si un message d'erreur mentionne un module introuvable (ex. après avoir
récupéré le projet sur une nouvelle machine, ou après une mise à jour du
code), relancer `npm install` une fois avant `npm run dev`.

Autres commandes disponibles, à lancer de la même façon :

```bash
npm run dev     # http://localhost:3000 — développement, avec rechargement à chaud côté client
npm run lint    # vérification TypeScript (strict)
npm run build   # bundle client + serveur dans dist/
npm start       # sert le build de production (après npm run build)
```

Au premier accès à `http://localhost:3000`, l'application affiche un écran
d'installation : choisissez uniquement votre mot de passe (10 caractères
minimum) — pas d'adresse e-mail, pas de nom, pas de photo. Le profil part
vide, à compléter plus tard si vous le souhaitez depuis Profil & Options.
Aux accès suivants, l'application se souvient de la session et affiche
directement le tableau de bord (ou l'écran de connexion si la session a
expiré ou a été fermée).

### Variables d'environnement utiles

| Variable | Rôle | Défaut |
|---|---|---|
| `PORT` | Port d'écoute du serveur | `3000` |
| `DATA_DIR` | Dossier de la base SQLite locale | `./data` |

Voir [.env.example](.env.example) pour la liste complète.

## Architecture

Un serveur Express unique sert l'API **et** l'application : en développement il
monte Vite en middleware, en production il sert `dist/`. Il n'y a donc qu'un
seul port et aucun proxy à configurer.

```
server.ts              point d'entrée : Express + Vite/statique
server/
  db.ts                connexion base (fichier local) et schéma
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
                       rentabilité, macro, setups, plan de trading...)
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

La base vit dans un fichier local (`DATA_DIR`, `./data` par défaut, hors du
dépôt). `server/db.ts` gère la connexion.

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

Cette application est pensée pour un usage **mono-utilisateur** : un seul
compte, celui créé à l'installation. Il n'y a pas de rôles ni de comptes
secondaires — le compte connecté a systématiquement tous les droits sur ses
propres données.

Au premier démarrage, l'application détecte qu'aucun compte n'existe et
affiche un écran d'installation : vous y choisissez uniquement un mot de
passe (10 caractères minimum) — aucune adresse e-mail n'est demandée, la
connexion se fait par mot de passe seul. **Les données déjà présentes sont
conservées.**

Les mots de passe sont hachés avec `scrypt` (`node:crypto`, aucune dépendance
ajoutée), sel aléatoire, comparaison à temps constant. Les sessions sont des
jetons de 256 bits portés par un cookie `HttpOnly`, valables 30 jours et
prolongés à l'usage. Plusieurs appareils peuvent rester connectés en
parallèle ; se déconnecter ne ferme que la session courante.

### Mot de passe oublié

Il n'y a pas de récupération par e-mail. La seule issue est de supprimer
directement les identifiants en base, ce qui ramène l'écran d'installation au
prochain chargement.

Avec la CLI `sqlite3` si elle est installée (présente par défaut sur macOS, à
installer séparément sur Windows) :

```bash
sqlite3 data/horizon.db "delete from staff_accounts; delete from sessions;"
```

Sans cette CLI (notamment sur Windows) — un script `npx tsx` ponctuel
fonctionne de façon identique sur macOS et Windows, en réutilisant la même
librairie que le serveur (`@libsql/client`, déjà installée) :

```bash
npx tsx -e "import {createClient} from '@libsql/client'; (async () => { const db = createClient({url: 'file:data/horizon.db'}); await db.execute('DELETE FROM staff_accounts'); await db.execute('DELETE FROM sessions'); })();"
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
