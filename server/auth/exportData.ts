import { Router } from "express";
import { listCollection, getQuizResults, getTradingPlan } from "../repositories";
import { buildStudentProfile, getStudentById } from "./studentCredentials";
import { requireStudentKind } from "./middleware";

/** Formes minimales lues depuis les collections — seuls les champs exportés nous intéressent ici. */
interface LessonLike {
  id: string;
  title: string;
  isCompleted: boolean;
}
interface ModuleLike {
  id: string;
  title: string;
  category: string;
  lessons: LessonLike[];
  [key: string]: unknown;
}
interface BadgeLike {
  id: string;
  title: string;
  category: string;
  unlocked: boolean;
  unlockedAt?: string;
  rewardXP?: number;
  [key: string]: unknown;
}
interface QuizResultLike {
  scorePercentage: number;
  totalQuestions: number;
  correctAnswers: number;
  passed: boolean;
  completedAt: string;
}

/**
 * Rassemble les données personnelles d'un élève pour l'export RGPD (Article
 * 20, droit à la portabilité) — limité à ce qui existe réellement dans ce
 * schéma (voir `server/db.ts`) : ni paiements ni logs d'accès, ce projet n'a
 * jamais eu ces modules.
 *
 * `null` si le compte n'existe plus (ne devrait pas arriver : appelé
 * uniquement depuis une route déjà protégée par `requireStudentKind`, qui a
 * donc déjà une session valide, mais un compte peut en théorie être
 * supprimé entre la validation de la session et cet appel).
 */
function collectStudentExport(studentAccountId: string): Record<string, unknown> | null {
  const account = getStudentById(studentAccountId);
  if (!account) return null;

  const profile = buildStudentProfile(studentAccountId);
  const modules = listCollection<ModuleLike>("modules", account.userId);
  const quizResults = getQuizResults<QuizResultLike>(account.userId);
  const badges = listCollection<BadgeLike>("badges", account.userId);
  const tradingPlan = getTradingPlan(account.userId);

  return {
    exportedAt: new Date().toISOString(),
    compte: {
      id: account.id,
      email: account.email,
    },
    profil: profile,
    planDeTrading: tradingPlan,
    progressionModules: modules.map((m) => ({
      id: m.id,
      titre: m.title,
      categorie: m.category,
      leconsTerminees: m.lessons.filter((l) => l.isCompleted).length,
      leconsTotal: m.lessons.length,
      resultatQuiz: quizResults[m.id] ?? null,
    })),
    badgesObtenus: badges
      .filter((b) => b.unlocked)
      .map((b) => ({
        id: b.id,
        titre: b.title,
        categorie: b.category,
        debloqueLe: b.unlockedAt ?? null,
        xpGagne: b.rewardXP ?? 0,
      })),
  };
}

/**
 * `GET /auth/export` — télécharge les données personnelles de l'élève
 * connecté au format JSON, immédiatement (pas de délai de traitement à
 * respecter : l'Article 20 impose un maximum d'un mois, ce endpoint répond
 * en un aller-retour).
 *
 * Monté sur `studentProtectedRouter` — voir `studentRoutes.ts`, en bas de
 * fichier après `PUT /trading-plan`. Aucune route équivalente côté staff :
 * ces données appartiennent à l'élève, lui seul peut les exporter.
 */
export function addStudentExportRoute(router: Router): void {
  router.get("/export", requireStudentKind, (req, res) => {
    const data = collectStudentExport(req.auth!.userId);
    if (!data) {
      res.status(404).json({ error: "Compte introuvable." });
      return;
    }

    res.setHeader("Content-Type", "application/json");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="propdesk-export-${new Date().toISOString().split("T")[0]}.json"`
    );
    res.json(data);
  });
}
