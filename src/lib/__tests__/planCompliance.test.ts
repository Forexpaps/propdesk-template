import { describe, it, expect } from "vitest";
import { checkPlanViolations, normalizeTradingPlans } from "../planCompliance";
import { Trade, TradingPlan } from "../../types";

/**
 * `checkPlanViolations` est le seul mécanisme de l'application qui confronte un
 * trade aux règles que le trader s'est fixées. Il n'avait aucun test — et il est
 * resté entièrement mort pendant une session complète (l'appelant lisait une
 * clé de stockage périmée) sans que rien ne le signale.
 */

const plan = (over: Partial<TradingPlan> = {}): TradingPlan => ({
  id: "p1",
  name: "Plan",
  authorizedSessions: [],
  tradingHours: "",
  trackedAssets: "",
  authorizedSetups: "",
  riskPerTradePercent: "",
  maxTradesPerDay: "",
  maxDailyLossPercent: "",
  entryConditions: "",
  stopConditions: "",
  goldenRules: "",
  ...over,
});

const trade = (over: Partial<Trade> = {}): Trade =>
  ({
    id: "t1",
    date: "2026-03-10",
    time: "10:00", // 10h UTC → Londres active
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

describe("checkPlanViolations — plan vide", () => {
  it("n'impose rien quand aucun champ n'est renseigné", () => {
    expect(checkPlanViolations(trade(), [trade()], plan(), 10000)).toEqual([]);
  });
});

describe("checkPlanViolations — actif et setup", () => {
  it("signale un actif hors plan", () => {
    const r = checkPlanViolations(trade({ pair: "EURUSD" }), [], plan({ trackedAssets: "US30, NAS100" }), 10000);
    expect(r).toContain("actif hors plan (EURUSD)");
  });

  it("accepte un actif listé", () => {
    expect(checkPlanViolations(trade({ pair: "NAS100" }), [], plan({ trackedAssets: "US30, NAS100" }), 10000)).toEqual([]);
  });

  it("signale un setup non autorisé", () => {
    const r = checkPlanViolations(trade({ strategy: "Scalp" }), [], plan({ authorizedSetups: "OPR" }), 10000);
    expect(r).toContain("setup non autorisé (Scalp)");
  });

  it("n'impose pas le setup quand le trade n'en porte aucun", () => {
    expect(checkPlanViolations(trade({ strategy: "" }), [], plan({ authorizedSetups: "OPR" }), 10000)).toEqual([]);
  });
});

describe("checkPlanViolations — session", () => {
  it("signale un trade hors des sessions autorisées", () => {
    // 10h UTC = Londres ; le plan n'autorise que l'Asie.
    const r = checkPlanViolations(trade({ time: "10:00" }), [], plan({ authorizedSessions: ["Asie"] }), 10000);
    expect(r).toContain("session non autorisée");
  });

  it("accepte un trade dans une session autorisée", () => {
    expect(checkPlanViolations(trade({ time: "10:00" }), [], plan({ authorizedSessions: ["Londres"] }), 10000)).toEqual([]);
  });

  it("n'impose rien sans heure de trade — l'absence n'est pas une faute", () => {
    expect(checkPlanViolations(trade({ time: undefined }), [], plan({ authorizedSessions: ["Asie"] }), 10000)).toEqual([]);
  });
});

describe("checkPlanViolations — limites quotidiennes", () => {
  it("signale le dépassement du nombre de trades par jour", () => {
    const jour = [trade({ id: "a" }), trade({ id: "b" })];
    const r = checkPlanViolations(trade({ id: "a" }), jour, plan({ maxTradesPerDay: "1" }), 10000);
    expect(r).toContain("limite de 1 trade/jour dépassée");
  });

  it("signale la perte quotidienne max dépassée", () => {
    const jour = [trade({ id: "a", pnl: -300, result: "LOSS" }), trade({ id: "b", pnl: -300, result: "LOSS" })];
    // 600 $ perdus sur 10 000 $ = 6 %, au-delà des 5 % du plan.
    const r = checkPlanViolations(jour[0], jour, plan({ maxDailyLossPercent: "5" }), 10000);
    expect(r.some((m) => m.startsWith("perte quotidienne max dépassée"))).toBe(true);
  });

  it("ignore la perte quotidienne sans capital de départ connu", () => {
    const jour = [trade({ pnl: -900, result: "LOSS" })];
    expect(checkPlanViolations(jour[0], jour, plan({ maxDailyLossPercent: "5" }), 0)).toEqual([]);
  });
});

describe("checkPlanViolations — risque engagé", () => {
  it("signale un risque mesuré au-delà du plan", () => {
    const r = checkPlanViolations(trade({ riskPercent: 3 }), [], plan({ riskPerTradePercent: "1" }), 10000);
    expect(r).toContain("risque engagé 3% au-delà du plan (1%)");
  });

  it("accepte un risque exactement au seuil", () => {
    expect(checkPlanViolations(trade({ riskPercent: 1 }), [], plan({ riskPerTradePercent: "1" }), 10000)).toEqual([]);
  });

  it("tolère l'imprécision du calculateur de position", () => {
    // `PositionCalculatorModal` produit ce genre de valeur pour un risque de 1 %.
    expect(
      checkPlanViolations(trade({ riskPercent: 0.9999999996 }), [], plan({ riskPerTradePercent: "1" }), 10000)
    ).toEqual([]);
  });

  it("n'impose rien quand le risque n'est pas renseigné", () => {
    expect(checkPlanViolations(trade({ riskPercent: undefined }), [], plan({ riskPerTradePercent: "1" }), 10000)).toEqual([]);
  });

  it("désactive la règle quand le seuil du plan n'est pas un nombre", () => {
    // « 1 à 2 » : deviner un seuf que l'utilisateur n'a pas écrit serait pire
    // que ne rien vérifier.
    expect(checkPlanViolations(trade({ riskPercent: 5 }), [], plan({ riskPerTradePercent: "1 à 2" }), 10000)).toEqual([]);
  });

  it("distingue le risque mesuré du risque auto-déclaré", () => {
    // Tag coché mais risque réel conforme : une seule violation, celle du tag.
    const r = checkPlanViolations(
      trade({ riskPercent: 0.5, mistakes: ["Sur-risque (>1%)"] }),
      [],
      plan({ riskPerTradePercent: "1" }),
      10000
    );
    expect(r).toEqual(["risque auto-déclaré au-delà du plan"]);
  });

  it("cumule les deux quand le tag est coché ET le risque dépassé", () => {
    const r = checkPlanViolations(
      trade({ riskPercent: 4, mistakes: ["Sur-risque (>1%)"] }),
      [],
      plan({ riskPerTradePercent: "1" }),
      10000
    );
    expect(r).toHaveLength(2);
  });
});

describe("checkPlanViolations — tag auto-déclaré sans plan", () => {
  it("signale un trade marqué « Pas de plan de trade »", () => {
    const r = checkPlanViolations(trade({ mistakes: ["Pas de plan de trade"] }), [], plan(), 10000);
    expect(r).toContain("trade auto-déclaré sans plan");
  });
});

describe("normalizeTradingPlans", () => {
  it("accepte l'ancien format mono-plan (objet et non tableau)", () => {
    const r = normalizeTradingPlans({ name: "Ancien plan", trackedAssets: "US30" });
    expect(r).toHaveLength(1);
    expect(r[0].trackedAssets).toBe("US30");
  });

  it("écarte une entrée dont un champ a le mauvais type plutôt que de la propager", () => {
    // `authorizedSessions: null` ferait planter tout code lisant `.length`.
    const r = normalizeTradingPlans([{ id: "x", name: "P", authorizedSessions: null }]);
    expect(Array.isArray(r[0].authorizedSessions)).toBe(true);
  });

  it("renvoie un tableau vide sur une valeur illisible", () => {
    expect(normalizeTradingPlans(null)).toEqual([]);
    expect(normalizeTradingPlans("nimporte quoi")).toEqual([]);
  });
});
