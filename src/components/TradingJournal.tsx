import React, { useState, useEffect } from "react";
import {
  Plus,
  Search,
  Filter,
  Sparkles,
  ArrowUpRight,
  ArrowDownRight,
  Trash2,
  ExternalLink,
  MessageSquare,
  BarChart3,
  CheckCircle2,
  XCircle,
  Clock,
  Zap,
  TrendingUp,
  Brain,
  ShieldCheck,
  Tag,
  Smile,
  AlertTriangle,
  Award,
  Calculator,
  Download,
  Eye,
  X
} from "lucide-react";
import { Trade, TradeDirection, TradeResult, EmotionState, MarketCategory, TradeDraft } from "../types";

interface TradingJournalProps {
  trades: Trade[];
  onAddTrade: (trade: Omit<Trade, "id">) => void;
  onDeleteTrade: (id: string) => void;
  onSelectTradeForAudit: (trade: Trade) => void;
  onSendTradeToCoach: (trade: Trade) => void;
  onOpenCalculator?: () => void;
  /** Ébauche envoyée par le calculateur de position ou l'analyseur de setup IA. */
  prefillDraft?: TradeDraft | null;
  /** Appelé une fois l'ébauche appliquée, pour que le parent la remette à null. */
  onPrefillConsumed?: () => void;
}

