# HANDOFF — PropDesk

Document de reprise, à lire avant de toucher au code. Écrit pour quelqu'un
(humain ou IA) qui n'a aucun contexte préalable sur ce dépôt.

## État au moment de l'écriture

- Branche : `main`, arbre de travail propre (`git status` clean).
- Dernier commit : `5a02cea` — "Détaille les instructions de déploiement,
  avec un guide pas à pas pour Railway".
- `main` est à jour avec `origin/main` (rien à pousser).
- Pas de tests automatisés dans le projet (`npm run lint` = `tsc --noEmit`
  est la seule vérification statique disponible).

## Qu'est-ce que PropDesk, aujourd'hui

PropDesk est un tableau de bord de trading **personnel et mono-utilisateur** :
journal d'exécution, portefeuille (comptes de trading), analyse de
rentabilité, calendrier macro, gestion de setups, plan de trading et suivi de
mindset. Chaque déploiement n'héberge **qu'un seul compte**, créé une fois
pour toutes à l'installation, avec ses propres données isolées. Il n'y a
aucune notion de rôles, d'équipe, d'élèves ou de coachs — le compte connecté a
systématiquement tous les droits sur ses propres données, et c'est le seul
compte de l'instance. Aucune IA n'est utilisée nulle part dans l'application.

Stack : React 19 + TypeScript + Vite côté client, Express côté serveur, un
seul process Node sert l'API et l'app (pas de proxy à configurer). Le module
`server/db.ts` abstrait trois moteurs de base de données possibles (détaillé
plus bas).

Licence : **usage personnel non commercial** (`LICENSE`, "Licence d'usage
personnel non commercial", © Thomas Gauthey). N'importe qui peut cloner,
déployer et modifier le code gratuitement pour son propre usage personnel
(sa propre plateforme de trading, sur son propre hébergeur). Est en revanche
interdit sans autorisation écrite : vendre le code ou l'accès à une instance
qui en découle, l'utiliser comme base pour commercialiser un produit en le
présentant comme sa propre création, retirer les mentions de copyright, ou
s'en servir comme contexte fourni à un outil d'IA dans un but qui
contreviendrait à ces interdictions.

Authentification : **mot de passe seul, aucune adresse e-mail**. À la
première visite, l'app détecte qu'aucun compte n'existe et affiche un écran
d'installation où l'on choisit uniquement un mot de passe (10 caractères
minimum). Il n'y a ni nom, ni email, ni photo à ce stade — le profil part
vide et se complète plus tard depuis Profil & Options si on le souhaite.

## Pièges et points d'attention avant de coder

- **Pas de hot-reload sur le code serveur.** `npm run dev` lance `tsx
  server.ts`, qui monte Vite en middleware pour le HMR du client — mais toute
  modification de `server.ts` ou de `server/**` exige un redémarrage manuel
  du process `tsx`. Le HMR client, lui, fonctionne normalement.

- **`server/db.ts` choisit le moteur de base selon les variables
  d'environnement présentes, silencieusement.** Ordre de priorité strict :
  1. `POSTGRES_URL` défini → Postgres (`pg`), n'importe quel fournisseur.
  2. Sinon, `TURSO_DATABASE_URL` défini → SQLite distant via Turso/libSQL
     (`TURSO_AUTH_TOKEN` pour l'auth).
  3. Sinon → fichier SQLite local, `DATA_DIR/horizon.db` (`DATA_DIR` par
     défaut `./data`), via libSQL en mode `file:`.
  Se tromper de variable (ou en laisser traîner une d'un ancien
  environnement) change silencieusement la base utilisée — aucune erreur ne
  le signale. `POSTGRES_URL` a toujours priorité sur Turso si les deux sont
  présentes.

- **`AuthStatus["server-error"]` est distinct de `"offline"`, et la
  distinction est délibérée** (`src/hooks/useAuth.ts`). Si `/api/auth/me`
  échoue en réseau, l'app ne bascule sur le cache `localStorage` (`offline`,
  filet anti-perte de données) que si ce navigateur porte déjà une preuve
  d'authentification antérieure (`localStorage["horizon_student"]` présent).
  Un navigateur qui n'a **jamais** authentifié sur l'instance et qui tombe
  sur un serveur injoignable voit un écran d'erreur explicite
  (`ServerErrorScreen`, dans `src/App.tsx`), jamais l'application. Cela évite
  qu'un serveur mal configuré (ex. base qui échoue à s'initialiser sur un
  hébergement au disque non persistant) ne présente une fausse app
  "connectée" à n'importe quel visiteur n'ayant jamais créé de compte. Ne pas
  fusionner ces deux états en corrigeant/refactorant `useAuth.ts` sans
  comprendre pourquoi ils existent séparément.

