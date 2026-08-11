import React, { useEffect, useMemo, useState } from "react";
import { Calendar, AlertCircle, Globe, X } from "lucide-react";

interface EconomicCalendarModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type Impact = "HIGH" | "MEDIUM" | "LOW";

interface CalendarEventTemplate {
  id: string;
  /** Minutes depuis l'ouverture de la modale — passé (négatif) ou à venir. */
  offsetMinutes: number;
  currency: "EUR" | "GBP" | "USD" | "JPY";
  flag: string;
  event: string;
  impact: Impact;
  forecast: string;
  previous: string;
}

/**
 * Événements relatifs à l'instant d'ouverture (`offsetMinutes`), pas à une
 * heure d'horloge fixe : un calendrier codé en dur sur « 08:45 » afficherait
 * un compte à rebours négatif absurde selon l'heure à laquelle l'utilisateur
 * ouvre la modale. En partant de l'instant réel, l'heure affichée et le
 * compte à rebours restent cohérents quel que soit le moment de consultation.
 *
 * Données de démonstration — voir HANDOFF.md §1 : aucune source de cours ou
 * de calendrier économique réelle n'est intégrée à l'application.
 */
const EVENT_TEMPLATES: CalendarEventTemplate[] = [
  {
    id: "1",
    offsetMinutes: -22,
    currency: "EUR",
    flag: "🇫🇷",
    event: "French Industrial Production m/m",
    impact: "LOW",
    forecast: "0.3%",
    previous: "-0.1%",
  },
  {
    id: "2",
    offsetMinutes: 8,
    currency: "EUR",
    flag: "🇪🇸",
    event: "Spanish Services PMI",
    impact: "MEDIUM",
    forecast: "54.9",
    previous: "54.2",
  },
  {
    id: "3",
    offsetMinutes: 38,
    currency: "EUR",
    flag: "🇮🇹",
    event: "Italian Services PMI",
    impact: "MEDIUM",
    forecast: "51.0",
    previous: "50.2",
  },
  {
    id: "4",
    offsetMinutes: 43,
    currency: "EUR",
    flag: "🇫🇷",
    event: "French Final Services PMI",
    impact: "LOW",
    forecast: "49.8",
    previous: "49.8",
  },
  {
    id: "5",
    offsetMinutes: 48,
    currency: "EUR",
    flag: "🇩🇪",
    event: "German Final Services PMI",
    impact: "MEDIUM",
    forecast: "49.6",
    previous: "49.6",
  },
  {
    id: "6",
    offsetMinutes: 53,
    currency: "EUR",
    flag: "🇪🇺",
    event: "Final Services PMI",
    impact: "MEDIUM",
    forecast: "51.6",
    previous: "51.6",
  },
  {
    id: "7",
    offsetMinutes: 83,
    currency: "GBP",
    flag: "🇬🇧",
    event: "Final Services PMI",
    impact: "MEDIUM",
    forecast: "51.8",
    previous: "51.8",
  },
  {
    id: "8",
    offsetMinutes: 113,
    currency: "EUR",
    flag: "🇪🇺",
    event: "PPI m/m",
    impact: "LOW",
    forecast: "-0.2%",
    previous: "0.2%",
  },
  {
    id: "9",
    offsetMinutes: 210,
    currency: "USD",
    flag: "🇺🇸",
    event: "US CPI / Indice des prix à la consommation (m/m)",
    impact: "HIGH",
    forecast: "0.3%",
    previous: "0.2%",
  },
  {
    id: "10",
    offsetMinutes: 330,
    currency: "USD",
    flag: "🇺🇸",
    event: "Discours du Président Jerome Powell (Fed)",
    impact: "HIGH",
    forecast: "-",
    previous: "-",
  },
];

const MARKET_NEWS = [
  "WTI Price Forecast: Edges lower to near $74.50 with bearish bias intact below 100-day SMA",
  "British Pound: Consolidation with limited upside scope against US Dollar – UOB",
  "Euro holds gains against the Pound awaiting Eurozone and UK Services PMIs",
  "Japanese Yen: Joint action fails to secure lasting gains – Commerzbank",
  "Forex Today: US Dollar struggles as risk flows dominate markets",
];

const IMPACT_DOT: Record<Impact, string> = {
  HIGH: "bg-rose-500",
  MEDIUM: "bg-amber-500",
  LOW: "bg-slate-500",
};

/** `"3h07"` au-delà d'une heure, `"8 min"` en-dessous, `null` si déjà passé. */
function formatCountdown(minutesUntil: number): string | null {
  if (minutesUntil <= 0) return null;
  if (minutesUntil < 60) return `dans ${minutesUntil} min`;
  const hours = Math.floor(minutesUntil / 60);
  const minutes = minutesUntil % 60;
  return `dans ${hours}h${minutes.toString().padStart(2, "0")}`;
}

function formatClock(date: Date): string {
  return date.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
}

