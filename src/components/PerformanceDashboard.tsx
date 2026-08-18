import React from "react";
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
import { computePerformanceStats } from "../lib/performanceStats";

interface PerformanceDashboardProps {
  student: StudentProfile;
  trades: Trade[];
}

const tooltipStyle = {
  contentStyle: { backgroundColor: "#0D1110", borderColor: "#1B2320", borderRadius: "10px", fontSize: "12px" },
  labelStyle: { color: "#ffffff" },
  itemStyle: { color: "#ffffff" },
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
  <Card className="p-3.5 space-y-1">
    <MicroLabel>{label}</MicroLabel>
    <div className={`text-xl font-black font-mono ${valueClassName}`}>{value}</div>
    {secondary && <div className="text-[10px] text-slate-500">{secondary}</div>}
  </Card>
);

/** Empty state générique — court, dans le ton discret de la maquette de référence. */
const EmptyState: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="h-full min-h-[140px] flex items-center justify-center text-xs text-slate-500 italic text-center px-6">
    {children}
  </div>
);

export const PerformanceDashboard: React.FC<PerformanceDashboardProps> = ({ student, trades }) => {
  const stats = computePerformanceStats(student, trades);
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
  } = stats;

  // Une carte par dimension, toutes affichées en même temps — plus de pilules
  // à cliquer pour comparer deux répartitions entre elles.
  const bestWhereDimensions: { label: string; data: { key: string; pnl: number; tradesCount: number }[] }[] = [
    { label: "Session", data: sessionChartData.map((d) => ({ key: d.session, pnl: d.pnl, tradesCount: d.tradesCount })) },
    { label: "Heure", data: hourChartData.map((d) => ({ key: d.hour, pnl: d.pnl, tradesCount: d.tradesCount })) },
    { label: "Jour", data: dayChartData.map((d) => ({ key: d.day, pnl: d.pnl, tradesCount: d.tradesCount })) },
    { label: "Actif", data: pairChartData.map((d) => ({ key: d.pair, pnl: d.pnl, tradesCount: d.tradesCount })) },
    { label: "Setup", data: stats.strategyChartData.map((d) => ({ key: d.strategy, pnl: d.pnl, tradesCount: d.tradesCount })) },
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

      {/* Rangée de statistiques — huit cartes, une valeur par métrique clé. */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
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
