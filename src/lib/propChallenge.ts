/**
 * Moteur du simulateur de challenge Prop Firm : marché simulé (random walk),
 * exécution d'ordres avec SL/TP, et évaluation continue des règles de
 * drawdown/objectif. Aucune vraie donnée de marché — "marché simulé", comme
 * annoncé à l'écran, uniquement pour l'entraînement à la gestion du risque.
 *
 * État persisté en localStorage (pas de synchronisation serveur) : un
 * challenge est une session de pratique jetable, pas une donnée métier.
 */

export type AssetSymbol = "XAUUSD" | "EURUSD" | "GBPUSD" | "NAS100";

export interface AssetConfig {
  symbol: AssetSymbol;
  label: string;
  basePrice: number;
  /** Taille d'un "pip" en unité de prix, pour cet actif. */
  pipSize: number;
  /** Valeur en $ d'un pip, pour 1.0 lot. */
  pipValuePerLot: number;
  /** Amplitude typique de mouvement par bougie, en pips. */
  volatilityPips: number;
  decimals: number;
}

export const PROP_SIM_ASSETS: Record<AssetSymbol, AssetConfig> = {
  XAUUSD: {
    symbol: "XAUUSD",
    label: "Gold / US Dollar",
    basePrice: 2350,
    pipSize: 0.1,
    pipValuePerLot: 10,
    volatilityPips: 22,
    decimals: 2,
  },
  EURUSD: {
    symbol: "EURUSD",
    label: "Euro / US Dollar",
    basePrice: 1.0865,
    pipSize: 0.0001,
    pipValuePerLot: 10,
    volatilityPips: 9,
    decimals: 4,
  },
  GBPUSD: {
    symbol: "GBPUSD",
    label: "British Pound / US Dollar",
    basePrice: 1.271,
    pipSize: 0.0001,
    pipValuePerLot: 10,
    volatilityPips: 10,
    decimals: 4,
  },
  NAS100: {
    symbol: "NAS100",
    label: "NASDAQ 100 Index",
    basePrice: 18650,
    pipSize: 1,
    pipValuePerLot: 10,
    volatilityPips: 24,
    decimals: 1,
  },
};

export const ASSET_LIST: AssetSymbol[] = ["XAUUSD", "EURUSD", "GBPUSD", "NAS100"];

export interface ChallengeRules {
  dailyLossPercent: number;
  totalDrawdownPercent: number;
  phase1TargetPercent: number;
  phase2TargetPercent: number;
  minTradingDays: number;
  maxRiskPerTradePercent: number;
  /** Si vrai, le drawdown total se mesure depuis le plus haut de l'équité (trailing), sinon depuis le capital initial. */
  trailingDrawdown: boolean;
  /** "Règle de rendement" : le meilleur trade ne peut pas dépasser cette part des profits bruts. */
  consistencyRuleEnabled: boolean;
  consistencyRuleMaxSharePercent: number;
  newsTradingAllowed: boolean;
}

export interface ChallengePreset {
  name: string;
  rules: ChallengeRules;
}

/** Repris des 4 presets de l'ancien outil "Prop Firm Rules" (modale retirée), adaptés au format 2 phases. */
export const CHALLENGE_PRESETS: ChallengePreset[] = [
  {
    name: "FTMO Standard",
    rules: {
      dailyLossPercent: 5,
      totalDrawdownPercent: 10,
      phase1TargetPercent: 10,
      phase2TargetPercent: 5,
      minTradingDays: 4,
      maxRiskPerTradePercent: 2,
      trailingDrawdown: false,
      consistencyRuleEnabled: true,
      consistencyRuleMaxSharePercent: 45,
      newsTradingAllowed: true,
    },
  },
  {
    name: "FundedNext Stellar",
    rules: {
      dailyLossPercent: 5,
      totalDrawdownPercent: 10,
      phase1TargetPercent: 8,
      phase2TargetPercent: 5,
      minTradingDays: 5,
      maxRiskPerTradePercent: 2,
      trailingDrawdown: false,
      consistencyRuleEnabled: true,
      consistencyRuleMaxSharePercent: 40,
      newsTradingAllowed: true,
    },
  },
  {
    name: "Alpha Capital",
    rules: {
      dailyLossPercent: 4,
      totalDrawdownPercent: 8,
      phase1TargetPercent: 8,
      phase2TargetPercent: 5,
      minTradingDays: 0,
      maxRiskPerTradePercent: 1.5,
      trailingDrawdown: true,
      consistencyRuleEnabled: false,
      consistencyRuleMaxSharePercent: 40,
      newsTradingAllowed: false,
    },
  },
  {
    name: "Horizon Compte Réel",
    rules: {
      dailyLossPercent: 3,
      totalDrawdownPercent: 6,
      phase1TargetPercent: 15,
      phase2TargetPercent: 0,
      minTradingDays: 0,
      maxRiskPerTradePercent: 1,
      trailingDrawdown: false,
      consistencyRuleEnabled: false,
      consistencyRuleMaxSharePercent: 100,
      newsTradingAllowed: true,
    },
  },
];

