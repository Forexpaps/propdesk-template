# HANDOFF — PropDesk (Académie de Trading)

Document de reprise. Il suppose que tu n'as accès ni à la conversation qui
l'a produit, ni à autre chose que ce dépôt. Lis-le en entier avant de
toucher au code.

> **État à la dernière mise à jour de ce document**
> Branche `main`, dernier commit poussé : **`dfe149c`** (« Ajoute le statut
> Compte DÉMO et le changement de mot de passe volontaire »), déployé avec
> succès sur Railway (`status: SUCCESS` confirmé via
> `railway deployment list --service propdesk --json`, et confirmé
> visuellement par l'utilisateur).
> **Répertoire de travail PROPRE** — `git status --short` ne renvoie rien.
> `npm run lint` et `npm run build` passent sans erreur.
> Application déployée sur **Railway**, domaine
> `https://propdesk-academie.up.railway.app`.

---

## 0. Où reprendre EXACTEMENT

**Pas de chantier interrompu** — le répertoire de travail est propre et le
dernier commit est déployé avec succès. **Aucun bug bloquant connu.**
Quelques points ouverts, non bloquants, à connaître :

1. **Suggestion en attente (chip), pas encore traitée** : deux
   `window.confirm()` natifs subsistent dans `StudentTracking.tsx` (ligne
   ~228, révocation d'accès élève ; ligne ~1036, suppression d'élève) —
   peu fiables en prévisualisation et sur iOS en mode application (voir §2
   et §7). **En creusant pour ce document, il s'avère qu'il y en a en fait
   PLUS que ça** dans tout le projet : `ForumSection.tsx:306`,
   `PendingChangesBanner.tsx:71`, `StaffAccountsModal.tsx:94`,
   `UserProfileModal.tsx:185` (import de sauvegarde). Aucun n'a encore été
   remplacé par une modale maison — seul `WalletManagement.tsx` a déjà reçu
   ce traitement (session antérieure). Si l'utilisateur relance ce chantier,
   élargis le périmètre à ces cinq fichiers, pas seulement les deux connus.
2. **Formule non confirmée par l'utilisateur** : la "note globale" d'une
   session de coaching (`computeSessionGlobalNote`,
   `src/lib/coachingSessionStats.ts`) a été **déduite** d'une capture
   d'écran de référence externe, pas communiquée explicitement par
   l'utilisateur. Elle correspondait exactement aux deux exemples visibles
   à l'époque, mais n'a jamais été confirmée depuis. Si un doute survient
   dessus, redemander plutôt que de supposer que c'est acquis.
3. **Comportement à surveiller, pas confirmé comme un bug** : la création
   d'un sujet de forum (`ForumSection.tsx`, `handleCreateTopicSubmit`)
   fixe `authorRole: "Élève Premium"` en dur, y compris si l'auteur est un
   coach — repéré en marge d'un autre chantier, jamais creusé ni signalé à
   l'utilisateur. Peut être volontaire (un topic n'a pas besoin du badge
   coach, contrairement à une réponse) ou être un oubli. Ne pas le
   corriger sans avoir vérifié l'intention réelle.

Tout le reste est terminé, vérifié, et déployé.

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
(`#111615`/`#1B2320`), micro-labels `[9px]`/`[10px]` en majuscules
espacées, en-têtes de section à barre verticale colorée (`SectionHeader`,
un composant local à chaque fichier, jamais partagé — voir §9 pourquoi).
Palette PropDesk (vert `#00E676`, fonds `#0D1110`/`#111615`) inchangée.

Le projet possède une page publique de mentions légales, un système
complet de gestion d'accès/mot de passe élève (invitation, changement
forcé, changement volontaire, lien de réinitialisation à jeton), un
journal de sécurité complet réservé au fondateur, et depuis cette période
une photo de profil personnalisable par chaque élève et un changement de
mot de passe volontaire pour tout compte staff.

### Qui l'utilise

Outil de travail d'un coach (« ForexPaps »/« Forex Paps » selon
l'environnement, `th.gauthey99@gmail.com`, compte fondateur) et de son
staff. Plusieurs comptes staff partagent le même bureau (mêmes trades,
fiches élèves, portefeuilles) — « mêmes droits pour tous », un principe
répété dans le code (`credentials.ts`, `StaffAccountsModal.tsx`), avec une
**seule exception depuis cette période** : la suppression d'un compte
coach est désormais réservée au fondateur (`requireOwner`), suite à un
audit de sécurité — voir §5 et §8. Les élèves ont un second monde
d'identité séparé, chacun avec son propre bureau cloisonné. Seul « Suivi
des Élèves » (et désormais « Sécurité », via le journal dans le profil)
reste réservé à un compte staff/fondateur — voir §3/§8.

### Hébergement : Railway (pas seulement GitHub)

**Railway** (`https://propdesk-academie.up.railway.app`, projet
"propdesk", dépôt GitHub `Forexpaps/propdesk` connecté) :
- Service configuré avec un **volume persistant** `/data` (500 Mo) monté
  sur `DATA_DIR=/data`, `NODE_ENV=production`.
- **Déploiement automatique sur push** fonctionne, vérifié à chaque
  session par `railway deployment list --service propdesk --json`.
