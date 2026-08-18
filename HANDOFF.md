# HANDOFF — PropDesk (Académie de Trading)

Document de reprise. Il suppose que tu n'as accès ni à la conversation qui
l'a produit, ni à autre chose que ce dépôt. Lis-le en entier avant de
toucher au code — en particulier **§0** (où reprendre) et **§9** (piège de
nommage critique).

> **État à la dernière mise à jour de ce document**
> Branche `main`, dernier commit poussé : **`558a799`** (« Ajoute le module
> Plan de trading dans la section Pratique »), déployé avec succès sur
> Railway (`status: SUCCESS`, commit `558a799` confirmé via
> `railway deployment list --service propdesk --json`).
> **Répertoire de travail SALE** — 1 fichier modifié, non committé :
> `src/components/MainDashboard.tsx` (voir §0). `npm run lint` et
> `npm run build` passent tous les deux malgré cet état intermédiaire.
> Application déployée sur **Railway**, domaine
> `https://propdesk-academie.up.railway.app`.

---

## 0. Où reprendre EXACTEMENT

**Chantier interrompu, non committé** : `src/components/MainDashboard.tsx`
a été modifié mais jamais committé. Le changement (déjà appliqué dans le
fichier, `git diff` pour le voir en entier) :

- La section basse du Tableau de bord passait d'une grille 2/3 (Courbe de
  progression) + 1/3 (« Ta semaine ») à **une seule carte pleine largeur**
  pour la Courbe de progression.
- Le bloc entier **« Ta semaine » est supprimé** — il contenait 3 tuiles
  avec des données **codées en dur** (« Exercice du jour terminé — 5/5 »,
  « Examen à repasser — dernier score 78/100 », « Revue 1:1 avec Marc —
  Vendredi 17h »), listées comme bug connu #7 dans les versions
  précédentes de ce document. Ce nettoyage semble être **la correction de
  ce bug**, en cours.
- Import `ChevronRight` (lucide-react) retiré, devenu inutile après le
  retrait du bouton « Voir le programme complet » qui l'utilisait.
- **Effet de bord à vérifier** : la prop `onOpenChecklist` de
  `MainDashboard` (ligne ~66/77) est maintenant **déstructurée mais plus
  utilisée nulle part dans le composant** (l'ancienne tuile « Exercice du
  jour » qui l'appelait a disparu avec « Ta semaine »). `npm run lint`
  passe quand même (le projet n'a pas `noUnusedParameters` activé), mais
  cette prop est probablement à retirer de l'interface `MainDashboardProps`
  et de son appelant dans `App.tsx` (deux endroits, un par bureau) pour ne
  pas laisser du code mort silencieux.

**Pour reprendre immédiatement** :
1. `git diff src/components/MainDashboard.tsx` pour voir l'état exact.
2. Vérifier visuellement dans le Browser pane que le Tableau de bord
   s'affiche correctement sans « Ta semaine » (les deux bureaux : élève et
   staff, `MainDashboard` est un composant partagé).
3. Décider si `onOpenChecklist` doit être retiré de `MainDashboardProps`
   et de ses deux appelants dans `App.tsx`, ou laissé en l'état si un
   remplacement de « Ta semaine » est prévu qui le réutiliserait.
4. `npm run lint && npm run build`, puis committer et pousser (voir §7
   pour la méthode de vérification/déploiement qui a fait ses preuves).
5. **Aucune autre tâche explicite n'est en attente après ça** — redemander
   directement à l'utilisateur.

---

## 1. Le projet en bref

**PropDesk** est une plateforme d'académie de trading SMC (*Smart Money
Concepts*) destinée à un coach (le fondateur, compte admin) et à ses
élèves. Interface **entièrement en français**, ton direct, tutoiement.
Devise unique : **`$`**, jamais `€` (exception : le module Calculateurs,
voir §4, qui affiche `€/$` sur certains champs pour coller à une maquette
externe — ne pas généraliser cette exception ailleurs). **Aucune IA n'est
utilisée nulle part** — décision produit explicite et répétée plusieurs
fois, **ne jamais la réintroduire sans nouvelle demande explicite**.

C'est un **vrai projet full-stack** : React 19 + TypeScript + Vite côté
client, Express + `better-sqlite3` (SQLite, mode WAL) côté serveur, un
seul process Node sert les deux.

**Identité visuelle** : design system unifié sur **tout l'écosystème**
(chantier terminé, voir §5) autour du langage visuel de Macro/Rentabilité
— cartes plates à bordure fine (`#111615`/`#1B2320`), micro-labels `[9px]`
en majuscules espacées, en-têtes de section à barre verticale colorée
(`SectionHeader`, un composant local à chaque fichier, jamais partagé —
voir §8 pourquoi). Palette PropDesk (vert `#00E676`, fonds
`#0D1110`/`#111615`) inchangée.

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
- **Déploiement automatique sur push** fonctionne (le `DeploymentTrigger`
  a dû être créé manuellement via l'API GraphQL lors d'une session
  antérieure — voir §8 pour la commande exacte si un nouveau
  service/environnement Railway devait être recréé).
