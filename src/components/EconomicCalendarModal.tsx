import React, { useEffect, useMemo, useState } from "react";
import { X, Loader2 } from "lucide-react";
import { api, EconomicCalendarEvent } from "../lib/api";

interface EconomicCalendarModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const MARKET_NEWS = [
  "WTI Price Forecast: Edges lower to near $74.50 with bearish bias intact below 100-day SMA",
  "British Pound: Consolidation with limited upside scope against US Dollar – UOB",
  "Euro holds gains against the Pound awaiting Eurozone and UK Services PMIs",
  "Japanese Yen: Joint action fails to secure lasting gains – Commerzbank",
  "Forex Today: US Dollar struggles as risk flows dominate markets",
];

/** Repli générique pour toute devise absente de cette table plutôt qu'un rendu vide. */
const CURRENCY_FLAGS: Record<string, string> = {
  USD: "🇺🇸",
  EUR: "🇪🇺",
  GBP: "🇬🇧",
  JPY: "🇯🇵",
  AUD: "🇦🇺",
  CAD: "🇨🇦",
  CHF: "🇨🇭",
  CNY: "🇨🇳",
  NZD: "🇳🇿",
};
const FALLBACK_FLAG = "🌐";

const IMPACT_DOT: Record<string, string> = {
  High: "bg-rose-500",
  Medium: "bg-amber-500",
  Low: "bg-slate-500",
  Holiday: "bg-slate-700",
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

/**
 * Fenêtre du jour calendaire **local** au visiteur, pas en UTC : « aujourd'hui »
 * est une notion propre au fuseau de la personne qui regarde l'écran. Le flux
 * fournit des horodatages ISO avec décalage explicite, donc `new Date(iso)`
 * reste correct quel que soit le fuseau — seule la borne de comparaison doit
 * être locale.
 */
function isToday(isoDate: string, reference: Date): boolean {
  const d = new Date(isoDate);
  return (
    d.getFullYear() === reference.getFullYear() &&
    d.getMonth() === reference.getMonth() &&
    d.getDate() === reference.getDate()
  );
}

export const EconomicCalendarModal: React.FC<EconomicCalendarModalProps> = ({
  isOpen,
  onClose,
}) => {
  const [now, setNow] = useState(() => new Date());
  const [rawEvents, setRawEvents] = useState<EconomicCalendarEvent[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Recalcule uniquement le compte à rebours affiché — pas de requête réseau.
  useEffect(() => {
    if (!isOpen) return;
    const timer = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(timer);
  }, [isOpen]);

  // Charge à l'ouverture, puis rafraîchit périodiquement pour une session
  // laissée ouverte longtemps. En cas d'échec d'un rafraîchissement en
  // arrière-plan, la liste déjà affichée est conservée telle quelle plutôt
  // que vidée — même logique de dégradation gracieuse que le cache serveur.
  useEffect(() => {
    if (!isOpen) return;

    let cancelled = false;

    const load = async () => {
      setLoading((prev) => prev || rawEvents === null);
      try {
        const { events } = await api.fetchEconomicCalendar();
        if (!cancelled) {
          setRawEvents(events);
          setError(null);
        }
      } catch (err) {
        if (!cancelled) {
          console.warn("[calendrier-economique] Chargement échoué.", err);
          setError((err as Error).message || "Impossible de charger le calendrier.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void load();
    const refreshTimer = setInterval(() => void load(), 10 * 60_000);
    return () => {
      cancelled = true;
      clearInterval(refreshTimer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  const events = useMemo(() => {
    if (!rawEvents) return [];
    return rawEvents
      .filter((ev) => isToday(ev.date, now))
      .map((ev) => {
        const eventTime = new Date(ev.date);
        const minutesUntil = Math.round((eventTime.getTime() - now.getTime()) / 60_000);
        return {
          ...ev,
          time: formatClock(eventTime),
          minutesUntil,
          countdown: ev.impact === "Holiday" ? null : formatCountdown(minutesUntil),
          flag: CURRENCY_FLAGS[ev.country] ?? FALLBACK_FLAG,
        };
      })
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }, [rawEvents, now]);

  if (!isOpen) return null;

  const showEmptyList = !loading && rawEvents !== null && events.length === 0 && !error;
  const showErrorState = error !== null && rawEvents === null;

  return (
    <div className="fixed inset-0 z-50 bg-[#0D1110]/80 backdrop-blur-md flex items-center justify-center p-4 font-sans">
      <div className="bg-[#111615] border border-[#1B2320] rounded-2xl max-w-3xl w-full p-6 space-y-6 shadow-2xl relative text-slate-100 max-h-[90vh] overflow-y-auto">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 rounded-lg bg-[#1B2320] hover:bg-[#232D29] text-slate-400 hover:text-white transition-colors"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Annonces à venir aujourd'hui */}
        <div className="space-y-3">
          <div className="flex items-center justify-between pr-8">
            <h4 className="text-sm font-bold text-white flex items-center gap-2">
              <span className="w-1 h-4 rounded-full bg-violet-500" />
              Annonces à venir aujourd'hui
            </h4>
            {rawEvents !== null && !showErrorState && (
              <span className="text-[11px] text-slate-500 font-mono">
                {events.length} annonce{events.length > 1 ? "s" : ""} aujourd'hui
              </span>
            )}
          </div>

          {loading && rawEvents === null ? (
            <div className="flex items-center gap-2 text-xs text-slate-500 py-6 justify-center">
              <Loader2 className="w-4 h-4 animate-spin" /> Chargement du calendrier…
            </div>
          ) : showErrorState ? (
            <div className="p-4 text-center text-xs text-slate-500 italic">
              Impossible de charger le calendrier, réessaie plus tard.
            </div>
          ) : showEmptyList ? (
            <div className="p-4 text-center text-xs text-slate-500 italic">
              Aucune annonce prévue aujourd'hui.
            </div>
          ) : (
            <div className="divide-y divide-[#1B2320]">
              {events.map((item) => {
                const isImminent = item.countdown !== null && item.minutesUntil <= 15;
                return (
                  <div
                    key={item.id}
                    className="flex items-start gap-4 p-3 border border-transparent hover:border-[#1B2320] rounded-lg transition-colors"
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
                        <span
                          className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                            IMPACT_DOT[item.impact] ?? "bg-slate-500"
                          }`}
                        />
                        <span className="font-bold text-white text-sm">{item.title}</span>
                      </div>
                      <div className="text-xs text-slate-500 font-mono mt-0.5">
                        prév. {item.forecast || "-"} · précéd. {item.previous || "-"}
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
              })}
            </div>
          )}
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
      </div>
    </div>
  );
};
