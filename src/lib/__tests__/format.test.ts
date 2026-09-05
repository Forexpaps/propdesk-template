import { describe, it, expect } from "vitest";
import { formatCurrency, formatDuration, parsePriceInput } from "../format";

describe("parsePriceInput", () => {
  /**
   * Demande explicite : on doit pouvoir taper un prix comme on le lit sur sa
   * plateforme, sans que l'app impose une convention. Ces cas fixent
   * l'heuristique — le dernier séparateur rencontré est la décimale.
   */
  it("accepte les deux conventions de décimale", () => {
    expect(parsePriceInput("4655.66")).toBe(4655.66);
    expect(parsePriceInput("4655,66")).toBe(4655.66);
  });

  it("distingue le séparateur de milliers de la décimale", () => {
    expect(parsePriceInput("4.655,66")).toBe(4655.66); // convention française
    expect(parsePriceInput("4,655.66")).toBe(4655.66); // convention anglo-saxonne
  });

  it("renvoie 0 sur une saisie vide — d'où la garde ailleurs contre le faux « prix à zéro »", () => {
    expect(parsePriceInput("")).toBe(0);
  });

  it("gère un entier sans séparateur", () => {
    expect(parsePriceInput("53409")).toBe(53409);
  });
});

describe("formatCurrency", () => {
  it("conserve les centimes", () => {
    expect(formatCurrency(543.83)).toBe("$543.83");
  });

  it("place le signe avant le symbole pour un montant négatif", () => {
    expect(formatCurrency(-52)).toBe("-$52.00");
  });

  it("n'affiche pas « -$0.00 » pour un zéro négatif", () => {
    expect(formatCurrency(-0.001)).toBe("$0.00");
  });

  it("groupe les milliers", () => {
    expect(formatCurrency(10126.5)).toBe("$10,126.50");
  });
});

describe("formatDuration", () => {
  it("reste en minutes sous une heure", () => {
    expect(formatDuration(45)).toBe("45 min");
  });

  it("passe en heures et minutes au-delà", () => {
    expect(formatDuration(135)).toBe("2h15");
    expect(formatDuration(120)).toBe("2h");
  });

  it("passe en jours au-delà de 24 h", () => {
    expect(formatDuration(4560)).toBe("3j 4h");
  });

  it("complète les minutes sur deux chiffres", () => {
    expect(formatDuration(65)).toBe("1h05");
  });
});
