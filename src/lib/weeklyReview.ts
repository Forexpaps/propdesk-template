import { ObjectifHebdo, ObjectifHebdoType, Trade, WeeklyReview } from "../types";
import { startOfWeek } from "./performanceStats";

/**
 * Le rituel de revue : la seule boucle fermée de l'application. Le trader
 * écrit ce qu'il a vu, pose un objectif pour la semaine suivante, et le
 * journal lui dit tout seul, sept jours plus tard, s'il l'a tenu.
 *
 * Module pur : aucune dépendance à React, au réseau ni à `Date.now()` en
 * dehors des valeurs par défaut explicitement passées.
 */

/** Les émotions que l'objectif « aucun trade en émotion » interdit — les deux autres (`Disciplined`, `Calm`) sont précisément celles qu'on vise. */
const EMOTIONS_A_EVITER = ["FOMO", "Impulsive", "Anxious"] as const;

/**
 * Verdict d'un objectif. **Trois états, et le troisième est le plus
 * important.**
 *
 * Sans `non_verifiable`, l'application déclarerait « atteint » par ABSENCE DE
 * PREUVE : « aucun trade en émotion » sur une semaine sans aucun trade serait
 * validé, et le journal récompenserait le fait de ne pas trader. Un objectif
 * qu'on n'a pas eu l'occasion de tenir n'est ni tenu ni manqué.
 */
export type ObjectifVerdict = "atteint" | "manque" | "non_verifiable";

export interface ObjectifEvaluation {
  verdict: ObjectifVerdict;
  /** Constat factuel, nommant ce qui a été mesuré (et sur combien de trades quand ça compte). */
  constat: string;
}

