import { describe, it, expect } from "vitest";
import {
  weekStartOf,
  previousWeekStart,
  currentWeekStart,
  reviewId,
  findReview,
  tradesDeLaSemaine,
  evaluerObjectif,
  describeObjectif,
  revueAProposer,
  formatSemaine,
  OBJECTIF_CATALOGUE,
} from "../weeklyReview";
import { ObjectifHebdo, Trade, WeeklyReview } from "../../types";

const trade = (over: Partial<Trade> = {}): Trade =>
  ({
    id: `t-${Math.random()}`,
    date: "2026-03-10",
    pair: "US30",
    result: "WIN",
    pnl: 10,
    pnlUnit: "USD",
    riskRewardRatio: 2,
    emotion: "Disciplined",
    strategy: "OPR",
    ...over,
  }) as unknown as Trade;

const objectif = (over: Partial<ObjectifHebdo>): ObjectifHebdo => ({
  type: "max_trades_par_jour",
  valeur: 2,
  cibleWeekStart: "2026-03-09",
  ...over,
});

const review = (over: Partial<WeeklyReview> = {}): WeeklyReview => ({
  id: reviewId("2026-03-02"),
  weekStart: "2026-03-02",
  ceQuiAMarche: "",
  ceQuiNaPasMarche: "",
  objectif: null,
  createdAt: "2026-03-09T08:00:00.000Z",
  updatedAt: "2026-03-09T08:00:00.000Z",
  ...over,
});

describe("weekStartOf", () => {
  it("recule au lundi de l'année précédente pour un jeudi de nouvel an", () => {
    expect(weekStartOf(new Date(2026, 0, 1))).toBe("2025-12-29");
  });

  it("renvoie le lundi lui-même", () => {
    expect(weekStartOf(new Date(2026, 2, 9))).toBe("2026-03-09");
  });

  it("range le dimanche dans la semaine qui s'achève, pas celle qui commence", () => {
    expect(weekStartOf(new Date(2026, 2, 15))).toBe("2026-03-09");
  });

  it("traverse les changements d'heure sans décaler le jour", () => {
    // Passage à l'heure d'été en France : dimanche 29 mars 2026.
    expect(weekStartOf(new Date(2026, 2, 29))).toBe("2026-03-23");
    expect(weekStartOf(new Date(2026, 2, 30))).toBe("2026-03-30");
    // Retour à l'heure d'hiver : dimanche 25 octobre 2026.
    expect(weekStartOf(new Date(2026, 9, 25))).toBe("2026-10-19");
    expect(weekStartOf(new Date(2026, 9, 26))).toBe("2026-10-26");
  });

  it("previousWeekStart recule d'exactement une semaine, changement d'heure inclus", () => {
    expect(previousWeekStart(new Date(2026, 2, 30))).toBe("2026-03-23");
    expect(previousWeekStart(new Date(2026, 0, 1))).toBe("2025-12-22");
    expect(currentWeekStart(new Date(2026, 2, 11))).toBe("2026-03-09");
  });
});

describe("tradesDeLaSemaine", () => {
  it("borne strictement au lundi et au dimanche", () => {
    const trades = [
      trade({ id: "dimanche-avant", date: "2026-03-08" }),
      trade({ id: "lundi", date: "2026-03-09" }),
      trade({ id: "dimanche", date: "2026-03-15" }),
      trade({ id: "lundi-suivant", date: "2026-03-16" }),
    ];
    expect(tradesDeLaSemaine(trades, "2026-03-09").map((t) => t.id)).toEqual(["lundi", "dimanche"]);
  });

  it("écarte une date illisible plutôt que de la ranger quelque part", () => {
    expect(tradesDeLaSemaine([trade({ date: "pas-une-date" })], "2026-03-09")).toEqual([]);
  });
});

