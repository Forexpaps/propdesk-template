import { describe, it, expect } from "vitest";
import {
  checkPlanViolations,
  computePlanComplianceSummary,
  normalizeTradingPlans,
  PlanViolation,
} from "../planCompliance";
import { Trade, TradingPlan } from "../../types";

/**
 * `checkPlanViolations` est le seul mécanisme de l'application qui confronte un
 * trade aux règles que le trader s'est fixées. Il n'avait aucun test — et il est
 * resté entièrement mort pendant une session complète (l'appelant lisait une
 * clé de stockage périmée) sans que rien ne le signale.
 *
 * Les `message` sont assertés VERBATIM : ils partent dans des notifications
 * persistées, qu'un simple changement de formulation ferait réapparaître comme
 * non lues. Les `code`, eux, sont la clé d'agrégation de
 * `computePlanComplianceSummary`.
 */

const messages = (v: PlanViolation[]) => v.map((x) => x.message);
const codes = (v: PlanViolation[]) => v.map((x) => x.code);

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
    expect(messages(r)).toContain("actif hors plan (EURUSD)");
  });

  it("accepte un actif listé", () => {
    expect(checkPlanViolations(trade({ pair: "NAS100" }), [], plan({ trackedAssets: "US30, NAS100" }), 10000)).toEqual([]);
  });

  it("signale un setup non autorisé", () => {
    const r = checkPlanViolations(trade({ strategy: "Scalp" }), [], plan({ authorizedSetups: "OPR" }), 10000);
    expect(messages(r)).toContain("setup non autorisé (Scalp)");
  });

  it("n'impose pas le setup quand le trade n'en porte aucun", () => {
    expect(checkPlanViolations(trade({ strategy: "" }), [], plan({ authorizedSetups: "OPR" }), 10000)).toEqual([]);
  });
});

describe("checkPlanViolations — session", () => {
  it("signale un trade hors des sessions autorisées", () => {
    // 10h UTC = Londres ; le plan n'autorise que l'Asie.
    const r = checkPlanViolations(trade({ time: "10:00" }), [], plan({ authorizedSessions: ["Asie"] }), 10000);
    expect(messages(r)).toContain("session non autorisée");
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
    expect(messages(r)).toContain("limite de 1 trade/jour dépassée");
  });

  it("signale la perte quotidienne max dépassée", () => {
    const jour = [trade({ id: "a", pnl: -300, result: "LOSS" }), trade({ id: "b", pnl: -300, result: "LOSS" })];
    // 600 $ perdus sur 10 000 $ = 6 %, au-delà des 5 % du plan.
    const r = checkPlanViolations(jour[0], jour, plan({ maxDailyLossPercent: "5" }), 10000);
    expect(r.some((v) => v.message.startsWith("perte quotidienne max dépassée"))).toBe(true);
  });

  it("ignore la perte quotidienne sans capital de départ connu", () => {
    const jour = [trade({ pnl: -900, result: "LOSS" })];
    expect(checkPlanViolations(jour[0], jour, plan({ maxDailyLossPercent: "5" }), 0)).toEqual([]);
  });
});

