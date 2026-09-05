import { describe, it, expect } from "vitest";
import { computeBadgeProgress, computeRiskDisciplineStreak, computeDisciplineStreak } from "../badges";
import { Trade, TraderBadge } from "../../types";

const trade = (over: Partial<Trade> = {}): Trade =>
  ({
    id: "t-1",
    date: "2026-01-05",
    pair: "US30",
    result: "WIN",
    emotion: "Calm",
    riskRewardRatio: 2,
    notes: "",
    mistakes: [],
    ...over,
  }) as unknown as Trade;

const badge = (id: string): TraderBadge =>
  ({ id, title: id, unlocked: false, progressPercentage: 0, currentValue: 0, targetValue: 0 }) as unknown as TraderBadge;

describe("computeRiskDisciplineStreak", () => {
  it("compte les trades consécutifs dont le risque est renseigné et ≤ 1 %", () => {
    // `trades` arrive du plus récent au plus ancien.
    const trades = [trade({ riskPercent: 0.5 }), trade({ riskPercent: 1 }), trade({ riskPercent: 0.8 })];
    expect(computeRiskDisciplineStreak(trades)).toBe(3);
  });

  it("rompt la série sur un dépassement", () => {
    const trades = [trade({ riskPercent: 0.5 }), trade({ riskPercent: 2.5 }), trade({ riskPercent: 0.5 })];
    expect(computeRiskDisciplineStreak(trades)).toBe(1);
  });

  it("rompt la série sur un trade dont le risque n'est pas renseigné, sans l'ignorer", () => {
    // L'ignorer fabriquerait une série jamais observée : un journal où le champ
    // n'est jamais rempli afficherait alors une discipline parfaite.
    const trades = [trade({ riskPercent: 0.5 }), trade({ riskPercent: undefined }), trade({ riskPercent: 0.5 })];
    expect(computeRiskDisciplineStreak(trades)).toBe(1);
  });

  it("vaut 0 quand aucun trade ne renseigne le risque", () => {
    expect(computeRiskDisciplineStreak([trade(), trade()])).toBe(0);
    expect(computeRiskDisciplineStreak([])).toBe(0);
  });

  it("accepte exactement 1 % comme conforme", () => {
    expect(computeRiskDisciplineStreak([trade({ riskPercent: 1 })])).toBe(1);
    expect(computeRiskDisciplineStreak([trade({ riskPercent: 1.01 })])).toBe(0);
  });
});

describe("computeBadgeProgress — badges de gestion du risque", () => {
  it("rend « Maître du Risk 1% » suivable dès que le risque est renseigné", () => {
    const trades = Array.from({ length: 15 }, (_, i) => trade({ id: `t${i}`, riskPercent: 0.5 }));
    const [b] = computeBadgeProgress([badge("badge-1")], trades);
    expect(b.trackable).toBe(true);
    expect(b.currentValue).toBe(15);
    expect(b.targetValue).toBe(15);
    expect(b.progressPercentage).toBe(100);
  });

  it("applique les bons paliers aux badges 21, 22 et 23", () => {
    const trades = Array.from({ length: 30 }, (_, i) => trade({ id: `t${i}`, riskPercent: 1 }));
    const [b21, b22, b23] = computeBadgeProgress(
      [badge("badge-21"), badge("badge-22"), badge("badge-23")],
      trades
    );
    expect(b21.targetValue).toBe(30);
    expect(b21.progressPercentage).toBe(100);
    expect(b22.targetValue).toBe(50);
    expect(b23.targetValue).toBe(100);
    expect(b23.progressPercentage).toBe(30);
  });

  it("reste à 0 sans jamais devenir « non suivable » quand le champ est vide", () => {
    const [b] = computeBadgeProgress([badge("badge-1")], [trade(), trade()]);
    expect(b.trackable).toBe(true);
    expect(b.currentValue).toBe(0);
  });

  it("laisse « Cumul de Performance +10R » non suivable, faute du risque en devise", () => {
    const [b] = computeBadgeProgress([badge("badge-8")], [trade({ riskPercent: 1 })]);
    expect(b.trackable).toBe(false);
  });

  it("retrouve le critère d'un badge dont l'id est préfixé par l'utilisateur", () => {
    const [b] = computeBadgeProgress([badge("user-42-badge-1")], [trade({ riskPercent: 0.5 })]);
    expect(b.trackable).toBe(true);
    expect(b.currentValue).toBe(1);
  });
});

describe("computeDisciplineStreak", () => {
  it("compte les jours de trading consécutifs sans écart émotionnel ni erreur", () => {
    const trades = [
      trade({ id: "1", date: "2026-01-07", emotion: "Calm" }),
      trade({ id: "2", date: "2026-01-06", emotion: "Disciplined" }),
      trade({ id: "3", date: "2026-01-05", emotion: "FOMO" }),
    ];
    expect(computeDisciplineStreak(trades)).toBe(2);
  });

  it("rompt la série dès qu'une erreur est taguée dans la journée", () => {
    const trades = [
      trade({ id: "1", date: "2026-01-07", emotion: "Calm", mistakes: ["Over-trading"] }),
    ];
    expect(computeDisciplineStreak(trades)).toBe(0);
  });
});
