import { Router, type Request, type Response, type NextFunction } from "express";
import {
  listCollection,
  replaceCollection,
  getProfile,
  saveProfile,
  getQuizResults,
  replaceQuizResults,
  getTradingPlan,
  getAnnouncements,
  getCollectionVersion,
  COLLECTION_NAMES,
  CollectionOwnershipConflictError,
  CollectionVersionConflictError,
  type CollectionName,
} from "./repositories";
import { isBootstrapped, writeFullState, seedDemoData } from "./seed";
import {
  collectionPayloadSchema,
  profileSchema,
  quizResultsSchema,
  importStateSchema,
} from "./schemas";
import { authRouter, staffRouter } from "./auth/routes";
import { studentAuthRouter, studentProtectedRouter } from "./auth/studentRoutes";
import { requireAuth, type AuthContext } from "./auth/middleware";
import { uploadsRouter } from "./uploads";
import { createRateLimit } from "./middleware/rateLimit";
import { getEconomicCalendar } from "./economicCalendar";
import { getMarketData } from "./marketData";
import { buildStudentProfile, getStudentByEnrolledId } from "./auth/studentCredentials";
import { DEFAULT_USER_ID, FOUNDER_COACH_ID } from "./db";
import { getStaffById } from "./auth/credentials";
import { hasStaffPermission } from "./auth/permissions";
// Catalogue fixe des badges + repli de dernier recours pour les modules —
// données pures (aucune dépendance React/DOM), voir le commentaire de
// `backfillStudentDefaultCollections` plus bas pour pourquoi le serveur en a besoin.
import { initialTraderBadges, initialModules } from "../src/data/mockData";

export const api = Router();

/** Enveloppe un handler async pour que ses rejets partent vers le gestionnaire d'erreurs. */
const wrap =
  (fn: (req: Request, res: Response) => Promise<void>) =>
  (req: Request, res: Response, next: NextFunction) => {
    fn(req, res).catch(next);
  };

