# HANDOFF — PropDesk (Académie de Trading)

Document de reprise. Il suppose que tu n'as accès ni à la conversation qui
l'a produit, ni à autre chose que ce dépôt. Lis-le en entier avant de
toucher au code.

> **État à la dernière mise à jour de ce document**
> Branche **`main`**, working tree **propre**, dernier commit **poussé ET
> déployé avec succès sur Railway** : `3f3c6d0` (« Élargit le catalogue
> d'icônes des modules et corrige celles déjà attribuées »). Statut
> confirmé via `railway status` (`● Online`).
>
> Application déployée sur **Railway**, domaine
> `https://propdesk-academie.up.railway.app`.
>
> **Aucun correctif en attente, aucun fichier modifié non commité.** Le
> projet est dans un état stable. La seule chose à savoir avant de
> continuer : un écart réel entre l'environnement de dev local et la
> production, voir §0.

---

## 0. Piège n°1 à connaître avant tout : dev local ≠ production Railway

Ce projet a **deux bases de données SQLite totalement séparées**, chacune
avec son propre volume :
- **Locale** : `data/horizon.db` (répertoire `./data`, ignoré par git),
  utilisée par `npm run dev`.
- **Production Railway** : volume persistant monté sur `/data`
  (`DATA_DIR=/data` dans les variables d'environnement Railway), jamais
  accessible directement depuis l'environnement de dev — pas de `railway
  ssh`/`railway run` donnant un accès shell au conteneur ni à son volume.

**Conséquence concrète et actuelle** : lors de la session qui a produit ce
handoff, **8 modules du Module Cours** (Analyse Technique, Trading Plan &
Routine, Psychologie en Trading, Money Management, Règles Prop Firm &
Challenges, Backtesting & Journal de Trading, Probabilité en trading,
Concepts SMC Avancés — voir §5) ont été créés et peaufinés (niveaux,
icônes) **uniquement dans la base de dev locale**, pour vérifier chaque
fonctionnalité en conditions réelles avant de livrer le code. **Ils
n'existent PAS sur le site en ligne.** L'utilisateur en a été informé à
chaque fois et sait qu'il doit les recréer lui-même via "+ Nouveau module"
dans Module Cours (formulaire complet : titre, niveau, icône, durée,
description — voir §6.7). Si l'utilisateur demande "pourquoi je ne vois pas
mes modules sur le site", c'est la réponse : rien n'est cassé, il faut les
recréer en ligne, ou lui proposer de le faire pour lui s'il se connecte
lui-même (voir juste en dessous, aucun accès direct possible sinon).

**Aucun moyen de publier du contenu créé en local vers la production** sauf
si l'utilisateur se connecte lui-même dans un onglet du navigateur pané par
l'outil `Browser` (jamais taper son mot de passe à sa place — interdit) :
une fois sa session active dans cet onglet, on peut exécuter les mêmes
appels `fetch` authentifiés (`PUT /api/collections/modules`, etc.) contre
`https://propdesk-academie.up.railway.app` que ceux utilisés en local. Le
site en ligne est en plus derrière une vérification anti-bot Cloudflare
("Checking your browser…") au premier chargement, que seul un humain peut
valider.

---

## 1. Le projet en bref

**PropDesk** est une plateforme d'académie de trading SMC (*Smart Money
Concepts*) destinée à un fondateur (compte staff propriétaire), ses coachs
invités, et ses élèves. Interface **entièrement en français**, ton direct,
tutoiement. Devise unique : **`$`**, jamais `€` (exception assumée : le
module Calculateurs, qui affiche `€/$` sur certains champs pour coller à
une maquette externe). **Aucune IA n'est utilisée nulle part** — décision
produit explicite et répétée plusieurs fois, ne jamais la réintroduire sans
nouvelle demande explicite.

C'est un **vrai projet full-stack** : React 19 + TypeScript + Vite côté
client, Express + `better-sqlite3` (SQLite, mode WAL) côté serveur, un seul
process Node sert les deux.

**Trois mondes d'identité**, jamais mélangés :
- **Élève** (`StudentAuthenticatedApp`, `src/App.tsx`) : chaque élève a son
  propre bureau isolé (`student-<id>`), ses propres trades, comptes, plan,
  badges, modules (copie personnelle du programme, progression
  individuelle).
- **Staff — bureau PARTAGÉ** (`AcademyApp`, `src/App.tsx`) : fiches élèves
  (`enrolledStudents`), programme de formation MAÎTRE (`modules`),
  messagerie coach (`messages`), annonces — un élève doit voir un seul
  coach/programme cohérent, peu importe qui répond ou édite. Tout compte
  staff a `isAdmin: true`.
- **Staff — bureau PERSONNEL** (nouveau depuis cette session, voir §5/§8) :
  chaque compte staff (fondateur ET chaque coach invité séparément) a
  maintenant son PROPRE Journal de trades, portefeuilles, badges,
  notifications de risque, setups, et profil (nom/avatar/bio/capital) — un
  coach ne voit ni ne peut modifier ceux d'un autre coach ni du fondateur.
  Seul le fondateur (`isOwner`) a toujours absolument tout débloqué/tout
  accordé, jamais restreignable.

Format des nombres **totalement libre** dans les champs de prix du Journal
de trading et du Calculateur : point ou virgule, avec ou sans séparateur de
milliers — `parsePriceInput` (`src/lib/format.ts`) retrouve le bon nombre
quelle que soit la convention utilisée. Convention "PnL réalisé"
(`isRealizedDollarTrade`, `src/lib/performanceStats.ts`) : un trade `OPEN`
n'entre dans AUCUN total $ agrégé nulle part dans l'app.

Le projet possède : mentions légales/CGU, gestion d'accès/mot de passe
élève complète, **2FA (TOTP) maison** pour les comptes staff, journal de
sécurité, photo de profil élève, **export RGPD Article 20**, effacement en
cascade Article 17, système de niveau/XP dynamique (10 niveaux, 20 000 XP
total répartis sur 26 badges, voir §5), module **Setups**, **Plans de
trading multiples**, module **Annonces**, **captures d'écran multiples par
trade**, **import/export CSV** du Journal, un onglet **Suivi de
performance** dédié dans les fiches élèves, des **menus déroulants à
l'apparence identique sur tous les navigateurs** (`Select.tsx`), une
**gestion complète du Module Cours** avec éditeur (créer/modifier/supprimer
modules et leçons), **téléversement direct de vidéo** en plus des liens
externes, un système d'**autorisations granulaires par coach**, et des
**alertes automatiques de risque portefeuille** (inactivité, drawdown).

---

## 2. Démarrage immédiat

| Commande | Effet |
|---|---|
| `npm install` | installe les dépendances (client + serveur, même `package.json`) |
| `npm run dev` | lance le serveur Express + Vite en mode dev (HMR côté client uniquement) |
| `npm run lint` (= `tsc --noEmit`) | vérifie le typage sur tout le projet — c'est le "lint" de ce projet |
| `npm run build` | build de production (`vite build` + `esbuild server.ts` → `dist/`) |
| `npm run start` | lance le build de production (`node dist/server.cjs`) |
| `git push origin main` | Railway redéploie automatiquement sur push (déploiement continu configuré, confirmé sur toute cette session — pas besoin de `railway up`/`redeploy` manuel) |
| `railway status` | statut du service (`● Online`/`Building`/`Deploying`/`Crashed`), URL publique |
| `railway logs` | logs du conteneur en production |

**Piège serveur** : après une modification côté `server/`, le serveur de
dev doit être **redémarré manuellement** — pas de hot-reload serveur avec
`tsx server.ts`. Utiliser l'outil `preview_stop` puis `preview_start` (ou
tuer le process sur le port et relancer `npm run dev`).