- **Depuis cette période**, le serveur vérifie lui-même au démarrage la
  cohérence de cette configuration (voir §5/§8, `server.ts`) : si
  `DATA_DIR` est positionné (signe d'un déploiement voulu en production)
  mais que `NODE_ENV` ne vaut pas `"production"`, un avertissement
  impossible à manquer s'affiche dans les logs de démarrage. Vérifié à
  cette période : aucun avertissement dans les logs Railway, la config est
  saine.
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
  premier, au plus UN `curl`/`railway logs` espacé dans le temps ensuite.

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

**⚠️ Piège d'outil de prévisualisation confirmé, sur plusieurs sessions** :
un onglet de navigateur laissé ouvert longtemps pendant une session de
travail accumule des erreurs de rechargement à chaud (HMR) obsolètes dans
sa console — module supprimé, ordre des hooks React qui semble avoir
changé, `ReferenceError` sur une variable qui n'existe plus. **Ce ne sont
quasiment toujours que des artefacts de l'historique d'édition de cet
onglet précis**, pas de vrais bugs : la méthode de vérification fiable est
d'ouvrir un **onglet neuf** (`tabs_create`) et de comparer sa console —
vérifié à plusieurs reprises cette période, toujours confirmé inoffensif.
Un raccourci clavier simulé (`cmd+R`) ne recharge pas toujours vraiment la
page non plus ; préférer `navigate()` vers la même URL, ou un onglet neuf.

**⚠️ `window.confirm()`/`window.prompt()` natifs sont fiables NULLE PART
où ils sont encore utilisés** — deux causes distinctes confirmées :
1. Dans le Browser pane automatisé de dev : `confirm()` retourne
   silencieusement `false`, `prompt()` lève une exception.
2. **En production, sur iOS, quand le site est ouvert en mode application**
   (icône ajoutée à l'écran d'accueil) : `confirm()`/`prompt()` restent
   muets. Bug réel signalé par l'utilisateur en usage réel sur iPhone.

   Déjà corrigé dans `WalletManagement.tsx` (deux modales maison). **Six
   autres usages restent** dans le projet (`StudentTracking.tsx` ×2,
   `ForumSection.tsx`, `PendingChangesBanner.tsx`, `StaffAccountsModal.tsx`,
   `UserProfileModal.tsx`) — voir §0 point 1. **Si tu retrouves un
   `window.confirm()`/`prompt()` ailleurs, remplace-le proactivement.**

**⚠️ Le flux de réinitialisation de mot de passe élève (§6) n'envoie aucun
e-mail** — c'est assumé et documenté en commentaire dans le code
(`server/auth/studentCredentials.ts`, `server/auth/studentRoutes.ts`) : le
lien est affiché une seule fois côté staff, à copier/transmettre à la
main. Ne pas "corriger" en ajoutant un envoi d'e-mail sans qu'on te le
demande — aucune infrastructure d'envoi n'existe dans ce projet.

**⚠️ Tester une fonctionnalité élève sans casser la session du coach** :
les cookies de session staff (`pd_session`) et élève (`pd_student_session`)
sont distincts, mais **partagés entre tous les onglets du même navigateur**
— et côté serveur, une session staff valide prime toujours sur une session
élève si les deux coexistent (`useAuth.ts`, commentaire "staff prime").
Impossible donc d'afficher l'UI élève dans le même navigateur qu'une
session staff active sans déconnecter cette dernière. **Ne jamais faire
ça sans le demander à l'utilisateur** (ni taper son mot de passe pour lui,
règle absolue). À la place : vérifier via des appels `fetch` directs
(`javascript_tool`) sur les vraies routes, avec un compte élève de test
existant en base, et le dire explicitement à l'utilisateur (ce qui a été
vérifié vs ce qui ne l'a pas été). Pour une logique serveur pure (ex.
gestion de session), un script `tsx` jetable à la racine du projet,
supprimé après usage, est une autre option propre — utilisé cette période
pour vérifier `destroyOtherSessions` sans toucher à aucune vraie session.

### Inspecter la base locale

```bash
sqlite3 data/horizon.db "select id, name, email from staff_accounts"
sqlite3 data/horizon.db "select json_extract(payload,'\$.isAdmin') from users where id='user-local'"
sqlite3 data/horizon.db "select id, json_extract(payload,'\$.name'), json_extract(payload,'\$.equity') from trading_accounts"
sqlite3 data/horizon.db "select id, json_extract(payload,'\$.name'), json_extract(payload,'\$.statusTag') from enrolled_students"
sqlite3 data/horizon.db "select id, email, must_change_password from student_accounts"
```

**⚠️ Piège confirmé, à connaître** : `users.payload.isAdmin` peut être
`0`/absent en base pour le compte fondateur SANS que ce soit un problème
réel — le serveur force `isAdmin: true` dans la réponse `/api/state` pour
toute session staff (voir §6/§8), sans jamais réécrire la valeur en base à
la lecture. **Il l'écrit désormais correctement à l'écriture aussi**
(`PUT /profile` force `isAdmin: true` sans jamais le redériver d'une
valeur potentiellement périmée — bug de fond corrigé cette période, voir
§5/§7).

**Piège confirmé, non corrigé, faible priorité** : `.gitignore` contient
`data/` sans slash de tête, qui matche `src/data/` en plus du dossier
SQLite racine — `git add src/data/mockData.ts` (chemin exact) refuse et
demande `-f`. `git add -A`/`git add .` fonctionnent normalement.

**⚠️ Les données locales de test peuvent changer entre deux sessions sans
intervention explicite** — ne jamais supposer que l'état des données
locales observé à un instant T est stable — revérifier avec `sqlite3`
avant de bâtir un raisonnement dessus.

### Inspecter la base Railway (production)

