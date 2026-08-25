# HANDOFF — PropDesk (Académie de Trading)

Document de reprise. Il suppose que tu n'as accès ni à la conversation qui
l'a produit, ni à autre chose que ce dépôt. Lis-le en entier avant de
toucher au code.

> **État à la dernière mise à jour de ce document**
> Branche **`main`**, dernier commit **poussé** : `959ff91` (« Rattrape les
> badges/modules jamais initialisés chez un élève existant »), **déployé
> avec succès sur Railway** (`SUCCESS` confirmé via `railway deployment
> list --service propdesk --json`).
>
> **MAIS ce commit `959ff91` a un bug connu, déjà corrigé dans l'arbre de
> travail, PAS ENCORE COMMITÉ** : voir §0 ci-dessous, c'est la toute
> première chose à traiter en reprenant. Un seul fichier modifié,
> non commité : `server/routes.ts`. `npx tsc --noEmit` et `npm run build`
> passent sans erreur ; corrigé et vérifié directement en base de données
> (voir §0), mais **jamais vérifié en conditions réelles via le navigateur
> connecté** (aucun identifiant élève disponible dans la session qui a
> produit ce correctif).
>
> Application déployée sur **Railway**, domaine
> `https://propdesk-academie.up.railway.app`.

---

## 0. Où reprendre EXACTEMENT

### Le correctif en cours (non commité) : badges/modules jamais initialisés chez un élève

**Symptôme rapporté par l'utilisateur** : un élève voit "Badges & Succès
0/0" dans son profil — aucun badge affiché, alors qu'il devrait voir le
catalogue complet (verrouillé) et pouvoir en débloquer en utilisant l'app.

**Cause racine** : les badges (et modules vidéo) d'un élève sont copiés
depuis le bureau staff partagé au moment de son **invitation**
(`server/auth/routes.ts`, recherche `sharedBadges`) — mais cette copie ne
se produit qu'**une seule fois**, sans mécanisme de rattrapage. Un élève
invité avant l'existence de cette copie, ou à un moment où le bureau staff
n'avait lui-même **encore rien à copier**, reste bloqué à vie avec une
collection vide.

**Premier correctif tenté (commit `959ff91`, DÉPLOYÉ mais INSUFFISANT)** :
une fonction `backfillStudentDefaultCollections()` dans `server/routes.ts`,
appelée à chaque `GET /api/state` d'une session élève, qui copie
badges/modules depuis la collection du bureau staff (`DEFAULT_USER_ID`) si
la collection de l'élève est vide. **Le bug** : sur ce déploiement, la
collection "badges" du bureau staff **n'a jamais été réellement écrite
côté serveur** — le tableau de bord staff affiche les 9 badges uniquement
via un repli d'affichage côté client (`seed()` dans `AcademyApp`,
`src/App.tsx`, retombe sur `initialTraderBadges` de `mockData.ts` sans
jamais le persister tant que personne ne réclame un badge). Copier depuis
cette collection revient donc à copier une liste vide : le rattrapage ne
rattrapait rien.

