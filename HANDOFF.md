# HANDOFF — PropDesk (Académie de Trading)

Document de reprise. Il suppose que tu n'as accès ni à la conversation qui
l'a produit, ni à autre chose que ce dépôt. Rédigé **au milieu d'un
chantier en cours**, sur demande explicite de l'utilisateur qui vient de
t'interrompre — la section §0 ci-dessous décrit exactement où reprendre,
lis-la en premier.

> **État à la dernière mise à jour de ce document**
> Branche `main`, dernier commit poussé : **`c7b95fd`** (« Sépare chaque
> dimension d'"Où es-tu le meilleur ?" en sa propre carte »), déployé avec
> succès sur Railway.
> **Répertoire de travail SALE** — 6 fichiers modifiés, non committés, un
> chantier d'harmonisation visuelle en cours (voir §0). `npm run lint` et
> `npm run build` passent tous les deux malgré l'état intermédiaire.
> Application déployée sur **Railway** (plus Vercel, abandonné — voir §8),
> domaine `https://propdesk-academie.up.railway.app`.

---

## 0. Chantier d'harmonisation visuelle : TERMINÉ

Les 6 modules principaux + l'onglet Badges du Profil sont désormais
harmonisés sur le style Macro/Rentabilité (cartes `#111615`/`#1B2320`,
micro-labels `[9px]`, `SectionHeader` à barre colorée). `StudentTracking.tsx`
(2 `<h4>` restants de la Vue Complète), `VideoAcademy.tsx` et
`UserProfileModal.tsx` (onglet Badges) ont été complétés à la reprise de
cette session. `npm run lint`/`npm run build` passent, vérification
visuelle faite dans le Browser pane (Tableau de bord, Messagerie Coach,
Suivi des Élèves, onglet Badges & Succès). Section conservée ci-dessous à
titre d'historique du chantier.

## 0 bis. Où reprendre EXACTEMENT — chantier interrompu en cours (historique, résolu)

**Tâche en cours** : harmoniser visuellement tous les modules de
l'écosystème sur le langage graphique de Macro (`MacroDashboard.tsx`) et
Rentabilité (`PerformanceDashboard.tsx`), à la demande explicite de
l'utilisateur (« je veux que tu reprennes le visuel du module macro et du
module rentabilité et que tu t'en serves pour tous les modules »). Un
plan a été validé en mode plan avant de commencer — voir
`/Users/forexpaps/.claude/plans/quelles-autres-h-bergeur-me-composed-ember.md`
pour le plan complet approuvé (nom de fichier trompeur, hérité d'une
question sans rapport posée plus tôt dans la session : c'est bien le plan
d'harmonisation visuelle).

**Périmètre confirmé avec l'utilisateur** (`AskUserQuestion`, réponses
"Recommandé" les deux fois) :
- Les **6 modules principaux** accessibles depuis la sidebar + l'onglet
  Badges du Profil.
- **Explicitement exclus** : le Forum (inaccessible actuellement) et les
  petites modales (calculateur de position, plan de trading, journal
  mental, notifications).

**Référence de design** (voir §8 pour le détail) : carte
`bg-[#111615] border border-[#1B2320] rounded-xl` ; micro-label
`text-[9px] uppercase tracking-wider text-slate-500 font-bold` ; en-tête
de section = barre verticale colorée + titre
(`<span className="w-1 h-4 rounded-full {accent}" /><h3 className="text-sm font-bold text-white">{titre}</h3>`,
extrait tel quel dans un composant `SectionHeader` local à chaque
fichier) ; valeur de stat `text-xl font-black font-mono {accent}`.

### Statut par fichier (liste de tâches déjà créée dans le tracker de tâches)

1. ✅ **`src/components/TradingJournal.tsx`** — terminé. Micro-labels
   unifiées (`[10px]`→`[9px]`, y compris dans la grille du modal détail
   qui utilisait un ordre de classes différent), valeurs de stat
   (`text-2xl`→`text-xl`), `SectionHeader` ajouté au-dessus de la rangée
   KPI (« Performance ») et du tableau (« Registre des Positions »).
2. ✅ **`src/components/WalletManagement.tsx`** — terminé. Bordures
   `#151D1A`→`#1B2320` unifiées, micro-labels/valeurs harmonisées,
   `SectionHeader` sur « Sélectionner un Compte » et « Règles de Risk &
   Drawdown Prop Firm ».
3. ✅ **`src/components/MainDashboard.tsx`** — terminé. Décorations
   `shadow-sm`/glow radial retirées des cartes (absentes de
   Macro/Rentabilité), `SectionHeader` sur « Modules », « Courbe de
   progression », « Ta semaine ». **`src/components/EquityCurveChart.tsx`**
   modifié en même temps : `CartesianGrid stroke="#1B2320"` ajouté (absent
   avant).
4. ✅ **`src/components/CoachMessaging.tsx`** — terminé. `SectionHeader`
   sur « Vos Coachs Référents », bordures `#151D1A`→`#1B2320`.
5. 🔶 **`src/components/StudentTracking.tsx`** — **EN COURS, C'EST ICI QU'IL
   FAUT REPRENDRE.** Déjà fait : composant `SectionHeader` local ajouté
   (ligne ~28, signature légèrement différente des autres fichiers — ici
   `<span>` pas `<div>`, pensé pour être inséré inline dans un `<h4>`
   existant sans casser sa mise en page), bordures `#151D1A`→`#1B2320`
   unifiées (3 occurrences). **Reste à faire** : appliquer `SectionHeader`
   aux deux `<h4 className="text-sm font-bold text-white flex items-center gap-2">`
   de la Vue Complète en lecture seule (dans la modale "READ ONLY PREVIEW",
   grep `text-sm font-bold text-white flex items-center gap-2` pour les
   retrouver — actuellement lignes ~778 et ~818) : « Portefeuilles &
   Comptes Attribués (...) » et « Historique Récent des Trades ». Ces deux
   `<h4>` ont une icône Lucide en tête ET un badge conditionnel en fin de
   ligne (`{selectedStudent.studentAccountId && (...)}`) — le remplacement
   doit préserver icône et badge, seul le libellé doit être enveloppé par
   `SectionHeader` (ou la barre colorée insérée juste avant l'icône).
   **Décision déjà prise et à ne pas remettre en cause** : les titres de
   *modales* (« Fiche Édition : {nom} », « Inscrire un Nouvel Élève »,
   « Accès élève créé ») ne reçoivent PAS le traitement `SectionHeader` —
   ce sont des titres de fenêtre, pas des en-têtes de section à
   l'intérieur d'une page, exactement comme le titre de
   `UserProfileModal.tsx` ou de la modale d'ajout de portefeuille dans
   `WalletManagement.tsx` n'ont pas été touchés non plus. Ne pas les
   convertir par souci de "cohérence excessive".
6. ⬜ **`src/components/VideoAcademy.tsx`** — **pas commencé.** Prévu :
   `SectionHeader` sur les titres de modules/sections ; micro-label de
   catégorie (`text-xs font-bold text-amber-400 uppercase tracking-wider`)
   et barre de progression (`text-[10px]`) à ramener sur le format
   `[9px]` canonique.
7. ⬜ **`src/components/UserProfileModal.tsx`, onglet Badges & Succès
   uniquement** — **pas commencé, le plus gros écart restant.** Reclasser
   `bg-[#0D1110]/rounded-2xl`→`bg-[#111615]/rounded-xl` sur la carte
   d'en-tête XP (~ligne 650) et sur les cartes de badges (une classe
   partagée à corriger une fois, appliquée à N badges) ; ajouter
   `SectionHeader`. **Ne toucher que l'onglet Badges** — l'onglet « Profil
   & Options » (formulaire d'édition) est hors périmètre.
8. ⬜ **Vérification finale + commit(s) + push** — une fois les 3 fichiers
   restants faits : `npm run lint`, `npm run build`, vérification visuelle
   de CHAQUE module dans le Browser pane (comparer au rendu déjà en place
   de Macro/Rentabilité), puis committer (un seul commit ou quelques
   commits thématiques — l'utilisateur n'a pas d'exigence particulière
   là-dessus cette fois) et pousser. Le déploiement Railway suit
   automatiquement le push (déclencheur déjà configuré, voir §8) — vérifier
   via `railway deployment list --service propdesk --json`, **sans
   marteler l'URL publique avec des `curl` répétés** (voir le piège documenté
   en §6, le blocage anti-abus de l'edge Railway a déjà été déclenché deux
   fois cette session par des vérifications trop fréquentes).

**Pour reprendre immédiatement** : lis le plan complet à
`/Users/forexpaps/.claude/plans/quelles-autres-h-bergeur-me-composed-ember.md`
(contexte + référence de design + détail fichier par fichier), termine
StudentTracking.tsx (point 5 ci-dessus), puis enchaîne sur VideoAcademy.tsx
et UserProfileModal.tsx dans l'ordre, puis la vérification finale (point 8).
Le tracker de tâches interne a déjà les 8 tâches créées avec le bon statut
(#1-4 completed, #5 in_progress, #6-8 pending) — pas besoin de le
reconstruire, juste continuer à le mettre à jour.

---

## 1. Le projet en bref

**PropDesk** est une plateforme d'académie de trading SMC (*Smart Money
Concepts*) destinée à un coach (le fondateur, compte admin) et à ses
élèves. Interface **entièrement en français**, ton direct, tutoiement.
Devise unique : **`$`**, jamais `€`. **Aucune IA n'est utilisée nulle
part** — décision produit explicite et répétée plusieurs fois cette
session (notamment en refusant implicitement de reproduire les
fonctionnalités "+ IA"/"Rapport hebdo IA" d'une maquette de référence
partagée par l'utilisateur), **ne jamais la réintroduire sans nouvelle
demande explicite**.

C'est un **vrai projet full-stack** : React 19 + TypeScript + Vite côté
client, Express + `better-sqlite3` (SQLite, mode WAL) côté serveur, un
seul process Node sert les deux.

**Identité visuelle** : design system unifié progressivement cette
session autour du langage visuel de Macro/Rentabilité — cartes plates à
bordure fine (`#111615`/`#1B2320`), micro-labels `[9px]` en majuscules
espacées, en-têtes de section à barre verticale colorée. Palette PropDesk
(vert `#00E676`, fonds `#0D1110`/`#111615`) inchangée. **Chantier
d'harmonisation en cours sur TOUT l'écosystème — voir §0, ne pas repartir
de zéro.**

### Qui l'utilise

Outil de travail d'un coach (« ForexPaps »/« Forex Paps » selon
l'environnement, `th.gauthey99@gmail.com`, compte fondateur) et de son
staff. Plusieurs comptes staff partagent le même bureau (mêmes trades,
fiches élèves, portefeuilles). Les élèves ont un second monde d'identité
séparé, chacun avec son propre bureau cloisonné. Seul « Suivi des
Élèves » reste réservé à un compte staff (`isAdmin`, désormais **toujours
vrai pour tout compte staff** — voir §6, un bug qui l'empêchait d'être
vrai a été corrigé cette session).

### Le projet est maintenant hébergé sur Railway (pas seulement GitHub)

**Changement majeur cette session** : l'utilisateur a publié le site sur
**Vercel** en premier — **ça ne fonctionne pas et ne fonctionnera jamais
sans réécriture lourde** (serverless, système de fichiers éphémère,
incompatible avec un serveur Express + SQLite persistant). Symptôme
observé : connexion automatique sur un faux compte de démo figé
("Alexandre Vance"), déconnexion impossible. Diagnostiqué et expliqué à
l'utilisateur, **abandonné au profit de Railway**.

**Railway** (`https://propdesk-academie.up.railway.app`, projet
"propdesk", dépôt GitHub `Forexpaps/propdesk` connecté) :
- Service configuré avec un **volume persistant** `/data` (500 Mo) monté
  sur `DATA_DIR=/data`, `NODE_ENV=production`.
- **Déploiement automatique sur push** — a nécessité un correctif
  manuel : `railway add --repo` seul ne crée PAS de déclencheur de
  déploiement automatique (bug/lacune du CLI), il a fallu créer le
  `DeploymentTrigger` manquant via l'API GraphQL de Railway (voir §8 pour
  la commande exacte). **Fonctionne maintenant correctement.**
- **Domaine changé en cours de session** : `propdesk-production-ab8b.up.railway.app`
  (généré au tout premier `railway domain`) a été abandonné pour
  `propdesk-academie.up.railway.app` (visible dans les captures d'écran
  de l'utilisateur — probablement renommé depuis le dashboard Railway).
  **Utiliser systématiquement `propdesk-academie.up.railway.app`
  désormais.**
- **Piège récurrent cette session** : l'edge Railway ("railway-hikari")
  bloque périodiquement TOUT le trafic vers l'app avec des réponses
  `429 rate limited`, un mécanisme anti-abus indépendant de l'application
  (les logs serveur restent sains, les métriques Railway ne montrent
  aucune erreur applicative). Déclenché au moins deux fois cette session,
  très probablement par des vérifications `curl` trop fréquentes/répétées
  de ma part. **Void §6 et §9 — ne JAMAIS vérifier le déploiement par des
  `curl` répétés, un seul contrôle après un délai raisonnable, en
  s'appuyant d'abord sur `railway deployment list --json` (API, pas
  affecté par ce blocage) avant de solliciter l'URL publique.**

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
| `npm run build` | `vite build` (client) + `esbuild server.ts` → `dist/server.cjs`, ~1.5-3s |
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

**⚠️ Piège d'outil de prévisualisation confirmé** : un raccourci clavier
simulé (`cmd+R`) ne recharge pas toujours vraiment la page. Préférer
`navigate()` vers la même URL.

**⚠️ `window.confirm()`/`window.prompt()` natifs ne fonctionnent pas dans
le Browser pane automatisé** — `confirm()` retourne silencieusement
`false`, `prompt()` lève une exception. Pour vérifier un flux qui en
dépend (ex: suppression d'un portefeuille), stubber temporairement via
`javascript_tool` (`window.confirm = () => true`) juste avant de cliquer.

**⚠️ Faux messages d'erreur persistants dans la console du navigateur** —
confirmé plusieurs fois cette session : `read_console_messages` peut
afficher des erreurs `[vite] Failed to reload ...` ou des
`ReferenceError` qui datent d'un état de code ANTÉRIEUR (avant un
correctif), alors que la page rendue est parfaitement fonctionnelle. Avant
de conclure à un vrai bug, vérifier visuellement (screenshot) que la page
fonctionne réellement — si oui, ce sont des entrées de journal obsolètes,
pas une erreur en cours.

### Inspecter la base locale

```bash
sqlite3 data/horizon.db "select id, name, email from staff_accounts"
sqlite3 data/horizon.db "select json_extract(payload,'\$.isAdmin') from users where id='user-local'"
sqlite3 data/horizon.db "select id, json_extract(payload,'\$.name'), json_extract(payload,'\$.initialBalance'), json_extract(payload,'\$.equity') from trading_accounts"
sqlite3 data/horizon.db "select id, json_extract(payload,'\$.unlocked'), json_extract(payload,'\$.description') from badges"
```

**⚠️ Piège confirmé et corrigé cette session, mais à connaître** :
`users.payload.isAdmin` peut être `0`/absent en base pour le compte
fondateur SANS que ce soit un problème réel à l'usage — le serveur force
désormais `isAdmin: true` dans la réponse `/api/state` pour toute session
staff (voir §6/§8), sans jamais réécrire la valeur en base. Ne pas
s'alarmer si une requête SQL directe montre `0` : c'est attendu, la valeur
qui compte est celle renvoyée par l'API, pas celle stockée.

**Piège confirmé, non corrigé, faible priorité** : `.gitignore` contient
`data/` sans slash de tête, qui matche `src/data/` en plus du dossier
SQLite racine — `git add src/data/mockData.ts` (chemin exact) refuse et
demande `-f`. `git add -A`/`git add .` fonctionnent normalement pour ce
fichier déjà suivi.

### Inspecter la base Railway (production)

Pas d'accès direct — pas de SSH utilisé cette session sur la base
Railway (une demande d'accès SSH a été explicitement refusée par
l'utilisateur pour une tâche annexe, voir §6). Pour toute vérification,
passer par l'API HTTP du site déployé (`curl`, avec parcimonie — voir
§1/§6) ou par le dashboard Railway (`railway open`, ou
https://railway.com/project/1ff27138-1722-451a-95c5-4719ffbae46a).

### Compte admin

`th.gauthey99@gmail.com` — mot de passe jamais consigné ici. **Ne jamais
le taper toi-même** dans un formulaire (voir §9, absolue et non
négociable), y compris pour se connecter à l'environnement Railway.

---

## 3. Architecture

### Vue d'ensemble

```
server.ts                     point d'entrée : Express + Vite/statique
                               + helmet + trust proxy (prod) + 4 tâches
                               de nettoyage périodiques.
                               La route statique dédiée /replay-fx a été
                               RETIRÉE cette session (module supprimé,
                               voir §4) — ne plus la chercher.
server/
  db.ts (+11 lignes)           SQLite (better-sqlite3, WAL, foreign_keys
                               ON), 17 tables. Nouveau cette session :
                               `FOUNDER_COACH_ID` (constante partagée,
                               voir §4 "Messagerie coach"), inchangé côté
                               schéma.
  repositories.ts               inchangé cette session.
  routes.ts (+62 lignes net)    routes /api/* génériques. Nouveau cette
                               session : `buildCoachesForStudent()`
                               (reconstruit le coach affiché à l'élève
                               depuis le vrai profil fondateur) et
                               `buildStaffProfile()` (force
                               `isAdmin: true` dans la réponse `/api/state`
                               pour toute session staff — voir §6/§8).
  schemas.ts                    inchangé cette session.
  auth/routes.ts (+15 lignes)   la route qui écrit la réponse du coach à
                               un élève utilise désormais
                               `FOUNDER_COACH_ID` (constante partagée)
                               au lieu d'une chaîne "coach-thomas" codée
                               en dur.
src/
  App.tsx (+58 lignes net)      porte d'auth à deux mondes. Cette
                               session : `founderCoaches` dérivé du
                               profil du fondateur (voir §4), plus de
                               prop `courseCompletionPercentage` passée à
                               `PerformanceDashboard` (retirée, plus
                               utilisée par ce composant après sa
                               refonte).
  types.ts (+12 lignes)         `Coach.rating` devenu optionnel (plus de
                               note fictive), constante
                               `FOUNDER_COACH_ID` côté client (miroir de
                               celle du serveur, dupliquée
                               intentionnellement — le client ne peut pas
                               importer du code serveur).
  data/mockData.ts (+158/-...)  `initialCoaches` supprimé (plus jamais
                               utilisé, les coachs sont désormais
                               toujours dérivés d'un vrai profil).
                               `initialTraderBadges` restauré avec les 9
                               définitions d'origine, MAIS
                               `unlocked: true` sur les 9 avec des dates
                               2024 (décision explicite du fondateur,
                               voir §4 — pas une régression vers les
                               données de démo). `initialStudentProfile`
                               porte désormais `isAdmin: true` par
                               défaut (voir §6).
  hooks/useServerSync.ts        `useStudentBootstrap()` expose désormais
                               `coaches` (voir §4).
  lib/
    api.ts (+8 lignes)          `ServerState.coaches?: Coach[]` ajouté.
    badges.ts (+110/-...)       calcul du badge "Prop Firm Challenge
                               Ready" (basé sur le module Replay,
                               supprimé) retiré — ce badge est
                               redevenu non calculable en direct
                               (`trackable: false`), son état
                               `unlocked` persisté n'est pas affecté.
    performanceStats.ts (+104)  refonte de `computePerformanceStats` :
                               nouveaux champs `profitFactor`, `avgRR`
                               (réutilisés de `computeJournalSummary`),
                               `drawdownMaxPercent`, `expectancyPerTrade`,
                               `avgWin`/`avgLoss`, `monthlyChartData`,
                               `hourChartData`, `marketChartData` — tous
                               dérivés des vrais trades, voir §4.
  components/
    ReplayModule.tsx             SUPPRIMÉ cette session (voir §4).
    PerformanceDashboard.tsx      **entièrement réécrit deux fois cette
                               session** : (1) refonte complète sur la
                               maquette "MacroPulse" partagée par
                               l'utilisateur — rangée de 8 stats, courbe
                               de capital, Performance mensuelle +
                               Psychologie, "Où es-tu le meilleur ?" ;
                               (2) le filtrage par pilules de "Où es-tu
                               le meilleur ?" a ensuite été remplacé par
                               7 cartes séparées affichées simultanément
                               (Session/Heure/Jour/Actif/Setup/Sens/
                               Marché), sur demande explicite de
                               l'utilisateur qui ne voulait plus avoir à
                               cliquer pour comparer. C'est CE fichier
                               (avec MacroDashboard.tsx) qui sert
                               maintenant de référence de style pour tout
                               le reste de l'écosystème — voir §0.
    TradingJournal.tsx,
    WalletManagement.tsx,
    MainDashboard.tsx,
    CoachMessaging.tsx            harmonisés visuellement sur le style
                               Macro/Rentabilité cette session — voir §0
                               pour le détail exact de ce qui a changé
                               dans chacun. **Non committés.**
    StudentTracking.tsx            harmonisation EN COURS, voir §0 —
                               **non committé, incomplet.**
    VideoAcademy.tsx,
    UserProfileModal.tsx           harmonisation PAS ENCORE COMMENCÉE —
                               voir §0.
    EquityCurveChart.tsx (+2)     `CartesianGrid` ajouté (absent avant),
                               pour cohérence avec les autres graphiques.
    auth/AuthShell.tsx (+9/-...)  logo `/logo-auth.jpg` → `/logo-auth.png`
                               (fond transparent, voir §4), classe
                               `rounded-2xl` retirée de l'`<img>` (plus
                               nécessaire, le fond est transparent).
    UserProfileModal.tsx,
    StaffAccountsModal.tsx,
    SecurityLogModal.tsx,
    StudentTracking.tsx           **correctif de layout distinct** (pas
                               le chantier d'harmonisation visuelle) :
                               les modales longues faisaient disparaître
                               leur en-tête au-delà d'une certaine
                               hauteur d'écran (bug de centrage Safari,
                               voir §4/§8). Corrigé en plafonnant la
                               carte (`max-h-[calc(100vh-4rem)]`) avec un
                               en-tête `sticky` et un corps qui défile
                               seul — **déjà committé** (`d5c6936`),
                               distinct du chantier en cours.
public/
  logo-auth.jpg                 SUPPRIMÉ, remplacé par logo-auth.png
                               (fond transparent, voir §4).
  logo-auth.png                 NOUVEAU — extrait par seuil de luminance
                               depuis l'ancien JPG (script Python/Pillow
                               ponctuel, pas conservé dans le dépôt).
replay-fx/                      SUPPRIMÉ ENTIÈREMENT cette session (9
                               fichiers, ~27 Mo) — voir §4. Ne plus y
                               faire référence nulle part.
```

### Le modèle d'authentification à deux mondes

Inchangé structurellement, mais **`isAdmin` côté staff est désormais
fiable** (voir §6) — `buildStaffProfile()` (server/routes.ts) force
`isAdmin: true` dans la réponse `/api/state` pour toute session staff,
override qui n'est jamais écrit en base (même principe que
`hiddenSidebarItems`/`badges` déjà documentés dans les versions
précédentes de ce fichier).

### Schéma SQLite (17 tables)

Inchangé cette session, aucune migration ajoutée.

---

## 4. Fonctionnalités terminées cette session (chronologique)

*(Sessions antérieures : voir `git log`. Cette section couvre uniquement
depuis le dernier HANDOFF, commit `c34a014`.)*

1. **Publication sur Vercel, diagnostic d'échec, migration vers Railway**
   — voir §1. Domaine Railway généré, volume persistant configuré,
   déclencheur de déploiement automatique créé manuellement (bug du CLI
   Railway, voir §8).

2. **Messagerie coach reconnectée à une vraie identité** — les élèves
   voyaient "Aucun coach disponible" (la liste de coachs de démo avait
   été vidée lors d'un nettoyage antérieur). `buildCoachesForStudent()`
   (server/routes.ts) reconstruit désormais le coach affiché depuis le
   vrai profil du fondateur (nom, avatar, rôle — jamais l'email). Le
   fondateur voit sa propre entrée dérivée directement de son profil en
   mémoire côté `AcademyApp`. `FOUNDER_COACH_ID` partagé (dupliqué
   volontairement client/serveur) entre la reconstruction du coach et la
   route qui écrit la réponse du staff à un élève.

3. **Catalogue des 9 badges restauré, puis tous débloqués sur demande
   explicite** — les badges avaient été vidés lors du même nettoyage.
   D'abord restaurés avec un état honnête (aucun débloqué, progression
   recalculée en direct). Puis, sur demande explicite ultérieure de
   l'utilisateur (« je veux que tu valides tous les badges et succès à
   partir de 2024 »), les 9 sont passés à `unlocked: true` avec des dates
   réparties sur 2024 — **décision produit assumée, pas une régression**.
   `unlocked`/`unlockedAt` ne sont jamais recalculés par
   `computeBadgeProgress`, seule la progression affichée des badges
   calculables l'est.

4. **Logo de connexion à fond transparent** — `logo-auth.jpg` portait un
   badge sombre en dur (carré aux coins arrondis) visible sur le fond de
   la page. Remplacé par un PNG à fond transparent, extrait par seuil de
   luminance (script Python/Pillow ponctuel : les pixels sombres
   [canevas ET badge, tous deux < seuil] deviennent transparents, le
   glyphe blanc/vert reste opaque).

5. **Module Replay retiré entièrement** — sur demande explicite, après un
   diagnostic de blocage persistant : le fichier `market-data.js` (25 Mo,
   sans cache HTTP au départ) déclenchait la protection anti-abus de
   l'edge Railway à chaque rechargement de l'onglet Replay, bloquant TOUT
   le site (pas seulement Replay). Un correctif de cache HTTP a d'abord
   été tenté (`Cache-Control` long sur `market-data.js`), puis
   l'utilisateur a finalement demandé le retrait complet du module.
   Supprimé : `replay-fx/` (dossier entier), `ReplayModule.tsx`, la route
   statique dédiée dans `server.ts`, toutes les références dans
   `App.tsx`/`Sidebar.tsx`/`MainDashboard.tsx`, le calcul du badge "Prop
   Firm Challenge Ready" (redevenu non calculable).

6. **Correctif d'affichage tronqué sur 4 modales** (`UserProfileModal.tsx`,
   `StaffAccountsModal.tsx`, `SecurityLogModal.tsx`,
   `StudentTracking.tsx` × 3 modales) — signalé par l'utilisateur sur son
   propre profil. Cause : `items-center` + `overflow-y-auto` sur le
   conteneur externe d'une modale, combiné à un enfant plus haut que
   l'écran, provoque un bug de centrage (confirmé sur Safari) où le haut
   du contenu devient inatteignable au lieu de défiler. Corrigé
   systématiquement : carte plafonnée à `max-h-[calc(100vh-4rem)]`, en-tête
   `sticky top-0`, corps dans un conteneur `flex-1 overflow-y-auto`
   séparé. **Bonus découvert en vérifiant "élèves" comme demandé** :
   `student.isAdmin` (champ du profil) n'était jamais explicitement à
   `true` pour un compte fondateur frais (regression du nettoyage de
   données antérieur), ce qui masquait "Suivi des Élèves" de la sidebar.
   Corrigé à la racine — voir §3/§6/§8.

7. **Refonte complète de Rentabilité sur une maquette externe
   ("MacroPulse")** — l'utilisateur a partagé une capture d'écran d'une
   autre application et demandé une reproduction esthétique fidèle.
   Nouvelle structure : rangée de 8 statistiques (Capital, P&L Net, Win
   Rate, Profit Factor, RR Moyen, Drawdown Max, Espérance/Trade,
   Gain/Perte Moy.), courbe de capital pleine largeur, Performance
   mensuelle + Psychologie en 2 colonnes, "Où es-tu le meilleur ?".
   Nouveaux calculs ajoutés à `performanceStats.ts` (voir §3), tous
   dérivés des vrais trades. Deux dimensions de la maquette de référence
   ("Type") ont été sciemment omises faute de champ `Trade` correspondant
   — pas de donnée inventée. Puis, sur demande explicite de suivi, le
   filtrage par pilules de "Où es-tu le meilleur ?" a été remplacé par 7
   cartes toujours visibles (plus besoin de cliquer pour comparer).

8. **Chantier en cours : harmonisation visuelle de tout l'écosystème sur
   ce même style** — voir §0 pour l'état exact et la suite à faire.

---

## 5. Historique des chantiers (résumé, ordre chronologique inverse)

| Commit | Résumé |
|---|---|
| `c7b95fd` | Sépare chaque dimension d'"Où es-tu le meilleur ?" en sa propre carte |
| `11550cc` | Refond Rentabilité sur la maquette MacroPulse partagée par l'utilisateur |
| `d5c6936` | Corrige l'affichage tronqué des modales profil/élèves/coachs (+ correctif isAdmin) |
| `a66f384` | Retire entièrement le module Replay (Replay FX) |
| `74c76bd` | Ajoute le cache HTTP sur les assets de Replay FX |
| `9e52120` | Logo de connexion à fond transparent |
| `53f28f4` | Débloque les 9 badges avec des dates de 2024 |
| `20e98e1` | Réactive le catalogue des 9 badges, avec un état honnête |
| `50f35da` | Vérifie le déclencheur de déploiement Railway nouvellement créé (commit vide, test) |
| `52694ff` | Affiche le fondateur comme coach dans la Messagerie élève |
| `c34a014` | Met à jour le HANDOFF.md après analyse complète du projet *(précédente version de ce document)* |
| `0c1523e` | Retire bun.lock, obsolète depuis le commit initial |
| `aac295f` | Vide les données de démo et lie le capital affiché aux portefeuilles réels |

*(Commits antérieurs à `aac295f` : voir `git log`, couverts par les
versions précédentes de ce document.)*

**Non committé actuellement** : le chantier d'harmonisation visuelle en
cours (§0) — 6 fichiers modifiés, `git status --short` pour la liste
exacte à tout moment.

---

## 6. Bugs connus / limitations

### 🟡 Connus, non corrigés (décisions produit ou priorité basse)

1. **Forum inaccessible depuis l'UI.** Décision produit inchangée.
2. **Rate limiter en mémoire, par processus.** Compromis accepté.
3. **Absence de flux de récupération de mot de passe.** Discussion produit.
4. **`CoachSignals.tsx` : aucune UI pour qu'un coach crée un signal.**
5. **`NotificationModal.tsx` : statut "Push Server Live" factice.**
6. **`MindsetJournalModal.tsx` : persistance `localStorage` uniquement.**
7. **`MainDashboard.tsx` : sous-titre + bloc "Ta semaine" codés en dur.**
8. **`MacroDashboard.tsx` : fil d'actualités statique.**
9. **`EquityCurveChart.tsx` : `ReferenceLine` "$11,500 · ATTEINT" codée en
   dur** — toujours présente, non demandée à corriger, laissée telle
   quelle même en touchant ce fichier cette session (ajout du
   `CartesianGrid` seulement).
10. **`UserProfileModal.tsx` : "NIVEAU 4" statique.**
11. **`package.json.name` reste `"react-example"`.**
12. **`.gitignore` : règle `data/` matche aussi `src/data/`** — voir §2.
13. **`syncAccountsWithTrades` (src/lib/walletStats.ts) écrase tout
    ajustement manuel dès qu'au moins un trade est rattaché au compte.**
    Compromis assumé, documenté en détail dans une version antérieure de
    ce fichier (voir historique git de HANDOFF.md si besoin du détail).
14. **Le badge de rating des coachs (`Coach.rating`) est optionnel et
    absent pour tout coach dérivé d'un vrai profil** — comportement
    voulu (pas de note fictive), juste noté pour éviter qu'un futur
    Claude ne le "corrige" en ajoutant une note inventée.

### 🟠 Nouveau cette session, actif et à surveiller

15. **Blocage anti-abus périodique de l'edge Railway (429
    `railway-hikari`)** — voir §1. Se déclenche visiblement en réponse à
    des requêtes HTTP répétées/rapprochées vers le domaine public
    (`curl` de vérification en boucle en étant la cause la plus probable
    identifiée cette session). Se résout de lui-même après un délai
    (observé : de quelques minutes à plus de 40 minutes selon les
    épisodes). **Prévention** : ne jamais vérifier un déploiement par
    plusieurs `curl` rapprochés — utiliser `railway deployment list
    --service propdesk --json` (API Railway, non affectée) pour confirmer
    le build, puis UN SEUL `curl` espacé dans le temps pour confirmer que
    le site répond.

