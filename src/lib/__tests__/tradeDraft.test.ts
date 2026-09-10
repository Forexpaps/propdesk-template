import { describe, it, expect } from "vitest";
import { appliquerDraft } from "../tradeDraft";
import { TradeDraft } from "../../types";

/**
 * Le formulaire du Journal ne manipule que des chaînes ; `TradeDraft` porte
 * des nombres. Sans conversion, l'enregistrement levait
 * `raw.trim is not a function` et le trade n'était jamais sauvegardé — chemin
 * « Appliquer au Journal » entièrement inutilisable, en silence.
 */

const vierge = {
  date: "2026-03-10",
  pair: "",
  entryPrice: "",
  stopLoss: "",
  takeProfit: "",
  lotSize: "",
  riskPercent: "",
  strategy: "",
  notes: "",
  mistakes: [] as string[],
};

describe("appliquerDraft", () => {
  it("convertit en chaînes tous les champs numériques de l'ébauche", () => {
    const draft: TradeDraft = {
      pair: "US30",
      entryPrice: 44000,
      stopLoss: 43800,
      takeProfit: 44600,
      lotSize: 0.25,
      riskPercent: 0.5,
    };
    const r = appliquerDraft(vierge, draft);
    for (const cle of ["entryPrice", "stopLoss", "takeProfit", "lotSize", "riskPercent"] as const) {
      expect(typeof r[cle], cle).toBe("string");
    }
    expect(r.riskPercent).toBe("0.5");
    expect(r.entryPrice).toBe("44000");
    expect(r.pair).toBe("US30");
  });

  it("garantit que chaque champ chaîne du formulaire supporte `.trim()`", () => {
    // Assertion de la panne exacte : `parsePriceInput` commence par
    // `raw.trim()`, et c'est ce que le formulaire appelle à l'enregistrement.
    const r = appliquerDraft(vierge, { entryPrice: 44000, riskPercent: 0.5, lotSize: 0.25 });
    expect(() => {
      (r.entryPrice as string).trim();
      (r.riskPercent as string).trim();
      (r.lotSize as string).trim();
    }).not.toThrow();
  });

  it("laisse intacts les champs que l'ébauche ne fournit pas", () => {
    const r = appliquerDraft(vierge, { pair: "US30" });
    expect(r.entryPrice).toBe("");
    expect(r.riskPercent).toBe("");
    expect(r.date).toBe("2026-03-10");
    expect(r.mistakes).toEqual([]);
  });

  it("ignore une clé absente du formulaire plutôt que de l'inventer", () => {
    const r = appliquerDraft(vierge, { tradingPlanId: "plan-1" } as TradeDraft);
    expect("tradingPlanId" in r).toBe(false);
  });

  it("ne modifie pas le formulaire vierge reçu", () => {
    const copie = { ...vierge };
    appliquerDraft(vierge, { entryPrice: 42 });
    expect(vierge).toEqual(copie);
  });

  it("n'écrase pas un champ non numérique par une conversion", () => {
    const r = appliquerDraft(vierge, { notes: "dimensionné au calculateur" });
    expect(r.notes).toBe("dimensionné au calculateur");
  });
});
