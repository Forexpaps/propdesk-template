import { Router, type Request, type Response, type NextFunction } from "express";
import {
  listCollection,
  replaceCollection,
  getProfile,
  saveProfile,
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
  importStateSchema,
} from "./schemas";
import { authRouter, staffRouter } from "./auth/routes";
import { requireAuth, type AuthContext } from "./auth/middleware";
import { createRateLimit } from "./middleware/rateLimit";
import { getEconomicCalendar } from "./economicCalendar";
import { getMarketData } from "./marketData";
import { DEFAULT_USER_ID } from "./db";
// Catalogue fixe des badges — données pures (aucune dépendance React/DOM),
// voir le commentaire de `backfillMissingBadges` plus bas pour pourquoi le
// serveur en a besoin.
import { initialTraderBadges } from "../src/data/mockData";

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

/** Public : donnée non sensible, identique pour tout visiteur. */
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
 */
api.use(requireAuth);

// Montée ici et non avec le routeur public plus haut : ces routes exigent une
// session valide, donc doivent passer APRÈS la barrière.
api.use("/auth", staffRouter);

/**
 * Garantit une ligne `users` pour le bureau de données — utile seulement sur
 * une base migrée depuis un état antérieur ; sur une base neuve, `/auth/setup`
 * l'a déjà créée.
 */
function ensurePersonalUserRow(userId: string): void {
  if (getProfile(userId) !== null) return;
  saveProfile(
    {
      name: "Utilisateur",
      email: "",
      avatar: "",
      level: "Trader",
      joinedDate: new Date().toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" }),
      startingCapital: 10000,
      currentCapital: 10000,
      isAdmin: true,
    },
    userId
  );
}

/**
 * Rattrape les badges MANQUANTS par rapport au catalogue `initialTraderBadges`
 * — pas seulement quand la collection est totalement vide (`length === 0`) :
 * un ajout de nouveaux badges au catalogue doit aussi atteindre un compte déjà
 * peuplé. Idempotent — sans effet une fois que chaque badge du catalogue a sa
 * copie.
 */
function backfillMissingBadges(dataUserId: string): void {
  const existing = listCollection<{ id: string; [key: string]: unknown }>("badges", dataUserId);
  const isAlreadyPresent = (definitionId: string) => existing.some((b) => b.id === definitionId);

  const missingDefinitions = initialTraderBadges.filter((def) => !isAlreadyPresent(def.id));
  if (missingDefinitions.length === 0) return;

  replaceCollection("badges", [...existing, ...missingDefinitions.map((def) => ({ ...def }))], dataUserId);
}

/**
 * Resynchronise les badges DÉJÀ présents avec le catalogue actuel
 * (`initialTraderBadges`) — `backfillMissingBadges` n'AJOUTE que les badges
 * manquants, il ne met jamais à jour ceux déjà stockés. Sans cette fonction,
 * changer un `rewardXP` ou une description dans `src/data/mockData.ts`
 * resterait invisible : la copie déjà en base garderait ses anciennes
 * valeurs indéfiniment.
 *
 * `unlocked`/`unlockedAt` sont volontairement EXCLUS de la resynchronisation
 * — ce sont des états réclamés par l'utilisateur (`onClaimBadge`), jamais une
 * convention du catalogue. Les resynchroniser écraserait la progression déjà
 * acquise d'un compte (le fondateur actuel en a plusieurs) à chaque
 * changement du catalogue.
 */
function syncBadgeCatalog(dataUserId: string): void {
  const existing = listCollection<{ id: string; unlocked?: boolean; unlockedAt?: string; [key: string]: unknown }>(
    "badges",
    dataUserId
  );
  const byId = new Map(initialTraderBadges.map((def) => [def.id, def]));

  let changed = false;
  const next = existing.map((badge) => {
    const def = byId.get(badge.id);
    if (!def) return badge;
    const synced = { ...def, unlocked: badge.unlocked, unlockedAt: badge.unlockedAt };
    if (JSON.stringify(synced) === JSON.stringify(badge)) return badge;
    changed = true;
    return synced;
  });

  if (changed) replaceCollection("badges", next, dataUserId);
}

