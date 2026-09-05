import React, { useMemo } from "react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  BarChart,
  Bar,
  Cell,
  CartesianGrid,
} from "recharts";
import { LineChart, AlertTriangle, RotateCcw } from "lucide-react";
import { Trade, StudentProfile } from "../types";
import { formatCurrency } from "../lib/format";
import { computePerformanceStats, computePnlByPeriod, isRealizedDollarTrade } from "../lib/performanceStats";

interface PerformanceDashboardProps {
  student: StudentProfile;
  trades: Trade[];
}

const tooltipStyle = {
  contentStyle: { backgroundColor: "#0D1110", borderColor: "#1B2320", borderRadius: "10px", fontSize: "12px" },
  labelStyle: { color: "#ffffff" },
  itemStyle: { color: "#ffffff" },
  // Sans ça, Recharts dessine par défaut un rectangle gris/blanc plein
  // derrière toute la catégorie survolée (barres) — visible sur fond sombre.
  cursor: { fill: "transparent" },
};

/** Micro-label en petites majuscules espacées, au-dessus d'une valeur. */
const MicroLabel: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <span className="text-[9px] uppercase tracking-wider text-slate-500 font-bold">{children}</span>
);

/** Carte flat à bordure fine, sans ombre. */
const Card: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className = "" }) => (
  <div className={`bg-[#111615] border border-[#1B2320] rounded-xl ${className}`}>{children}</div>
);

/**
 * En-tête de section — petite barre verticale colorée + titre en gras,
 * motif repris tel quel de la maquette de référence pour cette page.
 */
const SectionHeader: React.FC<{ children: React.ReactNode; color?: string }> = ({
  children,
  color = "bg-indigo-500",
}) => (
  <div className="flex items-center gap-2">
    <span className={`w-1 h-4 rounded-full ${color}`} />
    <h3 className="text-sm font-bold text-white">{children}</h3>
  </div>
);

/** Une des huit cartes de la rangée de statistiques du haut. */
const StatCard: React.FC<{
  label: string;
  value: string;
  valueClassName: string;
  secondary?: string;
}> = ({ label, value, valueClassName, secondary }) => (
  <Card className="p-3.5 space-y-1 min-w-0">
    <MicroLabel>{label}</MicroLabel>
    {/* `text-lg` (pas `text-xl`) + `truncate` : une valeur qui grossit (le
        capital augmente avec les trades) ne doit jamais dépasser la carte —
        `truncate` ne joue ici qu'un rôle de garde-fou ultime, la marge
        ajoutée par la taille réduite suffit dans l'immense majorité des cas. */}
    <div className={`text-lg font-black font-mono truncate ${valueClassName}`} title={value}>
      {value}
    </div>
    {secondary && <div className="text-[10px] text-slate-500">{secondary}</div>}
  </Card>
);

/** Empty state générique — court, dans le ton discret de la maquette de référence. */
const EmptyState: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="h-full min-h-[140px] flex items-center justify-center text-xs text-slate-500 italic text-center px-6">
    {children}
  </div>
);

/** Jours dans l'ordre d'affichage (semaine française, lundi en premier) — distinct de `Date.getDay()` (0 = dimanche). */
const HEATMAP_DAYS = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];
/** `Date.getDay()` (0 = dimanche) → index dans `HEATMAP_DAYS`. */
const JS_DAY_TO_HEATMAP_INDEX = [6, 0, 1, 2, 3, 4, 5];
const HEATMAP_BLOCKS: { label: string; startHour: number; endHour: number }[] = [
  { label: "0-3h", startHour: 0, endHour: 3 },
  { label: "3-6h", startHour: 3, endHour: 6 },
  { label: "6-9h", startHour: 6, endHour: 9 },
  { label: "9-12h", startHour: 9, endHour: 12 },
  { label: "12-15h", startHour: 12, endHour: 15 },
  { label: "15-18h", startHour: 15, endHour: 18 },
  { label: "18-21h", startHour: 18, endHour: 21 },
  { label: "21-24h", startHour: 21, endHour: 24 },
];

interface HeatmapCellStats {
  tradesCount: number;
  wins: number;
  losses: number;
  pnl: number;
}

