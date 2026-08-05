import React, { useState } from "react";
import {
  ShieldCheck,
  Zap,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  HelpCircle,
  X,
  TrendingUp,
  Target,
  Layers,
} from "lucide-react";

interface SetupAnalyzerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onApplyToJournal?: (setupData: any) => void;
}

export const SetupAnalyzerModal: React.FC<SetupAnalyzerModalProps> = ({
  isOpen,
  onClose,
  onApplyToJournal,
}) => {
  const [pair, setPair] = useState<string>("EUR/USD");
  const [timeframe, setTimeframe] = useState<string>("M15");
  const [direction, setDirection] = useState<"BUY" | "SELL">("BUY");

  // Confluence Checkboxes
  const [hasSweep, setHasSweep] = useState<boolean>(true); // Prise de liquidité (BSL/SSL)
  const [hasCHoCH, setHasCHoCH] = useState<boolean>(true); // Change of Character
  const [hasOB, setHasOB] = useState<boolean>(true); // Order Block M15/H1
  const [hasFVG, setHasFVG] = useState<boolean>(true); // Imbalance / Fair Value Gap
  const [inKillzone, setInKillzone] = useState<boolean>(true); // London/NY Killzone
  const [htfAlignment, setHtfAlignment] = useState<boolean>(true); // HTF Trend H4/D1

  if (!isOpen) return null;

  // Calculate score
  const confluences = [
    { name: "Prise de Liquidité (BSL / SSL Sweep)", active: hasSweep, weight: 20 },
    { name: "Casse de Structure (CHoCH / BOS)", active: hasCHoCH, weight: 20 },
    { name: "Order Block Inefficace (OB H1/M15)", active: hasOB, weight: 15 },
    { name: "Fair Value Gap / Imbalance (FVG)", active: hasFVG, weight: 15 },
    { name: "Alignement Killzone (London / NY Open)", active: inKillzone, weight: 15 },
    { name: "Tendance HTF (H4 / D1 Alignment)", active: htfAlignment, weight: 15 },
  ];

  const totalScore = confluences.reduce((acc, c) => acc + (c.active ? c.weight : 0), 0);

  const getVerdict = () => {
    if (totalScore >= 85) {
      return {
        label: "SETUP A+ PARFAIT",
        color: "text-[#00E676] bg-[#00E676]/15 border-[#00E676]/40",
        desc: "Toutes les confluences majeures SMC sont validées. Exécution avec gestion de risque standard (1%).",
      };
    } else if (totalScore >= 65) {
      return {
        label: "SETUP B+ VALIDE",
        color: "text-amber-400 bg-amber-500/15 border-amber-500/40",
        desc: "Setup correct mais manquant de confirmation HTF ou Killzone. Réduisez le risque à 0.5%.",
      };
    } else {
      return {
        label: "SETUP NON CONFORME (ÉVITER)",
        color: "text-rose-400 bg-rose-500/15 border-rose-500/40",
        desc: "Manque de confluences techniques SMC clés. Risque de faux break élevé.",
      };
    }
  };

  const verdict = getVerdict();

  return (
    <div className="fixed inset-0 z-50 bg-[#0D1110]/80 backdrop-blur-md flex items-center justify-center p-4 font-sans">
      <div className="bg-[#111615] border border-[#1B2320] rounded-2xl max-w-2xl w-full p-6 space-y-6 shadow-2xl relative text-slate-100 my-6 max-h-[92vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#1B2320] pb-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-[#00E676]/10 text-[#00E676] border border-[#00E676]/20">
              <Target className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                Audit & Scoring de Setup SMC
                <span className="px-2 py-0.5 rounded bg-[#00E676]/15 text-[#00E676] text-[10px] font-mono font-bold border border-[#00E676]/30">
                  CONFLUENCE MATRIX
                </span>
              </h3>
              <p className="text-xs text-slate-400">
                Calcule automatiquement le score technique de ton setup avant de passer l'ordre.
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

        {/* Inputs */}
        <div className="grid grid-cols-3 gap-3 text-xs font-mono">
          <div>
            <label className="block text-slate-400 mb-1 font-sans">Instrument</label>
            <select
              value={pair}
              onChange={(e) => setPair(e.target.value)}
              className="w-full bg-[#0D1110] border border-[#1B2320] rounded-xl px-3 py-2 text-white font-bold focus:outline-none focus:border-[#00E676]"
            >
              <option value="EUR/USD">EUR/USD</option>
              <option value="GBP/USD">GBP/USD</option>
              <option value="XAU/USD">XAU/USD (Gold)</option>
              <option value="NAS100">NAS100 (US100)</option>
              <option value="BTC/USD">BTC/USD</option>
            </select>
          </div>

          <div>
            <label className="block text-slate-400 mb-1 font-sans">Timeframe d'Entrée</label>
            <select
              value={timeframe}
              onChange={(e) => setTimeframe(e.target.value)}
              className="w-full bg-[#0D1110] border border-[#1B2320] rounded-xl px-3 py-2 text-white font-bold focus:outline-none focus:border-[#00E676]"
            >
              <option value="M1">M1 (Scalping)</option>
              <option value="M5">M5 (Intraday)</option>
              <option value="M15">M15 (Standard)</option>
              <option value="H1">H1 (Swing)</option>
            </select>
          </div>

          <div>
            <label className="block text-slate-400 mb-1 font-sans">Direction</label>
            <div className="flex gap-1">
              <button
                type="button"
                onClick={() => setDirection("BUY")}
                className={`flex-1 py-1.5 rounded-xl font-bold transition-all ${
                  direction === "BUY"
                    ? "bg-[#00E676] text-slate-950"
                    : "bg-[#0D1110] text-slate-400 border border-[#1B2320]"
                }`}
              >
                BUY
              </button>
              <button
                type="button"
                onClick={() => setDirection("SELL")}
                className={`flex-1 py-1.5 rounded-xl font-bold transition-all ${
                  direction === "SELL"
                    ? "bg-rose-500 text-white"
                    : "bg-[#0D1110] text-slate-400 border border-[#1B2320]"
                }`}
              >
                SELL
              </button>
            </div>
          </div>
        </div>

        {/* Confluences Checklist */}
        <div className="space-y-2">
          <label className="block text-xs font-bold text-slate-300">
            Coche les confluences SMC présentes sur le graphique :
          </label>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
            <button
              type="button"
              onClick={() => setHasSweep(!hasSweep)}
              className={`p-3 rounded-xl border transition-all text-left flex items-center justify-between ${
                hasSweep
                  ? "bg-[#00E676]/10 border-[#00E676]/40 text-white font-bold"
                  : "bg-[#0D1110] border-[#1B2320] text-slate-400"
              }`}
            >
              <span>1. Liquidity Sweep (BSL / SSL)</span>
              <CheckCircle2 className={`w-4 h-4 ${hasSweep ? "text-[#00E676]" : "text-slate-600"}`} />
            </button>

            <button
              type="button"
              onClick={() => setHasCHoCH(!hasCHoCH)}
              className={`p-3 rounded-xl border transition-all text-left flex items-center justify-between ${
                hasCHoCH
                  ? "bg-[#00E676]/10 border-[#00E676]/40 text-white font-bold"
                  : "bg-[#0D1110] border-[#1B2320] text-slate-400"
              }`}
            >
              <span>2. Casse CHoCH / BOS</span>
              <CheckCircle2 className={`w-4 h-4 ${hasCHoCH ? "text-[#00E676]" : "text-slate-600"}`} />
            </button>

            <button
              type="button"
              onClick={() => setHasOB(!hasOB)}
              className={`p-[#00E676] p-3 rounded-xl border transition-all text-left flex items-center justify-between ${
                hasOB
                  ? "bg-[#00E676]/10 border-[#00E676]/40 text-white font-bold"
                  : "bg-[#0D1110] border-[#1B2320] text-slate-400"
              }`}
            >
              <span>3. Order Block Inefficace (OB)</span>
              <CheckCircle2 className={`w-4 h-4 ${hasOB ? "text-[#00E676]" : "text-slate-600"}`} />
            </button>

            <button
              type="button"
              onClick={() => setHasFVG(!hasFVG)}
              className={`p-3 rounded-xl border transition-all text-left flex items-center justify-between ${
                hasFVG
                  ? "bg-[#00E676]/10 border-[#00E676]/40 text-white font-bold"
                  : "bg-[#0D1110] border-[#1B2320] text-slate-400"
              }`}
            >
              <span>4. Fair Value Gap (FVG / Imbalance)</span>
              <CheckCircle2 className={`w-4 h-4 ${hasFVG ? "text-[#00E676]" : "text-slate-600"}`} />
            </button>

            <button
              type="button"
              onClick={() => setInKillzone(!inKillzone)}
              className={`p-3 rounded-xl border transition-all text-left flex items-center justify-between ${
                inKillzone
                  ? "bg-[#00E676]/10 border-[#00E676]/40 text-white font-bold"
                  : "bg-[#0D1110] border-[#1B2320] text-slate-400"
              }`}
            >
              <span>5. Alignement Killzone (London/NY)</span>
              <CheckCircle2 className={`w-4 h-4 ${inKillzone ? "text-[#00E676]" : "text-slate-600"}`} />
            </button>

            <button
              type="button"
              onClick={() => setHtfAlignment(!htfAlignment)}
              className={`p-3 rounded-xl border transition-all text-left flex items-center justify-between ${
                htfAlignment
                  ? "bg-[#00E676]/10 border-[#00E676]/40 text-white font-bold"
                  : "bg-[#0D1110] border-[#1B2320] text-slate-400"
              }`}
            >
              <span>6. Tendance HTF (H4 / D1 Alignment)</span>
              <CheckCircle2 className={`w-4 h-4 ${htfAlignment ? "text-[#00E676]" : "text-slate-600"}`} />
            </button>
          </div>
        </div>

        {/* Score & Verdict Card */}
        <div className={`p-4 rounded-xl border space-y-2 ${verdict.color}`}>
          <div className="flex items-center justify-between font-mono">
            <span className="font-bold text-sm tracking-wide">{verdict.label}</span>
            <span className="text-xl font-black">{totalScore} / 100 PTS</span>
          </div>

          <p className="text-xs leading-relaxed">{verdict.desc}</p>
        </div>

        {/* Action Buttons */}
        <div className="flex justify-end gap-3 pt-3 border-t border-[#1B2320]">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 rounded-xl bg-[#1B2320] hover:bg-[#232D29] text-slate-300 font-bold text-xs"
          >
            Fermer
          </button>
          <button
            type="button"
            onClick={() => {
              if (onApplyToJournal) {
                onApplyToJournal({
                  pair,
                  timeframe,
                  direction: direction === "BUY" ? "LONG" : "SHORT",
                  score: totalScore,
                  verdict: verdict.label,
                  notes: `Setup validé par la matrice de confluences (${totalScore}/100 PTS). TF: ${timeframe}. ${verdict.desc}`
                });
              } else {
                onClose();
              }
            }}
            className="px-5 py-2.5 rounded-xl bg-[#00E676] hover:bg-[#00c865] text-slate-950 font-extrabold text-xs flex items-center gap-1.5 shadow-md cursor-pointer"
          >
            <ShieldCheck className="w-4 h-4" /> Valider & Transférer au Journal
          </button>
        </div>
      </div>
    </div>
  );
};
