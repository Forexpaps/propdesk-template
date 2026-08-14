# HANDOFF — PropDesk (Académie de Trading)

Document de reprise. Il suppose que tu n'as accès ni à la conversation qui
l'a produit, ni à autre chose que ce dépôt. Rédigé après une session
complète (création du dépôt GitHub, remise à zéro complète des données de
démo, capital dérivé des portefeuilles réels partout dans l'app,
synchronisation automatique portefeuille ↔ trades, correction de la courbe
de progression) — pas une compilation superficielle de notes.

> **État à la dernière mise à jour de ce document**
> Branche `main`, dernier commit : **`aac295f`** (« Vide les données de
> démo et lie le capital affiché aux portefeuilles réels »), poussé sur
> **GitHub** (`https://github.com/Forexpaps/propdesk`, dépôt privé — voir
> §4 pour l'historique de sa création).
> Répertoire de travail **propre** (`git status` sans rien à committer).
> `npm run lint` (`tsc --noEmit`) et `npm run build` passent tous les deux,
> build ~2.9s.
> Aucun chantier en attente de commit à ce jour.

---

## 1. Le projet en bref

**PropDesk** est une plateforme d'académie de trading SMC (*Smart Money
Concepts*) destinée à un coach (le fondateur, compte admin) et à ses
élèves. Interface **entièrement en français**, ton direct, tutoiement.
Devise unique : **`$`**, jamais `€`. **Aucune IA n'est utilisée nulle
part** (retirée intégralement lors d'une session antérieure — décision
produit explicite et répétée, **ne pas la réintroduire sans nouvelle
demande explicite**).

C'est un **vrai projet full-stack** : React 19 + TypeScript + Vite côté
client, Express + `better-sqlite3` (SQLite, mode WAL) côté serveur, un
seul process Node sert les deux.

**Identité visuelle** : design system inspiré du module Replay FX (session
antérieure) — cartes plates à bordure fine (`#1B2320`), micro-labels en
majuscules espacées au-dessus des valeurs, chiffres clés en police mono,
navigation en pilules soulignées pour les vues à onglets internes. Palette
PropDesk (vert `#00E676`, fonds `#0D1110`/`#111615`).

### Qui l'utilise

Outil de travail d'un coach (« ForexPaps », `th.gauthey99@gmail.com`,
compte fondateur) et de son staff. Plusieurs comptes staff peuvent se
connecter séparément mais **partagent tous le même bureau** (mêmes trades,
fiches élèves, portefeuilles) — pas de multi-tenant côté staff. **Les
élèves ont un second monde d'identité complètement séparé**, chacun avec
son propre bureau de données personnel cloisonné. Seul « Suivi des
Élèves » reste structurellement réservé à un compte staff (`isAdmin`, vrai
pour tout le staff).

### Le repo est maintenant sur GitHub

Nouveau cette session : `https://github.com/Forexpaps/propdesk`, **privé**.
Créé via `gh repo create` + `gh auth login` (device flow navigateur).
L'ancien remote `origin` contenait un **Personal Access Token en clair dans
l'URL** (`https://Forexpaps:github_pat_...@github.com/...`) — remplacé par
une URL propre (`https://github.com/Forexpaps/propdesk.git`), l'auth passe
désormais par le credential helper de `gh`. L'utilisateur a vérifié que
l'ancien token n'apparaissait déjà plus dans ses tokens actifs GitHub (déjà
invalide avant cette session) — rien à révoquer en plus.

**Piège opérationnel découvert et confirmé cette session** : `.gitignore`
contient la règle `data/` (destinée à ignorer le dossier SQLite
`./data/horizon.db` à la racine) — **sans slash de tête, ce motif matche
`data/` à N'IMPORTE QUELLE profondeur**, y compris `src/data/`. Résultat :
`git add src/data/mockData.ts` (chemin explicite) **refuse** en le
signalant comme ignoré, il faut `git add -f src/data/mockData.ts`.
`git add -A`/`git add .`, eux, stagent correctement les fichiers déjà
suivis même s'ils matchent une règle d'ignore (seuls les fichiers *non
suivis* sont réellement ignorés par ces commandes) — donc pas de risque de
perdre silencieusement une modification via un commit habituel, mais
`git add <chemin exact>` sur `src/data/*` demandera systématiquement `-f`.
**Non corrigé** : la règle `.gitignore` pourrait être resserrée en
`/data/` (ancrée à la racine) pour lever l'ambiguïté — pas fait cette
session, faute de demande explicite ; à faire si ça recommence à gêner.

### Fonctionnalités, honnêtement caractérisées

**Réellement dynamiques et fonctionnelles** :
- **Journal de trading** (`TradingJournal.tsx`, 1331 lignes) — CRUD trades
  complet, PnL saisi librement (`$` ou `%`, jamais recalculé), capture
  d'écran jointe, tag de 9 erreurs d'exécution prédéfinies, export CSV
  protégé contre l'injection de formule. Persisté serveur. Chaque trade
  peut être rattaché à un portefeuille (`Trade.accountId`) — **et ce
  rattachement pilote désormais réellement le solde du portefeuille**
  (nouveau cette session, voir §4).
- **Portefeuille** (`WalletManagement.tsx`, 691 lignes) — multi-comptes
  Prop Firm/Broker, drawdown quotidien/total calculés en direct.
  **Nouveau cette session** : bouton **Supprimer** un portefeuille
  (confirmation native), et le solde (`equity`/`currentBalance`) se
  recalcule **automatiquement** dès qu'un trade lui est rattaché — la
  saisie manuelle (« Ajuster le Solde ») ne sert plus que tant qu'aucun
  trade n'est encore rattaché au compte (voir §4/§8 pour les détails et
  compromis).
- **Tableau de bord** (`MainDashboard.tsx`, 396 lignes) — le capital
  affiché (badge en-tête, carte « Courbe de progression ») et la courbe
  elle-même sont désormais **dérivés des portefeuilles et trades réels**,
  jamais d'une valeur figée (voir §4). **Bug corrigé cette session** : le
  point de départ de la courbe disparaissait dès qu'un trade existait,
  la rendant plate — corrigé, la courbe part toujours du capital initial
  réel.
- **Rentabilité** (`PerformanceDashboard.tsx`, 479 lignes) — 3
  sous-onglets à navigation en pilules (Vue d'ensemble / Psychologie &
  Catégories / Erreurs). Dérivé de `src/lib/performanceStats.ts`, source
  unique de vérité pour ce module — reçoit désormais lui aussi le
  `student` dérivé des portefeuilles (voir §3/§4), donc cohérent avec le
  Tableau de bord.
- **Macro** (`MacroDashboard.tsx`) — cotations et calendrier économique
  réellement en direct, sans clé API.
- **Modules vidéo** (`VideoAcademy.tsx`, 756 lignes) — lecture vidéo, quiz
  notés (seuil 70%), progression persistée serveur. **Catalogue vide par
  défaut désormais** (voir §4 : `mockData.ts` vidé) — à remplir avec le
  vrai contenu de cours de l'utilisateur, aucun module de démo ne reste.