/** Date locale au format YYYY-MM-DD — jamais `toISOString()`, qui bascule en UTC et peut reculer d'un jour. */
function toIsoDay(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Lundi (YYYY-MM-DD) de la semaine contenant `date`. Même découpage que tout le reste de l'app — voir `startOfWeek`. */
export function weekStartOf(date: Date): string {
  return toIsoDay(startOfWeek(date));
}

export function currentWeekStart(reference: Date = new Date()): string {
  return weekStartOf(reference);
}

export function previousWeekStart(reference: Date = new Date()): string {
  const lundi = startOfWeek(reference);
  return toIsoDay(new Date(lundi.getFullYear(), lundi.getMonth(), lundi.getDate() - 7));
}

/** Lundi de la semaine SUIVANTE — cible par défaut d'un objectif : on ne se fixe pas un objectif pour une semaine déjà écoulée. */
export function nextWeekStart(weekStart: string): string {
  const debut = new Date(`${weekStart}T00:00:00`);
  if (Number.isNaN(debut.getTime())) return weekStart;
  return toIsoDay(new Date(debut.getFullYear(), debut.getMonth(), debut.getDate() + 7));
}

/** Id déterministe : réécrire la revue d'une semaine la remplace, ne la duplique jamais. */
export function reviewId(weekStart: string): string {
  return `revue-${weekStart}`;
}

export function findReview(reviews: WeeklyReview[], weekStart: string): WeeklyReview | undefined {
  return reviews.find((r) => r.weekStart === weekStart);
}

/**
 * Trades du lundi (inclus) au dimanche (inclus) de la semaine `weekStart`.
 * Bornes strictes : le dimanche précédent et le lundi suivant sont dehors.
 */
export function tradesDeLaSemaine(trades: Trade[], weekStart: string): Trade[] {
  const debut = new Date(`${weekStart}T00:00:00`);
  if (Number.isNaN(debut.getTime())) return [];
  const fin = new Date(debut.getFullYear(), debut.getMonth(), debut.getDate() + 7);
  return trades.filter((t) => {
    const d = new Date(`${t.date}T00:00:00`);
    if (Number.isNaN(d.getTime())) return false;
    return d >= debut && d < fin;
  });
}

/** « Lundi 9 mars » etc. — pour nommer le jour fautif dans un constat. */
function nommerJour(isoDay: string): string {
  const d = new Date(`${isoDay}T00:00:00`);
  if (Number.isNaN(d.getTime())) return isoDay;
  return d.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" });
}

/** Libellé lisible d'un objectif, pour le formulaire comme pour le bandeau. */
export function describeObjectif(objectif: ObjectifHebdo): string {
  switch (objectif.type) {
    case "max_trades_par_jour":
      return `Pas plus de ${objectif.valeur} trade${objectif.valeur > 1 ? "s" : ""} par jour`;
    case "max_trades_semaine":
      return `Pas plus de ${objectif.valeur} trade${objectif.valeur > 1 ? "s" : ""} sur la semaine`;
    case "aucun_trade_en_emotion":
      return "Aucun trade pris en FOMO, impulsivité ou anxiété";
    case "risque_max_par_trade":
      return `Risque limité à ${objectif.valeur}% par trade`;
    case "aucune_erreur_taguee":
      return "Aucune erreur taguée sur mes trades";
    case "min_jours_traves":
      return `Au moins ${objectif.valeur} jour${objectif.valeur > 1 ? "s" : ""} de trading`;
    case "aucun_trade_hors_plan":
      return "Chaque trade rattaché à un plan de trading";
  }
}

/** Catalogue destiné au formulaire : ce que l'application sait vérifier. */
export const OBJECTIF_CATALOGUE: {
  type: ObjectifHebdoType;
  label: string;
  /** `null` = pas de seuil à saisir. */
  defaut: number | null;
  unite?: string;
}[] = [
  { type: "max_trades_par_jour", label: "Pas plus de N trades par jour", defaut: 2, unite: "trades/jour" },
  { type: "max_trades_semaine", label: "Pas plus de N trades sur la semaine", defaut: 8, unite: "trades" },
  { type: "min_jours_traves", label: "Au moins N jours de trading", defaut: 3, unite: "jours" },
  { type: "risque_max_par_trade", label: "Risque limité à N% par trade", defaut: 1, unite: "%" },
  { type: "aucun_trade_en_emotion", label: "Aucun trade en FOMO / impulsivité / anxiété", defaut: null },
  { type: "aucune_erreur_taguee", label: "Aucune erreur taguée", defaut: null },
  { type: "aucun_trade_hors_plan", label: "Chaque trade rattaché à un plan", defaut: null },
];

/**
 * Juge un objectif sur les trades de SA semaine cible.
 *
 * Ne reçoit que ces trades, jamais tout le journal : aucune logique de date
 * ici, donc rien à tester deux fois. `planIds` sert au seul objectif qui a
 * besoin de savoir quels plans existent encore — un `tradingPlanId` orphelin
 * (plan supprimé) est traité comme « hors plan », exactement comme dans
 * `computePlanComplianceSummary`.
 */
export function evaluerObjectif(
  objectif: ObjectifHebdo,
  tradesDeLaSemaineCible: Trade[],
  planIds: Set<string> = new Set()
): ObjectifEvaluation {
  const trades = tradesDeLaSemaineCible;
  const n = trades.length;

  // Un objectif d'ABSENCE (« pas plus de », « aucun ») est invérifiable sur une
  // semaine sans trade : le valider récompenserait le fait de ne pas trader.
  // `min_jours_traves` est la seule exception — celui-là se mesure justement
  // par l'absence, et une semaine vide le manque pour de bon.
  if (n === 0 && objectif.type !== "min_jours_traves") {
    return { verdict: "non_verifiable", constat: "Aucun trade cette semaine-là : rien à vérifier." };
  }

  switch (objectif.type) {
    case "max_trades_par_jour": {
      const parJour = new Map<string, number>();
      for (const t of trades) parJour.set(t.date, (parJour.get(t.date) ?? 0) + 1);
      const depassements = [...parJour.entries()]
        .filter(([, c]) => c > objectif.valeur)
        .sort((a, b) => b[1] - a[1]);
      if (depassements.length === 0) {
        const jours = parJour.size;
        return {
          verdict: "atteint",
          constat: `Jamais plus de ${objectif.valeur} trade${objectif.valeur > 1 ? "s" : ""} par jour, sur ${jours} jour${jours > 1 ? "s" : ""} tradé${jours > 1 ? "s" : ""}.`,
        };
      }
      const [jour, compte] = depassements[0];
      const reste = depassements.length - 1;
      return {
        verdict: "manque",
        constat:
          `${compte} trades le ${nommerJour(jour)}, au-delà de ${objectif.valeur}` +
          (reste > 0 ? ` (et ${reste} autre${reste > 1 ? "s" : ""} jour${reste > 1 ? "s" : ""} dans ce cas).` : "."),
      };
    }

    case "max_trades_semaine":
      return n <= objectif.valeur
        ? { verdict: "atteint", constat: `${n} trade${n > 1 ? "s" : ""} sur la semaine, pour un plafond de ${objectif.valeur}.` }
        : { verdict: "manque", constat: `${n} trades sur la semaine, au-delà des ${objectif.valeur} visés.` };

    case "min_jours_traves": {
      const jours = new Set(trades.map((t) => t.date)).size;
      return jours >= objectif.valeur
        ? { verdict: "atteint", constat: `${jours} jour${jours > 1 ? "s" : ""} de trading, pour un minimum de ${objectif.valeur}.` }
        : { verdict: "manque", constat: `${jours} jour${jours > 1 ? "s" : ""} de trading seulement, sur les ${objectif.valeur} visés.` };
    }

    case "aucun_trade_en_emotion": {
      const fautifs = trades.filter((t) => (EMOTIONS_A_EVITER as readonly string[]).includes(t.emotion));
      return fautifs.length === 0
        ? { verdict: "atteint", constat: `Les ${n} trade${n > 1 ? "s" : ""} de la semaine sont tagués disciplinés ou calmes.` }
        : {
            verdict: "manque",
            constat: `${fautifs.length} trade${fautifs.length > 1 ? "s" : ""} sur ${n} pris en ${[...new Set(fautifs.map((t) => t.emotion))].join(", ")}.`,
          };
    }

    case "aucune_erreur_taguee": {
      const fautifs = trades.filter((t) => (t.mistakes ?? []).length > 0);
      return fautifs.length === 0
        ? { verdict: "atteint", constat: `Aucune erreur taguée sur les ${n} trade${n > 1 ? "s" : ""} de la semaine.` }
        : { verdict: "manque", constat: `${fautifs.length} trade${fautifs.length > 1 ? "s" : ""} sur ${n} portent au moins une erreur taguée.` };
    }

    case "aucun_trade_hors_plan": {
      const horsPlan = trades.filter((t) => !t.tradingPlanId || !planIds.has(t.tradingPlanId));
      return horsPlan.length === 0
        ? { verdict: "atteint", constat: `Les ${n} trade${n > 1 ? "s" : ""} de la semaine sont rattachés à un plan existant.` }
        : { verdict: "manque", constat: `${horsPlan.length} trade${horsPlan.length > 1 ? "s" : ""} sur ${n} sans plan rattaché (ou dont le plan a été supprimé).` };
    }

    case "risque_max_par_trade": {
      // `riskPercent` est optionnel et le restera : on juge sur les trades qui
      // le renseignent, et on ANNONCE le dénominateur. Aucun renseigné → rien
      // à juger, surtout pas « atteint ».
      const mesures = trades.filter((t) => typeof t.riskPercent === "number");
      if (mesures.length === 0) {
        return {
          verdict: "non_verifiable",
          constat: `Aucun des ${n} trade${n > 1 ? "s" : ""} de la semaine ne renseigne le risque engagé.`,
        };
      }
      // Même epsilon que `checkPlanViolations` : le calculateur de position
      // produit un `0.9999999996` pour un risque de 1 %.
      const depassements = mesures.filter((t) => (t.riskPercent as number) - objectif.valeur > 1e-9);
      const portee = `vérifié sur ${mesures.length} trade${mesures.length > 1 ? "s" : ""} sur ${n}`;
      return depassements.length === 0
        ? { verdict: "atteint", constat: `Aucun dépassement de ${objectif.valeur}% (${portee}).` }
        : {
            verdict: "manque",
            constat: `${depassements.length} trade${depassements.length > 1 ? "s" : ""} au-delà de ${objectif.valeur}% (${portee}).`,
          };
    }
  }
}

/**
 * Semaine dont la revue reste à écrire, ou `null` s'il n'y a rien à proposer.
 *
 * Propose la semaine ÉCOULÉE (pas celle en cours) : un bilan s'écrit sur une
 * semaine terminée. La modale, elle, permet quand même de traiter la semaine
 * courante pour qui fait son point le dimanche soir.
 */
export function revueAProposer(
  reviews: WeeklyReview[],
  trades: Trade[],
  reference: Date = new Date()
): string | null {
  const cible = previousWeekStart(reference);
  if (findReview(reviews, cible)) return null;
  // Ne rien proposer à un journal qui n'a rien à relire : un bandeau
  // « écris ta revue » sur une semaine sans le moindre trade serait une corvée
  // inventée, pas un rituel.
  if (tradesDeLaSemaine(trades, cible).length === 0) return null;
  return cible;
}

/** « du 9 au 15 mars » — bornes inclusives, pour nommer la semaine dans un bouton. */
export function formatSemaine(weekStart: string): string {
  const debut = new Date(`${weekStart}T00:00:00`);
  if (Number.isNaN(debut.getTime())) return weekStart;
  const fin = new Date(debut.getFullYear(), debut.getMonth(), debut.getDate() + 6);
  const memeMois = fin.getMonth() === debut.getMonth();
  const debutTexte = memeMois
    ? String(debut.getDate())
    : debut.toLocaleDateString("fr-FR", { day: "numeric", month: "long" });
  return `du ${debutTexte} au ${fin.toLocaleDateString("fr-FR", { day: "numeric", month: "long" })}`;
}

/** Référence stable pour l'état initial — un `[]` littéral en ferait une valeur neuve à chaque rendu. */
export const EMPTY_WEEKLY_REVIEWS: WeeklyReview[] = [];
