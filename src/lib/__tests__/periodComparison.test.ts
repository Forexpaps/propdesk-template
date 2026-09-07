import { describe, it, expect } from "vitest";
import {
  computePeriodComparison,
  periodWindows,
  formatPeriodWindow,
  MIN_ECHANTILLON_COMPARAISON,
} from "../periodComparison";
import { Trade } from "../../types";

const trade = (over: Partial<Trade> = {}): Trade =>
  ({
    id: `t-${Math.random()}`,
    date: "2026-03-11",
    pair: "EUR/USD",
    result: "WIN",
    pnl: 100,
    pnlUnit: "USD",
    riskRewardRatio: 2,
    emotion: "Disciplined",
    strategy: "",
    ...over,
  }) as unknown as Trade;

const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

describe("periodWindows — semaine", () => {
  it("ancre sur le lundi, quel que soit le jour de référence dans la semaine", () => {
    // Mercredi 11 mars 2026 → semaine du lundi 9 au dimanche 15.
    const mercredi = periodWindows("week", new Date(2026, 2, 11));
    expect(iso(mercredi.courant.debut)).toBe("2026-03-09");
    expect(iso(mercredi.courant.fin)).toBe("2026-03-16");
    // Un lundi de référence doit produire EXACTEMENT la même fenêtre...
    const lundi = periodWindows("week", new Date(2026, 2, 9));
    expect(iso(lundi.courant.debut)).toBe("2026-03-09");
    // ...et un dimanche aussi : c'est le dernier jour de sa semaine, pas le premier.
    const dimanche = periodWindows("week", new Date(2026, 2, 15));
    expect(iso(dimanche.courant.debut)).toBe("2026-03-09");
    expect(iso(dimanche.precedent.debut)).toBe("2026-03-02");
    expect(iso(dimanche.precedent.fin)).toBe("2026-03-09");
  });

  it("remonte au-dessus d'un changement de mois et d'année", () => {
    // Jeudi 1er janvier 2026 appartient à la semaine du lundi 29 décembre 2025.
    const w = periodWindows("week", new Date(2026, 0, 1));
    expect(iso(w.courant.debut)).toBe("2025-12-29");
    expect(iso(w.precedent.debut)).toBe("2025-12-22");
  });
});

describe("periodWindows — mois", () => {
  it("compare des mois calendaires, jamais des fenêtres de 30 jours", () => {
    const mars = periodWindows("month", new Date(2026, 2, 20));
    expect(iso(mars.courant.debut)).toBe("2026-03-01");
    expect(iso(mars.courant.fin)).toBe("2026-04-01");
    // Février 2026 fait 28 jours : la fenêtre précédente doit s'arrêter au 1er mars.
    expect(iso(mars.precedent.debut)).toBe("2026-02-01");
    expect(iso(mars.precedent.fin)).toBe("2026-03-01");
  });

  it("janvier compare à décembre de l'année précédente", () => {
    const janvier = periodWindows("month", new Date(2026, 0, 15));
    expect(iso(janvier.precedent.debut)).toBe("2025-12-01");
    expect(iso(janvier.precedent.fin)).toBe("2026-01-01");
  });
});

describe("computePeriodComparison — bornes", () => {
  it("exclut le dimanche précédent et le lundi suivant", () => {
    const trades = [
      trade({ id: "avant", date: "2026-03-08", pnl: 1 }),
      trade({ id: "dedans", date: "2026-03-09", pnl: 10 }),
      trade({ id: "dernier", date: "2026-03-15", pnl: 20 }),
      trade({ id: "apres", date: "2026-03-16", pnl: 999 }),
    ];
    const c = computePeriodComparison(trades, "week", new Date(2026, 2, 11));
    expect(c.tradesCount.courant).toBe(2);
    expect(c.pnl.courant).toBe(30);
    // Le trade du 8 mars tombe dans la semaine précédente, pas dans le vide.
    expect(c.tradesCount.precedent).toBe(1);
  });
});

