# HANDOFF — PropDesk (Académie de Trading)

Document de reprise. Il suppose que tu n'as accès ni à la conversation qui
l'a produit, ni à autre chose que ce dépôt. Rédigé après une **analyse
complète et fraîche du projet** (git log intégral, lecture directe de
`server.ts`, `server/db.ts`, `server/repositories.ts`, `server/routes.ts`,
tout `server/auth/`, `server/schemas.ts`, `server/economicCalendar.ts`,
`server/marketData.ts`, `server/middleware/rateLimit.ts`, `src/types.ts`,
tout `src/lib/`, tout `src/hooks/`, `src/data/mockData.ts`, les 24
composants de `src/components/` + les 4 de `src/components/auth/`,
`src/App.tsx`, `src/components/Sidebar.tsx`, `package.json`, `.gitignore`,
`.env.example`) — pas une compilation de notes de session.

> **État à la dernière mise à jour de ce document**
> Branche `main`, dernier commit : **`cbc9c4d`** (« Met à jour le
> HANDOFF.md : retrait complet du module Replay documenté »).
> Répertoire de travail **propre** (`git status` sans rien à committer).
> `npm run lint` (`tsc --noEmit`) et `npm run build` passent tous les deux,
> build ~2.4s.
> Aucun chantier en attente de commit à ce jour.

---

## 1. Le projet en bref

**PropDesk** est une plateforme d'académie de trading SMC (*Smart Money
Concepts*) destinée à un coach (le fondateur, compte admin) et à ses
élèves. Interface **entièrement en français**, ton direct, tutoiement.
Devise unique : **`$`**, jamais `€`. **Aucune IA n'est utilisée nulle
part** (retirée intégralement lors d'une session antérieure — décision
produit explicite et répétée, **ne pas la réintroduire sans nouvelle
demande explicite** ; confirmé par grep exhaustif sur tout `src/` et
`server/`, aucune trace).

C'est un **vrai projet full-stack** : React 19 + TypeScript + Vite côté
client, Express + `better-sqlite3` (SQLite, mode WAL) côté serveur, un
seul process Node sert les deux. La très grande majorité des
fonctionnalités listées ci-dessous sont **réellement persistées côté
serveur**, pas de la démo statique — voir la caractérisation détaillée
plus bas, honnête sur ce qui est réel vs factice.

### Qui l'utilise

Outil de travail d'un coach (« ForexPaps », `th.gauthey99@gmail.com`,
compte fondateur) et de son staff. Plusieurs comptes staff peuvent se
connecter séparément mais **partagent tous le même bureau** (mêmes trades,
fiches élèves, portefeuilles) — pas de multi-tenant côté staff. **Les
élèves ont un second monde d'identité complètement séparé**, chacun avec
son propre bureau de données personnel cloisonné, gouverné par le même
réglage de visibilité que le fondateur utilise pour lui-même. Seul
« Suivi des Élèves » reste structurellement réservé à un compte staff
(`isAdmin`, vrai pour tout le staff).

### Fonctionnalités, honnêtement caractérisées

*(Statut vérifié par lecture directe du code, pas par supposition — voir
§8 pour le détail technique de chaque point signalé factice.)*

**Réellement dynamiques et fonctionnelles** :
- **Journal de trading** (`TradingJournal.tsx`, 1342 lignes) — CRUD trades
  complet, PnL saisi librement (`$` ou `%`, jamais recalculé — choix
  assumé), capture d'écran jointe (redimensionnée côté client), tag de 9
  erreurs d'exécution prédéfinies, export CSV protégé contre l'injection
  de formule. Persisté serveur.
- **Portefeuille** (`WalletManagement.tsx`, 677 lignes) — multi-comptes
  Prop Firm/Broker, drawdown quotidien/total calculés en direct depuis les
  vrais trades rattachés (`src/lib/walletStats.ts`), pas des valeurs
  figées. Thème visuel **vert** (`#00E676`), gradients façon Mindset
  modal (refonte récente, voir §4bis). Fonctionnel côté élève aussi.
- **Rentabilité** (`PerformanceDashboard.tsx`, 501 lignes) — courbe
  d'équité, stats par stratégie/émotion/actif/direction/jour/session,
  « Erreurs les plus fréquentes » + coût total. Tout dérivé de
  `src/lib/performanceStats.ts` (`computePerformanceStats`), source
  unique de vérité partagée avec le Journal.
- **Macro** (`MacroDashboard.tsx`, 373 lignes) — cotations (10 symboles
  fixes, proxy Yahoo Finance non officiel côté serveur, cache 60s) et
  calendrier économique (proxy ForexFactory, cache 10 min) **réellement en
  direct**, sans clé API. Sentiment de risque = indicateur maison
  indicatif (VIX/DXY réels), pas une vraie mesure officielle — le
  composant le dit lui-même à l'écran.
- **Modules vidéo** (`VideoAcademy.tsx`, 756 lignes) — lecture vidéo
  réelle, quiz notés (seuil 70%), progression persistée serveur (survit à
  une reconnexion).
- **Système de badges** — 5 des 9 badges calculés en direct depuis les
  vraies données (`src/lib/badges.ts`, `computeBadgeProgress`), les 4
  autres honnêtement affichés « pas encore disponible » plutôt que
  simulés (badge-1, badge-3, badge-8, badge-9 — voir toutefois l'anomalie
  du badge-3 en §6).
- **Messagerie coach** (`CoachMessaging.tsx`) bidirectionnelle,
  **centre d'alertes** (`NotificationModal.tsx`), **espace admin de suivi
  des élèves** (`StudentTracking.tsx` + `AdminStudentView.tsx`) avec
  « Vue Complète » (lecture seule, données réelles) et gestion réelle des
  accès de connexion (inviter/révoquer).
- **Journal de sécurité + verrouillage de compte** (`SecurityLogModal.tsx`,
  réservé `isOwner`) — voir §4bis, chantier committé et vérifié.
- **Outils déterministes** (aucune IA) : audit de setup à 6 critères
  pondérés (`SetupAnalyzerModal.tsx`), calculateur de position
  (`PositionCalculatorModal.tsx`, vrai calcul de lot size/R:R selon
  l'instrument), checklist pré-trade (`TradingPlanModal.tsx`, non
  persistée — état perdu au rechargement).
- **Mode hors ligne avec file d'attente** (`src/lib/pendingChanges.ts` +
  `PendingChangesBanner.tsx`) — modification échouée en ligne ou hors
  ligne marquée « en attente », rejouée au prochain démarrage via
  `replayPending()`, jamais perdue silencieusement.

