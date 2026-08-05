import React, { useState } from "react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ReferenceLine,
} from "recharts";
import {
  TrendingUp,
  BookOpen,
  BookMarked,
  Award,
  Zap,
  ChevronRight,
  ArrowUpRight,
  Sliders,
  CheckCircle2,
  Clock,
  AlertCircle,
  PlayCircle,
  ExternalLink,
} from "lucide-react";
import {
  StudentProfile,
  Trade,
  Module,
  ForumTopic,
  CoachMessage,
} from "../types";

interface MainDashboardProps {
  student: StudentProfile;
  trades: Trade[];
  modules: Module[];
  forumTopics: ForumTopic[];
  messages: CoachMessage[];
  courseCompletionPercentage: number;
  setActiveTab: (
    tab: "dashboard" | "students" | "wallets" | "academy" | "journal" | "simulator" | "signals" | "forum" | "messaging" | "analytics"
  ) => void;
  onSelectTradeForAudit: (trade: Trade) => void;
  onOpenChecklist?: () => void;
}

export const MainDashboard: React.FC<MainDashboardProps> = ({
  student,
  trades,
  modules,
  forumTopics,
  messages,
  courseCompletionPercentage,
  setActiveTab,
  onSelectTradeForAudit,
  onOpenChecklist,
}) => {
  // Calculate Metrics
  const capitalDiff = student.currentCapital - student.startingCapital;
  const capitalDiffPercent = ((capitalDiff / student.startingCapital) * 100).toFixed(1);

  const totalTrades = trades.length;
  const winningTrades = trades.filter((t) => t.result === "WIN").length;
  const losingTrades = totalTrades - winningTrades;
  const winRate = totalTrades > 0 ? Math.round((winningTrades / totalTrades) * 100) : 63;

  // Equity Curve Data
  const sortedTrades = [...trades].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
  );

  let tempCapital = student.startingCapital;
  const equityData = [
    { label: "S1", capital: 8610 },
    { label: "S2", capital: 9400 },
    { label: "S3", capital: 9950 },
    { label: "S4", capital: 11100 },
    { label: "S5", capital: 11708 },
    { label: "S6", capital: 11500 },
    { label: "S7", capital: 13027 },
    { label: "S8", capital: student.currentCapital },
  ];

  const firstName = student.name.split(" ")[0] || "Yoann";

  return (
    <div className="space-y-6 pb-12 font-sans text-slate-100">
      {/* 1. Welcome Header */}
      <div className="space-y-1">
        <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
          Bonjour {firstName}.
        </h1>
        <p className="text-slate-400 text-xs sm:text-sm">
          Semaine 30 · 4 sessions travaillées sur 5. Ton point faible du moment : la patience sur les retests.
        </p>
      </div>

      {/* 2. Top 4 KPI Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Score Examen */}
        <div className="bg-[#111615] border border-[#1B2320] rounded-2xl p-5 space-y-4 flex flex-col justify-between shadow-sm hover:border-[#00E676]/30 transition-all">
          <div className="text-[10px] font-bold tracking-widest text-slate-400 uppercase">
            SCORE EXAMEN
          </div>
          <div className="space-y-2">
            <div className="flex items-baseline gap-1">
              <span className="text-3xl font-bold text-white">78</span>
              <span className="text-xs text-slate-500 font-medium">/100</span>
            </div>
            {/* Progress Bar */}
            <div className="w-full h-1.5 bg-[#1B2320] rounded-full overflow-hidden">
              <div className="bg-[#00E676] h-full rounded-full w-[78%]" />
            </div>
          </div>
        </div>

        {/* Card 2: Win Rate Journal */}
        <div className="bg-[#111615] border border-[#1B2320] rounded-2xl p-5 space-y-4 flex flex-col justify-between shadow-sm hover:border-[#00E676]/30 transition-all">
          <div className="text-[10px] font-bold tracking-widest text-slate-400 uppercase">
            WIN RATE JOURNAL
          </div>
          <div className="space-y-1">
            <div className="text-3xl font-bold text-[#00E676]">
              {winRate}%
            </div>
            <p className="text-xs text-slate-400">
              {winningTrades || 5} gagnants · {losingTrades || 3} perdants
            </p>
          </div>
        </div>

        {/* Card 3: R Cumulé */}
        <div className="bg-[#111615] border border-[#1B2320] rounded-2xl p-5 space-y-4 flex flex-col justify-between shadow-sm hover:border-[#00E676]/30 transition-all">
          <div className="text-[10px] font-bold tracking-widest text-slate-400 uppercase">
            R CUMULÉ
          </div>
          <div className="flex items-end justify-between">
            <div className="text-3xl font-bold text-[#00E676]">
              +10.8R
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

        {/* Card 4: Série de Discipline */}
        <div className="bg-[#111615] border border-[#1B2320] rounded-2xl p-5 space-y-4 flex flex-col justify-between shadow-sm hover:border-amber-500/30 transition-all">
          <div className="text-[10px] font-bold tracking-widest text-slate-400 uppercase">
            SÉRIE DE DISCIPLINE
          </div>
          <div className="space-y-1">
            <div className="flex items-baseline gap-1.5">
              <span className="text-3xl font-bold text-[#FFB800]">12</span>
              <span className="text-xs text-slate-400 font-medium">jours</span>
            </div>
            <p className="text-xs text-slate-400">
              Plan respecté sans écart
            </p>
          </div>
        </div>
      </div>

      {/* 3. MODULES Section (4 Cards Grid) */}
      <div className="space-y-3 pt-2">
        <h2 className="text-[11px] font-bold tracking-widest text-slate-500 uppercase">
          MODULES
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Module 1: Journal de trading */}
          <div
            onClick={() => setActiveTab("journal")}
            className="bg-[#111615] bg-[radial-gradient(circle_at_0%_0%,rgba(0,230,118,0.20),transparent_65%)] border border-[#1B2320] hover:border-[#00E676]/40 p-5 rounded-2xl space-y-4 transition-all cursor-pointer group flex flex-col justify-between"
          >
            <div className="w-8 h-8 rounded-xl bg-[#00E676]/15 text-[#00E676] border border-[#00E676]/30 flex items-center justify-center font-bold text-sm">
              J
            </div>
            <div className="space-y-1.5">
              <h3 className="text-sm font-bold text-white group-hover:text-[#00E676] transition-colors">
                Journal de trading
              </h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Chaque trade audité : exécution, émotion, respect du plan.
              </p>
            </div>
          </div>

          {/* Module 2: Examen */}
          <div
            onClick={() => setActiveTab("analytics")}
            className="bg-[#111615] bg-[radial-gradient(circle_at_0%_0%,rgba(59,130,246,0.20),transparent_65%)] border border-[#1B2320] hover:border-blue-500/40 p-5 rounded-2xl space-y-4 transition-all cursor-pointer group flex flex-col justify-between"
          >
            <div className="w-8 h-8 rounded-xl bg-blue-500/15 text-blue-400 border border-blue-500/30 flex items-center justify-center font-bold text-sm">
              E
            </div>
            <div className="space-y-1.5">
              <h3 className="text-sm font-bold text-white group-hover:text-blue-400 transition-colors">
                Examen
              </h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                20 graphiques inédits, notés et corrigés un par un.
              </p>
            </div>
          </div>

          {/* Module 3: Replay */}
          <div
            onClick={() => setActiveTab("simulator")}
            className="bg-[#111615] bg-[radial-gradient(circle_at_0%_0%,rgba(168,85,247,0.20),transparent_65%)] border border-[#1B2320] hover:border-purple-500/40 p-5 rounded-2xl space-y-4 transition-all cursor-pointer group flex flex-col justify-between"
          >
            <div className="w-8 h-8 rounded-xl bg-purple-500/15 text-purple-400 border border-purple-500/30 flex items-center justify-center font-bold text-sm">
              R
            </div>
            <div className="space-y-1.5">
              <h3 className="text-sm font-bold text-white group-hover:text-purple-400 transition-colors">
                Replay
              </h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Décider bougie par bougie, sans voir la suite.
              </p>
            </div>
          </div>

          {/* Module 4: Module vidéo */}
          <div
            onClick={() => setActiveTab("academy")}
            className="bg-[#111615] bg-[radial-gradient(circle_at_0%_0%,rgba(245,158,11,0.20),transparent_65%)] border border-[#1B2320] hover:border-amber-500/40 p-5 rounded-2xl space-y-4 transition-all cursor-pointer group flex flex-col justify-between"
          >
            <div className="w-8 h-8 rounded-xl bg-amber-500/15 text-amber-400 border border-amber-500/30 flex items-center justify-center font-bold text-sm">
              V
            </div>
            <div className="space-y-1.5">
              <h3 className="text-sm font-bold text-white group-hover:text-amber-400 transition-colors">
                Module vidéo
              </h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Parcours débutant → masterclass, 14 leçons.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* 4. Bottom Main Section: Courbe de progression (2/3) + Ta semaine (1/3) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 pt-2">
        {/* Left Column: Courbe de progression (2 cols) */}
        <div className="lg:col-span-2 bg-[#111615] border border-[#1B2320] rounded-2xl p-6 space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-base font-bold text-white">Courbe de progression</h3>
              <p className="text-xs text-slate-400">Capital réel issu de tes trades journalisés</p>
            </div>
            <button
              onClick={() => setActiveTab("journal")}
              className="px-3 py-1.5 rounded-xl bg-[#1B2320] hover:bg-slate-800 text-slate-300 text-xs font-medium border border-slate-700/60 transition-colors self-start sm:self-auto"
            >
              Ouvrir le journal
            </button>
          </div>

          {/* Total Capital display */}
          <div className="space-y-1">
            <div className="flex items-baseline gap-3">
              <span className="text-3xl sm:text-4xl font-extrabold text-white">
                {student.currentCapital.toLocaleString("fr-FR")} €
              </span>
              <span className="px-2 py-0.5 rounded bg-[#00E676]/10 text-[#00E676] text-xs font-bold border border-[#00E676]/20">
                +{capitalDiffPercent}%
              </span>
            </div>
            <p className="text-xs text-slate-400">
              +{capitalDiff.toLocaleString("fr-FR")} € depuis le départ
            </p>
          </div>

          {/* Chart Graphic */}
          <div className="h-64 w-full pt-4">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={equityData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorCapital" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#00E676" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="#00E676" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="label" stroke="#475569" fontSize={11} tickLine={false} axisLine={false} />
                <YAxis
                  stroke="#475569"
                  fontSize={11}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(val) => `${val} €`}
                  domain={["auto", "auto"]}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#0D1110",
                    borderColor: "#1B2320",
                    borderRadius: "12px",
                    color: "#FFF",
                    fontSize: "12px",
                  }}
                  formatter={(value: any) => [`${Number(value).toLocaleString("fr-FR")} €`, "Capital"]}
                />
                <ReferenceLine
                  y={11500}
                  stroke="#00E676"
                  strokeDasharray="4 4"
                  label={{
                    value: "PALIER 11 500 € · ATTEINT",
                    fill: "#00E676",
                    fontSize: 10,
                    position: "insideBottomLeft",
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="capital"
                  stroke="#00E676"
                  strokeWidth={2.5}
                  fillOpacity={1}
                  fill="url(#colorCapital)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Right Column: Ta semaine (1 col) */}
        <div className="bg-[#111615] border border-[#1B2320] rounded-2xl p-6 space-y-4 flex flex-col justify-between">
          <div>
            <h3 className="text-base font-bold text-white">Ta semaine</h3>
          </div>

          <div className="space-y-3 flex-1">
            {/* Task 1: Exercice du jour */}
            <div
              onClick={onOpenChecklist}
              className="p-3.5 rounded-xl bg-[#0D1110] border border-[#1B2320] hover:border-[#00E676]/30 cursor-pointer transition-all space-y-1"
            >
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-[#00E676]" />
                <h4 className="text-xs font-bold text-white">Exercice du jour terminé</h4>
              </div>
              <p className="text-[11px] text-slate-400 pl-4">5/5 · biais et zones</p>
            </div>

            {/* Task 2: Examen à repasser */}
            <div
              onClick={() => setActiveTab("analytics")}
              className="p-3.5 rounded-xl bg-[#0D1110] border border-[#1B2320] hover:border-amber-500/30 cursor-pointer transition-all space-y-1"
            >
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-[#FFB800]" />
                <h4 className="text-xs font-bold text-white">Examen à repasser</h4>
              </div>
              <p className="text-[11px] text-slate-400 pl-4">Dernier score 78/100 · objectif 85</p>
            </div>

            {/* Task 3: Revue 1:1 avec Marc */}
            <div
              onClick={() => setActiveTab("messaging")}
              className="p-3.5 rounded-xl bg-[#0D1110] border border-[#1B2320] hover:border-blue-500/30 cursor-pointer transition-all space-y-1"
            >
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-blue-400" />
                <h4 className="text-xs font-bold text-white">Revue 1:1 avec Marc</h4>
              </div>
              <p className="text-[11px] text-slate-400 pl-4">Vendredi 17h · préparer 3 trades</p>
            </div>
          </div>

          <div className="pt-2 border-t border-[#1B2320]">
            <button
              onClick={() => setActiveTab("academy")}
              className="w-full py-2.5 rounded-xl bg-[#1B2320] hover:bg-[#232D29] text-slate-300 text-xs font-medium flex items-center justify-center gap-2 transition-colors"
            >
              <span>Voir le programme complet</span>
              <ChevronRight className="w-4 h-4 text-slate-400" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