- **`NODE_ENV` gouverne silencieusement `trust proxy`, la CSP, HSTS et le
  flag `secure` des cookies de session** (voir les commentaires en tête de
  `server.ts`). Il n'y a pas de garde-fou strict (un `throw` casserait le
  tout premier déploiement avant que la variable soit configurée) : juste un
  avertissement en log si `DATA_DIR` est positionné (signe d'un déploiement
  voulu en production) alors que `NODE_ENV !== "production"`.

- **`server/db.ts` conserve un modèle `staff_accounts` complet** (nom,
  email, hash de mot de passe, 2FA/TOTP, codes de récupération) hérité de
  l'ancien système multi-comptes, mais **une seule ligne y existe jamais** en
  pratique : `server/auth/credentials.ts` n'expose que
  `getSoleStaffAccount()`/`hasAnyStaffAccount()`/`createFirstStaffAccount()`,
  jamais de recherche par email, et `/auth/login` ne prend qu'un mot de
  passe. L'email stocké en base n'est renseigné qu'à des fins historiques de
  migration (ancien compte) et n'est plus jamais demandé ni affiché côté
  client. Ne pas réintroduire de flux de connexion par email en pensant
  combler un manque : c'est un choix assumé documenté dans
  `credentials.ts`.

- **Verrouillage optimiste sur les collections.** Chaque écriture sur
  `PUT /api/collections/:name` doit fournir la version lue au dernier
  chargement (table `collection_versions`) ; sinon 409. Deux onglets ouverts
  sur la même session peuvent sinon s'écraser silencieusement l'un l'autre.

## Architecture

```
server.ts                 point d'entrée unique : Express + Vite (dev) ou dist/ statique (prod)
server/
  db.ts                    connexion base (fichier local libSQL / Postgres / Turso), schéma SQL, migrations
  repositories.ts          seul module qui exécute des requêtes SQL — accès aux données
  routes.ts                routes /api/* (état applicatif, collections, profil)
  schemas.ts               validation zod de toutes les entrées API
  seed.ts                  amorçage d'une base vide + import d'un état complet (reprise localStorage)
  economicCalendar.ts      données du calendrier macro
  marketData.ts            données de marché (widget carte des marchés)
  middleware/rateLimit.ts  limitation de débit par IP
  auth/
    routes.ts              routes /api/auth/* (setup, login, logout, change-password, 2FA)
    credentials.ts         accès à staff_accounts — seul module à lire/écrire l'identité de connexion
    sessions.ts             jetons de session (256 bits, cookie HttpOnly), création/validation/purge
    middleware.ts           requireAuth et garde d'accès aux routes protégées
    password.ts              hachage scrypt, comparaison à temps constant
    loginLockout.ts          verrouillage progressif après tentatives échouées
    securityEvents.ts        journal de sécurité (purge RGPD à 90 jours)
    totp.ts / twoFactor.ts   génération/validation TOTP, codes de récupération 2FA

src/
  App.tsx                  point d'entrée React : résout l'état d'auth (App), charge l'état (AuthenticatedApp), puis monte TraderApp — seul shell applicatif, pas de dualité coach/élève
  types.ts                 source de vérité des formes de données (Trade, TradingAccount, TraderBadge, Setup, StudentProfile, etc.)
  main.tsx                 montage React (StrictMode)
  index.css                styles globaux (Tailwind v4)
  data/mockData.ts         jeu de données d'amorçage, catalogue de badges par défaut
  hooks/
    useAuth.ts              état d'authentification client (voir AuthStatus ci-dessus)
    useServerSync.ts         bootstrap (GET /api/state), synchronisation différée vers le serveur
    usePersistentState.ts    persistance locale générique
    useNotificationSound.ts  son de notification
  lib/
    api.ts                   client typé de l'API
    badges.ts                calcul de progression des badges
    pendingChanges.ts        suivi des modifications non encore envoyées au serveur (mode hors ligne)
    planCompliance.ts        vérification du respect du plan de trading
    walletAlerts.ts / walletStats.ts   alertes et calculs sur les comptes de trading
    performanceStats.ts      calculs de rentabilité
    weeklySummary.ts         synthèse hebdomadaire
    format.ts / image.ts / confirmDialog.tsx   utilitaires divers
  components/
    Sidebar.tsx, TopHeader.tsx, MainDashboard.tsx        navigation et tableau de bord principal
    TradingJournal.tsx                                    journal d'exécution (chargé à la demande)
    PerformanceDashboard.tsx, EquityCurveChart.tsx        analyse de rentabilité (chargés à la demande)
    WalletManagement.tsx                                  portefeuille / comptes (chargé à la demande)
    SetupManagement.tsx                                   gestion des setups (chargé à la demande)
    MacroDashboard.tsx, MarketMapWidget.tsx, TradingSessionsWidget.tsx   calendrier macro et marché
    MindsetJournalModal.tsx, TradingPlanEditorModal.tsx   mindset et plan de trading
    PositionCalculatorModal.tsx, UserProfileModal.tsx, NotificationModal.tsx, ChangeOwnPasswordModal.tsx, TwoFactorSetupModal.tsx
    PendingChangesBanner.tsx, SyncErrorBanner.tsx          bannières d'état de synchronisation
    Select.tsx                                             utilitaire d'UI
    auth/
      AuthShell.tsx, LoginScreen.tsx, SetupScreen.tsx, ChangePasswordScreen.tsx, TwoFactorVerifyScreen.tsx
```

