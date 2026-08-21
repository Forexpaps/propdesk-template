import React from "react";
import { Globe2 } from "lucide-react";
import { FOREX_SESSIONS, isSessionActive, isForexMarketClosed } from "./TopHeader";
import { MarketQuote } from "../lib/api";

/**
 * Position en pourcentage dans la zone "carte" (pas une vraie projection
 * géographique — un placement stylisé, ouest→est de gauche à droite, qui
 * retrouve la disposition de la maquette fournie par l'utilisateur) et
 * couleur de piste dans la frise horaire du bas. Couleurs distinctes de
 * celles du point ouvert/fermé (vert/gris) : ici elles identifient la place,
 * pas son état.
 */
const CITIES: {
  name: string;
  timeZone: string;
  session: string;
  top: string;
  left: string;
  trackColor: string;
}[] = [
  { name: "New York", timeZone: "America/New_York", session: "New York", top: "38%", left: "12%", trackColor: "bg-indigo-500" },
  { name: "Londres", timeZone: "Europe/London", session: "Londres", top: "22%", left: "46%", trackColor: "bg-[#00E676]" },
  { name: "Tokyo", timeZone: "Asia/Tokyo", session: "Tokyo", top: "42%", left: "82%", trackColor: "bg-rose-500" },
  { name: "Sydney", timeZone: "Australia/Sydney", session: "Sydney", top: "68%", left: "90%", trackColor: "bg-amber-500" },
];

const HOUR_TICKS = [0, 3, 6, 9, 12, 15, 18, 21, 24];

function formatCityTime(date: Date, timeZone: string): string {
  return new Intl.DateTimeFormat("fr-FR", { timeZone, hour: "2-digit", minute: "2-digit", hour12: false }).format(
    date
  );
}

/** Segments (en %) de la piste horaire d'une session — deux segments si elle traverse minuit UTC (Sydney). */
function sessionSegments(session: { startUTC: number; endUTC: number }): { left: number; width: number }[] {
  if (session.startUTC < session.endUTC) {
    return [{ left: (session.startUTC / 24) * 100, width: ((session.endUTC - session.startUTC) / 24) * 100 }];
  }
  return [
    { left: 0, width: (session.endUTC / 24) * 100 },
    { left: (session.startUTC / 24) * 100, width: ((24 - session.startUTC) / 24) * 100 },
  ];
}

const DAY_ABBR = ["dim.", "lun.", "mar.", "mer.", "jeu.", "ven.", "sam."];

interface NextHighImpactEvent {
  title: string;
  country: string;
  eventTime: Date;
}

interface MarketMapWidgetProps {
  now: Date;
  vix?: MarketQuote;
  nextHighImpact: NextHighImpactEvent | null;
}

/**
 * Vue d'ensemble des 4 places majeures — statut en direct (carte stylisée en
 * haut), frise des horaires de session sur 24h UTC (en bas, avec un repère
 * "maintenant"), volatilité et prochaine annonce clé. Toutes les données
 * viennent de sources déjà utilisées ailleurs dans ce module
 * (`FOREX_SESSIONS`/`isSessionActive` du header, `quotes` du calendrier
 * macro) — aucune nouvelle source réseau.
 */
