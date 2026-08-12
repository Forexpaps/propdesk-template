import React, { useState } from "react";
import {
  Wallet,
  ShieldCheck,
  TrendingUp,
  AlertTriangle,
  Plus,
  DollarSign,
  PieChart,
  Award,
  Calendar,
  Layers,
  CheckCircle2,
  XCircle,
  BarChart3,
  ChevronRight,
  Info,
  Building,
  ArrowUpRight,
  ArrowDownRight,
  RefreshCw
} from "lucide-react";
import { TradingAccount, AccountType, Trade } from "../types";
import { formatCurrency } from "../lib/format";
import {
  positionsDuCompte as computePositionsDuCompte,
  dailyLossPercent as computeDailyLossPercent,
  totalDrawdownPercent as computeTotalDrawdownPercent,
} from "../lib/walletStats";

/**
 * Une prop `onSelectAccountForJournal?: (accountId: string) => void` figurait
 * ici : déclarée, déstructurée, jamais appelée. Elle a été retirée, parce que
 * `Trade` n'avait alors aucun `accountId` — le filtrage qu'elle suggérait était
 * une fonctionnalité entière, pas un branchement.
 *
 * Cette fonctionnalité **existe maintenant** : `Trade.accountId` relie un trade
 * à un portefeuille, le journal se filtre par compte, et `positionsDuCompte`
 * ci-dessous compte les positions réelles. Si tu veux rétablir un saut
 * « portefeuille → journal filtré sur ce compte », c'est désormais un vrai
 * branchement : remonter l'`accountId` à `App.tsx`, basculer l'onglet, et
 * pré-positionner le filtre du journal.
 */
interface WalletManagementProps {
  accounts: TradingAccount[];
  /**
   * Journal complet, uniquement pour compter les positions par compte.
   *
   * Ce composant ne modifie jamais un trade : il ne fait que lire le
   * rattachement `Trade.accountId`.
   */
  trades: Trade[];
  onAddAccount: (account: TradingAccount) => void;
  onUpdateAccountBalance: (id: string, newBalance: number) => void;
  /** Masque les actions d'ajout et d'ajustement de solde — vue admin d'un élève. */
  readOnly?: boolean;
}

