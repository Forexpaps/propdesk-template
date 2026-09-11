import { MarketCategory } from "../types";

/**
 * Catalogue des actifs les plus courants, pour la sélection rapide du champ
 * "Paire / Actif" du Journal (`TradingJournal.tsx`) — sélectionner une
 * entrée renseigne automatiquement sa catégorie de marché, pas besoin de le
 * faire à la main. N'importe quel autre actif reste saisissable librement
 * (voir `usePersistentState("horizon_custom_assets", ...)` dans
 * `TradingJournal.tsx`) : ce catalogue n'est qu'un point de départ, pas une
 * liste fermée.
 */
export const ASSET_CATALOG: { symbol: string; category: MarketCategory }[] = [
  { symbol: "EURUSD", category: "Forex" },
  { symbol: "GBPUSD", category: "Forex" },
  { symbol: "USDJPY", category: "Forex" },
  { symbol: "AUDUSD", category: "Forex" },
  { symbol: "USDCAD", category: "Forex" },
  { symbol: "USDCHF", category: "Forex" },
  { symbol: "NZDUSD", category: "Forex" },
  { symbol: "SP500", category: "Indices" },
  { symbol: "NAS100", category: "Indices" },
  { symbol: "US30", category: "Indices" },
  { symbol: "XAUUSD", category: "Matières Premières" },
  { symbol: "BTCUSD", category: "Crypto" },
  { symbol: "ETHUSD", category: "Crypto" },
  { symbol: "SOLUSD", category: "Crypto" },
  { symbol: "XRPUSD", category: "Crypto" },
  { symbol: "BNBUSD", category: "Crypto" },
  { symbol: "DOGEUSD", category: "Crypto" },
];

/** Catégorie du catalogue pour un symbole (comparaison insensible à la casse) — `undefined` si absent, laisse alors la catégorie déjà choisie inchangée. */
export function categoryForAsset(symbol: string): MarketCategory | undefined {
  const normalized = symbol.trim().toUpperCase();
  return ASSET_CATALOG.find((a) => a.symbol === normalized)?.category;
}