- **Système de badges** — calculés en direct (`src/lib/badges.ts`,
  `computeBadgeProgress`) depuis les vraies données. Le badge « Prop Firm
  Challenge Ready » lit le `localStorage` du module Replay FX (voir §8).
- **Module Replay** (`ReplayModule.tsx` + `replay-fx/`) — backtest manuel
  sur données historiques réelles HistData.com 2024 (7 paires forex, 1m à
  Daily).
- **Données & Sauvegarde** (`UserProfileModal.tsx`) — export/import JSON
  complet du bureau de l'utilisateur connecté, sans bouton de
  réinitialisation destructrice.
- **Messagerie coach** bidirectionnelle, **centre d'alertes**, **espace
  admin de suivi des élèves** avec « Vue Complète » et gestion réelle des
  accès de connexion — système **indépendant** du capital dérivé des
  portefeuilles ci-dessus (voir « Deux systèmes de capital » ci-dessous).
- **Journal de sécurité + verrouillage de compte**, réservé `isOwner`.
- **Mode modérateur du Forum**, strictement réservé à `student.isAdmin`.
  Le Forum reste sans entrée de navigation dans la sidebar (décision
  produit inchangée).
- **Outils déterministes** (aucune IA) : audit de setup, calculateur de
  position (préremplit désormais avec le capital réel dérivé, voir §4),
  checklist pré-trade (non persistée).
- **Mode hors ligne avec file d'attente** (`src/lib/pendingChanges.ts`).

**Partiellement statiques ou factices** — inchangé depuis la session
précédente, sauf mention contraire :
- **`MainDashboard.tsx`** — sous-titre et bloc « Ta semaine » toujours
  codés en dur.
- **`MacroDashboard.tsx`** — « Actualités marché » toujours statique.
- **`EquityCurveChart.tsx`** — `ReferenceLine` « PALIER $11,500 » toujours
  codée en dur (celle du module Rentabilité, distincte de la courbe du
  Tableau de bord corrigée cette session).
- **`UserProfileModal.tsx`** — « NIVEAU 4 » toujours statique. Les champs
  « Capital Initial » / « Capital Actuel Enregistré » ont été **retirés**
  cette session (voir §4) : plus aucun champ de capital éditable
  manuellement dans ce formulaire.
- **`NotificationModal.tsx`** — statut « Push Server: Connecté (Live) »
  toujours factice.
- **`ForumSection.tsx`** (765 lignes) — CRUD réel, toujours sans entrée de
  navigation dans la sidebar.
- **`StudentTracking.tsx`** (888 lignes) — inchangé, métriques par défaut
  toujours saisies manuellement sauf via « Vue Complète »/« Lecture »
  (système `EnrolledStudent.startingCapital`/`currentCapital`,
  **indépendant** de la refonte capital de cette session — voir
  « Deux systèmes de capital » ci-dessous).
- **`MindsetJournalModal.tsx`** — toujours `localStorage` uniquement.
- **`CoachSignals.tsx`** — toujours aucune UI de création de signal côté
  coach.

### Deux systèmes de capital — à ne jamais confondre

Cette session a changé **uniquement** le capital du **bureau de la
personne connectée** (fondateur ou élève avec son propre login), affiché
sur son propre Tableau de bord/en-tête/Rentabilité. Il existe un système
**totalement différent et non touché** :
`EnrolledStudent.startingCapital`/`currentCapital` (`StudentTracking.tsx`,
`types.ts` ligne ~226) — un champ **saisi à la main par le coach** pour
noter l'état d'un élève qu'il suit, quand cet élève n'a pas (ou pas encore)
de compte de connexion réel. Le type documente déjà explicitement (ligne
~237) : si `studentAccountId` est présent, ce champ manuel « devient
obsolète », les vraies données de cet élève doivent être lues via l'API.
**Ne jamais appliquer la logique de dérivation par portefeuilles de cette
session à `EnrolledStudent`** sans demande explicite distincte — c'est un
concept produit délibérément différent.

**Ordres de grandeur** (lignes de code, vérifié à cette analyse) :
`src/App.tsx` 1682 (+25 cette session), `TradingJournal.tsx` 1331,
`UserProfileModal.tsx` 801 (-23 cette session), `StudentTracking.tsx` 888,
`server/auth/routes.ts` 771, `ForumSection.tsx` 765, `VideoAcademy.tsx`
756, `WalletManagement.tsx` 691 (+20 cette session), `server/routes.ts`
572, `Sidebar.tsx` 582, `PerformanceDashboard.tsx` 479, `server/db.ts` 413,
`src/lib/api.ts` 353, `MainDashboard.tsx` 396 (+5 cette session),
`src/types.ts` 356, `src/lib/performanceStats.ts` 310,
`server/repositories.ts` 291, `src/lib/badges.ts` 262, `server/schemas.ts`
220, `ReplayModule.tsx` 31, `src/lib/walletStats.ts` 76 (+35 cette
session), **`src/data/mockData.ts` 31 lignes (contre 1408 avant cette
session — vidé de tout son contenu de démo, voir §4)**.

**État de la base réelle** (`data/horizon.db` — inspectée à cette mise à
jour, voir §2 pour les commandes) : **quasiment vierge**. 1 compte staff
réel (`th.gauthey99@gmail.com`), 1 profil réel (« ForexPaps »), **1
portefeuille de test** (`acc-...`, nommé « test », capital initial
$100 000, solde actuel $102 963) et **1 trade de test** (EUR/USD, +$2 963,
rattaché à ce portefeuille) créés par l'utilisateur pendant cette session
pour vérifier la synchronisation portefeuille↔trade. Aucun élève inscrit,
aucun module de cours, aucun message, aucun sujet de forum, aucun badge,
aucune notification. **Ce portefeuille/trade « test » est probablement à
nettoyer ou à conserver comme premier vrai portefeuille selon l'intention
de l'utilisateur — à clarifier avec lui avant de le supprimer, ne pas
supposer.**

---

## 2. Démarrage immédiat

```bash
npm install
```

**Aucune variable d'environnement requise** — `.env.example` liste `PORT`
(défaut 3000), `DATA_DIR` (défaut `./data`), `NODE_ENV`. Un `.env` existe
déjà à la racine.

| Commande | Effet |
|---|---|
| `npm run dev` | serveur de développement sur http://localhost:3000 (`tsx server.ts`) |
| `npm run lint` | `tsc --noEmit` — **doit toujours sortir sans erreur** |
| `npm run build` | `vite build` (client) + `esbuild server.ts` → `dist/server.cjs`, ~2.9s |
| `npm start` | sert le build de production (`NODE_ENV=production` requis) |
| `npm run clean` | supprime `dist/` et `server.js` |

Un seul port, pas de proxy à configurer. `.claude/launch.json` démarre le
serveur sous le nom **`horizon-dev`**.

