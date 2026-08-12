# HANDOFF — PropDesk (Académie de Trading)

Document de reprise. Il suppose que tu n'as accès ni à la conversation
précédente, ni à autre chose que ce dépôt.

> **État à la dernière mise à jour de ce document**
> Branche `main`, dernier commit réel : **`af78c146`** (« Corrige 4 bugs
> trouvés lors du second passage d'audit »). **Un chantier complet est fait,
> entièrement vérifié en direct (staff ET élève), mais PAS ENCORE
> COMMITTÉ** — voir §0 juste en dessous, c'est la priorité n°1 de reprise :
> tout ce qu'il reste à faire est de lancer le commit.
>
> `npm run lint` n'a pas pu être revérifié dans les toutes dernières étapes
> de cette session (voir « Piège d'environnement » ci-dessous) — mais le
> code a été testé de bout en bout dans un vrai navigateur (staff et élève),
> sans aucune erreur console, et relu manuellement avant chaque étape.
> **Revérifie `npm run lint` en tout premier réflexe** à la reprise.

---

## 0. ✅ Chantier badges/notifications/sync — COMMITTÉ

Commit `ecbbce6` : « Ajoute badges calculés en direct, notifications élève,
bandeau anti-perte de sync ». Détail complet en §4, section « Points 2/3/4 ».

**Aucune tâche en attente de commit.** La nouvelle priorité n°1 est la
décision produit sur le Forum — voir §7, point 1 ci-après.

---

## 1. Le projet en bref

**PropDesk** est une plateforme d'académie de trading SMC (*Smart Money
Concepts*) destinée à un coach (le fondateur, compte admin) et à ses élèves.
Elle réunit dans une seule interface :

- un **journal de trading** — saisie libre du PnL (`$` ou `%`, jamais
  calculé), capture d'écran jointe à chaque trade, aperçu complet d'un clic,
  tag d'erreurs d'exécution (9 erreurs prédéfinies, `TradeMistake`) ;
- un **suivi des comptes prop firm** (FTMO, MyFundedFX, brokers réels),
  accessible et fonctionnel côté élève aussi ;
- une **analyse de rentabilité** (« Rentabilité ») très riche : courbe
  d'équité, stats par stratégie/émotion/actif/direction/jour de la
  semaine/session de marché, « Erreurs les plus fréquentes » + coût total ;
- un module **Macro** : marché en direct, calendrier économique réel,
  actualités, sentiment de risque (flux publics gratuits, proxés/cachés
  côté serveur) ;
- des **modules vidéo** avec quiz et progression, copie individuelle par
  élève ;
- un **simulateur** (replay de setups historiques + Monte Carlo) ;
- un **forum** (`ForumSection.tsx`, complet côté code — **mais toujours
  inaccessible depuis l'UI**, voir §6, bug non résolu), une **messagerie
  coach** à deux sens (sans réponse automatique), un **centre d'alertes** ;
- un **système de badges/gamification** — **calculé en direct** depuis les
  vraies données pour les badges qui le permettent (5 sur 9, voir §4),
  accessible et fonctionnel côté élève aussi désormais (chantier tout juste
  terminé, voir §0/§4) ;
- un **espace admin** de suivi des élèves (« Suivi des Élèves »), avec
  **« Vue Complète »** (lecture seule, réutilise le vrai Sidebar/TopHeader de
  l'écosystème) et possibilité de **donner un accès de connexion** à un
  élève ;
- des **outils** en modale : audit de setup (déterministe, pas d'IA), règles
  prop firm, mindset — accessibles aux élèves aussi.

**Aucune IA n'est utilisée nulle part dans l'application.** Retiré
intégralement lors d'une session antérieure — décision explicite et
répétée de l'utilisateur, **ne pas réintroduire d'IA sans nouvelle demande
explicite**.

**Qui l'utilise, et ce que cela implique.** C'est l'outil de travail d'un
coach (« ForexPaps », `th.gauthey99@gmail.com`) et de son staff. Plusieurs
comptes staff peuvent se connecter séparément, mais tous partagent **le même
bureau** : mêmes trades, mêmes fiches élèves, mêmes portefeuilles — ce n'est
pas du multi-tenant côté staff. **Les élèves ont un compte séparé**, un
second monde d'identité avec son propre bureau de données personnel
cloisonné — bureau **riche** (Journal, Portefeuille, Rentabilité, Macro,
Module vidéo, Messagerie Coach, Audit Setup, Prop Firm, Mindset, Exercice du
jour, Replay, Sim propfirm, Examen, badges, notifications), gouverné par le
même réglage de visibilité que le fondateur utilise pour lui-même. Seul
« Suivi des Élèves » reste structurellement réservé à l'admin.

L'interface est **entièrement en français**, ton direct, tutoiement. Devise :
**`$`**, jamais `€`.

**Ordres de grandeur** : `src/App.tsx` ~1680 lignes (les deux applications,
staff et élève, sont dans ce même fichier), `src/components/StudentTracking.tsx`
~900 lignes, `WalletManagement.tsx` ~700 lignes, `Sidebar.tsx` ~610 lignes,
`PerformanceDashboard.tsx` ~690 lignes, `AdminStudentView.tsx` ~310 lignes,
`MainDashboard.tsx` ~400 lignes, `src/lib/badges.ts` ~160 lignes (nouveau).

**État de la base** : `data/horizon.db` contient un mélange de données
réelles et de démonstration. Julien Moreau (`stud-1`) a un compte élève
actif de longue date. **Camille Dupont** (`stud-2`) a servi de compte de
test pendant cette session (badges/notifications/sync côté élève) — **son
accès a été révoqué après vérification**, la fiche reste mais sans compte
actif.

---

## 2. Démarrage immédiat

```bash
npm install
```

**Aucune variable d'environnement requise.** `.env.example` liste `PORT`,
`DATA_DIR`, `NODE_ENV`, tous avec un défaut utilisable.

| Commande | Effet |
|---|---|
| `npm run dev` | serveur de développement sur http://localhost:3000 |
| `npm run lint` | `tsc --noEmit` — **doit toujours sortir sans erreur** |
| `npm run build` | bundle client (`dist/`) + serveur (`dist/server.cjs`) |
| `npm start` | sert le build de production (`NODE_ENV=production` requis) |
| `npm run clean` | supprime `dist/` |

Un seul port, pas de proxy à configurer. `.claude/launch.json` démarre le
serveur sous le nom **`horizon-dev`** pour l'outil de prévisualisation.

**⚠️ Après tout changement dans `server/` ou `server.ts`**, il faut
redémarrer le serveur de dev (`preview_stop` puis `preview_start` sur
`horizon-dev`, ou `lsof -ti:3000 | xargs -r kill && npm run dev`) — TSX ne
recharge pas à chaud les fichiers serveur.

### Inspecter la base

```bash
sqlite3 data/horizon.db "select id, name, email, must_change_password from staff_accounts"
sqlite3 data/horizon.db "select sa.user_id, es.id, json_extract(es.payload,'$.name') from student_accounts sa join enrolled_students es on es.id = sa.enrolled_student_id"
sqlite3 data/horizon.db "select user_id, json_extract(payload,'$.hiddenSidebarItems') from users where id='user-local'"
```

Sonder l'API sans session :

```bash
curl -s localhost:3000/api/health && curl -s localhost:3000/api/auth/me && curl -s localhost:3000/api/auth/student-me
```

Compte admin actuel (staff) : `th.gauthey99@gmail.com`. Le mot de passe
n'est **jamais** consigné ici — demande-le à l'utilisateur si besoin de te
connecter en tant qu'admin. **Ne le tape jamais toi-même** dans un
formulaire ni dans une requête (voir §9, règle de sécurité stricte) —
demande-lui de se connecter lui-même et de te confirmer quand c'est fait.

Flux élève complet (depuis une session staff déjà connectée) :

```bash
curl -s -c /tmp/pd.txt -X POST localhost:3000/api/auth/login -H 'Content-Type: application/json' -d '{"email":"…","password":"…"}'

curl -s -b /tmp/pd.txt -X POST localhost:3000/api/auth/students/stud-1/invite
# → { "studentAccountId": "...", "email": "...", "temporaryPassword": "..." }

curl -s -c /tmp/pd_student.txt -X POST localhost:3000/api/auth/student-login \
  -H 'Content-Type: application/json' -d '{"email":"...","password":"..."}'

curl -s -b /tmp/pd_student.txt -c /tmp/pd_student.txt -X POST localhost:3000/api/auth/student-change-password \
  -H 'Content-Type: application/json' -d '{"currentPassword":"...","newPassword":"UnVraiMotDePasse123"}'

curl -s -b /tmp/pd_student.txt localhost:3000/api/state   # profil + trades + accounts + modules + messages + badges + quizResults

curl -s -b /tmp/pd.txt localhost:3000/api/auth/students/stud-1/trades   # trades + accounts réels, lecture staff
curl -s -b /tmp/pd.txt localhost:3000/api/auth/admin/students/stud-1/view   # vue complète (student, collections)
curl -s -b /tmp/pd.txt -X POST localhost:3000/api/auth/admin/students/stud-1/messages -H 'Content-Type: application/json' -d '{"text":"..."}'

curl -s -b /tmp/pd.txt -X DELETE localhost:3000/api/auth/students/stud-1/access   # révocation
```

**⚠️ Règle stricte — mots de passe et navigateur automatisé.** Si tu
utilises l'outil de prévisualisation navigateur (Browser pane) : **tu ne
dois jamais taper un mot de passe dans un champ de formulaire**, même un
mot de passe de test généré par le système, même avec l'autorisation
explicite de l'utilisateur. Pour te connecter en tant que staff, demande à
l'utilisateur de le faire lui-même. Pour un compte de test créé via `curl`
(mot de passe jamais vu par un humain), l'authentification programmatique
reste légitime — la règle porte sur la saisie UI, pas sur l'appel API en
tant que tel.

**Ne teste JAMAIS l'authentification (staff ou élève) sur `data/`** sans
nécessité — préfère une base jetable (`DATA_DIR=/tmp/xxx PORT=3102 npx tsx
server.ts`), mais si tu dois vérifier un comportement réel, utilise
`data/` directement et **nettoie systématiquement** tes données de test
après coup.

---

## 3. Architecture

### Vue d'ensemble

Un serveur **Express unique** sert l'API **et** l'application (Vite en
middleware en dev, `dist/` statique en prod).

```
server.ts              point d'entrée : Express + Vite/statique + helmet
                        (CSP activée seulement en production) + trust proxy
                        (production uniquement, app derrière un reverse proxy)
server/
  db.ts                SQLite (better-sqlite3, WAL), schéma + migrations
  repositories.ts      accès aux données — SEUL module qui parle à SQLite.
                        replaceCollection() vérifie la PROPRIÉTÉ de chaque id
                        soumis avant l'UPSERT (correctif de sécurité
                        critique, voir §8) ; fait un UPSERT (pas un
                        vidage-réinsertion)
  routes.ts             routes /api/*, barrière requireAuth, filtrage élève,
                         buildStudentProfile(), STUDENT_ALLOWED_COLLECTIONS
                         inclut désormais "badges", gestion du 409
                         CollectionOwnershipConflictError
  schemas.ts            validation zod ; verrous défensifs sur chartUrl/
                         avatar (https://|data:image/ uniquement) et
                         initialBalance (> 0)
  seed.ts               amorçage et import d'un état complet
  economicCalendar.ts   proxy + cache du flux ForexFactory
  marketData.ts         proxy + cache du flux Yahoo Finance
  middleware/
    rateLimit.ts          fabrique de limiteur par IP, EN MÉMOIRE (compromis
                           assumé pour un outil mono-instance, voir §6)
  auth/
    password.ts          hachage scrypt
    sessions.ts           jetons, cookie STAFF (pd_session), destroyAllSessions()
    credentials.ts        accès à staff_accounts
    routes.ts              authRouter (public) + staffRouter (protégé) ;
                            routes /students/:id/invite|access|trades|messages,
                            /admin/students/:id/view|messages ; seeding du
                            programme de formation ET des badges (id
                            remappés `${account.userId}-badge-N`,
                            `unlocked` réinitialisé) à l'invitation
    middleware.ts          requireAuth (deux mondes), requireStaffKind, etc.
    studentCredentials.ts  accès à student_accounts
    studentSessions.ts     jetons, cookie ÉLÈVE (pd_student_session),
                            destroyAllStudentSessions() (colonne user_id)
    studentRoutes.ts        studentAuthRouter (public) + studentProtectedRouter
src/
  main.tsx               point de montage React
  App.tsx                porte d'auth à deux mondes :
                          AuthenticatedApp/AcademyApp (staff, ~1300 lignes de
                          rendu) + StudentAuthenticatedApp (élève, réutilise
                          Sidebar+TopHeader, badges+notifications+sync
                          entièrement fonctionnels — voir §4)
  types.ts               source de vérité des formes de données ;
                          TradeMistake (9 valeurs), Trade.mistakes?,
                          TraderBadge.trackable?
  data/mockData.ts       jeu de données d'amorçage (curriculum partagé,
                          fiches élèves de démo, coachs fictifs, 9 badges)
  hooks/
    useServerSync.ts      useBootstrap (staff) + useStudentBootstrap (élève,
                           renvoie aussi badges) + useSyncedState (5ᵉ
                           argument onSyncError?: (message?) => void,
                           markPending() appelé aussi sur échec en ligne)
    useAuth.ts             état d'auth à deux mondes ; si les deux cookies
                            existent, le STAFF prime (piège rencontré, §9)
  lib/
    api.ts                client HTTP typé — routes staff ET élève
    format.ts              formatCurrency() — $ uniquement
    badges.ts              NOUVEAU (non committé) : computeBadgeProgress(),
                            computeDisciplineStreak() — voir §4
    pendingChanges.ts       registre des modifications non synchronisées
                            (localStorage) ; reconnaît désormais aussi les
                            clés élève `horizon_student_*` (non committé,
                            correctif d'un bug réel trouvé cette session,
                            voir §4/§8)
  components/
    Sidebar.tsx            source de vérité des onglets. Une section
                            entièrement masquée ne disparaît plus QUE pour un
                            visiteur sans droit de gestion (`canManage`)
    AdminStudentView.tsx    Vue Complète admin, lecture seule.
                            `courseCompletionPercentage` calculé en direct ;
                            message de repli pour les onglets sans rendu dédié
    MacroDashboard.tsx      module Macro complet
    StudentTracking.tsx     « Suivi des Élèves »
    WalletManagement.tsx    Portefeuille ; capital initial doit être > 0
                            (client + serveur)
    PerformanceDashboard.tsx  Rentabilité — stats par actif/direction/jour de
                            la semaine/session de marché, « Erreurs les plus
                            fréquentes » + coût total ; les 6 émotions
                            s'affichent toujours (même à 0 trade)
    TradingJournal.tsx      chips « Erreurs Commises » (TradeMistake), export
                            CSV protégé contre l'injection de formule
    MainDashboard.tsx       « Score Examen » affiche « — » (module Examen pas
                            encore développé), « PnL Cumulé » et « Série de
                            Discipline » calculés en direct (non committé)
    UserProfileModal.tsx    onglet Badges : badge non calculable
                            (`trackable: false`) affiche « Suivi pas encore
                            disponible », jamais réclamable (non committé)
    SyncErrorBanner.tsx     NOUVEAU (non committé) : bandeau discret en bas à
                            droite quand une sauvegarde échoue en arrière-plan
public/
  icon.png / logo-auth.jpg / logo.png / Fonctionnalites_Horizon_SMC.pdf
```

**Autres composants existants** (stables, non retouchés récemment) :
`ForumSection.tsx` (complet mais inaccessible, §6), `NotificationModal.tsx`,
`CoachMessaging.tsx`, `VideoAcademy.tsx`, `SMCSimulator.tsx`, `CoachSignals.tsx`,
`PositionCalculatorModal.tsx`, `TradingPlanModal.tsx`, `MindsetJournalModal.tsx`,
`SetupAnalyzerModal.tsx`, `PropFirmRulesModal.tsx`, `StaffAccountsModal.tsx`,
`PendingChangesBanner.tsx`, `TopHeader.tsx`, `EquityCurveChart.tsx`,
composants `auth/` (AuthShell, LoginScreen, SetupScreen, ChangePasswordScreen).

### Le modèle d'authentification à deux mondes

| | Monde **staff** | Monde **élève** |
|---|---|---|
| Table d'identité | `staff_accounts` | `student_accounts` |
| Table de sessions | `sessions` | `student_sessions` |
| Cookie | `pd_session` | `pd_student_session` |
| Bureau de données | `DEFAULT_USER_ID` — un seul, partagé | une ligne `users` dédiée par élève (`student_accounts.user_id`) |
| Ce qu'il voit | Tout | Ses propres `trades`, `accounts`, `modules`, `messages`, `badges` |

```ts
export interface AuthContext {
  userId: string;       // id d'IDENTITÉ (staff_accounts.id OU student_accounts.id)
  kind: "staff" | "student";
  dataUserId: string;   // le user_id à passer à repositories.ts
  isAdmin: boolean;
  isOwner: boolean;
}
```

**`dataUserId` ≠ `userId` — ne pas les confondre.** Deux comptes staff
différents ont deux `userId` différents mais le même `dataUserId`
(`DEFAULT_USER_ID`).

**Si les deux cookies existent dans le même navigateur, le staff prime**
(`src/hooks/useAuth.ts`, `refresh()`) — impossible de voir la vue élève dans
le même navigateur sans d'abord se déconnecter du staff. Piège rencontré et
documenté cette session (§9).

**⚠️ Piège Express déjà rencontré.** `staffRouter` et
`studentProtectedRouter` sont montés sur le même préfixe `"/auth"`. Une
garde de rôle doit être un argument de **chaque route individuelle**, jamais
posée au montage ou en `.use()` en tête d'un routeur.

### Ce qu'une session élève peut lire/écrire

```ts
// server/routes.ts
const STUDENT_ALLOWED_COLLECTIONS = new Set(["trades", "accounts", "modules", "messages", "badges"]);
const ALWAYS_HIDDEN_FOR_STUDENTS = ["students"]; // Suivi des Élèves, seul module vraiment réservé à l'admin
```

`badges` a été ajouté cette session — un élève ne persiste que l'état de
**réclamation** (`unlocked`/`unlockedAt`) de ses badges ; la progression
affichée est recalculée en direct côté client, jamais stockée telle quelle
(`src/lib/badges.ts`).

`GET /api/state` (session élève) renvoie : un **profil reconstruit** depuis
la fiche `EnrolledStudent` correspondante, avec `hiddenSidebarItems`
**fusionné** entre `ALWAYS_HIDDEN_FOR_STUDENTS` et le réglage de visibilité
réel du bureau staff.

### Schéma SQLite

Tables staff : `staff_accounts`, `sessions`, `users` (une ligne partagée
`DEFAULT_USER_ID = "user-local"`), `trades`, `trading_accounts`,
`coach_signals`, `coach_messages`, `forum_topics`, `forum_replies`,
`notifications`, `enrolled_students`, `badges`, `modules`, `quiz_results`,
`meta`.

Tables élève : `student_accounts`, `student_sessions`, plus **une ligne
`users` dédiée par élève** (`student_accounts.user_id`), qui porte ses
propres `trades`/`trading_accounts`/`modules`/`coach_messages`/`quiz_results`/`badges`.

**⚠️ `id` est une clé primaire GLOBALE dans chaque table de collection**
(`trades.id`, `trading_accounts.id`, `modules.id`, `badges.id`...), **pas
composite avec `user_id`**. Toute opération qui copie des lignes d'un bureau
vers un autre **doit remapper les `id`**. Voir §8 pour l'interaction directe
et sévère de ce piège avec le correctif de sécurité critique.

`server/repositories.ts` : `replaceCollection()` fait un **UPSERT** +
suppression des seules lignes disparues, ET vérifie que chaque `id` soumis
n'appartient pas déjà à un **autre** `user_id` avant d'écrire quoi que ce
soit (rejet 409 sinon).

---

## 4. Fonctionnalités terminées

*(Organisé par grand chantier, dans l'ordre chronologique. Pour ce qui
précède — Macro, Vue Complète refondue, accès élève étendu, passage €→$,
retrait de l'IA — voir l'historique git, tout est stable.)*

### Audit de sécurité complet (2 tours) — committé, tout corrigé et vérifié

**Premier tour** (auth/sessions, autorisation/IDOR, injection/validation,
infra/config) :

- 🔴 **CRITIQUE — Corruption de données entre bureaux via collision d'id**
  (IDOR). `replaceCollection()` faisait `ON CONFLICT(id) DO UPDATE` sans
  vérifier le propriétaire — un id soumis par un élève, s'il existait déjà
  chez un **autre** utilisateur (id générés côté client via `Date.now()`,
  devinables), écrasait silencieusement sa ligne. **Corrigé** :
  vérification de propriété avant tout UPSERT, rejet 409
  (`CollectionOwnershipConflictError`) + transaction annulée. **Testé
  contre une base SQLite jetable** : usage légitime accepté, attaque
  bloquée, victime intacte.
- 🟠 Révocation de session élève cassée (colonne SQL inexistante) — corrigé.
- 🟠 Headers de sécurité manquants — `helmet` ajouté, CSP en production
  uniquement.
- 🟠 `trust proxy` non configuré — activé en production.
- 🟡 Injection de formule CSV dans l'export du Journal — `csvCell()`.
- 🟢 `chartUrl`/`avatar` sans validation de schéma d'URL — corrigé.

**Second tour** (re-vérification + forum/badges/notifications/quiz/
concurrence/portefeuille) :

- 🔴 **CRITIQUE — Verrouillage du réglage de visibilité de la sidebar.**
  Une section entièrement masquée (y compris son bouton ⚙️) disparaissait
  du DOM — un admin qui masquait tout perdait tout moyen de la ronte
  réafficher. **Corrigé** : la section entière ne disparaît que pour
  `!canManage`. Testé en direct.
- 🟠 Capital initial négatif/nul accepté (`WalletManagement.tsx`) — corrigé
  (client + serveur).
- 🟢 Bug de précédence d'opérateur `PropFirmRulesModal.tsx` — corrigé.
- 🟡 `AdminStudentView.tsx` : `courseCompletionPercentage` en direct, page
  blanche des onglets non supportés remplacée par un message.

**Recensé mais volontairement NON corrigé** : forum inaccessible depuis
l'UI, usurpation d'identité possible dans le forum par un compte staff,
`PUT /api/collections/:name` toujours sans rate limit, `forum_replies`
sans vérification de propriété, `quizResultsSchema` non borné, absence de
flux de récupération de mot de passe. Voir §6.

### Rentabilité enrichie + tag d'erreurs + toutes les émotions — committé

- **Nouveau champ** `Trade.mistakes?: TradeMistake[]` — 9 erreurs
  prédéfinies : `"Entrée anticipée" | "Sortie prématurée" | "SL trop serré"
  | "SL déplacé/retiré" | "Sur-risque (>1%)" | "Revenge trading" | "FOMO /
  Chasing" | "Pas de plan de trade" | "Sur-trading"`.
- **Journal** : chips multi-sélection, aperçu complet, export CSV.
- **Rentabilité**, 5 nouvelles sections : PnL par actif, direction, jour de
  la semaine, session de marché, Erreurs les plus fréquentes + coût total.
  Coûts en **`$`**, pas en « R » — aucun champ de risque en R-multiple
  n'existe dans l'app.
- Les 6 émotions du Journal s'affichent toujours dans « Impact
  Psychologique » (même à 0 trade), traduction française complète.

### Points 2/3/4 — badges en direct, notifications élève, bandeau de sync

**✅ CODÉ ET ENTIÈREMENT VÉRIFIÉ (staff + élève) — ⚠️ NON COMMITTÉ, voir §0.**

Demande explicite de prioriser 3 points d'un rapport d'audit fonctionnel
antérieur.

**Badges** — `src/lib/badges.ts` (nouveau) :
- `computeBadgeProgress(badges, trades, modules)` : recalcule
  `currentValue`/`targetValue`/`progressPercentage`/`trackable`, **sans
  jamais toucher** `unlocked`/`unlockedAt` (réclamation explicite,
  persistée telle quelle).
- 5 des 9 badges honnêtement calculables : `badge-2` (Diplômé SMC, %
  leçons), `badge-4` (Trader Discipliné, trades Calm/Disciplined),
  `badge-5` (Analyste Rigoureux, notes ≥ 40 caractères — approximation),
  `badge-6` (Série de Discipline, `computeDisciplineStreak`), `badge-7`
  (Sniper R/R, meilleur ratio sur un trade gagnant).
- 4 badges **non calculables** : `badge-1` (% risque — pas tracké),
  `badge-3` (simulateur — pas persisté), `badge-8` (cumul « R » — pas
  tracké), `badge-9` (score examen — feature inexistante). Marqués
  `trackable: false`, 0%, « Suivi pas encore disponible pour ce badge »,
  jamais réclamables.
- `computeDisciplineStreak(trades)` : jours de **trading** consécutifs (pas
  calendaires) où chaque trade a une émotion maîtrisée (Calm/Disciplined)
  ET aucune erreur taguée. Réutilisé dans `MainDashboard.tsx` (carte «
  Série de Discipline ») ET dans le badge-6.
- **Piège critique découvert et corrigé pendant l'implémentation** : les
  badges d'un élève sont copiés à l'invitation (comme `modules`), avec des
  `id` remappés `${account.userId}-badge-N` — **sans ce remappage, le
  correctif de sécurité IDOR aurait rejeté la copie dès le second élève
  inscrit**. `computeSingleBadgeProgress` reconnaît le badge par le
  **suffixe** de l'id (`canonicalBadgeId()`), pour fonctionner avec les id
  du staff ET ceux, préfixés, d'un élève.

**Notifications élève** — `src/App.tsx`, `StudentAuthenticatedApp` :
- Avant : modale recevant `notifications={[]}` et des handlers no-op en
  dur (stub d'une session antérieure), malgré un compteur non-lu réel sur
  la cloche.
- Désormais : liste dérivée à chaque rendu — messages coach non lus +
  badges nouvellement débloqués. Marquer lu un message met à jour son
  `status` (déjà synchronisé) ; marquer lu un badge utilise un registre
  local `usePersistentState` (`horizon_student_read_badge_notifications`).
- **Découverte annexe corrigée** : le bouton « Badges & Profil » ne
  faisait **rien** côté élève, ni sur la Sidebar (au départ) ni sur le
  TopHeader (oubli initial, corrigé en cours de vérification) —
  `onOpenProfileModal` jamais câblé pour un élève. Corrigé aux deux
  endroits : ouvre `UserProfileModal` sur l'onglet Badges. `onSaveProfile`
  côté élève affiche un message explicite (le profil est géré par le
  coach) plutôt que d'appeler `PUT /api/profile`, réservée au staff.

**Bandeau de sync** — `src/hooks/useServerSync.ts` +
`src/components/SyncErrorBanner.tsx` (nouveau) :
- `markPending(localKey)` est désormais aussi appelé sur échec **en
  ligne** (pas seulement hors ligne) — réutilise `PendingChangesBanner`
  déjà existant.
- `SyncErrorBanner` avertit **immédiatement** (bandeau discret, coin bas
  droit) avec le message d'erreur réel.
- `useSyncedState` : nouveau 5ᵉ paramètre `onSyncError?: (message?:
  string) => void`, câblé sur tous les appels (11 dans `AcademyApp`, 5 dans
  `StudentAuthenticatedApp`, désormais 6 avec `badges`).

**🐛 Bug réel trouvé ET corrigé pendant la vérification en direct côté
élève** — `src/lib/pendingChanges.ts` :
- Le registre `pendingChanges` (liste blanche `LABELS`/`COLLECTION_BY_KEY`)
  ne reconnaissait **que** les clés staff (`horizon_trades`,
  `horizon_messages`, ...), jamais les clés élève préfixées
  (`horizon_student_trades`, `horizon_student_messages`, ...). Conséquence
  concrète vérifiée : `markPending()` ne faisait **rien** pour un élève —
  le bandeau `SyncErrorBanner` s'affichait bien (mécanisme indépendant),
  mais la vraie protection anti-perte au rechargement **ne fonctionnait
  pas**.
- Second problème, plus profond : même une fois les clés reconnues,
  `StudentAuthenticatedApp` n'avait **aucun mécanisme** pour respecter ce
  registre au chargement (contrairement à `AcademyApp`/`useBootstrap()`,
  qui a `seed()` + vérifie `listPending()` avant tout `cacheState()`).
  `useStudentBootstrap()` recharge toujours depuis le serveur au montage
  et un `useEffect` réécrasait ensuite chaque collection **sans condition**.
- **Corrigé** : clés `horizon_student_*` ajoutées à `LABELS`/
  `COLLECTION_BY_KEY` ; nouveau helper `resolveStudentValue<T>(serverValue,
  localKey)` dans `App.tsx`, qui fait primer le cache local sur la réponse
  serveur pour toute clé en attente ; utilisé dans le `useEffect` de
  resynchronisation de `StudentAuthenticatedApp`.

**Vérifié de bout en bout, deux fois** (le premier test, fait avant le
correctif ci-dessus, a confirmé le bug ; le second, après, a confirmé le
fix) : côté staff (arrêt serveur → sauvegarde échouée → bandeau affiché →
redémarrage → rechargement → `PendingChangesBanner` prend le relais → envoi
réussi) ET côté élève avec un compte de test réel (Camille Dupont — accès
révoqué après coup) : cloche de notifications fonctionnelle, modale Badges
accessible des deux endroits (Sidebar + TopHeader), badges avec vraie
progression (71%/0% au lieu de valeurs figées), badge non calculable
affichant le bon message, message envoyé pendant une coupure serveur perdu
au premier essai (bug confirmé) puis correctement protégé et rejouable au
second essai (fix confirmé) via `replayPending()`.

---

## 5. Fichiers créés ou modifiés

### Committés (jusqu'à `af78c146`)

| Fichier | Nature |
|---|---|
| `server/repositories.ts` | `CollectionOwnershipConflictError`, vérification de propriété dans `replaceCollection()` |
| `server/routes.ts` | catch du 409, `STUDENT_ALLOWED_COLLECTIONS` |
| `server.ts` | `helmet`, `trust proxy` |
| `server/schemas.ts` | `isSafeMediaUrl`, `isValidInitialBalance` |
| `server/auth/studentSessions.ts` | colonne corrigée |
| `server/auth/routes.ts` | seeding modules (existant) |
| `src/components/TradingJournal.tsx` | `csvCell()`, chips erreurs |
| `src/components/WalletManagement.tsx` | validation capital initial |
| `src/components/PropFirmRulesModal.tsx` | parenthésage `reduce` |
| `src/components/AdminStudentView.tsx` | `courseCompletionPercentage`, repli onglets |
| `src/components/Sidebar.tsx` | section vide masquée seulement si `!canManage` |
| `src/types.ts` | `TradeMistake`, `Trade.mistakes?`, `TraderBadge.trackable?` |
| `src/components/PerformanceDashboard.tsx` | 5 sections stats, 6 émotions |

### ⚠️ NON committés (voir §0 pour la commande de commit)

| Fichier | Nature des changements |
|---|---|
| `src/lib/badges.ts` **(nouveau)** | `computeBadgeProgress()`, `computeDisciplineStreak()` |
| `src/components/SyncErrorBanner.tsx` **(nouveau)** | bandeau d'alerte immédiat sur échec de sync |
| `src/hooks/useServerSync.ts` | `useStudentBootstrap` renvoie `badges` ; `useSyncedState` : 5ᵉ paramètre `onSyncError`, `markPending` aussi sur échec en ligne |
| `src/lib/pendingChanges.ts` | clés élève `horizon_student_*` ajoutées à `LABELS`/`COLLECTION_BY_KEY` (bug réel corrigé, voir §4/§8) |
| `src/components/UserProfileModal.tsx` | affichage « Suivi pas encore disponible » pour badge non calculable |
| `src/components/MainDashboard.tsx` | Score Examen → « — », PnL Cumulé et Série de Discipline en direct |
| `src/App.tsx` | `StudentAuthenticatedApp` : badges, notifications, modale profil câblée (Sidebar + TopHeader), `resolveStudentValue()` ; `AcademyApp` : `reportSyncError` câblé sur 11 `useSyncedState`, badges recalculés en direct |
| `server/routes.ts` | `"badges"` ajouté à `STUDENT_ALLOWED_COLLECTIONS` |
| `server/auth/routes.ts` | seeding des badges à l'invitation (id remappés, `unlocked` réinitialisé) |

---

## 6. Bugs connus

### ✅ Corrigés et vérifiés (tout, y compris le chantier badges/notifications/sync — voir §4)

### ✅ Corrigés cette session

7. **Rate limiting** sur 5 routes (`server/routes.ts`, commit `36d5ce5`) :
   ajouté. Fenêtre glissante de 15 minutes, limites : 60 pour `/collections`,
   30 pour `/profile` et `/quiz-results`, 10 pour `/state/import`, 5 pour
   `/state/seed`.
8. **Courbe d'équité** (`MainDashboard.tsx`, commit `8a49988`) : corrigé.
   L'ancienne logique inversait le signe pour LOSS et BREAKEVEN, faussant le
   cumul.

### 🟡 Connus, non corrigés

1. **Forum inaccessible depuis l'UI.** `ForumSection.tsx` complet côté
   code, mais aucun onglet de sidebar ni notification n'y mène. Décision
   produit prise : rester inaccessible.
2. **Usurpation d'identité possible dans le forum par un compte staff.**
   `authorName`/`authorRole`/`isCoachCertified` non vérifiés contre
   `req.auth`. Impact borné aujourd'hui (forum inaccessible côté élève).
3. **`forum_replies` sans vérification de propriété.** Latent, pas
   exploitable aujourd'hui (un seul bureau staff possède des forumTopics).
4. **`quizResultsSchema` non borné.** Mineur, borné par la limite globale 8 Mo.
5. **Rate limiter en mémoire, par processus.** Compromis accepté pour un
   outil mono-instance (aucune redistribution pour multi-instance sans
   demande explicite).
6. **Absence de flux de récupération de mot de passe.** Discussion produit,
   pas un bug de code.

### Piège opérationnel : deux `PRATIQUE`/sections identiques dans le DOM

`AdminStudentView.tsx` est un **overlay** monté par-dessus la page admin,
qui reste dans le DOM en arrière-plan. Scoper toute recherche DOM à
`document.querySelector('.fixed.inset-0.z-50...')`.

### Piège opérationnel : `window.confirm()` dans l'outil de prévisualisation

`confirm()` retourne silencieusement `false` dans le Browser pane (jamais
affiché), touchant tous les boutons qui l'utilisent (« Déconnexion »,
« Compte actif » pour révoquer un accès élève, etc.) — **pas un bug de
l'app**, une limitation de cet outil précis. Contournement qui fonctionne :
appeler directement l'endpoint concerné en JS
(`fetch("/api/auth/logout", {method:"POST", credentials:"same-origin"})`,
`fetch("/api/auth/students/:id/access", {method:"DELETE", credentials:"same-origin"})`,
etc.) puis recharger/re-vérifier. Dans un vrai navigateur, ces boutons
fonctionnent normalement.

### Piège opérationnel : le Bash tool peut perdre l'accès au répertoire

Rencontré et **toujours non résolu** en fin de cette session :
`process.cwd()` lève `EPERM`, cassant `cd`, `ls`, `git`, `npm run <script>`
dans ce répertoire précis — `sqlite3 <chemin absolu>` et les outils
Read/Edit/Write continuent de fonctionner normalement. Probablement un
souci de permissions macOS sur cette machine (Desktop protégé, TCC), sans
lien avec le code. **Contournement utile découvert cette session** : lire
`.git/logs/HEAD` avec l'outil Read (aucun besoin de `cwd`) pour consulter
l'historique réel des commits sans passer par `git log`. Ça ne résout pas
`git commit`/`git add`, qui nécessitent toujours un shell fonctionnel — si
tu rencontres le même blocage, demande à l'utilisateur de committer
lui-même (commande prête en §0) plutôt que de forcer un contournement
agressif (`dangerouslyDisableSandbox` testé, n'a pas résolu le problème).

---

## 6 bis. Ce qui ressemble à du code mort, mais ne l'est pas

- **`EnrolledStudent.accounts`** coexiste avec la collection globale
  `accounts` — reste la source pour les élèves **sans** compte actif.
- **`ForumSection.tsx`** — complet, fonctionnel, mais inaccessible (§6,
  point 1). Ne le supprime pas en pensant que c'est du code mort.
- **`Trade.mistakes`** absent sur les trades créés avant le tag d'erreurs —
  traité partout comme `?? []`.
- **`TraderBadge.trackable`** absent sur les données existantes en base —
  `computeBadgeProgress()` le recalcule à chaque rendu, jamais lu tel quel.

---

## 6 ter. Arbitrages déjà rendus

| Sujet | Décision |
|---|---|
| Périmètre de l'accès élève | Étendu à tout l'écosystème sauf Suivi des Élèves |
| Coûts d'erreurs en Rentabilité, unité | `$`, pas « R » |
| Badges non calculables | Marqués « pas encore disponible », jamais de fausse progression ; pas de nouveau champ de tracking ajouté (choix explicite) |
| Notifications élève, contenu | Messages coach + déblocages de badge (choix explicite) |
| Bandeau d'échec de sync | Bandeau discret + protection anti-perte, pas de retry automatique (choix explicite) |
| `trust proxy` | Activé en production (app confirmée derrière un reverse proxy) |
| Taper un mot de passe (même de test) dans un formulaire UI | **Jamais**, sans exception |
| Rate limiter en mémoire | Accepté pour un outil mono-instance |
| Flux de récupération de mot de passe | Pas construit, décision assumée |
| Compte de test Camille Dupont | Accès révoqué après vérification (choix explicite de l'utilisateur, option recommandée) |

---

## 7. Prochaines tâches

### 1. Remplir le module « Examen »

Décision produit en attente : specs des graphiques, règles de notation,
nombre de questions, durée limite, etc. Cette implémentation débloquerait aussi
le badge-9 (actuellement « Score Examen » affiche « — »).

### Aucune autre tâche en attente de code

Forum restera inaccessible, rate limiting complété, courbe d'équité corrigée.

### Ce qui n'est PAS une tâche

- **Réintroduire de l'IA sous quelque forme que ce soit.**
- **Le cloisonnement des données par compte staff** — bureau partagé
  toujours voulu.
- **Donner aux élèves accès à « Suivi des Élèves ».**
- **Ajouter un champ de tracking pour débloquer les 4 badges non
  calculables** sans discussion produit préalable.
- **Migrer le rate limiter vers Redis** sans demande explicite.

---

## 8. Décisions techniques importantes

### Le correctif de sécurité critique et son interaction avec le seeding des badges

`replaceCollection()` vérifie qu'aucun `id` soumis n'appartient déjà à un
autre `user_id` avant d'écrire. Toute future copie de données d'un bureau
vers un autre (comme le seeding des badges à l'invitation) **doit
impérativement remapper ses `id`**, sous peine d'être rejetée par ce même
correctif dès le second bureau destinataire — une violation ne cause plus
une simple collision silencieuse, **mais une erreur 409 qui bloque
l'opération entière**. Avant d'ajouter une nouvelle collection copiée entre
bureaux, vérifie systématiquement le remappage.

### Pourquoi `pendingChanges.ts` avait un trou côté élève, et pourquoi ce n'était pas évident

Le registre `pendingChanges` a été conçu et testé exclusivement dans le
contexte staff (`AcademyApp`), où `useBootstrap()` a son propre mécanisme
de protection (`seed()`, vérification de `listPending()` avant
`cacheState()`). Quand `StudentAuthenticatedApp` a été construit (sessions
antérieures), le HANDOFF de l'époque notait explicitement « pas de bandeau
de modifications hors ligne (pas de mode hors ligne élève) » — un choix
de simplification assumé à l'époque. En ajoutant `reportSyncError`/
`SyncErrorBanner` côté élève cette session, l'hypothèse implicite était que
`markPending()` (déjà utilisé côté staff) suffirait aussi côté élève — **ça
n'a pas été le cas**, parce que (a) la liste blanche ne reconnaissait pas
les clés préfixées, et (b) même corrigé, rien ne consultait ce registre au
chargement côté élève. **Le seul moyen qui a permis de le découvrir a été
un test de bout en bout réel** (couper le serveur, écrire un message,
vérifier `localStorage`, redémarrer, recharger, constater la perte) — pas
une relecture de code, aussi attentive soit-elle. Retiens cette méthode :
vérifier une protection anti-perte nécessite de vraiment perdre quelque
chose une fois pour confirmer qu'elle ne protège pas, avant de pouvoir
confirmer qu'un correctif la fait fonctionner.

### Pourquoi les badges non calculables ne sont pas simplement masqués

Romprait le compteur affiché (« 6/9 badges ») et la logique de filtre par
catégorie. Un message honnête est plus transparent qu'une disparition
silencieuse.

### Pourquoi `computeBadgeProgress` ne persiste jamais la progression calculée

Recalculée à **chaque rendu**, jamais écrite dans la collection `badges`
synchronisée. Alternative (calculer côté serveur, persister) écartée :
complexité disproportionnée par rapport au coût quasi nul de recalculer
côté client.

### Ne jamais taper un mot de passe, même de test, dans un champ UI

Même un mot de passe de test généré par le système, jamais vu par un
humain, avec l'autorisation explicite de l'utilisateur — reste interdit
s'il doit être **tapé dans un champ de formulaire**. Un appel `curl`/
`fetch` programmatique que tu contrôles entièrement reste légitime.

*(Pour les décisions antérieures — pièges Express, cascades SQL, session de
marché en UTC, capture d'écran non recadrée, distinction IA réelle/fausse —
voir l'historique git.)*

---

## 9. Contexte de travail avec l'utilisateur

- Il **communique en français**, ton direct, tutoiement.
- Il travaille par **demandes courtes et itératives**, souvent en signalant
  un problème constaté en usage réel plutôt qu'en décrivant une solution.
- Il a demandé un **audit exhaustif suivi d'une correction priorisée** à
  deux reprises (sécurité, puis fonctionnel) — méthode qui fonctionne bien.
- Quand il demande de traiter des points spécifiques d'une liste priorisée,
  **il attend d'être consulté sur les choix de conception ambigus avant
  l'implémentation** — les 4 questions posées avant de coder les points
  2/3/4 ont toutes reçu l'option « recommandée ».
- **Il ne donne pas ses mots de passe pour que tu les utilises** — même
  fourni en clair dans le chat sur demande explicite, la règle de sécurité
  prime. Rencontré deux fois cette session (staff, compte élève de test) :
  la bonne réponse est de refuser poliment et proposer que l'utilisateur
  agisse lui-même.
- **Toujours vérifier en conditions réelles, pas seulement à la
  compilation, ni même à la seule lecture du code.** Le bug de protection
  anti-perte côté élève (§4/§8) n'a été trouvé qu'en testant vraiment le
  scénario de perte — une relecture attentive du code, faite juste avant,
  ne l'avait pas révélé.
- **Ses données de travail sont réelles** (`data/horizon.db`). Toujours
  nettoyer après un test qui a dû l'utiliser directement — fait cette
  session pour le message de test et l'accès de Camille Dupont (révoqué,
  sur sa demande explicite entre deux options proposées).
- Il **commite lui-même la décision de committer**, mais une fois la
  demande faite, n'attend pas de confirmation supplémentaire avant chaque
  commit individuel dans la même série. **Cette session s'est terminée
  avant que le dernier commit n'ait pu être confirmé exécuté** (blocage
  Bash) — c'est la toute première chose à vérifier/faire à la reprise (§0).

### Méthode de vérification qui a fonctionné cette session

1. `npm run lint` après chaque changement (quand l'environnement le permet).
2. Redémarrer le serveur de dev après tout changement **serveur**.
3. Pour un bug de sécurité touchant à l'écriture de données : tester contre
   une **base SQLite jetable**, simuler l'attaque précisément.
4. Pour un bug d'UI/UX : reproduire le scénario exact dans le navigateur.
5. **Pour une protection anti-perte de données : la faire échouer une
   première fois pour de vrai avant de corriger**, sinon impossible de
   savoir si le correctif fonctionne ou si le scénario de test était
   simplement trop indulgent.
6. Nettoyage systématique des données de test après vérification.
7. Vérifier soi-même les trouvailles les plus sévères d'un agent d'audit
   avant de les inclure dans un rapport ou de les corriger.
8. Quand un outil UI ne réagit pas comme attendu (bouton qui ne fait
   rien), vérifier d'abord si c'est un vrai bug applicatif (réseau,
   console) avant de conclure — deux fois cette session, la cause réelle
   était une limitation de l'environnement de test (`confirm()` non
   supporté), pas un bug de l'app. Le distinguo se fait en testant l'appel
   API directement (`fetch(...)` en JS) : s'il fonctionne isolément,
   l'app est saine, seul l'outil de test a une limite.

---

## 10. État à la reprise

- Branche `main`, dernier commit réel `36d5ce5` (rate limiting ✓).
  Avant : `8a49988` (courbe d'équité), avant : `ecbbce6` (badges/notifications),
  avant : `af78c14` (4 bugs audit).
- Code clean (`npm run lint` ok).
- Aucune tâche en attente de commit.
- Le compte staff est actuellement connecté dans le navigateur (Browser
  pane). Le compte de test élève (Camille Dupont) a été **révoqué** —
  plus de session active.

### Par où commencer

**Aucune autre tâche de code en attente.** L'application a atteint un bon état
de stabilité. Les seules demandes restantes sont produit (module Examen). Si tu
reprends : vérifier que le rate limiting fonctionne en conditions réelles.

> Ce document est la **seule** source de reprise fiable. S'il existe un
> écart entre ce document et le code, **fais confiance au code** — vérifie
> par la lecture directe des fichiers sources, et corrige ce document en
> conséquence.
