# HANDOFF — PropDesk (Académie de Trading)

Document de reprise. Il suppose que tu n'as accès ni à la conversation qui
l'a produit, ni à autre chose que ce dépôt. Lis-le en entier avant de
toucher au code.

> **État à la dernière mise à jour de ce document**
> Branche `main`, dernier commit poussé : **`85b08df`** (« Ajoute l'alerte
> sonore des notifications et le module Annonces »).
> **19 fichiers modifiés, NON commités** au moment de cette mise à jour
> (voir §0 et §3) — `npx tsc --noEmit` et `npm run build` passent sans
> erreur. L'audit complet (bugs + failles de sécurité) demandé par
> l'utilisateur est **terminé** à une exception près : seul #12 (fan-out
> d'annonces synchrone, jugé hors scope à l'échelle actuelle) reste ouvert —
> voir §0 pour le détail exact de chaque correctif.
> Statut de déploiement Railway du dernier commit poussé non re-vérifié
> dans cette période — à confirmer avec `railway deployment list --service
> propdesk --json` avant de considérer `85b08df` en production.
> Application déployée sur **Railway**, domaine
> `https://propdesk-academie.up.railway.app`.

---

## 0. Où reprendre EXACTEMENT

**Chantier quasi terminé, répertoire NON propre.** Un audit complet du
projet (bugs + failles de sécurité, demandé explicitement par l'utilisateur,
qui a aussi validé de corriger tout — y compris le problème de concurrence
multi-onglets ET, après question explicite, la durée de vie des sessions)
a été mené. `git status --short` doit renvoyer ces 19 fichiers modifiés :

```
server.ts
server/auth/routes.ts
server/auth/sessions.ts
server/auth/studentSessions.ts
server/auth/totp.ts
server/auth/twoFactor.ts
server/db.ts
server/repositories.ts
server/routes.ts
server/schemas.ts
src/App.tsx
src/components/Announcements.tsx
src/components/MainDashboard.tsx
src/components/PerformanceDashboard.tsx
src/hooks/useServerSync.ts
src/lib/api.ts
src/lib/performanceStats.ts
src/lib/planCompliance.ts
src/lib/walletStats.ts
```

`npx tsc --noEmit` ET `npm run build` passent sans erreur sur cet état.
**Rien n'a été commité, rien n'a été poussé.**

### TERMINÉ dans cette session :

1. **Convention "PnL réalisé"** — un trade `result === "OPEN"` n'entre plus
   dans aucun total $ agrégé (`isRealizedDollarTrade`, voir §8). Corrigé dans
   `performanceStats.ts`, `MainDashboard.tsx`, `PerformanceDashboard.tsx`
   (heatmap), `walletStats.ts` (**le bug le plus grave** : un trade OPEN
   pouvait fausser le solde recalculé d'un compte prop firm et déclencher un
   faux badge "Compte Invalidé"), `planCompliance.ts`.
2. **Logout élève incohérent** — `StudentAuthenticatedApp.handleLogout`
   suit maintenant exactement le motif du logout staff.
3. **Concurrence multi-onglets (contrôle de concurrence optimiste)** —
   compteur de version par `(userId, collection)`, table
   `collection_versions`, rejet HTTP 409 sur un push à version périmée.
   **Le câblage `markLoaded` dans `src/App.tsx` (qui manquait à la mise à
   jour précédente de ce document) est maintenant fait** : les ~9
   `useSyncedState<...>` du shell élève récupèrent et utilisent leur 3ᵉ
   élément `markLoaded` (variables `markTradesLoaded`, `markAccountsLoaded`,
   etc.) dans l'effet `[status]` qui hydrate depuis `resolveStudentValue`.
   Le shell staff (`AcademyApp`) n'en avait pas besoin : il résout sa valeur
   de départ de façon synchrone via `seed()` et ne monte qu'après la fin du
   bootstrap (`AuthenticatedApp`, `status === "loading"` → écran de
   chargement), donc pas de phase "resolve après montage" à couvrir.
4. **#6 (Élevée) `normalizeTradingPlans` sans validation de type par
   champ** — `sanitizePlanEntry()` (`src/lib/planCompliance.ts`) ne retient
   un champ de l'entrée brute que s'il a le bon type (tableau de strings
   pour `authorizedSessions`, string pour tout le reste), sinon garde le
   default de `createEmptyPlan()`. Corrige un crash potentiel sur
   `authorizedSessions: null` ou toute valeur corrompue similaire.
