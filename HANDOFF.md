# HANDOFF — Académie de Trading Horizon / PropDesk

Document de reprise. Il suppose que tu n'as accès ni à la conversation
précédente, ni à autre chose que ce dépôt. Dernier commit couvert : `5a5c54d`.

> **À lire en premier :** le §6.1 décrit un bug qui rend **1 270 lignes
> d'interface déjà écrites** inatteignables. C'est le point le plus rentable du
> projet : la réparation est décrite en §7, tâche 2.

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
- un **espace admin** de suivi des élèves.

L'interface est **entièrement en français**. Le ton des libellés est direct et
tutoie l'utilisateur. Conserve cette langue et ce registre.

Le projet vient de **Google AI Studio** : c'est important, plusieurs choix
initiaux en découlent (voir §8).

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
| `npm start` | sert le build de production |
| `npm run clean` | supprime `dist/` |

Il n'y a **qu'un seul port**. Pas de proxy à configurer.

Inspecter la base :

```bash
sqlite3 data/horizon.db "select id, pair, pnl from trades order by rowid desc limit 5"
```

---

## 3. Architecture

### Vue d'ensemble

Un serveur **Express unique** sert l'API **et** l'application. En
développement il monte Vite en middleware ; en production il sert `dist/`.

```
server.ts              point d'entrée : Express + Vite/statique
server/
  db.ts                connexion SQLite (better-sqlite3, WAL) et schéma
  repositories.ts      accès aux données — SEUL module qui parle à SQLite
  routes.ts            routes /api/*
  schemas.ts           validation zod des entrées
  seed.ts              amorçage et import d'un état complet
src/
  App.tsx              état applicatif et câblage de toutes les vues (890 l.)
  types.ts             source de vérité des formes de données
  data/mockData.ts     jeu de données d'amorçage (1455 l.)
  hooks/
    usePersistentState.ts   état miroité dans localStorage
    useServerSync.ts        bootstrap serveur + synchronisation optimiste
  lib/api.ts           client HTTP typé
  components/          10 vues d'onglet + 10 modales + Sidebar et TopHeader
public/
  icon.png             icône 512x512 — sidebar et favicon
  logo.png             logo complet 1536x1024 — réservé à l'écran de connexion (§6 bis)
  Fonctionnalites_Horizon_SMC.pdf
scripts/generate_pdf.js  génération hors ligne du PDF
```

### Navigation

**Pas de routeur.** `App.tsx` tient un `activeTab` et rend la vue
correspondante. L'union `TabType` est définie dans
[`src/components/Sidebar.tsx`](src/components/Sidebar.tsx) :

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

### Persistance

Le **serveur est la source de vérité**. Au démarrage, le client appelle
`GET /api/state` et reçoit toutes les collections en un aller-retour.

Chaque modification suit ce chemin :

1. l'interface se met à jour **immédiatement** (optimiste) ;
2. la valeur est recopiée dans `localStorage` ;
3. après **400 ms de regroupement**, elle part vers le serveur.

Si le serveur est injoignable, l'application démarre sur le cache local et
reste utilisable — voir la limite en §6.2.

Au tout premier lancement sur une base vide, les données présentes dans
`localStorage` (version antérieure sans serveur) sont importées
automatiquement. À défaut, la base est amorcée depuis `mockData.ts`.

La base vit dans `DATA_DIR` (`./data` par défaut), **hors du dépôt**
(`.gitignore`).

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
limitée à **10 appels par minute et par IP** : c'est la seule route facturée à
l'appel (Gemini, modèle `gemini-3.6-flash`).

Codes de retour à connaître : `400` entrée invalide, `404` collection inconnue,
`409` base déjà amorcée (import ou seed refusé), `429` quota IA dépassé.

### Schéma SQLite

13 tables : `meta`, `users`, `trades`, `trading_accounts`, `coach_signals`,
`coach_messages`, `forum_topics`, `forum_replies`, `notifications`,
`enrolled_students`, `badges`, `modules`, `quiz_results`.

