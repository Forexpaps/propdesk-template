# HANDOFF — PropDesk (Académie de Trading)

Document de reprise. Il suppose que tu n'as accès ni à la conversation qui
l'a produit, ni à autre chose que ce dépôt. Rédigé après une analyse
complète et fraîche du projet (arborescence, `git status`/`log`, lecture
directe de tous les modules) — pas une simple compilation de notes de
session.

> **État à la dernière mise à jour de ce document**
> Branche `main`, dernier commit : **`f24d53e`** (« Ajoute l'aperçu SL/TP
> en direct et le glisser-déposer sur le graphique du simulateur Prop
> Firm »), suite du chantier Simulateur de Challenge Prop Firm (`18ff5c4`)
> — voir §0 bis pour le détail complet.
> `npm run lint` et `npm run build` passent tous les deux.

---

## 0. Journal de sécurité + verrouillage de compte — COMMITTÉ

**Journal de sécurité + verrouillage de compte**, fonctionnellement complet
(DB + serveur + front), testé et **maintenant COMMITTÉ** en commit `0939553`.
14 fichiers (11 modifiés, 3 nouveaux):

```
 M server.ts
 M server/auth/middleware.ts
 M server/auth/routes.ts
 M server/auth/sessions.ts
 M server/auth/studentRoutes.ts
 M server/auth/studentSessions.ts
 M server/db.ts
 M server/schemas.ts
 M src/App.tsx
 M src/components/UserProfileModal.tsx
 M src/lib/api.ts
?? server/auth/loginLockout.ts
?? server/auth/securityEvents.ts
?? src/components/SecurityLogModal.tsx
```

**Ce que fait ce chantier** (demande explicite : « journal de sécurité pour
mon compte fondateur, administrateur uniquement, pour vérifier tous les
problèmes de sécurité de mon écosystème ») :

- Nouvelle table `security_events` (`server/db.ts`) : journal d'audit
  (connexions réussies/échouées, déconnexions, changements de mot de passe,
  invitations/révocations staff et élève, accès refusés), couvre les DEUX
  mondes d'identité (`account_kind`: `"staff" | "student"`), **purge
  automatique à 90 jours** (les IP sont des données personnelles — voir
  `purgeOldSecurityEvents`/`startSecurityEventCleanup` dans
  `server/auth/securityEvents.ts`). Pas de FK vers les comptes : un
  événement reste lisible même après révocation du compte concerné.
- Nouvelle table `login_lockouts` + module `server/auth/loginLockout.ts` :
  **verrouillage de compte après 5 échecs de connexion en 15 minutes,
  verrouillage de 15 minutes**, indexé sur l'email **brut normalisé** (pas
  sur "compte trouvé") pour ne jamais révéler qu'un compte existe — un
  email inconnu se verrouille exactement comme un email réel avec mauvais
  mot de passe. Distinct et complémentaire du rate-limit HTTP par IP
  existant (`server/middleware/rateLimit.ts`), qui reste inchangé.
- `server/auth/routes.ts` et `server/auth/studentRoutes.ts` : chaque route
  d'authentification (login, logout, changement de mot de passe, invitation/
  révocation staff, invitation/révocation accès élève) journalise
  désormais l'événement correspondant, avec IP (`req.ip`) et détail
  contextualisé.
- `server/auth/middleware.ts` : `requireOwner`/`requireStaffKind`/
  `requireStudentKind` journalisent un `access_denied` (critique) à chaque
  refus d'accès à une session authentifiée du mauvais rôle. `requireOwner`
  existait déjà dans le code mais n'avait **jamais** été monté comme garde
  de route avant ce chantier — première utilisation réelle.
- Nouvelle route `GET /api/auth/security-events` (staffRouter, gardée par
  `requireStaffKind` + `requireOwner`) : filtres (`severity`, `eventType`,
  `limit`, `offset`), agrégats des 4 dernières 24h.
- `src/components/SecurityLogModal.tsx` (nouveau) : modale (gabarit
  `StaffAccountsModal.tsx`) avec 4 cartes de stats, 2 filtres, tableau
  d'événements avec badges colorés, pagination "Charger plus", note RGPD.
  Bouton d'ouverture dans `UserProfileModal.tsx`, conditionné par
  `isOwner` (pas `isAdmin`) — invisible pour tout compte staff non-fondateur.

**Vérifié en conditions réelles** : 5 tentatives de connexion avec mauvais
mot de passe → 5× `login_failed` en base + `account_locked` sur la 5ᵉ ; 6ᵉ
tentative → bloquée immédiatement (403 `ACCOUNT_LOCKED`), sans même
comparer le mot de passe, `login_blocked` journalisé ; IP correctement
capturée ; route protégée (401 sans session). Le verrouillage de test a
été nettoyé en base après vérification (`DELETE FROM login_lockouts WHERE
email_lower = 'th.gauthey99@gmail.com'`) — ne laisse aucun compte
verrouillé pour de vrai.

**Vérification visuelle** : le bouton "Journal de sécurité" doit apparaître
dans le profil (UserProfileModal, visible seulement pour `isOwner`), la
modale SecurityLogModal doit s'ouvrir et afficher les événements réels,
les filtres doivent déclencher un nouvel appel réseau. À tester une fois
connecté en session staff active dans le navigateur.

---

## 0 bis. Simulateur de challenge Prop Firm — COMMITTÉ (`18ff5c4`)

Refonte complète de ce qui était derrière le mot "Prop Firm" dans l'app,
sur demande explicite de l'utilisateur (captures d'écran d'une maquette
externe "PropSim" à reproduire fonctionnellement, avec le design system
existant : vert `#00E676`, thème sombre, pas les couleurs de la maquette).

**Ce qui a été retiré** (n'existe plus) :
- L'ancien "Simulateur Replay" (onglet PRATIQUE → "Replay") : ce n'était
  **pas** un vrai replay — juste un quiz de direction LONG/SHORT sur une
  **image statique Unsplash**, sans exécution d'ordre ni P&L. 3 scénarios
  fixes (EUR/USD, XAU/USD, NAS100) codés en dur dans `mockData.ts`.
- La modale "Prop Firm Rules" (menu OUTILS) : jauges de drawdown calculées
  à partir de 3 champs saisis **à la main** par l'utilisateur, aucune
  connexion aux vraies données. `src/components/PropFirmRulesModal.tsx`
  supprimé, avec tout son câblage (`App.tsx` x2 — staff et élève —,
  `Sidebar.tsx`).
- Le type `BacktestScenario` et `initialBacktestScenarios` (`types.ts`,
  `mockData.ts`) : devenus morts, retirés.

**Ce qui existe maintenant** — un vrai moteur de marché simulé et de
trading, dans `src/lib/propChallenge.ts` (logique pure, sans React) :
- **Génération de prix par marche aléatoire** (random walk), par actif —
  XAUUSD/EURUSD/GBPUSD/NAS100, chacun avec sa volatilité et sa valeur de
  pip (`PROP_SIM_ASSETS`). "Marché simulé" explicitement affiché à l'écran
  — aucune vraie donnée de marché, décision assumée (voir §7 pour le
  contexte de ce choix parmi les options posées).
- **Ouverture/clôture de position** avec détection réelle du SL/TP contre
  le high/low de chaque nouvelle bougie générée (`checkStopsAgainstCandle`),
  calcul du P&L flottant et réalisé.
- **Évaluation continue des règles** à chaque tick : perte journalière max,
  drawdown total (fixe ou trailing selon le réglage), objectif de profit en
  **2 phases** (les deux configurables), jours de trading minimum, "règle
  de régularité" (le meilleur trade ne doit pas dépasser X% des profits
  bruts — bloque la validation sans faire échouer le compte, comme chez un
  vrai prop firm).
