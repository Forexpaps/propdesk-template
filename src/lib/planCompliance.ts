import { AppNotification, Trade, TradingPlan, TradingPlanData } from "../types";
import { FOREX_SESSIONS, isSessionActive } from "../components/TopHeader";

const BASE_STORAGE_KEY = "horizon_trading_plan";

/** Un plan vierge, prêt pour le formulaire — `id` généré, jamais réutilisé. */
export function createEmptyPlan(name = "Nouveau plan"): TradingPlan {
  return {
    id: `plan-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    name,
    authorizedSessions: [],
    tradingHours: "",
    trackedAssets: "",
    authorizedSetups: "",
    riskPerTradePercent: "",
    maxTradesPerDay: "",
    maxDailyLossPercent: "",
    entryConditions: "",
    stopConditions: "",
    goldenRules: "",
  };
}

export const EMPTY_TRADING_PLANS: TradingPlanData = [];

/**
 * Même motif que `MindsetJournalModal.tsx` (`storageKey` prop) : côté
 * élève, namespacé par email pour qu'un poste partagé ne compare jamais les
 * trades d'un élève au plan d'un autre. Côté staff, clé partagée (bureau
 * commun), comme avant.
 */
export function getTradingPlanStorageKey(storageKey?: string): string {
  return storageKey ? `${BASE_STORAGE_KEY}_${storageKey}` : BASE_STORAGE_KEY;
}

/**
 * Convertit une valeur de plan brute (venue de `localStorage` ou du serveur)
 * en tableau de `TradingPlan` — quelle que soit sa forme d'origine :
 * - déjà un tableau : renvoyé tel quel, avec des defaults défensifs par
 *   entrée au cas où un champ manquerait (donnée partiellement corrompue) ;
 * - ancien objet unique (forme d'avant le multi-plan, sans `id`/`name`) :
 *   enveloppé dans un tableau à une entrée, pour ne perdre aucune donnée déjà
 *   enregistrée ;
 * - absent/invalide : tableau vide.
 *
 * À utiliser partout où une valeur de plan stockée est lue avant usage —
 * jamais directement `JSON.parse` ni la valeur brute du serveur.
 */
export function normalizeTradingPlans(raw: unknown): TradingPlan[] {
  if (Array.isArray(raw)) {
    return raw
      .filter((entry): entry is Record<string, unknown> => typeof entry === "object" && entry !== null)
      .map((entry) => ({ ...createEmptyPlan(), ...entry }) as TradingPlan);
  }
  if (typeof raw === "object" && raw !== null) {
    return [{ ...createEmptyPlan("Mon plan"), ...(raw as Record<string, unknown>), id: "legacy" } as TradingPlan];
  }
  return [];
}

/** Tableau vide si l'utilisateur n'a jamais enregistré de plan. */
export function loadTradingPlan(storageKey?: string): TradingPlanData {
  try {
    const saved = localStorage.getItem(getTradingPlanStorageKey(storageKey));
    return saved ? normalizeTradingPlans(JSON.parse(saved)) : [];
  } catch {
    return [];
  }
}

/** Le plan ("Asie") et `FOREX_SESSIONS` ("Tokyo") ne partagent pas le même libellé pour la session asiatique. */
const PLAN_SESSION_TO_FOREX_SESSION: Record<string, string> = {
  Asie: "Tokyo",
  Londres: "Londres",
  "New York": "New York",
};

function matchesAny(haystack: string, needle: string): boolean {
  return haystack
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean)
    .some((entry) => needle.toLowerCase().includes(entry) || entry.includes(needle.toLowerCase()));
}

/**
 * Raisons de non-respect du plan pour CE trade, ou `[]` s'il est conforme.
 * Chaque règle ne s'applique que si le champ correspondant du plan est
 * renseigné — un plan incomplet n'impose aucune contrainte sur ses champs
 * vides.
 *
 * `sameDayTrades` doit inclure ce trade lui-même (même date, l'appelant est
 * responsable du filtrage — voir les deux `handleAddTrade`/`handleUpdateTrade`
 * dans `App.tsx`).
 */
export function checkPlanViolations(
  trade: Trade,
  sameDayTrades: Trade[],
  plan: TradingPlan,
  startingCapital: number
): string[] {
  const reasons: string[] = [];

  if (plan.trackedAssets.trim() && !matchesAny(plan.trackedAssets, trade.pair)) {
    reasons.push(`actif hors plan (${trade.pair})`);
  }

  if (plan.authorizedSetups.trim() && trade.strategy.trim() && !matchesAny(plan.authorizedSetups, trade.strategy)) {
    reasons.push(`setup non autorisé (${trade.strategy})`);
  }

  if (plan.authorizedSessions.length > 0 && trade.time) {
    const instant = new Date(`${trade.date}T${trade.time}`);
    if (!Number.isNaN(instant.getTime())) {
      const hourUTC = instant.getUTCHours();
      const activeSessions = FOREX_SESSIONS.filter((s) => isSessionActive(s, hourUTC)).map((s) => s.name);
      const authorizedForexSessions = plan.authorizedSessions.map(
        (s) => PLAN_SESSION_TO_FOREX_SESSION[s] ?? s
      );
      const withinPlan = activeSessions.some((s) => authorizedForexSessions.includes(s));
      if (!withinPlan) {
        reasons.push("session non autorisée");
      }
    }
  }

  const maxTradesPerDay = Number(plan.maxTradesPerDay);
  if (plan.maxTradesPerDay.trim() && Number.isFinite(maxTradesPerDay) && maxTradesPerDay > 0) {
    if (sameDayTrades.length > maxTradesPerDay) {
      reasons.push(`limite de ${maxTradesPerDay} trade${maxTradesPerDay > 1 ? "s" : ""}/jour dépassée`);
    }
  }

  const maxDailyLossPercent = Number(plan.maxDailyLossPercent);
  if (plan.maxDailyLossPercent.trim() && Number.isFinite(maxDailyLossPercent) && maxDailyLossPercent > 0 && startingCapital > 0) {
    const dailyLoss = sameDayTrades
      .filter((t) => (t.pnlUnit ?? "USD") !== "PERCENT" && t.pnl < 0)
      .reduce((acc, t) => acc + t.pnl, 0);
    const dailyLossPercent = (Math.abs(dailyLoss) / startingCapital) * 100;
    if (dailyLossPercent > maxDailyLossPercent) {
      reasons.push(`perte quotidienne max dépassée (${dailyLossPercent.toFixed(1)}%)`);
    }
  }

  if (trade.mistakes?.includes("Pas de plan de trade")) {
    reasons.push("trade auto-déclaré sans plan");
  }

  if (plan.riskPerTradePercent.trim() && trade.mistakes?.includes("Sur-risque (>1%)")) {
    reasons.push("risque auto-déclaré au-delà du plan");
  }

  return reasons;
}

/** Id déterministe (un seul upsert par trade, jamais de doublon en cas de ré-édition). */
export function planAlertId(tradeId: string): string {
  return `plan-alert-${tradeId}`;
}

/**
 * Construit la notification pour un trade en infraction. `reasons` doit être
 * non vide (l'appelant retire déjà la notification quand ça ne l'est pas —
 * voir `upsertPlanAlert`).
 */
export function buildPlanAlertNotification(trade: Trade, reasons: string[]): AppNotification {
  return {
    id: planAlertId(trade.id),
    title: "⚠️ Non-respect du plan de trading",
    message: `${trade.pair} (${trade.date}) : ${reasons.join(" ; ")}.`,
    time: "À l'instant",
    type: "risk",
    read: false,
    targetTab: "journal",
  };
}

/**
 * Upsert idempotent : ajoute/remplace la notification déterministe de ce
 * trade si `reasons` est non vide, la retire sinon (un trade corrigé après
 * coup ne doit pas laisser une alerte périmée traîner, même "lue").
 */
export function upsertPlanAlert(
  notifications: AppNotification[],
  trade: Trade,
  reasons: string[]
): AppNotification[] {
  const withoutExisting = notifications.filter((n) => n.id !== planAlertId(trade.id));
  if (reasons.length === 0) return withoutExisting;
  return [buildPlanAlertNotification(trade, reasons), ...withoutExisting];
}
