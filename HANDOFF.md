# HANDOFF — PropDesk

Document de reprise, à lire avant de toucher au code. Écrit pour quelqu'un
(humain ou IA) qui n'a aucun contexte préalable sur ce dépôt.

## État au moment de l'écriture

- Branche : `main`.
- `origin` pointe désormais vers un dépôt **privé** dédié à l'usage personnel
  (`journal-de-trading`), plus vers l'ancien dépôt public `propdesk-template`.
- Document à jour au commit `44c09d3 — "Rend « Cumul de Performance +10R »
  mesurable : le capital n'était pas nécessaire"` (le commit suivant est cette
  mise à jour du HANDOFF elle-même).
- **Tests : `npm test` (vitest, 196 tests)** sur les calculs purs — soldes,
  statistiques du Journal, durées, capture de la cible, R réalisé, badges, tri
  et fenêtres de période, filet anti-perte `pendingChanges`, conformité au
  plan, comparaison de périodes, revue hebdomadaire, sparkline, ébauche du
  calculateur, et résistance aux données aberrantes (émotion hors catalogue,
  nombre illisible, tableau non trié). `npm run lint` (`tsc --noEmit`) reste la
  vérification de typage. Les composants React ne sont pas testés : la logique
  testable en est extraite vers `src/lib/` — c'est la raison d'être de
  `tradeDraft.ts`, dont le contenu tenait auparavant en ligne dans
  `TradingJournal.tsx` et n'était donc couvert par rien.

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
  backup.ts                copie automatique du fichier de base au démarrage (20 conservées, 6 h d'intervalle mini)
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
    badges.ts                calcul de progression des badges, séries de discipline, cumul en R
    journalFilters.ts        tri des colonnes et fenêtres de période du Journal (logique pure)
    pendingChanges.ts        suivi des modifications non encore envoyées au serveur (mode hors ligne)
    planCompliance.ts        respect du plan de trading, par trade et agrégé par règle
    walletAlerts.ts / walletStats.ts   alertes et calculs sur les comptes de trading
    performanceStats.ts      rentabilité, durée des trades, capture de la cible, R réalisé, ventilations
    periodComparison.ts      comparaison période sur période (semaine / mois)
    weeklyReview.ts          revue hebdomadaire : découpage des semaines, objectifs typés, verdicts
    weeklySummary.ts         phrase d'accueil du tableau de bord
    sessions.ts              sessions Forex (extrait de TopHeader pour être testable)
    sparkline.ts             tracé de la courbe compacte du PnL cumulé
    tradeDraft.ts            application d'une ébauche du calculateur sur le formulaire du Journal
    format.ts / image.ts / confirmDialog.tsx   utilitaires divers
  components/
    Sidebar.tsx, TopHeader.tsx, MainDashboard.tsx        navigation et tableau de bord principal
    PeriodComparisonCard.tsx                              « est-ce que je progresse ? » (semaine / mois)
    WeeklyReviewBanner.tsx, WeeklyReviewModal.tsx         rituel de revue hebdomadaire
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
| POST | `/api/screenshots` | envoie une capture d'écran de trade (id généré) |
| GET | `/api/screenshots/:id` | sert une capture (filtrée par `user_id`, cache immuable) |
| GET | `/api/backup/screenshots` | toutes les captures — export de sauvegarde uniquement |
| POST | `/api/backup/screenshots` | réinsère un lot de captures en conservant leur identifiant |

Toutes les routes exigent une session valide, sauf `/api/health`,
`/api/economic-calendar`, `/api/market-data`, `/api/auth/me`,
`/api/auth/setup`, `/api/auth/login` (et son étape 2FA) et
`/api/auth/logout`. Toutes les entrées sont validées par zod
(`server/schemas.ts`). Limitation de débit par IP : `/api/auth/login` 10 par
quart d'heure, `/api/auth/setup` 5 par quart d'heure.

## Décisions de fond à connaître

- **Rien de ce qui se recalcule n'est stocké.** Le verdict d'un objectif
  hebdomadaire (`src/lib/weeklyReview.ts`), les violations de plan agrégées
  (`computePlanComplianceSummary`) et les comparaisons de périodes
  (`src/lib/periodComparison.ts`) sont TOUS recalculés depuis les trades à
  chaque affichage. Les figer en ferait des caches faux dès qu'un trade est
  corrigé ou qu'un plan est édité — même famille de raisonnement que
  « `result` n'est jamais déduit du signe du PnL ». Conséquence assumée et
  annoncée à l'écran : un trade d'il y a six mois est jugé avec les règles
  d'aujourd'hui.
- **Un objectif hebdomadaire est TYPÉ, jamais du texte libre.** Le journal
  doit pouvoir dire seul s'il a été tenu, et aucune IA n'est utilisée ici. Le
  catalogue (`OBJECTIF_CATALOGUE`) ne contient que ce qui se vérifie sur des
  données déjà saisies. Le texte libre de la revue (« ce qui a marché ») garde
  toute sa place : il porte le pourquoi, pas ce qu'on vérifie.
- **Le verdict d'un objectif a TROIS états**, et le troisième
  (`non_verifiable`) est le plus important : sans lui, « aucun trade en
  émotion » serait déclaré atteint sur une semaine sans le moindre trade, et
  l'application récompenserait le fait de ne pas trader.
- **Seuil d'échantillon unique : 5.** Partout où une moyenne pourrait se lire
  comme un verdict (ratios de sortie, win rate par setup, comparaison de
  périodes), en dessous de 5 trades la valeur reste AFFICHÉE mais en gris —
  c'est le verdict qu'on suspend, pas la donnée.
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
- **Badges remis à zéro, et désormais TOUS suivis.** Les badges du catalogue
  (`data/horizon.db`, table `badges`) ont été réinitialisés (`unlocked: false`,
  `progressPercentage: 0`, `currentValue: 0`, `unlockedAt` retiré) pour
  repartir sur un suivi réel : seule la progression calculable depuis les
  trades déjà journalisés compte (voir `src/lib/badges.ts`,
  `computeBadgeProgress`). Les badges reposant sur des modules retirés (cours,
  examen) ont été supprimés du catalogue, et le dernier qui restait
  `trackable: false` — « Cumul de Performance +10R » — est maintenant mesuré
  (voir la décision sur le R juste en dessous). **Les 23 badges du catalogue
  ont donc chacun leur `case` dans `computeSingleBadgeProgress`, et plus aucun
  n'affiche « Suivi pas encore disponible ».** Ce message et le drapeau
  `trackable: false` restent en place comme filet : un badge ajouté au
  catalogue sans son calcul l'affichera, plutôt que de mentir avec une barre
  à 0 %.
- **Le R d'un trade se mesure sur les PRIX, pas sur l'argent.** Le cumul en R
  a longtemps été déclaré hors de portée, au motif qu'il fallait le montant
  risqué en devise, donc le capital du compte au moment du trade — que rien ne
  conserve. C'est vrai de la voie monétaire, et faux de la voie géométrique :
  dans `PnL / risque engagé`, la taille de lot et la valeur du point
  s'annulent, et il reste `déplacement / |entrée − stop|` (voir
  `tradeRealizedR`, `src/lib/performanceStats.ts`). L'application faisait déjà
  cette arithmétique pour « Capture du TP » et « Perte vs SL ». Deux limites
  assumées et écrites dans la description du badge : le R est géométrique
  (hors frais et spread) et un trade sans prix de sortie n'est pas
  comptabilisé — il est compté à part, jamais traité comme un 0 R.
