# HANDOFF — PropDesk (Académie de Trading)

Document de reprise. Il suppose que tu n'as accès ni à la conversation
précédente, ni à autre chose que ce dépôt.

> **État à la dernière mise à jour de ce document**
> Branche `main`, dernier commit `69567d7`. `npm run lint` et `npm run build`
> passent. La base `data/horizon.db` contient les **vraies données de
> l'utilisateur**, plus le jeu de démonstration.
>
> Le problème d'avatar qui bloquait tout est **corrigé** : les images
> téléversées sont désormais réduites à 256×256 avant stockage, et l'avatar
> déjà en base a été recompressé (§4, « Poids des images »).
>
> **Prochaine tâche : l'écran de connexion** (§7, tâche 1). Elle demande des
> décisions produit **avant** d'écrire du code.

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

L'interface est **entièrement en français**. Le ton des libellés est direct et
tutoie l'utilisateur. Conserve cette langue et ce registre.

Le projet vient de **Google AI Studio** : c'est important, plusieurs choix
initiaux en découlent (voir §8).

**Ordres de grandeur** : ~12 400 lignes de TypeScript dans `src/` + `server/`,
26 fichiers `.ts`/`.tsx`, 25 commits.

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

Inspecter la base :

```bash
sqlite3 data/horizon.db "select id, pair, pnl from trades order by position"
```

```bash
curl -s localhost:3000/api/state | head -c 400
```

---

## 3. Architecture

### Vue d'ensemble

Un serveur **Express unique** sert l'API **et** l'application. En
développement il monte Vite en middleware ; en production il sert `dist/`.

```
server.ts              point d'entrée : Express + Vite/statique (46 l.)
server/
  db.ts                connexion SQLite (better-sqlite3, WAL) et schéma (146 l.)
  repositories.ts      accès aux données — SEUL module qui parle à SQLite (173 l.)
  routes.ts            routes /api/* (261 l.)
  schemas.ts           validation zod des entrées (51 l.)
  seed.ts              amorçage et import d'un état complet (81 l.)
src/
  main.tsx             point de montage React (10 l.)
  App.tsx              état applicatif et câblage de toutes les vues (879 l.)
  types.ts             source de vérité des formes de données (300 l.)
  index.css            Tailwind 4 + styles globaux
  data/mockData.ts     jeu de données d'amorçage (1455 l.)
  hooks/
    usePersistentState.ts   état miroité dans localStorage (41 l.)
    useServerSync.ts        bootstrap serveur + synchronisation optimiste (183 l.)
  lib/api.ts           client HTTP typé (86 l.)
  components/          10 vues d'onglet + 9 modales + Sidebar et TopHeader
public/
  icon.png             icône 512x512 — sidebar et favicon
  logo.png             logo complet 1536x1024 — réservé à l'écran de connexion (§6 bis)
  Fonctionnalites_Horizon_SMC.pdf
scripts/generate_pdf.js  génération hors ligne du PDF
```

### Inventaire des composants

**Vues d'onglet (10)** — `MainDashboard`, `StudentTracking`, `WalletManagement`,
`VideoAcademy`, `TradingJournal`, `SMCSimulator`, `CoachSignals`,
`ForumSection`, `CoachMessaging`, `PerformanceDashboard`. L'onglet `exam` n'a
pas de composant : il est rendu en ligne dans `App.tsx` (§6 bis).

**Modales (9)** — `UserProfileModal`, `TradeAuditModal`,
`PositionCalculatorModal`, `TradingPlanModal`, `EconomicCalendarModal`,
`PropFirmRulesModal`, `MindsetJournalModal`, `SetupAnalyzerModal`,
`NotificationModal`.

**Chrome** — `Sidebar` (494 l.), `TopHeader` (133 l.).

Les plus gros fichiers, si tu cherches où le poids se concentre :
`mockData.ts` (1455), `App.tsx` (879), `TradingJournal.tsx` (848),
`ForumSection.tsx` (764), `VideoAcademy.tsx` (756), `StudentTracking.tsx` (746).

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

