/**
 * Formatage monétaire centralisé de l'application — devise unique : $.
 *
 * `minimumFractionDigits` égal à `maximumFractionDigits` : toujours
 * exactement 2 décimales (auparavant seul un maximum était posé, donnant un
 * nombre de décimales affichées incohérent d'un montant à l'autre —
 * "$1,234", "$1,234.5", "$1,234.57").
 *
 * Le signe est déterminé APRÈS arrondi, sur la valeur arrondie — pas sur
 * `amount` brut : un résidu flottant infime (ex. `capitalDiff` proche de 0
 * après une suite de calculs) est négatif mais s'arrondit à "0.00" ; sans ce
 * réordonnancement, il s'affichait "-$0.00".
 */
const FR_MONTHS = [
  "janvier", "février", "mars", "avril", "mai", "juin",
  "juillet", "août", "septembre", "octobre", "novembre", "décembre",
];

/** Parse une date au format `toLocaleDateString("fr-FR", { day, month: "long", year })` (ex. "26 août 2026", voir `TraderBadge.unlockedAt`) — `Date.parse` natif ne comprend pas les noms de mois français. `NaN` si le format ne correspond pas. */
function parseFrenchLongDate(value: string): number {
  const match = value.trim().toLowerCase().match(/^(\d{1,2})\s+([a-zéûôïî]+)\s+(\d{4})$/);
  if (!match) return NaN;
  const monthIndex = FR_MONTHS.indexOf(match[2]);
  if (monthIndex === -1) return NaN;
  return new Date(Number(match[3]), monthIndex, Number(match[1])).getTime();
}

/**
 * Horodatage comparable (epoch ms) pour trier une liste de notifications
 * dont le champ `time` mélange trois formats incompatibles selon la source
 * (`AppNotification.time`, voir `src/App.tsx`) :
 * - ISO 8601 pour les messages du coach (`CoachMessage.timestamp`)
 * - date française longue pour les badges (`TraderBadge.unlockedAt`)
 * - le littéral constant `"À l'instant"` pour les alertes de risque/plan
 *   (`walletAlerts.ts`, `planCompliance.ts`), recalculées en direct depuis
 *   l'état courant à chaque rendu — donc toujours réellement "maintenant".
 *
 * Un simple tri par comparaison de chaînes sur `time` mélangeait ces trois
 * formats sans aucun sens chronologique réel (ex. "À" a un point de code
 * Unicode qui le place arbitrairement devant toute date ISO/française).
 * Trouvé en audit.
 */
export function notificationTimestamp(time: string): number {
  if (time === "À l'instant") return Date.now();
  const iso = Date.parse(time);
  if (!Number.isNaN(iso)) return iso;
  const fr = parseFrenchLongDate(time);
  return Number.isNaN(fr) ? 0 : fr;
}

/**
 * "2026-09-11" (format natif d'un `<input type="date">`, tel que stocké dans
 * `Trade.date`/`Trade.exitDate`) → "11/09/26" pour l'affichage — l'ISO n'est
 * qu'un format d'échange, jamais ce qu'on montre à l'utilisateur.
 * Toute valeur qui ne correspond pas exactement à ce format (vide,
 * corrompue) est retournée telle quelle plutôt que de planter l'affichage.
 */
export function formatDateFr(isoDate: string): string {
  const match = isoDate.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return isoDate;
  const [, year, month, day] = match;
  return `${day}/${month}/${year.slice(2)}`;
}

export function formatCurrency(amount: number): string {
  const rounded = Math.round(Math.abs(amount) * 100) / 100;
  const sign = amount < 0 && rounded !== 0 ? "-" : "";
  return `${sign}$${rounded.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/**
 * Durée de détention lisible : « 45 min », « 2h15 », « 3j 4h ».
 *
 * On change d'unité plutôt que d'empiler les minutes : « 4320 minutes » ne dit
 * rien à personne, « 3j » se lit d'un coup d'œil. Les minutes ne sont affichées
 * qu'en dessous de 24 h, au-delà elles ne servent plus à décider quoi que ce
 * soit sur un swing.
 */
export function formatDuration(minutes: number): string {
  const total = Math.round(minutes);
  if (total < 60) return `${total} min`;
  const heures = Math.floor(total / 60);
  const reste = total % 60;
  if (heures < 24) return reste === 0 ? `${heures}h` : `${heures}h${String(reste).padStart(2, "0")}`;
  return `${Math.floor(heures / 24)}j ${heures % 24}h`;
}

/**
 * Convertit en nombre un prix/montant saisi librement, point et virgule à
 * l'emplacement choisi par qui tape (Journal de trading, Calculateurs) —
 * demande explicite du fondateur : un coach ou un élève doit pouvoir taper
 * `4655,66` OU `4655.66` OU `4.655,66` OU `4,655.66` sans que l'app ne lui
 * impose une convention plutôt qu'une autre, la cotation d'un actif n'ayant
 * pas la même forme d'un instrument à l'autre.
 *
 * Un seul séparateur présent : c'est forcément la décimale, quel que soit
 * le caractère. Les deux présents (regroupement par milliers + décimale) :
 * celui qui apparaît en DERNIER est la décimale, l'autre n'est que du
 * regroupement à retirer — heuristique standard qui couvre aussi bien la
 * convention française que la convention anglo-saxonne.
 */
/**
 * Le SEUL séparateur présent, quel que soit son type, s'il apparaît PLUSIEURS
 * fois (ex. "2.345.67", "1,234,567") : la version précédente ne gérait que
 * "un seul point ET une seule virgule" ou "un seul séparateur, une seule
 * fois" — un point ou une virgule répété(e) produisait un `Number(...)` =
 * `NaN` non détecté par la garde `risque === 0` du formulaire (`NaN === 0`
 * est `false`), qui contaminait ensuite silencieusement le R:R moyen affiché
 * pour tout le compte. Trouvé en audit.
 *
 * Traité désormais avec la MÊME règle que le cas à deux types de séparateurs
 * ci-dessous : le DERNIER caractère séparateur rencontré est la décimale,
 * tous les autres (même type ou non) ne sont que du regroupement à retirer.
 * Ambigu sur un grand entier saisi avec regroupement mais sans décimale
 * (ex. "1,234,567" lu comme 1234.567 plutôt que 1234567) — mais toujours
 * strictement mieux qu'un NaN silencieux, et cohérent avec l'heuristique déjà
 * documentée juste en dessous.
 */
export function parsePriceInput(raw: string): number {
  const trimmed = raw.trim();
  // Chaîne vide (champ optionnel laissé vide) : 0, même comportement que
  // l'ancien `Number("")` qu'elle remplace partout où elle est utilisée.
  if (!trimmed) return 0;

  const lastSeparator = Math.max(trimmed.lastIndexOf(","), trimmed.lastIndexOf("."));
  if (lastSeparator === -1) return Number(trimmed);

  // `|| "0"` : un séparateur isolé sans chiffre d'un côté (ex. ".", ",",
  // "12,") ne doit pas non plus retomber en `NaN` — `Number("12.")` est déjà
  // valide (12), mais `Number(".")`/`Number(".5")` mal reconstruit ne l'est
  // pas toujours selon le côté vide.
  const integerPart = trimmed.slice(0, lastSeparator).replace(/[.,]/g, "") || "0";
  const decimalPart = trimmed.slice(lastSeparator + 1) || "0";
  return Number(`${integerPart}.${decimalPart}`);
}
