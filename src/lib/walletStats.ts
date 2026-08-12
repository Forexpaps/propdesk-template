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
 * Perte du jour sur un compte, en % du capital initial — **calculée**
 * depuis les trades du jour rattachés à ce compte, jamais affichée en dur.
 */
export function dailyLossPercent(trades: Trade[], account: TradingAccount): number {
  if (account.initialBalance <= 0) return 0;
  const today = new Date().toISOString().split("T")[0];
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
