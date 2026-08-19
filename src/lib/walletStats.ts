import { Trade, TradingAccount } from "../types";

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
function todayLocalISODate(): string {
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
    .filter(
      (t) => t.accountId === account.id && t.date === today && (t.pnlUnit ?? "USD") !== "PERCENT"
    )
    .reduce((sum, t) => sum + t.pnl, 0);
  return (pnlToday / account.initialBalance) * 100;
}

/** Drawdown total depuis le capital initial, en % — mêmes principes. */
export function totalDrawdownPercent(account: TradingAccount): number {
  if (account.initialBalance <= 0) return 0;
  return ((account.initialBalance - account.equity) / account.initialBalance) * 100;
}

/**
 * Recalcule le solde de chaque compte à partir des trades qui lui sont
 * rattachés : `equity = capital initial + somme des PnL des trades liés`
 * (en dollars uniquement — un trade en % n'est pas une somme d'argent).
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

    const pnl = linkedTrades
      .filter((t) => (t.pnlUnit ?? "USD") !== "PERCENT")
      .reduce((sum, t) => sum + t.pnl, 0);
    const newBalance = acc.initialBalance + pnl;

    if (acc.equity === newBalance && acc.currentBalance === newBalance) return acc;
    changed = true;
    return { ...acc, equity: newBalance, currentBalance: newBalance };
  });
  return changed ? next : accounts;
}