### ✅ Résolus cette session (retirés de la liste)

Messagerie coach vide, badges vidés, logo avec badge sombre en dur,
module Replay causant des blocages edge, modales tronquées en hauteur
(Safari), `student.isAdmin` jamais vrai pour un compte fondateur frais,
déploiement Railway sans déclencheur automatique, vérification de
déploiement basée sur le mauvais mot-clé (`railway status` affiche
"Online", jamais "Deployed" — une boucle de vérification cherchait ce
second mot et restait bloquée indéfiniment, corrigé en basculant sur
`railway deployment list --json`).

### Piège opérationnel : `AdminStudentView.tsx` est un overlay

Inchangé — scoper toute recherche DOM à
`document.querySelector('.fixed.inset-0.z-50...')`.

### Piège rencontré et confirmé cette session : `git add <chemin exact>` sur `src/data/`

Voir §2 — `git add -f` nécessaire, `git add -A` fonctionne normalement.

---

## 6 bis. Ce qui ressemble à du code mort, mais ne l'est pas

*(Inchangé pour les entrées antérieures — voir historique git si besoin
du détail complet : `EnrolledStudent.accounts`, `ForumSection.tsx`,
`Trade.mistakes`, `TraderBadge.trackable`, `requireOwner`/`requireAdmin`,
`updateCollectionItem()`.)*