export const CAPITAL_PRESETS = [10000, 25000, 50000, 100000, 200000];

export interface Candle {
  index: number;
  timestampMs: number;
  open: number;
  high: number;
  low: number;
  close: number;
}

export type OrderDirection = "BUY" | "SELL";

export interface OpenPosition {
  id: string;
  direction: OrderDirection;
  lots: number;
  entryPrice: number;
  sl: number | null;
  tp: number | null;
  openedAtCandleIndex: number;
}

export type CloseReason = "SL" | "TP" | "MANUAL" | "FIN_CHALLENGE";

export interface ClosedTrade extends OpenPosition {
  exitPrice: number;
  closedAtCandleIndex: number;
  pnl: number;
  reason: CloseReason;
}

export type ChallengeStatus = "EN_COURS" | "REUSSI" | "ECHOUE";
export type ChallengePhase = 1 | 2;

export interface ChallengeConfig {
  asset: AssetSymbol;
  initialCapital: number;
  rules: ChallengeRules;
}

export interface ChallengeState {
  config: ChallengeConfig;
  phase: ChallengePhase;
  status: ChallengeStatus;
  failureReason: string | null;
  /** Objectif atteint mais règle de régularité (45%) non respectée : bloque la validation sans faire échouer. */
  consistencyWarning: boolean;
  candles: Candle[];
  balance: number;
  openPosition: OpenPosition | null;
  closedTrades: ClosedTrade[];
  dayIndex: number;
  dayStartBalance: number;
  peakEquity: number;
  candlesElapsedToday: number;
}

const CANDLES_PER_DAY = 26;
const SIM_START_MS = Date.UTC(2026, 7, 1, 8, 0, 0);
const STORAGE_KEY = "horizon_propchallenge_state_v1";

let positionCounter = 0;
function nextPositionId(): string {
  positionCounter += 1;
  return `pos-${Date.now()}-${positionCounter}`;
}

export function generateNextCandle(prevClose: number, index: number, asset: AssetConfig): Candle {
  const stepCount = 6;
  const stepSize = (asset.volatilityPips * asset.pipSize) / Math.sqrt(stepCount);
  let price = prevClose;
  let high = prevClose;
  let low = prevClose;
  for (let i = 0; i < stepCount; i++) {
    const move = (Math.random() - 0.5) * 2 * stepSize;
    price = Math.max(asset.pipSize, price + move);
    if (price > high) high = price;
    if (price < low) low = price;
  }
  return {
    index,
    timestampMs: SIM_START_MS + index * 60_000,
    open: prevClose,
    high,
    low,
    close: price,
  };
}

export function createChallengeState(config: ChallengeConfig): ChallengeState {
  const asset = PROP_SIM_ASSETS[config.asset];
  const firstCandle: Candle = {
    index: 0,
    timestampMs: SIM_START_MS,
    open: asset.basePrice,
    high: asset.basePrice,
    low: asset.basePrice,
    close: asset.basePrice,
  };
  return {
    config,
    phase: 1,
    status: "EN_COURS",
    failureReason: null,
    consistencyWarning: false,
    candles: [firstCandle],
    balance: config.initialCapital,
    openPosition: null,
    closedTrades: [],
    dayIndex: 1,
    dayStartBalance: config.initialCapital,
    peakEquity: config.initialCapital,
    candlesElapsedToday: 0,
  };
}

export function currentPrice(state: ChallengeState): number {
  return state.candles[state.candles.length - 1].close;
}

export function floatingPnl(state: ChallengeState): number {
  if (!state.openPosition) return 0;
  return computePositionPnl(state.openPosition, currentPrice(state), PROP_SIM_ASSETS[state.config.asset]);
}

export function computeEquity(state: ChallengeState): number {
  return state.balance + floatingPnl(state);
}

function computePositionPnl(position: OpenPosition, exitPrice: number, asset: AssetConfig): number {
  const priceDelta = position.direction === "BUY" ? exitPrice - position.entryPrice : position.entryPrice - exitPrice;
  const pips = priceDelta / asset.pipSize;
  return pips * asset.pipValuePerLot * position.lots;
}

export function pipsToPriceDelta(pips: number, asset: AssetConfig): number {
  return pips * asset.pipSize;
}

export function potentialPnlForPips(pips: number, lots: number, asset: AssetConfig): number {
  return pips * asset.pipValuePerLot * lots;
}

/**
 * Prix absolus de SL/TP pour un ordre pas encore ouvert (aperçu) ou à
 * l'ouverture réelle — même formule dans les deux cas, pour ne jamais
 * diverger entre ce que l'aperçu montre et ce qui s'exécute vraiment.
 * `null` quand la distance en pips est nulle ou négative (pas de niveau).
 */
