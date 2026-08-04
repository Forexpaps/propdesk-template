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
  Sparkles,
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
  const [aiReport, setAiReport] = useState<string | null>(null);
  const [isGeneratingAiReport, setIsGeneratingAiReport] = useState(false);

  // 1. Calculate Equity Curve Data
  const sortedTrades = [...trades].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
  );

  let runningCapital = student.startingCapital;
  const equityData = [
    { date: "Début (15 Jan)", capital: student.startingCapital, pnl: 0 },
    ...sortedTrades.map((t, idx) => {
      runningCapital += t.pnl;
      return {
        date: `Trade #${idx + 1} (${t.pair})`,
        capital: runningCapital,
        pnl: t.pnl,
      };
    }),
  ];

  // 2. Performance by Strategy Data
  const strategyStats: Record<string, { wins: number; total: number; pnl: number }> = {};
  trades.forEach((t) => {
    if (!strategyStats[t.strategy]) {
      strategyStats[t.strategy] = { wins: 0, total: 0, pnl: 0 };
    }
    strategyStats[t.strategy].total += 1;
    if (t.result === "WIN") strategyStats[t.strategy].wins += 1;
    strategyStats[t.strategy].pnl += t.pnl;
  });

  const strategyChartData = Object.keys(strategyStats).map((strat) => ({
    strategy: strat,
    winRate: Math.round((strategyStats[strat].wins / strategyStats[strat].total) * 100),
    pnl: strategyStats[strat].pnl,
    tradesCount: strategyStats[strat].total,
  }));

  // 3. Performance by Emotion Data
  const emotionStats: Record<string, { wins: number; total: number; pnl: number }> = {};
  trades.forEach((t) => {
    if (!emotionStats[t.emotion]) {
      emotionStats[t.emotion] = { wins: 0, total: 0, pnl: 0 };
    }
    emotionStats[t.emotion].total += 1;
    if (t.result === "WIN") emotionStats[t.emotion].wins += 1;
    emotionStats[t.emotion].pnl += t.pnl;
  });

  const emotionChartData = Object.keys(emotionStats).map((em) => ({
    emotion:
      em === "Disciplined"
        ? "Discipliné"
        : em === "FOMO"
        ? "FOMO"
        : em === "Impulsive"
        ? "Impulsif"
        : em === "Calm"
        ? "Calme"
        : em,
    winRate: Math.round((emotionStats[em].wins / emotionStats[em].total) * 100),
    pnl: emotionStats[em].pnl,
  }));

  // General Metrics
  const totalTrades = trades.length;
  const wins = trades.filter((t) => t.result === "WIN").length;
  const winRate = totalTrades > 0 ? Math.round((wins / totalTrades) * 100) : 0;
  const totalPnL = trades.reduce((acc, t) => acc + t.pnl, 0);

  const disciplinedCount = trades.filter(
    (t) => t.emotion === "Disciplined" || t.emotion === "Calm"
  ).length;
  const disciplineScore = totalTrades > 0 ? Math.round((disciplinedCount / totalTrades) * 100) : 100;

  // Generate Global AI Performance Audit
  const generateAiGlobalAudit = async () => {
    setIsGeneratingAiReport(true);
    try {
      const response = await fetch("/api/coach/ai-review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question: `
Voici le résumé des performances de l'élève Alexandre Vance:
- Taux de réussite global: ${winRate}% sur ${totalTrades} trades
- Capital actuel: ${student.currentCapital} € (Starting: ${student.startingCapital} €)
- Score de discipline émotionnelle: ${disciplineScore}%
- Performance par stratégie: ${JSON.stringify(strategyChartData)}
- Performance par émotion: ${JSON.stringify(emotionChartData)}
- Progression dans les modules vidéo: ${courseCompletionPercentage}%

Veuillez rédiger un bilan pédagogique personnalisé et motivant en français de 3 paragraphes comprenant :
1. Un diagnostic général de sa progression technique et émotionnelle.
2. Ses 2 plus gros points forts (ex: maîtrise de la stratégie SMC, patience).
3. Son plan d'action prioritaire en 3 étapes pour atteindre la régularité absolue.
`,
        }),
      });

      const data = await response.json();
      if (data.data?.coachFeedback) {
        setAiReport(data.data.coachFeedback);
      } else {
        setAiReport("L'analyse AI des performances est prête. Continuez à appliquer la discipline !");
      }
    } catch (err) {
      console.error(err);
      setAiReport("Audit indisponible actuellement. Réessayez plus tard.");
    } finally {
      setIsGeneratingAiReport(false);
    }
  };

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
            Analyse Complète de la Performance Éleve
          </h1>
          <p className="text-slate-400 text-xs sm:text-sm max-w-2xl">
            Visualisez la trajectoire de votre capital, la rentabilité par stratégie et la corrélation directe entre votre état d'esprit et vos résultats.
          </p>
        </div>

        <button
          onClick={generateAiGlobalAudit}
          disabled={isGeneratingAiReport}
          className="flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-gradient-to-r from-amber-500 to-amber-400 text-slate-950 font-bold text-xs shadow-lg shadow-amber-500/20 hover:brightness-110 transition-all cursor-pointer shrink-0"
        >
          <Sparkles className="w-4 h-4" />
          <span>{isGeneratingAiReport ? "Génération de l'Audit..." : "Générer un Audit IA Globale"}</span>
        </button>
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
            {student.currentCapital.toLocaleString("fr-FR")} €
          </div>
          <div className="text-xs text-slate-400 flex items-center gap-1">
            <span className="text-[#00E676] font-bold flex items-center">
              <ArrowUpRight className="w-3.5 h-3.5" /> +24.5%
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

      {/* Global AI Performance Report (If Generated) */}
      {aiReport && (
        <div className="bg-gradient-to-r from-amber-500/10 via-[#111615] to-[#111615] border border-amber-500/30 p-6 rounded-2xl space-y-4 shadow-xl">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-amber-400" />
              <h3 className="text-lg font-extrabold text-white">Rapport d'Audit de Performance du Coach IA</h3>
            </div>
            <button
              onClick={() => setAiReport(null)}
              className="text-xs text-slate-400 hover:text-white"
            >
              Fermer
            </button>
          </div>

          <div className="text-xs sm:text-sm text-slate-200 leading-relaxed whitespace-pre-wrap border-l-2 border-amber-400 pl-4 bg-[#0D1110]/40 p-4 rounded-xl">
            {aiReport}
          </div>
        </div>
      )}

      {/* Charts Row 1: Equity Curve & Strategy Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Equity Curve Area Chart */}
        <div className="lg:col-span-2 bg-[#111615] border border-[#1B2320] p-6 rounded-2xl space-y-4 shadow-xl">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold text-white">Courbe d'Équité du Capital (€)</h3>
              <p className="text-xs text-slate-400">Évolution nette du compte de trading</p>
            </div>
            <span className="text-xs font-mono font-bold text-[#00E676] bg-[#00E676]/10 px-2.5 py-1 rounded border border-[#00E676]/20">
              +{totalPnL} € net
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
                  formatter={(value: any) => [`${value} €`, "Capital"]}
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
            Impact Psychologique & Émotionnel sur la Rentabilité (€)
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
              <YAxis stroke="#475569" fontSize={11} unit=" €" />
              <Tooltip
                contentStyle={{ backgroundColor: "#0f172a", borderColor: "#334155", borderRadius: "12px", fontSize: "12px" }}
                formatter={(value: any) => [`${value} €`, "PnL Total"]}
              />
              <Bar dataKey="pnl" radius={[6, 6, 0, 0]}>
                {emotionChartData.map((entry, index) => (
                  <Cell
                    key={`cell-emotion-${index}`}
                    fill={entry.pnl >= 0 ? "#10b981" : "#f43f5e"}
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
    </div>
  );
};