**Ajout cette session** : `FOUNDER_COACH_ID` existe en DEUX endroits
(`server/db.ts` et `src/types.ts`), volontairement dupliqué et jamais
partagé via un import — le client ne peut pas importer du code serveur
(Node/better-sqlite3) sans casser le bundle navigateur. Si l'un change,
l'autre DOIT changer avec lui, sans quoi le fil de messagerie élève↔coach
se désynchronise silencieusement.

**Ajout cette session** : `users.payload.isAdmin` peut légitimement valoir
`0`/absent en base pour le compte fondateur sans que ce soit un bug — voir
§2/§3/§8, la valeur qui fait foi est celle forcée par
`buildStaffProfile()` à la réponse API, jamais celle stockée telle quelle.

---

## 6 ter. Arbitrages déjà rendus

| Sujet | Décision |
|---|---|
| Hébergement | **Railway**, pas Vercel (incompatible avec l'architecture) |
| Domaine Railway | `propdesk-academie.up.railway.app` (pas `-production-ab8b`) |
| Module Replay | **Retiré entièrement**, source du blocage edge Railway |
| Badges | **Les 9 débloqués avec des dates 2024**, décision explicite du fondateur — ne pas repartir sur un état "vierge" sans redemande |
| Style visuel cible | Langage Macro/Rentabilité (cartes plates, micro-labels 9px, en-têtes à barre colorée) appliqué à **tout** l'écosystème, hors Forum et petites modales |
| "Où es-tu le meilleur ?" (Rentabilité) | 7 cartes toujours visibles, **pas** de filtre à pilules |
| Métriques "Type"/"Marché" de la maquette externe | "Marché" calculable (`Trade.marketCategory` existe) et implémenté ; "Type" omis, aucun champ correspondant |
| Accès SSH à la base Railway | **Refusé explicitement** par l'utilisateur pour l'instant (question posée pour les badges, pas encore nécessaire pour l'harmonisation visuelle qui ne touche que du code, pas des données) |
| Titres de modales vs en-têtes de section | Seuls les en-têtes de section À L'INTÉRIEUR d'une page/modale reçoivent `SectionHeader` ; le titre de la fenêtre elle-même n'est jamais converti (voir §0, point 5) |

---

## 7. Prochaines tâches, dans l'ordre

**1. Terminer le chantier interrompu (§0) — priorité immédiate absolue :**
   1. Finir `StudentTracking.tsx` (2 `<h4>` restants).
   2. `VideoAcademy.tsx`.
   3. `UserProfileModal.tsx`, onglet Badges uniquement.
   4. Vérification (`lint`, `build`, visuelle module par module), commit,
      push, confirmation du déploiement Railway (sans marteler l'URL).

**2. Une fois le chantier ci-dessus terminé**, aucune tâche explicite en
attente n'est connue — redemander directement à l'utilisateur.

### Ce qui n'est PAS une tâche

- **Réintroduire de l'IA sous quelque forme que ce soit.**
- **Retoucher le badge de rating des coachs** (absence volontaire).
- **"Réparer" les 9 limitations connues listées en §6** sans demande
  explicite (Forum, MindsetJournal, statut Push factice, etc.).
- **Convertir les titres de modales en `SectionHeader`** (voir §6ter).
- **Vérifier le déploiement Railway par des `curl` répétés** — voir §1/§6,
  ça a déjà causé deux blocages evités cette session.
- **Recréer le module Replay** sans demande explicite — retiré
  volontairement, cause identifiée d'un vrai incident de production.
- **Réinitialiser les badges à un état "non débloqué"** sans demande
  explicite — décision produit assumée (voir §6ter).

---

## 8. Décisions techniques importantes

### Railway : le déclencheur de déploiement automatique n'est pas créé par `railway add --repo`

Découverte cette session après plusieurs push restés sans effet sur le
site déployé (déploiement resté sur un ancien commit malgré `git push`
répétés). `railway add --repo`/`railway service source connect` relient
le SERVICE au dépôt (source), mais ne créent pas automatiquement l'objet
`DeploymentTrigger` qui écoute les push GitHub — un objet distinct de
l'API Railway. Créé manuellement via l'API GraphQL :

```bash
railway api 'mutation($input: DeploymentTriggerCreateInput!) { deploymentTriggerCreate(input: $input) { id branch repository provider } }' \
  --var 'input={"branch":"main","environmentId":"<ID>","projectId":"<ID>","provider":"github","repository":"Forexpaps/propdesk","serviceId":"<ID>"}'
```
Vérifié fonctionnel par un commit vide de test (`50f35da`) qui a bien
déclenché un build automatique. **Si un futur dépôt/service Railway est
créé pour ce projet (nouvel environnement, fork), refaire cette étape —
ne pas supposer que la connexion GitHub suffit.**

### `railway status` n'affiche jamais le mot "Deployed"

Piège opérationnel réel rencontré cette session : une boucle de
vérification attendait le mot-clé `"Deployed"` dans la sortie de
`railway status` pour savoir qu'un déploiement était terminé — ce mot
n'apparaît JAMAIS, le statut réel est `"Online"` (ou `"Building"`,
`"Failed"`, `"Crashed"`). La boucle restait donc bloquée indéfiniment
jusqu'à expiration, même quand le déploiement avait déjà réussi. Corrigé
en basculant sur `railway deployment list --service propdesk --json`, qui
renvoie un champ `status` fiable et interrogeable (`SUCCESS`, `FAILED`,
`BUILDING`).

### Le bug de centrage Safari sur une modale "overflow + items-center"

Documenté en détail dans le commit `d5c6936` et son message — pattern à
connaître pour toute NOUVELLE modale ajoutée à l'app : ne jamais utiliser
`fixed inset-0 ... flex items-center justify-center ... overflow-y-auto`
sur le conteneur externe SANS plafonner la hauteur de la carte interne
(`max-h-[calc(100vh-4rem)]`) et sans y ajouter son propre `overflow-y-auto`
interne avec un en-tête `sticky`. Sinon, un enfant plus haut que l'écran
fait disparaître son propre haut (titre, bouton fermer) hors de portée,
de façon irrécupérable au scroll sur certains navigateurs (confirmé sur
Safari).

### `student.isAdmin` doit être forcé côté serveur, jamais supposé stocké correctement

`buildStaffProfile()` (server/routes.ts) force `isAdmin: true` dans la
réponse `/api/state` pour toute session staff, quelle que soit la valeur
réellement stockée en base — miroir exact de `buildStudentProfile()` qui
force `isAdmin: false` côté élève. Raison : le profil par défaut
(`initialStudentProfile`, mockData.ts) n'a longtemps porté aucun champ
`isAdmin` du tout (undefined → falsy), et `Sidebar.tsx` décide d'afficher
"Suivi des Élèves" sur ce seul champ — un compte fondateur fraîchement
créé (site neuf, ou nouvel environnement comme Railway) se retrouvait donc
sans accès à ses propres élèves, silencieusement. **Toute future logique
qui a besoin de savoir "est-ce un compte staff" doit lire cette valeur
forcée par l'API, jamais relire le profil stocké directement.**

### Extraction d'un logo à fond transparent par seuil de luminance

Technique utilisée pour `logo-auth.png` (pas de Photoshop/ImageMagick
disponible, Pillow installé via `pip3 install Pillow numpy` à la volée) :
calculer la luminance de chaque pixel (`0.299R + 0.587G + 0.114B`),
construire un histogramme pour repérer la coupure naturelle entre "fond
sombre" et "glyphe clair", puis appliquer une rampe alpha
`clip((lum - low) / (high - low), 0, 1)` avec `low`/`high` calés juste
au-dessus du pixel le plus clair du fond à éliminer (mesuré précisément,
pas deviné). Fonctionne bien pour un visuel à deux tons nets (fond sombre
uniforme + glyphe clair), à réutiliser si un futur logo/asset a le même
besoin.

### La maquette externe ("MacroPulse") sert de référence de style, pas de source de vérité produit

Quand l'utilisateur partage une capture d'écran d'une autre application
en demandant une reproduction "esthétique", la bonne lecture est :
reproduire le langage visuel (cartes, couleurs, typographie, densité,
structure de mise en page) en le nourrissant des VRAIES données/fonctions
de PropDesk — jamais copier des fonctionnalités hors-sujet (l'app de
référence avait des boutons "+ IA", explicitement incompatibles avec la
règle "aucune IA" de ce projet) ni inventer des métriques dont PropDesk
n'a pas la donnée sous-jacente (voir "Type", omis faute de champ
`Trade` correspondant, plutôt que fabriqué).

*(Pour les décisions antérieures à cette session — Tailwind v4 vs gros
asset statique, `writeCollectionForAuth()`, `safeParsePayload()`,
capital dérivé des portefeuilles jamais persisté — voir l'historique git
de ce document, `git log -p -- HANDOFF.md`.)*

---

## 9. Contexte de travail avec l'utilisateur

- Il **communique en français**, ton direct, tutoiement.
- Il travaille par **demandes courtes et itératives**, souvent en
  signalant un problème constaté en usage réel plutôt qu'en décrivant une
  solution — confirmé encore cette session (messagerie coach vide,
  badges manquants, modale tronquée, module Replay cassé : tous
  découverts par lui en utilisant l'app, pas par un audit demandé).
- **Il peut interrompre un chantier en cours de production pour demander
  autre chose** (cette mise à jour du HANDOFF en est la preuve directe) —
  dans ce cas, documenter précisément l'état d'interruption (§0) est
  exactement ce qu'il attend, pas une reprise silencieuse ni un
  redémarrage à zéro.
- **Il partage parfois une référence visuelle externe** (capture d'écran
  d'une autre app) en demandant une reproduction fidèle — voir §8, la
  bonne pratique est de reproduire le LANGAGE VISUEL avec les vraies
  données du projet, jamais de copier des fonctionnalités hors-sujet ou
  d'inventer une donnée absente.
- **Il change parfois d'avis en cours de route** (badges : d'abord
  restaurés "honnêtes" puis tous débloqués sur demande explicite ;
  Rentabilité : filtres à pilules d'abord, puis cartes toujours visibles
  sur demande de suivi) — ne pas s'accrocher à un choix antérieur si une
  nouvelle demande le remet en cause, et ne pas re-proposer l'ancien
  comportement sans qu'il le redemande.
- **Il refuse parfois une demande de permission élargie** (accès SSH à la
  base Railway pour les badges) sans que ça bloque le reste du travail —
  respecter le refus, proposer une alternative de moindre portée si
  possible, ne pas insister.
- **Toujours vérifier en conditions réelles.** Chaque correctif de cette
  session a été vérifié visuellement dans le Browser pane avant d'être
  annoncé terminé, y compris en stubbant `window.confirm` quand
  nécessaire plutôt que de sauter la vérification.
- **Attention à la fréquence des vérifications sur l'environnement de
  production** — le blocage edge Railway (§1/§6) a été déclenché au moins
  deux fois cette session par des `curl` de vérification trop rapprochés.
  Espacer les contrôles, privilégier l'API Railway (non affectée par ce
  blocage) à des requêtes HTTP directes vers le site public.
- Il **ne donne jamais ses mots de passe pour que tu les utilises** —
  règle absolue, y compris pour l'environnement Railway.
- Quand il demande une mise à jour du HANDOFF « suffisamment détaillée »,
  il attend fidélité complète à ce qui a changé — **et, comme cette
  fois, une description exacte du point d'interruption si le travail est
  coupé en plein milieu**, pas seulement un résumé de ce qui est fini.

### Méthode de vérification qui a fait ses preuves

1. `npm run lint` après chaque changement de code, même en cours de
   chantier multi-fichiers.
2. Redémarrer le serveur de dev après tout changement **serveur**.
3. Vérification visuelle dans le Browser pane avant d'annoncer un
   correctif terminé — `navigate()` plutôt qu'un raccourci clavier
   simulé pour tout rechargement dont le résultat compte.
4. Pour un déploiement Railway : `railway deployment list --json`
   d'abord (fiable, jamais bloqué par l'edge), UN SEUL `curl` espacé dans
   le temps ensuite pour confirmer que le site public répond.
