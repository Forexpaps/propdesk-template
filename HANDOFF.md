# HANDOFF — PropDesk (Académie de Trading)

Document de reprise. Il suppose que tu n'as accès ni à la conversation qui
l'a produit, ni à autre chose que ce dépôt. Lis-le en entier avant de
toucher au code — en particulier **§0** (où reprendre) et **§9** (piège de
nommage critique, toujours d'actualité).

> **État à la dernière mise à jour de ce document**
> Branche `main`, dernier commit poussé : **`cdd72e9`** (« Refond la fiche
> élève : nouveau statut, diagnostic, accès & connexion »), déployé avec
> succès sur Railway (`status: SUCCESS`, commit `cdd72e9` confirmé via
> `railway deployment list --service propdesk --json`).
> **Répertoire de travail PROPRE** — `git status --short` ne renvoie rien.
> `npm run lint` et `npm run build` passent sans erreur.
> Application déployée sur **Railway**, domaine
> `https://propdesk-academie.up.railway.app`.

---

## 0. Où reprendre EXACTEMENT

**Pas de chantier interrompu** — le répertoire de travail est propre et le
dernier commit est déployé avec succès. **Mais un bug réel et confirmé
attend une décision avant toute autre tâche** :

### 🔴 Bug confirmé, priorité immédiate : anciennes fiches élèves avec un statut obsolète

Le commit `cdd72e9` a remplacé entièrement `StudentStatusTag` (voir §5) :
l'ancien statut (`"En Évaluation FTMO"`, `"Prop Firm Financé"`, `"Besoin
Coaching"`, `"Alerte Tilt"`) n'existe plus dans le type, remplacé par 4
nouvelles valeurs (`"Évaluation Étape 1"`, `"Évaluation Étape 2"`, `"Compte
Financé"`, `"Fonds Propres"`). **Aucune migration de données n'a été
faite.**

**Confirmé en base locale** :
```bash
sqlite3 data/horizon.db "select id, json_extract(payload,'\$.name'), json_extract(payload,'\$.statusTag') from enrolled_students"
→ stud-1787124306837|Sensei|En Évaluation FTMO
```

La fiche "Sensei" porte encore l'ancienne valeur. `STATUS_TAG_STYLES`
(`src/components/StudentTracking.tsx`, ligne ~54) est un
`Record<StudentStatusTag, string>` **strict** ne contenant que les 4
nouvelles clés — `STATUS_TAG_STYLES["En Évaluation FTMO"]` renvoie donc
`undefined`. Pas de crash JS (accès à une clé absente d'un objet ne lève
pas d'exception), mais le badge de statut s'affiche **sans style** (pas de
couleur, pas de bordure) sur la fiche concernée, dans la liste comme dans
le formulaire d'édition.

**À trancher à la reprise** (pas fait faute d'instruction explicite de
l'utilisateur sur ce point précis) :
1. Migrer les fiches existantes vers une valeur du nouveau statut (mapping
   à décider avec l'utilisateur — aucune correspondance évidente et
   univoque entre l'ancien et le nouveau système : "Besoin Coaching" et
   "Alerte Tilt" n'ont pas d'équivalent direct dans Évaluation/Financé/
   Fonds Propres).
2. Ou ajouter un simple filet de sécurité d'affichage (classe par défaut
   si la clé ne matche rien) pour que l'ancien badge reste au moins
   lisible, en attendant une vraie décision sur le mapping.

**Ne pas deviner le mapping toi-même** — demande d'abord à l'utilisateur.
Vérifier aussi si d'autres fiches existent en production Railway avec le
même problème (pas de moyen d'y accéder directement, voir §2 "Inspecter
la base Railway").

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
(`#111615`/`#1B2320`), micro-labels `[9px]` en majuscules espacées,
en-têtes de section à barre verticale colorée (`SectionHeader`, un
composant local à chaque fichier, jamais partagé — voir §8 pourquoi).
Palette PropDesk (vert `#00E676`, fonds `#0D1110`/`#111615`) inchangée.
Les cartes "Modules" du Tableau de bord ont en plus une **lueur intérieure
permanente**, colorée selon le module (voir §5, point 3-4).

Le projet possède aussi une page publique de mentions légales (voir §5,
point 9) et un vrai système de gestion d'accès/mot de passe élève avec
lien de réinitialisation à jeton (voir §5, point 10, et §6 pour le détail
technique complet).

### Qui l'utilise

Outil de travail d'un coach (« ForexPaps »/« Forex Paps » selon
l'environnement, `th.gauthey99@gmail.com`, compte fondateur) et de son
staff. Plusieurs comptes staff partagent le même bureau (mêmes trades,
fiches élèves, portefeuilles). Les élèves ont un second monde d'identité
séparé, chacun avec son propre bureau cloisonné. Seul « Suivi des
Élèves » reste réservé à un compte staff (`isAdmin`, toujours vrai pour
tout compte staff, forcé côté serveur — voir §6/§8).

### Hébergement : Railway (pas seulement GitHub)

**Railway** (`https://propdesk-academie.up.railway.app`, projet
"propdesk", dépôt GitHub `Forexpaps/propdesk` connecté) :
- Service configuré avec un **volume persistant** `/data` (500 Mo) monté
  sur `DATA_DIR=/data`, `NODE_ENV=production`.
- **Déploiement automatique sur push** fonctionne, vérifié à chaque
  session par `railway deployment list --service propdesk --json`.
- **Vercel a été essayé puis abandonné** (session antérieure) — serverless
  incompatible avec Express + SQLite persistant. Ne pas y revenir sans
  réécriture lourde.
- **Piège récurrent observé sur plusieurs sessions** : l'edge Railway
  ("railway-hikari") peut bloquer périodiquement le trafic avec des
  réponses `429 rate limited`, un mécanisme anti-abus indépendant de
  l'application, déclenché par des `curl` trop fréquents/rapprochés. Un
  `429` isolé après confirmation `SUCCESS` via l'API Railway n'est **pas**
  un vrai problème — ne pas insister, ne pas re-tenter en boucle.
  **Prévention** : toujours vérifier un déploiement via
  `railway deployment list --service propdesk --json` (API, fiable) en
  premier, au plus UN `curl` espacé dans le temps ensuite.

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
reconnecter est normal, ou vérifier via `fetch(...).then(r=>r.json())`
dans `javascript_tool` si la session survit (elle survit tant que le
cookie et la base ne changent pas, seul le process redémarre).

**⚠️ Piège d'outil de prévisualisation confirmé** : un raccourci clavier
simulé (`cmd+R`) ne recharge pas toujours vraiment la page. Préférer
`navigate()` vers la même URL. Le screenshot du Browser pane peut parfois
rester figé sur une frame obsolète (observé cette période) — si un clic
semble sans effet, vérifier l'état réel via `javascript_tool`
(`document.body.innerHTML.includes(...)`) avant de conclure à un bug.

**⚠️ `window.confirm()`/`window.prompt()` natifs sont fiables NULLE PART
où ils sont encore utilisés** — deux causes distinctes confirmées :
1. Dans le Browser pane automatisé de dev : `confirm()` retourne
   silencieusement `false`, `prompt()` lève une exception.
2. **En production, sur iOS, quand le site est ouvert en mode application**
   (icône ajoutée à l'écran d'accueil) : `confirm()`/`prompt()` restent
   muets. Bug réel signalé par l'utilisateur en usage réel sur iPhone,
   corrigé dans `WalletManagement.tsx` par deux modales maison (session
   antérieure). **Si tu retrouves un `window.confirm()`/`prompt()`
   ailleurs, remplace-le proactivement** — pas un cas isolé.

**⚠️ Le nouveau flux de réinitialisation de mot de passe (§5 point 10, §6)
n'envoie aucun e-mail** — c'est assumé et documenté en commentaire dans le
code (`server/auth/studentCredentials.ts`, `server/auth/routes.ts`) : le
lien est affiché une seule fois côté staff, à copier/transmettre à la
main. Ne pas "corriger" en ajoutant un envoi d'e-mail sans qu'on te le
demande — aucune infrastructure d'envoi n'existe dans ce projet.

### Inspecter la base locale

```bash
sqlite3 data/horizon.db "select id, name, email from staff_accounts"
sqlite3 data/horizon.db "select json_extract(payload,'\$.isAdmin') from users where id='user-local'"
sqlite3 data/horizon.db "select id, json_extract(payload,'\$.name'), json_extract(payload,'\$.equity') from trading_accounts"
sqlite3 data/horizon.db "select id, json_extract(payload,'\$.name'), json_extract(payload,'\$.statusTag') from enrolled_students"
```

**⚠️ Piège confirmé, à connaître** : `users.payload.isAdmin` peut être
`0`/absent en base pour le compte fondateur SANS que ce soit un problème
réel — le serveur force `isAdmin: true` dans la réponse `/api/state` pour
toute session staff (voir §6/§8), sans jamais réécrire la valeur en base.

**Piège confirmé, non corrigé, faible priorité** : `.gitignore` contient
`data/` sans slash de tête, qui matche `src/data/` en plus du dossier
SQLite racine — `git add src/data/mockData.ts` (chemin exact) refuse et
demande `-f`. `git add -A`/`git add .` fonctionnent normalement.

**⚠️ Les données locales de test peuvent changer entre deux sessions sans
intervention explicite** — déjà observé une fois (compte "test" remplacé
par "SMT 10K" sans action délibérée). Ne jamais supposer que l'état des
données locales observé à un instant T est stable — revérifier avec
`sqlite3` avant de bâtir un raisonnement dessus.

### Inspecter la base Railway (production)

Pas d'accès direct — pas de SSH (refusé explicitement par l'utilisateur).
Pour toute vérification, passer par l'API HTTP du site déployé (`curl`,
avec parcimonie — voir §1) ou par le dashboard Railway (`railway open`, ou
https://railway.com/project/1ff27138-1722-451a-95c5-4719ffbae46a).

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
                               nettoyage périodiques (sessions staff,
                               sessions élève, événements de sécurité,
                               verrous de connexion, ET DÉSORMAIS
                               jetons de réinitialisation de mot de passe
                               élève — startPasswordResetTokenCleanup()).
server/
  db.ts                        SQLite (better-sqlite3, WAL, foreign_keys
                               ON), 18 tables (17 + nouvelle
                               student_password_reset_tokens, voir §5
                               point 10 pour le schéma exact). Piège
                               syntaxique rencontré cette période : tout
                               le bloc `CREATE TABLE` vit dans UN SEUL
                               template literal JS (backticks) — un
                               backtick littéral dans un commentaire SQL
                               ferme prématurément la chaîne et casse la
                               compilation TypeScript avec une erreur
                               obscure ("',' expected") sur une ligne sans
                               rapport apparent. Ne jamais utiliser de
                               backtick à l'intérieur d'un commentaire SQL
                               `-- ...` dans ce fichier — utiliser des
                               guillemets ou rien.
  repositories.ts               accès bas niveau aux tables.
  routes.ts                     routes /api/* génériques.
                               `buildCoachesForStudent()` reconstruit le
                               coach affiché à l'élève depuis le vrai
                               profil fondateur. `buildStaffProfile()`
                               force `isAdmin: true` pour toute session
                               staff. `PUT /profile` est **réservée au
                               staff** — 403 si `req.auth.kind ===
                               "student"`.
  schemas.ts                    schémas Zod. Nouveaux cette période :
                               `setStudentPasswordSchema`,
                               `updateStudentEmailSchema`,
                               `consumeResetTokenSchema`. L'enum
                               `eventType` du filtre de journal de
                               sécurité a 4 nouvelles valeurs (voir §5
                               point 10).
  auth/
    routes.ts                   `staffRouter` (post-barrière
                               d'authentification) — 3 nouvelles routes
                               cette période : `PUT
                               /students/:id/password`, `PUT
                               /students/:id/email`, `POST
                               /students/:id/reset-link`.
    studentRoutes.ts             `studentAuthRouter` (PUBLIC, monté avant
                               la barrière) + `studentProtectedRouter`.
                               Nouvelle route publique cette période :
                               `POST /reset-password/:token`.
    studentCredentials.ts        Accès table `student_accounts` +
                               DÉSORMAIS `student_password_reset_tokens`.
                               Nouvelles fonctions : `updateStudentEmail`,
                               `createPasswordResetToken`,
                               `consumePasswordResetToken` (transaction
                               atomique anti-double-consommation),
                               `purgeExpiredPasswordResetTokens`,
                               `startPasswordResetTokenCleanup`.
src/
  App.tsx                      porte d'auth à deux mondes. **Deux
                               "shells" distincts, chacun avec son propre
                               état de modales dupliqué** :
                               `StudentAuthenticatedApp` (élève) et
                               `AuthenticatedApp` → `AcademyApp` (staff).
                               **Nouveau cette période** : tout en haut du
                               composant `App()`, AVANT la logique
                               d'authentification, un check
                               `window.location.pathname ===
                               "/reset-password"` monte
                               `ResetPasswordScreen` sans session — seul
                               point d'entrée public de toute l'app en
                               dehors de l'écran de connexion. Pas de
                               routeur dans ce projet : ce test manuel sur
                               `window.location` est LE mécanisme de
                               routing, à réutiliser pour toute future
                               page publique plutôt que d'introduire un
                               routeur.
  types.ts                     `StudentStatusTag` **entièrement remplacé**
                               cette période (voir §5 point 8) — plus
                               aucune trace de l'ancien statut dans le
                               type, mais des fiches existantes en base
                               en portent encore la valeur (voir §0,
                               bug confirmé). Nouveaux types
                               `StudentInitialDiagnostic`,
                               `RECURRING_MISTAKES`/`RecurringMistake`.
                               `TradingPlanData` (localStorage, inchangé).
  hooks/useServerSync.ts        `useSyncedState` : état React synchronisé
                               au serveur, debounce 400ms.
  lib/
    api.ts                      client HTTP. 4 nouvelles fonctions cette
                               période : `setStudentPassword`,
                               `updateStudentEmail`,
                               `generateStudentResetLink`,
                               `consumePasswordReset`.
    performanceStats.ts          calculs purs de Rentabilité — seule
                               implémentation partagée, ne jamais la
                               dupliquer.
    walletStats.ts               `syncAccountsWithTrades` — écrase tout
                               ajustement manuel de solde dès qu'au moins
                               un trade est rattaché au compte.
  components/
    StudentTracking.tsx           Fiche élève **fortement enrichie** cette
                               période : nouveau statut (4 valeurs),
                               sections "Diagnostic initial &
                               historique" et "Erreurs récurrentes
                               identifiées" (création + édition), section
                               "Accès & connexion" (édition uniquement,
                               élève avec accès actif) — changer l'email
                               de connexion, fixer un mot de passe,
                               générer un lien de réinitialisation.
                               `STATUS_TAG_STYLES` est un
                               `Record<StudentStatusTag, string>` strict
                               — voir §0 pour le risque sur les anciennes
                               valeurs.
    auth/ResetPasswordScreen.tsx  **NOUVEAU** — écran public (aucune
                               session), atteint via
                               `/reset-password?token=…`. Consomme le
                               jeton via `api.consumePasswordReset`.
    MainDashboard.tsx              Bloc "Ta semaine" (données factices)
                               **retiré**. Carte "Score Examen" et tuile
                               "Examen" **retirées** (grille Modules à 3
                               colonnes). Cartes Modules restantes ont une
                               **lueur intérieure permanente**, colorée
                               par module — mécanisme : `glowColor` par
                               carte posé en style inline via `["--glow"
                               as string]: c.glowColor`, consommé par
                               `shadow-[inset_0_0_28px_-8px_var(--glow)]`
                               (classe Tailwind arbitraire unique, pas une
                               classe par couleur).
    Sidebar.tsx                    Entrées "Examen"/"Exercice du jour"
                               **retirées** de `ALL_TABS`/
                               `SIDEBAR_TOGGLEABLE_KEYS`/
                               `SIDEBAR_ITEM_TABS`/`pratiqueItems`.
                               `tradingPlan` reste la seule entrée-modale
                               de la section Pratique.
    TradingPlanModal.tsx           **N'existe plus**, supprimé (c'était en
                               réalité la checklist "Exercice du jour",
                               retirée avec le module). Ne pas confondre
                               avec `TradingPlanEditorModal.tsx`, qui
                               existe toujours et n'a pas changé (le vrai
                               plan de trading, module Pratique).
    LegalNoticeModal.tsx           **NOUVEAU** (session antérieure à
                               celle-ci mais après le dernier HANDOFF) —
                               mentions légales, 10 sections, ouverte
                               depuis une barre de pied persistante dans
                               les deux bureaux.
    WalletManagement.tsx           "N° Compte" retiré de l'en-tête du
                               portefeuille sélectionné (le champ
                               `accountNumber` existe toujours dans le
                               type et le formulaire de création, seul
                               l'affichage dans l'en-tête a changé).
    SecurityLogModal.tsx           4 nouveaux types d'événement journalisés
                               (voir §5 point 10) avec labels/icônes.
```

### Le modèle d'authentification à deux mondes

`isAdmin` côté staff est fiable — `buildStaffProfile()`
(server/routes.ts) force `isAdmin: true` dans la réponse `/api/state`
pour toute session staff. `PUT /api/profile` reste 403 pour tout compte
élève — c'est pourquoi le plan de trading (`TradingPlanData`) reste en
localStorage (inchangé cette période).

Le nouveau système de gestion d'accès élève (§5 point 10, §6) **ne
contourne pas** cette règle : toutes les nouvelles routes qui modifient un
compte élève (`PUT .../password`, `PUT .../email`, `POST
.../reset-link`) sont des routes **staff**, protégées par
`requireStaffKind`. Seule la consommation finale du jeton (`POST
/auth/reset-password/:token`) est publique, et elle ne touche que
`student_accounts`/`student_password_reset_tokens` — jamais le profil
staff partagé.

### Schéma SQLite (18 tables)

17 tables inchangées + `student_password_reset_tokens` (nouvelle cette
période, voir §5 point 10 pour le schéma exact).

---

## 4. Le module Calculateurs (référence design "MacroPulse")

Inchangé cette période — voir le détail complet dans l'historique git de
ce document (`git log -p -- HANDOFF.md`) si besoin. Résumé : 3 panneaux
(Taille de position & risque, Risque/Rendement, Profit/Perte) dans
`PositionCalculatorModal.tsx`, ouvert via "Calculer Lot" dans le Journal,
reproduisant fidèlement une maquette externe "MacroPulse" partagée par
l'utilisateur — mêmes formules, mêmes libellés, vraies données PropDesk.

---

## 5. Fonctionnalités terminées cette période (chronologique)

*(Cette section couvre les 10 commits depuis le dernier HANDOFF documenté,
commit `6a1bcba`. Pour l'historique antérieur : voir `git log`.)*

1. **Retrait du bloc "Ta semaine"** (`b2f03ee`) — données factices (3
   tuiles codées en dur : "Exercice du jour terminé 5/5", "Examen à
   repasser 78/100", "Revue 1:1 avec Marc"), remplacé par une carte pleine
   largeur pour la courbe de progression. Prop `onOpenChecklist` morte
   retirée de `MainDashboard` et ses deux appelants.

2. **Suppression complète des modules Examen et Exercice du jour**
   (`0b01ae5`) — l'onglet Examen n'a jamais eu de contenu réel
   ("Contenu à venir" depuis le début) ; la checklist "Exercice du jour"
   (fichier `TradingPlanModal.tsx`, nom trompeur hérité du scaffold
   d'origine — voir §9) est retirée avec lui. Retiré partout : sidebar,
   `TabType`, tuiles du Tableau de bord, fil d'Ariane, état de modale dans
   les deux bureaux.

3-4. **Lueur des cartes Modules** (`4c5010f` puis `54c6dd0`) — d'abord au
   survol, puis rendue **permanente et vers l'intérieur** sur demande de
   suivi immédiate de l'utilisateur (« je ne veux pas que l'effet
   s'affiche quand je passe ma souris dessus, je veux qu'il soit
   permanent »). Mécanisme CSS custom property, voir §3.

5. **Retrait du "N° Compte"** (`d59aeb3`) de l'en-tête du portefeuille
   sélectionné dans `WalletManagement.tsx`, sur demande explicite.

6-7-8. **Coach Attribué : trois allers-retours** (`d2db3c9` → `190af60` →
   `eaeec26`) — retiré (contenait des noms fictifs : Thomas Laurent, Sarah
   Benali, Marc Dupuis) puis réintroduit sur demande de l'utilisateur, qui
   voulait pouvoir s'attribuer lui-même comme coach. Réintroduit alimenté
   par `api.listStaff()` (vrais comptes staff), pas des noms inventés.
   Dernier correctif : le sélecteur affichait le nom brut du compte
   (`th.gauthey99`) au lieu du nom complet du profil (`ForexPaps`) —
   corrigé en faisant primer `getProfile().name` pour le compte
   fondateur uniquement (les coachs invités n'ont pas ce problème, leur
   nom de compte est directement celui tapé à l'invitation).

9. **Mentions légales** (`b20586e`) — nouvelle modale `LegalNoticeModal.tsx`
   (10 sections, texte fourni par l'utilisateur : éditeur, hébergement,
   RGPD, avertissement risques financiers, etc.), ouverte depuis une barre
   de pied persistante dans les deux bureaux. **Le SIRET est indiqué "en
   cours d'attribution"** tel que fourni par l'utilisateur — à mettre à
   jour dès réception, rien à automatiser côté code. Rappel légal transmis
   à l'utilisateur en même temps : ne pas facturer/encaisser avant d'avoir
   un SIRET valide.

10. **Refonte complète de la fiche élève** (`cdd72e9`, le plus gros
   commit de cette période, +1012/-18 sur 12 fichiers) :
    - **Nouveau statut** : `StudentStatusTag` remplacé entièrement par 4
      étapes réelles du compte (`Évaluation Étape 1`, `Évaluation Étape
      2`, `Compte Financé`, `Fonds Propres`) — **⚠️ voir §0, bug confirmé
      sur les fiches existantes avec l'ancien statut**.
    - **Diagnostic initial & historique** (création + édition) — Win Rate
      %, R/R moyen, Drawdown Max %, Trades/semaine, Capital tradé, Type de
      compte. Nouveau champ `EnrolledStudent.initialDiagnostic`, distinct
      du suivi en cours (`winRate`/`totalTrades`, jamais touchés).
    - **Erreurs récurrentes identifiées** (création + édition) —
      catalogue fermé de 8 points faibles cochables (`RECURRING_MISTAKES`
      dans `types.ts`). Nouveau champ `EnrolledStudent.recurringMistakes`.
    - **Accès & connexion** (édition uniquement, élève avec accès actif)
      — trois actions : changer l'email de connexion, fixer directement
      un mot de passe (déconnecte les sessions élève en cours), générer
      un **vrai lien de réinitialisation à jeton** (table SQL dédiée,
      hash SHA-256 du jeton, TTL 1h, usage unique garanti par transaction
      atomique, purge périodique automatique). Choix explicite de
      l'utilisateur — l'option la plus lourde des deux proposées (voir
      §8). Nouvelle page publique `/reset-password`
      (`ResetPasswordScreen.tsx`) où l'élève choisit lui-même son
      nouveau mot de passe, sans session requise. **Aucun envoi d'e-mail
      automatique** — le lien est copié/transmis à la main par le staff,
      documenté en commentaire dans le code (voir §2).
    - Testé de bout en bout dans cette session : génération de lien,
      consommation réussie, rejet d'un jeton déjà utilisé (message "Ce
      lien est invalide, déjà utilisé, ou expiré."), définition directe
      de mot de passe — tous confirmés via le journal de sécurité
      (`security_events`, 4 nouveaux types d'événement journalisés :
      `student_password_set_by_staff`, `student_email_changed`,
      `student_password_reset_link_created`,
      `student_password_reset_completed`).

---

## 6. Flux détaillé : réinitialisation de mot de passe élève

Utile pour toute future modification de ce système. Fichiers et fonctions
exacts à chaque étape :

1. **Staff clique "Générer un lien de réinitialisation"**
   (`StudentTracking.tsx`, section "Accès & connexion") →
   `api.generateStudentResetLink(enrolledStudentId)` (`src/lib/api.ts`).
2. **Serveur** : `POST /students/:id/reset-link` (`server/auth/routes.ts`)
   → `createPasswordResetToken(account.id)`
   (`server/auth/studentCredentials.ts`) génère 32 octets aléatoires,
   stocke le **hash SHA-256** en base (`student_password_reset_tokens`,
   TTL 1h), renvoie le jeton en clair **une seule fois**. La route
   construit le lien complet
   (`${req.protocol}://${req.get("host")}/reset-password?token=${token}`)
   et journalise `student_password_reset_link_created`.
3. **Pas d'envoi d'e-mail** — le staff copie le lien affiché dans l'UI et
   le transmet lui-même (SMS, WhatsApp, en personne).
4. **Élève clique le lien** → `/reset-password?token=…`. `src/App.tsx`
   (composant `App()`) détecte le pathname AVANT toute logique
   d'authentification, extrait le token du query string, monte
   `ResetPasswordScreen` sans session requise.
5. **Élève saisit son nouveau mot de passe** (≥10 caractères, confirmation
   identique) → `api.consumePasswordReset(token, password)`.
6. **Serveur** : `POST /auth/reset-password/:token`
   (`server/auth/studentRoutes.ts`, route PUBLIQUE, montée avant la
   barrière d'authentification) → `consumePasswordResetToken(token)`
   vérifie dans une **transaction atomique** que le jeton existe, n'est
   pas déjà utilisé, n'est pas expiré, puis le marque `used_at` — empêche
   toute réutilisation concurrente. Si valide : `setStudentPassword` hash
   et enregistre, `destroyAllStudentSessions` déconnecte toute session
   élève active, journalise `student_password_reset_completed`.
7. **Retour UI** : `ResetPasswordScreen` affiche le succès, l'élève clique
   "Aller à la connexion" (`window.location.href = "/"`) et se reconnecte
   normalement.

---

## 7. Bugs connus / limitations

### 🔴 Nouveau cette période, priorité immédiate

1. **Anciennes fiches élèves avec un `statusTag` obsolète, badge sans
   style.** Voir §0 pour le détail complet, la fiche concrète concernée
   (`stud-1787124306837`, "Sensei") et la décision à prendre avec
   l'utilisateur avant de corriger.

### 🟡 Connus, non corrigés (décisions produit ou priorité basse — hérités des sessions précédentes)

2. **Forum inaccessible depuis l'UI.** Décision produit inchangée.
3. **Rate limiter en mémoire, par processus.** Compromis accepté.
4. **Absence de flux de récupération de mot de passe STAFF** (distinct du
   nouveau flux élève de cette période, qui ne concerne que les comptes
   élève). Un coach qui perd son mot de passe n'a toujours aucun
   mécanisme self-service — seule la procédure de secours décrite dans le
   README (accès direct à la base) existe.
5. **`CoachSignals.tsx` : aucune UI pour qu'un coach crée un signal.**
6. **`NotificationModal.tsx` : statut "Push Server Live" factice.**
7. **`TradingPlanEditorModal.tsx`/`MindsetJournalModal.tsx` : persistance
   `localStorage` uniquement**, pas de synchronisation multi-appareils.
   Compromis assumé (voir §3, "Le modèle d'authentification à deux
   mondes").
8. **`MacroDashboard.tsx` : fil d'actualités statique.**
9. **`EquityCurveChart.tsx` : `ReferenceLine` "$11,500 · ATTEINT" codée en
   dur.**
10. **`UserProfileModal.tsx` : "NIVEAU 4" statique.**
11. **`package.json.name` reste `"react-example"`.**
12. **`.gitignore` : règle `data/` matche aussi `src/data/`** — voir §2.
13. **`syncAccountsWithTrades` écrase tout ajustement manuel dès qu'au
    moins un trade est rattaché au compte.** Compromis assumé.
14. **Le badge de rating des coachs (`Coach.rating`) est optionnel et
    absent pour tout coach dérivé d'un vrai profil** — voulu, pas de note
    fictive.

### ✅ Résolus cette période (retirés de la liste)

Bloc "Ta semaine" à données factices, modules Examen/Exercice du jour
(retirés entièrement plutôt que corrigés), N° Compte affiché inutilement,
absence de flux de réinitialisation de mot de passe **élève** (résolu par
un vrai système à jeton — le flux staff, point 4 ci-dessus, reste non
résolu), Coach Attribué avec noms fictifs.

### Piège opérationnel : `AdminStudentView.tsx` est un overlay

Scoper toute recherche DOM à
`document.querySelector('.fixed.inset-0.z-50...')`.

### Piège confirmé : backtick littéral dans un commentaire SQL de `server/db.ts`

Voir §3 — casse la compilation TypeScript avec une erreur peu claire.

---

## 8. Décisions techniques importantes

### Anciennes décisions (avant cette période — toujours valides)

Voir l'historique git de ce document pour le détail complet : plan de
trading en localStorage (§3), calculateur simplifié plutôt qu'enrichi,
`window.confirm()`/`prompt()` remplacés par des modales maison (défaut de
plateforme, pas un cas isolé), deux shells applicatifs avec état de modale
dupliqué par design, `SectionHeader` dupliqué à dessein dans chaque
fichier.

### Nouvelles décisions cette période

**Lien de réinitialisation "complet" plutôt qu'une version simplifiée** —
face au choix entre (a) réutiliser le mécanisme déjà en place (mot de
passe temporaire généré, affiché une fois, à copier) et (b) un vrai
système à jeton avec expiration et page publique dédiée, **l'utilisateur a
explicitement choisi l'option (b)**, la plus lourde. Implémenté avec les
protections attendues d'un tel système : hash du jeton (jamais stocké en
clair), TTL court (1h), usage unique garanti par transaction atomique,
purge périodique. Si une future demande similaire se présente (ex. reset
de mot de passe staff, point 4 §7), ce code (`studentCredentials.ts`,
fonctions `createPasswordResetToken`/`consumePasswordResetToken`) est le
patron à dupliquer/adapter plutôt qu'à réinventer.

**Coach Attribué reconstruit depuis les vrais comptes staff** —
après un retrait puis une réintroduction, la version finale n'affiche
jamais de nom inventé : la liste vient de `api.listStaff()`
(`GET /api/auth/staff`), qui reflète les vrais comptes de
`StaffAccountsModal`. Le nom du fondateur spécifiquement vient de
`getProfile().name` (son profil, modifiable) plutôt que du nom brut de
compte (figé au premier bootstrap) — cohérent avec `buildCoachesForStudent`
qui fait déjà ce choix côté élève.

**Remplacement sec du statut élève, sans migration de données** — décision
prise sans anticiper l'impact sur les fiches déjà existantes en base
(voir §0/§7 point 1). À garder en tête pour tout futur remplacement de
type similaire : proposer une migration ou au moins un filet de sécurité
d'affichage AVANT de livrer, ou signaler explicitement le risque à
l'utilisateur au moment de la demande plutôt qu'après coup.

**Mécanisme CSS `--glow` pour la lueur des cartes Modules** — variable CSS
custom property posée en style inline par carte
(`style={{ ["--glow"]: c.glowColor }}`), consommée par une classe
Tailwind arbitraire (`shadow-[inset_0_0_28px_-8px_var(--glow)]`). Évite de
générer une classe statique par couleur de module — pattern réutilisable
si d'autres cartes colorées par catégorie doivent porter un effet visuel
similaire.

---

## 9. ⚠️ Piège de nommage historique (résolu par suppression, mais à connaître)

`src/components/TradingPlanModal.tsx` — qui portait un nom trompeur
(c'était en réalité la checklist "Exercice du jour", sans rapport avec un
plan de trading) — **a été supprimé** dans cette période, avec tout le
module Examen/Exercice du jour (`0b01ae5`). Le risque de confusion qu'il
posait n'existe donc plus.

**`src/components/TradingPlanEditorModal.tsx` existe toujours** — c'est le
vrai plan de trading (module Pratique, sidebar), inchangé cette période,
persistance localStorage. Si tu recroises une référence à
"TradingPlanModal" dans un commentaire, un test, ou une conversation
antérieure à `0b01ae5`, sache qu'elle décrit un fichier qui n'existe plus.

---

## 10. Contexte de travail avec l'utilisateur

- Il **communique en français**, ton direct, tutoiement.
- Il travaille par **demandes courtes et itératives**, souvent en
  signalant un problème constaté en usage réel plutôt qu'en décrivant une
  solution.
- **Il partage souvent une référence visuelle externe** (capture d'écran
  d'une autre application, "MacroPulse") en demandant une reproduction
  fidèle du **style et des formules**, jamais des fonctionnalités
  hors-sujet ni de données inventées faute de champ correspondant.
- **Il sélectionne parfois des éléments UI directement dans le
  navigateur** (capture d'écran + inspecteur d'élément) pour désigner
  précisément ce qu'il veut modifier/retirer.
- **Il change parfois d'avis en cours de route, très vite** — le glow des
  cartes Modules a été demandé au survol puis corrigé en "permanent" dans
  le message suivant immédiatement. Le Coach Attribué a fait un
  aller-retour complet retrait/réintroduction en trois messages
  consécutifs. Ne pas s'accrocher à un choix antérieur si une nouvelle
  demande le remet en cause, et vérifier après coup que le résultat
  correspond exactement à la dernière formulation, pas à la précédente.
- **Sur un chantier significatif touchant la sécurité/l'authentification**
  (comme le système de reset token, `cdd72e9`), il a été possible et
  approprié de poser des questions de clarification à choix multiples
  avant de coder (`AskUserQuestion`) — il a choisi à chaque fois l'option
  la plus complète/robuste plutôt que la plus rapide à livrer. Pour un
  futur chantier de cette ampleur, ne pas hésiter à clarifier le
  périmètre avant d'écrire du code, plutôt que de deviner.
- Sur ce même chantier, il a aussi validé explicitement le passage en
  Plan Mode et le contenu du plan avant implémentation — un bon réflexe
  à reproduire pour tout chantier touchant l'authentification, une
  migration de données, ou plusieurs fichiers serveur à la fois.
- **Il refuse parfois une demande de permission élargie** (accès SSH à la
  base Railway) sans que ça bloque le reste du travail — respecter le
  refus, ne pas insister.
- **Toujours vérifier en conditions réelles.** Chaque correctif doit être
  vérifié visuellement dans le Browser pane avant d'être annoncé terminé
  — et pour les flux serveur (comme le reset token), vérifier aussi côté
  API/base de données directement (`javascript_tool` + `fetch`,
  `sqlite3`), pas seulement l'écran.
- **Sur les chantiers de grande ampleur touchant la sécurité**, il a
  explicitement voulu pousser vers Railway seulement après confirmation
  que tout était testé de bout en bout — poser la question avant de
  pousser un tel chantier n'est pas perçu comme un ralentissement inutile.
- Il **ne donne jamais ses mots de passe pour que tu les utilises** —
  règle absolue.
- Quand il demande une mise à jour du HANDOFF « suffisamment détaillée »,
  il attend fidélité complète à ce qui a changé, y compris les bugs
  fraîchement découverts en cours de rédaction (comme le point §0 de cette
  version) — pas seulement un résumé du fini.

### Méthode de vérification qui a fait ses preuves

1. `npm run lint` après chaque changement de code, même en cours de
   chantier multi-fichiers.
2. Redémarrer le serveur de dev après tout changement **serveur**.
3. Vérification visuelle dans le Browser pane avant d'annoncer un
   correctif terminé — `navigate()` plutôt qu'un raccourci clavier
   simulé. Si le screenshot semble ne pas refléter un clic, vérifier via
   `javascript_tool` (état DOM réel) avant de conclure à un bug.
4. Pour un flux serveur avec effets de bord (mot de passe, jeton, email) :
   vérifier aussi directement via `javascript_tool` + `fetch()` sur l'API,
   et via `sqlite3` sur la base, pas seulement l'écran — comme fait cette
   période pour confirmer les 4 nouveaux types d'événements de sécurité et
   tester le rejet d'un jeton de reset déjà consommé.
5. Pour un déploiement Railway : `railway deployment list --service
   propdesk --json` d'abord, UN SEUL `curl` espacé ensuite.
6. Pour une fonctionnalité ambiguë ou un chantier de grande ampleur :
   poser une question de clarification courte (`AskUserQuestion`) avant
   d'écrire du code — et pour un chantier touchant l'authentification/une
   migration de données/plusieurs fichiers serveur, envisager le Plan
   Mode complet avec validation explicite du plan par l'utilisateur.
7. Avant de pousser un chantier de grande ampleur (nouvelle table SQL,
   nouvelles routes d'auth), demander confirmation explicite même si
   l'utilisateur a déjà autorisé des push plus petits dans la même
   session — la taille et la sensibilité du changement justifient de
   revalider.
8. Nettoyage systématique des scripts ponctuels après usage — jamais
   laissés dans le dépôt.

---

## 11. Prochaines tâches, dans l'ordre

**1. Trancher le bug §0 en priorité absolue** — migration des anciennes
   fiches élèves (`statusTag` obsolète) ou filet de sécurité d'affichage.
   Ne pas deviner le mapping : demander à l'utilisateur.

**2. Aucune autre tâche explicite en attente** après le point 1 —
   redemander directement à l'utilisateur.

### Idées non demandées mais qui reviendraient probablement (ne pas anticiper sans demande)

- Un flux de réinitialisation de mot de passe équivalent pour les comptes
  **staff** (aujourd'hui seule la procédure de secours README existe) —
  le code de `cdd72e9` (jetons hachés, TTL, transaction atomique) est un
  bon patron à dupliquer si demandé.
- Un envoi d'e-mail automatique pour le lien de réinitialisation élève,
  si le staff trouve la transmission manuelle trop lourde à l'usage.

### Ce qui n'est PAS une tâche

- **Réintroduire de l'IA sous quelque forme que ce soit.**
- **Deviner et appliquer toi-même le mapping ancien statut → nouveau
  statut** sans validation de l'utilisateur (voir §0).
- **Ajouter un envoi d'e-mail automatique** au flux de reset sans demande
  explicite — assumé absent, documenté comme tel dans le code.
- **"Réparer" les limitations connues listées en §7** sans demande
  explicite.
- **Vérifier le déploiement Railway par des `curl` répétés.**
- **Unifier `TradingPlanEditorModal.tsx`** avec quoi que ce soit — c'est
  le seul composant "plan de trading" restant, plus de risque de
  confusion avec l'ancien `TradingPlanModal.tsx` (supprimé).

---

## 12. État à la reprise

- Branche `main`, dernier commit **poussé et déployé** `cdd72e9`.
  Répertoire de travail **propre**.
- `npm run lint` et `npm run build` passent sans erreur.
- Application déployée et fonctionnelle sur Railway
  (`propdesk-academie.up.railway.app`), déploiement automatique
  opérationnel, dernier déploiement confirmé `SUCCESS` sur `cdd72e9`.
- **Un seul point ouvert, non technique mais bloquant une décision** : le
  mapping ancien statut → nouveau statut pour les fiches élèves
  existantes (§0). Tout le reste est terminé et vérifié.

### Par où commencer

1. Lire intégralement §0 (le bug confirmé) et §9 (piège de nommage
   historique, résolu mais utile à connaître si une référence ancienne
   ressurgit).
2. `git status --short` et `sqlite3 data/horizon.db "select ... from
   enrolled_students"` pour confirmer l'état exact (peut avoir légèrement
   évolué si l'utilisateur a créé/modifié des fiches entre-temps).
3. Poser la question du mapping de statut à l'utilisateur avant toute
   correction — ne pas la deviner.

> Ce document est la **seule** source de reprise fiable. S'il existe un
> écart entre ce document et le code, **fais confiance au code** —
> vérifie par la lecture directe des fichiers sources et par
> `git status`/`git diff`/`sqlite3`, et corrige ce document en
> conséquence.
