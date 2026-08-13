# HANDOFF — PropDesk (Académie de Trading)

Document de reprise. Il suppose que tu n'as accès ni à la conversation qui
l'a produit, ni à autre chose que ce dépôt. Rédigé après une session
complète (restylage de 7 modules, intégration d'un nouveau module Replay,
audit de bugs priorisé, 4 correctifs, et une nouvelle fonctionnalité
Export/Import) — pas une compilation superficielle de notes.

> **État à la dernière mise à jour de ce document**
> Branche `main`, dernier commit : **`656c757`** (« Ajoute l'export et la
> restauration de sauvegarde (Données & Sauvegarde) »).
> Répertoire de travail **propre** (`git status` sans rien à committer).
> `npm run lint` (`tsc --noEmit`) et `npm run build` passent tous les deux,
> build ~2.5-3s.
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
seul process Node sert les deux. La très grande majorité des
fonctionnalités listées ci-dessous sont **réellement persistées côté
serveur**, pas de la démo statique.

**Identité visuelle** : depuis cette session, le design system s'inspire du
module Replay FX (voir §4bis) — cartes plates à bordure fine (`#1B2320`),
micro-labels en majuscules espacées au-dessus des valeurs, chiffres clés en
police mono, navigation en pilules soulignées pour les vues à onglets
internes. Palette PropDesk (vert `#00E676`, fonds `#0D1110`/`#111615`)
intégralement conservée — c'est la densité et la hiérarchie typographique
qui ont changé, pas les couleurs.

### Qui l'utilise

Outil de travail d'un coach (« ForexPaps », `th.gauthey99@gmail.com`,
compte fondateur) et de son staff. Plusieurs comptes staff peuvent se
connecter séparément mais **partagent tous le même bureau** (mêmes trades,
fiches élèves, portefeuilles) — pas de multi-tenant côté staff. **Les
élèves ont un second monde d'identité complètement séparé**, chacun avec
son propre bureau de données personnel cloisonné. Seul « Suivi des
Élèves » reste structurellement réservé à un compte staff (`isAdmin`, vrai
pour tout le staff).

### Fonctionnalités, honnêtement caractérisées

**Réellement dynamiques et fonctionnelles** :
- **Journal de trading** (`TradingJournal.tsx`, 1331 lignes) — CRUD trades
  complet, PnL saisi librement (`$` ou `%`, jamais recalculé), capture
  d'écran jointe, tag de 9 erreurs d'exécution prédéfinies, export CSV
  protégé contre l'injection de formule. Persisté serveur.
- **Portefeuille** (`WalletManagement.tsx`, 671 lignes) — multi-comptes
  Prop Firm/Broker, drawdown quotidien/total calculés en direct. Thème
  visuel vert (`#00E676`), restylé cette session (cartes plates, plus de
  dégradés colorés).
- **Rentabilité** (`PerformanceDashboard.tsx`, 479 lignes) — restylé cette
  session en 3 sous-onglets à navigation en pilules (Vue d'ensemble /
  Psychologie & Catégories / Erreurs) au lieu d'un long scroll. Toujours
  dérivé de `src/lib/performanceStats.ts`, source unique de vérité.
- **Macro** (`MacroDashboard.tsx`) — cotations et calendrier économique
  réellement en direct, sans clé API.
- **Modules vidéo** (`VideoAcademy.tsx`, 756 lignes) — lecture vidéo, quiz
  notés (seuil 70%), progression persistée serveur. `quizResultsSchema`
  désormais borné (voir §4).
- **Système de badges** — 6 des 9 badges calculés en direct
  (`src/lib/badges.ts`, `computeBadgeProgress`) depuis cette session : le
  badge-3 « Prop Firm Challenge Ready » a été réactivé et connecté au
  module Replay (voir §4). Les 3 autres (badge-1, 8, 9) restent
  honnêtement « pas encore disponible ».
- **Module Replay** (`ReplayModule.tsx` + `replay-fx/`) — **nouveau cette
  session**, voir §4bis. Backtest manuel sur données historiques réelles
  HistData.com 2024 (7 paires forex, 1m à Daily).
- **Données & Sauvegarde** (`UserProfileModal.tsx`) — **nouveau cette
  session**, voir §4. Export/import JSON complet du bureau de
  l'utilisateur connecté, sans bouton de réinitialisation destructrice.
- **Messagerie coach** bidirectionnelle, **centre d'alertes**, **espace
  admin de suivi des élèves** avec « Vue Complète » et gestion réelle des
  accès de connexion.
- **Journal de sécurité + verrouillage de compte**, réservé `isOwner`.
- **Mode modérateur du Forum** — **corrigé cette session** (voir §4) :
  strictement réservé à `student.isAdmin`, un élève ne peut plus s'y
  faire passer pour un coach. Le Forum reste sans entrée de navigation
  dans la sidebar (décision produit inchangée).
- **Outils déterministes** (aucune IA) : audit de setup, calculateur de
  position, checklist pré-trade (non persistée).
- **Mode hors ligne avec file d'attente** (`src/lib/pendingChanges.ts`).