| Méthode | Route | Rôle |
|---|---|---|
| GET | `/api/health` | sonde de vie |
| GET | `/api/state` | état complet de démarrage |
| PUT | `/api/collections/:name` | remplace une collection entière |
| PUT | `/api/profile` | profil de l'élève courant |
| PUT | `/api/quiz-results` | résultats de quiz |
| POST | `/api/state/seed` | amorce avec le jeu de démonstration |
| POST | `/api/state/import` | reprend un état venu de `localStorage` |
| POST | `/api/coach/ai-review` | audit IA d'un trade ou réponse à une question |
| GET | `/api/download-features-pdf` | catalogue PDF des fonctionnalités |

Toutes les entrées sont validées par **zod**. `/api/coach/ai-review` est
limitée à **10 appels par minute et par IP** (fenêtre glissante en mémoire) :
c'est la seule route facturée à l'appel (Gemini, modèle `gemini-3.6-flash`).

Codes de retour à connaître : `400` entrée invalide, `404` collection inconnue,
`409` base déjà amorcée (import ou seed refusé), `429` quota IA dépassé,
`500` exception non prévue (via `apiErrorHandler`).

Le corps JSON est plafonné à **8 Mo** (`express.json({ limit: "8mb" })`) — la
limite par défaut de 100 ko était trop basse pour une collection complète.

### Schéma SQLite

13 tables : `meta`, `users`, `trades`, `trading_accounts`, `coach_signals`,
`coach_messages`, `forum_topics`, `forum_replies`, `notifications`,
`enrolled_students`, `badges`, `modules`, `quiz_results`.

Chaque ligne porte un `user_id` (`DEFAULT_USER_ID = "user-local"`), **même sans
authentification** : cela évite une migration douloureuse le jour où elle
arrivera. Les objets sont stockés en **colonne JSON** (`payload`), ce qui rend
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

Socle à **un seul compte** : la mécanique est réelle, les données ne sont pas
encore cloisonnées (limites en §6.2 et §6.3).

**Schéma** — deux tables purement additives dans `server/db.ts`, aucun `ALTER`,
aucun moteur de migration :

