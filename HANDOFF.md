# HANDOFF — PropDesk

Document de reprise, à lire avant de toucher au code. Écrit pour quelqu'un
(humain ou IA) qui n'a aucun contexte préalable sur ce dépôt.

## État au moment de l'écriture

- Branche : `main`.
- `origin` pointe désormais vers un dépôt **privé** dédié à l'usage personnel
  (`journal-de-trading`), plus vers l'ancien dépôt public `propdesk-template`.
- Dernier commit : `4ea8923` — "Repasse la heatmap de rentabilité en
  créneaux de 2h".
- Pas de tests automatisés dans le projet (`npm run lint` = `tsc --noEmit`
  est la seule vérification statique disponible).

## Qu'est-ce que PropDesk, aujourd'hui

PropDesk est un tableau de bord de trading **personnel et mono-utilisateur** :
journal d'exécution, portefeuille (comptes de trading), analyse de
rentabilité, calendrier macro, gestion de setups et plan de trading. Un seul
compte, créé une fois pour toutes à l'installation, avec ses propres données
isolées. Il n'y a aucune notion de rôles, d'équipe, d'élèves ou de coachs — le
compte connecté a systématiquement tous les droits sur ses propres données,
et c'est le seul compte de l'instance. Aucune IA n'est utilisée nulle part
dans l'application.

Stack : React 19 + TypeScript + Vite côté client, Express côté serveur, un
seul process Node sert l'API et l'app (pas de proxy à configurer). Le module
`server/db.ts` ouvre toujours un fichier SQLite local (`DATA_DIR/horizon.db`,
`DATA_DIR` par défaut `./data`) via libSQL en mode `file:` — application
pensée pour tourner uniquement en local, sur cet ordinateur, aucun compte ou
service externe requis.

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

- **`server/db.ts` ouvre toujours un fichier SQLite local**,
  `DATA_DIR/horizon.db` (`DATA_DIR` par défaut `./data`), via libSQL en mode
  `file:`. Pas de moteur distant, pas de variable à configurer pour choisir
  la base.

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
  db.ts                    connexion base (fichier local libSQL), schéma SQL, migrations
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
    journalFilters.ts        tri des colonnes et fenêtres de période du Journal (logique pure)
    pendingChanges.ts        suivi des modifications non encore envoyées au serveur (mode hors ligne)
    planCompliance.ts        vérification du respect du plan de trading
    walletAlerts.ts / walletStats.ts   alertes et calculs sur les comptes de trading
    performanceStats.ts      calculs de rentabilité, durée des trades, capture de la cible, ventilation par plan
    weeklySummary.ts         synthèse hebdomadaire
    format.ts / image.ts / confirmDialog.tsx   utilitaires divers
  components/
    Sidebar.tsx, TopHeader.tsx, MainDashboard.tsx        navigation et tableau de bord principal
    TradingJournal.tsx                                    journal d'exécution (chargé à la demande)
    PerformanceDashboard.tsx, EquityCurveChart.tsx        analyse de rentabilité (chargés à la demande)
    WalletManagement.tsx                                  portefeuille / comptes (chargé à la demande)
    SetupManagement.tsx                                   gestion des setups (chargé à la demande)
    MacroDashboard.tsx, MarketMapWidget.tsx, TradingSessionsWidget.tsx   calendrier macro et marché
    TradingPlanEditorModal.tsx                            plan de trading
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
- **Base de données à moteur unique (SQLite local).** Le support Postgres et
  Turso a été retiré de `server/db.ts` (et la dépendance `pg` du
  `package.json`) : l'application ne tourne plus qu'en local, sur cet
  ordinateur, jamais déployée en ligne. Ne pas réintroduire cette abstraction
  sans demande explicite.
- **Badges remis à zéro.** Les 26 badges du catalogue (`data/horizon.db`,
  table `badges`) ont été réinitialisés (`unlocked: false`,
  `progressPercentage: 0`, `currentValue: 0`, `unlockedAt` retiré) pour
  repartir sur un suivi réel : seule la progression calculable depuis les
  trades déjà journalisés compte (voir `src/lib/badges.ts`,
  `computeBadgeProgress`) ; les badges qui reposent sur une donnée non suivie
  (modules cours, examen, % de risque déclaratif...) restent `trackable:
  false` et affichent "Suivi pas encore disponible pour ce badge".
- **Le formulaire du Journal ne pré-remplit plus rien.** Il proposait un trade
  EUR/USD complet (entrée 1.085, SL 1.083, TP 1.091, lot 1, 14h30, émotion
  « Discipliné ») : un champ non écrasé partait en base comme une vraie saisie,
  et l'émotion par défaut faisait monter toute seule la discipline émotionnelle
  — la statistique même qu'on cherche à mesurer. Seuls restent la date du jour
  (bornée) et les trois `<Select>` marché / sens / unité. `result` et `emotion`
  sont typés `| ""` **côté formulaire uniquement** (`Trade` reste strict) et
  `handleFormSubmit` refuse d'enregistrer tant que les deux ne sont pas choisis.
  Ne pas « rétablir des valeurs par défaut pratiques » : c'est le bug d'origine.