- **4 presets** repris et adaptés de l'ancienne modale (FTMO Standard,
  FundedNext Stellar, Alpha Capital, Horizon Compte Réel), plus réglages
  avancés éditables (repliables, `<details>`).
- **Persistance locale uniquement** (`localStorage`, clé
  `horizon_propchallenge_state_v1`) : un challenge est une session de
  pratique jetable, **pas** synchronisé serveur — décision explicite (voir
  §7), cohérente avec le Journal de mindset qui fonctionne pareil.

**Composants** :
- `src/components/CandlestickChart.tsx` : rendu **SVG fait maison** du
  graphique en chandelier (aucune lib candlestick dans le projet — seul
  `recharts` est installé, pas adapté à l'OHLC). Lignes pointillées pour
  entrée/SL/TP quand une position est ouverte.
- `src/components/PropChallengeSimulator.tsx` : écran de configuration
  (capital/actif/règles/presets) → terminal de trading (barre solde/
  équité/P&L/phase/statut, 4 cartes de règles en direct, graphique +
  contrôles Tick Suivant/Lecture Rapide/Fin de Journée, panneau
  d'exécution avec calculateur de risque, historique des trades).
- `src/components/SMCSimulator.tsx` : **simplifié**, ne gère plus que le
  choix d'onglet interne (bascule `REPLAY`/`MONTE_CARLO` par boutons
  internes, plus de prop `initialMode` — un seul point d'entrée sidebar
  désormais, voir plus bas). Le Monte Carlo (déjà réel avant ce chantier)
  est **inchangé** dans sa logique, seulement renommé à l'écran
  « Simulateur Rentabilité PropFirm » (était « Simulateur Monte Carlo &
  Compounding », demande de suivi). L'onglet `REPLAY` rend désormais
  `<PropChallengeSimulator />`.

**Suivi demandé après coup, committé séparément** :
- Bouton "Simulateur Monte Carlo & Compounding" renommé en "Simulateur
  Rentabilité PropFirm" (commit `11f1118`).
- Entrée sidebar "Sim propfirm" (section PRATIQUE) **entièrement retirée**
  (commit `ceafafa`) — les 2 entrées ("Replay"/"Sim propfirm") pointaient
  vers le même composant avec juste une vue initiale différente ; la vue
  Monte Carlo reste accessible via l'onglet interne de "Replay", donc
  aucune fonctionnalité perdue. Nettoyage complet côté code (pas un simple
  masquage) : `propfirm` retiré de `ALL_TABS`/`SIDEBAR_ITEM_TABS`/
  `SIDEBAR_TOGGLEABLE_KEYS` (`Sidebar.tsx`), de la branche de rendu dédiée
  dans `App.tsx` (x2, staff + élève), du libellé dans `TopHeader.tsx`.
- **Aperçu SL/TP en direct + glisser-déposer sur le graphique** (commit
  `f24d53e`) : les lignes SL/TP s'affichent désormais dès qu'on saisit des
  pips dans le formulaire, **avant** d'ouvrir la position — `computeSlTpPrices()`
  (`propChallenge.ts`) est partagé entre l'aperçu et l'ouverture réelle,
  jamais deux calculs qui pourraient diverger. Un sélecteur "Sens de
  l'ordre" (Achat/Vente, ne trade rien tant qu'on ne valide pas) contrôle
  de quel côté du prix l'aperçu se place ; il a remplacé les deux boutons
  Achat/Vente auparavant seuls déclencheurs de la direction — désormais un
  seul bouton d'exécution contextuel en bas ("Ouvrir l'Achat"/"Ouvrir la
  Vente", coloré selon le sens choisi). Les lignes SL/TP du graphique
  (`CandlestickChart.tsx`) sont **glissables** à la souris/au doigt (Pointer
  Events + `setPointerCapture`, zone de clic élargie invisible par-dessus
  le trait visible) : glisser avant l'ouverture met à jour les champs pips
  (`pipsFromDraggedPrice()`, inverse de `computeSlTpPrices()`), glisser une
  fois la position ouverte modifie directement son SL/TP réel
  (`updateOpenPositionStops()`, nouvelle fonction du moteur).

**Simplifications assumées par rapport à la maquette de référence** (pas
reproduites, pour contenir la portée du chantier à la boucle fonctionnelle
essentielle) :
- Pas de navigation multi-pages façon app-dans-l'app (Analytique/Journal &
  historique/Paramètres/Centre d'aide séparés) : tout est sur un seul écran
  de trading, avec l'historique des trades affiché en ligne dans le
  terminal.
- Le toggle "Trading pendant les actualités" est stocké mais **purement
  informatif** — aucun calendrier économique n'est simulé, donc rien à
  appliquer dessus concrètement.