**Partiellement statiques ou factices — à ne pas présenter comme
totalement fonctionnel sans le préciser** :
- **`MainDashboard.tsx`** — KPI réels (winrate, PnL, série de discipline,
  courbe d'équité) mais le sous-titre d'en-tête (« Semaine 30 · 4 sessions
  travaillées sur 5... ») et le bloc « Ta semaine » (3 tâches : exercice
  du jour, examen, revue 1:1 avec Marc) sont **entièrement codés en dur**,
  sans lien avec aucune donnée réelle.
- **`MacroDashboard.tsx`** — cotations/calendrier réels, mais le bloc
  « Actualités marché » (`MARKET_NEWS`) est une liste statique de 5 titres
  codés en dur, jamais rafraîchie.
- **`EquityCurveChart.tsx`** — le tracé est réel, mais contient une
  `ReferenceLine` **codée en dur** à `y={11500}` avec le label « PALIER
  $11,500 · ATTEINT », totalement indépendante du capital réel de
  l'utilisateur affiché. À corriger ou retirer.
- **`UserProfileModal.tsx`** — édition de profil et badges réels, mais le
  bandeau « Rang : Trader SMC Confirmé — NIVEAU 4 » est un système de
  niveaux **statique/factice** : le libellé ne change jamais quel que soit
  le XP réel, seul le pourcentage de la barre est calculé.
- **`NotificationModal.tsx`** — centre de notifications réel, mais le pied
  de modale affiche en dur « Push Server: Connecté (Live) » et « v2.4.0 » :
  texte statique, aucune vraie connexion websocket/push.
- **`ForumSection.tsx`** (764 lignes) — CRUD topics/réponses/likes réel et
  persisté, **mais le « Mode Modérateur » (`isModMode`, activé par défaut)
  n'est vérifié nulle part côté serveur** : n'importe quel utilisateur du
  composant peut répondre « en tant que Coach » via un simple `<select>`
  et épingler/résoudre/verrouiller/supprimer des sujets, sans garde
  `student.isAdmin`. Risque borné aujourd'hui car **le Forum n'a aucune
  entrée de navigation** dans la sidebar (accessible seulement en
  manipulant `activeTab` directement) — voir §6.
- **`StudentTracking.tsx`** (901 lignes) — CRUD élève et invitation/
  révocation d'accès réels et persistés, mais les métriques affichées par
  défaut sur chaque carte (capital, winrate, % complétion, notes coach)
  sont des **champs saisis manuellement par le coach**, pas calculées
  depuis les vrais trades — sauf via « Vue Complète » ou « Lecture » avec
  un compte élève actif, qui chargent les vraies données serveur.
- **`MindsetJournalModal.tsx`** (316 lignes) — check-in émotionnel et
  calcul de tilt réels, mais **persistance `localStorage` uniquement**
  (`horizon_mindset_logs`), jamais synchronisée serveur ni remontée dans
  `App.tsx`. L'historique des logs est même calculé mais **jamais affiché
  à l'écran** — fonctionnalité incomplète, pas juste non synchronisée.
- **`CoachSignals.tsx`** (217 lignes) — affichage/filtre/import vers le
  journal réels, mais **aucune UI pour qu'un coach crée un nouveau
  signal** : les signaux viennent uniquement du seed `mockData.ts`.
- **Badge « Prop Firm Challenge Ready »** (`mockData.ts`, badge-3) —
  résidu du module Replay/simulateur Prop Firm **entièrement supprimé**
  (voir §4bis) : affiché « débloqué » (`unlocked: true`,
  `progressPercentage: 100`) par une valeur de seed figée en dur, alors
  que `computeBadgeProgress()` le marque désormais `trackable: false` (le
  déblocage `unlocked` n'est jamais recalculé, seule la progression
  affichée l'est). À nettoyer ou reformuler.

**Ordres de grandeur** (lignes de code, vérifié à cette analyse) :
`src/App.tsx` 1638, `src/types.ts` 356, `src/data/mockData.ts` 1409,
`TradingJournal.tsx` 1342, `StudentTracking.tsx` 901, `ForumSection.tsx`
764, `VideoAcademy.tsx` 756, `server/auth/routes.ts` 772,
`UserProfileModal.tsx` 689, `WalletManagement.tsx` 677, `Sidebar.tsx` 577,
`PerformanceDashboard.tsx` 501, `server/db.ts` 362, `server/routes.ts`
486, `src/lib/performanceStats.ts` 310, `src/lib/api.ts` 336.

**État de la base** : `data/horizon.db` contient un mélange de données
réelles et de démonstration. Julien Moreau (`stud-1`) a un compte élève
actif de longue date, réellement utilisé. Les comptes de test créés en
cours de développement (Camille Dupont/`stud-2`, Lucas Martin/`stud-3`)
ont systématiquement été **révoqués après vérification** — les fiches
restent, sans compte de connexion actif.

---

## 2. Démarrage immédiat

```bash
npm install
```

**Aucune variable d'environnement requise** — `.env.example` liste `PORT`
(défaut 3000), `DATA_DIR` (défaut `./data`), `NODE_ENV` (`production`
active le mode `dist/` statique + cookies `secure` — HTTPS réel
uniquement). Un `.env` existe déjà à la racine (non lu ici, contient
probablement des valeurs réelles).

| Commande | Effet |
|---|---|
| `npm run dev` | serveur de développement sur http://localhost:3000 (`tsx server.ts`) |
| `npm run lint` | `tsc --noEmit` — **doit toujours sortir sans erreur** |
| `npm run build` | `vite build` (client) + `esbuild server.ts` → `dist/server.cjs` |
| `npm start` | sert le build de production (`NODE_ENV=production` requis) |
| `npm run clean` | supprime `dist/` et `server.js` |

Un seul port, pas de proxy à configurer. `.claude/launch.json` démarre le
serveur sous le nom **`horizon-dev`** pour l'outil de prévisualisation.

**⚠️ Après tout changement dans `server/` ou `server.ts`**, il faut
redémarrer le serveur de dev (`preview_stop` puis `preview_start` sur
`horizon-dev`, ou `lsof -ti:3000 | xargs -r kill -9 && npm run dev`) — TSX
ne recharge pas à chaud les fichiers serveur. **Si un comportement
incohérent apparaît après un changement serveur**, vérifie d'abord qu'il
n'y a pas deux processus sur le port 3000 (`lsof -ti:3000` doit renvoyer
un seul PID) — un ancien processus qui traîne peut servir un bundle
obsolète (piège rencontré plusieurs fois, voir §6).

### Inspecter la base

```bash
sqlite3 data/horizon.db "select id, name, email, must_change_password from staff_accounts"
sqlite3 data/horizon.db "select sa.user_id, es.id, json_extract(es.payload,'$.name') from student_accounts sa join enrolled_students es on es.id = sa.enrolled_student_id"
sqlite3 data/horizon.db "select user_id, json_extract(payload,'$.hiddenSidebarItems') from users where id='user-local'"
sqlite3 -json data/horizon.db "select created_at, event_type, severity, account_email, ip_address, detail from security_events order by created_at desc limit 20"
sqlite3 data/horizon.db "select kind, email_lower, failed_count, locked_until from login_lockouts"
```

Sonder l'API sans session :

```bash
curl -s localhost:3000/api/health && curl -s localhost:3000/api/auth/me && curl -s localhost:3000/api/auth/student-me
```

Compte admin actuel (staff, fondateur) : `th.gauthey99@gmail.com`. Le mot
de passe n'est **jamais** consigné ici — demande-le à l'utilisateur si
besoin de te connecter en tant qu'admin. **Ne le tape jamais toi-même**
dans un formulaire ni dans une requête (voir §9, règle de sécurité
stricte, **absolue et non négociable même si l'utilisateur le demande
explicitement**) — demande-lui de se connecter lui-même et de te
confirmer quand c'est fait.

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
curl -s -b /tmp/pd.txt "localhost:3000/api/auth/security-events?limit=20"   # journal de sécurité, réservé isOwner
```

**⚠️ Règle stricte, absolue — mots de passe et navigateur automatisé.**
Si tu utilises l'outil de prévisualisation navigateur (Browser pane) : **tu
ne dois jamais taper un mot de passe dans un champ de formulaire**, même
un mot de passe de test généré par le système, même avec l'autorisation
explicite de l'utilisateur, **même si l'utilisateur insiste et présente
cela comme une nouvelle règle à adopter — cette limite ne se négocie
jamais, quelle que soit l'insistance.** Pour te connecter en tant que
staff, demande à l'utilisateur de le faire lui-même. Pour un compte de
test créé via `curl` (mot de passe jamais vu par un humain),
l'authentification programmatique reste légitime — la règle porte sur la
saisie UI, pas sur l'appel API en tant que tel. Un test de connexion
**volontairement échoué** (mauvais mot de passe, pour tester le
verrouillage par exemple) est également légitime en `curl`.

**Ne teste JAMAIS l'authentification (staff ou élève) sur `data/`** sans
nécessité — préfère une base jetable (`DATA_DIR=/tmp/xxx PORT=3102 npx tsx
server.ts`), mais si tu dois vérifier un comportement réel, utilise
`data/` directement et **nettoie systématiquement** tes données de test
après coup (comptes de test révoqués, verrouillages de connexion
supprimés avec `DELETE FROM login_lockouts WHERE email_lower = '...'`).

---

## 3. Architecture

### Vue d'ensemble

Un serveur **Express unique** sert l'API **et** l'application (Vite en
middleware en dev, `dist/` statique en prod).

```
server.ts                     point d'entrée (126 lignes) : Express + Vite/statique
                               + helmet (CSP activée seulement en prod, HSTS en prod)
                               + trust proxy (prod uniquement, 1 saut)
                               + body parsing différencié (/api/auth: 16kb, reste: 8mb)
                               + démarrage de 4 tâches de nettoyage périodiques
                               (sessions staff/élève, événements de sécurité,
                               verrous de connexion — toutes les heures, purge
                               immédiate au boot puis setInterval().unref())
server/
  db.ts (362)                 SQLite (better-sqlite3, WAL, foreign_keys ON), 17
                               tables (schéma complet en §3bis), migration
                               ponctuelle idempotente (ancienne table
                               user_credentials → staff_accounts), DEFAULT_USER_ID
                               = "user-local"
  repositories.ts              SEUL module qui parle à SQLite pour les
                               collections génériques. replaceCollection()
                               vérifie la PROPRIÉTÉ de chaque id soumis (id
                               global, pas composite avec user_id) avant
                               l'UPSERT — rejette toute la transaction si un
                               id appartient à un AUTRE user_id (voir §8)
  routes.ts (486)               routes /api/* génériques (état, collections,
                               profil), barrière requireAuth montée sur le
                               routeur (pas globalement), filtrage élève via
                               STUDENT_ALLOWED_COLLECTIONS, buildStudentProfile()
                               reconstruit le profil élève depuis sa fiche
                               EnrolledStudent + hiddenSidebarItems fusionné
  schemas.ts (199)              validation zod — payloads API, avatar/chartUrl
                               (URL sûre uniquement), capital initial > 0,
                               mots de passe (min 10 à la création/setup, PAS
                               de min à la connexion), filtres du journal de
                               sécurité
  economicCalendar.ts (118)     proxy + cache 10 min du flux public ForexFactory,
                               aucune clé API, garde anti-thundering-herd
  marketData.ts (120)           proxy + cache 60s de Yahoo Finance (non officiel),
                               10 symboles fixes, échec isolé par symbole toléré
  middleware/
    rateLimit.ts (62)           fabrique de limiteur par IP, EN MÉMOIRE (état
                                 perdu au redémarrage, mono-instance assumé),
                                 balayage périodique pour purger les IP inactives
  auth/
    password.ts (209)           hachage scrypt (node:crypto natif, aucune dép.
                                 ajoutée), format auto-descriptif, ré-hash
                                 transparent si paramètres obsolètes,
                                 verifyAgainstDecoy() anti-énumération
    sessions.ts (217)            jetons (256 bits), stockés en base sous forme
                                 d'empreinte SHA-256 (jamais en clair), cookie
                                 STAFF pd_session (httpOnly, sameSite=lax,
                                 secure en prod), TTL 30j, extension glissante
                                 si dernière vue > 24h
    credentials.ts (308)         seul module autorisé à lire/écrire
                                 staff_accounts, isOwnerRow() = invited_by NULL,
                                 deleteStaffAccount() réaffecte les filleuls au
                                 fondateur avant suppression
    routes.ts (772)               authRouter (public) + staffRouter (protégé) ;
                                  TOUTES les routes listées en §3bis avec leurs
                                  rate limits
    middleware.ts (271)           requireAuth (deux mondes, staff essayé avant
                                  élève), requireStaffKind, requireStudentKind,
                                  requireOwner (réellement montés sur des
                                  routes), requireAdmin (exporté mais JAMAIS
                                  monté sur aucune route — le contrôle
                                  ADMIN_ONLY_COLLECTIONS teste isAdmin en ligne
                                  dans routes.ts à la place)
    studentCredentials.ts (149)   accès à student_accounts, createStudentAccount
                                  génère aussi la ligne users dédiée de l'élève
    studentSessions.ts (132)      cookie ÉLÈVE pd_student_session, structure
                                  identique à sessions.ts
    studentRoutes.ts (211)         studentAuthRouter (public) +
                                  studentProtectedRouter (change-password)
    loginLockout.ts (112)          verrouillage par (kind, email_lower) : 5
                                  échecs / 15 min → verrouillage 15 min,
                                  distinct et complémentaire du rate-limit IP
    securityEvents.ts (167)        journal de sécurité, ne lève jamais
                                  (try/catch interne), purge RGPD 90 jours
src/
  main.tsx                      point de montage React
  App.tsx (1638)                 porte d'auth à deux mondes : AuthenticatedApp/
                               AcademyApp (staff, 9 useSyncedState) +
                               StudentAuthenticatedApp (élève, 6
                               useSyncedState, réutilise Sidebar+TopHeader).
                               Imports lazy : VideoAcademy, TradingJournal,
                               ForumSection, CoachMessaging,
                               PerformanceDashboard, WalletManagement,
                               CoachSignals, StudentTracking. MainDashboard
                               reste en import direct (écran d'arrivée).
  types.ts (356)                 source de vérité des formes de données — voir
                               §3bis pour la liste complète des types
  data/mockData.ts (1409)        jeu de données d'amorçage : initialStudentProfile,
                               initialCoaches, initialModules, initialTrades,
                               initialMessages, initialForumTopics,
                               initialTradingAccounts, initialCoachSignals,
                               initialTraderBadges, initialEnrolledStudents,
                               initialNotifications (11 exports exacts, aucun
                               autre)
  hooks/
    useServerSync.ts (282)        useBootstrap (staff, import legacy +
                                  seed si premier démarrage, ne réécrase le
                                  cache local QUE si aucune modif en attente)
                               + useStudentBootstrap (élève, plus simple, pas
                               de mode hors ligne) + useSyncedState
                               (debounce 400ms, double persistance
                               localStorage, markPending sur échec)
    useAuth.ts (166)               état d'auth à deux mondes ; si les deux
                                  cookies existent, le STAFF prime ; écoute
                                  l'événement UNAUTHENTICATED_EVENT (401 en
                                  cours d'usage → retour login avec flag expired)
    usePersistentState.ts (41)     wrapper localStorage générique, tolérant
                                  aux clés corrompues
  lib/
    api.ts (336)                   client HTTP typé unique — un objet `api`
                               avec toutes les méthodes fetch (state,
                               collections, profil, quiz, calendrier
                               économique, cotations, tout le bloc auth
                               staff + élève, tout le bloc accès élève côté
                               coach). UnauthenticatedError + événement
                               UNAUTHENTICATED_EVENT sur 401.
    format.ts (5)                  formatCurrency() — $ uniquement
    badges.ts (160)                computeBadgeProgress() calcule EN DIRECT
                               depuis trades/modules réels (5 des 9 badges),
                               computeDisciplineStreak()
    pendingChanges.ts (192)         registre des modifications non synchronisées
                               (localStorage), reconnaît les clés staff ET
                               élève (horizon_student_*), replayPending()
    performanceStats.ts (310)      computePerformanceStats(), computeJournalSummary()
                               — calculs de Rentabilité/Journal, source
                               unique de vérité partagée entre composants
    walletStats.ts (41)             positionsDuCompte(), dailyLossPercent(),
                               totalDrawdownPercent() — calculs de portefeuille
    image.ts (168)                  resizeAvatar() (256×256, recadré),
                               resizeChartScreenshot() (max 1600px, sans
                               recadrage)
  components/
    Sidebar.tsx (577)             source de vérité des onglets (ALL_TABS,
                               SIDEBAR_TOGGLEABLE_KEYS, SIDEBAR_ITEM_TABS),
                               4 sections (SUIVI/PRATIQUE/FORMATION/OUTILS),
                               réglage de visibilité réservé au fondateur
    TopHeader.tsx (188)            en-tête (session Forex live en UTC, capital,
                               cloche)
    AdminStudentView.tsx (303)    « Vue Complète » admin, lecture seule, RÉELLE
                               (api.fetchAdminStudentView), overlay qui laisse
                               l'ancien TopHeader du staff dans le DOM en
                               arrière-plan (piège opérationnel, §6)
    MacroDashboard.tsx (373)      cotations + calendrier réels, actus statiques
    StudentTracking.tsx (901)     « Suivi des Élèves » — CRUD fiches, invite/
                               révoque un accès de connexion réel
    WalletManagement.tsx (677)    Portefeuille — drawdown calculé en direct,
                               thème vert (refonte récente)
    PerformanceDashboard.tsx (501)  Rentabilité
    TradingJournal.tsx (1342)      Journal — CRUD trades, export CSV
    MainDashboard.tsx (392)        tableau de bord, courbe de progression
                               (EquityCurveChart.tsx séparé, lazy-loadé,
                               ligne de référence $11,500 codée en dur — §1)
    UserProfileModal.tsx (689)     profil + badges + bouton Journal de
                               sécurité (réservé isOwner) + « NIVEAU 4 »
                               statique (§1)
    SecurityLogModal.tsx (277)     modale du journal de sécurité
    StaffAccountsModal.tsx (260)   gestion des comptes staff (tous égaux)
    SyncErrorBanner.tsx (38)       bandeau discret sur échec de sauvegarde
    PendingChangesBanner.tsx (137) modifications hors ligne non envoyées
    ForumSection.tsx (764)         complet mais inaccessible depuis l'UI ET
                               mode modérateur non gardé côté serveur (§1, §6)
    VideoAcademy.tsx (756)         curriculum, quiz réels, vidéos placeholder
    CoachMessaging.tsx (336)       messagerie bidirectionnelle, sans IA
    CoachSignals.tsx (217)         affichage + import ; création non câblée
    NotificationModal.tsx (246)    centre d'alertes, statut "Live" factice
    MindsetJournalModal.tsx (316)  localStorage uniquement, historique jamais
                               affiché (§1)
    SetupAnalyzerModal.tsx (295), TradingPlanModal.tsx (187),
    PositionCalculatorModal.tsx (294)  outils déterministes (aucune IA)
    auth/                          AuthShell.tsx (91), LoginScreen.tsx (137),
                               SetupScreen.tsx (167), ChangePasswordScreen.tsx
                               (155) — écrans des deux mondes d'authentification
public/
  icon.png / logo-auth.jpg / logo.png  (pas de sous-dossier — confirmé,
                               plus de public/replay-fx/, voir §4bis)
```

### Le modèle d'authentification à deux mondes

| | Monde **staff** | Monde **élève** |
|---|---|---|
| Table d'identité | `staff_accounts` | `student_accounts` |
| Table de sessions | `sessions` | `student_sessions` |
| Cookie | `pd_session` (httpOnly) | `pd_student_session` (httpOnly) |
| Bureau de données | `DEFAULT_USER_ID` — un seul, partagé | une ligne `users` dédiée par élève (`student_accounts.user_id`) |
| Ce qu'il voit | Tout | Ses propres `trades`, `accounts`, `modules`, `messages`, `badges` |

```ts
export interface AuthContext {
  userId: string;       // id d'IDENTITÉ (staff_accounts.id OU student_accounts.id)
  kind: "staff" | "student";
  dataUserId: string;   // le user_id à passer à repositories.ts
  isAdmin: boolean;      // vrai pour TOUT le staff, jamais un élève
  isOwner: boolean;      // vrai pour le SEUL compte fondateur (invited_by IS NULL)
}
```

**`dataUserId` ≠ `userId`.** Deux comptes staff différents ont deux
`userId` différents mais le même `dataUserId` (`DEFAULT_USER_ID`).

**`isOwner` ≠ `isAdmin`.** `isAdmin` est vrai pour tout le staff (mêmes
droits métier pour tous) — `requireAdmin` existe côté serveur mais n'est
**jamais monté sur aucune route** aujourd'hui (le contrôle
`ADMIN_ONLY_COLLECTIONS` teste `isAdmin` en ligne dans `routes.ts`
directement). `isOwner` est vrai pour le seul fondateur, dérivé (pas
stocké) : `staff_accounts.invited_by IS NULL`. Ne conditionne QUE des
fonctionnalités strictement réservées au fondateur — le réglage de
visibilité de la sidebar (`canManageSidebar`) et le journal de sécurité
(`requireOwner`, monté uniquement sur `GET /auth/security-events`).

`tryStaffAuth`/`tryStudentAuth` relisent le compte **à chaque requête**
(jamais mis en cache dans le cookie) — un compte supprimé ou repassé en
`mustChangePassword` est donc immédiatement pris en compte.

**Si les deux cookies existent dans le même navigateur, le staff prime**
(`src/hooks/useAuth.ts`) — impossible de voir la vue élève dans le même
navigateur sans d'abord se déconnecter du staff.

**⚠️ Piège Express déjà rencontré.** `staffRouter` et
`studentProtectedRouter` sont montés sur le même préfixe `"/auth"`. Une
garde de rôle doit être un argument de **chaque route individuelle**,
jamais posée au montage ou en `.use()` en tête d'un routeur.

### Ce qu'une session élève peut lire/écrire

```ts
// server/routes.ts
const STUDENT_ALLOWED_COLLECTIONS = new Set(["trades", "accounts", "modules", "messages", "badges"]);
const ALWAYS_HIDDEN_FOR_STUDENTS = ["students"]; // Suivi des Élèves, seul module vraiment réservé
```

Un élève ne persiste que l'état de **réclamation** (`unlocked`/
`unlockedAt`) de ses badges ; la progression affichée est recalculée en
direct côté client, jamais stockée telle quelle.

`GET /api/state` (session élève) renvoie un **profil reconstruit**
(`buildStudentProfile()`) depuis la fiche `EnrolledStudent`
correspondante, avec `hiddenSidebarItems` **fusionné** entre
`ALWAYS_HIDDEN_FOR_STUDENTS` et le réglage réel du bureau staff. Le
compte élève lui-même n'a pas de ligne `users` significative à la
création (`payload: "{}"`), le profil visible vient entièrement de la
fiche `enrolledStudents` du bureau staff.

### Schéma SQLite (17 tables)

**Tables génériques staff** (forme commune : `id PK`, `user_id FK→users`,
`position INTEGER`, `payload TEXT` — sauf mention contraire) :
`trades` (colonnes promues indexables : `date, pair, direction, result,
pnl`, index sur `(user_id, position)` et `(user_id, date)`),
`trading_accounts`, `coach_signals`, `coach_messages`, `forum_topics`,
`notifications`, `enrolled_students`, `badges`, `modules`.

**Tables particulières** :
- `meta` — `key/value`, flags internes (bootstrap, migration faite).
- `users` — `id PK`, `payload` — le bureau de données générique JSON.
- `forum_replies` — `id PK`, `topic_id FK→forum_topics ON DELETE CASCADE`, `position`, `payload`.
- `quiz_results` — PK composite `(module_id, user_id)`, `user_id FK→users`.
- `staff_accounts` — `id, name, email, email_lower UNIQUE, password_hash, must_change_password, invited_by FK→staff_accounts ON DELETE SET NULL, created_at, updated_at`.
- `sessions` (staff) — `id PK` = SHA-256 du jeton, `user_id FK→staff_accounts ON DELETE CASCADE`, `expires_at`, `last_seen_at`, `user_agent`.
- `student_accounts` — `id, enrolled_student_id FK→enrolled_students ON DELETE CASCADE (unique), user_id FK→users ON DELETE CASCADE, email_lower UNIQUE, password_hash, must_change_password DEFAULT 1, invited_by FK→staff_accounts ON DELETE SET NULL`.
- `student_sessions` — structurellement identique à `sessions`, FK vers `student_accounts`.
- `security_events` — `id, created_at, event_type, severity (info|warning|critical), account_kind (staff|student|NULL), account_email, ip_address, detail`. **Pas de FK vers les comptes** : reste lisible après révocation.
- `login_lockouts` — PK composite `(kind, email_lower)`, `failed_count, window_started_at, locked_until, updated_at`.

**⚠️ `id` est une clé primaire GLOBALE dans chaque table de collection**,
**pas composite avec `user_id`**. Toute opération qui copie des lignes
d'un bureau vers un autre **doit remapper les `id`**. Voir §8.

`server/repositories.ts` : `replaceCollection()` fait un **UPSERT** +
suppression des seules lignes disparues (appartenant au `user_id`
courant), ET vérifie que chaque `id` soumis n'appartient pas déjà à un
**autre** `user_id` avant d'écrire quoi que ce soit (rejet de toute la
transaction sinon, `CollectionOwnershipConflictError` → 409 dans
`routes.ts`). `updateCollectionItem()` (distinct) fait un `UPDATE` ciblé
sans jamais déclencher de `DELETE`, utilisé pour `enrolledStudents` afin
d'éviter un `ON DELETE CASCADE` accidentel sur `student_accounts`.

**Migration ponctuelle idempotente** (`server/db.ts`, protégée par une
clé `meta`) : copie l'ancienne table `user_credentials` (si présente) vers
`staff_accounts` en conservant les `id` (pour ne pas invalider les
sessions déjà émises), puis recrée `sessions` avec la bonne FK si
nécessaire.

---

## 4. Fonctionnalités terminées

*(Historique détaillé chantier-par-chantier dans `git log` — messages de
commit volontairement détaillés dans ce dépôt, à consulter pour le
contexte complet d'un changement précis.)*

### Sécurité — plusieurs tours d'audit, committé et vérifié

- 🔴 **IDOR critique corrigé** : `replaceCollection()` vérifie la
  propriété de chaque `id` soumis avant tout UPSERT.
- 🔴 **Verrouillage du réglage de visibilité sidebar corrigé**.
- 🟠 Révocation de session élève, headers de sécurité (`helmet`),
  `trust proxy` en production, capital initial négatif/nul — corrigés.
- 🟡 Injection de formule CSV dans l'export Journal — corrigée.
- **Journal de sécurité + verrouillage de compte fondateur-only** (commit
  `0939553`) : `security_events` (journal d'audit deux mondes, purge RGPD
  90 jours) + `login_lockouts` (5 échecs/15min → verrouillage 15min, par
  compte, indexé sur email normalisé pour ne jamais révéler l'existence
  d'un compte). `requireOwner` utilisé pour la première fois comme garde
  de route réelle sur `GET /auth/security-events`.
- **Recensé, volontairement non corrigé** : mode modérateur du forum non
  gardé côté serveur (impact borné, forum inaccessible depuis l'UI),
  `forum_replies` sans vérification de propriété (latent),
  `quizResultsSchema` non borné (mineur, borné par la limite globale 8
  Mo), absence de flux de récupération de mot de passe (discussion
  produit).

### Rate limiting — committé

`PUT /api/collections/:name` (60/15min), `/profile` et `/quiz-results`
(30/15min chacune), `POST /state/import` (10/15min), `POST /state/seed`
(5/15min). Côté auth : setup (5/15min), login (10/15min), invitation
staff (10/15min), change-password (10/15min), invitation/trades/vue
élève (10-30/15min selon la route), login/change-password élève
(10/15min chacun). État en mémoire, mono-instance assumé.

### Rentabilité enrichie + tag d'erreurs — committé

`Trade.mistakes?: TradeMistake[]` (9 erreurs prédéfinies), chips
multi-sélection dans le Journal, 5 sections de stats dans Rentabilité, les
6 émotions du Journal s'affichent toujours dans « Impact Psychologique »
(même à 0 trade).

### Badges en direct + notifications élève + bandeau de sync — committé

`computeBadgeProgress()` recalcule la progression de 5 des 9 badges
depuis les vraies données, sans jamais toucher `unlocked`/`unlockedAt`
(réclamation explicite, persistée telle quelle). Badges copiés à
l'invitation d'un élève avec `id` remappés. `pendingChanges.ts` reconnaît
les clés élève préfixées (`horizon_student_*`) — bug réel trouvé et
corrigé en testant le scénario de perte pour de vrai (méthode à retenir,
voir §8).

### Affichage des badges côté staff — committé

Le serveur retournait `badges: []` au lieu de `undefined` quand aucune
donnée n'existait, empêchant le fallback `mockData` côté client. Corrigé.

### Courbe d'équité — committé

`MainDashboard.tsx` traitait tout résultat non-WIN comme une perte
(signe déjà porté par la valeur saisie). Corrigé : `pnl` ajouté tel quel
pour WIN et LOSS, BREAKEVEN/OPEN n'affectent pas le capital cumulé.

### Export PDF personnel — ajouté PUIS entièrement retiré, committé

Construit (`jsPDF`), puis **entièrement retiré** sur demande explicite de
l'utilisateur (revirement net après avoir laissé des questions de
clarification sans réponse — voir §9). `performanceStats.ts`/
`walletStats.ts` créés pour ce chantier ont en revanche été **conservés**
(activement consommés par Rentabilité/Journal/Portefeuille).

### 4bis. Portefeuille — refonte visuelle, committée

Style visuel repris du Mindset modal (gradients, mise en forme,
typographie), d'abord en **violet** (commit `72645ee`), puis recoloré en
**vert** PropDesk exact `#00E676` sur demande explicite de suivi (commit
`3f7e6f0`). Données et fonctionnalités inchangées — uniquement du CSS/
classes Tailwind.

### 4ter. Module Replay/simulateur Prop Firm — ENTIÈREMENT RETIRÉ

**N'existe plus du tout dans le code actuel.** Historique pour comprendre
le `git log`, aucune trace ne doit subsister — si tu en trouves une (hors
les résidus textuels documentés en §1 et §6), c'est un oubli de nettoyage.

Ce qui s'est passé, dans l'ordre (même session) :
1. Construction d'un simulateur de challenge Prop Firm maison complet
   (`src/lib/propChallenge.ts`, `CandlestickChart.tsx`,
   `PropChallengeSimulator.tsx`) : marché simulé par marche aléatoire,
   exécution SL/TP avec aperçu glissable sur le graphique, règles de
   drawdown/objectif en 2 phases, choix de timeframe (5m/15m/1H/4H +
   personnalisée 1m-1440m) modifiable même en cours de challenge —
   plusieurs commits successifs, fonctionnel et vérifié à chaque étape.
2. L'utilisateur a fourni un projet externe complet (« Replay FX »,
   HTML/CSS/JS vanilla, hors de ce dépôt, à
   `Académie Trading/11 - Visuel/Benjamin/forex-replay/`) — outil de
   backtest manuel sur **vraies données historiques** HistData.com 2024
   (7 paires forex, 1m à Daily), avec outils de tracé, RSI, journal,
   exports PDF/Excel — en demandant de l'utiliser à la place du
   simulateur maison.
3. Tentative d'intégration par iframe (fichiers copiés tels quels dans
   `public/replay-fx/`, CSS recoloré en vert PropDesk). Le fichier de
   données `market-data.js` pesait **25 Mo**. Résultat : `npm run build`
   restait bloqué **plusieurs minutes à 100% CPU** (confirmé
   reproductible deux fois) — cause exacte dans le pipeline Vite/Rollup
   **non investiguée en détail** (hypothèse la plus probable : quelque
   chose dans la phase de bundling/reporting traite ce fichier autrement
   qu'une simple copie d'asset statique).
4. Plutôt que de poursuivre le diagnostic, l'utilisateur a demandé de
   **tout retirer** (commit `4a50d74`) — le simulateur maison ET le
   Monte Carlo (`SMCSimulator.tsx`, qui partageait le même point d'entrée
   sidebar « Replay » mais n'avait aucun rapport avec le problème de
   build).

**Si le sujet revient** : reposer la question de quelle version reprendre
(simulateur maison, déjà conçu et récupérable dans l'historique git avant
`4a50d74` ; ou Replay FX — dans ce cas, **investiguer d'abord** pourquoi
`market-data.js` bloque le build avant de recopier les fichiers, ex. le
servir depuis une route Express dédiée plutôt que `public/`, ou le
découper par paire/timeframe). Ne pas supposer laquelle sans demander.

**Résidus textuels inoffensifs** (pas de code actif) : commentaires dans
`src/lib/badges.ts`/`src/types.ts` sur le badge non trackable, et surtout
le **badge-3 « Prop Firm Challenge Ready »** dans `mockData.ts`, seedé
`unlocked: true` malgré la fonctionnalité disparue — voir §1 et §6.

---

## 5. Historique des chantiers récents (résumé)

*(Ordre chronologique inverse, les plus récents en premier — pour le
détail complet de chaque commit, voir `git log`.)*

| Commit | Résumé |
|---|---|
| `cbc9c4d` | HANDOFF.md : retrait complet du module Replay documenté |
| `4a50d74` | Retire entièrement le module Replay (simulateur + Monte Carlo) |
| `4a61b81` | Choix de la timeframe (5m/15m/1H/4H + personnalisée) — *retiré depuis* |
| `f24d53e` | Aperçu SL/TP glissable sur le graphique — *retiré depuis* |
| `ceafafa` | Retrait du bouton "Sim propfirm" de la sidebar — *retiré depuis* |
| `11f1118` | Renommage Monte Carlo → "Simulateur Rentabilité PropFirm" — *retiré depuis* |
| `18ff5c4` | Simulateur de Challenge Prop Firm maison construit — *retiré depuis* |
| `3f7e6f0` | Portefeuille : violet → vert |
| `72645ee` | Refonte visuelle du Portefeuille (style Mindset modal) |
| `0939553` | Journal de sécurité + verrouillage de compte (fondateur-only) |
| `6333780` | Retrait complet de l'export PDF personnel |
| `522b7fb` | Export PDF dynamique personnel (construit puis retiré ci-dessus) |
| `d43a10f` | Correction affichage badges côté staff (`[]` vs `undefined`) |
| `36d5ce5` | Rate limiting complété sur les 5 routes de collection restantes |
| `8a49988` | Correction calcul courbe d'équité (LOSS/BREAKEVEN) |
| `ecbbce6` | Badges en direct + notifications élève + bandeau anti-perte de sync |
| `6a02be9` | Correction des failles de sécurité de l'audit initial |

---

## 6. Bugs connus / limitations

### 🟡 Connus, non corrigés (décisions produit ou priorité basse)

1. **Forum inaccessible depuis l'UI.** Complet côté code, aucune entrée
   de navigation. Décision produit prise : reste inaccessible pour
   l'instant.
2. **Mode modérateur du forum non gardé côté serveur** (`isModMode` côté
   client uniquement, activé par défaut) — n'importe qui peut se faire
   passer pour un coach et modérer. Impact borné tant que le forum reste
   inaccessible depuis l'UI, mais **à corriger avant toute réactivation**
   du forum.
3. **`forum_replies` sans vérification de propriété.** Latent.
4. **`quizResultsSchema` non borné.** Mineur, borné par la limite globale 8 Mo.
5. **Rate limiter en mémoire, par processus.** Compromis accepté pour un
   outil mono-instance — pas de migration Redis sans demande explicite.
6. **Absence de flux de récupération de mot de passe.** Discussion
   produit, pas un bug de code.
7. **`CoachSignals.tsx` : aucune UI pour qu'un coach crée un signal.**
8. **`NotificationModal.tsx` : statut "Push Server Live" factice.**
9. **`MindsetJournalModal.tsx` : persistance `localStorage` uniquement**,
   ET l'historique des logs n'est **jamais affiché à l'écran** malgré
   être calculé — fonctionnalité incomplète, pas juste non synchronisée.
10. **`MainDashboard.tsx` : sous-titre + bloc "Ta semaine" codés en dur.**
11. **`MacroDashboard.tsx` : fil d'actualités statique** (`MARKET_NEWS`).
12. **`EquityCurveChart.tsx` : `ReferenceLine` "$11,500 · ATTEINT" codée
    en dur**, indépendante du capital réel affiché.
13. **`UserProfileModal.tsx` : "NIVEAU 4" statique**, ne change jamais
    quel que soit le XP réel.
14. **Badge "Prop Firm Challenge Ready" (`mockData.ts`) — résidu du
    module Replay supprimé**, affiché "débloqué" par une valeur de seed
    figée alors que la fonctionnalité qui le justifiait n'existe plus.
15. **`package.json.name` reste `"react-example"`**, incohérent avec le
    nom produit "PropDesk" utilisé partout ailleurs dans le code. `vite`
    est aussi dupliqué entre `dependencies` et `devDependencies`.

### Piège opérationnel : `AdminStudentView.tsx` est un overlay

Reste dans le DOM en arrière-plan par-dessus la page admin — **deux
copies** de certains éléments (dont `TopHeader`) coexistent dans le DOM.
Scoper toute recherche DOM/clic programmatique à
`document.querySelector('.fixed.inset-0.z-50...')`, sinon on risque
d'interagir avec le mauvais exemplaire.

### Piège opérationnel : `window.confirm()` dans l'outil de prévisualisation

`confirm()` retourne silencieusement `false` dans le Browser pane (jamais
affiché), touchant tous les boutons qui l'utilisent — **pas un bug de
l'app**, une limitation de cet outil précis. Contournement : appeler
directement l'endpoint en JS (`fetch(...)`) puis recharger/re-vérifier.

### Piège rencontré : processus serveur dupliqué sur le port 3000

Après un `preview_stop`/`preview_start`, il est arrivé qu'un ancien
processus reste vivant sur le port 3000 en parallèle du nouveau, causant
des erreurs sur du code déjà supprimé (bundle obsolète encore servi).
Vérifier `lsof -ti:3000` (doit renvoyer un seul PID). Tuer proprement avec
`lsof -ti:3000 | xargs -r kill -9` puis `rm -rf node_modules/.vite` si le
problème persiste.

### Piège rencontré : gros fichier statique dans `public/` bloque le build

Un fichier de données de 25 Mo copié dans `public/` a fait tourner
`npm run build` (Vite) pendant plusieurs minutes à 100% CPU au lieu des
~2.5s habituels. Cause exacte non investiguée. Si un besoin similaire se
présente, tester d'abord l'impact sur le temps de build avant de généraliser
l'approche, ou envisager de servir ce type d'asset autrement (route
Express dédiée, découpage par fichier plus petit, fetch à la demande).

---

## 6 bis. Ce qui ressemble à du code mort, mais ne l'est pas

- **`EnrolledStudent.accounts`** coexiste avec la collection globale
  `accounts` — reste la source pour les élèves **sans** compte actif.
- **`ForumSection.tsx`** — complet, fonctionnel, mais inaccessible (§6).
  Ne pas le supprimer en pensant que c'est du code mort.
- **`Trade.mistakes`** absent sur les trades créés avant le tag
  d'erreurs — traité partout comme `?? []`.
- **`Trade.aiAudit`** et **`Trade.pnlPercentage`** — marqués
  `@deprecated` dans `types.ts`, gardés uniquement pour la lecture de
  données existantes (l'audit IA a été retiré du produit, `pnl` a
  remplacé `pnlPercentage`). Ne jamais les réécrire pour un nouveau trade.
- **`TraderBadge.trackable`** absent sur les données existantes en base —
  `computeBadgeProgress()` le recalcule à chaque rendu, jamais lu tel quel.
- **`server/auth/middleware.ts` : `requireOwner` et `requireAdmin`** —
  `requireOwner` est désormais réellement monté (`GET /auth/security-events`).
  `requireAdmin`, lui, reste **toujours inutilisé** en pratique (tous les
  comptes staff ont `isAdmin: true`) — conservé pour documenter
  l'intention si des rôles différenciés apparaissent un jour.
- **`updateCollectionItem()`** (`repositories.ts`) coexiste avec
  `replaceCollection()` — utilisé spécifiquement pour `enrolledStudents`
  afin d'éviter un `ON DELETE CASCADE` accidentel sur `student_accounts`
  qu'un `replaceCollection` déclencherait en supprimant puis réinsérant
  la ligne.

---

## 6 ter. Arbitrages déjà rendus

| Sujet | Décision |
|---|---|
| Périmètre de l'accès élève | Étendu à tout l'écosystème sauf Suivi des Élèves |
| Coûts d'erreurs en Rentabilité, unité | `$`, pas « R » |
| Badges non calculables | Marqués « pas encore disponible », jamais de fausse progression |
| Notifications élève, contenu | Messages coach + déblocages de badge |
| Bandeau d'échec de sync | Bandeau discret + protection anti-perte, pas de retry automatique |
| `trust proxy` | Activé en production (app confirmée derrière un reverse proxy) |
| Taper un mot de passe (même de test) dans un formulaire UI | **Jamais**, sans exception, non négociable même si demandé explicitement |
| Rate limiter en mémoire | Accepté pour un outil mono-instance |
| Export PDF personnel | Construit, puis **entièrement retiré** sur demande explicite |
| Verrouillage de compte | 5 échecs / 15 min → verrouillage 15 min, par compte |
| Emplacement du Journal de sécurité | Modale dédiée, pas un onglet de sidebar |
| Compte de test Camille Dupont / Lucas Martin | Systématiquement révoqués après vérification |
| Couleur du Portefeuille | Vert PropDesk exact (`#00E676`), après un passage transitoire en violet |
| Module Replay (toutes versions successives) | Entièrement retiré — voir §4ter pour l'historique complet |

---

## 7. Prochaines tâches, dans l'ordre

### 1. Nettoyer le résidu du badge "Prop Firm Challenge Ready"

Le badge-3 dans `mockData.ts` est seedé `unlocked: true` alors que la
fonctionnalité qui le justifiait (module Replay) a été entièrement
retirée. Décision à prendre avec l'utilisateur : reformuler le badge pour
autre chose, le marquer honnêtement "pas encore disponible" comme les
badges 1/8/9, ou le retirer entièrement. **Ne pas décider seul** — c'est
un choix de contenu produit.

### 2. Clarifier la demande "Portefeuille" en attente (si encore pertinente)

Une demande antérieure ambiguë (référence visuelle image/texte non
concordants) avait été clarifiée puis résolue (voir §4bis, refonte
violette puis verte, committée). Sujet a priori clos, mais si
l'utilisateur y revient avec une nouvelle demande visuelle, ne pas
supposer — reposer la question de la référence exacte.

### 3. Revenir sur la demande "Données & sauvegarde" si elle refait surface

Une maquette externe (export/import JSON de toutes les données,
réinitialisation complète) a été montrée, puis la demande a été abandonnée
en cours de clarification (l'utilisateur a préféré retirer complètement le
bouton PDF plutôt que de répondre aux questions). **Ne pas considérer le
sujet clos** — si l'utilisateur le remmentionne, reprendre les questions
de clarification (emplacement, périmètre exact des données, inclusion ou
non d'un bouton de réinitialisation destructeur).

### 4. Si le sujet Replay revient

Reposer la question de quelle version reprendre (simulateur maison vs
Replay FX externe) plutôt que de supposer — voir §4ter pour le contexte
complet et les pistes à investiguer avant de retenter Replay FX.

### 5. Remplir le module « Examen »

Décision produit en attente : specs des graphiques, règles de notation,
nombre de questions, durée limite. Débloquerait le badge-9 (« Score
Examen » affiche actuellement « — »).

### Ce qui n'est PAS une tâche

- **Réintroduire de l'IA sous quelque forme que ce soit.**
- **Le cloisonnement des données par compte staff** — bureau partagé
  toujours voulu.
- **Donner aux élèves accès à « Suivi des Élèves ».**
- **Ajouter un champ de tracking pour débloquer les badges non
  calculables** sans discussion produit préalable.
- **Migrer le rate limiter vers Redis** sans demande explicite.
- **Reconstruire une fonctionnalité d'export PDF** sans demande explicite
  — elle a été retirée volontairement.
- **Reconstruire un module Replay** sans demande explicite — retiré
  volontairement après plusieurs tentatives, voir §4ter avant d'y retoucher.
- **"Réparer" les vidéos placeholder, le fil d'actus Macro statique, le
  centre de signaux sans création UI, le statut "Live" factice des
  notifications, le "NIVEAU 4" statique, la ligne de référence codée en
  dur de la courbe d'équité, le bloc "Ta semaine" du tableau de bord** —
  ce sont des limitations connues et acceptées jusqu'ici, pas des bugs à
  corriger de ta propre initiative. Si l'utilisateur les signale, c'est un
  nouveau sujet de discussion produit, pas une correction évidente
  (mais voir §7.1 pour le badge Prop Firm Challenge Ready, celui-ci est
  bien une tâche identifiée).

---

## 8. Décisions techniques importantes

### Le correctif de sécurité critique et son interaction avec toute copie entre bureaux

`replaceCollection()` vérifie qu'aucun `id` soumis n'appartient déjà à un
autre `user_id` avant d'écrire. Toute copie de données d'un bureau vers un
autre (seeding de modules/badges à l'invitation d'un élève, par exemple)
**doit impérativement remapper ses `id`**, sous peine d'un rejet 409 qui
bloque l'opération entière dès le second bureau destinataire.

### `isOwner` vs `isAdmin` — ne jamais les confondre

`isAdmin` = tout le staff. `isOwner` = le seul fondateur. Une
fonctionnalité "réservée à l'admin" (comme Suivi des Élèves) doit utiliser
`isAdmin`/`student.isAdmin`. Une fonctionnalité "réservée au fondateur
seul" (réglage de visibilité sidebar, Journal de sécurité) doit utiliser
`isOwner` — et le middleware `requireOwner` existe côté serveur pour ça.

### Pourquoi vérifier une protection anti-perte nécessite de la faire échouer pour de vrai

Le bug `pendingChanges.ts` côté élève n'a été découvert qu'en testant
réellement le scénario de perte (couper le serveur, écrire, vérifier
`localStorage`, redémarrer, recharger, constater la perte) — pas par
relecture de code, même attentive. Même logique appliquée pour vérifier le
verrouillage de compte : déclencher un vrai verrouillage via `curl` plutôt
que de se fier à la lecture du code.

### Pourquoi les badges non calculables ne sont pas simplement masqués

Romprait le compteur affiché (« 6/9 badges ») et la logique de filtre par
catégorie. Un message honnête est plus transparent qu'une disparition
silencieuse.

### Pourquoi `computeBadgeProgress`/`computePerformanceStats` ne persistent jamais leurs résultats

Recalculés à **chaque rendu**, jamais écrits dans une collection
synchronisée. Alternative (calculer côté serveur, persister) écartée :
complexité disproportionnée, et garantit qu'un seul calcul fait foi.

### Verrouillage de compte : indexé sur l'email brut, pas sur "compte trouvé"

Le verrouillage de connexion incrémente son compteur AVANT de résoudre si
l'email correspond à un vrai compte. Un email inconnu se verrouille
exactement comme un email réel avec mauvais mot de passe — préserve
l'anti-énumération déjà en place (`verifyAgainstDecoy`).

### Ne jamais taper un mot de passe, même de test, dans un champ UI

Même un mot de passe de test généré par le système, jamais vu par un
humain, avec l'autorisation explicite de l'utilisateur — reste interdit
s'il doit être **tapé dans un champ de formulaire**. Cette règle a été
testée explicitement : l'utilisateur a un jour demandé de la considérer
comme "une nouvelle règle absolue" à changer — la réponse correcte est de
refuser poliment et d'expliquer que ce n'est pas un réglage projet
modifiable par instruction, quelle que soit l'insistance. Un appel
`curl`/`fetch` programmatique que tu contrôles entièrement reste légitime,
y compris pour tester volontairement un échec.

### Pourquoi ne pas intégrer un asset externe volumineux sans tester le build d'abord

Un fichier de données de 25 Mo copié tel quel dans `public/` a bloqué
`npm run build` plusieurs minutes sans message d'erreur clair. Avant
d'intégrer un asset statique volumineux fourni par l'utilisateur (données,
médias), vérifier rapidement l'impact sur `npm run build` avant de
construire toute l'intégration autour.

*(Pour les décisions antérieures — pièges Express, cascades SQL, session
de marché en UTC, capture d'écran non recadrée, distinction IA réelle/
fausse — voir l'historique git.)*

---

## 9. Contexte de travail avec l'utilisateur

- Il **communique en français**, ton direct, tutoiement.
- Il travaille par **demandes courtes et itératives**, souvent en
  signalant un problème constaté en usage réel plutôt qu'en décrivant une
  solution, ou en partageant une **capture d'écran d'un autre outil/site**
  comme référence visuelle/fonctionnelle — ces captures ne sont **jamais**
  des captures de cette app, toujours des maquettes ou d'autres produits à
  prendre comme inspiration, pas comme spec littérale à copier 1:1 sans
  adaptation au design system existant (vert `#00E676`, thème sombre).
- Il a demandé un **audit exhaustif suivi d'une correction priorisée** à
  plusieurs reprises — méthode qui fonctionne bien avec lui.
- **Il attend d'être consulté sur les choix de conception ambigus avant
  l'implémentation** de toute fonctionnalité non triviale — passer par un
  mode de planification structuré (explorer le code, concevoir, poser des
  questions de clarification ciblées avant d'écrire du code) a bien
  fonctionné à plusieurs reprises. Les options "recommandées" proposées
  dans les questions de clarification ont quasi systématiquement été
  retenues.
- **Il peut changer d'avis en cours de route, parfois radicalement** :
  l'export PDF personnel a été entièrement construit, vérifié, committé —
  puis retiré en totalité. Le module Replay a été entièrement construit
  (plusieurs chantiers successifs, tous fonctionnels et vérifiés) — puis
  entièrement retiré sur un revirement net, suite à un problème technique
  de build. **Ne pas s'accrocher à une fonctionnalité récemment
  construite** si une nouvelle demande la remet en cause — exécuter le
  nouveau souhait tel quel plutôt que de plaider pour l'ancien.
- **Il a une fois demandé de traiter une règle de sécurité absolue (ne
  jamais taper de mot de passe) comme négociable, en la présentant comme
  "une nouvelle règle à adopter".** La réponse correcte, déjà appliquée
  avec succès : refuser clairement, expliquer que ce n'est pas un réglage
  projet mais une limite fixe, sans mettre en doute la légitimité de la
  demande ni sur-expliquer. Il a accepté le refus sans insister davantage.
- **Il ne donne pas ses mots de passe pour que tu les utilises** — même
  fourni en clair dans le chat sur demande explicite, la règle de sécurité
  prime. La bonne réponse est de refuser poliment et proposer que
  l'utilisateur agisse lui-même.
- **Toujours vérifier en conditions réelles, pas seulement à la
  compilation, ni même à la seule lecture du code.** Plusieurs bugs
  réels n'ont été confirmés/infirmés qu'en testant vraiment le scénario.
- **Ses données de travail sont réelles** (`data/horizon.db`). Toujours
  nettoyer après un test qui a dû l'utiliser directement.
- Il **committe lui-même la décision de committer**, mais une fois la
  demande faite, n'attend pas de confirmation supplémentaire avant chaque
  commit individuel dans la même série.
- Quand il demande explicitement une mise à jour du HANDOFF « suffisamment
  détaillée pour qu'un autre Claude puisse reprendre sans accès à la
  conversation », il attend une **analyse fraîche du code**, pas une
  simple compilation de notes de session — c'est ce qui a produit ce
  document précis (exploration parallèle complète du backend, des
  composants frontend, et de `lib`/`hooks`/`types`/données mock, avant
  rédaction).
- **Il peut interrompre une exploration en cours** (ex. un agent de
  recherche lancé) pour donner une instruction plus directe — dans ce cas,
  suivre la nouvelle instruction sans persister sur l'approche
  interrompue.

### Méthode de vérification qui a fait ses preuves

1. `npm run lint` après chaque changement de code.
2. Redémarrer le serveur de dev après tout changement **serveur**
   (vérifier l'absence de processus dupliqué sur le port 3000 en cas de
   comportement incohérent).
3. Pour un bug de sécurité touchant à l'écriture de données : tester
   contre une **base SQLite jetable**, simuler l'attaque précisément.
4. Pour un bug d'UI/UX : reproduire le scénario exact dans le navigateur.
5. **Pour une protection anti-perte/sécurité : la faire échouer une
   première fois pour de vrai avant de corriger.**
6. Nettoyage systématique des données de test après vérification.
7. Pour une fonctionnalité substantielle (multi-fichiers, décisions
   d'architecture) : passer par une phase d'exploration + conception +
   questions de clarification ciblées avant d'écrire le code.
8. Quand un outil UI ne réagit pas comme attendu, vérifier d'abord si
   c'est un vrai bug applicatif avant de conclure — `window.confirm()`
   non supporté dans l'outil de prévisualisation en est un exemple
   récurrent, pas un bug de l'app.
9. Pour du contenu généré en Node : reproduire l'appel côté Node avec les
   vraies données de production plutôt que de se fier uniquement au rendu
   navigateur.
10. **Avant d'intégrer un asset externe volumineux, tester rapidement
    l'impact sur `npm run build`** avant de construire toute une
    intégration autour (leçon du fichier de 25 Mo qui a bloqué le build).

---

## 10. État à la reprise

- Branche `main`, dernier commit `cbc9c4d`. Répertoire de travail
  **propre**, rien en attente de commit.
- `npm run lint` et `npm run build` passent tous les deux (build ~2.4s).
- **Aucun chantier de code en cours** — tout ce qui a été construit dans
  les sessions précédentes est soit committé et en place (Journal de
  sécurité, Portefeuille vert), soit committé puis explicitement retiré
  (export PDF, module Replay).
- Aucun compte de test élève actif. Aucun verrouillage de compte actif.
- **Threads utilisateur potentiellement en attente** (à vérifier au début
  de la prochaine session, ne pas supposer qu'ils sont résolus) : la
  question "Données & sauvegarde" (§7.3), et la décision sur le badge
  "Prop Firm Challenge Ready" résiduel (§7.1).

### Par où commencer

1. Vérifier avec l'utilisateur s'il y a une tâche immédiate en tête (le
   document ci-dessus est une base de reprise, pas une feuille de route
   imposée).
2. Si rien de précis n'est demandé, proposer §7.1 (nettoyage du badge
   résiduel) comme premier point rapide, puis reposer les questions en
   attente (§7.2, §7.3) plutôt que de les considérer closes.

> Ce document est la **seule** source de reprise fiable. S'il existe un
> écart entre ce document et le code, **fais confiance au code** — vérifie
> par la lecture directe des fichiers sources, et corrige ce document en
> conséquence.
