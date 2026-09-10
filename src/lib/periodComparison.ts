import { Trade } from "../types";
import { isRealizedDollarTrade, startOfWeek } from "./performanceStats";

/**
 * Comparaison période sur période — la seule partie de l'application qui
 * répond à « est-ce que je progresse ? ». Tout le reste cumule depuis le
 * premier trade et ne peut donc rien dire d'une tendance.
 *
 * Volontairement dans son propre fichier plutôt que dans `performanceStats.ts`
 * (850 lignes) : DÉCRIRE une fenêtre et COMPARER deux fenêtres sont deux
 * préoccupations distinctes. `startOfWeek` est en revanche importée de là-bas,
 * jamais réécrite — deux découpages de semaine sur le même écran est
 * exactement le genre de divergence silencieuse que ce projet a déjà payée.
 *
 * Tous les pièges d'interprétation sont traités ICI, pas laissés au composant :
 * un `null` bien placé vaut mieux qu'un « +∞ % » affiché avec aplomb.
 */

/** En dessous, un écart de taux n'est pas un signal — c'est du bruit d'échantillon. */
export const MIN_ECHANTILLON_COMPARAISON = 5;

export type Granularite = "week" | "month";

/** Fenêtre calendaire, `fin` EXCLUE (minuit du jour suivant la période). */
export interface PeriodWindow {
  debut: Date;
  fin: Date;
}

export interface MetricComparison {
  /** `null` = non mesurable sur la période (pas « zéro »). */
  courant: number | null;
  precedent: number | null;
  /** `courant - precedent`, `null` dès qu'un des deux est `null`. */
  delta: number | null;
  /**
   * `null` partout où une division serait trompeuse — voir `buildMetric`.
   * N'est JAMAIS renseigné pour le PnL ni pour les taux (win rate, discipline,
   * respect du plan), qui se lisent en points.
   */
  variationPercent: number | null;
  /**
   * `false` quand un des deux côtés compte moins de
   * `MIN_ECHANTILLON_COMPARAISON` trades. La valeur reste affichée — c'est le
   * VERDICT qu'on suspend, pas la donnée.
   */
  fiable: boolean;
}

export interface PeriodComparison {
  granularite: Granularite;
  courant: PeriodWindow;
  precedent: PeriodWindow;
  /** Vrai quand la période précédente ne contient aucun trade : l'UI affiche une ligne unique plutôt que six comparaisons vides. */
  precedentVide: boolean;
  pnl: MetricComparison;
  winRate: MetricComparison;
  tradesCount: MetricComparison;
  avgRR: MetricComparison;
  disciplineEmotionnelle: MetricComparison;
  /**
   * Part des trades de la période conformes à leur plan, en %.
   * `null` des deux côtés tant que `violationsParTrade` n'est pas fourni —
   * la conformité n'est pas calculable ici, elle vient de `planCompliance.ts`.
   */
  respectDuPlan: MetricComparison;
}

/**
 * Bornes de la période contenant `reference`, et de celle qui la précède.
 *
 * Mois CALENDAIRES, jamais normalisés par jour : comparer février à janvier en
 * ramenant les deux à 30 jours produirait des chiffres que l'utilisateur ne
 * peut recouper avec aucun relevé. `new Date(y, m - 1, 1)` gère janvier →
 * décembre de l'année précédente sans arithmétique manuelle.
 */
export function periodWindows(
  granularite: Granularite,
  reference: Date
): { courant: PeriodWindow; precedent: PeriodWindow } {
  if (granularite === "week") {
    const debut = startOfWeek(reference);
    const fin = new Date(debut.getFullYear(), debut.getMonth(), debut.getDate() + 7);
    const debutPrecedent = new Date(debut.getFullYear(), debut.getMonth(), debut.getDate() - 7);
    return {
      courant: { debut, fin },
      precedent: { debut: debutPrecedent, fin: debut },
    };
  }
  const debut = new Date(reference.getFullYear(), reference.getMonth(), 1);
  const fin = new Date(reference.getFullYear(), reference.getMonth() + 1, 1);
  const debutPrecedent = new Date(reference.getFullYear(), reference.getMonth() - 1, 1);
  return {
    courant: { debut, fin },
    precedent: { debut: debutPrecedent, fin: debut },
  };
}

/**
 * Trades dont la date d'ENTRÉE tombe dans la fenêtre — même convention que
 * `computePnlByPeriod` : un trade appartient à la période où il a été pris,
 * pas à celle où il a été clôturé. Date invalide → écarté, jamais rangé à une
 * date de repli.
 */
function tradesDansFenetre(trades: Trade[], fenetre: PeriodWindow): Trade[] {
  return trades.filter((t) => {
    const d = new Date(`${t.date}T00:00:00`);
    if (Number.isNaN(d.getTime())) return false;
    return d >= fenetre.debut && d < fenetre.fin;
  });
}

/**
 * Assemble une métrique et décide seule de ce qui est publiable.
 *
 * `avecPourcentage` est refusé pour le PnL et pour tous les taux :
 * - PnL : −100 $ → +150 $ donnerait « +250 % » ou « −250 % » selon le signe
 *   pris au dénominateur. Les deux sont défendables, donc aucun ne vaut rien.
 * - taux : la variation d'un pourcentage se lit en POINTS ; « +20 % » pour un
 *   win rate passé de 40 % à 48 % serait lu comme « 48 % de plus ».
 */