**Piège SQL** : jamais de backtick littéral dans un commentaire SQL `-- ...`
à l'intérieur d'un template `db.exec(\`...\`)` dans `server/db.ts` — casse
la compilation TS avec une erreur obscure (TS1005). Texte brut uniquement
dans ces commentaires.

**Tester une fonctionnalité staff/élève sans casser une session en cours** :
ne jamais se déconnecter d'une session active dont on ne peut pas
récupérer les identifiants. Un incident réel de cette session : un compte
coach de test créé pour vérifier l'isolation des données a fini par
écraser (via un clic accidentel sur "Enregistrer" du profil pendant la
navigation) le profil du fondateur en LOCAL (nom/avatar) — restauré
manuellement, mais la photo de profil locale a été perdue. Méthode sûre
depuis : créer un compte staff de test via un script `tsx` autonome
(`createInvitedStaffAccount`, `server/auth/credentials.ts`) + authentifier
via `curl` avec un fichier de cookies dédié (`curl -c cookies.txt -X POST
.../api/auth/login ...`), jamais dans le même onglet de navigateur que la
session réelle en cours — ainsi la session du navigateur (utilisée pour
les vérifications visuelles) n'est jamais compromise. Toujours nettoyer le
compte de test après usage (`DELETE FROM staff_accounts/sessions/badges
WHERE id = ...`).

**Inspection SQLite directe** : `sqlite3 data/horizon.db`, puis `.tables`,
`.schema <table>`, `SELECT * FROM ... ;`. Table `student_accounts` pour
retrouver le `user_id` d'un élève à partir de son email ; `staff_accounts`
pour les comptes coach (colonne `permissions`, JSON ou `NULL` = tout
accordé — voir §5/§6.6).

**Vérifier un correctif serveur sans navigateur** : un script `tsx`
autonome à la racine du projet (`npx tsx mon-script.ts`) peut importer
directement `server/repositories.ts`/`server/db.ts`/`server/auth/*` et
exécuter la même logique qu'une route contre la vraie base de dev — utile
pour créer un compte de test, vérifier une migration, etc. Toujours
nettoyer après usage (jamais de fichier de script laissé, jamais de
données de test commitées).

**Accès production Railway** : `railway status`/`railway logs` pour le
statut et les journaux ; **aucun accès shell/DB direct au conteneur ou à
son volume** (pas de commande `ssh`/`run` équivalente dans ce CLI Railway)
— voir §0 pour la conséquence pratique la plus importante.

---

## 3. Architecture

