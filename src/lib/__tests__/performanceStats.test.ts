import { describe, it, expect } from "vitest";
import {
  computeJournalSummary,
  tradeDurationMinutes,
  computeDurationStats,
  tradeExitRatios,
  computeExitEfficiency,
  computePlanDetail,
  isRealizedDollarTrade,
} from "../performanceStats";
import { Trade, TradingPlan } from "../../types";

const trade = (over: Partial<Trade> = {}): Trade =>
  ({
    id: "t-1",
    date: "2026-01-05",
    pair: "US30",
    marketCategory: "Indices",
    direction: "LONG",
    entryPrice: 100,
    stopLoss: 95,
    takeProfit: 110,
    lotSize: 1,
    pnl: 0,
    pnlUnit: "USD",
    riskRewardRatio: 2,
    result: "WIN",
    strategy: "OPR",
    emotion: "Calm",
    notes: "",
    ...over,
  }) as unknown as Trade;

describe("isRealizedDollarTrade", () => {
  it("exclut les positions ouvertes et les PnL en pourcentage", () => {
    expect(isRealizedDollarTrade(trade())).toBe(true);
    expect(isRealizedDollarTrade(trade({ result: "OPEN" }))).toBe(false);
    expect(isRealizedDollarTrade(trade({ pnlUnit: "PERCENT" }))).toBe(false);
  });

  it("traite l'unité absente comme des dollars", () => {
    expect(isRealizedDollarTrade(trade({ pnlUnit: undefined }))).toBe(true);
  });
});

describe("computeJournalSummary", () => {
  it("calcule le taux de réussite sur les gagnants et perdants seulement", () => {
    // 2 WIN, 1 LOSS, 1 BREAKEVEN, 1 OPEN → 2/3 = 67 %, le BE et l'ouvert hors dénominateur.
    const trades = [
      trade({ id: "1", result: "WIN" }),
      trade({ id: "2", result: "WIN" }),
      trade({ id: "3", result: "LOSS" }),
      trade({ id: "4", result: "BREAKEVEN" }),
      trade({ id: "5", result: "OPEN" }),
    ];
    expect(computeJournalSummary(trades).winRate).toBe(67);
  });

  it("ne somme que le PnL réalisé en dollars", () => {
    const trades = [
      trade({ id: "1", pnl: 100 }),
      trade({ id: "2", pnl: 500, result: "OPEN" }),
      trade({ id: "3", pnl: 7, pnlUnit: "PERCENT" }),
    ];
    expect(computeJournalSummary(trades).totalPnL).toBe(100);
  });

  it("renvoie des valeurs neutres sur un journal vide plutôt que NaN", () => {
    const s = computeJournalSummary([]);
    expect(s.winRate).toBe(0);
    expect(s.totalPnL).toBe(0);
    expect(Number.isNaN(Number(s.avgRR))).toBe(false);
  });

  it("affiche N/A comme profit factor quand il n'y a aucune perte", () => {
    expect(computeJournalSummary([trade({ pnl: 50 })]).profitFactor).toBe("N/A");
  });
});

describe("tradeDurationMinutes", () => {
  it("mesure la durée quand les deux horodatages sont complets", () => {
    expect(
      tradeDurationMinutes(trade({ time: "09:00", exitDate: "2026-01-05", exitTime: "11:15" }))
    ).toBe(135);
  });

  it("traverse correctement plusieurs jours", () => {
    expect(
      tradeDurationMinutes(trade({ time: "09:00", exitDate: "2026-01-08", exitTime: "13:00" }))
    ).toBe(4560);
  });

  it("refuse d'inventer une durée quand une heure manque", () => {
    expect(tradeDurationMinutes(trade({ time: "09:00", exitDate: "2026-01-05" }))).toBeNull();
    expect(tradeDurationMinutes(trade({ exitDate: "2026-01-05", exitTime: "11:00" }))).toBeNull();
  });

  it("ne mesure rien sur une position ouverte", () => {
    expect(tradeDurationMinutes(trade({ result: "OPEN", time: "09:00" }))).toBeNull();
  });

  it("écarte une sortie antérieure à l'entrée plutôt que de renvoyer un négatif", () => {
    expect(
      tradeDurationMinutes(trade({ time: "16:00", exitDate: "2026-01-05", exitTime: "09:00" }))
    ).toBeNull();
  });
});

describe("computeDurationStats", () => {
  it("compte à part les trades clôturés sans horodatage exploitable", () => {
    const trades = [
      trade({ id: "1", time: "09:00", exitDate: "2026-01-05", exitTime: "10:00" }), // 60
      trade({ id: "2", time: "09:00", exitDate: "2026-01-05", exitTime: "11:00" }), // 120
      trade({ id: "3" }), // clôturé, sans horaire → écarté
      trade({ id: "4", result: "OPEN" }), // ouvert → ni compté ni écarté
    ];
    const s = computeDurationStats(trades);
    expect(s.countedTrades).toBe(2);
    expect(s.skippedTrades).toBe(1);
    expect(s.avgMinutes).toBe(90);
    expect(s.medianMinutes).toBe(90);
  });

  it("renvoie null plutôt que 0 quand rien n'est mesurable", () => {
    expect(computeDurationStats([]).avgMinutes).toBeNull();
  });
});