- **`TradeDraft` porte des NOMBRES, le formulaire du Journal des CHAÎNES.**
  Ses champs sont des `<input type="text">` relus par `parsePriceInput`, qui
  commence par `raw.trim()`. Recopier une ébauche du calculateur telle quelle
  levait `raw.trim is not a function` : le trade n'était jamais enregistré, le
  formulaire restait ouvert, et rien ne l'expliquait — tout le chemin
  « Appliquer au Journal » était inutilisable en silence, et c'est pour cela
  qu'aucun trade ne portait de `riskPercent`. La conversion vit dans
  `appliquerDraft` (`src/lib/tradeDraft.ts`), s'aligne sur le TYPE DU CHAMP
  VIERGE et non sur une liste de noms, et est testée. La soumission du
  formulaire est par ailleurs enveloppée dans un `try/catch` qui AFFICHE
  l'échec : une saisie complète ne doit jamais disparaître sans un mot.
- **Ne jamais supposer l'ordre du tableau `trades`.** `computeRiskDisciplineStreak`
  se fiait au commentaire « App.tsx insère en tête », vrai de la seule saisie
  manuelle : un import CSV empile dans l'ordre du fichier, une édition de date
  laisse le trade en place, un rechargement rend l'ordre `position` de la base.
  Toute logique « en partant du plus récent » doit trier elle-même, comme le
  fait `computeDisciplineStreak`.