/** Payload de démarrage : toutes les collections en un aller-retour, dans les formes exactes attendues par le client. */
api.get("/state", (req, res) => {
  const dataUserId = req.auth!.dataUserId;

  ensurePersonalUserRow(dataUserId);
  backfillMissingBadges(dataUserId);
  syncBadgeCatalog(dataUserId);

  const collections = Object.fromEntries(
    COLLECTION_NAMES.map((name) => {
      const collection = listCollection(name, dataUserId);
      // Collection initialement vide (badges) : retourner undefined pour que
      // le client tombe sur le fallback (mockData) au démarrage. Les autres
      // collections (trades, accounts, etc.) retournent l'array même s'il
      // est vide — c'est l'état correct.
      if (collection.length === 0 && name === "badges") {
        return [name, undefined];
      }
      return [name, collection];
    })
  );

  res.json({
    bootstrapped: isBootstrapped(),
    student: (() => {
      const profile = getProfile<Record<string, unknown>>(dataUserId);
      return profile ? { ...profile, isAdmin: true } : null;
    })(),
    collections,
    versions: Object.fromEntries(COLLECTION_NAMES.map((name) => [name, getCollectionVersion(name, dataUserId)])),
  });
});

const collectionsRateLimit = createRateLimit({
  windowMs: 15 * 60_000,
  max: 60,
  message: "Trop d'écritures à la base de données. Réessaie dans quelques minutes.",
});

/**
 * Cœur de l'écriture d'une collection, partagé par `PUT /collections/:name`
 * ET par la restauration de sauvegarde (`POST /state/restore`) — jamais
 * dupliqué, pour que les deux chemins appliquent exactement les mêmes règles.
 */
function writeCollectionForAuth(
  auth: AuthContext,
  name: CollectionName,
  rawPayload: unknown,
  /**
   * Version lue par l'appelant à son dernier chargement — `undefined`
   * désactive la vérification (restauration de sauvegarde : toujours
   * autoritaire, jamais un client concurrent).
   */
  expectedVersion?: number
): { ok: true; count: number; version: number } | { ok: false; status: number; error: string } {
  const parsed = collectionPayloadSchema.safeParse(rawPayload);
  if (!parsed.success) {
    return { ok: false, status: 400, error: "Collection invalide." };
  }

  const dataToWrite = parsed.data;

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
      // Un autre onglet a écrit cette collection entre le chargement de
      // CETTE session et maintenant — rien n'a été écrit, pour ne pas
      // écraser cette autre modification.
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
  const parsed = profileSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Profil invalide.", details: parsed.error.issues });
    return;
  }

  // Forcé à `true`, jamais redérivé d'une valeur lue en base — cette instance
  // n'a qu'un seul compte, avec tous les droits.
  const profile: Record<string, unknown> = {
    ...parsed.data,
    isAdmin: true,
  };

  saveProfile(profile, req.auth!.dataUserId);
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
api.post("/state/seed", stateSeedRateLimit, (_req, res) => {
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
 * Sauvegarde » du profil) — remplace le profil et les collections du bureau
 * de l'appelant. Contrairement à `/state/import` (réservée au tout premier
 * amorçage, voir plus haut), fonctionne à tout moment sur une base déjà en
 * service.
 *
 * Chaque collection passe par `writeCollectionForAuth`, exactement comme un
 * `PUT /collections/:name` normal. Une collection inconnue, refusée ou
 * invalide est simplement ignorée (renvoyée dans `skipped`) plutôt que de
 * bloquer toute la restauration — un fichier partiellement corrompu ou
 * modifié à la main ne doit pas empêcher de récupérer le reste.
 */
api.post("/state/restore", stateRestoreRateLimit, (req, res) => {
  const auth = req.auth!;

  const parsed = importStateSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Fichier de sauvegarde invalide.", details: parsed.error.issues });
    return;
  }
  const imported: string[] = [];
  const skipped: string[] = [];

  if (parsed.data.student) {
    saveProfile(parsed.data.student, auth.dataUserId);
    imported.push("student");
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