**Partiellement statiques ou factices — inchangé depuis la dernière
session**, sauf mention contraire :
- **`MainDashboard.tsx`** — sous-titre et bloc « Ta semaine » codés en dur
  (inchangé). La section MODULES compte désormais 4 cartes (Journal,
  **Replay** en violet, Examen, Module vidéo) après réintégration explicite
  du raccourci Replay.
- **`MacroDashboard.tsx`** — « Actualités marché » toujours statique.
- **`EquityCurveChart.tsx`** — `ReferenceLine` « PALIER $11,500 » toujours
  codée en dur (inchangé).
- **`UserProfileModal.tsx`** — « NIVEAU 4 » toujours statique (inchangé).
  Contient désormais la vraie section Données & Sauvegarde (voir §4).
- **`NotificationModal.tsx`** — statut « Push Server: Connecté (Live) »
  toujours factice (inchangé).
- **`ForumSection.tsx`** (765 lignes) — CRUD réel, mode modérateur
  **désormais gardé côté serveur/client** (voir §4). Toujours sans entrée
  de navigation dans la sidebar.
- **`StudentTracking.tsx`** (888 lignes) — inchangé, métriques par défaut
  toujours saisies manuellement sauf via « Vue Complète »/« Lecture ».
- **`MindsetJournalModal.tsx`** — toujours `localStorage` uniquement,
  historique jamais affiché (inchangé).
- **`CoachSignals.tsx`** — toujours aucune UI de création de signal côté
  coach (inchangé).

**Ordres de grandeur** (lignes de code, vérifié à cette analyse) :
`src/App.tsx` 1657, `src/data/mockData.ts` 1408, `TradingJournal.tsx`
1331, `UserProfileModal.tsx` 824 (+135 lignes cette session),
`StudentTracking.tsx` 888, `ForumSection.tsx` 765, `VideoAcademy.tsx` 756,
`server/auth/routes.ts` 771, `WalletManagement.tsx` 671,
`server/routes.ts` 572 (+135 lignes cette session), `Sidebar.tsx` 582,
`PerformanceDashboard.tsx` 479 (réécrit), `server/db.ts` 413 (+51 lignes),
`src/lib/api.ts` 353, `src/lib/performanceStats.ts` 310,
`server/repositories.ts` 291 (+65 lignes), `src/lib/badges.ts` 262 (+118
lignes), `MainDashboard.tsx` 391, `server/schemas.ts` 220 (+24 lignes),
`ReplayModule.tsx` 31 (nouveau).

**État de la base** : `data/horizon.db` contient un mélange de données
réelles et de démonstration. Julien Moreau (`stud-1`) reste le seul compte
élève actif de longue date. `forum_replies` a été migrée cette session
(nouvelle colonne `user_id`, voir §4/§3bis) — migration vérifiée sur les
données réelles, rien perdu.

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
| `npm run build` | `vite build` (client) + `esbuild server.ts` → `dist/server.cjs`, ~2.5-3s |
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

**⚠️ Piège d'outil de prévisualisation confirmé cette session** : un
raccourci clavier simulé (`cmd+R`) pour recharger la page **n'a pas
toujours déclenché un vrai rechargement** dans le Browser pane — l'UI
continuait d'afficher des données obsolètes (cache client) alors que
l'API renvoyait déjà la bonne donnée. La commande `navigate()` vers la
même URL, elle, a fonctionné de façon fiable à chaque fois. **Préférer
`navigate()` à un raccourci clavier simulé** pour toute vérification qui
dépend d'un vrai rechargement d'état.

### Inspecter la base

```bash
sqlite3 data/horizon.db "select id, name, email, must_change_password from staff_accounts"
sqlite3 data/horizon.db "select sa.user_id, es.id, json_extract(es.payload,'$.name') from student_accounts sa join enrolled_students es on es.id = sa.enrolled_student_id"
sqlite3 -json data/horizon.db "select id, json_extract(payload,'$.unlocked') as unlocked, json_extract(payload,'$.progressPercentage') as pct from badges where id like '%badge-3'"
sqlite3 data/horizon.db "select id, topic_id, user_id from forum_replies"
```

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
touche sa **vraie base de données** — pas un bac à sable. Un incident réel
cette session : un test de `PUT /api/quiz-results` a écrit un résultat de
quiz factice sur le vrai compte fondateur. Heureusement sans perte
(vérifié via une capture antérieure que ce quiz n'avait pas encore été
passé), nettoyé immédiatement après. **Toujours vérifier l'état AVANT
d'exécuter un appel qui écrit, pas seulement après** — et préférer, quand
c'est possible, un aller-retour neutre (relire l'état existant puis le
renvoyer tel quel) plutôt qu'une donnée fabriquée, pour tester un endpoint
d'écriture sans aucun risque de perte.

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
                               dédiée /replay-fx (voir §4bis)
