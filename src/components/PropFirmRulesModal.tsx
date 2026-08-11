import React, { useState } from "react";
import {
  ShieldAlert,
  Trophy,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  TrendingUp,
  Clock,
  Zap,
  DollarSign,
  X,
  Sparkles,
  Info,
  RefreshCw,
} from "lucide-react";
import { StudentProfile } from "../types";
import { formatCurrency } from "../lib/format";

interface PropFirmRulesModalProps {
  isOpen: boolean;
  onClose: () => void;
  student: StudentProfile;
}

interface PropFirmPreset {
  name: string;
  initialCapital: number;
  maxDailyDrawdownPercent: number;
  maxTotalDrawdownPercent: number;
  targetProfitPercent: number;
  minTradingDays: number;
  maxTradingDays: number;
}

const PRESETS: PropFirmPreset[] = [
  {
    name: "FTMO Challenge 100k",
    initialCapital: 100000,
    maxDailyDrawdownPercent: 5,
    maxTotalDrawdownPercent: 10,
    targetProfitPercent: 10,
    minTradingDays: 4,
    maxTradingDays: 30,
  },
  {
    name: "FundedNext Stellar 50k",
    initialCapital: 50000,
    maxDailyDrawdownPercent: 5,
    maxTotalDrawdownPercent: 10,
    targetProfitPercent: 8,
    minTradingDays: 5,
    maxTradingDays: 0, // Illimité
  },
  {
    name: "Alpha Capital 200k",
    initialCapital: 200000,
    maxDailyDrawdownPercent: 4,
    maxTotalDrawdownPercent: 8,
    targetProfitPercent: 8,
    minTradingDays: 0,
    maxTradingDays: 0,
  },
  {
    name: "Horizon Compte Réel",
    initialCapital: 10000,
    maxDailyDrawdownPercent: 3,
    maxTotalDrawdownPercent: 6,
    targetProfitPercent: 15,
    minTradingDays: 0,
    maxTradingDays: 0,
  },
];

