import React, { useMemo } from "react";
import { Target, NotebookPen } from "lucide-react";
import { Trade, TradingPlanData, WeeklyReview } from "../types";
import {
  currentWeekStart,
  describeObjectif,
  evaluerObjectif,
  formatSemaine,
  previousWeekStart,
  revueAProposer,
  tradesDeLaSemaine,
} from "../lib/weeklyReview";
import { computeWeeklySummary } from "../lib/weeklySummary";

/**
 * La ligne sous « Bonjour X », par ordre de priorité :
 *
 * 1. **Le verdict de l'objectif de la semaine écoulée.** En premier parce que
 *    c'est le seul endroit de l'application où une boucle se referme — et la
 *    seule chose que le trader ne peut pas savoir en regardant son journal.
 * 2. Sinon, la revue à écrire.
 * 3. Sinon, la phrase de `computeWeeklySummary`, qui reste la phrase d'accueil
 *    d'un journal neuf. L'enrichir, jamais la remplacer.
 */

interface WeeklyReviewBannerProps {
  trades: Trade[];
  plans: TradingPlanData;
  reviews: WeeklyReview[];
  onOpenReview: (semaine: string) => void;
}

export const WeeklyReviewBanner: React.FC<WeeklyReviewBannerProps> = ({
  trades,
  plans,
  reviews,
  onOpenReview,
}) => {
  const maintenant = useMemo(() => new Date(), []);
  const semainePrecedente = previousWeekStart(maintenant);
  const semaineCourante = currentWeekStart(maintenant);
  const planIds = useMemo(() => new Set(plans.map((p) => p.id)), [plans]);

  // Objectif qui visait la semaine ÉCOULÉE : celle qu'on peut juger en entier.
  // Un objectif visant la semaine en cours serait jugé sur une semaine
  // incomplète, et son verdict changerait encore jusqu'à dimanche soir.
  const objectifEchu = reviews.map((r) => r.objectif).find((o) => o && o.cibleWeekStart === semainePrecedente);
  const verdict = objectifEchu
    ? evaluerObjectif(objectifEchu, tradesDeLaSemaine(trades, semainePrecedente), planIds)
    : null;

  const aProposer = revueAProposer(reviews, trades, maintenant);

  if (objectifEchu && verdict) {
    const couleur =
      verdict.verdict === "atteint"
        ? "text-[#00E676]"
        : verdict.verdict === "manque"
        ? "text-rose-400"
        : "text-slate-400";
    const mot =
      verdict.verdict === "atteint"
        ? "Objectif tenu"
        : verdict.verdict === "manque"
        ? "Objectif manqué"
        : "Objectif non vérifiable";

    return (
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs sm:text-sm">
        <Target className={`w-4 h-4 shrink-0 ${couleur}`} />
        <span className={`font-bold ${couleur}`}>{mot}</span>
        <span className="text-slate-400">
          {describeObjectif(objectifEchu)}, semaine {formatSemaine(semainePrecedente)}. {verdict.constat}
        </span>
        <button
          onClick={() => onOpenReview(aProposer ?? semaineCourante)}
          className="text-slate-300 hover:text-white underline underline-offset-2 font-medium"
        >
          {aProposer ? "Écrire la revue" : "Ouvrir mes revues"}
        </button>
      </div>
    );
  }

  if (aProposer) {
    return (
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs sm:text-sm">
        <NotebookPen className="w-4 h-4 shrink-0 text-[#00E676]" />
        <span className="text-slate-400">{computeWeeklySummary(trades)}</span>
        <button
          onClick={() => onOpenReview(aProposer)}
          className="text-[#00E676] hover:underline underline-offset-2 font-semibold"
        >
          Écrire la revue {formatSemaine(aProposer)}
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs sm:text-sm">
      <span className="text-slate-400">{computeWeeklySummary(trades)}</span>
      <button
        onClick={() => onOpenReview(semaineCourante)}
        className="text-slate-300 hover:text-white underline underline-offset-2 font-medium"
      >
        Ouvrir mes revues
      </button>
    </div>
  );
};