### Navigation

Pas de routeur : `App.tsx` (dans `TraderApp`) tient un `activeTab` (union
`TabType`, définie dans `components/Sidebar.tsx`) et rend la vue
correspondante. Les vues d'onglet lourdes sont chargées à la demande via
`React.lazy` (voir le bloc de commentaires en tête de `App.tsx`) ; les
modales, elles, restent montées en permanence et pilotées par une prop
`isOpen`, pour ne pas perdre leur état interne à chaque ouverture.

### Persistance

Le serveur est la source de vérité. Au démarrage authentifié, le client
appelle `GET /api/state` et reçoit toutes les collections en un aller-retour.
Chaque modification met l'interface à jour immédiatement, est envoyée au
serveur après un court délai de regroupement, puis recopiée dans
`localStorage`. Si le serveur est injoignable après une authentification déjà
réussie, l'application démarre sur ce cache local et reste utilisable (voir
`AuthStatus["offline"]` ci-dessus). Au tout premier lancement sur une base
vide, un éventuel état `localStorage` d'une version antérieure sans serveur
est importé automatiquement ; à défaut, la base est amorcée avec
`src/data/mockData.ts`.

### API

| Méthode | Route | Rôle |
|---|---|---|
| GET | `/api/health` | sonde de vie |
| GET | `/api/economic-calendar` | calendrier macro (public, non authentifié) |
| GET | `/api/market-data` | cotations pour le widget marché (public, non authentifié) |
| GET | `/api/auth/me` | état d'authentification (répond toujours 200) |
| POST | `/api/auth/setup` | première installation, refusée si un compte existe déjà |
| POST | `/api/auth/login` | connexion (mot de passe seul) |
| POST | `/api/auth/login/2fa` | second facteur, si activé |
| POST | `/api/auth/logout` | déconnexion |
| POST | `/api/auth/change-password` | remplace son propre mot de passe |
| GET | `/api/auth/2fa/status` | état de la 2FA du compte |
| POST | `/api/auth/2fa/setup` | démarre la configuration 2FA (secret TOTP) |
| POST | `/api/auth/2fa/enable` | confirme et active la 2FA |
| POST | `/api/auth/2fa/disable` | désactive la 2FA |
| POST | `/api/auth/2fa/recovery-codes/regenerate` | régénère les codes de récupération 2FA |
| GET | `/api/state` | état complet de démarrage |
| PUT | `/api/collections/:name` | remplace une collection (verrouillage optimiste par version) |
| PUT | `/api/profile` | profil |
| POST | `/api/state/seed` | amorce avec le jeu de démonstration |
| POST | `/api/state/import` | reprend un état venu de `localStorage` (premier amorçage uniquement) |
| POST | `/api/state/restore` | restaure une sauvegarde JSON exportée (à tout moment, hors premier amorçage) |

Toutes les routes exigent une session valide, sauf `/api/health`,
`/api/economic-calendar`, `/api/market-data`, `/api/auth/me`,
`/api/auth/setup`, `/api/auth/login` (et son étape 2FA) et
`/api/auth/logout`. Toutes les entrées sont validées par zod
(`server/schemas.ts`). Limitation de débit par IP : `/api/auth/login` 10 par
quart d'heure, `/api/auth/setup` 5 par quart d'heure.

## Décisions de fond à connaître