- Vérifié fonctionnel en fin de session courante :
  `railway deployment list --service propdesk --json` renvoie
  `status: SUCCESS` pour le commit `558a799` (le dernier poussé).
- **Vercel a été essayé puis abandonné** (session antérieure) — serverless
  incompatible avec Express + SQLite persistant. Ne pas y revenir sans
  réécriture lourde (backend serverless + DB managée).
- **Piège récurrent observé sur plusieurs sessions passées** : l'edge
  Railway ("railway-hikari") peut bloquer périodiquement TOUT le trafic
  avec des réponses `429 rate limited`, un mécanisme anti-abus indépendant
  de l'application, déclenché par des vérifications `curl` trop
  fréquentes/rapprochées. **Prévention** : ne jamais vérifier un
  déploiement par plusieurs `curl` rapprochés — utiliser
  `railway deployment list --service propdesk --json` (API, non affectée)
  pour confirmer le build, puis au plus UN `curl` espacé dans le temps
  pour confirmer que le site public répond.

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

**⚠️ Piège d'outil de prévisualisation confirmé** : un raccourci clavier
simulé (`cmd+R`) ne recharge pas toujours vraiment la page. Préférer
`navigate()` vers la même URL.

**⚠️ `window.confirm()`/`window.prompt()` natifs sont fiables NULLE PART
où ils sont encore utilisés** — deux causes distinctes confirmées :
1. Dans le Browser pane automatisé de dev : `confirm()` retourne
   silencieusement `false`, `prompt()` lève une exception.
2. **En production, sur iOS, quand le site est ouvert en mode application**
   (icône ajoutée à l'écran d'accueil) : `confirm()`/`prompt()` restent
   muets, aucune boîte de dialogue ne s'affiche — bug réel signalé par
   l'utilisateur en usage réel sur iPhone (bouton "Supprimer" un
   portefeuille qui ne faisait rien), corrigé dans `WalletManagement.tsx`
   par deux modales maison (voir §5). **Si tu retrouves un
   `window.confirm()`/`prompt()` ailleurs dans le code, remplace-le
   proactivement par une modale maison** plutôt que de le laisser — ce
   n'est pas un cas isolé, c'est un défaut de plateforme.

**⚠️ Faux messages d'erreur persistants dans la console du navigateur** —
`read_console_messages` peut afficher des erreurs `[vite] Failed to
reload ...` ou des `ReferenceError` qui datent d'un état de code ANTÉRIEUR
(avant un correctif), alors que la page rendue est parfaitement
fonctionnelle. Avant de conclure à un vrai bug, vérifier visuellement
(screenshot) que la page fonctionne réellement.

### Inspecter la base locale

```bash
sqlite3 data/horizon.db "select id, name, email from staff_accounts"
sqlite3 data/horizon.db "select json_extract(payload,'\$.isAdmin') from users where id='user-local'"
sqlite3 data/horizon.db "select id, json_extract(payload,'\$.name'), json_extract(payload,'\$.equity') from trading_accounts"
sqlite3 data/horizon.db "select id, json_extract(payload,'\$.unlocked'), json_extract(payload,'\$.description') from badges"
```

**⚠️ Piège confirmé, à connaître** : `users.payload.isAdmin` peut être
`0`/absent en base pour le compte fondateur SANS que ce soit un problème
réel à l'usage — le serveur force `isAdmin: true` dans la réponse
`/api/state` pour toute session staff (voir §6/§8), sans jamais réécrire
la valeur en base. Ne pas s'alarmer si une requête SQL directe montre `0`.

**Piège confirmé, non corrigé, faible priorité** : `.gitignore` contient
`data/` sans slash de tête, qui matche `src/data/` en plus du dossier
SQLite racine — `git add src/data/mockData.ts` (chemin exact) refuse et
demande `-f`. `git add -A`/`git add .` fonctionnent normalement.

