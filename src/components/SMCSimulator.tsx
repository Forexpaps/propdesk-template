import React, { useState } from "react";
import {
  Play,
  RotateCcw,
  CheckCircle2,
  XCircle,
  HelpCircle,
  Award,
  Zap,
  TrendingUp,
  ArrowUpRight,
  ArrowDownRight,
  Sparkles,
  Eye,
  ChevronRight,
  Clock,
  BookOpen,
  BarChart3,
  Calculator,
  ShieldCheck,
  RefreshCw
} from "lucide-react";
import { BacktestScenario, TradeDirection } from "../types";

interface SMCSimulatorProps {
  scenarios: BacktestScenario[];
}

export const SMCSimulator: React.FC<SMCSimulatorProps> = ({ scenarios }) => {
  const [activeTab, setActiveTab] = useState<"REPLAY" | "MONTE_CARLO">("REPLAY");

  const [activeScenarioId, setActiveScenarioId] = useState<string>(
    scenarios[0]?.id || ""
  );

  const scenario = scenarios.find((s) => s.id === activeScenarioId) || scenarios[0];

  // Simulator choices
  const [userDirection, setUserDirection] = useState<TradeDirection>("LONG");
  const [userLot, setUserLot] = useState<number>(1.0);
  const [userSL, setUserSL] = useState<number>(scenario?.suggestedSL || 0);
  const [userTP, setUserTP] = useState<number>(scenario?.suggestedTP || 0);
  const [isExecuted, setIsExecuted] = useState<boolean>(false);
  const [userScore, setUserScore] = useState<number>(1250);

  // Monte Carlo state
  const [initialCapital, setInitialCapital] = useState<number>(100000);
  const [winRate, setWinRate] = useState<number>(55);
  const [riskReward, setRiskReward] = useState<number>(2.5);
  const [riskPercent, setRiskPercent] = useState<number>(1.0);
  const [numTrades, setNumTrades] = useState<number>(50);
  const [simTrigger, setSimTrigger] = useState<number>(0);

  const handleSelectScenario = (scen: BacktestScenario) => {
    setActiveScenarioId(scen.id);
    setUserDirection(scen.suggestedDirection);
    setUserSL(scen.suggestedSL);
    setUserTP(scen.suggestedTP);
    setIsExecuted(false);
  };

  const isUserCorrect = userDirection === scenario.suggestedDirection;

  // Monte Carlo calculation
  const runMonteCarlo = () => {
    let balance = initialCapital;
    let peak = initialCapital;
    let maxDrawdown = 0;
    let wins = 0;

    for (let i = 0; i < numTrades; i++) {
      const isWin = Math.random() * 100 < winRate;
      const riskAmount = balance * (riskPercent / 100);
      if (isWin) {
        wins++;
        balance += riskAmount * riskReward;
      } else {
        balance -= riskAmount;
      }
      if (balance > peak) peak = balance;
      const dd = ((peak - balance) / peak) * 100;
      if (dd > maxDrawdown) maxDrawdown = dd;
    }

    const netProfit = balance - initialCapital;
    const netReturnPercent = (netProfit / initialCapital) * 100;
    const passChallengeProb = Math.min(
      98,
      Math.max(10, Math.round(netReturnPercent >= 10 && maxDrawdown < 10 ? 88 : netReturnPercent >= 5 ? 65 : 30))
    );

    return {
      finalBalance: Math.round(balance),
      netProfit: Math.round(netProfit),
      netReturnPercent: Number(netReturnPercent.toFixed(1)),
      maxDrawdown: Number(maxDrawdown.toFixed(1)),
      passChallengeProb,
      wins,
      losses: numTrades - wins,
    };
  };

  const mcResult = runMonteCarlo();

  return (
    <div className="space-y-6">
      {/* Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-900 to-indigo-950/50 p-6 rounded-2xl border border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-6 shadow-xl relative overflow-hidden">
        <div className="space-y-2 z-10">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 text-xs font-mono font-bold">
            <Zap className="w-3.5 h-3.5" /> Simulateur de Backtesting & Replay SMC
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
            Entraînez-vous sur des Setups Réels Historiques
          </h1>
          <p className="text-slate-400 text-sm max-w-2xl">
            Développez vos réflexes d'exécution institutionnelle sans risquer un seul centime.
            Analysez la structure SMC, choisissez votre direction et testez la validité du trade.
          </p>
        </div>

        <div className="flex items-center gap-3 bg-slate-950 p-3 rounded-xl border border-slate-800 z-10 shrink-0">
          <Award className="w-8 h-8 text-indigo-400" />
          <div>
            <div className="text-[10px] text-slate-400 font-mono">Score de Rigueur Backtest</div>
            <div className="text-xl font-black text-indigo-300 font-mono">{userScore} XP</div>
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-800 pb-2">
        <button
          onClick={() => setActiveTab("REPLAY")}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
            activeTab === "REPLAY"
              ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/20"
              : "bg-slate-900 border border-slate-800 text-slate-400 hover:text-white"
          }`}
        >
          <Clock className="w-4 h-4" /> Replay Historique ({scenarios.length})
        </button>

        <button
          onClick={() => setActiveTab("MONTE_CARLO")}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
            activeTab === "MONTE_CARLO"
              ? "bg-[#00E676] text-slate-950 font-extrabold shadow-md shadow-[#00E676]/20"
              : "bg-slate-900 border border-slate-800 text-slate-400 hover:text-white"
          }`}
        >
          <BarChart3 className="w-4 h-4" /> Simulateur Monte Carlo & Compounding
        </button>
      </div>

      {activeTab === "MONTE_CARLO" ? (
        /* Monte Carlo Compounding View */
        <div className="bg-[#111615] border border-[#1B2320] rounded-2xl p-6 space-y-6 shadow-xl">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-[#1B2320] pb-4 gap-4">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#00E676]/10 text-[#00E676] border border-[#00E676]/20 text-xs font-mono font-bold">
                <Calculator className="w-3.5 h-3.5" /> Simulation Algorithmique de Projections
              </div>
              <h2 className="text-xl font-bold text-white mt-1">Simulateur de Probabilités Monte Carlo (50 Trades)</h2>
              <p className="text-xs text-slate-400">
                Calculez l'espérance mathématique théorique de votre stratégie et estimez vos chances de réussir un challenge Prop Firm.
              </p>
            </div>

            <button
              onClick={() => setSimTrigger((prev) => prev + 1)}
              className="px-4 py-2.5 rounded-xl bg-[#00E676] hover:bg-[#00c865] text-slate-950 font-extrabold text-xs flex items-center gap-2 shadow-md shrink-0 cursor-pointer"
            >
              <RefreshCw className="w-4 h-4" /> Relancer la Simulation
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            <div>
              <label className="block text-xs font-mono text-slate-400 mb-1">Capital Initial (€)</label>
              <input
                type="number"
                value={initialCapital}
                onChange={(e) => setInitialCapital(Number(e.target.value))}
                className="w-full bg-[#0D1110] border border-[#1B2320] rounded-xl px-3 py-2 text-white font-mono text-xs font-bold"
              />
            </div>

            <div>
              <label className="block text-xs font-mono text-slate-400 mb-1">Win Rate Estimé (%)</label>
              <input
                type="number"
                value={winRate}
                onChange={(e) => setWinRate(Number(e.target.value))}
                className="w-full bg-[#0D1110] border border-[#1B2320] rounded-xl px-3 py-2 text-white font-mono text-xs font-bold"
              />
            </div>

            <div>
              <label className="block text-xs font-mono text-slate-400 mb-1">Ratio R:R Moyen (1:X)</label>
              <input
                type="number"
                step="0.1"
                value={riskReward}
                onChange={(e) => setRiskReward(Number(e.target.value))}
                className="w-full bg-[#0D1110] border border-[#1B2320] rounded-xl px-3 py-2 text-white font-mono text-xs font-bold"
              />
            </div>

            <div>
              <label className="block text-xs font-mono text-slate-400 mb-1">Risque Par Trade (%)</label>
              <input
                type="number"
                step="0.1"
                value={riskPercent}
                onChange={(e) => setRiskPercent(Number(e.target.value))}
                className="w-full bg-[#0D1110] border border-[#1B2320] rounded-xl px-3 py-2 text-white font-mono text-xs font-bold"
              />
            </div>

            <div>
              <label className="block text-xs font-mono text-slate-400 mb-1">Nombre de Trades</label>
              <input
                type="number"
                value={numTrades}
                onChange={(e) => setNumTrades(Number(e.target.value))}
                className="w-full bg-[#0D1110] border border-[#1B2320] rounded-xl px-3 py-2 text-white font-mono text-xs font-bold"
              />
            </div>
          </div>

          {/* Result cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-2">
            <div className="bg-[#0D1110] border border-[#1B2320] p-4 rounded-xl space-y-1">
              <div className="text-[11px] text-slate-400 font-mono">Solde Final Projeté</div>
              <div className="text-2xl font-black text-[#00E676] font-mono">
                {mcResult.finalBalance.toLocaleString("fr-FR")} €
              </div>
              <div className="text-[10px] text-emerald-400">
                +{mcResult.netReturnPercent}% de rendement
              </div>
            </div>

            <div className="bg-[#0D1110] border border-[#1B2320] p-4 rounded-xl space-y-1">
              <div className="text-[11px] text-slate-400 font-mono">PnL Net Simulé</div>
              <div className={`text-2xl font-black font-mono ${mcResult.netProfit >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                {mcResult.netProfit >= 0 ? `+${mcResult.netProfit.toLocaleString("fr-FR")} €` : `${mcResult.netProfit.toLocaleString("fr-FR")} €`}
              </div>
              <div className="text-[10px] text-slate-500">
                {mcResult.wins} Win / {mcResult.losses} Loss
              </div>
            </div>

            <div className="bg-[#0D1110] border border-[#1B2320] p-4 rounded-xl space-y-1">
              <div className="text-[11px] text-slate-400 font-mono">Max Drawdown Estimé</div>
              <div className="text-2xl font-black text-rose-400 font-mono">
                -{mcResult.maxDrawdown}%
              </div>
              <div className="text-[10px] text-slate-500">Peak to trough</div>
            </div>

            <div className="bg-[#0D1110] border border-[#1B2320] p-4 rounded-xl space-y-1">
              <div className="text-[11px] text-slate-400 font-mono">Chances de Succès Prop Firm</div>
              <div className="text-2xl font-black text-amber-400 font-mono">
                {mcResult.passChallengeProb}%
              </div>
              <div className="text-[10px] text-slate-500">Seuil de validation +10%</div>
            </div>
          </div>
        </div>
      ) : (
        /* Main Grid: Scenario Selector & Replay Station */
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Scenarios Sidebar */}
        <div className="space-y-3 lg:col-span-1">
          <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider font-mono flex items-center gap-2">
            <Clock className="w-4 h-4 text-indigo-400" /> Cas d'Étude Disponibles ({scenarios.length})
          </h2>

          {scenarios.map((item) => {
            const isSelected = item.id === scenario.id;
            return (
              <div
                key={item.id}
                onClick={() => handleSelectScenario(item)}
                className={`p-4 rounded-xl border transition-all cursor-pointer space-y-2 ${
                  isSelected
                    ? "bg-slate-900 border-indigo-500 shadow-lg shadow-indigo-500/10"
                    : "bg-slate-950 border-slate-850 hover:border-slate-750"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-900 border border-slate-800 text-slate-300 font-mono">
                    {item.pair} • {item.timeframe}
                  </span>
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                      item.difficulty === "Débutant"
                        ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                        : item.difficulty === "Intermédiaire"
                        ? "bg-amber-500/10 text-amber-400 border border-amber-500/20"
                        : "bg-indigo-500/10 text-indigo-400 border border-indigo-500/20"
                    }`}
                  >
                    {item.difficulty}
                  </span>
                </div>

                <h3 className="text-xs font-bold text-white line-clamp-1">{item.title}</h3>
                <p className="text-[11px] text-slate-400 line-clamp-2">{item.smcPattern}</p>
              </div>
            );
          })}
        </div>

        {/* Replay Playground Station */}
        {scenario && (
          <div className="lg:col-span-2 bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-800 pb-4 gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 text-xs font-mono font-bold">
                    {scenario.pair}
                  </span>
                  <span className="text-xs text-slate-400 font-mono">{scenario.timeframe}</span>
                  <span className="text-xs text-amber-400 font-medium"> Pattern: {scenario.smcPattern}</span>
                </div>
                <h2 className="text-xl font-bold text-white mt-1">{scenario.title}</h2>
              </div>

              <button
                onClick={() => setIsExecuted(false)}
                className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold flex items-center gap-1.5"
              >
                <RotateCcw className="w-3.5 h-3.5" /> Réinitialiser
              </button>
            </div>

            {/* Scenario Chart Display */}
            <div className="relative rounded-xl overflow-hidden border border-slate-800 bg-slate-950 aspect-video flex items-center justify-center">
              <img
                src={scenario.chartUrl}
                alt={scenario.title}
                className="w-full h-full object-cover opacity-80"
              />

              {/* Chart Overlay Controls */}
              <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-transparent to-transparent p-4 flex flex-col justify-end">
                <div className="bg-slate-950/90 backdrop-blur-md p-3.5 rounded-xl border border-slate-800 space-y-1">
                  <div className="text-xs font-bold text-white flex items-center gap-1.5">
                    <Eye className="w-4 h-4 text-indigo-400" /> Contexte du marché
                  </div>
                  <p className="text-xs text-slate-300">{scenario.description}</p>
                </div>
              </div>
            </div>

            {/* Execution Controls Form */}
            {!isExecuted ? (
              <div className="bg-slate-950 p-5 rounded-xl border border-slate-850 space-y-4">
                <h3 className="text-xs font-bold text-white uppercase tracking-wider font-mono">
                  1. Prenez votre décision de trading
                </h3>

                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => setUserDirection("LONG")}
                    className={`py-3 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-all ${
                      userDirection === "LONG"
                        ? "bg-emerald-500 text-slate-950 shadow-lg shadow-emerald-500/20"
                        : "bg-slate-900 border border-slate-800 text-slate-400 hover:text-white"
                    }`}
                  >
                    <ArrowUpRight className="w-4 h-4" /> Achat (BUY / LONG)
                  </button>

                  <button
                    onClick={() => setUserDirection("SHORT")}
                    className={`py-3 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-all ${
                      userDirection === "SHORT"
                        ? "bg-rose-500 text-white shadow-lg shadow-rose-500/20"
                        : "bg-slate-900 border border-slate-800 text-slate-400 hover:text-white"
                    }`}
                  >
                    <ArrowDownRight className="w-4 h-4" /> Vente (SELL / SHORT)
                  </button>
                </div>

                <div className="grid grid-cols-3 gap-3 text-xs">
                  <div>
                    <label className="block text-slate-400 font-mono mb-1">Prix d'Entrée Proposé</label>
                    <div className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 font-mono text-white font-bold">
                      {scenario.suggestedEntry}
                    </div>
                  </div>

                  <div>
                    <label className="block text-slate-400 font-mono mb-1">Stop Loss (SL)</label>
                    <input
                      type="number"
                      step="0.0001"
                      value={userSL}
                      onChange={(e) => setUserSL(parseFloat(e.target.value))}
                      className="w-full p-2.5 rounded-xl bg-slate-900 border border-slate-800 font-mono text-rose-400 font-bold focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-400 font-mono mb-1">Take Profit (TP)</label>
                    <input
                      type="number"
                      step="0.0001"
                      value={userTP}
                      onChange={(e) => setUserTP(parseFloat(e.target.value))}
                      className="w-full p-2.5 rounded-xl bg-slate-900 border border-slate-800 font-mono text-emerald-400 font-bold focus:outline-none"
                    />
                  </div>
                </div>

                <button
                  onClick={() => {
                    setIsExecuted(true);
                    if (userDirection === scenario.suggestedDirection) {
                      setUserScore((prev) => prev + 150);
                    }
                  }}
                  className="w-full py-3.5 rounded-xl bg-gradient-to-r from-indigo-500 to-indigo-600 hover:from-indigo-400 hover:to-indigo-500 text-white font-bold text-sm shadow-lg shadow-indigo-500/20 flex items-center justify-center gap-2 cursor-pointer transition-all"
                >
                  <Play className="w-4 h-4 fill-white" /> Lancer le Replay & Tester l'Exécution
                </button>
              </div>
            ) : (
              /* Scenario Result & SMC Explanation Breakdown */
              <div className="space-y-4 animate-in fade-in duration-300">
                <div
                  className={`p-5 rounded-2xl border ${
                    isUserCorrect
                      ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
                      : "bg-rose-500/10 border-rose-500/30 text-rose-400"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    {isUserCorrect ? (
                      <CheckCircle2 className="w-8 h-8 text-emerald-400 shrink-0" />
                    ) : (
                      <XCircle className="w-8 h-8 text-rose-400 shrink-0" />
                    )}
                    <div>
                      <h3 className="text-base font-bold text-white">
                        {isUserCorrect
                          ? "Félicitations ! Vous avez validé l'analyse institutionnelle SMC ✅ (+150 XP)"
                          : "Erreur d'analyse SMC : Attention au piège de liquidité (Judas Swing) ❌"}
                      </h3>
                      <p className="text-xs text-slate-300 mt-0.5">
                        Direction recommandée par l'algo :{" "}
                        <span className="font-bold text-white">{scenario.suggestedDirection}</span>
                      </p>
                    </div>
                  </div>
                </div>

                {/* Detailed Coach Explanation Box */}
                <div className="bg-slate-950 p-5 rounded-xl border border-slate-800 space-y-3">
                  <div className="flex items-center gap-2 text-xs font-bold text-amber-400 uppercase tracking-wider font-mono">
                    <Sparkles className="w-4 h-4 text-amber-400" /> Débriefing Officiel du Head Coach
                  </div>
                  <p className="text-xs text-slate-300 leading-relaxed italic">{scenario.explanation}</p>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
      )}
    </div>
  );
};
