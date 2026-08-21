import React, { useState, useEffect } from "react";
import {
  Plus,
  Search,
  Filter,
  ArrowUpRight,
  ArrowDownRight,
  Trash2,
  MessageSquare,
  Zap,
  Tag,
  Calculator,
  Download,
  Eye,
  Pencil,
  X,
  ImagePlus,
  Loader2
} from "lucide-react";
import {
  Trade,
  TradeDirection,
  TradeResult,
  EmotionState,
  MarketCategory,
  TradeDraft,
  TradingAccount,
  PnlUnit,
  TradeMistake,
  Setup,
} from "../types";
import { formatCurrency } from "../lib/format";
import { resizeChartScreenshot } from "../lib/image";
import { computeJournalSummary } from "../lib/performanceStats";

/** Valeur du sélecteur de compte quand aucun n'est choisi. */
const SANS_COMPTE = "";

/** Valeur du filtre « tous les comptes », distincte de « non rattaché ». */
const TOUS_COMPTES = "Tous";

/** Valeur du filtre isolant les trades sans compte. */
const NON_RATTACHES = "__aucun__";

/** Erreurs proposées au tag sur un trade — voir `TradeMistake` dans types.ts. */
const MISTAKE_OPTIONS: TradeMistake[] = [
  "Entrée anticipée",
  "Sortie prématurée",
  "SL trop serré",
  "SL déplacé/retiré",
  "Sur-risque (>1%)",
  "Revenge trading",
  "FOMO / Chasing",
  "Pas de plan de trade",
  "Sur-trading",
];

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

interface TradingJournalProps {
  trades: Trade[];
  /**
   * Portefeuilles disponibles pour rattacher un trade.
   *
   * Sert aussi à retrouver le nom d'un compte depuis un `accountId`. Un id
   * absent de cette liste (compte supprimé depuis) est traité comme « non
   * rattaché », jamais comme une erreur.
   */
  accounts: TradingAccount[];
  onAddTrade: (trade: Omit<Trade, "id">) => void;
  /** Remplace un trade existant, identifié par son `id`. */
  onUpdateTrade: (trade: Trade) => void;
  onDeleteTrade: (id: string) => void;
  onSendTradeToCoach: (trade: Trade) => void;
  onOpenCalculator?: () => void;
  /** Ébauche envoyée par le calculateur de position ou l'analyseur de setup. */
  prefillDraft?: TradeDraft | null;
  /** Appelé une fois l'ébauche appliquée, pour que le parent la remette à null. */
  onPrefillConsumed?: () => void;
  /**
   * Masque le bouton « Discuter avec le coach » sur chaque ligne. Sert au
   * Journal élève, qui n'a pas accès à la messagerie coach — voir
   * `StudentAuthenticatedApp` dans `src/App.tsx`.
   */
  hideAiAndCoachActions?: boolean;
  /** Mode lecture seule : masque les boutons d'ajout, édition, suppression. */
  readOnly?: boolean;
  /**
   * Stratégies définies par l'élève (module Setups, voir `SetupManagement.tsx`)
   * — remplace l'ancienne liste de 6 stratégies codées en dur comme source du
   * champ « Stratégie / Setup » du formulaire de trade. `Trade.strategy` reste
   * une chaîne libre (le nom du setup) : un setup renommé ou supprimé après
   * coup ne modifie jamais les trades déjà enregistrés.
   */
  setups?: Setup[];
}

