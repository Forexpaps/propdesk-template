import { Trade } from "../types";

/**
 * Tri et fenêtrage temporel du Journal — logique pure, sans React ni état.
 *
 * Vit ici et non dans `performanceStats.ts` : trier un tableau ou borner une
 * période n'est pas une statistique. Et pas non plus dans `TradingJournal.tsx`,
 * déjà très long, où ces ~60 lignes n'auraient rien à voir avec du rendu.
 */

/** Fenêtre calendaire proposée par le filtre de période. */
export type PeriodPreset = "all" | "month" | "quarter" | "year";

/** Colonnes triables du registre. */
export type SortKey = "date" | "pnl" | "rr";

export interface SortState {
  key: SortKey;
  dir: "asc" | "desc";
}

/**
 * Début de la fenêtre calendaire en cours, ou `null` pour « Tout ».
 *
 * Fenêtres **calendaires** (1er du mois / du trimestre / de l'année), jamais
 * glissantes sur N jours : c'est la convention déjà retenue par
 * `computePnlByPeriod`, pour qu'un « Ce mois » du Journal et un « Mois » de
 * Rentabilité désignent exactement la même chose.
 *
 * Dates construites en heure **locale** (et non UTC) : on les compare à un
 * « aujourd'hui » vécu par l'utilisateur, pas à un instant absolu. C'est
 * l'inverse du choix fait pour les durées de trade (`tradeDurationMinutes`),
 * qui mesure un écart entre deux instants — les deux conventions coexistent
 * volontairement.
 */
export function periodStart(preset: PeriodPreset, reference: Date = new Date()): Date | null {
  if (preset === "all") return null;
  const annee = reference.getFullYear();
  if (preset === "year") return new Date(annee, 0, 1);
  if (preset === "quarter") return new Date(annee, Math.floor(reference.getMonth() / 3) * 3, 1);
  return new Date(annee, reference.getMonth(), 1);
}

/**
 * Trie une copie du tableau selon la colonne demandée.
 *
 * `sort === null` renvoie le tableau tel quel : c'est l'ordre naturel de la
 * collection (les trades les plus récemment SAISIS en tête, App.tsx insère en
 * tête), qui n'est pas un tri par date et qu'on doit pouvoir retrouver.
 *
 * `Array.prototype.sort` est stable depuis ES2019 : à clé égale, cet ordre
 * naturel est conservé, aucun tri secondaire n'est donc nécessaire.
 */
export function sortTrades(trades: Trade[], sort: SortState | null): Trade[] {
  if (!sort) return trades;
  const sens = sort.dir === "asc" ? 1 : -1;

  // Copie explicite : `sort()` trie en place, et le tableau reçu peut être
  // celui d'un appelant qui ne s'attend pas à le voir réordonné.
  return [...trades].sort((a, b) => {
    switch (sort.key) {
      case "date": {
        // Comparaison de chaînes : un horodatage "YYYY-MM-DDTHH:MM" s'ordonne
        // lexicographiquement exactement comme chronologiquement — aucun objet
        // Date à allouer, aucun fuseau horaire à considérer.
        //
        // `time` est optionnel : les trades sans heure retombent sur "00:00",
        // donc à date égale ils remontent en premier en tri ascendant.
        const ka = `${a.date}T${a.time ?? "00:00"}`;
        const kb = `${b.date}T${b.time ?? "00:00"}`;
        return ka < kb ? -sens : ka > kb ? sens : 0;
      }
      case "pnl":
        // Valeur brute, malgré les unités mixtes ($ et %) que `pnlUnit`
        // autorise. La colonne PnL affiche déjà les deux mélangées : ce tri
        // est exactement aussi imprécis que ce qu'elle montre, ni plus ni
        // moins. Convertir supposerait un taux de change entre un % et des
        // dollars, qui n'existe pas.
        return (a.pnl - b.pnl) * sens;
      case "rr":
        return (a.riskRewardRatio - b.riskRewardRatio) * sens;
    }
  });
}