describe("evaluerObjectif — le verdict a trois états", () => {
  it("ne déclare PAS « atteint » un objectif d'absence sur une semaine sans trade", () => {
    // Le piège central de cette fonctionnalité : valider « aucun trade en
    // émotion » sans le moindre trade récompenserait le fait de ne pas trader.
    for (const type of ["aucun_trade_en_emotion", "aucune_erreur_taguee", "max_trades_par_jour", "max_trades_semaine", "aucun_trade_hors_plan"] as const) {
      const r = evaluerObjectif(objectif({ type }), []);
      expect(r.verdict, type).toBe("non_verifiable");
    }
  });

  it("déclare « manqué » un minimum de jours sur une semaine vide", () => {
    // Celui-là SE mesure par l'absence : ne pas trader, c'est le manquer.
    const r = evaluerObjectif(objectif({ type: "min_jours_traves", valeur: 3 }), []);
    expect(r.verdict).toBe("manque");
  });
});

describe("evaluerObjectif — max_trades_par_jour", () => {
  const o = objectif({ type: "max_trades_par_jour", valeur: 2 });

  it("atteint quand aucun jour ne dépasse", () => {
    const r = evaluerObjectif(o, [trade({ date: "2026-03-09" }), trade({ date: "2026-03-09" }), trade({ date: "2026-03-10" })]);
    expect(r.verdict).toBe("atteint");
  });

  it("manqué, et le constat nomme le jour fautif", () => {
    const r = evaluerObjectif(o, [
      trade({ date: "2026-03-12" }),
      trade({ date: "2026-03-12" }),
      trade({ date: "2026-03-12" }),
      trade({ date: "2026-03-09" }),
    ]);
    expect(r.verdict).toBe("manque");
    expect(r.constat).toContain("jeudi 12 mars");
    expect(r.constat).toContain("3 trades");
  });

  it("mentionne les autres jours en dépassement sans les énumérer", () => {
    const r = evaluerObjectif(objectif({ type: "max_trades_par_jour", valeur: 1 }), [
      trade({ date: "2026-03-09" }),
      trade({ date: "2026-03-09" }),
      trade({ date: "2026-03-10" }),
      trade({ date: "2026-03-10" }),
    ]);
    expect(r.constat).toContain("1 autre jour");
  });
});

describe("evaluerObjectif — comptes de la semaine", () => {
  it("max_trades_semaine tranche au seuil inclus", () => {
    const trois = [trade(), trade(), trade()];
    expect(evaluerObjectif(objectif({ type: "max_trades_semaine", valeur: 3 }), trois).verdict).toBe("atteint");
    expect(evaluerObjectif(objectif({ type: "max_trades_semaine", valeur: 2 }), trois).verdict).toBe("manque");
  });

  it("min_jours_traves compte les JOURS distincts, pas les trades", () => {
    const troisTradesUnSeulJour = [trade({ date: "2026-03-09" }), trade({ date: "2026-03-09" }), trade({ date: "2026-03-09" })];
    const r = evaluerObjectif(objectif({ type: "min_jours_traves", valeur: 3 }), troisTradesUnSeulJour);
    expect(r.verdict).toBe("manque");
    expect(r.constat).toContain("1 jour");
  });
});

describe("evaluerObjectif — émotions et erreurs", () => {
  it("aucun_trade_en_emotion accepte Discipliné et Calme, refuse les trois autres", () => {
    const o = objectif({ type: "aucun_trade_en_emotion" });
    expect(evaluerObjectif(o, [trade({ emotion: "Disciplined" }), trade({ emotion: "Calm" })]).verdict).toBe("atteint");
    const r = evaluerObjectif(o, [trade({ emotion: "Calm" }), trade({ emotion: "FOMO" })]);
    expect(r.verdict).toBe("manque");
    expect(r.constat).toContain("1 trade sur 2");
  });

  it("aucune_erreur_taguee ignore un tableau d'erreurs vide", () => {
    const o = objectif({ type: "aucune_erreur_taguee" });
    expect(evaluerObjectif(o, [trade({ mistakes: [] }), trade({ mistakes: undefined })]).verdict).toBe("atteint");
    expect(evaluerObjectif(o, [trade({ mistakes: ["FOMO / Chasing"] })]).verdict).toBe("manque");
  });
});

