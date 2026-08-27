import { Trade, TradingAccount } from "../types";
import { isRealizedDollarTrade } from "./performanceStats";

/**
 * Calculs purs de portefeuille, extraits de `WalletManagement.tsx` où ils
 * étaient des closures internes fermées sur `trades` — `trades` devient un
 * paramètre explicite, plus facile à tester et à réutiliser ailleurs.
 */

/**
 * Nombre de positions journalisées sur un compte, **calculé** depuis les
 * trades qui lui sont rattachés.
 *
 * Remplace le champ `TradingAccount.tradesCount`, qui reste figé à 0 depuis
 * la création de chaque compte et n'est jamais mis à jour : le champ
 * subsiste dans le type pour ne pas casser les données existantes, mais ne
 * t'y fie pas — c'est ce calcul qui fait foi.
 */
export function positionsDuCompte(trades: Trade[], accountId: string): number {
  return trades.filter((t) => t.accountId === accountId).length;
}

/**
 * Date du jour au format `YYYY-MM-DD`, en heure **locale** — jamais
 * `toISOString().split("T")[0]`, qui donne la date UTC. `Trade.date` est
 * saisi et comparé en heure locale (même principe que `getDayLabel` dans
 * `performanceStats.ts`) : entre minuit et ~1h-2h du matin en France
 * (UTC+1/+2), la date UTC est encore celle de la veille, ce qui aurait fait
 * disparaître du calcul les trades saisis avec la date locale du jour,
 * sous-évaluant `dailyLossPercent` (un indicateur de conformité prop firm)
 * pendant cette fenêtre chaque nuit.
 */
export function todayLocalISODate(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/**
 * Perte du jour sur un compte, en % du capital initial — **calculée**
 * depuis les trades du jour rattachés à ce compte, jamais affichée en dur.
 */
export function dailyLossPercent(trades: Trade[], account: TradingAccount): number {
  if (account.initialBalance <= 0) return 0;
  const today = todayLocalISODate();
  const pnlToday = trades
    .filter((t) => t.accountId === account.id && t.date === today && isRealizedDollarTrade(t))
    .reduce((sum, t) => sum + t.pnl, 0);
  return (pnlToday / account.initialBalance) * 100;
}

/**
 * Convertit une date `YYYY-MM-DD` en `Date` locale à minuit — jamais
 * `new Date("YYYY-MM-DD")`, qui parse en UTC et peut décaler le jour d'un
 * cran selon le fuseau (même piège documenté sur `todayLocalISODate`).
 */
function parseLocalISODate(iso: string): Date {
  const [year, month, day] = iso.split("-").map(Number);
  return new Date(year, month - 1, day);
}

/**
 * Nombre de jours écoulés depuis la dernière activité connue sur un compte
 * (0 = aujourd'hui), ou `null` si aucune date n'est disponible — sert à
 * repérer les portefeuilles inactifs (risque d'échec d'une règle "minimum
 * trading days" prop firm, ou simplement un compte délaissé).
 *
 * Prend la plus récente entre la date du dernier trade journalisé et
 * `lastManualActivityDate` (compte tradé chez le broker sans être
 * journalisé ici) — un compte sans aucun trade rattaché resterait sinon
 * marqué "Aucun trade" en permanence même actif.
 */
export function daysSinceLastTrade(
  trades: Trade[],
  accountId: string,
  lastManualActivityDate?: string
): number | null {
  const dates = trades.filter((t) => t.accountId === accountId).map((t) => t.date);
  if (lastManualActivityDate) dates.push(lastManualActivityDate);
  if (dates.length === 0) return null;
  const lastDate = dates.reduce((latest, d) => (d > latest ? d : latest));
  const msPerDay = 24 * 60 * 60 * 1000;
  const diff = Math.round(
    (parseLocalISODate(todayLocalISODate()).getTime() - parseLocalISODate(lastDate).getTime()) /
      msPerDay
  );
  return Math.max(0, diff);
}

/** Drawdown total depuis le capital initial, en % — mêmes principes. */
export function totalDrawdownPercent(account: TradingAccount): number {
  if (account.initialBalance <= 0) return 0;
  return ((account.initialBalance - account.equity) / account.initialBalance) * 100;
}

/** Somme des PnL réalisés (dollars, clôturés — voir `isRealizedDollarTrade`) des trades rattachés à un compte. Partagé entre `syncAccountsWithTrades` et le calcul de `manualAdjustment` (`WalletManagement.tsx`, « Ajuster le Solde »). */
export function computeRealizedPnl(trades: Trade[], accountId: string): number {
  return trades
    .filter((t) => t.accountId === accountId)
    .filter(isRealizedDollarTrade)
    .reduce((sum, t) => sum + t.pnl, 0);
}

/**
 * Recalcule le solde de chaque compte à partir des trades qui lui sont
 * rattachés : `equity = capital initial + somme des PnL des trades liés +
 * manualAdjustment` (dépôts/retraits/frais absents du journal, voir
 * `TradingAccount.manualAdjustment`).
 *
 * Un compte sans trade rattaché garde son solde tel quel — retirer le
 * dernier trade lié à un compte ne doit pas silencieusement remettre son
 * solde au capital initial si ce compte avait un ajustement manuel
 * antérieur ; seul le PnL des trades *présents* est recalculé, jamais
 * "annulé" par leur absence.
 *
 * Renvoie `accounts` à l'identique (même référence) quand rien ne bouge,
 * pour ne déclencher ni sauvegarde ni re-rendu inutile.
 */
export function syncAccountsWithTrades(
  accounts: TradingAccount[],
  trades: Trade[]
): TradingAccount[] {
  let changed = false;
  const next = accounts.map((acc) => {
    const linkedTrades = trades.filter((t) => t.accountId === acc.id);
    if (linkedTrades.length === 0) return acc;

    const pnl = computeRealizedPnl(trades, acc.id);
    const newBalance = acc.initialBalance + pnl + (acc.manualAdjustment ?? 0);

    if (acc.equity === newBalance && acc.currentBalance === newBalance) return acc;
    changed = true;
    return { ...acc, equity: newBalance, currentBalance: newBalance };
  });
  return changed ? next : accounts;
}