**⚠️ Après tout changement dans `server/` ou `server.ts`**, il faut
redémarrer le serveur de dev (`preview_stop` puis `preview_start`, ou
`lsof -ti:3000 | xargs -r kill -9 && npm run dev`) — TSX ne recharge pas à
chaud les fichiers serveur. Un redémarrage fait perdre la session
navigateur (cookie lié au process/port) — redemander à l'utilisateur de se
reconnecter est normal et attendu après un redémarrage serveur.

**⚠️ Piège d'outil de prévisualisation confirmé** : un raccourci clavier
simulé (`cmd+R`) pour recharger la page **n'a pas toujours déclenché un
vrai rechargement** dans le Browser pane. La commande `navigate()` vers la
même URL fonctionne de façon fiable. **Préférer `navigate()`**.

**⚠️ `window.confirm()`/`window.prompt()` natifs ne fonctionnent pas dans
le Browser pane automatisé** — `confirm()` retourne silencieusement
`false` (le clic semble n'avoir aucun effet), `prompt()` lève carrément une
exception non interceptée (« prompt() is not supported. »). Ça touche
notamment : import de sauvegarde, ajustement de solde de portefeuille, et
**le nouveau bouton Supprimer un portefeuille** (voir §4). Pour vérifier
qu'un flux protégé par `confirm()` fonctionne réellement, deux options :
appeler l'endpoint directement en JS (`fetch(...)`), ou stubber
temporairement `window.confirm` depuis `javascript_tool`
(`window.confirm = () => true`) juste avant de cliquer — **uniquement pour
vérifier**, jamais une façon de contourner la confirmation en usage réel.

### Inspecter la base

```bash
sqlite3 data/horizon.db "select id, name, email, must_change_password from staff_accounts"
sqlite3 data/horizon.db "select id, json_extract(payload,'\$.name'), json_extract(payload,'\$.startingCapital'), json_extract(payload,'\$.currentCapital') from users where id='user-local'"
sqlite3 data/horizon.db "select id, json_extract(payload,'\$.name'), json_extract(payload,'\$.initialBalance'), json_extract(payload,'\$.equity') from trading_accounts"
sqlite3 data/horizon.db "select id, json_extract(payload,'\$.pair'), json_extract(payload,'\$.pnl'), json_extract(payload,'\$.accountId') from trades"
```

**⚠️ Piège à connaître** : `users.payload.startingCapital`/`currentCapital`
en base sont désormais des **valeurs figées héritées**, plus jamais mises
à jour ni lues pour l'affichage (voir §4/§8 — le capital affiché est
recalculé au rendu depuis `trading_accounts`). Ne pas s'étonner si la base
affiche `100000/100000` alors que l'UI montre `$102,963` : c'est attendu,
**fais confiance à `trading_accounts`, pas à `users.payload`**, pour
connaître le vrai capital de quelqu'un.

Sonder l'API sans session :

```bash
curl -s localhost:3000/api/health && curl -s localhost:3000/api/auth/me
curl -s -o /dev/null -w "%{http_code}\n" localhost:3000/replay-fx/index.html
```

Compte admin actuel (staff, fondateur) : `th.gauthey99@gmail.com`. Le mot
de passe n'est **jamais** consigné ici — demande-le à l'utilisateur si
besoin. **Ne le tape jamais toi-même** dans un formulaire (voir §9,
absolue et non négociable).

**⚠️ Règle stricte, absolue — mots de passe et navigateur automatisé.**
Ne jamais taper un mot de passe dans un champ de formulaire du Browser
pane, même un mot de passe de test, même avec autorisation explicite.
Pour se connecter, demander à l'utilisateur de le faire lui-même.
L'authentification programmatique via `curl`/`fetch` (mot de passe jamais
vu par un humain) reste légitime.