- `user_credentials` — `user_id` (clé primaire), `email`, `email_lower`
  (**`UNIQUE`**, l'identifiant de connexion), `password_hash`, horodatages.
- `sessions` — `id` (**SHA-256 du jeton**, jamais le jeton), `user_id`,
  `created_at`, `expires_at`, `last_seen_at`, `user_agent`, plus deux index.

Table séparée et non `ALTER TABLE users` pour une raison précise :
`GET /api/state` renvoie `getProfile()` **tel quel au navigateur**. Un hash qui
vivrait dans `users.payload` partirait au client à chaque démarrage. Ne
réintroduis pas de secret dans ce payload.

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

**Routes** — `/auth/me` (répond **toujours 200**, union discriminée
`no-account` / `unauthenticated` / `authenticated` : « pas encore connecté » est
l'état normal au démarrage, un 401 pousserait à traiter un état comme une
erreur), `/auth/setup` (**409 si un compte existe** — c'est la protection
critique, sans elle n'importe qui réinitialiserait le mot de passe à distance),
`/auth/login`, `/auth/logout` (**204, idempotente, hors de `requireAuth`** :
une session expirée doit pouvoir se déconnecter).

Deux protections anti-énumération sur `/auth/login` : le **même message** pour
email inconnu et mot de passe faux, et un **hachage contre un hash factice**
quand le compte est absent — sinon l'écart de temps de réponse (immédiat contre
80 ms) révélerait quels comptes existent.

**La barrière** — `api.use(requireAuth)` dans `server/routes.ts`, placée **après**
`/health` et le routeur d'auth, **avant** tout le reste : l'ordre de déclaration
rend l'exclusion structurelle. Elle est sur le **routeur**, jamais en `app.use` :
Vite est monté après l'API dans `startServer()`, un middleware au niveau
application intercepterait `/@vite/client` et le WebSocket HMR et casserait le
développement. Une liste d'exclusions explicite sert de filet, avec des chemins
**relatifs au routeur** (`/state`, pas `/api/state`).

`/state/seed` et `/state/import` sont **protégés**. Le flux le permet : sur base
neuve, `me` → `no-account` → `setup` crée la ligne `users` *et* la session →
le client est authentifié → *ensuite* `useBootstrap` déclenche le seed.

**Durcissement des privilèges**, indissociable de l'auth — sans lui elle serait
décorative :

- `isAdmin` n'est plus écrivable par le client. Deux verrous : `profileSchema`
  **retire** la clé du corps (retirer et non rejeter — le client renvoie l'objet
  qu'il a reçu, un 400 casserait toute sauvegarde), et `PUT /api/profile`
  réinjecte la valeur autoritative lue en base.
- Le bouton « Activer Admin 👑 » de `UserProfileModal` est **retiré** ; le statut
  s'affiche en lecture seule.
- La vue `students` est gardée **au rendu**, plus seulement masquée dans la
  sidebar, avec un message explicite. `"students"` ne figure dans
  `knownTabs` que pour un admin, et un `useEffect` renvoie au tableau de bord si
  le statut est révoqué en cours de session.
- `PUT /api/collections/enrolledStudents` exige l'admin côté serveur — sans quoi
  la protection resterait cosmétique.
- `profileSchema.email` valide enfin une vraie adresse (ou la chaîne vide).
- `apiErrorHandler` ne renvoie plus `err.message` en production : il exposait les
  contraintes SQLite, donc des noms de tables et de colonnes.

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

| Fichier | Rôle |
|---|---|
| `server/db.ts` | connexion SQLite et schéma |
| `server/repositories.ts` | couche d'accès aux données |
| `server/routes.ts` | routes `/api/*` |
| `server/schemas.ts` | validation zod |
| `server/seed.ts` | amorçage et import |
| `src/lib/api.ts` | client HTTP typé |
| `src/lib/image.ts` | réduction des images téléversées avant stockage |
| `server/auth/password.ts` | hachage scrypt, vérification, re-hachage |
| `server/auth/sessions.ts` | jetons, cookie, purge, lecture du cookie |
| `server/auth/credentials.ts` | accès à `user_credentials` |
| `server/auth/routes.ts` | `/api/auth/*` |
| `server/auth/middleware.ts` | `requireAuth`, `requireAdmin` |
| `server/middleware/rateLimit.ts` | fabrique de limiteur, extraite de `routes.ts` |
| `src/hooks/useAuth.ts` | état d'authentification côté client |
| `src/components/auth/AuthShell.tsx` | coque et primitives des écrans d'auth |
| `src/components/auth/LoginScreen.tsx` | écran de connexion |
| `src/components/auth/SetupScreen.tsx` | écran de première installation |
| `public/logo-auth.jpg` | logo optimisé pour les écrans d'auth |
| `src/hooks/usePersistentState.ts` | état miroité dans localStorage |
| `src/hooks/useServerSync.ts` | bootstrap + synchronisation optimiste |
| `public/icon.png` | icône 512×512 |
| `public/logo.png` | logo complet (fourni par l'utilisateur) |
| `.claude/launch.json` | configuration du serveur de prévisualisation |
| `README.md` | réécrit intégralement |
| `HANDOFF.md` | ce document |

### Renommé

| Avant | Après |
|---|---|
| `src/components/AISetupAnalyzerModal.tsx` | `src/components/SetupAnalyzerModal.tsx` |

### Modifiés en profondeur

| Fichier | Nature des changements |
|---|---|
| `src/App.tsx` | bootstrap serveur, 12 `useSyncedState`, câblage des modales, `handleLogout` |
| `src/components/Sidebar.tsx` | masquage admin, `TabType`, logo, clés stables, section OUTILS, `renderSection`, bouton de déconnexion, pied non défilant |
| `src/components/TradingJournal.tsx` | horodatages de sortie, CSV, palette |
| `src/components/StudentTracking.tsx` | style de trading, palette, statuts |
| `src/components/TopHeader.tsx` | 5 boutons retirés, fil d'ariane, props mortes retirées |
| `src/components/MainDashboard.tsx` | props mortes retirées (`onOpenCalculator`, `onOpenCalendar`) |
| `src/components/UserProfileModal.tsx` | `useEffect` sur `isOpen`, palette, réduction des avatars téléversés |
| `src/types.ts` | `exitDate`, `exitTime`, `TradingStyle`, `hiddenSidebarItems`, `TradeDraft` |
| `src/data/mockData.ts` | horodatages de sortie, styles de trading |
| `server.ts` | simplifié, chemins via `process.cwd()`, limite JSON à 8 Mo |
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

### « Déconnexion » ne ferme pas encore de session

Le bouton existe dans le pied de la sidebar, mais **il n'y a pas encore
d'authentification** (§6.2) : aucune session à invalider, et rien à masquer
puisque le serveur ne connaît qu'un utilisateur.

Ce qu'il fait aujourd'hui, et c'est le seul comportement honnête disponible :
il vide le cache `localStorage` et recharge, ce qui ramène l'application à un
démarrage propre relu depuis le serveur.

Il **refuse d'agir hors ligne** : le cache est alors la seule copie des données
et le vider serait une perte sèche. L'utilisateur reçoit un message explicite
au lieu d'une destruction silencieuse.

Quand l'écran de connexion arrivera (§7, tâche 1), **seul le corps de
`handleLogout` change** — l'appel depuis la sidebar reste identique. Ne
réimplémente pas le bouton, remplis le handler.

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

### 1. Les modifications hors ligne ne sont pas rejouées

Elles restent dans le cache local, mais **le rechargement suivant reprend
l'état du serveur** et les perd. Implémenter le rejeu demande une gestion de
conflits (quelle version gagne ?) — c'est une décision produit, pas seulement
technique.

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

### 3. Un seul compte, données non cloisonnées

L'authentification est un **socle** : un compte unique, et toutes les données
restent sur `user-local`. Le multi-compte est conçu pour être **additif** —
`email_lower` est déjà `UNIQUE`, chaque ligne porte déjà un `user_id`, et les six
fonctions de `repositories.ts` acceptent déjà un `userId`.

Ce qui reste à faire pour de vrais comptes multiples, et qui n'est **pas** fait :

- aucun appelant ne passe de `userId` aux repositories (le défaut implicite
  s'applique partout) ;
- `forum_replies` n'a **pas** de `user_id` (rattachement indirect par `topic_id`) ;
- `isBootstrapped()` est un drapeau **global** dans `meta` : un second
  utilisateur trouverait la base « déjà amorcée » et n'obtiendrait jamais de seed ;
- le forum identifie les auteurs par **chaîne de nom**, sans `authorId` ;
- les clés `localStorage` sont **globales**, sans namespace : un second compte
  sur le même navigateur hériterait du cache du premier ;
- il faudrait trancher quelles collections sont partagées (modules, signaux) et
  lesquelles sont privées, et le lien entre `EnrolledStudent` et un compte
  (aujourd'hui inexistant, voir §3 « Inventaire »).

### 3. `onSelectAccountForJournal` est mort

Dans [`WalletManagement.tsx:29`](src/components/WalletManagement.tsx:29), la
prop est **déclarée et déstructurée mais jamais appelée dans le composant**. La
câbler depuis `App.tsx` ne produirait rien. Il faut d'abord décider quel
élément d'interface doit la déclencher.

### 4. Résidus de session dans `data/`

- Un **trade de test est toujours en base** : `MARQUEUR/TEST`, id
  `trade-marqueur-migration`, PnL `1234 €`, note « Doit se retrouver en base ».
  Il vient d'une vérification de persistance qui n'a pas été nettoyée, et il
  **fausse les statistiques du tableau de bord** (win rate, capital, R cumulé).
  À supprimer depuis l'interface du journal — c'est le plus sûr, la
  suppression repassera par la synchronisation normale.
- Trois fichiers **`data/horizon 2.db*`** (une base de 4 ko et 1,8 Mo de WAL)
  traînent à côté de la vraie base. C'est un doublon Finder, **rien ne les
  lit** : `db.ts` ouvre exclusivement `horizon.db`. Supprimables sans risque,
  mais demander avant.

### 5. Données existantes sans les nouveaux champs

Les trades et élèves déjà en base ont été créés avant l'ajout de `exitDate`,
`exitTime` et `tradingStyle`. Les vues gèrent l'absence proprement (mention
*sortie non renseignée*, pastille masquée), mais **les valeurs mises dans
`mockData.ts` ne s'appliquent qu'à une base neuve**.

> **`rm -rf data/` détruit de vraies données.** Le profil en base est celui de
> l'utilisateur (« ForexPaps », capital 100 000 € / 103 684 €), pas le profil
> de démonstration de `mockData.ts` (« Alexandre Vance »). Les styles de
> trading des 4 élèves ont été saisis **à la main via l'interface**, ils ne
> sont pas amorcés. Une remise à zéro perd tout cela. Sauvegarde d'abord :
>
> ```bash
> cp data/horizon.db data/horizon.db.bak
> ```

### 6. Aucun test automatisé

Le projet n'a pas de *runner*. En ajouter un est une décision à part entière.
Voir §9 pour ce qui a réellement été vérifié, et comment.

### 7. SQLite sur disque éphémère

Sur Cloud Run (cible naturelle vu l'origine AI Studio), le disque est éphémère
et **les données seraient perdues à chaque redémarrage d'instance**. Monter un
volume sur `DATA_DIR`, ou passer à Postgres. Seul `server/repositories.ts` est
à réécrire : les routes n'y touchent pas.

### 8. Bundle client de ~925 Ko

`dist/assets/index-*.js` dépasse **920 ko** (~250 ko gzippé), au-delà du
seuil d'avertissement de 500 ko de Vite. Aucun découpage de code n'est en
place. Non bloquant, mais à traiter avant une mise en production sérieuse.
`recharts` est le principal contributeur.

### 9. `.env.example` encore rédigé pour AI Studio

Il mentionne l'injection automatique par AI Studio et une variable `APP_URL`
qui n'est utilisée **nulle part** dans le code. À nettoyer.

### 10. `vite.config.ts` porte encore des béquilles AI Studio

Le bloc `server.hmr` / `server.watch` est piloté par une variable
`DISABLE_HMR` propre à l'environnement AI Studio, avec un commentaire
« Do not modify ». Hors AI Studio, cette variable n'est jamais définie : le
comportement est donc le défaut de Vite. L'alias `@` pointe sur la racine du
projet et n'est utilisé par aucun import.

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
| Périmètre de l'authentification | **socle à un seul compte**, extensible sans refonte — le multi-compte n'est pas fait (§6.3) |
| Hachage des mots de passe | **scrypt de `node:crypto`**, aucune dépendance ajoutée — argon2 et bcrypt écartés (compilation native, aucun gain réel à cette échelle) |
| Premier mot de passe | **écran de première installation**, pas de variable d'environnement ni de script — aucun mot de passe par défaut dans le dépôt |
| Sessions multi-appareils | **autorisées** — la connexion ne révoque pas les autres sessions, la déconnexion ne ferme que la session courante |
| Accès hors ligne | **conservé** — le verrou n'est donc pas une barrière physique (§6.2). Bloquer ou passer en lecture seule ont été écartés |
| Devenir administrateur | **premier compte admin d'office**. Sans effet sur la base actuelle, dont le profil a déjà `isAdmin: true`. À revoir au multi-compte |
| Longueur minimale du mot de passe | **10 caractères**, sans contrainte de composition |
| `onSelectAccountForJournal` | **non tranché** — demande une décision produit |
| Rejeu des modifications hors ligne | **non tranché** — coût élevé, à ne faire que sur demande |

---

## 7. Prochaines tâches, dans l'ordre

### 1. Remplir le module « Examen »

L'onglet `exam` existe mais **affiche une page vierge** avec le texte « Contenu
à venir » ([`App.tsx:773`](src/App.tsx:773)). L'utilisateur a demandé cette
page vierge en attendant de définir le contenu. Lui demander ce qu'il veut y
mettre avant de coder.

### 2. Nettoyer les résidus

Le trade `MARQUEUR/TEST` et les fichiers `data/horizon 2.db*` (§6.4). Rapide,
mais demander avant de toucher à des données. S'y ajoutent désormais deux
sauvegardes de base laissées par les chantiers précédents :
`data/horizon.db.bak` et `data/horizon.db.avant-auth`.

### 3. Dériver la liste blanche des onglets de notification

`handleNavigateFromNotification` a été complété (`exam`, `propfirm`, et
`students` réservé à l'admin), mais la liste reste **recopiée à la main**. La
dériver de `TabType` éviterait qu'un futur onglet crée un trou silencieux.

### 5. Découper le bundle

`build.rollupOptions.output.manualChunks` ou imports dynamiques sur les vues
les plus lourdes (`recharts` est le principal contributeur).

### 6. Décider du sort de `onSelectAccountForJournal`

Câbler ou supprimer. Demander d'abord.

### 7. Nettoyer `.env.example` et `vite.config.ts`

Retirer les mentions AI Studio et la variable `APP_URL` inutilisée (§6.10,
§6.11).

### 8. Rejeu des modifications hors ligne

Seulement si l'utilisateur le demande : coût élevé, gestion de conflits.

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

À noter pour la tâche §7.0 : le redimensionnement de l'avatar se fera **dans le
navigateur** (`<canvas>`), ces limites de la machine ne s'y appliquent donc pas.

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
enfreinte une fois** — voir le trade `MARQUEUR/TEST` en §6.5.

### Ce qui a réellement été vérifié — et ce qui ne l'a pas été

Le projet n'a aucun test automatisé (§6.7). Tout a été vérifié à la main, et
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

> ### La base attend son mot de passe
>
> `user_credentials` est **vide** : au prochain démarrage, l'application affiche
> l'écran de **première installation**. C'est voulu — le mot de passe doit être
> choisi par l'utilisateur, aucun mot de passe de test n'a été laissé derrière.
>
> Les données sont intactes et vérifiées champ par champ contre la sauvegarde
> `data/horizon.db.avant-auth` : profil identique, 7 trades, 4 élèves,
> 4 portefeuilles, 5 messages, 4 sujets, 5 notifications, 9 badges, 5 modules.

- Branche `main`, dernier commit `2f9bb7a`, plus le socle d'authentification
  **non committé**.
- `npm run lint` : sans erreur. `npm run build` : réussi, avec le seul
  avertissement de taille de bundle (§6.8, désormais ~933 ko).
- Vérifié **aussi en production** (`npm run build && NODE_ENV=production node
  dist/server.cjs`) : `/logo-auth.jpg` servi en 38 830 octets, SPA servie,
  `/api/auth/me` répond `no-account`.
- **Une erreur console subsiste**, sans rapport avec le code applicatif :
  `WebSocket connection to 'ws://localhost:24678/' failed`, en boucle. C'est le
  socket HMR de Vite, qui écoute sur son propre port alors que Vite tourne en
  middleware derrière Express — ce port n'est pas exposé. Sans effet sur le
  fonctionnement, mais le rechargement à chaud ne marche pas : **recharge la
  page à la main** après une modification.
- Une sauvegarde `data/horizon.db.bak` (8,2 Mo, avec l'avatar d'origine non
  compressé) a été laissée à côté de la base. Supprimable une fois le
  correctif jugé bon.

### Contenu de `data/horizon.db`

Fichier : **200 ko** (8,2 Mo avant recompression de l'avatar et `VACUUM`).

| Table | Lignes |
|---|---|
| `users` | 1 (profil « ForexPaps », admin, avatar JPEG 256×256 de 42 879 car.) |
| `user_credentials` | **0** — d'où l'écran de première installation au prochain démarrage |
| `sessions` | 0 |
| `trades` | 7 — **dont 1 trade de test à supprimer** (§6.4) |
| `trading_accounts` | 4 |
| `coach_signals` | 4 |
| `coach_messages` | 5 |
| `forum_topics` / `forum_replies` | 4 / 6 |
| `notifications` | 5 |
| `enrolled_students` | 4 (tous avec `tradingStyle`) |
| `badges` | 9 |
| `modules` | 5 |
| `quiz_results` | 0 |
| `meta` | `bootstrapped_at = 2026-08-04T15:25:28.717Z` |

Les 4 élèves : Julien Moreau (Intraday, En Évaluation FTMO), Camille Dupont
(Swing Trading, Prop Firm Financé), Lucas Martin (Scalping, Alerte Tilt),
Sophie Bernard (Intraday, Besoin Coaching).

### Par où commencer

Le socle d'authentification est terminé et vérifié. Plus rien n'est cassé : les
points d'entrée sont des choix, pas des urgences.

- **§7 tâche 1 — remplir le module « Examen ».** À ne pas coder avant d'avoir
  demandé à l'utilisateur ce qu'il veut y mettre : la page vierge est volontaire.
- **§7 tâche 2 — nettoyer les résidus.** Quelques minutes, et cela retire le
  trade de test qui fausse les statistiques du tableau de bord, ainsi que trois
  sauvegardes de base devenues inutiles.
- **§6.3 — les comptes multiples**, si l'utilisateur le demande. La liste
  exhaustive de ce qui reste à faire y figure ; tout est additif.

> Ce document est la **seule** source de reprise. Des plans de travail ont pu
> être écrits dans `~/.claude/plans/`, **hors du dépôt** : un nouveau Claude ne
> les verra pas. Tout ce qui compte a été replié ici. Si tu produis un plan
> important, reporte-en la substance dans ce fichier.