/**
 * Grille jour × créneau de 6h — win rate et nombre de trades par case.
 * Calculée directement depuis `trades` (pas `performanceStats.ts` :
 * `dayChartData`/`hourChartData` existants agrègent chaque dimension
 * séparément, jamais croisée). Un trade sans heure (`time` absent, saisie
 * manuelle ancienne) n'a pas de créneau assignable — exclu de la grille,
 * jamais compté dans une case au hasard.
 */
function computeHeatmap(trades: Trade[]): HeatmapCellStats[][] {
  const grid: HeatmapCellStats[][] = HEATMAP_DAYS.map(() =>
    HEATMAP_BLOCKS.map(() => ({ tradesCount: 0, wins: 0, losses: 0, pnl: 0 }))
  );

  for (const trade of trades) {
    if (!trade.time) continue;
    const hour = parseInt(trade.time.split(":")[0], 10);
    if (Number.isNaN(hour)) continue;
    const blockIndex = HEATMAP_BLOCKS.findIndex((b) => hour >= b.startHour && hour < b.endHour);
    if (blockIndex === -1) continue;

    const parsedDate = new Date(`${trade.date}T00:00:00`);
    if (Number.isNaN(parsedDate.getTime())) continue;
    const dayIndex = JS_DAY_TO_HEATMAP_INDEX[parsedDate.getDay()];

    const cell = grid[dayIndex][blockIndex];
    cell.tradesCount += 1;
    if (trade.result === "WIN") cell.wins += 1;
    if (trade.result === "LOSS") cell.losses += 1;
    if (isRealizedDollarTrade(trade)) cell.pnl += trade.pnl;
  }

  return grid;
}

