/**
 * Sessions de trading Forex — table UTC unique de l'application.
 *
 * Extraites de `components/TopHeader.tsx` : ces définitions n'ont rien de
 * visuel, et les importer depuis un `.tsx` obligeait `planCompliance.ts` (donc
 * ses tests) à charger React et lucide-react pour une table de quatre lignes.
 * Ne jamais dupliquer ces bornes ailleurs : le libellé de session d'un trade
 * doit être le même partout, du bandeau d'en-tête aux statistiques.
 */
export const FOREX_SESSIONS: { name: string; startUTC: number; endUTC: number }[] = [
  { name: "Sydney", startUTC: 21, endUTC: 6 }, // traverse minuit UTC
  { name: "Tokyo", startUTC: 0, endUTC: 9 },
  { name: "Londres", startUTC: 7, endUTC: 16 },
  { name: "New York", startUTC: 12, endUTC: 21 },
];

export function isSessionActive(
  session: { startUTC: number; endUTC: number },
  hourUTC: number
): boolean {
  if (session.startUTC < session.endUTC) {
    return hourUTC >= session.startUTC && hourUTC < session.endUTC;
  }
  // La session traverse minuit UTC (Sydney) : active avant OU après le seuil.
  return hourUTC >= session.startUTC || hourUTC < session.endUTC;
}

/**
 * Le marché Forex ferme du vendredi 21h UTC (clôture de New York) au dimanche
 * 21h UTC (ouverture de Sydney) — un week-end complet sans aucune session
 * active, quelle que soit l'heure.
 */
export function isForexMarketClosed(date: Date): boolean {
  const day = date.getUTCDay(); // 0 = dimanche, 5 = vendredi, 6 = samedi
  const hour = date.getUTCHours();
  if (day === 6) return true;
  if (day === 5 && hour >= 21) return true;
  if (day === 0 && hour < 21) return true;
  return false;
}