```
server.ts                     Point d'entrée : Express + Vite (dev) ou
                               statique (prod) + helmet + trust proxy +
                               tâches de nettoyage périodiques. Parseurs
                               JSON à taille bornée : 16kb par défaut sur
                               /api/auth, 2mb sur /api/auth/profile/avatar
                               et /api/auth/announcements (uploads
                               d'image), 8mb ailleurs. Upload vidéo (voir
                               server/uploads.ts) NE PASSE PAS par ces
                               parseurs JSON — multipart géré par multer.

server/
  db.ts                        SQLite (better-sqlite3, WAL, foreign_keys
                               ON). Migrations idempotentes (CREATE TABLE
                               IF NOT EXISTS / PRAGMA table_info avant
                               ALTER TABLE). DEFAULT_USER_ID = "user-local"
                               (bureau staff PARTAGÉ). DATA_DIR exporté
                               (utilisé aussi par uploads.ts).
  repositories.ts               Accès aux données : `listCollection`,
                               `replaceCollection` (contrôle de
                               concurrence optimiste par version),
                               `updateCollectionItem`, singletons (profil,
                               plan de trading, annonces).
  routes.ts                     Routes générales (`/api/state`,
                               `/collections/:name`, `/profile`,
                               `/quiz-results`, calendrier économique,
                               données de marché, `/state/restore`).
                               Contient `resolveCollectionUserId` (choisit
                               bureau personnel vs partagé selon la
                               collection, voir §5/§8), `backfillMissingBadges`
                               (rattrapage badges manquants, staff ET
                               élève), `syncFounderBadgeCatalog` (resynchronise
                               les badges déjà stockés du fondateur avec le
                               catalogue, voir §8), `ensurePersonalUserRow`
                               (FK `users` pour un nouveau bureau
                               personnel staff), `PERSONAL_STAFF_COLLECTIONS`.
  uploads.ts                    NOUVEAU — vidéos de leçon téléversées.
                               `POST /api/uploads/videos` (staff
                               uniquement, multer, 2 Go max, mp4/webm/mov/
                               mkv/ogv), `GET /api/uploads/videos/:filename`
                               (toute session authentifiée, support
                               `Range` HTTP pour la lecture/seek). Fichiers
                               sous `DATA_DIR/uploads/videos/` (survit aux
                               redéploiements, volume persistant).
  schemas.ts                    Validation Zod de tout ce qui entre par
                               l'API. `containsDangerousUrlScheme` (anti-XSS
                               générique), `isSafeChartUrls`.
  middleware/rateLimit.ts       Limiteur de débit générique.
  auth/
    permissions.ts                NOUVEAU — `STAFF_PERMISSION_KEYS`
                               (students, messaging, announcements, team,
                               data), `hasStaffPermission` (fondateur
                               toujours tout), `requirePermission`
                               (middleware Express). Voir §5/§6.6.
    routes.ts                    `authRouter` (login, 2FA, logout) +
                               `staffRouter` (comptes staff — invitation
                               gouvernée par la permission "team",
                               révocation TOUJOURS `requireOwner` strict
                               — asymétrie volontaire, voir §8 — 2FA,
                               journal de sécurité, annonces gouvernées par
                               "announcements", `PUT /staff/:id/permissions`
                               strictement `requireOwner`).
    credentials.ts                 `StaffAccount` porte maintenant
                               `permissions: StaffPermissionKey[] | null`
                               (`null` = tout accordé), `setStaffPermissions`.
    studentRoutes.ts             Auth élève + `PUT /trading-plan` + export
                               RGPD.
    middleware.ts                  `AuthContext` porte `dataUserId`
                               (bureau PARTAGÉ, historique) ET
                               `personalDataUserId` (bureau PERSONNEL,
                               nouveau) ET `permissions`. Voir §5/§8.
    exportData.ts                 Export Article 20 (rate-limité).
    totp.ts / twoFactor.ts         TOTP maison (RFC 6238/4226), anti-rejeu.
    sessions.ts / studentSessions.ts   Sessions serveur, TTL absolu 90j +
                               glissant 30j.
    loginLockout.ts                Verrouillage de compte après échecs
                               (indexé par email, pas IP — trade-off
                               assumé).
    studentCredentials.ts          Profil élève, jetons de reset.
    password.ts                    Hachage scrypt, comparaison anti-timing.
    securityEvents.ts               Journal de sécurité (purge RGPD 90j).
  economicCalendar.ts / marketData.ts   Flux externes, cache, timeout.
  seed.ts                        Amorçage initial (démo, `initialModules`
                               vide — voir §0/§8).

src/
  App.tsx                      Fichier central : `StudentAuthenticatedApp`
                               et `AcademyApp`, quasi-dupliqués (deux
                               mondes d'identité). Chaque instance a
                               maintenant ses PROPRES handlers de programme
                               (`handleSaveModule`/`handleDeleteModule`/
                               `handleSaveLesson`/`handleDeleteLesson`,
                               staff UNIQUEMENT — jamais côté élève, qui
                               reste en lecture seule) et son propre effet
                               `upsertWalletRiskAlerts` (voir §6.9).
  types.ts                     Tous les types métier. `CourseLevel` =
                               "Débutant" | "Intermédiaire" | "Confirmé"
                               (PAS "Avancé", PAS "Masterclass" — renommé
                               puis Masterclass supprimé cette session).
                               `Lesson.theory?: string` (contenu théorique
                               écrit, nouveau). `TradingAccount.maxInactivityDays`/
                               `lastManualActivityDate` (nouveau, voir
                               §6.8). `StudentProfile.permissions` (nouveau).
  data/mockData.ts               Données de démo + catalogue FIXE des **26
                               badges** (`initialTraderBadges`, total
                               20 000 XP) — importé aussi côté SERVEUR
                               (`server/routes.ts`). `initialModules` reste
                               VIDE (le programme n'a jamais de contenu de
                               démo, uniquement du vrai contenu créé par le
                               fondateur, voir §0/§8).
  hooks/
    useAuth.ts                   État d'authentification, 2FA.
    useServerSync.ts               `useSyncedState`, `useBootstrap` (staff),
                               `useStudentBootstrap` (élève).
    useNotificationSound.ts        Son d'alerte (Web Audio API).
    usePersistentState.ts          `useState` + localStorage.
  lib/
    api.ts                        `StaffPermissionKey`/`STAFF_PERMISSION_KEYS`
                               (miroir client du catalogue serveur),
                               `updateStaffPermissions`, `uploadLessonVideo`
                               (XMLHttpRequest — seule API exposant une
                               progression d'upload).
    format.ts                     `formatCurrency` + `parsePriceInput`.
    image.ts                      `resizeChartScreenshot`/`resizeAvatar`,
                               décodage en cascade.
    pendingChanges.ts               Registre des modifications hors ligne.
    badges.ts                     `computeBadgeProgress` — recalcule la
                               progression en direct (26 badges, dont
                               plusieurs volontairement `trackable: false`
                               — voir §8), ne touche jamais
                               `unlocked`/`unlockedAt`.
    walletStats.ts                `daysSinceLastTrade` (inactivité,
                               fusionne dernier trade + date manuelle),
                               `todayLocalISODate` (exporté).
    walletAlerts.ts                NOUVEAU — `upsertWalletRiskAlerts`
                               (alertes inactivité/drawdown quotidien/
                               drawdown total, idempotent par palier).
    planCompliance.ts               `checkPlanViolations`,
                               `normalizeTradingPlans`.
    performanceStats.ts             Calculs partagés, "PnL réalisé"-aware.
  components/
    Select.tsx                    `<select>` personnalisé partagé (chevron
                               identique sur tous les navigateurs).
    VideoAcademy.tsx               Module Cours. Éditeur complet
                               (créer/modifier/supprimer module et leçon,
                               staff uniquement — props `isAdmin`/
                               `onSaveModule`/`onDeleteModule`/
                               `onSaveLesson`/`onDeleteLesson`, tous
                               optionnels et absents côté élève).
                               `COURSE_LEVEL_ORDER` trie toujours l'affichage
                               Débutant → Intermédiaire → Confirmé, PAS
                               l'ordre de création. `MODULE_ICON_NAMES` (12
                               icônes). Section Théorie affichée sous la
                               vidéo si `lesson.theory` présent. Bouton
                               "Téléverser" à côté du champ URL vidéo
                               (barre de progression, `api.uploadLessonVideo`).
    StaffAccountsModal.tsx          "Gérer l'équipe". Un bouton par
                               autorisation sous chaque coach non-fondateur
                               (visible seulement par le fondateur),
                               active/désactive d'un clic.
    WalletManagement.tsx             Portefeuilles. Filtre par onglet
                               correctement scopé (bug corrigé cette
                               session). Badge d'inactivité par compte
                               (coloré selon la limite propre au compte si
                               définie). Modale "Ajuster le Portefeuille"
                               porte aussi la limite d'inactivité et la
                               date de dernière activité manuelle.
    UserProfileModal.tsx             Badges & Succès. `LEVEL_TITLES` (10
                               niveaux, "Trader Débutant" → "Trader SMC
                               Légende").
    TradingJournal.tsx             Le plus gros fichier de composant.
    StudentTracking.tsx             Fiches élèves (staff).
    Sidebar.tsx                    Onglets masqués selon les autorisations
                               du compte staff connecté (`hasPermission`
                               local, voir §6.6) ET selon
                               `hiddenSidebarItems` (réglage du fondateur,
                               partagé).
    AdminStudentView.tsx / Announcements.tsx / CoachMessaging.tsx /
    PositionCalculatorModal.tsx / SecurityLogModal.tsx   Utilisent `Select`.
```

