import { describe, it, expect } from "vitest";
import { periodStart, sortTrades, SortState } from "../journalFilters";
import { Trade } from "../../types";

const trade = (over: Partial<Trade> = {}): Trade =>
  ({
    id: "t-1",
    date: "2026-01-05",
    pair: "US30",
    pnl: 0,
    riskRewardRatio: 1,
    result: "WIN",
    ...over,
  }) as unknown as Trade;

describe("periodStart", () => {
  const reference = new Date(2026, 7, 17); // 17 août 2026

  it("borne au 1er du mois en cours", () => {
    expect(periodStart("month", reference)).toEqual(new Date(2026, 7, 1));
  });

  it("borne au 1er du trimestre en cours", () => {
    // Août appartient au trimestre juillet-septembre.
    expect(periodStart("quarter", reference)).toEqual(new Date(2026, 6, 1));
  });

  it("borne au 1er janvier pour l'année", () => {
    expect(periodStart("year", reference)).toEqual(new Date(2026, 0, 1));
  });

  it("ne borne rien pour « tout »", () => {
    expect(periodStart("all", reference)).toBeNull();
  });

  it("place janvier dans le premier trimestre", () => {
    expect(periodStart("quarter", new Date(2026, 0, 15))).toEqual(new Date(2026, 0, 1));
  });
});

describe("sortTrades", () => {
  const a = trade({ id: "a", date: "2026-01-05", time: "09:00", pnl: 100, riskRewardRatio: 3 });
  const b = trade({ id: "b", date: "2026-01-07", time: "14:00", pnl: -50, riskRewardRatio: 1 });
  const c = trade({ id: "c", date: "2026-01-06", time: "10:00", pnl: 20, riskRewardRatio: 2 });
  const liste = [a, b, c];

  it("renvoie le tableau tel quel sans tri, pour préserver l'ordre de saisie", () => {
    expect(sortTrades(liste, null)).toBe(liste);
  });

  it("trie par date, dans les deux sens", () => {
    const desc = sortTrades(liste, { key: "date", dir: "desc" }).map((t) => t.id);
    expect(desc).toEqual(["b", "c", "a"]);
    const asc = sortTrades(liste, { key: "date", dir: "asc" }).map((t) => t.id);
    expect(asc).toEqual(["a", "c", "b"]);
  });

  it("départage deux trades du même jour par l'heure", () => {
    const matin = trade({ id: "matin", date: "2026-02-01", time: "08:00" });
    const soir = trade({ id: "soir", date: "2026-02-01", time: "18:00" });
    expect(sortTrades([soir, matin], { key: "date", dir: "asc" }).map((t) => t.id)).toEqual([
      "matin",
      "soir",
    ]);
  });

  it("fait remonter un trade sans heure avant ceux du même jour, de façon déterministe", () => {
    const sansHeure = trade({ id: "sans", date: "2026-02-01", time: undefined });
    const avecHeure = trade({ id: "avec", date: "2026-02-01", time: "08:00" });
    expect(sortTrades([avecHeure, sansHeure], { key: "date", dir: "asc" }).map((t) => t.id)).toEqual([
      "sans",
      "avec",
    ]);
  });

  it("trie par PnL et par R:R", () => {
    expect(sortTrades(liste, { key: "pnl", dir: "desc" }).map((t) => t.id)).toEqual(["a", "c", "b"]);
    expect(sortTrades(liste, { key: "rr", dir: "asc" }).map((t) => t.id)).toEqual(["b", "c", "a"]);
  });

  it("ne modifie jamais le tableau d'origine", () => {
    const original = [...liste];
    sortTrades(liste, { key: "pnl", dir: "asc" });
    expect(liste).toEqual(original);
  });

  it("reste stable : à valeur égale, l'ordre d'origine est conservé", () => {
    const x = trade({ id: "x", pnl: 10 });
    const y = trade({ id: "y", pnl: 10 });
    const z = trade({ id: "z", pnl: 10 });
    const sort: SortState = { key: "pnl", dir: "desc" };
    expect(sortTrades([x, y, z], sort).map((t) => t.id)).toEqual(["x", "y", "z"]);
  });
});
