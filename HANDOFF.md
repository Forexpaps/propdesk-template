# HANDOFF — PropDesk (Académie de Trading)

Document de reprise. Il suppose que tu n'as accès ni à la conversation
précédente, ni à autre chose que ce dépôt.

> **État à la dernière mise à jour de ce document**
> Branche `main`, arbre propre. `npm run lint` et `npm run build` passent. La
> base `data/horizon.db` contient les **vraies données de l'utilisateur**, plus
> le jeu de démonstration.
>
> L'authentification est **terminée et vérifiée** : comptes staff multiples sur
> un bureau unique partagé, invitation avec mot de passe temporaire, le tout
> rejoué de bout en bout sur une copie de la vraie base (§10). La sauvegarde
> d'avant migration a été supprimée — `data/` ne contient plus que la base
> vivante.
>
> **Prochaine tâche : remplir le module « Examen »** (§7, tâche 1). Elle demande
> une décision produit de l'utilisateur **avant** d'écrire du code.

---

## 1. Le projet en bref

**PropDesk** est une plateforme d'académie de trading SMC (*Smart Money
Concepts*) destinée à un coach et à ses élèves. Elle réunit dans une seule
interface :

- un **journal de trading** avec audit IA de chaque position ;
- un **suivi des comptes prop firm** (FTMO, MyFundedFX, brokers réels) ;
- des **modules vidéo** avec quiz et progression ;
- un **simulateur** (replay de setups historiques + Monte Carlo) ;
- un **forum**, une **messagerie coach**, un **centre d'alertes** ;
- un **espace admin** de suivi des élèves ;
- quatre **outils** en modale : audit de setup, règles prop firm, mindset,
  calendrier économique.

**Qui l'utilise, et ce que cela implique.** C'est l'outil de travail d'un coach
(« ForexPaps ») et de son staff. Plusieurs comptes staff peuvent se connecter
séparément, mais tous partagent **le même bureau** : mêmes trades, mêmes fiches
élèves, mêmes portefeuilles. Ce n'est pas du multi-tenant — voir §6.3, c'est la
confusion la plus coûteuse possible sur ce projet. Les élèves, eux, n'ont
**pas** de compte : ce sont des fiches de suivi (`EnrolledStudent`).

L'interface est **entièrement en français**. Le ton des libellés est direct et
tutoie l'utilisateur. Conserve cette langue et ce registre.

Le projet vient de **Google AI Studio** : c'est important, plusieurs choix
initiaux en découlent (voir §8).