- **Une ventilation par clé doit CRÉER sa case.** `emotionStats[t.emotion]`
  supposait la clé présente : une émotion hors catalogue (sauvegarde retouchée,
  trade d'une version antérieure) faisait tomber tout l'écran Rentabilité sur
  un `Cannot read properties of undefined`. Les quatre autres ventilations du
  même fichier créaient leur case à la volée. Même famille de piège pour
  `MISTAKE_PHRASES[weakness]`, qui affichait « Ton point faible : undefined ».
  Une donnée que l'application n'a pas produite elle-même doit être écartée et
  comptée, jamais rangée dans une case voisine ni supposée valide.
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
  d'affichage ne change aucune moyenne. `MainDashboard.tsx` continue, lui, de
  calculer sur tous les trades : c'est voulu, les deux vues peuvent donc
  afficher des chiffres différents (d'où l'indicateur « N trades filtrés sur M »
  dans le Journal).
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
- **Un fichier se télécharge par `Blob`, jamais par une URL `data:`.**
  L'export CSV du Journal passait par `encodeURI("data:text/csv,...")` :
  `encodeURI` n'échappe pas le croisillon, donc la première note contenant un
  « # » (« setup #3 ») transformait tout ce qui suivait en fragment d'URL et le
  fichier téléchargé s'arrêtait là, sans message. Une URL `data:` plafonne en
  outre en longueur selon le navigateur. L'export ajoute un BOM UTF-8 pour
  qu'Excel lise correctement les accents ; l'import le tolère parce que
  `String.prototype.trim()` retire le BOM (vérifié), ce sur quoi
  `normalizeHeader` s'appuie.
- **Toute cellule numérique importée d'un CSV est validée AVANT d'entrer.**
  `parsePriceInput` renvoie `NaN` sur du texte, et un `NaN` dans `pnl`
  contaminait toutes les sommes de l'application — PnL cumulé, capital, courbe
  d'équité, profit factor, soldes — en affichant « $NaN » sans désigner la
  ligne fautive. Une ligne illisible est refusée et NOMMÉE (colonne, valeur,
  numéro de ligne).
- **La sauvegarde JSON n'est PAS `GET /api/state`.** Les captures d'écran
  vivent dans `trade_screenshots`, hors des collections : elles ne sont donc
  pas dans `/api/state`, et l'export les a longtemps oubliées — une sauvegarde
  restaurée sur une base neuve rendait tous les trades avec des images
  cassées, sans aucun avertissement. L'export appelle désormais aussi
  `GET /api/backup/screenshots`, et la restauration les réinsère par lots
  (limite de corps de 8 Mo) en CONSERVANT leur identifiant : les `chartUrls`
  des trades pointent dessus. Toute donnée future stockée hors des collections
  devra faire la même chose, sous peine du même trou.
- **Toute nouvelle collection synchronisée doit être déclarée à SIX
  endroits**, sous peine de perte de données silencieuse :
  1. `SCHEMA_STATEMENTS` (`server/db.ts`) — la table ;
  2. `CollectionName` + `TABLES` (`server/repositories.ts`) — tout le reste du
     serveur (routes, export, sauvegarde) est piloté par `TABLES` ;
  3. `ServerCollections` (`src/lib/api.ts`) ;
  4. `LEGACY_KEYS.collections` (`src/hooks/useServerSync.ts`) — sinon pas de
     cache hors ligne ;
  5. `LABELS` **et** `COLLECTION_BY_KEY` (`src/lib/pendingChanges.ts`) ;
  6. `useSyncedState` (`src/App.tsx`).

  Ce document annonçait TROIS endroits, et cet oubli a coûté deux pertes de
  données silencieuses de suite sur les plans de trading. `markPending` ignore
  en silence toute clé absente de `LABELS` ; et une clé présente dans `LABELS`
  mais absente de `COLLECTION_BY_KEY` est comptée comme envoyée par
  `replayPending` puis retirée du registre, sans jamais partir. Un test de
  garde (`src/lib/__tests__/pendingChanges.test.ts`) échoue désormais si les
  deux tables divergent — mais il ne couvre que le point 5.

## Lancement

Application pensée pour tourner **uniquement en local**, sur cet ordinateur :
pas d'hébergeur, pas de déploiement en ligne. Voir README, "Démarrage en
local" pour le détail pas-à-pas (`npm install` puis `npm run dev`).

Variables d'environnement principales : `PORT` (défaut 3000), `DATA_DIR`
(dossier de la base SQLite locale, défaut `./data`), `NODE_ENV`. Voir
`.env.example` pour la liste complète.

## Tests

`npm test` (vitest) couvre `src/lib/` — 196 tests, 13 fichiers. Deux d'entre
eux sont des gardes structurelles plutôt que des tests de calcul :
`pendingChanges.test.ts` échoue si une collection est déclarée dans `LABELS`
sans l'être dans `COLLECTION_BY_KEY` (le trou qui a coûté deux pertes de
données), et `donneesAberrantes.test.ts` fige la résistance aux données que
l'application n'a pas produite elle-même. Les composants React ne sont pas
testés : quand une logique mérite un test, on l'extrait vers `src/lib/`.

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
- Une modification faite hors ligne n'est jamais rejouée toute seule. Elle est
  retenue dans un registre local (`src/lib/pendingChanges.ts`) et
  `PendingChangesBanner` la propose explicitement à la reconnexion :
  l'utilisateur tranche entre l'envoyer et l'abandonner. Rien ne repart
  automatiquement, parce qu'une collection est remplacée EN BLOC et jamais
  fusionnée ligne à ligne. (Ce document affirmait auparavant qu'elles étaient
  simplement perdues — c'était le comportement d'avant `pendingChanges`.)
