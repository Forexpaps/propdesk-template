import { describe, it, expect } from "vitest";
import { tradeRealizedR } from "../performanceStats";
import { computeCumulativeR, computeBadgeProgress } from "../badges";
import { Trade, TraderBadge } from "../../types";

/**
 * Le R réalisé d'un trade — son résultat en multiples du risque engagé.
 * Longtemps déclaré « hors de portée » faute de connaître le capital au moment
 * du trade ; il se mesure en fait sur les seuls prix, la taille de lot et la
 * valeur du point s'annulant dans le rapport.
 */

const trade = (over: Partial<Trade> = {}): Trade =>
  ({
    id: `t-${Math.random()}`,
    date: "2026-03-10",
    pair: "US30",
    marketCategory: "Indices",
    direction: "LONG",
    entryPrice: 100,
    stopLoss: 90,
    takeProfit: 130,
    exitPrice: 130,
    lotSize: 1,
    pnl: 0,
    pnlUnit: "USD",
    riskRewardRatio: 3,
    result: "WIN",
    strategy: "OPR",
    emotion: "Calm",
    notes: "",
    ...over,
  }) as unknown as Trade;

describe("tradeRealizedR", () => {
  it("vaut +3 quand la cible à 3 fois le risque est atteinte", () => {
    expect(tradeRealizedR(trade())).toBeCloseTo(3, 10);
  });

  it("vaut -1 sur une sortie exactement au stop", () => {
    expect(tradeRealizedR(trade({ exitPrice: 90, result: "LOSS" }))).toBeCloseTo(-1, 10);
  });

  it("dépasse -1 quand le stop a glissé", () => {
    // Sortie SOUS le stop : le R doit refléter la perte réelle, pas être borné.
    expect(tradeRealizedR(trade({ exitPrice: 88, result: "LOSS" }))).toBeCloseTo(-1.2, 10);
  });

  it("respecte le sens du trade sur un SHORT", () => {
    const short = trade({ direction: "SHORT", entryPrice: 100, stopLoss: 110, takeProfit: 70, exitPrice: 70 });
    expect(tradeRealizedR(short)).toBeCloseTo(3, 10);
  });

  it("ne dépend ni de la taille de lot ni du PnL saisi", () => {
    // C'est l'identité qui rend le calcul possible sans le capital du compte.
    const petit = trade({ lotSize: 0.01, pnl: 3 });
    const gros = trade({ lotSize: 50, pnl: 15000 });
    expect(tradeRealizedR(petit)).toBeCloseTo(tradeRealizedR(gros)!, 10);
  });

  it("reste mesurable sur un trade dont le PnL est en pourcentage", () => {
    expect(tradeRealizedR(trade({ pnlUnit: "PERCENT", pnl: 7 }))).toBeCloseTo(3, 10);
  });

  it("n'est pas mesurable sans prix de sortie, ni sur une position ouverte", () => {
    expect(tradeRealizedR(trade({ exitPrice: undefined }))).toBeNull();
    expect(tradeRealizedR(trade({ result: "OPEN" }))).toBeNull();
  });

  it("refuse un setup incohérent plutôt que d'inverser le signe", () => {
    // LONG dont le stop est AU-DESSUS de l'entrée : aucun risque mesurable.
    expect(tradeRealizedR(trade({ entryPrice: 100, stopLoss: 110 }))).toBeNull();
  });
});

describe("computeCumulativeR", () => {
  it("additionne les R et compte à part ce qui n'est pas mesurable", () => {
    const r = computeCumulativeR([
      trade({ exitPrice: 130 }), // +3R
      trade({ exitPrice: 90, result: "LOSS" }), // -1R
      trade({ exitPrice: undefined }), // non mesurable
    ]);
    expect(r.cumul).toBeCloseTo(2, 10);
    expect(r.tradesMesures).toBe(2);
    expect(r.tradesNonMesurables).toBe(1);
  });

  it("ne compte JAMAIS un trade non mesurable comme un 0 R", () => {
    const r = computeCumulativeR([trade({ exitPrice: undefined }), trade({ result: "OPEN" })]);
    expect(r.cumul).toBe(0);
    expect(r.tradesMesures).toBe(0);
    expect(r.tradesNonMesurables).toBe(2);
  });
});

describe("badge « Cumul de Performance +10R »", () => {
  const badge8 = { id: "badge-8", title: "Cumul de Performance +10R" } as TraderBadge;

  it("est désormais suivi, et non plus marqué indisponible", () => {
    const [r] = computeBadgeProgress([badge8], [trade({ exitPrice: 130 })]);
    expect(r.trackable).toBe(true);
    expect(r.currentValue).toBe(3);
    expect(r.targetValue).toBe(10);
    expect(r.progressPercentage).toBe(30);
  });

  it("plafonne à 100 % et jamais en dessous de 0 %", () => {
    const gagnants = Array.from({ length: 5 }, () => trade({ exitPrice: 130 })); // +15R
    expect(computeBadgeProgress([badge8], gagnants)[0].progressPercentage).toBe(100);

    const perdants = Array.from({ length: 3 }, () => trade({ exitPrice: 90, result: "LOSS" })); // -3R
    const [enPerte] = computeBadgeProgress([badge8], perdants);
    expect(enPerte.progressPercentage).toBe(0);
    // La valeur réelle reste affichée, négative : c'est le fait, pas le verdict.
    expect(enPerte.currentValue).toBe(-3);
  });

  it("reste à 0 sur un journal sans aucun trade mesurable", () => {
    const [r] = computeBadgeProgress([badge8], [trade({ result: "OPEN" })]);
    expect(r.trackable).toBe(true);
    expect(r.currentValue).toBe(0);
    expect(r.progressPercentage).toBe(0);
  });
});
