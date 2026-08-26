import React, { useEffect, useMemo, useState } from "react";
import { Loader2, Zap } from "lucide-react";
import { api, EconomicCalendarEvent, MarketQuote } from "../lib/api";
import { MarketMapWidget } from "./MarketMapWidget";

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

type ImpactLevel = "High" | "Medium" | "Low" | "Holiday";

const IMPACT_DOT: Record<string, string> = {
  High: "bg-rose-500",
  Medium: "bg-amber-500",
  Low: "bg-slate-500",
  Holiday: "bg-violet-500",
};

/**
 * Filtre par impact — sélection MULTIPLE et indépendante (chaque pastille
 * est son propre interrupteur, pas un groupe façon boutons radio) : demande
 * explicite de l'utilisateur, qui revient sur le comportement exclusif
 * choisi précédemment. "Férié" est désormais un niveau filtrable comme les
 * autres, plus un cas toujours affiché à part.
 */
const IMPACT_FILTER_OPTIONS: {
  id: ImpactLevel;
  label: string;
  dotClass: string;
  activeClasses: string;
}[] = [
  { id: "High", label: "Fort", dotClass: "bg-rose-500", activeClasses: "bg-rose-500/15 border-rose-500/60 text-rose-400" },
  { id: "Medium", label: "Moyen", dotClass: "bg-amber-500", activeClasses: "bg-amber-500/15 border-amber-500/60 text-amber-400" },
  { id: "Low", label: "Faible", dotClass: "bg-slate-400", activeClasses: "bg-slate-500/15 border-slate-400/60 text-slate-300" },
  { id: "Holiday", label: "Férié", dotClass: "bg-violet-500", activeClasses: "bg-violet-500/15 border-violet-500/60 text-violet-400" },
];

/**
 * Le marché en direct ne s'actualise plus en continu : seulement à ces 3
 * horaires (heure locale du navigateur), sur demande explicite du fondateur.
 * Le calendrier économique garde son propre cycle (`CALENDAR_REFRESH_MS`),
 * inchangé.
 */
const MARKET_REFRESH_HOURS = [8, 12, 20];
const CALENDAR_REFRESH_MS = 10 * 60_000;

/** Prochain horaire de `MARKET_REFRESH_HOURS` strictement après `from`. */
function getNextMarketRefresh(from: Date): Date {
  for (let dayOffset = 0; dayOffset <= 1; dayOffset++) {
    for (const hour of MARKET_REFRESH_HOURS) {
      const candidate = new Date(from);
      candidate.setDate(from.getDate() + dayOffset);
      candidate.setHours(hour, 0, 0, 0);
      if (candidate.getTime() > from.getTime()) return candidate;
    }
  }
  // Filet de sécurité — inatteignable en pratique : un créneau du lendemain
  // est toujours strictement après `from`, la boucle ci-dessus le trouve.
  const fallback = new Date(from);
  fallback.setDate(from.getDate() + 1);
  fallback.setHours(MARKET_REFRESH_HOURS[0], 0, 0, 0);
  return fallback;
}

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

function isToday(isoDate: string, reference: Date): boolean {
  const d = new Date(isoDate);
  return (
    d.getFullYear() === reference.getFullYear() &&
    d.getMonth() === reference.getMonth() &&
    d.getDate() === reference.getDate()
  );
}

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

/** `false` si `isoDate` tombe avant le début du jour de `reference` — jours déjà passés de la semaine du flux, exclus de la vue "Cette semaine". */
function isTodayOrLater(isoDate: string, reference: Date): boolean {
  return new Date(isoDate).getTime() >= startOfDay(reference).getTime();
}

/**
 * `true` du lundi au vendredi seulement — les marchés actions/indices/Forex
 * classiques sont fermés le week-end, les quelques annonces du flux datées
 * samedi/dimanche (fuseaux d'Océanie surtout) n'ont donc pas leur place ici,
 * sur demande explicite de l'utilisateur.
 */
function isWeekday(isoDate: string): boolean {
  const day = new Date(isoDate).getDay(); // 0 = dimanche, 6 = samedi
  return day >= 1 && day <= 5;
}

