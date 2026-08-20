# HANDOFF — PropDesk (Académie de Trading)

Document de reprise. Il suppose que tu n'as accès ni à la conversation qui
l'a produit, ni à autre chose que ce dépôt. Lis-le en entier avant de
toucher au code.

> **État à la dernière mise à jour de ce document**
> Branche `main`, dernier commit poussé : **`610882c`** (« Ajoute un filtre
> d'impact au calendrier Macro, corrige Vue Complète, retire Signaux des
> alertes »), déployé avec succès sur Railway (`status: SUCCESS` confirmé
> via `railway deployment list --service propdesk --json`).
> **Répertoire de travail PROPRE** — `git status --short` ne renvoie rien.
> `npm run lint` (`tsc --noEmit`) passe sans erreur.
> Application déployée sur **Railway**, domaine
> `https://propdesk-academie.up.railway.app`.

---

## 0. Où reprendre EXACTEMENT

**Pas de chantier interrompu.** Répertoire propre, dernier commit déployé
avec succès, `npm run lint` sans erreur. **Aucun point bloquant.**

Un **audit complet** (bugs client + bugs serveur + sécurité OWASP, 3 agents
parallèles) a été mené à la fin de cette période et entièrement traité :
**0 faille de sécurité**, **0 bug client**, **4 bugs serveur mineurs
corrigés** (détail en §5 point 9 et §7). Si l'utilisateur redemande un
audit, ce n'est donc pas pour rattraper du retard — le projet en sort
propre à la date de ce document.

Aucun point ouvert hérité du HANDOFF précédent : les trois points qu'il
listait (`window.confirm()`, formule de note globale, `authorRole` forum)
étaient déjà réglés au commit `9a8e6a0`, qui est la base de cette mise à
jour. Depuis, le **module Forum a été retiré entièrement** (voir §5 point
2) — cela ne laisse donc plus aucune trace de ces anciens points ouverts.

**Nouveaux points à connaître, pas bloquants, mais utiles pour ne pas
répéter du travail déjà fait cette période :**

1. **Le système de niveau/XP du profil est maintenant dynamique**
   (`UserProfileModal.tsx`, `computeLevelInfo`) — 5 paliers calculés sur la
   somme réelle des `rewardXP` des badges, plus de "NIVEAU 4"/"3 000 XP"
   codés en dur. Voir §5 point 7.
2. **"Plan de trading" et "Mindset" sont visuellement désactivés dans la
   Vue Complète** (`AdminStudentView.tsx`) — pas un bug, une limite
   architecturale assumée : ces deux outils vivent en `localStorage` sur
   l'appareil de l'ÉLÈVE, jamais synchronisés au serveur, donc
   structurellement impossibles à consulter depuis le navigateur du coach.
   Voir §5 point 9 et §7.
3. **Le calendrier économique du module Macro a désormais un filtre
   d'impact exclusif** (Faible/Moyen/Fort/Tous, un seul actif à la fois) —
   voir §5 point 9.

Tout le reste est terminé, vérifié, et déployé.

---

## 1. Le projet en bref

**PropDesk** est une plateforme d'académie de trading SMC (*Smart Money
Concepts*) destinée à un coach (le fondateur, compte admin) et à ses
élèves. Interface **entièrement en français**, ton direct, tutoiement.
Devise unique : **`$`**, jamais `€` (exception : le module Calculateurs,
qui affiche `€/$` sur certains champs pour coller à une maquette externe —
ne pas généraliser). **Aucune IA n'est utilisée nulle part** — décision
produit explicite et répétée plusieurs fois, **ne jamais la réintroduire
sans nouvelle demande explicite**.

C'est un **vrai projet full-stack** : React 19 + TypeScript + Vite côté
client, Express + `better-sqlite3` (SQLite, mode WAL) côté serveur, un
seul process Node sert les deux.

**Identité visuelle** : design system unifié sur tout l'écosystème autour
du langage visuel de Macro/Rentabilité — cartes plates à bordure fine
(`#111615`/`#1B2320`), micro-labels `[9px]`/`[10px]` en majuscules
espacées, en-têtes de section à barre verticale colorée (`SectionHeader`,
un composant local à chaque fichier, jamais partagé — voir §9 pourquoi).
Palette PropDesk (vert `#00E676`, fonds `#0D1110`/`#111615`) inchangée.

Le projet possède une page publique de mentions légales, un système
complet de gestion d'accès/mot de passe élève (invitation, changement
forcé, changement volontaire, lien de réinitialisation à jeton), un
journal de sécurité complet réservé au fondateur, une photo de profil
personnalisable par élève, un changement de mot de passe volontaire pour
tout compte staff, et — depuis cette période — un système de niveau/XP
entièrement dynamique et un tableau de bord enrichi (RR Moyen, Profit
Factor, phrase d'accueil calculée depuis les vrais trades).

**Le footer de l'app affiche "Thomas Gauthey — Trader"** (avant : "Auto-
entrepreneur") — changement cosmétique demandé cette période, sur les deux
shells. La mention légale ("Mentions légales", `LegalNoticeModal.tsx`)
n'a **pas** été touchée : elle reflète toujours le vrai statut juridique
("Auto-entrepreneur"), ce n'est pas la même chose que le footer.

### Qui l'utilise

Outil de travail d'un coach (« ForexPaps »/« Forex Paps » selon
l'environnement, `th.gauthey99@gmail.com`, compte fondateur) et de son
staff. Plusieurs comptes staff partagent le même bureau (mêmes trades,
fiches élèves, portefeuilles) — « mêmes droits pour tous », sauf la
suppression d'un compte coach, réservée au fondateur (`requireOwner`,
décision produit explicite suite à un audit de sécurité d'une période
antérieure). Les élèves ont un second monde d'identité séparé, chacun avec
son propre bureau cloisonné. Seul « Suivi des Élèves » (et « Sécurité »,
via le journal dans le profil) reste réservé à un compte staff/fondateur.

### Hébergement : Railway (pas seulement GitHub)

**Railway** (`https://propdesk-academie.up.railway.app`, projet
"propdesk", dépôt GitHub `Forexpaps/propdesk` connecté) :
- Service configuré avec un **volume persistant** `/data` (500 Mo) monté
  sur `DATA_DIR=/data`, `NODE_ENV=production`.
- **Déploiement automatique sur push** fonctionne, vérifié à chaque
  session par `railway deployment list --service propdesk --json`.
- Le serveur vérifie lui-même au démarrage la cohérence
  `NODE_ENV`/`DATA_DIR` (avertissement de démarrage si incohérents, voir
  `server.ts`) — aucun avertissement observé dans les logs Railway
  actuellement.
- **Vercel a été essayé puis abandonné** (période ancienne) — serverless
  incompatible avec Express + SQLite persistant. Ne pas y revenir sans
  réécriture lourde.
- **Piège récurrent, plusieurs sessions** : l'edge Railway
  ("railway-hikari") peut bloquer périodiquement le trafic avec des
  réponses `429 rate limited`, indépendant de l'application, déclenché par
  des `curl` trop fréquents/rapprochés. Un `429` isolé après confirmation
  `SUCCESS` via l'API Railway n'est **pas** un vrai problème — ne pas
  insister. **Prévention** : toujours vérifier un déploiement via
  `railway deployment list --service propdesk --json` (API, fiable) en
  premier, au plus UN `curl`/`railway logs` espacé ensuite.

---

## 2. Démarrage immédiat

```bash
npm install
```

**Aucune variable d'environnement requise en local** — `.env.example`
liste `PORT` (défaut 3000), `DATA_DIR` (défaut `./data`), `NODE_ENV`. Un
`.env` existe déjà à la racine.

| Commande | Effet |
|---|---|
| `npm run dev` | serveur de développement sur http://localhost:3000 (`tsx server.ts`) |
| `npm run lint` | `tsc --noEmit` — **doit toujours sortir sans erreur** |
| `npm run build` | `vite build` (client) + `esbuild server.ts` → `dist/server.cjs`, ~1.3-3s |
| `npm start` | sert le build de production (`NODE_ENV=production` requis) |
| `npm run clean` | supprime `dist/` et `server.js` |

Un seul port, pas de proxy à configurer. `.claude/launch.json` démarre le
serveur sous le nom **`horizon-dev`**.

