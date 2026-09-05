import { describe, it, expect, beforeEach } from "vitest";
import { markPending, listPending, clearPending, describePending } from "../pendingChanges";

/**
 * `markPending` est le filet qui empêche une modification non synchronisée de
 * disparaître au rechargement suivant. Il ignore volontairement les clés
 * inconnues — ce qui en fait un piège : ajouter une collection synchronisée
 * sans l'y déclarer la prive silencieusement de toute protection. C'est
 * exactement ce qui est arrivé aux plans de trading, d'où ces tests.
 */

const localStorageSimule = () => {
  const store: Record<string, string> = {};
  return {
    getItem: (k: string) => store[k] ?? null,
    setItem: (k: string, v: string) => {
      store[k] = v;
    },
    removeItem: (k: string) => {
      delete store[k];
    },
    clear: () => {
      for (const k of Object.keys(store)) delete store[k];
    },
  };
};

beforeEach(() => {
  (globalThis as Record<string, unknown>).localStorage = localStorageSimule();
  clearPending();
});

describe("markPending", () => {
  it("retient chaque collection synchronisée de l'application", () => {
    const collections = [
      "horizon_student",
      "horizon_trades",
      "horizon_accounts",
      "horizon_notifications",
      "horizon_badges",
      "horizon_setups",
      "horizon_trading_plans",
    ];
    for (const cle of collections) markPending(cle);
    expect(listPending().sort()).toEqual([...collections].sort());
  });

  it("protège les plans de trading, devenus une collection serveur", () => {
    markPending("horizon_trading_plans");
    expect(listPending()).toContain("horizon_trading_plans");
    expect(describePending(listPending())).toEqual(["Plans de trading"]);
  });

  it("ignore une clé inconnue plutôt que d'encombrer le registre", () => {
    markPending("cle_qui_nexiste_pas");
    expect(listPending()).toEqual([]);
  });

  it("ne retient pas deux fois la même clé", () => {
    markPending("horizon_trades");
    markPending("horizon_trades");
    expect(listPending()).toEqual(["horizon_trades"]);
  });

  it("traduit les clés en libellés lisibles pour le bandeau", () => {
    expect(describePending(["horizon_trades", "horizon_setups"])).toEqual([
      "Journal de trading",
      "Setups",
    ]);
  });

  it("laisse passer une clé sans libellé plutôt que de l'effacer de l'affichage", () => {
    expect(describePending(["inconnue"])).toEqual(["inconnue"]);
  });
});
