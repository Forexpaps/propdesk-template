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
import { createRateLimit } from "./middleware/rateLimit";
import { getEconomicCalendar } from "./economicCalendar";
import { getMarketData } from "./marketData";
import { buildStudentProfile, getStudentByEnrolledId } from "./auth/studentCredentials";
import { DEFAULT_USER_ID, FOUNDER_COACH_ID } from "./db";
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
 * Profil du bureau staff partagé, `isAdmin` toujours forcé à `true`.
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
function buildStaffProfile(dataUserId: string): Record<string, unknown> | null {
  const profile = getProfile<Record<string, unknown>>(dataUserId);
  if (!profile) return null;
  return { ...profile, isAdmin: true };
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
 * `asStaff` distingue les deux règles d'id/état déjà en vigueur ailleurs
 * (voir `server/auth/routes.ts`) :
 * - bureau staff (`DEFAULT_USER_ID`) : id du catalogue tel quel
 *   (`badge-N`), état copié tel quel — décision explicite du fondateur que
 *   SON profil a tout de débloqué (voir le commentaire en tête de
 *   `initialTraderBadges`).
 * - élève : id préfixé (`${dataUserId}-badge-N`), toujours reposé
 *   verrouillé — jamais un faux badge déjà débloqué.
 */
function backfillMissingBadges(dataUserId: string, asStaff: boolean): void {
  const existing = listCollection<{ id: string; [key: string]: unknown }>("badges", dataUserId);
  const isAlreadyPresent = (definitionId: string) =>
    asStaff
      ? existing.some((b) => b.id === definitionId)
      : existing.some((b) => b.id.endsWith(`-${definitionId}`));

  const missingDefinitions = initialTraderBadges.filter((def) => !isAlreadyPresent(def.id));
  if (missingDefinitions.length === 0) return;

  const newEntries = missingDefinitions.map((def) =>
    asStaff
      ? { ...def }
      : { ...def, id: `${dataUserId}-${def.id}`, unlocked: false, unlockedAt: undefined }
  );
  replaceCollection("badges", [...existing, ...newEntries], dataUserId);
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

  backfillMissingBadges(dataUserId, true);

  const collections = Object.fromEntries(
    COLLECTION_NAMES.map((name) => {
      const collection = listCollection(name, dataUserId);
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
    student: buildStaffProfile(dataUserId),
    quizResults: getQuizResults(dataUserId),
    announcements: getAnnouncements() ?? [],
    collections,
    versions: Object.fromEntries(
      COLLECTION_NAMES.map((name) => [name, getCollectionVersion(name, dataUserId)])
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

  // Repéré en audit : cette branche ne peut aujourd'hui jamais se déclencher
  // — un élève est déjà arrêté juste au-dessus (`STUDENT_ALLOWED_COLLECTIONS`
  // n'inclut pas `enrolledStudents`), et tout compte staff a `isAdmin: true`
  // forcé (`buildStaffProfile`, `tryStaffAuth` ci-dessous) : "tous les
  // comptes staff ont les mêmes droits" est le principe actuel du projet
  // (voir HANDOFF.md). Gardée telle quelle en défense en profondeur pour le
  // jour où des rôles staff différenciés seraient réintroduits — mais elle
  // n'offre aucune protection réelle tant que ce jour n'est pas arrivé,
  // contrairement à ce que suggérait l'ancien commentaire de cette ligne.
  if (ADMIN_ONLY_COLLECTIONS.has(name) && auth.isAdmin !== true) {
    return { ok: false, status: 403, error: "Action réservée à l'administrateur." };
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
      auth.dataUserId
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
    newVersion = replaceCollection(name, dataToWrite, auth.dataUserId, expectedVersion);
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

  // Second verrou sur `isAdmin`. Le schéma a déjà retiré la clé du corps ; ici on
  // réinjecte la valeur autoritative lue en base. Les deux sont utiles : le
  // schéma protège cette route, cette ligne protège l'invariant même si une
  // future route oublie le schéma — et elle empêche aussi qu'un client qui ne
  // renvoie pas le champ ne l'effface.
  const current = getProfile<{
    isAdmin?: boolean;
    hiddenSidebarItems?: unknown;
  }>();

  // Seul le compte fondateur règle les entrées masquées de la sidebar.
  //
  // La valeur en base est **réinjectée** pour un coach, elle n'est pas rejetée :
  // `hiddenSidebarItems` voyage dans le même objet que le nom, l'avatar ou le
  // capital, tous légitimement modifiables par un coach. Un 403 sur la requête
  // entière lui interdirait de changer son propre profil à cause d'un champ
  // qu'il n'a même pas touché — le client renvoie fidèlement l'objet reçu.
  //
  // Forcé à `true`, jamais redérivé de `current?.isAdmin` : cette route a
  // déjà rejeté toute session non-staff plus haut (ligne 356), et tout compte
  // staff a `isAdmin: true` par invariant (voir `buildStaffProfile`, plus
  // bas dans ce fichier — même règle, même raison). `current?.isAdmin ===
  // true` semblait équivalent mais ne l'était pas : sur une base migrée
  // avant l'ajout de ce champ, `current.isAdmin` vaut `false`/absent, et
  // cette ligne écrivait alors `isAdmin: false` en base — une valeur que
  // plus rien ne corrigeait ensuite, puisque chaque futur PUT la relisait
  // pour la réécrire à l'identique. `buildStaffProfile` masquait le symptôme
  // en la forçant à `true` en lecture, mais la valeur stockée restait fausse.
  const profile: Record<string, unknown> = {
    ...parsed.data,
    isAdmin: true,
  };

  if (req.auth?.isOwner !== true) {
    if (current && "hiddenSidebarItems" in current) {
      profile.hiddenSidebarItems = current.hiddenSidebarItems;
    } else {
      delete profile.hiddenSidebarItems;
    }
  }

  saveProfile(profile);
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
  const parsed = importStateSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Fichier de sauvegarde invalide.", details: parsed.error.issues });
    return;
  }

  const auth = req.auth!;
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
      saveProfile(parsed.data.student, auth.dataUserId);
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