**⚠️ Attention aux appels qui écrivent des données réelles pendant un
test.** Un `fetch()` de vérification exécuté depuis la console du
navigateur, dans un onglet où l'utilisateur est réellement connecté,
touche sa **vraie base de données** — pas un bac à sable. **Toujours
vérifier l'état AVANT d'exécuter un appel qui écrit, pas seulement
après** — et préférer, quand c'est possible, un aller-retour neutre
(relire l'état existant puis le renvoyer tel quel) plutôt qu'une donnée
fabriquée.

**Ne teste JAMAIS l'authentification (staff ou élève) sur `data/`** sans
nécessité — préfère une base jetable (`DATA_DIR=/tmp/xxx PORT=3102 npx tsx
server.ts`) quand c'est possible ; sinon nettoie systématiquement après
coup.

---

## 3. Architecture

### Vue d'ensemble

```
server.ts                     point d'entrée : Express + Vite/statique
                               + helmet + trust proxy (prod) + 4 tâches
                               de nettoyage périodiques + route statique
                               dédiée /replay-fx
server/
  db.ts (413)                  SQLite (better-sqlite3, WAL, foreign_keys
                               ON), 17 tables. Inchangé cette session.
  repositories.ts (291)        SEUL module qui parle à SQLite pour les
                               collections génériques. replaceCollection()
                               vérifie la PROPRIÉTÉ de chaque id soumis.
                               safeParsePayload() défensif sur toute
                               lecture JSON. Inchangé cette session.
  routes.ts (572)               routes /api/* génériques.
                               writeCollectionForAuth() centralise
                               l'autorisation par collection. Inchangé
                               cette session.
  schemas.ts (220)              validation zod. Inchangé cette session.
  economicCalendar.ts / marketData.ts   proxies en cache, inchangés.
  middleware/rateLimit.ts       inchangé.
  auth/                         inchangé cette session (password.ts,
                               sessions.ts, credentials.ts, routes.ts,
                               middleware.ts, studentCredentials.ts,
                               studentSessions.ts, studentRoutes.ts,
                               loginLockout.ts, securityEvents.ts).
src/
  main.tsx                      point de montage React, inchangé.
  App.tsx (1682)                 porte d'auth à deux mondes,
                               `StudentAuthenticatedApp` (élève connecté)
                               et `AcademyApp` (staff/fondateur).
                               **Modifié cette session** :
                               - `handleDeleteAccount` (les deux
                                 composants) : filtre le portefeuille par
                                 id, câblé sur `onDeleteAccount` de
                                 `WalletManagement`.
                               - Ancien `useEffect` qui recalculait
                                 `student.currentCapital` depuis le PnL
                                 total des trades (persistant, via
                                 `setStudent`) **retiré**, remplacé par un
                                 second `useEffect` qui appelle
                                 `syncAccountsWithTrades(prev, trades)`
                                 sur `setAccounts`/`setSyncedAccounts` à
                                 chaque changement de `trades` — le calcul
                                 vit maintenant sur les PORTEFEUILLES, pas
                                 sur le profil.
                               - `displayStudent` (AcademyApp) /
                                 `studentProfile` (StudentAuthenticatedApp,
                                 objet déjà existant, étendu) : objets
                                 DÉRIVÉS, jamais persistés, où
                                 `startingCapital`/`currentCapital` sont
                                 recalculés à chaque rendu depuis
                                 `accounts.reduce(...)`. Passés à
                                 `Sidebar`, `TopHeader`, `MainDashboard`,
                                 `PerformanceDashboard` et
                                 `PositionCalculatorModal`
                                 (`defaultCapital`). `ForumSection`,
                                 `CoachMessaging` et `UserProfileModal`
                                 continuent de recevoir le `student`
                                 BRUT (non dérivé) — ils n'affichent pas
                                 de capital, et `UserProfileModal` doit
                                 éditer le vrai objet stocké.
  types.ts (356)                 inchangé.
  data/mockData.ts (31, contre 1408 avant)   **VIDÉ cette session** — tous
                               les `initial*` (profil, coaches, modules,
                               trades, comptes, signaux, messages, sujets
                               de forum, élèves inscrits, notifications,
                               badges) sont désormais des tableaux/objet
                               vides. Sert toujours de fallback initial
                               React (avant que l'état serveur arrive) ET
                               de contenu d'amorçage
                               (`server/seed.ts`, `seedDemoData()`) quand
                               une base neuve démarre sans donnée
                               `localStorage` héritée à importer — les
                               deux chemins produisent désormais un
                               bureau réellement vide, pas un jeu de
                               démo. **Piège gitignore** : voir §1, `git
                               add` sur ce chemin exact demande `-f`.
  hooks/                         inchangé.
  lib/
    api.ts (353)                    inchangé cette session.
    badges.ts (262)                 inchangé cette session (le calcul du
                               badge Prop Firm Challenge Ready continue
                               de lire le `localStorage` de Replay FX,
                               voir §8 — sans lien avec le capital dérivé
                               des portefeuilles).
    walletStats.ts (76, +35 lignes)   **Nouveau cette session** :
                               `syncAccountsWithTrades(accounts, trades)`
                               — pure, recalcule
                               `equity`/`currentBalance = initialBalance +
                               somme(pnl des trades liés, hors %)` pour
                               chaque compte qui a AU MOINS un trade
                               rattaché (`trade.accountId === acc.id`).
                               Un compte sans trade rattaché n'est jamais
                               touché (préserve un ajustement manuel
                               antérieur). Renvoie `accounts` à
                               l'identique (même référence) si rien ne
                               bouge, pour éviter un
                               `PUT /api/collections/accounts` ou un
                               re-rendu inutiles. Appelée par un
                               `useEffect([trades])` dans `App.tsx`, dans
                               les DEUX composants (élève et
                               staff/fondateur).
    autres fichiers                inchangés.
  components/
    WalletManagement.tsx (691, +20)   **Modifié cette session** :
                               nouvelle prop obligatoire
                               `onDeleteAccount: (id: string) => void`.
                               Bouton « Supprimer » (icône `Trash2`) dans
                               l'inspecteur du compte sélectionné, à côté
                               de « Ajuster le Solde ». Confirmation
                               native (`window.confirm`, voir piège §2).
                               Après suppression, si le compte supprimé
                               était sélectionné, sélectionne un autre
                               compte restant (ou aucun). `readOnly`
                               masque toujours ce bouton (vue admin d'un
                               élève, `AdminStudentView.tsx`).
    MainDashboard.tsx (396, +5)   **Bug corrigé cette session** : le
                               calcul de `equityData` omettait le point
                               « Départ » (`student.startingCapital`) dès
                               que `trades.length > 0` — la courbe
                               semblait alors plate car elle démarrait
                               directement au dernier point. Le point de
                               départ est désormais TOUJOURS le premier
                               élément du tableau, suivi de chaque trade
                               dans l'ordre chronologique, puis d'un
                               point final « Actuel » basé sur
                               `student.currentCapital` (capital
                               réellement dérivé des comptes, pas le
                               `tempCapital` accumulé localement — garde-
                               fou contre une divergence silencieuse si
                               un trade sans compte rattaché, ou en %,
                               n'entre pas dans le même calcul).
    UserProfileModal.tsx (801, -23)   **Modifié cette session** : les
                               champs « Capital Initial ($) » et
                               « Capital Actuel Enregistré ($) », leurs
                               états locaux (`startingCapital`,
                               `currentCapital`) et leur envoi dans
                               `handleSubmit` ont été **retirés** — plus
                               aucune édition manuelle du capital. Le
                               `...student` initial dans le payload
                               envoyé au serveur conserve les valeurs
                               historiques telles quelles (voir piège
                               §2 : elles ne pilotent plus rien à
                               l'affichage).
    AdminStudentView.tsx           **+1 ligne cette session** :
                               `onDeleteAccount={() => {}}` (no-op) ajouté
                               à l'appel `<WalletManagement readOnly />`
                               pour satisfaire la nouvelle prop
                               obligatoire — cohérent avec les autres
                               callbacks no-op déjà présents à cet appel
                               (`onAddAccount`, `onUpdateAccountBalance`).
    Sidebar.tsx, TopHeader.tsx, PerformanceDashboard.tsx,
    performanceStats.ts            **non modifiés directement** — ils
                               lisent toujours `student.currentCapital`/
                               `startingCapital` tels quels, mais reçoivent
                               désormais l'objet DÉRIVÉ (`displayStudent`/
                               `studentProfile`) depuis `App.tsx` au lieu
                               du profil brut — leur propre code n'a pas eu
                               besoin de changer.
    autres composants               inchangés cette session.
replay-fx/                      inchangé cette session. Appli HTML/CSS/JS
                               vanilla autonome, servie via une route
                               Express dédiée, PAS dans `public/`.
public/
  icon.png / logo-auth.jpg / logo.png  inchangé.
```

### Le modèle d'authentification à deux mondes

Inchangé cette session — voir le tableau `AuthContext` / `dataUserId` /
`isOwner` vs `isAdmin` déjà en place.

### Schéma SQLite (17 tables)

Inchangé cette session (aucune migration ajoutée). Rappel des tables les
plus pertinentes pour le travail de cette session :
- `users` — un bureau par `id` (`user-local` pour le fondateur/staff
  partagé, `student-xxx` pour chaque élève connecté). `payload.
  startingCapital`/`currentCapital` **ne sont plus lus pour l'affichage**
  (voir ci-dessus), mais restent en base — champ hérité, pas supprimé du
  schéma.
- `trading_accounts` — un portefeuille par ligne, `payload.equity`/
  `currentBalance` désormais tenus à jour automatiquement par
  `syncAccountsWithTrades` dès qu'un trade leur est rattaché.
- `trades` — `payload.accountId` est le lien optionnel vers
  `trading_accounts.id` qui pilote toute cette session.

---

## 4. Fonctionnalités terminées

*(Historique détaillé chantier-par-chantier dans `git log`.)*

### Session courante — GitHub, remise à zéro complète, capital dérivé des portefeuilles

Chantier en plusieurs temps, sur demande explicite à chaque étape :

1. **Lancement du projet** (`npm run dev`, vérifié dans le Browser pane) —
   point de départ de la session, rien à signaler.

2. **Création du dépôt GitHub** — `gh auth login` (device flow
   navigateur, code affiché à l'utilisateur qui l'a saisi lui-même sur
   github.com/login/device), `gh repo create Forexpaps/propdesk --private
   --source=. --remote=temp-origin`, remplacement de l'ancien remote
   `origin` (qui contenait un PAT en clair dans son URL — signalé
   explicitement à l'utilisateur comme risque de sécurité) par le remote
   propre créé par `gh`. Push initial réussi. L'utilisateur a vérifié
   lui-même que l'ancien token n'était déjà plus dans sa liste de tokens
   actifs GitHub — rien à révoquer.

3. **Remise à zéro complète des données de démo** (« site neuf ») — sur
   demande explicite, avec clarification préalable (`AskUserQuestion`) sur
   le périmètre exact :
   - **Choix de l'utilisateur : tout supprimer, y compris les modules de
     cours de démo** (l'autre option proposée — garder les modules comme
     base à éditer — n'a pas été retenue).
   - Base SQLite réelle nettoyée directement (script `tsx` ponctuel,
     supprimé après usage) : toutes les collections du bureau `user-local`
     vidées via `replaceCollection(name, [], "user-local")`, les 6
     bureaux de test (`student-xxx`, créés pendant les tests précédents)
     supprimés (cascade SQL automatique sur leurs trades/comptes/modules
     via `ON DELETE CASCADE`), les 4 élèves inscrits fictifs supprimés de
     `enrolled_students` (cascade sur le seul compte de connexion élève de
     test, « Julien Moreau »). Le profil réel (« ForexPaps »,
     `th.gauthey99@gmail.com`, bio personnalisée, avatar importé) a été
     **conservé tel quel** — identifié comme personnalisation réelle, pas
     comme donnée de démo. `currentCapital` réaligné sur `startingCapital`
     (plus de PnL fictif résiduel).
   - `src/data/mockData.ts` vidé de tout son contenu (voir §3) pour que
     plus AUCUN futur amorçage ne réintroduise de démo.
   - Vérifié dans le navigateur après redémarrage : Tableau de bord,
     Journal, Messagerie Coach tous à zéro sans plantage.

4. **Suppression de portefeuille** (`WalletManagement.tsx`) — fonctionnalité
   manquante repérée par l'utilisateur en testant l'app fraîchement remise
   à zéro (« je viens de créer un portefeuille test, je veux pouvoir le
   supprimer »). Voir §3 pour le détail technique. Vérifié dans le
   navigateur (avec `window.confirm` stubbé pour contourner le piège §2),
   `PUT /api/collections/accounts → 200`, persistance confirmée après
   rechargement.

5. **Capital dérivé des portefeuilles réels, partout dans l'app** — repéré
   par l'utilisateur : un « site neuf » sans portefeuille affichait quand
   même $100 000 de capital sur le Tableau de bord. Clarification
   préalable (`AskUserQuestion`) sur le périmètre :
   - **Choix de l'utilisateur : partout dans l'app** (en-tête, Tableau de
     bord, sidebar, Rentabilité), pas seulement la courbe — avec retrait
     du champ manuel du profil puisqu'il n'aurait plus eu d'effet.
   - Voir §3 pour le détail technique (`displayStudent`/`studentProfile`
     dérivés, `UserProfileModal` allégé).
   - Vérifié dans le navigateur : $0 partout sans portefeuille, $100 000
     cohérent avec un portefeuille de test créé puis supprimé pour
     revérifier le retour à $0.

6. **Synchronisation automatique portefeuille ↔ trades** — bug réel
   signalé par l'utilisateur en conditions réelles : après avoir saisi un
   vrai trade rattaché à son portefeuille « test », ni le solde du
   portefeuille ni la courbe de progression ne bougeaient. Cause : le
   solde d'un compte n'était mis à jour QUE manuellement (« Ajuster le
   Solde »), jamais depuis les trades journalisés, y compris quand un
   `accountId` de rattachement existait. Voir §3/§8 pour le détail
   technique et les compromis assumés (`syncAccountsWithTrades`). Vérifié
   directement sur les vraies données de l'utilisateur (portefeuille
   « test » $100 000 → $102 963 après son trade EUR/USD réel de +$2 963).

7. **Courbe de progression plate malgré une variation réelle** — bug
   distinct repéré par l'utilisateur juste après le point 6 : le solde
   affichait bien $102 963, mais la courbe restait une ligne plate. Cause
   isolée : `MainDashboard.tsx` omettait systématiquement le point de
   départ dès qu'au moins un trade existait (voir §3 pour le détail).
   Vérifié visuellement : la courbe part maintenant de $100 000 (« Départ »)
   et monte jusqu'à $102 963 (« Actuel »).

8. **Commit + push** — un seul commit groupant les 6 fichiers modifiés
   (`aac295f`), poussé sur `origin/main` sur demande explicite.

Toutes les décisions de périmètre ambiguës (site vierge : tout supprimer
vs. garder les modules ; capital dérivé : partout vs. juste la courbe) ont
été reposées via `AskUserQuestion` avant implémentation — méthode qui
fonctionne bien avec cet utilisateur, voir §9. Dans les deux cas,
l'utilisateur a choisi l'option la plus large/« Recommandé ».

### Sécurité et robustesse — historique antérieur inchangé

*(Sessions antérieures — IDOR critique, verrouillage sidebar, CSV
injection, journal de sécurité + verrouillage de compte, mode modérateur
Forum gardé, `forum_replies` avec propriétaire, lecture JSON défensive,
`quizResultsSchema` borné, SheetJS à jour — inchangé, voir `git log` pour
le détail.)*

### Module Replay (Replay FX externe) — historique antérieur inchangé

*(Intégré lors d'une session antérieure, voir `git log` pour le détail
complet : cause du blocage de build historique — Tailwind v4 qui scannait
le fichier de données de 25 Mo —, route Express dédiée `/replay-fx`,
intégration comme onglet standard de la sidebar. Aucune modification cette
session.)*

---

## 5. Historique des chantiers récents (résumé)

*(Ordre chronologique inverse, les plus récents en premier.)*

| Commit | Résumé |
|---|---|
| `aac295f` | Vide les données de démo et lie le capital affiché aux portefeuilles réels |
| `0213656` | Met à jour le HANDOFF.md : session Replay FX + audit de bugs + Données & Sauvegarde |
| `656c757` | Ajoute l'export et la restauration de sauvegarde (Données & Sauvegarde) |
| `963124d` | Réactive le badge "Prop Firm Challenge Ready" via le journal Replay FX |
| `7ce08fe` | Borne le schéma de résultats de quiz |
| `97c0177` | Renforce la lecture JSON et l'intégrité de forum_replies côté serveur |
| `aa827cf` | Corrige le mode modérateur du Forum, non gardé côté serveur |
| `e522776` | Reprend le langage visuel de Replay FX sur les modules existants |
| `c770ee8` | Intègre le module Replay FX (backtest manuel sur données historiques réelles) |
| `9d62075` | Marque le badge-3 "Prop Firm Challenge Ready" comme pas encore disponible |
| `ff306de` | Réécrit intégralement le HANDOFF.md après analyse fraîche complète du projet |
| `4a50d74` | Retire entièrement le module Replay (simulateur + Monte Carlo) — *depuis remplacé* |
| `0939553` | Journal de sécurité + verrouillage de compte (fondateur-only) |
| `6333780` | Retrait complet de l'export PDF personnel |

*(Commits antérieurs à `6333780` : voir `git log` directement, non
reproduits ici pour rester lisible.)*

---

## 6. Bugs connus / limitations

### 🟡 Connus, non corrigés (décisions produit ou priorité basse)

1. **Forum inaccessible depuis l'UI.** Décision produit toujours en
   vigueur.
2. **Rate limiter en mémoire, par processus.** Compromis accepté pour un
   outil mono-instance.
3. **Absence de flux de récupération de mot de passe.** Discussion
   produit, pas un bug de code.
4. **`CoachSignals.tsx` : aucune UI pour qu'un coach crée un signal.**
5. **`NotificationModal.tsx` : statut "Push Server Live" factice.**
6. **`MindsetJournalModal.tsx` : persistance `localStorage` uniquement**,
   historique jamais affiché à l'écran.
7. **`MainDashboard.tsx` : sous-titre + bloc "Ta semaine" codés en dur.**
8. **`MacroDashboard.tsx` : fil d'actualités statique.**
9. **`EquityCurveChart.tsx` : `ReferenceLine` "$11,500 · ATTEINT" codée
   en dur** (module Rentabilité — distincte de la courbe du Tableau de
   bord, corrigée cette session).
10. **`UserProfileModal.tsx` : "NIVEAU 4" statique.**
11. **`package.json.name` reste `"react-example"`.** `vite` dupliqué
    entre `dependencies` et `devDependencies`.
12. **`.gitignore` : règle `data/` sans slash de tête matche aussi
    `src/data/`** (voir §1) — `git add <chemin exact>` sur ce dossier
    demande systématiquement `-f`. Pas corrigé faute de demande
    explicite ; correction triviale si ça gêne (`data/` → `/data/`).

### 🟡 Compromis assumés, nouveaux cette session

13. **`syncAccountsWithTrades` écrase tout ajustement manuel dès qu'AU
    MOINS un trade est rattaché au compte.** Une fois qu'un trade a
    `accountId = X`, le solde de `X` devient entièrement piloté par la
    somme des PnL des trades qui lui sont liés — un « Ajuster le Solde »
    fait ensuite sur ce compte serait silencieusement écrasé au prochain
    changement de `trades` (ajout/édition/suppression, sur N'IMPORTE quel
    trade, puisque l'effet tourne sur tout le tableau `trades`). C'est
    voulu et correspond à la demande explicite de l'utilisateur
    (« synchronisé à chaque fois que je rentre un trade »), mais un
    utilisateur qui voudrait injecter un dépôt/retrait/frais hors journal
    sur un compte qui a déjà des trades rattachés n'a **aucun moyen
    actuel** de le faire persister. Pas un bug — juste une limite connue
    à garder en tête si le sujet revient. Un compte SANS aucun trade
    rattaché reste, lui, entièrement piloté par « Ajuster le Solde »
    comme avant.
14. **Portefeuille « test » et son trade restent dans la vraie base** (voir
    §1) — décision volontairement laissée à l'utilisateur, à ne pas
    supprimer de ta propre initiative.

### ✅ Résolus cette session (retirés de la liste)

Absence de bouton de suppression de portefeuille, capital du Tableau de
bord/en-tête figé indépendamment des portefeuilles réels, solde de
portefeuille non synchronisé avec les trades rattachés, courbe de
progression plate malgré un trade réel (point de départ manquant). Voir §4
pour le détail de chaque correctif.

### Piège opérationnel : `AdminStudentView.tsx` est un overlay

Inchangé — voir historique. Scoper toute recherche DOM à
`document.querySelector('.fixed.inset-0.z-50...')`.

### Piège opérationnel : `window.confirm()`/`window.prompt()` dans l'outil de prévisualisation

Voir §2 — touche désormais aussi le bouton Supprimer un portefeuille.

### Piège opérationnel : `cmd+R` simulé ne recharge pas toujours

Voir §2 — préférer `navigate()`.

### Piège opérationnel, nouveau cette session : `.gitignore` `data/` matche `src/data/`

Voir §1/§2 — `git add -f` nécessaire sur `src/data/*`, `git add -A`
fonctionne normalement.

---

## 6 bis. Ce qui ressemble à du code mort, mais ne l'est pas

*(Inchangé, voir historique — `EnrolledStudent.accounts`, `ForumSection.tsx`,
`Trade.mistakes`, `Trade.aiAudit`/`pnlPercentage`, `TraderBadge.trackable`,
`requireOwner`/`requireAdmin`, `updateCollectionItem()`, `replay-fx/` servi
par une route Express dédiée.)*

**Ajout cette session** : `src/data/mockData.ts` (31 lignes, tous des
tableaux/objet vides) **n'est PAS un fichier orphelin ni un reliquat à
supprimer** — il reste importé par `App.tsx` (état React initial, avant
que le serveur réponde) et `server/seed.ts` (`seedDemoData()`, amorçage
d'une base neuve sans import `localStorage` hérité). Le vider était
délibéré (voir §4), le fichier lui-même doit rester en place avec sa forme
actuelle (tableaux vides, mais toujours exportés et typés).

**Ajout cette session** : `users.payload.startingCapital`/`currentCapital`
en base **ne sont plus lus pour l'affichage** mais restent écrits/lus par
`saveProfile()`/`getProfile()` (`server/repositories.ts`, inchangé) — ne
pas les retirer du schéma zod (`server/schemas.ts`) ni du type
`StudentProfile` (`types.ts`) sans vérifier au préalable qu'aucun autre
consommateur (notamment `EnrolledStudent`, système distinct, voir §1) n'en
dépend.

---

## 6 ter. Arbitrages déjà rendus

| Sujet | Décision |
|---|---|
| Périmètre de l'accès élève | Étendu à tout l'écosystème sauf Suivi des Élèves |
| Badges non calculables | Marqués « pas encore disponible », jamais de fausse progression |
| Emplacement du Journal de sécurité | Modale dédiée, pas un onglet de sidebar |
| Couleur du Portefeuille | Vert PropDesk exact (`#00E676`) |
| Module Replay | Replay FX (externe), intégré comme onglet standard sidebar |
| Style visuel global | Langage Replay FX (cartes plates, micro-labels, pilules) |
| Données & Sauvegarde | Dans Profil & Options, tout le bureau, sans réinitialisation destructrice |
| Mode modérateur Forum | Réservé à `student.isAdmin` |
| **Dépôt GitHub** | **Privé, créé cette session (`Forexpaps/propdesk`), auth via `gh` CLI, remote sans token en clair** |
| **Remise à zéro « site neuf »** | **Périmètre total : y compris les modules de cours de démo, pas seulement les données d'activité** |
| **Capital affiché** | **Dérivé de la somme des portefeuilles réels PARTOUT dans l'app (pas seulement la courbe), champ manuel du profil retiré** |
| **Synchronisation solde ↔ trades** | **Automatique dès qu'un trade est rattaché à un compte ; un compte sans trade rattaché reste piloté manuellement** |
| **Portefeuille/trade « test » actuels en base** | **Laissés tels quels, décision explicitement renvoyée à l'utilisateur** |

---

## 7. Prochaines tâches, dans l'ordre

**Aucun chantier explicite en attente à ce jour.** Tout ce qui a été
signalé par l'utilisateur cette session (suppression de portefeuille,
capital figé, synchronisation trades↔portefeuille, courbe plate) a été
traité, vérifié en conditions réelles, committé et poussé sur GitHub.

S'il faut proposer un point de départ à l'utilisateur plutôt que d'attendre
une demande :

1. **Demander s'il veut garder ou supprimer le portefeuille « test » et
   son trade** (voir §1/§6) — c'est la seule donnée résiduelle non-vide
   dans une base par ailleurs entièrement remise à zéro, et sa nature
   (test à nettoyer vs. premier vrai portefeuille) n'a jamais été
   tranchée explicitement.
2. **Remplir le catalogue de cours** (`modules`, vidé cette session) —
   l'utilisateur va devoir recréer ses vrais modules/leçons/quiz depuis
   zéro ; pas d'UI de création de module identifiée dans ce dépôt à ce
   stade (`VideoAcademy.tsx` semble être un lecteur/quiz, pas un éditeur —
   **à vérifier avant d'affirmer quoi que ce soit à l'utilisateur**, ne
   pas supposer que l'admin peut créer un module depuis l'UI sans avoir
   lu le composant).
3. Si l'utilisateur veut continuer à démêler le compromis du point 13
   (§6) — un ajustement manuel de solde persistant même avec des trades
   rattachés — ce serait un chantier à cadrer avec lui d'abord (ex:
   introduire un champ `manualAdjustment` séparé sur `TradingAccount`),
   pas à décider de ta propre initiative.

### Ce qui n'est PAS une tâche

- **Réintroduire de l'IA sous quelque forme que ce soit.**
- **Le cloisonnement des données par compte staff** — bureau partagé
  toujours voulu.
- **Donner aux élèves accès à « Suivi des Élèves ».**
- **Migrer le rate limiter vers Redis** sans demande explicite.
- **Reconstruire une fonctionnalité d'export PDF** sans demande explicite.
- **Ajouter un bouton de réinitialisation destructrice** à Données &
  Sauvegarde sans demande explicite.
- **"Réparer" le fil d'actus Macro statique, le centre de signaux sans
  création UI, le statut "Live" factice des notifications, le "NIVEAU 4"
  statique, la ligne de référence codée en dur de la courbe d'équité
  (module Rentabilité), le bloc "Ta semaine" du tableau de bord** —
  limitations connues et acceptées.
- **Réactiver le Forum dans la sidebar** sans demande explicite.
- **Supprimer le portefeuille/trade « test »** de ta propre initiative
  (voir point 1 ci-dessus — demande d'abord).
- **Resserrer la règle `.gitignore` `data/` → `/data/`** sans demande
  explicite (voir §6, point 12 — connu, pas gênant en pratique avec
  `git add -A`).
- **Appliquer la logique de capital dérivé des portefeuilles à
  `EnrolledStudent`** (Suivi des Élèves) — systèmes délibérément
  distincts, voir §1 « Deux systèmes de capital ».

---

## 8. Décisions techniques importantes

### Le capital affiché est calculé au rendu, jamais persisté

`displayStudent`/`studentProfile` (`App.tsx`) recalculent
`startingCapital`/`currentCapital` à **chaque rendu** depuis `accounts`,
sans jamais appeler `setStudent`/`api.saveProfile`. C'est un choix
délibéré : l'ancien mécanisme (un `useEffect` qui persistait
`currentCapital` recalculé depuis le PnL des trades) déclenchait un
`PUT /api/profile` à chaque changement de trades, et le commentaire
d'origine documentait déjà le risque (bandeau « modifications en
attente » qui « crie au loup » à chaque montage si l'objet recalculé
n'est pas strictement égal à l'ancien). Recalculer à la volée à partir
d'`accounts` (déjà synchronisé séparément) évite complètement cette classe
de problème — pas de nouvel état à synchroniser, pas de risque de dérive
entre « ce qui est affiché » et « ce qui est en base ».

### `syncAccountsWithTrades` : équilibre entre auto-sync et perte de contrôle manuel

Deux approches étaient possibles pour lier trades et solde de compte : (a)
toujours recalculer depuis les trades, en supprimant purement et
simplement l'ajustement manuel ; (b) séparer `equity` en deux
composantes (solde dérivé des trades + un delta manuel séparé, plus
correct mais plus complexe, nécessiterait un nouveau champ sur
`TradingAccount` et une migration). Le choix retenu est un compromis
pragmatique explicitement documenté (voir §6, point 13) : un compte
**sans aucun trade rattaché** reste 100% piloté par l'ajustement manuel
(cas d'usage : suivi d'un compte externe, dépôts/retraits) ; dès qu'**au
moins un trade** lui est rattaché, le solde bascule entièrement sur le
calcul automatique et tout ajustement manuel antérieur/futur sur ce compte
sera silencieusement écrasé au prochain changement de `trades`. Si ce
compromis devient gênant à l'usage (utilisateur qui veut journaliser ses
trades ET faire des ajustements manuels sur le même compte), la vraie
solution est l'option (b) — ne pas la construire préventivement sans
qu'il en fasse la demande.