Pas d'accès direct — pas de SSH (refusé explicitement par l'utilisateur).
Pour toute vérification, passer par l'API HTTP du site déployé (`curl`,
avec parcimonie — voir §1) ou par le dashboard Railway (`railway open`, ou
https://railway.com/project/1ff27138-1722-451a-95c5-4719ffbae46a), ou par
`railway logs --service propdesk` pour les logs de démarrage.

### Compte admin

`th.gauthey99@gmail.com` — mot de passe jamais consigné ici. **Ne jamais
le taper toi-même** dans un formulaire, y compris pour se connecter à
l'environnement Railway, y compris pour tester la nouvelle modale "Mon mot
de passe" (§5 point 7).

---

## 3. Architecture

### Vue d'ensemble

```
server.ts                     point d'entrée : Express + Vite/statique
                               + helmet + trust proxy (prod) + tâches de
                               nettoyage périodiques (sessions staff,
                               sessions élève, événements de sécurité,
                               verrous de connexion, jetons de
                               réinitialisation de mot de passe élève).
                               DEPUIS CETTE PÉRIODE : avertissement de
                               démarrage si NODE_ENV/DATA_DIR incohérents
                               (voir §1/§5/§8).
server/
  db.ts                        SQLite (better-sqlite3, WAL, foreign_keys
                               ON), 19 tables. Migrations ponctuelles
                               idempotentes en bas de fichier (motif
                               établi : fonction + appel immédiat après sa
                               définition, protégée par une clé `meta` ou
                               naturellement idempotente comme
                               `DROP TABLE IF EXISTS`). Piège syntaxique
                               connu : jamais de backtick littéral dans un
                               commentaire SQL `-- ...` de ce fichier (casse
                               la compilation TS avec une erreur obscure).
                               DEPUIS CETTE PÉRIODE : table `coach_signals`
                               SUPPRIMÉE (migration `migrateDropCoachSignals`,
                               le module "Signaux & Analyses" a été retiré
                               entièrement, voir §5).
  repositories.ts               accès bas niveau aux tables.
                               `CollectionName` n'inclut plus `"signals"`.
  routes.ts                     routes /api/* génériques. `buildCoachesForStudent()`
                               reconstruit le coach affiché à l'élève depuis
                               le vrai profil fondateur. `buildStaffProfile()`
                               force `isAdmin: true` pour toute session
                               staff (lecture ET désormais écriture, voir
                               §7). `PUT /profile` reste réservée au staff.
                               `/economic-calendar` et `/market-data` ont
                               désormais un rate limit (voir §7).
  schemas.ts                    schémas Zod. `updateAvatarSchema` (nouveau,
                               élève). `isSafeMediaUrl`/`isValidInitialBalance`
                               ne laissent plus passer un mauvais type
                               silencieusement (bug de confusion de type
                               corrigé, voir §7). `authorAvatar` (forum)
                               ajouté à `SAFE_MEDIA_URL_FIELDS`.
  middleware/rateLimit.ts       limiteur par IP en mémoire, fabrique
                               (`createRateLimit`), inchangé cette période.
  auth/
    routes.ts                   `staffRouter`. Nouveautés cette période :
                               `PUT /profile/avatar` — non, cette route vit
                               dans `studentRoutes.ts` (élève). Ici :
                               `DELETE /staff/:id` désormais protégée par
                               `requireOwner` en plus de `requireStaffKind`
                               (suite audit sécurité). `/change-password`
                               ne détruit plus la session courante de
                               l'appelant (`destroyOtherSessions`, voir §7).
                               `/students/:id/trades` renvoie désormais
                               aussi `email` (le vrai email de connexion,
                               voir §7). Détection et réponse 409 propre sur
                               collision d'invitation concurrente
                               (`isUniqueConstraintViolation`).
    studentRoutes.ts             `studentAuthRouter` (public) +
                               `studentProtectedRouter`. Nouvelle route
                               cette période : `PUT /profile/avatar` (élève
                               choisit sa propre photo). Même correctif de
                               session que côté staff sur
                               `/student-change-password`
                               (`destroyOtherStudentSessions`).
    studentCredentials.ts        `buildStudentProfile()` fusionne désormais
                               aussi l'avatar personnel de l'élève
                               (`ownProfile.avatar`, bureau personnel) —
                               prioritaire sur `enrolled.avatar` (la fiche
                               du coach) s'il est présent. `setStudentPassword`
                               prend un 3e paramètre `mustChangePassword`
                               (`false` par défaut, `true` quand c'est le
                               STAFF qui fixe la valeur pour l'élève — force
                               alors son remplacement, voir §7).
    sessions.ts / studentSessions.ts   `destroyOtherSessions`/
                               `destroyOtherStudentSessions` (nouvelles) :
                               révoquent toutes les sessions D'UN COMPTE
                               SAUF celle qui vient de faire la requête —
                               pour un changement de mot de passe VOLONTAIRE
                               (voir §5/§7). `destroyAllSessions`
                               (staff) a été retirée, n'avait qu'un seul
                               appelant, remplacé. `destroyAllStudentSessions`
                               reste utilisée telle quelle pour les cas où
                               il n'y a pas de "session courante à
                               préserver" (staff qui fixe un mot de passe
                               élève, reset par lien).
    password.ts                  Coût scrypt relevé à N=2^17 (recommandation
                               OWASP actuelle), contre 2^15 avant —
                               migration en douceur via `needsRehash()`,
                               déjà en place, aucun mot de passe existant
                               invalidé.
    securityEvents.ts             inchangé cette période — journal de
                               sécurité déjà complet (`get24hStats`,
                               `listSecurityEvents`, purge RGPD 90 jours).
  economicCalendar.ts / marketData.ts   inchangés fonctionnellement.
                               `marketData.ts` : le champ `scale` de
                               `^TNX` (rendement 10 ans) est désormais
                               RÉELLEMENT appliqué (bug corrigé, affichait
                               un facteur 10 d'erreur, voir §7).
src/
  App.tsx                      porte d'auth à deux mondes. Deux "shells"
                               distincts (`StudentAuthenticatedApp`,
                               `AcademyApp`), état de modale dupliqué par
                               design. Nouveautés cette période :
                               - `resetToken` (lien de reset élève) retire
                                 désormais le jeton de l'URL/historique dès
                                 sa lecture (`history.replaceState`).
                               - `onUnauthenticated` (`useAuth.ts`) vide
                                 `localStorage` à l'expiration NATURELLE
                                 d'une session élève, pas seulement au clic
                                 sur "Déconnexion" — bug de sécurité réel
                                 corrigé (voir §7).
                               - `handleAddForumReply` ne marque plus
                                 automatiquement un sujet "Résolu"/une
                                 réponse "SOLUTION VALIDÉE" sur une réponse
                                 de coach — seule l'action manuelle
                                 (`onToggleSolveTopic`) le fait désormais.
                               - `journalDraft`/`prefillDraft` ajoutés au
                                 shell ÉLÈVE (existait déjà côté staff) :
                                 le Setup Analyzer peut transférer un setup
                                 vers le Journal élève, ce qu'il ne pouvait
                                 pas faire avant (bouton silencieux, voir
                                 §7).
                               - Module "Signaux & Analyses" retiré
                                 entièrement (composant, état, imports,
                                 rendu — voir §5).
  types.ts                     `StudentStatusTag` a désormais 5 valeurs
                               (`"Compte DÉMO"` ajoutée avant "Évaluation
                               Étape 1"). `EnrolledStudent.email` documenté
                               comme pouvant diverger de l'email de
                               connexion réel une fois un accès actif (voir
                               §7). `ForumTopic.authorEmail` (nouveau,
                               optionnel) : identifiant stable pour le
                               filtre "Mes Sujets", `authorName` seul
                               confondait les homonymes. `CoachSignal`
                               retiré (module supprimé).
  hooks/
    useAuth.ts                  voir App.tsx ci-dessus pour le correctif
                               de sécurité sur `onUnauthenticated`.
    useServerSync.ts             `useStudentBootstrap` expose désormais
                               `setStudent` (permet une mise à jour locale
                               instantanée après un changement d'avatar).
                               Rejoue désormais SILENCIEUSEMENT toute
                               modification élève restée "en attente"
                               (`markPending`) AVANT même d'appliquer l'état
                               serveur au montage — combLé au correctif
                               `onUnauthenticated`, empêche qu'un élève sur
                               poste partagé hérite des données en attente
                               d'un précédent utilisateur (voir §7).
  lib/
    api.ts                      `updateStudentAvatar` (nouveau).
                               `fetchStudentTrades` renvoie désormais aussi
                               `email`. `ServerCollections`/`CollectionName`
                               n'incluent plus `signals`.
    performanceStats.ts          date de départ de la courbe d'équité
                               (`equityData[0].date`) vient désormais de
                               `student.joinedDate`, plus une valeur codée
                               en dur ("15 Jan").
    walletStats.ts               `dailyLossPercent` calcule "aujourd'hui"
                               en heure LOCALE, plus en UTC (bug de
                               conformité prop firm corrigé, voir §7).
    format.ts                    `formatCurrency` affiche toujours
                               exactement 2 décimales (avant : nombre de
                               décimales incohérent d'un montant à l'autre),
                               et ne peut plus afficher "-$0.00" sur un
                               résidu flottant négatif proche de zéro.
    coachingSessionStats.ts       NOUVEAU (session antérieure à celle-ci,
                               mais après le dernier HANDOFF) —
                               `computeSessionGlobalNote`, formule non
                               confirmée par l'utilisateur, voir §0.
    pendingChanges.ts             plus de référence à `horizon_signals`.
  components/
    ChangeOwnPasswordModal.tsx    NOUVEAU — changement de mot de passe
                               VOLONTAIRE pour un compte staff déjà
                               connecté (n'importe lequel, pas réservé au
                               fondateur), ouvert depuis `UserProfileModal`.
                               Voir §5/§6.
    UserProfileModal.tsx           prop `avatarOnly` (élève) : seule la
                               photo est modifiable, le reste des champs
                               est désactivé avec une note explicite. Tous
                               les champs du formulaire (pas seulement
                               `activeSubTab`) se resynchronisent désormais
                               à chaque réouverture de la modale — un champ
                               modifié puis "Annulé" ne réapparaissait pas
                               correctement à la réouverture avant ce
                               correctif. Nouveau bloc "Mon mot de passe"
                               (staff uniquement, `!avatarOnly`).
    StudentTracking.tsx            fichier le plus gros du projet
                               (~1590 lignes). `getStatusTagStyle`/
                               `getStatusTagLabel` : filet de sécurité pour
                               tout statut absent/non reconnu. `STATUS_TAGS`
                               a désormais 5 valeurs (Compte DÉMO en
                               premier). Champ "Email" (fiche) DÉSACTIVÉ dès
                               qu'un accès élève est actif, avec renvoi
                               explicite vers "Accès & connexion" — les deux
                               champs divergeaient silencieusement sinon
                               (bug corrigé, voir §7). Le champ "Identifiant
                               (email de connexion)" se précharge désormais
                               avec le VRAI email de connexion
                               (`api.fetchStudentTrades().email`), pas
                               l'email de la fiche — même bug, corrigé côté
                               lecture aussi. `handleOpenReadOnly` garde
                               contre une réponse réseau tardive
                               (`realTradesRequestId`) qui pouvait afficher
                               les trades d'un élève A sur la fiche d'un
                               élève B. Section "Suivi d'évolution"
                               (graphique + notes de session, voir plus
                               bas) intégrée en lecture seule ET en édition.
                               Diagnostic initial et Erreurs récurrentes
                               désormais aussi visibles en LECTURE SEULE
                               (avant : édition uniquement). Téléphone
                               affiché en lecture seule (avant : invisible
                               hors édition).
    StudentEvolutionSection.tsx /
    StudentEvolutionChart.tsx      NOUVEAUX (session antérieure à
                               celle-ci) — graphique d'évolution (Discipline/
                               Performance/Exécution du plan/Global) +
                               notes de session détaillées, en accordéon.
                               `StudentEvolutionChart.tsx` isolé pour le
                               lazy-loading `recharts`, même motif que
                               `EquityCurveChart.tsx`.
    EquityCurveChart.tsx            `ReferenceLine` fixe à $11,500 retirée
                               (affichait un faux palier "ATTEINT" à tout
                               élève indépendamment de son vrai capital).
                               Devient optionnelle (`referenceValue`/
                               `referenceLabel`), non fournie par
                               `MainDashboard` faute de calcul non-arbitraire
                               pour un graphique multi-comptes (voir §7).
    MainDashboard.tsx               sa courbe d'équité locale (distincte de
                               celle de `performanceStats.ts`, libellés
                               courts "T1"/"T2" pour la tuile compacte)
                               ignore désormais correctement les trades en
                               `%` au lieu de les additionner comme des $.
    TradingJournal.tsx               `lotSize` : le champ acceptait "0" en
                               le forçant silencieusement à "1", rendant
                               impossible toute taille commençant par 0
                               (0.01, 0.5…) — corrigé. Formulaire
                               correctement réinitialisé après une ébauche
                               du calculateur (avant : un vieux trade en
                               édition annulé laissait son PnL/capture/tags
                               fuiter sur le trade suivant créé depuis le
                               calculateur). Seuil mort ±50$ retiré du
                               classement WIN/LOSS/BREAKEVEN (faisait
                               contredire Win Rate et PnL total sur un même
                               trade). `min="0"` sur les champs de prix,
                               `max` (aujourd'hui) sur la date d'entrée.
                               R:R fictif "1:1" sur stop=entrée bloqué en
                               amont (alerte, saisie refusée) plutôt
                               qu'enregistré.
    ForumSection.tsx                filtre "Mes Sujets" compare désormais
                               `authorEmail` (stable) en priorité, repli
                               sur `authorName` pour les sujets créés avant
                               l'ajout du champ.
    MindsetJournalModal.tsx          clé `localStorage` namespacée par
                               compte côté élève (`storageKey` prop, email)
                               — avant : un historique de check-in
                               émotionnel partagé entre deux élèves sur un
                               poste partagé.
    Sidebar.tsx                      "Signaux & Analyses" retiré
                               entièrement (`ALL_TABS`,
                               `SIDEBAR_TOGGLEABLE_KEYS`, `SIDEBAR_ITEM_TABS`,
                               `formationItems`).
    StaffAccountsModal.tsx           bouton de suppression d'un coach
                               n'apparaît plus que si le VIEWER courant est
                               lui-même le fondateur (`isCurrentUserOwner`,
                               dérivé de la liste des comptes) — cohérent
                               avec `requireOwner` désormais posé côté
                               serveur sur `DELETE /staff/:id`.
    CoachSignals.tsx                 SUPPRIMÉ (module "Signaux & Analyses"
                               retiré entièrement sur demande explicite).
    SecurityLogModal.tsx             inchangé fonctionnellement cette
                               période (déjà complet : 4 cartes de stats
                               24h, filtres, tableau, pagination) — c'est LE
                               "module sécurité" déjà en place, accessible
                               via Badges & Profil → Journal de sécurité →
                               Consulter, réservé à `isOwner`.
```

### Le modèle d'authentification à deux mondes

`isAdmin` côté staff est fiable — `buildStaffProfile()`
(server/routes.ts) force `isAdmin: true` dans la réponse `/api/state`
pour toute session staff, **et désormais aussi à l'écriture** (`PUT
/profile` force `true` sans jamais le redériver d'une valeur en base
potentiellement périmée — voir §7 pour le bug historique que ça
corrige). `PUT /api/profile` reste 403 pour tout compte élève — c'est
pourquoi le plan de trading (`TradingPlanData`) reste en localStorage.

Le système de gestion d'accès élève **ne contourne pas** cette règle :
toutes les routes qui modifient un compte élève sont des routes **staff**,
protégées par `requireStaffKind`. Seule la consommation finale du jeton de
reset est publique, et elle ne touche que `student_accounts`/
`student_password_reset_tokens` — jamais le profil staff partagé.

**Nouveauté cette période** : une route élève peut désormais modifier SON
PROPRE bureau personnel sans passer par le staff — `PUT
/auth/profile/avatar` (photo de profil). C'est le SEUL champ qu'un élève
peut modifier lui-même sur son "profil" ; le reste (nom, niveau, bio…)
reste géré exclusivement par le coach sur la fiche `EnrolledStudent`. Voir
§5/§6 pour le détail complet de ce mécanisme.

**Distinction staff : `isAdmin` vs `isOwner`.** Tout compte staff a
`isAdmin: true` (mêmes droits métier). Seul le compte fondateur a
`isOwner: true` — jusqu'ici réservé au réglage des modules visibles
(sidebar) et à la lecture du journal de sécurité. **Depuis cette période**,
`requireOwner` protège aussi `DELETE /staff/:id` (suppression d'un
compte coach) — décision produit explicite de l'utilisateur suite à un
audit de sécurité, qui casse volontairement le principe "mêmes droits pour
tous" sur ce point précis (voir §7/§8).

### Schéma SQLite (19 tables)

`badges`, `coach_messages`, `enrolled_students`, `forum_replies`,
`forum_topics`, `login_lockouts`, `meta`, `modules`, `notifications`,
`quiz_results`, `security_events`, `sessions`, `staff_accounts`,
`student_accounts`, `student_password_reset_tokens`, `student_sessions`,
`trades`, `trading_accounts`, `users`. **`coach_signals` a été supprimée**
cette période (module retiré, table confirmée vide avant suppression,
migration idempotente `DROP TABLE IF EXISTS`).

---

## 4. Le module Calculateurs (référence design "MacroPulse")

Inchangé depuis plusieurs périodes — voir le détail complet dans
l'historique git de ce document (`git log -p -- HANDOFF.md`) si besoin.
Résumé : 3 panneaux (Taille de position & risque, Risque/Rendement,
Profit/Perte) dans `PositionCalculatorModal.tsx`, ouvert via "Calculer
Lot" dans le Journal, reproduisant fidèlement une maquette externe
"MacroPulse" partagée par l'utilisateur.

---

## 5. Fonctionnalités terminées cette période (chronologique, 7 commits)

*(Depuis le dernier HANDOFF documenté, commit `cdd72e9`. Pour l'historique
antérieur : voir `git log`.)*

1. **Migration du statut élève** (`311b8ee`) — les fiches créées avant le
   remplacement complet de `StudentStatusTag` (commit `cdd72e9`, période
   précédente) portaient encore l'ancien statut ("En Évaluation FTMO", etc.),
   invisible dans le nouveau système (badge sans style). Migration serveur
   idempotente (`migrateStudentStatusTags`, `server/db.ts`) : les deux
   valeurs à correspondance directe sont renommées, les deux sans
   équivalent ("Besoin Coaching", "Alerte Tilt") sont **retirées** plutôt
   que forcées vers une valeur arbitraire — décision explicite de
   l'utilisateur. `statusTag` devient optionnel dans le type, avec un
   filet de sécurité d'affichage permanent (`getStatusTagStyle`/Label`)
   pour toute valeur future non reconnue.

