import React, { useState, useEffect, useRef } from "react";
import { ClipboardList, X, Check } from "lucide-react";
import { TradingPlanData } from "../types";

interface TradingPlanEditorModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const SESSIONS = ["Asie", "Londres", "New York"];
const STORAGE_KEY = "horizon_trading_plan";

const EMPTY_PLAN: TradingPlanData = {
  authorizedSessions: [],
  tradingHours: "",
  trackedAssets: "",
  authorizedSetups: "",
  riskPerTradePercent: "",
  maxTradesPerDay: "",
  maxDailyLossPercent: "",
  entryConditions: "",
  stopConditions: "",
  goldenRules: "",
};

const loadPlan = (): TradingPlanData => {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved ? { ...EMPTY_PLAN, ...JSON.parse(saved) } : EMPTY_PLAN;
  } catch {
    return EMPTY_PLAN;
  }
};

const inputClass =
  "w-full bg-[#0D1110] border border-[#1B2320] rounded-xl px-3.5 py-2.5 text-white text-sm focus:outline-none focus:border-[#00E676]/50 placeholder-slate-600";

export const TradingPlanEditorModal: React.FC<TradingPlanEditorModalProps> = ({
  isOpen,
  onClose,
}) => {
  const [plan, setPlan] = useState<TradingPlanData>(loadPlan);
  const [showSaved, setShowSaved] = useState(false);

  // Recharge depuis le stockage à chaque ouverture — au cas où un autre
  // onglet du même navigateur aurait modifié le plan entre-temps.
  useEffect(() => {
    if (isOpen) setPlan(loadPlan());
  }, [isOpen]);

  // Enregistrement automatique (500ms après la dernière frappe) — conservé
  // tel quel. Un bouton "Enregistrer" explicite a été ajouté en plus (voir
  // `handleSaveNow` plus bas) : l'auto-save seul laissait l'utilisateur
  // sans action claire à poser une fois son plan rempli.
  const isFirstRun = useRef(true);
  useEffect(() => {
    if (!isOpen) return;
    if (isFirstRun.current) {
      isFirstRun.current = false;
      return;
    }
    const timer = setTimeout(() => {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(plan));
      } catch {
        // Quota dépassé ou navigation privée : rien à faire de plus ici.
      }
      setShowSaved(true);
      setTimeout(() => setShowSaved(false), 1500);
    }, 500);
    return () => clearTimeout(timer);
  }, [plan, isOpen]);

  useEffect(() => {
    if (isOpen) isFirstRun.current = true;
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSaveNow = () => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(plan));
    } catch {
      // Quota dépassé ou navigation privée : rien à faire de plus ici.
    }
    setShowSaved(true);
    setTimeout(() => setShowSaved(false), 1500);
  };

  const toggleSession = (session: string) => {
    setPlan((prev) => ({
      ...prev,
      authorizedSessions: prev.authorizedSessions.includes(session)
        ? prev.authorizedSessions.filter((s) => s !== session)
        : [...prev.authorizedSessions, session],
    }));
  };

  return (
    <div className="fixed inset-0 z-50 bg-[#0D1110]/80 backdrop-blur-md flex items-center justify-center p-4 font-sans">
      <div className="bg-[#111615] border border-[#1B2320] rounded-2xl max-w-2xl w-full my-8 shadow-2xl relative text-slate-100 max-h-[calc(100vh-4rem)] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="p-5 sm:p-6 border-b border-[#1B2320] flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-[#00E676]/10 text-[#00E676] border border-[#00E676]/20">
              <ClipboardList className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">Mon plan de trading</h3>
              <p className="text-xs text-slate-400 flex items-center gap-1.5">
                Ta discipline en un écran.
                <span
                  className={`transition-opacity duration-300 flex items-center gap-1 text-[#00E676] font-semibold ${
                    showSaved ? "opacity-100" : "opacity-0"
                  }`}
                >
                  <Check className="w-3 h-3" /> Enregistré
                </span>
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg bg-[#1B2320] hover:bg-[#232D29] text-slate-400 hover:text-white transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-5 text-sm">
          {/* Sessions autorisées */}
          <div>
            <label className="block text-xs font-bold text-slate-300 mb-2">Sessions autorisées</label>
            <div className="flex flex-wrap gap-2">
              {SESSIONS.map((session) => (
                <button
                  key={session}
                  type="button"
                  onClick={() => toggleSession(session)}
                  className={`px-3.5 py-1.5 rounded-lg border text-xs font-bold transition-all ${
                    plan.authorizedSessions.includes(session)
                      ? "bg-[#00E676]/15 border-[#00E676] text-[#00E676]"
                      : "bg-[#0D1110] border-[#1B2320] text-slate-400 hover:text-white"
                  }`}
                >
                  {session}
                </button>
              ))}
            </div>
          </div>

          {/* Horaires / Actifs */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1.5">Horaires de trading</label>
              <input
                type="text"
                value={plan.tradingHours}
                onChange={(e) => setPlan((p) => ({ ...p, tradingHours: e.target.value }))}
                placeholder="ex : 09h–12h et 15h–18h"
                className={inputClass}
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1.5">Actifs suivis</label>
              <input
                type="text"
                value={plan.trackedAssets}
                onChange={(e) => setPlan((p) => ({ ...p, trackedAssets: e.target.value }))}
                placeholder="EUR/USD, XAU, NAS100, BTC..."
                className={inputClass}
              />
            </div>
          </div>

          {/* Setups autorisés */}
          <div>
            <label className="block text-xs font-bold text-slate-300 mb-1.5">Setups autorisés</label>
            <input
              type="text"
              value={plan.authorizedSetups}
              onChange={(e) => setPlan((p) => ({ ...p, authorizedSetups: e.target.value }))}
              placeholder="Breakout retest, FVG H1, order block..."
              className={inputClass}
            />
          </div>

          {/* Risque / Nb trades / Perte max */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1.5">Risque par trade (%)</label>
              <input
                type="number"
                step="0.1"
                value={plan.riskPerTradePercent}
                onChange={(e) => setPlan((p) => ({ ...p, riskPerTradePercent: e.target.value }))}
                placeholder="1"
                className={`${inputClass} font-mono`}
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1.5">Nb de trades / jour</label>
              <input
                type="number"
                value={plan.maxTradesPerDay}
                onChange={(e) => setPlan((p) => ({ ...p, maxTradesPerDay: e.target.value }))}
                placeholder="3"
                className={`${inputClass} font-mono`}
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1.5">Perte max / jour (%)</label>
              <input
                type="number"
                step="0.1"
                value={plan.maxDailyLossPercent}
                onChange={(e) => setPlan((p) => ({ ...p, maxDailyLossPercent: e.target.value }))}
                placeholder="3"
                className={`${inputClass} font-mono`}
              />
            </div>
          </div>

          {/* Conditions d'entrée / d'arrêt */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1.5">Conditions d'entrée</label>
              <textarea
                rows={3}
                value={plan.entryConditions}
                onChange={(e) => setPlan((p) => ({ ...p, entryConditions: e.target.value }))}
                placeholder="Ce qui doit être réuni pour entrer..."
                className={`${inputClass} resize-none`}
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1.5">Conditions d'arrêt (stop la journée)</label>
              <textarea
                rows={3}
                value={plan.stopConditions}
                onChange={(e) => setPlan((p) => ({ ...p, stopConditions: e.target.value }))}
                placeholder="Quand j'arrête : -3%, 2 pertes d'affilée, tilt..."
                className={`${inputClass} resize-none`}
              />
            </div>
          </div>

          {/* Règles d'or */}
          <div>
            <label className="block text-xs font-bold text-slate-300 mb-1.5">Règles d'or / rappels</label>
            <textarea
              rows={3}
              value={plan.goldenRules}
              onChange={(e) => setPlan((p) => ({ ...p, goldenRules: e.target.value }))}
              placeholder="Ne jamais bouger mon stop. Pas de trade sur émotion. Respecter le plan."
              className={`${inputClass} resize-none`}
            />
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-5 sm:px-6 py-4 border-t border-[#1B2320] shrink-0">
          <button
            onClick={onClose}
            className="px-4 py-2.5 rounded-xl bg-[#1B2320] hover:bg-[#232D29] text-slate-300 font-bold text-xs"
          >
            Fermer
          </button>
          <button
            onClick={handleSaveNow}
            className="px-5 py-2.5 rounded-xl bg-[#00E676] hover:bg-[#00c865] text-slate-950 font-extrabold text-xs shadow-lg shadow-[#00E676]/20 flex items-center gap-1.5"
          >
            <Check className="w-3.5 h-3.5" /> Enregistrer
          </button>
        </div>
      </div>
    </div>
  );
};
