import React, { useState } from "react";
import {
  Radio,
  ArrowUpRight,
  ArrowDownRight,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Plus,
  ShieldCheck,
  Zap,
  Bookmark,
  TrendingUp,
  MessageSquare,
  Share2
} from "lucide-react";
import { CoachSignal, Trade } from "../types";

interface CoachSignalsProps {
  signals: CoachSignal[];
  onImportSignalToJournal: (signal: CoachSignal) => void;
}

export const CoachSignals: React.FC<CoachSignalsProps> = ({
  signals,
  onImportSignalToJournal,
}) => {
  const [filterStatus, setFilterStatus] = useState<string>("ALL");
  const [importedSignalIds, setImportedSignalIds] = useState<string[]>([]);

  const filteredSignals = signals.filter((sig) => {
    if (filterStatus === "ALL") return true;
    return sig.status === filterStatus;
  });

  const handleImport = (sig: CoachSignal) => {
    onImportSignalToJournal(sig);
    setImportedSignalIds((prev) => [...prev, sig.id]);
  };

  return (
    <div className="space-y-6">
      {/* Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-900 to-rose-950/40 p-6 rounded-2xl border border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-6 shadow-xl relative overflow-hidden">
        <div className="space-y-2 z-10">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-rose-500/10 text-rose-400 border border-rose-500/20 text-xs font-mono font-bold">
            <Radio className="w-3.5 h-3.5 animate-pulse" /> Centre de Signaux & Analyses Coach en Direct
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
            Analyses Institutionnelles & Setups SMC des Coachs
          </h1>
          <p className="text-slate-400 text-sm max-w-2xl">
            Accédez en direct aux opportunités identifiées par l'équipe de coachs pendant les sessions de Londres et New York.
            Analysez la prise de position et importez les setups en 1 clic dans votre journal.
          </p>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
        {["ALL", "ACTIF", "EN_ATTENTE", "TP_ATTEINT", "SL_ATTEINT"].map((st) => (
          <button
            key={st}
            onClick={() => setFilterStatus(st)}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all shrink-0 ${
              filterStatus === st
                ? "bg-rose-500 text-white shadow-md shadow-rose-500/20"
                : "bg-slate-900 border border-slate-800 text-slate-400 hover:text-white"
            }`}
          >
            {st === "ALL"
              ? "Tous les Signaux"
              : st === "ACTIF"
              ? "🟢 Actifs en Cours"
              : st === "EN_ATTENTE"
              ? "🟠 En Attente de Trigger"
              : st === "TP_ATTEINT"
              ? "✅ TP Touché"
              : "🔴 SL Touché"}
          </button>
        ))}
      </div>

      {/* Signals Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {filteredSignals.map((sig) => {
          const isImported = importedSignalIds.includes(sig.id);

          return (
            <div
              key={sig.id}
              className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4 hover:border-slate-750 transition-colors shadow-lg relative flex flex-col justify-between"
            >
              <div className="space-y-4">
                {/* Header Info */}
                <div className="flex items-start justify-between border-b border-slate-800 pb-3">
                  <div className="flex items-center gap-3">
                    <img
                      src={sig.coachAvatar}
                      alt={sig.coachName}
                      className="w-10 h-10 rounded-full object-cover border-2 border-slate-700"
                    />
                    <div>
                      <div className="text-xs font-bold text-white">{sig.coachName}</div>
                      <div className="text-[10px] text-slate-400 font-mono">{sig.date}</div>
                    </div>
                  </div>

                  <span
                    className={`px-2.5 py-1 rounded-full text-[10px] font-bold font-mono ${
                      sig.status === "ACTIF"
                        ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 animate-pulse"
                        : sig.status === "TP_ATTEINT"
                        ? "bg-blue-500/10 text-blue-300 border border-blue-500/20"
                        : sig.status === "EN_ATTENTE"
                        ? "bg-amber-500/10 text-amber-300 border border-amber-500/20"
                        : "bg-rose-500/10 text-rose-400 border border-rose-500/20"
                    }`}
                  >
                    {sig.status === "ACTIF"
                      ? "🟢 SIGNAL ACTIF"
                      : sig.status === "TP_ATTEINT"
                      ? "✅ TP ATTEINT"
                      : sig.status === "EN_ATTENTE"
                      ? "⌛ EN ATTENTE"
                      : "🔴 SL ATTEINT"}
                  </span>
                </div>

                {/* Main Pair & Direction Badge */}
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-2xl font-black text-white font-mono">{sig.pair}</span>
                    <span className="text-xs text-slate-400 font-mono ml-2">({sig.timeframe})</span>
                  </div>

                  <span
                    className={`px-3 py-1.5 rounded-xl font-black text-xs font-mono flex items-center gap-1 ${
                      sig.direction === "LONG"
                        ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                        : "bg-rose-500/20 text-rose-400 border border-rose-500/30"
                    }`}
                  >
                    {sig.direction === "LONG" ? (
                      <>
                        <ArrowUpRight className="w-4 h-4" /> BUY / LONG
                      </>
                    ) : (
                      <>
                        <ArrowDownRight className="w-4 h-4" /> SELL / SHORT
                      </>
                    )}
                  </span>
                </div>

                {/* Technical Levels Table */}
                <div className="grid grid-cols-4 gap-2 bg-slate-950 p-3 rounded-xl border border-slate-850 text-xs font-mono">
                  <div>
                    <div className="text-[10px] text-slate-500">Zone d'Entrée</div>
                    <div className="font-bold text-white text-[11px] truncate">{sig.entryZone}</div>
                  </div>

                  <div>
                    <div className="text-[10px] text-slate-500">Stop Loss</div>
                    <div className="font-bold text-rose-400 text-[11px]">{sig.stopLoss}</div>
                  </div>

                  <div>
                    <div className="text-[10px] text-slate-500">Take Profit 1</div>
                    <div className="font-bold text-emerald-400 text-[11px]">{sig.takeProfit1}</div>
                  </div>

                  <div>
                    <div className="text-[10px] text-slate-500">Take Profit 2</div>
                    <div className="font-bold text-emerald-300 text-[11px]">{sig.takeProfit2}</div>
                  </div>
                </div>

                {/* SMC Commentary */}
                <div className="p-3 rounded-xl bg-slate-950 border-l-2 border-amber-400 text-xs text-slate-300 italic">
                  "{sig.smcNotes}"
                </div>
              </div>

              {/* Action Footer */}
              <div className="pt-4 border-t border-slate-800 flex items-center justify-between mt-4">
                <span className="text-[11px] text-slate-400 font-mono">
                  Risque Recommandé: <span className="text-white font-bold">{sig.riskLevel}</span>
                </span>

                <button
                  onClick={() => handleImport(sig)}
                  disabled={isImported}
                  className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all ${
                    isImported
                      ? "bg-slate-800 text-emerald-400 border border-emerald-500/30 cursor-default"
                      : "bg-gradient-to-r from-emerald-500 to-teal-400 hover:from-emerald-400 hover:to-teal-300 text-slate-950 shadow-md shadow-emerald-500/10 cursor-pointer"
                  }`}
                >
                  {isImported ? (
                    <>
                      <CheckCircle2 className="w-4 h-4" /> Importé dans le Journal
                    </>
                  ) : (
                    <>
                      <Plus className="w-4 h-4" /> Importer dans mon Journal
                    </>
                  )}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