**⚠️ Après tout changement dans `server/` ou `server.ts`**, redémarrer le
serveur de dev (`preview_stop` puis `preview_start`, ou
`lsof -ti:3000 | xargs -r kill -9 && npm run dev`) — TSX ne recharge pas à
chaud les fichiers serveur. Un redémarrage fait perdre la session
navigateur (cookie lié au process/port) — redemander à l'utilisateur de se
reconnecter est normal.

**⚠️ Piège d'outil de prévisualisation confirmé, sur plusieurs sessions** :
un onglet de navigateur laissé ouvert longtemps accumule des erreurs de
rechargement à chaud (HMR) obsolètes dans sa console — module supprimé,
ordre des hooks React qui semble avoir changé, `ReferenceError` sur une
variable qui n'existe plus. **Ce ne sont quasiment toujours que des
artefacts de l'historique d'édition de cet onglet précis**, pas de vrais
bugs : ouvrir un **onglet neuf** (`tabs_create`) et comparer sa console.
Un raccourci clavier simulé (`cmd+R`) ne recharge pas toujours vraiment la
page non plus ; préférer `navigate()` vers la même URL, ou un onglet neuf.

**⚠️ `window.confirm()`/`window.prompt()` natifs ne sont fiables NULLE
PART** (Browser pane de dev : `confirm()` retourne silencieusement
`false` ; en production sur iOS en mode application : restent muets — bug
réel signalé par l'utilisateur). **Ce chantier est TERMINÉ** (période
antérieure à celle-ci) : tous les usages remplacés par `confirmDialog()`
(`src/lib/confirmDialog.tsx`) — modale maison, `Promise<boolean>`. **Si tu
ajoutes un nouveau `confirm()`/`prompt()`**, utilise `confirmDialog()`
directement, et vérifie que `<ConfirmDialogHost />` est monté dans le
shell où le code s'exécute (voir §3, "deux shells").

**⚠️ Le flux de réinitialisation de mot de passe élève (§6) n'envoie aucun
e-mail** — assumé et documenté en commentaire dans le code (le lien est
affiché une seule fois côté staff, à transmettre à la main). Ne pas
"corriger" sans qu'on te le demande — aucune infrastructure d'envoi
n'existe dans ce projet.

**⚠️ Tester une fonctionnalité élève sans casser la session du coach** :
les cookies de session staff (`pd_session`) et élève (`pd_student_session`)
sont distincts mais partagés entre tous les onglets du même navigateur, et
une session staff valide prime toujours sur une session élève si les deux
coexistent. Impossible d'afficher l'UI élève dans le même navigateur
qu'une session staff active sans déconnecter cette dernière. **Ne jamais
faire ça sans le demander à l'utilisateur** (ni taper son mot de passe
pour lui, règle absolue). À la place : appels `fetch` directs
(`javascript_tool`) avec un compte élève de test existant, ou un script
`tsx` jetable à la racine (supprimé après usage) pour la logique serveur
pure.

**⚠️ Les données d'une collection (trades, comptes...) ne sont PAS
tracées par git** — `data/` est dans `.gitignore` (voir plus bas). Un
import/suppression massive de trades (ex. import d'un relevé de
plateforme, script `tsx` jetable) ne produit donc **rien** à committer
côté code, seulement une modification de `data/horizon.db`. Ne pas
chercher un diff git qui n'existera jamais pour ce type d'opération.

### Inspecter la base locale

```bash
sqlite3 data/horizon.db "select id, name, email from staff_accounts"
sqlite3 data/horizon.db "select json_extract(payload,'\$.isAdmin') from users where id='user-local'"
sqlite3 data/horizon.db "select id, json_extract(payload,'\$.name'), json_extract(payload,'\$.equity') from trading_accounts"
sqlite3 data/horizon.db "select id, json_extract(payload,'\$.name'), json_extract(payload,'\$.statusTag') from enrolled_students"
sqlite3 data/horizon.db "select id, email, must_change_password from student_accounts"
```

**⚠️ Piège confirmé** : `users.payload.isAdmin` peut être `0`/absent en
base pour le compte fondateur SANS que ce soit un problème réel — le
serveur force `isAdmin: true` dans la réponse `/api/state` pour toute
session staff (lecture ET écriture, `PUT /profile`), sans jamais le
redériver d'une valeur en base potentiellement périmée.

**Piège confirmé, non corrigé, faible priorité** : `.gitignore` contient
`data/` sans slash de tête, qui matche `src/data/` en plus du dossier
SQLite racine — `git add src/data/mockData.ts` (chemin exact) refuse et
demande `-f`. `git add -A`/`git add .` fonctionnent normalement.

**⚠️ Les données locales de test peuvent changer entre deux sessions sans
intervention explicite** — ne jamais supposer que l'état observé à un
instant T est stable — revérifier avec `sqlite3` avant de raisonner
dessus.

### Inspecter la base Railway (production)