2. **Suivi d'évolution par sessions de coaching** (`ba3ae34`) — nouveau
   graphique (Discipline/Performance/Exécution du plan/Global,
   `StudentEvolutionChart.tsx`, isolé pour le lazy-loading `recharts`) et
   notes de session détaillées en accordéon (texte libre + 4 notes sur 10,
   `StudentEvolutionSection.tsx`), intégrés en édition ET en lecture seule
   de la fiche élève. Note globale calculée automatiquement — **formule
   déduite d'une capture de référence, jamais confirmée explicitement par
   l'utilisateur, voir §0**. La lecture seule de la fiche élève affiche
   désormais aussi Diagnostic initial, Erreurs récurrentes et un résumé de
   l'accès élève — jusqu'ici visibles uniquement en édition.

3. **Correctif Vue Complète** (`ea0743e`) — la "Vue Complète" d'un élève
   (`AdminStudentView.tsx`) affichait des modules que le fondateur avait
   pourtant masqués dans sa propre sidebar : la route serveur
   (`GET /admin/students/:id/view`) renvoyait le profil élève BRUT
   (`getProfile`) au lieu de le fusionner avec le réglage de visibilité
   (`buildStudentProfile`, déjà utilisée pour la vraie session élève).
   Corrigé en déplaçant `buildStudentProfile` vers
   `server/auth/studentCredentials.ts` comme source unique, réutilisée par
   les deux routes.