5. **#8 (Moyenne) codes TOTP rejouables** — nouvelle colonne
   `totp_last_used_step` sur `staff_accounts` (migration idempotente comme
   les autres colonnes 2FA). `findMatchingTotpStep()` (`server/auth/totp.ts`)
   renvoie maintenant le pas de temps apparié (pas juste un booléen) ;
   `verifyAndConsumeTotpStep()` (`server/auth/twoFactor.ts`) rejette un pas
   déjà utilisé ou antérieur, et enregistre le nouveau pas dès qu'il est
   accepté. Câblé dans `confirmTotpSetup` et `verifyStaffTotpCode`.
6. **#10 (Moyenne) limite 16kb sur `/api/auth` bloquant les uploads
   d'image** — deux parseurs `express.json({ limit: "2mb" })` scopés
   ajoutés dans `server.ts`, AVANT le parseur global à 16kb, pour
   `/api/auth/profile/avatar` et `/api/auth/announcements` (les deux seules
   routes sous `/api/auth` qui transportent une image en base64). En plus :
   `apiErrorHandler` (`server/routes.ts`) respecte maintenant `err.status`/
   `err.statusCode` quand il est dans la plage 4xx (ex. `PayloadTooLargeError`
   de body-parser) au lieu de toujours renvoyer 500 "Erreur serveur." — un
   413 réel remonte maintenant un 413 avec un message clair.
7. **#11 (Moyenne) URL de ressource de leçon non validée côté serveur** —
   nouveau scanner récursif générique `containsDangerousUrlScheme()`
   (`server/schemas.ts`) qui rejette `javascript:`/`vbscript:`/
   `data:text/html` n'importe où dans un item de collection, quelle que soit
   la profondeur d'imbrication (couvre `Module.lessons[].videoUrl` et
   `.resources[].url`, jamais validés par nom de champ jusqu'ici) — branché
   dans le `.refine()` de `collectionItem`.
8. **#13 (Moyenne) collection `notifications` élève jamais purgée** —
   plafond `MAX_STUDENT_NOTIFICATIONS = 300` dans `upsertPlanAlert()`
   (`src/lib/planCompliance.ts`) et plafond équivalent (`.slice(0, 300)`)
   dans le fan-out de notifications d'annonce (`server/auth/routes.ts`).
9. **#14 (Moyenne) `announcementsSchema` n'imposait pas l'unicité des
   `id`** — `.refine()` ajouté (`server/schemas.ts`), même motif que
   `collectionPayloadSchema`.
10. **#16 (Moyenne) `applyPlanCompliance` sous-compte par stale closure** —
    les deux shells (`StudentAuthenticatedApp`/`AcademyApp`, `src/App.tsx`)
    ont maintenant un ref (`syncedTradesRef`/`tradesRef`) tenu à jour de
    façon strictement synchrone à chaque ajout/modif/suppression de trade
    (pas via un `useEffect`, qui ne se déclenche qu'au rendu suivant) —
    deux `handleAddTrade` rapprochés (avant re-rendu) voient maintenant
    chacun le trade ajouté par l'autre dans `allTrades`.
11. **#17 (Moyenne) clé localStorage des badges lus non namespacée par
    élève** — `readBadgeNotificationIds` (`src/App.tsx`) utilise maintenant
    `horizon_student_read_badge_notifications_${student.email}`.
12. **Faible — `Announcements.onSave` non gardé par `isOwner` côté
    client** — `handleSubmit`/`handleDelete`/`togglePin`
    (`src/components/Announcements.tsx`) vérifient maintenant `isOwner`
    eux-mêmes, en plus de la garde `{isOwner && (...)}` déjà présente autour
    du rendu (le serveur, `requireOwner`, restait de toute façon la seule
    vraie barrière — défense en profondeur seulement).

13. **#9 (Moyenne) session sans durée de vie absolue réelle** — corrigé,
    après validation explicite de l'utilisateur (ajouter une vraie limite,
    recommandation choisie). Nouvelle constante `ABSOLUTE_TTL_MS = 90 jours`
    dans `server/auth/sessions.ts` ET `server/auth/studentSessions.ts`
    (mondes staff et élève, code dupliqué par design — voir §8), calculée
    depuis `created_at` et JAMAIS prolongée, contrairement à `expires_at`
    (glissant, prolongé de `TTL_MS` à chaque connexion espacée de plus de
    `SLIDING_THRESHOLD_MS`). `validateSession`/`validateStudentSession`
    rejettent maintenant aussi une session dont `created_at` dépasse ce
    plafond, même si `expires_at` reste dans le futur ; `purgeExpiredSessions`/
    `purgeExpiredStudentSessions` la suppriment en base au lieu de la
    laisser traîner. Au-delà de 90 jours, même un compte utilisé
    quotidiennement doit se reconnecter.

### PAS traité, jugé hors scope pour l'instant (échelle actuelle du projet) :