/** "Aujourd'hui" / "Demain" / "lundi 24 août" — en-tête de groupe pour la vue "Cette semaine". */
function dayLabel(isoDate: string, reference: Date): string {
  const d = new Date(isoDate);
  const diffDays = Math.round((startOfDay(d).getTime() - startOfDay(reference).getTime()) / 86_400_000);
  if (diffDays === 0) return "Aujourd'hui";
  if (diffDays === 1) return "Demain";
  return d.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" });
}

function formatPrice(value: number): string {
  const decimals = Math.abs(value) >= 1000 ? 0 : Math.abs(value) >= 100 ? 2 : 4;
  return value.toLocaleString("fr-FR", { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

/** Mini-graphique en aire, dessiné en SVG pur — pas besoin de recharts pour 20 points. */
const Sparkline: React.FC<{ points: number[]; positive: boolean }> = ({ points, positive }) => {
  if (points.length < 2) return <div className="h-10" />;

  const width = 140;
  const height = 40;
  const min = Math.min(...points);
  const max = Math.max(...points);
  const range = max - min || 1;

  const coords = points.map((p, i) => {
    const x = (i / (points.length - 1)) * width;
    const y = height - ((p - min) / range) * height;
    return [x, y];
  });

  const linePath = coords.map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  const areaPath = `${linePath} L${width},${height} L0,${height} Z`;
  const color = positive ? "#00E676" : "#f43f5e";
  const gradientId = `spark-${positive ? "up" : "down"}`;

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-10" preserveAspectRatio="none">
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity={0.35} />
          <stop offset="100%" stopColor={color} stopOpacity={0} />
        </linearGradient>
      </defs>
      <path d={areaPath} fill={`url(#${gradientId})`} stroke="none" />
      <path d={linePath} fill="none" stroke={color} strokeWidth={1.5} />
    </svg>
  );
};

/**
 * Sentiment de risque synthétique : dérivé du VIX (peur) et du Dollar (DXY),
 * les deux baromètres classiques du risk-on/risk-off — pas une vraie mesure
 * officielle, juste une lecture rapide et indicative de la tendance du jour.
 * VIX élevé + DXY en hausse → risk-off ; l'inverse → risk-on.
 */
function computeRiskSentiment(quotes: MarketQuote[]): number {
  const vix = quotes.find((q) => q.symbol === "^VIX");
  const dxy = quotes.find((q) => q.symbol === "DX-Y.NYB");
  if (!vix || !dxy) return 50;

  // VIX au-dessus de 25 = nervosité marquée ; en dessous de 15 = calme.
  const vixScore = Math.max(0, Math.min(100, 100 - ((vix.price - 12) / (30 - 12)) * 100));
  const dxyScore = Math.max(0, Math.min(100, 50 - dxy.changePercent * 15));
  return Math.round((vixScore + dxyScore) / 2);
}

export const MacroDashboard: React.FC = () => {
  const [now, setNow] = useState(() => new Date());
  const [quotes, setQuotes] = useState<MarketQuote[] | null>(null);
  const [marketError, setMarketError] = useState<string | null>(null);
  const [lastMarketUpdate, setLastMarketUpdate] = useState<Date | null>(null);
  const [rawEvents, setRawEvents] = useState<EconomicCalendarEvent[] | null>(null);
  const [calendarError, setCalendarError] = useState<string | null>(null);
  // Sélection multiple indépendante — chaque niveau d'impact est son propre
  // interrupteur, pas un groupe exclusif façon boutons radio (revenu sur ce
  // comportement sur demande explicite de l'utilisateur). Tout activé par
  // défaut : rien n'est filtré tant que personne n'a désactivé un niveau.
  const [selectedImpacts, setSelectedImpacts] = useState<Set<ImpactLevel>>(
    () => new Set<ImpactLevel>(["High", "Medium", "Low", "Holiday"])
  );
  const toggleImpact = (level: ImpactLevel) => {
    setSelectedImpacts((prev) => {
      const next = new Set(prev);
      if (next.has(level)) next.delete(level);
      else next.add(level);
      return next;
    });
  };

  /** Portée de la liste — "Aujourd'hui" (comportement historique) ou "Cette semaine" (tout le flux, à partir d'aujourd'hui). Exclusif : les deux vues n'ont pas de sens combinées. */
  const [scope, setScope] = useState<"today" | "week">("today");

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;
    const load = async () => {
      try {
        const { quotes: q } = await api.fetchMarketData();
        if (!cancelled) {
          setQuotes(q);
          setMarketError(null);
          setLastMarketUpdate(new Date());
        }
      } catch (err) {
        if (!cancelled) setMarketError((err as Error).message || "Marché indisponible.");
      }
    };
    // Chargement immédiat pour ne pas afficher une page vide à l'ouverture,
    // puis un seul `setTimeout` reprogrammé à chaque exécution vers le
    // prochain créneau de MARKET_REFRESH_HOURS — pas de `setInterval` à
    // cadence fixe, l'actualisation automatique n'a lieu qu'à ces horaires.
    const scheduleNext = () => {
      if (cancelled) return;
      const delay = getNextMarketRefresh(new Date()).getTime() - Date.now();
      timer = setTimeout(() => {
        void load().finally(scheduleNext);
      }, delay);
    };
    void load();
    scheduleNext();
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const { events } = await api.fetchEconomicCalendar();
        if (!cancelled) {
          setRawEvents(events);
          setCalendarError(null);
        }
      } catch (err) {
        if (!cancelled) setCalendarError((err as Error).message || "Calendrier indisponible.");
      }
    };
    void load();
    const timer = setInterval(() => void load(), CALENDAR_REFRESH_MS);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, []);

  const events = useMemo(() => {
    if (!rawEvents) return [];
    return rawEvents
      .filter((ev) => isWeekday(ev.date))
      .filter((ev) => (scope === "today" ? isToday(ev.date, now) : isTodayOrLater(ev.date, now)))
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
  }, [rawEvents, now, scope]);

  /**
   * Prochaine annonce à fort impact — sur TOUTE la semaine du flux (pas
   * seulement `events`, filtré sur "aujourd'hui" pour la liste juste en
   * dessous) : un vendredi soir, la prochaine annonce "Fort impact" est
   * probablement lundi, pas "aucune" faute de correspondance du jour même.
   */
  const nextHighImpact = useMemo(() => {
    if (!rawEvents) return null;
    return rawEvents
      .filter((ev) => ev.impact === "High")
      .filter((ev) => isWeekday(ev.date))
      .map((ev) => {
        const eventTime = new Date(ev.date);
        return { ...ev, eventTime, minutesUntil: Math.round((eventTime.getTime() - now.getTime()) / 60_000) };
      })
      .filter((ev) => ev.minutesUntil > 0)
      .sort((a, b) => a.eventTime.getTime() - b.eventTime.getTime())[0] ?? null;
  }, [rawEvents, now]);

  const highImpactCount = events.filter((e) => e.impact === "High").length;
  const filteredEvents = events.filter((e) => selectedImpacts.has(e.impact as ImpactLevel));

  /** Regroupement par jour — utilisé seulement en vue "Cette semaine" (un seul groupe, inutile, en vue "Aujourd'hui"). */
  const groupedEvents = useMemo(() => {
    const groups: { label: string; items: typeof filteredEvents }[] = [];
    for (const item of filteredEvents) {
      const label = dayLabel(item.date, now);
      const lastGroup = groups[groups.length - 1];
      if (lastGroup && lastGroup.label === label) lastGroup.items.push(item);
      else groups.push({ label, items: [item] });
    }
    return groups;
  }, [filteredEvents, now]);

  const riskScore = quotes ? computeRiskSentiment(quotes) : 50;
  const riskLabel = riskScore >= 60 ? "Risk-On" : riskScore <= 40 ? "Risk-Off" : "Neutre";

  return (
    <div className="space-y-6 pb-12 font-sans text-slate-100">
      {/* Bandeau ticker */}
      <div className="overflow-x-auto -mx-4 sm:-mx-8 px-4 sm:px-8">
        <div className="flex items-center gap-6 whitespace-nowrap text-xs font-mono py-2 border-b border-[#1B2320]">
          {quotes?.map((q) => (
            <span key={q.symbol} className="flex items-center gap-1.5 shrink-0">
              <span className="text-slate-400">{q.label}</span>
              <span className="text-white font-bold">{formatPrice(q.price)}</span>
              <span className={q.changePercent >= 0 ? "text-[#00E676]" : "text-rose-400"}>
                {q.changePercent >= 0 ? "▲" : "▼"} {Math.abs(q.changePercent).toFixed(2)}%
              </span>
            </span>
          ))}
        </div>
      </div>

      <div>
        <h1 className="text-2xl font-bold text-white">Macro</h1>
        <p className="text-xs text-slate-400">Marché en direct et calendrier économique</p>
      </div>

      {/* Prochaine annonce à fort impact */}
      {nextHighImpact && (
        <div className="bg-gradient-to-r from-rose-500/10 to-transparent border border-rose-500/20 rounded-xl px-4 py-3 flex items-center gap-3">
          <Zap className="w-5 h-5 text-amber-400 shrink-0" />
          <div className="min-w-0 flex-1">
            <div className="text-[10px] uppercase tracking-wider text-slate-400 font-bold">
              Prochaine annonce à fort impact
            </div>
            <div className="text-sm text-white font-semibold truncate flex items-center gap-1.5">
              <span>{CURRENCY_FLAGS[nextHighImpact.country] ?? FALLBACK_FLAG}</span>
              {nextHighImpact.title}
            </div>
          </div>
          <div className="text-right shrink-0">
            <div className="text-lg font-black text-white">
              {formatCountdown(nextHighImpact.minutesUntil)}
            </div>
            <div className="text-[11px] text-slate-500">{formatClock(nextHighImpact.eventTime)}</div>
          </div>
        </div>
      )}

      {/* Carte des marchés */}
      <MarketMapWidget now={now} vix={quotes?.find((q) => q.symbol === "^VIX")} nextHighImpact={nextHighImpact} />

      {/* Sentiment de risque */}
      <div className="bg-[#111615] border border-[#1B2320] rounded-xl p-5 space-y-3">
        <div className="flex items-center justify-between text-xs font-bold">
          <span className="text-slate-400">Sentiment de risque</span>
          <span className={riskScore >= 60 ? "text-[#00E676]" : riskScore <= 40 ? "text-rose-400" : "text-slate-300"}>
            {riskLabel}
          </span>
        </div>
        <div className="relative h-1.5 rounded-full bg-gradient-to-r from-rose-500 via-slate-600 to-[#00E676]">
          <div
            className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-3 h-3 rounded-full bg-white border-2 border-[#111615] shadow"
            style={{ left: `${riskScore}%` }}
          />
        </div>
        <div className="flex justify-between text-[10px] text-slate-500 font-mono">
          <span>Risk-Off</span>
          <span>Neutre</span>
          <span>Risk-On</span>
        </div>
      </div>

      {/* Marché en direct */}
      <div className="space-y-3">
        <div className="flex items-center justify-between flex-wrap gap-1">
          <h4 className="text-sm font-bold text-white flex items-center gap-2">
            <span className="w-1 h-4 rounded-full bg-violet-500" />
            Marché en direct
          </h4>
          <p className="text-[11px] text-slate-500">
            {lastMarketUpdate ? `Actualisé à ${formatClock(lastMarketUpdate)}` : "Chargement…"}
            {" · "}Prochaine actualisation à {formatClock(getNextMarketRefresh(now))}
          </p>
        </div>

        {!quotes && !marketError && (
          <div className="flex items-center gap-2 text-xs text-slate-500 py-6 justify-center">
            <Loader2 className="w-4 h-4 animate-spin" /> Chargement des cotations…
          </div>
        )}
        {marketError && !quotes && (
          <div className="p-4 text-center text-xs text-slate-500 italic">
            Données de marché indisponibles pour le moment.
          </div>
        )}
        {quotes && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {quotes.map((q) => {
              const positive = q.changePercent >= 0;
              return (
                <div key={q.symbol} className="bg-[#111615] border border-[#1B2320] rounded-xl p-4 space-y-2">
                  <div className="flex items-center justify-between text-xs text-slate-400">
                    <span>{q.label}</span>
                    <span className="font-mono text-[10px] text-slate-600">{q.symbol}</span>
                  </div>
                  <div className="text-xl font-black text-white font-mono">{formatPrice(q.price)}</div>
                  <Sparkline points={q.sparkline} positive={positive} />
                  <div className={`text-xs font-bold ${positive ? "text-[#00E676]" : "text-rose-400"}`}>
                    {positive ? "+" : ""}
                    {q.changePercent.toFixed(2)}%
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Annonces à venir */}
      <div className="space-y-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <h4 className="text-sm font-bold text-white flex items-center gap-2">
            <span className="w-1 h-4 rounded-full bg-violet-500" />
            Annonces à venir {scope === "today" ? "aujourd'hui" : "cette semaine"}
          </h4>
          {rawEvents !== null && (
            <span className="text-[11px] text-slate-500 font-mono">
              {events.length} annonce{events.length > 1 ? "s" : ""} {scope === "today" ? "aujourd'hui" : "cette semaine"}
              {highImpactCount > 0 && ` · ${highImpactCount} à fort impact`}
            </span>
          )}
        </div>

        {/* Portée : Aujourd'hui / Cette semaine — exclusif, les deux vues n'ont pas de sens combinées. */}
        <div className="flex items-center gap-2 text-xs font-medium">
          {(
            [
              { id: "today", label: "Aujourd'hui" },
              { id: "week", label: "Cette semaine" },
            ] as const
          ).map((opt) => (
            <button
              key={opt.id}
              type="button"
              aria-pressed={scope === opt.id}
              onClick={() => setScope(opt.id)}
              className={`px-3.5 py-1.5 rounded-full border transition-all whitespace-nowrap ${
                scope === opt.id
                  ? "bg-[#00E676]/15 border-[#00E676]/60 text-[#00E676] font-bold"
                  : "bg-[#0D1110] border-[#1B2320] text-slate-500 hover:text-white"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {rawEvents && events.length > 0 && (
          <div className="flex items-center gap-2 flex-wrap text-xs font-medium">
            <span className="text-[10px] uppercase tracking-wider text-slate-500 font-bold mr-1">Impact :</span>
            {IMPACT_FILTER_OPTIONS.map((opt) => {
              const isActive = selectedImpacts.has(opt.id);
              return (
                <button
                  key={opt.id}
                  type="button"
                  aria-pressed={isActive}
                  onClick={() => toggleImpact(opt.id)}
                  className={`flex items-center gap-2 px-3.5 py-1.5 rounded-full border transition-all whitespace-nowrap ${
                    isActive
                      ? `${opt.activeClasses} font-bold`
                      : "bg-[#0D1110] border-[#1B2320] text-slate-500 hover:text-white"
                  }`}
                >
                  <span className={`w-2 h-2 rounded-full shrink-0 ${isActive ? opt.dotClass : "bg-slate-600"}`} />
                  {opt.label}
                </button>
              );
            })}
          </div>
        )}

        {!rawEvents && !calendarError && (
          <div className="flex items-center gap-2 text-xs text-slate-500 py-6 justify-center">
            <Loader2 className="w-4 h-4 animate-spin" /> Chargement du calendrier…
          </div>
        )}
        {calendarError && !rawEvents && (
          <div className="p-4 text-center text-xs text-slate-500 italic">
            Impossible de charger le calendrier, réessaie plus tard.
          </div>
        )}
        {rawEvents && events.length === 0 && (
          <div className="p-4 text-center text-xs text-slate-500 italic">
            {scope === "today" ? "Aucune annonce prévue aujourd'hui." : "Aucune annonce prévue cette semaine."}
          </div>
        )}
        {rawEvents && events.length > 0 && filteredEvents.length === 0 && (
          <div className="p-4 text-center text-xs text-slate-500 italic">
            Aucune annonce ne correspond aux filtres d'impact sélectionnés.
          </div>
        )}
        {rawEvents && groupedEvents.length > 0 && (
          <div className="space-y-4">
            {groupedEvents.map((group) => (
              <div key={group.label} className="space-y-2">
                {/* En-tête de jour : seulement utile quand plusieurs jours sont
                    mélangés (vue "Cette semaine") — en vue "Aujourd'hui" il n'y a
                    qu'un seul groupe, l'en-tête serait redondant avec le titre. */}
                {scope === "week" && (
                  <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wide px-1 capitalize">
                    {group.label}
                  </div>
                )}
                <div className="border border-[#1B2320] rounded-xl divide-y divide-[#1B2320] overflow-hidden">
                  {group.items.map((item) => {
                    const isImminent = item.countdown !== null && item.minutesUntil <= 15;
                    return (
                      <div key={item.id} className="flex items-start gap-4 p-3.5">
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
                              className={`w-1.5 h-1.5 rounded-full shrink-0 ${IMPACT_DOT[item.impact] ?? "bg-slate-500"}`}
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
              </div>
            ))}
          </div>
        )}
      </div>

    </div>
  );
};