**Correctif actuel (dans l'arbre de travail, NON COMMITÉ)** : la partie
"badges" de `backfillStudentDefaultCollections()` utilise maintenant
**directement** la constante `initialTraderBadges` importée depuis
`src/data/mockData.ts` (import cross-répertoire `../src/data/mockData`
depuis `server/routes.ts` — fonctionne car ce fichier est de la donnée pure,
sans dépendance React/DOM, et esbuild le bundle sans problème dans
`dist/server.cjs`, vérifié : `grep` dans le bundle retrouve bien les
titres de badges, juste échappés en unicode `\xEE` pour les accents). Les
badges copiés sont toujours reposés `unlocked: false` (jamais un faux badge
déjà débloqué). La partie "modules" garde sa logique d'origine (copie
depuis le bureau staff en priorité — c'est du vrai contenu personnalisable
par le fondateur, pas un catalogue fixe — avec repli sur `initialModules`,
qui est vide dans ce projet, donc sans effet réel aujourd'hui).

**Vérifié** : reproduit exactement les conditions de production en local
(bureau staff ET élève vidés de leurs badges dans `data/horizon.db`),
exécuté la même logique via un script `tsx` autonome, confirmé les 9
badges recréés côté élève, tous verrouillés. **PAS vérifié dans le
navigateur** (session élève réelle) faute d'identifiants disponibles dans
la session qui a produit ce correctif — c'est la prochaine étape avant de
committer.

**Prochaine étape immédiate** :
1. Committer ce correctif (`server/routes.ts` — un seul fichier).
2. Pousser et déployer sur Railway **seulement si l'utilisateur le demande
   explicitement** (voir §10 — jamais spontanément).
3. Une fois déployé, demander à l'utilisateur de confirmer avec son élève
   que les badges apparaissent bien (0/9, pas 0/0).
4. Si le bug persiste malgré tout après ce déploiement, le diagnostic
   suivant à creuser : vérifier que le compte élève concerné a bien un
   `student_account_id` actif (un élève sans accès actif n'appelle jamais
   `GET /api/state` en tant qu'élève) et que la route appelle bien
   `backfillStudentDefaultCollections(dataUserId)` avec le bon
   `dataUserId` (voir la ligne juste avant `res.json(...)` dans la branche
   `kind === "student"`).

---

## 1. Le projet en bref

**PropDesk** est une plateforme d'académie de trading SMC (*Smart Money
Concepts*) destinée à un coach (le fondateur, compte admin) et à ses
élèves. Interface **entièrement en français**, ton direct, tutoiement.
Devise unique : **`$`**, jamais `€` (exception assumée : le module
Calculateurs, qui affiche `€/$` sur certains champs pour coller à une
maquette externe). **Aucune IA n'est utilisée nulle part** — décision
produit explicite et répétée plusieurs fois, ne jamais la réintroduire
sans nouvelle demande explicite.

C'est un **vrai projet full-stack** : React 19 + TypeScript + Vite côté
client, Express + `better-sqlite3` (SQLite, mode WAL) côté serveur, un
seul process Node sert les deux.

**Deux mondes d'identité strictement séparés**, jamais mélangés :
- **Staff** (`AcademyApp`, `src/App.tsx`) : un bureau **partagé** entre
  tous les comptes coach (`DEFAULT_USER_ID`), toutes les données du
  fondateur et des élèves y transitent en lecture. Tout compte staff a
  `isAdmin: true` — "tous les comptes staff ont les mêmes droits" est le
  principe actuel du projet (documenté et assumé, pas un oubli).
- **Élève** (`StudentAuthenticatedApp`, `src/App.tsx`) : chaque élève a son
  propre bureau isolé (`student-<id>`), ses propres trades, comptes, plan,
  badges, modules.

Format des nombres **totalement libre** dans les champs de prix du Journal
de trading et du Calculateur (voir §6, §8) : point ou virgule, avec ou sans
séparateur de milliers, à l'emplacement choisi par qui tape —
`parsePriceInput` (`src/lib/format.ts`) retrouve le bon nombre quelle que
soit la convention utilisée. Convention "PnL réalisé"
(`isRealizedDollarTrade`, `src/lib/performanceStats.ts`) : un trade
`OPEN` n'entre dans AUCUN total $ agrégé nulle part dans l'app.

Le projet possède : mentions légales/CGU, gestion d'accès/mot de passe
élève complète, **2FA (TOTP) maison** pour les comptes staff, journal de
sécurité, photo de profil élève, **export RGPD Article 20**, **effacement
en cascade Article 17**, système de niveau/XP dynamique, module **Setups**,
**Plans de trading multiples** (avec **Aperçu en lecture seule** + onglet
Édition, voir §6), module **Annonces** (diffusion fondateur → élèves, avec
son), **captures d'écran multiples par trade** (Début/Pendant/Après +
emplacements supplémentaires, voir §6), **import/export CSV** du Journal,
un onglet **Suivi de performance** dédié dans les fiches élèves (séparé de
l'édition), et des **menus déroulants à l'apparence identique sur tous les
navigateurs** (composant partagé `Select.tsx`, voir §6/§8).

---

## 2. Démarrage immédiat

| Commande | Effet |
|---|---|
| `npm install` | installe les dépendances (client + serveur, même `package.json`) |
| `npm run dev` | lance le serveur Express + Vite en mode dev (HMR) |
| `npx tsc --noEmit` | vérifie le typage sur tout le projet — c'est le "lint" de ce projet |
| `npm run build` | build de production (`vite build` + `esbuild server.ts` → `dist/`) |
| `git push` puis `railway redeploy --from-source -y` | déploiement Railway — **JAMAIS `railway up`** (le `.gitignore` a un motif `data/` qui matche aussi `src/data/`, faisant échouer l'upload) |
| `railway deployment list --service propdesk --json` | vérifie le statut du dernier déploiement (`SUCCESS`/`FAILED`/`BUILDING`) |

**Piège serveur** : après une modification côté `server/`, le serveur de
dev doit être redémarré manuellement (pas de hot-reload serveur) — tuer le
process sur le port 3000 (`lsof -ti:3000 | xargs kill`) puis relancer.

**Piège SQL** : jamais de backtick littéral dans un commentaire SQL `-- ...`
à l'intérieur d'un template `db.exec(\`...\`)` dans `server/db.ts` — casse
la compilation TS avec une erreur obscure (TS1005). Texte brut uniquement
dans ces commentaires.

**Tester une fonctionnalité élève sans casser une session coach en
cours** : ne jamais se déconnecter du compte staff. Un second navigateur/
profil privé, l'API directe, ou le compte élève de test existant "Sensei"
(présent dans la base de dev locale) sont les méthodes sûres.

**Inspection SQLite directe** : `sqlite3 data/horizon.db`, puis `.tables`,
`.schema <table>`, `SELECT * FROM ... ;`. Table `student_accounts` pour
retrouver le `user_id` d'un élève à partir de son email.

**Vérifier un correctif serveur sans navigateur** : un script `tsx` autonome
à la racine du projet (`npx tsx mon-script.ts`) peut importer directement
`server/repositories.ts`/`server/db.ts` et exécuter la même logique qu'une
route contre la vraie base de dev — utile pour vérifier une migration/un
rattrapage de données sans avoir besoin d'une session authentifiée. Toujours
sauvegarder `data/horizon.db` avant (`cp data/horizon.db /tmp/backup.db`) et
le supprimer après usage (jamais commité).

**Accès production Railway** : logs et déploiement se pilotent via la CLI
`railway` (`railway logs`, `railway deployment list --service propdesk
--json`, `railway redeploy --from-source -y`) — pas d'accès direct à la
base de production depuis l'environnement de dev.

---

## 3. Architecture

```
server.ts                     Point d'entrée : Express + Vite (dev) ou
                               statique (prod) + helmet + trust proxy +
                               tâches de nettoyage périodiques. Parseurs
                               JSON à taille bornée : 16kb par défaut sur
                               /api/auth, 2mb sur /api/auth/profile/avatar
                               et /api/auth/announcements (uploads
                               d'image), 8mb ailleurs.

server/
  db.ts                        SQLite (better-sqlite3, WAL, foreign_keys
                               ON). Toutes les migrations sont idempotentes
                               (CREATE TABLE IF NOT EXISTS / PRAGMA
                               table_info avant ALTER TABLE). DEFAULT_USER_ID
                               = "user-local" (bureau staff partagé).
  repositories.ts               Accès aux données : `listCollection`,
                               `replaceCollection` (avec contrôle de
                               concurrence optimiste par version, voir §8),
                               `updateCollectionItem`, singletons
                               (profil, plan de trading, annonces).
  routes.ts                     Routes générales (`/api/state`,
                               `/collections/:name`, `/profile`,
                               `/quiz-results`, calendrier économique,
                               données de marché). Contient
                               `backfillStudentDefaultCollections()` (voir
                               §0) — appelée à chaque `GET /state` élève.
  schemas.ts                    Validation Zod de tout ce qui entre par
                               l'API. `containsDangerousUrlScheme` (scan
                               récursif anti-XSS générique),
                               `isSafeChartUrls` (validation de
                               `Trade.chartUrls[]`).
  middleware/rateLimit.ts       Limiteur de débit générique.
  auth/
    routes.ts                    `authRouter` (login, 2FA, logout) +
                               `staffRouter` (gestion comptes staff —
                               création réservée `requireOwner`, 2FA,
                               journal de sécurité, annonces, invitation
                               élève avec copie badges/modules).
    studentRoutes.ts             Auth élève + `PUT /trading-plan` + export
                               RGPD.
    exportData.ts                 Export Article 20 (rate-limité).
    totp.ts                       TOTP maison (RFC 6238/4226), anti-rejeu
                               via `totp_last_used_step`.
    twoFactor.ts                  Accès bas niveau 2FA staff.
    sessions.ts / studentSessions.ts   Sessions serveur, durée de vie
                               ABSOLUE de 90 jours (`ABSOLUTE_TTL_MS`) en
                               plus du renouvellement glissant de 30 jours.
    loginLockout.ts                Verrouillage de compte après échecs
                               (indexé par email, pas IP — trade-off
                               assumé, voir §8).
    studentCredentials.ts          Profil élève, jetons de reset (invalidés
                               à la régénération).
    password.ts / credentials.ts   Hachage scrypt, comparaison anti-timing.
    securityEvents.ts               Journal de sécurité (purge RGPD 90j).
  economicCalendar.ts / marketData.ts   Flux externes, cache, timeout.
  seed.ts                        Amorçage initial (démo).

src/
  App.tsx                      Fichier central : les deux shells
                               `StudentAuthenticatedApp` et `AcademyApp`,
                               quasi-dupliqués (même feature, deux mondes
                               d'identité — voir §8 pour pourquoi ce n'est
                               pas factorisé). Tous les handlers de haut
                               niveau (`handleAddTrade`, `handleClaimBadge`,
                               `applyPlanCompliance`...).
  types.ts                     Tous les types métier. `TradeScreenshot`
                               (captures multiples), `Trade.chartUrls`
                               (remplace l'ancien `chartUrl`, gardé
                               `@deprecated` pour lecture rétro-compatible).
  data/mockData.ts               Données de démo + catalogue FIXE des 9
                               badges (`initialTraderBadges`) — importé
                               aussi côté SERVEUR maintenant (voir §0),
                               fichier de donnée pure sans dépendance
                               React/DOM.
  hooks/
    useAuth.ts                   État d'authentification, 2FA.
    useServerSync.ts               `useSyncedState` (sync optimiste avec
                               contrôle de version), `useBootstrap`
                               (staff), `useStudentBootstrap` (élève).
    useNotificationSound.ts        Son d'alerte (Web Audio API).
    usePersistentState.ts          `useState` + localStorage, tolère un
                               changement de clé en cours de vie (relit au
                               lieu d'écraser).
  lib/
    format.ts                     `formatCurrency` + `parsePriceInput`
                               (saisie libre des prix, voir §6/§8).
    image.ts                      `resizeChartScreenshot`/`resizeAvatar` —
                               décodage en cascade (`createImageBitmap` →
                               `<img>` → fichier brut en dernier recours,
                               voir §6) pour accepter tous les formats
                               d'image sans jamais bloquer l'upload.
    pendingChanges.ts               Registre des modifications hors ligne
                               non synchronisées (couvre trades, comptes,
                               setups, plan de trading namespacé par email).
    badges.ts                     `computeBadgeProgress` — recalcule la
                               progression en direct depuis trades/modules,
                               ne touche jamais `unlocked`/`unlockedAt`.
    planCompliance.ts               `checkPlanViolations`,
                               `normalizeTradingPlans` (validation de type
                               par champ), `parsePriceInput`-compatible.
    walletStats.ts / performanceStats.ts   Calculs partagés, tous
                               "PnL réalisé"-aware.
  components/
    Select.tsx                    NOUVEAU — `<select>` personnalisé
                               partagé par tout le projet (chevron
                               identique sur tous les navigateurs, voir
                               §6/§8). Remplace l'ancien `ThousandsInput.tsx`
                               (supprimé) et la définition locale qui
                               vivait dans `TradingJournal.tsx`.
    TradingJournal.tsx             Le plus gros fichier de composant.
                               Captures d'écran multiples, import/export
                               CSV, prix en saisie libre, tous les
                               `<select>` uniformisés.
    TradingPlanEditorModal.tsx      Onglets "Aperçu" (lecture seule, en un
                               coup d'œil) / "Modifier" (formulaire
                               complet) — voir §6.
    StudentTracking.tsx             Fiches élèves (staff) — onglets
                               "Infos" / "Suivi de performance" (graphique
                               d'évolution + notes de session), dans la
                               fiche d'édition ET la fiche complète en
                               lecture seule.
    WalletManagement.tsx             Formulaire de portefeuille — champs
                               numériques `step="any"` (pas juste `min`,
                               voir bug §7 déjà corrigé).
    Announcements.tsx / CoachMessaging.tsx / PositionCalculatorModal.tsx /
    SecurityLogModal.tsx             Tous mis à jour pour utiliser `Select`.
```

---

## 4. Le module Calculateurs

`PositionCalculatorModal.tsx`. Affiche `€/$` sur certains champs pour
coller à une maquette externe — exception volontaire à la règle "devise
unique `$`" du reste de l'app. Champs de prix en saisie libre
(`parsePriceInput`, comme le Journal). Menus déroulants uniformisés
(`Select`).

---

## 5. Fonctionnalités terminées (les plus récentes en premier)

- **Rattrapage badges/modules jamais initialisés** (en cours, voir §0) —
  self-heal côté serveur à chaque chargement d'état élève.
- **Menus déroulants uniformisés sur tout le projet** — composant partagé
  `Select.tsx` (chevron personnalisé, `appearance-none`) : sans lui, Safari
  affichait une double flèche "spinner" alors que Chrome affiche un simple
  chevron, un coach et son élève ne voyaient pas le même formulaire pour un
  code identique. Appliqué à Portefeuille, Messagerie Coach, Calculateur,
  Journal de sécurité, Annonces, Suivi des Élèves, Journal de trading.
- **Saisie libre des prix (point/virgule au choix)** — `parsePriceInput`
  (`src/lib/format.ts`) remplace l'ancien `ThousandsInput` qui forçait un
  regroupement par milliers pendant la frappe (faux sur un actif comme
  XAU/USD). Fonctionne dans le Journal ET le Calculateur.
- **Import CSV du Journal de trading** — bouton à côté d'"Exporter CSV",
  colonnes retrouvées par nom (tolère un fichier réordonné), lignes
  invalides ignorées et comptées à part.
- **Aperçu du Plan de trading** — onglet "Aperçu" en lecture seule (par
  défaut à l'ouverture) + onglet "Modifier" pour le formulaire complet.
- **Onglet "Suivi de performance" dans les fiches élèves** — le graphique
  d'évolution + notes de session ne sont plus mélangés aux champs d'édition
  de la fiche, dans un onglet séparé (fiche d'édition ET fiche complète).
- **Acceptation de tous les formats d'image** — `resizeChartScreenshot`
  (`src/lib/image.ts`) ne bloque plus jamais un upload : décodage en
  cascade (`createImageBitmap` → `<img>` → fichier brut si les deux
  échouent). Limite connue : un format qu'AUCUN navigateur ne sait afficher
  (HEIC réel sur Chrome/Android) sera enregistré mais peut ne pas
  s'afficher en aperçu — limitation de la plateforme, pas de l'app.
- **Captures d'écran multiples par trade** — `Trade.chartUrls`
  (`TradeScreenshot[]`) remplace `chartUrl` (gardé `@deprecated` pour la
  lecture rétro-compatible). 3 emplacements par défaut (Début/Pendant/
  Après) toujours proposés + emplacements supplémentaires à libellé libre
  (jusqu'à 8). Validé côté serveur (`isSafeChartUrls`, `schemas.ts`).
- **Correction de la validation des champs numériques du Portefeuille** —
  `step="any"` ajouté (un `min="0.1"` sans `step` limitait les valeurs
  acceptées à 0,1/1,1/2,1... rejetant "10").
- Fonctionnalités antérieures (déjà en production, stables) : audit
  sécurité complet (concurrence multi-onglets, convention PnL réalisé,
  durcissements 2FA/sessions/uploads/XSS — voir historique git pour le
  détail, `6b60eb4` et `acfd951`), RGPD complet, module Annonces, alerte
  sonore, plans de trading multiples, niveau/XP, module Setups.

---

## 6. Flux détaillés

### 6.1 Rattrapage badges/modules (voir §0 pour l'état exact et le bug résiduel)

`backfillStudentDefaultCollections(dataUserId)` (`server/routes.ts`),
appelée à chaque `GET /api/state` élève : si `badges` est vide, copie
`initialTraderBadges` (catalogue fixe, `src/data/mockData.ts`) avec des id
préfixés `${dataUserId}-` et `unlocked: false` forcé ; si `modules` est
vide, copie en priorité le contenu réel du bureau staff, avec repli sur
`initialModules` (vide dans ce projet, donc sans effet pratique).

### 6.2 Captures d'écran multiples par trade

`toScreenshotSlots(trade)` (`TradingJournal.tsx`) garantit toujours 3
emplacements "Début/Pendant/Après" dans le formulaire (même vides),
absorbe l'ancien `chartUrl` d'un trade existant dans "Début" à l'édition.
`handleAddScreenshotSlot`/`handleRemoveScreenshotSlot` gèrent les
emplacements supplémentaires (libellé libre, jusqu'à 8 au total). À la
soumission, seuls les emplacements avec une image sont persistés.
`getFilledScreenshots(trade)` (distincte, ne force pas les 3 emplacements)
sert à l'aperçu en lecture seule.

### 6.3 Décodage d'image en cascade (accepte tous les formats)

`decode()` (`src/lib/image.ts`) tente `createImageBitmap` (rapide, corrige
l'orientation EXIF), puis `<img>` classique si ça échoue (plus permissif —
corrige le cas réel signalé : un PNG valide rejeté par
`createImageBitmap` sur Safari). Si les deux échouent,
`resizeChartScreenshot` retombe sur `readAsDataUrl(file)` : le fichier
original, non compressé, plutôt que de bloquer l'upload.

### 6.4 Saisie libre des prix

`parsePriceInput(raw)` (`src/lib/format.ts`) : un seul séparateur présent
(point OU virgule) est toujours la décimale ; les deux présents (ex.
"4.655,66" ou "4,655.66"), celui qui apparaît EN DERNIER est la décimale,
l'autre n'est que du regroupement à retirer. Les champs eux-mêmes
n'appliquent plus aucun formatage/reformatage pendant la frappe — texte
totalement libre, filtré uniquement sur `[\d.,]`.

### 6.5 Import CSV du Journal

`handleImportCSV` (`TradingJournal.tsx`) : `parseCsv()` maison (RFC 4180
basique, miroir de `csvCell` côté export), colonnes retrouvées par NOM
(`CSV_IMPORT_COLUMNS`) pas par position. Chaque ligne valide devient un
NOUVEAU trade (`onAddTrade`) — la colonne "ID" de l'export est ignorée,
réimporter son propre export crée donc des doublons plutôt que de
fusionner. Une ligne avec marché/direction/résultat inconnu est ignorée et
comptée à part.

### 6.6 Menus déroulants uniformisés

`Select` (`src/components/Select.tsx`) : `appearance-none` + un chevron
`ChevronDown` constant, quel que soit le navigateur. Le padding droit est
fixé en `style` inline (pas en classe Tailwind — une classe `pr-*`
perdrait face à un `p-2.5`/`px-3` du même niveau de spécificité selon
l'ordre interne des utilitaires Tailwind).

---

## 7. Bugs connus / limitations

**En cours de correction, voir §0** :
- Rattrapage badges/modules — correctif dans l'arbre de travail, pas
  encore vérifié en conditions réelles connecté.

**Limite de plateforme assumée (pas un bug applicatif)** :
- Un format d'image qu'AUCUN navigateur ne sait afficher (HEIC réel sur
  Chrome/Android, sans support natif) sera enregistré via le repli "fichier
  brut" mais peut ne jamais s'afficher en aperçu sur ce navigateur — vrai
  seulement pour des formats exotiques, PNG/JPEG/WebP fonctionnent partout.

**Non traités, restent de vrais arbitrages produit (pas des oublis)** :
- Verrouillage de compte par email (pas par IP) — `server/auth/loginLockout.ts` :
  protection anti-credential-stuffing délibérée, dont la contrepartie
  (quelqu'un qui connaît un email peut verrouiller ce compte en boucle)
  n'a pas de correctif gratuit sans ajouter de l'infrastructure (CAPTCHA,
  déverrouillage admin). Documenté dans le code, pas un bug oublié.
- Fan-out de notifications à la publication d'une annonce, synchrone —
  jugé hors scope à l'échelle actuelle du projet (dizaines/centaines
  d'élèves), à revisiter si le nombre d'élèves actifs devient très grand.
- Score du quiz rapide de leçon (VideoAcademy, `activeLessonQuizModal`)
  jamais persisté — semble être un outil de vérification à faible enjeu,
  pas une évaluation formelle. Nécessiterait un nouveau champ/schéma/route
  si un suivi réel est voulu — pas fait faute de demande explicite.

**Limitations connues, non des bugs** :
- Le calendrier économique ne montre que "cette semaine" (flux
  ForexFactory) — peut être vide un vendredi soir, comportement normal.
- Pas de QR code pour la 2FA — secret + lien `otpauth://` cliquable,
  décision explicite pour éviter une dépendance externe.

---

## 8. Décisions techniques importantes

- **Import cross-répertoire serveur ← client pour les données pures**
  (`server/routes.ts` importe `src/data/mockData.ts`) — accepté
  spécifiquement parce que ce fichier n'a aucune dépendance React/DOM,
  esbuild le bundle sans problème. Ne PAS généraliser ce pattern à des
  fichiers qui ont de vraies dépendances client (composants, hooks).
- **`isRealizedDollarTrade`** comme seule source de vérité pour "ce trade
  compte-t-il dans un total $ agrégé ?" — un trade `OPEN` n'y entre jamais.
- **`parsePriceInput`** comme seule source de vérité pour convertir un prix
  saisi librement en nombre — ne jamais réintroduire `Number(x)` direct ni
  un formatage forcé (`ThousandsInput`, supprimé) sur un champ de prix.
- **`Select` partagé** pour tout nouveau `<select>` du projet — ne jamais
  revenir à un `<select>` brut, le rendu natif diverge entre navigateurs.
- **Contrôle de concurrence optimiste scopé aux seules collections
  `CollectionName`** (pas aux endpoints singleton comme le plan de trading
  ou les annonces) — compromis coût/bénéfice assumé.
- **Catalogue de badges FIXE, jamais édité via une UI** — `initialTraderBadges`
  fait foi directement pour le rattrapage, indépendamment de ce que
  contient (ou pas) la collection "badges" du bureau staff.
- **Plans de trading multiples avec sélection manuelle explicite** — le
  `tradingPlanId` d'un trade n'est jamais déduit automatiquement du setup.
- **Aperçu en lecture seule par défaut** (Plan de trading, et pattern
  "Infos"/"Suivi de performance" des fiches élèves) — un module qui mélange
  consultation et édition dans le même écran gagne à séparer les deux dès
  qu'il devient consulté plus souvent qu'édité.
- **Aucune dépendance externe pour le TOTP** — implémentation maison
  (RFC 6238/4226) sur `node:crypto` uniquement.
- **Aucune IA nulle part dans le produit** — décision produit ferme,
  répétée plusieurs fois, ne jamais réintroduire sans demande explicite.

---

## 9. Historique de nommage (contexte)

`SectionHeader` est réimplémenté localement dans chaque fichier qui en a
besoin plutôt que factorisé en composant partagé — décision historique
assumée (variations mineures de style/props par section).

Le module "Annonces" a été nommé ainsi plutôt que "Académie" pour éviter
une collision avec le module vidéo existant `VideoAcademy.tsx`
(`TabType: "academy"`).

`ThousandsInput.tsx` a existé puis a été **supprimé** une fois tous ses
appelants migrés vers la saisie libre (`parsePriceInput`) — si tu tombes
sur une référence à ce nom dans un vieux commentaire, c'est de l'histoire,
pas un fichier manquant.

---

## 10. Contexte de travail avec l'utilisateur

Forexpaps est le fondateur de PropDesk, **non-technique**, délègue
largement l'exécution du code. Il valide des décisions produit (nommage,
droits d'accès, priorités) mais pas des détails d'implémentation.

**Workflow observé sur de nombreux échanges, à reproduire** :
1. L'utilisateur signale un bug (souvent via une ou deux captures d'écran
   comparant "chez moi" vs "chez mon élève") ou demande une fonctionnalité
   en une phrase.
2. Diagnostiquer en profondeur AVANT de proposer un correctif — plusieurs
   bugs de cette session avaient une cause différente de l'hypothèse
   initiale la plus évidente (voir §0 : le rattrapage badges a été corrigé
   UNE FOIS, déployé, et s'est révélé insuffisant à l'usage réel — la
   bonne pratique est de vérifier l'hypothèse aussi près que possible des
   conditions réelles avant de conclure qu'un correctif est fini).
3. Corriger directement, vérifier (`tsc` + `build` + test en navigateur ou
   en base de données), puis résumer clairement CE QUI A CHANGÉ et
   pourquoi, en français simple, sans jargon inutile.
4. **Ne JAMAIS committer, pousser, ni déployer sans demande explicite** —
   "commite et pousse" / "publie sur Railway" sont des phrases qui
   reviennent systématiquement, une par une, après chaque correctif validé.
5. Un déploiement Railway prend ~1-2 minutes ; vérifier le statut via
   `railway deployment list` après un délai raisonnable plutôt que de
   sonder en boucle serrée.

**Test d'une fonctionnalité élève** : ne jamais déconnecter une session
coach en cours. Utiliser un second navigateur/profil privé, l'API directe,
ou le compte élève de test "Sensei" existant.

**Sur la vérification** : plusieurs bugs de cette session (menus
déroulants, formats d'image, badges) étaient invisibles en local pour le
développeur (macOS/Chrome) mais visibles uniquement dans l'environnement
réel de l'élève (souvent Safari/iOS, ou un compte créé avant une
fonctionnalité). Toujours envisager que "ça marche chez moi" et "ça marche
en production pour un compte existant" sont deux affirmations différentes
— tester avec des données/navigateurs représentatifs de la vraie
population d'utilisateurs quand c'est possible (onglet neuf, simulation en
base de données des conditions réelles), pas seulement le cas le plus
simple.

---

## 11. Prochaines tâches, dans l'ordre

1. **Committer le correctif badges/modules en cours** (`server/routes.ts`,
   voir §0) — un seul fichier, prêt.
2. Sur demande explicite de l'utilisateur seulement : pousser et déployer
   sur Railway.
3. Une fois déployé, s'assurer que l'utilisateur confirme avec son élève
   que les badges apparaissent (0/9 au lieu de 0/0). Si ce n'est toujours
   pas le cas, suivre le diagnostic de repli donné en §0 (point 4).
4. Aucune autre tâche explicitement demandée n'est en attente à la date de
   cette mise à jour — le reste de ce document (§7) liste des arbitrages
   produit non tranchés (verrouillage par email, fan-out d'annonces, quiz
   de leçon non persisté) : ne les traiter QUE si l'utilisateur les
   soulève, ce sont des choix, pas des bugs oubliés.
5. En l'absence de demande précise, un audit de sécurité/bugs complet
   (méthode : agents parallèles en lecture seule par zone, résultats
   compilés et priorisés, une seule vraie question de permission posée à
   l'utilisateur si besoin, tout le reste corrigé directement) a déjà été
   fait deux fois dans l'historique de ce projet et est une action que
   l'utilisateur redemande périodiquement — un bon réflexe si aucune tâche
   spécifique n'est donnée et qu'un moment semble propice à une passe de
   qualité.

---

## 12. État à la reprise

- Branche `main`, dernier commit **poussé et déployé** : `959ff91`.
- **1 fichier modifié, non commité** : `server/routes.ts` (correctif
  badges/modules, voir §0) — `npx tsc --noEmit` et `npm run build` passent
  sans erreur, vérifié en base de données mais pas en navigateur connecté.
- Aucun autre chantier ouvert. Le reste du projet est stable et déployé.
- Aucun blocage technique connu — juste la vérification finale en
  conditions réelles à obtenir de l'utilisateur après déploiement (§0/§11).