---

## 4. Le module Calculateurs

`PositionCalculatorModal.tsx`. Affiche `€/$` sur certains champs pour
coller à une maquette externe — exception volontaire à la règle "devise
unique `$`" du reste de l'app. Champs de prix en saisie libre
(`parsePriceInput`). Menus déroulants uniformisés (`Select`).

---

## 5. Fonctionnalités terminées (les plus récentes en premier)

- **Icônes de module élargies et corrigées** — 12 icônes disponibles (au
  lieu de 6), chacune associée à une couleur propre ; les 8 modules déjà
  créés en local ont été réassignés à l'icône la plus pertinente (ex.
  Money Management → `Wallet`, Backtesting → `History`, Probabilité →
  `Percent`).
- **Niveau "Masterclass" supprimé** du `CourseLevel` — reste `Débutant` /
  `Intermédiaire` / `Confirmé` (renommé depuis `Avancé` juste avant).
- **Tri automatique des modules par niveau** (`COURSE_LEVEL_ORDER`,
  `VideoAcademy.tsx`) — l'affichage suit toujours Débutant → Intermédiaire
  → Confirmé, indépendamment de l'ordre de création.
- **Téléversement direct de vidéo pour les leçons** (`server/uploads.ts`,
  `src/lib/api.ts`) — en plus d'un lien externe, upload d'un fichier
  (mp4/webm/mov/mkv/ogv, 2 Go max), hébergé sur le volume persistant,
  lecture avec support `Range` HTTP (nécessaire pour avancer/reculer dans
  une vidéo longue).
- **Partie Théorie des leçons + éditeur de programme complet**
  (`Lesson.theory`, `VideoAcademy.tsx`) — jusque-là, le Module Cours était
  entièrement vide et sans AUCUNE interface de gestion. Le staff peut
  désormais créer/modifier/supprimer modules et leçons (titre, niveau,
  icône, durée, description courte, théorie) directement depuis l'app.
