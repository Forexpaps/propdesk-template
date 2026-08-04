import React, { useState } from "react";
import { Calendar, AlertCircle, Clock, Globe, Shield, Filter, Search, X } from "lucide-react";

interface EconomicCalendarModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const EconomicCalendarModal: React.FC<EconomicCalendarModalProps> = ({
  isOpen,
  onClose,
}) => {
  const [filterImpact, setFilterImpact] = useState<"ALL" | "HIGH">("HIGH");

  if (!isOpen) return null;

  const events = [
    {
      id: "1",
      time: "14:30",
      date: "Aujourd'hui",
      currency: "USD",
      event: "US CPI / Indice des prix à la consommation (m/m)",
      impact: "HIGH",
      forecast: "0.3%",
      previous: "0.2%",
      note: "Volatilité extrême attendue sur EUR/USD, Gold et NAS100",
    },
    {
      id: "2",
      time: "16:00",
      date: "Aujourd'hui",
      currency: "USD",
      event: "Discours du Président Jerome Powell (Fed)",
      impact: "HIGH",
      forecast: "-",
      previous: "-",
      note: "Éviter toute prise de position 15 min avant et après le discours",
    },
    {
      id: "3",
      time: "14:15",
      date: "Demain",
      currency: "EUR",
      event: "Décision de la BCE sur les taux d'intérêt",
      impact: "HIGH",
      forecast: "3.75%",
      previous: "4.00%",
      note: "Impact majeur sur les paires en EUR",
    },
    {
      id: "4",
      time: "10:00",
      date: "Demain",
      currency: "GBP",
      event: "Ventes au détail (Retail Sales m/m)",
      impact: "MEDIUM",
      forecast: "0.5%",
      previous: "-0.1%",
      note: "Volatilité modérée GBP/USD",
    },
    {
      id: "5",
      time: "14:30",
      date: "Vendredi",
      currency: "USD",
      event: "NFP - Non-Farm Payrolls (Emplois non agricoles)",
      impact: "HIGH",
      forecast: "185K",
      previous: "206K",
      note: "Événement le plus volatil du mois. Ne pas garder de position sans SL serré",
    },
  ];

  const filteredEvents =
    filterImpact === "HIGH" ? events.filter((e) => e.impact === "HIGH") : events;

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 font-sans">
      <div className="bg-[#111615] border border-[#1B2320] rounded-2xl max-w-2xl w-full p-6 space-y-6 shadow-2xl relative text-slate-100">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#1B2320] pb-4">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-rose-500/10 text-rose-400 border border-rose-500/20">
              <Calendar className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">Calendrier Économique & High Impact News</h3>
              <p className="text-xs text-slate-400">Évitez les pièges de volatilité institutionnelle</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg bg-[#1B2320] hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Filter bar */}
        <div className="flex items-center justify-between bg-[#0D1110] p-2 rounded-xl border border-[#1B2320] text-xs">
          <span className="text-slate-400 font-mono flex items-center gap-1.5">
            <Globe className="w-4 h-4 text-slate-500" /> Heure locale : EST (New York)
          </span>

          <div className="flex items-center gap-1 bg-[#111615] p-1 rounded-lg border border-[#1B2320]">
            <button
              onClick={() => setFilterImpact("HIGH")}
              className={`px-3 py-1 rounded-md font-bold transition-all ${
                filterImpact === "HIGH"
                  ? "bg-rose-500 text-white shadow-md"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              🔴 High Impact Seul
            </button>
            <button
              onClick={() => setFilterImpact("ALL")}
              className={`px-3 py-1 rounded-md font-bold transition-all ${
                filterImpact === "ALL"
                  ? "bg-[#1B2320] text-white"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              Tous les événements
            </button>
          </div>
        </div>

        {/* Events List */}
        <div className="space-y-3 max-h-80 overflow-y-auto pr-1">
          {filteredEvents.map((item) => (
            <div
              key={item.id}
              className="bg-[#0D1110] p-4 rounded-xl border border-[#1B2320] space-y-2 hover:border-[#00E676]/30 transition-colors"
            >
              <div className="flex items-center justify-between gap-3 text-xs font-mono">
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded bg-[#111615] border border-[#1B2320] font-bold text-slate-300">
                    {item.date} • {item.time}
                  </span>
                  <span
                    className={`px-2 py-0.5 rounded font-black ${
                      item.currency === "USD"
                        ? "bg-[#00E676]/20 text-[#00E676] border border-[#00E676]/30"
                        : "bg-blue-500/20 text-blue-300 border border-blue-500/30"
                    }`}
                  >
                    {item.currency}
                  </span>
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                      item.impact === "HIGH"
                        ? "bg-rose-500/20 text-rose-400 border border-rose-500/30 animate-pulse"
                        : "bg-amber-500/20 text-amber-400 border border-amber-500/30"
                    }`}
                  >
                    {item.impact === "HIGH" ? "🔴 DANGER VOLATILITÉ" : "🟠 MOYEN"}
                  </span>
                </div>

                <div className="text-[11px] text-slate-400">
                  Prévu: <span className="text-white font-bold">{item.forecast}</span> | Préc:{" "}
                  <span className="text-slate-500">{item.previous}</span>
                </div>
              </div>

              <div className="text-sm font-bold text-white">{item.event}</div>

              <div className="p-2.5 rounded-lg bg-[#111615] text-xs text-slate-400 border-l-2 border-rose-500 italic">
                {item.note}
              </div>
            </div>
          ))}
        </div>

        {/* Advice Footer */}
        <div className="flex items-center justify-between pt-2 border-t border-[#1B2320]">
          <span className="text-xs text-amber-400 font-medium flex items-center gap-1.5">
            <AlertCircle className="w-4 h-4 text-amber-400" />
            Règle SMC : Ne jamais trader les 15 minutes encadrant les annonces High Impact.
          </span>

          <button
            onClick={onClose}
            className="px-5 py-2.5 rounded-xl bg-[#1B2320] hover:bg-slate-800 text-white font-bold text-xs"
          >
            Fermer
          </button>
        </div>
      </div>
    </div>
  );
};
