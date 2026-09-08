/**
 * Fuseau horaire du visiteur pour l'affichage de la Carte des marchés
 * (`MarketMapWidget.tsx`) — persisté (`usePersistentState`, voir
 * `MacroDashboard.tsx`) plutôt que redétecté à chaque chargement : un
 * utilisateur qui voyage veut choisir explicitement son fuseau de référence,
 * pas dépendre du fuseau système de l'appareil utilisé à l'instant T.
 *
 * Choix délibéré : un décalage GMT fixe (ex. "GMT+2"), pas un fuseau IANA
 * (ex. "Europe/Paris"). La liste des ~400 fuseaux IANA (`Intl.
 * supportedValuesOf("timeZone")`) rendait le sélecteur interminable pour un
 * choix qui ne sert qu'à cadrer un axe horaire — un décalage GMT couvre le
 * même besoin en 27 options. Contrepartie assumée : pas de bascule
 * automatique heure d'été/hiver (l'utilisateur re-choisit une fois par an,
 * comme il re-choisirait son fuseau après un changement de pays).
 */

/** Décalage détecté depuis le système, arrondi au quart d'heure le plus proche — valeur par défaut à la première visite. */
export const BROWSER_OFFSET_MINUTES = Math.round(-new Date().getTimezoneOffset() / 15) * 15;

/** Libellé court "GMT+2" / "GMT-5" / "GMT+0" pour un décalage en minutes. */
export function formatGmtOffset(offsetMinutes: number): string {
  const sign = offsetMinutes >= 0 ? "+" : "-";
  const abs = Math.abs(offsetMinutes);
  const hours = Math.floor(abs / 60);
  const minutes = abs % 60;
  return `GMT${sign}${hours}${minutes ? `:${String(minutes).padStart(2, "0")}` : ""}`;
}

/**
 * Décalages proposés au choix, de GMT-12 à GMT+14 (bornes des fuseaux
 * réellement utilisés dans le monde), heure pleine uniquement — les
 * quelques fuseaux à demi-heure (Inde, Iran...) sont hors du besoin ici
 * (cadrer un axe pour un trader, pas afficher l'heure légale d'un pays).
 */
export const GMT_OFFSET_OPTIONS: { minutes: number; label: string }[] = Array.from(
  { length: 27 },
  (_, i) => {
    const minutes = (i - 12) * 60;
    return { minutes, label: formatGmtOffset(minutes) };
  }
);

/** Heure "HH:MM" d'une date une fois décalée d'un nombre de minutes fixe (pas de fuseau IANA, pas de DST). */
export function formatTimeAtOffset(date: Date, offsetMinutes: number): string {
  const shifted = new Date(date.getTime() + offsetMinutes * 60_000);
  const hh = String(shifted.getUTCHours()).padStart(2, "0");
  const mm = String(shifted.getUTCMinutes()).padStart(2, "0");
  return `${hh}:${mm}`;
}
