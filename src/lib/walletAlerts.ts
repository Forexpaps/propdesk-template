import { AppNotification, Trade, TradingAccount } from "../types";
import { dailyLossPercent, daysSinceLastTrade, todayLocalISODate, totalDrawdownPercent } from "./walletStats";

/**
 * Paliers de risque d'un portefeuille — mêmes seuils que le code couleur du
 * badge d'inactivité dans `WalletManagement.tsx` (`inactivityStatus`), pour
 * que l'alerte reçue corresponde exactement à ce qui s'affiche à l'écran.
 */
type RiskTier = "safe" | "warning" | "danger" | "lost";

/**
 * Palier d'inactivité d'un compte. Avec une limite connue
 * (`maxInactivityDays`), calé sur le nombre de jours restants avant la
 * perte du compte ; sans limite connue, sur des seuils génériques.
 */
function inactivityTier(inactivityDays: number | null, maxInactivityDays?: number): RiskTier {
  if (inactivityDays === null) return "safe";
  if (maxInactivityDays !== undefined) {
    const remaining = maxInactivityDays - inactivityDays;
    if (remaining <= 0) return "lost";
    if (remaining <= 3) return "danger";
    if (remaining <= 7) return "warning";
    return "safe";
  }
  if (inactivityDays >= 7) return "danger";
  if (inactivityDays >= 3) return "warning";
  return "safe";
}

/**
 * Palier de drawdown (quotidien ou total) relatif à sa propre limite :
 * alerte à 80% de la limite consommée, critique à 100% ou plus (règle
 * franchie — invalidation prop firm).
 */
function drawdownTier(usedPercent: number, limitPercent: number): Exclude<RiskTier, "lost"> {
  if (limitPercent <= 0) return "safe";
  const ratio = usedPercent / limitPercent;
  if (ratio >= 1) return "danger";
  if (ratio >= 0.8) return "warning";
  return "safe";
}

function inactivityAlertId(accountId: string, tier: RiskTier): string {
  return `wallet-inactivity-${accountId}-${tier}`;
}

function drawdownAlertId(
  kind: "daily" | "total",
  accountId: string,
  tier: Exclude<RiskTier, "lost">,
  day?: string
): string {
  return kind === "daily"
    ? `wallet-daily-dd-${accountId}-${day}-${tier}`
    : `wallet-total-dd-${accountId}-${tier}`;
}

function buildInactivityNotification(
  account: TradingAccount,
  tier: RiskTier,
  inactivityDays: number
): AppNotification {
  const limitSuffix = account.maxInactivityDays ? ` (limite ${account.maxInactivityDays}j)` : "";
  const messages: Record<RiskTier, { title: string; message: string }> = {
    safe: { title: "", message: "" },
    warning: {
      title: "⏱️ Portefeuille inactif",
      message: `${account.name} : ${inactivityDays} jour(s) sans trade journalisé${limitSuffix}. Pense à trader ou à mettre à jour la dernière activité.`,
    },
    danger: {
      title: "⏱️ Inactivité proche de la limite",
      message: `${account.name} : ${inactivityDays} jour(s) d'inactivité${limitSuffix} — la limite approche, risque de perte du compte.`,
    },
    lost: {
      title: "❌ Limite d'inactivité dépassée",
      message: `${account.name} : ${inactivityDays} jour(s) d'inactivité, limite de ${account.maxInactivityDays}j dépassée — ce compte est probablement invalidé chez la prop firm/broker.`,
    },
  };
  const { title, message } = messages[tier];
  return {
    id: inactivityAlertId(account.id, tier),
    title,
    message,
    time: "À l'instant",
    type: "risk",
    read: false,
    targetTab: "wallets",
  };
}