export const MarketMapWidget: React.FC<MarketMapWidgetProps> = ({ now, vix, nextHighImpact }) => {
  const marketClosed = isForexMarketClosed(now);
  const hourUTC = now.getUTCHours();
  const minuteUTC = now.getUTCMinutes();
  const nowPercent = ((hourUTC + minuteUTC / 60) / 24) * 100;

  const openCities = CITIES.filter((city) => {
    const def = FOREX_SESSIONS.find((s) => s.name === city.session);
    return !marketClosed && !!def && isSessionActive(def, hourUTC);
  });

  const vixLevel = vix ? (vix.price >= 25 ? "Élevée" : vix.price <= 15 ? "Faible" : "Modérée") : null;
  const vixColor = vix
    ? vix.price >= 25
      ? "text-rose-400"
      : vix.price <= 15
      ? "text-[#00E676]"
      : "text-amber-400"
    : "text-slate-400";

  return (
    <div className="bg-[#111615] border border-[#1B2320] rounded-xl overflow-hidden">
      {/* En-tête */}
      <div className="flex items-center gap-2.5 px-5 py-4">
        <Globe2 className="w-5 h-5 text-[#00E676]" />
        <h3 className="text-sm font-bold text-white">Carte des marchés</h3>
        <span className="text-xs text-[#00E676] font-mono">
          {openCities.length} session{openCities.length > 1 ? "s" : ""} ouverte{openCities.length > 1 ? "s" : ""}
        </span>
      </div>

      {/* Carte stylisée */}
      <div
        className="relative h-64 border-t border-[#1B2320]"
        style={{
          backgroundImage: "radial-gradient(rgba(148,163,184,0.15) 1px, transparent 1px)",
          backgroundSize: "22px 22px",
        }}
      >
        {CITIES.map((city) => {
          const def = FOREX_SESSIONS.find((s) => s.name === city.session);
          const isOpen = !marketClosed && !!def && isSessionActive(def, hourUTC);
          return (
            <div
              key={city.name}
              className="absolute -translate-x-1/2 -translate-y-1/2 flex flex-col items-center gap-1.5"
              style={{ top: city.top, left: city.left }}
            >
              <span className="relative flex items-center justify-center">
                {isOpen && (
                  <span className="absolute w-5 h-5 rounded-full bg-[#00E676]/40 animate-ping" aria-hidden="true" />
                )}
                <span
                  className={`relative w-3 h-3 rounded-full ${isOpen ? "bg-[#00E676] shadow-[0_0_10px_2px_rgba(0,230,118,0.6)]" : "bg-slate-600"}`}
                />
              </span>
              <span className={`text-sm font-bold ${isOpen ? "text-white" : "text-slate-400"}`}>{city.name}</span>
              <span className={`text-xs font-mono ${isOpen ? "text-white" : "text-slate-500"}`}>
                {formatCityTime(now, city.timeZone)}
              </span>
              <span className={`text-[10px] font-bold tracking-wide ${isOpen ? "text-[#00E676]" : "text-slate-500"}`}>
                {isOpen ? "OUVERT" : "FERMÉ"}
              </span>
            </div>
          );
        })}
      </div>

      {/* Frise des sessions (24h UTC) */}
      <div className="px-5 py-4 border-t border-[#1B2320] space-y-2">
        {CITIES.map((city) => {
          const def = FOREX_SESSIONS.find((s) => s.name === city.session);
          const segments = def ? sessionSegments(def) : [];
          return (
            <div key={city.name} className="flex items-center gap-3">
              <span className="w-16 shrink-0 text-xs text-slate-400">{city.name}</span>
              <div className="relative flex-1 h-2.5 rounded-full bg-[#0D1110] overflow-hidden">
                {segments.map((seg, i) => (
                  <span
                    key={i}
                    className={`absolute top-0 h-full rounded-full ${city.trackColor}`}
                    style={{ left: `${seg.left}%`, width: `${seg.width}%` }}
                  />
                ))}
                <span
                  className="absolute top-[-3px] w-px h-[calc(100%+6px)] bg-white/80"
                  style={{ left: `${nowPercent}%` }}
                  aria-hidden="true"
                />
              </div>
            </div>
          );
        })}
        <div className="flex items-center gap-3 pt-1">
          <span className="w-16 shrink-0" />
          <div className="relative flex-1 flex justify-between text-[10px] text-slate-500 font-mono">
            {HOUR_TICKS.map((h) => (
              <span key={h}>{h}h</span>
            ))}
          </div>
        </div>
      </div>

      {/* Volatilité + prochaine annonce clé */}
      <div className="grid grid-cols-1 sm:grid-cols-2 border-t border-[#1B2320] divide-y sm:divide-y-0 sm:divide-x divide-[#1B2320]">
        <div className="px-5 py-4">
          <div className="text-[10px] uppercase tracking-wider text-slate-500 font-bold mb-1.5">
            Volatilité (VIX)
          </div>
          {vix ? (
            <div className="flex items-baseline gap-2">
              <span className="text-xl font-black text-white font-mono">{vix.price.toFixed(2)}</span>
              <span className={`text-sm font-bold ${vixColor}`}>{vixLevel}</span>
            </div>
          ) : (
            <span className="text-sm text-slate-500">—</span>
          )}
        </div>
        <div className="px-5 py-4">
          <div className="text-[10px] uppercase tracking-wider text-slate-500 font-bold mb-1.5">
            Prochaine annonce clé
          </div>
          {nextHighImpact ? (
            <>
              <div className="text-sm font-bold text-white truncate">
                {nextHighImpact.country} · {nextHighImpact.title}
              </div>
              <div className="text-xs text-amber-400 font-mono mt-0.5">
                {DAY_ABBR[nextHighImpact.eventTime.getDay()]}{" "}
                {formatCityTime(nextHighImpact.eventTime, Intl.DateTimeFormat().resolvedOptions().timeZone)}
              </div>
            </>
          ) : (
            <span className="text-sm text-slate-500">Aucune cette semaine</span>
          )}
        </div>
      </div>
    </div>
  );
};