export const PropFirmRulesModal: React.FC<PropFirmRulesModalProps> = ({
  isOpen,
  onClose,
  student,
}) => {
  const [selectedPreset, setSelectedPreset] = useState<PropFirmPreset>(PRESETS[0]);
  const [currentBalance, setCurrentBalance] = useState<number>(104250);
  const [todayPnl, setTodayPnl] = useState<number>(-450);
  const [daysTraded, setDaysTraded] = useState<number>(6);

  if (!isOpen) return null;

  const initialCap = selectedPreset.initialCapital;
  const maxDailyLossAmount = initialCap * (selectedPreset.maxDailyDrawdownPercent / 100);
  const maxTotalLossAmount = initialCap * (selectedPreset.maxTotalDrawdownPercent / 100);
  const targetProfitAmount = initialCap * (selectedPreset.targetProfitPercent / 100);
  
  const totalProfitLoss = currentBalance - initialCap;
  const totalProfitPercent = (totalProfitLoss / initialCap) * 100;

  const dailyLossPercent = (Math.abs(Math.min(0, todayPnl)) / initialCap) * 100;
  const dailyDrawdownUsage = (dailyLossPercent / selectedPreset.maxDailyDrawdownPercent) * 100;

  const totalDrawdownAmount = Math.max(0, initialCap - currentBalance);
  const totalDrawdownPercent = (totalDrawdownAmount / initialCap) * 100;
  const totalDrawdownUsage = (totalDrawdownPercent / selectedPreset.maxTotalDrawdownPercent) * 100;

  const targetProgress = Math.min(100, Math.max(0, (totalProfitLoss / targetProfitAmount) * 100));

  const isDailyBreached = dailyLossPercent >= selectedPreset.maxDailyDrawdownPercent;
  const isTotalBreached = totalDrawdownPercent >= selectedPreset.maxTotalDrawdownPercent;
  const isTargetPassed = totalProfitLoss >= targetProfitAmount;

  return (
    <div className="fixed inset-0 z-50 bg-[#0D1110]/80 backdrop-blur-md flex items-center justify-center p-4 font-sans">
      <div className="bg-[#111615] border border-[#1B2320] rounded-2xl max-w-3xl w-full p-6 space-y-6 shadow-2xl relative text-slate-100 my-6 max-h-[92vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#1B2320] pb-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-[#00E676]/10 text-[#00E676] border border-[#00E676]/20">
              <Trophy className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                Simulateur & Suivi Challenge Prop Firm
                <span className="px-2 py-0.5 rounded bg-[#00E676]/15 text-[#00E676] text-[10px] font-mono font-bold border border-[#00E676]/30">
                  SMC RISK MATRIX
                </span>
              </h3>
              <p className="text-xs text-slate-400">
                Surveille tes métriques en temps réel pour éviter d'enfreindre les règles de Drawdown.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg bg-[#1B2320] hover:bg-[#232D29] text-slate-400 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Preset Selector */}
        <div className="space-y-2">
          <label className="block text-xs font-medium text-slate-400">
            Sélectionne ton Challenge / Prop Firm :
          </label>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {PRESETS.map((p) => (
              <button
                key={p.name}
                onClick={() => {
                  setSelectedPreset(p);
                  setCurrentBalance(p.initialCapital * 1.0425);
                }}
                className={`p-2.5 rounded-xl border text-left transition-all ${
                  selectedPreset.name === p.name
                    ? "bg-[#00E676]/15 border-[#00E676]/50 text-white shadow-sm"
                    : "bg-[#0D1110] border-[#1B2320] text-slate-400 hover:text-white"
                }`}
              >
                <div className="text-xs font-bold text-slate-200">{p.name}</div>
                <div className="text-[10px] text-slate-500 font-mono">
                  {formatCurrency(p.initialCapital)}
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Quick Simulator Inputs */}
        <div className="bg-[#0D1110] p-4 rounded-xl border border-[#1B2320] grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs font-mono">
          <div>
            <label className="block text-slate-400 mb-1 font-sans">Capital Actuel ($)</label>
            <input
              type="number"
              value={currentBalance}
              onChange={(e) => setCurrentBalance(Number(e.target.value))}
              className="w-full bg-[#111615] border border-[#1B2320] rounded-xl px-3 py-2 text-white font-bold focus:outline-none focus:border-[#00E676]"
            />
          </div>

          <div>
            <label className="block text-slate-400 mb-1 font-sans">PnL du Jour ($)</label>
            <input
              type="number"
              value={todayPnl}
              onChange={(e) => setTodayPnl(Number(e.target.value))}
              className={`w-full bg-[#111615] border border-[#1B2320] rounded-xl px-3 py-2 font-bold focus:outline-none ${
                todayPnl >= 0 ? "text-[#00E676] focus:border-[#00E676]" : "text-rose-400 focus:border-rose-500"
              }`}
            />
          </div>

          <div>
            <label className="block text-slate-400 mb-1 font-sans">Jours de Trading Validés</label>
            <input
              type="number"
              value={daysTraded}
              onChange={(e) => setDaysTraded(Number(e.target.value))}
              className="w-full bg-[#111615] border border-[#1B2320] rounded-xl px-3 py-2 text-white font-bold focus:outline-none focus:border-[#00E676]"
            />
          </div>
        </div>

        {/* Overall Status Banner */}
        {isDailyBreached || isTotalBreached ? (
          <div className="p-4 rounded-xl bg-rose-500/15 border border-rose-500/40 text-rose-300 flex items-center gap-3">
            <XCircle className="w-6 h-6 text-rose-400 shrink-0 animate-bounce" />
            <div>
              <div className="text-sm font-bold">RÈGLE FRANCHIE ! COMPTE EN ÉCHEC</div>
              <p className="text-xs text-rose-200">
                Vous avez dépassé la limite autorisée de perte. Respectez la gestion du risque.
              </p>
            </div>
          </div>
        ) : isTargetPassed ? (
          <div className="p-4 rounded-xl bg-[#00E676]/15 border border-[#00E676]/40 text-[#00E676] flex items-center gap-3">
            <CheckCircle2 className="w-6 h-6 text-[#00E676] shrink-0" />
            <div>
              <div className="text-sm font-bold">CHALLENGE VALIDE AVEC SUCCÈS ! 🏆</div>
              <p className="text-xs text-slate-300">
                Objectif de profit de +{formatCurrency(targetProfitAmount)} atteint ! Félicitations !
              </p>
            </div>
          </div>
        ) : (
          <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 flex items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2">
              <Zap className="w-4 h-4 text-amber-400 shrink-0" />
              <span>Challenge en cours : Respectez vos SL et max 1% de risque par position.</span>
            </div>
            <span className="font-mono font-bold text-white shrink-0">
              {targetProfitAmount - totalProfitLoss > 0
                ? `Encore +${formatCurrency(targetProfitAmount - totalProfitLoss)} pour valider`
                : "Objectif atteint"}
            </span>
          </div>
        )}

        {/* 3 Main Gauges */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Gauge 1: Max Daily Drawdown */}
          <div className="bg-[#0D1110] border border-[#1B2320] rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-400 font-medium">Perte Max Jour (-{selectedPreset.maxDailyDrawdownPercent}%)</span>
              <span className={`font-mono font-bold ${dailyLossPercent >= selectedPreset.maxDailyDrawdownPercent ? "text-rose-400" : "text-white"}`}>
                {todayPnl < 0 ? `-${formatCurrency(Math.abs(todayPnl))}` : formatCurrency(0)}
              </span>
            </div>

            <div className="w-full bg-[#111615] h-3 rounded-full overflow-hidden border border-[#1B2320]">
              <div
                className={`h-full transition-all duration-300 ${
                  dailyDrawdownUsage > 80 ? "bg-rose-500" : dailyDrawdownUsage > 50 ? "bg-amber-400" : "bg-[#00E676]"
                }`}
                style={{ width: `${Math.min(100, dailyDrawdownUsage)}%` }}
              />
            </div>

            <div className="flex justify-between text-[11px] font-mono text-slate-500">
              <span>Limite : -{formatCurrency(maxDailyLossAmount)}</span>
              <span>{Math.round(dailyDrawdownUsage)}% utilisé</span>
            </div>
          </div>

          {/* Gauge 2: Max Total Drawdown */}
          <div className="bg-[#0D1110] border border-[#1B2320] rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-400 font-medium">Perte Max Totale (-{selectedPreset.maxTotalDrawdownPercent}%)</span>
              <span className={`font-mono font-bold ${totalDrawdownPercent >= selectedPreset.maxTotalDrawdownPercent ? "text-rose-400" : "text-white"}`}>
                {totalDrawdownAmount > 0 ? `-${formatCurrency(totalDrawdownAmount)}` : formatCurrency(0)}
              </span>
            </div>

            <div className="w-full bg-[#111615] h-3 rounded-full overflow-hidden border border-[#1B2320]">
              <div
                className={`h-full transition-all duration-300 ${
                  totalDrawdownUsage > 80 ? "bg-rose-500" : totalDrawdownUsage > 50 ? "bg-amber-400" : "bg-[#00E676]"
                }`}
                style={{ width: `${Math.min(100, totalDrawdownUsage)}%` }}
              />
            </div>

            <div className="flex justify-between text-[11px] font-mono text-slate-500">
              <span>Limite : -{formatCurrency(maxTotalLossAmount)}</span>
              <span>{Math.round(totalDrawdownUsage)}% utilisé</span>
            </div>
          </div>

          {/* Gauge 3: Profit Target */}
          <div className="bg-[#0D1110] border border-[#1B2320] rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-400 font-medium">Objectif (+{selectedPreset.targetProfitPercent}%)</span>
              <span className="font-mono font-bold text-[#00E676]">
                +{formatCurrency(totalProfitLoss > 0 ? totalProfitLoss : 0)}
              </span>
            </div>

            <div className="w-full bg-[#111615] h-3 rounded-full overflow-hidden border border-[#1B2320]">
              <div
                className="h-full bg-gradient-to-r from-[#00E676] to-[#00E676] transition-all duration-300"
                style={{ width: `${Math.min(100, targetProgress)}%` }}
              />
            </div>

            <div className="flex justify-between text-[11px] font-mono text-slate-500">
              <span>Cible : +{formatCurrency(targetProfitAmount)}</span>
              <span className="text-[#00E676] font-bold">{Math.round(targetProgress)}%</span>
            </div>
          </div>
        </div>

        {/* Footer info & action */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-3 border-t border-[#1B2320] text-xs">
          <div className="text-slate-400 flex items-center gap-1.5 font-mono">
            <Info className="w-4 h-4 text-[#00E676]" />
            <span>Recommandation SMC : Risque maximum conseillé = 0.5% par position.</span>
          </div>

          <button
            onClick={onClose}
            className="px-5 py-2.5 rounded-xl bg-[#00E676] hover:bg-[#00c865] text-slate-950 font-extrabold shadow-md w-full sm:w-auto text-center"
          >
            Fermer le Suivi Prop Firm
          </button>
        </div>
      </div>
    </div>
  );
};
