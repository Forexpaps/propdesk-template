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