api.get("/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

/**
 * Public non authentifié : contrairement à toute autre route de ce fichier,
 * `/economic-calendar` et `/market-data` n'avaient aucun `createRateLimit` —
 * incohérence trouvée en audit de sécurité. Le cache + verrou `inflight`
 * (`economicCalendar.ts`/`marketData.ts`) empêche déjà toute amplification
 * vers les fournisseurs externes, mais rien ne bornait un client local
 * spammant ces deux routes (sérialisation/envoi JSON répété sans frein). Une
 * limite large (le cache tient déjà 1 à 10 min, un usage légitime n'en
 * approche jamais le seuil) plutôt que stricte, pour ne jamais gêner un vrai
 * visiteur.
 */
const publicDataRateLimit = createRateLimit({
  windowMs: 60_000,
  max: 60,
  message: "Trop de requêtes. Réessaie dans quelques instants.",
});

/**
 * Public : donnée non sensible, identique pour tout visiteur, qu'il soit
 * staff ou élève — pas de raison de la coupler à l'un des deux mondes
 * d'authentification.
 */
api.get(
  "/economic-calendar",
  publicDataRateLimit,
  wrap(async (_req, res) => {
    try {
      const events = await getEconomicCalendar();
      res.json({ events });
    } catch (err) {
      console.warn("[economic-calendar] Aucun cache disponible.", err);
      res.status(503).json({ error: "Calendrier économique indisponible pour le moment." });
    }
  })
);

/** Public, même raisonnement que `/economic-calendar` ci-dessus. */
api.get(
  "/market-data",
  publicDataRateLimit,
  wrap(async (_req, res) => {
    try {
      const quotes = await getMarketData();
      res.json({ quotes });
    } catch (err) {
      console.warn("[market-data] Aucun cache disponible.", err);
      res.status(503).json({ error: "Données de marché indisponibles pour le moment." });
    }
  })
);

api.use("/auth", authRouter);
api.use("/auth", studentAuthRouter);

/**
 * Barrière d'authentification.
 *
 * Tout ce qui est déclaré APRÈS cette ligne exige une session valide ; ce qui
 * précède reste public. L'ordre de déclaration rend donc l'exclusion
 * structurelle, ce qui vaut mieux qu'une liste à maintenir.
 *
 * Elle est ici, sur le routeur, et non en `app.use` : Vite est monté après l'API
 * dans `startServer()`, un middleware au niveau application casserait le
 * rechargement à chaud.
 *
 * Accepte désormais deux mondes de session (staff ou élève) — voir
 * `server/auth/middleware.ts`. `req.auth.kind` distingue les deux ensuite.
 */
api.use(requireAuth);

// Montées ici et non avec les routeurs publics plus haut : ces routes exigent
// une session valide, donc doivent passer APRÈS la barrière.
//
// `requireStaffKind`/`requireStudentKind` sont appliquées route par route,
// À L'INTÉRIEUR de chaque routeur (voir `server/auth/routes.ts` et
// `studentRoutes.ts`) — jamais ici, au niveau du montage. Les deux routeurs
// partagent le même préfixe "/auth" : une garde posée ici s'exécuterait pour
// TOUTE requête sous "/auth", y compris celles destinées à l'autre monde,
// avant même qu'Express n'ait pu constater qu'aucune route de ce routeur ne
// correspond. C'est exactement ce qui bloquait `/auth/student-change-password`
// avec « Action réservée au staff » avant ce correctif.
api.use("/auth", staffRouter);
api.use("/auth", studentProtectedRouter);
// Vidéos de leçon (téléversement staff + lecture avec support Range) — voir
// server/uploads.ts. Montée ici, après la barrière d'authentification :
// regarder une leçon exige une session valide (staff ou élève), la limite au
// seul staff pour le téléversement est posée route par route dans ce routeur.
api.use("/uploads", uploadsRouter);

/**
 * Collections qu'une session élève peut lire/écrire : son Journal, ses
 * propres portefeuilles (comptes Prop Firm / broker), sa copie personnelle
 * du programme de formation (leçons vues), son fil de messagerie avec
 * le coach, et son état de badges (réclamation — la progression elle-même
 * est recalculée en direct côté client, voir `src/lib/badges.ts`) — jamais
 * les collections du bureau staff (fiches élèves) ni celles d'un autre élève.
 */
const STUDENT_ALLOWED_COLLECTIONS = new Set<CollectionName>([
  "trades",
  "accounts",
  "modules",
  "messages",
  "badges",
  // Alertes de non-respect du plan de trading (client, voir
  // src/lib/planCompliance.ts) : un élève a désormais besoin d'une vraie
  // collection persistée pour ces notifications, au même titre que le
  // bureau staff — avant, `studentNotifications` (App.tsx) était
  // entièrement dérivé des messages/badges, sans mécanisme pour pousser
  // une notification arbitraire.
  "notifications",
  // Stratégies de trading définies par l'élève (module Setups) — voir
  // `Setup`, `src/types.ts`. Source du multi-choix `authorizedSetups` du
  // Plan de trading et du champ Stratégie du Journal.
  "setups",
]);

/**
 * Profil PERSONNEL d'un compte staff — nom, avatar, bio, capital, etc.
 * `isAdmin` toujours forcé à `true`.
 *
 * `personalDataUserId` (voir `AuthContext.personalDataUserId`) : jamais
 * `DEFAULT_USER_ID` tel quel pour un coach, sans quoi il verrait et pourrait
 * modifier l'identité du fondateur au lieu de la sienne — exactement le bug
 * signalé ("les coachs ne doivent pas voir mon profil en détail, ni celui
 * des autres coachs"). Pour le fondateur, `personalDataUserId ===
 * DEFAULT_USER_ID`, donc aucun changement de comportement pour lui.
 *
 * `hiddenSidebarItems` reste l'EXCEPTION partagée : c'est un réglage
 * org-wide que seul le fondateur peut poser (voir `PUT /profile` plus bas et
 * `AuthContext.isOwner`), et qui doit s'appliquer à tout le staff — jamais
 * lu depuis le profil personnel de l'appelant, toujours depuis le bureau
 * partagé, fusionné par-dessus (même principe que `buildStudentProfile`,
 * `server/auth/studentCredentials.ts`).
 *
 * Tout compte staff a exactement les mêmes droits (voir
 * `StaffAccountsModal.tsx`, "Mêmes droits pour tous sur ce bureau") — `false`
 * ou absent n'est jamais un état légitime ici, seulement un profil jamais
 * réenregistré depuis sa création (le profil par défaut, `initialStudentProfile`
 * dans `src/data/mockData.ts`, n'a longtemps porté aucun champ `isAdmin` du
 * tout). Sans ce correctif, le champ restait figé à `false`/`undefined` et
 * `Sidebar.tsx` (qui décide d'afficher "Suivi des Élèves" sur ce seul champ)
 * masquait silencieusement l'onglet à un vrai compte fondateur.
 */
function buildStaffProfile(auth: AuthContext): Record<string, unknown> | null {
  const profile = getProfile<Record<string, unknown>>(auth.personalDataUserId);
  if (!profile) return null;
  const sharedProfile = getProfile<{ hiddenSidebarItems?: unknown }>(DEFAULT_USER_ID);
  return {
    ...profile,
    isAdmin: true,
    hiddenSidebarItems: sharedProfile?.hiddenSidebarItems ?? [],
    // `null` = tout accordé (voir `hasStaffPermission`) — le client doit
    // distinguer ce cas d'une liste vide, jamais le traiter comme "aucune
    // autorisation" par un `?? []` naïf (voir Sidebar.tsx).
    permissions: auth.permissions,
  };
}

/**
 * "Coach" affiché côté élève dans la Messagerie — reconstruit depuis le vrai
 * profil du bureau staff partagé (`DEFAULT_USER_ID`), jamais une identité
 * fictive. Seuls des champs publics (nom, avatar, rôle/niveau) traversent
 * cette frontière — jamais l'email, le téléphone ni aucun champ privé du
 * profil fondateur.
 *
 * `id` est fixé sur `FOUNDER_COACH_ID` : `CoachMessaging` filtre son fil par
 * ce champ, et la route qui écrit la réponse du coach
 * (`server/auth/routes.ts`) l'utilise pour taguer chaque message — les deux
 * doivent rester le même identifiant, quel que soit le compte staff qui
 * répond réellement (bureau partagé, voir §"Qui l'utilise" du HANDOFF).
 *
 * Si le profil fondateur n'a pas encore de nom renseigné (juste après la
 * toute première installation), renvoie `[]` : `CoachMessaging` affiche
 * alors honnêtement "Aucun coach disponible" plutôt qu'une fiche vide.
 */
function buildCoachesForStudent(): Array<Record<string, unknown>> {
  const staffProfile = getProfile<{
    name?: string;
    avatar?: string;
    role?: string;
    level?: string;
  }>(DEFAULT_USER_ID);

  if (!staffProfile?.name) return [];

  return [
    {
      id: FOUNDER_COACH_ID,
      name: staffProfile.name,
      role: staffProfile.role || "Coach",
      specialty: staffProfile.level || "",
      avatar: staffProfile.avatar || "",
      isOnline: true,
    },
  ];
}

/**
 * Fusionne, pour chaque fiche élève, sa vraie photo de profil personnelle
 * (téléversée par l'élève lui-même, `PUT /auth/profile/avatar`) par-dessus
 * `avatar` de la fiche — même résolution que `buildStudentProfile`
 * (`ownProfile.avatar` prioritaire sur `enrolled.avatar`), mais appliquée à
 * TOUTE la collection d'un coup, pour la carte résumé du Suivi des Élèves
 * (`StudentTracking.tsx`), qui affichait jusqu'ici la photo figée sur la
 * fiche même après que l'élève ait changé la sienne — bug signalé par
 * l'utilisateur, la fiche n'ayant jamais eu accès au bureau personnel de
 * l'élève avant ce correctif.
 *
 * Une fiche sans accès élève actif (`getStudentByEnrolledId` renvoie `null`)
 * n'a par construction aucun bureau personnel à consulter : elle repart
 * inchangée.
 */
function withResolvedStudentAvatars<T extends { id: string; avatar?: unknown }>(
  enrolledStudents: T[]
): T[] {
  return enrolledStudents.map((enrolled) => {
    const account = getStudentByEnrolledId(enrolled.id);
    if (!account) return enrolled;

    const ownProfile = getProfile<{ avatar?: string }>(account.userId);
    if (!ownProfile?.avatar) return enrolled;

    return { ...enrolled, avatar: ownProfile.avatar };
  });
}

/**
 * Collections qui restent le suivi PERSONNEL du compte staff connecté
 * (Journal, portefeuilles, badges, alertes de risque, setups) — jamais le
 * bureau partagé `DEFAULT_USER_ID`, contrairement aux fiches élèves, au
 * programme de formation et à la messagerie coach, qu'un élève doit voir
 * comme un seul et même coach cohérent quel que soit le membre du staff
 * connecté. Un coach nouvellement invité démarre donc avec un Journal et des
 * badges à lui, vierges — jamais ceux déjà accumulés par le fondateur.
 *
 * Sans effet sur une session élève : `resolveCollectionUserId` ne s'en sert
 * que pour `kind === "staff"`.
 */
const PERSONAL_STAFF_COLLECTIONS = new Set<CollectionName>([
  "trades",
  "accounts",
  "badges",
  "notifications",
  "setups",
]);

/**
 * Bureau de données à utiliser pour LIRE/ÉCRIRE une collection donnée, selon
 * l'identité de l'appelant — voir `AuthContext.personalDataUserId` pour le
 * pourquoi de cette distinction personnel/partagé côté staff. Une session
 * élève n'a qu'un seul bureau (`dataUserId` === `personalDataUserId`), donc
 * toujours la même valeur ici quelle que soit la collection.
 */
function resolveCollectionUserId(auth: AuthContext, name: CollectionName): string {
  if (auth.kind === "student") return auth.dataUserId;
  return PERSONAL_STAFF_COLLECTIONS.has(name) ? auth.personalDataUserId : auth.dataUserId;
}

/**
 * Garantit une ligne `users` pour ce bureau personnel — `trades`/`accounts`/
 * `badges`/`notifications`/`setups` référencent `users(id)` en clé
 * étrangère, et un compte staff invité AVANT ce mécanisme (ou même après :
 * `createInvitedStaffAccount` ne crée qu'une ligne `staff_accounts`, jamais
 * `users`) n'en a aucune tant qu'il n'a rien écrit — la première écriture
 * échouerait sinon (violation de contrainte). Sans effet dès que la ligne
 * existe déjà (le fondateur en a toujours une, `personalDataUserId ===
 * DEFAULT_USER_ID`).
 *
 * Sème un profil minimal cohérent (nom déduit de l'email, capital par
 * défaut) plutôt qu'un objet vide — même contenu que `minimalProfile`
 * (`server/auth/routes.ts`, appelé pour le tout premier compte fondateur) :
 * un coach voit ainsi tout de suite SA propre identité dans "Profil &
 * Options", jamais un écran vide ni, pire, celle du fondateur.
 */
function ensurePersonalUserRow(userId: string): void {
  if (getProfile(userId) !== null) return;
  const staff = getStaffById(userId);
  saveProfile(
    {
      name: staff?.name || staff?.email?.split("@")[0] || "Coach",
      email: staff?.email ?? "",
      avatar: "",
      level: "Coach",
      joinedDate: new Date().toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" }),
      startingCapital: 10000,
      currentCapital: 10000,
      isAdmin: true,
    },
    userId
  );
}

/**
 * Rattrape un compte élève dont `badges`/`modules` n'ont jamais été
 * initialisés — normalement copiés depuis le bureau staff partagé au moment
 * de l'invitation (voir `server/auth/routes.ts`), mais un élève invité
 * avant l'existence de ces collections (ou dont le bureau staff n'avait
 * lui-même encore aucune définition à copier ce jour-là) reste bloqué avec
 * une collection vide pour toujours : cette copie ne se produit qu'une
 * fois, à l'invitation, sans mécanisme de rattrapage — exactement le bug
 * signalé ("les badges ne s'affichent pas chez mon élève"). Appelée à
 * chaque chargement d'état élève, mais sans effet dès que la collection a
 * été réellement peuplée une fois (idempotent).
 */
/**
 * Rattrape les badges MANQUANTS d'un bureau (staff partagé ou élève) par
 * rapport au catalogue `initialTraderBadges` — pas seulement quand la
 * collection est totalement vide (`length === 0`) : un ajout de nouveaux
 * badges au catalogue (ex. les paliers de série de discipline au-delà de 7
 * jours) doit aussi atteindre les comptes déjà peuplés, staff comme élèves
 * déjà invités, sans attendre une réinvitation qui n'aura jamais lieu.
 * Idempotent — sans effet une fois que chaque badge du catalogue a sa copie.
 *
 * `dataUserId` est déjà le bureau PERSONNEL de l'appelant (voir
 * `AuthContext.personalDataUserId`, `resolveCollectionUserId`) — jamais
 * `DEFAULT_USER_ID` tel quel pour un coach, sans quoi il rattraperait les
 * badges déjà débloqués du fondateur au lieu des siens.
 *
 * `asFounder` distingue les deux règles d'id/état déjà en vigueur ailleurs
 * (voir `server/auth/routes.ts`) :
 * - fondateur (`personalDataUserId === DEFAULT_USER_ID`) : id du catalogue
 *   tel quel (`badge-N`), état copié tel quel — décision explicite que SON
 *   profil a tout de débloqué (voir le commentaire en tête de
 *   `initialTraderBadges`).
 * - élève OU coach invité : id préfixé (`${dataUserId}-badge-N`), toujours
 *   reposé verrouillé — jamais un faux badge déjà débloqué. Un coach n'a
 *   pas encore de trade dans son Journal personnel à l'invitation : ses
 *   badges doivent rester à débloquer par lui, exactement comme un élève.
 */
function backfillMissingBadges(dataUserId: string, asFounder: boolean): void {
  const existing = listCollection<{ id: string; [key: string]: unknown }>("badges", dataUserId);
  const isAlreadyPresent = (definitionId: string) =>
    asFounder
      ? existing.some((b) => b.id === definitionId)
      : existing.some((b) => b.id.endsWith(`-${definitionId}`));

  const missingDefinitions = initialTraderBadges.filter((def) => !isAlreadyPresent(def.id));
  if (missingDefinitions.length === 0) return;

  const newEntries = missingDefinitions.map((def) =>
    asFounder
      ? { ...def }
      : { ...def, id: `${dataUserId}-${def.id}`, unlocked: false, unlockedAt: undefined }
  );
  replaceCollection("badges", [...existing, ...newEntries], dataUserId);
}

/**
 * Resynchronise les badges DÉJÀ présents du fondateur avec le catalogue
 * actuel (`initialTraderBadges`) — `backfillMissingBadges` n'AJOUTE que les
 * badges manquants, il ne met jamais à jour ceux déjà stockés. Sans cette
 * fonction, changer un `rewardXP` ou un `unlockedAt` dans
 * `src/data/mockData.ts` (ex. remonter le total d'XP à 20 000 pour matcher
 * un niveau max relevé) resterait invisible : la copie déjà en base du
 * fondateur garderait ses anciennes valeurs indéfiniment.
 *
 * Réservée au fondateur : ses badges "unlocked: true" sont une CONVENTION
 * du catalogue (jamais une vraie progression réclamée), donc entièrement
 * dérivés de `initialTraderBadges` — les resynchroniser en totalité est
 * sans risque. Un coach ou un élève, eux, ont un état `unlocked`/`unlockedAt`
 * RÉELLEMENT gagné par leur propre progression : jamais touché ici, seul
 * `rewardXP` (une caractéristique du catalogue, pas une donnée personnelle)
 * mériterait la même synchronisation le jour où un badge existant change de
 * barème — hors scope aujourd'hui, personne n'en a encore réclamé aucun.
 */
function syncFounderBadgeCatalog(founderPersonalId: string): void {
  const existing = listCollection<{ id: string; [key: string]: unknown }>("badges", founderPersonalId);
  const byId = new Map(initialTraderBadges.map((def) => [def.id, def]));

  let changed = false;
  const next = existing.map((badge) => {
    const def = byId.get(badge.id);
    if (!def) return badge;
    const synced = { ...def };
    if (JSON.stringify(synced) === JSON.stringify(badge)) return badge;
    changed = true;
    return synced;
  });

  if (changed) replaceCollection("badges", next, founderPersonalId);
}

function backfillStudentDefaultCollections(dataUserId: string): void {
  backfillMissingBadges(dataUserId, false);

  // Modules : contenu réel du programme, personnalisable par le fondateur —
  // copié depuis SON bureau en priorité (source de vérité éditable), avec un
  // repli sur le contenu par défaut seulement si même celui-ci est vide.
  if (listCollection("modules", dataUserId).length === 0) {
    const sharedModules = listCollection<{ id: string; [key: string]: unknown }>("modules", DEFAULT_USER_ID);
    const source = sharedModules.length > 0 ? sharedModules : initialModules;
    if (source.length > 0) {
      const personalModules = source.map((mod) => ({ ...mod, id: `${dataUserId}-${mod.id}` }));
      replaceCollection("modules", personalModules, dataUserId);
    }
  }
}

/**
 * Payload de démarrage : toutes les collections en un aller-retour, dans les
 * formes exactes attendues par le client.
 *
 * Une session élève ne reçoit que les collections listées dans
 * `STUDENT_ALLOWED_COLLECTIONS` (+ son profil reconstruit et ses résultats de
 * quiz) — un filtrage franc côté serveur, pas une forme complète à moitié
 * cachée côté client.
 */
api.get("/state", (req, res) => {
  const dataUserId = req.auth!.dataUserId;

  if (req.auth!.kind === "student") {
    backfillStudentDefaultCollections(dataUserId);
    res.json({
      bootstrapped: isBootstrapped(),
      student: buildStudentProfile(req.auth!.userId),
      quizResults: getQuizResults(dataUserId),
      tradingPlan: getTradingPlan(dataUserId),
      // Annonces du fondateur : jamais scopées par élève (voir
      // `getAnnouncements`, `server/repositories.ts`) — la même liste part
      // dans les deux branches de cette route (élève et staff).
      announcements: getAnnouncements() ?? [],
      coaches: buildCoachesForStudent(),
      collections: Object.fromEntries(
        [...STUDENT_ALLOWED_COLLECTIONS].map((name) => [name, listCollection(name, dataUserId)])
      ),
      // Version actuelle de chaque collection modifiable par l'élève —
      // renvoyée avec la collection elle-même pour que `PUT
      // /collections/:name` puisse détecter qu'un autre onglet l'a modifiée
      // entre-temps (voir `CollectionVersionConflictError`).
      versions: Object.fromEntries(
        [...STUDENT_ALLOWED_COLLECTIONS].map((name) => [name, getCollectionVersion(name, dataUserId)])
      ),
    });
    return;
  }

  // Badges : bureau PERSONNEL du compte connecté (voir
  // `PERSONAL_STAFF_COLLECTIONS`) — un coach invité rattrape ses propres
  // badges, verrouillés, jamais ceux déjà débloqués du fondateur.
  ensurePersonalUserRow(req.auth!.personalDataUserId);
  backfillMissingBadges(req.auth!.personalDataUserId, req.auth!.isOwner);
  if (req.auth!.isOwner) syncFounderBadgeCatalog(req.auth!.personalDataUserId);

  const collections = Object.fromEntries(
    COLLECTION_NAMES.map((name) => {
      const collectionUserId = resolveCollectionUserId(req.auth!, name);
      const collection = listCollection(name, collectionUserId);
      // Collections initialement vides (badges, modules) : retourner undefined
      // pour que le client tombe sur le fallback (mockData) au démarrage.
      // Les autres collections (trades, accounts, etc.) retournent l'array même
      // s'il est vide — c'est l'état correct.
      if (collection.length === 0 && (name === "badges" || name === "modules")) {
        return [name, undefined];
      }
      if (name === "enrolledStudents") {
        return [name, withResolvedStudentAvatars(collection as { id: string; avatar?: unknown }[])];
      }
      return [name, collection];
    })
  );

  res.json({
    bootstrapped: isBootstrapped(),
    student: buildStaffProfile(req.auth!),
    quizResults: getQuizResults(dataUserId),
    announcements: getAnnouncements() ?? [],
    collections,
    versions: Object.fromEntries(
      COLLECTION_NAMES.map((name) => [name, getCollectionVersion(name, resolveCollectionUserId(req.auth!, name))])
    ),
  });
});

/** Collections que seul un administrateur peut écrire. */
const ADMIN_ONLY_COLLECTIONS = new Set<CollectionName>(["enrolledStudents"]);

const collectionsRateLimit = createRateLimit({
  windowMs: 15 * 60_000,
  max: 60,
  message: "Trop d'écritures à la base de données. Réessaie dans quelques minutes.",
});

/**
 * Cœur de l'écriture d'une collection, partagé par `PUT /collections/:name`
 * ET par la restauration de sauvegarde (`POST /state/restore`) — jamais
 * dupliqué, pour que les deux chemins appliquent exactement les mêmes règles
 * d'autorisation et la même fusion protectrice des messages coach. Toute
 * évolution de cette logique (nouvelle collection réservée, nouvelle règle de
 * fusion) n'a besoin d'être écrite qu'ici.
 */
function writeCollectionForAuth(
  auth: AuthContext,
  name: CollectionName,
  rawPayload: unknown,
  /**
   * Version lue par l'appelant à son dernier chargement — `undefined`
   * désactive la vérification (restauration de sauvegarde : toujours
   * autoritaire, jamais un client concurrent). Fournie par
   * `PUT /collections/:name`, chemin normal d'un client vivant qui peut
   * avoir un autre onglet ouvert sur le même bureau — voir
   * `CollectionVersionConflictError`, `server/repositories.ts`.
   */
  expectedVersion?: number
): { ok: true; count: number; version: number } | { ok: false; status: number; error: string } {
  // Une session élève ne touche jamais qu'à son propre Journal — ni les
  // collections du bureau staff, ni celles d'un autre élève.
  if (auth.kind === "student" && !STUDENT_ALLOWED_COLLECTIONS.has(name)) {
    return { ok: false, status: 403, error: "Action réservée au staff." };
  }

  // `auth.isAdmin !== true` ne peut aujourd'hui jamais se déclencher — un
  // élève est déjà arrêté juste au-dessus, et tout compte staff a
  // `isAdmin: true` forcé. La vraie restriction, depuis l'introduction des
  // autorisations par coach, est l'autorisation "students" : éditer une
  // fiche élève (créer, modifier, supprimer) fait partie du Suivi des
  // Élèves au même titre que les routes dédiées de `server/auth/routes.ts`
  // (`requirePermission("students")`) — un coach à qui elle a été retirée
  // ne doit pas pouvoir la contourner par une écriture directe de collection.
  if (ADMIN_ONLY_COLLECTIONS.has(name) && auth.isAdmin !== true) {
    return { ok: false, status: 403, error: "Action réservée à l'administrateur." };
  }
  if (ADMIN_ONLY_COLLECTIONS.has(name) && auth.kind === "staff" && !hasStaffPermission(auth, "students")) {
    return { ok: false, status: 403, error: "Autorisation retirée par le fondateur pour cette action." };
  }

  const parsed = collectionPayloadSchema.safeParse(rawPayload);
  if (!parsed.success) {
    return { ok: false, status: 400, error: "Collection invalide." };
  }

  // `collectionPayloadSchema` ne valide qu'un `id` et laisse tout le reste
  // passer tel quel, et le client envoie toujours le tableau complet tel
  // qu'il l'avait en mémoire au moment de la modification — jamais un delta.
  // Pour `messages` côté élève, ces deux faits combinés ouvrent deux
  // problèmes distincts si on se contente de tout remplacer tel quel :
  //  1. Un élève pourrait fabriquer un item `sender: "coach"` de toutes
  //     pièces, qui semblerait alors venir du coach.
  //  2. Une réponse du coach postée par `POST .../messages` PENDANT que
  //     l'élève avait déjà son propre tableau (sans cette réponse) chargé en
  //     mémoire disparaîtrait silencieusement au prochain envoi de l'élève —
  //     son tableau, ne la contenant pas, l'effacerait purement et
  //     simplement en écrasant toute la collection.
  //
  // Les deux se résolvent avec la même règle : la partie « coach » du fil
  // reste toujours autoritaire côté serveur, quoi que le client envoie —
  // un élève ne peut qu'ajouter ou modifier SES PROPRES messages.
  let dataToWrite = parsed.data;
  if (auth.kind === "student" && name === "messages") {
    const existingCoachMessages = listCollection<{ id: string; sender?: string; [key: string]: unknown }>(
      name,
      resolveCollectionUserId(auth, name)
    ).filter((m) => m.sender === "coach");

    // Filtrer sur `sender !== "coach"` seul ne suffit pas : `replaceCollection`
    // fait un upsert par `id` (`ON CONFLICT(id) DO UPDATE`), donc un item
    // soumis avec un `id` identique à celui d'un vrai message coach — même
    // avec un `sender` différent — écraserait ce message à l'écriture, l'ordre
    // du tri par `timestamp` (contrôlé par l'élève sur son propre item)
    // décidant lequel des deux gagne. On exclut donc en plus tout id qui
    // appartient déjà à un message coach existant : un tel item est
    // simplement abandonné plutôt qu'admis sous un id qui n'est pas le sien.
    const existingCoachIds = new Set(existingCoachMessages.map((m) => m.id));
    const submittedNonCoach = (
      parsed.data as { id: string; sender?: string; [key: string]: unknown }[]
    ).filter((item) => item.sender !== "coach" && !existingCoachIds.has(item.id));

    // Fusionnés puis triés par `timestamp` (ISO 8601 des deux côtés — voir
    // `handleSendMessage` côté élève et la route de réponse du coach) : les
    // `id` ne sont pas comparables entre les deux, générés différemment
    // (horodatage brut côté élève, aléatoire côté coach).
    const timestampOf = (m: Record<string, unknown>) => (typeof m.timestamp === "string" ? m.timestamp : "");
    dataToWrite = [...existingCoachMessages, ...submittedNonCoach].sort((a, b) =>
      timestampOf(a) < timestampOf(b) ? -1 : timestampOf(a) > timestampOf(b) ? 1 : 0
    ) as typeof parsed.data;
  }

  let newVersion: number;
  try {
    newVersion = replaceCollection(name, dataToWrite, resolveCollectionUserId(auth, name), expectedVersion);
  } catch (err) {
    if (err instanceof CollectionOwnershipConflictError) {
      // Un ou plusieurs `id` soumis appartiennent déjà à un autre bureau
      // (voir le commentaire de `replaceCollection`) — rien n'a été écrit.
      // Un id généré côté client (`Date.now()`) est entré en collision ;
      // recharger régénère un id propre à la prochaine tentative.
      return {
        ok: false,
        status: 409,
        error: "Conflit de synchronisation : recharge la page et réessaie.",
      };
    }
    if (err instanceof CollectionVersionConflictError) {
      // Un autre onglet (ou un autre coach sur le même bureau partagé) a
      // écrit cette collection entre le chargement de CETTE session et
      // maintenant — rien n'a été écrit, pour ne pas écraser cette autre
      // modification. Même message que le conflit d'id ci-dessus : dans les
      // deux cas, la seule action correcte est de recharger.
      return {
        ok: false,
        status: 409,
        error: "Conflit de synchronisation : recharge la page et réessaie.",
      };
    }
    throw err;
  }
  return { ok: true, count: dataToWrite.length, version: newVersion };
}

api.put("/collections/:name", collectionsRateLimit, (req, res) => {
  const name = req.params.name as CollectionName;
  if (!COLLECTION_NAMES.includes(name)) {
    res.status(404).json({ error: `Collection inconnue : ${req.params.name}` });
    return;
  }

  // Corps `{ items, version }` — `version` est la valeur renvoyée par le
  // dernier `GET /state` ou la dernière écriture réussie pour cette
  // collection (voir `versions` dans la réponse de bootstrap plus bas, et
  // `useSyncedState`/`api.ts` côté client). Absente ou non numérique :
  // traitée comme "pas de vérification demandée" plutôt que rejetée, pour
  // ne pas casser un appel direct à l'API qui ignorerait ce détail.
  const body = req.body as { items?: unknown; version?: unknown };
  const items = body && typeof body === "object" && "items" in body ? body.items : req.body;
  const version = typeof body?.version === "number" ? body.version : undefined;

  const result = writeCollectionForAuth(req.auth!, name, items, version);
  if (!result.ok) {
    res.status(result.status).json({ error: result.error });
    return;
  }
  res.json({ success: true, count: result.count, version: result.version });
});

const profileRateLimit = createRateLimit({
  windowMs: 15 * 60_000,
  max: 30,
  message: "Trop de mises à jour du profil. Réessaie dans quelques minutes.",
});

api.put("/profile", profileRateLimit, (req, res) => {
  // Le profil élève n'existe pas en tant que tel dans ce chantier (pas de
  // capital, pas d'avatar à gérer côté élève) — cette route reste réservée au
  // bureau staff.
  if (req.auth!.kind === "student") {
    res.status(403).json({ error: "Action réservée au staff." });
    return;
  }

  const parsed = profileSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Profil invalide.", details: parsed.error.issues });
    return;
  }

  // Forcé à `true`, jamais redérivé d'une valeur lue en base — cette route a
  // déjà rejeté toute session non-staff plus haut, et tout compte staff a
  // `isAdmin: true` par invariant (voir `buildStaffProfile`, plus bas dans ce
  // fichier — même règle, même raison).
  const profile: Record<string, unknown> = {
    ...parsed.data,
    isAdmin: true,
  };

  // `hiddenSidebarItems` est le SEUL champ qui n'appartient pas au profil
  // PERSONNEL de l'appelant, même s'il voyage dans le même objet que le nom,
  // l'avatar ou le capital côté client — c'est un réglage org-wide que seul
  // le fondateur peut poser (voir `buildStaffProfile`, qui le lit toujours
  // depuis le bureau partagé, jamais depuis le profil personnel écrit ici).
  // Pour un coach, ce champ n'a donc aucune existence légitime dans SA
  // propre ligne : plutôt que de réinjecter une valeur (celle du bureau
  // partagé, ou une valeur périmée de son propre profil), on l'écarte
  // simplement — `buildStaffProfile` la resservira de toute façon depuis la
  // source autoritaire à la prochaine lecture, quoi que ce PUT ait stocké.
  if (req.auth?.isOwner !== true) {
    delete profile.hiddenSidebarItems;
  }

  saveProfile(profile, req.auth!.personalDataUserId);
  res.json({ success: true });
});

