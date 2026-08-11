/** Formatage monétaire centralisé de l'application — devise unique : $. */
export function formatCurrency(amount: number): string {
  const sign = amount < 0 ? "-" : "";
  return `${sign}$${Math.abs(amount).toLocaleString("en-US", { maximumFractionDigits: 2 })}`;
}
