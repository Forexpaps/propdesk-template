/**
 * Fuseau horaire du visiteur pour l'affichage de la Carte des marchés
 * (`MarketMapWidget.tsx`) — persisté (`usePersistentState`, voir
 * `MacroDashboard.tsx`) plutôt que redétecté à chaque chargement : un
 * utilisateur qui voyage veut choisir explicitement son fuseau de référence,
 * pas dépendre du fuseau système de l'appareil utilisé à l'instant T.
 */

/** Fuseau détecté depuis le système — utilisé comme valeur par défaut à la première visite. */
export const BROWSER_TIMEZONE = Intl.DateTimeFormat().resolvedOptions().timeZone;

/**
 * Liste des fuseaux IANA proposés au choix. `Intl.supportedValuesOf` couvre
 * la base complète mais n'existe pas sur tous les moteurs JS ; la liste de
 * secours ci-dessous couvre les fuseaux pertinents pour un trader Forex
 * (les 4 places majeures + quelques capitales courantes) si l'API manque.
 */
export const TIMEZONE_OPTIONS: string[] =
  typeof Intl.supportedValuesOf === "function"
    ? Intl.supportedValuesOf("timeZone")
    : [
        "UTC",
        "Europe/Paris",
        "Europe/London",
        "America/New_York",
        "America/Los_Angeles",
        "Asia/Tokyo",
        "Asia/Dubai",
        "Asia/Singapore",
        "Australia/Sydney",
      ];

/**
 * Décalage (en minutes) entre UTC et l'heure locale d'un fuseau IANA, à un
 * instant donné. Recalculé pour chaque `date` plutôt que codé en dur : un
 * décalage fixe se déréglerait deux fois par an au passage heure d'été/hiver.
 */
export function getTimezoneOffsetMinutes(date: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(date);

  const map: Record<string, string> = {};
  for (const part of parts) map[part.type] = part.value;

  const asUTC = Date.UTC(
    Number(map.year),
    Number(map.month) - 1,
    Number(map.day),
    Number(map.hour),
    Number(map.minute),
    Number(map.second)
  );
  return Math.round((asUTC - date.getTime()) / 60_000);
}

/** Libellé court "UTC+2" / "UTC-5" pour un fuseau, à une date donnée. */
export function formatUtcOffset(date: Date, timeZone: string): string {
  const offsetMinutes = getTimezoneOffsetMinutes(date, timeZone);
  const sign = offsetMinutes >= 0 ? "+" : "-";
  const abs = Math.abs(offsetMinutes);
  const hours = Math.floor(abs / 60);
  const minutes = abs % 60;
  return `UTC${sign}${hours}${minutes ? `:${String(minutes).padStart(2, "0")}` : ""}`;
}