### Pourquoi le point « Départ » de la courbe manquait

`MainDashboard.tsx` construisait `equityData` avec un `? :` : soit un seul
point « Départ » (aucun trade), soit **directement** la liste des trades
suivie d'un point « Actuel » (au moins un trade) — sans jamais inclure
« Départ » dans cette seconde branche. Le bug n'était visible qu'avec très
peu de trades (avec beaucoup de trades, la partie manquante était
proportionnellement négligeable sur le graphique). Leçon générale : une
structure `condition ? [un seul cas] : [liste différente]` pour construire
une série temporelle mérite une relecture attentive de ce qui existe dans
une branche mais pas dans l'autre — ici, le point de départ existait dans
une branche et avait simplement été oublié dans l'autre.

### GitHub — remote sans token en clair, auth via `gh` CLI

Le remote `origin` initial contenait un Personal Access Token directement
dans l'URL HTTPS (`https://user:TOKEN@github.com/...`) — visible en clair
dans `.git/config`, dans l'historique de n'importe quel outil qui
affiche la config git, et désormais dans les transcripts de cette
conversation. Remplacé par une URL sans identifiants
(`https://github.com/Forexpaps/propdesk.git`), l'authentification passant
par le credential helper que `gh auth login` configure. **Si un futur push
échoue avec une erreur d'authentification**, la réponse est `gh auth
login` (device flow, code affiché à l'utilisateur), jamais de réintroduire
un token dans l'URL du remote.

### Tester un flux protégé par `window.confirm()` sans compromettre la vérification

Pattern utilisé pour vérifier la suppression de portefeuille : stubber
`window.confirm = () => true` via `javascript_tool` juste avant de
cliquer, puisque le clic seul ne déclenche jamais le vrai dialogue natif
dans le Browser pane (voir §2/§6). Confirmer ensuite le résultat par deux
canaux indépendants : la requête réseau observée (`PUT
/api/collections/accounts → 200`) ET un rechargement complet de la page
(`navigate()`) pour vérifier la persistance réelle, pas seulement l'état
React en mémoire.

*(Pour les décisions antérieures — Tailwind v4 vs gros asset statique,
`writeCollectionForAuth()`, couplage badge/localStorage Replay FX,
`safeParsePayload()`, aller-retour neutre pour tester une écriture — voir
la version précédente de ce document dans `git log -p -- HANDOFF.md`, ou
directement l'historique git du code concerné.)*

---

## 9. Contexte de travail avec l'utilisateur

- Il **communique en français**, ton direct, tutoiement.
- Il travaille par **demandes courtes et itératives**, souvent en
  signalant un problème constaté en usage réel plutôt qu'en décrivant une
  solution à l'avance — cette session en est un exemple particulièrement
  net : « je viens de rentrer un trade... mon portefeuille ne se met pas à
  jour » a mené directement à isoler et corriger un vrai bug de
  synchronisation, jamais mentionné avant que l'utilisateur ne le
  rencontre lui-même en testant l'app.
- **Il attend d'être consulté sur les choix de conception ambigus avant
  l'implémentation.** Cette session : deux `AskUserQuestion` posées avant
  d'agir (périmètre exact de la remise à zéro « site neuf » ; périmètre
  du capital dérivé des portefeuilles). Dans les deux cas il a choisi
  l'option la plus large, marquée « Recommandé ».
- **Il teste réellement l'app en conditions d'usage et remonte les bugs
  au fil de l'eau**, pas seulement en lisant du code ou en faisant
  confiance à une implémentation qui « devrait marcher ». Trois bugs
  distincts de cette session (solde non synchronisé, courbe plate,
  capital figé à $100 000 sur un site neuf) ont tous été découverts par
  lui en utilisant l'app normalement, pas par un audit de code demandé.
- **Il committe et pousse sur GitHub sur demande explicite**, groupée
  plutôt qu'au fil de l'eau cette session (un seul commit pour 6 fichiers,
  demandé après plusieurs correctifs successifs plutôt qu'après chacun).
- **Toujours vérifier en conditions réelles, pas seulement à la
  compilation.** Cette session : chaque correctif (suppression de
  portefeuille, capital dérivé, synchronisation trades, courbe corrigée) a
  été vérifié dans le Browser pane avant d'être annoncé comme terminé —
  y compris en stubbant `window.confirm` pour contourner une limitation
  connue de l'outil plutôt que de sauter la vérification.
- **Ses données de travail sont réelles** (`data/horizon.db`). Cette
  session a nécessité une remise à zéro volontaire et étendue de cette
  base réelle — vérifiée deux fois avant d'agir (comptage des lignes par
  table, inspection du contenu réel des `enrolled_students`/`trades`) pour
  ne jamais confondre donnée réelle personnalisée (le profil « ForexPaps »)
  et donnée de démo à supprimer.
- Il **ne donne pas ses mots de passe pour que tu les utilises** — même
  fourni en clair sur demande explicite, la règle de sécurité prime.
- Quand il demande une mise à jour du HANDOFF « suffisamment détaillée »,
  il attend qu'elle reflète fidèlement tout ce qui a changé, avec une
  liste explicite : résumé du projet, architecture, fichiers
  modifiés, fonctionnalités terminées, bugs connus, prochaines tâches,
  décisions techniques, commandes à lancer, contexte de travail — toutes
  ces sections ont été revues à cette mise à jour, pas seulement les
  grandes lignes.

### Méthode de vérification qui a fait ses preuves

1. `npm run lint` après chaque changement de code.
2. Redémarrer le serveur de dev après tout changement **serveur**, en
   prévenant que la session sera perdue.
3. Pour un bug touchant à l'écriture de données réelles : vérifier l'état
   AVANT d'écrire, préférer un aller-retour neutre à une donnée fabriquée
   quand c'est possible.
4. Pour un bug d'UI/UX : reproduire le scénario exact dans le navigateur,
   en utilisant `navigate()` plutôt qu'un raccourci clavier simulé, et en
   stubbant `window.confirm`/`window.prompt` via `javascript_tool`
   uniquement quand un flux protégé par une boîte de dialogue native doit
   être vérifié.
5. Nettoyage systématique des données de test après vérification — sauf
   quand la donnée résiduelle appartient à l'utilisateur lui-même (le
   portefeuille « test » de cette session a été laissé en place,
   volontairement, la décision de le garder ou non lui revient).
6. Pour une fonctionnalité substantielle ou ambiguë : reposer les
   questions de clarification avant d'écrire du code via
   `AskUserQuestion`, même si un HANDOFF antérieur documentait déjà une
   piste de réponse.
7. Confirmer un correctif par au moins deux canaux indépendants quand
   c'est possible (ex: requête réseau observée ET rechargement complet de
   la page) plutôt que de se fier à un seul signal.

---

## 10. État à la reprise

- Branche `main`, dernier commit `aac295f`, poussé sur
  `https://github.com/Forexpaps/propdesk` (`origin/main` à jour).
  Répertoire de travail **propre**, rien en attente de commit.
