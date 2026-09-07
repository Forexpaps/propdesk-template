import React, { useState } from "react";
import { Trade } from "../types";
import { formatCurrency } from "../lib/format";
import {
  computePeriodComparison,
  formatPeriodWindow,
  Granularite,
  MetricComparison,
  MIN_ECHANTILLON_COMPARAISON,
} from "../lib/periodComparison";

/**
 * « Est-ce que je progresse ? » — la comparaison de la période en cours à la
 * précédente. Tout le raisonnement (bornes, `null`, seuils) vit dans
 * `src/lib/periodComparison.ts` : ce fichier ne fait que choisir les mots.
 *
 * Aucun import de `recharts` : ce composant est monté dans `MainDashboard`,
 * qui charge sa courbe d'équité paresseusement. Un import statique de recharts
 * ici ramènerait ses 327 ko dans le bundle de démarrage.
 */

interface PeriodComparisonCardProps {
  trades: Trade[];
  /** Violations par trade (`planCompliance`) — active la ligne « Respect du plan » quand fourni. */
  violationsParTrade?: Map<string, unknown[]>;
}

type Sens = "positif" | "negatif" | "neutre";

interface LigneMetrique {
  label: string;
  metric: MetricComparison;
  /** Rendu d'une valeur brute (`courant`/`precedent`). */
  render: (v: number) => string;
  /** Rendu de l'écart. Le win rate se lit en POINTS, jamais en « % ». */
  renderDelta: (v: number) => string;
  /**
   * `"neutre"` = jamais coloré. Le nombre de trades en fait partie : peindre
   * « +8 trades » en vert récompenserait l'over-trading, qui est précisément
   * un des tags d'erreur du journal.
   */
  sens: Sens;
}

const signe = (v: number) => (v > 0 ? "+" : "");

function couleurDelta(delta: number, sens: Sens, fiable: boolean): string {
  if (sens === "neutre") return "text-slate-300";
  // Écart mesuré sur trop peu de trades : affiché, mais jamais peint en verdict.
  if (!fiable) return "text-slate-500";
  if (delta === 0) return "text-slate-300";
  return delta > 0 ? "text-[#00E676]" : "text-rose-400";
}

export const PeriodComparisonCard: React.FC<PeriodComparisonCardProps> = ({
  trades,
  violationsParTrade,
}) => {
  const [granularite, setGranularite] = useState<Granularite>("week");
  const c = computePeriodComparison(trades, granularite, new Date(), violationsParTrade);

  const motPeriode = granularite === "week" ? "semaine" : "mois";
  const pct = (v: number) => `${Math.round(v)}%`;
  const pts = (v: number) => `${signe(v)}${Math.round(v)} pts`;

  const lignes: LigneMetrique[] = [
    {
      label: "PnL",
      metric: c.pnl,
      render: (v) => `${signe(v)}${formatCurrency(v)}`,
      renderDelta: (v) => `${signe(v)}${formatCurrency(v)}`,
      sens: "positif",
    },
    {
      label: "Win rate",
      metric: c.winRate,
      render: pct,
      renderDelta: pts,
      sens: "positif",
    },
    {
      label: "Trades",
      metric: c.tradesCount,
      render: (v) => String(v),
      renderDelta: (v) => `${signe(v)}${v}`,
      sens: "neutre",
    },
    {
      label: "RR moyen",
      metric: c.avgRR,
      render: (v) => `1:${v.toFixed(1)}`,
      renderDelta: (v) => `${signe(v)}${v.toFixed(1)}`,
      sens: "positif",
    },
    {
      label: "Discipline",
      metric: c.disciplineEmotionnelle,
      render: pct,
      renderDelta: pts,
      sens: "positif",
    },
    // Ligne masquée tant que les violations ne sont pas fournies : une
    // conformité vide vaudrait « 0 % respecté », ce qui serait faux.
    ...(c.respectDuPlan.courant !== null || c.respectDuPlan.precedent !== null
      ? [
          {
            label: "Respect du plan",
            metric: c.respectDuPlan,
            render: pct,
            renderDelta: pts,
            sens: "positif" as Sens,
          },
        ]
      : []),
  ];

  return (
    <div className="bg-[#111615] border border-[#1B2320] rounded-xl p-5 space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="w-1 h-4 rounded-full bg-blue-500" />
            <h3 className="text-sm font-bold text-white">Est-ce que je progresse&nbsp;?</h3>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            {formatPeriodWindow(c.courant, granularite)} comparé à {formatPeriodWindow(c.precedent, granularite)}
          </p>
        </div>

        <div className="flex gap-1 self-start sm:self-auto bg-[#0D1110] border border-[#1B2320] rounded-xl p-1">
          {(
            [
              { key: "week", label: "Semaine" },
              { key: "month", label: "Mois" },
            ] as const
          ).map((opt) => (
            <button
              key={opt.key}
              onClick={() => setGranularite(opt.key)}
              className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${
                granularite === opt.key
                  ? "bg-[#1B2320] text-white"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {c.precedentVide ? (
        // Une seule phrase plutôt que six comparaisons à tirets : sans période
        // de référence, il n'y a rien à comparer, et le dire est plus honnête
        // que d'aligner des cases vides.
        <p className="text-xs text-slate-400">
          Aucun trade sur {granularite === "week" ? "la semaine" : "le mois"} précédent{granularite === "week" ? "e" : ""} —
          rien à comparer pour l'instant.
        </p>
      ) : (
        <>
          <div className="space-y-1">
            {lignes.map((ligne) => {
              const { metric } = ligne;
              return (
                <div
                  key={ligne.label}
                  className="flex items-center justify-between gap-3 py-1.5 border-b border-[#1B2320]/60 last:border-b-0"
                >
                  <span className="text-xs text-slate-400 flex-1">{ligne.label}</span>
                  <span className="text-xs text-slate-500 font-mono w-20 text-right">
                    {metric.precedent === null ? "—" : ligne.render(metric.precedent)}
                  </span>
                  <span className="text-sm text-white font-mono font-bold w-24 text-right">
                    {metric.courant === null ? "—" : ligne.render(metric.courant)}
                  </span>
                  <span
                    className={`text-xs font-mono font-bold w-24 text-right ${
                      metric.delta === null ? "text-slate-600" : couleurDelta(metric.delta, ligne.sens, metric.fiable)
                    }`}
                  >
                    {metric.delta === null ? "—" : ligne.renderDelta(metric.delta)}
                  </span>
                </div>
              );
            })}
          </div>

          <div className="flex items-center justify-between gap-3 text-[10px] text-slate-500">
            <span>
              {motPeriode} précédent{granularite === "week" ? "e" : ""} · {motPeriode} en cours · écart
            </span>
            {lignes.some((l) => l.sens !== "neutre" && l.metric.delta !== null && !l.metric.fiable) && (
              // Affichée SEULEMENT si un écart gris est réellement à l'écran :
              // sans cette phrase il ressemblerait à un bug d'affichage, mais
              // annoncée alors qu'aucun écart n'est calculable, elle serait du bruit.
              <span className="text-right">
                Écarts de taux en gris&nbsp;: moins de {MIN_ECHANTILLON_COMPARAISON} trades d'un côté
              </span>
            )}
          </div>
        </>
      )}
    </div>
  );
};
