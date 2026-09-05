import { describe, it, expect } from "vitest";
import { syncAccountsWithTrades, computeRealizedPnl } from "../walletStats";
import { TradingAccount, Trade } from "../../types";

/**
 * Le solde d'un compte est de l'argent : c'est le calcul qu'on peut le moins
 * se permettre de casser. Un retour anticipé « pas de trade → on ne touche à
 * rien » y a laissé, pendant un temps, des soldes gonflés du PnL de trades
 * supprimés depuis — d'où le premier cas ci-dessous.
 */

const compte = (over: Partial<TradingAccount> = {}): TradingAccount =>
  ({
    id: "acc-1",
    name: "SMT 10K",
    initialBalance: 10000,
    currentBalance: 10000,
    equity: 10000,
    manualAdjustment: 0,
    ...over,
  }) as unknown as TradingAccount;

const trade = (over: Partial<Trade> = {}): Trade =>
  ({
    id: "t-1",
    accountId: "acc-1",
    pnl: 0,
    result: "WIN",
    pnlUnit: "USD",
    ...over,
  }) as unknown as Trade;

describe("syncAccountsWithTrades", () => {
  it("ramène le solde au capital initial quand tous les trades ont été supprimés", () => {
    const gonfle = compte({ currentBalance: 10126.5, equity: 10126.5 });
    expect(syncAccountsWithTrades([gonfle], [])[0].currentBalance).toBe(10000);
  });

  it("conserve l'ajustement manuel en l'absence de trade", () => {
    const avecAjustement = compte({ currentBalance: 9999, manualAdjustment: 500 } as Partial<TradingAccount>);
    expect(syncAccountsWithTrades([avecAjustement], [])[0].currentBalance).toBe(10500);
  });

  it("additionne le PnL des trades rattachés", () => {
    const trades = [trade({ pnl: 50 }), trade({ id: "t-2", pnl: -20 })];
    expect(syncAccountsWithTrades([compte()], trades)[0].currentBalance).toBe(10030);
  });

  it("ignore les trades d'un autre compte", () => {
    const trades = [trade({ accountId: "acc-2", pnl: 900 })];
    expect(syncAccountsWithTrades([compte()], trades)[0].currentBalance).toBe(10000);
  });

  it("ignore une position encore ouverte : son PnL n'est pas réalisé", () => {
    const trades = [trade({ pnl: 80, result: "OPEN" })];
    expect(syncAccountsWithTrades([compte()], trades)[0].currentBalance).toBe(10000);
  });

  it("ignore un trade dont le PnL est en %, qui n'est pas une somme d'argent", () => {
    const trades = [trade({ pnl: 5, pnlUnit: "PERCENT" })];
    expect(syncAccountsWithTrades([compte()], trades)[0].currentBalance).toBe(10000);
  });

  it("renvoie la MÊME référence quand rien ne change, pour ne pas déclencher de sauvegarde inutile", () => {
    const stable = compte();
    const accounts = [stable];
    expect(syncAccountsWithTrades(accounts, [])).toBe(accounts);
  });

  it("met à jour equity et currentBalance ensemble", () => {
    const r = syncAccountsWithTrades([compte()], [trade({ pnl: 250 })])[0];
    expect(r.equity).toBe(10250);
    expect(r.currentBalance).toBe(10250);
  });
});

describe("computeRealizedPnl", () => {
  it("ne compte que les trades réalisés en dollars du compte demandé", () => {
    const trades = [
      trade({ pnl: 100 }),
      trade({ id: "t-2", pnl: 50, result: "OPEN" }),
      trade({ id: "t-3", pnl: 30, pnlUnit: "PERCENT" }),
      trade({ id: "t-4", pnl: 999, accountId: "autre" }),
    ];
    expect(computeRealizedPnl(trades, "acc-1")).toBe(100);
  });

  it("vaut 0 sans aucun trade", () => {
    expect(computeRealizedPnl([], "acc-1")).toBe(0);
  });
});
