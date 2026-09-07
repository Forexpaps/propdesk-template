import { describe, it, expect } from "vitest";
import { computePerformanceStats } from "../performanceStats";
import { computeWeeklySummary } from "../weeklySummary";
import { computeRiskDisciplineStreak } from "../badges";
import { upsertWalletRiskAlerts } from "../walletAlerts";
import { MAX_STUDENT_NOTIFICATIONS } from "../planCompliance";
import { AppNotification, StudentProfile, Trade, TradingAccount } from "../../types";

/**
 * Données que l'application peut réellement rencontrer sans les avoir
 * produites elle-même : sauvegarde restaurée puis éditée à la main, CSV rempli
 * dans un tableur, trade écrit par une version antérieure. Rien ici n'est
 * théorique — chacun de ces cas cassait une partie de l'écran.
 */

const student = {
  startingCapital: 10000,
  currentCapital: 10000,
  joinedDate: "1 janvier 2026",
} as unknown as StudentProfile;

const trade = (over: Partial<Trade> = {}): Trade =>
  ({
    id: `t-${Math.random()}`,
    date: "2026-03-10",
    pair: "US30",
    marketCategory: "Indices",
    direction: "LONG",
    entryPrice: 100,
    stopLoss: 95,
    takeProfit: 110,
    lotSize: 1,
    pnl: 10,
    pnlUnit: "USD",
    riskRewardRatio: 2,
    result: "WIN",
    strategy: "OPR",
    emotion: "Calm",
    notes: "",
    ...over,
  }) as unknown as Trade;

describe("émotion hors catalogue", () => {
  it("n'interrompt plus tout l'écran Rentabilité", () => {
    // `emotionStats[t.emotion]` valait `undefined` : la page entière tombait
    // sur un TypeError, rendant l'analyse inaccessible pour une seule ligne.
    expect(() =>
      computePerformanceStats(student, [trade({ emotion: "Serein" as never })])
    ).not.toThrow();
  });

  it("écarte le trade au lieu de le ranger dans une émotion voisine", () => {
    const r = computePerformanceStats(student, [
      trade({ emotion: "Calm", pnl: 10 }),
      trade({ emotion: "Serein" as never, pnl: 999 }),
    ]);
    const calme = r.emotionChartData.find((e) => e.emotion === "Calme")!;
    expect(calme.tradesCount).toBe(1);
    expect(r.emotionChartData.reduce((n, e) => n + e.tradesCount, 0)).toBe(1);
    // Il reste compté partout où l'émotion n'entre pas en jeu.
    expect(r.totalTrades).toBe(2);
    expect(r.totalPnL).toBe(1009);
  });
});

describe("erreur taguée hors catalogue", () => {
  it("n'affiche jamais « ton point faible : undefined »", () => {
    const phrase = computeWeeklySummary([trade({ mistakes: ["Truc inconnu" as never] })]);
    expect(phrase).not.toContain("undefined");
    expect(phrase).toContain("Aucun point faible");
  });

  it("nomme toujours un tag connu", () => {
    const phrase = computeWeeklySummary([
      trade({ date: new Date().toISOString().slice(0, 10), mistakes: ["Over-trading"] }),
    ]);
    expect(phrase).toContain("over-trading");
  });
});

describe("computeRiskDisciplineStreak", () => {
  it("ne dépend plus de l'ordre du tableau reçu", () => {
    // Un import CSV, une édition de date ou un rechargement rendent un ordre
    // qui n'est pas chronologique : la série partait alors d'un trade qui
    // n'était pas le plus récent.
    const recentMauvais = trade({ date: "2026-03-12", riskPercent: 5 });
    const anciensBons = [
      trade({ date: "2026-03-11", riskPercent: 0.5 }),
      trade({ date: "2026-03-10", riskPercent: 0.5 }),
    ];
    expect(computeRiskDisciplineStreak([...anciensBons, recentMauvais])).toBe(0);
    expect(computeRiskDisciplineStreak([recentMauvais, ...anciensBons])).toBe(0);
  });

  it("compte la série en partant du trade le plus récent", () => {
    const trades = [
      trade({ date: "2026-03-10", riskPercent: 5 }),
      trade({ date: "2026-03-12", riskPercent: 0.5 }),
      trade({ date: "2026-03-11", riskPercent: 0.5 }),
    ];
    expect(computeRiskDisciplineStreak(trades)).toBe(2);
  });

  it("départage deux trades du même jour par l'heure", () => {
    const trades = [
      trade({ date: "2026-03-12", time: "09:00", riskPercent: 0.5 }),
      trade({ date: "2026-03-12", time: "16:00", riskPercent: 4 }),
    ];
    // Le plus récent de la journée est celui de 16h, hors seuil : série nulle.
    expect(computeRiskDisciplineStreak(trades)).toBe(0);
  });

  it("rompt la série sur un risque non renseigné", () => {
    expect(
      computeRiskDisciplineStreak([
        trade({ date: "2026-03-12", riskPercent: undefined }),
        trade({ date: "2026-03-11", riskPercent: 0.5 }),
      ])
    ).toBe(0);
  });
});

describe("rétention du centre d'alertes", () => {
  it("borne la collection comme le font les alertes de plan", () => {
    // L'id du drawdown quotidien porte la date du jour : chaque journée en
    // dépassement créait de nouvelles entrées que rien ne purgeait.
    const compte: TradingAccount = {
      id: "acc-1",
      name: "Prop 10K",
      status: "ACTIVE",
      initialBalance: 10000,
      currentBalance: 5000,
      equity: 5000,
      maxDailyDrawdownPercent: 5,
      maxTotalDrawdownPercent: 10,
    } as unknown as TradingAccount;

    const anciennes: AppNotification[] = Array.from({ length: MAX_STUDENT_NOTIFICATIONS }, (_, i) => ({
      id: `vieille-${i}`,
      title: "x",
      message: "x",
      time: "x",
      type: "system",
      read: true,
    }));

    const apres = upsertWalletRiskAlerts(anciennes, [compte], []);
    expect(apres.length).toBeLessThanOrEqual(MAX_STUDENT_NOTIFICATIONS);
    // La nouvelle alerte est bien entrée : c'est la plus ancienne qui sort.
    expect(apres[0].id).not.toBe("vieille-0");
  });

  it("renvoie la même référence quand rien de neuf n'est déclenché", () => {
    const notifications: AppNotification[] = [];
    expect(upsertWalletRiskAlerts(notifications, [], [])).toBe(notifications);
  });
});
