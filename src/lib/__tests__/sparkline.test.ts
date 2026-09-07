import { describe, it, expect } from "vitest";
import { buildCumulativePnlSeries, buildSparklinePath } from "../sparkline";
import { Trade } from "../../types";

const trade = (over: Partial<Trade> = {}): Trade =>
  ({ id: "t", date: "2026-01-05", pnl: 0, result: "WIN", pnlUnit: "USD", ...over }) as unknown as Trade;

describe("buildCumulativePnlSeries", () => {
  it("cumule le PnL dans l'ordre chronologique", () => {
    const trades = [
      trade({ id: "b", date: "2026-01-06", pnl: -30 }),
      trade({ id: "a", date: "2026-01-05", pnl: 100 }),
      trade({ id: "c", date: "2026-01-07", pnl: 50 }),
    ];
    expect(buildCumulativePnlSeries(trades)).toEqual([100, 70, 120]);
  });

  it("exclut les positions ouvertes et les PnL en pourcentage", () => {
    // Même convention que le nombre affiché à côté : une courbe qui suivrait
    // une autre règle que son propre chiffre serait une seconde façon de mentir.
    const trades = [
      trade({ id: "a", pnl: 100 }),
      trade({ id: "b", pnl: 999, result: "OPEN" }),
      trade({ id: "c", pnl: 7, pnlUnit: "PERCENT" }),
    ];
    expect(buildCumulativePnlSeries(trades)).toEqual([100]);
  });

  it("renvoie un tableau vide sans trade exploitable", () => {
    expect(buildCumulativePnlSeries([])).toEqual([]);
  });

  it("ne modifie pas le tableau reçu", () => {
    const trades = [trade({ id: "b", date: "2026-01-06" }), trade({ id: "a", date: "2026-01-05" })];
    const avant = trades.map((t) => t.id);
    buildCumulativePnlSeries(trades);
    expect(trades.map((t) => t.id)).toEqual(avant);
  });
});

describe("buildSparklinePath", () => {
  it("ne trace rien sous deux points — pas de ligne plate décorative", () => {
    expect(buildSparklinePath([], 80, 30)).toBeNull();
    expect(buildSparklinePath([42], 80, 30)).toBeNull();
  });

  it("trace une ligne à mi-hauteur sur une série constante, sans diviser par zéro", () => {
    const d = buildSparklinePath([50, 50, 50], 80, 30)!;
    expect(d).not.toBeNull();
    const ys = [...d.matchAll(/[ML] [\d.]+ ([\d.]+)/g)].map((m) => Number(m[1]));
    expect(ys.every((y) => y === 15)).toBe(true);
  });

  it("descend visuellement quand la série monte — l'axe SVG est inversé", () => {
    const d = buildSparklinePath([0, 100], 80, 30)!;
    const ys = [...d.matchAll(/[ML] [\d.]+ ([\d.]+)/g)].map((m) => Number(m[1]));
    expect(ys[ys.length - 1]).toBeLessThan(ys[0]);
  });

  it("part à gauche et finit exactement à droite", () => {
    const d = buildSparklinePath([1, 2, 3], 80, 30)!;
    expect(d.startsWith("M 0.00")).toBe(true);
    expect(d).toContain("80.00");
  });

  it("borne le nombre de points sur une longue série", () => {
    const longue = Array.from({ length: 500 }, (_, i) => i);
    const d = buildSparklinePath(longue, 80, 30, 60)!;
    expect(d.split(/[ML]/).length - 1).toBe(60);
  });

  it("conserve le dernier point au sous-échantillonnage — il porte le résultat courant", () => {
    const longue = Array.from({ length: 500 }, (_, i) => i);
    const d = buildSparklinePath(longue, 80, 30, 60)!;
    // La dernière valeur est le maximum → y = 0 (haut du cadre).
    const ys = [...d.matchAll(/[ML] [\d.]+ ([\d.]+)/g)].map((m) => Number(m[1]));
    expect(ys[ys.length - 1]).toBe(0);
  });
});
