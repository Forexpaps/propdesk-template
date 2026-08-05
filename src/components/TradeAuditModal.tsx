import React, { useState } from "react";
import { Sparkles, ShieldCheck, Award, AlertTriangle, CheckCircle2, MessageSquare, RotateCcw } from "lucide-react";
import { Trade } from "../types";

interface TradeAuditModalProps {
  trade: Trade;
  onClose: () => void;
  onUpdateTradeAudit: (tradeId: string, auditData: any) => void;
}

export const TradeAuditModal: React.FC<TradeAuditModalProps> = ({
  trade,
  onClose,
  onUpdateTradeAudit,
}) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const runAiAudit = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/coach/ai-review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ trade }),
      });

      const json = await response.json();
      if (json.success && json.data) {
        onUpdateTradeAudit(trade.id, json.data);
      } else {
        setError("Impossible de générer l'audit pour le moment.");
      }
    } catch (err: any) {
      console.error(err);
      setError("Erreur de connexion au serveur d'Audit IA.");
    } finally {
      setLoading(false);
    }
  };

  const audit = trade.aiAudit;

  return (
    <div className="fixed inset-0 z-50 bg-[#0D1110]/80 backdrop-blur-md flex items-center justify-center p-4 font-sans">
      <div className="bg-[#111615] border border-[#1B2320] rounded-2xl max-w-2xl w-full p-6 space-y-6 shadow-2xl max-h-[90vh] overflow-y-auto text-slate-100">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#1B2320] pb-4">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-[#00E676]/10 text-[#00E676]">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <span className="text-xs font-bold text-[#00E676] uppercase tracking-wider">
                Audit Clinique par IA Gemini
              </span>
              <h3 className="text-lg font-bold text-white">
                Analyse du Trade {trade.pair} ({trade.direction})
              </h3>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg bg-[#1B2320] hover:bg-[#232D29] text-slate-400 hover:text-white"
          >
            ✕
          </button>
        </div>

        {/* Trade Details Bar */}
        <div className="p-4 rounded-xl bg-[#0D1110] border border-[#1B2320] grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs font-mono">
          <div>
            <div className="text-slate-500 text-[10px]">Paire</div>
            <div className="font-bold text-white">{trade.pair}</div>
          </div>
          <div>
            <div className="text-slate-500 text-[10px]">Entrée / SL</div>
            <div className="text-slate-300">{trade.entryPrice} / {trade.stopLoss}</div>
          </div>
          <div>
            <div className="text-slate-500 text-[10px]">R:R / Stratégie</div>
            <div className="text-[#00E676] font-bold">1:{trade.riskRewardRatio} ({trade.strategy})</div>
          </div>
          <div>
            <div className="text-slate-500 text-[10px]">PnL Net</div>
            <div className={trade.pnl >= 0 ? "text-[#00E676] font-bold" : "text-rose-400 font-bold"}>
              {trade.pnl > 0 ? `+${trade.pnl} €` : `${trade.pnl} €`}
            </div>
          </div>
        </div>

        {/* Content */}
        {!audit && !loading && (
          <div className="text-center py-8 space-y-4">
            <p className="text-xs text-slate-400">
              Ce trade n'a pas encore été audité par le Master Coach IA. Cliquez ci-dessous pour lancer l'analyse complète de l'exécution et du risque.
            </p>
            <button
              onClick={runAiAudit}
              className="px-6 py-3 rounded-xl bg-[#00E676] hover:bg-[#00c865] text-slate-950 font-bold text-xs shadow-lg shadow-[#00E676]/20 cursor-pointer transition-colors"
            >
              Lancer l'Audit IA Gemini
            </button>
          </div>
        )}

        {loading && (
          <div className="text-center py-12 space-y-3">
            <Sparkles className="w-8 h-8 text-[#00E676] animate-spin mx-auto" />
            <p className="text-xs font-bold text-[#69F0AE]">Analyse du Price Action & du Management du Risque en cours...</p>
          </div>
        )}

        {error && (
          <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs">
            {error}
          </div>
        )}

        {audit && !loading && (
          <div className="space-y-6">
            {/* Score Badges */}
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-[#0D1110] p-3 rounded-xl border border-[#1B2320] text-center">
                <div className="text-[10px] text-slate-400 font-semibold">Technique</div>
                <div className="text-xl font-extrabold text-amber-400 font-mono">
                  {audit.technicalScore} <span className="text-xs text-slate-500">/10</span>
                </div>
              </div>
              <div className="bg-[#0D1110] p-3 rounded-xl border border-[#1B2320] text-center">
                <div className="text-[10px] text-slate-400 font-semibold">Risk Management</div>
                <div className="text-xl font-extrabold text-[#00E676] font-mono">
                  {audit.riskScore} <span className="text-xs text-slate-500">/10</span>
                </div>
              </div>
              <div className="bg-[#0D1110] p-3 rounded-xl border border-[#1B2320] text-center">
                <div className="text-[10px] text-slate-400 font-semibold">Discipline</div>
                <div className="text-xl font-extrabold text-purple-400 font-mono">
                  {audit.disciplineScore} <span className="text-xs text-slate-500">/10</span>
                </div>
              </div>
            </div>

            {/* Diagnosis Banner */}
            <div className="p-3.5 rounded-xl bg-[#00E676]/10 border border-[#00E676]/20 text-xs text-[#69F0AE] font-semibold flex items-center gap-2">
              <Award className="w-4 h-4 shrink-0 text-[#00E676]" />
              <span>{audit.diagnosis}</span>
            </div>

            {/* Strengths & Improvements */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div className="bg-[#0D1110]/60 p-4 rounded-xl border border-[#1B2320] space-y-2">
                <h4 className="font-bold text-[#00E676] flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4" /> Points Forts
                </h4>
                <ul className="space-y-1 text-slate-300 list-disc list-inside">
                  {audit.strengths.map((s: string, idx: number) => (
                    <li key={idx}>{s}</li>
                  ))}
                </ul>
              </div>

              <div className="bg-[#0D1110]/60 p-4 rounded-xl border border-[#1B2320] space-y-2">
                <h4 className="font-bold text-amber-400 flex items-center gap-1.5">
                  <AlertTriangle className="w-4 h-4" /> Axes d'Amélioration
                </h4>
                <ul className="space-y-1 text-slate-300 list-disc list-inside">
                  {audit.improvements.map((imp: string, idx: number) => (
                    <li key={idx}>{imp}</li>
                  ))}
                </ul>
              </div>
            </div>

            {/* Coach Detailed Feedback */}
            <div className="bg-[#0D1110] p-4 rounded-xl border border-[#1B2320] space-y-2">
              <h4 className="text-xs font-bold text-[#00E676] uppercase tracking-wider flex items-center gap-1.5">
                <MessageSquare className="w-3.5 h-3.5" />
                Conseil Pédagogique du Master Coach
              </h4>
              <p className="text-xs text-slate-200 leading-relaxed whitespace-pre-wrap">
                {audit.coachFeedback}
              </p>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between pt-4 border-t border-[#1B2320]">
          <button
            onClick={runAiAudit}
            className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-white"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Ré-auditer</span>
          </button>

          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-[#1B2320] hover:bg-[#232D29] text-slate-200 text-xs font-bold"
          >
            Fermer
          </button>
        </div>
      </div>
    </div>
  );
};
