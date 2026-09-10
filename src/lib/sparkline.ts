import { Trade } from "../types";
import { isRealizedDollarTrade } from "./performanceStats";

/**
 * Courbe miniature du PnL cumulé, tracée à la main en SVG.
 *
 * Pourquoi pas recharts : `MainDashboard` ne doit pas l'importer statiquement.
 * `EquityCurveChart` est chargé en `React.lazy` précisément pour le sortir du
 * bundle initial, et Rollup fusionne un module importé à la fois statiquement
 * et dynamiquement — le `lazy` deviendrait décoratif.
 *
 * Pourquoi ce module existe : la carte « PnL cumulé » affichait un `<path>`
 * CODÉ EN DUR, toujours vert et toujours montant, y compris quand le trader
 * perdait de l'argent. Dans un journal dont l'objet même est de dire la vérité
 * sur ses résultats, c'était le pire endroit possible pour un faux visuel.
 */

/**
 * Cumul du PnL réalisé, dans l'ordre chronologique, en partant de 0.
 *
 * Filtré par `isRealizedDollarTrade` — exactement la même convention que le
 * nombre affiché juste à côté : une position ouverte ou un PnL en pourcentage
 * ne sont pas des sommes d'argent acquises. Une courbe qui suivrait une autre
 * règle que son propre chiffre serait une seconde façon de mentir.
 */
export function buildCumulativePnlSeries(trades: Trade[]): number[] {
  const chronologique = [...trades]
    .filter(isRealizedDollarTrade)
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));

  const serie: number[] = [];
  let cumul = 0;
  for (const t of chronologique) {
    cumul += t.pnl;
    serie.push(cumul);
  }
  return serie;
}

/**
 * Chemin SVG passant par chaque valeur, ou `null` quand il n'y a rien d'honnête
 * à tracer (moins de deux points). L'appelant doit alors **ne rien rendre** :
 * une ligne plate décorative laisserait croire à une stabilité observée.
 *
 * `maxPoints` sous-échantillonne : au-delà de quelques dizaines de points sur
 * 80 pixels, la chaîne grossit sans qu'un seul pixel bouge.
 */
export function buildSparklinePath(
  values: number[],
  width: number,
  height: number,
  maxPoints = 60
): string | null {
  if (values.length < 2) return null;

  // Sous-échantillonnage régulier, en gardant toujours le dernier point : c'est
  // celui qui porte le résultat courant, il ne doit jamais être écarté.
  let points = values;
  if (values.length > maxPoints) {
    const pas = (values.length - 1) / (maxPoints - 1);
    points = Array.from({ length: maxPoints }, (_, i) => values[Math.round(i * pas)]);
  }

  const min = Math.min(...points);
  const max = Math.max(...points);
  const amplitude = max - min;

  const y = (valeur: number) =>
    // Série constante : ligne à mi-hauteur, jamais de division par zéro.
    // L'axe SVG est inversé (0 en haut), d'où le `height -`.
    amplitude === 0 ? height / 2 : height - ((valeur - min) / amplitude) * height;

  return points
    .map((valeur, i) => {
      const x = (i / (points.length - 1)) * width;
      return `${i === 0 ? "M" : "L"} ${x.toFixed(2)} ${y(valeur).toFixed(2)}`;
    })
    .join(" ");
}