- Les captures d'écran ne transitent pas par l'export CSV du Journal (ce
  format n'a pas de place pour des images) : seule la sauvegarde JSON les
  emporte.
- Le R des badges de performance est géométrique : il ignore frais, spread et
  swap, et un trade sans prix de sortie n'entre pas dans le cumul.

## Ce qui n'existe plus (pour éviter de le réintroduire par réflexe)

Comptes coach/élève et leur double parcours applicatif, permissions/invites
staff, modules cours et vidéos (leçons, upload vidéo, programme), Annonces,
Messagerie coach, Forum, module "Signaux & Analyses", écran de consultation
du journal de sécurité (le journal côté serveur existe toujours, juste sans
UI pour le consulter), Mentions légales/CGU et le footer qui les affichait,
connexion par email, export PDF du rapport de performance (un commentaire de
`WalletManagement.tsx` y fait encore référence, il est périmé),
`better-sqlite3`, hypothèse d'un déploiement Railway
exclusif, catalogue de badges liés à la progression dans des cours, notions
`isOwner`/permissions par coach/`enrolledStudents`, module **Mindset**
(`MindsetJournalModal.tsx`, entrée de sidebar), support **Postgres/Turso**
dans `server/db.ts` (et la dépendance `pg`), fichier `LICENSE` et
`REGISTRE_TRAITEMENTS.md` (registre RGPD pour une activité de coaching
multi-utilisateurs, sans objet pour un usage personnel).