Chaque ligne porte un `user_id`, **même sans authentification** : cela évite
une migration douloureuse le jour où elle arrivera. Les objets sont stockés en
**colonne JSON** (`payload`), ce qui rend le schéma tolérant à l'ajout de
champs — voir §8.

Les réponses du forum sont stockées séparément (`forum_replies`) mais
recomposées dans les sujets à la lecture.

---

## 4. Fonctionnalités terminées

### Socle technique

- `@types/react` installé et **`strict` activé** dans `tsconfig.json`.
- `npm run lint` et `npm run build` passent sans erreur ni avertissement.
- Dépôt git initialisé, 21 commits, historique propre.
- `README.md` réécrit (documentation utilisateur ; ce HANDOFF est la
  documentation de reprise).

### Persistance serveur

SQLite complet, validation zod, limitation de débit sur la route IA, repli
hors ligne, migration automatique depuis `localStorage`.

**Vérifié** : mutation dans l'UI → présente en base ; serveur redémarré et
`localStorage` entièrement vidé → données toujours là.

### Navigation et sidebar

- **Masquage de modules par l'admin.** Un engrenage apparaît à droite des
  titres de section (SUIVI, PRATIQUE, FORMATION) pour l'administrateur seul. Il
  bascule la section en mode réglage : chaque entrée se masque ou se réaffiche
  d'un clic. Hors de ce mode, une entrée masquée disparaît pour tout le monde.
  **10 entrées masquables** ; « Tableau de bord » ne l'est pas, c'est la
  destination de repli.
- **Repli automatique** : masquer le dernier accès à l'onglet courant renvoie
  au tableau de bord. « Replay » et « Sim propfirm » menant au même onglet, la
  bascule n'a lieu que si plus aucune entrée visible n'y conduit.
- La configuration vit dans `StudentProfile.hiddenSidebarItems` et transite par
  `/api/profile` — **aucune migration de base**.

### Journal de trading

- Quatre horodatages : **date et heure d'entrée, date et heure de sortie**.
  Les champs de sortie sont facultatifs (position ouverte).
