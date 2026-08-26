import React, { useState } from "react";
import {
  Wallet,
  ShieldCheck,
  TrendingUp,
  AlertTriangle,
  Plus,
  DollarSign,
  Award,
  Layers,
  XCircle,
  Building,
  ArrowUpRight,
  ArrowDownRight,
  RefreshCw,
  Trash2,
  Settings,
  Landmark,
} from "lucide-react";
import { TradingAccount, AccountType, Trade } from "../types";
import { formatCurrency } from "../lib/format";
import {
  positionsDuCompte as computePositionsDuCompte,
  dailyLossPercent as computeDailyLossPercent,
  totalDrawdownPercent as computeTotalDrawdownPercent,
} from "../lib/walletStats";
import { Select } from "./Select";

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
/**
 * En-tête de section — barre verticale colorée + titre, motif repris tel
 * quel de PerformanceDashboard.tsx pour un rendu cohérent sur tout l'écosystème.
 */
const SectionHeader: React.FC<{ children: React.ReactNode; color?: string }> = ({
  children,
  color = "bg-[#00E676]",
}) => (
  <div className="flex items-center gap-2">
    <span className={`w-1 h-4 rounded-full ${color}`} />
    <h3 className="text-sm font-bold text-white">{children}</h3>
  </div>
);

const ACCOUNT_STATUS_LABEL: Record<TradingAccount["status"], string> = {
  ACTIVE: "En cours",
  PASSED: "Réussi",
  FAILED: "Échoué",
  PAID_OUT: "Payé",
};
const ACCOUNT_STATUS_CLASS: Record<TradingAccount["status"], string> = {
  ACTIVE: "text-amber-400",
  PASSED: "text-[#00E676]",
  FAILED: "text-rose-400",
  PAID_OUT: "text-blue-400",
};

/**
 * Ligne "actuel / limite" avec barre de progression — une par carte de
 * portefeuille (objectif de gain, perte du jour, perte totale). `current`
 * et `limit` portent déjà leur signe (négatif pour une perte) :
 * `formatCurrency` s'occupe de l'affichage, cette ligne ne fait aucune
 * hypothèse de signe elle-même.
 */
const RiskProgressRow: React.FC<{
  label: string;
  current: number;
  limit: number;
  barColor: string;
  valueColor: string;
}> = ({ label, current, limit, barColor, valueColor }) => {
  const percent = limit !== 0 ? Math.min(100, (Math.abs(current) / Math.abs(limit)) * 100) : 0;
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-xs">
        <span className="text-slate-400">{label}</span>
        <span className={`font-mono font-bold ${valueColor}`}>
          {formatCurrency(current)} / {formatCurrency(limit)}
        </span>
      </div>
      <div className="w-full h-1.5 rounded-full bg-[#0D1110] border border-[#1B2320] overflow-hidden">
        <div className={`h-full rounded-full ${barColor}`} style={{ width: `${percent}%` }} />
      </div>
    </div>
  );
};

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
  onDeleteAccount: (id: string) => void;
  /** Masque les actions d'ajout, d'ajustement de solde et de suppression — vue admin d'un élève. */
  readOnly?: boolean;
}

