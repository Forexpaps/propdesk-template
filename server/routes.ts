import { Router, type Request, type Response, type NextFunction } from "express";
import fs from "fs";
import path from "path";
import { GoogleGenAI } from "@google/genai";
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
  coachReviewSchema,
} from "./schemas";
import { createRateLimit } from "./middleware/rateLimit";
import { authRouter, staffRouter } from "./auth/routes";
import { requireAuth } from "./auth/middleware";

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

// Monté ici et non avec `authRouter` plus haut : ces routes (invitation,
// liste, suppression, changement de mot de passe) exigent une session
// valide, donc doivent passer APRÈS la barrière. `req.path` y vaut
// "/auth/staff" et "/auth/change-password", cohérent avec les chemins
// écrits en dur dans `server/auth/middleware.ts`.
api.use("/auth", staffRouter);

/**
 * Payload de démarrage : toutes les collections en un aller-retour, dans les
 * formes exactes attendues par le client.
 */
api.get("/state", (_req, res) => {
  res.json({
    bootstrapped: isBootstrapped(),
    student: getProfile(),
    quizResults: getQuizResults(),
    collections: Object.fromEntries(
      COLLECTION_NAMES.map((name) => [name, listCollection(name)])
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

  replaceCollection(name, parsed.data);
  res.json({ success: true, count: parsed.data.length });
});

api.put("/profile", (req, res) => {
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
  const current = getProfile<{ isAdmin?: boolean }>();

  saveProfile({ ...parsed.data, isAdmin: current?.isAdmin === true });
  res.json({ success: true });
});

api.put("/quiz-results", (req, res) => {
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
api.post("/state/seed", (_req, res) => {
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

// --- Coach IA (Gemini) ---------------------------------------------------

const getAiClient = () => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY non disponible sur le serveur.");
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: { headers: { "User-Agent": "aistudio-build" } },
  });
};

/**
 * C'est la seule route qui appelle un service facturé à l'appel : elle ne doit
 * pas pouvoir être martelée. Comportement identique à avant l'extraction du
 * limiteur dans son propre module.
 */
const aiRateLimit = createRateLimit({
  windowMs: 60_000,
  max: 10,
  message: "Trop de demandes d'audit IA. Réessayez dans une minute.",
});

api.post(
  "/coach/ai-review",
  aiRateLimit,
  wrap(async (req, res) => {
    const parsed = coachReviewSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Données insuffisantes", details: parsed.error.issues });
      return;
    }

    const { trade, question } = parsed.data as {
      trade?: Record<string, unknown>;
      question?: string;
    };

    let prompt = "";
    if (trade) {
      prompt = `
Vous êtes le Master Coach Senior de l'Académie de Trading "Horizon".
Effectuez un audit clinique, pédagogique et motivant du trade suivant soumis par un élève:

- Actif / Paire: ${trade.pair || "Non spécifié"}
- Direction: ${trade.direction || "Long/Short"}
- Prix Entrée: ${trade.entryPrice}
- Stop Loss: ${trade.stopLoss}
- Take Profit: ${trade.takeProfit}
- Prix Sortie: ${trade.exitPrice || "En cours"}
- Résultat PnL (€): ${trade.pnl} (€)
- Stratégie / Setup: ${trade.strategy || "Analyse technique"}
- État émotionnel / Émotion lors de la prise de position: ${trade.emotion || "Neutre"}
- Notes de l'élève: ${trade.notes || "Aucune note"}

Fournissez une analyse complète au format JSON strict avec les clés suivantes:
- technicalScore (nombre de 1 à 10)
- riskScore (nombre de 1 à 10)
- disciplineScore (nombre de 1 à 10)
- diagnosis (résumé en 1 phrase percutante)
- strengths (tableau de 2-3 points forts du trade)
- improvements (tableau de 2-3 points à corriger ou axes d'amélioration)
- coachFeedback (conseil détaillé et bienveillant de 3-4 paragraphes en français, faisant référence au Money Management, au R:R ratio, et au contrôle émotionnel).
`;
    } else {
      prompt = `
Vous êtes le Head Trading Coach de l'Académie Horizon.
Un élève vous pose la question suivante dans la messagerie de l'académie:

"${question}"

Répondez de manière structurée, professionnelle et pédagogique en français avec des conseils pratiques applicables directement sur le marché (gestion des risques, psychologie, analyse technique SMC & Price Action).
Fournissez le résultat au format JSON strict:
{
  "coachFeedback": "Votre réponse détaillée ici avec des puces et des exemples concréts",
  "recommendedModule": "Nom ou sujet du module de cours recommandé dans l'académie (ex: Gestion du Risque & Money Management, Smart Money Concepts, Masterclass Psychologie)"
}
`;
    }

    const ai = getAiClient();
    const response = await ai.models.generateContent({
      model: "gemini-3.6-flash",
      contents: prompt,
      config: { responseMimeType: "application/json" },
    });

    res.json({ success: true, data: JSON.parse(response.text || "{}") });
  })
);

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