function buildDrawdownNotification(
  account: TradingAccount,
  kind: "daily" | "total",
  tier: Exclude<RiskTier, "lost">,
  usedPercent: number,
  limitPercent: number
): AppNotification {
  const label = kind === "daily" ? "Drawdown quotidien" : "Drawdown total";
  const messages: Record<Exclude<RiskTier, "lost">, { title: string; message: string }> = {
    safe: { title: "", message: "" },
    warning: {
      title: `⚠️ ${label} proche de la limite`,
      message: `${account.name} : ${usedPercent.toFixed(1)}% / ${limitPercent}% max — approche la limite, réduis le risque sur ce compte.`,
    },
    danger: {
      title: `🔴 ${label} : limite atteinte`,
      message: `${account.name} : ${usedPercent.toFixed(1)}% / ${limitPercent}% max — limite atteinte ou dépassée, ce compte risque d'être invalidé.`,
    },
  };
  const { title, message } = messages[tier];
  return {
    id: drawdownAlertId(kind, account.id, tier, kind === "daily" ? todayLocalISODate() : undefined),
    title,
    message,
    time: "À l'instant",
    type: "risk",
    read: false,
    targetTab: "wallets",
  };
}

/**
 * Plafond de sécurité, même principe que `MAX_STUDENT_NOTIFICATIONS` dans
 * `planCompliance.ts` — improbable à atteindre ici (quelques paliers par
 * compte actif), mais évite toute croissance non bornée.
 */
const MAX_WALLET_ALERTS_APPENDED_PER_PASS = 50;

/**
 * Calcule les alertes de risque (inactivité, drawdown quotidien, drawdown
 * total) pour tous les portefeuilles ACTIFS, et les ajoute à `notifications`
 * si elles n'y sont pas déjà — idempotent et à "cliquet" (ratchet) : une
 * alerte déjà déclenchée pour un palier donné n'est jamais recréée ni
 * supprimée automatiquement (même marquée comme lue, elle doit rester dans
 * l'historique), sauf le drawdown quotidien qui se réinitialise chaque jour
 * (id daté) puisque la perte du jour elle-même repart à zéro.
 *
 * Renvoie `notifications` à l'identique (même référence) quand rien de
 * nouveau n'est déclenché, pour ne provoquer ni sauvegarde ni re-rendu
 * inutile (même principe que `syncAccountsWithTrades`).
 */
export function upsertWalletRiskAlerts(
  notifications: AppNotification[],
  accounts: TradingAccount[],
  trades: Trade[]
): AppNotification[] {
  const existingIds = new Set(notifications.map((n) => n.id));
  const toAppend: AppNotification[] = [];

  for (const account of accounts) {
    if (account.status !== "ACTIVE") continue;
    if (toAppend.length >= MAX_WALLET_ALERTS_APPENDED_PER_PASS) break;

    const inactivityDays = daysSinceLastTrade(trades, account.id, account.lastManualActivityDate);
    if (inactivityDays !== null) {
      const tier = inactivityTier(inactivityDays, account.maxInactivityDays);
      if (tier !== "safe") {
        const id = inactivityAlertId(account.id, tier);
        if (!existingIds.has(id)) {
          existingIds.add(id);
          toAppend.push(buildInactivityNotification(account, tier, inactivityDays));
        }
      }
    }

    const dailyUsed = Math.abs(Math.min(0, dailyLossPercent(trades, account)));
    const dailyTier = drawdownTier(dailyUsed, account.maxDailyDrawdownPercent);
    if (dailyTier !== "safe") {
      const id = drawdownAlertId("daily", account.id, dailyTier, todayLocalISODate());
      if (!existingIds.has(id)) {
        existingIds.add(id);
        toAppend.push(buildDrawdownNotification(account, "daily", dailyTier, dailyUsed, account.maxDailyDrawdownPercent));
      }
    }

    const totalUsed = Math.max(0, totalDrawdownPercent(account));
    const totalTier = drawdownTier(totalUsed, account.maxTotalDrawdownPercent);
    if (totalTier !== "safe") {
      const id = drawdownAlertId("total", account.id, totalTier);
      if (!existingIds.has(id)) {
        existingIds.add(id);
        toAppend.push(buildDrawdownNotification(account, "total", totalTier, totalUsed, account.maxTotalDrawdownPercent));
      }
    }
  }

  if (toAppend.length === 0) return notifications;
  return [...toAppend, ...notifications];
}
