import React, { useState } from "react";
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
import {
  Award,
  ShieldCheck,
  LineChart,
  Brain,
  Target,
  ArrowUpRight,
  ArrowDownRight,
  Clock,
  AlertTriangle,
  RotateCcw,
  BarChart3,
} from "lucide-react";
import { Trade, StudentProfile } from "../types";
import { formatCurrency } from "../lib/format";
import { computePerformanceStats } from "../lib/performanceStats";

interface PerformanceDashboardProps {
  student: StudentProfile;
  trades: Trade[];
  courseCompletionPercentage: number;
}

const tooltipStyle = {
  contentStyle: { backgroundColor: "#0D1110", borderColor: "#1B2320", borderRadius: "10px", fontSize: "12px" },
  labelStyle: { color: "#ffffff" },
  itemStyle: { color: "#ffffff" },
};

/** Micro-label en petites majuscules espacées, au-dessus d'une valeur — motif repris de Replay FX. */
const MicroLabel: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <span className="text-[10px] uppercase tracking-wider text-slate-500 font-bold">{children}</span>
);

/** Carte flat à bordure fine, sans ombre — motif repris de Replay FX (contraste avec les anciens dégradés colorés). */
const Card: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className = "" }) => (
  <div className={`bg-[#111615] border border-[#1B2320] rounded-xl ${className}`}>{children}</div>
);

type Section = "overview" | "categories" | "errors";