- `npm run lint` et `npm run build` passent tous les deux (build ~2.9s).
- **Aucun chantier de code en cours.** Le commit de cette session couvre :
  remise à zéro complète des données de démo, suppression de portefeuille,
  capital dérivé des portefeuilles réels partout dans l'app,
  synchronisation automatique solde↔trades, correction de la courbe de
  progression.
- Base réelle (`data/horizon.db`) quasiment vierge : 1 profil réel, 1
  portefeuille de test (« test », $100 000 → $102 963), 1 trade de test
  rattaché. Aucun élève inscrit, aucun module de cours, aucune autre
  collection non vide.
- **Aucun thread utilisateur en attente identifié** à ce jour — tous les
  sujets soulevés cette session ont été traités, vérifiés et poussés.

### Par où commencer

1. Vérifier avec l'utilisateur s'il y a une tâche immédiate en tête (le
   document ci-dessus est une base de reprise, pas une feuille de route
   imposée).
2. Si rien de précis n'est demandé, le point le plus naturel à proposer
   est de **clarifier le sort du portefeuille/trade « test »** actuellement
   dans sa vraie base (§1/§7, point 1) — c'est la seule ambiguïté encore
   ouverte identifiée à cette mise à jour.

> Ce document est la **seule** source de reprise fiable. S'il existe un
> écart entre ce document et le code, **fais confiance au code** — vérifie
> par la lecture directe des fichiers sources, et corrige ce document en
> conséquence.
