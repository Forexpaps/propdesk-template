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
  PieChart,
  Pie,
  CartesianGrid,
  Legend
} from "recharts";
import {
  Award,
  TrendingUp,
  ShieldCheck,
  Zap,
  BarChart3,
  LineChart,
  Brain,
  Target,
  ArrowUpRight,
  ArrowDownRight,
  Clock,
  CheckCircle2,
  AlertTriangle,
  RotateCcw
} from "lucide-react";
import { Trade, StudentProfile } from "../types";
import { formatCurrency } from "../lib/format";
import { computePerformanceStats } from "../lib/performanceStats";

interface PerformanceDashboardProps {
  student: StudentProfile;
  trades: Trade[];
  courseCompletionPercentage: number;
}

export const PerformanceDashboard: React.FC<PerformanceDashboardProps> = ({
  student,
  trades,
  courseCompletionPercentage,
}) => {
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

  return (
    <div className="space-y-8 pb-12">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-[#111615] via-[#151D1A] to-[#111615] p-6 rounded-2xl border border-[#1B2320] shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/10 text-amber-400 text-xs font-semibold border border-amber-500/20">
            <LineChart className="w-3.5 h-3.5" />
            Tableau de Bord Analytique Personnalisé
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
            Analyse Complète de la Performance
          </h1>
          <p className="text-slate-400 text-xs sm:text-sm max-w-2xl">
            Visualisez la trajectoire de votre capital, la rentabilité par stratégie et la corrélation directe entre votre état d'esprit et vos résultats.
          </p>
        </div>
      </div>

      {/* Primary KPI Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Capital Box */}
        <div className="bg-[#111615] border border-[#1B2320] p-5 rounded-2xl space-y-2 shadow-lg relative overflow-hidden">
          <div className="flex items-center justify-between text-xs text-slate-400 font-semibold">
            <span>Capital Financé</span>
            <ShieldCheck className="w-4 h-4 text-[#00E676]" />
          </div>
          <div className="text-3xl font-black text-[#00E676] font-mono">
            {formatCurrency(student.currentCapital)}
          </div>
          <div className="text-xs text-slate-400 flex items-center gap-1">
            <span
              className={`font-bold flex items-center ${isCapitalUp ? "text-[#00E676]" : "text-rose-400"}`}
            >
              {isCapitalUp ? (
                <ArrowUpRight className="w-3.5 h-3.5" />
              ) : (
                <ArrowDownRight className="w-3.5 h-3.5" />
              )}
              {isCapitalUp ? "+" : ""}
              {capitalDiffPercent.toFixed(1)}%
            </span>
            <span>depuis le démarrage</span>
          </div>
        </div>

        {/* Win Rate Box */}
        <div className="bg-[#111615] border border-[#1B2320] p-5 rounded-2xl space-y-2 shadow-lg">
          <div className="flex items-center justify-between text-xs text-slate-400 font-semibold">
            <span>Taux de Réussite Global</span>
            <Target className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-3xl font-black text-amber-400 font-mono">{winRate}%</div>
          <div className="text-xs text-slate-400">{wins} gagnants sur {totalTrades} positions</div>
        </div>

        {/* Discipline Score Box */}
        <div className="bg-[#111615] border border-[#1B2320] p-5 rounded-2xl space-y-2 shadow-lg">
          <div className="flex items-center justify-between text-xs text-slate-400 font-semibold">
            <span>Indice de Discipline</span>
            <Brain className="w-4 h-4 text-purple-400" />
          </div>
          <div className="text-3xl font-black text-purple-400 font-mono">{disciplineScore}%</div>
          <div className="text-xs text-slate-400">Respect strict du Risk Management</div>
        </div>

        {/* Course Progression Box */}
        <div className="bg-[#111615] border border-[#1B2320] p-5 rounded-2xl space-y-2 shadow-lg">
          <div className="flex items-center justify-between text-xs text-slate-400 font-semibold">
            <span>Avancement Académie</span>
            <Award className="w-4 h-4 text-rose-400" />
          </div>
          <div className="text-3xl font-black text-white font-mono">{courseCompletionPercentage}%</div>
          <div className="text-xs text-slate-400">Modules de cours théoriques validés</div>
        </div>
      </div>

      {/* Charts Row 1: Equity Curve & Strategy Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Equity Curve Area Chart */}
        <div className="lg:col-span-2 bg-[#111615] border border-[#1B2320] p-6 rounded-2xl space-y-4 shadow-xl">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold text-white">Courbe d'Équité du Capital</h3>
              <p className="text-xs text-slate-400">Évolution nette du compte de trading</p>
            </div>
            <span
              className={`text-xs font-mono font-bold px-2.5 py-1 rounded border ${
                totalPnL >= 0
                  ? "text-[#00E676] bg-[#00E676]/10 border-[#00E676]/20"
                  : "text-rose-400 bg-rose-500/10 border-rose-500/20"
              }`}
            >
              {totalPnL >= 0 ? "+" : ""}
              {formatCurrency(totalPnL)} net
            </span>
          </div>

          <div className="h-72 w-full pt-4">
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
                <Tooltip
                  contentStyle={{ backgroundColor: "#0f172a", borderColor: "#334155", borderRadius: "12px", fontSize: "12px" }}
                  labelStyle={{ color: "#ffffff" }}
                  itemStyle={{ color: "#ffffff" }}
                  formatter={(value: any) => [formatCurrency(Number(value)), "Capital"]}
                />
                <Area
                  type="monotone"
                  dataKey="capital"
                  stroke="#00E676"
                  strokeWidth={3}
                  fillOpacity={1}
                  fill="url(#colorCapital)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Win Rate by Strategy Bar Chart */}
        <div className="bg-[#111615] border border-[#1B2320] p-6 rounded-2xl space-y-4 shadow-xl">
          <div>
            <h3 className="text-base font-bold text-white">Taux de Réussite par Stratégie</h3>
            <p className="text-xs text-slate-400">Pourcentage de gain selon la configuration</p>
          </div>

          <div className="h-72 w-full pt-2">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={strategyChartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1B2320" />
                <XAxis dataKey="strategy" stroke="#475569" fontSize={10} interval={0} angle={-15} textAnchor="end" />
                <YAxis stroke="#475569" fontSize={11} unit="%" />
                <Tooltip
                  contentStyle={{ backgroundColor: "#0f172a", borderColor: "#334155", borderRadius: "12px", fontSize: "12px" }}
                  labelStyle={{ color: "#ffffff" }}
                  itemStyle={{ color: "#ffffff" }}
                  formatter={(value: any) => [`${value}%`, "Win Rate"]}
                />
                <Bar dataKey="winRate" radius={[6, 6, 0, 0]}>
                  {strategyChartData.map((entry, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={entry.winRate >= 60 ? "#10b981" : entry.winRate >= 40 ? "#f59e0b" : "#f43f5e"}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Charts Row 2: Psychology & Emotion vs Profitability */}
      <div className="bg-[#111615] border border-[#1B2320] p-6 rounded-2xl space-y-4 shadow-xl">
        <div>
          <h3 className="text-base font-bold text-white flex items-center gap-2">
            <Brain className="w-5 h-5 text-purple-400" />
            Impact Psychologique & Émotionnel sur la Rentabilité
          </h3>
          <p className="text-xs text-slate-400">
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
                contentStyle={{ backgroundColor: "#0f172a", borderColor: "#334155", borderRadius: "12px", fontSize: "12px" }}
                labelStyle={{ color: "#ffffff" }}
                itemStyle={{ color: "#ffffff" }}
                formatter={(value: any, _name: any, props: any) => [
                  `${formatCurrency(Number(value))} (${props?.payload?.tradesCount ?? 0} trade${
                    (props?.payload?.tradesCount ?? 0) > 1 ? "s" : ""
                  })`,
                  "PnL Total",
                ]}
              />
              <Bar dataKey="pnl" radius={[6, 6, 0, 0]}>
                {emotionChartData.map((entry, index) => (
                  <Cell
                    key={`cell-emotion-${index}`}
                    fill={entry.tradesCount === 0 ? "#475569" : entry.pnl >= 0 ? "#10b981" : "#f43f5e"}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Insight Callout */}
        <div className="p-4 rounded-xl bg-[#0D1110] border border-[#1B2320] text-xs text-slate-300 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
          <div>
            <strong className="text-amber-400">Constat Psychologique Clé : </strong>
            Vos positions prises avec un état <span className="text-[#00E676] font-bold">Discipliné / Calme</span> génèrent 100% de vos bénéfices nets. Les trades pris sous impulsion <span className="text-rose-400 font-bold">FOMO</span> sont responsables de la totalité de votre Drawdown.
          </div>
        </div>
      </div>

      {/* Charts Row 3: Actif & Direction */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* PnL par Actif */}
        <div className="bg-[#111615] border border-[#1B2320] p-6 rounded-2xl space-y-4 shadow-xl">
          <div>
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-[#00E676]" />
              PnL Net par Actif
            </h3>
            <p className="text-xs text-slate-400">Rentabilité selon la paire tradée (top 8 par volume)</p>
          </div>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={pairChartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1B2320" />
                <XAxis dataKey="pair" stroke="#475569" fontSize={11} />
                <YAxis stroke="#475569" fontSize={11} tickFormatter={(val) => formatCurrency(Number(val))} />
                <Tooltip
                  contentStyle={{ backgroundColor: "#0f172a", borderColor: "#334155", borderRadius: "12px", fontSize: "12px" }}
                  labelStyle={{ color: "#ffffff" }}
                  itemStyle={{ color: "#ffffff" }}
                  formatter={(value: any) => [formatCurrency(Number(value)), "PnL Total"]}
                />
                <Bar dataKey="pnl" radius={[6, 6, 0, 0]}>
                  {pairChartData.map((entry, index) => (
                    <Cell key={`cell-pair-${index}`} fill={entry.pnl >= 0 ? "#10b981" : "#f43f5e"} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* PnL par Direction */}
        <div className="bg-[#111615] border border-[#1B2320] p-6 rounded-2xl space-y-4 shadow-xl">
          <div>
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <ArrowUpRight className="w-5 h-5 text-[#00E676]" />
              PnL Net par Direction
            </h3>
            <p className="text-xs text-slate-400">Rentabilité Long vs Short</p>
          </div>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={directionChartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1B2320" />
                <XAxis dataKey="direction" stroke="#475569" fontSize={12} />
                <YAxis stroke="#475569" fontSize={11} tickFormatter={(val) => formatCurrency(Number(val))} />
                <Tooltip
                  contentStyle={{ backgroundColor: "#0f172a", borderColor: "#334155", borderRadius: "12px", fontSize: "12px" }}
                  labelStyle={{ color: "#ffffff" }}
                  itemStyle={{ color: "#ffffff" }}
                  formatter={(value: any) => [formatCurrency(Number(value)), "PnL Total"]}
                />
                <Bar dataKey="pnl" radius={[6, 6, 0, 0]} barSize={80}>
                  {directionChartData.map((entry, index) => (
                    <Cell key={`cell-dir-${index}`} fill={entry.pnl >= 0 ? "#10b981" : "#f43f5e"} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Charts Row 4: Jour de la Semaine & Session de Marché */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* PnL par Jour de la Semaine */}
        <div className="bg-[#111615] border border-[#1B2320] p-6 rounded-2xl space-y-4 shadow-xl">
          <div>
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <Clock className="w-5 h-5 text-amber-400" />
              PnL Net par Jour de la Semaine
            </h3>
            <p className="text-xs text-slate-400">Identifie tes meilleurs et pires jours de trading</p>
          </div>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={dayChartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1B2320" />
                <XAxis dataKey="day" stroke="#475569" fontSize={12} />
                <YAxis stroke="#475569" fontSize={11} tickFormatter={(val) => formatCurrency(Number(val))} />
                <Tooltip
                  contentStyle={{ backgroundColor: "#0f172a", borderColor: "#334155", borderRadius: "12px", fontSize: "12px" }}
                  labelStyle={{ color: "#ffffff" }}
                  itemStyle={{ color: "#ffffff" }}
                  formatter={(value: any) => [formatCurrency(Number(value)), "PnL Total"]}
                />
                <Bar dataKey="pnl" radius={[6, 6, 0, 0]}>
                  {dayChartData.map((entry, index) => (
                    <Cell key={`cell-day-${index}`} fill={entry.pnl >= 0 ? "#10b981" : "#f43f5e"} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* PnL par Session de Marché */}
        <div className="bg-[#111615] border border-[#1B2320] p-6 rounded-2xl space-y-4 shadow-xl">
          <div>
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <Clock className="w-5 h-5 text-amber-400" />
              PnL Net par Session de Marché
            </h3>
            <p className="text-xs text-slate-400">
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
                  <Tooltip
                    contentStyle={{ backgroundColor: "#0f172a", borderColor: "#334155", borderRadius: "12px", fontSize: "12px" }}
                    labelStyle={{ color: "#ffffff" }}
                    itemStyle={{ color: "#ffffff" }}
                    formatter={(value: any) => [formatCurrency(Number(value)), "PnL Total"]}
                  />
                  <Bar dataKey="pnl" radius={[6, 6, 0, 0]}>
                    {sessionChartData.map((entry, index) => (
                      <Cell key={`cell-session-${index}`} fill={entry.pnl >= 0 ? "#10b981" : "#f43f5e"} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </div>

      {/* Charts Row 5: Erreurs les plus fréquentes */}
      {mistakeChartData.length === 0 ? (
        <div className="bg-[#111615] border border-[#1B2320] p-6 rounded-2xl shadow-xl">
          <h3 className="text-base font-bold text-white flex items-center gap-2 mb-2">
            <RotateCcw className="w-5 h-5 text-rose-400" />
            Erreurs les plus fréquentes
          </h3>
          <p className="text-xs text-slate-500 italic">
            Aucune erreur taguée pour l'instant. Tague les erreurs commises directement sur un trade
            dans le Journal (champ « Erreurs Commises ») pour voir apparaître ces statistiques.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Liste des erreurs les plus fréquentes */}
          <div className="bg-[#111615] border border-[#1B2320] p-6 rounded-2xl space-y-4 shadow-xl">
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <RotateCcw className="w-5 h-5 text-rose-400" />
                Erreurs les plus fréquentes
              </h3>
              <p className="text-xs text-slate-400">Classées par nombre d'occurrences</p>
            </div>
            <div className="space-y-2">
              {mistakeChartData.map((m) => (
                <div
                  key={m.mistake}
                  className="p-3.5 rounded-xl bg-[#0D1110] border border-[#1B2320] flex items-center justify-between"
                >
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
          </div>

          {/* Coût total des erreurs */}
          <div className="bg-[#111615] border border-[#1B2320] p-6 rounded-2xl space-y-4 shadow-xl">
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-rose-400" />
                Coût Total des Erreurs
              </h3>
            </div>
            <div className="space-y-1">
              <div className="text-3xl font-black text-rose-400 font-mono">
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
                  <Tooltip
                    contentStyle={{ backgroundColor: "#0f172a", borderColor: "#334155", borderRadius: "12px", fontSize: "12px" }}
                    labelStyle={{ color: "#ffffff" }}
                    itemStyle={{ color: "#ffffff" }}
                    formatter={(value: any) => [formatCurrency(Number(value)), "Coût"]}
                  />
                  <Bar dataKey="cost" radius={[0, 6, 6, 0]} fill="#f43f5e" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