- **#12 (Moyenne) fan-out de notifications d'annonce synchrone/bloquant** —
  la boucle sur tous les élèves actifs dans `PUT /admin/announcements`
  (`server/auth/routes.ts`) est synchrone dans une transaction SQLite
  unique. Pour la taille actuelle d'une académie (dizaines/centaines
  d'élèves), better-sqlite3 (synchrone, très rapide) absorbe ça sans
  problème perceptible. À revisiter si le nombre d'élèves actifs devient
  très grand (des milliers).
- Faible — UX de collage avec espace insécable dans `ThousandsInput`.
- Faible — pas de purge périodique dédiée des défis 2FA expirés (purgés
  opportunistement au fil des requêtes de connexion via
  `purgeExpiredTwoFactorChallenges()`, déjà en place, jugé suffisant).

**Prochaine étape immédiate concrète** : décider avec l'utilisateur du sort
de #9 (voir ci-dessus et §11), puis committer le travail de cette session —
probablement plusieurs commits par thème (concurrence multi-onglets / PnL
réalisé / durcissements sécurité 2FA-uploads-notifications / logout
élève) — **seulement sur demande explicite** ("commite", "commite et
pousse"), jamais spontanément.

---

## 1. Le projet en bref

**PropDesk** est une plateforme d'académie de trading SMC (*Smart Money
Concepts*) destinée à un coach (le fondateur, compte admin) et à ses
élèves. Interface **entièrement en français**, ton direct, tutoiement.
Devise unique : **`$`**, jamais `€` (exception assumée : le module
Calculateurs, qui affiche `€/$` sur certains champs pour coller à une
maquette externe — ne pas généraliser). **Aucune IA n'est utilisée nulle
part** — décision produit explicite et répétée plusieurs fois, **ne jamais
la réintroduire sans nouvelle demande explicite**.

C'est un **vrai projet full-stack** : React 19 + TypeScript + Vite côté
client, Express + `better-sqlite3` (SQLite, mode WAL) côté serveur, un
seul process Node sert les deux.

**Identité visuelle** : design system unifié sur tout l'écosystème autour
du langage visuel de Macro/Rentabilité — cartes plates à bordure fine
(`#111615`/`#1B2320`), micro-labels `[9px]`/`[10px]` en majuscules
espacées, en-têtes de section à barre verticale colorée (`SectionHeader`,
un composant local à chaque fichier, jamais partagé — voir §9). Palette
PropDesk (vert `#00E676`, fonds `#0D1110`/`#111615`), enrichie de couleurs
de statut ponctuelles (ambre, violet, indigo, rose) pour les widgets
Macro/Portefeuille.

Format des nombres **français** partout dans les champs de saisie
(virgule = décimale, espace/point = milliers) via le composant partagé
`src/components/ThousandsInput.tsx` — utilisé dans le calculateur de
position, le Journal de trading, le Plan de trading. Convention "PnL
réalisé" (`isRealizedDollarTrade`, voir §0 et §8) : un trade `OPEN` n'entre
dans AUCUN total $ agrégé nulle part dans l'app.