export const WalletManagement: React.FC<WalletManagementProps> = ({
  accounts,
  trades,
  onAddAccount,
  onUpdateAccountBalance,
  onDeleteAccount,
  readOnly = false,
}) => {
  const [filterType, setFilterType] = useState<string>("ALL");
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [selectedAccountId, setSelectedAccountId] = useState<string>(
    accounts[0]?.id || ""
  );
  // Modales maison pour la suppression et l'ajustement de solde — remplacent
  // window.confirm()/prompt(), qui restent muets (aucune boîte de dialogue,
  // retour silencieux) sur iOS en mode application (icône ajoutée à l'écran
  // d'accueil), signalé par l'utilisateur en usage réel sur iPhone.
  const [deleteConfirmAccount, setDeleteConfirmAccount] = useState<TradingAccount | null>(null);
  const [balanceEditAccount, setBalanceEditAccount] = useState<TradingAccount | null>(null);
  const [balanceEditValue, setBalanceEditValue] = useState("");

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

  // Le compte affiché doit toujours provenir de la liste déjà filtrée par
  // onglet, sinon un compte d'un autre type (ex: SMT 10K en "Prop Firm
  // Evaluation") reste sélectionné et s'affiche dans le détail même après
  // avoir changé d'onglet, alors qu'il a disparu de la liste de gauche.
  const selectedAccount =
    filteredAccounts.find((a) => a.id === selectedAccountId) || filteredAccounts[0];

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
    // `parseFloat(...) || défaut` seul ne protège pas contre une valeur
    // négative (`-5 || 10` reste `-5`, seul `0`/NaN retombe sur le défaut) —
    // une valeur négative fausserait silencieusement les barres de
    // progression de risque (`RiskProgressRow`) qui supposent un pourcentage
    // positif. Une fonction dédiée referme ce trou en plus du cas NaN.
    const positiveOrDefault = (raw: string, fallback: number): number => {
      const parsed = parseFloat(raw);
      return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
    };

    const initialBal = parsedBalance;
    const newAcc: TradingAccount = {
      id: `acc-${Date.now()}`,
      name: newAccName,
      firmOrBroker: newAccFirm,
      type: newAccType,
      initialBalance: initialBal,
      currentBalance: initialBal,
      equity: initialBal,
      maxTotalDrawdownPercent: positiveOrDefault(newAccMaxTotalDrawdown, 10),
      maxDailyDrawdownPercent: positiveOrDefault(newAccMaxDailyDrawdown, 5),
      profitTargetPercent: positiveOrDefault(newAccProfitTarget, 10),
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

  const handleDeleteAccount = (account: TradingAccount) => {
    setDeleteConfirmAccount(account);
  };

  const confirmDeleteAccount = () => {
    if (!deleteConfirmAccount) return;
    onDeleteAccount(deleteConfirmAccount.id);
    if (selectedAccountId === deleteConfirmAccount.id) {
      setSelectedAccountId(accounts.find((a) => a.id !== deleteConfirmAccount.id)?.id || "");
    }
    setDeleteConfirmAccount(null);
  };

  const handleOpenBalanceEdit = (account: TradingAccount) => {
    setBalanceEditValue(account.equity.toString());
    setBalanceEditAccount(account);
  };

  const confirmBalanceEdit = () => {
    if (!balanceEditAccount) return;
    const newBal = parseFloat(balanceEditValue);
    if (!isNaN(newBal)) {
      onUpdateAccountBalance(balanceEditAccount.id, newBal);
    }
    setBalanceEditAccount(null);
  };

  return (
    <div className="space-y-6">
      {/* Top Banner Header */}
      <div className="bg-[#111615] p-6 rounded-xl border border-[#1B2320] flex flex-col md:flex-row md:items-center justify-between gap-6 relative overflow-hidden">
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
        <div className="bg-[#111615] p-4 rounded-xl border border-[#1B2320] space-y-1.5">
          <div className="text-[9px] uppercase tracking-wider text-slate-500 font-bold flex items-center justify-between">
            <span>Capital Total Cumulé</span>
            <DollarSign className="w-3.5 h-3.5 text-[#00E676]" />
          </div>
          <div className="text-xl font-black font-mono text-[#00E676]">
            {formatCurrency(totalCombinedEquity)}
          </div>
          <div className="text-[11px] text-slate-500 flex items-center gap-1 font-mono">
            {parseFloat(totalCombinedPnlPercent) >= 0 ? (
              <span className="text-[#00E676] font-bold flex items-center gap-0.5">
                <ArrowUpRight className="w-3.5 h-3.5" /> +{totalCombinedPnlPercent}%
              </span>
            ) : (
              <span className="text-rose-400 font-bold flex items-center gap-0.5">
                <ArrowDownRight className="w-3.5 h-3.5" /> {totalCombinedPnlPercent}%
              </span>
            )}
            <span className="font-sans">depuis le démarrage</span>
          </div>
        </div>

        <div className="bg-[#111615] p-4 rounded-xl border border-[#1B2320] space-y-1.5">
          <div className="text-[9px] uppercase tracking-wider text-slate-500 font-bold flex items-center justify-between">
            <span>Comptes Actifs & Evaluation</span>
            <Building className="w-3.5 h-3.5 text-blue-400" />
          </div>
          <div className="text-xl font-black font-mono text-blue-300">
            {accounts.length} Portefeuilles
          </div>
          <div className="text-[11px] text-slate-500">
            {accounts.filter((a) => a.type.includes("Prop Firm")).length} Comptes Prop Firms sous gestion
          </div>
        </div>

        <div className="bg-[#111615] p-4 rounded-xl border border-[#1B2320] space-y-1.5">
          <div className="text-[9px] uppercase tracking-wider text-slate-500 font-bold flex items-center justify-between">
            <span>Profit Cumulé Net</span>
            <TrendingUp className="w-3.5 h-3.5 text-amber-400" />
          </div>
          <div className="text-xl font-black font-mono text-amber-300">
            +{formatCurrency(totalCombinedPnl)}
          </div>
          <div className="text-[11px] text-slate-500">Bénéfices réels enregistrés sur le desk</div>
        </div>

        <div className="bg-[#111615] p-4 rounded-xl border border-[#1B2320] space-y-1.5">
          <div className="text-[9px] uppercase tracking-wider text-slate-500 font-bold flex items-center justify-between">
            <span>Règle Risque Globale</span>
            <ShieldCheck className="w-3.5 h-3.5 text-rose-400" />
          </div>
          <div className="text-xl font-black font-mono text-rose-300 flex items-center gap-2">
            <span>1.0% Max</span>
          </div>
          <div className="text-[11px] text-rose-300/80">Protection contre le Surtraitement</div>
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
          <SectionHeader>
            <span className="inline-flex items-center gap-2">
              <Layers className="w-4 h-4 text-[#00E676]" /> Sélectionner un Compte ({filteredAccounts.length})
            </span>
          </SectionHeader>

          {filteredAccounts.map((acc) => {
            const isSelected = selectedAccount?.id === acc.id;

            // Objectifs/limites en $ — dérivés des % configurés à la
            // création du compte (voir modale "Ajouter un Portefeuille"),
            // appliqués au capital INITIAL (une prop firm fixe ses règles
            // sur le capital de départ, jamais sur l'équité courante).
            const profitTargetAmount = (acc.initialBalance * acc.profitTargetPercent) / 100;
            const dailyLossLimitAmount = (acc.initialBalance * acc.maxDailyDrawdownPercent) / 100;
            const totalLossLimitAmount = (acc.initialBalance * acc.maxTotalDrawdownPercent) / 100;
            const floorEquity = acc.initialBalance - totalLossLimitAmount;

            const gainAmount = Math.max(0, acc.equity - acc.initialBalance);
            const dailyLossPct = computeDailyLossPercent(trades, acc);
            const dailyLossAmount = -Math.max(0, (-dailyLossPct / 100) * acc.initialBalance);
            const totalLossAmount = -Math.max(0, acc.initialBalance - acc.equity);

            return (
              <div
                key={acc.id}
                onClick={() => setSelectedAccountId(acc.id)}
                className={`p-4 rounded-xl border transition-all cursor-pointer space-y-3.5 ${
                  isSelected
                    ? "bg-[#111615] border-[#00E676]/40"
                    : "bg-[#0D1110] border-[#1B2320] hover:border-[#00E676]/20"
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <Landmark className="w-4 h-4 text-amber-400 shrink-0" />
                    <h3 className="text-sm font-bold text-white truncate">
                      {acc.firmOrBroker} <span className="text-slate-500 font-normal">· {acc.type}</span>
                    </h3>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className={`text-xs font-bold ${ACCOUNT_STATUS_CLASS[acc.status]}`}>
                      {ACCOUNT_STATUS_LABEL[acc.status]}
                    </span>
                    {!readOnly && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleOpenBalanceEdit(acc);
                        }}
                        title="Ajuster le solde de ce portefeuille"
                        className="p-1.5 rounded-lg bg-[#1B2320] hover:bg-[#232D29] text-slate-400 hover:text-white transition-colors"
                      >
                        <Settings className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>

                <div className="space-y-3 pt-1">
                  <RiskProgressRow
                    label="Objectif de gain"
                    current={gainAmount}
                    limit={profitTargetAmount}
                    barColor="bg-[#00E676]"
                    valueColor="text-[#00E676]"
                  />
                  <RiskProgressRow
                    label="Perte du jour"
                    current={dailyLossAmount}
                    limit={-dailyLossLimitAmount}
                    barColor="bg-amber-500"
                    valueColor="text-amber-400"
                  />
                  <RiskProgressRow
                    label="Perte totale (limite)"
                    current={totalLossAmount}
                    limit={-totalLossLimitAmount}
                    barColor="bg-rose-500"
                    valueColor="text-rose-400"
                  />
                </div>

                <div className="flex items-center gap-1.5 pt-2 border-t border-[#1B2320] text-[11px] text-slate-500">
                  Équité <span className="text-white font-bold font-mono">{formatCurrency(acc.equity)}</span>
                  <span>· plancher {formatCurrency(floorEquity)}</span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Right Column: Selected Account Deep-Dive Inspector */}
        {selectedAccount && (
          <div className="lg:col-span-2 bg-[#111615] border border-[#1B2320] rounded-xl p-6 space-y-6">
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
                  Fournisseur / Broker: <span className="text-slate-200 font-bold">{selectedAccount.firmOrBroker}</span>
                </p>
              </div>

              {!readOnly && (
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleOpenBalanceEdit(selectedAccount)}
                    className="px-3 py-2 rounded-xl bg-[#00E676]/10 hover:bg-[#00E676]/20 text-[#00E676] hover:text-[#00E676] font-bold text-xs flex items-center gap-1.5 transition-colors"
                  >
                    <RefreshCw className="w-3.5 h-3.5" /> Ajuster le Solde
                  </button>
                  <button
                    onClick={() => handleDeleteAccount(selectedAccount)}
                    title="Supprimer ce portefeuille"
                    className="px-3 py-2 rounded-xl bg-[#1B2320] hover:bg-rose-500/10 text-slate-400 hover:text-rose-400 font-bold text-xs flex items-center gap-1.5 transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" /> Supprimer
                  </button>
                </div>
              )}
            </div>

            {/* Drawdown & Objectives Tracker Bars */}
            <div className="space-y-4">
              <SectionHeader color="bg-rose-500">
                <span className="inline-flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-[#00E676]" /> Règles de Risk & Drawdown Prop Firm
                </span>
              </SectionHeader>

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
                    <div className="bg-[#0D1110] p-4 rounded-xl border border-[#1B2320] space-y-3">
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
                    <div className="bg-[#0D1110] p-4 rounded-xl border border-[#1B2320] space-y-3">
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
                <div className="bg-[#0D1110] p-4 rounded-xl border border-[#1B2320] space-y-3">
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
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-[#0D1110] p-4 rounded-xl border border-[#1B2320] text-xs">
              <div>
                <div className="text-[9px] uppercase tracking-wider text-slate-500 font-bold">Jours de Trading</div>
                <div className="text-sm font-bold text-white mt-1">
                  {selectedAccount.tradingDays} / {selectedAccount.minTradingDaysRequired} jours min
                </div>
              </div>

              <div>
                <div className="text-[9px] uppercase tracking-wider text-slate-500 font-bold">Trades Exécutés</div>
                <div className="text-sm font-bold text-white mt-1">
                  {positionsDuCompte(selectedAccount.id)} positions
                </div>
              </div>

              <div>
                <div className="text-[9px] uppercase tracking-wider text-slate-500 font-bold">Capital Initial</div>
                <div className="text-sm font-bold text-white mt-1 font-mono">
                  {formatCurrency(selectedAccount.initialBalance)}
                </div>
              </div>

              <div>
                <div className="text-[9px] uppercase tracking-wider text-slate-500 font-bold">Solde Actuel</div>
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
          <div className="bg-[#111615] border border-[#1B2320] rounded-xl max-w-lg w-full p-6 space-y-6 shadow-2xl relative">
            <div className="flex items-center justify-between border-b border-[#1B2320] pb-4">
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
                  className="w-full bg-[#0D1110] border border-[#1B2320] rounded-xl px-3.5 py-2.5 text-white focus:outline-none focus:border-[#00E676]/50"
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
                    className="w-full bg-[#0D1110] border border-[#1B2320] rounded-xl px-3.5 py-2.5 text-white focus:outline-none focus:border-[#00E676]/50"
                  />
                </div>

                <div>
                  <label className="block font-medium text-slate-300 mb-1">Type de Compte</label>
                  <Select
                    value={newAccType}
                    onChange={(e) => setNewAccType(e.target.value as AccountType)}
                    className="w-full bg-[#0D1110] border border-[#1B2320] rounded-xl px-3.5 py-2.5 text-white focus:outline-none focus:border-[#00E676]/50"
                  >
                    <option value="Prop Firm Evaluation">Prop Firm Evaluation</option>
                    <option value="Prop Firm Funded">Prop Firm Funded</option>
                    <option value="Broker Réel">Broker Réel</option>
                    <option value="Compte DÉMO">Compte DÉMO</option>
                  </Select>
                </div>
              </div>

              {/* `step="any"` sur les 4 champs numériques ci-dessous : sans lui,
                  un `<input type="number">` applique un pas par défaut de 1 à
                  partir de `min` — avec `min="0.1"`, seules 0,1 / 1,1 / 2,1…
                  sont valides, donc une valeur aussi normale que "10" était
                  rejetée par le navigateur ("valeur non valable"). Bug
                  introduit en ajoutant `min` sans `step` lors d'un audit
                  précédent, signalé par un élève qui ne pouvait plus saisir
                  10% de Profit Target. */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium text-slate-300 mb-1">Capital Initial ($)</label>
                  <input
                    type="number"
                    required
                    min="1"
                    step="any"
                    value={newAccBalance}
                    onChange={(e) => setNewAccBalance(e.target.value)}
                    className="w-full bg-[#0D1110] border border-[#1B2320] rounded-xl px-3.5 py-2.5 text-white focus:outline-none focus:border-[#00E676]/50 font-mono"
                  />
                </div>

                <div>
                  <label className="block font-medium text-slate-300 mb-1">Profit Target (%)</label>
                  <input
                    type="number"
                    min="0.1"
                    step="any"
                    value={newAccProfitTarget}
                    onChange={(e) => setNewAccProfitTarget(e.target.value)}
                    className="w-full bg-[#0D1110] border border-[#1B2320] rounded-xl px-3.5 py-2.5 text-white focus:outline-none focus:border-[#00E676]/50 font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium text-slate-300 mb-1">Max Daily Loss (%)</label>
                  <input
                    type="number"
                    min="0.1"
                    step="any"
                    value={newAccMaxDailyDrawdown}
                    onChange={(e) => setNewAccMaxDailyDrawdown(e.target.value)}
                    className="w-full bg-[#0D1110] border border-[#1B2320] rounded-xl px-3.5 py-2.5 text-white focus:outline-none focus:border-[#00E676]/50 font-mono"
                  />
                </div>

                <div>
                  <label className="block font-medium text-slate-300 mb-1">Max Total Drawdown (%)</label>
                  <input
                    type="number"
                    min="0.1"
                    step="any"
                    value={newAccMaxTotalDrawdown}
                    onChange={(e) => setNewAccMaxTotalDrawdown(e.target.value)}
                    className="w-full bg-[#0D1110] border border-[#1B2320] rounded-xl px-3.5 py-2.5 text-white focus:outline-none focus:border-[#00E676]/50 font-mono"
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
                  className="px-5 py-2.5 rounded-xl bg-[#00E676] hover:bg-[#00c865] text-slate-950 font-bold"
                >
                  Créer le Portefeuille
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Confirmation de suppression — modale maison, voir la note près de
          l'état `deleteConfirmAccount` pour la raison (window.confirm() muet
          sur iOS en mode application). */}
      {deleteConfirmAccount && (
        <div className="fixed inset-0 z-50 bg-[#0D1110]/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-[#111615] border border-[#1B2320] rounded-xl max-w-sm w-full p-6 space-y-5 shadow-2xl">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-rose-500/10 shrink-0">
                <Trash2 className="w-5 h-5 text-rose-400" />
              </div>
              <h3 className="text-base font-bold text-white">Supprimer ce portefeuille ?</h3>
            </div>
            <p className="text-xs text-slate-400">
              Supprimer « <span className="text-white font-bold">{deleteConfirmAccount.name}</span> » ?
              Cette action est irréversible.
            </p>
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                onClick={() => setDeleteConfirmAccount(null)}
                className="px-4 py-2.5 rounded-xl bg-[#1B2320] hover:bg-[#232D29] text-slate-300 font-bold text-xs"
              >
                Annuler
              </button>
              <button
                onClick={confirmDeleteAccount}
                className="px-4 py-2.5 rounded-xl bg-rose-500 hover:bg-rose-400 text-white font-bold text-xs"
              >
                Supprimer définitivement
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Ajustement de solde — modale maison, remplace prompt() pour la même
          raison (silencieux sur iOS en mode application). */}
      {balanceEditAccount && (
        <div className="fixed inset-0 z-50 bg-[#0D1110]/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-[#111615] border border-[#1B2320] rounded-xl max-w-sm w-full p-6 space-y-5 shadow-2xl">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-[#00E676]/10 shrink-0">
                <RefreshCw className="w-5 h-5 text-[#00E676]" />
              </div>
              <h3 className="text-base font-bold text-white">Ajuster le Solde</h3>
            </div>
            <div>
              <label className="block font-medium text-slate-300 mb-1 text-xs">
                Nouveau solde de « {balanceEditAccount.name} » ($)
              </label>
              <input
                type="number"
                autoFocus
                value={balanceEditValue}
                onChange={(e) => setBalanceEditValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") confirmBalanceEdit();
                }}
                className="w-full bg-[#0D1110] border border-[#1B2320] rounded-xl px-3.5 py-2.5 text-white font-mono focus:outline-none focus:border-[#00E676]/50"
              />
            </div>
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                onClick={() => setBalanceEditAccount(null)}
                className="px-4 py-2.5 rounded-xl bg-[#1B2320] hover:bg-[#232D29] text-slate-300 font-bold text-xs"
              >
                Annuler
              </button>
              <button
                onClick={confirmBalanceEdit}
                className="px-4 py-2.5 rounded-xl bg-[#00E676] hover:bg-[#00c865] text-slate-950 font-bold text-xs"
              >
                Enregistrer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