const quizResultsRateLimit = createRateLimit({
  windowMs: 15 * 60_000,
  max: 30,
  message: "Trop de mises à jour de résultats. Réessaie dans quelques minutes.",
});

api.put("/quiz-results", quizResultsRateLimit, (req, res) => {
  const parsed = quizResultsSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Résultats de quiz invalides.", details: parsed.error.issues });
    return;
  }

  // Portée par bureau de données : un élève n'écrit que les siens, jamais
  // ceux du bureau staff partagé (`dataUserId` fait déjà cette distinction).
  replaceQuizResults(parsed.data, req.auth!.dataUserId);
  res.json({ success: true });
});

const stateImportRateLimit = createRateLimit({
  windowMs: 15 * 60_000,
  max: 10,
  message: "Trop de tentatives d'import d'état. Réessaie dans quelques minutes.",
});

/**
 * Reprise des données qu'un utilisateur avait dans son localStorage avant que
 * la persistance serveur existe. Refusée si la base est déjà amorcée, pour que
 * deux onglets ouverts ne puissent pas réimporter et dupliquer.
 */
api.post("/state/import", stateImportRateLimit, (req, res) => {
  if (req.auth!.kind === "student") {
    res.status(403).json({ error: "Action réservée au staff." });
    return;
  }

  if (isBootstrapped()) {
    res.status(409).json({ error: "Base déjà amorcée, import ignoré." });
    return;
  }

  const parsed = importStateSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "État importé invalide.", details: parsed.error.issues });
    return;
  }

  const collections = Object.fromEntries(
    Object.entries(parsed.data.collections ?? {}).filter(([name]) =>
      COLLECTION_NAMES.includes(name as CollectionName)
    )
  ) as Partial<Record<CollectionName, { id: string }[]>>;

  writeFullState({
    student: parsed.data.student ?? getProfile(),
    collections,
    quizResults: parsed.data.quizResults,
  });

  res.json({ success: true, imported: Object.keys(collections) });
});

