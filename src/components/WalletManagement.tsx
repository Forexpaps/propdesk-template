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
import { TradingAccount, AccountType } from "../types";

/**
 * Une prop `onSelectAccountForJournal?: (accountId: string) => void` figurait
 * ici : déclarée, déstructurée, jamais appelée, et jamais transmise par
 * `App.tsx`. Elle a été retirée.
 *
 * Elle laissait croire qu'il suffisait de la brancher pour filtrer le journal
 * sur un compte. Ce n'est pas le cas : **`Trade` n'a aucun `accountId`** (voir
 * `src/types.ts`), rien ne relie un trade à un portefeuille. Le faire
 * demanderait d'ajouter le champ, de décider à quel compte rattacher les
 * trades déjà en base, d'ajouter un sélecteur au formulaire de saisie et un
 * filtre au journal — une fonctionnalité entière, pas un branchement. Elle est
 * décrite comme telle dans le HANDOFF si le besoin se présente.
 */
interface WalletManagementProps {
  accounts: TradingAccount[];
  onAddAccount: (account: TradingAccount) => void;
  onUpdateAccountBalance: (id: string, newBalance: number) => void;
}

export const WalletManagement: React.FC<WalletManagementProps> = ({
  accounts,
  onAddAccount,
  onUpdateAccountBalance,
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
  const totalCombinedInitial = accounts.reduce((acc, a) => acc + a.initialBalance, 0);
  const totalCombinedPnl = totalCombinedEquity - totalCombinedInitial;
  const totalCombinedPnlPercent = ((totalCombinedPnl / totalCombinedInitial) * 100).toFixed(2);

  const handleCreateAccount = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAccName.trim()) return;

    const initialBal = parseFloat(newAccBalance) || 100000;
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
      <div className="bg-[#111615] p-6 rounded-2xl border border-[#1B2320] flex flex-col md:flex-row md:items-center justify-between gap-6 shadow-sm relative overflow-hidden">
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

        <button
          onClick={() => setIsAddModalOpen(true)}
          className="flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-[#00E676] hover:bg-[#00c865] text-slate-950 font-extrabold text-sm shadow-md transition-all shrink-0 cursor-pointer z-10"
        >
          <Plus className="w-5 h-5" />
          <span>Ajouter un Portefeuille</span>
        </button>
      </div>

      {/* Capital Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-[#111615] p-5 rounded-2xl border border-[#1B2320] space-y-2">
          <div className="text-xs font-medium text-slate-400 flex items-center justify-between">
            <span>Capital Total Cumulé</span>
            <DollarSign className="w-4 h-4 text-[#00E676]" />
          </div>
          <div className="text-2xl font-bold font-mono text-[#00E676]">
            {totalCombinedEquity.toLocaleString("fr-FR")} €
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

        <div className="bg-[#111615] p-5 rounded-2xl border border-[#1B2320] space-y-2">
          <div className="text-xs font-medium text-slate-400 flex items-center justify-between">
            <span>Comptes Actifs & Evaluation</span>
            <Building className="w-4 h-4 text-blue-400" />
          </div>
          <div className="text-2xl font-bold font-mono text-white">
            {accounts.length} Portefeuilles
          </div>
          <div className="text-xs text-slate-400">
            {accounts.filter((a) => a.type.includes("Prop Firm")).length} Comptes Prop Firms sous gestion
          </div>
        </div>

        <div className="bg-[#111615] p-5 rounded-2xl border border-[#1B2320] space-y-2">
          <div className="text-xs font-medium text-slate-400 flex items-center justify-between">
            <span>Profit Cumulé Net</span>
            <TrendingUp className="w-4 h-4 text-[#FFB800]" />
          </div>
          <div className="text-2xl font-bold font-mono text-[#00E676]">
            +{totalCombinedPnl.toLocaleString("fr-FR")} €
          </div>
          <div className="text-xs text-slate-400">Bénéfices réels enregistrés sur le desk</div>
        </div>

        <div className="bg-[#111615] p-5 rounded-2xl border border-[#1B2320] space-y-2">
          <div className="text-xs font-medium text-slate-400 flex items-center justify-between">
            <span>Règle Risque Globale</span>
            <ShieldCheck className="w-4 h-4 text-[#00E676]" />
          </div>
          <div className="text-2xl font-bold font-mono text-[#00E676] flex items-center gap-2">
            <span>1.0% Max</span>
          </div>
          <div className="text-xs text-[#00E676] font-medium">Protection contre le Surtraitement</div>
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
            const pnlPercent = ((pnl / acc.initialBalance) * 100).toFixed(1);

            return (
              <div
                key={acc.id}
                onClick={() => setSelectedAccountId(acc.id)}
                className={`p-4 rounded-xl border transition-all cursor-pointer space-y-3 ${
                  isSelected
                    ? "bg-[#111615] border-[#00E676] shadow-lg shadow-[#00E676]/10"
                    : "bg-[#0D1110] border-[#151D1A] hover:border-[#232D29]"
                }`}
              >
                <div className="flex items-start justify-between">
                  <div>
                    <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-[#111615] border border-[#1B2320] text-[#00E676]">
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
                      {acc.equity.toLocaleString("fr-FR")} €
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
          <div className="lg:col-span-2 bg-[#111615] border border-[#1B2320] rounded-2xl p-6 space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-[#1B2320] pb-4 gap-4">
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

              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    const newBalStr = prompt(
                      "Mettre à jour le solde du portefeuille (€) :",
                      selectedAccount.equity.toString()
                    );
                    if (newBalStr) {
                      const newBal = parseFloat(newBalStr);
                      if (!isNaN(newBal)) {
                        onUpdateAccountBalance(selectedAccount.id, newBal);
                      }
                    }
                  }}
                  className="px-3 py-2 rounded-xl bg-[#1B2320] hover:bg-[#232D29] text-slate-300 hover:text-white font-bold text-xs flex items-center gap-1.5 transition-colors"
                >
                  <RefreshCw className="w-3.5 h-3.5" /> Ajuster le Solde
                </button>
              </div>
            </div>

            {/* Drawdown & Objectives Tracker Bars */}
            <div className="space-y-4">
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider font-mono flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-[#00E676]" /> Règles de Risk & Drawdown Prop Firm
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Daily Loss Limit Card */}
                <div className="bg-[#0D1110] p-4 rounded-xl border border-[#151D1A] space-y-3">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-400 font-medium flex items-center gap-1">
                      <AlertTriangle className="w-3.5 h-3.5 text-amber-400" /> Drawdown Quotidien Max
                    </span>
                    <span className="text-amber-400 font-mono font-bold">
                      {selectedAccount.maxDailyDrawdownPercent}% Max (
                      {((selectedAccount.initialBalance * selectedAccount.maxDailyDrawdownPercent) / 100).toLocaleString("fr-FR")} €)
                    </span>
                  </div>

                  {/* Progress bar */}
                  <div className="w-full h-3 bg-[#111615] rounded-full overflow-hidden border border-[#1B2320]">
                    <div className="h-full bg-[#00E676] rounded-full w-[22%]" />
                  </div>

                  <div className="flex justify-between text-[11px] text-slate-400 font-mono">
                    <span>Perte aujourd'hui: <span className="text-[#00E676] font-bold">-0.8%</span></span>
                    <span className="text-[#00E676]">Sécurisé ✅</span>
                  </div>
                </div>

                {/* Total Drawdown Limit Card */}
                <div className="bg-[#0D1110] p-4 rounded-xl border border-[#151D1A] space-y-3">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-400 font-medium flex items-center gap-1">
                      <XCircle className="w-3.5 h-3.5 text-rose-400" /> Drawdown Total Max (Invalidation)
                    </span>
                    <span className="text-rose-400 font-mono font-bold">
                      {selectedAccount.maxTotalDrawdownPercent}% Max (
                      {((selectedAccount.initialBalance * selectedAccount.maxTotalDrawdownPercent) / 100).toLocaleString("fr-FR")} €)
                    </span>
                  </div>

                  {/* Progress bar */}
                  <div className="w-full h-3 bg-[#111615] rounded-full overflow-hidden border border-[#1B2320]">
                    <div className="h-full bg-[#00E676] rounded-full w-[15%]" />
                  </div>

                  <div className="flex justify-between text-[11px] text-slate-400 font-mono">
                    <span>Distance de l'invalidation: <span className="text-[#00E676] font-bold">+8.5%</span></span>
                    <span className="text-[#00E676]">Zone Sûre ✅</span>
                  </div>
                </div>
              </div>

              {/* Profit Target Progress (If Prop Firm Evaluation) */}
              {selectedAccount.profitTargetPercent > 0 && (
                <div className="bg-[#0D1110] p-4 rounded-xl border border-[#00E676]/30 space-y-3">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-200 font-bold flex items-center gap-1.5">
                      <Award className="w-4 h-4 text-amber-400" /> Objectif de Validation (Profit Target)
                    </span>
                    <span className="text-[#00E676] font-mono font-bold">
                      +{selectedAccount.profitTargetPercent}% (+
                      {((selectedAccount.initialBalance * selectedAccount.profitTargetPercent) / 100).toLocaleString("fr-FR")} €)
                    </span>
                  </div>

                  {/* Progress bar */}
                  <div className="w-full h-3.5 bg-[#111615] rounded-full overflow-hidden border border-[#1B2320]">
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
                        +{(selectedAccount.equity - selectedAccount.initialBalance).toLocaleString("fr-FR")} €
                      </span>
                    </span>
                    <span className="text-amber-400 font-bold">
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
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-[#0D1110] p-4 rounded-xl border border-[#151D1A] text-xs">
              <div>
                <div className="text-slate-400 font-mono">Jours de Trading</div>
                <div className="text-sm font-bold text-white mt-1">
                  {selectedAccount.tradingDays} / {selectedAccount.minTradingDaysRequired} jours min
                </div>
              </div>

              <div>
                <div className="text-slate-400 font-mono">Trades Exécutés</div>
                <div className="text-sm font-bold text-white mt-1">
                  {selectedAccount.tradesCount} positions
                </div>
              </div>

              <div>
                <div className="text-slate-400 font-mono">Capital Initial</div>
                <div className="text-sm font-bold text-white mt-1 font-mono">
                  {selectedAccount.initialBalance.toLocaleString("fr-FR")} €
                </div>
              </div>

              <div>
                <div className="text-slate-400 font-mono">Solde Actuel</div>
                <div className="text-sm font-bold text-[#00E676] mt-1 font-mono">
                  {selectedAccount.equity.toLocaleString("fr-FR")} €
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Modal Add Account */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 bg-[#0D1110]/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-[#111615] border border-[#1B2320] rounded-2xl max-w-lg w-full p-6 space-y-6 shadow-2xl relative">
            <div className="flex items-center justify-between border-b border-[#1B2320] pb-4">
              <div className="flex items-center gap-2">
                <Wallet className="w-5 h-5 text-[#00E676]" />
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
                  className="w-full bg-[#0D1110] border border-[#1B2320] rounded-xl px-3.5 py-2.5 text-white focus:outline-none focus:border-[#00E676]"
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
                    className="w-full bg-[#0D1110] border border-[#1B2320] rounded-xl px-3.5 py-2.5 text-white focus:outline-none focus:border-[#00E676]"
                  />
                </div>

                <div>
                  <label className="block font-medium text-slate-300 mb-1">Type de Compte</label>
                  <select
                    value={newAccType}
                    onChange={(e) => setNewAccType(e.target.value as AccountType)}
                    className="w-full bg-[#0D1110] border border-[#1B2320] rounded-xl px-3.5 py-2.5 text-white focus:outline-none focus:border-[#00E676]"
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
                  <label className="block font-medium text-slate-300 mb-1">Capital Initial (€)</label>
                  <input
                    type="number"
                    required
                    value={newAccBalance}
                    onChange={(e) => setNewAccBalance(e.target.value)}
                    className="w-full bg-[#0D1110] border border-[#1B2320] rounded-xl px-3.5 py-2.5 text-white focus:outline-none focus:border-[#00E676] font-mono"
                  />
                </div>

                <div>
                  <label className="block font-medium text-slate-300 mb-1">Profit Target (%)</label>
                  <input
                    type="number"
                    value={newAccProfitTarget}
                    onChange={(e) => setNewAccProfitTarget(e.target.value)}
                    className="w-full bg-[#0D1110] border border-[#1B2320] rounded-xl px-3.5 py-2.5 text-white focus:outline-none focus:border-[#00E676] font-mono"
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
                    className="w-full bg-[#0D1110] border border-[#1B2320] rounded-xl px-3.5 py-2.5 text-white focus:outline-none focus:border-[#00E676] font-mono"
                  />
                </div>

                <div>
                  <label className="block font-medium text-slate-300 mb-1">Max Total Drawdown (%)</label>
                  <input
                    type="number"
                    value={newAccMaxTotalDrawdown}
                    onChange={(e) => setNewAccMaxTotalDrawdown(e.target.value)}
                    className="w-full bg-[#0D1110] border border-[#1B2320] rounded-xl px-3.5 py-2.5 text-white focus:outline-none focus:border-[#00E676] font-mono"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-[#1B2320]">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl bg-[#1B2320] hover:bg-[#232D29] text-slate-300 font-bold"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-xl bg-[#00E676] hover:bg-[#00E676] text-slate-950 font-bold"
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