describe("computePeriodComparison — pièges d'interprétation", () => {
  it("n'expose JAMAIS de pourcentage sur le PnL, même quand la division serait possible", () => {
    // −100 $ → +150 $ : « +250 % » et « −250 % » sont tous deux défendables.
    const trades = [
      trade({ date: "2026-03-02", pnl: -100, result: "LOSS" }),
      trade({ date: "2026-03-09", pnl: 150 }),
    ];
    const c = computePeriodComparison(trades, "week", new Date(2026, 2, 11));
    expect(c.pnl.courant).toBe(150);
    expect(c.pnl.precedent).toBe(-100);
    expect(c.pnl.delta).toBe(250);
    expect(c.pnl.variationPercent).toBeNull();
  });

  it("ne divise pas par un précédent nul", () => {
    const trades = [trade({ date: "2026-03-09", pnl: 50, riskRewardRatio: 3 })];
    const c = computePeriodComparison(trades, "week", new Date(2026, 2, 11));
    for (const m of [c.pnl, c.winRate, c.tradesCount, c.avgRR, c.disciplineEmotionnelle, c.respectDuPlan]) {
      expect(m.variationPercent === null || Number.isFinite(m.variationPercent)).toBe(true);
      expect(m.delta === null || Number.isFinite(m.delta)).toBe(true);
    }
    expect(c.precedentVide).toBe(true);
  });

  it("laisse le win rate à null — pas à 0 — quand aucun trade n'est tranché", () => {
    // Une semaine 100 % BREAKEVEN n'est pas une semaine à 0 % de réussite.
    const trades = [
      trade({ date: "2026-03-09", result: "BREAKEVEN", pnl: 0 }),
      trade({ date: "2026-03-10", result: "OPEN", pnl: 0 }),
    ];
    const c = computePeriodComparison(trades, "week", new Date(2026, 2, 11));
    expect(c.winRate.courant).toBeNull();
    expect(c.winRate.delta).toBeNull();
    // Les trades existent bel et bien : eux sont comptés.
    expect(c.tradesCount.courant).toBe(2);
  });

  it("laisse toutes les métriques de taux à null sur une période vide des deux côtés", () => {
    const c = computePeriodComparison([], "month", new Date(2026, 2, 11));
    expect(c.winRate.courant).toBeNull();
    expect(c.avgRR.courant).toBeNull();
    expect(c.disciplineEmotionnelle.courant).toBeNull();
    // Le PnL et le compte, eux, valent bien zéro : c'est un fait, pas une absence.
    expect(c.pnl.courant).toBe(0);
    expect(c.tradesCount.courant).toBe(0);
  });
});

describe("computePeriodComparison — seuil d'échantillon", () => {
  const semaine = (debut: string, n: number, over: Partial<Trade> = {}) =>
    Array.from({ length: n }, (_, i) =>
      trade({ id: `${debut}-${i}`, date: `${debut.slice(0, 8)}${String(Number(debut.slice(8)) + i).padStart(2, "0")}`, ...over })
    );

  it("marque les taux non fiables sous 5 trades d'un côté, sans masquer la valeur", () => {
    const trades = [
      ...semaine("2026-03-02", MIN_ECHANTILLON_COMPARAISON),
      ...semaine("2026-03-09", MIN_ECHANTILLON_COMPARAISON - 1),
    ];
    const c = computePeriodComparison(trades, "week", new Date(2026, 2, 11));
    expect(c.winRate.fiable).toBe(false);
    expect(c.winRate.courant).toBe(100); // la donnée reste là, c'est le verdict qu'on suspend
    // Sommes de faits : jamais suspendues.
    expect(c.pnl.fiable).toBe(true);
    expect(c.tradesCount.fiable).toBe(true);
  });

  it("déclare les taux fiables dès 5 trades des deux côtés", () => {
    const trades = [
      ...semaine("2026-03-02", MIN_ECHANTILLON_COMPARAISON),
      ...semaine("2026-03-09", MIN_ECHANTILLON_COMPARAISON),
    ];
    const c = computePeriodComparison(trades, "week", new Date(2026, 2, 11));
    expect(c.winRate.fiable).toBe(true);
  });
});

describe("computePeriodComparison — respect du plan", () => {
  it("reste null tant que les violations ne sont pas fournies", () => {
    const c = computePeriodComparison([trade({ date: "2026-03-09" })], "week", new Date(2026, 2, 11));
    expect(c.respectDuPlan.courant).toBeNull();
  });

  it("ne compte au dénominateur que les trades évalués", () => {
    const trades = [
      trade({ id: "conforme", date: "2026-03-09" }),
      trade({ id: "fautif", date: "2026-03-10" }),
      trade({ id: "hors-plan", date: "2026-03-11" }), // absent de la map : non évaluable
    ];
    const violations = new Map<string, unknown[]>([
      ["conforme", []],
      ["fautif", ["actif hors plan"]],
    ]);
    const c = computePeriodComparison(trades, "week", new Date(2026, 2, 11), violations);
    // 1 conforme sur 2 évalués — surtout pas 1 sur 3, ce qui traiterait le
    // trade hors plan comme une infraction.
    expect(c.respectDuPlan.courant).toBe(50);
  });
});

describe("formatPeriodWindow", () => {
  it("affiche des bornes inclusives — la fin exclue ne doit jamais apparaître", () => {
    const w = periodWindows("week", new Date(2026, 2, 11));
    const texte = formatPeriodWindow(w.courant, "week");
    expect(texte).toContain("15"); // dimanche, dernier jour réel
    expect(texte).not.toContain("16"); // lundi suivant, borne exclue
  });

  it("nomme le mois et l'année", () => {
    const w = periodWindows("month", new Date(2026, 2, 11));
    expect(formatPeriodWindow(w.courant, "month")).toBe("mars 2026");
  });
});
