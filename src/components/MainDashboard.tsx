import React, { useState } from "react";

/**
 * `recharts` pèse ~327 ko et ne sert ici qu'à la courbe de progression, en bas
 * de page. Le charger paresseusement sort ce poids du démarrage : le tableau
 * de bord — écran d'arrivée de l'application — s'affiche sans l'attendre.
 */
const EquityCurveChart = React.lazy(() =>
  import("./EquityCurveChart").then((m) => ({ default: m.EquityCurveChart }))
);

/**
 * Gabarit affiché le temps que `recharts` arrive.
 *
 * **Il doit rester dans ce fichier, surtout pas dans `EquityCurveChart.tsx`.**
 * Un module à la fois importé statiquement et dynamiquement est fusionné par
 * Rollup dans le chunk de l'importateur statique : le `React.lazy` devient
 * alors décoratif, et `recharts` repart dans le bundle initial sans qu'aucun
 * avertissement ne le signale. C'est exactement ce qui s'est produit au
 * premier essai. `EquityCurveChart.tsx` n'est importé que dynamiquement, et
 * cela doit le rester.
 *
 * La hauteur est portée par le conteneur parent (`h-64`) : le gabarit occupe
 * donc exactement la place du graphique, et la page ne sursaute pas à son
 * arrivée. Volontairement muet — sur une connexion normale l'attente est trop
 * brève pour qu'un texte serve à autre chose qu'à clignoter.
 */
function EquityCurvePlaceholder() {
  return (
    <div className="h-full w-full rounded-xl bg-[#0D1110]/40 animate-pulse" aria-hidden="true" />
  );
}
import { formatCurrency } from "../lib/format";
import {
  StudentProfile,
  Trade,
  Module,
  CoachMessage,
} from "../types";
import { TabType, SidebarItemKey } from "./Sidebar";
import { computeDisciplineStreak } from "../lib/badges";
import { computeWeeklySummary } from "../lib/weeklySummary";
import { computeJournalSummary, computePnlByPeriod } from "../lib/performanceStats";
import { TradingSessionsWidget } from "./TradingSessionsWidget";

/**
 * En-tête de section — barre verticale colorée + titre, motif repris tel
 * quel de PerformanceDashboard.tsx pour un rendu cohérent sur tout l'écosystème.
 */
const SectionHeader: React.FC<{ children: React.ReactNode; color?: string }> = ({
  children,
  color = "bg-[#00E676]",
}) => (
  <div className="flex items-center gap-2">
    <span className={`w-1 h-4 rounded-full ${color}`} />
    <h3 className="text-sm font-bold text-white">{children}</h3>
  </div>
);

interface MainDashboardProps {
  student: StudentProfile;
  trades: Trade[];
  modules: Module[];
  messages: CoachMessage[];
  courseCompletionPercentage: number;
  setActiveTab: (tab: TabType) => void;
}