- **Les statistiques du Journal portent sur l'ensemble FILTRÉ**
  (`computeJournalSummary(filteredTrades)`), jamais sur `sortedTrades` — l'ordre
  d'affichage ne change aucune moyenne. `MainDashboard.tsx` et le rapport PDF
  continuent, eux, de calculer sur tous les trades : c'est voulu, les deux vues
  peuvent donc afficher des chiffres différents (d'où l'indicateur « N trades
  filtrés sur M » dans le Journal).
- **`exitPrice` absent ou nul = « pas de prix de sortie ».** `parsePriceInput("")`
  vaut 0, qui s'écrivait en base comme une cotation à zéro — impossible sur tous
  les marchés du Journal. Le champ n'est plus persisté sur une position ouverte
  ni quand il est laissé vide, et `tradeExitRatios` écarte les 0 hérités des
  saisies antérieures.
- **« Capture de la cible », pas « efficacité de sortie ».** Sans MFE (plus haut
  atteint en position), on ne peut pas mesurer ce que le marché a offert —
  seulement la part de l'objectif planifié réellement encaissée. Le nom de la
  métrique reflète ce qu'elle mesure vraiment. Gagnants et perdants sont agrégés
  séparément, regroupés par `result` (choisi explicitement par l'utilisateur) et
  **jamais** par le signe du ratio : un WIN à capture négative est une
  incohérence de saisie qu'il faut laisser voir, pas reclasser en douce.

- **Le serveur n'écoute que sur `127.0.0.1`.** Il écoutait sur `0.0.0.0`
  (toutes les interfaces réseau), héritage de l'époque où l'app était pensée
  pour un déploiement derrière un proxy : sur un Wi-Fi partagé, n'importe qui
  atteignait le journal à `http://<ip-de-la-machine>:3000`, et un mot de passe
  saisi depuis un autre appareil circulait en clair (pas de TLS en local).
  `HOST=0.0.0.0` reste possible pour un usage délibéré (consulter le journal
  depuis son téléphone), mais c'est un choix explicite, pas le défaut.
- **Les captures d'écran ne vivent PAS dans la collection `trades`.** Elles y
  étaient en base64 : la collection partant en un seul envoi à chaque
  sauvegarde, un journal d'environ 23 trades illustrés dépassait la limite de
  8 Mo du serveur et devenait impossible à enregistrer (HTTP 413, mesuré).
  Elles vivent désormais dans `trade_screenshots`, servies une par une par
  `GET /api/screenshots/:id` (filtrées par `user_id`, cache immuable), et un
  trade n'en garde que l'URL. Le payload des trades est passé de 1405 Ko à
  2 Ko pour les mêmes données. Ne pas y réintroduire d'images : la table n'a
  volontairement pas de clé étrangère vers `trades` (l'id du trade n'existe pas
  encore à l'envoi), les orphelines étant balayées au démarrage par
  `purgeOrphanScreenshots`.
- **Toute nouvelle collection synchronisée doit être déclarée à TROIS
  endroits**, sous peine de perte de données silencieuse : `TABLES`
  (`server/repositories.ts`), `LEGACY_KEYS.collections`
  (`src/hooks/useServerSync.ts`, sinon pas de cache hors ligne) et `LABELS`
  (`src/lib/pendingChanges.ts`). Ce dernier est le plus traître :
  `markPending` ignore en silence toute clé absente de `LABELS`, donc une
  écriture échouée n'est ni signalée, ni retenue à la déconnexion, et repart
  écrasée par l'état serveur au rechargement suivant.

## Lancement

Application pensée pour tourner **uniquement en local**, sur cet ordinateur :
pas d'hébergeur, pas de déploiement en ligne. Voir README, "Démarrage en
local" pour le détail pas-à-pas (`npm install` puis `npm run dev`).

Variables d'environnement principales : `PORT` (défaut 3000), `DATA_DIR`
(dossier de la base SQLite locale, défaut `./data`), `NODE_ENV`. Voir
`.env.example` pour la liste complète.

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
`isOwner`/permissions par coach/`enrolledStudents`, module **Mindset**
(`MindsetJournalModal.tsx`, entrée de sidebar), support **Postgres/Turso**
dans `server/db.ts` (et la dépendance `pg`), fichier `LICENSE` et
`REGISTRE_TRAITEMENTS.md` (registre RGPD pour une activité de coaching
multi-utilisateurs, sans objet pour un usage personnel).