export function computeSlTpPrices(
  price: number,
  direction: OrderDirection,
  slPips: number,
  tpPips: number,
  asset: AssetConfig
): { sl: number | null; tp: number | null } {
  const slDelta = pipsToPriceDelta(slPips, asset);
  const tpDelta = pipsToPriceDelta(tpPips, asset);
  const sl = slPips > 0 ? (direction === "BUY" ? price - slDelta : price + slDelta) : null;
  const tp = tpPips > 0 ? (direction === "BUY" ? price + tpDelta : price - tpDelta) : null;
  return { sl, tp };
}

/**
 * Inverse de `computeSlTpPrices` : convertit un prix (déplacé à la souris
 * sur le graphique) en distance de pips par rapport au prix de référence,
 * pour le côté SL ou TP. Toujours positif ou nul — glisser un niveau du
 * mauvais côté du prix le ramène à 0 plutôt que de produire une distance
 * négative dénuée de sens.
 */
export function pipsFromDraggedPrice(
  referencePrice: number,
  direction: OrderDirection,
  side: "SL" | "TP",
  draggedPrice: number,
  asset: AssetConfig
): number {
  const isAboveReference = draggedPrice >= referencePrice;
  // SL d'un BUY et TP d'un SELL sont sous le prix ; TP d'un BUY et SL d'un
  // SELL sont au-dessus — un glissé du mauvais côté est ignoré (borné à 0).
  const expectedAbove = (side === "TP") === (direction === "BUY");
  if (isAboveReference !== expectedAbove) return 0;
  const priceDelta = Math.abs(draggedPrice - referencePrice);
  return Math.round(priceDelta / asset.pipSize);
}

/** Modifie le SL/TP d'une position déjà ouverte (glissé sur le graphique). */
export function updateOpenPositionStops(
  state: ChallengeState,
  sl: number | null,
  tp: number | null
): ChallengeState {
  if (!state.openPosition || state.status !== "EN_COURS") return state;
  return { ...state, openPosition: { ...state.openPosition, sl, tp } };
}

export function targetPercentForPhase(state: ChallengeState): number {
  return state.phase === 1 ? state.config.rules.phase1TargetPercent : state.config.rules.phase2TargetPercent;
}

export function openPosition(
  state: ChallengeState,
  direction: OrderDirection,
  lots: number,
  slPips: number,
  tpPips: number
): ChallengeState {
  if (state.openPosition || state.status !== "EN_COURS") return state;
  const asset = PROP_SIM_ASSETS[state.config.asset];
  const price = currentPrice(state);
  const { sl, tp } = computeSlTpPrices(price, direction, slPips, tpPips, asset);

  const position: OpenPosition = {
    id: nextPositionId(),
    direction,
    lots,
    entryPrice: price,
    sl,
    tp,
    openedAtCandleIndex: state.candles[state.candles.length - 1].index,
  };

  return { ...state, openPosition: position };
}

function closeOpenPosition(state: ChallengeState, exitPrice: number, reason: CloseReason): ChallengeState {
  if (!state.openPosition) return state;
  const asset = PROP_SIM_ASSETS[state.config.asset];
  const pnl = computePositionPnl(state.openPosition, exitPrice, asset);
  const closed: ClosedTrade = {
    ...state.openPosition,
    exitPrice,
    closedAtCandleIndex: state.candles[state.candles.length - 1].index,
    pnl,
    reason,
  };
  return {
    ...state,
    balance: state.balance + pnl,
    openPosition: null,
    closedTrades: [closed, ...state.closedTrades],
  };
}

export function closePositionManually(state: ChallengeState): ChallengeState {
  if (!state.openPosition) return state;
  return evaluateAfterTick(closeOpenPosition(state, currentPrice(state), "MANUAL"));
}

/** Vérifie si le prix de la dernière bougie a touché SL ou TP de la position ouverte, la clôture si c'est le cas. */
function checkStopsAgainstCandle(state: ChallengeState, candle: Candle): ChallengeState {
  const position = state.openPosition;
  if (!position) return state;

  if (position.direction === "BUY") {
    if (position.sl !== null && candle.low <= position.sl) {
      return closeOpenPosition(state, position.sl, "SL");
    }
    if (position.tp !== null && candle.high >= position.tp) {
      return closeOpenPosition(state, position.tp, "TP");
    }
  } else {
    if (position.sl !== null && candle.high >= position.sl) {
      return closeOpenPosition(state, position.sl, "SL");
    }
    if (position.tp !== null && candle.low <= position.tp) {
      return closeOpenPosition(state, position.tp, "TP");
    }
  }
  return state;
}