describe("checkPlanViolations — risque engagé", () => {
  it("signale un risque mesuré au-delà du plan", () => {
    const r = checkPlanViolations(trade({ riskPercent: 3 }), [], plan({ riskPerTradePercent: "1" }), 10000);
    expect(messages(r)).toContain("risque engagé 3% au-delà du plan (1%)");
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
    expect(codes(r)).toEqual(["sur_risque_declare"]);
    expect(messages(r)).toEqual(["risque auto-déclaré au-delà du plan"]);
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
    expect(messages(r)).toContain("trade auto-déclaré sans plan");
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

describe("computePlanComplianceSummary", () => {
  it("compte à part les trades sans plan — ne pas en avoir n'est pas respecter le sien", () => {
    const trades = [
      trade({ id: "avec", tradingPlanId: "p1" }),
      trade({ id: "sans", tradingPlanId: undefined }),
      trade({ id: "plan-supprime", tradingPlanId: "plan-effacé" }),
    ];
    const r = computePlanComplianceSummary(trades, [plan()], 10000);
    expect(r.tradesEvalues).toBe(1);
    expect(r.tradesNonEvalues).toBe(2);
    // Un trade non évalué n'apparaît pas dans la map : « absent » et
    // « présent avec zéro violation » disent deux choses différentes.
    expect(r.violationsParTrade.has("sans")).toBe(false);
    expect(r.violationsParTrade.get("avec")).toEqual([]);
  });

  it("ne compte qu'UNE fois un trade qui enfreint trois règles, mais l'inscrit aux trois lignes", () => {
    const t = trade({
      id: "triple",
      tradingPlanId: "p1",
      pair: "EURUSD",
      strategy: "Scalp",
      pnl: -200,
      result: "LOSS",
    });
    const r = computePlanComplianceSummary(
      [t],
      [plan({ trackedAssets: "US30", authorizedSetups: "OPR", authorizedSessions: ["Asie"] })],
      10000
    );
    expect(r.tradesEnInfraction).toBe(1);
    expect(r.pnlTotalEnInfraction).toBe(-200);
    expect(r.parRegle).toHaveLength(3);
    // Recoupement ASSUMÉ et vérifié : la somme des lignes recompte le même
    // trade trois fois, le total général non. Les deux chiffres sont justes,
    // ils ne répondent simplement pas à la même question.
    expect(r.parRegle.reduce((acc, l) => acc + l.pnl, 0)).toBe(-600);
    expect(r.parRegle.every((l) => l.occurrences === 1)).toBe(true);
  });

  it("garde le PnL signé — une entorse rentable reste rentable", () => {
    const r = computePlanComplianceSummary(
      [trade({ tradingPlanId: "p1", pair: "EURUSD", pnl: 350, result: "WIN" })],
      [plan({ trackedAssets: "US30" })],
      10000
    );
    expect(r.pnlTotalEnInfraction).toBe(350);
    expect(r.parRegle[0].pnl).toBe(350);
  });

  it("met les deux trades du jour en infraction quand la limite est de 1", () => {
    // Fige le comportement actuel de `checkPlanViolations` : la règle juge la
    // JOURNÉE, pas le trade excédentaire — les deux la portent donc.
    const trades = [
      trade({ id: "a", date: "2026-03-10", tradingPlanId: "p1" }),
      trade({ id: "b", date: "2026-03-10", tradingPlanId: "p1" }),
    ];
    const r = computePlanComplianceSummary(trades, [plan({ maxTradesPerDay: "1" })], 10000);
    expect(r.tradesEnInfraction).toBe(2);
    expect(r.parRegle[0].code).toBe("max_trades_par_jour");
    expect(r.parRegle[0].occurrences).toBe(2);
  });

  it("n'agrège pas les jours entre eux", () => {
    const trades = [
      trade({ id: "a", date: "2026-03-10", tradingPlanId: "p1" }),
      trade({ id: "b", date: "2026-03-11", tradingPlanId: "p1" }),
    ];
    const r = computePlanComplianceSummary(trades, [plan({ maxTradesPerDay: "1" })], 10000);
    expect(r.tradesEnInfraction).toBe(0);
  });

  it("signale les trades dont le risque n'a pas pu être vérifié", () => {
    const trades = [
      trade({ id: "mesure", tradingPlanId: "p1", riskPercent: 0.5 }),
      trade({ id: "inconnu", tradingPlanId: "p1", riskPercent: undefined }),
    ];
    const r = computePlanComplianceSummary(trades, [plan({ riskPerTradePercent: "1" })], 10000);
    expect(r.tradesRisqueNonVerifiable).toBe(1);
    // Non vérifiable ≠ en infraction : le trade reste hors du compte des fautes.
    expect(r.tradesEnInfraction).toBe(0);
  });

  it("compte à part les infractions dont le PnL n'est pas chiffrable", () => {
    const trades = [
      trade({ id: "ouverte", tradingPlanId: "p1", pair: "EURUSD", result: "OPEN", pnl: 999 }),
      trade({ id: "pourcent", tradingPlanId: "p1", pair: "EURUSD", pnlUnit: "PERCENT", pnl: 7 }),
    ];
    const r = computePlanComplianceSummary(trades, [plan({ trackedAssets: "US30" })], 10000);
    expect(r.tradesEnInfraction).toBe(2);
    expect(r.pnlTotalEnInfraction).toBe(0);
    expect(r.parRegle[0].tradesNonChiffrables).toBe(2);
  });

  it("classe la règle la plus coûteuse en tête", () => {
    const trades = [
      trade({ id: "a", tradingPlanId: "p1", pair: "EURUSD", pnl: -500, result: "LOSS", strategy: "OPR" }),
      trade({ id: "b", tradingPlanId: "p1", pair: "US30", strategy: "Scalp", pnl: -50, result: "LOSS" }),
    ];
    const r = computePlanComplianceSummary(
      trades,
      [plan({ trackedAssets: "US30", authorizedSetups: "OPR" })],
      10000
    );
    expect(r.parRegle.map((l) => l.code)).toEqual(["actif_hors_plan", "setup_non_autorise"]);
  });

  it("renvoie un résumé vide sans trade, sans jamais lever", () => {
    const r = computePlanComplianceSummary([], [], 10000);
    expect(r).toMatchObject({ tradesEvalues: 0, tradesNonEvalues: 0, tradesEnInfraction: 0, pnlTotalEnInfraction: 0 });
    expect(r.parRegle).toEqual([]);
  });
});