5. Pour une fonctionnalité ambiguë ou un chantier de grande ampleur :
   passer par le mode plan (`AskUserQuestion` pour lever les
   ambiguïtés de périmètre) avant d'écrire du code — a bien fonctionné
   pour le chantier d'harmonisation visuelle en cours (§0).
6. Nettoyage systématique des scripts ponctuels après usage (ex: script
   Python d'extraction du logo, scripts `_seed-*.ts` de peuplement de
   badges en base locale — jamais laissés dans le dépôt).

---

## 10. État à la reprise

- Branche `main`, dernier commit **poussé** `c7b95fd`. **Répertoire de
  travail SALE** — 6 fichiers modifiés, non committés (chantier
  d'harmonisation visuelle interrompu, voir §0 pour le détail exact).
- `npm run lint` et `npm run build` passent tous les deux malgré l'état
  intermédiaire — sûr de reprendre le travail sans rien réparer d'abord.
- Application déployée et fonctionnelle sur Railway
  (`propdesk-academie.up.railway.app`), déploiement automatique
  opérationnel. **Au moment de cette mise à jour, l'edge Railway est
  potentiellement encore en cooldown après les vérifications de cette
  session — ne pas re-tester immédiatement par curl, voir §1/§6.**
- Base locale (`data/horizon.db`) : 1 profil réel, 1 portefeuille "test"
  ($100 000 → $102 963), 1 trade réel, 9 badges tous débloqués (dates
  2024), 0 élève inscrit.
- **Un seul thread ouvert** : terminer le chantier d'harmonisation
  visuelle exactement comme décrit en §0, puis redemander à l'utilisateur
  s'il a une nouvelle tâche.

### Par où commencer

1. Lire intégralement §0 ci-dessus.
2. Lire le plan complet à
   `/Users/forexpaps/.claude/plans/quelles-autres-h-bergeur-me-composed-ember.md`.
3. `git status --short` et `git diff` pour confirmer l'état exact des 6
   fichiers en cours (peut avoir légèrement évolué si l'utilisateur a
   fait autre chose entre-temps — toujours vérifier avant de supposer).
4. Terminer `StudentTracking.tsx`, puis `VideoAcademy.tsx`, puis
   `UserProfileModal.tsx` (onglet Badges), puis la vérification finale +
   commit + push (tâche #8 du tracker).

> Ce document est la **seule** source de reprise fiable. S'il existe un
> écart entre ce document et le code, **fais confiance au code** —
> vérifie par la lecture directe des fichiers sources et par
> `git status`/`git diff`, et corrige ce document en conséquence.