Le projet possède : une page publique de mentions légales et de CGU, un
lien vers la politique de confidentialité, un système complet de gestion
d'accès/mot de passe élève (invitation, changement forcé, changement
volontaire, lien de réinitialisation à jeton), une **authentification à
deux facteurs (TOTP) optionnelle pour les comptes staff** (maison, sans
lib externe, `node:crypto`), un journal de sécurité réservé au fondateur,
une photo de profil personnalisable par élève, un **export RGPD Article
20** côté élève, un **effacement en cascade conforme à l'Article 17**, un
système de niveau/XP dynamique, un module **Setups** (stratégies
définies par l'élève), un **système de Plans de trading multiples**
(voir §6 — remplace l'ancien plan unique), un module **Annonces**
(diffusion du fondateur vers tous les élèves, avec notification + son),
une alerte sonore de notification (Web Audio API, aucun fichier audio
externe).

---

## 2. Démarrage immédiat

| Commande | Effet |
|---|---|
| `npm install` | installe les dépendances (client + serveur, même `package.json`) |
| `npm run dev` | lance le serveur Express + Vite en mode dev (HMR) |
| `npx tsc --noEmit` | vérifie le typage sur tout le projet, AUCUNE émission — c'est le "lint" de ce projet |
| `npm run build` | build de production (client + serveur) |
| `git push` puis `railway redeploy --from-source -y` | déploiement Railway — **JAMAIS `railway up`**, qui échoue car le `.gitignore` du dépôt a un motif `data/` qui matche aussi `src/data/` |

**Piège serveur** : après une modification côté `server/`, le serveur de
dev doit être redémarré manuellement (pas de hot-reload serveur) — un
onglet navigateur ouvert avant le redémarrage peut afficher un état HMR
périmé côté client, recharger la page en cas de doute.

**Tester une fonctionnalité élève sans casser une session coach en
cours** : ne jamais se déconnecter du compte staff pour tester côté élève.
Méthodes sûres : (a) un second navigateur/profil ou une fenêtre de
navigation privée pour la session élève, en parallèle de la session staff ;
(b) vérification directe via l'API (`curl`/fetch) sans passer par l'UI
quand seul l'état serveur doit être inspecté ; (c) le compte élève de test
existant "Sensei" (si présent en base) peut être réutilisé pour ne pas
polluer les données d'élèves réels. Ne jamais déconnecter l'utilisateur
réel pour un test.

**Inspection SQLite directe** (utile pour vérifier un état sans passer par
l'API) : `sqlite3 data/app.db` (ou le chemin configuré), puis `.tables`,
`.schema <table>`, `SELECT * FROM ... ;`.

**Accès production Railway** : les logs et le déploiement se pilotent via
la CLI `railway` (`railway logs`, `railway deployment list --service
propdesk --json`, `railway redeploy --from-source -y`) — pas d'accès direct
à la base de production depuis cet environnement de dev.

**Compte admin** : le compte fondateur est le seul avec `isOwner` — les
routes de publication (Annonces, gestion staff, etc.) sont gardées côté
serveur par `requireOwner`, pas seulement par une garde UI.

---

## 3. Architecture

```
server.ts                     point d'entrée : Express + Vite/statique
                               + helmet + trust proxy (prod) + tâches de
                               nettoyage périodiques.
server/
  db.ts                       SQLite (better-sqlite3, WAL, foreign_keys
                               ON). MODIFIÉ (non commité) : + table
                               `collection_versions` (contrôle de
                               concurrence optimiste, voir §0/§8). Piège
                               syntaxique connu : jamais de backtick
                               littéral dans un commentaire SQL `-- ...` à
                               l'intérieur du template `db.exec(\`...\`)`.
  repositories.ts              MODIFIÉ (non commité) : `CollectionVersionConflictError`,
                               `getCollectionVersion()`, `replaceCollection()`
                               accepte un `expectedVersion?` et retourne la
                               nouvelle version ; `updateCollectionItem()`
                               incrémente aussi le compteur de version.
                               Gère aussi le stockage type "objet unique par
                               utilisateur" (`trading_plans`, `announcements`,
                               `profile`) via le même motif `user_id TEXT
                               PRIMARY KEY`.
  routes.ts                    MODIFIÉ (non commité) : `writeCollectionForAuth()`
                               version-aware, catch `CollectionVersionConflictError`
                               → 409, `PUT /collections/:name` attend
                               `{ items, version }`, `GET /api/state`
                               retourne `versions: Record<CollectionName,
                               number>` (branches élève ET staff).
  schemas.ts                   `announcementSchema`/`announcementsSchema`,
                               `tradingPlanSchema` (adapté au système multi-plans,
                               voir §6), `totpCodeSchema`, `twoFactorLoginSchema`,
                               `disableTotpSchema`.
  middleware/rateLimit.ts      inchangé.
  auth/
    routes.ts                  `staffRouter` : routes 2FA (`/2fa/status`,
                               `/2fa/setup`, `/2fa/enable`, `/2fa/disable`,
                               `/2fa/recovery-codes/regenerate`, toutes
                               `requireStaffKind`) ; route publique `POST
                               /login/2fa` (étape 2 de connexion) ; `POST
                               /login` répond `{state: "2fa-required",
                               pendingToken}` si le compte a la 2FA active ;
                               `PUT /admin/announcements` (`requireStaffKind`
                               + `requireOwner`) diffuse une notification à
                               chaque élève actif pour toute nouvelle
                               annonce (id inconnu de l'ancienne liste).
    studentRoutes.ts            `PUT /trading-plan` (élève écrit son plan,
                               maintenant un tableau de plans — voir §6) ;
                               `GET /export` (export RGPD Article 20,
                               délègue à `exportData.ts`).
    exportData.ts                Collecte profil + plans de trading +
                               progression modules + badges pour l'élève
                               connecté — n'exporte QUE des données réelles
                               du schéma de ce projet.
    totp.ts                      TOTP (RFC 6238) maison sans dépendance
                               externe : secret base32, HMAC-SHA1 +
                               troncature dynamique (RFC 4226), tolérance
                               ±1 pas de temps (30s), URI `otpauth://`. Pas
                               de QR code (décision explicite, voir §8).
    twoFactor.ts                  Accès bas niveau à la 2FA d'un compte
                               staff (secret, activation, codes de
                               récupération à usage unique, défi de
                               connexion temporaire).
    studentCredentials.ts        `buildStudentProfile()` fusionne l'avatar
                               personnalisé de l'élève ; `listActiveStudentAccounts()`
                               (utilisé par le fan-out de notifications
                               Annonces).
    securityEvents.ts             types d'événements 2FA + `login_2fa_required`
                               (champ `eventType` reste `string` libre,
                               aucune migration nécessaire pour en ajouter).
  economicCalendar.ts           flux public ForexFactory, cache 10 min,
                               "this week" seulement (comportement normal,
                               pas un bug : un vendredi soir, la semaine du
                               flux peut ne plus contenir d'annonce à
                               venir).
  marketData.ts / seed.ts       inchangés.
src/
  App.tsx                      MODIFIÉ (non commité, wiring incomplet —
                               voir §0). Deux shells quasi-dupliqués :
                               `StudentAuthenticatedApp` (élève, `userId`
                               isolé par compte) et `AcademyApp` (staff,
                               bureau unique partagé `DEFAULT_USER_ID`).
                               `handleLogout` élève réécrit pour suivre le
                               motif staff (terminé). Modules Annonces et
                               plans multiples déjà branchés (chercher
                               `announcements`/`tradingPlans` dans le
                               fichier).
  types.ts                     `TradingPlan[]` (remplace l'ancien objet
                               `TradingPlanData` unique — voir §6),
                               `Announcement`/`AnnouncementCategory`,
                               `Setup`.
  hooks/
    useAuth.ts                  état `"2fa-required"` dans `AuthStatus` ;
                               `pendingTwoFactorToken`, `verifyTwoFactor`,
                               `verifyTwoFactorRecovery`, `cancelTwoFactor`.
    useServerSync.ts             MODIFIÉ (non commité) : `useSyncedState<T>`
                               retourne un triplet `[value, setValue,
                               markLoaded]` (voir §0) ; flush automatique au
                               démontage ; `tradingPlans`/`announcements`
                               dans les bootstraps.
    useNotificationSound.ts      Web Audio API — joue un son quand une
                               notification avec un `id` inédit apparaît
                               dans la collection `notifications`.
  lib/
    performanceStats.ts          MODIFIÉ (non commité) : + `isRealizedDollarTrade`
                               (helper partagé, voir §0/§8), + `losses`
                               dans `CategoryStats`, + `winRateOf()`.
    walletStats.ts                MODIFIÉ (non commité) : `dailyLossPercent`
                               et `syncAccountsWithTrades` utilisent
                               `isRealizedDollarTrade`.
    planCompliance.ts             MODIFIÉ (non commité) : règle de perte
                               quotidienne max utilise `isRealizedDollarTrade`.
    api.ts                        MODIFIÉ (non commité) : `ServerState.versions`,
                               cache `collectionVersions`, `fetchState`/
                               `saveCollection` version-aware ;
                               `getAnnouncements`/`saveAnnouncements`
                               (routes dédiées, pas `saveCollection`
                               générique — `saveAnnouncements` n'a pas la
                               restriction `requireOwner` côté client, elle
                               vient du serveur).
    links.ts                      `PRIVACY_POLICY_URL`.
    image.ts                      `resizeChartScreenshot` — réutilisé pour
                               les pièces jointes image des Annonces.
  components/
    MainDashboard.tsx             MODIFIÉ (non commité) : `isCapitalUp` en
                               `>=`, courbe d'équité et `totalPnL` via
                               `isRealizedDollarTrade`.
    PerformanceDashboard.tsx      MODIFIÉ (non commité) : heatmap `winRate`
                               recalculé sur `wins/(wins+losses)`, garde
                               `winRate !== null`.
    Announcements.tsx             NOUVEAU (déjà commité dans `85b08df`).
                               Vue staff (fondateur uniquement, formulaire +
                               liste avec édition/suppression/épinglage) et
                               vue lecture seule (élève, coach non-fondateur) —
                               badges de catégorie colorés, épinglées en
                               premier.
    TradingPlanEditorModal.tsx    Gère désormais une LISTE de plans
                               (`TradingPlan[]`), pas un objet unique — voir
                               §6.
    ThousandsInput.tsx             Champ de saisie numérique au format
                               français (virgule décimale), utilisé dans
                               calculateur de position + Journal + Plan de
                               trading.
    Sidebar.tsx                    entrée "Annonces" (icône Megaphone).
```

---

## 4. Le module Calculateurs (référence design "MacroPulse")

Composant `PositionCalculatorModal.tsx`. Affiche `€/$` sur certains champs
pour coller à une maquette externe fournie par l'utilisateur — exception
volontaire à la règle "devise unique `$`" du reste de l'app, ne pas
généraliser à d'autres modules. La saisie des prix (y compris les indices)
suit le format français via `ThousandsInput`.

---

## 5. Fonctionnalités terminées (les plus récentes en premier)

- **Module Annonces** (`85b08df`) — diffusion fondateur → tous les élèves,
  catégories à badges colorés, épinglage, pièce jointe image, notification
  + son automatiques à la création (pas à l'édition). Droits : publication
  réservée `requireOwner`, lecture ouverte à toute session authentifiée.
- **Alerte sonore de notification** (`85b08df`) — `useNotificationSound.ts`,
  Web Audio API, aucun fichier audio externe.
- **Taux de réussite tenant compte des Breakeven** (`37bcf84`, affiné en
  `295e144`) — le détail TP/SL/BE est maintenant affiché explicitement, et
  Paris a été retiré de la liste des sessions de trading.
- **Plans de trading multiples** (`44edb39`) — remplace l'ancien objet
  unique `TradingPlanData` par `TradingPlan[]`. Voir §6 pour le détail du
  design (exclusivité setup↔plan, sélection manuelle explicite du plan par
  trade). Corrige aussi la mise en page de l'onglet Rentabilité.
- **PnL en $ non arrondi à l'enregistrement** (`5cd8f1c`) — le Journal
  conserve désormais les décimales exactes saisies par l'utilisateur au
  lieu d'arrondir à l'entier.
- **Choix manuel du résultat (TP/SL/BE) et saisie des prix au format
  français** (`67ae89b`, `348b9dd`, `1f942d7`, `1eaeea7`) — le résultat
  d'un trade n'est plus uniquement déduit automatiquement du calcul
  prix/stop, l'utilisateur peut le choisir explicitement ; tous les champs
  de prix (y compris indices) utilisent `ThousandsInput`.
- Fonctionnalités antérieures (RGPD complet — 2FA TOTP maison, export
  Article 20, effacement Article 17, CGU, registre des traitements —,
  système de niveau/XP, module Setups, photo de profil élève répercutée
  côté coach) : terminées lors de périodes précédentes, stables, non
  retouchées cette période sauf mention contraire ci-dessus.

**Non commité cette période (voir §0 pour le détail complet)** :
- Correction de la convention "PnL réalisé" dans 5 fichiers (`performanceStats.ts`,
  `MainDashboard.tsx`, `PerformanceDashboard.tsx`, `walletStats.ts`,
  `planCompliance.ts`) — **terminé, prêt à committer**.
- Logout élève aligné sur le motif staff (`App.tsx`) — **terminé, prêt à
  committer**.
- Contrôle de concurrence optimiste multi-onglets (`db.ts`, `repositories.ts`,
  `routes.ts`, `api.ts`, `useServerSync.ts`) — **serveur et lib client
  terminés, wiring dans `App.tsx` PAS FAIT** (voir §0, prochaine tâche).

---

## 6. Flux détaillés

### 6.1 Plans de trading multiples

Le Plan de trading est passé d'un objet unique (`TradingPlanData`) à une
**liste** (`TradingPlan[]`), chaque plan ayant son propre nom, ses règles,
et sa liste de setups autorisés. Un trade référence désormais
explicitement un `tradingPlanId` — **pas de déduction automatique** du
plan depuis le setup utilisé, le choix est manuel et explicite dans le
Journal. Un setup ne peut être rattaché qu'à un seul plan à la fois
(exclusivité). Stocké côté serveur via `PUT /trading-plan` (élève),
`getTradingPlan`/`saveTradingPlan` dans `repositories.ts` (même motif
"une ligne JSON par utilisateur" que `profile`).

### 6.2 Module Annonces

Stockage : une liste JSON complète réécrite à chaque publication (`announcements`
table, `user_id TEXT PRIMARY KEY` = toujours `DEFAULT_USER_ID`, un seul
bureau partagé — pas de `CollectionName` générique car pas besoin d'id/position
par ligne SQL). `GET /api/announcements` : lecture ouverte à toute session
authentifiée (élève ou staff). `PUT /api/auth/admin/announcements` :
réservé `requireOwner`, diffuse une notification (`type: "academy"`) à
chaque élève actif pour toute entrée dont l'`id` n'existait pas dans
l'ancienne liste (une édition ne renotifie pas). Le son se déclenche déjà
côté client via `useNotificationSound` dès qu'un `id` inédit apparaît dans
`notifications`.

### 6.3 Contrôle de concurrence optimiste (EN COURS — voir §0)

Un compteur de version par `(userId, collection)` dans la table
`collection_versions`. Chaque `PUT /collections/:name` envoie la version
qu'il pensait être la dernière connue (`{ items, version }`) ; le serveur
vérifie-puis-incrémente atomiquement dans la même transaction que
l'écriture, et rejette (409, `CollectionVersionConflictError`) si la
version envoyée est périmée — signe qu'un autre onglet/appareil a écrit
entre-temps. Scope délibérément limité aux 8 collections `CollectionName`
partagées à plus haut risque (trades, comptes, modules, messages, badges,
setups, notifications, enrolledStudents) — pas étendu aux endpoints
singleton (plan de trading, profil, annonces, résultats de quiz) qui ont
un risque de collision beaucoup plus faible en pratique.

---

## 7. Bugs connus / limitations

**Corrigés cette période (non commités, voir §0/§5) :**
- ~~PnL non réalisé (trades OPEN) inclus dans des totaux agrégés à
  plusieurs endroits~~ — corrigé via `isRealizedDollarTrade`.
- ~~Écrasement silencieux multi-onglets~~ — corrigé serveur ET client
  (wiring `markLoaded` fait, voir §0).
- ~~Logout élève incohérent avec le motif staff~~ — corrigé.
- ~~#6 Élevée : `normalizeTradingPlans` sans validation de type~~ — corrigé
  (`sanitizePlanEntry`, voir §0).
- ~~#8 Moyenne : codes TOTP rejouables~~ — corrigé (`totp_last_used_step` +
  `verifyAndConsumeTotpStep`, voir §0).
- ~~#10 Moyenne : limite 16kb bloquant les uploads d'image~~ — corrigé
  (parseurs scopés à 2mb + `apiErrorHandler` respecte le vrai code HTTP,
  voir §0).
- ~~#11 Moyenne : URL de ressource de leçon non validée~~ — corrigé
  (`containsDangerousUrlScheme`, voir §0).
- ~~#13 Moyenne : collection `notifications` élève jamais purgée~~ — corrigé
  (plafond 300, voir §0).
- ~~#14 Moyenne : `announcementsSchema` sans unicité des `id`~~ — corrigé.
- ~~#16 Moyenne : `applyPlanCompliance` stale closure~~ — corrigé (ref
  synchrone dans les deux shells, voir §0).
- ~~#17 Moyenne : clé localStorage badges non namespacée~~ — corrigé.
- ~~Faible : `Announcements.onSave` non gardé par `isOwner` côté client~~ —
  corrigé (défense en profondeur).

**Encore ouverts :**

| # | Sévérité | Constat |
|---|---|---|
| 9 | Moyenne | La session n'a pas de durée de vie absolue réelle — c'est une fenêtre glissante. **Décision produit nécessaire avant correctif**, voir §0. |
| 12 | Moyenne | La boucle de fan-out de notifications à la publication d'une annonce est synchrone et bloquante. Jugé hors scope à l'échelle actuelle du projet, voir §0. |
| — | Faible | UX de collage avec espace insécable dans `ThousandsInput` ; pas de purge périodique dédiée des défis 2FA expirés (purge opportuniste déjà en place, jugée suffisante). |

**Limitations connues, non des bugs :**
- Le calendrier économique ne montre que "cette semaine" (flux
  ForexFactory) — un vendredi soir, la liste peut être vide, comportement
  normal.
- Pas de QR code pour la 2FA — décision explicite (voir §8).

---

## 8. Décisions techniques importantes

- **`isRealizedDollarTrade`** comme seule source de vérité pour "ce trade
  compte-t-il dans un total $ agrégé ?" — un trade `OPEN` n'y entre jamais.
  Motif : avant cette période, 5 fichiers différents avaient chacun leur
  propre logique, souvent incohérente (BE parfois inclus, parfois exclu ;
  OPEN parfois inclus par erreur). Toute nouvelle fonctionnalité qui somme
  du PnL en $ DOIT utiliser cet helper plutôt que ré-implémenter un filtre.
- **Contrôle de concurrence optimiste scopé aux seules collections
  `CollectionName`** (pas aux endpoints singleton) — compromis coût/bénéfice
  assumé : ce sont les seules données où deux onglets peuvent raisonnablement
  écrire des éléments indépendants en parallèle (ajouter deux trades
  différents en même temps, par ex.) ; les singletons (plan, profil,
  annonces) sont réécrits en bloc et déjà à faible risque de collision réelle.
- **Plans de trading multiples avec sélection manuelle explicite** — le
  `tradingPlanId` d'un trade n'est jamais déduit automatiquement du setup
  utilisé, même si un setup n'appartient qu'à un seul plan. Motif : éviter
  toute ambiguïté silencieuse si un setup change de plan après coup.
- **Pas de QR code pour la 2FA** — secret affiché en texte à recopier +
  lien `otpauth://` cliquable sur mobile, décision explicite pour éviter
  une dépendance externe de génération de QR code pour un gain UX marginal
  (l'app cible des coachs/élèves, pas le grand public).
- **Aucune dépendance externe pour le TOTP** — implémentation maison
  (RFC 6238/4226) sur `node:crypto` uniquement.
- **Annonces : stockage JSON complet plutôt que `CollectionName` générique**
  — pas besoin d'id/position par ligne SQL pour une liste réécrite en bloc
  à chaque publication (peu fréquente), motif identique à `trading_plans`.
- **Aucune IA nulle part dans le produit** — répété plusieurs fois par
  l'utilisateur comme décision produit ferme, ne pas réintroduire sans
  demande explicite.

---

## 9. Historique de nommage (contexte)

`SectionHeader` est réimplémenté localement dans chaque fichier qui en a
besoin plutôt que factorisé en composant partagé — décision historique
assumée (chaque section a des variations mineures de style/props qui
rendaient une factorisation prématurée plus coûteuse que répétitive).

Le module "Annonces" a été nommé ainsi plutôt que "Académie" pour éviter
une collision de nom avec le module vidéo existant `VideoAcademy.tsx`
(`TabType: "academy"`), qui aurait été confusante.

---

## 10. Contexte de travail avec l'utilisateur

Forexpaps est le fondateur de PropDesk, **non-technique**, délègue
largement l'exécution du code. Il valide des décisions produit (nommage,
droits d'accès, priorités) mais pas des détails d'implémentation. Workflow
attendu pour un audit complet : agents parallèles par zone → compiler les
résultats → prioriser → ne demander l'arbitrage de l'utilisateur QUE pour
de vraies décisions produit/permission (pas pour des choix techniques) →
corriger tout le reste directement → vérifier (`tsc`/build/navigateur) →
UN commit bien documenté par initiative (ne pas fragmenter à l'excès) →
ne committer/pousser que sur demande explicite ("commite et pousse", pas
avant).

Pour tester une fonctionnalité élève : ne jamais déconnecter une session
coach en cours pour le faire — utiliser un second navigateur/profil privé,
l'API directe, ou un compte élève de test dédié.

---

## 11. Prochaines tâches, dans l'ordre

1. **Décider du sort de #9** (session sans vraie durée de vie absolue,
   voir §0/§7) avec l'utilisateur — imposer une expiration absolue changerait
   un comportement produit existant (reconnexion forcée périodique), ce
   n'est pas un choix purement technique. Implémenter seulement après
   validation.
2. Tester manuellement le scénario deux-onglets décrit dans la version
   précédente de ce document (§0) : modifier une donnée dans l'onglet A,
   dans l'onglet B modifier la même collection avant que A n'ait rechargé →
   B doit voir un rejet 409 propre (`SyncErrorBanner`) plutôt qu'un
   écrasement silencieux. Vérifier aussi la 2FA (anti-rejeu #8) et un upload
   d'avatar/annonce avec une image de quelques centaines de ko (#10).
3. Committer les 19 fichiers modifiés — plusieurs commits par thème
   (probable : concurrence multi-onglets / convention PnL réalisé /
   durcissements sécurité 2FA-uploads-notifications-XSS / logout élève —
   à discuter avec l'utilisateur si ambigu), **seulement sur demande
   explicite** ("commite", "commite et pousse").
4. Si l'utilisateur valide un correctif pour #9, l'implémenter, vérifier,
   committer séparément.
5. #12 (fan-out d'annonces synchrone) : à revisiter seulement si le nombre
   d'élèves actifs devient très grand — pas d'action requise pour l'instant.
6. Ne pousser/déployer sur Railway que sur demande explicite de
   l'utilisateur.

---

## 12. État à la reprise

- Branche `main`, dernier commit **poussé** : `85b08df`.
- **19 fichiers modifiés, non commités** (liste exacte en §0) — `npx tsc
  --noEmit` ET `npm run build` passent sans erreur sur cet état.
- Statut de déploiement Railway de `85b08df` **non re-vérifié** dans cette
  période — à confirmer avant de supposer quoi que ce soit sur la prod.
- Audit complet (bugs + failles de sécurité) **quasiment terminé** : 12 des
  14 constats traités (voir §0/§7 pour le détail exact), tous vérifiés par
  `tsc`/`build`. Il reste #9 (bloqué sur une décision produit) et #12 (jugé
  hors scope à l'échelle actuelle).
- Aucun blocage technique connu — juste la décision #9 à prendre avec
  l'utilisateur, puis committer sur demande explicite.
