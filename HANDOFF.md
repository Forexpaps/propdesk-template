# HANDOFF — PropDesk (Académie de Trading)

Document de reprise. Il suppose que tu n'as accès ni à la conversation
précédente, ni à autre chose que ce dépôt.

> **État à la dernière mise à jour de ce document**
> Branche `main`. **Arbre de travail NON committé** — voir §0. `npm run lint`
> et `npm run build` passent tous les deux, sans erreur.
>
> Cette session a livré, dans l'ordre :
> 1. **Passage € → $** dans toute l'application, et **refonte du champ PnL**
>    du Journal en saisie libre `$`/`%`, sans plus aucun calcul automatique.
> 2. **Accès élève** : chaque élève peut avoir un compte de connexion léger
>    (email + mot de passe), séparé du bureau staff, pour son propre Journal
>    cloisonné.
> 3. Trois retouches ciblées du Journal : suppression du bouton **Audit IA**,
>    renommage de la colonne **Actions**, ajout d'une **capture d'écran**
>    jointe à chaque trade, et transformation du bouton « œil » en un
>    **aperçu complet** de toutes les données saisies.
> 4. **Pastille de session de marché dynamique** dans le header (Sydney,
>    Tokyo, Londres, New York, calculée en direct — plus de « SESSION NY »
>    figé avec un faux cours).
> 5. **Retrait complet de l'IA de toute l'application** (staff compris) —
>    décision explicite de l'utilisateur, répétée deux fois : « je ne veux
>    pas qu'il y ait de IA ».
>
> **✅ Le point 5 (retrait de l'IA) est maintenant vérifié visuellement dans
> le navigateur, en plus de compiler et builder sans erreur.** Connexion
> staff réelle (`th.gauthey99@gmail.com`), puis contrôle de :
> `PerformanceDashboard` (« Rentabilité ») — aucun bouton « Générer un Audit
> IA Globale », aucun rapport IA affiché ; `CoachMessaging` (« Messagerie
> Coach ») — aucune bascule « Réponse IA Immédiate », un message de test
> envoyé (« Test vérification retrait IA (sera visible dans la conversation,
> sans conséquence) », visible dans le fil avec Thomas Laurent, horodaté
> « Aujourd'hui, 07:10 ») n'a déclenché **aucune** réponse automatique ;
> `TradingJournal` — colonne « Actions » (renommée), 4 icônes seulement
> (œil/crayon/message/corbeille), aucun bouton Audit IA sur aucune ligne,
> et l'aperçu complet (icône œil) affiche bien la capture d'écran + tous les
> champs saisis. **Ce message de test n'a pas été supprimé** (aucune action
> de suppression trouvée dans l'UI de la messagerie) — il reste visible dans
> le fil Thomas Laurent, sans conséquence fonctionnelle, mais à savoir si tu
> nettoies la messagerie plus tard.
>
> **⚠️ Le serveur de développement qui tourne peut-être encore (port 3000)
> n'a pas forcément été redémarré depuis l'ajout des tables
> `student_accounts` / `student_sessions`.** Voir §2.
>
> **⚠️ La base `data/horizon.db` est toujours un mélange, pas « les vraies
> données ».** Le profil (nom, email, capital) est réel ; les 4 comptes
> trading, les 4 fiches élèves et les 6 trades sont **encore** le jeu de
> démonstration de `src/data/mockData.ts`. Voir §6, point 5.
>
> **Prochaine tâche** : reprendre la liste de §7 (le chantier IA est
> maintenant clos, tâches 2 à 5 restantes attendent une décision/action de
> l'utilisateur).

---

## 0. À committer

Tout le travail de cette session est dans l'arbre de travail, **rien n'a été
committé**. L'utilisateur commite lui-même sur demande explicite (§9) — ne
commite pas sans qu'il le demande, mais ne perds pas ces changements :
`git status` avant tout `checkout`/`reset`/`clean`.

```
 M .env.example
 M README.md
 M package-lock.json
 M package.json
 M server.ts
 M server/auth/middleware.ts
 M server/auth/routes.ts
 M server/db.ts
 M server/repositories.ts
 M server/routes.ts
 M server/schemas.ts
 M src/App.tsx
 M src/components/CoachMessaging.tsx
 M src/components/EquityCurveChart.tsx
 M src/components/MainDashboard.tsx
 M src/components/PerformanceDashboard.tsx
 M src/components/PositionCalculatorModal.tsx
 M src/components/PropFirmRulesModal.tsx
 M src/components/SMCSimulator.tsx
 M src/components/StudentTracking.tsx
 M src/components/TopHeader.tsx
 D src/components/TradeAuditModal.tsx
 M src/components/TradingJournal.tsx
 M src/components/UserProfileModal.tsx
 M src/components/WalletManagement.tsx
 M src/components/auth/LoginScreen.tsx
 M src/data/mockData.ts
 M src/hooks/useAuth.ts
 M src/hooks/useServerSync.ts
 M src/lib/api.ts
 M src/lib/image.ts
 M src/types.ts
?? server/auth/studentCredentials.ts
?? server/auth/studentRoutes.ts
?? server/auth/studentSessions.ts
?? src/lib/format.ts
```

33 fichiers modifiés ou supprimés, 4 fichiers créés. `git diff --stat` :
+2196 / −2738 lignes (la suppression de `TradeAuditModal.tsx` et le retrait de
l'IA font plus que compenser les ajouts). Dernier commit réel sur la branche :
`0e2566b` (« Corrige le HANDOFF : les comptes, élèves et trades sont encore de
la démo ») — **tout** ce que décrit ce document est postérieur à ce commit et
non committé.

`package.json`/`package-lock.json` ont changé : `@google/genai` a été
désinstallé (`npm uninstall @google/genai`), plus aucune dépendance IA.

---

## 1. Le projet en bref

**PropDesk** est une plateforme d'académie de trading SMC (*Smart Money
Concepts*) destinée à un coach et à ses élèves. Elle réunit dans une seule
interface :

- un **journal de trading** — saisie libre du PnL (`$` ou `%`, jamais
  calculé), capture d'écran jointe à chaque trade, aperçu complet d'un clic ;
- un **suivi des comptes prop firm** (FTMO, MyFundedFX, brokers réels) ;
- des **modules vidéo** avec quiz et progression ;
- un **simulateur** (replay de setups historiques + Monte Carlo) ;
- un **forum**, une **messagerie coach** (sans réponse automatique — voir
  §4), un **centre d'alertes** ;
- un **espace admin** de suivi des élèves, avec la possibilité de **donner un
  accès de connexion** à un élève pour son propre journal ;
- quatre **outils** en modale : audit de setup (déterministe, pas d'IA —
  voir §8), règles prop firm, mindset, calendrier économique.

**Aucune IA n'est utilisée nulle part dans l'application.** C'était vrai en
partie avant cette session (l'« Audit Setup » n'a jamais été de l'IA, voir
§8) ; c'est maintenant vrai **partout** : la dépendance `@google/genai`, la
clé `GEMINI_API_KEY`, la route `/api/coach/ai-review`, l'audit IA d'un trade,
le rapport de performance généré par IA, et la réponse automatique du coach
dans la messagerie ont tous été retirés (§4, « Retrait de l'IA »).

**Qui l'utilise, et ce que cela implique.** C'est l'outil de travail d'un coach
(« ForexPaps ») et de son staff. Plusieurs comptes staff peuvent se connecter
séparément, mais tous partagent **le même bureau** : mêmes trades, mêmes fiches
élèves, mêmes portefeuilles — ce n'est pas du multi-tenant côté staff (§6.3).
**Les élèves PEUVENT désormais avoir un compte** — mais un compte élève est un
second monde d'identité totalement séparé, avec son propre bureau de données
personnel cloisonné (un élève ne voit jamais que son propre Journal). Voir
§3, « Le modèle d'authentification à deux mondes ».

L'interface est **entièrement en français**, ton direct, tutoiement. Devise :
**`$`**, plus jamais `€` (§4).

Le projet vient de **Google AI Studio** à l'origine — c'est un fait
historique du dépôt, plus une caractéristique de l'application : elle
n'utilise plus aucun service Google ni aucune IA.

**Ordres de grandeur** (après cette session) : `src/App.tsx` ~1300 lignes,
`TradingJournal.tsx` ~1180 lignes (capture d'écran + aperçu complet ajoutés),
`StudentTracking.tsx` ~855 lignes. Le serveur a gagné 3 fichiers dédiés à
l'accès élève (`studentCredentials.ts`, `studentSessions.ts`,
`studentRoutes.ts`) et perdu tout le bloc Gemini de `server/routes.ts`.

**Seul le profil de l'utilisateur, en base, est réel.** Le reste — 4 comptes
trading, 4 fiches élèves, 6 trades — est encore le jeu de démonstration de
`mockData.ts`, jamais remplacé. Voir §6, point 5.

---

## 2. Démarrage immédiat

```bash
npm install
```

**Aucune variable d'environnement requise.** Un `.env` vide ou absent
suffit : toutes les variables ont un défaut utilisable (`.env.example` liste
`PORT`, `DATA_DIR`, `NODE_ENV`). `GEMINI_API_KEY` n'existe plus nulle part
dans le code — si tu la vois encore quelque part, c'est un oubli à signaler.

| Commande | Effet |
|---|---|
| `npm run dev` | serveur de développement sur http://localhost:3000 |
| `npm run lint` | `tsc --noEmit` — **doit toujours sortir sans erreur** |
| `npm run build` | bundle client (`dist/`) + serveur (`dist/server.cjs`) |
| `npm start` | sert le build de production (`NODE_ENV=production` requis) |
| `npm run clean` | supprime `dist/` |
| `node scripts/generate_pdf.js` | régénère le catalogue PDF des fonctionnalités |

Il n'y a **qu'un seul port**. Pas de proxy à configurer.

### ⚠️ Redémarrer le serveur de dev avant de toucher à l'accès élève

Le schéma SQLite a gagné deux tables (`student_accounts`, `student_sessions`)
cette session. `CREATE TABLE IF NOT EXISTS` ne s'exécute qu'**au chargement du
module** `server/db.ts` — un serveur déjà démarré avant ce changement ne les a
jamais créées dans sa connexion ouverte, même si le fichier `.db` sur disque
est le même.

```bash
lsof -ti:3000 | xargs -r kill
npm run dev
```

Un `.claude/launch.json` est présent : l'outil de prévisualisation démarre le
serveur sous le nom **`horizon-dev`** (port 3000, `autoPort` activé) — même
remarque si c'est la première fois que tu l'utilises après cette session.

Inspecter la base :

```bash
sqlite3 data/horizon.db "select id, pair, pnl, pnlUnit from trades order by position"
sqlite3 data/horizon.db "select id, name, email, must_change_password from staff_accounts"
sqlite3 data/horizon.db "select id, enrolled_student_id, email_lower from student_accounts"
```

Sonder l'API **sans** session :

```bash
curl -s localhost:3000/api/health && curl -s localhost:3000/api/auth/me && curl -s localhost:3000/api/auth/student-me
```

Compte admin actuel (staff) : `th.gauthey99@gmail.com`. Le mot de passe a été
réinitialisé manuellement pendant cette session (l'utilisateur l'a demandé en
clair dans le chat, hors procédure normale) — il ne figure pas ici par
principe (les mots de passe ne sont jamais consignés), demande-le directement
à l'utilisateur s'il te faut te connecter.

Pour exercer les routes staff protégées :

```bash
curl -s -c /tmp/pd.txt -X POST localhost:3000/api/auth/login -H 'Content-Type: application/json' -d '{"email":"…","password":"…"}' \
  && curl -s -b /tmp/pd.txt localhost:3000/api/state | head -c 400
```

Flux élève complet (depuis une session staff déjà connectée) :

```bash
# 1. Le staff invite une fiche élève existante (id d'un EnrolledStudent, ex. "stud-1")
curl -s -b /tmp/pd.txt -X POST localhost:3000/api/auth/students/stud-1/invite
# → { "studentAccountId": "...", "email": "...", "temporaryPassword": "..." }

# 2. L'élève se connecte, SUR UN AUTRE COOKIE JAR
curl -s -c /tmp/pd_student.txt -X POST localhost:3000/api/auth/student-login \
  -H 'Content-Type: application/json' -d '{"email":"...","password":"..."}'

# 3. Changement de mot de passe obligatoire
curl -s -b /tmp/pd_student.txt -c /tmp/pd_student.txt -X POST localhost:3000/api/auth/student-change-password \
  -H 'Content-Type: application/json' -d '{"currentPassword":"...","newPassword":"UnVraiMotDePasse123"}'

# 4. L'élève ne voit QUE ses trades
curl -s -b /tmp/pd_student.txt localhost:3000/api/state

# 5. Le staff lit les vrais trades de l'élève, en lecture seule
curl -s -b /tmp/pd.txt localhost:3000/api/auth/students/stud-1/trades

# 6. Révocation (ne supprime pas les trades ni la fiche)
curl -s -b /tmp/pd.txt -X DELETE localhost:3000/api/auth/students/stud-1/access
```

**Ne teste JAMAIS l'authentification (staff ou élève) sur `data/`.** Toujours
une base jetable :

```bash
lsof -ti:3102 | xargs -r kill -9
rm -rf /tmp/propdesk-test && mkdir -p /tmp/propdesk-test
DATA_DIR=/tmp/propdesk-test PORT=3102 npx tsx server.ts &
# ... tests ...
lsof -ti:3102 | xargs -r kill -9
rm -rf /tmp/propdesk-test
```

---

## 3. Architecture

### Vue d'ensemble

Un serveur **Express unique** sert l'API **et** l'application. En
développement il monte Vite en middleware ; en production il sert `dist/`.

```
server.ts              point d'entrée : Express + Vite/statique
server/
  db.ts                SQLite (better-sqlite3, WAL), schéma + migrations
  repositories.ts      accès aux données — SEUL module qui parle à SQLite
  routes.ts            routes /api/*, barrière requireAuth, filtrage élève
                        (plus AUCUNE route IA depuis cette session)
  schemas.ts           validation zod des entrées (coachReviewSchema retiré)
  seed.ts              amorçage et import d'un état complet
  auth/
    password.ts        hachage scrypt, vérification, re-hachage
    sessions.ts         jetons, cookie STAFF (pd_session), purge
    credentials.ts      accès à staff_accounts
    routes.ts           authRouter (public) + staffRouter (protégé, staff) ;
                         + routes /students/:id/invite|access|trades
    middleware.ts        requireAuth (deux mondes), requireStaffKind,
                         requireStudentKind, requireAdmin, requireOwner
    studentCredentials.ts   accès à student_accounts
    studentSessions.ts      jetons, cookie ÉLÈVE (pd_student_session)
    studentRoutes.ts        studentAuthRouter (public) +
                             studentProtectedRouter (protégé, élève)
  middleware/
    rateLimit.ts        fabrique de limiteur par IP
src/
  main.tsx              point de montage React
  App.tsx               porte d'auth à deux mondes + état applicatif staff
                         + StudentAuthenticatedApp (journal élève minimal)
                         + handleSendMessage SANS réponse automatique
  types.ts              source de vérité des formes de données
                         (aiAudit et pnlPercentage : @deprecated, lecture seule)
  index.css             Tailwind 4 + styles globaux
  data/mockData.ts      jeu de données d'amorçage
  hooks/
    usePersistentState.ts   état miroité dans localStorage
    useServerSync.ts        useBootstrap (staff) + useStudentBootstrap
                             (élève, minimal) + useSyncedState
    useAuth.ts               état d'auth à deux mondes (staff + élève)
  lib/
    api.ts              client HTTP typé — routes staff ET élève
    image.ts            réduction des images (avatar carré + capture
                         d'écran rectangulaire, voir §4)
    format.ts            formatCurrency() — $ uniquement
  components/           10 vues d'onglet + modales + Sidebar/TopHeader
                         (PLUS de TradeAuditModal — supprimé)
    auth/               AuthShell, LoginScreen (variante staff/élève),
                        SetupScreen, ChangePasswordScreen (réutilisé tel quel)
public/
  icon.png / logo-auth.jpg / logo.png / Fonctionnalites_Horizon_SMC.pdf
scripts/generate_pdf.js  génération hors ligne du PDF
```

### Le modèle d'authentification à deux mondes

Deux mondes d'identité totalement séparés, chacun avec ses propres tables,
son propre cookie, sa propre notion de « bureau de données ».

| | Monde **staff** (inchangé) | Monde **élève** |
|---|---|---|
| Table d'identité | `staff_accounts` | `student_accounts` |
| Table de sessions | `sessions` | `student_sessions` |
| Cookie | `pd_session` | `pd_student_session` |
| Bureau de données | `DEFAULT_USER_ID` — un seul, partagé | une ligne `users` dédiée par élève (`student_accounts.user_id`) |
| Ce qu'il voit | Tout | **Uniquement** sa collection `trades` |
| Créé par | `/auth/setup` puis invitation staff | Invitation depuis une fiche `EnrolledStudent` existante |

`req.auth` porte un discriminant `kind` (`server/auth/middleware.ts`) :

```ts
export interface AuthContext {
  userId: string;       // id d'IDENTITÉ (staff_accounts.id OU student_accounts.id)
  kind: "staff" | "student";
  dataUserId: string;   // le user_id à passer à repositories.ts — DEFAULT_USER_ID
                         // pour le staff, le bureau dédié pour un élève
  isAdmin: boolean;
  isOwner: boolean;
}
```

**`dataUserId` ≠ `userId` — ne pas les confondre.** `userId` identifie le
compte (identité de connexion) ; `dataUserId` identifie le bureau de données
à passer à `repositories.ts`. Deux comptes staff différents ont deux `userId`
différents mais le **même** `dataUserId` (`DEFAULT_USER_ID`) — c'est ce qui
leur fait partager le même bureau.

**⚠️ Piège Express déjà rencontré et corrigé — ne le réintroduis pas.**
`staffRouter` et `studentProtectedRouter` sont montés sur le **même préfixe**
`"/auth"`. Une garde de rôle (`requireStaffKind`/`requireStudentKind`) posée
**au niveau du montage** ou en `.use()` en tête d'un routeur s'exécute pour
**toute** requête sous `/auth/*`, y compris celles destinées à l'autre
routeur — Express ne regarde pas d'abord si une route interne correspond.
**La garde doit être un argument de chaque route individuelle**
(`staffRouter.post("/staff", requireStaffKind, ...)`), jamais au montage.
Voir le code actuel de `server/auth/routes.ts`/`studentRoutes.ts` pour le
motif correct.

### Chaîne serveur pour `/api/state` ou `/api/collections/:name`

- Session **staff** : comportement inchangé — toutes les collections,
  `listCollection(name, DEFAULT_USER_ID)`.
- Session **élève** : `GET /api/state` ne renvoie que `collections.trades`
  (filtré sur `dataUserId`) + un profil minimal. `PUT /api/collections/:name`
  gardé par `STUDENT_ALLOWED_COLLECTIONS = new Set(["trades"])`.
- `/api/profile`, `/api/quiz-results`, `/api/state/import`, `/api/state/seed`
  sont bloquées (403) pour `kind === "student"`.

### Démarrage du client

```
App()                        ne fait QUE useAuth()
 ├─ "loading"                → LoadingScreen
 ├─ "no-account"             → SetupScreen (première installation, staff)
 ├─ "unauthenticated"        → LoginScreen, à bascule staff/élève
 │                             (lien "Tu es élève ?" ↔ "Tu es coach ?")
 ├─ "authenticated" + mustChangePassword       → ChangePasswordScreen (staff)
 ├─ "authenticated-student" + mustChangePassword → ChangePasswordScreen (élève)
 ├─ "authenticated-student"  → StudentAuthenticatedApp()
 │                             useStudentBootstrap() → <TradingJournal
 │                             hideAiAndCoachActions accounts={[]} ... />
 └─ "authenticated" / "offline"  → AuthenticatedApp()
      └─ useBootstrap()       →  GET /api/state (staff, inchangé)
           └─ AcademyApp()    toutes les vues et modales
                               (STRUCTURE INTERNE INTOUCHÉE cette session)
```

`AcademyApp`/`AuthenticatedApp` n'ont subi **aucune** modification
structurelle. `StudentAuthenticatedApp` (~90 lignes) réutilise
`<TradingJournal>` tel quel.

### Schéma SQLite — deux tables ajoutées cette session

```sql
CREATE TABLE student_accounts (
  id                    TEXT PRIMARY KEY,
  enrolled_student_id   TEXT NOT NULL REFERENCES enrolled_students(id) ON DELETE CASCADE,
  user_id               TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  email                 TEXT NOT NULL,
  email_lower           TEXT NOT NULL UNIQUE,
  password_hash         TEXT NOT NULL,
  must_change_password  INTEGER NOT NULL DEFAULT 1,
  invited_by            TEXT REFERENCES staff_accounts(id) ON DELETE SET NULL,
  created_at            TEXT NOT NULL,
  updated_at            TEXT NOT NULL
);
CREATE TABLE student_sessions ( -- copie structurelle de `sessions`
  id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES student_accounts(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL, expires_at TEXT NOT NULL, last_seen_at TEXT NOT NULL, user_agent TEXT
);
```

`server/repositories.ts` a gagné `updateCollectionItem(name, id, item,
userId)` : fait un `UPDATE` ciblé sur une seule ligne, **sans** vider-
réinsérer toute la collection — voir §8, « Piège : `replaceCollection` et les
cascades », pour la raison exacte de son existence. **Utilise cette fonction,
pas `replaceCollection`, chaque fois que tu modifies un seul élément d'une
collection qui a une table enfant en `ON DELETE CASCADE`.**

`EnrolledStudent` a gagné `studentAccountId?: string` (optionnel).

---

## 4. Fonctionnalités terminées

*(Les fonctionnalités des sessions antérieures à celle-ci — socle technique,
persistance serveur, navigation et sidebar, authentification staff,
`isOwner`, poids des images, identité visuelle, rattachement trades/comptes,
édition d'un trade sans recalcul, modifications hors ligne, découpage du
bundle — sont **inchangées**. Voir l'historique git de ce fichier
[commit `0e2566b`] pour leur détail complet. Ce qui suit est le travail de
cette session, dans l'ordre où il a été livré.)*

### Passage € → $

Fonction centralisée `formatCurrency()` dans `src/lib/format.ts`, utilisée
dans les 13 fichiers qui affichaient un montant. Plus aucune occurrence de
`€` dans `src/` (vérifié par `grep`). Libellés de champ (« Capital Initial
(€) ») devenus `($)`.

### PnL libre : `$` ou `%`, plus aucun calcul automatique

`pnlDepuis()` (proposait un PnL avec un multiplicateur de 1000, faux pour
tout instrument) a été **entièrement supprimé**, ainsi que l'état
`pnlTouche`. Le champ PnL du formulaire est une saisie libre avec un
sélecteur d'unité :

```ts
export type PnlUnit = "USD" | "PERCENT";
// Trade.pnlUnit?: PnlUnit — optionnel, absent = "USD" implicite
// Trade.pnlPercentage?: number — @deprecated, plus jamais écrit
```

- **`$`** : montant arrondi à l'entier, `formatCurrency()`.
- **`%`** : pourcentage **libre, tapé par l'utilisateur**, jamais calculé ni
  converti. Garde ses décimales.
- **WIN/LOSS/Breakeven** : seuil `±$50` conservé pour `$` ; pour `%`, aucune
  marge morte (positif → WIN, négatif → LOSS, zéro → Breakeven).
- **Agrégation** : tous les totaux monétaires (PnL cumulé, Profit Factor,
  courbe d'équité, stats par stratégie/émotion) **excluent** les trades en
  `%` (filtre `(t.pnlUnit ?? "USD") !== "PERCENT"`). Un trade en `%` compte
  quand même dans le Win Rate et le nombre de positions.
- **CSV** : colonnes `PnL` + `Unité PnL`.

### Accès élève : Journal de trading cloisonné

Voir §3 pour l'architecture. Côté fonctionnel : un élève connecté ne voit que
son propre Journal (saisie + stats), sans onglets, sans IA (déjà vrai avant
même le retrait global), sans champ « Compte » utile (`accounts={[]}`).

**Comment un élève obtient un compte** : dans Suivi des Élèves
(`StudentTracking.tsx`), bouton **« Donner un accès »** sur toute fiche sans
`studentAccountId` → `POST /auth/students/:id/invite` → mot de passe
temporaire affiché **une seule fois**. Badge **« Compte actif »** ensuite
(cliquable pour révoquer). Dès qu'un compte est actif, la fiche affiche les
**vrais** trades de l'élève (`GET /auth/students/:id/trades`) à la place de
la saisie manuelle `recentTrades`.

**Vérifié de bout en bout, sur base jetable** : invitation → connexion sur
cookie jar séparé → changement de mot de passe obligatoire → saisie d'un
trade → absence totale dans le bureau staff → lecture par le staff → second
élève, aucune fuite croisée → révocation propre → 401/403 sur tout ce qui
est hors périmètre.

### Journal — retouches ciblées

- **Bouton « Audit IA » retiré** de chaque ligne (`onSelectTradeForAudit`
  purgé de `TradingJournal.tsx` et de ses deux points d'appel dans
  `App.tsx`). Le bouton « Discuter avec le coach » n'a pas été touché à ce
  moment-là (il a depuis perdu sa réponse automatique, voir plus bas).
- **Colonne « Actions Coach IA » renommée « Actions »**.
- **Capture d'écran jointe à un trade** : nouveau champ dans le formulaire de
  saisie/édition, upload + aperçu + boutons Remplacer/Retirer. Nouvelle
  fonction `resizeChartScreenshot()` dans `src/lib/image.ts` — réduit
  l'image à 1600 px de large max **sans la recadrer** (contrairement à
  l'avatar, carré), compressée en WebP/JPEG, même garde-fou 20 Mo au
  décodage que l'avatar. Réutilise le champ existant `Trade.chartUrl`.
- **Bouton « œil » transformé en aperçu complet** : disponible sur **toutes**
  les lignes désormais (avant, seulement si `chartUrl` existait). Affiche la
  capture d'écran (ou « Aucune capture d'écran jointe ») puis un résumé
  complet de tous les champs saisis (compte, marché, résultat, dates,
  taille de lot, prix, PnL avec unité, émotion, notes).

**Vérifié de bout en bout** sur la vraie base (trade de test créé, capture
1920×1080 réduite à 4,7 ko en WebP, aperçu et modale d'agrandissement
fonctionnels, trade de test supprimé, base revérifiée à 6 trades intacts).

### Pastille de session de marché, calculée en direct

`TopHeader.tsx` affichait « SESSION NY » et un faux cours `XAU/USD 2418.4
+1.2%` figés en dur. Remplacé par un calcul réel :

```ts
const FOREX_SESSIONS = [
  { name: "Sydney", startUTC: 21, endUTC: 6 },  // traverse minuit UTC
  { name: "Tokyo", startUTC: 0, endUTC: 9 },
  { name: "Londres", startUTC: 7, endUTC: 16 },
  { name: "New York", startUTC: 12, endUTC: 21 },
];
```

Comparaison sur **l'heure UTC** de l'instant réel (`getUTCHours()`), pas
l'heure locale du navigateur — comme `new Date()` représente le même instant
pour tout le monde, chaque utilisateur voit la bonne session ouverte au bon
moment quel que soit son fuseau. Gère les chevauchements (« Sydney / Tokyo »,
« Londres / New York »), le week-end (« Marché fermé » de vendredi 21h UTC à
dimanche 21h UTC), et se rafraîchit toutes les 60 secondes. Le faux cours a
été retiré, pas remplacé (aucune source de prix réelle n'existe dans
l'application).

**Vérifié** : à 04h38 UTC un mardi, affiche correctement « Sydney / Tokyo ».

### Retrait complet de l'IA de l'application

Décision explicite et répétée de l'utilisateur : « je ne veux pas qu'il y
ait de IA ». Portée : **toute** l'application, staff compris (le module
élève n'en avait déjà aucune).

**Retiré :**
- `src/components/TradeAuditModal.tsx` — **fichier supprimé**. Plus aucune
  référence (vérifié par `grep`).
- `server/routes.ts` : le bloc entier « Coach IA (Gemini) » —
  `getAiClient()`, `aiRateLimit`, la route `POST /api/coach/ai-review` et ses
  deux prompts (audit de trade / réponse à une question), l'import
  `GoogleGenAI`.
- `server/schemas.ts` : `coachReviewSchema` retiré.
- `src/App.tsx` : `selectedTradeForAudit`, `handleUpdateTradeAudit`, le rendu
  de `<TradeAuditModal>`, l'appel `fetch("/api/coach/ai-review")` dans
  `handleSendMessage` (qui simulait une réponse automatique du coach).
  `handleSendMessage` enregistre maintenant le message envoyé et s'arrête
  là — **aucune réponse automatique n'est générée**.
- `src/components/CoachMessaging.tsx` : la bascule « Réponse IA Immédiate »
  (`isAiCoachMode`), le paramètre `triggerAiReply`, l'indicateur « Le Coach
  réfléchit... » (remplacé par un simple « Envoi en cours... »).
- `src/components/PerformanceDashboard.tsx` : le bouton « Générer un Audit IA
  Globale », `generateAiGlobalAudit()`, l'état `aiReport`/
  `isGeneratingAiReport`, le bloc d'affichage du rapport généré.
- `src/components/MainDashboard.tsx` : la prop `onSelectTradeForAudit`
  (déjà dead code — jamais appelée dans le corps du composant).
- `package.json`/`package-lock.json` : `@google/genai` désinstallé
  (`npm uninstall @google/genai`).
- `.env`, `.env.example`, `README.md` : toute mention de `GEMINI_API_KEY`
  retirée.
- `src/data/mockData.ts` : le badge `badge-5` (« Expert de l'AI Audit »,
  catégorie `AUDIT`) repensé en « Analyste Rigoureux » (catégorie
  `PERFORMANCE`, même valeurs numériques pour ne rien casser côté
  progression/XP). Le filtre de catégorie « Audit IA » retiré de
  `UserProfileModal.tsx`.
- Libellés résiduels : « obtenir des audits IA automatisés par votre coach »
  (bandeau du Journal) → « progresser trade après trade ». Deux commentaires
  de code appelant à tort l'analyseur de setup « analyseur IA » corrigés en
  « analyseur de setup » (rappel : ce module n'a **jamais** été de l'IA, voir
  §8 — c'était un mot choisi par erreur dans un commentaire, pas un fait).

**Conservé sciemment** : `Trade.aiAudit` reste dans `src/types.ts`, marqué
`@deprecated`, pour ne pas casser la lecture de données existantes (2 trades
de `mockData.ts` en portent encore). Plus jamais écrit ni lu par aucune UI.

**⚠️ Non vérifié visuellement** — voir le bandeau en tête de document. Le
code compile et build sans erreur (`npm run lint`, `npm run build` verts),
mais aucune capture d'écran n'a confirmé le rendu réel dans le navigateur
après ces derniers changements.

---

## 5. Fichiers créés ou modifiés cette session

### Créés

| Fichier | Rôle |
|---|---|
| `src/lib/format.ts` | `formatCurrency()` — devise unique `$` |
| `server/auth/studentCredentials.ts` | accès à `student_accounts` |
| `server/auth/studentSessions.ts` | jetons/cookie élève `pd_student_session` |
| `server/auth/studentRoutes.ts` | routes publiques + protégées élève |

### Supprimé

| Fichier | Raison |
|---|---|
| `src/components/TradeAuditModal.tsx` | Audit IA Gemini retiré (§4) |

### Modifiés — passage € → $ (mécanique)

`CoachMessaging.tsx`, `EquityCurveChart.tsx`, `MainDashboard.tsx`,
`PositionCalculatorModal.tsx`, `PropFirmRulesModal.tsx`, `SMCSimulator.tsx`,
`TopHeader.tsx`, `UserProfileModal.tsx`, `WalletManagement.tsx`,
`mockData.ts` (texte du quiz).

### Modifiés en profondeur

| Fichier | Nature des changements |
|---|---|
| `src/components/TradingJournal.tsx` | Suppression `pnlDepuis()`/`pnlTouche` ; champ PnL `$`/`%` ; seuils WIN/LOSS différenciés ; agrégats filtrés `%` ; CSV ; bouton Audit IA retiré ; colonne « Actions » ; capture d'écran (upload + aperçu) ; modale « œil » → aperçu complet ; prop `hideAiAndCoachActions` |
| `src/components/StudentTracking.tsx` | Bouton « Donner un accès », modale mot de passe temporaire, bascule vrais trades, révocation |
| `src/components/auth/LoginScreen.tsx` | Props `title`/`subtitle`/`footer` pour la variante élève |
| `src/App.tsx` | Branche `"authenticated-student"`, `StudentAuthenticatedApp`, filtre `%` sur `totalPnL`, retrait complet du bloc Audit IA et de la réponse automatique du coach |
| `src/components/PerformanceDashboard.tsx` | Filtre `%` sur les agrégats ; retrait du bouton/rapport d'Audit IA Globale |
| `src/components/CoachMessaging.tsx` | Retrait de la bascule IA et de l'indicateur « Le Coach réfléchit » |
| `src/components/TopHeader.tsx` | Pastille de session calculée en direct (UTC), faux cours retiré |
| `src/hooks/useAuth.ts` | `AuthStatus` élargi, `studentUser`, `studentLogin`, `studentChangePassword` |
| `src/hooks/useServerSync.ts` | `useStudentBootstrap()` |
| `src/lib/api.ts` | Routes élève (invite/revoke/fetchTrades/login/logout/changePassword) |
| `src/lib/image.ts` | `resizeChartScreenshot()` (capture d'écran, sans recadrage) |
| `src/types.ts` | `PnlUnit`, `Trade.pnlUnit`, `pnlPercentage`/`aiAudit` devenus `@deprecated`, `EnrolledStudent.studentAccountId` |
| `server/db.ts` | Tables `student_accounts`, `student_sessions` |
| `server/repositories.ts` | `updateCollectionItem()` |
| `server/routes.ts` | Routeurs élève, filtrage `/api/state`/`/api/collections/:name`, **retrait complet du bloc Coach IA (Gemini)** |
| `server/schemas.ts` | `coachReviewSchema` retiré |
| `server/auth/middleware.ts` | `AuthContext.kind`/`dataUserId`, `requireStaffKind`, `requireStudentKind` |
| `server/auth/routes.ts` | Routes `/students/:id/invite|access|trades`, gardes posées **par route** |
| `server.ts` | `startStudentSessionCleanup()` |
| `package.json` | `@google/genai` désinstallé |
| `.env`, `.env.example`, `README.md` | Toute mention de Gemini/`GEMINI_API_KEY` retirée |

---

## 6. Bugs connus et limites

### 1. (Corrigé cette session) Retrait de l'IA — vérification visuelle faite

Voir le bandeau en tête de document. `npm run lint`/`npm run build` verts,
**et** contrôle visuel fait dans le navigateur sur `PerformanceDashboard`,
`CoachMessaging` (message de test envoyé, aucune réponse automatique) et
`TradingJournal`. Chantier clos.

### 2. (Corrigé cette session) `replaceCollection` et les cascades SQL

`replaceCollection("enrolledStudents", ...)` vide puis réinsère toute la
table, ce qui déclenchait `ON DELETE CASCADE` sur
`student_accounts.enrolled_student_id` et supprimait silencieusement le
compte élève juste créé, dans la même transaction, sans lever d'exception.
**Corrigé** par `updateCollectionItem()` (§3, §8). Si tu ajoutes une nouvelle
table avec une FK `ON DELETE CASCADE` vers une collection existante, vérifie
qu'aucune écriture serveur simultanée sur une table liée n'utilise
`replaceCollection`.

### 3. Redémarrage serveur requis pour le schéma élève

Voir §2. Pas un bug de code, un piège opérationnel.

### 4. Rattachement trades ↔ comptes — inchangé, toujours vrai

Le rattachement existe, mais les 6 trades de démo restent tous « Non
rattaché ». Action utilisateur, pas un bug (§7, tâche 2).

### 5. La base est un mélange : un seul profil réel, tout le reste est de la démo

**Inchangé**. Les 4 `trading_accounts`, les 4 `enrolled_students` et les 6
`trades` sont identiques à `mockData.ts`. Seul le profil (`users`, 1 ligne)
est réel.

> **`rm -rf data/` détruit quand même de vraies données.** Sauvegarde
> d'abord (`cp data/horizon.db data/horizon.db.bak`), et ne laisse pas la
> sauvegarde derrière toi.

### 6. Aucun test automatisé

Inchangé. Tout est vérifié à la main (§9).

### 7. SQLite sur disque éphémère

Inchangé (Cloud Run, disque éphémère — voir historique git pour le détail).

### 8. Mot de passe admin réinitialisé en clair dans le chat

Pendant cette session, l'utilisateur a demandé le mot de passe du compte
admin, puis a fourni un nouveau mot de passe directement dans le chat pour
qu'il soit haché et enregistré en base. C'est une entorse à la bonne
pratique habituelle (ne jamais faire transiter un mot de passe en clair) —
fait une fois, à la demande explicite de l'utilisateur, mot de passe haché
immédiatement avec la fonction scrypt existante de l'application. Ne
propose jamais ce chemin de toi-même ; si l'utilisateur perd de nouveau
l'accès, la même procédure reste possible mais doit rester à son initiative.

---

## 6 bis. Ce qui ressemble à du code mort, mais ne l'est pas

*(Inchangé cette session pour les points déjà connus — `CoachSignals` sans
entrée de sidebar mais atteignable par notification, l'onglet `exam`
volontairement vide, `public/logo.png` non importé mais source du logo. Voir
l'historique git pour le détail. Un ajout ci-dessous.)*

**`Trade.pnlPercentage` et `Trade.aiAudit`** sont `@deprecated` dans
`src/types.ts` et ne sont plus jamais écrits — mais ils restent dans le type
et peuvent apparaître sur des trades mock anciens (`mockData.ts`). Ne les
supprime pas du type sans vérifier qu'aucune donnée existante ne les porte
encore : ce sont des champs de lecture historique, pas du code mort à nettoyer.

---

## 6 ter. Arbitrages déjà rendus

*(Table cumulative — consulte-la avant de proposer un choix déjà tranché.
Les lignes ci-dessous sont celles décidées cette session ; voir l'historique
git pour les arbitrages antérieurs, tous toujours valides.)*

| Sujet | Décision |
|---|---|
| Utiliser l'IA quelque part dans l'application | **Non, nulle part.** Décision explicite et répétée deux fois par l'utilisateur (§4, « Retrait de l'IA »). Ne réintroduis aucun appel à un service d'IA sans qu'il le redemande explicitement |
| Réponse automatique dans la messagerie coach | **Supprimée avec l'IA.** Un message envoyé reste sans réponse tant qu'un humain n'y répond pas — aucune fonctionnalité de réponse humaine par le staff n'a été construite pour autant (hors sujet de ce chantier) |
| Badge « Expert de l'AI Audit » | **Repensé**, pas supprimé — devenu « Analyste Rigoureux », catégorie PERFORMANCE, même valeurs numériques |
| Formule de PnL automatique (table de tailles de contrat) | **Abandonnée** — remplacée par une saisie libre `$`/`%`, aucun calcul |
| Devise de l'application | **`$` partout**, plus jamais `€` |
| Le `%` du champ PnL représente | un nombre tapé librement, jamais calculé ni converti |
| Agrégation des trades `$` et `%` | Exclusion des `%` de tout total monétaire ; ils comptent dans le Win Rate et le nombre de positions |
| Champ « Compte » côté élève | Masqué (`accounts={[]}`) — aucun sens sans accès au module Portefeuille |
| Qui peut avoir un compte | Le staff, ET désormais les élèves — deux mondes d'identité séparés |
| Périmètre d'un compte élève | Uniquement son propre Journal de trading |
| Stockage de l'identité élève | Tables séparées (`student_accounts`, `student_sessions`) |
| Fiche élève vs vrai journal | Le vrai journal devient la source dès qu'un compte est actif |
| Bouton « œil » du Journal | Transformé en aperçu complet de toutes les données du trade, disponible sur toutes les lignes (plus seulement celles avec capture d'écran) |
| Capture d'écran d'un trade | Réduite à 1600 px de large max, **sans recadrage** (contrairement à l'avatar) |
| Pastille « Session » du header | Calculée en direct (UTC), sessions réelles (Sydney/Tokyo/Londres/New York), plus de faux cours affiché |

---

## 7. Prochaines tâches, dans l'ordre

### 1. (Fait cette session) Vérification du retrait de l'IA

Voir le bandeau en tête de document et §6 point 1. Clos.

### 2. Remplir le module « Examen »

Inchangé depuis les sessions précédentes. L'onglet `exam` affiche une page
vierge volontaire (« Contenu à venir »). Demander à l'utilisateur ce qu'il
veut y mettre avant de coder.

### 3. Rattacher les 6 trades existants à un compte

Inchangé. Action utilisateur, pas une tâche de code.

### 4. Fusion ligne à ligne des modifications hors ligne

Inchangé. Écarté volontairement — coût élevé, à ne faire que sur demande.

### 5. Vider les données de démonstration avant la mise en ligne

Inchangé. Pas urgent, juste confirmé avec l'utilisateur.

### Ce qui n'est PAS une tâche

- **Réintroduire de l'IA sous quelque forme que ce soit.** Décision explicite
  et répétée — ne le fais pas sans nouvelle demande claire.
- **Construire une réponse humaine du staff dans la messagerie coach**, pour
  remplacer l'ancienne réponse automatique IA. Personne ne l'a demandé ; la
  messagerie reste fonctionnelle pour l'envoi, simplement sans réponse
  automatique.
- **Le cloisonnement des données par compte staff** — bureau partagé
  toujours voulu pour le staff. *Ne pas confondre* avec l'accès élève, qui
  est lui bien cloisonné par construction.
- **Étendre `isOwner` à autre chose que le masquage des modules.**
- **Donner aux élèves accès à autre chose que leur Journal.**

---

## 8. Décisions techniques importantes

*(Les décisions des sessions antérieures — typage strict, palette, HMR,
rattachement trades/comptes, modification sans recalcul, modifications hors
ligne, découpage du bundle, Tailwind 4, `.passthrough()`, remplacement de
collection entière, `setState` fonctionnel, clés stables de sidebar, seed
côté client, pièges d'authentification, poids des assets sérialisés,
« Audit Setup » n'est pas une fonction IA — restent **toutes valides**. Voir
l'historique git de ce fichier pour leur détail complet. Ce qui suit est
nouveau ou complète un point déjà connu.)*

### Piège : `replaceCollection` et les cascades SQL

**Le bug rencontré.** La route d'invitation élève faisait, dans une seule
transaction : (1) `createStudentAccount(...)` — insère `student_accounts`
avec FK `ON DELETE CASCADE` vers `enrolled_students` ; (2)
`replaceCollection("enrolledStudents", updated)` pour poser
`studentAccountId` sur la fiche. `replaceCollection` **vide puis réinsère
toute la collection** : le `DELETE` de l'étape 2 supprime **momentanément**
la ligne de la fiche, et SQLite applique le `ON DELETE CASCADE`
**immédiatement**, pas à la fin de la transaction — la ligne
`student_accounts` créée à l'étape 1 est supprimée à son tour. La fiche est
ensuite réinsérée avec le nouveau payload (elle a donc l'air correcte), mais
le compte élève a disparu, **sans qu'aucune exception ne soit levée**.

Découvert en comparant la réponse de l'API (succès annoncé) au contenu réel
de `student_accounts` via `sqlite3` — la seule façon de le voir.

**La correction** : `updateCollectionItem(name, id, item, userId)` fait un
`UPDATE` ciblé, jamais de suppression, donc jamais de cascade déclenchée.

**Règle à retenir** : dès qu'une collection a une table enfant avec
`ON DELETE CASCADE`, n'utilise jamais `replaceCollection` pour modifier un
seul élément à l'intérieur d'une transaction qui vient d'écrire dans la
table enfant — utilise `updateCollectionItem`.

### Piège : les gardes de rôle doivent être posées route par route

Voir §3 pour le détail complet. Deux routeurs Express montés sur le même
préfixe ne peuvent pas chacun avoir une garde de rôle en `.use()` ou en
argument du montage — la garde du premier routeur enregistré s'exécute pour
toutes les requêtes sous ce préfixe. La garde doit être un argument de
**chaque route individuelle**.

### Deux mondes d'identité : pourquoi pas un rôle sur `staff_accounts`

Plutôt que d'ajouter une colonne `role` à `staff_accounts` et de réutiliser
`sessions`, deux tables et deux cookies entièrement séparés. Raison : la
contrainte FK stricte existante `sessions.user_id → staff_accounts(id) ON
DELETE CASCADE` aurait dû être affaiblie, et tout endroit lisant
`staff_accounts` sans filtrer explicitement par rôle aurait pu
accidentellement traiter un élève comme un membre du staff (ex.
`GET /auth/staff`, qui liste littéralement « tous les comptes »).

### Session de marché : heure UTC, pas heure locale du navigateur

`getActiveSessionLabel()` dans `TopHeader.tsx` compare `date.getUTCHours()`,
jamais `date.getHours()`. Les horaires d'ouverture des marchés sont fixes
dans le temps réel (UTC), indépendants d'où se trouve la personne qui
regarde l'écran — `new Date()` représente déjà le même instant réel pour
tout le monde, donc comparer en UTC suffit à donner la bonne réponse à
chaque utilisateur, sans avoir besoin de connaître son fuseau horaire
explicitement.

### Capture d'écran d'un trade : pas de recadrage, contrairement à l'avatar

`resizeChartScreenshot()` (`src/lib/image.ts`) réduit à une dimension
maximale (1600 px) en conservant les proportions, **sans recadrer en carré**
comme le fait `resizeAvatar()`. Un graphique de bougies recadré en carré
perdrait toute lisibilité (mèches et niveaux de prix coupés) — le compromis
qui fonctionne pour un visage ne fonctionne pas pour un graphique.

### Retirer l'IA : distinguer le vrai du faux

`server/routes.ts` avait **une seule** route branchée sur un vrai service
externe (`/api/coach/ai-review`, Gemini) — mais elle servait **trois**
usages différents dans l'interface (audit d'un trade, rapport de
performance global, réponse dans la messagerie coach). Les trois ont dû être
retirés séparément côté client, alors qu'ils partageaient la même route
serveur. À l'inverse, l'« Audit Setup » (`SetupAnalyzerModal.tsx`) n'a
**jamais** appelé cette route ni aucun service externe — c'est une matrice de
confluences déterministe (6 cases à cocher pondérées), malgré un nom
historique trompeur (`AISetupAnalyzerModal`, déjà corrigé lors d'une session
antérieure) et deux commentaires de code qui l'appelaient encore à tort
« analyseur IA », corrigés cette session. **Avant de retirer quoi que ce soit
au nom du retrait de l'IA, vérifie par un `grep` du nom de la route/du
service si la fonctionnalité appelle réellement un service externe** — un
nom ou un commentaire mentionnant « IA » ne le garantit pas.

---

## 9. Contexte de travail avec l'utilisateur

*(Inchangé pour l'essentiel — voir l'historique git pour le détail complet.
Résumé, complété par cette session :)*

- Il **communique en français** et attend des réponses en français.
- Il travaille par **demandes courtes et itératives**, souvent en désignant
  un élément précis de l'interface (captures d'écran avec élément
  sélectionné, comme pour la pastille de session).
- Il **commite lui-même la décision de committer** — ne pas committer sans
  qu'il le demande. **Rien n'a été committé cette session** (§0).
- Il donne des instructions **fermes et sans ambiguïté sur ses choix
  produits une fois qu'il les a formulés** deux fois de suite (« je ne veux
  pas d'IA », répété identiquement à la session précédente puis à
  celle-ci) — inutile de redemander confirmation dans ce cas, agir
  directement mais **vérifier exhaustivement** (grep sur tout le dépôt)
  plutôt que de s'arrêter aux occurrences évidentes.
- **Ses données de travail sont réelles.** Ne jamais tester l'authentification
  (staff ou élève) ni la persistance sur `data/horizon.db` — toujours une
  base jetable, nettoyée après usage. Cette règle a été respectée sans
  écart cette session (vérifié : `data/horizon.db` toujours à 6 trades après
  tous les tests).
- Ponctuellement, il peut demander une action qui sort du cadre des bonnes
  pratiques habituelles (ex. transmettre un nouveau mot de passe en clair
  dans le chat pour réinitialiser son propre compte, §6 point 8) — dans ce
  cas, signaler que ce n'est pas la procédure normale mais s'exécuter
  puisque c'est son propre compte et une demande explicite, sans réclamer
  de validation supplémentaire.

### Méthode de vérification utilisée cette session (à reprendre)

1. `npm run lint` et `npm run build` après chaque changement significatif.
2. Pour un changement serveur touchant à l'auth/aux données : base jetable,
   scénario complet au `curl`, vérification directe en `sqlite3` de ce qui a
   **réellement** été écrit (pas seulement la réponse HTTP — c'est ce qui a
   révélé le bug de cascade).
3. Pour un changement visuel : capture d'écran dans le navigateur après
   chaque étape significative, jamais seulement après la compilation.
4. Nettoyage systématique des données de test après chaque vérification —
   aucune trace de test n'est restée dans `data/horizon.db`.

### Ce qui n'a pas été vérifié cette session, à ne pas supposer fait

- **Le rendu visuel du retrait de l'IA** dans `PerformanceDashboard` et
  `CoachMessaging` — voir le bandeau en tête de document, c'est la priorité
  n°1 de reprise (§7, tâche 1).
- Le comportement de re-invitation après révocation d'un élève (edge case
  déjà documenté avant cette session, toujours non traité).
- Aucun test avec une vraie clé Gemini — devenu sans objet, la fonctionnalité
  n'existe plus.

---

## 10. État à la reprise

- Branche `main`, **arbre de travail avec des changements non committés**
  (§0) — 33 fichiers modifiés/supprimés, 4 fichiers créés.
- `npm run lint` et `npm run build` : **sans erreur**, vérifié juste avant la
  rédaction de ce document.
- Quatre chantiers complets et vérifiés de bout en bout (€→$/PnL libre,
  accès élève, retouches du Journal avec capture d'écran, pastille de
  session dynamique) — voir §4 pour le détail des scénarios exercés.
- Un cinquième chantier (retrait de l'IA) **complet et entièrement vérifié**,
  y compris dans le navigateur (bandeau en tête de document).
- **`data/horizon.db` n'a pas été altéré** par les tests de cette session.
  Son contenu réel est inchangé : 1 profil réel, le reste est de la démo
  (§6 point 5). Ses tables `student_accounts`/`student_sessions`
  **n'existent pas encore** dans ce fichier tant que le serveur qui le sert
  n'a pas été redémarré depuis cette session (§2).
- Le mot de passe du compte admin (`th.gauthey99@gmail.com`) a été changé à
  la demande de l'utilisateur pendant cette session (§6 point 8) — ne le
  redemande pas à moins qu'il ne signale un nouveau problème d'accès.

### Par où commencer

1. Le retrait de l'IA est désormais **entièrement clos** (code + vérification
   visuelle) — plus rien à faire dessus.
2. **Si tu dois continuer sur l'accès élève** : redémarre le serveur de
   développement (§2) avant toute chose.
3. Les tâches 2 à 5 de §7 (Examen, rattachement des 6 trades, fusion hors
   ligne, purge des données démo) restent dans le même état qu'avant cette
   session — aucune n'est urgente, toutes attendent une décision ou une
   action de l'utilisateur plutôt qu'un blocage technique.

> Ce document est la **seule** source de reprise. Des plans de travail ont pu
> être écrits dans `~/.claude/plans/`, **hors du dépôt** : un nouveau Claude ne
> les verra pas. Tout ce qui compte a été replié ici. Si tu produis un plan
> important, reporte-en la substance dans ce fichier.