export const MainDashboard: React.FC<MainDashboardProps> = ({
  student,
  trades,
  modules,
  messages,
  courseCompletionPercentage,
  setActiveTab,
}) => {
  // Calculate Metrics
  const capitalDiff = student.currentCapital - student.startingCapital;
  const capitalDiffPercent = student.startingCapital > 0 ? ((capitalDiff / student.startingCapital) * 100).toFixed(1) : "0.0";
  const isCapitalUp = capitalDiff > 0;

  const totalTrades = trades.length;
  const winningTrades = trades.filter((t) => t.result === "WIN").length;
  // Jamais `totalTrades - winningTrades` : ça comptait les trades encore
  // ouverts et ceux clôturés au break-even comme "perdants", alors qu'ils ne
  // sont ni l'un ni l'autre — voir `computeJournalSummary`,
  // `src/lib/performanceStats.ts`, même règle appliquée là-bas.
  const losingTrades = trades.filter((t) => t.result === "LOSS").length;
  const breakevenTrades = trades.filter((t) => t.result === "BREAKEVEN").length;
  const decidedTrades = winningTrades + losingTrades;
  const winRate = decidedTrades > 0 ? Math.round((winningTrades / decidedTrades) * 100) : 0;

  // Equity Curve Data
  const sortedTrades = [...trades].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
  );

  let tempCapital = student.startingCapital;
  const equityData = [
    { label: "Départ", capital: student.startingCapital },
    ...sortedTrades.map((trade) => {
      // Un trade en % n'est pas une somme d'argent : l'ajouter tel quel au
      // capital cumulé (ex. "2.5" pour +2.5%) faussait la forme de la courbe
      // comme s'il s'agissait de +2.5$. Même règle que `totalPnL` plus bas et
      // que la seule autre courbe d'équité de l'app (`computePerformanceStats`,
      // `src/lib/performanceStats.ts`) — ce fichier reste néanmoins une
      // implémentation séparée, dupliquée pour la tuile compacte du tableau
      // de bord. Les deux affichent désormais la vraie date du trade en
      // abscisse (demande explicite), plus de libellés "T1"/"T2" générés.
      const pnl = (trade.pnlUnit ?? "USD") !== "PERCENT" ? parseFloat(String(trade.pnl)) || 0 : 0;
      if (trade.result === "WIN" || trade.result === "LOSS") {
        tempCapital += pnl;
      }
      return {
        label: trade.date,
        capital: tempCapital
      };
    }),
    // Point final rattaché au vrai capital courant (somme des portefeuilles) :
    // évite que la courbe diverge silencieusement si un trade sans compte
    // rattaché, ou en %, n'entre pas dans le même calcul que `tempCapital`.
    ...(sortedTrades.length > 0 ? [{ label: "Actuel", capital: student.currentCapital }] : []),
  ];

  // Trades en $ uniquement : un trade en % n'est pas une somme d'argent,
  // même principe que dans PerformanceDashboard.tsx.
  const totalPnL = trades
    .filter((t) => (t.pnlUnit ?? "USD") !== "PERCENT")
    .reduce((acc, t) => acc + t.pnl, 0);
  const isPnLPositive = totalPnL >= 0;

  const disciplineStreak = computeDisciplineStreak(trades);
  const { avgRR, profitFactor } = computeJournalSummary(trades);
  const pnlByPeriod = computePnlByPeriod(trades);

  const firstName = student.name.split(" ")[0] || "Yoann";

  return (
    <div className="space-y-6 pb-12 font-sans text-slate-100">
      {/* 1. Welcome Header */}
      <div className="space-y-1">
        <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
          Bonjour {firstName}.
        </h1>
        <p className="text-slate-400 text-xs sm:text-sm">
          {computeWeeklySummary(trades)}
        </p>
      </div>

      {/* 2. Top KPI Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
        {/* Card 1: Win Rate Journal */}
        <div className="bg-[#111615] border border-[#1B2320] rounded-xl p-5 space-y-4 flex flex-col justify-between">
          <div className="text-[9px] uppercase tracking-wider text-slate-500 font-bold">
            WIN RATE JOURNAL
          </div>
          <div className="space-y-1">
            <div className="text-xl font-black text-[#00E676] font-mono">
              {winRate}%
            </div>
            <p className="text-xs text-slate-400">
              {winningTrades} gagnants · {losingTrades} perdants
              {breakevenTrades > 0 ? ` · ${breakevenTrades} BE` : ""}
            </p>
          </div>
        </div>

        {/* Card 2: PnL Cumulé */}
        <div className="bg-[#111615] border border-[#1B2320] rounded-xl p-5 space-y-4 flex flex-col justify-between">
          <div className="text-[9px] uppercase tracking-wider text-slate-500 font-bold">
            PNL CUMULÉ
          </div>
          <div className="flex items-end justify-between">
            <div className={`text-xl font-black font-mono ${isPnLPositive ? "text-[#00E676]" : "text-rose-400"}`}>
              {isPnLPositive ? "+" : ""}
              {formatCurrency(totalPnL)}
            </div>
            {/* Sparkline SVG */}
            <div className="w-20 h-8">
              <svg className="w-full h-full overflow-visible" viewBox="0 0 80 30">
                <path
                  d="M 0 25 Q 20 28, 40 15 T 80 5"
                  fill="none"
                  stroke="#00E676"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                />
              </svg>
            </div>
          </div>
        </div>

        {/* Card 3: Série de Discipline */}
        <div className="bg-[#111615] border border-[#1B2320] rounded-xl p-5 space-y-4 flex flex-col justify-between">
          <div className="text-[9px] uppercase tracking-wider text-slate-500 font-bold">
            SÉRIE DE DISCIPLINE
          </div>
          <div className="space-y-1">
            <div className="flex items-baseline gap-1.5">
              <span className="text-xl font-black text-[#FFB800] font-mono">{disciplineStreak}</span>
              <span className="text-xs text-slate-400 font-medium">
                {disciplineStreak > 1 ? "jours" : "jour"}
              </span>
            </div>
            <p className="text-xs text-slate-400">
              {disciplineStreak > 0
                ? "Jours de trading sans écart émotionnel"
                : "Aucune série en cours"}
            </p>
          </div>
        </div>

        {/* Card 4: RR Moyen */}
        <div className="bg-[#111615] border border-[#1B2320] rounded-xl p-5 space-y-4 flex flex-col justify-between">
          <div className="text-[9px] uppercase tracking-wider text-slate-500 font-bold">
            RR MOYEN
          </div>
          <div className="space-y-1">
            <div className="text-xl font-black text-purple-400 font-mono">1:{avgRR}</div>
            <p className="text-xs text-slate-400">Risque / Récompense moyen</p>
          </div>
        </div>

        {/* Card 5: Profit Factor */}
        <div className="bg-[#111615] border border-[#1B2320] rounded-xl p-5 space-y-4 flex flex-col justify-between">
          <div className="text-[9px] uppercase tracking-wider text-slate-500 font-bold">
            PROFIT FACTOR
          </div>
          <div className="space-y-1">
            <div className="text-xl font-black text-white font-mono">{profitFactor}</div>
            <p className="text-xs text-slate-400">Gains / Pertes</p>
          </div>
        </div>
      </div>

      {/* PnL par période — jour / semaine / mois / année en cours */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {(
          [
            { key: "day", label: "PnL Jour" },
            { key: "week", label: "Semaine" },
            { key: "month", label: "Mois" },
            { key: "year", label: "Année" },
          ] as const
        ).map((period) => {
          const data = pnlByPeriod[period.key];
          return (
            <div
              key={period.key}
              className="bg-[#111615] border border-[#1B2320] rounded-xl p-4 space-y-1.5"
            >
              <div className="text-[9px] uppercase tracking-wider text-slate-500 font-bold">{period.label}</div>
              <div
                className={`text-xl font-black font-mono ${
                  data.pnl > 0 ? "text-[#00E676]" : data.pnl < 0 ? "text-rose-400" : "text-white"
                }`}
              >
                {data.pnl > 0 ? "+" : ""}
                {formatCurrency(data.pnl)}
              </div>
              <p className="text-xs text-slate-400">
                {data.tradesCount} trade{data.tradesCount > 1 ? "s" : ""}
              </p>
            </div>
          );
        })}
      </div>

      {/* 2bis. Sessions de trading en direct */}
      <div className="space-y-3">
        <SectionHeader color="bg-blue-500">Sessions de Trading</SectionHeader>
        <TradingSessionsWidget />
      </div>

      {/* 3. MODULES Section (4 Cards Grid) */}
      {(() => {
        // Reprend les mêmes clés que la sidebar (Sidebar.tsx,
        // SIDEBAR_TOGGLEABLE_KEYS) : un module masqué par le fondateur doit
        // disparaître partout où il est accessible en raccourci, pas
        // seulement de la sidebar — sinon le masquage n'est que cosmétique.
        const hiddenItems: SidebarItemKey[] = (student.hiddenSidebarItems ?? []) as SidebarItemKey[];

        const cards: Array<{
          key: SidebarItemKey;
          tab: TabType;
          letter: string;
          title: string;
          description: string;
          badgeClasses: string;
          borderHover: string;
          textHover: string;
          /** Couleur de la lueur au survol — celle du module (badge/bordure). */
          glowColor: string;
        }> = [
          {
            key: "journal",
            tab: "journal",
            letter: "J",
            title: "Journal de trading",
            description: "Chaque trade audité : exécution, émotion, respect du plan.",
            badgeClasses: "text-[#00E676] bg-[#00E676]/15 border-[#00E676]/30",
            borderHover: "hover:border-[#00E676]/40",
            textHover: "group-hover:text-[#00E676]",
            glowColor: "#00E676",
          },
          {
            key: "academy",
            tab: "academy",
            letter: "V",
            title: "Module vidéo",
            description: "Parcours débutant → masterclass, 14 leçons.",
            badgeClasses: "text-amber-400 bg-amber-500/15 border-amber-500/30",
            borderHover: "hover:border-amber-500/40",
            textHover: "group-hover:text-amber-400",
            glowColor: "#f59e0b",
          },
          {
            key: "analytics",
            tab: "analytics",
            letter: "R",
            title: "Rentabilité",
            description: "Analyse de performance.",
            badgeClasses: "text-blue-400 bg-blue-500/15 border-blue-500/30",
            borderHover: "hover:border-blue-500/40",
            textHover: "group-hover:text-blue-400",
            glowColor: "#3b82f6",
          },
          {
            key: "calendar",
            tab: "macro",
            letter: "M",
            title: "Macro",
            description: "Marché en direct et calendrier économique.",
            badgeClasses: "text-violet-400 bg-violet-500/15 border-violet-500/30",
            borderHover: "hover:border-violet-500/40",
            textHover: "group-hover:text-violet-400",
            glowColor: "#8b5cf6",
          },
        ];

        const visibleCards = cards.filter((c) => !hiddenItems.includes(c.key));
        if (visibleCards.length === 0) return null;

        return (
          <div className="space-y-3 pt-2">
            <SectionHeader color="bg-amber-500">Modules</SectionHeader>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {visibleCards.map((c) => (
                <div
                  key={c.key}
                  onClick={() => setActiveTab(c.tab)}
                  style={{ ["--glow" as string]: c.glowColor }}
                  className={`bg-[#111615] border border-[#1B2320] ${c.borderHover} shadow-[inset_0_0_28px_-8px_var(--glow)] p-5 rounded-xl space-y-4 transition-all cursor-pointer group flex flex-col`}
                >
                  <div className={`w-8 h-8 rounded-xl border flex items-center justify-center font-bold text-sm ${c.badgeClasses}`}>
                    {c.letter}
                  </div>
                  <div className="space-y-1.5">
                    <h3 className={`text-sm font-bold text-white ${c.textHover} transition-colors`}>
                      {c.title}
                    </h3>
                    <p className="text-xs text-slate-400 leading-relaxed">{c.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      })()}

      {/* 4. Bottom Main Section: Courbe de progression (pleine largeur) */}
      <div className="bg-[#111615] border border-[#1B2320] rounded-xl p-6 space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <SectionHeader color="bg-[#00E676]">Courbe de progression</SectionHeader>
            <p className="text-xs text-slate-400 mt-1">Capital réel issu de tes trades journalisés</p>
          </div>
          <button
            onClick={() => setActiveTab("journal")}
            className="px-3 py-1.5 rounded-xl bg-[#1B2320] hover:bg-[#232D29] text-slate-300 text-xs font-medium border border-[#232D29]/60 transition-colors self-start sm:self-auto"
          >
            Ouvrir le journal
          </button>
        </div>

        {/* Total Capital display */}
        <div className="space-y-1">
          <div className="flex items-baseline gap-3">
            <span className="text-3xl sm:text-4xl font-black text-white font-mono">
              {formatCurrency(student.currentCapital)}
            </span>
            <span className="px-2 py-0.5 rounded bg-[#00E676]/10 text-[#00E676] text-xs font-mono font-bold border border-[#00E676]/20">
              {isCapitalUp ? "+" : ""}{capitalDiffPercent}%
            </span>
          </div>
          <p className="text-xs text-slate-400">
            {isCapitalUp ? "+" : ""}{formatCurrency(capitalDiff)} depuis le départ
          </p>
        </div>

        {/* Chart Graphic */}
        <div className="h-64 w-full pt-4">
          <React.Suspense fallback={<EquityCurvePlaceholder />}>
            <EquityCurveChart data={equityData} />
          </React.Suspense>
        </div>
      </div>
    </div>
  );
};