- **Mono-utilisateur.** Le produit s'appelait auparavant "Académie de
  Trading" : coachs, élèves, cours vidéo, forum, messagerie, badges liés à la
  progression dans des modules. Toute cette couche a été retirée sur demande
  explicite pour recentrer le produit sur un usage personnel de trader
  indépendant (voir `git log`, commits autour de "Transforme le projet en
  template mono-utilisateur"). Chaque ligne en base porte déjà un `user_id` :
  réintroduire plusieurs comptes serait additif au niveau du schéma, mais le
  cloisonnement des données par utilisateur reste entièrement à faire côté
  application.
- **Mot de passe seul, pas d'email.** Simplification volontaire de
  l'installation et de la connexion pour un usage personnel — pas de
  récupération de mot de passe par email, la seule voie de secours est de
  supprimer directement les identifiants en base (voir README, "Mot de passe
  oublié").
- **Abstraction multi-moteurs de base (`server/db.ts`).** Ajoutée pour
  permettre le déploiement sur des hébergeurs à disque éphémère
  (fonctions serverless type Vercel), qui ne peuvent pas garder un fichier
  SQLite local entre les invocations. Le reste du serveur ne parle jamais
  qu'à `repositories.ts`, qui ne parle jamais qu'à l'interface commune
  `execute`/`transaction` de `db.ts` — ajouter un nouveau fournisseur de base
  ne touche que ce fichier.
- **Licence "usage personnel, pas de revente".** Le code est partagé
  librement pour que d'autres traders indépendants puissent s'en servir comme
  outil personnel, mais pas pour qu'il devienne la base d'un produit
  commercial concurrent revendu par quelqu'un d'autre.

## Déploiement

Résumé du README (`README.md`, section "Déployer pour un usage personnel") :

- L'application tourne sur n'importe quel hébergeur Node.js
  (`npm run build && npm start`).
- **Hébergeur à disque persistant** (Railway, Render, Fly.io, VPS, Docker
  avec volume monté...) : rien à configurer, la base SQLite embarquée
  fonctionne directement. Railway en particulier a un disque persistant par
  défaut sur ses services ; une base Postgres managée en un clic reste
  possible en pointant `POSTGRES_URL` vers la même valeur que le
  `DATABASE_URL` que Railway fournit.
- **Hébergeur serverless** (Vercel, Netlify, AWS Lambda...) : il faut une
  base accessible en réseau, via `POSTGRES_URL` (Postgres, n'importe quel
  fournisseur — natif de l'hébergeur ou service tiers comme Neon) ou
  `TURSO_DATABASE_URL` + `TURSO_AUTH_TOKEN` (Turso). Sans l'une des deux,
  l'app bascule sur un fichier SQLite local inutilisable sur ce type
  d'hébergeur, d'où l'écran "Serveur injoignable" en cas de déploiement mal
  configuré.

Variables d'environnement principales : `PORT` (défaut 3000), `DATA_DIR`
(défaut `./data`, ignoré si `POSTGRES_URL`/`TURSO_DATABASE_URL` défini),
`POSTGRES_URL`, `TURSO_DATABASE_URL`, `TURSO_AUTH_TOKEN`, `NODE_ENV`. Voir
`.env.example` pour la liste complète et `README.md` pour le détail
pas-à-pas (dont un guide Railway).

## Limites connues (voir README, "Limites connues")

- Le verrou de connexion ne protège pas les données déjà en cache
  `localStorage` : un serveur qui devient injoignable après une
  authentification déjà réussie laisse l'app redémarrer sur ce cache sans
  écran de connexion (choix assumé, filet anti-perte de données). Un
  navigateur n'ayant jamais authentifié voit en revanche un écran d'erreur
  explicite (`server-error`), jamais l'application.
- Un seul compte par instance ; la connexion se fait par mot de passe seul.
  Le schéma est prêt pour du multi-comptes (chaque ligne a un `user_id`) mais
  le cloisonnement des données par utilisateur n'est pas implémenté.
- Les modifications faites hors ligne ne sont pas rejouées à la
  reconnexion : elles restent dans le cache local, mais le rechargement
  suivant reprend l'état du serveur.
- Aucun test automatisé : le projet n'a pas de runner de tests.

## Ce qui n'existe plus (pour éviter de le réintroduire par réflexe)

Comptes coach/élève et leur double parcours applicatif, permissions/invites
staff, modules cours et vidéos (leçons, upload vidéo, programme), Annonces,
Messagerie coach, Forum, module "Signaux & Analyses", écran de consultation
du journal de sécurité (le journal côté serveur existe toujours, juste sans
UI pour le consulter), Mentions légales/CGU et le footer qui les affichait,
connexion par email, `better-sqlite3`, hypothèse d'un déploiement Railway
exclusif, catalogue de badges liés à la progression dans des cours, notions
`isOwner`/permissions par coach/`enrolledStudents`.