export const PerformanceDashboard: React.FC<PerformanceDashboardProps> = ({ student, trades }) => {
  const stats = computePerformanceStats(student, trades);
  const heatmap = useMemo(() => computeHeatmap(trades), [trades]);
  const pnlByPeriod = useMemo(() => computePnlByPeriod(trades), [trades]);
  const {
    equityData,
    totalTrades,
    winRate,
    totalPnL,
    pairChartData,
    directionChartData,
    dayChartData,
    sessionChartData,
    mistakeChartData,
    totalErrorsCost,
    netResultWithoutErrors,
    profitFactor,
    avgRR,
    drawdownMaxPercent,
    expectancyPerTrade,
    avgWin,
    avgLoss,
    monthlyChartData,
    hourChartData,
    marketChartData,
    emotionChartData,
    assetDetailData,
    bestWinStreak,
    worstLossStreak,
  } = stats;

  // Une carte par dimension, toutes affichées en même temps — plus de pilules
  // à cliquer pour comparer deux répartitions entre elles.
  const bestWhereDimensions: { label: string; data: { key: string; pnl: number; tradesCount: number }[] }[] = [
    { label: "Session", data: sessionChartData.map((d) => ({ key: d.session, pnl: d.pnl, tradesCount: d.tradesCount })) },
    { label: "Jour", data: dayChartData.map((d) => ({ key: d.day, pnl: d.pnl, tradesCount: d.tradesCount })) },
    { label: "Sens", data: directionChartData.map((d) => ({ key: d.direction, pnl: d.pnl, tradesCount: d.tradesCount })) },
    { label: "Marché", data: marketChartData.map((d) => ({ key: d.market, pnl: d.pnl, tradesCount: d.tradesCount })) },
  ];

  return (
    <div className="space-y-6 pb-12">
      {/* Header minimal : micro-label + titre + ticker PnL */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-1.5 mb-1">
            <LineChart className="w-3 h-3 text-slate-500" />
            <MicroLabel>Rentabilité</MicroLabel>
          </div>
          <h1 className="text-2xl font-extrabold text-white tracking-tight">Analyse de Performance</h1>
        </div>
        <div
          className={`flex items-center gap-2 px-3.5 py-2 rounded-lg border font-mono text-sm font-bold w-fit ${
            totalPnL >= 0
              ? "border-[#00E676]/25 bg-[#00E676]/10 text-[#00E676]"
              : "border-rose-500/25 bg-rose-500/10 text-rose-400"
          }`}
        >
          {totalPnL >= 0 ? "+" : ""}
          {formatCurrency(totalPnL)}
          <span className="text-slate-500 font-sans font-normal text-xs">net cumulé</span>
        </div>
      </div>

      {/* Rangée de statistiques — huit cartes, une valeur par métrique clé.
          4 colonnes max (jamais 8 sur une seule ligne) : les 4 premières
          (Capital/P&L/Win Rate/Profit Factor) sur une ligne, les 4
          suivantes (RR Moyen/Drawdown/Espérance/Gain-Perte) sur la
          suivante — plus de marge par carte qu'à 8 en ligne, une valeur à 6
          chiffres comme un capital ("$110,000.00") ne risque plus de
          dépasser sa carte. */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard
          label="Capital"
          value={formatCurrency(student.currentCapital)}
          valueClassName="text-[#00E676]"
        />
        <StatCard
          label="P&L Net"
          value={`${totalPnL >= 0 ? "+" : ""}${formatCurrency(totalPnL)}`}
          valueClassName={totalPnL >= 0 ? "text-[#00E676]" : "text-rose-400"}
        />
        <StatCard
          label="Win Rate"
          value={`${winRate}%`}
          valueClassName={winRate >= 50 ? "text-[#00E676]" : "text-rose-400"}
          secondary={`${totalTrades} trade${totalTrades > 1 ? "s" : ""}`}
        />
        <StatCard
          label="Profit Factor"
          value={profitFactor}
          valueClassName={profitFactor !== "N/A" && Number(profitFactor) >= 1 ? "text-[#00E676]" : "text-rose-400"}
        />
        <StatCard label="RR Moyen" value={avgRR} valueClassName="text-blue-400" />
        <StatCard
          label="Drawdown Max"
          value={`-${drawdownMaxPercent.toFixed(1)}%`}
          valueClassName="text-rose-400"
        />
        <StatCard
          label="Espérance / Trade"
          value={`${expectancyPerTrade >= 0 ? "+" : ""}${formatCurrency(expectancyPerTrade)}`}
          valueClassName={expectancyPerTrade >= 0 ? "text-purple-400" : "text-rose-400"}
        />
        <StatCard
          label="Gain / Perte Moy."
          value={`${formatCurrency(avgWin)} / ${formatCurrency(avgLoss)}`}
          valueClassName="text-white"
        />
      </div>

      {/* PnL par période — jour / semaine / mois / année en cours */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
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
            <StatCard
              key={period.key}
              label={period.label}
              value={`${data.pnl > 0 ? "+" : ""}${formatCurrency(data.pnl)}`}
              valueClassName={data.pnl > 0 ? "text-[#00E676]" : data.pnl < 0 ? "text-rose-400" : "text-white"}
              secondary={`${data.tradesCount} trade${data.tradesCount > 1 ? "s" : ""}`}
            />
          );
        })}
      </div>

      {/* Courbe de capital — pleine largeur */}
      <Card className="p-5 space-y-4">
        <SectionHeader color="bg-[#00E676]">Courbe de capital</SectionHeader>
        {trades.length === 0 ? (
          <EmptyState>Ajoute des trades pour voir ta courbe de capital.</EmptyState>
        ) : (
          <div className="h-72 w-full pt-2">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={equityData}>
                <defs>
                  <linearGradient id="colorCapital" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#00E676" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#00E676" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#1B2320" />
                <XAxis dataKey="date" stroke="#475569" fontSize={11} />
                <YAxis stroke="#475569" fontSize={11} domain={["auto", "auto"]} />
                <Tooltip {...tooltipStyle} formatter={(value: any) => [formatCurrency(Number(value)), "Capital"]} />
                <Area type="monotone" dataKey="capital" stroke="#00E676" strokeWidth={2} fillOpacity={1} fill="url(#colorCapital)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
      </Card>

      {/* Heatmap — où tu gagnes : win rate croisé jour × créneau de 3h. */}
      <Card className="p-5 space-y-4">
        <SectionHeader color="bg-violet-500">Heatmap — où tu gagnes</SectionHeader>
        {trades.length < 3 ? (
          <EmptyState>Ajoute au moins 3 trades pour révéler ton ADN de trader.</EmptyState>
        ) : (
          <div className="overflow-x-auto">
            <div className="min-w-[720px] grid grid-cols-[48px_repeat(8,1fr)] gap-1.5">
              <div />
              {HEATMAP_BLOCKS.map((block) => (
                <div key={block.label} className="text-center text-[10px] text-slate-500 font-mono pb-1">
                  {block.label}
                </div>
              ))}
              {HEATMAP_DAYS.map((day, dayIndex) => (
                <React.Fragment key={day}>
                  <div className="flex items-center text-xs text-slate-400 font-medium">{day}</div>
                  {HEATMAP_BLOCKS.map((block, blockIndex) => {
                    const cell = heatmap[dayIndex][blockIndex];
                    // `wins/(wins+losses)`, pas `wins/tradesCount` : un BE ou un
                    // OPEN dans la case ne doit ni compter comme gagnant ni
                    // diluer le taux — même règle que partout ailleurs, voir
                    // `isRealizedDollarTrade` (src/lib/performanceStats.ts).
                    const decided = cell.wins + cell.losses;
                    const winRate = decided > 0 ? Math.round((cell.wins / decided) * 100) : null;
                    // Intensité proportionnelle au win rate — jamais en dessous de 15%
                    // d'opacité pour qu'une case avec des trades reste visuellement
                    // distincte d'une case vraiment vide, même à 0%/100% de réussite.
                    const backgroundColor =
                      winRate === null
                        ? undefined
                        : winRate >= 50
                        ? `rgba(0,230,118,${Math.max(0.15, winRate / 100)})`
                        : `rgba(244,63,94,${Math.max(0.15, (100 - winRate) / 100)})`;
                    return (
                      <div
                        key={block.label}
                        title={
                          cell.tradesCount > 0
                            ? winRate !== null
                              ? `${day} ${block.label} — ${winRate}% de réussite sur ${cell.tradesCount} trade${cell.tradesCount > 1 ? "s" : ""}`
                              : `${day} ${block.label} — ${cell.tradesCount} trade${cell.tradesCount > 1 ? "s" : ""} sans résultat décidé (BE/ouvert)`
                            : `${day} ${block.label} — aucun trade`
                        }
                        className="h-11 rounded-lg border border-[#1B2320] bg-[#0D1110] flex flex-col items-center justify-center"
                        style={backgroundColor ? { backgroundColor } : undefined}
                      >
                        {cell.tradesCount > 0 && (
                          <>
                            {/* `null` seulement si aucun trade WIN/LOSS dans la
                                case (uniquement des BE/OPEN) : pas de taux à
                                afficher plutôt qu'un "null%" littéral. */}
                            <span
                              className={`text-[11px] font-bold leading-none ${
                                winRate !== null ? "text-slate-950" : "text-white"
                              }`}
                            >
                              {winRate !== null ? `${winRate}%` : "—"}
                            </span>
                            <span
                              className={`text-[9px] leading-none mt-0.5 ${
                                winRate !== null ? "text-slate-950/80" : "text-slate-300/80"
                              }`}
                            >
                              {cell.tradesCount} trade{cell.tradesCount > 1 ? "s" : ""}
                            </span>
                          </>
                        )}
                      </div>
                    );
                  })}
                </React.Fragment>
              ))}
            </div>
          </div>
        )}
      </Card>

      {/* Performance mensuelle & Psychologie — deux colonnes */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="p-5 space-y-4">
          <SectionHeader color="bg-blue-500">Performance mensuelle</SectionHeader>
          {monthlyChartData.length === 0 ? (
            <EmptyState>Pas assez de trades pour une vue mensuelle.</EmptyState>
          ) : (
            <div className="h-56 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={monthlyChartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1B2320" />
                  <XAxis dataKey="month" stroke="#475569" fontSize={11} />
                  <YAxis stroke="#475569" fontSize={11} tickFormatter={(val) => formatCurrency(Number(val))} />
                  <Tooltip {...tooltipStyle} formatter={(value: any) => [formatCurrency(Number(value)), "PnL"]} />
                  <Bar dataKey="pnl" radius={[6, 6, 0, 0]}>
                    {monthlyChartData.map((entry, index) => (
                      <Cell key={`cell-month-${index}`} fill={entry.pnl >= 0 ? "#10b981" : "#f43f5e"} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </Card>

        <Card className="p-5 space-y-4">
          <SectionHeader color="bg-purple-500">Psychologie</SectionHeader>
          {trades.length === 0 ? (
            <EmptyState>
              Win rate quand l'émotion est forte vs faible. Tague ton état émotionnel sur chaque trade
              dans le Journal.
            </EmptyState>
          ) : (
            <div className="h-56 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={emotionChartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1B2320" />
                  <XAxis dataKey="emotion" stroke="#475569" fontSize={10} interval={0} angle={-15} textAnchor="end" />
                  <YAxis stroke="#475569" fontSize={11} tickFormatter={(val) => formatCurrency(Number(val))} />
                  <Tooltip
                    {...tooltipStyle}
                    formatter={(value: any, _name: any, props: any) => [
                      `${formatCurrency(Number(value))} (${props?.payload?.tradesCount ?? 0} trade${
                        (props?.payload?.tradesCount ?? 0) > 1 ? "s" : ""
                      })`,
                      "PnL",
                    ]}
                  />
                  <Bar dataKey="pnl" radius={[6, 6, 0, 0]}>
                    {emotionChartData.map((entry, index) => (
                      <Cell key={`cell-emotion-${index}`} fill={entry.tradesCount === 0 ? "#475569" : entry.pnl >= 0 ? "#10b981" : "#f43f5e"} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </Card>
      </div>

      {/* Où es-tu le meilleur ? — une carte par dimension, toutes visibles en
          même temps : plus besoin de naviguer entre des pilules pour
          comparer deux répartitions, chacune a sa propre section. */}
      <div className="space-y-4">
        <SectionHeader color="bg-amber-500">Où es-tu le meilleur ?</SectionHeader>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {bestWhereDimensions.map((dim) => (
            <Card key={dim.label} className="p-5 space-y-4">
              <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wide">{dim.label}</h4>
              {dim.data.length === 0 ? (
                <EmptyState>Pas assez de données.</EmptyState>
              ) : (
                <div className="h-56 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={dim.data}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#1B2320" />
                      <XAxis
                        dataKey="key"
                        stroke="#475569"
                        fontSize={11}
                        interval={0}
                        angle={dim.data.length > 6 ? -15 : 0}
                        textAnchor={dim.data.length > 6 ? "end" : "middle"}
                      />
                      <YAxis stroke="#475569" fontSize={11} tickFormatter={(val) => formatCurrency(Number(val))} />
                      <Tooltip
                        {...tooltipStyle}
                        formatter={(value: any, _name: any, props: any) => [
                          `${formatCurrency(Number(value))} (${props?.payload?.tradesCount ?? 0} trade${
                            (props?.payload?.tradesCount ?? 0) > 1 ? "s" : ""
                          })`,
                          "PnL",
                        ]}
                      />
                      <Bar dataKey="pnl" radius={[6, 6, 0, 0]}>
                        {dim.data.map((entry, index) => (
                          <Cell key={`cell-${dim.label}-${index}`} fill={entry.pnl >= 0 ? "#10b981" : "#f43f5e"} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </Card>
          ))}
        </div>
      </div>

      {/* Détail par actif — tableau exhaustif (tous les actifs, pas les 8
          premiers de "Où es-tu le meilleur ?"), trié par PnL décroissant. */}
      <Card className="p-5 space-y-4">
        <SectionHeader color="bg-[#00E676]">Détail par Actif</SectionHeader>
        {assetDetailData.length === 0 ? (
          <EmptyState>Ajoute des trades pour voir le détail par actif.</EmptyState>
        ) : (
          <div className="overflow-x-auto -mx-1">
            <table className="w-full text-sm min-w-[480px]">
              <thead>
                <tr className="border-b border-[#1B2320]">
                  <th className="text-left px-3 py-2 text-[9px] uppercase tracking-wider text-slate-500 font-bold">Actif</th>
                  <th className="text-right px-3 py-2 text-[9px] uppercase tracking-wider text-slate-500 font-bold">Trades</th>
                  <th className="text-right px-3 py-2 text-[9px] uppercase tracking-wider text-slate-500 font-bold">Win Rate</th>
                  <th className="text-right px-3 py-2 text-[9px] uppercase tracking-wider text-slate-500 font-bold">PnL Total</th>
                </tr>
              </thead>
              <tbody>
                {assetDetailData.map((row) => (
                  <tr key={row.asset} className="border-b border-[#1B2320] last:border-b-0">
                    <td className="px-3 py-3 font-bold text-white">{row.asset}</td>
                    <td className="px-3 py-3 text-right text-slate-300 font-mono">{row.tradesCount}</td>
                    <td
                      className={`px-3 py-3 text-right font-mono font-bold ${
                        row.winRate >= 50 ? "text-[#00E676]" : "text-rose-400"
                      }`}
                    >
                      {row.winRate}%
                    </td>
                    <td
                      className={`px-3 py-3 text-right font-mono font-bold ${
                        row.pnl >= 0 ? "text-[#00E676]" : "text-rose-400"
                      }`}
                    >
                      {row.pnl >= 0 ? "+" : ""}
                      {formatCurrency(row.pnl)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Meilleure / Pire série — plus longue suite de trades gagnants ou
          perdants consécutifs. */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
        <Card className="p-5 space-y-1">
          <MicroLabel>Meilleure Série</MicroLabel>
          <div className="text-2xl font-black font-mono text-[#00E676]">
            {bestWinStreak} win{bestWinStreak > 1 ? "s" : ""}
          </div>
        </Card>
        <Card className="p-5 space-y-1">
          <MicroLabel>Pire Série</MicroLabel>
          <div className="text-2xl font-black font-mono text-rose-400">
            {worstLossStreak} loss{worstLossStreak > 1 ? "es" : ""}
          </div>
        </Card>
      </div>

      {/* Erreurs les plus fréquentes — conservé de l'ancienne version, pas dans
          la maquette de référence mais donnée réelle utile, jamais affichée
          ailleurs dans l'app. */}
      {mistakeChartData.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card className="p-5 space-y-4">
            <SectionHeader color="bg-rose-500">Erreurs les plus fréquentes</SectionHeader>
            <div className="space-y-2">
              {mistakeChartData.map((m) => (
                <div key={m.mistake} className="p-3 rounded-lg bg-[#0D1110] border border-[#1B2320] flex items-center justify-between">
                  <div>
                    <div className="text-sm font-bold text-white">{m.mistake}</div>
                    <div className="text-[11px] text-slate-500">{m.count} occurrence{m.count > 1 ? "s" : ""}</div>
                  </div>
                  <div className={`font-mono font-bold ${m.cost >= 0 ? "text-[#00E676]" : "text-rose-400"}`}>
                    {m.cost >= 0 ? "+" : ""}
                    {formatCurrency(m.cost)}
                  </div>
                </div>
              ))}
            </div>
          </Card>

          <Card className="p-5 space-y-4">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-400" />
              <h3 className="text-sm font-bold text-white">Coût Total des Erreurs</h3>
            </div>
            <div className="space-y-1">
              <div className="text-2xl font-black text-rose-400 font-mono">
                {formatCurrency(totalErrorsCost)}
              </div>
              <p className="text-xs text-slate-400">
                Sans ces erreurs, ton résultat cumulé serait de{" "}
                <span className="text-[#00E676] font-bold">{formatCurrency(netResultWithoutErrors)}</span>{" "}
                au lieu de {formatCurrency(totalPnL)}.
              </p>
            </div>
            <div className="h-56 w-full pt-2">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={mistakeChartData} layout="vertical" margin={{ left: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1B2320" />
                  <XAxis type="number" stroke="#475569" fontSize={11} tickFormatter={(val) => formatCurrency(Number(val))} />
                  <YAxis type="category" dataKey="mistake" stroke="#475569" fontSize={10} width={110} />
                  <Tooltip {...tooltipStyle} formatter={(value: any) => [formatCurrency(Number(value)), "Coût"]} />
                  <Bar dataKey="cost" radius={[0, 6, 6, 0]} fill="#f43f5e" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </div>
      )}

      {mistakeChartData.length === 0 && (
        <Card className="p-5 flex items-center gap-3">
          <RotateCcw className="w-4 h-4 text-slate-600 shrink-0" />
          <p className="text-xs text-slate-500 italic">
            Aucune erreur taguée pour l'instant. Tague les erreurs commises directement sur un trade
            dans le Journal (champ « Erreurs Commises ») pour voir apparaître ces statistiques.
          </p>
        </Card>
      )}
    </div>
  );
};