Pas d'accès direct — pas de SSH (refusé explicitement par l'utilisateur).
Pour toute vérification, passer par l'API HTTP du site déployé (`curl`,
avec parcimonie — voir §1) ou par le dashboard Railway (`railway open`, ou
https://railway.com/project/1ff27138-1722-451a-95c5-4719ffbae46a), ou par
`railway logs --service propdesk` pour les logs de démarrage.

### Compte admin

`th.gauthey99@gmail.com` — mot de passe jamais consigné ici. **Ne jamais
le taper toi-même** dans un formulaire, y compris pour se connecter à
l'environnement Railway.

---

## 3. Architecture

### Vue d'ensemble

```
server.ts                     point d'entrée : Express + Vite/statique
                               + helmet + trust proxy (prod) + tâches de
                               nettoyage périodiques. Vérifie la cohérence
                               NODE_ENV/DATA_DIR au démarrage.
server/
  db.ts                        SQLite (better-sqlite3, WAL, foreign_keys
                               ON), **17 tables** (19 avant cette période —
                               `forum_topics`/`forum_replies` supprimées,
                               voir migration `migrateDropForum()` juste
                               après `migrateDropCoachSignals()`, même
                               motif `DROP TABLE IF EXISTS`, confirmées
                               vides avant suppression). Migrations
                               ponctuelles idempotentes en bas de fichier.
                               Piège syntaxique connu : jamais de backtick
                               littéral dans un commentaire SQL `-- ...`
                               de ce fichier (casse la compilation TS avec
                               une erreur obscure).
  repositories.ts               accès bas niveau aux tables.
                               `CollectionName` n'inclut plus `"forumTopics"`
                               (ni `"signals"`, période antérieure) — toute
                               la logique de reconstruction des réponses
                               de forum (`listForumReplies`,
                               `replaceForumReplies`) a été retirée avec
                               le module.
  routes.ts                     routes /api/* génériques. `buildCoachesForStudent()`
                               reconstruit le coach affiché à l'élève.
                               `buildStaffProfile()` force `isAdmin: true`
                               pour toute session staff (lecture ET
                               écriture). `PUT /profile` reste réservée au
                               staff. `/economic-calendar` et
                               `/market-data` ont un rate limit
                               (`publicDataRateLimit`, 60 req/min).
                               `ADMIN_ONLY_COLLECTIONS` (`enrolledStudents`)
                               : repéré en audit cette période que cette
                               vérification ne peut plus jamais se
                               déclencher (élève déjà bloqué avant, tout
                               staff a `isAdmin` forcé) — commentaire
                               corrigé pour ne plus prétendre à une
                               protection active, gardée en défense en
                               profondeur pour d'éventuels rôles staff
                               futurs.
  schemas.ts                    schémas Zod. `isSafeMediaUrl`/
                               `isValidInitialBalance` : confusion de type
                               déjà corrigée (période antérieure).
                               `authorAvatar` (forum) retiré de
                               `SAFE_MEDIA_URL_FIELDS` avec le module.
                               **Depuis cette période** : `startingCapital`/
                               `currentCapital` du profil ont désormais
                               `.min(0)` (négatifs rejetés — trouvé en
                               audit, aucune borne minimale avant).
  middleware/rateLimit.ts       limiteur par IP en mémoire, fabrique
                               (`createRateLimit`), inchangé cette période.
  auth/
    routes.ts                   `staffRouter`. `DELETE /staff/:id` protégée
                               par `requireOwner`. `/change-password` ne
                               détruit plus la session courante de
                               l'appelant (`destroyOtherSessions`).
    studentRoutes.ts             `studentAuthRouter` (public) +
                               `studentProtectedRouter`. `PUT
                               /profile/avatar` (élève choisit sa photo).
                               `POST /reset-password/:token` — route
                               PARAMÉTRÉE, protégée jusqu'ici seulement par
                               l'ordre de montage des routeurs (avant la
                               barrière `requireAuth`).
    middleware.ts                **Depuis cette période** : `PUBLIC_PATH_PREFIXES`
                               (nouveau, à côté de `PUBLIC_PATHS`) — filet
                               de sécurité supplémentaire pour les routes
                               PARAMÉTRÉES qu'un `Set` de chemins exacts ne
                               peut structurellement pas couvrir. Couvre
                               aujourd'hui `/auth/reset-password/` (préfixe).
                               Repéré en audit : latent, pas exploitable
                               aujourd'hui (l'ordre de montage protège déjà
                               la route), mais un futur refactor des
                               routeurs l'aurait cassé silencieusement.
    studentCredentials.ts        `buildStudentProfile()` fusionne l'avatar
                               personnel de l'élève (`ownProfile.avatar`)
                               — prioritaire sur `enrolled.avatar`.
                               `ALWAYS_HIDDEN_FOR_STUDENTS = ["students"]`
                               seulement — "Plan de trading"/"Mindset" n'y
                               sont jamais masqués pour un élève (voir §5
                               point 9 pour le distinguo avec la Vue
                               Complète staff).
    sessions.ts / studentSessions.ts   `destroyOtherSessions`/
                               `destroyOtherStudentSessions` : révoquent
                               toutes les sessions D'UN COMPTE SAUF celle
                               qui vient de faire la requête (changement de
                               mot de passe VOLONTAIRE).
    password.ts                  Coût scrypt N=2^17 (recommandation OWASP).
    securityEvents.ts             journal de sécurité complet (`get24hStats`,
                               `listSecurityEvents`, purge RGPD 90 jours).
  economicCalendar.ts            inchangé cette période. Flux public
                               ForexFactory, cache 10 min, rate-limité.
  marketData.ts                  **Depuis cette période** : le `scale: 10`
                               appliqué à `^TNX` (taux US 10 ans) a été
                               RETIRÉ — vérifié empiriquement par `curl`
                               direct sur le point d'accès Yahoo réellement
                               utilisé (`/v8/finance/chart`), qui renvoie
                               déjà la vraie valeur (`4.67` pour 4.67 %),
                               sans la convention CBOE ×10 qu'applique
                               l'ancien endpoint `/v7/finance/quote`. Le
                               `scale: 10` précédent (période antérieure,
                               censé corriger une erreur inverse observée à
                               l'époque) divisait donc une valeur déjà
                               correcte, affichant 0.467 % au lieu de
                               4.67 %. **Piège à retenir** : avant de
                               réintroduire une correction de facteur sur
                               ce flux, revérifier empiriquement (`curl`
                               direct sur LE point d'accès réellement
                               utilisé), pas seulement par référence à une
                               convention Yahoo générale.
  seed.ts                        `writeFullState` (seed + import de
                               sauvegarde) est **désormais transactionnel**
                               (`db.transaction(...)`) — trouvé en audit :
                               un échec en cours de boucle pouvait laisser
                               des collections partiellement écrites sans
                               `bootstrapped_at` posé.
src/
  App.tsx                      porte d'auth à deux mondes. Deux "shells"
                               distincts (`StudentAuthenticatedApp`,
                               `AcademyApp`), état de modale dupliqué par
                               design — **tout changement de state/handler
                               doit être répliqué dans les DEUX**, piège
                               déjà rencontré plusieurs fois (`ConfirmDialogHost`
                               à monter deux fois, période antérieure).
                               **Depuis cette période** : le module
                               `SetupAnalyzerModal` ("Audit Setup") a été
                               retiré entièrement des deux shells (state
                               `isSetupAnalyzerOpen` supprimé, callback
                               `onOpenSetupAnalyzer` retiré de `<Sidebar>`)
                               — le mécanisme `journalDraft`/`prefillDraft`
                               est CONSERVÉ dans `AcademyApp` (toujours
                               utilisé par le Calculateur de position),
                               mais entièrement retiré du shell élève où il
                               ne servait plus qu'au Setup Analyzer.
  types.ts                     `ForumTopic`/`ForumReply`/`ForumCategory`/
                               `ForumRole` retirés (module supprimé).
                               `NotificationType` garde encore la valeur
                               `"signal"` dans son union (dead code mineur
                               — le FILTRE UI a été retiré de
                               `NotificationModal.tsx`, mais le type lui-
                               même n'a pas été nettoyé, aucune notification
                               de ce type n'étant de toute façon jamais
                               créée). `TradeMistake` (9 valeurs : "Entrée
                               anticipée", "Sortie prématurée", "SL trop
                               serré", "SL déplacé/retiré", "Sur-risque
                               (>1%)", "Revenge trading", "FOMO / Chasing",
                               "Pas de plan de trade", "Sur-trading") sert
                               désormais aussi à `weeklySummary.ts` (voir
                               plus bas) — toute modification de ce
                               catalogue doit mettre à jour
                               `MISTAKE_PHRASES` dans ce fichier
                               (`Record<TradeMistake, string>`, le
                               compilateur signale l'omission).
  lib/
    weeklySummary.ts              **NOUVEAU cette période.** Une seule
                               fonction exportée, `computeWeeklySummary
                               (trades: Trade[]): string` — calcule la
                               phrase d'accueil du tableau de bord
                               ("Semaine N · X sessions travaillées sur 5.
                               Ton point faible du moment : ..."), toujours
                               recalculée depuis les vrais trades, jamais
                               stockée. "Semaine 1" part de la date du
                               PREMIER trade jamais journalisé (pas une
                               valeur arbitraire). "Sessions travaillées" =
                               jours distincts avec ≥1 trade dans la
                               semaine en cours, dénominateur fixe à 5
                               (jours ouvrés). "Point faible" = tag
                               `Trade.mistakes` le plus fréquent de la
                               semaine (repli sur toutes semaines
                               confondues si rien cette semaine ; message
                               neutre si aucune erreur taguée nulle part).
                               Sans aucun trade : phrase d'invitation à
                               démarrer, pas de chiffre inventé.
    performanceStats.ts          `computeJournalSummary(trades)` (déjà
                               exportée, utilisée par `TradingJournal.tsx`)
                               est désormais AUSSI réutilisée par
                               `MainDashboard.tsx` pour les cartes RR
                               Moyen/Profit Factor — pas de logique
                               dupliquée. `equityData[].date` (courbe
                               d'équité, page Rentabilité) affiche
                               désormais la vraie date du trade
                               (`trade.date`) au lieu de libellés générés
                               "Trade #N (paire)".
    coachingSessionStats.ts       inchangé cette période — `computeSessionGlobalNote`,
                               formule déjà confirmée par l'utilisateur.
    confirmDialog.tsx              inchangé cette période — modale de
                               confirmation maison, voir §2.
  components/
    ForumSection.tsx                **SUPPRIMÉ entièrement** cette
                               période, sur demande explicite de
                               l'utilisateur — voir §5 point 2 pour le
                               détail complet du retrait (fichiers,
                               routes, types, migration SQL).
    SetupAnalyzerModal.tsx          **SUPPRIMÉ entièrement** cette
                               période ("Audit Setup") — voir §5 point 6.
    MainDashboard.tsx               Sa courbe d'équité locale (distincte
                               de celle de `performanceStats.ts`) affiche
                               désormais la vraie date du trade en abscisse
                               (plus de libellés "T1"/"T2"). **Depuis cette
                               période** : phrase d'accueil dynamique
                               (`computeWeeklySummary`), 2 nouvelles cartes
                               Modules (Rentabilité, Macro — mêmes
                               fonctions que les onglets sidebar, style
                               identique aux cartes existantes avec leurs
                               propres couleurs bleu/violet), 2 nouvelles
                               cartes KPI (RR Moyen, Profit Factor via
                               `computeJournalSummary`), grille passée à 5
                               cartes KPI (`xl:grid-cols-5`). Le
                               `justify-between` sur les cartes Modules a
                               été retiré (décalait les titres selon la
                               longueur de la description — tous les
                               titres sont maintenant alignés depuis le
                               haut).
    Sidebar.tsx                      **Restructuration majeure cette
                               période**, sur demande explicite : les
                               anciennes sections SUIVI/PRATIQUE/FORMATION/
                               OUTILS sont FUSIONNÉES en une seule section
                               renommée **"SUIVIE TRADING"** (orthographe
                               volontaire de l'utilisateur, pas une faute à
                               corriger). `SectionName` simplifié à un seul
                               type `"suivi"`. Module "Audit Setup" retiré
                               (`onOpenSetupAnalyzer` prop supprimée,
                               import `Target` de lucide-react retiré).
                               Code mort retiré (`capitalDiff`/
                               `capitalDiffPercent`, calculés mais jamais
                               affichés nulle part — trouvé en audit).
                               **Nouveau comportement générique** : une
                               entrée-modale (`id: null`) sans `onOpen`
                               fourni par le parent (ex. `AdminStudentView`
                               qui ne branche pas `onOpenTradingPlan`/
                               `onOpenMindset`) est désormais visuellement
                               DÉSACTIVÉE (`opacity-50`, `cursor-not-allowed`,
                               `title` explicatif) au lieu d'un clic
                               silencieux qui ne faisait rien — voir §5
                               point 9.
    MacroDashboard.tsx               **Plusieurs changements cette
                               période** : bloc "Actualités marché" (5
                               titres statiques codés en dur, jamais mis à
                               jour) et bloc "Repères macro" (encart
                               pédagogique DXY/taux/VIX, contenait aussi le
                               disclaimer légal) RETIRÉS entièrement, sur
                               demande explicite — ne reste que ce qui est
                               réellement en direct (cotations 60s,
                               calendrier 10min, sentiment de risque
                               calculé côté client depuis les mêmes
                               cotations, sans appel réseau séparé). Sous-
                               titre ajusté en conséquence. **Nouveau**
                               filtre d'impact EXCLUSIF (façon boutons
                               radio, pas des cases indépendantes) sur
                               "Annonces à venir aujourd'hui" — 4 boutons
                               dans l'ordre Faible/Moyen/Fort/Tous
                               (`selectedImpact` state, "Holiday" toujours
                               affiché quel que soit le filtre actif).
    UserProfileModal.tsx           **Système de niveau/XP entièrement
                               revu cette période** (`computeLevelInfo`,
                               fonction pure hors composant) — avant :
                               "Rang : Trader SMC Confirmé"/"NIVEAU 4" et
                               objectif "3 000 XP" codés en dur,
                               incohérents dès que le vrai total (3650 XP)
                               les dépassait (repéré par l'utilisateur :
                               "3650 / 3 000 XP" affiché comme "en cours").
                               Désormais 5 paliers ("Trader Débutant" →
                               "Trader SMC Élite") calculés dynamiquement
                               sur la somme réelle des `rewardXP` du
                               catalogue de badges fourni, avec état
                               "Niveau maximum atteint" quand tous les
                               badges sont débloqués. **Aussi cette
                               période** : boutons Annuler/Enregistrer
                               ajoutés en bas de l'onglet "Badges &
                               Succès" (`handleSaveFromBadgesTab`, réutilise
                               `buildUpdatedProfile()` extrait de
                               `handleSubmit`) — cet onglet n'avait
                               auparavant AUCUN moyen de fermer la modale
                               autrement qu'en cliquant en dehors.
    NotificationModal.tsx           **Depuis cette période** : filtre
                               "Signaux" retiré du centre d'alertes —
                               aucune notification `type: "signal"` n'est
                               jamais créée nulle part dans le code
                               (vérifié par recherche exhaustive). Le type
                               `NotificationType` garde encore la valeur
                               `"signal"` dans son union (dead code mineur,
                               non nettoyé — voir `types.ts` ci-dessus).
    AdminStudentView.tsx            inchangé fonctionnellement, mais
                               n'a jamais branché `onOpenTradingPlan`/
                               `onOpenMindset` sur `<Sidebar>` — c'est ce
                               qui déclenche le nouveau comportement
                               "désactivé" générique de `Sidebar.tsx` (voir
                               plus haut), et non un oubli de cette
                               période : c'est la Vue Complète en LECTURE
                               SEULE, ces outils localStorage-only ne
                               peuvent structurellement pas y être
                               consultés (voir §5 point 9).
    TopHeader.tsx                    petit nettoyage : un `case "forum"`
                               mort dans `getBreadcrumbTitle` (retournait
                               "Badges & paliers", vestige d'une confusion
                               antérieure) retiré avec le module Forum.
```

### Le modèle d'authentification à deux mondes

`isAdmin` côté staff est fiable — `buildStaffProfile()`
(`server/routes.ts`) force `isAdmin: true` dans la réponse `/api/state`
pour toute session staff, à la lecture ET à l'écriture. `PUT /api/profile`
reste 403 pour tout compte élève — c'est pourquoi le plan de trading
(`TradingPlanData`) reste en `localStorage`, jamais synchronisé.

**"Plan de trading" et "Mindset" sont deux outils localStorage-only** — ni
l'un ni l'autre n'écrit jamais sur le serveur. C'est une conséquence
directe et volontaire du modèle ci-dessus (aucune route serveur dédiée
n'existe pour ces données), qui a une implication UX découverte cette
période : le coach ne peut JAMAIS voir le vrai plan de trading ou les
vrais check-ins Mindset d'un élève depuis son propre navigateur, même en
lecture seule — ces données sont physiquement absentes du serveur. Voir §5
point 9 pour le correctif UX appliqué (désactivation visuelle plutôt que
clic silencieux) et §7 pour ce point comme limitation connue assumée.

Le système de gestion d'accès élève **ne contourne pas** la règle
`isAdmin` : toutes les routes qui modifient un compte élève sont des
routes **staff**, protégées par `requireStaffKind`. Seule la consommation
finale du jeton de reset est publique, protégée par `PUBLIC_PATHS` +
`PUBLIC_PATH_PREFIXES` (voir §3, `server/auth/middleware.ts` ci-dessus)
plutôt que l'ordre de montage seul.

**Distinction staff : `isAdmin` vs `isOwner`.** Tout compte staff a
`isAdmin: true` (mêmes droits métier). Seul le compte fondateur a
`isOwner: true` — réservé au réglage des modules visibles (sidebar), à la
lecture du journal de sécurité, et à `DELETE /staff/:id` (suppression
d'un compte coach, décision produit explicite d'une période antérieure).

### Schéma SQLite (17 tables)

`badges`, `coach_messages`, `enrolled_students`, `login_lockouts`, `meta`,
`modules`, `notifications`, `quiz_results`, `security_events`, `sessions`,
`staff_accounts`, `student_accounts`, `student_password_reset_tokens`,
`student_sessions`, `trades`, `trading_accounts`, `users`.

**Deux tables supprimées cette période** : `forum_topics`/`forum_replies`
(module Forum retiré, migration `migrateDropForum()`, confirmées vides
avant suppression — le forum n'a jamais eu d'entrée dans la sidebar, donc
personne n'a jamais pu y écrire depuis l'UI). `coach_signals` avait déjà
été supprimée une période antérieure (module "Signaux & Analyses").

---

## 4. Le module Calculateurs (référence design "MacroPulse")

Inchangé cette période — voir le détail complet dans l'historique git de
ce document (`git log -p -- HANDOFF.md`) si besoin. Résumé : 3 panneaux
(Taille de position & risque, Risque/Rendement, Profit/Perte) dans
`PositionCalculatorModal.tsx`, ouvert via "Calculer Lot" dans le Journal,
reproduisant fidèlement une maquette externe "MacroPulse" partagée par
l'utilisateur.

---

## 5. Fonctionnalités terminées cette période (chronologique, 9 commits)

*(Depuis le dernier HANDOFF documenté, commit `9a8e6a0`. Pour l'historique
antérieur : `git log`, ou les périodes précédentes résumées en §1/§3.)*

1. **Mise à jour de dépendance** (`17d8bc5`) — `tsx` 4.23.5 → 4.23.12,
   patch dans la plage déjà autorisée par `package.json`, sans changement
   de code. Trouvé en vérifiant les dépendances obsolètes sur demande
   explicite ("vérifie qu'aucun secret n'a été commité, détecte les
   dépendances obsolètes"). `npm audit` : 0 vulnérabilité avant/après.
   Les autres dépendances obsolètes (Express 4→5, Vite 6→8, TypeScript
   5→7, etc.) sont des montées MAJEURES risquées, volontairement pas
   touchées — voir §7.

2. **Retrait entier du module Forum** (`9c5d7eb`) — sur demande explicite
   de l'utilisateur ("je veux que tu me supprimes ce module"), après avoir
   confirmé qu'il n'avait jamais d'entrée dans la sidebar (inaccessible
   depuis l'UI, décision produit déjà actée une période antérieure).
   Retiré : `ForumSection.tsx` (composant, 779 lignes), le type
   `ForumTopic`/`ForumReply`/`ForumCategory`/`ForumRole` (`types.ts`),
   tous les handlers et le state dans les deux shells `App.tsx`, toute la
   logique serveur dédiée dans `repositories.ts` (recomposition des
   réponses depuis leur propre table), les références dans `Sidebar.tsx`
   (`ALL_TABS`), `TopHeader.tsx` (breadcrumb mort), `MainDashboard.tsx`,
   `AdminStudentView.tsx`, `api.ts`, `useServerSync.ts`,
   `pendingChanges.ts`, `seed.ts`, `mockData.ts`. Migration
   `migrateDropForum()` ajoutée dans `db.ts` (tables confirmées vides
   avant suppression).

3. **Correctif taux US 10 ans** (`0aceb9f`) — le module Macro affichait
   0,4668 % au lieu de ~4,67 %. Vérifié EMPIRIQUEMENT via `curl` direct
   sur le point d'accès Yahoo réellement utilisé par `marketData.ts`
   (`/v8/finance/chart`, pas `/v7/finance/quote`) : il renvoie déjà la
   vraie valeur, sans facteur ×10. Le `scale: 10` d'une période antérieure
   (censé corriger l'erreur INVERSE) divisait donc une valeur déjà
   correcte. Voir §3 pour le piège à ne pas reproduire.

4. **Simplification du module Macro, footer** (`d8f9ba4`) — sur demande
   explicite, retrait des blocs "Actualités marché" (statique, jamais mis
   à jour) et "Repères macro" (encart pédagogique). Footer des deux shells
   changé de "Auto-entrepreneur" à "Trader" (mention légale non touchée).

5. **Dates réelles sur les courbes de capital** (`b445316`) — les deux
   courbes d'équité de l'app (tuile compacte `MainDashboard.tsx`, page
   pleine largeur `performanceStats.ts`/`PerformanceDashboard.tsx`)
   affichaient des libellés génériques "T1"/"T2"… ou "Trade #1 (US30)" en
   abscisse. Utilisent désormais `trade.date` directement, sur demande
   explicite.

6. **Retrait "Audit Setup", fusion sidebar, système de niveau XP corrigé**
   (`c5f3692`, le plus gros commit de cette période) :
   - **Module "Audit Setup" (`SetupAnalyzerModal.tsx`) retiré entièrement**
     — sur demande explicite, sans toucher au mécanisme `journalDraft`
     partagé avec le Calculateur de position (conservé côté staff, retiré
     côté élève où il ne servait plus qu'à ce module).
   - **Sidebar fusionnée** : "SUIVI" renommé "SUIVIE TRADING" (orthographe
     voulue), sections PRATIQUE/FORMATION/OUTILS fusionnées dedans — même
     fonctions, une seule section visuelle.
   - **Phrase d'accueil dynamique** (`src/lib/weeklySummary.ts`, nouveau
     fichier) — voir §3 pour le détail du calcul.
   - **2 cartes Modules ajoutées** (Rentabilité, Macro) au tableau de
     bord, même style que les cartes existantes.
   - **Boutons Annuler/Enregistrer ajoutés** à l'onglet Badges & Succès du
     profil (`UserProfileModal.tsx`) — cet onglet n'avait aucun moyen de
     fermer la modale avant.
   - **Système de niveau/XP corrigé** — "NIVEAU 4"/"3 000 XP" codés en dur
     remplacés par un calcul dynamique sur 5 paliers (voir §3).
   - **Titres des cartes Modules alignés** (retrait d'un `justify-between`
     qui les décalait selon la longueur de la description).

7. **RR Moyen et Profit Factor au tableau de bord** (`9bf0cce`) — 2
   nouvelles cartes KPI, réutilisant `computeJournalSummary()` (déjà
   utilisée par le Journal), pas de logique dupliquée.

8. **Import puis suppression de 59 trades de test** (données uniquement,
   pas de commit git — voir §2 pour pourquoi). L'utilisateur a demandé
   d'importer un relevé de trading réel (captures d'écran d'une
   plateforme prop firm) pour tester le Journal, rattaché à un compte
   "SMT 100K", puis de tout supprimer une fois le test terminé
   ("c'était principalement pour faire un test"). Le PnL importé
   correspondait au "Bénéfice Net" brut (commission déjà incluse) — un
   aller-retour a eu lieu sur "faut-il retirer les commissions du PnL",
   tranché en comparant avec les statistiques natives de la plateforme de
   l'utilisateur (Taux de réussite, Plus grosse perte/gain) qui
   correspondaient exactement au Net BRUT, pas au Net sans commission.
   **Aucune trace en base aujourd'hui** — Journal et portefeuille SMT 100K
   vides, comme avant cet essai. Si l'utilisateur redemande un import de
   ce type, le script utilisé était un fichier `tsx` jetable à la racine
   du projet appelant `replaceCollection("trades", [...], DEFAULT_USER_ID)`
   directement (voir §2, méthode "script jetable").

9. **Audit complet + filtre d'impact Macro + corrections diverses**
   (`460d03d` puis `610882c`) :
   - **Audit complet demandé explicitement** (bugs + sécurité), mené par 3
     agents parallèles (bugs client, bugs serveur, sécurité OWASP) — voir
     §0 et §7 pour le résultat détaillé (0 faille, 0 bug client, 4 bugs
     serveur mineurs, tous corrigés).
   - **Filtre d'impact sur le calendrier économique** (`MacroDashboard.tsx`)
     — d'abord des cases à cocher indépendantes (Faible/Moyen/Fort +
     bouton "Tous"), puis changé en EXCLUSIF (façon boutons radio) sur
     demande explicite ultérieure : un seul niveau actif à la fois.
   - **Correctif Vue Complète** (`Sidebar.tsx`) — "Plan de trading"/
     "Mindset" cliquables sans effet visible dans `AdminStudentView.tsx`
     (l'utilisateur l'a signalé : "je n'arrivais pas à accéder à ces
     modules-là"). Root cause : ces callbacks n'y sont jamais fournis
     (design volontaire, ces données étant localStorage-only côté élève,
     structurellement invisibles pour le coach). Corrigé par une
     désactivation visuelle générique + infobulle explicative, plutôt que
     par un faux accès qui aurait montré un formulaire vide et trompeur.
   - **Filtre "Signaux" retiré** du centre d'alertes
     (`NotificationModal.tsx`) — aucune notification de ce type n'est
     jamais créée dans le code.

---

## 6. Flux détaillés

### 6.1 Réinitialisation de mot de passe élève (par lien, sans email)

Inchangé cette période. Le staff génère un lien à jeton depuis la fiche
élève (`StudentTracking.tsx`, section "Accès & connexion") ; le jeton
(256 bits, haché en base, TTL 1h, usage unique garanti par transaction
atomique) est affiché une seule fois, à transmettre à la main (aucun
envoi d'email) ; l'élève choisit son nouveau mot de passe via
`/reset-password?token=…` (`ResetPasswordScreen.tsx`, seul point d'entrée
public de l'app en dehors de la connexion). Le jeton est retiré de
l'URL/historique du navigateur dès sa lecture (`history.replaceState`).
Cette route est protégée par `PUBLIC_PATHS`/`PUBLIC_PATH_PREFIXES`
(voir §3) — filet ajouté cette période, sans changement de comportement
observable.

### 6.2 Photo de profil personnalisée élève

Inchangé cette période. `UserProfileModal` (`avatarOnly`) → `PUT
/auth/profile/avatar` → stocké dans le bureau personnel de l'élève,
prioritaire sur `enrolled.avatar` (fiche coach) à la lecture via
`buildStudentProfile()`. La fiche côté coach (`StudentTracking.tsx`)
continue d'afficher `enrolled.avatar`, divergence assumée.

### 6.3 Changement de mot de passe volontaire

Inchangé cette période. Badges & Profil → "Mon mot de passe" →
`ChangeOwnPasswordModal` → `POST /auth/change-password` →
`destroyOtherSessions` (exclut la session courante). Distinct du
changement FORCÉ après invitation (`ChangePasswordScreen.tsx`), qui reste
sur `destroyAllSessions`/`destroyAllStudentSessions`.

### 6.4 Phrase d'accueil dynamique du tableau de bord (nouveau)

1. `MainDashboard.tsx` appelle `computeWeeklySummary(trades)`
   (`src/lib/weeklySummary.ts`) à chaque rendu.
2. Aucun trade → phrase d'invitation à démarrer.
3. Sinon : `firstTradeDate` = date la plus ancienne parmi `trades` (string
   `YYYY-MM-DD`, comparaison lexicographique = chronologique). `weekNumber`
   = nombre de semaines pleines écoulées depuis cette date + 1.
4. Fenêtre de la semaine en cours = `[weekStart, weekStart+6j]`. "Sessions
   travaillées" = dates distinctes de trades dans cette fenêtre,
   dénominateur fixe 5.
5. "Point faible" = tag `Trade.mistakes` le plus fréquent de la semaine en
   cours (repli sur toutes les semaines si rien cette semaine ; message
   neutre "Aucun point faible identifié" si aucune erreur taguée nulle
   part). Table de formulation française dans `MISTAKE_PHRASES`
   (`Record<TradeMistake, string>`, exhaustivité garantie par le
   compilateur).

### 6.5 Système de niveau/XP du profil (nouveau)

1. `UserProfileModal.tsx` calcule `totalXP` = somme des `rewardXP` des
   badges DÉBLOQUÉS (inchangé).
2. `computeLevelInfo(totalXP, badges)` calcule `maxXP` = somme des
   `rewardXP` de TOUS les badges du catalogue (débloqués ou non).
3. 5 paliers (`LEVEL_TITLES`) répartis uniformément sur `[0, maxXP]` —
   les seuils sont donc TOUJOURS cohérents avec le catalogue de badges
   réellement fourni, jamais une valeur codée en dur.
4. Le niveau affiché = le palier le plus haut dont le seuil plancher est
   dépassé. À `totalXP === maxXP` (tous les badges débloqués) : état
   spécial "Niveau maximum atteint", barre pleine, pas de "Progression
   vers niveau N+1" affichée (il n'y en a pas).
5. **Si le catalogue de badges change** (ajout/retrait/repondération d'un
   `rewardXP`), les paliers se recalculent automatiquement — rien à
   maintenir à la main.

---

## 7. Bugs connus / limitations

### ✅ Résolus cette période

Taux US 10 ans faux (facteur 10, sens inverse de l'ancien correctif) ;
module Forum entièrement retiré (était déjà inaccessible, mais existait
encore en code/DB) ; module "Audit Setup" entièrement retiré ; "NIVEAU 4"/
"3 000 XP" codés en dur et incohérents dès que le vrai total les
dépassait ; courbes de capital avec libellés génériques au lieu des
vraies dates ; onglet "Badges & Succès" sans aucun moyen de fermer la
modale ; cartes Modules du tableau de bord avec titres désalignés ; filtre
"Signaux" du centre d'alertes sans notification de ce type jamais créée ;
"Plan de trading"/"Mindset" cliquables sans effet visible dans la Vue
Complète (corrigé par désactivation visuelle explicite, pas par un faux
accès) ; **4 bugs serveur mineurs trouvés en audit** :
`startingCapital`/`currentCapital` sans borne minimale (négatifs acceptés,
`.min(0)` ajouté) ; code mort `capitalDiff`/`capitalDiffPercent` dans
`Sidebar.tsx` (calculés, jamais affichés, retirés) ; route de reset
password protégée seulement par l'ordre de montage des routeurs
(`PUBLIC_PATH_PREFIXES` ajouté en filet) ; commentaire trompeur sur une
vérification d'autorisation devenue inatteignable (`ADMIN_ONLY_COLLECTIONS`,
corrigé) ; `writeFullState` (seed/import) non transactionnel (enveloppé
dans une transaction unique).

*(Détail complet de chaque correctif : `git log --oneline 9a8e6a0..HEAD`
puis `git show <hash>`, ou §5 ci-dessus.)*

### ✅ Résolus périodes antérieures (résumé, détail dans l'historique git)

Ancien statut élève non migré ; Vue Complète ignorant les modules
masqués ; module "Signaux & Analyses" retiré entièrement ; cache élève non
vidé à l'expiration naturelle de session (faille de sécurité) ; coût
scrypt sous recommandation OWASP ; suppression de compte coach non
réservée au fondateur ; `NODE_ENV` non vérifié au démarrage ; absence de
rate limit sur les endpoints publics météo/marché ; jeton de reset visible
dans l'historique navigateur ; validations Zod contournables par confusion
de type ; `isAdmin` réécrit à `false` sur une base ancienne ; date de
courbe d'équité codée en dur ; Win Rate/PnL contradictoires ; taille de lot
bloquée à 1 ; perte quotidienne calculée en UTC ; email de connexion élève
désynchronisé de la fiche ; ratio R:R fictif sur stop=entrée ; mot de passe
imposé par le staff sans forcer son remplacement ; changement de mot de
passe volontaire déconnectant l'auteur lui-même ; les 7 `window.confirm()`
natifs restants remplacés par `confirmDialog()` ; rôle auteur du forum
codé en dur (avant le retrait complet du module).

### 🟡 Connus, non corrigés (décisions produit ou priorité basse)

1. **"Plan de trading"/"Mindset" invisibles depuis la Vue Complète**
   (`AdminStudentView.tsx`) — **limitation architecturale assumée**, pas
   un bug : ces deux outils persistent en `localStorage` sur l'appareil de
   l'ÉLÈVE, jamais synchronisés au serveur. Le coach ne peut structurellement
   pas les consulter, même en lecture seule, depuis son propre navigateur.
   Corrigé cette période côté UX (désactivation visuelle + infobulle au
   lieu d'un clic silencieux), mais la limitation de fond reste entière.
   Pour la lever un jour, il faudrait une vraie route serveur pour ces
   deux données (hors périmètre actuel).
2. **`NotificationType` garde la valeur `"signal"` dans son union**
   (`types.ts`) alors que le filtre UI correspondant a été retiré — dead
   code mineur, sans risque, pas nettoyé faute de demande explicite.
3. **Dépendances obsolètes non mises à jour** (trouvé en audit dépendances
   cette période) : `typescript`, `vite`, `express`, `esbuild`,
   `@vitejs/plugin-react`, `lucide-react`, `@types/express`, `@types/node`
   ont tous une version majeure plus récente disponible. `npm audit` : 0
   vulnérabilité, donc aucune urgence sécurité — mais ce sont des montées
   MAJEURES (ex. Express 4→5, Vite 6→8) potentiellement disruptives, à ne
   traiter que sur demande explicite avec du temps de test dédié.
4. **Rate limiter en mémoire, par processus.** Compromis accepté,
   documenté dans `rateLimit.ts`.
5. **Absence de flux de récupération de mot de passe STAFF en cas
   d'OUBLI complet** (distinct du changement volontaire). Seule la
   procédure de secours du README (accès direct base) existe.
6. **`TradingPlanEditorModal.tsx` : persistance `localStorage`
   uniquement**, pas de synchronisation multi-appareils. Compromis assumé
   (voir point 1 ci-dessus pour l'implication découverte cette période).
7. **`package.json.name` reste `"react-example"`.**
8. **`.gitignore` : règle `data/` matche aussi `src/data/`** — voir §2.
9. **`syncAccountsWithTrades` écrase tout ajustement manuel de solde dès
   qu'au moins un trade est rattaché au compte.** Compromis assumé.
10. **Le badge de rating des coachs (`Coach.rating`) est optionnel et
    absent pour tout coach dérivé d'un vrai profil** — voulu.
11. **Durée de vie de session sans plafond absolu, pas de révocation par
    appareil précis.** Sévérité basse, choix produit assumé ("outil
    personnel d'usage quotidien").
12. **Fragilité théorique de validation** : `collectionItem` (schémas Zod
    des collections) est en `.passthrough()`. Sans danger aujourd'hui,
    documenté en commentaire dans `server/schemas.ts`.

### Piège opérationnel : `AdminStudentView.tsx` est un overlay

Scoper toute recherche DOM à
`document.querySelector('.fixed.inset-0.z-50...')`.

### Piège confirmé : backtick littéral dans un commentaire SQL de `server/db.ts`

Casse la compilation TypeScript avec une erreur peu claire.

---

## 8. Décisions techniques importantes

### Anciennes décisions (toujours valides)

Voir l'historique git de ce document pour le détail complet : plan de
trading en localStorage, calculateur simplifié plutôt qu'enrichi, deux
shells applicatifs avec état de modale dupliqué par design,
`SectionHeader` dupliqué à dessein dans chaque fichier, lien de reset
"complet" à jeton plutôt qu'un mot de passe temporaire simplifié, Coach
Attribué reconstruit depuis les vrais comptes staff jamais des noms
inventés, `window.confirm()`/`prompt()` remplacés par `confirmDialog()`.

### Nouvelles décisions cette période

**Retrait du module Forum, entièrement, plutôt que lui ajouter une entrée
sidebar** — le module était fonctionnel mais inaccessible depuis
plusieurs périodes (décision produit déjà actée). Face au choix "le
rendre accessible" vs "le supprimer", l'utilisateur a choisi la
suppression complète sans hésitation quand la question a été posée
explicitement. Réflexe à reproduire : pour tout module "prêt mais caché"
découvert dans une future exploration, poser la question plutôt que de
supposer qu'il faut le finir/l'exposer.

**Fusion des sections sidebar en une seule ("SUIVIE TRADING")** — demande
explicite de simplification de la navigation, sans changement de
fonction. Si une future demande veut re-séparer des groupes, le motif à
reproduire est celui d'AVANT cette période (4 tableaux `SidebarEntry[]`
distincts, un `renderSection()` par groupe) — visible dans l'historique
git de `Sidebar.tsx`.

**Désactivation visuelle plutôt que branchement factice pour "Plan de
trading"/"Mindset" en Vue Complète** — face à un clic qui ne faisait
rien, deux options : brancher des callbacks qui ouvriraient un formulaire
VIDE (trompeur, l'élève a peut-être vraiment rempli quelque chose,
simplement invisible pour le coach), ou désactiver visuellement avec une
explication honnête. La seconde a été retenue, généralisée dans
`Sidebar.tsx` (toute entrée-modale sans `onOpen` fourni devient
automatiquement non-cliquable) plutôt que traitée au cas par cas dans
`AdminStudentView.tsx` — plus robuste face à un futur module du même type.

**Filtre d'impact du calendrier Macro : exclusif (radio), pas cases à
cocher** — implémenté d'abord en multi-sélection (cases indépendantes),
changé sur demande explicite ultérieure de l'utilisateur en comportement
exclusif. Si une future demande touche ce filtre, vérifier d'abord lequel
des deux comportements est actuellement en place plutôt que de supposer.

**Audits (bugs et sécurité) menés par agents parallèles, une zone/un
angle par agent** — méthode qui a fait ses preuves à nouveau cette
période (3 agents : bugs client, bugs serveur, sécurité OWASP). Chaque
agent audite en lecture seule et rapporte avec sévérité + scénario
concret, sans corriger ; l'IA compile, priorise, corrige tout
directement (aucune clarification nécessaire cette fois — tous les bugs
trouvés étaient des corrections techniques pures, pas des décisions
produit), vérifie (lint/build/API en direct), et committe/pousse sur
demande explicite. **Nouveau cette période** : un des 3 agents a échoué
en cours de route ("session limit" — une limite d'usage de la session
globale, pas un bug de l'agent) après avoir déjà couvert la majorité de
son périmètre ; la suite a été terminée manuellement (lecture directe des
derniers fichiers + un balayage `grep` ciblé) plutôt que de relancer un
agent frais qui aurait dupliqué le travail déjà fait. Réflexe à
reproduire si ça se reproduit : vérifier CE QUE l'agent avait déjà
couvert (son dernier message donne généralement un indice, ex. "Clean, no
bugs. Let's check X et Y") avant de décider comment terminer.

---

## 9. Historique de nommage (résolu, contexte seulement)

`src/components/TradingPlanModal.tsx` (nom trompeur, en réalité la
checklist "Exercice du jour") a été supprimé il y a plusieurs périodes.
`src/components/TradingPlanEditorModal.tsx` existe toujours — c'est le
vrai plan de trading (module Pratique, désormais fusionné dans la section
sidebar "SUIVIE TRADING"), persistance localStorage.

`CoachSignals.tsx` a été supprimé une période antérieure (module "Signaux
& Analyses"). `ForumSection.tsx` et `SetupAnalyzerModal.tsx` ont été
supprimés CETTE période (voir §5 points 2 et 6). Toute référence à l'un
de ces trois fichiers, ou aux types `CoachSignal`/`ForumTopic`/
`ForumReply`, dans un contexte antérieur à cette période décrit quelque
chose qui n'existe plus.

---

## 10. Contexte de travail avec l'utilisateur

- Il **communique en français**, ton direct, tutoiement, souvent par
  phrases courtes sans ponctuation soignée — lire l'intention plutôt que
  la forme.
- Il travaille par **demandes courtes et itératives**, souvent en
  signalant un problème constaté en usage réel plutôt qu'en décrivant une
  solution technique (ex. "je n'arrivais pas à accéder à ces modules-là"
  plutôt que "AdminStudentView ne branche pas onOpenTradingPlan").
- **Il pointe parfois un élément UI précis en le sélectionnant dans le
  navigateur** (capture d'écran + inspecteur d'élément fourni au fil de
  la conversation) pour désigner exactement ce qu'il veut modifier —
  très fréquent cette période (renommage de bouton, retrait de bloc,
  échange de position de deux boutons).
- **Il change parfois d'avis en cours de route, très vite**, et peut
  redemander une modification contraire à ce qu'il vient de valider (ex. :
  a d'abord demandé un filtre d'impact en cases à cocher, puis a demandé
  de le rendre exclusif quelques échanges plus tard). Ne pas s'accrocher à
  un choix antérieur, vérifier l'état actuel du code avant d'agir.
- **Sur un chantier touchant la sécurité/l'authentification/les
  permissions**, il a systématiquement choisi l'option la plus
  complète/robuste quand on lui a posé la question. Poser la question
  plutôt que deviner reste le bon réflexe pour ce type de sujet — il y
  répond vite et précisément.
- **Il demande parfois des audits complets de l'écosystème** ("vérifie
  toute la sécurité et les bugs") avec l'attente explicite qu'ils soient
  MENÉS JUSQU'AU BOUT (trouvés, priorisés, ET corrigés) dans la même
  session, sans qu'il ait à repasser derrière pour valider chaque
  correctif un par un. Voir §8 pour la méthode qui a fonctionné.
- **Il ne donne jamais ses mots de passe pour que tu les utilises** —
  règle absolue. Voir §2 pour la méthode de vérification alternative
  (appels API directs, comptes de test existants, scripts jetables).
- **Toujours vérifier en conditions réelles.** Chaque correctif doit être
  vérifié visuellement dans le Browser pane avant d'être annoncé terminé
  — et pour les flux serveur, vérifier aussi côté API/base de données
  directement.
- **Il pousse toujours après confirmation explicite**, jamais
  automatiquement — même après un chantier annoncé "terminé", attendre le
  "commite et pousse" avant d'agir. Il redemande aussi régulièrement de
  vérifier le déploiement Railway APRÈS avoir poussé — c'est une étape
  attendue du cycle, pas une vérification superflue.
- **Il a demandé un import puis une suppression de données de test réelles**
  cette période (59 trades depuis des captures d'écran de sa vraie
  plateforme prop firm) — a bien précisé "c'était principalement pour
  faire un test", confirmant qu'il comprend et utilise consciemment les
  scripts jetables comme un vrai outil de travail, pas juste une
  formalité. Rien d'inhabituel à cette demande si elle se reproduit.
- Quand il demande une mise à jour du HANDOFF « suffisamment détaillée »,
  il attend fidélité complète à ce qui a changé, y compris les points
  encore ouverts/non confirmés — pas seulement un résumé du fini.

### Méthode de vérification qui a fait ses preuves

1. `npm run lint` après chaque changement de code, même en cours de
   chantier multi-fichiers.
2. Redémarrer le serveur de dev après tout changement **serveur**.
3. Vérification visuelle dans le Browser pane avant d'annoncer un
   correctif terminé — `navigate()` plutôt qu'un raccourci clavier
   simulé. Si des erreurs console semblent incohérentes avec le code
   actuel, ouvrir un **onglet neuf** avant de conclure à un vrai bug.
4. Pour un flux serveur avec effets de bord : vérifier directement via
   `javascript_tool` + `fetch()` sur l'API, via `sqlite3` sur la base, et
   via un **script `tsx` jetable à la racine du projet** (supprimé après
   usage) pour tester une fonction serveur pure.
5. Pour un déploiement Railway : `railway deployment list --service
   propdesk --json` d'abord, `railway logs --service propdesk` en
   complément, UN SEUL `curl` espacé en dernier recours.
6. Pour une fonctionnalité ambiguë ou un chantier de grande ampleur :
   `AskUserQuestion` courte — UNIQUEMENT pour les vraies décisions
   produit/permission, jamais pour une correction technique pure.
7. Avant de pousser un chantier de grande ampleur, demander confirmation
   explicite même si l'utilisateur a déjà autorisé des push plus petits
   dans la même session.
8. Nettoyage systématique des scripts ponctuels après usage — jamais
   laissés dans le dépôt.
9. Pour tester une fonctionnalité élève sans disposer du mot de passe de
   l'utilisateur : appels API directs avec un compte élève de TEST
   existant en base, jamais le vrai compte de l'utilisateur.
10. **Pour un audit multi-agents** : si un agent échoue en cours de route
    (limite d'usage, pas un bug), lire son dernier message pour savoir ce
    qu'il avait déjà couvert avant de décider comment terminer
    manuellement — éviter de dupliquer le travail déjà fait.

---

## 11. Prochaines tâches, dans l'ordre

**Aucune tâche explicite en attente** — redemander directement à
l'utilisateur.

### Points ouverts à garder en tête (pas des tâches, des choses à vérifier SI l'occasion se présente)

- Voir §0 pour les 3 points de cette période (niveau/XP dynamique, Plan de
  trading/Mindset désactivés en Vue Complète, filtre d'impact Macro) —
  tous déjà terminés, listés ici seulement pour contexte rapide.
- Un flux de réinitialisation de mot de passe STAFF pour le cas de
  l'OUBLI complet — le code de `createPasswordResetToken`/
  `consumePasswordResetToken` (`studentCredentials.ts`) est le patron à
  dupliquer/adapter si demandé.
- Un envoi d'e-mail automatique pour le lien de réinitialisation élève, si
  le staff trouve la transmission manuelle trop lourde à l'usage.
- Les dépendances majeures obsolètes (§7 point 3) — seulement sur demande
  explicite, avec du temps de test dédié (montées disruptives).
- Nettoyer la valeur `"signal"` morte dans `NotificationType` (§7 point 2)
  — cosmétique, très faible priorité.

### Ce qui n'est PAS une tâche

- **Réintroduire de l'IA sous quelque forme que ce soit.**
- **Deviner et appliquer soi-même un mapping/une décision produit
  ambiguë** sans validation de l'utilisateur.
- **Ajouter un envoi d'e-mail automatique** au flux de reset sans demande
  explicite.
- **"Réparer" les limitations connues listées en §7** sans demande
  explicite — en particulier ne pas toucher au principe "tous égaux" des
  comptes staff, et ne pas essayer de "corriger" la limitation Plan de
  trading/Mindset en Vue Complète (c'est une contrainte architecturale,
  pas un oubli) sans qu'on te le demande.
- **Monter les dépendances majeures obsolètes** (Express, Vite,
  TypeScript...) sans demande explicite et sans prévoir du temps de test.
- **Vérifier le déploiement Railway par des `curl` répétés.**
- **Taper le mot de passe de l'utilisateur**, sous quelque prétexte que
  ce soit.

---

## 12. État à la reprise

- Branche `main`, dernier commit **poussé et déployé** `610882c`.
  Répertoire de travail **propre**.
- `npm run lint` (`tsc --noEmit`) passe sans erreur.
- Application déployée et fonctionnelle sur Railway
  (`propdesk-academie.up.railway.app`), déploiement automatique
  opérationnel, dernier déploiement confirmé `SUCCESS`.
- **Aucun point bloquant, aucun point ouvert.** Un audit complet
  (bugs + sécurité) a été mené et entièrement traité cette période — voir
  §0.

### Par où commencer

1. Lire §0 en entier (contexte des correctifs les plus récents).
2. `git status --short` et `git log --oneline -10` pour confirmer que
   l'état correspond toujours à ce document (peut avoir légèrement évolué
   si l'utilisateur a travaillé entre-temps sans mettre à jour ce
   fichier).
3. Si un audit de bugs/sécurité est redemandé rapidement après la date de
   ce document, rappeler qu'un audit complet vient d'être fait (§0/§5
   point 9) — ça n'empêche pas d'en refaire un si demandé, mais évite de
   présenter le résultat comme une surprise.
4. Attendre la prochaine demande de l'utilisateur — rien n'est en attente
   de sa part à la date de rédaction.

> Ce document est la **seule** source de reprise fiable. S'il existe un
> écart entre ce document et le code, **fais confiance au code** —
> vérifie par la lecture directe des fichiers sources et par
> `git status`/`git diff`/`sqlite3`, et corrige ce document en
> conséquence.


---

## MISE À JOUR 20/08/2026 — CGU plateforme + alignement du statut juridique (fichiers déjà écrits, à commit + déployer)

> Les modifications décrites ci-dessous sont **déjà présentes dans les fichiers** du dépôt (écrites le 20/08/2026). Elles ne sont **pas encore commitées ni poussées**. Cette section dit à un développeur (ou à Claude Code) exactement quoi faire.

### Ce qui a changé, fichier par fichier

- **`src/components/CGUModal.tsx`** — NOUVEAU COMPOSANT. Modal de Conditions Générales d'Utilisation de la plateforme (objet, accès, compte/identifiants, usage conforme, propriété intellectuelle, disponibilité, données personnelles, nature éducative + risques, suspension/résiliation, responsabilité, modification, droit applicable). Style calqué **à l'identique** sur `LegalNoticeModal.tsx` (mêmes classes, palette `#00E676`/`#111615`/`#1B2320`, composants locaux `SectionTitle` et `P`, prop `isOpen`/`onClose`). Icône `FileText`.
- **`src/components/LegalNoticeModal.tsx`** — statut juridique aligné : « Auto-entrepreneur » → « Entrepreneur individuel (micro-entreprise) » (section 1 et pied de modal). Date passée au 20/08/2026. (La section Cookies n'a volontairement pas été retouchée ici — hors périmètre de cette mise à jour.)
- **`src/App.tsx`** — câblage du modal CGU dans les **deux shells** :
  - import `import { CGUModal } from "./components/CGUModal";` ajouté ;
  - état `const [isCguOpen, setIsCguOpen] = useState(false);` ajouté à côté de `isLegalNoticeOpen` (2 endroits) ;
  - bouton « CGU » ajouté dans le `<footer>` à côté de « Mentions légales » (2 endroits) ;
  - `<CGUModal isOpen={isCguOpen} onClose={() => setIsCguOpen(false)} />` monté à côté de `<LegalNoticeModal .../>` (2 endroits) ;
  - texte de pied de page « Thomas Gauthey — Trader » → « Thomas Gauthey — Entrepreneur individuel » (2 endroits).

### Action attendue de Claude Code

1. Relire `CGUModal.tsx`, `LegalNoticeModal.tsx` et les 2 blocs footer de `App.tsx`.
2. `npm run lint` (`tsc --noEmit`) — doit passer (déjà vérifié OK au 20/08/2026).
3. Commit (ex. « Ajoute les CGU de la plateforme (modal + câblage 2 shells) et aligne le statut juridique »).
4. Pousser sur GitHub `Forexpaps/propdesk` → **déploiement automatique Railway sur push** (vérifier `railway deployment list --service propdesk --json` : `status: SUCCESS`).

### Reste à la charge du propriétaire (hors code)

- **SIRET** à renseigner dans `LegalNoticeModal.tsx` et `CGUModal.tsx` dès attribution (actuellement « en cours d'attribution »).
- La **politique de confidentialité** vit sur le site vitrine (`09 - PropDesk-Site/app/confidentialite`) ; si tu veux la rendre accessible depuis la plateforme, prévoir un lien ou un modal dédié (non fait dans cette mise à jour).