4. **Photo de profil élève, audit complet (29 bugs), retrait de "Signaux
   & Analyses"** (`b49c90c`, le plus gros commit de cette période) :
   - **Photo de profil personnalisée pour les élèves** — nouvelle route
     `PUT /auth/profile/avatar`, stockée dans le bureau personnel de
     l'élève, prioritaire sur celle fixée par le coach une fois présente.
     Seule la photo est éditable côté élève (`UserProfileModal`, prop
     `avatarOnly`) ; le reste de la fiche reste géré par le coach.
   - **Audit exhaustif de l'écosystème** (client + serveur), mené via 6
     agents parallèles par zone, 29 bugs trouvés et corrigés par sévérité
     — voir §7 pour le détail de ce qui a changé de comportement.
   - **Retrait total du module "Signaux & Analyses"** (composant, routes
     de rendu, types, sidebar, cache local, ET la table SQL `coach_signals`,
     confirmée vide) sur demande explicite de l'utilisateur.

5. **Audit de sécurité complet** (`294fcdf`) — 5 agents parallèles par
   angle OWASP (auth/sessions, autorisation/IDOR, injection/validation,
   exposition de données, client/stockage). Toutes les failles trouvées
   corrigées — voir §7 pour le détail. Le plus sérieux : la combinaison
   d'un cache `localStorage` élève non vidé à l'expiration NATURELLE d'une
   session (pas seulement au clic sur "Déconnexion") et d'un rejeu
   automatique des modifications en attente pouvait faire écraser les
   données d'un élève par celles d'un précédent utilisateur sur un même
   poste partagé.

6. **Statut "Compte DÉMO" + changement de mot de passe volontaire**
   (`dfe149c`) :
   - Nouveau statut élève "Compte DÉMO", disponible à la création et à
     l'édition (avant "Évaluation Étape 1" dans la liste).
   - Nouvelle modale "Mon mot de passe" (`ChangeOwnPasswordModal.tsx`,
     ouverte depuis Badges & Profil), pour tout compte staff — jusqu'ici
     le changement de mot de passe n'existait qu'en version FORCÉE après
     invitation (`ChangePasswordScreen.tsx`). Bug corrigé au passage, dans
     les deux mondes (staff et élève) : la route de changement de mot de
     passe détruisait TOUTES les sessions, y compris celle de l'auteur du
     changement — invisible dans le flux forcé, mais cassant pour un
     changement volontaire depuis une session active.

---

## 6. Flux détaillés

### 6.1 Réinitialisation de mot de passe élève (par lien, sans email)

