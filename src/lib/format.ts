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
export function formatCurrency(amount: number): string {
  const rounded = Math.round(Math.abs(amount) * 100) / 100;
  const sign = amount < 0 && rounded !== 0 ? "-" : "";
  return `${sign}$${rounded.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
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
export function parsePriceInput(raw: string): number {
  const trimmed = raw.trim();
  // Chaîne vide (champ optionnel laissé vide) : 0, même comportement que
  // l'ancien `Number("")` qu'elle remplace partout où elle est utilisée.
  if (!trimmed) return 0;

  const lastComma = trimmed.lastIndexOf(",");
  const lastDot = trimmed.lastIndexOf(".");

  if (lastComma !== -1 && lastDot !== -1) {
    return lastComma > lastDot
      ? Number(trimmed.replace(/\./g, "").replace(",", "."))
      : Number(trimmed.replace(/,/g, ""));
  }

  if (lastComma !== -1) return Number(trimmed.replace(",", "."));
  return Number(trimmed);
}
