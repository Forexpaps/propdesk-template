/**
 * Fuseau horaire du visiteur pour l'affichage de la Carte des marchés
 * (`MarketMapWidget.tsx`) — persisté (`usePersistentState`, voir
 * `MacroDashboard.tsx`) plutôt que redétecté à chaque chargement : un
 * utilisateur qui voyage veut choisir explicitement son fuseau de référence,
 * pas dépendre du fuseau système de l'appareil utilisé à l'instant T.
 *
 * Stocké comme un identifiant IANA (ex. "Europe/Paris"), pas un décalage GMT
 * fixe : seul un fuseau nommé applique automatiquement le bon passage
 * heure d'été/hiver (et seulement au bon moment — les dates de bascule
 * diffèrent entre l'UE, les US, et beaucoup de pays n'ont pas de DST du
 * tout). Un décalage fixe aurait fauté deux fois par an sans intervention
 * manuelle — exactement ce que cette version corrige.
 *
 * La liste complète des fuseaux IANA (`Intl.supportedValuesOf("timeZone")`,
 * ~400 entrées) rendrait le sélecteur interminable pour un usage qui ne sert
 * qu'à cadrer un axe horaire. `CURATED_TIMEZONES` n'en garde qu'un par
 * décalage utile dans le monde ; le fuseau système du visiteur est toujours
 * injecté en plus s'il n'y figure pas déjà, pour ne jamais lui imposer un
 * choix par défaut approximatif.
 */

/** Fuseau détecté depuis le système — valeur par défaut à la première visite. */
export const BROWSER_TIMEZONE = Intl.DateTimeFormat().resolvedOptions().timeZone;

/** Un fuseau IANA représentatif par grande zone de décalage, du plus à l'est au plus à l'ouest. */
export const CURATED_TIMEZONES: string[] = [
  "Pacific/Auckland",
  "Australia/Sydney",
  "Asia/Tokyo",
  "Asia/Shanghai",
  "Asia/Bangkok",
  "Asia/Dhaka",
  "Asia/Kolkata",
  "Asia/Dubai",
  "Europe/Moscow",
  "Europe/Istanbul",
  "Europe/Paris",
  "Europe/London",
  "Atlantic/Reykjavik",
  "America/Sao_Paulo",
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "America/Anchorage",
  "Pacific/Honolulu",
];

/**
 * Décalage (en minutes) entre UTC et l'heure locale d'un fuseau IANA, à un
 * instant donné. Recalculé pour chaque `date` plutôt que codé en dur : c'est
 * ce recalcul, à chaque rendu, qui fait passer l'heure d'été à l'heure
 * d'hiver tout seul, au jour près, pour n'importe quel fuseau.
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

/** Libellé court "GMT+2" / "GMT-5" / "GMT+0" pour un décalage en minutes. */
export function formatGmtOffset(offsetMinutes: number): string {
  const sign = offsetMinutes >= 0 ? "+" : "-";
  const abs = Math.abs(offsetMinutes);
  const hours = Math.floor(abs / 60);
  const minutes = abs % 60;
  return `GMT${sign}${hours}${minutes ? `:${String(minutes).padStart(2, "0")}` : ""}`;
}

function cityLabel(timeZone: string): string {
  const city = timeZone.split("/").pop() ?? timeZone;
  return city.replace(/_/g, " ");
}

/**
 * Options du sélecteur, triées par décalage actuel croissant — recalculées
 * à chaque rendu (l'ordre et les libellés "GMT+X" bougent d'eux-mêmes au
 * passage heure d'été/hiver). `selected` est injecté s'il n'appartient pas
 * déjà à `CURATED_TIMEZONES`, pour que la valeur courante (fuseau système
 * détecté, ou choix antérieur d'un visiteur) reste toujours représentée.
 */
export function timezoneOptions(date: Date, selected: string): { id: string; label: string }[] {
  const ids = CURATED_TIMEZONES.includes(selected) ? CURATED_TIMEZONES : [...CURATED_TIMEZONES, selected];
  return ids
    .map((id) => ({ id, offsetMinutes: getTimezoneOffsetMinutes(date, id) }))
    .sort((a, b) => a.offsetMinutes - b.offsetMinutes)
    .map(({ id, offsetMinutes }) => ({ id, label: `${cityLabel(id)} (${formatGmtOffset(offsetMinutes)})` }));
}