export const WalletManagement: React.FC<WalletManagementProps> = ({
  accounts,
  trades,
  onAddAccount,
  onUpdateAccountBalance,
  readOnly = false,
}) => {
  const [filterType, setFilterType] = useState<string>("ALL");
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [selectedAccountId, setSelectedAccountId] = useState<string>(
    accounts[0]?.id || ""
  );

  // Form state
  const [newAccName, setNewAccName] = useState("");
  const [newAccFirm, setNewAccFirm] = useState("FTMO Prop Firm");
  const [newAccType, setNewAccType] = useState<AccountType>("Prop Firm Evaluation");
  const [newAccBalance, setNewAccBalance] = useState("100000");
  const [newAccMaxTotalDrawdown, setNewAccMaxTotalDrawdown] = useState("10");
  const [newAccMaxDailyDrawdown, setNewAccMaxDailyDrawdown] = useState("5");
  const [newAccProfitTarget, setNewAccProfitTarget] = useState("10");

  const filteredAccounts = accounts.filter((acc) => {
    if (filterType === "ALL") return true;
    return acc.type === filterType;
  });

  const selectedAccount = accounts.find((a) => a.id === selectedAccountId) || accounts[0];

  const totalCombinedEquity = accounts.reduce((acc, a) => acc + a.equity, 0);

  /**
   * Wrappers courts sur `src/lib/walletStats.ts` (partagé avec l'export PDF) :
   * referment `trades`, déjà disponible dans ce composant, pour garder les
   * mêmes appels `positionsDuCompte(id)` / `dailyLossPercent(account)` /
   * `totalDrawdownPercent(account)` utilisés plus bas.
   *
   * L'equity, elle, reste saisie à la main volontairement : elle intègre des
   * mouvements absents du journal (dépôts, retraits, frais, trades non
   * journalisés) qu'un calcul depuis le PnL écraserait.
   */
  const positionsDuCompte = (accountId: string) => computePositionsDuCompte(trades, accountId);
  const dailyLossPercent = (account: TradingAccount) => computeDailyLossPercent(trades, account);
  const totalDrawdownPercent = (account: TradingAccount) => computeTotalDrawdownPercent(account);
  const totalCombinedInitial = accounts.reduce((acc, a) => acc + a.initialBalance, 0);
  const totalCombinedPnl = totalCombinedEquity - totalCombinedInitial;
  const totalCombinedPnlPercent = totalCombinedInitial > 0 ? ((totalCombinedPnl / totalCombinedInitial) * 100).toFixed(2) : "0.00";

  const handleCreateAccount = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAccName.trim()) return;

    const parsedBalance = parseFloat(newAccBalance);
    // Un capital nul ou négatif casse tous les calculs de pourcentage qui en
    // dépendent (progression vers l'objectif de profit notamment, div/0 ou
    // signe inversé) — on refuse plutôt que de créer un compte inexploitable.
    if (!(parsedBalance > 0)) {
      alert("Le capital initial doit être un nombre supérieur à 0.");
      return;
    }
    const initialBal = parsedBalance;
    const newAcc: TradingAccount = {
      id: `acc-${Date.now()}`,
      name: newAccName,
      firmOrBroker: newAccFirm,
      type: newAccType,
      initialBalance: initialBal,
      currentBalance: initialBal,
      equity: initialBal,
      maxTotalDrawdownPercent: parseFloat(newAccMaxTotalDrawdown) || 10,
      maxDailyDrawdownPercent: parseFloat(newAccMaxDailyDrawdown) || 5,
      profitTargetPercent: parseFloat(newAccProfitTarget) || 10,
      startDate: new Date().toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" }),
      status: "ACTIVE",
      tradingDays: 1,
      minTradingDaysRequired: 5,
      tradesCount: 0,
      accountNumber: `ACC-${Math.floor(100000 + Math.random() * 900000)}`,
    };

    onAddAccount(newAcc);
    setSelectedAccountId(newAcc.id);
    setIsAddModalOpen(false);
    setNewAccName("");
  };

  return (
    <div className="space-y-6">
      {/* Top Banner Header */}
      <div className="bg-gradient-to-br from-[#0D1110] to-[#111615] p-6 rounded-2xl border border-[#00E676]/20 flex flex-col md:flex-row md:items-center justify-between gap-6 shadow-sm relative overflow-hidden">
        <div className="space-y-2 z-10">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#00E676]/10 text-[#00E676] border border-[#00E676]/20 text-xs font-mono font-bold">
            <Wallet className="w-3.5 h-3.5" /> Gestionnaire Multi-Portefeuilles & Prop Firms
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
            Mes Portefeuilles & Comptes de Trading
          </h1>
          <p className="text-slate-400 text-sm max-w-2xl">
            Suivez en temps réel la santé de vos comptes Prop Firms (FTMO, MFF, FundedNext) et brokers.
            Gérez vos règles strictes de Drawdown quotidien et total pour ne jamais échouer une évaluation.
          </p>
        </div>

        {!readOnly && (
          <button
            onClick={() => setIsAddModalOpen(true)}
            className="flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-[#00E676] hover:bg-[#00c865] text-slate-950 font-extrabold text-sm shadow-md transition-all shrink-0 cursor-pointer z-10"
          >
            <Plus className="w-5 h-5" />
            <span>Ajouter un Portefeuille</span>
          </button>
        )}
      </div>

      {/* Capital Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-gradient-to-br from-[#0D1110] to-[#111615] p-5 rounded-2xl border border-[#00E676]/20 space-y-2">
          <div className="text-xs font-medium text-slate-400 flex items-center justify-between">
            <span>Capital Total Cumulé</span>
            <DollarSign className="w-4 h-4 text-[#00E676]" />
          </div>
          <div className="text-2xl font-bold font-mono text-[#00E676]">
            {formatCurrency(totalCombinedEquity)}
          </div>
          <div className="text-xs text-slate-400 flex items-center gap-1 font-mono">
            {parseFloat(totalCombinedPnlPercent) >= 0 ? (
              <span className="text-[#00E676] font-bold flex items-center gap-0.5">
                <ArrowUpRight className="w-3.5 h-3.5" /> +{totalCombinedPnlPercent}%
              </span>
            ) : (
              <span className="text-rose-400 font-bold flex items-center gap-0.5">
                <ArrowDownRight className="w-3.5 h-3.5" /> {totalCombinedPnlPercent}%
              </span>
            )}
            <span>depuis le démarrage</span>
          </div>
        </div>

        <div className="bg-gradient-to-br from-[#0D1110] to-[#111615] p-5 rounded-2xl border border-blue-500/20 space-y-2">
          <div className="text-xs font-medium text-slate-400 flex items-center justify-between">
            <span>Comptes Actifs & Evaluation</span>
            <Building className="w-4 h-4 text-blue-400" />
          </div>
          <div className="text-2xl font-bold font-mono text-blue-300">
            {accounts.length} Portefeuilles
          </div>
          <div className="text-xs text-slate-400">
            {accounts.filter((a) => a.type.includes("Prop Firm")).length} Comptes Prop Firms sous gestion
          </div>
        </div>

        <div className="bg-gradient-to-br from-[#0D1110] to-[#111615] p-5 rounded-2xl border border-amber-500/20 space-y-2">
          <div className="text-xs font-medium text-slate-400 flex items-center justify-between">
            <span>Profit Cumulé Net</span>
            <TrendingUp className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-2xl font-bold font-mono text-amber-300">
            +{formatCurrency(totalCombinedPnl)}
          </div>
          <div className="text-xs text-slate-400">Bénéfices réels enregistrés sur le desk</div>
        </div>

        <div className="bg-gradient-to-br from-[#0D1110] to-[#111615] p-5 rounded-2xl border border-rose-500/20 space-y-2">
          <div className="text-xs font-medium text-slate-400 flex items-center justify-between">
            <span>Règle Risque Globale</span>
            <ShieldCheck className="w-4 h-4 text-rose-400" />
          </div>
          <div className="text-2xl font-bold font-mono text-rose-300 flex items-center gap-2">
            <span>1.0% Max</span>
          </div>
          <div className="text-xs text-rose-300 font-medium">Protection contre le Surtraitement</div>
        </div>
      </div>

      {/* Account Type Filter */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
        {["ALL", "Prop Firm Evaluation", "Prop Firm Funded", "Broker Réel", "Compte DÉMO"].map((type) => (
          <button
            key={type}
            onClick={() => setFilterType(type)}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all shrink-0 ${
              filterType === type
                ? "bg-[#00E676] text-slate-950 shadow-md shadow-[#00E676]/20"
                : "bg-[#111615] border border-[#1B2320] text-slate-400 hover:text-white"
            }`}
          >
            {type === "ALL" ? "Tous les Portefeuilles" : type}
          </button>
        ))}
      </div>

      {/* Main Grid: Accounts List & Selected Account Detailed View */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: List of Accounts */}
        <div className="space-y-3 lg:col-span-1">
          <h2 className="text-sm font-bold text-white uppercase tracking-wider font-mono flex items-center gap-2">
            <Layers className="w-4 h-4 text-[#00E676]" /> Sélectionner un Compte ({filteredAccounts.length})
          </h2>

          {filteredAccounts.map((acc) => {
            const isSelected = selectedAccount?.id === acc.id;
            const pnl = acc.equity - acc.initialBalance;
            const pnlPercent = acc.initialBalance > 0 ? ((pnl / acc.initialBalance) * 100).toFixed(1) : "0.0";

            return (
              <div
                key={acc.id}
                onClick={() => setSelectedAccountId(acc.id)}
                className={`p-4 rounded-xl border transition-all cursor-pointer space-y-3 ${
                  isSelected
                    ? "bg-gradient-to-br from-[#0D1110] to-[#111615] border-[#00E676]/40 shadow-lg shadow-[#00E676]/10"
                    : "bg-[#0D1110] border-[#151D1A] hover:border-[#00E676]/20"
                }`}
              >
                <div className="flex items-start justify-between">
                  <div>
                    <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-[#00E676]/10 border border-[#00E676]/20 text-[#00E676]">
                      {acc.firmOrBroker}
                    </span>
                    <h3 className="text-sm font-bold text-white mt-1">{acc.name}</h3>
                    <p className="text-[11px] text-slate-400 font-mono">{acc.accountNumber || "ACC-LIVE"}</p>
                  </div>

                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                      acc.status === "ACTIVE"
                        ? "bg-[#00E676]/10 text-[#00E676] border border-[#00E676]/20"
                        : acc.status === "PAID_OUT"
                        ? "bg-amber-500/10 text-amber-300 border border-amber-500/20"
                        : "bg-blue-500/10 text-blue-300 border border-blue-500/20"
                    }`}
                  >
                    {acc.status}
                  </span>
                </div>

                <div className="flex items-baseline justify-between pt-2 border-t border-[#151D1A]">
                  <div>
                    <div className="text-[10px] text-slate-500">Solde Actuel</div>
                    <div className="text-base font-bold font-mono text-white">
                      {formatCurrency(acc.equity)}
                    </div>
                  </div>

                  <div className="text-right">
                    <div className="text-[10px] text-slate-500">Performance</div>
                    <div
                      className={`text-xs font-bold font-mono ${
                        pnl >= 0 ? "text-[#00E676]" : "text-rose-400"
                      }`}
                    >
                      {pnl >= 0 ? `+${pnlPercent}%` : `${pnlPercent}%`}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Right Column: Selected Account Deep-Dive Inspector */}
        {selectedAccount && (
          <div className="lg:col-span-2 bg-gradient-to-br from-[#0D1110] to-[#111615] border border-[#00E676]/20 rounded-2xl p-6 space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-[#00E676]/20 pb-4 gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <span className="px-2.5 py-1 rounded bg-[#00E676]/10 text-[#00E676] border border-[#00E676]/20 text-xs font-mono font-bold">
                    {selectedAccount.type}
                  </span>
                  <span className="text-xs text-slate-400 font-mono">
                    Début: {selectedAccount.startDate}
                  </span>
                </div>
                <h2 className="text-xl font-bold text-white mt-1">{selectedAccount.name}</h2>
                <p className="text-xs text-slate-400">
                  Fournisseur / Broker: <span className="text-slate-200 font-bold">{selectedAccount.firmOrBroker}</span> | N° Compte:{" "}
                  <span className="text-[#00E676] font-mono">{selectedAccount.accountNumber}</span>
                </p>
              </div>

              {!readOnly && (
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      const newBalStr = prompt(
                        "Mettre à jour le solde du portefeuille ($) :",
                        selectedAccount.equity.toString()
                      );
                      if (newBalStr) {
                        const newBal = parseFloat(newBalStr);
                        if (!isNaN(newBal)) {
                          onUpdateAccountBalance(selectedAccount.id, newBal);
                        }
                      }
                    }}
                    className="px-3 py-2 rounded-xl bg-[#00E676]/10 hover:bg-[#00E676]/20 text-[#00E676] hover:text-[#00E676] font-bold text-xs flex items-center gap-1.5 transition-colors"
                  >
                    <RefreshCw className="w-3.5 h-3.5" /> Ajuster le Solde
                  </button>
                </div>
              )}
            </div>

            {/* Drawdown & Objectives Tracker Bars */}
            <div className="space-y-4">
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider font-mono flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-[#00E676]" /> Règles de Risk & Drawdown Prop Firm
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Daily Loss Limit Card */}
                {(() => {
                  const dailyPercent = dailyLossPercent(selectedAccount);
                  const dailyLossAbs = Math.max(0, -dailyPercent);
                  const dailyMax = selectedAccount.maxDailyDrawdownPercent;
                  const dailyBarPercent = dailyMax > 0 ? Math.min(100, (dailyLossAbs / dailyMax) * 100) : 0;
                  const dailyBreached = dailyLossAbs >= dailyMax;
                  const dailyWarning = !dailyBreached && dailyLossAbs >= dailyMax * 0.7;
                  const dailyColor = dailyBreached ? "bg-rose-500" : dailyWarning ? "bg-amber-400" : "bg-[#00E676]";
                  const dailyLabelColor = dailyBreached
                    ? "text-rose-400"
                    : dailyWarning
                    ? "text-amber-400"
                    : "text-[#00E676]";

                  return (
                    <div className="bg-[#0D1110] p-4 rounded-xl border border-[#151D1A] space-y-3">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-slate-400 font-medium flex items-center gap-1">
                          <AlertTriangle className="w-3.5 h-3.5 text-amber-400" /> Drawdown Quotidien Max
                        </span>
                        <span className="text-amber-400 font-mono font-bold">
                          {dailyMax}% Max ({formatCurrency((selectedAccount.initialBalance * dailyMax) / 100)})
                        </span>
                      </div>

                      <div className="w-full h-3 bg-[#111615] rounded-full overflow-hidden border border-[#1B2320]">
                        <div className={`h-full ${dailyColor} rounded-full`} style={{ width: `${dailyBarPercent}%` }} />
                      </div>

                      <div className="flex justify-between text-[11px] text-slate-400 font-mono">
                        <span>
                          Perte aujourd'hui:{" "}
                          <span className={`font-bold ${dailyLabelColor}`}>
                            {dailyPercent >= 0 ? "+" : ""}
                            {dailyPercent.toFixed(2)}%
                          </span>
                        </span>
                        <span className={dailyLabelColor}>
                          {dailyBreached ? "Limite Atteinte ⛔" : dailyWarning ? "Attention ⚠️" : "Sécurisé ✅"}
                        </span>
                      </div>
                    </div>
                  );
                })()}

                {/* Total Drawdown Limit Card */}
                {(() => {
                  const totalPercent = totalDrawdownPercent(selectedAccount);
                  const totalLossAbs = Math.max(0, totalPercent);
                  const totalMax = selectedAccount.maxTotalDrawdownPercent;
                  const totalBarPercent = totalMax > 0 ? Math.min(100, (totalLossAbs / totalMax) * 100) : 0;
                  const totalBreached = totalLossAbs >= totalMax;
                  const totalWarning = !totalBreached && totalLossAbs >= totalMax * 0.7;
                  const totalColor = totalBreached ? "bg-rose-500" : totalWarning ? "bg-amber-400" : "bg-[#00E676]";
                  const totalLabelColor = totalBreached
                    ? "text-rose-400"
                    : totalWarning
                    ? "text-amber-400"
                    : "text-[#00E676]";
                  const distanceToInvalidation = totalMax - totalLossAbs;

                  return (
                    <div className="bg-[#0D1110] p-4 rounded-xl border border-[#151D1A] space-y-3">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-slate-400 font-medium flex items-center gap-1">
                          <XCircle className="w-3.5 h-3.5 text-rose-400" /> Drawdown Total Max (Invalidation)
                        </span>
                        <span className="text-rose-400 font-mono font-bold">
                          {totalMax}% Max ({formatCurrency((selectedAccount.initialBalance * totalMax) / 100)})
                        </span>
                      </div>

                      <div className="w-full h-3 bg-[#111615] rounded-full overflow-hidden border border-[#1B2320]">
                        <div className={`h-full ${totalColor} rounded-full`} style={{ width: `${totalBarPercent}%` }} />
                      </div>

                      <div className="flex justify-between text-[11px] text-slate-400 font-mono">
                        <span>
                          Distance de l'invalidation:{" "}
                          <span className={`font-bold ${totalLabelColor}`}>
                            {distanceToInvalidation >= 0 ? "+" : ""}
                            {distanceToInvalidation.toFixed(2)}%
                          </span>
                        </span>
                        <span className={totalLabelColor}>
                          {totalBreached ? "Compte Invalidé ⛔" : totalWarning ? "Attention ⚠️" : "Zone Sûre ✅"}
                        </span>
                      </div>
                    </div>
                  );
                })()}
              </div>

              {/* Profit Target Progress (If Prop Firm Evaluation) */}
              {/* `initialBalance > 0` : sert de diviseur juste en dessous — un compte
                  legacy/malformé à 0 ou négatif donnerait un pourcentage NaN/inversé. */}
              {selectedAccount.profitTargetPercent > 0 && selectedAccount.initialBalance > 0 && (
                <div className="bg-gradient-to-br from-[#0D1110] to-[#111615] p-4 rounded-xl border border-[#00E676]/20 space-y-3">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-200 font-bold flex items-center gap-1.5">
                      <Award className="w-4 h-4 text-[#00E676]" /> Objectif de Validation (Profit Target)
                    </span>
                    <span className="text-[#00E676] font-mono font-bold">
                      +{selectedAccount.profitTargetPercent}% (+
                      {formatCurrency((selectedAccount.initialBalance * selectedAccount.profitTargetPercent) / 100)})
                    </span>
                  </div>

                  {/* Progress bar */}
                  <div className="w-full h-3.5 bg-[#111615] rounded-full overflow-hidden border border-[#00E676]/20">
                    <div
                      className="h-full bg-gradient-to-r from-[#00E676] to-teal-400 rounded-full transition-all"
                      style={{
                        width: `${Math.min(
                          100,
                          Math.max(
                            0,
                            (((selectedAccount.equity - selectedAccount.initialBalance) /
                              ((selectedAccount.initialBalance * selectedAccount.profitTargetPercent) / 100)) *
                              100)
                          )
                        )}%`,
                      }}
                    />
                  </div>

                  <div className="flex justify-between text-xs font-mono">
                    <span className="text-slate-400">
                      Bénéfice Actuel:{" "}
                      <span className="text-[#00E676] font-bold">
                        +{formatCurrency(selectedAccount.equity - selectedAccount.initialBalance)}
                      </span>
                    </span>
                    <span className="text-[#00E676] font-bold">
                      {Math.round(
                        (((selectedAccount.equity - selectedAccount.initialBalance) /
                          ((selectedAccount.initialBalance * selectedAccount.profitTargetPercent) / 100)) *
                          100)
                      )}
                      % Atteint
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* Quick Stats Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-gradient-to-br from-[#0D1110] to-[#111615] p-4 rounded-xl border border-[#00E676]/20 text-xs">
              <div>
                <div className="text-slate-400 font-mono">Jours de Trading</div>
                <div className="text-sm font-bold text-white mt-1">
                  {selectedAccount.tradingDays} / {selectedAccount.minTradingDaysRequired} jours min
                </div>
              </div>

              <div>
                <div className="text-slate-400 font-mono">Trades Exécutés</div>
                <div className="text-sm font-bold text-white mt-1">
                  {positionsDuCompte(selectedAccount.id)} positions
                </div>
              </div>

              <div>
                <div className="text-slate-400 font-mono">Capital Initial</div>
                <div className="text-sm font-bold text-white mt-1 font-mono">
                  {formatCurrency(selectedAccount.initialBalance)}
                </div>
              </div>

              <div>
                <div className="text-slate-400 font-mono">Solde Actuel</div>
                <div className="text-sm font-bold text-[#00E676] mt-1 font-mono">
                  {formatCurrency(selectedAccount.equity)}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Modal Add Account */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 bg-[#0D1110]/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-gradient-to-br from-[#0D1110] to-[#111615] border border-[#00E676]/20 rounded-2xl max-w-lg w-full p-6 space-y-6 shadow-2xl relative">
            <div className="flex items-center justify-between border-b border-[#00E676]/20 pb-4">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-lg bg-[#00E676]/10">
                  <Wallet className="w-5 h-5 text-[#00E676]" />
                </div>
                <h3 className="text-base font-bold text-white">Ajouter un nouveau Portefeuille</h3>
              </div>
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="text-slate-400 hover:text-white text-sm"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateAccount} className="space-y-4 text-xs">
              <div>
                <label className="block font-medium text-slate-300 mb-1">Nom du Portefeuille</label>
                <input
                  type="text"
                  required
                  placeholder="ex: FTMO $100K Phase 1"
                  value={newAccName}
                  onChange={(e) => setNewAccName(e.target.value)}
                  className="w-full bg-[#0D1110] border border-[#00E676]/20 rounded-xl px-3.5 py-2.5 text-white focus:outline-none focus:border-[#00E676]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium text-slate-300 mb-1">Fournisseur / Broker</label>
                  <input
                    type="text"
                    required
                    placeholder="FTMO, MyFundedFX, IC Markets..."
                    value={newAccFirm}
                    onChange={(e) => setNewAccFirm(e.target.value)}
                    className="w-full bg-[#0D1110] border border-[#00E676]/20 rounded-xl px-3.5 py-2.5 text-white focus:outline-none focus:border-[#00E676]"
                  />
                </div>

                <div>
                  <label className="block font-medium text-slate-300 mb-1">Type de Compte</label>
                  <select
                    value={newAccType}
                    onChange={(e) => setNewAccType(e.target.value as AccountType)}
                    className="w-full bg-[#0D1110] border border-[#00E676]/20 rounded-xl px-3.5 py-2.5 text-white focus:outline-none focus:border-[#00E676]"
                  >
                    <option value="Prop Firm Evaluation">Prop Firm Evaluation</option>
                    <option value="Prop Firm Funded">Prop Firm Funded</option>
                    <option value="Broker Réel">Broker Réel</option>
                    <option value="Compte DÉMO">Compte DÉMO</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium text-slate-300 mb-1">Capital Initial ($)</label>
                  <input
                    type="number"
                    required
                    min="1"
                    value={newAccBalance}
                    onChange={(e) => setNewAccBalance(e.target.value)}
                    className="w-full bg-[#0D1110] border border-purple-500/30 rounded-xl px-3.5 py-2.5 text-white focus:outline-none focus:border-purple-500 font-mono"
                  />
                </div>

                <div>
                  <label className="block font-medium text-slate-300 mb-1">Profit Target (%)</label>
                  <input
                    type="number"
                    value={newAccProfitTarget}
                    onChange={(e) => setNewAccProfitTarget(e.target.value)}
                    className="w-full bg-[#0D1110] border border-purple-500/30 rounded-xl px-3.5 py-2.5 text-white focus:outline-none focus:border-purple-500 font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium text-slate-300 mb-1">Max Daily Loss (%)</label>
                  <input
                    type="number"
                    value={newAccMaxDailyDrawdown}
                    onChange={(e) => setNewAccMaxDailyDrawdown(e.target.value)}
                    className="w-full bg-[#0D1110] border border-purple-500/30 rounded-xl px-3.5 py-2.5 text-white focus:outline-none focus:border-purple-500 font-mono"
                  />
                </div>

                <div>
                  <label className="block font-medium text-slate-300 mb-1">Max Total Drawdown (%)</label>
                  <input
                    type="number"
                    value={newAccMaxTotalDrawdown}
                    onChange={(e) => setNewAccMaxTotalDrawdown(e.target.value)}
                    className="w-full bg-[#0D1110] border border-purple-500/30 rounded-xl px-3.5 py-2.5 text-white focus:outline-none focus:border-purple-500 font-mono"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-[#00E676]/20">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl bg-[#1B2320] hover:bg-[#232D29] text-slate-300 font-bold"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-xl bg-[#00E676] hover:bg-[#00c865] text-slate-950 font-bold"
                >
                  Créer le Portefeuille
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