const stateSeedRateLimit = createRateLimit({
  windowMs: 15 * 60_000,
  max: 5,
  message: "Trop de tentatives d'amorçage. Réessaie dans quelques minutes.",
});

/**
 * Amorce la base avec le jeu de démonstration. Appelé par le client quand il
 * découvre une base vierge et qu'il n'a rien à reprendre de son localStorage.
 */
api.post("/state/seed", stateSeedRateLimit, (req, res) => {
  if (req.auth!.kind === "student") {
    res.status(403).json({ error: "Action réservée au staff." });
    return;
  }

  if (isBootstrapped()) {
    res.status(409).json({ error: "Base déjà amorcée." });
    return;
  }

  seedDemoData();
  res.json({ success: true });
});

const stateRestoreRateLimit = createRateLimit({
  windowMs: 15 * 60_000,
  max: 5,
  message: "Trop de tentatives de restauration. Réessaie dans quelques minutes.",
});

/**
 * Restaure une sauvegarde JSON précédemment exportée (section « Données &
 * Sauvegarde » du profil) — remplace le profil, les collections et les
 * résultats de quiz du bureau de l'appelant SEULEMENT. Contrairement à
 * `/state/import` (réservée au tout premier amorçage, voir plus haut),
 * fonctionne à tout moment sur une base déjà en service : c'est une
 * restauration volontaire de SES PROPRES données par l'appelant, jamais
 * celles d'un autre bureau.
 *
 * Chaque collection passe par `writeCollectionForAuth`, exactement comme un
 * `PUT /collections/:name` normal : une session élève ne peut restaurer que
 * les collections qui lui sont déjà autorisées, avec la même fusion
 * protectrice des messages coach. Une collection inconnue, refusée ou
 * invalide est simplement ignorée (renvoyée dans `skipped`) plutôt que de
 * bloquer toute la restauration — un fichier partiellement corrompu ou
 * modifié à la main ne doit pas empêcher de récupérer le reste.
 */