- **8 modules de programme créés** (contenu, uniquement en local — voir
  §0) : Analyse Technique, Trading Plan & Routine (Débutant) ; Psychologie
  en Trading, Money Management, Règles Prop Firm & Challenges, Backtesting
  & Journal de Trading (Intermédiaire) ; Probabilité en trading, Concepts
  SMC Avancés (Confirmé).
- **Renommage "Module vidéo" → "Module cours"** dans toute l'app.
- **26 badges au total, 20 000 XP, niveau max 10** — 17 nouveaux badges
  ajoutés à ce chantier (paliers de séries de discipline 14j/1mois/3mois/
  6mois/1an, paliers "Trader Actif"/"Trader Discipliné"/"Analyste Rigoureux"/
  "Maître du Risk 1%" à 30/50/100 trades), `rewardXP` de chaque badge
  rééquilibré pour totaliser exactement 20 000, dates de déblocage
  étalées et distinctes. `LEVEL_TITLES` (`UserProfileModal.tsx`) passé de
  5 à 10 paliers.
- **Système d'autorisations granulaires par coach** (`server/auth/permissions.ts`,
  `StaffAccountsModal.tsx`) — 5 autorisations indépendantes (students,
  messaging, announcements, team, data), activables/désactivables
  individuellement par le fondateur pour chaque coach. Le fondateur a
  TOUJOURS tout, jamais restreignable. La révocation d'un autre compte
  staff reste `requireOwner` strict même avec la permission "team"
  accordée (asymétrie volontaire, préserve un correctif de sécurité
  antérieur — voir §8).
- **Bureaux staff PERSONNELS** (`PERSONAL_STAFF_COLLECTIONS`,
  `resolveCollectionUserId`, `AuthContext.personalDataUserId`) — jusque-là
  tout compte staff (fondateur + coachs) partageait EXACTEMENT le même
  bureau de données : un coach invité voyait déjà les trades/portefeuilles/
  badges/profil du fondateur. Désormais séparés : trades, accounts,
  badges, notifications, setups, profil (nom/avatar/bio/capital)
  personnels par compte staff ; fiches élèves/programme/messagerie restent
  PARTAGÉS (un élève garde un seul coach cohérent). `ensurePersonalUserRow`
  sème un profil minimal cohérent pour un nouveau coach (jamais un objet
  vide, jamais celui du fondateur).
- **Alertes automatiques de risque portefeuille** (`src/lib/walletAlerts.ts`)
  — paliers d'inactivité (relatifs à la limite propre au compte si
  définie, sinon seuils génériques 3j/7j) et de drawdown quotidien/total
  (80% = alerte, 100%+ = critique), idempotent par palier (jamais de
  spam), sauf le drawdown quotidien qui se réinitialise chaque jour.
- **Limite d'inactivité configurable par portefeuille** + **date de
  dernière activité manuelle** (`TradingAccount.maxInactivityDays`/
  `lastManualActivityDate`) — pour un compte tradé hors du journal (chez
  le broker directement).
- **Nombre de jours d'inactivité affiché par portefeuille** + **correctif
  du filtre par onglet** (le compte sélectionné restait affiché hors de
  son onglet — bug réel corrigé).