export const TradingJournal: React.FC<TradingJournalProps> = ({
  trades,
  onAddTrade,
  onDeleteTrade,
  onSelectTradeForAudit,
  onSendTradeToCoach,
  onOpenCalculator,
  prefillDraft,
  onPrefillConsumed,
}) => {
  const [searchPair, setSearchPair] = useState("");
  const [selectedMarket, setSelectedMarket] = useState<string>("Tous");
  const [selectedResult, setSelectedResult] = useState<string>("Tous");
  const [selectedEmotion, setSelectedEmotion] = useState<string>("Tous");
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [selectedChartTrade, setSelectedChartTrade] = useState<Trade | null>(null);

  const exportToCSV = () => {
    if (trades.length === 0) return;
    const headers = [
      "ID",
      "Date",
      "Heure",
      "Paire",
      "Marche",
      "Direction",
      "Prix Entree",
      "Stop Loss",
      "Take Profit",
      "Prix Sortie",
      "Taille Lot",
      "PnL (€)",
      "PnL (%)",
      "Ratio RR",
      "Resultat",
      "Strategie",
      "Emotion",
      "Notes"
    ];
    const rows = trades.map((t) => [
      t.id,
      t.date,
      t.time || "",
      t.pair,
      t.marketCategory,
      t.direction,
      t.entryPrice,
      t.stopLoss,
      t.takeProfit,
      t.exitPrice || "",
      t.lotSize,
      t.pnl,
      t.pnlPercentage,
      t.riskRewardRatio,
      t.result,
      `"${t.strategy.replace(/"/g, '""')}"`,
      t.emotion,
      `"${(t.notes || "").replace(/"/g, '""')}"`
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
    pair: "EUR/USD",
    marketCategory: "Forex" as MarketCategory,
    direction: "LONG" as TradeDirection,
    entryPrice: 1.0850,
    stopLoss: 1.0830,
    takeProfit: 1.0910,
    exitPrice: 1.0910,
    lotSize: 1.0,
    strategy: "SMC Orderblock",
    emotion: "Disciplined" as EmotionState,
    notes: "Validation FVG H1 + Chasse de liquidité.",
    chartUrl: "https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?auto=format&fit=crop&q=80&w=800",
  });

  // Applique une ébauche venue du calculateur / de l'analyseur IA, puis ouvre le formulaire.
  // Seules les clés fournies écrasent les valeurs par défaut ci-dessus.
  useEffect(() => {
    if (!prefillDraft) return;
    setFormData((prev) => {
      const next = { ...prev };
      (Object.keys(prefillDraft) as (keyof TradeDraft)[]).forEach((key) => {
        const value = prefillDraft[key];
        if (value !== undefined) {
          (next as Record<string, unknown>)[key] = value;
        }
      });
      return next;
    });
    setIsAddModalOpen(true);
    onPrefillConsumed?.();
  }, [prefillDraft, onPrefillConsumed]);

  // Calculate Summary Statistics
  const totalTrades = trades.length;
  const winTrades = trades.filter((t) => t.result === "WIN").length;
  const lossTrades = trades.filter((t) => t.result === "LOSS").length;
  const winRate = totalTrades > 0 ? Math.round((winTrades / totalTrades) * 100) : 0;
  
  const totalPnL = trades.reduce((acc, t) => acc + t.pnl, 0);
  const totalGains = trades.filter((t) => t.pnl > 0).reduce((acc, t) => acc + t.pnl, 0);
  const totalLosses = Math.abs(trades.filter((t) => t.pnl < 0).reduce((acc, t) => acc + t.pnl, 0));
  const profitFactor = totalLosses > 0 ? (totalGains / totalLosses).toFixed(2) : "N/A";

  const avgRR =
    totalTrades > 0
      ? (trades.reduce((acc, t) => acc + t.riskRewardRatio, 0) / totalTrades).toFixed(1)
      : "0";

  // Filtering
  const filteredTrades = trades.filter((t) => {
    const matchesPair = t.pair.toLowerCase().includes(searchPair.toLowerCase()) || t.strategy.toLowerCase().includes(searchPair.toLowerCase());
    const matchesMarket = selectedMarket === "Tous" || t.marketCategory === selectedMarket;
    const matchesResult = selectedResult === "Tous" || t.result === selectedResult;
    const matchesEmotion = selectedEmotion === "Tous" || t.emotion === selectedEmotion;
    return matchesPair && matchesMarket && matchesResult && matchesEmotion;
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

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // Auto calculate PnL & R:R
    const riskPipsOrPrice = Math.abs(formData.entryPrice - formData.stopLoss);
    const rewardPipsOrPrice = Math.abs(formData.takeProfit - formData.entryPrice);
    const riskReward = riskPipsOrPrice > 0 ? Number((rewardPipsOrPrice / riskPipsOrPrice).toFixed(1)) : 1;

    let pnl = 0;
    let result: TradeResult = "OPEN";

    if (formData.exitPrice) {
      if (formData.direction === "LONG") {
        pnl = (formData.exitPrice - formData.entryPrice) * formData.lotSize * 1000;
      } else {
        pnl = (formData.entryPrice - formData.exitPrice) * formData.lotSize * 1000;
      }

      if (pnl > 50) result = "WIN";
      else if (pnl < -50) result = "LOSS";
      else result = "BREAKEVEN";
    }

    const pnlPercentage = Number(((pnl / 10000) * 100).toFixed(1));

    onAddTrade({
      date: formData.date,
      time: formData.time,
      pair: formData.pair,
      marketCategory: formData.marketCategory,
      direction: formData.direction,
      entryPrice: Number(formData.entryPrice),
      stopLoss: Number(formData.stopLoss),
      takeProfit: Number(formData.takeProfit),
      exitPrice: Number(formData.exitPrice),
      lotSize: Number(formData.lotSize),
      pnl: Math.round(pnl),
      pnlPercentage,
      riskRewardRatio: riskReward,
      result,
      strategy: formData.strategy,
      emotion: formData.emotion,
      notes: formData.notes,
      chartUrl: formData.chartUrl,
    });

    setIsAddModalOpen(false);
  };

  return (
    <div className="space-y-8 pb-12">
      {/* Header & New Trade Trigger */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-[#111615] p-6 rounded-2xl border border-[#1B2320] shadow-sm">
        <div className="space-y-1">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#00E676]/10 text-[#00E676] text-xs font-semibold border border-[#00E676]/20">
            <Zap className="w-3.5 h-3.5" />
            Journal de Trading Professionnel
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
            Carnet d'Exécution & Registre Émotionnel
          </h1>
          <p className="text-slate-400 text-xs sm:text-sm">
            Consignez chaque position, vos niveaux techniques et votre état d'esprit pour obtenir des audits IA automatisés par votre coach.
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

          <button
            onClick={() => setIsAddModalOpen(true)}
            className="flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-[#00E676] hover:bg-[#00c865] text-slate-950 font-extrabold text-sm shadow-md transition-all shrink-0 cursor-pointer"
          >
            <Plus className="w-5 h-5" />
            <span>Saisir un Trade</span>
          </button>
        </div>
      </div>

      {/* Metric Cards Bar */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <div className="bg-[#111615] border border-[#1B2320] p-4 rounded-xl space-y-1 shadow-sm">
          <div className="text-xs text-slate-400 font-medium">Taux de Réussite</div>
          <div className="text-2xl font-black text-[#00E676] font-mono">{winRate}%</div>
          <div className="text-[11px] text-slate-500">{winTrades} W / {lossTrades} L</div>
        </div>

        <div className="bg-[#111615] border border-[#1B2320] p-4 rounded-xl space-y-1 shadow-sm">
          <div className="text-xs text-slate-400 font-medium">PnL Cumulé</div>
          <div className={`text-2xl font-black font-mono ${totalPnL >= 0 ? "text-[#00E676]" : "text-rose-400"}`}>
            {totalPnL >= 0 ? `+${totalPnL} €` : `${totalPnL} €`}
          </div>
          <div className="text-[11px] text-slate-500">{totalTrades} positions fermées</div>
        </div>

        <div className="bg-[#111615] border border-[#1B2320] p-4 rounded-xl space-y-1 shadow-sm">
          <div className="text-xs text-slate-400 font-medium">Profit Factor</div>
          <div className="text-2xl font-black text-white font-mono">{profitFactor}</div>
          <div className="text-[11px] text-slate-500">Gains vs Pertes</div>
        </div>

        <div className="bg-[#111615]/90 border border-[#1B2320] p-4 rounded-xl space-y-1 shadow-md">
          <div className="text-xs text-slate-400 font-medium">Ratio R:R Moyen</div>
          <div className="text-2xl font-black text-purple-400 font-mono">1:{avgRR}</div>
          <div className="text-[11px] text-slate-500">Espérance par trade</div>
        </div>

        <div className="col-span-2 md:col-span-1 bg-[#111615]/90 border border-[#1B2320] p-4 rounded-xl space-y-1 shadow-md">
          <div className="text-xs text-slate-400 font-medium">Discipline Émotionnelle</div>
          <div className="text-2xl font-black text-[#00E676] font-mono">
            {totalTrades > 0
              ? `${Math.round((trades.filter((t) => t.emotion === "Disciplined" || t.emotion === "Calm").length / totalTrades) * 100)}%`
              : "100%"}
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
      <div className="bg-[#111615] border border-[#1B2320] rounded-2xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-[#0D1110]/80 text-slate-400 font-semibold border-b border-[#1B2320]">
              <tr>
                <th className="py-3.5 px-4">Date & Heure</th>
                <th className="py-3.5 px-4">Actif / Paire</th>
                <th className="py-3.5 px-4">Direction</th>
                <th className="py-3.5 px-4">Entrée → TP / SL</th>
                <th className="py-3.5 px-4">Stratégie & Émotion</th>
                <th className="py-3.5 px-4">R:R</th>
                <th className="py-3.5 px-4 text-right">PnL Net (€)</th>
                <th className="py-3.5 px-4 text-center">Actions Coach IA</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1B2320]/60">
              {filteredTrades.length === 0 ? (
                <tr>
                  <td colSpan={8} className="text-center py-12 text-slate-500">
                    Aucun trade trouvé correspondant aux critères de recherche.
                  </td>
                </tr>
              ) : (
                filteredTrades.map((trade) => (
                  <tr key={trade.id} className="hover:bg-[#151D1A]/80 transition-colors">
                    {/* Date */}
                    <td className="py-4 px-4 whitespace-nowrap">
                      <div className="font-semibold text-slate-200">{trade.date}</div>
                      <div className="text-[10px] text-slate-500 font-mono">{trade.time || "--:--"}</div>
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
                        {trade.pnl > 0 ? `+${trade.pnl} €` : `${trade.pnl} €`}
                      </div>
                      <div className="text-[10px] text-slate-500">
                        ({trade.pnlPercentage > 0 ? `+${trade.pnlPercentage}%` : `${trade.pnlPercentage}%`})
                      </div>
                    </td>

                    {/* Actions: AI Audit & Coach Message */}
                    <td className="py-4 px-4 whitespace-nowrap text-center">
                      <div className="flex items-center justify-center gap-2">
                        {/* View Chart Screenshot */}
                        {trade.chartUrl && (
                          <button
                            onClick={() => setSelectedChartTrade(trade)}
                            className="p-1.5 rounded-lg bg-[#1B2320] text-slate-300 hover:text-[#00E676] hover:bg-[#1B2320] transition-colors"
                            title="Agrandir le graphique du trade"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                        )}

                        {/* Gemini AI Audit button */}
                        <button
                          onClick={() => onSelectTradeForAudit(trade)}
                          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                            trade.aiAudit
                              ? "bg-amber-500/20 text-amber-300 border border-amber-500/40 hover:bg-amber-500/30"
                              : "bg-gradient-to-r from-amber-500 to-amber-400 text-slate-950 font-bold hover:brightness-110 shadow-sm"
                          }`}
                          title="Obtenir un audit IA Gemini"
                        >
                          <Sparkles className="w-3.5 h-3.5" />
                          <span>{trade.aiAudit ? "Voir Audit" : "Audit IA"}</span>
                        </button>

                        {/* Send to Coach button */}
                        <button
                          onClick={() => onSendTradeToCoach(trade)}
                          className="p-1.5 rounded-lg bg-[#1B2320] text-slate-400 hover:text-white hover:bg-[#232D29]"
                          title="Discuter de ce trade avec le coach"
                        >
                          <MessageSquare className="w-4 h-4 text-amber-400" />
                        </button>

                        {/* Delete trade */}
                        <button
                          onClick={() => onDeleteTrade(trade.id)}
                          className="p-1.5 rounded-lg bg-[#1B2320] text-slate-400 hover:text-rose-400 hover:bg-[#232D29]"
                          title="Supprimer la saisie"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
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
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 bg-[#0D1110]/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-[#111615] border border-[#1B2320] rounded-2xl max-w-2xl w-full p-6 space-y-6 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-[#1B2320] pb-4">
              <div>
                <span className="text-xs font-bold text-amber-400 uppercase tracking-wider">
                  Nouveau Trade
                </span>
                <h3 className="text-lg font-bold text-white">Consigner une Position au Journal</h3>
              </div>
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="p-2 rounded-lg bg-[#1B2320] hover:bg-[#232D29] text-slate-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleFormSubmit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">Date</label>
                  <input
                    type="date"
                    value={formData.date}
                    onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                    className="w-full bg-[#0D1110] border border-[#1B2320] rounded-lg p-2.5 text-xs text-white"
                    required
                  />
                </div>

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
                    type="number"
                    step="any"
                    value={formData.entryPrice}
                    onChange={(e) => setFormData({ ...formData, entryPrice: parseFloat(e.target.value) || 0 })}
                    className="w-full bg-[#0D1110] border border-[#1B2320] rounded-lg p-2.5 text-xs text-white font-mono"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">Stop Loss</label>
                  <input
                    type="number"
                    step="any"
                    value={formData.stopLoss}
                    onChange={(e) => setFormData({ ...formData, stopLoss: parseFloat(e.target.value) || 0 })}
                    className="w-full bg-[#0D1110] border border-[#1B2320] rounded-lg p-2.5 text-xs text-white font-mono"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">Take Profit</label>
                  <input
                    type="number"
                    step="any"
                    value={formData.takeProfit}
                    onChange={(e) => setFormData({ ...formData, takeProfit: parseFloat(e.target.value) || 0 })}
                    className="w-full bg-[#0D1110] border border-[#1B2320] rounded-lg p-2.5 text-xs text-white font-mono"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">Prix de Sortie (si fermé)</label>
                  <input
                    type="number"
                    step="any"
                    value={formData.exitPrice}
                    onChange={(e) => setFormData({ ...formData, exitPrice: parseFloat(e.target.value) || 0 })}
                    className="w-full bg-[#0D1110] border border-[#1B2320] rounded-lg p-2.5 text-xs text-white font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">Taille de Lot / Position</label>
                  <input
                    type="number"
                    step="any"
                    value={formData.lotSize}
                    onChange={(e) => setFormData({ ...formData, lotSize: parseFloat(e.target.value) || 1 })}
                    className="w-full bg-[#0D1110] border border-[#1B2320] rounded-lg p-2.5 text-xs text-white font-mono"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">Stratégie / Setup</label>
                  <select
                    value={formData.strategy}
                    onChange={(e) => setFormData({ ...formData, strategy: e.target.value })}
                    className="w-full bg-[#0D1110] border border-[#1B2320] rounded-lg p-2.5 text-xs text-white"
                  >
                    <option value="SMC Orderblock">SMC Orderblock</option>
                    <option value="Breakout FVG">Breakout Fair Value Gap</option>
                    <option value="Liquidity Sweep">Liquidity Sweep (BSL/SSL)</option>
                    <option value="Trend Following">Trend Following</option>
                    <option value="Reversal CHoCH">Reversal CHoCH</option>
                  </select>
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
                <label className="block text-xs font-semibold text-slate-400 mb-1">Notes & Réflexion Personnelle</label>
                <textarea
                  rows={2}
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  placeholder="Expliquez votre analyse, confluence ou ce que vous avez ressenti pendant le trade..."
                  className="w-full bg-[#0D1110] border border-[#1B2320] rounded-lg p-2.5 text-xs text-white"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-[#1B2320]">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-[#1B2320] text-slate-300 text-xs font-semibold"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs shadow-lg shadow-amber-500/20"
                >
                  Enregistrer au Journal
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Chart Screenshot Modal */}
      {selectedChartTrade && (
        <div className="fixed inset-0 z-50 bg-[#0D1110]/85 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-[#111615] border border-[#1B2320] rounded-2xl max-w-4xl w-full p-6 space-y-4 shadow-2xl relative max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-[#1B2320] pb-3">
              <div className="flex items-center gap-2.5">
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

            <div className="rounded-xl overflow-hidden border border-[#1B2320] bg-black max-h-[60vh] flex items-center justify-center">
              <img
                src={selectedChartTrade.chartUrl}
                alt={`Graphique ${selectedChartTrade.pair}`}
                className="w-full h-full object-contain"
              />
            </div>

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