api.post("/state/restore", stateRestoreRateLimit, (req, res) => {
  const auth = req.auth!;

  // Autorisation "data" : ne gouverne QUE la restauration (écrase le bureau
  // de l'appelant depuis un fichier), jamais la lecture/export — un coach a
  // toujours besoin de lire ses propres données pour utiliser l'app. Sans
  // objet pour une session élève, qui n'a pas de `permissions`.
  if (auth.kind === "staff" && !hasStaffPermission(auth, "data")) {
    res.status(403).json({ error: "Autorisation retirée par le fondateur pour cette action." });
    return;
  }

  const parsed = importStateSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Fichier de sauvegarde invalide.", details: parsed.error.issues });
    return;
  }
  const imported: string[] = [];
  const skipped: string[] = [];

  if (parsed.data.student) {
    // Une session élève n'a pas de profil éditable côté serveur (voir
    // PUT /profile juste en dessous, réservée au staff) : le profil élève
    // exporté est de toute façon reconstruit depuis la fiche enrolledStudents
    // à chaque lecture, jamais depuis un profil restauré ici.
    if (auth.kind === "student") {
      skipped.push("student");
    } else {
      saveProfile(parsed.data.student, auth.personalDataUserId);
      imported.push("student");
    }
  }

  for (const [name, payload] of Object.entries(parsed.data.collections ?? {})) {
    if (!COLLECTION_NAMES.includes(name as CollectionName)) {
      skipped.push(name);
      continue;
    }
    const result = writeCollectionForAuth(auth, name as CollectionName, payload);
    if (result.ok) {
      imported.push(name);
    } else {
      skipped.push(name);
    }
  }

  if (parsed.data.quizResults) {
    replaceQuizResults(parsed.data.quizResults, auth.dataUserId);
    imported.push("quizResults");
  }

  res.json({ success: true, imported, skipped });
});

/**
 * Gestionnaire d'erreurs : une exception non prévue renvoie un 500 propre.
 *
 * Le détail ne part au client qu'en développement. En production, `err.message`
 * exposerait des informations internes — noms de tables et de colonnes via les
 * contraintes SQLite, chemins de fichiers, paramètres cryptographiques.
 */
export const apiErrorHandler = (
  err: Error & { status?: number; statusCode?: number },
  _req: Request,
  res: Response,
  _next: NextFunction
) => {
  console.error("Erreur API:", err);

  // body-parser (corps JSON trop volumineux ou malformé) attache un vrai
  // code HTTP à l'erreur — sans ce cas, un simple dépassement de taille (ex.
  // upload d'image trop grosse) remontait en 500 "Erreur serveur.", un
  // message trompeur pour un problème purement côté requête.
  const status = err.status ?? err.statusCode;
  if (status && status >= 400 && status < 500) {
    res.status(status).json({ error: status === 413 ? "Fichier trop volumineux." : "Requête invalide." });
    return;
  }

  const body: { error: string; details?: string } = { error: "Erreur serveur." };
  if (process.env.NODE_ENV !== "production") body.details = err.message;

  res.status(500).json(body);
};