function buildMetric(
  courant: number | null,
  precedent: number | null,
  fiable: boolean,
  avecPourcentage: boolean
): MetricComparison {
  const delta = courant !== null && precedent !== null ? courant - precedent : null;
  const variationPercent =
    avecPourcentage && delta !== null && precedent !== null && precedent !== 0
      ? (delta / Math.abs(precedent)) * 100
      : null;
  return { courant, precedent, delta, variationPercent, fiable };
}

interface MesuresPeriode {
  pnl: number;
  tradesCount: number;
  winRate: number | null;
  avgRR: number | null;
  discipline: number | null;
  respectPlan: number | null;
}

function mesurer(trades: Trade[], violationsParTrade?: Map<string, unknown[]>): MesuresPeriode {
  const tradesCount = trades.length;
  const pnl = trades.filter(isRealizedDollarTrade).reduce((acc, t) => acc + t.pnl, 0);

  // BREAKEVEN et OPEN hors dénominateur, comme partout ailleurs. `null` et non
  // 0 quand rien n'est décidé : « 0 % de réussite » et « aucun trade tranché »
  // ne doivent pas se ressembler à l'écran.
  const wins = trades.filter((t) => t.result === "WIN").length;
  const losses = trades.filter((t) => t.result === "LOSS").length;
  const decides = wins + losses;
  const winRate = decides > 0 ? Math.round((wins / decides) * 100) : null;

  // Moyenne sur TOUS les trades de la période, y compris ceux à RR 0 — même
  // convention que la carte « RR MOYEN » du tableau de bord
  // (`computeJournalSummary`). Filtrer les zéros ici donnerait deux RR moyens
  // différents sur deux écrans du même logiciel.
  const avgRR = tradesCount > 0 ? trades.reduce((acc, t) => acc + t.riskRewardRatio, 0) / tradesCount : null;

  const discipline =
    tradesCount > 0
      ? Math.round(
          (trades.filter((t) => t.emotion === "Disciplined" || t.emotion === "Calm").length / tradesCount) * 100
        )
      : null;

  // Conformité au plan : seuls les trades RATTACHÉS à un plan entrent au
  // dénominateur. Un trade hors plan n'est ni conforme ni fautif — le compter
  // comme respectueux gonflerait le taux à chaque trade non rattaché.
  let respectPlan: number | null = null;
  if (violationsParTrade) {
    const evalues = trades.filter((t) => violationsParTrade.has(t.id));
    if (evalues.length > 0) {
      const conformes = evalues.filter((t) => (violationsParTrade.get(t.id) ?? []).length === 0).length;
      respectPlan = Math.round((conformes / evalues.length) * 100);
    }
  }

  return { pnl, tradesCount, winRate, avgRR, discipline, respectPlan };
}

/**
 * Compare la période contenant `reference` à celle qui la précède
 * immédiatement.
 *
 * `violationsParTrade` (optionnel) associe un id de trade à ses violations de
 * plan — une clé PRÉSENTE avec un tableau vide signifie « évalué et conforme »,
 * une clé ABSENTE signifie « non évaluable » (aucun plan rattaché). Fourni par
 * `computePlanComplianceSummary` pour éviter une seconde passe d'évaluation.
 */
export function computePeriodComparison(
  trades: Trade[],
  granularite: Granularite,
  reference: Date = new Date(),
  violationsParTrade?: Map<string, unknown[]>
): PeriodComparison {
  const { courant, precedent } = periodWindows(granularite, reference);
  const tradesCourant = tradesDansFenetre(trades, courant);
  const tradesPrecedent = tradesDansFenetre(trades, precedent);

  const a = mesurer(tradesCourant, violationsParTrade);
  const b = mesurer(tradesPrecedent, violationsParTrade);

  // Un taux ne devient un verdict qu'à partir de 5 trades DES DEUX CÔTÉS —
  // même seuil que partout dans l'application. Le PnL et le nombre de trades
  // sont des sommes de faits : toujours fiables, quel que soit l'échantillon.
  const fiable = a.tradesCount >= MIN_ECHANTILLON_COMPARAISON && b.tradesCount >= MIN_ECHANTILLON_COMPARAISON;

  return {
    granularite,
    courant,
    precedent,
    precedentVide: b.tradesCount === 0,
    pnl: buildMetric(a.pnl, b.pnl, true, false),
    winRate: buildMetric(a.winRate, b.winRate, fiable, false),
    tradesCount: buildMetric(a.tradesCount, b.tradesCount, true, false),
    avgRR: buildMetric(a.avgRR, b.avgRR, fiable, true),
    disciplineEmotionnelle: buildMetric(a.discipline, b.discipline, fiable, false),
    respectDuPlan: buildMetric(a.respectPlan, b.respectPlan, fiable, false),
  };
}

/** « 9 – 15 mars » / « mars 2026 » — sans ces bornes, « la semaine dernière » est ambigu. */
export function formatPeriodWindow(fenetre: PeriodWindow, granularite: Granularite): string {
  if (granularite === "month") {
    return fenetre.debut.toLocaleDateString("fr-FR", { month: "long", year: "numeric" });
  }
  // `fin` est exclue : le dernier jour affiché est la veille.
  const dernier = new Date(fenetre.fin.getFullYear(), fenetre.fin.getMonth(), fenetre.fin.getDate() - 1);
  const memeMois = dernier.getMonth() === fenetre.debut.getMonth();
  const debutTexte = memeMois
    ? String(fenetre.debut.getDate())
    : fenetre.debut.toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
  const finTexte = dernier.toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
  return `${debutTexte} – ${finTexte}`;
}