export const PerformanceDashboard: React.FC<PerformanceDashboardProps> = ({
  student,
  trades,
  courseCompletionPercentage,
}) => {
  const [section, setSection] = useState<Section>("overview");

  const {
    equityData,
    strategyChartData,
    emotionChartData,
    totalTrades,
    wins,
    winRate,
    totalPnL,
    disciplineScore,
    capitalDiffPercent,
    isCapitalUp,
    pairChartData,
    directionChartData,
    dayChartData,
    sessionChartData,
    tradesSansHeure,
    mistakeChartData,
    totalErrorsCost,
    netResultWithoutErrors,
  } = computePerformanceStats(student, trades);

  const sections: { id: Section; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
    { id: "overview", label: "Vue d'ensemble", icon: LineChart },
    { id: "categories", label: "Psychologie & Catégories", icon: Brain },
    { id: "errors", label: "Erreurs", icon: RotateCcw },
  ];

  return (
    <div className="space-y-6 pb-12">
      {/* Header : micro-label + titre + ticker PnL, motif repris du header instrument de Replay FX */}
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

      {/* Navigation en pilules soulignées — motif repris de Replay FX (Backtest/Journal/Statistiques) */}
      <div className="flex items-center gap-6 sm:gap-8 border-b border-[#1B2320] overflow-x-auto">
        {sections.map((s) => {
          const Icon = s.icon;
          const isActive = section === s.id;
          return (
            <button
              key={s.id}
              onClick={() => setSection(s.id)}
              className={`relative flex items-center gap-2 pb-3 text-sm font-bold whitespace-nowrap transition-colors ${
                isActive ? "text-white" : "text-slate-500 hover:text-slate-300"
              }`}
            >
              <Icon className="w-4 h-4" />
              {s.label}
              {isActive && (
                <span className="absolute -bottom-px left-0 right-0 h-0.5 bg-[#00E676] rounded-full" />
              )}
            </button>
          );
        })}
      </div>

      {section === "overview" && (
        <div className="space-y-6">
          {/* Primary KPI Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card className="p-4 space-y-1.5">
              <div className="flex items-center justify-between">
                <MicroLabel>Capital Financé</MicroLabel>
                <ShieldCheck className="w-3.5 h-3.5 text-[#00E676]" />
              </div>
              <div className="text-2xl font-black text-[#00E676] font-mono">
                {formatCurrency(student.currentCapital)}
              </div>
              <div className="text-[11px] text-slate-500 flex items-center gap-1">
                <span className={`font-bold flex items-center ${isCapitalUp ? "text-[#00E676]" : "text-rose-400"}`}>
                  {isCapitalUp ? <ArrowUpRight className="w-3.5 h-3.5" /> : <ArrowDownRight className="w-3.5 h-3.5" />}
                  {isCapitalUp ? "+" : ""}
                  {capitalDiffPercent.toFixed(1)}%
                </span>
                <span>depuis le démarrage</span>
              </div>
            </Card>

            <Card className="p-4 space-y-1.5">
              <div className="flex items-center justify-between">
                <MicroLabel>Taux de Réussite</MicroLabel>
                <Target className="w-3.5 h-3.5 text-amber-400" />
              </div>
              <div className="text-2xl font-black text-amber-400 font-mono">{winRate}%</div>
              <div className="text-[11px] text-slate-500">{wins} gagnants sur {totalTrades} positions</div>
              <div className="w-full h-1.5 rounded-full overflow-hidden flex mt-1">
                <div className="h-full bg-[#00E676]" style={{ width: `${winRate}%` }} />
                <div className="h-full bg-rose-500/60" style={{ width: `${100 - winRate}%` }} />
              </div>
            </Card>

            <Card className="p-4 space-y-1.5">
              <div className="flex items-center justify-between">
                <MicroLabel>Indice de Discipline</MicroLabel>
                <Brain className="w-3.5 h-3.5 text-purple-400" />
              </div>
              <div className="text-2xl font-black text-purple-400 font-mono">{disciplineScore}%</div>
              <div className="text-[11px] text-slate-500">Respect strict du Risk Management</div>
            </Card>

            <Card className="p-4 space-y-1.5">
              <div className="flex items-center justify-between">
                <MicroLabel>Avancement Académie</MicroLabel>
                <Award className="w-3.5 h-3.5 text-rose-400" />
              </div>
              <div className="text-2xl font-black text-white font-mono">{courseCompletionPercentage}%</div>
              <div className="text-[11px] text-slate-500">Modules de cours théoriques validés</div>
            </Card>
          </div>

          {/* Equity Curve & Strategy Breakdown */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <Card className="lg:col-span-2 p-5 space-y-4">
              <div>
                <h3 className="text-sm font-bold text-white">Courbe d'Équité du Capital</h3>
                <p className="text-[11px] text-slate-500">Évolution nette du compte de trading</p>
              </div>
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
            </Card>

            <Card className="p-5 space-y-4">
              <div>
                <h3 className="text-sm font-bold text-white">Taux de Réussite par Stratégie</h3>
                <p className="text-[11px] text-slate-500">Pourcentage de gain selon la configuration</p>
              </div>
              <div className="h-72 w-full pt-2">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={strategyChartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1B2320" />
                    <XAxis dataKey="strategy" stroke="#475569" fontSize={10} interval={0} angle={-15} textAnchor="end" />
                    <YAxis stroke="#475569" fontSize={11} unit="%" />
                    <Tooltip {...tooltipStyle} formatter={(value: any) => [`${value}%`, "Win Rate"]} />
                    <Bar dataKey="winRate" radius={[6, 6, 0, 0]}>
                      {strategyChartData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.winRate >= 60 ? "#10b981" : entry.winRate >= 40 ? "#f59e0b" : "#f43f5e"} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Card>
          </div>
        </div>
      )}

      {section === "categories" && (
        <div className="space-y-6">
          {/* Psychology & Emotion vs Profitability */}
          <Card className="p-5 space-y-4">
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Brain className="w-4 h-4 text-purple-400" />
                Impact Psychologique & Émotionnel sur la Rentabilité
              </h3>
              <p className="text-[11px] text-slate-500">
                Comparaison directe du PnL net selon l'état émotionnel lors de la prise de position
              </p>
            </div>

            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={emotionChartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1B2320" />
                  <XAxis dataKey="emotion" stroke="#475569" fontSize={12} />
                  <YAxis stroke="#475569" fontSize={11} tickFormatter={(val) => formatCurrency(Number(val))} />
                  <Tooltip
                    {...tooltipStyle}
                    formatter={(value: any, _name: any, props: any) => [
                      `${formatCurrency(Number(value))} (${props?.payload?.tradesCount ?? 0} trade${
                        (props?.payload?.tradesCount ?? 0) > 1 ? "s" : ""
                      })`,
                      "PnL Total",
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

            <div className="p-3.5 rounded-lg bg-[#0D1110] border border-[#1B2320] text-xs text-slate-300 flex items-start gap-3">
              <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
              <div>
                <strong className="text-amber-400">Constat Psychologique Clé : </strong>
                Vos positions prises avec un état <span className="text-[#00E676] font-bold">Discipliné / Calme</span> génèrent 100% de vos bénéfices nets. Les trades pris sous impulsion <span className="text-rose-400 font-bold">FOMO</span> sont responsables de la totalité de votre Drawdown.
              </div>
            </div>
          </Card>

          {/* Actif & Direction */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card className="p-5 space-y-4">
              <div>
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <BarChart3 className="w-4 h-4 text-[#00E676]" />
                  PnL Net par Actif
                </h3>
                <p className="text-[11px] text-slate-500">Rentabilité selon la paire tradée (top 8 par volume)</p>
              </div>
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={pairChartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1B2320" />
                    <XAxis dataKey="pair" stroke="#475569" fontSize={11} />
                    <YAxis stroke="#475569" fontSize={11} tickFormatter={(val) => formatCurrency(Number(val))} />
                    <Tooltip {...tooltipStyle} formatter={(value: any) => [formatCurrency(Number(value)), "PnL Total"]} />
                    <Bar dataKey="pnl" radius={[6, 6, 0, 0]}>
                      {pairChartData.map((entry, index) => (
                        <Cell key={`cell-pair-${index}`} fill={entry.pnl >= 0 ? "#10b981" : "#f43f5e"} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Card>

            <Card className="p-5 space-y-4">
              <div>
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <ArrowUpRight className="w-4 h-4 text-[#00E676]" />
                  PnL Net par Direction
                </h3>
                <p className="text-[11px] text-slate-500">Rentabilité Long vs Short</p>
              </div>
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={directionChartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1B2320" />
                    <XAxis dataKey="direction" stroke="#475569" fontSize={12} />
                    <YAxis stroke="#475569" fontSize={11} tickFormatter={(val) => formatCurrency(Number(val))} />
                    <Tooltip {...tooltipStyle} formatter={(value: any) => [formatCurrency(Number(value)), "PnL Total"]} />
                    <Bar dataKey="pnl" radius={[6, 6, 0, 0]} barSize={80}>
                      {directionChartData.map((entry, index) => (
                        <Cell key={`cell-dir-${index}`} fill={entry.pnl >= 0 ? "#10b981" : "#f43f5e"} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Card>
          </div>

          {/* Jour de la Semaine & Session de Marché */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card className="p-5 space-y-4">
              <div>
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <Clock className="w-4 h-4 text-amber-400" />
                  PnL Net par Jour de la Semaine
                </h3>
                <p className="text-[11px] text-slate-500">Identifie tes meilleurs et pires jours de trading</p>
              </div>
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={dayChartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1B2320" />
                    <XAxis dataKey="day" stroke="#475569" fontSize={12} />
                    <YAxis stroke="#475569" fontSize={11} tickFormatter={(val) => formatCurrency(Number(val))} />
                    <Tooltip {...tooltipStyle} formatter={(value: any) => [formatCurrency(Number(value)), "PnL Total"]} />
                    <Bar dataKey="pnl" radius={[6, 6, 0, 0]}>
                      {dayChartData.map((entry, index) => (
                        <Cell key={`cell-day-${index}`} fill={entry.pnl >= 0 ? "#10b981" : "#f43f5e"} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Card>

            <Card className="p-5 space-y-4">
              <div>
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <Clock className="w-4 h-4 text-amber-400" />
                  PnL Net par Session de Marché
                </h3>
                <p className="text-[11px] text-slate-500">
                  Basé sur l'heure d'entrée saisie
                  {tradesSansHeure > 0 ? ` — ${tradesSansHeure} trade(s) sans heure exclus` : ""}
                </p>
              </div>
              {sessionChartData.length === 0 ? (
                <div className="h-64 w-full flex items-center justify-center text-xs text-slate-500 italic text-center px-6">
                  Aucun trade avec une heure d'entrée renseignée pour l'instant.
                </div>
              ) : (
                <div className="h-64 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={sessionChartData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#1B2320" />
                      <XAxis dataKey="session" stroke="#475569" fontSize={10} interval={0} angle={-15} textAnchor="end" />
                      <YAxis stroke="#475569" fontSize={11} tickFormatter={(val) => formatCurrency(Number(val))} />
                      <Tooltip {...tooltipStyle} formatter={(value: any) => [formatCurrency(Number(value)), "PnL Total"]} />
                      <Bar dataKey="pnl" radius={[6, 6, 0, 0]}>
                        {sessionChartData.map((entry, index) => (
                          <Cell key={`cell-session-${index}`} fill={entry.pnl >= 0 ? "#10b981" : "#f43f5e"} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </Card>
          </div>
        </div>
      )}

      {section === "errors" && (
        <div className="space-y-6">
          {mistakeChartData.length === 0 ? (
            <Card className="p-5">
              <h3 className="text-sm font-bold text-white flex items-center gap-2 mb-2">
                <RotateCcw className="w-4 h-4 text-rose-400" />
                Erreurs les plus fréquentes
              </h3>
              <p className="text-xs text-slate-500 italic">
                Aucune erreur taguée pour l'instant. Tague les erreurs commises directement sur un trade
                dans le Journal (champ « Erreurs Commises ») pour voir apparaître ces statistiques.
              </p>
            </Card>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card className="p-5 space-y-4">
                <div>
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    <RotateCcw className="w-4 h-4 text-rose-400" />
                    Erreurs les plus fréquentes
                  </h3>
                  <p className="text-[11px] text-slate-500">Classées par nombre d'occurrences</p>
                </div>
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
                <div>
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-rose-400" />
                    Coût Total des Erreurs
                  </h3>
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
        </div>
      )}
    </div>
  );
};
