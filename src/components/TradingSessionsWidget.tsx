import React, { useEffect, useState } from "react";
import { FOREX_SESSIONS, isSessionActive, isForexMarketClosed } from "./TopHeader";

/**
 * Fuseau IANA de chaque place, pour l'heure locale affichée — `Intl.
 * DateTimeFormat` gère lui-même le passage heure d'été/hiver, pas besoin de
 * décalage codé en dur (qui se déréglerait deux fois par an).
 *
 * `session` référence une entrée de `FOREX_SESSIONS` (`TopHeader.tsx`,
 * horaires UTC, source unique déjà utilisée par le badge de session du
 * header et par `planCompliance.ts`).
 */
const CITIES: { name: string; timeZone: string; session: string }[] = [
  { name: "Sydney", timeZone: "Australia/Sydney", session: "Sydney" },
  { name: "Tokyo", timeZone: "Asia/Tokyo", session: "Tokyo" },
  { name: "Londres", timeZone: "Europe/London", session: "Londres" },
  { name: "New York", timeZone: "America/New_York", session: "New York" },
];

function formatCityTime(date: Date, timeZone: string): string {
  return new Intl.DateTimeFormat("fr-FR", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(date);
}

/**
 * Horloges des grandes places de trading, avec statut ouvert/fermé en
 * direct — même logique de session que le badge "SESSION" du header
 * (`TopHeader.tsx`), affichée ici pour les 4 places plutôt qu'un seul badge
 * texte.
 *
 * Tick chaque seconde (l'affichage inclut les secondes) : `setInterval`
 * plutôt que `requestAnimationFrame`, l'exactitude à la seconde suffit
 * largement pour une horloge, pas besoin d'un rafraîchissement lié à l'écran.
 */
export const TradingSessionsWidget: React.FC = () => {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const marketClosed = isForexMarketClosed(now);
  const hourUTC = now.getUTCHours();

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      {CITIES.map((city) => {
        const sessionDef = FOREX_SESSIONS.find((s) => s.name === city.session);
        const isOpen = !marketClosed && !!sessionDef && isSessionActive(sessionDef, hourUTC);

        return (
          <div
            key={city.name}
            className="bg-[#111615] border border-[#1B2320] rounded-xl px-4 py-3 space-y-2"
          >
            <div className="flex items-center justify-between gap-2">
              <span className="flex items-center gap-1.5 text-sm font-bold text-white">
                <span
                  className={`w-1.5 h-1.5 rounded-full ${isOpen ? "bg-[#00E676]" : "bg-slate-600"}`}
                  aria-hidden="true"
                />
                {city.name}
              </span>
              <span
                className={`text-[10px] font-mono font-bold tracking-wide ${
                  isOpen ? "text-[#00E676]" : "text-slate-500"
                }`}
              >
                {isOpen ? "OUVERT" : "FERMÉ"}
              </span>
            </div>
            <div className="text-xl font-black text-white font-mono tabular-nums">
              {formatCityTime(now, city.timeZone)}
            </div>
          </div>
        );
      })}
    </div>
  );
};