**Ordres de grandeur** : ~15 300 lignes de TypeScript, 49 fichiers `.ts`/`.tsx`,
29 commits. Le plus gros fichier applicatif est `src/App.tsx` (1057 l.), le plus
gros tout court `src/data/mockData.ts` (1455 l., données d'amorçage).

**La base de données contient de vraies données de travail** — pas un jeu de
démonstration. Voir l'avertissement en §6.5 avant toute manipulation de `data/`.

---

## 2. Démarrage immédiat

```bash
npm install
```

Créer un `.env` à la racine :

```
GEMINI_API_KEY=ta_clé
```

La clé n'est lue que **côté serveur**, jamais exposée au navigateur. Sans elle
l'application fonctionne : seules les fonctions d'audit IA renvoient une erreur
explicite.

| Commande | Effet |
|---|---|
| `npm run dev` | serveur de développement sur http://localhost:3000 |
| `npm run lint` | `tsc --noEmit` — **doit toujours sortir sans erreur** |
| `npm run build` | bundle client (`dist/`) + serveur (`dist/server.cjs`) |
| `npm start` | sert le build de production (`NODE_ENV=production` requis) |
| `npm run clean` | supprime `dist/` |
| `node scripts/generate_pdf.js` | régénère le catalogue PDF des fonctionnalités |

Il n'y a **qu'un seul port**. Pas de proxy à configurer.

Un `.claude/launch.json` est présent : l'outil de prévisualisation démarre le
serveur sous le nom **`horizon-dev`** (port 3000, `autoPort` activé).

Inspecter la base — c'est le chemin le plus direct, l'API exige une session :

```bash
sqlite3 data/horizon.db "select id, pair, pnl from trades order by position"
```

```bash
sqlite3 data/horizon.db "select id, name, email, must_change_password from staff_accounts"
```

Sonder l'API **sans** session (les seules routes qui répondent) :

```bash
curl -s localhost:3000/api/health && curl -s localhost:3000/api/auth/me
```

`/api/state` et tout le reste renvoient **401** sans cookie. Pour exercer les
routes protégées, connecte-toi d'abord et garde le cookie :

```bash
curl -s -c /tmp/pd.txt -X POST localhost:3000/api/auth/login -H 'Content-Type: application/json' -d '{"email":"…","password":"…"}' && curl -s -b /tmp/pd.txt localhost:3000/api/state | head -c 400
```

**Ne teste jamais l'authentification sur `data/`.** Utilise une base jetable —
c'est ce qui a permis de valider le flux complet sans toucher aux vraies
données ni créer de compte parasite :

```bash
DATA_DIR=/tmp/propdesk-test PORT=3100 npx tsx server.ts
```

---

## 3. Architecture

### Vue d'ensemble

Un serveur **Express unique** sert l'API **et** l'application. En
développement il monte Vite en middleware ; en production il sert `dist/`.

```
server.ts              point d'entrée : Express + Vite/statique (55 l.)
server/
  db.ts                SQLite (better-sqlite3, WAL), schéma + migration (294 l.)
  repositories.ts      accès aux données — SEUL module qui parle à SQLite (173 l.)
  routes.ts            routes /api/*, barrière requireAuth (299 l.)
  schemas.ts           validation zod des entrées (143 l.)
  seed.ts              amorçage et import d'un état complet (81 l.)
  auth/
    password.ts        hachage scrypt, vérification, re-hachage (208 l.)
    sessions.ts        jetons, cookie, purge, lecture du cookie (211 l.)
    credentials.ts     accès à staff_accounts (241 l.)
    routes.ts          authRouter (public) + staffRouter (protégé) (357 l.)
    middleware.ts      requireAuth, requireAdmin (109 l.)
  middleware/
    rateLimit.ts       fabrique de limiteur par IP (62 l.)
src/
  main.tsx             point de montage React (10 l.)
  App.tsx              porte d'auth + état applicatif + câblage des vues (1057 l.)
  types.ts             source de vérité des formes de données (300 l.)
  index.css            Tailwind 4 + styles globaux
  data/mockData.ts     jeu de données d'amorçage (1455 l.)
  hooks/
    usePersistentState.ts   état miroité dans localStorage (41 l.)
    useServerSync.ts        bootstrap serveur + synchronisation optimiste (183 l.)
    useAuth.ts              état d'authentification côté client (110 l.)
  lib/
    api.ts             client HTTP typé, interception du 401 (179 l.)
    image.ts           réduction des images téléversées (107 l.)
  components/          10 vues d'onglet + 10 modales + Sidebar et TopHeader
    auth/              AuthShell, LoginScreen, SetupScreen, ChangePasswordScreen
public/
  icon.png             icône 512×512 — sidebar, favicon, icône iOS
  logo-auth.jpg        logo 768×512, 38,8 ko — écrans d'authentification
  logo.png             source haute résolution 1536×1024 (§6 bis)
  Fonctionnalites_Horizon_SMC.pdf
scripts/generate_pdf.js  génération hors ligne du PDF
```

### Inventaire des composants

**Vues d'onglet (10)** — `MainDashboard`, `StudentTracking`, `WalletManagement`,
`VideoAcademy`, `TradingJournal`, `SMCSimulator`, `CoachSignals`,
`ForumSection`, `CoachMessaging`, `PerformanceDashboard`. L'onglet `exam` n'a
pas de composant : il est rendu en ligne dans `App.tsx` (§6 bis).

**Modales (10)** — `UserProfileModal`, `TradeAuditModal`,
`PositionCalculatorModal`, `TradingPlanModal`, `EconomicCalendarModal`,
`PropFirmRulesModal`, `MindsetJournalModal`, `SetupAnalyzerModal`,
`NotificationModal`, `StaffAccountsModal`.

**Écrans d'authentification (3 + coque)** — `LoginScreen`, `SetupScreen`,
`ChangePasswordScreen`, tous bâtis sur `AuthShell` (qui porte la palette et les
primitives `AuthField` / `AuthError` / `AUTH_INPUT_CLASS` / `AUTH_BUTTON_CLASS`).
Ils se montent **avant** l'application, jamais dedans.

**Chrome** — `Sidebar` (519 l.), `TopHeader` (133 l.).

Les plus gros fichiers, si tu cherches où le poids se concentre :
`mockData.ts` (1455), `App.tsx` (1057), `TradingJournal.tsx` (848),
`ForumSection.tsx` (764), `VideoAcademy.tsx` (756), `StudentTracking.tsx` (746),
`UserProfileModal.tsx` (650).

### Démarrage du client — le chemin critique

`src/App.tsx` est découpé en **trois composants successifs**, et c'est ce
découpage qui garantit qu'aucune donnée ne part avant qu'une session existe
(les hooks ne pouvant pas être conditionnels) :

```
App()                        ne fait QUE useAuth()  →  GET /api/auth/me
 ├─ "loading"          → LoadingScreen
 ├─ "no-account"       → SetupScreen           (première installation)
 ├─ "unauthenticated"  → LoginScreen
 ├─ authentifié mais mustChangePassword
 │                     → ChangePasswordScreen  (bloquant)
 └─ AuthenticatedApp()        monté seulement ici
      └─ useBootstrap()       →  GET /api/state
           └─ AcademyApp()    12 useSyncedState, toutes les vues et modales
```

`AcademyApp` porte l'essentiel de l'application (~900 des 1057 lignes) et **sa
structure interne n'a jamais été restructurée** — les chantiers successifs ont
délibérément gardé la surface de modification minimale sur ce composant.

`"offline"` mène aussi à `AuthenticatedApp` : sans serveur, aucune vérification
n'est possible et on démarre sur le cache (§6.2, choix assumé).

### Navigation

**Pas de routeur.** `App.tsx` tient un `activeTab` et rend la vue
correspondante. L'union `TabType` est définie dans
[`src/components/Sidebar.tsx:36`](src/components/Sidebar.tsx:36) :

```
dashboard · students · wallets · academy · journal · simulator
signals · forum · messaging · analytics · exam · propfirm
```

Conséquences à connaître : **pas d'URL par écran**, pas de bouton retour
navigateur, pas de lien partageable. Ajouter un routeur serait un chantier à
part entière.

Deux onglets partagent un composant :

- `simulator` et `propfirm` rendent tous deux `SMCSimulator`, avec une prop
  `initialMode` (`"REPLAY"` / `"MONTE_CARLO"`). Une `key={activeTab}` force le
  remontage, sans quoi l'état interne survivrait et ignorerait `initialMode`.

### Structure de la sidebar

Un item principal (Tableau de bord) puis **quatre sections**, toutes rendues
par la même fonction `renderSection` :

| Section | Entrées |
|---|---|
| **SUIVI** | Journal de trading, Portefeuille, Rentabilité, Suivi des Élèves *(admin seul)* |
| **PRATIQUE** | Examen, Exercice du jour *(modale)*, Replay, Sim propfirm |
| **FORMATION** | Module vidéo *(badge %)*, Messagerie Coach *(badge non-lus)* |
| **OUTILS** | Audit Setup, Prop Firm, Mindset, Calendrier — **les 4 sont des modales** |

Une entrée porte soit un `id` d'onglet, soit un `onOpen?: () => void` qui ouvre
une modale (`id: null`). Le routage passe par `onOpen`, **jamais** par une
comparaison de libellé : avec cinq entrées-modales, renommer un libellé aurait
silencieusement cassé la navigation.

**14 entrées masquables** au total (`SIDEBAR_TOGGLEABLE_KEYS`,
[`Sidebar.tsx:60`](src/components/Sidebar.tsx:60)) :

```
journal · wallets · analytics · students · exam · checklist · replay
propfirm · academy · messaging · audit · propfirmrules · mindset · calendar
```

« Tableau de bord » en est volontairement absent : c'est la destination de
repli, le masquer créerait le cul-de-sac qu'on cherche à éviter.

### Persistance

Le **serveur est la source de vérité**. Au démarrage, le client appelle
`GET /api/state` et reçoit toutes les collections en un aller-retour.

Chaque modification suit ce chemin :

1. l'interface se met à jour **immédiatement** (optimiste) ;
2. la valeur est recopiée dans `localStorage` ;
3. après **400 ms de regroupement**, elle part vers le serveur.

Si le serveur est injoignable, l'application démarre sur le cache local et
reste utilisable — voir les limites en §6.1.

Au tout premier lancement sur une base vide, les données présentes dans
`localStorage` (version antérieure sans serveur) sont importées
automatiquement. À défaut, la base est amorcée depuis `mockData.ts`.

La base vit dans `DATA_DIR` (`./data` par défaut), **hors du dépôt**
(`.gitignore`).

**Clés `localStorage` utilisées** — les neuf collections
(`horizon_trades`, `horizon_accounts`, `horizon_signals`, `horizon_messages`,
`horizon_forum_topics`, `horizon_notifications`, `horizon_enrolled_students`,
`horizon_badges`, `horizon_modules`), plus `horizon_student`,
`horizon_quiz_results`, `horizon_sidebar_collapsed` et `horizon_sound_alerts`
(préférence locale du centre d'alertes, jamais synchronisée).

### API

**Publiques** — accessibles sans session :

| Méthode | Route | Rôle |
|---|---|---|
| GET | `/api/health` | sonde de vie |
| GET | `/api/auth/me` | état d'auth ; **répond toujours 200** |
| POST | `/api/auth/setup` | première installation ; `409` si un compte existe |
| POST | `/api/auth/login` | connexion |
| POST | `/api/auth/logout` | déconnexion ; `204`, idempotente |

**Protégées** — derrière `api.use(requireAuth)` :

| Méthode | Route | Rôle |
|---|---|---|
| GET | `/api/auth/staff` | liste des comptes staff |
| POST | `/api/auth/staff` | invite un compte, renvoie un mot de passe temporaire |
| DELETE | `/api/auth/staff/:id` | révoque un compte ; `409` sur le dernier |
| POST | `/api/auth/change-password` | change son propre mot de passe |
| GET | `/api/state` | état complet de démarrage |
| PUT | `/api/collections/:name` | remplace une collection entière |
| PUT | `/api/profile` | profil affiché du bureau partagé |
| PUT | `/api/quiz-results` | résultats de quiz |
| POST | `/api/state/seed` | amorce avec le jeu de démonstration |
| POST | `/api/state/import` | reprend un état venu de `localStorage` |
| POST | `/api/coach/ai-review` | audit IA d'un trade ou réponse à une question |
| GET | `/api/download-features-pdf` | catalogue PDF des fonctionnalités |

Toutes les entrées sont validées par **zod**.

**Quatre limitations de débit par IP** (`createRateLimit`, fenêtre glissante en
mémoire) : `ai-review` 10/minute (seule route facturée à l'appel — Gemini,
modèle `gemini-3.6-flash`), `login` 10/quart d'heure, `setup` 5/quart d'heure,
`staff` (invitation) 10/quart d'heure.

Codes de retour à connaître : `400` entrée invalide, `401` session absente ou
expirée, `403` action refusée (mot de passe actuel faux, mot de passe
temporaire non changé, non-admin), `404` collection inconnue, `409` conflit
(compte déjà existant, base déjà amorcée, dernier compte non supprimable),
`429` quota dépassé, `500` exception non prévue (via `apiErrorHandler`).

Le corps JSON est plafonné à **8 Mo** (`express.json({ limit: "8mb" })`) — la
limite par défaut de 100 ko était trop basse pour une collection complète.
**Un second parseur borné à 16 ko est déclaré AVANT lui sur `/api/auth`** :
`body-parser` marque la requête comme déjà lue, donc le parseur 8 Mo passe la
main. Sans cela un corps de 8 Mo atteindrait le hachage du mot de passe.

### Schéma SQLite

15 tables : `meta`, `users`, `staff_accounts`, `sessions`, `trades`,
`trading_accounts`, `coach_signals`, `coach_messages`, `forum_topics`,
`forum_replies`, `notifications`, `enrolled_students`, `badges`, `modules`,
`quiz_results`.

**`users` est le bureau partagé, `staff_accounts` les identités.** Les deux ne
sont **pas** liées par une clé étrangère : un compte staff n'est pas
propriétaire d'un bureau, il y accède (§4 « Authentification »).

Les données portent un `user_id` valant toujours `DEFAULT_USER_ID`
(`"user-local"`) — **aucun repository ne filtre par identité de session**.
C'est ce qui a permis d'ajouter les comptes staff sans toucher à la couche de
données. Les objets sont stockés en **colonne JSON** (`payload`), ce qui rend
le schéma tolérant à l'ajout de champs — voir §8.

Chaque ligne porte aussi une colonne `position` : **l'ordre des listes est
significatif dans l'UI** et doit être conservé.

Seule la table `trades` **promeut des colonnes** hors du payload
(`date`, `pair`, `direction`, `result`, `pnl`), avec deux index — c'est la
seule collection sur laquelle on voudra requêter. Les autres ne sont jamais
lues autrement qu'en entier.

Les réponses du forum sont stockées séparément (`forum_replies`, en cascade sur
`forum_topics`) et **retirées du payload du sujet** à l'écriture, puis
recomposées à la lecture. La même donnée n'existe donc jamais à deux endroits.

---

## 4. Fonctionnalités terminées

### Socle technique

- `@types/react` installé et **`strict` activé** dans `tsconfig.json`.
- `npm run lint` et `npm run build` passent sans erreur (**vérifié**).
- Dépôt git initialisé, 25 commits, historique propre.
- `README.md` réécrit (documentation utilisateur ; ce HANDOFF est la
  documentation de reprise).

### Persistance serveur

SQLite complet, validation zod, limitation de débit sur la route IA, repli
hors ligne, migration automatique depuis `localStorage`.

**Vérifié** : mutation dans l'UI → présente en base ; serveur redémarré et
`localStorage` entièrement vidé → données toujours là.

### Navigation et sidebar

- **Masquage de modules par l'admin.** Un engrenage apparaît à droite des
  titres des 4 sections pour l'administrateur seul. Il bascule la section en
  mode réglage : chaque entrée se masque ou se réaffiche d'un clic. Hors de ce
  mode, une entrée masquée disparaît pour tout le monde. **14 entrées
  masquables** ; « Tableau de bord » ne l'est pas.
- **Repli automatique** : masquer le dernier accès à l'onglet courant renvoie
  au tableau de bord. « Replay » et « Sim propfirm » menant au même onglet, la
  bascule n'a lieu que si plus aucune entrée visible n'y conduit.
- La configuration vit dans `StudentProfile.hiddenSidebarItems` et transite par
  `/api/profile` — **aucune migration de base**.
- **Section OUTILS** : 4 entrées qui ouvrent une modale au lieu de changer
  d'onglet. Masquables comme les autres.
- Le réglage de visibilité n'est proposé qu'en sidebar **dépliée** : repliée,
  les en-têtes de section — donc l'interrupteur — ne sont pas rendus.
- **Seule la navigation défile.** Le logo et le pied (carte de profil,
  déconnexion) sont `shrink-0` et restent atteignables sans défilement. Avant,
  `overflow-y-auto` était posé sur le conteneur entier : sur un écran de 900 px
  de haut, le contenu faisait déjà 941 px et **la carte de profil sortait de
  l'écran**. Ne remets pas le défilement sur le conteneur.
- **Bouton de déconnexion** dans le pied, sous la carte de profil. Il n'est pas
  masquable : il ne vit dans aucune section. Rose au survol, comme les autres
  actions qui font quitter ou détruire quelque chose. En sidebar repliée, il
  devient une icône seule avec une infobulle.

### Journal de trading

- Quatre horodatages : **date et heure d'entrée, date et heure de sortie**.
  Les champs de sortie sont facultatifs (position ouverte).
- La colonne « Entrée / Sortie » distingue trois états : sortie renseignée,
  *position ouverte* (pas de prix de sortie), *sortie non renseignée* (trade
  clôturé saisi avant l'existence du champ).
- Export CSV à 20 colonnes, en-têtes et champs alignés.
- Reçoit des **ébauches de trade** (`TradeDraft`) depuis le calculateur de
  position et l'audit de setup, via `journalDraft` dans `App.tsx`.

### Suivi des élèves

- **Style de trading** par élève : `Scalping`, `Intraday`, `Swing Trading`.
  Réglé dans « Éditer Fiche », affiché en pastille près du nom sur la carte et
  dans la fiche détaillée.
- 4 statuts élève, chacun d'une couleur distincte : En Évaluation FTMO
  (violet), Prop Firm Financé (vert), Besoin Coaching (bleu), Alerte Tilt
  (rose).

### Authentification

**Plusieurs comptes staff, un seul bureau.** N'importe quel nombre de comptes
peut se connecter séparément (email + mot de passe propres), mais tous
travaillent sur les **mêmes** données — trades, élèves, portefeuilles. Il n'y a
**aucun cloisonnement** : ce n'est pas du multi-tenant, c'est un bureau partagé
avec plusieurs badges d'accès. Décision explicite de l'utilisateur : « le staff
seulement », invitation depuis l'interface avec mot de passe temporaire. Les
droits **métier** sont égaux pour tous ; la seule exception est `isOwner`
(§4 bis).

**L'identité est découplée de la donnée.** C'est la clé de voûte du design :
aucun repository n'a jamais utilisé l'identité de session pour filtrer quoi que
ce soit (tout retombe sur `DEFAULT_USER_ID` par défaut) — ça a permis d'ajouter
plusieurs comptes **sans toucher à une seule ligne de `server/repositories.ts`
ni des routes de collections**. `requireAuth` accorde `isAdmin: true` à toute
session valide, sans consulter le profil partagé : avoir un compte, c'est être
du staff. Il lit en revanche `isOwner` sur `staff_accounts` — le seul droit qui
ne soit pas accordé à tous (§4 bis).

**Schéma** — `server/db.ts`. Une seule table d'identité,
**`staff_accounts`** : `id`, `name`, `email`, `email_lower` (**`UNIQUE`**),
`password_hash`, `must_change_password`, `invited_by`, horodatages.
**Délibérément sans clé étrangère vers `users`** : un compte staff n'est pas
propriétaire d'un bureau, il y accède. `sessions` référence `staff_accounts(id)`,
plus `id` (**SHA-256 du jeton**, jamais le jeton), `created_at`, `expires_at`,
`last_seen_at`, `user_agent`.

Aucun champ de ces tables n'atteint jamais le client : `GET /api/state` renvoie
`getProfile()` (le bureau partagé) **tel quel au navigateur**, jamais
`staff_accounts`. Ne réintroduis pas de secret dans le payload du profil.

**Migration** (`migrateToStaffAccounts()` dans `server/db.ts`, marqueur
`migrated_staff_accounts_v1` en `meta`) — le projet est passé par un modèle
antérieur à un seul compte (`user_credentials`, lié 1:1 au bureau par une clé
étrangère qui interdisait tout second compte). La migration :
1. copie chaque ligne de `user_credentials` vers `staff_accounts`, **en
   conservant exactement le même `id`** — les sessions déjà émises restent
   valides, personne n'est déconnecté ;
2. recrée `sessions` avec la nouvelle contrainte (`CREATE TABLE IF NOT EXISTS`
   ne modifie **jamais** une table existante, un piège réel rencontré ici : sur
   une base déjà créée, l'ancienne contrainte vers `users` serait restée sans
   ce recréage explicite) ;
3. supprime `user_credentials`.
Idempotente (marqueur en `meta`), testée d'abord sur une **copie** de la vraie
base avant d'être appliquée (redémarrage du serveur de dev) — voir §9.

**Mots de passe** ([`server/auth/password.ts`](server/auth/password.ts)) —
`scrypt` de `node:crypto`, **aucune dépendance ajoutée**. `N = 32768`, `r = 8`,
`p = 1`, `keylen = 64`, sel de 16 octets, `maxmem` relevé explicitement (32 Mio
requis, soit exactement le défaut de Node — sans quoi scrypt échoue sur
`ERR_CRYPTO_INVALID_SCRYPT_PARAMS`).

Format de stockage **auto-descriptif** : `scrypt$N$r$p$sel$clé` en base64url.
Les paramètres voyagent avec le hash, donc durcir `N` plus tard **n'invalide pas**
les mots de passe existants — `needsRehash()` déclenche un ré-hachage transparent
à la connexion suivante.

`N = 32768` et non `16384` parce que `16384` ne coûtait que ~40 ms sur cette
machine. À 32768 le coût mesuré est de ~80 ms, ce qui est l'objectif : ralentir
une attaque hors ligne si la base fuit.

**Sessions** ([`server/auth/sessions.ts`](server/auth/sessions.ts)) — jeton
`randomBytes(32)` en base64url (256 bits). **Aucune signature HMAC** : signer un
secret aléatoire de 256 bits n'apporterait rien, et cela évite
`cookie-signature`, qui n'existe qu'en transitif d'Express alors que le build
est en `--packages=external`. Cela évite aussi un secret à gérer dans `.env`.

Cookie `pd_session` : `HttpOnly`, `SameSite=Lax`, `Path=/`, TTL 30 jours,
prolongation glissante au-delà de 24 h depuis la dernière vue (le seuil évite un
`UPDATE` par requête — `useSyncedState` en produit plusieurs par seconde).
`secure` est **conditionné à la production** : le dev est en HTTP clair, un
`secure: true` inconditionnel ferait disparaître le cookie sans message
compréhensible.

**Plusieurs appareils en parallèle** (décision utilisateur) : la connexion ne
révoque pas les sessions existantes, et la déconnexion ne ferme que la session
présentée.

Le cookie est lu à la main depuis `req.headers.cookie` — `cookie-parser` n'est
pas installé et la contrainte était de ne rien ajouter. Le découpage se fait sur
le **premier** `=` seulement.

**Routes publiques** (`authRouter`, avant la barrière) — `/auth/me` (répond
**toujours 200**, union discriminée `no-account` / `unauthenticated` /
`authenticated`, ce dernier portant `mustChangePassword` : « pas encore
connecté » est l'état normal au démarrage, un 401 pousserait à traiter un état
comme une erreur), `/auth/setup` (**409 si un compte existe** — protection
critique, crée le **premier** compte et amorce le bureau partagé),
`/auth/login`, `/auth/logout` (**204, idempotente, hors de `requireAuth`** :
une session expirée doit pouvoir se déconnecter).

Deux protections anti-énumération sur `/auth/login` : le **même message** pour
email inconnu et mot de passe faux, et un **hachage contre un hash factice**
quand le compte est absent — sinon l'écart de temps de réponse (immédiat contre
80 ms) révélerait quels comptes existent.

**Routes staff** (`staffRouter`, **après** la barrière — piège réel : elles ne
peuvent pas vivre dans `authRouter`, monté avant `requireAuth`, sinon
l'invitation et le changement de mot de passe seraient publics) —
`GET /auth/staff` (liste, accessible à tout compte : tous égaux), `POST
/auth/staff` (invite, génère un mot de passe temporaire de 12 caractères
**renvoyé une seule fois**, jamais stocké en clair, jamais journalisé),
`DELETE /auth/staff/:id` (**refuse de supprimer le dernier compte** —
`deleteStaffAccount()` compte les lignes avant d'agir, sans quoi la base
deviendrait irrécupérable), `POST /auth/change-password` (exige le mot de passe
**actuel**, même sous un mot de passe temporaire — sinon voler un jeton de
session suffirait à changer le mot de passe sans le connaître).

`POST /auth/change-password` répond **403 et non 401** sur un mauvais mot de
passe actuel : un 401 aurait déclenché l'interception générique de
`src/lib/api.ts` (`UNAUTHENTICATED_EVENT`) qui traite tout 401 comme une
session expirée — alors que la session y est parfaitement valide.

**La barrière** — `api.use(requireAuth)` dans `server/routes.ts`, placée **après**
`/health` et `authRouter`, **avant** `staffRouter` et tout le reste : l'ordre de
déclaration rend l'exclusion structurelle. Elle est sur le **routeur**, jamais en
`app.use` : Vite est monté après l'API dans `startServer()`, un middleware au
niveau application intercepterait `/@vite/client` et le WebSocket HMR et
casserait le développement. Une liste d'exclusions explicite sert de filet,
avec des chemins **relatifs au routeur** (`/state`, pas `/api/state`).

`requireAuth` relit le compte staff **en base à chaque requête** (jamais depuis
le cookie) et bloque tout sauf `/auth/change-password` si
`mustChangePassword` est vrai — filet de sécurité, le client se gouverne déjà
sur ce champ sans jamais appeler d'autre route dans cet état.

`/state/seed` et `/state/import` sont **protégés**. Le flux le permet : sur base
neuve, `me` → `no-account` → `setup` crée le bureau *et* la session →
le client est authentifié → *ensuite* `useBootstrap` déclenche le seed.

**Durcissement des privilèges**, indissociable de l'auth — sans lui elle serait
décorative :

- `isAdmin` n'est plus écrivable par le client. Deux verrous : `profileSchema`
  **retire** la clé du corps (retirer et non rejeter — le client renvoie l'objet
  qu'il a reçu, un 400 casserait toute sauvegarde), et `PUT /api/profile`
  réinjecte la valeur autoritative lue en base. **Devenu partiellement
  vestigial** depuis les comptes staff : `isAdmin` du profil partagé n'a plus
  de rôle de contrôle d'accès réel (`requireAuth` accorde déjà `isAdmin: true`
  à tout compte staff) ; il reste lu par `Sidebar.tsx` et le rendu de la vue
  `students` dans `App.tsx`, où il fonctionne toujours (`isAdmin` vaut
  toujours `true` en pratique) mais n'a plus de rôle discriminant entre
  utilisateurs — un compte staff n'est jamais différent d'un autre.
- Le bouton « Activer Admin 👑 » de `UserProfileModal` est **retiré**, remplacé
  par « Gérer l'équipe » qui ouvre `StaffAccountsModal`.
- La vue `students` est gardée **au rendu**, plus seulement masquée dans la
  sidebar, avec un message explicite.
- `PUT /api/collections/enrolledStudents` exige l'admin côté serveur.
- `profileSchema.email` valide enfin une vraie adresse (ou la chaîne vide).
- `apiErrorHandler` ne renvoie plus `err.message` en production.

**Rate limit** — extrait en fabrique `createRateLimit` dans
`server/middleware/rateLimit.ts`. L'ancienne version tenait une `Map` au niveau
du module ; une fabrique donne une `Map` par instance, donc l'isolation devient
structurelle. La fuite mémoire de cette `Map` est corrigée par un balayage
périodique. Trois instances : `ai-review` 60 s/10 (**comportement préservé**),
`login` 15 min/10, `setup` 15 min/5.

**Flux client** — `App` ne fait plus que `useAuth()` et choisit l'écran ;
`AuthenticatedApp`, monté conditionnellement, porte `useBootstrap()`. Les hooks
ne pouvant être conditionnels, c'est ce découpage qui garantit qu'aucun appel à
`/api/state` ne part sans session. **La structure d'`AcademyApp` n'est pas
touchée** — 800 lignes, la surface de modification devait rester minimale.

Un 401 sur n'importe quelle requête émet un `CustomEvent`
(`propdesk:unauthenticated`) écouté par `useAuth`, qui ramène à l'écran de
connexion avec « Ta session a expiré ». Sans cela, `useSyncedState` avalerait le
401 en `console.warn` et l'utilisateur continuerait de travailler en croyant que
ses données se sauvegardent.

**Changement de mot de passe forcé** — `App()` intercale un troisième écran
entre la connexion et l'application : si `status === "authenticated"` et
`user.mustChangePassword`, `ChangePasswordScreen` s'affiche et **rien d'autre
ne se monte**, notamment pas `AuthenticatedApp`/`useBootstrap` — cohérent avec
le blocage serveur qui refuserait `/api/state` de toute façon.

**Gestion de l'équipe** — `StaffAccountsModal.tsx`, ouverte depuis le bouton
« Gérer l'équipe » de `UserProfileModal`. Nécessite `currentStaffId`
(`user.id` de `useAuth`), fourni en filetant une nouvelle prop `currentStaffId`
de `App` → `AuthenticatedApp` → `AcademyApp` — **`null` hors ligne**, aucune
session à interroger sans serveur ; la modale n'est alors pas rendue. Le mot de
passe temporaire d'une invitation est tenu dans un état local **volatil**
(effacé à la fermeture de la modale) : il n'est jamais récupérable après coup,
y compris par cette modale elle-même.

### 4 bis. `isOwner` : la seule exception aux droits égaux

**Ce que c'est.** Le compte fondateur — celui créé à l'installation par
`/auth/setup` — est le seul à pouvoir **masquer ou réafficher les modules** de
la sidebar. Rien d'autre. Un coach invité garde l'intégralité des droits
métier : journal, suivi des élèves, portefeuilles, invitation et révocation de
collègues.

**Pourquoi cette exception existe.** `hiddenSidebarItems` vit sur le profil du
**bureau partagé**, pas sur le compte. Un coach qui masquait un module le
masquait donc pour tout le monde, fondateur compris, sans que personne ne
comprenne d'où venait le changement. Ce n'était pas un réglage personnel qui
avait fuité : c'était un réglage global à la portée de tous.

**Comment le drapeau se lit.** `invited_by IS NULL` dans `staff_accounts` —
vrai pour le seul compte de `/auth/setup`, renseigné pour tous les invités.
Aucune colonne ni migration n'a été ajoutée : le schéma portait déjà
l'information.

**Trois pièges déjà désamorcés, ne les réintroduis pas :**

1. **`isAdmin` n'a pas été réutilisé.** Il reste vrai pour tout le monde. S'en
   servir aurait retiré aux coachs le suivi des élèves et l'écriture des
   collections admin — bien plus que ce qui était demandé. `isOwner` est un
   champ distinct, et il doit le rester.
2. **`ON DELETE SET NULL` sur `invited_by`.** Supprimer un coach qui en avait
   invité d'autres remettait leur `invited_by` à `NULL`, donc les promouvait
   fondateurs. `deleteStaffAccount` réaffecte désormais les filleuls au
   fondateur **dans la même transaction**, avant la suppression.
3. **Le compte fondateur n'est plus supprimable** (409). Sans lui, plus aucun
   compte ne pourrait régler les modules visibles — état irrécupérable, aucune
   procédure de secours n'existant.

**Le serveur fait autorité, pas l'interface.** `PUT /api/profile` **réinjecte**
la valeur en base quand l'appelant n'est pas fondateur — il ne rejette pas la
requête. `hiddenSidebarItems` voyage dans le même objet que le nom, l'avatar et
le capital, tous légitimement modifiables par un coach : un 403 global lui
interdirait de modifier son profil à cause d'un champ qu'il n'a pas touché.
C'est le même motif que `isAdmin`, déjà en place.

**Hors ligne, `isOwner` est faux pour tout le monde**, y compris le fondateur :
sans serveur, aucune identité n'est vérifiable. Le réglage redevient
disponible à la reconnexion.

### Poids des images

Les avatars téléversés sont **réduits à 256×256 avant d'entrer dans l'état
applicatif** ([`src/lib/image.ts`](src/lib/image.ts)). C'est indispensable :
`StudentProfile.avatar` est sérialisé en JSON, donc une image brute pèserait
son poids majoré d'un tiers (base64) **à trois endroits à la fois** — la base,
chaque réponse de `/api/state`, et le cache `localStorage`.

Le recadrage est centré et carré, ce qui reproduit exactement l'affichage
(`object-cover` dans un cercle) : recadrer ici ne retire donc rien qui aurait
été visible. La sortie est du **WebP** quand le navigateur sait en produire,
du **JPEG** sinon — avec dans ce cas un fond `#111615` peint sous l'image, car
le JPEG n'a pas de canal alpha et les zones transparentes viraient au noir.

`createImageBitmap(file, { imageOrientation: "from-image" })` est préféré
quand il existe : il **redresse l'image selon son orientation EXIF**, ce que
les photos prises au téléphone exigent.

**Mesuré de bout en bout :**

| | Avant | Après |
|---|---|---|
| Avatar en base | 4 031 890 car. | **42 879 car.** |
| Réponse `GET /api/state` | 4 073 590 o | **84 579 o** |
| Total `localStorage` | 4 072 905 car. | **83 894 car.** |
| Fichier `horizon.db` | 8,2 Mo | **200 ko** |

Téléversement testé avec `public/logo.png` (1,19 Mo, 1536×1024) → **4 839
caractères** en WebP 256×256, soit une réduction de 327×.

Le garde-fou de `handleFileUpload` est passé de 5 à **20 Mo** et porte
désormais sur le **décodage**, plus sur le stockage : après réduction, la
taille du fichier d'origine n'a plus d'incidence.

### Identité visuelle

- Logo PropDesk intégré : `public/icon.png` (recadrage 512×512 de l'icône) dans
  la sidebar, en favicon et en icône iOS.
- **Palette unifiée** sur les 10 vues, le centre d'alertes **et les 9 modales**
  (jetons et règle de conservation en §8). **Vérifié** : les 9 modales
  n'utilisent plus que les jetons `#0D1110`, `#111615`, `#1B2320`, `#232D29`,
  `#00E676`, `#00c865`.

Il reste **8 occurrences de `bg-slate-*` / `border-slate-*`** dans `src/`,
toutes délibérées ou anodines : le gris du coach hors ligne
([`CoachMessaging.tsx:150`](src/components/CoachMessaging.tsx:150)), et des
survols sur des surfaces neutres de la sidebar et du header. Le texte
(`text-slate-*`) n'a jamais été concerné par la migration.

---

## 5. Fichiers créés ou modifiés

### Créés

**Persistance serveur** (chantier « base de données ») :

| Fichier | Rôle |
|---|---|
| `server/db.ts` | connexion SQLite, schéma, migration `staff_accounts` |
| `server/repositories.ts` | couche d'accès aux données |
| `server/routes.ts` | routes `/api/*`, barrière `requireAuth` |
| `server/schemas.ts` | validation zod |
| `server/seed.ts` | amorçage et import |
| `src/lib/api.ts` | client HTTP typé, interception du 401 |
| `src/hooks/usePersistentState.ts` | état miroité dans localStorage |
| `src/hooks/useServerSync.ts` | bootstrap + synchronisation optimiste |

**Authentification et comptes staff** :

| Fichier | Rôle |
|---|---|
| `server/auth/password.ts` | hachage scrypt, vérification, re-hachage, hash factice |
| `server/auth/sessions.ts` | jetons, cookie, purge, lecture du cookie |
| `server/auth/credentials.ts` | accès à `staff_accounts` (identité, invitation, révocation) |
| `server/auth/routes.ts` | `authRouter` (public) + `staffRouter` (protégé) |
| `server/auth/middleware.ts` | `requireAuth`, `requireAdmin` |
| `server/middleware/rateLimit.ts` | fabrique de limiteur, extraite de `routes.ts` |
| `src/hooks/useAuth.ts` | état d'authentification côté client, `changePassword` |
| `src/components/auth/AuthShell.tsx` | coque et primitives des écrans d'auth |
| `src/components/auth/LoginScreen.tsx` | écran de connexion |
| `src/components/auth/SetupScreen.tsx` | écran de première installation |
| `src/components/auth/ChangePasswordScreen.tsx` | changement forcé (mot de passe temporaire) |
| `src/components/StaffAccountsModal.tsx` | invitation, liste, révocation des comptes staff |

**Images et identité visuelle** :

| Fichier | Rôle |
|---|---|
| `src/lib/image.ts` | réduction des images téléversées avant stockage |
| `public/icon.png` | icône 512×512 — sidebar, favicon, icône iOS |
| `public/logo-auth.jpg` | logo 768×512 (38,8 ko) des écrans d'auth |
| `public/logo.png` | source haute résolution, fournie par l'utilisateur |

**Outillage et documentation** :

| Fichier | Rôle |
|---|---|
| `.claude/launch.json` | configuration du serveur de prévisualisation (`horizon-dev`) |
| `README.md` | réécrit intégralement — documentation utilisateur |
| `HANDOFF.md` | ce document — documentation de reprise |

### Renommé

| Avant | Après |
|---|---|
| `src/components/AISetupAnalyzerModal.tsx` | `src/components/SetupAnalyzerModal.tsx` |

### Modifiés en profondeur

| Fichier | Nature des changements |
|---|---|
| `src/App.tsx` | **porte d'authentification** (`App` → `AuthenticatedApp` → `AcademyApp`), bootstrap serveur, 12 `useSyncedState`, câblage des modales, `handleLogout`, gardes admin, filetage de `currentStaffId` |
| `src/components/Sidebar.tsx` | masquage admin, `TabType`, logo, clés stables, section OUTILS, `renderSection`, bouton de déconnexion, pied non défilant |
| `src/components/UserProfileModal.tsx` | `useEffect` sur `isOpen`, palette, réduction des avatars, retrait du bouton « Activer Admin », bouton « Gérer l'équipe » |
| `src/components/TradingJournal.tsx` | horodatages de sortie, CSV, palette |
| `src/components/StudentTracking.tsx` | style de trading, palette, statuts |
| `src/components/TopHeader.tsx` | 5 boutons retirés, fil d'ariane, props mortes retirées |
| `src/components/MainDashboard.tsx` | props mortes retirées (`onOpenCalculator`, `onOpenCalendar`) |
| `src/types.ts` | `exitDate`, `exitTime`, `TradingStyle`, `hiddenSidebarItems`, `TradeDraft` |
| `src/data/mockData.ts` | horodatages de sortie, styles de trading |
| `server.ts` | simplifié, chemins via `process.cwd()`, JSON 8 Mo + parseur 16 ko sur `/api/auth`, purge des sessions au démarrage |
| `index.html` | favicon et icône iOS |
| les 8 autres modales et 9 autres vues | migration de palette (slate → jetons du tableau de bord) |

### « Audit Setup » n'est pas une fonction IA

Le module note un setup à partir de **six cases à cocher pondérées**, en local
et de façon déterministe : aucun appel réseau, aucun modèle. Il s'appelait
`AISetupAnalyzerModal` et s'annonçait « Audit & Scoring de Trade SMC IA », ce
qui était faux. **Décision de l'utilisateur : ce module ne doit pas se
présenter comme boosté à l'IA.** Renommé `SetupAnalyzerModal`, titré « Audit &
Scoring de Setup SMC », icône `Target` au lieu de `Sparkles` (réservée à l'IA
dans cette application), et la note transférée au journal parle de « matrice de
confluences ».

La **seule** fonction Gemini réellement branchée est `TradeAuditModal`, via
`/api/coach/ai-review` — plus la réponse du coach dans la messagerie
(`handleSendMessage` dans [`App.tsx:426`](src/App.tsx:426)).

### « Déconnexion » ferme réellement la session

Le bouton vit dans le pied de la sidebar (`Sidebar.tsx`, prop `onLogout?`),
câblé à `handleLogout` dans `App.tsx`. Il appelle `api.logout()` — qui supprime
la session **en base** et le cookie — puis vide le cache `localStorage` et
repasse `useAuth` en `unauthenticated` via `onLoggedOut()`.

Le cache est effacé **délibérément** : hors ligne, l'application démarre sur ce
cache sans pouvoir vérifier d'identité (§6.2), le laisser en place après une
déconnexion volontaire rendrait le verrou contournable sur la machine.

Il **refuse d'agir hors ligne** : le cache est alors la seule copie des données
et le vider serait une perte sèche. Message explicite plutôt que destruction
silencieuse.

Le corps est enveloppé d'un `try/finally` : même si `api.logout()` ou
`localStorage.clear()` lève, l'écran de connexion s'affiche. Ce durcissement
vient d'un signalement « le bouton ne fonctionne pas » dont la cause réelle
était le HMR cassé de Vite (corrigé depuis, §8) laissant tourner l'ancien
code — mais un
échec silencieux était le symptôme le plus trompeur possible, d'où le filet.

`confirm()` est lui-même dans un `try/catch` : certains contextes (iframe
sandboxée, extension bloquant les dialogues natifs) le font **lever** plutôt
que renvoyer `false`, ce qui laissait le clic sans aucun effet ni message.

### Supprimé

- `src/components/CertificateModal.tsx` (140 lignes) et toutes ses traces —
  entrée de sidebar, état et rendu dans `App.tsx`, ligne « Attestation &
  Certificat Officiel » du catalogue PDF (`scripts/generate_pdf.js`, PDF
  régénéré). **Décision de l'utilisateur : un certificat d'académie n'a aucune
  valeur juridique, la fonctionnalité n'avait donc pas d'utilité.** Ne pas la
  réintroduire.
- `src/components/Navbar.tsx` (187 lignes, remplacé par `Sidebar` + `TopHeader`,
  plus aucun import).
- Dépendance `motion` (déclarée, jamais importée).

---

## 6. Bugs connus et limites

Classés du plus au moins gênant.

### 1. Le rejeu hors ligne remplace des collections entières

Corrigé pour l'essentiel : les modifications hors ligne ne sont plus perdues au
rechargement, un bandeau les propose à la reconnexion (§8, « Modifications hors
ligne »). La limite qui subsiste est la granularité — envoyer remplace la
collection **en bloc**. Si un collègue a modifié la même collection pendant la
coupure, son travail est écrasé. Le bandeau le dit explicitement, et c'est
pourquoi l'envoi n'est jamais automatique.

### 2. Le verrou ne protège pas le cache local

L'authentification existe désormais (§4, « Authentification »), mais **le mode
hors ligne la contourne** : si le serveur ne répond pas, l'application démarre
sur le cache `localStorage` sans écran de connexion, faute de pouvoir vérifier
quoi que ce soit.

**C'est une décision de l'utilisateur**, prise en connaissance de cause : elle
préserve le filet anti-perte de données. Le cache est effacé à la déconnexion
volontaire, mais quelqu'un ayant accès physique à la machine et coupant le
serveur verrait les données. Ne présente donc pas cet écran comme une barrière
d'accès — ce n'en est pas une contre un tiers présent devant l'écran.

Les deux alternatives ont été écartées : bloquer hors ligne ferait perdre les
modifications non synchronisées le jour où le serveur ne redémarre pas, et le
mode lecture seule demandait de désactiver les actions d'écriture dans les dix
vues.

### 3. Plusieurs comptes, mais aucun cloisonnement de données

**Les comptes multiples sont faits** (§4 « Authentification ») : n'importe
quel nombre de comptes staff peut se connecter séparément. Mais c'est un
**bureau partagé**, pas du multi-tenant — décision explicite de l'utilisateur
(« le staff seulement », « tous égaux »). Personne n'a de données privées :
tous les comptes voient et modifient les mêmes trades, élèves, portefeuilles.

Ce que ce choix laisse délibérément non fait, si le besoin change un jour vers
des bureaux réellement séparés par personne :

- aucun repository ne filtre par identité de session — tout retombe sur
  `DEFAULT_USER_ID`, quel que soit le compte connecté (c'est précisément ce qui
  a permis d'ajouter les comptes staff sans toucher aux repositories) ;
- `forum_replies` n'a **pas** de `user_id` (rattachement indirect par `topic_id`) ;
- `isBootstrapped()` reste un drapeau **global** dans `meta` ;
- le forum identifie les auteurs par **chaîne de nom**, sans `authorId` ;
- les clés `localStorage` sont **globales**, sans namespace par compte ;
- `EnrolledStudent` n'a toujours aucun lien avec un compte staff — ce sont des
  fiches de suivi, pas des comptes (voir §3 « Inventaire »).

Faire cela demanderait de reprendre chaque repository pour accepter un
`userId` réel (la signature existe déjà mais n'est jamais alimentée), de
trancher quelles collections resteraient partagées (modules vidéo, signaux
coach ?) contre lesquelles deviendraient privées par bureau, et de décider du
lien entre `EnrolledStudent` et un compte réel. Chantier bien plus grand que
l'ajout de comptes staff — ne pas le confondre avec lui.

### 4. Aucun lien entre un trade et un compte

`Trade` n'a pas d'`accountId`. Le journal ne peut donc pas être filtré par
portefeuille, et `tradesCount` d'un `TradingAccount` est une valeur saisie, pas
un calcul.

Une prop `onSelectAccountForJournal` traînait dans `WalletManagement` et
laissait croire que ce filtrage n'attendait qu'un branchement — elle était
déclarée, déstructurée, jamais appelée, jamais transmise. **Elle a été
supprimée** : le commentaire qui la remplace en tête de
[`WalletManagement.tsx`](src/components/WalletManagement.tsx) explique pourquoi.
Le vrai chantier est décrit en §7, tâche 2.

### 5. Données existantes sans les nouveaux champs

Les trades et élèves déjà en base ont été créés avant l'ajout de `exitDate`,
`exitTime` et `tradingStyle`. Les vues gèrent l'absence proprement (mention
*sortie non renseignée*, pastille masquée), mais **les valeurs mises dans
`mockData.ts` ne s'appliquent qu'à une base neuve**.

> **`rm -rf data/` détruit de vraies données.** Le profil en base est celui de
> l'utilisateur (« ForexPaps », capital 100 000 € / 102 450 €), pas le profil
> de démonstration de `mockData.ts` (« Alexandre Vance »). Les styles de
> trading des 4 élèves ont été saisis **à la main via l'interface**, ils ne
> sont pas amorcés. Une remise à zéro perd tout cela. Sauvegarde d'abord :
>
> ```bash
> cp data/horizon.db data/horizon.db.bak
> ```
>
> Ne laisse pas cette sauvegarde derrière toi une fois la tâche terminée : le
> répertoire `data/` a déjà accumulé plusieurs bases orphelines au fil des
> sessions passées (`horizon 2.db`, `horizon.db.bak`, `horizon.db.avant-auth`),
> toutes nettoyées depuis.

### 6. Aucun test automatisé

Le projet n'a pas de *runner*. En ajouter un est une décision à part entière.
Voir §9 pour ce qui a réellement été vérifié, et comment.

### 7. SQLite sur disque éphémère

Sur Cloud Run (cible naturelle vu l'origine AI Studio), le disque est éphémère
et **les données seraient perdues à chaque redémarrage d'instance**. Monter un
volume sur `DATA_DIR`, ou passer à Postgres. Seul `server/repositories.ts` est
à réécrire : les routes n'y touchent pas.

---

## 6 bis. Ce qui ressemble à du code mort, mais ne l'est pas

Trois pièges où un repreneur pressé supprimerait du code encore utile.

### La vue `CoachSignals` n'a plus d'entrée de sidebar

Elle a été retirée de la section FORMATION (`84e5e33`) à la demande de
l'utilisateur. Mais l'onglet `signals` **reste atteignable** par la
notification « Signal Coach SMC Actif » du centre d'alertes, dont le
`targetTab` pointe dessus
([`mockData.ts:1415`](src/data/mockData.ts:1415)). Le composant, l'onglet et la
collection `signals` (4 signaux en base) sont donc bien vivants.

### L'onglet `exam` est vide volontairement

Il affiche « Contenu à venir », rendu **en ligne dans `App.tsx`**
([`App.tsx:773`](src/App.tsx:773)) — il n'a pas de composant dédié.
L'utilisateur a explicitement demandé une page vierge en attendant de définir
le contenu. Ne pas la supprimer ni la remplir sans lui demander.

### `public/logo.png` n'est utilisé nulle part

Ce fichier de 1,1 Mo est la **source haute résolution** du logo. Les écrans
d'authentification utilisent `public/logo-auth.jpg` (768 px, ~39 ko), généré
depuis lui. `public/icon.png` (512×512) sert dans la sidebar, en favicon et en
icône iOS. Ne supprime pas `logo.png` : c'est l'original dont dérivent les deux
autres.

Note d'outillage : `sips` **liste** WebP dans ses formats mais échoue
silencieusement à en écrire — d'où le JPEG. L'original n'a pas de canal alpha
(`sips -g hasAlpha` → `no`), le JPEG ne perd donc rien.

---

## 6 ter. Arbitrages déjà rendus

Ces débats ont eu lieu et sont tranchés. Ne pas les rouvrir sans que
l'utilisateur le demande.

| Sujet | Décision |
|---|---|
| Statut « Accompagnement VIP » | **supprimé** — devenu indistinguable de « Prop Firm Financé » une fois la vue passée au vert |
| Bouton « Lecture » du suivi élèves | **passé au vert** en connaissance de cause : il ne se distingue plus d'« Éditer Fiche » par la couleur |
| Modale « Certificat » | **supprimée** — sans valeur juridique, donc sans utilité |
| « Badges & paliers » en sidebar | **retiré** — les badges restent dans le profil, onglet Badges |
| Les 5 modales orphelines | **remises dans la sidebar** (section OUTILS + « Exercice du jour ») |
| Harmonisation des 9 modales | **faite** |
| « Audit Setup » présenté comme IA | **corrigé** — c'est une matrice de confluences déterministe |
| Stockage des avatars | **redimensionnement côté client**, pas de route d'upload — l'avatar reste dans le profil, ce qui préserve le repli hors ligne (une URL ne résoudrait plus sans serveur) |
| Avatar de 4 Mo déjà en base | **recompressé sur place**, la photo de l'utilisateur est conservée |
| Périmètre de l'authentification | **comptes staff multiples, bureau unique partagé** — pas de multi-tenant, aucune donnée privée par compte (§6.3) |
| Qui peut avoir un compte | **le staff seulement** — les fiches élèves (`EnrolledStudent`) restent des dossiers de suivi, jamais des comptes |
| Droits par compte | **égaux sur le métier** — avoir un compte staff suffit à tout faire sur les données. Une seule exception, `isOwner` (§4 bis) |
| Masquage des modules | **réservé au compte fondateur** — le réglage appartient au bureau partagé, un coach le changerait pour tout le monde |
| Suppression du compte fondateur | **refusée** — il est l'ancre d'`isOwner` ; le perdre laisserait le bureau sans personne pour régler les modules |
| Créer un nouveau compte | **invitation depuis l'interface** (`StaffAccountsModal`), mot de passe temporaire généré côté serveur, jamais choisi par l'inviteur |
| Hachage des mots de passe | **scrypt de `node:crypto`**, aucune dépendance ajoutée — argon2 et bcrypt écartés (compilation native, aucun gain réel à cette échelle) |
| Premier mot de passe | **écran de première installation**, pas de variable d'environnement ni de script — aucun mot de passe par défaut dans le dépôt |
| Sessions multi-appareils | **autorisées** — la connexion ne révoque pas les autres sessions, la déconnexion ne ferme que la session courante |
| Accès hors ligne | **conservé** — le verrou n'est donc pas une barrière physique (§6.2). Bloquer ou passer en lecture seule ont été écartés |
| Longueur minimale du mot de passe | **10 caractères**, sans contrainte de composition |
| Suppression du dernier compte | **refusée par le serveur** — aucune procédure de récupération n'existe si plus aucun compte ne peut se connecter |
| `onSelectAccountForJournal` | **non tranché** — demande une décision produit |
| Rejeu des modifications hors ligne | **non tranché** — coût élevé, à ne faire que sur demande |

---

## 7. Prochaines tâches, dans l'ordre

### 1. Remplir le module « Examen »

L'onglet `exam` existe mais **affiche une page vierge** avec le texte « Contenu
à venir » ([`App.tsx:933`](src/App.tsx:933)). L'utilisateur a demandé cette
page vierge en attendant de définir le contenu. Lui demander ce qu'il veut y
mettre avant de coder.

### 2. Rattacher les 6 trades existants à un compte

Le rattachement existe (§8), l'édition d'un trade aussi (bouton crayon dans le
journal), mais les six trades déjà en base restent **« Non rattaché »** : rien
ne permettait de deviner leur compte, et l'inventer aurait été pire que de
laisser le champ vide. C'est à l'utilisateur de les assigner un par un. Ce
n'est pas un bug, et personne d'autre que lui ne peut le faire à sa place.

### 3. Le PnL proposé à la création est faux

`pnlDepuis()` dans [`TradingJournal.tsx`](src/components/TradingJournal.tsx)
applique un multiplicateur de 1 000 à tout instrument. Sur les six trades
d'origine : 9 € au lieu de 900 (EUR/USD), −50 000 au lieu de −300 (NAS100),
1 050 000 au lieu de 1 050 (BTC/USDT), 36 000 au lieu de 1 200 (XAU/USD).

Ce n'est plus dangereux — le PnL est un champ saisissable, la formule n'est
qu'une proposition affichée que l'utilisateur corrige, et l'édition ne
recalcule jamais. Mais la proposition reste inutile tant qu'elle ignore la
taille de contrat de l'instrument. La corriger demande de connaître ces
tailles (100 000 par lot en forex, 1 pour un indice CFD, etc.) : c'est une
table à établir avec l'utilisateur, pas une constante à deviner.

### 4. Fusion ligne à ligne des modifications hors ligne

Le rejeu hors ligne existe (§8, « Modifications hors ligne »), mais il remplace
des **collections entières**. Une fusion par élément, le plus récent gagnant,
supprimerait l'arbitrage manuel — au prix d'un horodatage par élément et d'une
réécriture de la synchronisation. Écarté volontairement pour l'instant : le
bandeau couvre le besoin sans risquer de perdre le travail d'un collègue.

### Ce qui n'est PAS une tâche

- **Le cloisonnement des données par compte** (§6.3). Le bureau partagé est un
  choix explicite, pas un manque. Ne l'entreprends que si l'utilisateur
  demande des espaces réellement séparés.
- **Donner des comptes aux élèves.** Tranché : les élèves restent des fiches de
  suivi, seul le staff se connecte.
- **Étendre `isOwner` à autre chose que le masquage des modules.** C'est une
  exception délibérément unique, pas l'amorce d'un système de rôles (§4 bis).
  Les droits métier restent égaux pour tous les comptes staff.

---

## 8. Décisions techniques importantes

### Le typage était un mensonge — ne pas y revenir

À la reprise, **`@types/react` n'était pas installé** et `noImplicitAny` était
désactivé. Tout le code React était donc silencieusement typé `any` : aucune
prop n'a jamais été vérifiée, et `npm run lint` était vert **pour cette
raison**.

Une fois les types réels en place, exactement **deux erreurs** sont apparues —
et c'étaient deux vrais bugs qui rendaient des fonctionnalités inaccessibles
(modale certificat qui plantait, calculateur qui ignorait le capital). Le reste
du code s'est révélé conforme à `strict`, qui a donc été activé gratuitement.

**Ne jamais désactiver `strict` ni retirer `@types/react`.**

### Palette : jetons du tableau de bord

Le tableau de bord fait référence. Les autres vues utilisaient une palette
`slate` bleutée ; elles ont été migrées vers :

| Rôle | Jeton |
|---|---|
| Fond de page | `#0A0E0D` (sidebar) / `#0B0F0E` (corps) |
| Fond en creux | `#0D1110` |
| Surface de carte | `#111615` |
| Bordure de carte / pastille | `#1B2320` |
| Pastille haute | `#232D29` |
| Bordure de section | `#151D1A` |
| Fond d'entrée active | `#131B18` |
| **Vert de marque** | `#00E676` |
| Survol de bouton vert | `#00c865` |
| Survol de lien vert | `#69F0AE` |

Rayons : `rounded-2xl` pour les cartes, `rounded-xl` pour les éléments internes.

Correspondance utilisée lors de la migration — elle a été appliquée partout,
elle sert désormais de référence pour tout nouvel écran :

```
bg-slate-950 → bg-[#0D1110]     border-slate-800 → border-[#1B2320]
bg-slate-900 → bg-[#111615]     border-slate-700 → border-[#232D29]
bg-slate-800 → bg-[#1B2320]     border-slate-900 → border-[#151D1A]
bg-slate-700 → bg-[#232D29]
emerald-300/400/500 → [#00E676]     indigo-* → purple-*
```

**`hover:bg-slate-800` ne suit pas la table.** Il est toujours posé sur une base
`bg-[#1B2320]` : le traduire en `hover:bg-[#1B2320]` rendrait le survol
invisible. Il devient `hover:bg-[#232D29]`, la pastille haute.

Ambre conservé partout où il **porte un sens** : avertissement (« Axes
d'Amélioration », alerte de checklist, note du calendrier), palier de jauge
(drawdown > 50 %, conformité incomplète), état dans une échelle (badge « à
réclamer » face à débloqué/verrouillé, verdict B+ face à A+/non conforme,
phase de respiration), et le thème doré des récompenses (rang, XP, couronne).
Ailleurs il n'était qu'un accent : il est passé au vert de marque.

**Piège trouvé** : `slate-850` et `slate-750` étaient utilisés à 13 endroits.
**Ces nuances n'existent pas en Tailwind 4** et le projet n'a pas de
`tailwind.config` — ces éléments n'avaient donc *aucun* fond ni bordure. Vérifie
ce genre de nuance avant de la migrer.

**Couleurs conservées volontairement** (elles portent un sens) :

- la palette des 4 statuts élève, chacun devant rester distinguable ;
- l'ambre du type « risque » dans le centre d'alertes ;
- le rose des actions destructives (« Effacer », « Supprimer ») ;
- le gris d'un coach hors ligne dans la messagerie ;
- les couleurs par module du tableau de bord — vert (Journal), bleu (Examen),
  violet (Replay), ambre (Module vidéo) — reprises dans chaque vue
  correspondante.

### Le rechargement à chaud passe par le serveur d'Express

`server.ts` crée explicitement son `http.Server` au lieu de laisser
`app.listen()` s'en charger, puis le **passe à Vite** :

```ts
const httpServer = http.createServer(app);
const vite = await createViteServer({
  server: { middlewareMode: true, hmr: { server: httpServer } },
  appType: "spa",
});
```

**Ne retire pas `hmr: { server: httpServer }`.** C'est ce qui répare une panne
qui a coûté cher : en mode middleware, Vite ne connaît pas le serveur HTTP qui
l'héberge. Faute de pouvoir s'y greffer, il ouvrait son propre WebSocket sur le
port 24678, que personne ne servait — le navigateur tentait
`ws://localhost:24678` en boucle, échouait, et le rechargement à chaud ne
fonctionnait pas. Il fallait recharger la page à la main après chaque
modification.

Le coût réel n'était pas la gêne : c'est que **l'ancien code continuait de
tourner à l'écran**. Un signalement « le bouton Déconnexion ne fonctionne pas »
en est venu (§5), alors que le bouton était correct — la page exécutait une
version périmée. Tout symptôme inexplicable en développement doit faire
soupçonner cela en premier.

Vérifié par une preuve directe plutôt que par l'absence d'erreur : un témoin
posé dans `window`, puis un fichier modifié. Le texte à l'écran a changé **et**
le témoin a survécu — donc remplacement de module à chaud, et non rechargement
complet, qui l'aurait effacé. Le serveur n'écoute plus que sur un seul port.

Effet de bord utile : un seul port à exposer, ce qui fonctionne tel quel
derrière un tunnel ou un reverse proxy.

### Rattachement trades ↔ comptes

`Trade.accountId` (optionnel) relie un trade à un `TradingAccount`. Il alimente
le filtre « Compte » du journal, une colonne du tableau, la colonne « Compte »
de l'export CSV, et `positionsDuCompte` dans `WalletManagement`.

**Trois choix à ne pas défaire :**

1. **Le champ est optionnel, et doit le rester.** Les trades antérieurs n'en ont
   pas, et rien ne permet de deviner leur compte — les rendre obligatoires
   forcerait à en inventer un. « Non rattaché » est un état légitime, pas une
   anomalie à corriger.
2. **Un `accountId` introuvable vaut « non rattaché ».** Un compte supprimé
   laisse des références orphelines ; `nomDuCompte()` renvoie `null` et l'écran
   affiche « Non rattaché ». Ne transforme jamais ce cas en erreur.
3. **L'equity reste saisie à la main.** Seul le *nombre de positions* est
   dérivé. L'equity d'un compte prop firm intègre des dépôts, retraits, frais et
   trades non journalisés : la recalculer depuis le PnL du journal écraserait
   des montants justes par des montants faux. Décision explicite de
   l'utilisateur.

`TradingAccount.tradesCount` subsiste dans le type mais **n'est plus lu à
l'écran** : il valait 0 depuis la création de chaque compte et n'a jamais été
mis à jour. C'est `positionsDuCompte` qui fait foi.

### Modifier un trade : ne jamais recalculer le PnL

Le journal permet de modifier un trade existant (bouton crayon). La règle qui
gouverne cet écran tient en une phrase : **ouvrir une fiche ne doit changer
aucun chiffre que l'utilisateur n'a pas touché.**

Ce n'est pas une précaution théorique. `pnlDepuis()` applique un multiplicateur
de 1 000 à tout instrument, ce qui est faux partout :

| Trade | PnL réel | Ce que donne la formule |
|---|---|---|
| EUR/USD | 900 € | 9 € |
| NAS100 | −300 € | −50 000 € |
| BTC/USDT | 1 050 € | 1 050 000 € |
| XAU/USD | 1 200 € | 36 000 € |

Recalculer à l'enregistrement ferait donc exploser le capital au seul motif
qu'on a ouvert un trade pour lui affecter un compte. D'où le dispositif :

- **le PnL est un champ de formulaire**, pas une valeur dérivée ;
- en **création**, il suit la proposition calculée tant que l'utilisateur n'y a
  pas touché (`pnlTouche`), et cesse de bouger dès qu'il saisit un montant ;
- en **modification**, `pnlTouche` démarre à `true` : la valeur enregistrée est
  reprise telle quelle et rien ne l'écrase jamais.

Ce qui *est* recalculé sans risque : `riskRewardRatio`, pure géométrie des prix
(vérifié : redonne exactement les valeurs stockées) ; `result` et
`pnlPercentage`, qui dérivent du PnL retenu.

**`onUpdateTrade` reçoit `{ ...editingTrade, ...champs }`**, dans cet ordre. Le
premier terme conserve l'`id` et surtout **`aiAudit`**, qui n'existe dans aucun
champ du formulaire : l'omettre effacerait l'audit IA à la première
modification. Vérifié en base après édition d'un trade audité.

`App.handleUpdateTrade` rafraîchit aussi `selectedTradeForAudit` si la modale
d'audit est ouverte sur ce trade, sinon elle garde une copie périmée.

### Modifications hors ligne

Sans serveur, l'application tourne sur le cache `localStorage`. Auparavant, le
rechargement suivant reprenait l'état du serveur et **les modifications hors
ligne disparaissaient sans un mot**. Trois pièces corrigent cela :

- **`src/lib/pendingChanges.ts`** — registre des collections modifiées hors
  ligne, dans `localStorage` pour survivre à la fermeture de l'onglet.
  `useSyncedState` y inscrit une clé dès qu'elle change alors que la
  synchronisation est désactivée.
- **`useBootstrap` saute `cacheState()`** quand le registre n'est pas vide.
  C'est **le** point critique : `cacheState` recopie l'état serveur par-dessus
  le cache local, il détruisait donc les modifications avant même qu'on ait pu
  les proposer.
- **`PendingChangesBanner`** — l'utilisateur envoie ou abandonne.

**Pourquoi jamais d'envoi automatique.** Le bureau est partagé et les
collections sont remplacées en bloc : renvoyer le cache sans rien demander
écraserait ce qu'un collègue aurait modifié pendant la coupure. L'arbitrage
revient donc à qui sait ce que contiennent ces modifications.

**Détails qui ont chacun coûté un bug :**

- `discardPending()` doit appeler `clearPending()`, pas seulement `setPending([])` :
  l'état React disparaît au rechargement qui suit, c'est le registre
  `localStorage` qui est relu au démarrage. Sans cela le bandeau réapparaissait
  aussitôt après avoir été abandonné.
- Le rejeu lit les valeurs **dans `localStorage`**, pas dans l'état React :
  celui-ci affiche la version du serveur, alors que le cache porte la version
  hors ligne — c'est bien celle-ci qu'on veut renvoyer.
- Les clés sont envoyées **séquentiellement** ; une clé en échec **reste en
  attente** et sera reproposée, plutôt que d'être perdue silencieusement.
- L'effet qui recalcule `student.currentCapital` doit renvoyer `prev` à
  l'identique quand la valeur ne bouge pas. Un nouvel objet à chaque montage
  suffisait à marquer le profil « modifié » : le bandeau annonçait alors des
  modifications inexistantes à chaque démarrage hors ligne (et déclenchait un
  `PUT /api/profile` inutile en ligne).

**Comment le tester** sans attendre une vraie panne : servir `dist/` avec un
serveur qui renvoie 503 sur `/api/*`. Même origine, donc même `localStorage`,
et le client voit exactement ce qu'il verrait si le serveur ne répondait plus.
Tuer le serveur ne marche pas — la page elle-même ne se chargerait plus.

### Découpage du bundle

Le client partait en **un seul fichier de ~944 ko**. Il est maintenant réparti,
selon deux mécanismes complémentaires qu'il ne faut pas confondre :

1. **`manualChunks` dans `vite.config.ts`** sépare les dépendances tierces du
   code applicatif — `charts` (recharts et sa famille `d3-*`), `react`,
   `vendor`. Elles changent rarement : le navigateur les garde en cache d'un
   déploiement à l'autre au lieu de les retélécharger à chaque correction.

   C'est une **fonction**, pas la forme courte `{nom: ['paquet']}`. Cette
   dernière compare des identifiants de module exacts : `react` est importé
   comme `react/jsx-runtime` et `react-dom` comme `react-dom/client`, elle
   produisait donc des blocs **vides**. Ne reviens pas à la forme courte.

   `jspdf` n'y figure pas volontairement : il n'est utilisé que par
   `scripts/generate_pdf.js`, sous Node, et n'entre pas dans le bundle client.

2. **`React.lazy` sur les vues d'onglet** (`App.tsx`) sort chaque vue dans son
   propre fichier, récupéré au premier affichage de l'onglet. Une seule vue est
   montrée à la fois ; les neuf autres n'ont pas à être téléchargées d'emblée.

**Ce qui reste en import direct, et pourquoi :**

- `MainDashboard` — onglet d'arrivée et repli de tout onglet devenu
  inatteignable. Le différer ajouterait une attente au démarrage sans rien
  économiser.
- **Les modales.** Elles sont montées en permanence et pilotées par une prop
  `isOpen` : un `lazy` les chargerait immédiatement, sans gain. Les rendre
  conditionnelles remettrait leur état interne à zéro à chaque ouverture — ce
  serait un changement de comportement, pas une optimisation.

3. **`React.lazy` sur la courbe de progression** (`EquityCurveChart.tsx`).
   `recharts` est la plus grosse dépendance du client et `MainDashboard` —
   l'écran d'arrivée — s'en servait, elle partait donc dans le chargement
   initial. Le graphique est désormais chargé après l'affichage de la page.

   **Piège rencontré :** `EquityCurveChart.tsx` ne doit **jamais** être importé
   statiquement. Rollup fusionne dans le chunk principal tout module à la fois
   importé statiquement et dynamiquement — le `React.lazy` devient décoratif et
   `recharts` repart dans le bundle initial, **sans le moindre avertissement**.
   C'est arrivé au premier essai, parce que le gabarit d'attente était exporté
   depuis ce même fichier. Il vit maintenant dans `MainDashboard.tsx`.

   Le gabarit occupe exactement la hauteur du graphique (`h-64`) : sans cela, la
   page remonterait puis redescendrait à l'arrivée de la courbe, déplaçant des
   boutons sous le curseur.

Résultat : le chargement initial passe de **944 ko à 475 ko** (255 → ~139 ko
gzippé), dont 176 ko de code applicatif contre 322. Une seule frontière
`Suspense` couvre toutes les vues : elles s'excluent mutuellement.

**Comment vérifier que le découpage tient**, plutôt que de se fier à la liste
des fichiers produits : `dist/index.html` ne doit précharger (`modulepreload`)
que `react` et `vendor`. Si `charts` y réapparaît, quelqu'un a réintroduit un
import statique.

### Tailwind 4, sans fichier de configuration

Le projet utilise `@tailwindcss/vite` et **n'a pas de `tailwind.config.js`**.
Toutes les couleurs de marque sont écrites en notation arbitraire
(`bg-[#111615]`). Il n'y a donc **aucun nom de jeton à étendre** : si tu veux
en introduire, c'est un choix d'architecture à proposer, pas à faire en
passant.

### Ajouter un champ ne demande pas de migration

`profileSchema` et `collectionItem` sont en **`.passthrough()`** (zod), et les
objets sont stockés en **colonne JSON**. Ajouter un champ à `Trade`,
`StudentProfile` ou `EnrolledStudent` ne demande donc **aucun changement
serveur ni migration SQL**.

C'est ainsi qu'ont été ajoutés `exitDate`, `exitTime`, `tradingStyle` et
`hiddenSidebarItems`. Rends les nouveaux champs **optionnels** : les données
existantes ne les auront pas.

La contrepartie : le serveur ne valide que ce qui lui est indispensable
(un `id` non vide, des bornes de taille, l'unicité des identifiants). Le
contrat de forme réel reste `src/types.ts`. **Ne redéclare pas les types métier
dans `schemas.ts`** : cela créerait deux sources de vérité à garder
synchronisées.

### Remplacement de collection entière, pas de mutation partielle

`PUT /api/collections/:name` **remplace** tout, dans une transaction. Ce n'est
pas de la paresse : le client détient toujours le tableau complet en mémoire et
chaque action produit un nouveau tableau complet. Remplacer correspond donc
exactement à sa sémantique, et l'opération est idempotente — un renvoi après
échec réseau ne peut pas dupliquer.

### Toujours la forme fonctionnelle de `setState`

Un bug réel a été introduit puis corrigé : lire `student` depuis la closure du
rendu faisait que **deux bascules dans le même lot de rendu partaient de la
même valeur**, et la seconde écrasait la première.

```tsx
// NON — perd une mise à jour si deux surviennent dans le même lot
const hidden = student.hiddenSidebarItems ?? [];
setStudent({ ...student, hiddenSidebarItems: [...hidden, key] });

// OUI
setStudent((prev) => ({ ...prev, hiddenSidebarItems: [...(prev.hiddenSidebarItems ?? []), key] }));
```

### Une valeur affichée doit être une valeur enregistrable

Piège rencontré deux fois. Quand un menu affiche une valeur par défaut pour une
donnée absente, **aligne l'état du formulaire sur ce qui est affiché à
l'ouverture** :

```tsx
setEditForm({ ...student, tradingStyle: student.tradingStyle ?? "Intraday" });
```

Sans cela, le menu montre « Intraday » mais enregistrer sans y toucher laisse
le champ vide. L'écran mentirait sur ce qui va être sauvegardé.

Même famille de piège : `UserProfileModal` reste montée entre deux ouvertures,
donc un `useState(initialTab)` ne se réévalue jamais. Il a fallu un `useEffect`
sur `isOpen`.

### Clés stables, indépendantes des identifiants d'onglet

`SIDEBAR_TOGGLEABLE_KEYS` n'utilise pas les `id` d'onglet parce que **« Replay »
et « Sim propfirm » pointaient tous deux sur `simulator`**. Les distinguer par
`id` aurait masqué les deux ensemble.

Pour la même raison, la clé de l'entrée « Prop Firm » de la section OUTILS est
`propfirmrules` et non `propfirm` : cette dernière est déjà prise par « Sim
propfirm ».

Le contournement historique `isActive = activeTab === item.id && idx === 0`,
qui limitait la surbrillance à la première entrée, a été retiré une fois les
`id` rendus uniques.

### Le seed est déclenché par le client, pas au démarrage du serveur

Volontaire. Si le serveur amorçait la base à son démarrage, elle serait
**toujours déjà amorcée** à l'arrivée du premier navigateur, et les données que
celui-ci détient encore dans son `localStorage` ne pourraient jamais être
reprises. Le client décide : il voit `bootstrapped: false`, regarde ce qu'il a
en local, et appelle soit `/api/state/import`, soit `/api/state/seed`.

Le `409` renvoyé quand la base est déjà amorcée n'est pas une erreur à
remonter : il signifie qu'un autre onglet a gagné la course. Le client
l'avale et relit simplement l'état.

### Pièges de l'authentification, à ne pas redécouvrir

Rencontrés ou anticipés pendant l'implémentation du socle. Le premier a
réellement coûté du temps.

**Les commentaires SQL vivent dans un template literal.** Le schéma de
`server/db.ts` est une chaîne entre backticks. Un backtick dans un commentaire
`--` **ferme la chaîne** et produit des erreurs de syntaxe TypeScript
incompréhensibles à des dizaines de lignes de là. N'utilise pas de backtick dans
ce bloc.

**`sips` ne sait pas écrire le WebP** bien qu'il le liste dans ses formats : la
commande échoue sans message et ne crée pas le fichier. Vérifie l'existence du
fichier de sortie, pas le code de retour.

**`secure: true` inconditionnel sur le cookie** rend la connexion impossible en
développement (HTTP clair) sans aucun message compréhensible. Conditionner à
`NODE_ENV === "production"`.

**Un middleware d'auth en `app.use`** intercepterait `/@vite/client`,
`/@react-refresh` et le WebSocket HMR, puisque Vite est monté après l'API. Il
doit aller sur le routeur `api`.

**`req.path` est relatif au routeur** : dans un middleware monté sur `/api`,
c'est `/state`, pas `/api/state`.

**`timingSafeEqual` lève** `RangeError` sur des longueurs différentes — comparer
les longueurs d'abord.

**`scrypt` avec `N ≥ 2^15` exige `maxmem` explicite** : 32 Mio requis, soit
exactement le défaut de Node, d'où un `ERR_CRYPTO_INVALID_SCRYPT_PARAMS`.

**`clearCookie` sans les mêmes attributs** que l'émission ne supprime rien.

**`express.json` global s'applique aussi aux routes d'auth** : un parseur borné
à 16 ko déclaré **avant** lui les protège, `body-parser` marquant la requête
comme déjà lue.

**`setInterval` sans `.unref()`** empêche le processus de se terminer.

**`z.string().email()` est déprécié en Zod 4** au profit de `z.email()`.

**Un timing différent entre « email inconnu » et « mot de passe faux »** offre
une énumération des comptes : hacher contre un hash factice dans le premier cas.

### Tout ce qui entre dans l'état applicatif est sérialisé trois fois

C'est la leçon du profil de 4 Mo, et elle vaut au-delà des images.

Une valeur placée dans un état synchronisé se retrouve **dans la base, dans
chaque réponse de `/api/state`, et dans `localStorage`**. Le coût est donc
triplé, et le plafond de `localStorage` (~5 Mo, tout confondu) est le premier
atteint — en échouant **silencieusement**, puisque `usePersistentState` et
`useSyncedState` avalent l'exception pour ne pas casser l'interaction en cours.

Avant d'ajouter un champ volumineux (image, fichier, historique long), réduis-le
à la source ou sors-le de l'état synchronisé. Ne compte pas sur un
avertissement : il n'y en aura pas.

### Le nom des fichiers d'assets doit être en minuscules

macOS ignore la casse, **un serveur Linux non**. Le logo fourni s'appelait
`Logo.png` et aurait disparu au déploiement.

### Outils d'image disponibles

La machine n'a **ni ImageMagick, ni PIL, ni sharp** — seulement `sips`, qui ne
recadre qu'au centre. Pour un recadrage décalé, passer par un BMP intermédiaire
et le manipuler en Python pur (`struct`), puis reconvertir avec `sips`. C'est la
méthode qui a produit `public/icon.png`.

`sips` **liste** WebP dans ses formats de sortie mais échoue silencieusement à
en écrire : vérifie l'existence du fichier produit, pas le code de retour.
C'est pourquoi `logo-auth.jpg` est un JPEG.

Ces limites ne concernent que les images traitées **hors ligne**. Le
redimensionnement des avatars, lui, se fait **dans le navigateur**
(`<canvas>`, `src/lib/image.ts`) et y produit du WebP sans difficulté.

---

## 9. Contexte de travail avec l'utilisateur

- Il **communique en français** et attend des réponses en français.
- Il travaille par **demandes courtes et itératives**, souvent visuelles, et
  désigne fréquemment un élément de l'interface plutôt que de le nommer.
- Il **commite lui-même la décision de committer** : il demande explicitement
  « commit the working tree changes ». Ne pas committer sans qu'il le demande.
- Il apprécie qu'on **signale les conséquences d'un choix** plutôt qu'on
  l'applique en silence. Exemple : quand il a demandé de passer le statut VIP au
  vert, le signaler comme devenu indistinguable de « Prop Firm Financé » était
  utile — il a ensuite choisi de supprimer le statut.
- Quand une vérification n'a pas pu être menée à son terme, **le dire
  explicitement** plutôt que de laisser croire que tout est validé.
- Il attend qu'on **tranche les décisions produit avec lui, pas à sa place** —
  mais une fois qu'il a tranché, il ne veut pas qu'on rouvre le débat. Les
  arbitrages rendus sont en §6 ter ; consulte-les avant de proposer un choix.
- **Ses données de travail sont réelles.** Il l'a rappelé plusieurs fois
  indirectement (un trade de test oublié en base a faussé ses statistiques
  pendant plusieurs sessions). Sauvegarde avant toute migration, teste sur
  `DATA_DIR=/tmp/...`, et ne crée jamais de compte ou de donnée parasite dans
  `data/horizon.db`.

### Méthode de vérification attendue

Le serveur de développement est piloté par les outils navigateur
(`preview_start` avec le nom `horizon-dev`). Le cycle utilisé jusqu'ici, à
reprendre :

1. `npm run lint` et `npm run build` après chaque changement ;
2. contrôle visuel de la vue touchée par capture d'écran ;
3. pour tout ce qui touche aux données : mutation dans l'UI → vérification via
   `curl -s localhost:3000/api/state` ou une requête `sqlite3` ;
4. **preuve de persistance réelle** : `localStorage.clear()` puis rechargement,
   et si possible redémarrage du serveur — c'est le seul test qui prouve que la
   donnée vient bien de SQLite et non du cache ;
5. `read_console_messages` pour confirmer l'absence d'erreur.

Nettoie derrière toi : les données de test créées pendant la vérification
doivent être supprimées avant de rendre la main. **Cette règle a déjà été
enfreinte une fois** — un trade de test (`MARQUEUR/TEST`) et plusieurs bases de
sauvegarde sont restés dans `data/` pendant plusieurs sessions avant d'être
retirés. Pour l'authentification, la vérification du flux d'installation a été
faite sur une base jetable (`DATA_DIR=/tmp/...`) séparée : aucun identifiant de
test n'a jamais atteint `data/horizon.db`.

### Ce qui a réellement été vérifié — et ce qui ne l'a pas été

Le projet n'a aucun test automatisé (§6.6). Tout a été vérifié à la main, et
**pas au même degré selon les zones**. Ne suppose pas une couverture uniforme.

| Degré | Zones |
|---|---|
| **Exercé de bout en bout** — mutation, base, redémarrage | persistance SQLite, masquage de sidebar, horodatages du journal, style de trading, validation et quotas de l'API (`400`/`404`/`409`/`429`), migration `localStorage` → base, repli hors ligne |
| **Contrôlé visuellement seulement** — la vue s'affiche, rien de plus | forum, académie vidéo, quiz, portefeuilles, messagerie coach, badges, simulateur |
| **Ouverture exercée** — la modale s'ouvre depuis la sidebar | les 4 entrées OUTILS + « Exercice du jour » ; « Audit Setup → Appliquer au journal » exercé jusqu'au formulaire pré-rempli |
| **Jamais exécuté** | la route Gemini **avec une vraie clé** |

Le redimensionnement d'avatar a été exercé **de bout en bout** : téléversement
d'un PNG de 1,19 Mo → data URI WebP de 4 839 caractères en 256×256, rendu
vérifié dans la modale, puis `localStorage.clear()` + rechargement pour prouver
que l'avatar recompressé vient bien de SQLite. Deux limites à connaître :

- le format de sortie **dépend du navigateur** (WebP ici, JPEG ailleurs) ; seul
  le chemin WebP a été observé en conditions réelles ;
- le redressement EXIF est demandé via `createImageBitmap`, mais **aucune photo
  réellement orientée par EXIF n'a été testée**.

Le bouton de déconnexion a été exercé sur ses **trois** chemins : en ligne
(confirmation, cache vidé, rechargement, état relu depuis SQLite), sidebar
repliée (icône seule, infobulle, même position), et **hors ligne** (refus
explicite, aucune confirmation demandée, cache intact). La branche hors ligne
n'étant pas atteignable en arrêtant le serveur — c'est lui qui sert
l'application — elle a été exercée en forçant temporairement `setStatus`
dans `useServerSync.ts`, modification ensuite annulée (`git diff` vérifié
vide). **Attention : son corps a depuis été réécrit pour appeler
`api.logout()`, et cette nouvelle version n'a jamais été exécutée.**

### L'authentification a été exercée de bout en bout

| Zone | Ce qui a été prouvé |
|---|---|
| `password.ts` | 24 contrôles : bon/mauvais mot de passe, 9 formats corrompus renvoyant `false` **sans lever**, sel aléatoire, `needsRehash`, borne de longueur. Coût mesuré **81 ms**, hash factice **79 ms** — l'écart de timing est éliminé |
| `sessions.ts` / `credentials.ts` | 37 contrôles sur base jetable : `readCookie` sur 9 cas (valeur percent-encodée mal formée, nom partiellement homonyme, en-tête absent), non-écrasement d'un profil existant, normalisation d'email, unicité de `email_lower`, empreinte SHA-256 ≠ jeton, sessions parallèles, expiration, purge, renouvellement glissant, **absence d'écriture quand la session vient d'être vue** |
| Les 4 routes | 20 contrôles `curl` : `no-account` → `setup` 201 → `409` au second → `login` → `logout` 204 idempotent. Cookie `HttpOnly; SameSite=Lax; Path=/` **sans `Secure`** en dev. Rate limit `429` au 11ᵉ essai. **Timing identique** (80-83 ms) entre email inconnu et mot de passe faux |
| La barrière | `/health` 200 sans cookie ; `/state`, `/collections/*`, `/download-features-pdf`, `/coach/ai-review` en **401** sans session. **Le HMR de Vite continue de fonctionner** — c'est le test qui prouve que la barrière est sur le routeur et non sur l'application |
| Le flux client | Installation → application chargée avec les vraies données → rechargement, **session persistée** → cookie **invisible en JS** → révocation serveur puis écriture réelle → **retour à l'écran de connexion avec « Ta session a expiré »** → déconnexion, **`localStorage` vidé à 0 clé** |
| Le durcissement | `PUT /profile` avec `isAdmin` : **valeur en base inchangée**. Email invalide `400`, vide `200`. Non-admin sur `enrolledStudents` : **403 et les 4 fiches survivent**. Sidebar dégradée (entrée, engrenages et badge absents). Bouton « Activer Admin » remplacé par « Défini côté serveur » |
| Installation neuve | Sur `DATA_DIR=/tmp/propdesk-neuf` : `no-account` → `setup` → session → **seed derrière la barrière** → 6 trades et 4 élèves amorcés. L'ordre `users` avant `user_credentials` (contrainte de clé étrangère) tient |
| Production | `npm run build` puis `NODE_ENV=production node dist/server.cjs` : `/logo-auth.jpg` servi (38 830 o), SPA servie, `/api/auth/me` répond |

**Deux réserves honnêtes.**

La **garde au rendu de la vue `students`** pour un non-admin n'a pas pu être
déclenchée : l'entrée de sidebar disparaît et `knownTabs` exclut l'onglet, donc
l'état n'est plus atteignable par l'interface — ce qui est le but, mais ce qui
empêche aussi d'exercer la branche. Les deux autres couches (masquage et `403`
serveur) sont, elles, vérifiées.

Le **clic automatisé ne soumet pas un formulaire** dans cet outillage : la
soumission n'a pu être déclenchée que par `requestSubmit()`. Le chemin de
soumission lui-même est donc prouvé (erreur affichée, `aria-invalid`,
`aria-describedby`), mais pas le clic humain sur le bouton — comportement
standard du navigateur, hors de portée d'ici.

**Piège si tu écris un script de test** : poser `process.env.DATA_DIR` sur une
base jetable **avant** d'importer `server/db.ts` — ce module ouvre la connexion
au chargement, un import statique en tête de fichier écrirait donc dans la vraie
base. Utiliser un `await import()` après avoir posé la variable.

Le dernier point mérite d'être explicite : `/api/coach/ai-review` n'a été testée
que sur sa **validation d'entrée** et sa **limitation de débit**. Aucun appel
réel à Gemini n'a abouti pendant le développement. **Ne suppose pas que l'audit
IA fonctionne** — c'est la première chose à vérifier si tu y touches, et le
modèle déclaré (`gemini-3.6-flash`,
[`routes.ts:243`](server/routes.ts:243)) est à confirmer.

---

## 10. État à la reprise

> ### Migration close, sauvegarde supprimée
>
> La migration `staff_accounts` (§4) a été **appliquée à la vraie base** —
> pas seulement testée sur une copie. Votre compte (`th.gauthey99@gmail.com`)
> a conservé son `id` d'origine et votre session n'a pas été invalidée.
>
> La sauvegarde d'avant migration (`data/horizon.db.avant-staff-accounts`) a
> été **supprimée** après une dernière vérification : les 11 tables métier ont
> été comparées ligne à ligne entre la sauvegarde et la base actuelle —
> `users`, `trades`, `enrolled_students`, `trading_accounts`, `modules` et
> `badges` sortent **identiques**, la migration n'a donc rien perdu. Il n'y a
> plus de retour arrière, et il n'y en a plus besoin. `data/` est propre :
> plus aucune base orpheline.

- Branche `main`, **arbre de travail propre**.
- `npm run lint` et `npm run build` : sans erreur (bundle ~944 ko, §6.8).
- Migration vérifiée **trois fois** : sur une copie isolée (`/tmp/test-migration`),
  sur une base neuve pour le flux staff complet (`/tmp/staff-neuf`), puis
  appliquée à la vraie base par redémarrage du serveur de dev — données
  comparées champ par champ à une sauvegarde d'avant migration, aucun écart.
- Flux staff exercé de bout en bout, au `curl` et dans le navigateur : invitation,
  connexion avec mot de passe temporaire, blocage sur toute route hors
  `/auth/change-password` tant que `mustChangePassword` est vrai, déblocage
  après changement, bureau partagé confirmé identique entre deux comptes,
  suppression avec purge immédiate des sessions, garde-fou du dernier compte.
- **Rejoué une seconde fois sur une copie de la vraie base** avant de supprimer
  la sauvegarde (16 contrôles, tous verts) : invitation d'un coach, connexion au
  mot de passe temporaire, `GET /api/state` refusé en 403 `MUST_CHANGE_PASSWORD`,
  403 sur un mauvais mot de passe actuel, changement accepté, ancien mot de passe
  temporaire devenu invalide (401), **écriture du coach visible depuis l'autre
  compte** (`PUT /api/collections/trades`), suppression du coach en 204 avec
  session purgée dans la seconde, et 409 sur la suppression du dernier compte.
  Méthode : `DATA_DIR` pointé sur une copie `sqlite3 .backup`, serveur sur le
  port 3999 — la vraie base n'a jamais été ouverte en écriture (compteurs et
  `mtime` vérifiés inchangés après coup).
- **La console est propre, et le rechargement à chaud fonctionne.** L'erreur
  `ws://localhost:24678` qui tournait en boucle est corrigée (§8, « Le
  rechargement à chaud »). Tu n'as plus à recharger la page à la main après une
  modification — si tu lis encore une consigne en ce sens quelque part, elle est
  périmée.
- **Bundle découpé** (§8) : chargement initial à **475 ko**, plus aucun bloc
  au-dessus du seuil de Vite. Vérifié sur le build de production servi pour de
  vrai, pas seulement à la compilation.
- **Édition d'un trade** (§8) vérifiée sur une copie de la vraie base : le trade
  BTC ouvert pour lui affecter un compte ressort avec `pnl`, `pnlPercentage`,
  `result` et `riskRewardRatio` **identiques au champ près**, et l'audit IA d'un
  trade audité survit à une modification.
- **Rattachement trades ↔ comptes** et **rejeu hors ligne** (§8) exercés de bout
  en bout sur une copie de la vraie base : trade rattaché depuis le formulaire et
  retrouvé en base avec son `accountId`, filtre cohérent (1 + 6 = 7), compteur de
  positions dérivé, puis cycle hors ligne complet — modification sans serveur,
  reconnexion, bandeau, envoi vérifié en base, et abandon vérifié lui aussi.

### Contenu de `data/horizon.db`

| Table | Lignes |
|---|---|
| `users` | 1 (profil « ForexPaps », `isAdmin: true`, capital 102 450 €) |
| `staff_accounts` | 1 (votre compte, migré, `must_change_password: 0`) |
| `sessions` | 1 (la vôtre, valable jusqu'au 4 septembre 2026) |
| `trades` | 6 (le trade de test a été retiré cette session) |
| `trading_accounts` | 4 |
| `coach_signals` | 4 |
| `coach_messages` | 5 |
| `forum_topics` / `forum_replies` | 4 / 6 |
| `notifications` | 5 |
| `enrolled_students` | 4 (tous avec `tradingStyle`) |
| `badges` | 9 |
| `modules` | 5 |
| `meta` | `bootstrapped_at`, `migrated_staff_accounts_v1` |

Les 4 élèves : Julien Moreau (Intraday, En Évaluation FTMO), Camille Dupont
(Swing Trading, Prop Firm Financé), Lucas Martin (Scalping, Alerte Tilt),
Sophie Bernard (Intraday, Besoin Coaching).

### Par où commencer

Plus rien n'est cassé ni en cours. Les points d'entrée restants sont des
choix, pas des urgences :

- **§7 tâche 1 — remplir le module « Examen ».** À ne pas coder avant d'avoir
  demandé à l'utilisateur ce qu'il veut y mettre : la page vierge est volontaire.
- **Inviter un second compte**, si l'utilisateur le souhaite — le bouton
  « Gérer l'équipe » dans le profil est prêt. Le flux complet (invitation,
  première connexion, changement de mot de passe imposé, suppression) a été
  rejoué sur une copie de la vraie base, sans anomalie ; il n'a simplement
  jamais servi à inviter quelqu'un pour de bon.
- **§6.3 — un vrai cloisonnement des données par compte**, seulement si le
  besoin dépasse un jour le bureau partagé actuel. Chantier nettement plus
  grand que les comptes staff ; la liste de ce qu'il faudrait reprendre y
  figure.

> Ce document est la **seule** source de reprise. Des plans de travail ont pu
> être écrits dans `~/.claude/plans/`, **hors du dépôt** : un nouveau Claude ne
> les verra pas. Tout ce qui compte a été replié ici. Si tu produis un plan
> important, reporte-en la substance dans ce fichier.