Inchangé cette période. Résumé (détail complet dans l'historique git de
ce document si besoin) : le staff génère un lien à jeton depuis la fiche
élève (`StudentTracking.tsx`, section "Accès & connexion") ; le jeton
(256 bits, haché en base, TTL 1h, usage unique garanti par transaction
atomique) est affiché une seule fois, à transmettre à la main (aucun
envoi d'email) ; l'élève choisit son nouveau mot de passe via
`/reset-password?token=…` (`ResetPasswordScreen.tsx`, seul point d'entrée
public de l'app en dehors de la connexion — routing par test manuel sur
`window.location.pathname` dans `App()`, pas de routeur dans ce projet).
**Depuis cette période** : le jeton est retiré de l'URL/historique du
navigateur dès sa lecture (`history.replaceState`).

### 6.2 Photo de profil personnalisée élève (nouveau cette période)

1. **Élève ouvre Badges & Profil** → modale `UserProfileModal` avec
   `avatarOnly` (seule la photo est éditable, le reste grisé).
2. **Élève choisit/importe une photo** → `api.updateStudentAvatar(avatar)`.
3. **Serveur** : `PUT /auth/profile/avatar` (`studentProtectedRouter`,
   `server/auth/studentRoutes.ts`) valide via `updateAvatarSchema`
   (`server/schemas.ts` — même garde `isSafeMediaUrl` que `chartUrl`/
   `avatar` ailleurs), écrit dans le bureau personnel de l'élève
   (`getProfile`/`saveProfile` sur `student.userId`, JAMAIS sur la fiche
   `enrolledStudents` du coach).
4. **Lecture** : `buildStudentProfile()` (`server/auth/studentCredentials.ts`)
   relit ce bureau personnel et fait primer `ownProfile.avatar` sur
   `enrolled.avatar` (la fiche du coach) s'il est présent — utilisée à la
   fois pour la vraie session élève ET pour la "Vue Complète" côté staff,
   qui reflète donc la vraie photo choisie par l'élève.
5. **La fiche côté coach** (roster `StudentTracking.tsx`, liste/édition)
   continue d'afficher `enrolled.avatar` (non touché) — divergence
   assumée : la fiche du coach reste "ce que le coach a fixé comme photo
   de rattachement", la session réelle de l'élève et la Vue Complète
   montrent "ce que l'élève a réellement choisi".

### 6.3 Changement de mot de passe volontaire (nouveau cette période)

1. **Compte staff (n'importe lequel) ouvre Badges & Profil** → bloc "Mon
   mot de passe" → "Modifier" → `ChangeOwnPasswordModal`.
2. **Saisit mot de passe actuel + nouveau (10 caractères min.) + confirmation**
   → `api.changePassword(currentPassword, newPassword)`.
3. **Serveur** : `POST /auth/change-password` (`staffRouter`) vérifie le
   mot de passe actuel, hache le nouveau (`setPassword`), puis
   **`destroyOtherSessions(staff.id, currentToken)`** — exclut
   explicitement la session qui vient de faire la requête, contrairement
   à l'ancien `destroyAllSessions` (renommé/retiré, un seul appelant).
4. **Résultat** : l'auteur du changement reste connecté sur l'appareil
   utilisé ; toute AUTRE session ouverte de ce compte est fermée.
   Même mécanique côté élève (`destroyOtherStudentSessions`,
   `/auth/student-change-password`, déjà existante mais avait le même bug
   avant ce correctif).

**Distinct** du changement FORCÉ (`ChangePasswordScreen.tsx`, plein écran,
déclenché par `mustChangePassword` après une invitation) : celui-ci reste
sur `destroyAllSessions`/`destroyAllStudentSessions` (tout détruire, y
compris courante) — sans conséquence dans ce flux précis puisque l'écran
suivant est de toute façon un tableau de bord fraîchement chargé après
réauthentification implicite... en réalité **ce point n'a pas été
re-vérifié en détail cette période** : le flux forcé continue d'utiliser
les fonctions "tout détruire" d'origine, jamais remplacées, uniquement
parce qu'aucun bug utilisateur n'a été signalé dessus. Si un comportement
étrange apparaît après un changement de mot de passe forcé (déconnexion
inattendue), c'est le premier endroit à vérifier.

---

## 7. Bugs connus / limitations

### ✅ Résolus cette période (retirés de la liste précédente)

Ancien statut élève non migré ; Vue Complète ignorant les modules
masqués ; module "Signaux & Analyses" avec noms fictifs (retiré
entièrement) ; cache élève non vidé à l'expiration naturelle de session
(faille de sécurité) ; coût scrypt sous recommandation OWASP ; suppression
de compte coach non réservée au fondateur ; `NODE_ENV` non vérifié au
démarrage ; absence de rate limit sur les endpoints publics météo/marché ;
jeton de reset visible dans l'historique navigateur ; validations Zod
contournables par confusion de type ; forgerie de message coach par
collision d'ID ; `isAdmin` réécrit à `false` sur une base ancienne ; taux
US 10 ans faux d'un facteur 10 ; profil jamais resynchronisé à la
réouverture de la modale ; date de courbe d'équité codée en dur ; Win
Rate/PnL contradictoires (seuil mort ±50$) ; courbe du dashboard ignorant
les trades en % ; aucune validation de date future/valeurs négatives dans
le Journal ; taille de lot bloquée à 1 ; formulaire du Journal jamais
réinitialisé après une ébauche du calculateur ; perte quotidienne
calculée en UTC ; aucun rattrapage de sauvegarde élève échouée ; réponse
de coach marquant à tort un sujet "Résolu" ; email de connexion élève
désynchronisé de la fiche (aux deux endroits : préchargement du champ ET
divergence d'écriture) ; téléphone invisible en lecture seule ; formatage
devise incohérent ; ratio R:R fictif sur stop=entrée ; bouton Setup
Analyzer silencieux côté élève ; mot de passe imposé par le staff sans
forcer son remplacement ; changement de mot de passe volontaire
déconnectant l'auteur lui-même ; double invitation concurrente en erreur
500 au lieu de 409 ; forum "Mes Sujets" cassé par homonyme/renommage ;
données émotionnelles (Mindset) partagées entre comptes sur poste
partagé ; `authorAvatar` du forum échappant à la validation d'URL.

*(Détail complet de chaque correctif dans l'historique git —
`git log --oneline cdd72e9..HEAD` puis `git show <hash>` — ou dans la
conversation qui a produit cette version du document si elle est encore
accessible.)*

### 🟡 Connus, non corrigés (décisions produit ou priorité basse)

1. **Forum inaccessible depuis l'UI** (`ForumSection.tsx`, monté dans
   `AcademyApp` mais sans entrée sidebar dans `ALL_TABS`/`Sidebar.tsx`).
   Décision produit inchangée, reconfirmé cette période.
2. **Rate limiter en mémoire, par processus.** Compromis accepté —
   documenté explicitement dans `rateLimit.ts`.
3. **Absence de flux de récupération de mot de passe STAFF en cas
   d'OUBLI** (distinct du changement volontaire ajouté cette période, qui
   suppose de connaître son mot de passe actuel). Un coach qui a
   complètement perdu son mot de passe n'a toujours aucun mécanisme
   self-service — seule la procédure de secours décrite dans le README
   (accès direct à la base) existe.
4. **Six `window.confirm()`/`prompt()` natifs restants** dans le projet,
   non fiables en prévisualisation et sur iOS en mode application — voir
   §0 point 1 pour la liste exacte des fichiers.
5. **`NotificationModal.tsx` : statut "Push Server Live" factice.**
6. **`TradingPlanEditorModal.tsx` : persistance `localStorage`
   uniquement**, pas de synchronisation multi-appareils. Compromis
   assumé.
7. **`MacroDashboard.tsx` : fil d'actualités statique.**
8. **`UserProfileModal.tsx` : "NIVEAU 4" statique** (badge de rang, ligne
   ~731).
9. **`package.json.name` reste `"react-example"`.**
10. **`.gitignore` : règle `data/` matche aussi `src/data/`** — voir §2.
11. **`syncAccountsWithTrades` écrase tout ajustement manuel de solde dès
    qu'au moins un trade est rattaché au compte.** Compromis assumé.
12. **Le badge de rating des coachs (`Coach.rating`) est optionnel et
    absent pour tout coach dérivé d'un vrai profil** — voulu, pas de note
    fictive.
13. **Durée de vie de session sans plafond absolu, pas de révocation par
    appareil précis** (seul un changement de mot de passe révoque tout,
    version "tout ou rien"). Relevé en audit de sécurité, sévérité basse,
    documenté comme choix produit assumé ("outil personnel d'usage
    quotidien") — laissé tel quel sur confirmation implicite de
    l'utilisateur (pas de demande de correction).
14. **Fragilité théorique de validation** : `collectionItem` (schémas Zod
    des collections) est en `.passthrough()` — un élève peut inclure
    n'importe quel champ supplémentaire sur ses propres lignes. Sans
    danger aujourd'hui (aucun champ de collection n'est relu avec un
    privilège supérieur côté serveur), documenté en commentaire dans
    `server/schemas.ts` pour toute future fonctionnalité qui y accorderait
    une confiance implicite.
15. **Points ouverts non confirmés** — voir §0 (formule de note globale
    de coaching non confirmée, `authorRole` forum codé en dur à vérifier).

### Piège opérationnel : `AdminStudentView.tsx` est un overlay

Scoper toute recherche DOM à
`document.querySelector('.fixed.inset-0.z-50...')`.

### Piège confirmé : backtick littéral dans un commentaire SQL de `server/db.ts`

Voir §3 — casse la compilation TypeScript avec une erreur peu claire.

---

## 8. Décisions techniques importantes

### Anciennes décisions (toujours valides)

Voir l'historique git de ce document pour le détail complet : plan de
trading en localStorage, calculateur simplifié plutôt qu'enrichi,
`window.confirm()`/`prompt()` à remplacer par des modales maison (défaut
de plateforme confirmé, pas un cas isolé — la liste s'est même allongée
cette période, voir §0/§7), deux shells applicatifs avec état de modale
dupliqué par design, `SectionHeader` dupliqué à dessein dans chaque
fichier, lien de reset "complet" à jeton plutôt qu'un mot de passe
temporaire simplifié (choix explicite de l'utilisateur), Coach Attribué
reconstruit depuis les vrais comptes staff jamais des noms inventés.

### Nouvelles décisions cette période

**Suppression de compte coach réservée au fondateur** — casse
volontairement le principe "mêmes droits pour tous les coachs" établi
ailleurs (`credentials.ts`, `StaffAccountsModal.tsx`). Décision explicite
de l'utilisateur en réponse à une question de clarification pendant
l'audit de sécurité (l'IA avait initialement noté ce point comme "à
confirmer", pas comme un bug pur). Si un futur chantier touche aux
permissions staff, vérifier d'abord si le principe "tous égaux" s'applique
toujours ou si d'autres exceptions ont été ajoutées depuis.

**Avatar élève dans le bureau personnel, pas dans la fiche du coach** —
face à deux options (écrire directement `enrolledStudents.avatar` depuis
une route élève, en franchissant la frontière staff/élève ; ou stocker
dans le bureau personnel de l'élève et fusionner à la lecture), la
seconde a été retenue : elle respecte la séparation stricte des deux
mondes déjà établie partout ailleurs dans le code (un élève n'écrit
JAMAIS dans une collection du bureau staff), au prix d'une divergence
assumée entre "photo sur la fiche du coach" et "photo réelle vue par
l'élève et en Vue Complète" — voir §6.2. Si une demande future veut
unifier les deux, le patron à suivre pour la synchro serait le même que
`buildStudentProfile`, pas une écriture directe.

**`destroyOtherSessions`/`destroyOtherStudentSessions` plutôt que
modifier `destroyAllSessions` sur place** — `destroyAllSessions` (staff)
n'avait qu'un seul appelant, donc remplacée entièrement plutôt que
dupliquée. `destroyAllStudentSessions` (élève) avait PLUSIEURS appelants
dont certains où "tout détruire y compris courante" reste correct (staff
qui fixe un mot de passe élève, reset par lien — aucune session élève
active à ce moment) : gardée telle quelle, une nouvelle fonction ajoutée
à côté pour le seul cas qui en avait besoin (changement volontaire par
l'élève lui-même). Réflexe à reproduire : avant de "corriger" une fonction
partagée, lister TOUS ses appelants et vérifier qu'ils ont bien le même
besoin.

**Audits (bugs et sécurité) menés par agents parallèles, une zone/un angle
par agent** — méthode qui a fait ses preuves deux fois cette période
(audit général par dossier, audit de sécurité par angle OWASP). Chaque
agent audite en lecture seule et rapporte avec sévérité + scénario
concret, sans corriger ; l'IA compile, priorise, ne pose une question de
clarification QUE pour les vraies décisions produit/permission (jamais
pour une correction technique pure), corrige tout le reste directement,
vérifie (lint/build/navigateur), et ne committe/pousse que sur demande
explicite. Voir §10 pour le contexte complet de collaboration.

---

## 9. Historique de nommage (résolu, contexte seulement)

`src/components/TradingPlanModal.tsx` (nom trompeur, en réalité la
checklist "Exercice du jour") a été supprimé il y a plusieurs périodes.
`src/components/TradingPlanEditorModal.tsx` existe toujours — c'est le
vrai plan de trading (module Pratique, sidebar), persistance localStorage,
inchangé cette période. Si une référence à "TradingPlanModal" ressurgit
dans un contexte ancien, elle décrit un fichier qui n'existe plus.

**Nouveau point de vigilance nominale, cette période** : `CoachSignals.tsx`
a également été supprimé (module "Signaux & Analyses" retiré). Toute
référence à ce fichier ou à `CoachSignal` (le type) dans un contexte
antérieur au commit `b49c90c` décrit également quelque chose qui n'existe
plus.

---

## 10. Contexte de travail avec l'utilisateur

- Il **communique en français**, ton direct, tutoiement, souvent par
  phrases courtes sans ponctuation soignée — lire l'intention plutôt que
  la forme.
- Il travaille par **demandes courtes et itératives**, souvent en
  signalant un problème constaté en usage réel plutôt qu'en décrivant une
  solution technique.
- **Il partage souvent une référence visuelle externe** (capture d'écran
  d'une autre application) en demandant une reproduction fidèle du
  **style et du comportement**. Attention : parfois la référence montre en
  réalité une fonctionnalité qui **existe déjà** dans PropDesk sous une
  autre forme (ex. le "Journal de sécurité" déjà en place, confondu un
  temps avec une demande de nouveau module) — vérifier l'existant avant
  de se lancer dans une reconstruction. Une fois, il s'est lui-même rendu
  compte qu'il cherchait une fonctionnalité déjà présente ailleurs dans
  l'UI et a annulé sa demande en cours de route — accepter ce genre
  d'interruption sans discuter.
- **Il sélectionne parfois des éléments UI directement dans le
  navigateur** (capture d'écran + inspecteur d'élément) pour désigner
  précisément ce qu'il veut modifier/retirer.
- **Il change parfois d'avis en cours de route, très vite**, et peut
  demander de retirer intégralement une fonctionnalité qu'il avait
  demandée dans une session antérieure (le module "Signaux & Analyses",
  demandé puis rendu accessible dans une session, entièrement supprimé
  dans la suivante). Ne pas s'accrocher à un choix antérieur.
- **Sur un chantier touchant la sécurité/l'authentification/les
  permissions**, il a systématiquement choisi l'option la plus
  complète/robuste quand on lui a posé la question (lien de reset à
  jeton plutôt que mot de passe temporaire ; suppression de compte coach
  réservée au fondateur plutôt que laissée ouverte à tous). Pour un futur
  chantier de cette nature, poser la question plutôt que deviner reste le
  bon réflexe — il y répond vite et précisément.
- **Il demande parfois des audits complets de l'écosystème** ("vérifie
  toute la sécurité", "trouve tous les bugs") avec l'attente explicite
  qu'ils soient MENÉS JUSQU'AU BOUT (trouvés, priorisés, ET corrigés) dans
  la même session, sans qu'il ait à repasser derrière pour valider chaque
  correctif un par un. Voir §8 pour la méthode qui a fonctionné (agents
  parallèles par zone/angle).
- **Il ne donne jamais ses mots de passe pour que tu les utilises** —
  règle absolue, y compris pour vérifier une fonctionnalité qu'il vient
  de demander (photo de profil élève, changement de mot de passe). Voir
  §2 pour la méthode de vérification alternative qui fonctionne dans ce
  cas (appels API directs, comptes de test existants, scripts jetables
  pour la logique serveur pure).
- **Il refuse parfois une demande de permission élargie** (accès SSH à la
  base Railway) sans que ça bloque le reste du travail — respecter le
  refus, ne pas insister.
- **Toujours vérifier en conditions réelles.** Chaque correctif doit être
  vérifié visuellement dans le Browser pane avant d'être annoncé terminé
  — et pour les flux serveur, vérifier aussi côté API/base de données
  directement, pas seulement l'écran.
- **Il pousse toujours après confirmation explicite**, jamais
  automatiquement — même après un chantier annoncé "terminé", attendre le
  "commite et pousse" avant d'agir. Ce pattern n'a jamais varié sur
  l'ensemble de la période couverte par ce document.
- Quand il demande une mise à jour du HANDOFF « suffisamment détaillée »,
  il attend fidélité complète à ce qui a changé, y compris les points
  encore ouverts/non confirmés — pas seulement un résumé du fini.

### Méthode de vérification qui a fait ses preuves

1. `npm run lint` après chaque changement de code, même en cours de
   chantier multi-fichiers.
2. Redémarrer le serveur de dev après tout changement **serveur**.
3. Vérification visuelle dans le Browser pane avant d'annoncer un
   correctif terminé — `navigate()` plutôt qu'un raccourci clavier
   simulé. Si des erreurs console semblent incohérentes avec le code
   actuel, ouvrir un **onglet neuf** avant de conclure à un vrai bug (voir
   §2, piège HMR confirmé plusieurs fois cette période).
4. Pour un flux serveur avec effets de bord (mot de passe, jeton, email,
   session) : vérifier directement via `javascript_tool` + `fetch()` sur
   l'API, via `sqlite3` sur la base, et — nouveau cette période — via un
   **script `tsx` jetable à la racine du projet** (supprimé après usage)
   pour tester une fonction serveur pure sans passer par une vraie requête
   HTTP ni une vraie session.
5. Pour un déploiement Railway : `railway deployment list --service
   propdesk --json` d'abord, `railway logs --service propdesk` en
   complément pour vérifier l'absence d'avertissement au démarrage, UN
   SEUL `curl` espacé en dernier recours.
6. Pour une fonctionnalité ambiguë ou un chantier de grande ampleur :
   poser une question de clarification courte (`AskUserQuestion`) — mais
   UNIQUEMENT pour les vraies décisions produit/permission, jamais pour
   une correction technique pure qui doit être faite directement (leçon
   tirée de l'audit de sécurité : ne pas sur-solliciter l'utilisateur).
7. Avant de pousser un chantier de grande ampleur, demander confirmation
   explicite même si l'utilisateur a déjà autorisé des push plus petits
   dans la même session.
8. Nettoyage systématique des scripts ponctuels après usage — jamais
   laissés dans le dépôt.
9. Pour tester une fonctionnalité élève sans disposer du mot de passe de
   l'utilisateur : appels API directs avec un compte élève de TEST
   existant en base, jamais le vrai compte de l'utilisateur, et être
   transparent sur ce qui a été vérifié par ce biais vs par un vrai clic
   UI.

---

## 11. Prochaines tâches, dans l'ordre

**Aucune tâche explicite en attente** — redemander directement à
l'utilisateur.

### Points ouverts à garder en tête (pas des tâches, des choses à vérifier SI l'occasion se présente)

- Voir §0 pour les trois points non bloquants (window.confirm() élargis,
  formule de note globale non confirmée, `authorRole` forum à vérifier).
- Un flux de réinitialisation de mot de passe STAFF pour le cas de l'OUBLI
  complet (pas juste le changement volontaire, déjà fait) — le code de
  `createPasswordResetToken`/`consumePasswordResetToken`
  (`studentCredentials.ts`) est le patron à dupliquer/adapter si demandé.
- Un envoi d'e-mail automatique pour le lien de réinitialisation élève, si
  le staff trouve la transmission manuelle trop lourde à l'usage.

### Ce qui n'est PAS une tâche

- **Réintroduire de l'IA sous quelque forme que ce soit.**
- **Deviner et appliquer soi-même un mapping/une décision produit
  ambiguë** sans validation de l'utilisateur.
- **Ajouter un envoi d'e-mail automatique** au flux de reset sans demande
  explicite.
- **"Réparer" les limitations connues listées en §7** sans demande
  explicite — en particulier ne pas remplacer les `window.confirm()`
  restants ou toucher au principe "tous égaux" des comptes staff sans
  qu'on te le demande, malgré leur mention répétée dans ce document.
- **Vérifier le déploiement Railway par des `curl` répétés.**
- **Taper le mot de passe de l'utilisateur**, sous quelque prétexte que
  ce soit, y compris pour "juste vérifier" une fonctionnalité qu'il a
  demandée lui-même.

---

## 12. État à la reprise

- Branche `main`, dernier commit **poussé et déployé** `dfe149c`.
  Répertoire de travail **propre**.
- `npm run lint` et `npm run build` passent sans erreur.
- Application déployée et fonctionnelle sur Railway
  (`propdesk-academie.up.railway.app`), déploiement automatique
  opérationnel, dernier déploiement confirmé `SUCCESS`, config
  `NODE_ENV`/`DATA_DIR` vérifiée saine (aucun avertissement dans les logs).
- **Aucun point bloquant.** Trois points ouverts non bloquants documentés
  en §0. Tout le reste est terminé et vérifié.

### Par où commencer

1. Lire §0 en entier (les trois points ouverts).
2. `git status --short` et `git log --oneline -10` pour confirmer que
   l'état correspond toujours à ce document (peut avoir légèrement évolué
   si l'utilisateur a travaillé entre-temps sans mettre à jour ce
   fichier).
3. Attendre la prochaine demande de l'utilisateur — rien n'est en attente
   de sa part à la date de rédaction.

> Ce document est la **seule** source de reprise fiable. S'il existe un
> écart entre ce document et le code, **fais confiance au code** —
> vérifie par la lecture directe des fichiers sources et par
> `git status`/`git diff`/`sqlite3`, et corrige ce document en
> conséquence.
