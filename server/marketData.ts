/**
 * Prix de marché en direct — proxy et cache autour du flux non officiel de
 * Yahoo Finance (`query1.finance.yahoo.com/v8/finance/chart`), sans clé API,
 * comme `economicCalendar.ts` pour le flux ForexFactory.
 *
 * Ce flux n'est pas documenté officiellement par Yahoo et peut cesser de
 * fonctionner sans préavis — c'est un compromis assumé pour rester à coût
 * nul. Une panne de ce flux ne doit jamais faire planter le tableau de bord :
 * voir la dégradation gracieuse dans `getMarketData()`.
 */

const CACHE_TTL_MS = 60 * 1000;
const FETCH_TIMEOUT_MS = 8_000;

export interface MarketQuote {
  symbol: string;
  label: string;
  price: number;
  previousClose: number;
  changePercent: number;
  /** Cours de clôture des derniers points, pour un mini-graphique. */
  sparkline: number[];
}

/**
 * Symboles Yahoo Finance affichés dans le tableau de bord Macro, avec leur
 * libellé français. `scale`, quand présent, est le **diviseur** appliqué au
 * prix brut renvoyé par Yahoo avant affichage (voir `fetchQuote`) — absent
 * équivaut à 1 (aucune correction).
 *
 * `^TNX` (rendement du 10 ans US) est le seul symbole concerné : Yahoo le
 * renvoie multiplié par 10 (convention CBOE, ex. 46.3 pour un vrai rendement
 * de 4.63 %). Champ déclaré une première fois avec `scale: 1` (un facteur
 * neutre, donc sans effet) sans jamais être lu dans `fetchQuote` — le taux
 * s'affichait alors avec une erreur d'un facteur 10 (« 46.3 » au lieu de
 * « 4.63 »), et le commentaire d'alors renvoyait vers une fonction
 * `normalize()` qui n'existe nulle part dans ce fichier. Corrigé ici : le
 * diviseur est réellement `10`, et appliqué.
 */
export const MARKET_SYMBOLS: { symbol: string; label: string; scale?: number }[] = [
  { symbol: "DX-Y.NYB", label: "Dollar (DXY)" },
  { symbol: "^TNX", label: "Taux US 10Y", scale: 10 },
  { symbol: "^GSPC", label: "S&P 500" },
  { symbol: "^IXIC", label: "Nasdaq" },
  { symbol: "^VIX", label: "VIX (peur)" },
  { symbol: "GC=F", label: "Or (spot)" },
  { symbol: "SI=F", label: "Argent (spot)" },
  { symbol: "CL=F", label: "Pétrole WTI" },
  { symbol: "EURUSD=X", label: "EUR / USD" },
  { symbol: "BTC-USD", label: "Bitcoin" },
];

let cache: { data: MarketQuote[]; fetchedAt: number } | null = null;
let inflight: Promise<MarketQuote[]> | null = null;

async function fetchQuote(entry: (typeof MARKET_SYMBOLS)[number]): Promise<MarketQuote | null> {
  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(
      entry.symbol
    )}?range=1d&interval=15m`;
    const response = await fetch(url, {
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      headers: { Accept: "application/json", "User-Agent": "Mozilla/5.0" },
    });
    if (!response.ok) return null;

    const body = await response.json();
    const result = body?.chart?.result?.[0];
    const meta = result?.meta;
    if (!meta || typeof meta.regularMarketPrice !== "number") return null;

    const scale = entry.scale ?? 1;
    const rawPreviousClose: number =
      typeof meta.previousClose === "number" ? meta.previousClose : meta.chartPreviousClose;
    const rawPrice: number = meta.regularMarketPrice;
    const price = rawPrice / scale;
    const previousClose = rawPreviousClose / scale;

    const closes: unknown[] = result?.indicators?.quote?.[0]?.close ?? [];
    const sparkline = closes
      .filter((c): c is number => typeof c === "number")
      .map((c) => c / scale);

    return {
      symbol: entry.symbol,
      label: entry.label,
      price,
      previousClose,
      changePercent: previousClose ? ((price - previousClose) / previousClose) * 100 : 0,
      sparkline,
    };
  } catch (err) {
    console.warn(`[market-data] Échec pour ${entry.symbol}.`, err);
    return null;
  }
}

async function fetchAllQuotes(): Promise<MarketQuote[]> {
  const settled = await Promise.all(MARKET_SYMBOLS.map(fetchQuote));
  const quotes = settled.filter((q): q is MarketQuote => q !== null);
  if (quotes.length === 0) {
    throw new Error("Aucun symbole n'a pu être récupéré depuis Yahoo Finance.");
  }
  return quotes;
}

/**
 * Retourne les cotations en cache si fraîches, sinon rafraîchit. En cas
 * d'échec, retourne le dernier cache connu plutôt que de casser l'UI ; ne
 * lève que si aucun cache n'existe encore (juste après un démarrage serveur).
 */
export async function getMarketData(): Promise<MarketQuote[]> {
  const isFresh = cache !== null && Date.now() - cache.fetchedAt < CACHE_TTL_MS;
  if (isFresh) return cache!.data;

  if (inflight) return inflight;

  inflight = fetchAllQuotes()
    .then((data) => {
      cache = { data, fetchedAt: Date.now() };
      return data;
    })
    .catch((err) => {
      console.warn("[market-data] Échec du rafraîchissement.", err);
      if (cache) return cache.data;
      throw err;
    })
    .finally(() => {
      inflight = null;
    });

  return inflight;
}