export const EconomicCalendarModal: React.FC<EconomicCalendarModalProps> = ({
  isOpen,
  onClose,
}) => {
  const [filterImpact, setFilterImpact] = useState<"ALL" | "HIGH">("ALL");

  // Ancre fixée à l'ouverture : recalculer sur `new Date()` à chaque rendu
  // ferait dériver les heures affichées d'une minute à l'autre, alors que
  // seul le compte à rebours doit avancer.
  const [openedAt] = useState(() => new Date());
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    if (!isOpen) return;
    const timer = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(timer);
  }, [isOpen]);

  const events = useMemo(
    () =>
      EVENT_TEMPLATES.map((tpl) => {
        const eventTime = new Date(openedAt.getTime() + tpl.offsetMinutes * 60_000);
        const minutesUntil = Math.round((eventTime.getTime() - now.getTime()) / 60_000);
        return {
          ...tpl,
          time: formatClock(eventTime),
          minutesUntil,
          countdown: formatCountdown(minutesUntil),
        };
      }),
    [openedAt, now]
  );

  if (!isOpen) return null;

  const filteredEvents =
    filterImpact === "HIGH" ? events.filter((e) => e.impact === "HIGH") : events;
  const highImpactCount = events.filter((e) => e.impact === "HIGH").length;

  return (
    <div className="fixed inset-0 z-50 bg-[#0D1110]/80 backdrop-blur-md flex items-center justify-center p-4 font-sans">
      <div className="bg-[#111615] border border-[#1B2320] rounded-2xl max-w-3xl w-full p-6 space-y-6 shadow-2xl relative text-slate-100 max-h-[90vh] overflow-y-auto">
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
            className="p-1.5 rounded-lg bg-[#1B2320] hover:bg-[#232D29] text-slate-400 hover:text-white transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Filter bar */}
        <div className="flex items-center justify-between bg-[#0D1110] p-2 rounded-xl border border-[#1B2320] text-xs">
          <span className="text-slate-400 font-mono flex items-center gap-1.5">
            <Globe className="w-4 h-4 text-slate-500" /> Heure locale du navigateur
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

        {/* Annonces à venir aujourd'hui */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-bold text-white flex items-center gap-2">
              <span className="w-1 h-4 rounded-full bg-violet-500" />
              Annonces à venir aujourd'hui
            </h4>
            <span className="text-[11px] text-slate-500 font-mono">
              {filteredEvents.length} annonce{filteredEvents.length > 1 ? "s" : ""} aujourd'hui
              {highImpactCount > 0 && ` · ${highImpactCount} High Impact`}
            </span>
          </div>

          <div className="border border-[#1B2320] rounded-xl divide-y divide-[#1B2320] overflow-hidden">
            {filteredEvents.length === 0 ? (
              <div className="p-4 text-center text-xs text-slate-500 italic">
                Aucune annonce ne correspond à ce filtre.
              </div>
            ) : (
              filteredEvents.map((item) => {
                const isImminent = item.countdown !== null && item.minutesUntil <= 15;
                return (
                  <div
                    key={item.id}
                    className="flex items-start gap-4 p-3.5 border border-transparent hover:border-[#232D29] hover:bg-[#0f1412] rounded-lg transition-colors"
                  >
                    <div
                      className={`w-14 shrink-0 font-mono text-sm font-bold pt-0.5 ${
                        isImminent ? "text-amber-400" : "text-white"
                      }`}
                    >
                      {item.time}
                    </div>
                    <div className="w-6 shrink-0 text-center text-lg leading-none pt-0.5">{item.flag}</div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${IMPACT_DOT[item.impact]}`} />
                        <span className="font-bold text-white text-sm">{item.event}</span>
                      </div>
                      <div className="text-xs text-slate-500 font-mono mt-0.5">
                        prév. {item.forecast} · précéd. {item.previous}
                        {item.countdown && (
                          <span className={isImminent ? "text-amber-400 font-semibold" : "text-slate-500"}>
                            {" "}
                            · {item.countdown}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Actualités marché */}
        <div className="space-y-3">
          <h4 className="text-sm font-bold text-white flex items-center gap-2">
            <span className="w-1 h-4 rounded-full bg-violet-500" />
            Actualités marché
          </h4>
          <div className="space-y-2.5">
            {MARKET_NEWS.map((headline, i) => (
              <div key={i} className="flex items-start gap-2.5 text-sm text-slate-300">
                <span className="w-1.5 h-1.5 rounded-full bg-[#00E676] shrink-0 mt-1.5" />
                <span>{headline}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Advice Footer */}
        <div className="flex items-center justify-between pt-2 border-t border-[#1B2320]">
          <span className="text-xs text-amber-400 font-medium flex items-center gap-1.5">
            <AlertCircle className="w-4 h-4 text-amber-400" />
            Règle SMC : Ne jamais trader les 15 minutes encadrant les annonces High Impact.
          </span>

          <button
            onClick={onClose}
            className="px-5 py-2.5 rounded-xl bg-[#1B2320] hover:bg-[#232D29] text-white font-bold text-xs"
          >
            Fermer
          </button>
        </div>
      </div>
    </div>
  );
};