describe("tradeExitRatios", () => {
  // entrée 100, SL 95, TP 110 en LONG (risque 5, cible 10, R:R 2)
  it("vaut 1 sur une sortie exactement au take profit", () => {
    expect(tradeExitRatios(trade({ exitPrice: 110 }))?.capture).toBeCloseTo(1);
  });

  it("vaut 0,5 sur une sortie à mi-chemin de la cible", () => {
    expect(tradeExitRatios(trade({ exitPrice: 105 }))?.capture).toBeCloseTo(0.5);
  });

  it("dépasse 1 quand le trade a été laissé courir au-delà du TP", () => {
    expect(tradeExitRatios(trade({ exitPrice: 118 }))?.capture).toBeCloseTo(1.8);
  });

  it("traite le SHORT symétriquement au LONG", () => {
    const short = trade({ direction: "SHORT", entryPrice: 100, stopLoss: 105, takeProfit: 90 });
    expect(tradeExitRatios({ ...short, exitPrice: 90 })?.capture).toBeCloseTo(1);
    expect(tradeExitRatios({ ...short, exitPrice: 95 })?.capture).toBeCloseTo(0.5);
    // Sortie au stop : même géométrie que le LONG au stop, donc même capture.
    expect(tradeExitRatios({ ...short, exitPrice: 105 })?.capture).toBeCloseTo(-0.5);
  });

  it("indique 100 % du risque consommé sur une sortie au stop, dans les deux sens", () => {
    expect(tradeExitRatios(trade({ exitPrice: 95 }))?.risqueConsomme).toBeCloseTo(1);
    const short = trade({ direction: "SHORT", entryPrice: 100, stopLoss: 105, takeProfit: 90, exitPrice: 105 });
    expect(tradeExitRatios(short)?.risqueConsomme).toBeCloseTo(1);
  });

  it("écarte les cas où le ratio n'a aucun sens", () => {
    expect(tradeExitRatios(trade({ result: "OPEN", exitPrice: 110 }))).toBeNull();
    expect(tradeExitRatios(trade({ exitPrice: undefined }))).toBeNull();
    // 0 n'est une cotation réelle sur aucun marché : c'est un « non renseigné » hérité.
    expect(tradeExitRatios(trade({ exitPrice: 0 }))).toBeNull();
    // TP du mauvais côté de l'entrée : le setup lui-même est incohérent.
    expect(tradeExitRatios(trade({ exitPrice: 105, takeProfit: 90 }))).toBeNull();
    expect(tradeExitRatios(trade({ exitPrice: 105, stopLoss: 100 }))).toBeNull();
  });
});

describe("computeExitEfficiency", () => {
  it("sépare gagnants et perdants, et suit le résultat déclaré sans le déduire", () => {
    const trades = [
      trade({ id: "1", result: "WIN", exitPrice: 105 }), // capture 0,5
      trade({ id: "2", result: "WIN", exitPrice: 110 }), // capture 1
      trade({ id: "3", result: "LOSS", exitPrice: 95 }), // risque consommé 1
      trade({ id: "4", result: "BREAKEVEN", exitPrice: 100 }), // exclu des deux moyennes
      trade({ id: "5", result: "WIN", exitPrice: undefined }), // non exploitable
    ];
    const s = computeExitEfficiency(trades);
    expect(s.winsComptes).toBe(2);
    expect(s.captureMoyenneWins).toBeCloseTo(0.75);
    expect(s.winsSortisAvantTp).toBe(1);
    expect(s.lossesComptes).toBe(1);
    expect(s.risqueMoyenLosses).toBeCloseTo(1);
    expect(s.tradesNonExploitables).toBe(1);
  });

  it("prend en compte les trades en pourcentage : ces ratios sont géométriques", () => {
    const s = computeExitEfficiency([trade({ pnlUnit: "PERCENT", exitPrice: 110 })]);
    expect(s.winsComptes).toBe(1);
  });
});

describe("computePlanDetail", () => {
  const plans = [
    { id: "p1", name: "Plan Londres" },
    { id: "p2", name: "Plan New York" },
  ] as TradingPlan[];

  it("ventile par plan et épingle « Hors plan » en dernier", () => {
    const trades = [
      trade({ id: "1", tradingPlanId: "p1", pnl: 100, result: "WIN" }),
      trade({ id: "2", tradingPlanId: "p1", pnl: -50, result: "LOSS" }),
      trade({ id: "3", pnl: 999, result: "WIN" }), // hors plan, PnL le plus élevé
    ];
    const lignes = computePlanDetail(trades, plans);
    expect(lignes[lignes.length - 1].planName).toBe("Hors plan");
    const p1 = lignes.find((l) => l.planId === "p1")!;
    expect(p1.tradesCount).toBe(2);
    expect(p1.winRate).toBe(50);
    expect(p1.pnl).toBe(50);
  });

  it("range un plan supprimé depuis dans « Hors plan » plutôt que d'inventer un plan fantôme", () => {
    const lignes = computePlanDetail([trade({ tradingPlanId: "plan-disparu", pnl: 10 })], plans);
    expect(lignes.some((l) => l.planName === "plan-disparu")).toBe(false);
    expect(lignes.find((l) => l.planId === null)!.tradesCount).toBe(1);
  });

  it("inclut les plans sans aucun trade, ce qui est une information en soi", () => {
    const lignes = computePlanDetail([], plans);
    expect(lignes.find((l) => l.planId === "p2")!.tradesCount).toBe(0);
  });
});
