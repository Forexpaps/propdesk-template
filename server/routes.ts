import { Router, type Request, type Response, type NextFunction } from "express";
import fs from "fs";
import path from "path";
import {
  listCollection,
  replaceCollection,
  getProfile,
  saveProfile,
  getQuizResults,
  replaceQuizResults,
  COLLECTION_NAMES,
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
import { requireAuth } from "./auth/middleware";
import { getEconomicCalendar } from "./economicCalendar";
import { getMarketData } from "./marketData";

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
 * Public : donnée non sensible, identique pour tout visiteur, qu'il soit
 * staff ou élève — pas de raison de la coupler à l'un des deux mondes
 * d'authentification.
 */
api.get(
  "/economic-calendar",
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

/** Collections qu'une session élève peut lire/écrire — uniquement son Journal. */
const STUDENT_ALLOWED_COLLECTIONS = new Set<CollectionName>(["trades"]);

/**
 * Payload de démarrage : toutes les collections en un aller-retour, dans les
 * formes exactes attendues par le client.
 *
 * Une session élève ne reçoit que sa collection de trades (+ un profil
 * minimal) — pas les autres collections, même vides : un filtrage franc côté
 * serveur, pas une forme complète à moitié cachée côté client.
 */
api.get("/state", (req, res) => {
  const dataUserId = req.auth!.dataUserId;

  if (req.auth!.kind === "student") {
    res.json({
      bootstrapped: isBootstrapped(),
      student: { name: "", email: "" },
      quizResults: {},
      collections: { trades: listCollection("trades", dataUserId) },
    });
    return;
  }

  res.json({
    bootstrapped: isBootstrapped(),
    student: getProfile(dataUserId),
    quizResults: getQuizResults(dataUserId),
    collections: Object.fromEntries(
      COLLECTION_NAMES.map((name) => [name, listCollection(name, dataUserId)])
    ),
  });
});

/** Collections que seul un administrateur peut écrire. */
const ADMIN_ONLY_COLLECTIONS = new Set<CollectionName>(["enrolledStudents"]);

api.put("/collections/:name", (req, res) => {
  const name = req.params.name as CollectionName;
  if (!COLLECTION_NAMES.includes(name)) {
    res.status(404).json({ error: `Collection inconnue : ${req.params.name}` });
    return;
  }

  // Une session élève ne touche jamais qu'à son propre Journal — ni les
  // collections du bureau staff, ni celles d'un autre élève.
  if (req.auth!.kind === "student" && !STUDENT_ALLOWED_COLLECTIONS.has(name)) {
    res.status(403).json({ error: "Action réservée au staff." });
    return;
  }

  // Les fiches élèves contiennent les notes privées du coach : sans ce contrôle,
  // la protection de la vue côté client ne serait que cosmétique.
  if (ADMIN_ONLY_COLLECTIONS.has(name) && req.auth?.isAdmin !== true) {
    res.status(403).json({ error: "Action réservée à l'administrateur." });
    return;
  }

  const parsed = collectionPayloadSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Collection invalide.", details: parsed.error.issues });
    return;
  }

  replaceCollection(name, parsed.data, req.auth!.dataUserId);
  res.json({ success: true, count: parsed.data.length });
});

api.put("/profile", (req, res) => {
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
  // La clé n'est réintroduite que si elle existait : l'ajouter à `undefined`
  // créerait un champ absent du profil d'origine.
  const profile: Record<string, unknown> = {
    ...parsed.data,
    isAdmin: current?.isAdmin === true,
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

api.put("/quiz-results", (req, res) => {
  // Pas de quiz côté élève dans ce chantier — réservé au bureau staff.
  if (req.auth!.kind === "student") {
    res.status(403).json({ error: "Action réservée au staff." });
    return;
  }

  const parsed = quizResultsSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Résultats de quiz invalides.", details: parsed.error.issues });
    return;
  }

  replaceQuizResults(parsed.data);
  res.json({ success: true });
});

/**
 * Reprise des données qu'un utilisateur avait dans son localStorage avant que
 * la persistance serveur existe. Refusée si la base est déjà amorcée, pour que
 * deux onglets ouverts ne puissent pas réimporter et dupliquer.
 */
api.post("/state/import", (req, res) => {
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

/**
 * Amorce la base avec le jeu de démonstration. Appelé par le client quand il
 * découvre une base vierge et qu'il n'a rien à reprendre de son localStorage.
 */
api.post("/state/seed", (req, res) => {
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

api.get("/download-features-pdf", (_req, res) => {
  const pdfPath = path.join(process.cwd(), "public", "Fonctionnalites_Horizon_SMC.pdf");
  if (fs.existsSync(pdfPath)) {
    res.download(pdfPath, "Fonctionnalites_Horizon_SMC.pdf");
  } else {
    res.status(404).json({ error: "Fichier PDF non trouvé." });
  }
});

/**
 * Gestionnaire d'erreurs : une exception non prévue renvoie un 500 propre.
 *
 * Le détail ne part au client qu'en développement. En production, `err.message`
 * exposerait des informations internes — noms de tables et de colonnes via les
 * contraintes SQLite, chemins de fichiers, paramètres cryptographiques.
 */
export const apiErrorHandler = (
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction
) => {
  console.error("Erreur API:", err);

  const body: { error: string; details?: string } = { error: "Erreur serveur." };
  if (process.env.NODE_ENV !== "production") body.details = err.message;

  res.status(500).json(body);
};