describe("evaluerObjectif — risque max par trade", () => {
  const o = objectif({ type: "risque_max_par_trade", valeur: 1 });

  it("reste non vérifiable si aucun trade ne renseigne le risque", () => {
    const r = evaluerObjectif(o, [trade({ riskPercent: undefined }), trade({ riskPercent: undefined })]);
    expect(r.verdict).toBe("non_verifiable");
  });

  it("juge sur les trades mesurés et annonce le dénominateur", () => {
    const r = evaluerObjectif(o, [trade({ riskPercent: 0.5 }), trade({ riskPercent: undefined }), trade({ riskPercent: 0.8 })]);
    expect(r.verdict).toBe("atteint");
    expect(r.constat).toContain("2 trades sur 3");
  });

  it("tolère l'imprécision du calculateur de position", () => {
    expect(evaluerObjectif(o, [trade({ riskPercent: 0.9999999996 })]).verdict).toBe("atteint");
  });

  it("signale un dépassement réel", () => {
    const r = evaluerObjectif(o, [trade({ riskPercent: 2 }), trade({ riskPercent: 0.5 })]);
    expect(r.verdict).toBe("manque");
    expect(r.constat).toContain("1 trade");
  });
});

describe("evaluerObjectif — rattachement au plan", () => {
  const o = objectif({ type: "aucun_trade_hors_plan" });

  it("traite un plan supprimé comme « hors plan », comme le fait le résumé de conformité", () => {
    const trades = [trade({ tradingPlanId: "p1" }), trade({ tradingPlanId: "plan-efface" })];
    const r = evaluerObjectif(o, trades, new Set(["p1"]));
    expect(r.verdict).toBe("manque");
    expect(r.constat).toContain("1 trade sur 2");
  });

  it("valide quand tous les trades pointent un plan existant", () => {
    const r = evaluerObjectif(o, [trade({ tradingPlanId: "p1" })], new Set(["p1"]));
    expect(r.verdict).toBe("atteint");
  });
});

describe("revues", () => {
  it("l'id est déterministe — réécrire une semaine met à jour, ne duplique pas", () => {
    expect(reviewId("2026-03-09")).toBe("revue-2026-03-09");
    expect(reviewId("2026-03-09")).toBe(reviewId("2026-03-09"));
  });

  it("findReview retrouve par semaine", () => {
    const reviews = [review({ weekStart: "2026-03-02" }), review({ id: "revue-2026-03-09", weekStart: "2026-03-09" })];
    expect(findReview(reviews, "2026-03-09")?.id).toBe("revue-2026-03-09");
    expect(findReview(reviews, "2026-03-16")).toBeUndefined();
  });
});

describe("revueAProposer", () => {
  const reference = new Date(2026, 2, 11); // mercredi 11 mars

  it("propose la semaine écoulée quand elle contient des trades et n'a pas de revue", () => {
    expect(revueAProposer([], [trade({ date: "2026-03-03" })], reference)).toBe("2026-03-02");
  });

  it("ne propose rien quand la revue est déjà écrite", () => {
    expect(revueAProposer([review({ weekStart: "2026-03-02" })], [trade({ date: "2026-03-03" })], reference)).toBeNull();
  });

  it("ne propose rien sur une semaine écoulée sans le moindre trade", () => {
    // Un bandeau « écris ta revue » sur une semaine vide serait une corvée
    // inventée, pas un rituel.
    expect(revueAProposer([], [trade({ date: "2026-03-10" })], reference)).toBeNull();
  });
});

describe("libellés", () => {
  it("décrit chaque type du catalogue sans jamais retomber sur une chaîne vide", () => {
    for (const entree of OBJECTIF_CATALOGUE) {
      const texte = describeObjectif(objectif({ type: entree.type, valeur: entree.defaut ?? 1 }));
      expect(texte.length, entree.type).toBeGreaterThan(0);
    }
  });

  it("formatSemaine affiche des bornes inclusives", () => {
    const texte = formatSemaine("2026-03-09");
    expect(texte).toContain("9");
    expect(texte).toContain("15 mars");
    expect(texte).not.toContain("16");
  });
});