- La colonne « Entrée / Sortie » distingue trois états : sortie renseignée,
  *position ouverte* (pas de prix de sortie), *sortie non renseignée* (trade
  clôturé saisi avant l'existence du champ).
- Export CSV à 20 colonnes, en-têtes et champs alignés.

### Suivi des élèves

- **Style de trading** par élève : `Scalping`, `Intraday`, `Swing Trading`.
  Réglé dans « Éditer Fiche », affiché en pastille près du nom sur la carte et
  dans la fiche détaillée.
- 4 statuts élève, chacun d'une couleur distincte : En Évaluation FTMO
  (violet), Prop Firm Financé (vert), Besoin Coaching (bleu), Alerte Tilt
  (rose).

### Identité visuelle

- Logo PropDesk intégré : `public/icon.png` (recadrage 512×512 de l'icône) dans
  la sidebar, en favicon et en icône iOS.
- **Palette unifiée** sur les 10 vues et le centre d'alertes (jetons en §8).
  Les 9 autres modales ne sont pas encore migrées — voir §6.4.

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
| `src/hooks/usePersistentState.ts` | état miroité dans localStorage |
| `src/hooks/useServerSync.ts` | bootstrap + synchronisation optimiste |
| `public/icon.png` | icône 512×512 |
| `public/logo.png` | logo complet (fourni par l'utilisateur) |
| `README.md` | réécrit intégralement |
| `HANDOFF.md` | ce document |

### Modifiés en profondeur

| Fichier | Nature des changements |
|---|---|
| `src/App.tsx` | bootstrap serveur, 12 `useSyncedState`, câblage des modales |
| `src/components/Sidebar.tsx` | masquage admin, `TabType`, logo, clés stables |
| `src/components/TradingJournal.tsx` | horodatages de sortie, CSV, palette |
| `src/components/StudentTracking.tsx` | style de trading, palette, statuts |
| `src/components/TopHeader.tsx` | 5 boutons retirés, fil d'ariane |
| `src/types.ts` | `exitDate`, `exitTime`, `TradingStyle`, `hiddenSidebarItems` |
| `src/data/mockData.ts` | horodatages de sortie, styles de trading |
| `server.ts` | simplifié, chemins via `process.cwd()` |
| `index.html` | favicon et icône iOS |
| les 9 autres vues | migration de palette (slate → jetons du tableau de bord) |

### Supprimé

- `src/components/Navbar.tsx` (187 lignes, remplacé par `Sidebar` + `TopHeader`,
  plus aucun import).
- Dépendance `motion` (déclarée, jamais importée).

---

## 6. Bugs connus et limites

Classés du plus au moins gênant.

### 1. Cinq modales sont inatteignables — 1 270 lignes perdues

**C'est le bug le plus rentable à corriger.** Le commit `eabb9cf` a retiré 5
boutons du header à la demande de l'utilisateur. Les modales sont **toujours
rendues** dans `App.tsx` et toujours fonctionnelles, mais **plus rien ne peut
les ouvrir**.

| Modale | Lignes | Déclencheur `setIs…Open(true)` |
|---|---|---|
| `PropFirmRulesModal` | 324 | **aucun** |
| `MindsetJournalModal` | 316 | **aucun** |
| `AISetupAnalyzerModal` | 296 | **aucun** |
| `EconomicCalendarModal` | 194 | 1, mais mort — voir ci-dessous |
| `CertificateModal` | 140 | 1, mais mort |
| | **1 270** | |

Pour le constater sans lire le code :

```bash
for s in setIsPropFirmRulesOpen setIsMindsetModalOpen setIsAISetupAnalyzerOpen; do
  echo "$s -> $(grep -c "$s(true)" src/App.tsx) déclencheur(s)"
done
```

Les trois renvoient `0`. Dans le navigateur : aucun clic, nulle part, n'ouvre
l'analyseur de setup.

Le piège des deux dernières : un déclencheur existe bien, à
[`App.tsx:678`](src/App.tsx:678) et [`679`](src/App.tsx:679), passé à
`MainDashboard` via `onOpenCalendar` / `onOpenCertificate`. Mais
**`MainDashboard` ne les appelle jamais** : la prop est déclarée dans
l'interface et déstructurée, sans aucun `onClick`. Le résultat est le même que
zéro déclencheur. Un `grep` sur le nom de la prop donne donc l'illusion que
c'est branché — vérifie toujours qu'il existe une invocation, pas juste une
mention.

La plus coûteuse à laisser perdue est `AISetupAnalyzerModal` : c'est l'une des
**deux seules fonctions Gemini** du projet, et son `onApplyToJournal`
pré-remplit un trade dans le journal.

Réparation décrite en §7, tâche 2. L'utilisateur a déjà choisi l'approche :
les remettre dans la **sidebar**, pas dans le header.

Même motif de prop morte, sans perte de fonctionnalité cette fois :
`TopHeader` déclare et déstructure `onOpenCalculator` et `onOpenChecklist`
**sans rendre aucun bouton** pour elles, et `MainDashboard` reçoit
`onOpenCalculator` sans l'appeler. Le calculateur et la checklist restent
atteignables ailleurs (3 déclencheurs chacun) : ce sont des props à nettoyer,
pas des écrans perdus.

### 2. Les modifications hors ligne ne sont pas rejouées

Elles restent dans le cache local, mais **le rechargement suivant reprend
l'état du serveur** et les perd. Implémenter le rejeu demande une gestion de
conflits (quelle version gagne ?) — c'est une décision produit, pas seulement
technique.

### 3. Aucune authentification

Un utilisateur unique implicite est utilisé. C'est le plus gros manque
fonctionnel. Voir §7, tâche 1.

### 4. Les 9 modales n'ont pas la palette du site

L'harmonisation visuelle a couvert les 10 vues d'onglet et le centre d'alertes,
**pas les autres modales**. Elles utilisent encore `slate-*` et l'ambre comme
accent :

| Modale | slate | amber |
|---|---|---|
| `TradeAuditModal` | 17 | 12 |
| `CertificateModal` | 13 | 13 |
| `UserProfileModal` | 4 | 18 |
| `TradingPlanModal` | 4 | 8 |
| `PropFirmRulesModal` | 2 | 9 |
| `PositionCalculatorModal` | 3 | 4 |
| `MindsetJournalModal` | 2 | 5 |
| `EconomicCalendarModal` | 3 | 5 |
| `AISetupAnalyzerModal` | 3 | 3 |

La recette est décrite en §8. C'est mécanique et sans risque.

### 5. `onSelectAccountForJournal` est mort

Dans [`WalletManagement.tsx:29`](src/components/WalletManagement.tsx:29), la
prop est **déclarée et déstructurée mais jamais appelée dans le composant**. La
câbler depuis `App.tsx` ne produirait rien. Il faut d'abord décider quel
élément d'interface doit la déclencher.

### 6. Données existantes sans les nouveaux champs

Les trades et élèves déjà en base ont été créés avant l'ajout de `exitDate`,
`exitTime` et `tradingStyle`. Les vues gèrent l'absence proprement (mention
*sortie non renseignée*, pastille masquée), mais **les valeurs mises dans
`mockData.ts` ne s'appliquent qu'à une base neuve**.

> **`rm -rf data/` détruit désormais de vraies données.** Les styles de trading
> des 4 élèves ont été saisis **à la main via l'interface**, ils ne sont pas
> amorcés. Une remise à zéro les perd. Sauvegarde d'abord :
>
> ```bash
> cp data/horizon.db data/horizon.db.bak
> ```

### 7. Aucun test automatisé

Le projet n'a pas de *runner*. En ajouter un est une décision à part entière.
Voir §9 pour ce qui a réellement été vérifié, et comment.

### 8. SQLite sur disque éphémère

Sur Cloud Run (cible naturelle vu l'origine AI Studio), le disque est éphémère
et **les données seraient perdues à chaque redémarrage d'instance**. Monter un
volume sur `DATA_DIR`, ou passer à Postgres. Seul `server/repositories.ts` est
à réécrire : les routes n'y touchent pas.

### 9. Bundle client de 906 Ko

Au-delà du seuil d'avertissement de Vite. Aucun découpage de code n'est en
place. Non bloquant, mais à traiter avant une mise en production sérieuse.

### 10. `.env.example` encore rédigé pour AI Studio

Il mentionne l'injection automatique par AI Studio et une variable `APP_URL`
qui n'est utilisée nulle part. À nettoyer.

---

## 6 bis. Ce qui ressemble à du code mort, mais ne l'est pas

Trois pièges où un repreneur pressé supprimerait du code encore utile.

### La vue `CoachSignals` n'a plus d'entrée de sidebar

Elle a été retirée de la section FORMATION (`84e5e33`) à la demande de
l'utilisateur. Mais l'onglet `signals` **reste atteignable** par la
notification « Signal Coach SMC Actif » du centre d'alertes, dont le
`targetTab` pointe dessus
([`mockData.ts:1415`](src/data/mockData.ts:1415)). Le composant, l'onglet et la
collection `signals` sont donc bien vivants.

### L'onglet `exam` est vide volontairement

Il affiche « Contenu à venir », rendu **en ligne dans `App.tsx`** — il n'a pas
de composant dédié. L'utilisateur a explicitement demandé une page vierge en
attendant de définir le contenu. Ne pas la supprimer ni la remplir sans lui
demander.

### `public/logo.png` n'est utilisé nulle part

Ce fichier de 1,1 Mo est **réservé à l'écran de connexion** à venir
(§7, tâche 1). Seul `public/icon.png` est utilisé aujourd'hui — sidebar,
favicon, icône iOS. Ne pas supprimer `logo.png`, et ne pas l'optimiser avant de
connaître sa taille d'affichage.

---

## 6 ter. Arbitrages déjà rendus

Ces débats ont eu lieu et sont tranchés. Ne pas les rouvrir sans que
l'utilisateur le demande.

| Sujet | Décision |
|---|---|
| Statut « Accompagnement VIP » | **supprimé** — devenu indistinguable de « Prop Firm Financé » une fois la vue passée au vert |
| Bouton « Lecture » du suivi élèves | **passé au vert** en connaissance de cause : il ne se distingue plus d'« Éditer Fiche » par la couleur |
| Les 5 modales orphelines | **à remettre dans la sidebar**, pas dans le header — le header doit rester épuré |
| Harmonisation des 9 modales restantes | **non tranchée** — signalée à l'utilisateur, jamais demandée |
| `onSelectAccountForJournal` | **non tranché** — demande une décision produit |
| Optimisation de `logo.png` | **reportée** à l'écran de connexion, où la taille d'affichage sera connue |
| Rejeu des modifications hors ligne | **non tranché** — coût élevé, à ne faire que sur demande |

---

## 7. Prochaines tâches, dans l'ordre

### 1. Écran de connexion et authentification — *demandé par l'utilisateur*

C'est la prochaine tâche explicitement souhaitée. L'utilisateur veut y placer
`public/logo.png` (le logo complet avec le mot-symbole).

**Ce n'est pas qu'une page.** Il faut trancher, avec lui, avant de coder :

- où vivent les comptes (table `users` existe déjà, avec `user_id` partout) ;
- comment les sessions sont gérées (cookie signé ? JWT ?) ;
- ce qui reste visible sans être connecté ;
- s'il y a une inscription libre ou seulement des comptes créés par l'admin ;
- comment `student.isAdmin` se relie aux comptes réels.

**Ne jamais** implémenter la saisie de mot de passe côté agent sans validation
explicite de l'utilisateur sur l'approche de stockage (hachage, sel).

Note d'intégration : `logo.png` pèse **1,1 Mo** pour 1536×1024. Le calibrer à
2× la taille d'affichage réelle au moment de construire l'écran. Mesures déjà
faites : 768 px → 332 Ko, 600 px → 208 Ko, 768 px en JPEG q88 → 40 Ko. Le JPEG
risque un léger halo sur les bords nets du D blanc et de la flèche verte : à
comparer à l'œil. L'original reste dans git (`6f2547c`).

### 2. Rebrancher les 5 modales orphelines — *approche déjà validée*

Répare le §6.1. **À faire avant la tâche 3** : il ne sert à rien d'harmoniser
visuellement des écrans qu'on ne peut pas ouvrir.

L'utilisateur a choisi de les remettre dans la **sidebar**, où elles seront
masquables par l'engrenage comme les autres entrées. Nouvelle section
**OUTILS**, ces 5 entrées ouvrant des modales et non des onglets.

| Libellé | Clé | Icône | Ouvre |
|---|---|---|---|
| Audit Setup | `audit` | `Sparkles` | `AISetupAnalyzerModal` |
| Prop Firm | `propfirmrules` | `Trophy` | `PropFirmRulesModal` |
| Mindset | `mindset` | `Brain` | `MindsetJournalModal` |
| Calendrier | `calendar` | `Calendar` | `EconomicCalendarModal` |
| Certificat | `certificate` | `ScrollText` | `CertificateModal` |

Pièges déjà repérés, à ne pas redécouvrir :

- la clé `propfirm` est **déjà prise** par « Sim propfirm » → d'où
  `propfirmrules` ;
- l'icône `Award` est **déjà utilisée** par « Examen » → `ScrollText` évite deux
  entrées visuellement jumelles ;
- dans `SIDEBAR_ITEM_TABS`, ces 5 clés valent **`null`** : elles ne changent pas
  d'onglet. Le repli automatique vers le tableau de bord (§4) les ignore alors
  **sans aucune modification**, puisqu'il compare à `activeTab` et que `null`
  n'égale jamais un onglet ;
- les états `setIsAISetupAnalyzerOpen`, `setIsMindsetModalOpen`,
  `setIsPropFirmRulesOpen`, `setIsCalendarOpen`, `setIsCertificateOpen`
  **existent déjà** dans `App.tsx`. Seul le déclencheur manque : aucun état à
  créer.

Deux améliorations à faire au passage, sinon la sidebar devient fragile :

- le clic est routé par **comparaison de libellé**
  (`item.label === "Exercice du jour"`). Avec 6 entrées ouvrant des modales,
  renommer un libellé casserait silencieusement la navigation. Remplacer par un
  champ optionnel `onOpen?: () => void` sur l'entrée ;
- les 3 blocs de section sont **quasi identiques** (~37 lignes chacun). En
  copier un quatrième donnerait 4 redites à maintenir. Extraire un
  `renderSection(label, section, items)`.

Nettoyage lié : une fois la sidebar branchée, retirer `onOpenCalendar`,
`onOpenCertificate` et `onOpenCalculator` de `MainDashboard` (jamais appelées),
ainsi que `onOpenCalculator` / `onOpenChecklist` de `TopHeader` (aucun bouton).

À vérifier en priorité : **Audit Setup**, puis « Appliquer au journal » — c'est
le chemin le plus long et le rebranchement le plus utile.

### 3. Harmoniser les 9 modales restantes

Mécanique, sans risque, gros gain visuel. Recette en §8.

### 4. Remplir le module « Examen »

L'onglet `exam` existe mais **affiche une page vierge** avec le texte « Contenu
à venir » ([`App.tsx`](src/App.tsx), bloc `activeTab === "exam"`). L'utilisateur
a demandé cette page vierge en attendant de définir le contenu. Lui demander ce
qu'il veut y mettre avant de coder.

### 5. Découper le bundle

`build.rollupOptions.output.manualChunks` ou imports dynamiques sur les vues
les plus lourdes (`recharts` est le principal contributeur).

### 6. Décider du sort de `onSelectAccountForJournal`

Câbler ou supprimer. Demander d'abord.

### 7. Rejeu des modifications hors ligne

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
| Fond de page | `#0A0E0D` |
| Fond en creux | `#0D1110` |
| Surface de carte | `#111615` |
| Bordure de carte / pastille | `#1B2320` |
| Pastille haute | `#232D29` |
| Bordure de section | `#151D1A` |
| **Vert de marque** | `#00E676` |
| Survol de bouton vert | `#00c865` |
| Survol de lien vert | `#69F0AE` |

Rayons : `rounded-2xl` pour les cartes, `rounded-xl` pour les éléments internes.

Correspondance utilisée lors de la migration, à réappliquer aux modales :

```
bg-slate-950 → bg-[#0D1110]     border-slate-800 → border-[#1B2320]
bg-slate-900 → bg-[#111615]     border-slate-700 → border-[#232D29]
bg-slate-800 → bg-[#1B2320]     border-slate-900 → border-[#151D1A]
bg-slate-700 → bg-[#232D29]
emerald-300/400/500 → [#00E676]     indigo-* → purple-*
```

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

### Ajouter un champ ne demande pas de migration

`profileSchema` et `collectionItem` sont en **`.passthrough()`** (zod), et les
objets sont stockés en **colonne JSON**. Ajouter un champ à `Trade`,
`StudentProfile` ou `EnrolledStudent` ne demande donc **aucun changement
serveur ni migration SQL**.

C'est ainsi qu'ont été ajoutés `exitDate`, `exitTime`, `tradingStyle` et
`hiddenSidebarItems`. Rends les nouveaux champs **optionnels** : les données
existantes ne les auront pas.

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

Le contournement historique `isActive = activeTab === item.id && idx === 0`,
qui limitait la surbrillance à la première entrée, a été retiré une fois les
`id` rendus uniques.

### Le nom des fichiers d'assets doit être en minuscules

macOS ignore la casse, **un serveur Linux non**. Le logo fourni s'appelait
`Logo.png` et aurait disparu au déploiement.

### Outils d'image disponibles

La machine n'a **ni ImageMagick, ni PIL, ni sharp** — seulement `sips`, qui ne
recadre qu'au centre. Pour un recadrage décalé, passer par un BMP intermédiaire
et le manipuler en Python pur (`struct`), puis reconvertir avec `sips`. C'est la
méthode qui a produit `public/icon.png`.

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

Le serveur de développement est piloté par les outils navigateur. Le cycle
utilisé jusqu'ici, à reprendre :

1. `npm run lint` et `npm run build` après chaque changement ;
2. contrôle visuel de la vue touchée par capture d'écran ;
3. pour tout ce qui touche aux données : mutation dans l'UI → vérification via
   `curl -s localhost:3000/api/state` ;
4. **preuve de persistance réelle** : `localStorage.clear()` puis rechargement,
   et si possible redémarrage du serveur — c'est le seul test qui prouve que la
   donnée vient bien de SQLite et non du cache ;
5. `read_console_messages` pour confirmer l'absence d'erreur.

Nettoie derrière toi : les données de test créées pendant la vérification
doivent être supprimées avant de rendre la main.

### Ce qui a réellement été vérifié — et ce qui ne l'a pas été

Le projet n'a aucun test automatisé (§6.7). Tout a été vérifié à la main, et
**pas au même degré selon les zones**. Ne suppose pas une couverture uniforme.

| Degré | Zones |
|---|---|
| **Exercé de bout en bout** — mutation, base, redémarrage | persistance SQLite, masquage de sidebar, horodatages du journal, style de trading, validation et quotas de l'API (`400`/`404`/`409`/`429`), migration `localStorage` → base, repli hors ligne |
| **Contrôlé visuellement seulement** — la vue s'affiche, rien de plus | forum, académie vidéo, quiz, portefeuilles, messagerie coach, badges, certificat |
| **Jamais exécuté** | la route Gemini **avec une vraie clé** |

Le dernier point mérite d'être explicite : `/api/coach/ai-review` n'a été testée
que sur sa **validation d'entrée** et sa **limitation de débit**. Aucun appel
réel à Gemini n'a abouti pendant le développement. **Ne suppose pas que l'audit
IA fonctionne** — c'est la première chose à vérifier si tu y touches, et le
modèle déclaré (`gemini-3.6-flash`) est à confirmer.

---

## 10. État à la reprise

- **Arbre de travail propre**, 21 commits, branche `main`.
- `npm run lint` et `npm run build` passent.
- Aucune erreur console.
- Base `data/horizon.db` peuplée : 4 élèves (avec style de trading), 7 trades,
  4 portefeuilles, modules, badges, forum, messages, notifications.

### Par où commencer

Deux points d'entrée légitimes, selon ce que veut l'utilisateur :

- **§7 tâche 1 — l'écran de connexion.** C'est ce qu'il a explicitement annoncé
  vouloir faire ensuite. Mais commence par lui poser les décisions listées :
  elles conditionnent tout le reste, et coder avant serait à refaire.
- **§7 tâche 2 — rebrancher les 5 modales.** Si tu veux un gain immédiat sans
  décision produit à prendre : l'approche est déjà validée, le code existe, il
  ne manque que les déclencheurs. C'est la tâche la plus rentable du projet.

> Ce document est la **seule** source de reprise. Des plans de travail ont pu
> être écrits dans `~/.claude/plans/`, **hors du dépôt** : un nouveau Claude ne
> les verra pas. Tout ce qui compte a été replié ici. Si tu produis un plan
> important, reporte-en la substance dans ce fichier.