server/
  db.ts (413)                  SQLite (better-sqlite3, WAL, foreign_keys
                               ON), 17 tables, 2 migrations ponctuelles
                               idempotentes (user_credentials →
                               staff_accounts ; forum_replies + user_id,
                               ajoutée cette session)
  repositories.ts (291)        SEUL module qui parle à SQLite pour les
                               collections génériques. replaceCollection()
                               vérifie la PROPRIÉTÉ de chaque id soumis.
                               Toutes les lectures JSON passent désormais
                               par safeParsePayload() (défensif, ajouté
                               cette session) : une ligne corrompue est
                               ignorée et journalisée, jamais fatale pour
                               toute la requête.
  routes.ts (572)               routes /api/* génériques. writeCollectionForAuth()
                               (extrait cette session) centralise la
                               logique d'autorisation par collection,
                               partagée par PUT /collections/:name ET
                               POST /state/restore (Données & Sauvegarde,
                               voir §4) — jamais dupliquée.
  schemas.ts (220)              validation zod. quizResultsSchema
                               désormais typé et borné (200 entrées max,
                               ajouté cette session, était z.unknown()
                               illimité avant).
  economicCalendar.ts / marketData.ts   proxies en cache, inchangés.
  middleware/rateLimit.ts       inchangé.
  auth/                         inchangé cette session (password.ts,
                               sessions.ts, credentials.ts, routes.ts,
                               middleware.ts, studentCredentials.ts,
                               studentSessions.ts, studentRoutes.ts,
                               loginLockout.ts, securityEvents.ts).
src/
  main.tsx                      point de montage React
  App.tsx (1657)                 porte d'auth à deux mondes. `<main>` a
                               désormais une className CONDITIONNELLE :
                               flex-1/flex-col plein espace pour l'onglet
                               "replay", padding/max-w-7xl centré pour
                               tous les autres — seule exception à la mise
                               en page standard de tous les onglets.
  types.ts (356)                 inchangé.
  data/mockData.ts (1408)        badge-3 (Prop Firm Challenge Ready)
                               remis à jour cette session (description +
                               targetValue réels, plus "à venir").
  hooks/                         inchangé.
  lib/
    api.ts (353)                    nouvelle méthode `restoreState()`
                               (POST /api/state/restore), distincte de
                               `importState()` (réservée au bootstrap).
    badges.ts (262)                 nouveau cas `badge-3` dans
                               computeSingleBadgeProgress() :
                               computePropFirmChallengeProgress() lit
                               localStorage["replayfx-journal-v1"]
                               (même origine que le module Replay, voir
                               §4bis) et rejoue l'équity/drawdown comme
                               Replay FX lui-même.
    autres fichiers                inchangés.
  components/
    ReplayModule.tsx (31)          NOUVEAU. Iframe vers /replay-fx/index.html,
                               occupe tout l'espace sous le header (voir
                               App.tsx ci-dessus). Aucune prop.
    Sidebar.tsx (582)              nouvel onglet "replay" dans ALL_TABS,
                               SIDEBAR_TOGGLEABLE_KEYS, SIDEBAR_ITEM_TABS,
                               et une entrée dans pratiqueItems (icône
                               CandlestickChart).
    UserProfileModal.tsx (824)     nouvelle section "Données & Sauvegarde"
                               sous "Journal de sécurité" (export/import
                               JSON, voir §4).
    ForumSection.tsx (765)         isModMode dérivé de student.isAdmin
                               (était true par défaut pour tout le monde,
                               voir §4).
    MainDashboard.tsx (391)        carte "Replay" (violet) réintégrée dans
                               la section MODULES, à la demande explicite
                               de l'utilisateur après le restylage.
    PerformanceDashboard.tsx (479) réécrit : navigation en pilules
                               (3 sous-onglets), cartes plates.
    TradingJournal.tsx, WalletManagement.tsx, MacroDashboard.tsx,
    VideoAcademy.tsx, CoachMessaging.tsx, StudentTracking.tsx   restylés
                               (langage visuel Replay FX), fonctionnalités
                               inchangées.
    auth/                          inchangé.
replay-fx/                      NOUVEAU. Appli HTML/CSS/JS vanilla
                               autonome fournie par l'utilisateur
                               (backtest manuel, données HistData.com
                               2024). Servie via une route Express dédiée,
                               PAS dans public/ (voir §4bis). SheetJS mis
                               à jour 0.18.5 → 0.20.3 cette session.
public/
  icon.png / logo-auth.jpg / logo.png  inchangé.
```

### Le modèle d'authentification à deux mondes

Inchangé cette session — voir le tableau `AuthContext` / `dataUserId` /
`isOwner` vs `isAdmin` déjà en place. `writeCollectionForAuth()` (nouveau,
`server/routes.ts`) applique exactement les mêmes règles
(`STUDENT_ALLOWED_COLLECTIONS`, `ADMIN_ONLY_COLLECTIONS`, fusion
protectrice des messages coach) que `PUT /collections/:name`, y compris
pour la restauration de sauvegarde.

### Schéma SQLite (17 tables)

Inchangé sauf **`forum_replies`**, qui porte désormais une colonne
`user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE` (migration
ajoutée cette session, `server/db.ts`, `migrateForumRepliesUserId()`) :
avant, la table n'avait aucune notion de propriétaire, seulement un
`topic_id`. Migration rétrocompatible (backfill par jointure sur
`forum_topics`, qui porte déjà `user_id`), vérifiée sur les 6 lignes
réelles existantes.

**⚠️ Piège d'ordre rencontré et corrigé** : l'index `idx_replies_user` ne
doit JAMAIS être créé dans le même bloc `CREATE TABLE IF NOT EXISTS` que
la table elle-même si la table peut déjà exister sans la colonne — sur une
base existante, `CREATE TABLE IF NOT EXISTS` est un no-op qui laisse
l'ancien schéma en place, et l'index sur une colonne pas encore migrée
fait planter le serveur au démarrage (`SqliteError: no such column`).
L'index doit être créé APRÈS l'appel à la fonction de migration.

---

## 4. Fonctionnalités terminées

*(Historique détaillé chantier-par-chantier dans `git log`.)*

### Session courante — restylage, nouveau module Replay, audit de bugs priorisé, Données & Sauvegarde

Chantier en plusieurs temps, sur demande explicite à chaque étape :

1. **Restylage de 7 modules** dans le langage visuel de Replay FX (voir
   ci-dessous) — module pilote validé avant généralisation (Rentabilité),
   puis Tableau de bord, Journal, Portefeuille, Macro, Module vidéo,
   Messagerie, Suivi des Élèves.
2. **Intégration du module Replay FX** (voir §4bis) — remplace le module
   Replay entièrement retiré lors d'une session antérieure.
3. **Audit de bugs priorisé** (méthode déjà éprouvée avec cet
   utilisateur) — 8 trouvailles classées Haute/Moyenne/Basse, traitées
   dans l'ordre sur demande explicite à chaque niveau :
   - 🔴 Mode modérateur du Forum non gardé (`isModMode` toujours `true`
     par défaut, aucune vérification `student.isAdmin`) — **corrigé**.
   - 🔴 SheetJS 0.18.5 avec CVE connues (prototype pollution
     CVE-2023-30533, ReDoS CVE-2024-22363) — **mis à jour vers 0.20.3**.
   - 🟠 Une ligne de payload corrompue faisait échouer la lecture de
     toute une collection (`JSON.parse` sans `try/catch`) — **corrigé**
     (`safeParsePayload()`).
   - 🟠 `forum_replies` sans colonne `user_id`, donc sans vérification de
     propriété possible au niveau table — **corrigé** (migration).
   - 🟡 `quizResultsSchema` non borné — **corrigé** (schéma typé, 200
     entrées max).
   - 🟡 Rate limiter en mémoire mono-instance — **non touché**,
     explicitement écarté (compromis déjà accepté, HANDOFF §6 le
     documentait déjà comme tel).
   - 🟡 Absence de flux de récupération de mot de passe — **non touché**,
     décision produit, pas un bug de code.
   - 🟡 ~40 imports d'icônes inutilisés — **nettoyés** (zéro impact
     fonctionnel).
4. **Réactivation du badge « Prop Firm Challenge Ready »** — connecté au
   nouveau module Replay (voir §4bis et §8 pour le détail du calcul).
5. **Carte « Replay » réintégrée** dans le Tableau de bord (violet),
   retirée par erreur par le restylage puis redemandée explicitement.
6. **Données & Sauvegarde** — reprise du sujet en attente HANDOFF §7.3
   (voir §4 ci-dessous pour le détail).

Toutes les questions de clarification ambiguës ont été reposées avant
implémentation (langage visuel exact à copier, seuil de drawdown du
badge, emplacement/périmètre/absence de bouton destructeur pour Données &
Sauvegarde) — méthode qui fonctionne bien avec cet utilisateur, voir §9.

### Données & Sauvegarde

Section dans `UserProfileModal.tsx`, sous "Journal de sécurité". Export
télécharge un JSON complet du bureau connecté (profil + 9 collections +
résultats de quiz, exactement ce que `GET /api/state` renvoie déjà).
Import lit un fichier, confirme explicitement le remplacement
(`window.confirm`, non testable dans le Browser pane — voir §6), appelle
`POST /api/state/restore`, puis recharge la page.

**Distincte de `POST /state/import`** (existante, réservée au tout premier
amorçage depuis le `localStorage` legacy, refuse si la base est déjà
amorcée) : `POST /state/restore` fonctionne à tout moment, sur les
données de l'appelant SEULEMENT. Réutilise `writeCollectionForAuth()` par
collection — une session élève ne peut restaurer que ses collections déjà
autorisées.

**Décision explicite** : pas de bouton de réinitialisation destructrice
dans cette version — si demandé un jour, le traiter comme un chantier à
part avec ses propres garde-fous (friction de confirmation élevée).

Vérifié par aller-retour neutre (export puis réimport immédiat des mêmes
données, via `fetch()` direct plutôt qu'un clic UI à cause de
`window.confirm()` — voir §6) : succès, toutes les collections importées,
données intactes après coup.

### Sécurité — plusieurs tours d'audit, committé et vérifié

*(Historique antérieur à cette session — IDOR critique, verrouillage
sidebar, CSV injection, journal de sécurité + verrouillage de compte —
inchangé, voir `git log` pour le détail.)*

Cette session ajoute : mode modérateur Forum gardé, `forum_replies` avec
propriétaire, lecture JSON défensive, `quizResultsSchema` borné, SheetJS à
jour.

### 4bis. Module Replay — remplacé par Replay FX (externe)

Contexte complet de l'historique (simulateur maison construit puis
retiré, tentative Replay FX bloquant le build) dans l'ancien §4ter,
**résolu cette session**. Sur demande explicite de l'utilisateur, Replay
FX (fourni en dehors de ce dépôt) a été intégré avec succès :

1. **Cause réelle du blocage de build identifiée** (jamais élucidée
   avant) : ce n'était PAS Vite/Rollup qui traitait le fichier de données
   de 25 Mo (`market-data.js`) placé dans `public/` — c'est **Tailwind
   v4** qui scanne tout le projet à la recherche de classes CSS sans
   `content` explicite, et essayait de scanner ce fichier comme du code
   source. Corrigé avec `@source not "../replay-fx"` dans `src/index.css`.
2. **Fichiers servis hors de `public/`**, via une route Express dédiée
   (`app.use("/replay-fx", express.static(...))`, `server.ts`) — montée
   avant le middleware Vite/le statique de prod, donc toujours prioritaire.
3. **Aucune modification de Replay FX au-delà de deux correctifs
   mineurs** : bouton plein écran du graphique restauré après une
   suppression accidentelle (l'app en avait besoin, `app.js` levait sinon
   une exception au chargement), SheetJS mis à jour (voir audit ci-dessus).
4. **Intégré comme onglet standard** de la sidebar (section PRATIQUE,
   icône `CandlestickChart`), pas en superposition plein écran — sidebar
   et header PropDesk restent accessibles pendant l'utilisation. `<main>`
   perd son padding/`max-w-7xl` uniquement pour cet onglet (voir §3).
5. **Interface avec PropDesk limitée au strict minimum** : le badge « Prop
   Firm Challenge Ready » lit `localStorage["replayfx-journal-v1"]``
   (même origine, donc accessible) pour calculer sa progression — voir
   §8 pour le détail et les limites assumées de ce couplage.

**Build vérifié à ~2.5-3s après le correctif** (contre plusieurs minutes à
100% CPU avant), confirmé sur les vraies données HistData.com du dépôt.

---

## 5. Historique des chantiers récents (résumé)

*(Ordre chronologique inverse, les plus récents en premier.)*

| Commit | Résumé |
|---|---|
| `656c757` | Ajoute l'export et la restauration de sauvegarde (Données & Sauvegarde) |
| `963124d` | Réactive le badge "Prop Firm Challenge Ready" via le journal Replay FX |
| `7ce08fe` | Borne le schéma de résultats de quiz |
| `97c0177` | Renforce la lecture JSON et l'intégrité de forum_replies côté serveur |
| `aa827cf` | Corrige le mode modérateur du Forum, non gardé côté serveur |
| `e522776` | Reprend le langage visuel de Replay FX sur les modules existants |
| `c770ee8` | Intègre le module Replay FX (backtest manuel sur données historiques réelles) |
| `9d62075` | Marque le badge-3 "Prop Firm Challenge Ready" comme pas encore disponible |
| `ff306de` | Réécrit intégralement le HANDOFF.md après analyse fraîche complète du projet |
| `4a50d74` | Retire entièrement le module Replay (simulateur + Monte Carlo) — *depuis remplacé, voir §4bis* |
| `3f7e6f0` | Change les couleurs du Portefeuille du violet au vert |
| `72645ee` | Refonte visuelle du Portefeuille (style Mindset modal) |
| `0939553` | Journal de sécurité + verrouillage de compte (fondateur-only) |
| `6333780` | Retrait complet de l'export PDF personnel |
| `d43a10f` | Correction affichage badges côté staff (`[]` vs `undefined`) |
| `8a49988` | Correction calcul courbe d'équité (LOSS/BREAKEVEN) |
| `ecbbce6` | Badges en direct + notifications élève + bandeau anti-perte de sync |
| `6a02be9` | Correction des failles de sécurité de l'audit initial |

---

## 6. Bugs connus / limitations

### 🟡 Connus, non corrigés (décisions produit ou priorité basse — inchangé)

1. **Forum inaccessible depuis l'UI.** Décision produit toujours en
   vigueur — reste inaccessible pour l'instant.
2. **`quizResultsSchema` non borné.** ~~Corrigé cette session~~ — voir §4.
3. **Rate limiter en mémoire, par processus.** Compromis accepté pour un
   outil mono-instance — pas de migration Redis sans demande explicite.
4. **Absence de flux de récupération de mot de passe.** Discussion
   produit, pas un bug de code.
5. **`CoachSignals.tsx` : aucune UI pour qu'un coach crée un signal.**
6. **`NotificationModal.tsx` : statut "Push Server Live" factice.**
7. **`MindsetJournalModal.tsx` : persistance `localStorage` uniquement**,
   historique jamais affiché à l'écran.
8. **`MainDashboard.tsx` : sous-titre + bloc "Ta semaine" codés en dur.**
9. **`MacroDashboard.tsx` : fil d'actualités statique.**
10. **`EquityCurveChart.tsx` : `ReferenceLine` "$11,500 · ATTEINT" codée
    en dur.**
11. **`UserProfileModal.tsx` : "NIVEAU 4" statique.**
12. **`package.json.name` reste `"react-example"`.** `vite` dupliqué
    entre `dependencies` et `devDependencies`.

### ✅ Résolus cette session (retirés de la liste)

Mode modérateur Forum non gardé, SheetJS obsolète (CVE), lecture JSON
fragile (une ligne corrompue cassait toute une collection),
`forum_replies` sans propriétaire, `quizResultsSchema` non borné, badge-3
résiduel du module Replay supprimé, imports inutilisés. Voir §4 pour le
détail de chaque correctif.

### Piège opérationnel : `AdminStudentView.tsx` est un overlay

Inchangé — voir historique. Scoper toute recherche DOM à
`document.querySelector('.fixed.inset-0.z-50...')`.

### Piège opérationnel : `window.confirm()` dans l'outil de prévisualisation

`confirm()` retourne silencieusement `false` dans le Browser pane —
touche tous les boutons qui l'utilisent, dont désormais le bouton
"Importer une sauvegarde" (Données & Sauvegarde). Contournement :
appeler directement l'endpoint en JS (`fetch(...)`) plutôt que de cliquer
à travers le flux UI complet.

### Piège opérationnel confirmé cette session : `cmd+R` simulé ne recharge pas toujours

Voir §2 — préférer `navigate()` à un raccourci clavier simulé pour toute
vérification dépendant d'un vrai rechargement.

### Piège rencontré : ordre migration/index sur `forum_replies`

Voir §3bis — un index sur une colonne ajoutée par migration doit être créé
APRÈS l'appel à la fonction de migration, jamais dans le même bloc de
schéma initial que `CREATE TABLE IF NOT EXISTS`.

### Piège rencontré (déjà documenté, reconfirmé) : gros fichier statique dans `public/` bloque le build

**Cause racine désormais identifiée** (voir §4bis) : ce n'est pas
Vite/Rollup qui pose problème avec un gros fichier dans `public/`, c'est
Tailwind v4 qui scanne tout le projet par défaut. La solution n'est donc
pas nécessairement de servir l'asset autrement, mais aussi/surtout
d'exclure son chemin du scan Tailwind (`@source not "chemin"`).

---

## 6 bis. Ce qui ressemble à du code mort, mais ne l'est pas

*(Inchangé, voir historique — `EnrolledStudent.accounts`, `ForumSection.tsx`,
`Trade.mistakes`, `Trade.aiAudit`/`pnlPercentage`, `TraderBadge.trackable`,
`requireOwner`/`requireAdmin`, `updateCollectionItem()`.)*

**Ajout cette session** : `replay-fx/` semble être un simple dossier
d'assets statiques mais est en réalité l'application entière servie par
sa propre route Express — ne pas le déplacer dans `public/` en pensant
« simplifier », ça reproduirait le blocage de build historique (voir
§4bis).

---

## 6 ter. Arbitrages déjà rendus

| Sujet | Décision |
|---|---|
| Périmètre de l'accès élève | Étendu à tout l'écosystème sauf Suivi des Élèves |
| Badges non calculables | Marqués « pas encore disponible », jamais de fausse progression |
| Emplacement du Journal de sécurité | Modale dédiée, pas un onglet de sidebar |
| Couleur du Portefeuille | Vert PropDesk exact (`#00E676`) |
| Module Replay | **Remplacé par Replay FX (externe)**, intégré avec succès cette session — voir §4bis |
| Style visuel global | Repris du langage Replay FX (cartes plates, micro-labels, pilules), couleurs PropDesk conservées |
| Emplacement du module Replay dans l'UI | Onglet standard sidebar (PRATIQUE), pas de superposition plein écran — sidebar/header toujours visibles |
| Badge Prop Firm Challenge Ready, critère | 10% de profit virtuel sur le journal Replay FX, sans jamais dépasser 10% de drawdown depuis le sommet |
| Données & Sauvegarde, emplacement | Dans Profil & Options (pas un onglet dédié) |
| Données & Sauvegarde, périmètre | Tout le bureau de l'utilisateur connecté (pas de sélection à la carte) |
| Données & Sauvegarde, réinitialisation destructrice | **Exclue de cette version**, à traiter séparément si demandé |
| Mode modérateur Forum | Réservé à `student.isAdmin`, jamais accessible à un élève |

---

## 7. Prochaines tâches, dans l'ordre

**Aucun chantier explicite en attente à ce jour.** Les trois sujets
documentés dans la version précédente de ce document (§7.1 badge
résiduel, §7.2 Portefeuille, §7.3 Données & Sauvegarde) ont tous été
traités et clos cette session — voir §4 et §6ter.

### Ce qui n'est PAS une tâche

- **Réintroduire de l'IA sous quelque forme que ce soit.**
- **Le cloisonnement des données par compte staff** — bureau partagé
  toujours voulu.
- **Donner aux élèves accès à « Suivi des Élèves ».**
- **Migrer le rate limiter vers Redis** sans demande explicite.
- **Reconstruire une fonctionnalité d'export PDF** sans demande explicite.
- **Ajouter un bouton de réinitialisation destructrice** à Données &
  Sauvegarde sans demande explicite — écarté consciemment cette session.
- **"Réparer" les vidéos placeholder, le fil d'actus Macro statique, le
  centre de signaux sans création UI, le statut "Live" factice des
  notifications, le "NIVEAU 4" statique, la ligne de référence codée en
  dur de la courbe d'équité, le bloc "Ta semaine" du tableau de bord** —
  limitations connues et acceptées, pas des bugs à corriger de ta propre
  initiative.
- **Réactiver le Forum dans la sidebar** sans demande explicite — le mode
  modérateur est désormais gardé, mais l'accessibilité UI reste une
  décision produit distincte, jamais tranchée dans ce sens.

---

## 8. Décisions techniques importantes

### La vraie cause du blocage de build historique était Tailwind v4, pas Vite

Documenté pendant longtemps comme « cause exacte non investiguée » —
résolu cette session. Tailwind v4 (`@tailwindcss/vite`), sans `content`
explicite, scanne tout le projet à la recherche de classes CSS. Un
fichier de données volumineux placé n'importe où dans l'arborescence du
projet (pas seulement `public/`) peut donc être scanné comme du code
source et faire exploser le temps de build. La leçon générale : **avant
d'intégrer un gros asset statique, vérifier l'impact sur `npm run build`
ET, si Tailwind v4 est présent, envisager `@source not "chemin"`** avant
de chercher une solution plus complexe (route serveur dédiée, découpage).

### `writeCollectionForAuth()` — ne jamais dupliquer la logique d'autorisation par collection

Extraite de `PUT /collections/:name` pour être réutilisée telle quelle par
`POST /state/restore`. Toute future route qui écrit une collection au nom
d'un utilisateur authentifié doit passer par cette fonction plutôt que de
réimplémenter les vérifications (`STUDENT_ALLOWED_COLLECTIONS`,
`ADMIN_ONLY_COLLECTIONS`, fusion protectrice des messages coach) — une
réimplémentation même correcte au moment où elle est écrite dérivera
inévitablement de l'original au premier correctif de sécurité oublié d'un
seul côté.

### Le badge Prop Firm Challenge Ready lit le `localStorage` d'une appli tierce — couplage fragile assumé

`src/lib/badges.ts`, `computePropFirmChallengeProgress()` lit
`localStorage["replayfx-journal-v1"]`, la clé de stockage interne de
Replay FX (`replay-fx/app.js`). Ce couplage fonctionne parce que Replay FX
est servi depuis la même origine que PropDesk (`/replay-fx/`), donc
partage le même `localStorage`. **Si le format de stockage de Replay FX
change un jour** (renommage de la clé, changement de forme des objets
trade), ce calcul cessera silencieusement de trouver quoi que ce soit
(retour à 0%, pas de plantage — voir le `try/catch` défensif) sans qu'un
signal explicite prévienne du changement. Si Replay FX est mis à jour à
l'avenir, vérifier que `pnlCash` reste le champ utilisé pour le calcul de
solde par trade.

### Pourquoi une ligne JSON corrompue ne doit jamais faire échouer toute une collection

`safeParsePayload()` (`server/repositories.ts`) isole chaque erreur de
parsing ligne par ligne plutôt que de laisser `JSON.parse` remonter et
faire échouer `listCollection()` en bloc. Le coût d'une ligne ignorée
(donnée manquante, journalisée) est très inférieur au coût de bloquer
tout l'accès aux données d'un utilisateur à cause d'une seule ligne
corrompue.

### Tester un endpoint d'écriture sans risquer les vraies données : l'aller-retour neutre

Pattern utilisé pour vérifier `POST /state/restore` : relire l'état
existant (`GET /api/state`) puis le renvoyer tel quel à l'endpoint
d'écriture, plutôt que d'inventer des données de test. Si l'endpoint est
correct, le contenu après l'opération est strictement identique à avant —
zéro risque de perte, et le test reste significatif (l'endpoint est
réellement exercé). À privilégier chaque fois que c'est possible sur les
vraies données de l'utilisateur, plutôt qu'un payload fabriqué qu'il faut
ensuite nettoyer manuellement.

*(Pour les décisions antérieures — pièges Express, cascades SQL, session
de marché en UTC, capture d'écran non recadrée, distinction IA réelle/
fausse, correctif IDOR — voir l'historique git.)*

---

## 9. Contexte de travail avec l'utilisateur

- Il **communique en français**, ton direct, tutoiement.
- Il travaille par **demandes courtes et itératives**, souvent en
  signalant un problème constaté en usage réel plutôt qu'en décrivant une
  solution.
- Il a demandé un **audit exhaustif suivi d'une correction priorisée**
  plusieurs fois maintenant (« regarde tous les bugs... classe-les par
  priorité », puis « occupe-toi des bugs de priorité haute/moyenne/basse »
  un niveau à la fois) — méthode qui fonctionne très bien avec lui.
  Traiter chaque niveau de priorité l'un après l'autre, sur demande
  explicite, plutôt que de tout corriger d'un coup.
- **Il attend d'être consulté sur les choix de conception ambigus avant
  l'implémentation** — reposer les questions de clarification à chaque
  fois qu'un sujet en attente resurgit, même si HANDOFF documentait déjà
  une hypothèse de réponse. Les options « recommandées » proposées dans
  les questions de clarification ont quasi systématiquement été
  retenues.
- **Il peut déléguer un choix technique pointu explicitement** (« fais ce
  que tu recommandes de mieux ») quand la question est suffisamment
  technique/factuelle (ex: quelle version de SheetJS installer) — dans ce
  cas, agir directement sans reposer la question, mais rester dans les
  limites déjà posées par les règles de sécurité (demander confirmation
  avant tout téléchargement de fichier, même quand le choix technique est
  délégué).
- **Il peut changer d'avis en cours de route, parfois radicalement** —
  voir l'historique du module Replay (retiré puis remplacé) et de
  l'export PDF (construit puis retiré). Ne pas s'accrocher à une
  fonctionnalité récemment construite si une nouvelle demande la remet en
  cause.
- **Il committe lui-même la décision de committer**, mais une fois la
  demande faite, n'attend pas de confirmation supplémentaire avant chaque
  commit individuel dans la même série — un découpage en plusieurs
  commits thématiques (plutôt qu'un seul commit géant) a été fait sans
  qu'il ait eu besoin de le demander, et n'a suscité aucune objection.
- **Toujours vérifier en conditions réelles, pas seulement à la
  compilation, ni même à la seule lecture du code.** Plusieurs bugs et
  correctifs de cette session n'ont été confirmés qu'en testant vraiment
  le scénario (ex: écrire un faux trade dans le `localStorage` de Replay
  FX pour vérifier le calcul du badge, puis le nettoyer).
- **Ses données de travail sont réelles** (`data/horizon.db`). Toujours
  nettoyer après un test qui a dû l'utiliser directement — et, comme
  découvert cette session, **vérifier l'état AVANT un appel qui écrit**,
  pas seulement après, pour être certain de savoir si une donnée réelle a
  été touchée.
- Il **ne donne pas ses mots de passe pour que tu les utilises** — même
  fourni en clair sur demande explicite, la règle de sécurité prime.
- Quand il demande une mise à jour du HANDOFF « suffisamment détaillée »,
  il attend qu'elle reflète fidèlement tout ce qui a changé, pas
  uniquement les grandes lignes — sections §1, §3, §4, §5, §6, §6ter, §7,
  §8 toutes révisées à cette mise à jour.

### Méthode de vérification qui a fait ses preuves

1. `npm run lint` après chaque changement de code.
2. Redémarrer le serveur de dev après tout changement **serveur**, en
   prévenant que la session sera perdue.
3. Pour un bug touchant à l'écriture de données réelles : vérifier l'état
   AVANT d'écrire, préférer un aller-retour neutre à une donnée fabriquée
   quand c'est possible (voir §8).
4. Pour un bug d'UI/UX : reproduire le scénario exact dans le navigateur,
   en utilisant `navigate()` plutôt qu'un raccourci clavier simulé pour
   tout rechargement dont le résultat compte (voir §2/§6).
5. Nettoyage systématique des données de test après vérification.
6. Pour une fonctionnalité substantielle ou ambiguë : reposer les
   questions de clarification avant d'écrire du code, même si un HANDOFF
   antérieur documentait déjà une piste de réponse.
7. Pour une nouvelle route serveur qui écrit des données : vérifier s'il
   existe déjà une fonction équivalente (ex: la logique de
   `PUT /collections/:name`) à extraire et réutiliser plutôt qu'à
   dupliquer.

---

## 10. État à la reprise

- Branche `main`, dernier commit `656c757`. Répertoire de travail
  **propre**, rien en attente de commit.
- `npm run lint` et `npm run build` passent tous les deux.
- **Aucun chantier de code en cours.** Les 7 commits de cette session
  couvrent : intégration Replay FX, restylage de 7 modules, correction du
  mode modérateur Forum, robustesse serveur (JSON défensif +
  `forum_replies`), bornage du schéma quiz, réactivation du badge Prop
  Firm Challenge Ready, fonctionnalité Données & Sauvegarde.
- Aucun compte de test élève actif. Aucun verrouillage de compte actif.
  Aucune donnée de test résiduelle (quiz factice nettoyé, trades Replay FX
  de test nettoyés).
- **Aucun thread utilisateur en attente identifié** à ce jour — les trois
  sujets qui étaient en attente dans la version précédente de ce document
  (badge résiduel, Portefeuille, Données & Sauvegarde) sont tous clos.

### Par où commencer

1. Vérifier avec l'utilisateur s'il y a une tâche immédiate en tête (le
   document ci-dessus est une base de reprise, pas une feuille de route
   imposée).
2. Si rien de précis n'est demandé, il n'y a pas de point rapide évident à
   proposer cette fois-ci (contrairement à la version précédente de ce
   document) — tout ce qui était identifié comme en attente a été traité.
   Se contenter de demander directement ce sur quoi il veut travailler.

> Ce document est la **seule** source de reprise fiable. S'il existe un
> écart entre ce document et le code, **fais confiance au code** — vérifie
> par la lecture directe des fichiers sources, et corrige ce document en
> conséquence.