- **Audit sécurité/bugs complet** (agents parallèles par zone) — aucune
  faille exploitable trouvée sur l'auth/routes/frontend à l'époque du
  passage ; un seul bug mineur corrigé (gestion d'erreur clipboard).
- Fonctionnalités antérieures (déjà en production, stables) : rattrapage
  badges/modules jamais initialisés (`backfillMissingBadges`), menus
  déroulants uniformisés, saisie libre des prix, import CSV du Journal,
  aperçu du Plan de trading, onglet "Suivi de performance" dans les fiches
  élèves, acceptation de tous les formats d'image, captures d'écran
  multiples par trade, RGPD complet (export Art. 20, effacement Art. 17),
  2FA TOTP maison, module Annonces, alerte sonore, plans de trading
  multiples, module Setups.

---

## 6. Flux détaillés

### 6.1 Rattrapage et synchronisation des badges

`backfillMissingBadges(dataUserId, asFounder)` (`server/routes.ts`) — pas
seulement pour une collection VIDE : ajoute individuellement chaque badge
du catalogue (`initialTraderBadges`) manquant chez un bureau déjà peuplé
(coach invité avant l'ajout de nouveaux badges, élève existant, etc.).
Pour le fondateur (`asFounder`), id du catalogue tel quel + état copié tel
quel (unlocked selon le catalogue). Pour un élève OU un coach non-fondateur,
id préfixé `${dataUserId}-` + toujours reposé `unlocked: false`.

`syncFounderBadgeCatalog(founderPersonalId)` (`server/routes.ts`) —
distinct du précédent : resynchronise les CHAMPS (rewardXP, unlockedAt,
titre, etc.) des badges DÉJÀ stockés du fondateur avec le catalogue actuel,
à chaque chargement. Sans elle, changer un `rewardXP` dans `mockData.ts`
resterait invisible sur un badge déjà persisté en base. Jamais appliqué à
un coach ou un élève (leur `unlocked`/`unlockedAt` est une vraie
progression personnelle, jamais réécrite depuis le catalogue).

### 6.2 Bureaux personnels vs partagé (staff)

`resolveCollectionUserId(auth, name)` (`server/routes.ts`) : pour une
session staff, retourne `auth.personalDataUserId` si `name` ∈
`PERSONAL_STAFF_COLLECTIONS` (trades, accounts, badges, notifications,
setups), sinon `auth.dataUserId` (= `DEFAULT_USER_ID`, bureau partagé —
enrolledStudents, modules, messages). Pour une session élève, toujours
`auth.dataUserId` (un seul bureau). `personalDataUserId` = l'id du compte
staff lui-même (`staff.id`) — coïncide avec `DEFAULT_USER_ID` UNIQUEMENT
pour le fondateur (créé avec cet id historique via `/auth/setup`), jamais
pour un coach invité (id aléatoire).

### 6.3 Autorisations par coach

`hasStaffPermission(auth, key)` (`server/auth/permissions.ts`) :
`auth.isOwner` court-circuite TOUJOURS à `true`, sinon
`auth.permissions === null` (jamais restreint) → `true`, sinon
`auth.permissions.includes(key)`. `requirePermission(key)` est un
middleware Express posé route par route (voir `server/auth/routes.ts` :
invitation staff → "team", fiches/vues élèves → "students", envoi de
message coach → "messaging", publication d'annonces → "announcements",
restauration de sauvegarde → "data" dans `server/routes.ts`). `PUT
/staff/:id/permissions` reste `requireOwner` strict, jamais délégable via
la permission "team" elle-même (éviterait qu'un coach s'auto-accorde des
droits). Côté client, `Sidebar.tsx` masque les onglets correspondants si la
permission est explicitement retirée (jamais si `permissions` est
`undefined`/`null` — toujours "tout accordé" par défaut).

### 6.4 Théorie et éditeur du Module Cours

`Lesson.theory?: string` (paragraphes séparés par une ligne vide),
affichée sous la vidéo dans la modale de lecture uniquement si présente.
L'éditeur (`VideoAcademy.tsx`) n'apparaît QUE si `isAdmin` + les callbacks
correspondants sont fournis — câblés uniquement sur l'instance staff de
`App.tsx` (jamais côté élève). `handleSaveModule`/`handleSaveLesson`
(`App.tsx`) font un upsert par id sur `modules`/`modules[i].lessons`.

### 6.5 Téléversement de vidéo de leçon

`POST /api/uploads/videos` (`server/uploads.ts`, staff uniquement, multer,
`fileFilter` sur le mimetype, nom de fichier généré côté serveur —
`path.basename` + horodatage + octets aléatoires, jamais le nom fourni par
le client). Répond `{ url: "/api/uploads/videos/<nom>" }`, à stocker tel
quel dans `Lesson.videoUrl`. `GET /api/uploads/videos/:filename` (toute
session authentifiée) supporte les requêtes `Range` (206 Partial Content) —
sans ça, un `<video>` ne peut ni avancer avant chargement complet, ni
reprendre une lecture interrompue. `src/lib/api.ts#uploadLessonVideo` en
`XMLHttpRequest` (pas `fetch`) pour exposer `upload.onprogress`.

### 6.6 Tri des modules par niveau

`COURSE_LEVEL_ORDER: Record<CourseLevel, number>` (`VideoAcademy.tsx`) —
`filteredModules` est trié par ce rang (tri stable) juste avant l'affichage,
indépendamment de l'ordre de `modules` en base (ordre de création, sans
signification pédagogique).

### 6.7 Alertes de risque portefeuille

`upsertWalletRiskAlerts(notifications, accounts, trades)`
(`src/lib/walletAlerts.ts`), appelée en effet React à chaque changement de
`accounts`/`trades` (donc aussi à chaque ouverture de l'app) dans `App.tsx`
(staff ET élève). Paliers d'inactivité calqués sur les seuils du badge
d'affichage (`WalletManagement.tsx#inactivityStatus`) : ambre à 7j ou
moins de la limite propre au compte (ou seuil générique 7j si pas de
limite définie), rouge à 3j ou moins, "compte perdu" au-delà. Drawdown
quotidien/total : ambre à 80% de la limite, critique à 100%+. Idempotent
par palier (id déterministe), sauf le drawdown quotidien qui repart à zéro
chaque jour (id daté).

### 6.8 Saisie libre des prix

`parsePriceInput(raw)` (`src/lib/format.ts`) : un seul séparateur présent
(point OU virgule) est toujours la décimale ; les deux présents, celui qui
apparaît EN DERNIER est la décimale.

### 6.9 Menus déroulants uniformisés

`Select` (`src/components/Select.tsx`) : `appearance-none` + un chevron
`ChevronDown` constant, quel que soit le navigateur.

---

## 7. Bugs connus / limitations

**Aucun bug en cours de correction à la date de ce document.**

**Écart connu, pas un bug applicatif (voir §0)** :
- Les 8 modules du Module Cours créés pendant cette session (contenu +
  niveaux + icônes) n'existent QUE dans la base de dev locale, jamais
  publiés sur Railway — l'utilisateur doit les recréer lui-même en ligne,
  ou se connecter dans un onglet piloté pour qu'on les publie en direct
  (voir §0).

**Limite de plateforme assumée (pas un bug applicatif)** :
- Un format d'image qu'AUCUN navigateur ne sait afficher (HEIC réel sur
  Chrome/Android) sera enregistré via le repli "fichier brut" mais peut ne
  jamais s'afficher en aperçu sur ce navigateur.
- Vidéo téléversée en `.mov`/`.mkv` : aucune conversion faite côté serveur,
  la lecture peut échouer sur un navigateur qui ne les décode pas
  nativement (mp4/webm sont fiables partout).

**Non traités, restent de vrais arbitrages produit (pas des oublis)** :
- Verrouillage de compte par email (pas par IP) —
  `server/auth/loginLockout.ts` : protection anti-credential-stuffing
  délibérée.
- Fan-out de notifications à la publication d'une annonce, synchrone —
  jugé hors scope à l'échelle actuelle du projet.
- Score du quiz rapide de leçon (`activeLessonQuizModal`, `VideoAcademy.tsx`)
  jamais persisté.
- Certains badges restent volontairement `trackable: false` (progression
  jamais calculée, uniquement débloqués par convention pour le fondateur) :
  `badge-1`, `badge-21`, `badge-22`, `badge-23` (% de risque par trade —
  seul signal disponible est le tag auto-déclaré "Sur-risque (>1%)", dont
  l'ABSENCE ne prouve rien), `badge-3` (module Replay, retiré de l'app),
  `badge-8` (cumul en "R", non suivi), `badge-9` (score d'examen, non
  suivi). Documenté en détail dans `src/lib/badges.ts`.

**Limitations connues, non des bugs** :
- Le calendrier économique ne montre que "cette semaine" (flux
  ForexFactory).
- Pas de QR code pour la 2FA — secret + lien `otpauth://` cliquable.

---

## 8. Décisions techniques importantes

- **Bureau staff PARTAGÉ pour les fiches élèves/programme/messagerie,
  PERSONNEL pour trades/comptes/badges/notifications/setups/profil** —
  décision structurante de cette session (voir §5/§6.2). Ne jamais ajouter
  une nouvelle collection à `PERSONAL_STAFF_COLLECTIONS` sans vérifier
  qu'elle ne doit pas rester un référentiel partagé par nature (ex. un
  futur "catalogue de setups partagés" devrait rester partagé, pas
  personnel).
- **Le fondateur (`isOwner`) a toujours absolument tout, jamais
  restreignable, même par lui-même** — court-circuite `hasStaffPermission`
  ET l'édition de `hiddenSidebarItems`. Ne jamais construire un chemin qui
  permettrait de retirer une permission au fondateur.
- **Révocation d'un compte staff (`DELETE /staff/:id`) reste `requireOwner`
  strict**, même après l'introduction de la permission "team" (qui ne
  gouverne que l'INVITATION) — préserve un correctif de sécurité antérieur
  (un coach compromis pouvait auparavant purger toute l'équipe). Asymétrie
  volontaire, documentée dans `server/auth/routes.ts`.
- **Catalogue de 26 badges FIXE**, jamais édité via une UI —
  `initialTraderBadges` (`src/data/mockData.ts`) fait foi. Total exact
  20 000 XP, 10 niveaux. Toute modification de `rewardXP`/`unlockedAt`
  DOIT passer par `syncFounderBadgeCatalog` pour atteindre les badges déjà
  stockés du fondateur (voir §6.1) — sinon invisible.
- **`initialModules` reste volontairement vide** — le Module Cours n'a
  jamais de contenu de démo, uniquement du vrai contenu créé par le
  fondateur via l'éditeur (`VideoAcademy.tsx`).
- **`CourseLevel` = Débutant / Intermédiaire / Confirmé** (pas "Avancé",
  pas "Masterclass" — renommages/suppressions sur demande explicite de
  l'utilisateur cette session).
- **Import cross-répertoire serveur ← client pour les données pures**
  (`server/routes.ts` importe `src/data/mockData.ts`) — accepté
  spécifiquement parce que ce fichier n'a aucune dépendance React/DOM. Ne
  PAS généraliser à des fichiers avec de vraies dépendances client.
- **`isRealizedDollarTrade`** comme seule source de vérité pour "ce trade
  compte-t-il dans un total $ agrégé ?".
- **`parsePriceInput`** comme seule source de vérité pour un prix saisi
  librement.
- **`Select` partagé** pour tout nouveau `<select>`.
- **Vidéos de leçon sur disque (volume persistant), jamais en base64 en
  base** — contrairement à l'avatar/pièce jointe d'annonce (petites images,
  base64 dans le JSON). Une vidéo peut peser plusieurs centaines de Mo :
  `multer` + stockage disque + streaming avec support `Range`, jamais de
  buffer complet en mémoire ni en JSON.
- **Aucune dépendance externe pour le TOTP** — implémentation maison
  (RFC 6238/4226) sur `node:crypto` uniquement.
- **Aucune IA nulle part dans le produit** — décision produit ferme,
  répétée plusieurs fois.

---

## 9. Historique de nommage (contexte)

`SectionHeader` est réimplémenté localement dans chaque fichier qui en a
besoin plutôt que factorisé en composant partagé — décision historique
assumée.

Le module "Annonces" a été nommé ainsi plutôt que "Académie" pour éviter
une collision avec le module cours existant (`TabType: "academy"`).

Le module cours a été renommé "Module vidéo" → **"Module cours"** cette
session (sidebar, tuile du tableau de bord, en-tête de page) — le concept
va désormais au-delà de la simple vidéo (Théorie écrite, upload de fichier).

`CourseLevel` : `"Avancé"` → renommé `"Confirmé"`, puis `"Masterclass"`
supprimé — les deux sur demande explicite, ne réintroduire aucun des deux
noms sans nouvelle demande.

`ThousandsInput.tsx` a existé puis a été **supprimé** une fois tous ses
appelants migrés vers la saisie libre (`parsePriceInput`).

---

## 10. Contexte de travail avec l'utilisateur

Forexpaps est le fondateur de PropDesk, **non-technique**, délègue
largement l'exécution du code. Il valide des décisions produit (nommage,
droits d'accès, priorités, classification pédagogique des modules) mais
pas des détails d'implémentation.

**Workflow observé sur de très nombreux échanges, à reproduire** :
1. L'utilisateur signale un bug ou demande une fonctionnalité en une
   phrase, parfois avec une capture d'écran d'un élément précis de l'UI.
2. Diagnostiquer en profondeur AVANT de proposer un correctif — plusieurs
   fois cette session, l'implémentation évidente au premier abord cachait
   un problème plus profond (ex. la demande "autorisations par coach" a
   révélé que TOUS les comptes staff partageaient déjà le même bureau, un
   problème plus large que juste ajouter des permissions).
3. Pour une demande de fonctionnalité dont le PÉRIMÈTRE n'est pas évident
   (quelles autorisations exactement ? quels niveaux ?), poser UNE
   question via l'outil de choix multiple plutôt que de deviner — mais
   dès que la portée est claire, exécuter directement sans re-demander
   confirmation à chaque étape.
4. Corriger directement, vérifier (`npm run lint` + `npm run build` + test
   en navigateur EN LECTURE SEULE d'abord, écriture ensuite si nécessaire),
   puis résumer clairement CE QUI A CHANGÉ, en français simple, souvent
   avec un tableau récapitulatif.
5. **Committer, pousser ET déployer sur Railway systématiquement après
   chaque changement validé** — contrairement à des sessions antérieures
   documentées plus haut dans l'historique du projet, cette session a vu
   l'utilisateur attendre un commit+push+déploiement après QUASIMENT
   CHAQUE tâche, sans avoir à le redemander explicitement à chaque fois.
   Le déploiement Railway est en continuous deployment (push sur `main` =
   déploiement automatique) — surveiller `railway status` jusqu'à
   `● Online` (un flicker "Crashed" transitoire pendant la bascule de
   conteneur est normal, pas un vrai échec).
6. **Ne jamais prendre de risque avec les données réelles du fondateur**
   pendant une vérification — voir l'incident documenté en §2 (profil
   écrasé par un compte de test). Toujours privilégier une vérification en
   LECTURE SEULE (`fetch` GET, `curl` avec un cookie jar séparé pour un
   compte de test) avant toute écriture, et ne jamais partager le même
   onglet de navigateur entre une session de test et la session réelle en
   cours.

**Test d'une fonctionnalité staff/élève sans casser une session réelle en
cours** : voir §2 pour la méthode sûre (compte de test créé via script
`tsx`, authentifié via `curl` avec cookie jar séparé, jamais dans le même
onglet navigateur que la session active).

**Sur la vérification** : toujours envisager que "ça marche en local" et
"ça marche sur le vrai site en production" sont deux affirmations
différentes (voir §0 : bases de données totalement séparées) — le dire
explicitement à l'utilisateur à chaque fois qu'une vérification n'a pu
être faite qu'en local.

---

## 11. Prochaines tâches, dans l'ordre

**Aucune tâche explicitement demandée n'est en attente à la date de cette
mise à jour.** Le projet est stable, déployé, et le dernier commit est
poussé. En l'absence de nouvelle demande précise :

1. Si l'utilisateur revient sur les modules du Module Cours : lui rappeler
   qu'ils n'existent qu'en local (§0) et proposer soit de les recréer avec
   lui en direct sur le site (nécessite qu'il se connecte lui-même dans un
   onglet piloté), soit de continuer à itérer en local en attendant qu'il
   soit prêt à les publier lui-même.
2. Idées de modules supplémentaires déjà évoquées mais non tranchées (à ne
   proposer QUE si l'utilisateur redemande une suggestion) : Fondamentaux
   des Marchés Financiers (Débutant, vrais prérequis avant Analyse
   Technique), Masterclass Études de Cas & Stratégies Pro (aucun module
   Masterclass n'existe — note : le niveau Masterclass a depuis été
   SUPPRIMÉ du type `CourseLevel`, cette idée n'est donc plus applicable
   telle quelle sans réintroduire le niveau), Fiscalité & Statut du
   Trader.
3. En l'absence de demande précise, un audit de sécurité/bugs complet
   (méthode : agents parallèles en lecture seule par zone, résultats
   compilés et priorisés, une seule vraie question de permission posée à
   l'utilisateur si besoin, tout le reste corrigé directement) a déjà été
   fait plusieurs fois dans l'historique de ce projet et est une action
   que l'utilisateur redemande périodiquement — un bon réflexe si aucune
   tâche spécifique n'est donnée.
4. Les arbitrages produit non tranchés listés en §7 (verrouillage par
   email, fan-out d'annonces, quiz de leçon non persisté, badges
   `trackable: false`) : ne les traiter QUE si l'utilisateur les soulève,
   ce sont des choix, pas des bugs oubliés.

---

## 12. État à la reprise

- Branche `main`, **working tree propre**, dernier commit **poussé ET
  déployé** : `3f3c6d0`.
- **Aucun fichier modifié non commité.**
- **Écart connu et documenté (§0)** : 8 modules du Module Cours existent
  uniquement dans la base de dev locale (`data/horizon.db`), jamais publiés
  sur Railway — pas un bug, l'utilisateur en a été informé à chaque fois.
- Aucun blocage technique connu. Le reste du projet est stable et déployé.