**⚠️ Les données locales de test (comptes, trades) peuvent changer entre
deux sessions de vérification sans intervention explicite** — observé
cette session : un compte "test" à $102 963 a été remplacé par un compte
"SMT 10K" à $10 000 sans action délibérée de ma part entre deux
vérifications dans le Browser pane. Cause non investiguée (redémarrage du
serveur de dev qui a peut-être réinitialisé un seed ? re-saisie manuelle
de l'utilisateur en parallèle ?). **Ne jamais supposer que l'état des
données locales observé à un instant T est stable** — revérifier avec
`sqlite3` avant de bâtir un raisonnement dessus.

### Inspecter la base Railway (production)

Pas d'accès direct — pas de SSH (refusé explicitement par l'utilisateur
lors d'une session antérieure). Pour toute vérification, passer par l'API
HTTP du site déployé (`curl`, avec parcimonie — voir §1) ou par le
dashboard Railway (`railway open`, ou
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
                               nettoyage périodiques.
server/
  db.ts                        SQLite (better-sqlite3, WAL, foreign_keys
                               ON), 17 tables. `FOUNDER_COACH_ID`
                               (constante partagée avec src/types.ts,
                               dupliquée intentionnellement — voir §8).
  repositories.ts               accès bas niveau aux tables.
  routes.ts                     routes /api/* génériques.
                               `buildCoachesForStudent()` reconstruit le
                               coach affiché à l'élève depuis le vrai
                               profil fondateur. `buildStaffProfile()`
                               force `isAdmin: true` pour toute session
                               staff. `PUT /profile` (ligne ~404) est
                               **réservée au staff** — 403 si
                               `req.auth.kind === "student"` : le profil
                               élève n'existe pas en tant que tel côté
                               serveur (voir §5, pertinent pour
                               TradingPlanEditorModal).
  schemas.ts                    schémas Zod de validation des payloads.
  auth/routes.ts                authentification à deux mondes (staff /
                               élève), utilise `FOUNDER_COACH_ID`.
src/
  App.tsx                      porte d'auth à deux mondes. **Deux
                               "shells" distincts, chacun avec son propre
                               état de modales dupliqué** :
                               - `StudentAuthenticatedApp` (≈ligne 283) —
                                 bureau élève.
                               - `AuthenticatedApp` → rend `AcademyApp`
                                 (≈ligne 714/766) — bureau staff/fondateur.
                               Toute nouvelle modale globale doit être
                               branchée **dans les deux**, avec son propre
                               `useState` local à chaque shell (pattern
                               systématique dans ce fichier, pas une
                               dette technique à corriger — voir §8).
  types.ts                     `TradingPlanData` (nouveau, voir §5) avec
                               une note explicite sur le choix
                               localStorage. `FOUNDER_COACH_ID` côté
                               client (miroir de celle du serveur).
  data/mockData.ts              données d'amorçage (seed) — badges,
                               profil initial, etc.
  hooks/useServerSync.ts        `useSyncedState` : état React synchronisé
                               au serveur avec debounce 400ms + miroir
                               localStorage + reprise hors-ligne
                               (`markPending`). `useStudentBootstrap()`
                               charge l'état initial élève.
  lib/
    api.ts                      client HTTP (`api.saveProfile`,
                               `api.saveCollection`, etc.).
    performanceStats.ts          calculs purs de Rentabilité et du résumé
                               Journal — **seule implémentation
                               partagée**, ne jamais la dupliquer (un bug
                               de courbe d'équité dupliquée entre deux
                               fichiers est déjà arrivé). Voir §5 pour le
                               détail des 16 catégories de données
                               calculées, dont les nouveaux
                               `assetDetailData`/`bestWinStreak`/
                               `worstLossStreak`.
    walletStats.ts               `syncAccountsWithTrades` — écrase tout
                               ajustement manuel de solde dès qu'au moins
                               un trade est rattaché au compte (compromis
                               assumé, voir §6).
  components/
    PositionCalculatorModal.tsx  Calculateur de trading, **entièrement
                               refondu cette session** — voir §5.
    TradingPlanEditorModal.tsx   **NOUVEAU cette session** — le vrai
                               "Plan de trading" (règles personnelles).
                               ⚠️ Ne pas confondre avec le fichier suivant,
                               voir §9.
    TradingPlanModal.tsx          Nom **trompeur** : c'est en réalité la
                               checklist "Exercice du jour" / "Checklist
                               Pre-Market & Plan SMC" (7 critères
                               cochables), sans rapport avec le plan de
                               trading ci-dessus. Voir §9.
    PerformanceDashboard.tsx      Page Rentabilité, structure à jour :
                               ticker PnL, 8 StatCard, courbe de capital,
                               Performance mensuelle + Psychologie, "Où
                               es-tu le meilleur ?" (4 cartes : Session/
                               Jour/Sens/Marché), "Détail par Actif"
                               (nouveau tableau), Meilleure/Pire Série
                               (nouveau), Erreurs les plus fréquentes.
    WalletManagement.tsx          Deux modales maison
                               (`deleteConfirmAccount`,
                               `balanceEditAccount`) remplaçant
                               `window.confirm()`/`prompt()` — voir §5/§2.
    Sidebar.tsx                   Nouvelle entrée `tradingPlan` dans
                               `SIDEBAR_TOGGLEABLE_KEYS`/
                               `SIDEBAR_ITEM_TABS` (avec `id: null` — une
                               entrée-modale, pas un onglet) et dans
                               `pratiqueItems`. **`tradingPlan` n'est PAS
                               dans `ALL_TABS`/`TabType`** — normal, ce
                               n'est pas une page à onglet.
    StudentTracking.tsx,
    VideoAcademy.tsx,
    UserProfileModal.tsx          Harmonisation visuelle **terminée**
                               (commit `33516ac`) — SectionHeader,
                               micro-labels `[9px]`, cartes
                               `#111615`/`#1B2320` appliqués partout.
    MainDashboard.tsx             **Modifié, NON COMMITTÉ** — voir §0.
    ReplayModule.tsx              **N'existe plus**, module retiré
                               entièrement (session antérieure) — ne pas
                               y faire référence.
```

### Le modèle d'authentification à deux mondes

`isAdmin` côté staff est fiable — `buildStaffProfile()`
(server/routes.ts) force `isAdmin: true` dans la réponse `/api/state`
pour toute session staff, override jamais écrit en base. Le profil élève
(`buildStudentProfile()`) force symétriquement `isAdmin: false`.

**Important pour toute future fonctionnalité "profil élève"** : `PUT
/api/profile` répond 403 à toute requête d'un compte élève — il n'existe
structurellement pas de mécanisme serveur pour qu'un élève modifie son
propre profil aujourd'hui. C'est la raison directe du choix localStorage
pour `TradingPlanEditorModal` (voir §5) et pour `MindsetJournalModal`
(session antérieure). Si une vraie fonctionnalité élève-éditable
multi-appareils est demandée un jour, il faudra soit assouplir cette
route (avec un schéma Zod restreint aux seuls champs autorisés côté
élève), soit créer une collection serveur dédiée comme `trades`/
`accounts`/`modules`/`messages`/`badges`/`quizResults` (voir
`useStudentBootstrap`/`useSyncedState` pour le pattern à suivre).

### Schéma SQLite (17 tables)

Inchangé cette session, aucune migration ajoutée.

---

## 4. Le module Calculateurs (référence design "MacroPulse")

Plusieurs fonctionnalités de cette période ont été construites en
reproduisant fidèlement une **maquette externe** ("MacroPulse", une autre
application) que l'utilisateur a partagée par capture d'écran. La bonne
pratique déjà établie et reconfirmée : reproduire le **langage visuel et
les formules de calcul** avec les **vraies données de PropDesk**, ne
jamais copier des fonctionnalités hors-sujet ni inventer une métrique
sans donnée sous-jacente réelle.

`PositionCalculatorModal.tsx` (ouvert via "Calculer Lot" dans le Journal)
contient désormais **3 panneaux** (`CalcCard`), tous vérifiés champ par
champ contre la maquette :

1. **Taille de position & risque** — Capital, Risque %, Entrée, Stop-loss,
   Objectif → Taille (unités), ≈ Lots, Perte maximale, Profit potentiel,
   Ratio R:R. Formules : `riskAmount = capital * risk% / 100`,
   `units = riskAmount / |entry - stop|`, `lots = units / contract`
   (contract dérivé de la classe d'actif sélectionnée — Forex 100000,
   Indices 1, Crypto 1, Métaux 100 —, **plus de champ éditable**, retiré
   sur demande explicite), `potentialProfit = units * |target - entry|`,
   `RR = |target - entry| / |entry - stop|`.
2. **Risque / Rendement** — Entrée, Stop, Objectif (indépendants du
   panneau 1) → Sens (Achat/Vente déduit du signe target-entry), Risque %
   / Gain % (par rapport au prix d'entrée), Ratio R:R, % gagnants pour
   l'équilibre = `1 / (1 + RR) * 100`.
3. **Profit / Perte** — Entrée, Sortie, Taille (unités), Sens → Mouvement
   (delta prix + %), Profit/Perte = `(sortie - entrée) * unités *
   (long ? 1 : -1)`.

Le panneau **"Valeur du pip" a été retiré entièrement** sur demande
explicite (avec son champ "Contrat" associé). "Appliquer au Journal" reste
branché uniquement sur le panneau 1 (seul avec assez de contexte pour
préremplir un trade : paire, entrée, stop, objectif, lot, risque, R:R).

**Si l'utilisateur redemande un jour d'ajouter/modifier un panneau de ce
calculateur**, relire ce fichier avant toute chose — la structure
`CalcCard`/`FieldInput`/`ResultRow` (composants locaux en haut du fichier)
est pensée pour qu'ajouter un panneau soit trivial.

---

## 5. Fonctionnalités terminées cette période (chronologique)

*(Cette section couvre uniquement depuis le dernier HANDOFF documenté,
commit `c7b95fd`. Pour l'historique antérieur : voir §7 et `git log`.)*

1. **Harmonisation visuelle de tout l'écosystème — TERMINÉE**
   (`33516ac`). `StudentTracking.tsx` (2 derniers `<h4>` de la Vue
   Complète en lecture seule), `VideoAcademy.tsx` (SectionHeader sur les
   titres de module, micro-labels `[9px]`), `UserProfileModal.tsx`
   (onglet Badges : cartes reclassées `bg-[#111615]/rounded-xl`,
   SectionHeader sur le rang). Les 6 modules principaux + l'onglet
   Badges du Profil sont désormais tous alignés sur le style Macro/
   Rentabilité. **Le §0 des versions précédentes de ce document, qui
   présentait ce chantier comme "en cours", est obsolète — c'est fini.**

2. **Détail par Actif et Meilleure/Pire Série ajoutés à Rentabilité**
   (`bd5e72c`). Nouveau tableau exhaustif par actif (Trades, Win Rate,
   PnL Total, trié par PnL décroissant) et deux cartes de streak (plus
   longue série de wins/losses consécutifs). Nouveaux champs
   `assetDetailData`/`bestWinStreak`/`worstLossStreak` dans
   `performanceStats.ts`.

3. **3 cartes retirées de "Où es-tu le meilleur ?"** (`11b9f53`) — sur
   sélection directe de l'utilisateur dans le Browser pane (Heure, Actif,
   Setup retirés ; Session, Jour, Sens, Marché conservés). La dimension
   Actif reste couverte par le nouveau tableau "Détail par Actif" du
   point précédent.

4. **`window.confirm()`/`prompt()` remplacés par des modales maison sur
   Portefeuille** (`81c0bf9`) — corrige un bug réel signalé par
   l'utilisateur en usage sur iPhone (bouton "Supprimer" un portefeuille
   totalement inerte). Cause : ces API natives restent muettes en mode
   PWA iOS. Voir §2 pour la portée générale du piège.

5. **Calculateur de position refondu deux fois** (`4c76b84` puis
   `af4681b`) — d'abord reproduit fidèlement sur la maquette MacroPulse
   "Calculs" (4 panneaux), puis simplifié sur demande explicite (retrait
   du champ Contrat et du panneau Valeur du pip, 3 panneaux restants).
   Voir §4 pour le détail complet.

6. **Module "Plan de trading" ajouté à la section Pratique** (`558a799`)
   — nouvelle entrée sidebar, nouvelle modale `TradingPlanEditorModal.tsx`
   reproduisant une maquette MacroPulse "Plan" : sessions autorisées
   (pills Asie/Londres/New York), horaires, actifs suivis, setups
   autorisés, risque/trade %, nb trades/jour, perte max/jour %,
   conditions d'entrée/d'arrêt, règles d'or. Enregistrement automatique
   (debounce 500ms, indicateur "Enregistré" temporaire), **persisté en
   localStorage** (`horizon_trading_plan`) — voir §3 pour la raison
   (`PUT /api/profile` réservée au staff) et §9 pour le piège de nommage
   associé (fichier `TradingPlanModal.tsx` préexistant, sans rapport).

7. **(Non committé, en cours)** Nettoyage de `MainDashboard.tsx` — retrait
   du bloc "Ta semaine" à données codées en dur. Voir §0.

---

## 6. Bugs connus / limitations

### 🟡 Connus, non corrigés (décisions produit ou priorité basse — hérités des sessions précédentes)

1. **Forum inaccessible depuis l'UI.** Décision produit inchangée.
2. **Rate limiter en mémoire, par processus.** Compromis accepté.
3. **Absence de flux de récupération de mot de passe.** Discussion produit.
4. **`CoachSignals.tsx` : aucune UI pour qu'un coach crée un signal.**
5. **`NotificationModal.tsx` : statut "Push Server Live" factice.**
6. **`MindsetJournalModal.tsx` : persistance `localStorage` uniquement**
   — même compromis que `TradingPlanEditorModal.tsx` (point 8 ci-dessous),
   assumé pour les deux.
7. ~~**`MainDashboard.tsx` : sous-titre + bloc "Ta semaine" codés en
   dur.**~~ **En cours de correction, non committé — voir §0.**
8. **`MacroDashboard.tsx` : fil d'actualités statique.**
9. **`EquityCurveChart.tsx` : `ReferenceLine` "$11,500 · ATTEINT" codée en
   dur** — non demandée à corriger.
10. **`UserProfileModal.tsx` : "NIVEAU 4" statique.**
11. **`package.json.name` reste `"react-example"`.**
12. **`.gitignore` : règle `data/` matche aussi `src/data/`** — voir §2.
13. **`syncAccountsWithTrades` (src/lib/walletStats.ts) écrase tout
    ajustement manuel dès qu'au moins un trade est rattaché au compte.**
    Compromis assumé.
14. **Le badge de rating des coachs (`Coach.rating`) est optionnel et
    absent pour tout coach dérivé d'un vrai profil** — comportement
    voulu (pas de note fictive), ne pas "corriger" en ajoutant une note
    inventée.

### 🟠 Nouveau cette période, à surveiller

15. **`TradingPlanEditorModal.tsx` : persistance `localStorage`
    uniquement, pas de synchronisation multi-appareils/multi-onglets**
    (même compromis assumé que Mindset, voir point 6). Un futur
    changement de navigateur/appareil perd le plan de trading. Corriger
    demanderait une vraie route serveur dédiée (voir §3, "Le modèle
    d'authentification à deux mondes").
16. **`onOpenChecklist` probablement mort dans `MainDashboard.tsx`** —
    voir §0, à trancher en priorité à la reprise.
17. **Données locales de test instables entre deux vérifications** — voir
    §2, cause non investiguée, ne pas construire de raisonnement dessus
    sans revérifier `sqlite3`.
18. **Blocage anti-abus périodique de l'edge Railway (429
    `railway-hikari`)** — voir §1. Prévention : ne jamais vérifier un
    déploiement par plusieurs `curl` rapprochés.

### ✅ Résolus cette période (retirés de la liste)

Bouton "Supprimer" un portefeuille inerte sur iPhone (window.confirm
muet), chantier d'harmonisation visuelle (terminé), 3 dimensions en trop
dans "Où es-tu le meilleur ?", calculateur trop complexe (Contrat +
Valeur du pip retirés).

### Piège opérationnel : `AdminStudentView.tsx` est un overlay

Scoper toute recherche DOM à
`document.querySelector('.fixed.inset-0.z-50...')`.

### Piège confirmé : `git add <chemin exact>` sur `src/data/`

Voir §2 — `git add -f` nécessaire, `git add -A` fonctionne normalement.

---

## 7. Prochaines tâches, dans l'ordre

**1. Terminer le chantier interrompu (§0) — priorité immédiate absolue :**
   1. Vérifier visuellement `MainDashboard.tsx` sans "Ta semaine" (bureau
      élève ET bureau staff).
   2. Trancher le sort de `onOpenChecklist` (prop probablement morte).
   3. `npm run lint`, `npm run build`, commit, push, confirmation du
      déploiement Railway (méthode §1 — jamais de `curl` répétés).

**2. Une fois le chantier ci-dessus terminé**, aucune tâche explicite en
attente n'est connue — redemander directement à l'utilisateur.

### Idées non demandées mais qui reviendraient probablement (ne pas anticiper sans demande)

- Synchronisation serveur du plan de trading (actuellement localStorage
  seul, voir point 15 §6) si l'utilisateur signale une perte de données
  en changeant d'appareil.
- Un futur remplacement du bloc "Ta semaine" par du contenu réel plutôt
  que sa simple suppression — rien n'indique que ce soit prévu, ne pas
  ajouter de proposition non sollicitée.

### Ce qui n'est PAS une tâche

- **Réintroduire de l'IA sous quelque forme que ce soit.**
- **Retoucher le badge de rating des coachs** (absence volontaire).
- **"Réparer" les limitations connues listées en §6** sans demande
  explicite.
- **Vérifier le déploiement Railway par des `curl` répétés.**
- **Recréer le module Replay** sans demande explicite.
- **Réinitialiser les badges à un état "non débloqué"** sans demande
  explicite (les 9 sont débloqués avec des dates 2024, décision produit
  assumée d'une session antérieure).
- **Unifier `TradingPlanModal.tsx` et `TradingPlanEditorModal.tsx`** ou
  renommer l'un des deux sans demande explicite — ce sont deux
  fonctionnalités distinctes et intentionnellement séparées (checklist
  pre-market vs règles personnelles), voir §9. Le nom trompeur est un
  fait à connaître, pas un bug à corriger de son propre chef.

---

## 8. Décisions techniques importantes

### Le plan de trading est en localStorage, pas sur le profil serveur

`PUT /api/profile` (server/routes.ts, ligne ~404) répond 403 à toute
requête d'un compte élève — "le profil élève n'existe pas en tant que tel
dans ce chantier". Construire une vraie persistance serveur pour un champ
éditable par un élève demanderait soit d'assouplir cette route avec un
schéma Zod restreint, soit de créer une collection serveur dédiée (calquer
le pattern de `trades`/`accounts`/`modules` via `useSyncedState` +
`api.saveCollection`). Jugé hors périmètre de la demande initiale — le
choix explicite a été de suivre le précédent déjà posé par
`MindsetJournalModal.tsx` (même compromis, même limitation assumée).

### Le calculateur de position simplifié plutôt qu'enrichi

Deux itérations dans la même période : d'abord une reproduction complète
et fidèle d'une maquette externe (4 panneaux), puis un retrait ciblé sur
demande explicite (Contrat + Valeur du pip). **Pattern à retenir** :
quand l'utilisateur partage une maquette externe pour "s'en inspirer",
reproduire large d'abord peut être correct, mais rester prêt à simplifier
vite si l'utilisateur juge que certains panneaux sont superflus — ne pas
argumenter pour les garder.

### `window.confirm()`/`prompt()` : un défaut de plateforme, pas un cas isolé

Voir §2 pour le détail. Le correctif de `WalletManagement.tsx` a
remplacé les deux usages présents dans ce fichier précis, mais **d'autres
usages pourraient exister ailleurs dans le code** (non audité
systématiquement cette période — un `grep -rn "window.confirm\|window.prompt" src/`
est recommandé avant toute nouvelle session de travail sur ce sujet).

### Deux "shells" applicatifs, état de modale dupliqué par design

`StudentAuthenticatedApp` et `AcademyApp` (dans `App.tsx`) sont deux
composants distincts, chacun avec son propre `useState` pour chaque
modale globale (Mindset, Setup Analyzer, Checklist, Plan de trading,
etc.). Ce n'est **pas** une dette technique à factoriser sans qu'on te le
demande — c'est le pattern déjà en place pour toutes les modales
existantes, cohérent avec la séparation stricte élève/staff de
l'authentification. Toute nouvelle modale globale doit suivre ce même
pattern : un état dans chaque shell, une prop `onOpenX` passée à
`Sidebar`, un rendu de la modale dans chaque shell.

### `SectionHeader` : composant dupliqué à dessein dans chaque fichier

Chaque fichier qui a besoin d'un en-tête de section (barre colorée +
titre) redéfinit son propre composant local `SectionHeader`, plutôt que
d'en importer un partagé. Ce n'est pas un oubli — plusieurs itérations de
harmonisation visuelle ont montré que les signatures divergent légèrement
d'un fichier à l'autre (ex : `StudentTracking.tsx` utilise un `<span>`
pensé pour être inséré inline dans un `<h4>` existant, les autres fichiers
utilisent un `<div>` autonome). Ne pas "corriger" en extrayant un
composant partagé sans qu'on te le demande — ça casserait potentiellement
la mise en page de plusieurs fichiers à la fois pour un gain de DRY
marginal.

*(Pour les décisions antérieures à cette période — hébergement Railway,
migration depuis Vercel, retrait du module Replay, `writeCollectionForAuth()`,
`safeParsePayload()`, capital dérivé des portefeuilles jamais persisté,
extraction de logo par seuil de luminance — voir l'historique git de ce
document, `git log -p -- HANDOFF.md`, ou `git log --oneline` pour la liste
complète des commits antérieurs à `c7b95fd`.)*

---

## 9. ⚠️ Piège de nommage critique : deux fichiers "TradingPlan"

**`src/components/TradingPlanModal.tsx`** (préexistant, hérité du
scaffold d'origine du projet) **n'est PAS un plan de trading** — c'est la
**checklist "Exercice du jour"**, aussi titrée "Checklist Pre-Market &
Plan SMC" dans son propre en-tête. Elle contient 7 critères cochables
(biais H4/D1, sweep de liquidité, FVG, zone d'entrée OTE, filtre
annonces économiques, ratio R:R ≥ 1:2, taille de lot max 1%), une jauge de
conformité, et un verdict "FEU VERT" si les 7 sont validés. Elle est
ouverte depuis `onOpenChecklist`/`isChecklistOpen`, l'entrée sidebar
"Exercice du jour" (clé `checklist`).

**`src/components/TradingPlanEditorModal.tsx`** (nouveau, ajouté cette
période) **est le vrai plan de trading** — un formulaire de règles
personnelles (sessions autorisées, horaires, actifs suivis, setups,
risque par trade, conditions d'entrée/d'arrêt, règles d'or), enregistré
automatiquement en localStorage. Ouvert depuis
`onOpenTradingPlan`/`isTradingPlanOpen`, l'entrée sidebar "Plan de
trading" (clé `tradingPlan`).

Les deux sont importés et rendus côte à côte dans `App.tsx` (les deux
shells), avec des noms de variables volontairement distincts
(`isChecklistOpen` vs `isTradingPlanOpen`) pour limiter le risque de
confusion au moment du câblage — mais **le nom du premier fichier reste
trompeur**. Ne le renomme pas sans qu'on te le demande explicitement (ça
casserait un historique git propre pour un gain cosmétique), mais **ne
te fie jamais au nom de fichier seul** pour comprendre ce que fait
`TradingPlanModal.tsx` — relis toujours son contenu.

---

## 10. Contexte de travail avec l'utilisateur

- Il **communique en français**, ton direct, tutoiement.
- Il travaille par **demandes courtes et itératives**, souvent en
  signalant un problème constaté en usage réel plutôt qu'en décrivant une
  solution (ex : bouton Supprimer inerte sur iPhone, découvert en
  utilisant l'app, pas par un audit demandé).
- **Il partage souvent une référence visuelle externe** (capture d'écran
  d'une autre application, "MacroPulse") en demandant une reproduction
  fidèle du **style et des formules**, jamais des fonctionnalités
  hors-sujet (ex : IA) ni de données inventées faute de champ
  correspondant dans PropDesk.
- **Il sélectionne parfois des éléments UI directement dans le navigateur**
  (capture d'écran + inspecteur d'élément) pour désigner précisément ce
  qu'il veut modifier/retirer — traiter cette sélection comme une donnée
  précise, poser une question de clarification courte si le périmètre
  exact reste ambigu (ex : "ces 3 cartes uniquement, ou aussi le tableau
  qui fait doublon ?") plutôt que de deviner.
- **Il change parfois d'avis en cours de route** (badges : d'abord
  restaurés "honnêtes" puis tous débloqués ; calculateur : d'abord
  enrichi à 4 panneaux puis simplifié à 3 sur demande de suivi) — ne pas
  s'accrocher à un choix antérieur si une nouvelle demande le remet en
  cause.
- **Il refuse parfois une demande de permission élargie** (accès SSH à la
  base Railway) sans que ça bloque le reste du travail — respecter le
  refus, ne pas insister.
- **Toujours vérifier en conditions réelles.** Chaque correctif doit être
  vérifié visuellement dans le Browser pane avant d'être annoncé terminé.
- **Attention à la fréquence des vérifications sur l'environnement de
  production** — voir §1, espacer les contrôles, privilégier l'API
  Railway à des requêtes HTTP directes.
- Il **ne donne jamais ses mots de passe pour que tu les utilises** —
  règle absolue.
- Quand il demande une mise à jour du HANDOFF « suffisamment détaillée »,
  il attend fidélité complète à ce qui a changé, y compris les pièges de
  nommage et le travail non committé en cours — pas seulement un résumé
  du fini.

### Méthode de vérification qui a fait ses preuves

1. `npm run lint` après chaque changement de code, même en cours de
   chantier multi-fichiers.
2. Redémarrer le serveur de dev après tout changement **serveur**.
3. Vérification visuelle dans le Browser pane avant d'annoncer un
   correctif terminé — `navigate()` plutôt qu'un raccourci clavier
   simulé pour tout rechargement dont le résultat compte.
4. Pour un déploiement Railway : `railway deployment list --service
   propdesk --json` d'abord (fiable, jamais bloqué par l'edge), UN SEUL
   `curl` espacé dans le temps ensuite pour confirmer que le site public
   répond.
5. Pour une fonctionnalité ambiguë ou un chantier de grande ampleur :
   poser une question de clarification courte (`AskUserQuestion`) avant
   d'écrire du code, en particulier sur le périmètre exact d'une
   sélection UI ou d'une reproduction de maquette externe.
6. Pour tester un flux qui dépend de `window.confirm()`/`prompt()` dans
   le Browser pane automatisé : stubber temporairement via
   `javascript_tool` (`window.confirm = () => true`) — mais rappel : en
   production sur iOS PWA, ces API sont muettes, la vraie solution est
   toujours une modale maison (voir §2/§8), pas un stub.
7. Nettoyage systématique des scripts ponctuels après usage — jamais
   laissés dans le dépôt.

---

## 11. État à la reprise

- Branche `main`, dernier commit **poussé** `558a799`. **Répertoire de
  travail SALE** — 1 fichier modifié, non committé
  (`src/components/MainDashboard.tsx`, voir §0 pour le détail exact).
- `npm run lint` et `npm run build` passent tous les deux malgré l'état
  intermédiaire — sûr de reprendre le travail sans rien réparer d'abord.
- Application déployée et fonctionnelle sur Railway
  (`propdesk-academie.up.railway.app`), déploiement automatique
  opérationnel, dernier déploiement confirmé `SUCCESS` sur le commit
  `558a799`.
- **Un seul thread ouvert** : terminer le nettoyage de `MainDashboard.tsx`
  exactement comme décrit en §0, puis redemander à l'utilisateur s'il a
  une nouvelle tâche.

### Par où commencer

1. Lire intégralement §0 et §9 ci-dessus (l'un décrit où reprendre,
   l'autre un piège qu'un futur Claude pourrait heurter en touchant au
   module Pratique).
2. `git status --short` et `git diff` pour confirmer l'état exact du
   fichier en cours (peut avoir légèrement évolué si l'utilisateur a fait
   autre chose entre-temps — toujours vérifier avant de supposer).
3. Terminer `MainDashboard.tsx` (vérification visuelle + décision sur
   `onOpenChecklist`), puis commit + push (tâche unique du §7).

> Ce document est la **seule** source de reprise fiable. S'il existe un
> écart entre ce document et le code, **fais confiance au code** —
> vérifie par la lecture directe des fichiers sources et par
> `git status`/`git diff`, et corrige ce document en conséquence.