export const TradingJournal: React.FC<TradingJournalProps> = ({
  trades,
  accounts,
  onAddTrade,
  onUpdateTrade,
  onDeleteTrade,
  onSendTradeToCoach,
  onOpenCalculator,
  prefillDraft,
  onPrefillConsumed,
  hideAiAndCoachActions = false,
  readOnly = false,
  setups = [],
}) => {
  const [searchPair, setSearchPair] = useState("");
  const [selectedMarket, setSelectedMarket] = useState<string>("Tous");
  const [selectedResult, setSelectedResult] = useState<string>("Tous");
  const [selectedEmotion, setSelectedEmotion] = useState<string>("Tous");
  const [selectedAccount, setSelectedAccount] = useState<string>(TOUS_COMPTES);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

  /**
   * Trade en cours de modification, `null` pour une création.
   *
   * On conserve l'objet entier et pas seulement son `id` : il porte des champs
   * absents du formulaire (`aiAudit` notamment) qu'il faut réinjecter tels
   * quels à l'enregistrement, sous peine de les effacer silencieusement.
   */
  const [editingTrade, setEditingTrade] = useState<Trade | null>(null);

  const [selectedChartTrade, setSelectedChartTrade] = useState<Trade | null>(null);
  const [isResizingChart, setIsResizingChart] = useState(false);

  /**
   * Nom affichable d'un compte, ou `null` si le trade n'est rattaché à rien —
   * y compris quand l'`accountId` pointe sur un compte supprimé depuis.
   */
  const nomDuCompte = (accountId?: string): string | null => {
    if (!accountId) return null;
    return accounts.find((a) => a.id === accountId)?.name ?? null;
  };

  /**
   * Échappe une cellule CSV de texte libre (saisi par l'utilisateur) : guillemets
   * doublés, ET neutralisation de l'injection de formule Excel/Sheets — une
   * cellule commençant par `=`, `+`, `-` ou `@` peut s'exécuter comme une formule
   * à l'ouverture (voir OWASP CSV Injection). Préfixe d'apostrophe standard :
   * Excel/Sheets l'interprète comme « force texte », sans dénaturer la lecture.
   */
  const csvCell = (value: string): string => {
    const safe = /^[=+\-@]/.test(value) ? `'${value}` : value;
    return `"${safe.replace(/"/g, '""')}"`;
  };

  const exportToCSV = () => {
    if (trades.length === 0) return;
    const headers = [
      "ID",
      "Date Entree",
      "Heure Entree",
      "Date Sortie",
      "Heure Sortie",
      "Compte",
      "Paire",
      "Marche",
      "Direction",
      "Prix Entree",
      "Stop Loss",
      "Take Profit",
      "Prix Sortie",
      "Taille Lot",
      "PnL",
      "Unite PnL",
      "Ratio RR",
      "Resultat",
      "Strategie",
      "Emotion",
      "Erreurs",
      "Notes"
    ];
    const rows = trades.map((t) => [
      t.id,
      t.date,
      t.time || "",
      t.exitDate || "",
      t.exitTime || "",
      csvCell(nomDuCompte(t.accountId) ?? "Non rattache"),
      csvCell(t.pair),
      t.marketCategory,
      t.direction,
      t.entryPrice,
      t.stopLoss,
      t.takeProfit,
      t.exitPrice || "",
      t.lotSize,
      t.pnl,
      t.pnlUnit ?? "USD",
      t.riskRewardRatio,
      t.result,
      csvCell(t.strategy),
      t.emotion,
      csvCell((t.mistakes || []).join("; ")),
      csvCell(t.notes || "")
    ]);

    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map((e) => e.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `Horizon_Journal_Trades_${new Date().toISOString().split("T")[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // New Trade Form state
  const [formData, setFormData] = useState({
    date: new Date().toISOString().split("T")[0],
    time: "14:30",
    exitDate: new Date().toISOString().split("T")[0],
    exitTime: "16:00",
    accountId: SANS_COMPTE,
    pnl: "0",
    pnlUnit: "USD" as PnlUnit,
    pair: "EUR/USD",
    marketCategory: "Forex" as MarketCategory,
    direction: "LONG" as TradeDirection,
    entryPrice: "1.0850",
    stopLoss: "1.0830",
    takeProfit: "1.0910",
    exitPrice: "1.0910",
    lotSize: "1",
    strategy: "",
    emotion: "Disciplined" as EmotionState,
    mistakes: [] as TradeMistake[],
    notes: "Validation FVG H1 + Chasse de liquidité.",
    chartUrl: "https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?auto=format&fit=crop&q=80&w=800",
  });

  /** Valeurs par défaut d'une création. Recalculées à chaque ouverture. */
  const formulaireVierge = () => ({
    date: new Date().toISOString().split("T")[0],
    time: "14:30",
    exitDate: new Date().toISOString().split("T")[0],
    exitTime: "16:00",
    accountId: SANS_COMPTE,
    pnl: "0",
    pnlUnit: "USD" as PnlUnit,
    pair: "EUR/USD",
    marketCategory: "Forex" as MarketCategory,
    direction: "LONG" as TradeDirection,
    entryPrice: "1.085",
    stopLoss: "1.083",
    takeProfit: "1.091",
    exitPrice: "1.091",
    lotSize: "1",
    strategy: "",
    emotion: "Disciplined" as EmotionState,
    mistakes: [] as TradeMistake[],
    notes: "",
    chartUrl: "",
  });

  const ouvrirCreation = () => {
    setEditingTrade(null);
    setFormData(formulaireVierge());
    setIsAddModalOpen(true);
  };

  /**
   * Ouvre le formulaire sur un trade existant.
   *
   * Le PnL est repris **tel qu'il est enregistré**, jamais recalculé — voir le
   * commentaire de `handleFormSubmit`, c'est le point le plus important de
   * cette vue.
   */
  const ouvrirEdition = (trade: Trade) => {
    setEditingTrade(trade);
    setFormData({
      date: trade.date,
      time: trade.time ?? "",
      exitDate: trade.exitDate ?? "",
      exitTime: trade.exitTime ?? "",
      accountId: trade.accountId ?? SANS_COMPTE,
      pnl: String(trade.pnl),
      pnlUnit: trade.pnlUnit ?? "USD",
      pair: trade.pair,
      marketCategory: trade.marketCategory,
      direction: trade.direction,
      entryPrice: String(trade.entryPrice),
      stopLoss: String(trade.stopLoss),
      takeProfit: String(trade.takeProfit),
      exitPrice: String(trade.exitPrice ?? 0),
      lotSize: String(trade.lotSize),
      strategy: trade.strategy,
      emotion: trade.emotion,
      mistakes: trade.mistakes ?? [],
      notes: trade.notes ?? "",
      chartUrl: trade.chartUrl ?? "",
    });
    setIsAddModalOpen(true);
  };

  const fermerFormulaire = () => {
    setIsAddModalOpen(false);
    setEditingTrade(null);
  };

  // Applique une ébauche venue du calculateur / de l'analyseur de setup, puis ouvre le formulaire.
  // Seules les clés fournies écrasent les valeurs par défaut ci-dessus.
  useEffect(() => {
    if (!prefillDraft) return;
    setFormData(() => {
      // Partir de `formulaireVierge()`, jamais de l'état précédent : sans ça,
      // le commentaire "écrasent les valeurs par défaut" mentait sur ce que
      // faisait le code. Rouvrir un vieux trade en édition (PnL, capture
      // d'écran, tags d'erreur), l'annuler, puis appliquer une ébauche du
      // calculateur conservait silencieusement tous ces champs — absents de
      // `TradeDraft` — sur le nouveau trade créé depuis l'ébauche.
      const next = formulaireVierge();
      (Object.keys(prefillDraft) as (keyof TradeDraft)[]).forEach((key) => {
        const value = prefillDraft[key];
        if (value !== undefined) {
          (next as Record<string, unknown>)[key] = value;
        }
      });
      return next;
    });
    // Une ébauche est toujours une création : sans cela, elle viendrait écraser
    // un trade en cours d'édition resté ouvert.
    setEditingTrade(null);
    setIsAddModalOpen(true);
    onPrefillConsumed?.();
  }, [prefillDraft, onPrefillConsumed]);

  // Calculate Summary Statistics — partagé avec l'export PDF, voir
  // src/lib/performanceStats.ts.
  const { totalTrades, winTrades, lossTrades, winRate, totalPnL, profitFactor, avgRR, disciplineEmoPercent } =
    computeJournalSummary(trades);

  // Filtering
  const filteredTrades = trades.filter((t) => {
    const matchesPair = t.pair.toLowerCase().includes(searchPair.toLowerCase()) || t.strategy.toLowerCase().includes(searchPair.toLowerCase());
    const matchesMarket = selectedMarket === "Tous" || t.marketCategory === selectedMarket;
    const matchesResult = selectedResult === "Tous" || t.result === selectedResult;
    const matchesEmotion = selectedEmotion === "Tous" || t.emotion === selectedEmotion;
    // « Non rattachés » couvre aussi les trades pointant sur un compte
    // supprimé : c'est ce que `nomDuCompte` renvoie à null qui fait foi, pas
    // la simple absence d'`accountId`.
    const matchesAccount =
      selectedAccount === TOUS_COMPTES ||
      (selectedAccount === NON_RATTACHES
        ? nomDuCompte(t.accountId) === null
        : t.accountId === selectedAccount);
    return matchesPair && matchesMarket && matchesResult && matchesEmotion && matchesAccount;
  });

  const getEmotionBadge = (emotion: EmotionState) => {
    switch (emotion) {
      case "Disciplined":
        return <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded bg-[#00E676]/10 text-[#00E676] border border-[#00E676]/30">🧘 Discipline</span>;
      case "FOMO":
        return <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded bg-rose-500/10 text-rose-400 border border-rose-500/30">🚀 FOMO</span>;
      case "Impulsive":
        return <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/30">⚡ Impulsif</span>;
      case "Anxious":
        return <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded bg-purple-500/10 text-purple-400 border border-purple-500/30">🤯 Anxieux</span>;
      case "Calm":
        return <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded bg-cyan-500/10 text-cyan-400 border border-cyan-500/30">🎯 Calme</span>;
      case "Greedy":
        return <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded bg-yellow-500/10 text-yellow-400 border border-yellow-500/30">💰 Avarice</span>;
      default:
        return <span className="text-[11px] text-slate-400">{emotion}</span>;
    }
  };

  /**
   * Capture d'écran du trade, réduite avant d'entrer dans l'état applicatif.
   *
   * `Trade.chartUrl` est sérialisé en JSON — dans la base, dans chaque
   * réponse de `/api/state` et dans le cache `localStorage` — une image brute
   * y pèserait donc son poids réel à trois endroits à la fois. Voir
   * `src/lib/image.ts`.
   */
  const handleChartUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    // Sans réinitialiser la valeur, re-choisir le même fichier après une
    // erreur n'émettrait aucun évènement.
    e.target.value = "";
    if (!file) return;

    // Garde-fou sur le décodage, pas sur le stockage : après réduction, la
    // taille du fichier d'origine n'a plus d'incidence.
    if (file.size > 20 * 1024 * 1024) {
      alert("L'image choisie est trop volumineuse (max 20 Mo). Choisis-en une autre.");
      return;
    }

    setIsResizingChart(true);
    try {
      const chartUrl = await resizeChartScreenshot(file);
      setFormData((prev) => ({ ...prev, chartUrl }));
    } catch (err) {
      console.error("[propdesk] Redimensionnement de la capture d'écran échoué.", err);
      alert("Cette image n'a pas pu être lue. Essaie un autre fichier (JPEG, PNG ou WebP).");
    } finally {
      setIsResizingChart(false);
    }
  };

  /**
   * Champs prix/PnL saisis en texte libre, jamais en `type="number"` : un
   * input number renvoie une `value` DOM vide dès que son contenu n'est pas
   * un nombre valide pour le *locale* du navigateur (virgule au lieu du
   * point, point superflu, "0" qu'on essaie d'effacer pour retaper devant).
   * Le champ contrôlé réaffichait alors aussitôt "0", effaçant la saisie en
   * cours. Ici, la valeur reste une chaîne pendant toute la frappe (virgule
   * convertie en point) et n'est convertie en nombre qu'à la soumission.
   */
  const handleDecimalChange = (
    field: "entryPrice" | "stopLoss" | "takeProfit" | "exitPrice" | "lotSize" | "pnl",
    raw: string,
    { allowNegative = false }: { allowNegative?: boolean } = {},
  ) => {
    const normalized = raw.replace(",", ".");
    const pattern = allowNegative ? /^-?\d*\.?\d*$/ : /^\d*\.?\d*$/;
    if (!pattern.test(normalized)) return;
    setFormData((prev) => ({ ...prev, [field]: normalized }));
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // Géométrie pure, indépendante de l'instrument : recalculable sans risque.
    const risque = Math.abs(Number(formData.entryPrice) - Number(formData.stopLoss));
    const gain = Math.abs(Number(formData.takeProfit) - Number(formData.entryPrice));

    // `risque === 0` (stop = entrée) n'a pas de ratio R:R réel — l'ancien
    // repli sur "1" enregistrait un 1:1 fictif, indiscernable d'un vrai
    // trade 1:1, faussant silencieusement la moyenne R:R du Journal
    // (`performanceStats.ts`). `riskRewardRatio` est un champ obligatoire du
    // type `Trade` : plutôt que d'inventer une valeur, on bloque la saisie
    // d'un setup sans distance de stop définie, invalide dans tous les cas.
    if (risque === 0) {
      alert("Le Stop Loss ne peut pas être égal au Prix d'Entrée — aucune distance de risque définie.");
      return;
    }

    const riskReward = Number((gain / risque).toFixed(1));

    // Le PnL vient du champ, jamais d'un recalcul ni d'une conversion.
    //
    // C'est **la** règle à ne pas casser. Aucune formule ne propose plus de
    // valeur par défaut : l'utilisateur tape le chiffre qu'il lit sur sa
    // propre plateforme, dans l'unité de son choix. Un montant "$" reste un
    // entier (comme avant) ; un "%" garde ses décimales, ce n'est pas une
    // somme d'argent à arrondir.
    const pnl =
      formData.pnlUnit === "PERCENT"
        ? Number(formData.pnl) || 0
        : Math.round(Number(formData.pnl) || 0);

    let result: TradeResult = "OPEN";
    if (Number(formData.exitPrice)) {
      // Même règle stricte pour les deux unités : l'utilisateur tape un
      // résultat réel dans les deux cas (voir le commentaire au-dessus de
      // `pnl`, "aucune formule ne propose plus de valeur par défaut"). Une
      // marge morte de ±50$ existait ici auparavant pour absorber le bruit
      // d'une proposition *automatique* de PnL — un mécanisme qui n'existe
      // plus depuis ce changement. Elle classait à tort un trade réellement
      // gagnant/perdant (ex. +30$) en "BREAKEVEN", exclu du Win Rate
      // (`t.result === "WIN"`) tout en restant compté dans `totalPnL`/
      // `avgWin`/`profitFactor` (qui utilisent le signe brut du PnL) — deux
      // cartes du même tableau de bord se contredisaient sur un même trade.
      result = pnl > 0 ? "WIN" : pnl < 0 ? "LOSS" : "BREAKEVEN";
    }

    const champs = {
      date: formData.date,
      time: formData.time,
      exitDate: formData.exitDate || undefined,
      exitTime: formData.exitTime || undefined,
      // `undefined` et non chaîne vide : le champ est optionnel, une chaîne
      // vide en base se lirait comme un rattachement à un compte sans id.
      accountId: formData.accountId || undefined,
      pair: formData.pair,
      marketCategory: formData.marketCategory,
      direction: formData.direction,
      entryPrice: Number(formData.entryPrice),
      stopLoss: Number(formData.stopLoss),
      takeProfit: Number(formData.takeProfit),
      exitPrice: Number(formData.exitPrice),
      lotSize: Number(formData.lotSize),
      pnl,
      pnlUnit: formData.pnlUnit,
      riskRewardRatio: riskReward,
      result,
      strategy: formData.strategy,
      emotion: formData.emotion,
      mistakes: formData.mistakes,
      notes: formData.notes,
      chartUrl: formData.chartUrl,
    };

    if (editingTrade) {
      // `...editingTrade` d'abord : conserve `id` et surtout `aiAudit`, absent
      // du formulaire. Sans cela, modifier un trade effacerait son audit.
      onUpdateTrade({ ...editingTrade, ...champs });
    } else {
      onAddTrade(champs);
    }

    fermerFormulaire();
  };

  return (
    <div className="space-y-8 pb-12">
      {/* Header & New Trade Trigger */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-[#111615] p-6 rounded-xl border border-[#1B2320]">
        <div className="space-y-1">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#00E676]/10 text-[#00E676] text-xs font-semibold border border-[#00E676]/20">
            <Zap className="w-3.5 h-3.5" />
            Journal de Trading Professionnel
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
            Carnet d'Exécution & Registre Émotionnel
          </h1>
          <p className="text-slate-400 text-xs sm:text-sm">
            Consignez chaque position, vos niveaux techniques et votre état d'esprit pour progresser trade après trade.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          <button
            onClick={exportToCSV}
            className="flex items-center justify-center gap-2 px-3.5 py-3 rounded-xl bg-[#1B2320] hover:bg-[#1B2320] text-slate-200 border border-[#1B2320] font-bold text-xs transition-all cursor-pointer"
            title="Télécharger l'ensemble des trades en format CSV"
          >
            <Download className="w-4 h-4 text-[#00E676]" />
            <span className="hidden sm:inline">Exporter CSV</span>
          </button>

          {onOpenCalculator && (
            <button
              onClick={onOpenCalculator}
              className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-[#1B2320] hover:bg-[#1B2320] text-[#00E676] border border-[#1B2320] font-bold text-xs transition-all cursor-pointer"
            >
              <Calculator className="w-4 h-4" />
              <span>Calculer Lot</span>
            </button>
          )}

          {!readOnly && (
            <button
              onClick={ouvrirCreation}
              className="flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-[#00E676] hover:bg-[#00c865] text-slate-950 font-extrabold text-sm shadow-md transition-all shrink-0 cursor-pointer"
            >
              <Plus className="w-5 h-5" />
              <span>Saisir un Trade</span>
            </button>
          )}
        </div>
      </div>

      {/* Metric Cards Bar */}
      <SectionHeader>Performance</SectionHeader>
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <div className="bg-[#111615] border border-[#1B2320] p-4 rounded-xl space-y-1">
          <div className="text-[9px] uppercase tracking-wider text-slate-500 font-bold">Taux de Réussite</div>
          <div className="text-xl font-black text-[#00E676] font-mono">{winRate}%</div>
          <div className="text-[11px] text-slate-500">{winTrades} W / {lossTrades} L</div>
        </div>

        <div className="bg-[#111615] border border-[#1B2320] p-4 rounded-xl space-y-1">
          <div className="text-[9px] uppercase tracking-wider text-slate-500 font-bold">PnL Cumulé</div>
          <div className={`text-xl font-black font-mono ${totalPnL >= 0 ? "text-[#00E676]" : "text-rose-400"}`}>
            {totalPnL >= 0 ? `+${formatCurrency(totalPnL)}` : formatCurrency(totalPnL)}
          </div>
          <div className="text-[11px] text-slate-500">{totalTrades} positions fermées</div>
        </div>

        <div className="bg-[#111615] border border-[#1B2320] p-4 rounded-xl space-y-1">
          <div className="text-[9px] uppercase tracking-wider text-slate-500 font-bold">Profit Factor</div>
          <div className="text-xl font-black text-white font-mono">{profitFactor}</div>
          <div className="text-[11px] text-slate-500">Gains vs Pertes</div>
        </div>

        <div className="bg-[#111615] border border-[#1B2320] p-4 rounded-xl space-y-1">
          <div className="text-[9px] uppercase tracking-wider text-slate-500 font-bold">Ratio R:R Moyen</div>
          <div className="text-xl font-black text-purple-400 font-mono">1:{avgRR}</div>
          <div className="text-[11px] text-slate-500">Espérance par trade</div>
        </div>

        <div className="col-span-2 md:col-span-1 bg-[#111615] border border-[#1B2320] p-4 rounded-xl space-y-1">
          <div className="text-[9px] uppercase tracking-wider text-slate-500 font-bold">Discipline Émotionnelle</div>
          <div className="text-xl font-black text-[#00E676] font-mono">
            {disciplineEmoPercent}%
          </div>
          <div className="text-[11px] text-slate-500">Respect du plan de trading</div>
        </div>
      </div>

      {/* Search & Filter Bar */}
      <div className="flex flex-col md:flex-row items-center justify-between gap-4 bg-[#111615]/60 p-4 rounded-xl border border-[#1B2320]">
        <div className="relative w-full md:w-64">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchPair}
            onChange={(e) => setSearchPair(e.target.value)}
            placeholder="Paire ou stratégie (ex: EUR/USD)..."
            className="w-full bg-[#0D1110] border border-[#1B2320] rounded-lg pl-9 pr-4 py-2 text-xs text-slate-200 focus:outline-none focus:border-amber-500"
          />
        </div>

        <div className="flex items-center gap-2 overflow-x-auto w-full md:w-auto scrollbar-none pb-1 md:pb-0">
          <select
            value={selectedMarket}
            onChange={(e) => setSelectedMarket(e.target.value)}
            className="bg-[#0D1110] border border-[#1B2320] rounded-lg px-3 py-2 text-xs text-slate-300 focus:outline-none"
          >
            <option value="Tous">Tous les marchés</option>
            <option value="Forex">Forex</option>
            <option value="Crypto">Crypto</option>
            <option value="Indices">Indices</option>
            <option value="Matières Premières">Matières Premières</option>
          </select>

          {/* Le filtre par compte n'apparaît que s'il y a des portefeuilles :
              sur une base neuve, un sélecteur vide n'apprendrait rien. */}
          {accounts.length > 0 && (
            <select
              value={selectedAccount}
              onChange={(e) => setSelectedAccount(e.target.value)}
              className="bg-[#0D1110] border border-[#1B2320] rounded-lg px-3 py-2 text-xs text-slate-300 focus:outline-none"
            >
              <option value={TOUS_COMPTES}>Compte : tous</option>
              {accounts.map((acc) => (
                <option key={acc.id} value={acc.id}>
                  {acc.name}
                </option>
              ))}
              <option value={NON_RATTACHES}>Non rattachés</option>
            </select>
          )}

          <select
            value={selectedResult}
            onChange={(e) => setSelectedResult(e.target.value)}
            className="bg-[#0D1110] border border-[#1B2320] rounded-lg px-3 py-2 text-xs text-slate-300 focus:outline-none"
          >
            <option value="Tous">Résultat: Tous</option>
            <option value="WIN">Gagnants (WIN)</option>
            <option value="LOSS">Perdants (LOSS)</option>
            <option value="BREAKEVEN">Breakeven</option>
          </select>

          <select
            value={selectedEmotion}
            onChange={(e) => setSelectedEmotion(e.target.value)}
            className="bg-[#0D1110] border border-[#1B2320] rounded-lg px-3 py-2 text-xs text-slate-300 focus:outline-none"
          >
            <option value="Tous">Émotion: Toutes</option>
            <option value="Disciplined">Discipliné</option>
            <option value="FOMO">FOMO</option>
            <option value="Impulsive">Impulsif</option>
            <option value="Anxious">Anxieux</option>
            <option value="Calm">Calme</option>
          </select>
        </div>
      </div>

      {/* Trades Table / List */}
      <SectionHeader color="bg-blue-500">Registre des Positions</SectionHeader>
      <div className="bg-[#111615] border border-[#1B2320] rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-[#0D1110]/80 text-slate-400 font-semibold border-b border-[#1B2320]">
              <tr>
                <th className="py-3.5 px-4">Entrée / Sortie</th>
                <th className="py-3.5 px-4">Actif / Paire</th>
                <th className="py-3.5 px-4">Compte</th>
                <th className="py-3.5 px-4">Direction</th>
                <th className="py-3.5 px-4">Entrée → TP / SL</th>
                <th className="py-3.5 px-4">Stratégie & Émotion</th>
                <th className="py-3.5 px-4">R:R</th>
                <th className="py-3.5 px-4 text-right">PnL Net</th>
                <th className="py-3.5 px-4 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1B2320]/60">
              {filteredTrades.length === 0 ? (
                <tr>
                  <td colSpan={9} className="text-center py-12 text-slate-500">
                    Aucun trade trouvé correspondant aux critères de recherche.
                  </td>
                </tr>
              ) : (
                filteredTrades.map((trade) => (
                  <tr key={trade.id} className="hover:bg-[#151D1A]/80 transition-colors">
                    {/* Horodatage d'entrée puis de sortie. Sans date de sortie,
                        la position est considérée encore ouverte. */}
                    <td className="py-4 px-4 whitespace-nowrap space-y-1">
                      <div className="flex items-baseline gap-1.5">
                        <span className="text-[#00E676] text-[10px] font-bold">↓</span>
                        <span className="font-semibold text-slate-200">{trade.date}</span>
                        <span className="text-[10px] text-slate-500 font-mono">
                          {trade.time || "--:--"}
                        </span>
                      </div>
                      {trade.exitDate ? (
                        <div className="flex items-baseline gap-1.5">
                          <span className="text-rose-400 text-[10px] font-bold">↑</span>
                          <span className="font-semibold text-slate-400">{trade.exitDate}</span>
                          <span className="text-[10px] text-slate-500 font-mono">
                            {trade.exitTime || "--:--"}
                          </span>
                        </div>
                      ) : trade.exitPrice ? (
                        // Trade clôturé mais saisi avant l'ajout de ces champs.
                        <div className="text-[10px] text-slate-600 font-mono pl-4">
                          sortie non renseignée
                        </div>
                      ) : (
                        <div className="text-[10px] text-amber-400 font-mono pl-4">
                          Position ouverte
                        </div>
                      )}
                    </td>

                    {/* Pair & Category */}
                    <td className="py-4 px-4 whitespace-nowrap">
                      <div className="font-extrabold text-sm text-white tracking-tight">
                        {trade.pair}
                      </div>
                      <span className="text-[10px] px-1.5 py-0.2 rounded bg-[#1B2320] text-slate-400">
                        {trade.marketCategory}
                      </span>
                    </td>

                    {/* Compte de rattachement. « Non rattaché » couvre aussi
                        les trades pointant sur un compte supprimé. */}
                    <td className="py-4 px-4 whitespace-nowrap">
                      {nomDuCompte(trade.accountId) ? (
                        <span className="text-[11px] font-semibold text-slate-200">
                          {nomDuCompte(trade.accountId)}
                        </span>
                      ) : (
                        <span className="text-[11px] text-slate-600 italic">Non rattaché</span>
                      )}
                    </td>

                    {/* Direction */}
                    <td className="py-4 px-4 whitespace-nowrap">
                      <span
                        className={`inline-flex items-center gap-1 font-bold px-2.5 py-1 rounded-lg text-xs ${
                          trade.direction === "LONG"
                            ? "bg-[#00E676]/10 text-[#00E676] border border-[#00E676]/30"
                            : "bg-rose-500/10 text-rose-400 border border-rose-500/30"
                        }`}
                      >
                        {trade.direction === "LONG" ? (
                          <ArrowUpRight className="w-3.5 h-3.5" />
                        ) : (
                          <ArrowDownRight className="w-3.5 h-3.5" />
                        )}
                        {trade.direction}
                      </span>
                    </td>

                    {/* Price Range */}
                    <td className="py-4 px-4 whitespace-nowrap font-mono text-[11px]">
                      <div>In: <span className="text-slate-200 font-bold">{trade.entryPrice}</span></div>
                      <div className="text-slate-500">
                        SL: {trade.stopLoss} | TP: {trade.takeProfit}
                      </div>
                    </td>

                    {/* Strategy & Emotion */}
                    <td className="py-4 px-4">
                      <div className="font-semibold text-slate-200 text-xs flex items-center gap-1">
                        <Tag className="w-3 h-3 text-amber-400 shrink-0" />
                        {trade.strategy}
                      </div>
                      <div className="mt-1">{getEmotionBadge(trade.emotion)}</div>
                    </td>

                    {/* Risk Reward */}
                    <td className="py-4 px-4 whitespace-nowrap font-mono font-bold text-purple-400">
                      1:{trade.riskRewardRatio}
                    </td>

                    {/* PnL */}
                    <td className="py-4 px-4 whitespace-nowrap text-right font-mono font-bold text-sm">
                      <div
                        className={
                          trade.pnl > 0
                            ? "text-[#00E676]"
                            : trade.pnl < 0
                            ? "text-rose-400"
                            : "text-slate-400"
                        }
                      >
                        {(trade.pnlUnit ?? "USD") === "PERCENT"
                          ? `${trade.pnl > 0 ? "+" : ""}${trade.pnl}%`
                          : `${trade.pnl > 0 ? "+" : ""}${formatCurrency(trade.pnl)}`}
                      </div>
                    </td>

                    {/* Actions: AI Audit & Coach Message */}
                    <td className="py-4 px-4 whitespace-nowrap text-center">
                      <div className="flex items-center justify-center gap-2">
                        {/* Aperçu complet du trade */}
                        <button
                          onClick={() => setSelectedChartTrade(trade)}
                          className="p-1.5 rounded-lg bg-[#1B2320] text-slate-300 hover:text-[#00E676] hover:bg-[#232D29] transition-colors"
                          title="Voir l'aperçu complet du trade"
                        >
                          <Eye className="w-4 h-4" />
                        </button>

                        {/* Modifier la saisie */}
                        {!readOnly && (
                          <button
                            onClick={() => ouvrirEdition(trade)}
                            className="p-1.5 rounded-lg bg-[#1B2320] text-slate-400 hover:text-[#00E676] hover:bg-[#232D29]"
                            title="Modifier ce trade"
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                        )}

                        {/* Send to Coach button */}
                        {!hideAiAndCoachActions && (
                          <button
                            onClick={() => onSendTradeToCoach(trade)}
                            className="p-1.5 rounded-lg bg-[#1B2320] text-slate-400 hover:text-white hover:bg-[#232D29]"
                            title="Discuter de ce trade avec le coach"
                          >
                            <MessageSquare className="w-4 h-4 text-amber-400" />
                          </button>
                        )}

                        {/* Delete trade */}
                        {!readOnly && (
                          <button
                            onClick={() => onDeleteTrade(trade.id)}
                            className="p-1.5 rounded-lg bg-[#1B2320] text-slate-400 hover:text-rose-400 hover:bg-[#232D29]"
                            title="Supprimer la saisie"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Trade Modal */}
      {isAddModalOpen && !readOnly && (
        <div className="fixed inset-0 z-50 bg-[#0D1110]/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-[#111615] border border-[#1B2320] rounded-2xl max-w-2xl w-full p-6 space-y-6 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-[#1B2320] pb-4">
              <div>
                <span className="text-xs font-bold text-amber-400 uppercase tracking-wider">
                  {editingTrade ? "Modifier le trade" : "Nouveau Trade"}
                </span>
                <h3 className="text-lg font-bold text-white">
                  {editingTrade
                    ? `${editingTrade.pair} · ${editingTrade.date}`
                    : "Consigner une Position au Journal"}
                </h3>
              </div>
              <button
                onClick={fermerFormulaire}
                className="p-2 rounded-lg bg-[#1B2320] hover:bg-[#232D29] text-slate-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleFormSubmit} className="space-y-4">
              {/* Horodatage : entrée obligatoire, sortie laissée vide tant que
                  la position est ouverte. */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">Date d'entrée</label>
                  <input
                    type="date"
                    value={formData.date}
                    max={new Date().toISOString().split("T")[0]}
                    onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                    className="w-full bg-[#0D1110] border border-[#1B2320] rounded-lg p-2.5 text-xs text-white"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">Heure d'entrée</label>
                  <input
                    type="time"
                    value={formData.time}
                    onChange={(e) => setFormData({ ...formData, time: e.target.value })}
                    className="w-full bg-[#0D1110] border border-[#1B2320] rounded-lg p-2.5 text-xs text-white"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">Date de sortie</label>
                  <input
                    type="date"
                    value={formData.exitDate}
                    min={formData.date}
                    onChange={(e) => setFormData({ ...formData, exitDate: e.target.value })}
                    className="w-full bg-[#0D1110] border border-[#1B2320] rounded-lg p-2.5 text-xs text-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">Heure de sortie</label>
                  <input
                    type="time"
                    value={formData.exitTime}
                    onChange={(e) => setFormData({ ...formData, exitTime: e.target.value })}
                    className="w-full bg-[#0D1110] border border-[#1B2320] rounded-lg p-2.5 text-xs text-white"
                  />
                </div>
              </div>

              {/* Compte de rattachement. Volontairement **sans** `required` :
                  un trade peut légitimement n'appartenir à aucun portefeuille
                  suivi ici, et forcer un choix pousserait à en désigner un au
                  hasard — donnée fausse plutôt que donnée absente. */}
              {accounts.length > 0 && (
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">
                    Compte <span className="text-slate-600 font-normal">(facultatif)</span>
                  </label>
                  <select
                    value={formData.accountId}
                    onChange={(e) => setFormData({ ...formData, accountId: e.target.value })}
                    className="w-full bg-[#0D1110] border border-[#1B2320] rounded-lg p-2.5 text-xs text-white"
                  >
                    <option value={SANS_COMPTE}>— Non rattaché —</option>
                    {accounts.map((acc) => (
                      <option key={acc.id} value={acc.id}>
                        {acc.name} · {acc.firmOrBroker}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">Paire / Actif</label>
                  <input
                    type="text"
                    value={formData.pair}
                    onChange={(e) => setFormData({ ...formData, pair: e.target.value.toUpperCase() })}
                    placeholder="ex: EUR/USD, NAS100"
                    className="w-full bg-[#0D1110] border border-[#1B2320] rounded-lg p-2.5 text-xs text-white uppercase font-bold"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">Marché</label>
                  <select
                    value={formData.marketCategory}
                    onChange={(e) => setFormData({ ...formData, marketCategory: e.target.value as MarketCategory })}
                    className="w-full bg-[#0D1110] border border-[#1B2320] rounded-lg p-2.5 text-xs text-white"
                  >
                    <option value="Forex">Forex</option>
                    <option value="Crypto">Crypto</option>
                    <option value="Indices">Indices</option>
                    <option value="Matières Premières">Matières Premières</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">Sens</label>
                  <select
                    value={formData.direction}
                    onChange={(e) => setFormData({ ...formData, direction: e.target.value as TradeDirection })}
                    className="w-full bg-[#0D1110] border border-[#1B2320] rounded-lg p-2.5 text-xs text-white font-bold"
                  >
                    <option value="LONG">LONG (Achat)</option>
                    <option value="SHORT">SHORT (Vente)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">Prix d'Entrée</label>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={formData.entryPrice}
                    onChange={(e) => handleDecimalChange("entryPrice", e.target.value)}
                    className="w-full bg-[#0D1110] border border-[#1B2320] rounded-lg p-2.5 text-xs text-white font-mono"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">Stop Loss</label>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={formData.stopLoss}
                    onChange={(e) => handleDecimalChange("stopLoss", e.target.value)}
                    className="w-full bg-[#0D1110] border border-[#1B2320] rounded-lg p-2.5 text-xs text-white font-mono"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">Take Profit</label>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={formData.takeProfit}
                    onChange={(e) => handleDecimalChange("takeProfit", e.target.value)}
                    className="w-full bg-[#0D1110] border border-[#1B2320] rounded-lg p-2.5 text-xs text-white font-mono"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">Prix de Sortie (si fermé)</label>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={formData.exitPrice}
                    onChange={(e) => handleDecimalChange("exitPrice", e.target.value)}
                    className="w-full bg-[#0D1110] border border-[#1B2320] rounded-lg p-2.5 text-xs text-white font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">Taille de Lot / Position</label>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={formData.lotSize}
                    onChange={(e) => handleDecimalChange("lotSize", e.target.value)}
                    className="w-full bg-[#0D1110] border border-[#1B2320] rounded-lg p-2.5 text-xs text-white font-mono"
                    required
                  />
                </div>

                {/* PnL net : toujours saisi à la main, dans l'unité de son
                    choix. Aucun calcul, aucune conversion — l'utilisateur
                    tape le chiffre qu'il lit sur sa propre plateforme. */}
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">PnL</label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      inputMode="decimal"
                      value={formData.pnl}
                      onChange={(e) => handleDecimalChange("pnl", e.target.value, { allowNegative: true })}
                      className="w-full bg-[#0D1110] border border-[#1B2320] rounded-lg p-2.5 text-xs text-white font-mono"
                    />
                    <select
                      value={formData.pnlUnit}
                      onChange={(e) => setFormData({ ...formData, pnlUnit: e.target.value as PnlUnit })}
                      className="bg-[#0D1110] border border-[#1B2320] rounded-lg p-2.5 text-xs text-white font-bold"
                    >
                      <option value="USD">$</option>
                      <option value="PERCENT">%</option>
                    </select>
                  </div>
                  <p className="text-[10px] text-slate-500 mt-1 leading-snug">
                    Le chiffre que tu lis sur ta plateforme — aucun calcul de notre part.
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">Stratégie / Setup</label>
                  {setups.length > 0 ? (
                    <select
                      value={formData.strategy}
                      onChange={(e) => setFormData({ ...formData, strategy: e.target.value })}
                      className="w-full bg-[#0D1110] border border-[#1B2320] rounded-lg p-2.5 text-xs text-white"
                    >
                      <option value="">— Choisis un setup —</option>
                      {setups.map((setup) => (
                        <option key={setup.id} value={setup.name}>
                          {setup.name}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <p className="text-[11px] text-slate-500 bg-[#0D1110] border border-dashed border-[#1B2320] rounded-lg p-2.5">
                      Aucun setup enregistré — ajoutes-en un dans l'onglet « Setups ».
                    </p>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">État Émotionnel Lors du Trade</label>
                <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                  {[
                    { id: "Disciplined", label: "🧘 Discipliné" },
                    { id: "FOMO", label: "🚀 FOMO" },
                    { id: "Impulsive", label: "⚡ Impulsif" },
                    { id: "Anxious", label: "🤯 Anxieux" },
                    { id: "Calm", label: "🎯 Calme" },
                    { id: "Greedy", label: "💰 Avarice" },
                  ].map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setFormData({ ...formData, emotion: item.id as EmotionState })}
                      className={`p-2 rounded-lg border text-xs font-semibold text-center transition-all ${
                        formData.emotion === item.id
                          ? "bg-amber-500 text-slate-950 border-amber-400 font-bold"
                          : "bg-[#0D1110] border-[#1B2320] text-slate-400 hover:text-white"
                      }`}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">
                  Erreurs Commises (optionnel, plusieurs possibles)
                </label>
                <div className="flex flex-wrap gap-2">
                  {MISTAKE_OPTIONS.map((mistake) => {
                    const isSelected = formData.mistakes.includes(mistake);
                    return (
                      <button
                        key={mistake}
                        type="button"
                        onClick={() =>
                          setFormData({
                            ...formData,
                            mistakes: isSelected
                              ? formData.mistakes.filter((m) => m !== mistake)
                              : [...formData.mistakes, mistake],
                          })
                        }
                        className={`px-2.5 py-1.5 rounded-lg border text-xs font-semibold text-center transition-all ${
                          isSelected
                            ? "bg-rose-500 text-white border-rose-400 font-bold"
                            : "bg-[#0D1110] border-[#1B2320] text-slate-400 hover:text-white"
                        }`}
                      >
                        {mistake}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">Notes & Réflexion Personnelle</label>
                <textarea
                  rows={2}
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  placeholder="Expliquez votre analyse, confluence ou ce que vous avez ressenti pendant le trade..."
                  className="w-full bg-[#0D1110] border border-[#1B2320] rounded-lg p-2.5 text-xs text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">
                  Capture d'écran du trade
                </label>
                {formData.chartUrl ? (
                  <div className="relative rounded-lg overflow-hidden border border-[#1B2320] group">
                    <img
                      src={formData.chartUrl}
                      alt="Capture d'écran du trade"
                      className="w-full max-h-56 object-contain bg-[#0D1110]"
                    />
                    <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                      <label className="px-3 py-1.5 rounded-lg bg-[#1B2320] text-white text-xs font-semibold cursor-pointer hover:bg-[#232D29]">
                        Remplacer
                        <input
                          type="file"
                          accept="image/*"
                          onChange={handleChartUpload}
                          className="hidden"
                        />
                      </label>
                      <button
                        type="button"
                        onClick={() => setFormData({ ...formData, chartUrl: "" })}
                        className="px-3 py-1.5 rounded-lg bg-rose-500/80 text-white text-xs font-semibold hover:bg-rose-500"
                      >
                        Retirer
                      </button>
                    </div>
                  </div>
                ) : (
                  <label
                    className={`flex items-center justify-center gap-2 w-full border border-dashed border-[#1B2320] rounded-lg p-4 text-xs text-slate-400 cursor-pointer hover:border-[#00E676]/40 hover:text-slate-200 transition-colors ${
                      isResizingChart ? "opacity-60 pointer-events-none" : ""
                    }`}
                  >
                    {isResizingChart ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Traitement de l'image…
                      </>
                    ) : (
                      <>
                        <ImagePlus className="w-4 h-4" />
                        Ajouter une capture d'écran (JPEG, PNG, WebP)
                      </>
                    )}
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleChartUpload}
                      disabled={isResizingChart}
                      className="hidden"
                    />
                  </label>
                )}
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-[#1B2320]">
                <button
                  type="button"
                  onClick={fermerFormulaire}
                  className="px-4 py-2 rounded-xl bg-[#1B2320] text-slate-300 text-xs font-semibold"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs shadow-lg shadow-amber-500/20"
                >
                  {editingTrade ? "Enregistrer les modifications" : "Enregistrer au Journal"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Aperçu complet du trade */}
      {selectedChartTrade && (
        <div className="fixed inset-0 z-50 bg-[#0D1110]/85 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-[#111615] border border-[#1B2320] rounded-2xl max-w-4xl w-full p-6 space-y-5 shadow-2xl relative max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-[#1B2320] pb-3">
              <div className="flex items-center gap-2.5 flex-wrap">
                <span className="px-2.5 py-1 rounded bg-[#00E676]/10 text-[#00E676] text-xs font-mono font-bold border border-[#00E676]/30">
                  {selectedChartTrade.pair} • {selectedChartTrade.direction}
                </span>
                <span className="text-sm font-bold text-white">{selectedChartTrade.strategy}</span>
                <span className="text-xs text-slate-400 font-mono">1:{selectedChartTrade.riskRewardRatio} R:R</span>
              </div>
              <button
                onClick={() => setSelectedChartTrade(null)}
                className="p-1.5 rounded-lg bg-[#1B2320] text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Capture d'écran, ou message d'absence */}
            {selectedChartTrade.chartUrl ? (
              <div className="rounded-xl overflow-hidden border border-[#1B2320] bg-black max-h-[50vh] flex items-center justify-center">
                <img
                  src={selectedChartTrade.chartUrl}
                  alt={`Capture d'écran ${selectedChartTrade.pair}`}
                  className="w-full h-full object-contain"
                />
              </div>
            ) : (
              <div className="rounded-xl border border-dashed border-[#1B2320] bg-[#0D1110] p-6 text-center text-xs text-slate-500 italic">
                Aucune capture d'écran jointe à ce trade.
              </div>
            )}

            {/* Résumé complet de la saisie */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
              <div className="bg-[#0D1110] border border-[#1B2320] rounded-lg p-3">
                <div className="text-[9px] uppercase tracking-wider text-slate-500 font-bold mb-0.5">Compte</div>
                <div className="text-white font-semibold">
                  {nomDuCompte(selectedChartTrade.accountId) ?? "Non rattaché"}
                </div>
              </div>
              <div className="bg-[#0D1110] border border-[#1B2320] rounded-lg p-3">
                <div className="text-[9px] uppercase tracking-wider text-slate-500 font-bold mb-0.5">Marché</div>
                <div className="text-white font-semibold">{selectedChartTrade.marketCategory}</div>
              </div>
              <div className="bg-[#0D1110] border border-[#1B2320] rounded-lg p-3">
                <div className="text-[9px] uppercase tracking-wider text-slate-500 font-bold mb-0.5">Résultat</div>
                <div className="text-white font-semibold">{selectedChartTrade.result}</div>
              </div>

              <div className="bg-[#0D1110] border border-[#1B2320] rounded-lg p-3">
                <div className="text-[9px] uppercase tracking-wider text-slate-500 font-bold mb-0.5">Entrée</div>
                <div className="text-white font-mono">
                  {selectedChartTrade.date} {selectedChartTrade.time}
                </div>
              </div>
              <div className="bg-[#0D1110] border border-[#1B2320] rounded-lg p-3">
                <div className="text-[9px] uppercase tracking-wider text-slate-500 font-bold mb-0.5">Sortie</div>
                <div className="text-white font-mono">
                  {selectedChartTrade.exitDate
                    ? `${selectedChartTrade.exitDate} ${selectedChartTrade.exitTime ?? ""}`
                    : "Position ouverte"}
                </div>
              </div>
              <div className="bg-[#0D1110] border border-[#1B2320] rounded-lg p-3">
                <div className="text-[9px] uppercase tracking-wider text-slate-500 font-bold mb-0.5">Taille de lot</div>
                <div className="text-white font-mono">{selectedChartTrade.lotSize}</div>
              </div>

              <div className="bg-[#0D1110] border border-[#1B2320] rounded-lg p-3">
                <div className="text-[9px] uppercase tracking-wider text-slate-500 font-bold mb-0.5">Prix d'entrée</div>
                <div className="text-white font-mono">{selectedChartTrade.entryPrice}</div>
              </div>
              <div className="bg-[#0D1110] border border-[#1B2320] rounded-lg p-3">
                <div className="text-[9px] uppercase tracking-wider text-slate-500 font-bold mb-0.5">Stop Loss</div>
                <div className="text-white font-mono">{selectedChartTrade.stopLoss}</div>
              </div>
              <div className="bg-[#0D1110] border border-[#1B2320] rounded-lg p-3">
                <div className="text-[9px] uppercase tracking-wider text-slate-500 font-bold mb-0.5">Take Profit</div>
                <div className="text-white font-mono">{selectedChartTrade.takeProfit}</div>
              </div>

              <div className="bg-[#0D1110] border border-[#1B2320] rounded-lg p-3">
                <div className="text-[9px] uppercase tracking-wider text-slate-500 font-bold mb-0.5">Prix de sortie</div>
                <div className="text-white font-mono">
                  {selectedChartTrade.exitPrice || "—"}
                </div>
              </div>
              <div className="bg-[#0D1110] border border-[#1B2320] rounded-lg p-3">
                <div className="text-[9px] uppercase tracking-wider text-slate-500 font-bold mb-0.5">PnL net</div>
                <div
                  className={`font-mono font-bold ${
                    selectedChartTrade.pnl > 0
                      ? "text-[#00E676]"
                      : selectedChartTrade.pnl < 0
                      ? "text-rose-400"
                      : "text-slate-300"
                  }`}
                >
                  {(selectedChartTrade.pnlUnit ?? "USD") === "PERCENT"
                    ? `${selectedChartTrade.pnl > 0 ? "+" : ""}${selectedChartTrade.pnl}%`
                    : `${selectedChartTrade.pnl > 0 ? "+" : ""}${formatCurrency(selectedChartTrade.pnl)}`}
                </div>
              </div>
              <div className="bg-[#0D1110] border border-[#1B2320] rounded-lg p-3">
                <div className="text-[9px] uppercase tracking-wider text-slate-500 font-bold mb-0.5">État émotionnel</div>
                <div>{getEmotionBadge(selectedChartTrade.emotion)}</div>
              </div>
            </div>

            {selectedChartTrade.mistakes && selectedChartTrade.mistakes.length > 0 && (
              <div className="p-4 rounded-xl bg-[#0D1110] border border-[#1B2320] space-y-2 text-xs">
                <div className="font-bold text-rose-400 font-mono">Erreurs Commises :</div>
                <div className="flex flex-wrap gap-1.5">
                  {selectedChartTrade.mistakes.map((mistake) => (
                    <span
                      key={mistake}
                      className="px-2 py-1 rounded bg-rose-500/10 border border-rose-500/20 text-rose-400 text-[11px] font-semibold"
                    >
                      {mistake}
                    </span>
                  ))}
                </div>
              </div>
            )}

            <div className="p-4 rounded-xl bg-[#0D1110] border border-[#1B2320] space-y-2 text-xs">
              <div className="font-bold text-[#00E676] font-mono">Reflexion & Note Technique :</div>
              <p className="text-slate-300 leading-relaxed">{selectedChartTrade.notes || "Aucune note saisie."}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
