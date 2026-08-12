import React, { useState } from "react";
import { Zap, BarChart3, Calculator, RefreshCw } from "lucide-react";
import { formatCurrency } from "../lib/format";
import { PropChallengeSimulator } from "./PropChallengeSimulator";

export type SimulatorMode = "REPLAY" | "MONTE_CARLO";

interface SMCSimulatorProps {
  /**
   * Vue ouverte à l'arrivée. « Replay » et « Sim propfirm » rendent ce même
   * composant, chacun sur sa vue.
   */
  initialMode?: SimulatorMode;
}

export const SMCSimulator: React.FC<SMCSimulatorProps> = ({ initialMode = "REPLAY" }) => {
  const [activeTab, setActiveTab] = useState<SimulatorMode>(initialMode);

  // Monte Carlo state
  const [initialCapital, setInitialCapital] = useState<number>(100000);
  const [winRate, setWinRate] = useState<number>(55);
  const [riskReward, setRiskReward] = useState<number>(2.5);
  const [riskPercent, setRiskPercent] = useState<number>(1.0);
  const [numTrades, setNumTrades] = useState<number>(50);
  const [simTrigger, setSimTrigger] = useState<number>(0);

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
      {/* Navigation Tabs */}
      <div className="flex items-center gap-2 border-b border-[#1B2320] pb-2">
        <button
          onClick={() => setActiveTab("REPLAY")}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
            activeTab === "REPLAY"
              ? "bg-[#00E676] text-slate-950 shadow-md shadow-[#00E676]/20"
              : "bg-[#111615] border border-[#1B2320] text-slate-400 hover:text-white"
          }`}
        >
          <Zap className="w-4 h-4" /> Simulateur de Challenge Prop Firm
        </button>

        <button
          onClick={() => setActiveTab("MONTE_CARLO")}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
            activeTab === "MONTE_CARLO"
              ? "bg-[#00E676] text-slate-950 font-extrabold shadow-md shadow-[#00E676]/20"
              : "bg-[#111615] border border-[#1B2320] text-slate-400 hover:text-white"
          }`}
        >
          <BarChart3 className="w-4 h-4" /> Simulateur Rentabilité PropFirm
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
              <label className="block text-xs font-mono text-slate-400 mb-1">Capital Initial ($)</label>
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
                {formatCurrency(mcResult.finalBalance)}
              </div>
              <div className="text-[10px] text-[#00E676]">
                +{mcResult.netReturnPercent}% de rendement
              </div>
            </div>

            <div className="bg-[#0D1110] border border-[#1B2320] p-4 rounded-xl space-y-1">
              <div className="text-[11px] text-slate-400 font-mono">PnL Net Simulé</div>
              <div className={`text-2xl font-black font-mono ${mcResult.netProfit >= 0 ? "text-[#00E676]" : "text-rose-400"}`}>
                {mcResult.netProfit >= 0 ? `+${formatCurrency(mcResult.netProfit)}` : formatCurrency(mcResult.netProfit)}
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
        <PropChallengeSimulator />
      )}
    </div>
  );
};