function evaluateAfterTick(state: ChallengeState): ChallengeState {
  if (state.status !== "EN_COURS") return state;

  const equity = computeEquity(state);
  const { rules, initialCapital } = state.config;
  const peakEquity = Math.max(state.peakEquity, equity);
  let next: ChallengeState = { ...state, peakEquity };

  const dailyLossAmount = state.dayStartBalance - equity;
  const dailyLossLimit = initialCapital * (rules.dailyLossPercent / 100);
  if (dailyLossAmount >= dailyLossLimit) {
    return {
      ...next,
      status: "ECHOUE",
      failureReason: `Perte journalière max dépassée (limite ${rules.dailyLossPercent}%).`,
    };
  }

  const ddReference = rules.trailingDrawdown ? peakEquity : initialCapital;
  const totalDDAmount = ddReference - equity;
  const totalDDLimit = initialCapital * (rules.totalDrawdownPercent / 100);
  if (totalDDAmount >= totalDDLimit) {
    return {
      ...next,
      status: "ECHOUE",
      failureReason: `Drawdown total max dépassé (limite ${rules.totalDrawdownPercent}%).`,
    };
  }

  // L'objectif ne se valide que position fermée : équité == solde réalisé à cet instant.
  if (!next.openPosition) {
    const targetPercent = targetPercentForPhase(next);
    const targetAmount = initialCapital * (targetPercent / 100);
    const netProfit = equity - initialCapital;
    const daysOk = next.dayIndex - 1 >= rules.minTradingDays;

    if (targetAmount > 0 && netProfit >= targetAmount && daysOk) {
      const grossProfit = next.closedTrades.filter((t) => t.pnl > 0).reduce((s, t) => s + t.pnl, 0);
      const bestTrade = next.closedTrades.reduce((max, t) => Math.max(max, t.pnl), 0);
      const consistencyBroken =
        rules.consistencyRuleEnabled &&
        grossProfit > 0 &&
        bestTrade / grossProfit > rules.consistencyRuleMaxSharePercent / 100;

      if (consistencyBroken) {
        next = { ...next, consistencyWarning: true };
      } else if (next.phase === 1 && rules.phase2TargetPercent > 0) {
        next = {
          ...next,
          phase: 2,
          consistencyWarning: false,
          balance: equity,
          dayStartBalance: equity,
          peakEquity: equity,
          closedTrades: [],
        };
      } else {
        return { ...next, status: "REUSSI", consistencyWarning: false };
      }
    } else {
      next = { ...next, consistencyWarning: false };
    }
  }

  return next;
}

export function advanceTick(state: ChallengeState): ChallengeState {
  if (state.status !== "EN_COURS") return state;
  const asset = PROP_SIM_ASSETS[state.config.asset];
  const lastCandle = state.candles[state.candles.length - 1];
  const newCandle = generateNextCandle(lastCandle.close, lastCandle.index + 1, asset);

  // Fenêtre glissante : garder au plus 180 bougies en mémoire, largement assez pour l'affichage.
  const candles = [...state.candles, newCandle].slice(-180);

  let next: ChallengeState = { ...state, candles, candlesElapsedToday: state.candlesElapsedToday + 1 };
  next = checkStopsAgainstCandle(next, newCandle);
  next = evaluateAfterTick(next);

  if (next.status === "EN_COURS" && next.candlesElapsedToday >= CANDLES_PER_DAY) {
    const equity = computeEquity(next);
    next = {
      ...next,
      dayIndex: next.dayIndex + 1,
      dayStartBalance: equity,
      candlesElapsedToday: 0,
    };
  }

  return next;
}

export function advanceDay(state: ChallengeState): ChallengeState {
  let next = state;
  const remaining = CANDLES_PER_DAY - (state.candlesElapsedToday % CANDLES_PER_DAY || CANDLES_PER_DAY);
  const steps = remaining <= 0 ? CANDLES_PER_DAY : remaining;
  for (let i = 0; i < steps; i++) {
    if (next.status !== "EN_COURS") break;
    next = advanceTick(next);
  }
  return next;
}

export function loadPersistedChallenge(): ChallengeState | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as ChallengeState;
  } catch {
    return null;
  }
}

export function persistChallenge(state: ChallengeState | null): void {
  try {
    if (state === null) {
      localStorage.removeItem(STORAGE_KEY);
    } else {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    }
  } catch {
    // Stockage indisponible (navigation privée, quota) : dégrade sans bloquer.
  }
}

export function formatSimTimestamp(timestampMs: number): string {
  const d = new Date(timestampMs);
  const months = ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."];
  const day = String(d.getUTCDate()).padStart(2, "0");
  const month = months[d.getUTCMonth()];
  const hh = String(d.getUTCHours()).padStart(2, "0");
  const mm = String(d.getUTCMinutes()).padStart(2, "0");
  return `${day} ${month} · ${hh}:${mm} UTC`;
}