**Vérifié en conditions réelles** (session staff, `data/horizon.db`) :
configuration → démarrage → bougies qui défilent (Tick Suivant et Lecture
Rapide) → position BUY ouverte avec SL/TP visibles sur le graphique → TP
touché **automatiquement**, +$400 (cohérent avec le calculateur de risque
affiché avant l'ouverture) → solde et carte "Objectif Phase 1" mis à jour
en conséquence → jour de trading incrémenté après suffisamment de bougies
→ **persistance confirmée après rechargement complet de la page**
(`navigate`, pas juste un changement d'onglet React) → bouton
"Reconfigurer" ramène proprement à l'écran de configuration → Monte Carlo
toujours fonctionnel, aucune régression.

**Piège opérationnel rencontré pendant la vérification** : "Replay" (et,
à l'époque, "Sim propfirm") étaient déjà masqués dans la sidebar de
l'utilisateur avant ce chantier (réglage `hiddenSidebarItems` préexistant,
sans rapport avec ce travail). Il a fallu les réafficher temporairement
via le réglage de visibilité du fondateur pour tester, puis les remasquer
à l'identique après coup — ne pas s'étonner si "Replay" reste invisible
dans la sidebar par défaut, ce n'est pas un bug introduit par ce chantier.
Depuis le retrait de "Sim propfirm" (voir "Suivi" ci-dessus), la clé
`"propfirm"` peut subsister comme résidu inoffensif dans
`hiddenSidebarItems` en base pour d'anciens profils — elle ne correspond
plus à aucune entrée de `SIDEBAR_TOGGLEABLE_KEYS`, donc silencieusement
ignorée, pas la peine de la nettoyer en base.

---

## 1. Le projet en bref

**PropDesk** est une plateforme d'académie de trading SMC (*Smart Money
Concepts*) destinée à un coach (le fondateur, compte admin) et à ses
élèves. Interface **entièrement en français**, ton direct, tutoiement.
Devise unique : **`$`**, jamais `€`. **Aucune IA n'est utilisée nulle part**
(retirée intégralement lors d'une session antérieure à toute IA visible
dans ce document — décision produit explicite et répétée, **ne pas la
réintroduire sans nouvelle demande explicite** ; confirmé par grep
exhaustif sur tout `src/` et `server/`, aucune trace).

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

**Réellement dynamiques et fonctionnelles** :
- **Journal de trading** — saisie libre du PnL (`$` ou `%`, jamais calculé
  automatiquement), capture d'écran jointe, tag de 9 erreurs d'exécution
  prédéfinies, export CSV protégé contre l'injection de formule.
- **Suivi des comptes prop firm** (Portefeuille) — drawdown quotidien/total
  calculés en direct depuis les vrais trades rattachés, pas des valeurs
  figées. Fonctionnel côté élève aussi.
- **Rentabilité** — courbe d'équité, stats par stratégie/émotion/actif/
  direction/jour de la semaine/session de marché, « Erreurs les plus
  fréquentes » + coût total. Tous calculs partagés avec le Journal via
  `src/lib/performanceStats.ts` (source unique de vérité).
- **Macro** — cotations et calendrier économique **réellement en direct**
  (proxy Yahoo Finance / ForexFactory côté serveur, sans clé API, avec
  cache). Sentiment de risque = indicateur maison indicatif (VIX/DXY), pas
  une vraie mesure officielle — le composant le dit lui-même à l'écran.
- **Simulateur Monte Carlo** — calcul probabiliste réel, recalculé à
  chaque paramètre changé.
- **Simulateur de Challenge Prop Firm** (onglet "Replay") — marché simulé
  (random walk) réellement animé bougie par bougie, exécution d'ordres
  réelle avec détection SL/TP, règles de drawdown/objectif évaluées en
  continu. "Simulé" au sens où le prix n'est pas une vraie donnée de
  marché (affiché comme tel à l'écran), mais tout le reste — exécution,
  P&L, règles — est un vrai calcul, pas un scénario scripté. Voir §0 bis.
- **Modules vidéo** avec quiz réels (seuil 70%) et progression persistée
  serveur (survit à une reconnexion).
- **Système de badges** — 5 des 9 badges calculés en direct depuis les
  vraies données (`src/lib/badges.ts`), les 4 autres honnêtement affichés
  « pas encore disponible » plutôt que simulés.
- **Messagerie coach** bidirectionnelle, **centre d'alertes**, **espace
  admin de suivi des élèves** avec « Vue Complète » (lecture seule) et
  gestion réelle des accès de connexion (inviter/révoquer).
- **Outils déterministes** (aucune IA) : audit de setup à 6 critères
  pondérés, règles prop firm (4 presets réels), calculateur de position,
  checklist pré-trade, journal de mindset avec indice de tilt calculé.

**Partiellement statiques ou factices — à ne pas présenter comme
totalement fonctionnel sans le préciser** :
- **Modules vidéo** — toutes les leçons pointent vers **la même vidéo
  placeholder** (`w3schools.com/html/mov_bbb.mp4`, "Big Buck Bunny"),
  aucun vrai contenu de cours hébergé. Les boutons de téléchargement de
  ressources déclenchent un simple `alert()`.
- **Macro — fil d'actualités** — 5 titres codés en dur (`MARKET_NEWS`),
  jamais rafraîchis, contrairement aux cotations/calendrier qui sont réels.
- **Centre de notifications** — pied de modale affiche en dur "Push
  Server: Connecté (Live)" et une version "v2.4.0" : texte statique,
  aucune vraie connexion websocket/push. Un bouton "Simuler alerte live"
  existe dans le composant mais n'est jamais câblé dans `App.tsx` — il
  n'apparaît donc jamais réellement dans l'app.
- **Centre de signaux coach** (`CoachSignals.tsx`) — affichage et import
  vers le journal fonctionnels, mais **aucune UI pour qu'un coach crée un
  nouveau signal** : `setSignals` existe mais n'est appelée nulle part.
- **Journal de mindset** — persistance en `localStorage` uniquement, pas
  synchronisé serveur (contrairement à quasiment tout le reste de l'app).
- **Forum** (`ForumSection.tsx`) — complet côté code (764 lignes, création
  de sujets, réponses, likes, modération) et câblé dans `App.tsx`, mais
  **aucune entrée de navigation n'y mène** (absent de `Sidebar.tsx`) —
  accessible seulement en manipulant `activeTab` directement. Bonus
  incohérence : `TopHeader.tsx` mappe encore `case "forum"` vers le
  libellé « Badges & paliers », signe d'un repurposing jamais nettoyé.

**Ordres de grandeur** (lignes de code, vérifié à l'instant) : `src/App.tsx`
1682, `TradingJournal.tsx` 1342, `mockData.ts` 1460, `StudentTracking.tsx`
901, `ForumSection.tsx` 764, `VideoAcademy.tsx` 756, `server/auth/routes.ts`
771, `UserProfileModal.tsx` 689, `WalletManagement.tsx` 675, `Sidebar.tsx`
599, `SMCSimulator.tsx` 488, `PerformanceDashboard.tsx` 501.

**État de la base** : `data/horizon.db` contient un mélange de données
réelles et de démonstration. Julien Moreau (`stud-1`) a un compte élève
actif de longue date, réellement utilisé (0 trade à ce jour). Les comptes
de test créés en cours de développement (Camille Dupont/`stud-2`, Lucas
Martin/`stud-3`) ont systématiquement été **révoqués après vérification**
— les fiches restent, sans compte de connexion actif.

---

## 2. Démarrage immédiat

```bash
npm install
```

**Aucune variable d'environnement requise** — `.env.example` liste `PORT`,
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
`horizon-dev`, ou `lsof -ti:3000 | xargs -r kill -9 && npm run dev`) — TSX
ne recharge pas à chaud les fichiers serveur. **Si un comportement
incohérent apparaît après un changement serveur** (ex. une erreur
`ReferenceError` sur du code qui n'existe plus), vérifie d'abord qu'il n'y
a pas deux processus sur le port 3000 (`lsof -ti:3000` doit renvoyer un
seul PID) — un ancien processus qui traîne peut servir un bundle obsolète.

### Inspecter la base

```bash
sqlite3 data/horizon.db "select id, name, email, must_change_password from staff_accounts"
sqlite3 data/horizon.db "select sa.user_id, es.id, json_extract(es.payload,'$.name') from student_accounts sa join enrolled_students es on es.id = sa.enrolled_student_id"
sqlite3 data/horizon.db "select user_id, json_extract(payload,'$.hiddenSidebarItems') from users where id='user-local'"
sqlite3 -json data/horizon.db "select created_at, event_type, severity, account_email, ip_address, detail from security_events order by created_at desc limit 20"
```

Sonder l'API sans session :

```bash
curl -s localhost:3000/api/health && curl -s localhost:3000/api/auth/me && curl -s localhost:3000/api/auth/student-me
```

Compte admin actuel (staff, fondateur) : `th.gauthey99@gmail.com`. Le mot
de passe n'est **jamais** consigné ici — demande-le à l'utilisateur si
besoin de te connecter en tant qu'admin. **Ne le tape jamais toi-même**
dans un formulaire ni dans une requête (voir §9, règle de sécurité
stricte) — demande-lui de se connecter lui-même et de te confirmer quand
c'est fait.

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

**⚠️ Règle stricte — mots de passe et navigateur automatisé.** Si tu
utilises l'outil de prévisualisation navigateur (Browser pane) : **tu ne
dois jamais taper un mot de passe dans un champ de formulaire**, même un
mot de passe de test généré par le système, même avec l'autorisation
explicite de l'utilisateur. Pour te connecter en tant que staff, demande à
l'utilisateur de le faire lui-même. Pour un compte de test créé via `curl`
(mot de passe jamais vu par un humain), l'authentification programmatique
reste légitime — la règle porte sur la saisie UI, pas sur l'appel API en
tant que tel. Un test de connexion **volontairement échoué** (mauvais mot
de passe, pour tester le verrouillage par exemple) est également légitime
en `curl` — ce n'est pas une vraie authentification.

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
server.ts                     point d'entrée : Express + Vite/statique + helmet
                               (CSP activée seulement en production) + trust proxy
                               (production uniquement) + démarrage de 4 tâches
                               de nettoyage périodique (sessions staff/élève,
                               événements de sécurité, verrous de connexion)
server/
  db.ts                       SQLite (better-sqlite3, WAL), schéma complet en
                               CREATE TABLE IF NOT EXISTS + migrations ponctuelles
  repositories.ts              SEUL module qui parle à SQLite pour les
                               collections génériques (trades, comptes, etc.).
                               replaceCollection() vérifie la PROPRIÉTÉ de
                               chaque id soumis avant l'UPSERT (correctif de
                               sécurité critique, voir §8)
  routes.ts                    routes /api/* génériques (état, collections,
                               profil), barrière requireAuth, filtrage élève,
                               STUDENT_ALLOWED_COLLECTIONS
  schemas.ts                   validation zod — payloads API, verrous défensifs
                               (chartUrl/avatar, initialBalance > 0, filtres
                               du journal de sécurité)
  seed.ts                      amorçage (déclenché côté client, POST
                               /state/seed) et import d'un état localStorage
  economicCalendar.ts          proxy + cache 10 min du flux public ForexFactory
  marketData.ts                proxy + cache 60s de Yahoo Finance (non-officiel)
  middleware/
    rateLimit.ts                fabrique de limiteur par IP, EN MÉMOIRE
                                 (compromis assumé, mono-instance)
  auth/
    password.ts                 hachage scrypt (node:crypto natif)
    sessions.ts                  jetons, cookie STAFF (pd_session, httpOnly),
                                  destroyAllSessions() renvoie désormais le
                                  nombre de sessions détruites (number)
    credentials.ts                accès à staff_accounts, normalizeEmail()
    routes.ts                     authRouter (public) + staffRouter (protégé) ;
                                  login/logout/change-password/invite staff/
                                  élève instrumentés pour le journal de
                                  sécurité + verrouillage de compte (non
                                  committé — voir §0) ; route GET
                                  /security-events (requireOwner)
    middleware.ts                 requireAuth (deux mondes), requireStaffKind,
                                  requireStudentKind, requireOwner (jamais
                                  monté comme garde de route avant ce
                                  chantier) — journalisent access_denied
    studentCredentials.ts         accès à student_accounts
    studentSessions.ts            jetons, cookie ÉLÈVE (pd_student_session),
                                  destroyAllStudentSessions() renvoie aussi
                                  désormais un number
    studentRoutes.ts               studentAuthRouter (public) +
                                  studentProtectedRouter — même
                                  instrumentation sécurité que routes.ts
    loginLockout.ts                NON COMMITTÉ — verrouillage de compte par
                                  (monde, email), distinct du rate-limit IP
    securityEvents.ts              NON COMMITTÉ — journal de sécurité,
                                  purge RGPD 90 jours
src/
  main.tsx                      point de montage React
  App.tsx                       porte d'auth à deux mondes (1682 lignes) :
                               AuthenticatedApp/AcademyApp (staff) +
                               StudentAuthenticatedApp (élève, réutilise
                               Sidebar+TopHeader)
  types.ts                      source de vérité des formes de données
  data/mockData.ts              jeu de données d'amorçage (curriculum,
                               fiches élèves démo, 9 badges, etc.)
  hooks/
    useServerSync.ts              useBootstrap (staff) + useStudentBootstrap
                                  (élève) + useSyncedState (avec
                                  onSyncError, markPending sur échec en ligne)
    useAuth.ts                    état d'auth à deux mondes ; si les deux
                                  cookies existent, le STAFF prime
    usePersistentState.ts         wrapper localStorage générique
  lib/
    api.ts                        client HTTP typé (336 lignes) — routes
                               staff ET élève ; inclut fetchSecurityLog
                               (non committé)
    format.ts                     formatCurrency() — $ uniquement
    badges.ts                     computeBadgeProgress(), computeDisciplineStreak()
    pendingChanges.ts              registre des modifications non synchronisées
                               (localStorage), reconnaît les clés staff ET
                               élève (horizon_student_*)
    performanceStats.ts            computePerformanceStats(), computeJournalSummary()
                               — calculs de Rentabilité/Journal, source
                               unique de vérité partagée entre composants
    walletStats.ts                 positionsDuCompte(), dailyLossPercent(),
                               totalDrawdownPercent() — calculs de portefeuille
    propChallenge.ts               moteur pur du simulateur de challenge Prop
                               Firm (génération de prix, exécution d'ordres,
                               règles) — voir §0 bis
    image.ts                       redimensionnement des avatars avant stockage
  components/
    Sidebar.tsx (599)             source de vérité des onglets, réglage de
                               visibilité admin
    TopHeader.tsx (192)            en-tête (session Forex live en UTC, capital,
                               cloche) — plus de bouton d'export PDF (retiré)
    AdminStudentView.tsx (303)    « Vue Complète » admin, lecture seule, overlay
                               qui laisse l'ancien TopHeader du staff dans le
                               DOM en arrière-plan (piège opérationnel, §6)
    MacroDashboard.tsx (373)      cotations + calendrier réels, actus statiques
    StudentTracking.tsx (901)     « Suivi des Élèves » — CRUD fiches, invite/
                               révoque un accès de connexion réel
    WalletManagement.tsx (675)    Portefeuille — drawdown calculé en direct
    PerformanceDashboard.tsx (501)  Rentabilité
    TradingJournal.tsx (1342)      Journal — CRUD trades, export CSV
    MainDashboard.tsx (403)        tableau de bord, courbe de progression
                               (EquityCurveChart.tsx séparé, lazy-loadé)
    UserProfileModal.tsx (689)     profil + badges + bouton Journal de
                               sécurité (réservé isOwner)
    SecurityLogModal.tsx (277)     modale du journal de sécurité
    StaffAccountsModal.tsx (260)   gestion des comptes staff (tous égaux)
    SyncErrorBanner.tsx (38)       bandeau discret sur échec de sauvegarde
    PendingChangesBanner.tsx       modifications hors ligne non envoyées
    ForumSection.tsx (764)         complet mais inaccessible depuis l'UI (§6)
    VideoAcademy.tsx (756)         curriculum, quiz réels, vidéos placeholder
    SMCSimulator.tsx               Monte Carlo réel ; Replay = PropChallengeSimulator
    PropChallengeSimulator.tsx     simulateur de challenge Prop Firm complet (§0 bis)
    CandlestickChart.tsx           rendu SVG du graphique en chandelier
    CoachMessaging.tsx (336)       messagerie bidirectionnelle, sans IA
    CoachSignals.tsx (217)         affichage + import ; création non câblée
    NotificationModal.tsx (246)    centre d'alertes, statut "Live" factice
    MindsetJournalModal.tsx (316)  non synchronisée serveur (comme le challenge Prop Firm)
    SetupAnalyzerModal.tsx, TradingPlanModal.tsx,
    PositionCalculatorModal.tsx    outils déterministes (aucune IA)
    auth/                          AuthShell, LoginScreen, SetupScreen,
                               ChangePasswordScreen
public/
  icon.png / logo-auth.jpg / logo.png
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
droits métier pour tous). `isOwner` est vrai pour le seul fondateur, dérivé
(pas stocké) : `staff_accounts.invited_by IS NULL`. Ne conditionne QUE des
fonctionnalités strictement réservées au fondateur — aujourd'hui le
réglage de visibilité de la sidebar (`canManageSidebar`) et, si le
chantier §0 est committé, le journal de sécurité.

**Si les deux cookies existent dans le même navigateur, le staff prime**
(`src/hooks/useAuth.ts`, `refresh()`) — impossible de voir la vue élève
dans le même navigateur sans d'abord se déconnecter du staff.

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
direct côté client, jamais stockée telle quelle (`src/lib/badges.ts`).

`GET /api/state` (session élève) renvoie un **profil reconstruit** depuis
la fiche `EnrolledStudent` correspondante, avec `hiddenSidebarItems`
**fusionné** entre `ALWAYS_HIDDEN_FOR_STUDENTS` et le réglage réel du
bureau staff.

### Schéma SQLite (état actuel, y compris le chantier non committé §0)

Tables staff : `staff_accounts`, `sessions`, `users` (une ligne partagée
`DEFAULT_USER_ID = "user-local"`), `trades`, `trading_accounts`,
`coach_signals`, `coach_messages`, `forum_topics`, `forum_replies`,
`notifications`, `enrolled_students`, `badges`, `modules`, `quiz_results`,
`meta`.

Tables élève : `student_accounts`, `student_sessions`, plus **une ligne
`users` dédiée par élève** (`student_accounts.user_id`), qui porte ses
propres `trades`/`trading_accounts`/`modules`/`coach_messages`/
`quiz_results`/`badges`.

Tables transverses (non committées, §0) : `security_events` (journal
d'audit, purge 90j), `login_lockouts` (état de verrouillage, clé primaire
`(kind, email_lower)`).

**⚠️ `id` est une clé primaire GLOBALE dans chaque table de collection**
(`trades.id`, `trading_accounts.id`, `modules.id`, `badges.id`...), **pas
composite avec `user_id`**. Toute opération qui copie des lignes d'un
bureau vers un autre **doit remapper les `id`**. Voir §8.

`server/repositories.ts` : `replaceCollection()` fait un **UPSERT** +
suppression des seules lignes disparues, ET vérifie que chaque `id` soumis
n'appartient pas déjà à un **autre** `user_id` avant d'écrire quoi que ce
soit (rejet 409 sinon, `CollectionOwnershipConflictError`).

---

## 4. Fonctionnalités terminées

*(Organisé par domaine, état actuel. Pour l'historique détaillé
chantier-par-chantier, voir `git log` — les messages de commit sont
volontairement détaillés dans ce dépôt.)*

### Sécurité — audit complet (2 tours), committé et vérifié

- 🔴 **IDOR critique corrigé** : `replaceCollection()` vérifie désormais la
  propriété de chaque `id` soumis avant tout UPSERT (rejet 409). Un id
  généré côté client (`Date.now()`, devinable) ne peut plus écraser la
  ligne d'un **autre** utilisateur.
- 🔴 **Verrouillage du réglage de visibilité sidebar corrigé** : une
  section entièrement masquée ne disparaît plus du DOM pour un visiteur
  avec droit de gestion (`canManage`).
- 🟠 Révocation de session élève (colonne SQL inexistante), headers de
  sécurité (`helmet`), `trust proxy` en production, capital initial
  négatif/nul — tous corrigés.
- 🟡 Injection de formule CSV dans l'export Journal (`csvCell()`) —
  corrigée.
- **Recensé, volontairement non corrigé** : forum inaccessible (décision
  produit), usurpation d'identité possible dans le forum (impact borné,
  forum inaccessible), `forum_replies` sans vérification de propriété
  (latent), `quizResultsSchema` non borné (mineur), absence de flux de
  récupération de mot de passe (discussion produit).

### Rate limiting — committé

`PUT /api/collections/:name` (60/15min), `/profile` et `/quiz-results`
(30/15min chacune), `POST /state/import` (10/15min), `POST /state/seed`
(5/15min). S'ajoute au rate-limit déjà en place sur les routes d'auth
(login, setup, invitations : 5-10/15min selon la route).

### Rentabilité enrichie + tag d'erreurs — committé

`Trade.mistakes?: TradeMistake[]` (9 erreurs prédéfinies), chips
multi-sélection dans le Journal, 5 sections de stats dans Rentabilité (par
actif/direction/jour/session/erreurs), les 6 émotions du Journal
s'affichent toujours dans « Impact Psychologique » (même à 0 trade).

### Badges en direct + notifications élève + bandeau de sync — committé

- `computeBadgeProgress(badges, trades, modules)` recalcule la progression
  de 5 des 9 badges depuis les vraies données, sans jamais toucher
  `unlocked`/`unlockedAt` (réclamation explicite, persistée telle quelle).
  Les badges d'un élève sont copiés à l'invitation avec des `id` remappés
  (`${account.userId}-badge-N`) — **sans ce remappage, le correctif IDOR
  rejetterait la copie dès le second élève inscrit**.
  `computeSingleBadgeProgress` reconnaît le badge par le **suffixe** de
  l'id (`canonicalBadgeId()`).
- Notifications élève dérivées à chaque rendu (messages coach non lus +
  badges nouvellement débloqués), bouton « Badges & Profil » câblé côté
  élève (Sidebar + TopHeader).
- `SyncErrorBanner` + `markPending()` appelé aussi sur échec **en ligne**
  (pas seulement hors ligne). **Bug réel trouvé et corrigé** :
  `pendingChanges.ts` ne reconnaissait pas les clés élève préfixées
  (`horizon_student_*`), et `StudentAuthenticatedApp` n'avait aucun
  mécanisme pour respecter ce registre au chargement — une modification
  échouée était réellement perdue au rechargement côté élève. Corrigé
  (clés ajoutées, helper `resolveStudentValue<T>()`), **vérifié en faisant
  échouer la protection une première fois pour de vrai** avant de
  confirmer le correctif (méthode à retenir, voir §8).

### Affichage des badges côté staff — committé

Le serveur retournait `badges: []` (array vide) au lieu de `undefined`
quand aucune donnée n'existait en base, empêchant le client de tomber sur
le fallback `mockData`. Résultat avant correctif : 0 badge affiché côté
staff. Corrigé : le serveur retourne `undefined` pour les collections
`badges`/`modules` vides.

### Courbe d'équité — committé

`MainDashboard.tsx` traitait tout résultat non-WIN comme une perte
(`tempCapital += trade.result === "WIN" ? pnl : -pnl`), faussant le cumul
pour BREAKEVEN et LOSS. Corrigé : `pnl` est ajouté tel quel pour WIN et
LOSS (le signe est déjà porté par la valeur saisie), BREAKEVEN/OPEN
n'affectent pas le capital cumulé.

### Export PDF personnel — ajouté PUIS entièrement retiré, committé

Le bouton "PDF Features" téléchargeait un catalogue marketing statique
obsolète (IA jamais retirée du texte, montants en `€`). Remplacé par un
export dynamique personnel (`jsPDF`), lui-même **entièrement retiré** peu
après sur demande explicite de l'utilisateur (voir §9 pour le contexte
exact de ce revirement). **Aucune trace de fonctionnalité PDF ne doit
subsister** : `jspdf`/`jspdf-autotable` désinstallés, `src/lib/pdfReport.ts`
supprimé, aucun bouton dans `TopHeader.tsx`. Les modules
`performanceStats.ts`/`walletStats.ts` créés pour ce chantier ont en
revanche été **conservés** : ils ne sont pas spécifiques au PDF, activement
consommés par l'UI (Rentabilité/Journal/Portefeuille).

### Journal de sécurité + verrouillage de compte — codé, testé, NON COMMITTÉ

Voir §0 pour le détail complet — c'est la priorité de reprise.

---

## 5. Fichiers créés ou modifiés récemment (COMMITTÉS en `0939553`)

Détail fonctionnel : voir §0. Liste technique des changements :

| Fichier | Nature du changement |
|---|---|
| `server/db.ts` | +2 tables (`security_events`, `login_lockouts`) + index |
| `server/auth/sessions.ts` | `destroyAllSessions` renvoie `number` (était `void`) |
| `server/auth/studentSessions.ts` | idem, `destroyAllStudentSessions` |
| `server/auth/loginLockout.ts` **(nouveau)** | verrouillage de compte, 111 lignes |
| `server/auth/securityEvents.ts` **(nouveau)** | journal de sécurité, 166 lignes |
| `server/schemas.ts` | `securityEventsQuerySchema` |
| `server/auth/middleware.ts` | `access_denied` journalisé dans les 3 gardes de rôle |
| `server/auth/routes.ts` | verrouillage + journalisation sur tout le cycle auth staff, route `GET /security-events` |
| `server/auth/studentRoutes.ts` | symétrique côté élève |
| `server.ts` | démarrage des 2 nouvelles tâches de nettoyage périodique |
| `src/lib/api.ts` | types `SecurityEvent*`, `fetchSecurityLog()` |
| `src/components/SecurityLogModal.tsx` **(nouveau)** | modale, 277 lignes |
| `src/components/UserProfileModal.tsx` | bouton "Journal de sécurité", prop `onOpenSecurityLog` |
| `src/App.tsx` | état `isSecurityLogOpen`, câblage conditionné `isOwner` |

Commit `0939553` inclut tous ces changements. Tous les commits jusqu'à
`0939553` inclus sont en place.

---

## 6. Bugs connus / limitations

### 🟡 Connus, non corrigés (décisions produit ou priorité basse)

1. **Forum inaccessible depuis l'UI.** Complet côté code, aucune entrée de
   navigation. Décision produit prise : reste inaccessible pour l'instant.
   Bonus : `TopHeader.tsx` mappe encore `case "forum"` vers un libellé
   obsolète (« Badges & paliers »).
2. **Usurpation d'identité possible dans le forum** par un compte staff
   (`authorName`/`authorRole` non vérifiés contre `req.auth`). Impact
   borné (forum inaccessible côté élève).
3. **`forum_replies` sans vérification de propriété.** Latent.
4. **`quizResultsSchema` non borné.** Mineur, borné par la limite globale 8 Mo.
5. **Rate limiter en mémoire, par processus.** Compromis accepté pour un
   outil mono-instance — pas de migration Redis sans demande explicite.
6. **Absence de flux de récupération de mot de passe.** Discussion
   produit, pas un bug de code.
7. **`CoachSignals.tsx` : aucune UI pour qu'un coach crée un signal**,
   seul l'affichage/import existe.
8. **`NotificationModal.tsx` : statut "Push Server Live" factice**, bouton
   "Simuler alerte" jamais câblé dans `App.tsx`.
9. **`MindsetJournalModal.tsx` et `PropChallengeSimulator.tsx` : persistance
   `localStorage` uniquement**, pas synchronisée serveur — décision
   assumée pour les deux (sessions de pratique jetables), pas un oubli.
10. **Modules vidéo : vidéo placeholder unique**, pas de vrai contenu hébergé.

### Piège opérationnel : `AdminStudentView.tsx` est un overlay

Reste dans le DOM en arrière-plan par-dessus la page admin — **deux
copies** de certains éléments (dont `TopHeader`) coexistent dans le DOM.
Scoper toute recherche DOM/clic programmatique à
`document.querySelector('.fixed.inset-0.z-50...')`, sinon on risque
d'interagir avec le mauvais exemplaire (rencontré concrètement en testant
l'ancien bouton PDF : un clic non scopé a déclenché l'action du staff au
lieu de celle de l'élève consulté).

### Piège opérationnel : `window.confirm()` dans l'outil de prévisualisation

`confirm()` retourne silencieusement `false` dans le Browser pane (jamais
affiché), touchant tous les boutons qui l'utilisent (« Déconnexion »,
révocation d'accès élève, etc.) — **pas un bug de l'app**, une limitation
de cet outil précis. Contournement : appeler directement l'endpoint en JS
(`fetch("/api/auth/logout", {method:"POST", credentials:"same-origin"})`)
puis recharger/re-vérifier. Dans un vrai navigateur, ces boutons
fonctionnent normalement.

### Piège d'environnement historique (Bash), a priori non actif

Une session antérieure a documenté un blocage `process.cwd()` → `EPERM`
cassant `cd`/`git`/`npm` dans ce répertoire précis (permissions macOS
probables). **Non reproduit dans les sessions ultérieures** (git, npm,
sqlite3, curl, lsof ont tous fonctionné normalement tout du long de la
session qui a produit ce document) — mentionné à titre préventif
seulement. Si ça se reproduit : `Read` sur `.git/logs/HEAD` fonctionne
sans `cwd` pour consulter l'historique des commits sans `git log`, mais
`git commit`/`add` nécessitent un shell fonctionnel — dans ce cas, demande
à l'utilisateur de committer lui-même.

### Piège rencontré : processus serveur dupliqué sur le port 3000

Après un `preview_stop`/`preview_start`, il est arrivé qu'un ancien
processus reste vivant sur le port 3000 en parallèle du nouveau, causant
des erreurs `ReferenceError` sur du code déjà supprimé (bundle obsolète
encore servi). Vérifier `lsof -ti:3000` (doit renvoyer un seul PID) avant
de chercher un bug applicatif inexistant. Tuer proprement avec
`lsof -ti:3000 | xargs -r kill -9` puis `rm -rf node_modules/.vite` si le
problème persiste.

---

## 6 bis. Ce qui ressemble à du code mort, mais ne l'est pas

- **`EnrolledStudent.accounts`** coexiste avec la collection globale
  `accounts` — reste la source pour les élèves **sans** compte actif.
- **`ForumSection.tsx`** — complet, fonctionnel, mais inaccessible (§6).
  Ne pas le supprimer en pensant que c'est du code mort.
- **`Trade.mistakes`** absent sur les trades créés avant le tag
  d'erreurs — traité partout comme `?? []`.
- **`TraderBadge.trackable`** absent sur les données existantes en base —
  `computeBadgeProgress()` le recalcule à chaque rendu, jamais lu tel quel.
- **`server/auth/middleware.ts` : `requireOwner` et `requireAdmin`** —
  `requireOwner` semblait "jamais utilisé" avant le chantier §0 (toujours
  défini, jamais monté sur une route) ; c'est désormais utilisé
  réellement. `requireAdmin`, lui, reste **toujours inutilisé** en
  pratique (tous les comptes staff ont `isAdmin: true`, donc cette garde
  ne peut jamais rejeter personne aujourd'hui) — conservé pour documenter
  l'intention si des rôles différenciés apparaissent un jour, à ne pas
  supprimer pensant que c'est mort, mais à ne pas s'étonner qu'il ne
  serve à rien non plus.

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
| Taper un mot de passe (même de test) dans un formulaire UI | **Jamais**, sans exception |
| Rate limiter en mémoire | Accepté pour un outil mono-instance |
| Export PDF personnel | Construit, puis **entièrement retiré** sur demande explicite (voir §9) |
| Verrouillage de compte | 5 échecs / 15 min → verrouillage 15 min, par compte (choix recommandé, validé par l'utilisateur) |
| Emplacement du Journal de sécurité | Modale dédiée (gabarit StaffAccountsModal), pas un onglet de sidebar (choix recommandé, validé) |
| Compte de test Camille Dupont / Lucas Martin | Systématiquement révoqués après vérification |
| Portée de la refonte Prop Firm | Remplace Replay + modale Prop Firm Rules (pas un 3ᵉ module ajouté à côté) |
| Persistance du challenge Prop Firm | Locale (`localStorage`), pas de synchronisation serveur |
| Génération de prix du challenge Prop Firm | Marche aléatoire simulée, pas de vraie donnée de marché historique |

---

## 7. Tâches complétées et prochaines

### ✅ 1. Chantier Journal de sécurité + verrouillage (COMMITTÉ `0939553`)

Entièrement committé et testé. Vérification visuelle confirmée en session
staff active : ✅ bouton dans le profil (foundateur-only), ✅ modale
SecurityLogModal affiche les événements réels, ✅ filtres déclenchent
appels réseau.

### ✅ 2. Refonte visuelle du Portefeuille — VERT (COMMITTÉ `3f7e6f0`)

L'utilisateur a d'abord demandé le style Mindset modal (violet), puis a demandé
que la couleur soit changée du violet au vert.

**Refonte complétée** : Commit `72645ee` (style Mindset modal avec violet) +
Commit `3f7e6f0` (changement violet → vert).

**Style actuel** :
- Accent principal : **Vert fluorescent** (`#00E676`)
- Gradients : `from-[#0D1110] to-[#111615]`
- Bordures : `border-[#00E676]/20`
- Badges : Vert ACTIVE, amber PAID_OUT, bleu autres
- Boutons & formulaire : Vert
- **Données & fonctionnalités : 100% conservées**

Vérification visuelle : ✅ en-tête vert, ✅ cartes résumé (capital vert, autres
couleurs variées), ✅ comptes (bordures vertes), ✅ détails (drawdown, profit
target vert, stats) ✅ modale d'ajout vert.

### 3. Revenir sur la demande "Données & sauvegarde" si elle refait surface

Une maquette externe (export/import JSON, réinitialisation) a été montrée,
puis abandonnée (l'utilisateur a préféré retirer le PDF plutôt que de
répondre). **Ne pas considérer clos** — si remmentionne, poser les questions
de clarification (emplacement, périmètre, bouton réinitialisation).

### 4. Remplir le module « Examen »

Décision produit en attente : specs des graphiques, règles de notation,
nombre de questions, durée limite. Débloquerait le badge-9 (« Score
Examen » affiche actuellement « — »).

### Ce qui n'est PAS une tâche

- **Réintroduire de l'IA sous quelque forme que ce soit.**
- **Le cloisonnement des données par compte staff** — bureau partagé
  toujours voulu.
- **Donner aux élèves accès à « Suivi des Élèves ».**
- **Ajouter un champ de tracking pour débloquer les 4 badges non
  calculables** sans discussion produit préalable.
- **Migrer le rate limiter vers Redis** sans demande explicite.
- **Reconstruire une fonctionnalité d'export PDF** sans demande explicite
  — elle a été retirée volontairement.
- **"Réparer" les vidéos placeholder, le fil d'actus Macro statique, le
  centre de signaux sans création UI, le statut "Live" factice des
  notifications** — ce sont des limitations connues et acceptées, pas des
  bugs à corriger de ta propre initiative. Si l'utilisateur les signale,
  c'est un nouveau sujet de discussion produit, pas une correction
  évidente. (Le Simulateur Replay, lui, **a** été refait sur demande
  explicite — voir §0 bis — ce n'est plus dans cette liste.)

---

## 8. Décisions techniques importantes

### Le correctif de sécurité critique et son interaction avec toute copie entre bureaux

`replaceCollection()` vérifie qu'aucun `id` soumis n'appartient déjà à un
autre `user_id` avant d'écrire. Toute copie de données d'un bureau vers un
autre (seeding de modules/badges à l'invitation d'un élève, par exemple)
**doit impérativement remapper ses `id`**, sous peine d'un rejet 409 qui
bloque l'opération entière dès le second bureau destinataire. Vérifie
systématiquement le remappage avant d'ajouter une nouvelle collection
copiée entre bureaux.

### `isOwner` vs `isAdmin` — ne jamais les confondre

`isAdmin` = tout le staff (droits métier complets, égaux). `isOwner` = le
seul fondateur. Une fonctionnalité "réservée à l'admin" (comme Suivi des
Élèves) doit utiliser `isAdmin`/`student.isAdmin`. Une fonctionnalité
"réservée au fondateur seul" (réglage de visibilité sidebar, Journal de
sécurité) doit utiliser `isOwner` — et le middleware `requireOwner`
existe côté serveur pour ça, prêt à être monté sur toute nouvelle route
qui en a besoin.

### Pourquoi vérifier une protection anti-perte nécessite de la faire échouer pour de vrai

Le bug `pendingChanges.ts` côté élève n'a été découvert qu'en testant
réellement le scénario de perte (couper le serveur, écrire, vérifier
`localStorage`, redémarrer, recharger, constater la perte) — pas par
relecture de code, même attentive. Méthode à retenir pour toute
fonctionnalité de protection/sécurité : la faire échouer une première fois
pour de vrai avant de corriger, sinon impossible de savoir si le correctif
fonctionne ou si le scénario de test était simplement trop indulgent.
Même logique appliquée pour vérifier le verrouillage de compte (§0) :
déclencher un vrai verrouillage via `curl` plutôt que de se fier à la
lecture du code.

### Pourquoi les badges non calculables ne sont pas simplement masqués

Romprait le compteur affiché (« 6/9 badges ») et la logique de filtre par
catégorie. Un message honnête est plus transparent qu'une disparition
silencieuse.

### Pourquoi `computeBadgeProgress`/`computePerformanceStats` ne persistent jamais leurs résultats

Recalculés à **chaque rendu**, jamais écrits dans une collection
synchronisée. Alternative (calculer côté serveur, persister) écartée :
complexité disproportionnée par rapport au coût quasi nul de recalculer
côté client — et ça garantit qu'un seul calcul fait foi, jamais deux
versions qui pourraient diverger.

### Verrouillage de compte : indexé sur l'email brut, pas sur "compte trouvé"

Le verrouillage de connexion (§0) incrémente son compteur AVANT de
résoudre si l'email correspond à un vrai compte. Un email inconnu se
verrouille exactement comme un email réel avec mauvais mot de passe, avec
le même code/message — préserve l'anti-énumération déjà en place
(`verifyAgainstDecoy`). Ne jamais faire dépendre le comportement de
verrouillage de l'existence réelle du compte.

### Ne jamais taper un mot de passe, même de test, dans un champ UI

Même un mot de passe de test généré par le système, jamais vu par un
humain, avec l'autorisation explicite de l'utilisateur — reste interdit
s'il doit être **tapé dans un champ de formulaire**. Un appel `curl`/
`fetch` programmatique que tu contrôles entièrement reste légitime, y
compris pour tester volontairement un échec (mauvais mot de passe pour
déclencher un verrouillage, par exemple).

*(Pour les décisions antérieures — pièges Express, cascades SQL, session
de marché en UTC, capture d'écran non recadrée, distinction IA réelle/
fausse — voir l'historique git.)*

---

## 9. Contexte de travail avec l'utilisateur

- Il **communique en français**, ton direct, tutoiement.
- Il travaille par **demandes courtes et itératives**, souvent en
  signalant un problème constaté en usage réel plutôt qu'en décrivant une
  solution, ou en partageant une **capture d'écran d'un autre outil/site**
  comme référence visuelle/fonctionnelle pour une fonctionnalité qu'il
  veut construite ici — ces captures ne sont **jamais** des captures de
  cette app, toujours des maquettes ou d'autres produits à prendre comme
  inspiration, pas comme spec littérale à copier 1:1 sans adaptation au
  design system existant (vert `#00E676`, thème sombre).
- Il a demandé un **audit exhaustif suivi d'une correction priorisée** à
  plusieurs reprises (sécurité, puis fonctionnel) — méthode qui fonctionne
  bien avec lui.
- **Il attend d'être consulté sur les choix de conception ambigus avant
  l'implémentation** de toute fonctionnalité non triviale — passer par un
  mode de planification structuré (explorer le code, concevoir, poser des
  questions de clarification ciblées avant d'écrire du code) a bien
  fonctionné pour l'export PDF et le Journal de sécurité. Les options
  "recommandées" proposées dans les questions de clarification ont
  systématiquement été retenues jusqu'ici.
- **Il peut changer d'avis en cours de route, parfois radicalement** :
  l'export PDF personnel a été entièrement construit, vérifié, committé —
  puis retiré en totalité quelques échanges plus tard sur un revirement
  net (« je veux supprimer le bouton et la fonctionnalité »), après avoir
  laissé sans réponse des questions de clarification sur une demande
  différente. **Ne pas s'accrocher à une fonctionnalité récemment
  construite** si une nouvelle demande la remet en cause — exécuter le
  nouveau souhait tel quel plutôt que de plaider pour l'ancien.
- **Il ne donne pas ses mots de passe pour que tu les utilises** — même
  fourni en clair dans le chat sur demande explicite, la règle de sécurité
  prime. La bonne réponse est de refuser poliment et proposer que
  l'utilisateur agisse lui-même.
- **Toujours vérifier en conditions réelles, pas seulement à la
  compilation, ni même à la seule lecture du code.** Plusieurs bugs
  réels (protection anti-perte élève, comportement du rate-limit, du
  verrouillage de compte) n'ont été confirmés/infirmés qu'en testant
  vraiment le scénario, jamais par relecture seule.
- **Ses données de travail sont réelles** (`data/horizon.db`). Toujours
  nettoyer après un test qui a dû l'utiliser directement (comptes de test
  révoqués, verrouillages de connexion supprimés).
- Il **committe lui-même la décision de committer**, mais une fois la
  demande faite, n'attend pas de confirmation supplémentaire avant chaque
  commit individuel dans la même série.
- Quand il demande explicitement une mise à jour du HANDOFF « suffisamment
  détaillée pour qu'un autre Claude puisse reprendre sans accès à la
  conversation », il attend une **analyse fraîche du code**, pas une
  simple compilation de notes de session — c'est ce qui a produit ce
  document précis (deux passes d'exploration indépendantes du code avant
  rédaction).

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
   questions de clarification ciblées avant d'écrire le code, plutôt que
   de foncer directement dans l'implémentation.
8. Quand un outil UI ne réagit pas comme attendu, vérifier d'abord si
   c'est un vrai bug applicatif (réseau, console) avant de conclure —
   `window.confirm()` non supporté dans l'outil de prévisualisation en est
   un exemple récurrent, pas un bug de l'app. Le distinguo se fait en
   testant l'appel API directement (`fetch(...)` en JS).
9. Pour du contenu généré en Node (ex. un PDF) : reproduire l'appel côté
   Node avec les vraies données de production plutôt que de se fier
   uniquement au rendu navigateur — permet de lire le résultat exact
   octet par octet.

---

## 10. État après ajout de l'aperçu SL/TP glissable

- Branche `main`, dernier commit : `f24d53e` (« Ajoute l'aperçu SL/TP en
  direct et le glisser-déposer sur le graphique du simulateur Prop
  Firm »).
- **Sept chantiers terminés et committés** :
  - `0939553` : Journal de sécurité + verrouillage (COMMITTÉ + vérifié)
  - `72645ee` : Refonte Portefeuille (style Mindset modal, violet)
  - `3f7e6f0` : Changement Portefeuille violet → vert (COMMITTÉ + vérifié)
  - `18ff5c4` : Simulateur de Challenge Prop Firm complet (COMMITTÉ +
    vérifié) — voir §0 bis pour le détail
  - `11f1118` : Renommage "Simulateur Monte Carlo & Compounding" →
    "Simulateur Rentabilité PropFirm"
  - `ceafafa` : Retrait complet de l'entrée sidebar "Sim propfirm"
    (COMMITTÉ + vérifié) — voir §0 bis, section "Suivi demandé après coup"
  - `f24d53e` : Aperçu SL/TP en direct + glisser-déposer sur le graphique
    (COMMITTÉ + vérifié) — voir §0 bis, section "Suivi demandé après coup"
- `npm run lint` et `npm run build` passent.
- Répertoire de travail propre (tous les changements sont committés).
- Aucun compte de test/verrouillage actif.
- Rappel : `src/data/` est couvert par un pattern `.gitignore` non ancré
  (`data/`), mais `mockData.ts` y est légitimement suivi de longue date —
  `git add` sur ce fichier réclame `-f` à chaque fois, c'est normal, pas un
  signe d'erreur.

### Prochaines tâches

1. **Clarifier la demande "Données & sauvegarde"** si elle refait surface
   (voir §7.3 pour les questions préalables).
2. Remplir le module « Examen » — décision produit en attente (specs,
   règles, nombre de questions, durée).

> Ce document est la **seule** source de reprise fiable. S'il existe un
> écart entre ce document et le code, **fais confiance au code** — vérifie
> par la lecture directe des fichiers sources, et corrige ce document en
> conséquence.
