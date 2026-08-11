import React, { useEffect, useMemo, useState } from "react";
import { Loader2 } from "lucide-react";
import { api, EconomicCalendarEvent, MarketQuote } from "../lib/api";

const MARKET_NEWS = [
  "WTI Price Forecast: Edges lower to near $74.50 with bearish bias intact below 100-day SMA",
  "British Pound: Consolidation with limited upside scope against US Dollar – UOB",
  "Euro holds gains against the Pound awaiting Eurozone and UK Services PMIs",
  "Japanese Yen: Joint action fails to secure lasting gains – Commerzbank",
  "Forex Today: US Dollar struggles as risk flows dominate markets",
];

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

const MARKET_REFRESH_MS = 60_000;
const CALENDAR_REFRESH_MS = 10 * 60_000;

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
  const [rawEvents, setRawEvents] = useState<EconomicCalendarEvent[] | null>(null);
  const [calendarError, setCalendarError] = useState<string | null>(null);

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const { quotes: q } = await api.fetchMarketData();
        if (!cancelled) {
          setQuotes(q);
          setMarketError(null);
        }
      } catch (err) {
        if (!cancelled) setMarketError((err as Error).message || "Marché indisponible.");
      }
    };
    void load();
    const timer = setInterval(() => void load(), MARKET_REFRESH_MS);
    return () => {
      cancelled = true;
      clearInterval(timer);
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

  const highImpactCount = events.filter((e) => e.impact === "High").length;
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
        <p className="text-xs text-slate-400">Marché en direct, calendrier économique et actualités</p>
      </div>

      {/* Sentiment de risque */}
      <div className="bg-[#111615] border border-[#1B2320] rounded-2xl p-5 space-y-3">
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
        <h4 className="text-sm font-bold text-white flex items-center gap-2">
          <span className="w-1 h-4 rounded-full bg-violet-500" />
          Marché en direct
        </h4>

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
                <div key={q.symbol} className="bg-[#111615] border border-[#1B2320] rounded-2xl p-4 space-y-2">
                  <div className="flex items-center justify-between text-xs text-slate-400">
                    <span>{q.label}</span>
                    <span className="font-mono text-[10px] text-slate-600">{q.symbol}</span>
                  </div>
                  <div className="text-xl font-bold text-white font-mono">{formatPrice(q.price)}</div>
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

      {/* Annonces à venir aujourd'hui */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-bold text-white flex items-center gap-2">
            <span className="w-1 h-4 rounded-full bg-violet-500" />
            Annonces à venir aujourd'hui
          </h4>
          {rawEvents !== null && (
            <span className="text-[11px] text-slate-500 font-mono">
              {events.length} annonce{events.length > 1 ? "s" : ""} aujourd'hui
              {highImpactCount > 0 && ` · ${highImpactCount} à fort impact`}
            </span>
          )}
        </div>

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
            Aucune annonce prévue aujourd'hui.
          </div>
        )}
        {rawEvents && events.length > 0 && (
          <div className="border border-[#1B2320] rounded-2xl divide-y divide-[#1B2320] overflow-hidden">
            {events.map((item) => {
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

      {/* Repères macro */}
      <div className="bg-[#111615] border border-[#1B2320] rounded-2xl p-5 text-xs text-slate-300 space-y-1">
        <p>
          <strong className="text-white">Repères macro.</strong> Un <strong className="text-white">DXY</strong>{" "}
          (dollar) qui monte pèse souvent sur l'or et les actions. Des{" "}
          <strong className="text-white">taux US 10Y</strong> en hausse tendent à peser sur les valeurs de
          croissance (Nasdaq). Un <strong className="text-white">VIX</strong> élevé = nervosité (risk-off).
        </p>
        <p className="text-slate-500">
          Ces données de marché et cette analyse ont un but éducatif — ce n'est pas un conseil en investissement. Le
          trading comporte un risque de perte en capital. Sources : Forex Factory (calendrier), Yahoo Finance
          (marché).
        </p>
      </div>
    </div>
  );
};
