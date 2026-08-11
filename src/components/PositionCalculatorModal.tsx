import React, { useState } from "react";
import { Calculator, Shield, DollarSign, ArrowRight, Check, X, AlertCircle } from "lucide-react";
import { formatCurrency } from "../lib/format";

interface PositionCalculatorModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultCapital: number;
  onApplyToJournal?: (calculatedData: {
    pair: string;
    entryPrice: number;
    stopLoss: number;
    takeProfit: number;
    lotSize: number;
    riskAmount: number;
    riskRewardRatio: number;
  }) => void;
}

export const PositionCalculatorModal: React.FC<PositionCalculatorModalProps> = ({
  isOpen,
  onClose,
  defaultCapital,
  onApplyToJournal,
}) => {
  const [pair, setPair] = useState("EUR/USD");
  const [capital, setCapital] = useState<number>(defaultCapital || 25000);
  const [riskPercent, setRiskPercent] = useState<number>(1); // 1%
  const [entryPrice, setEntryPrice] = useState<number>(1.0850);
  const [stopLoss, setStopLoss] = useState<number>(1.0820);
  const [takeProfit, setTakeProfit] = useState<number>(1.0940);
  const [direction, setDirection] = useState<"LONG" | "SHORT">("LONG");
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  // Calculation Logic
  const riskAmount = (capital * riskPercent) / 100;
  
  // Calculate Pips / Points difference
  const isIndices = pair.includes("NAS") || pair.includes("US30") || pair.includes("GER40");
  const isCrypto = pair.includes("BTC") || pair.includes("ETH");
  const isJpy = pair.includes("JPY");

  let pipMultiplier = 10000; // Standard Forex 4 decimals
  if (isJpy) pipMultiplier = 100;
  if (isIndices || isCrypto) pipMultiplier = 1;

  const priceDiff = direction === "LONG" ? entryPrice - stopLoss : stopLoss - entryPrice;
  const pipsSL = Math.abs(priceDiff * pipMultiplier);

  const profitDiff = direction === "LONG" ? takeProfit - entryPrice : entryPrice - takeProfit;
  const pipsTP = Math.abs(profitDiff * pipMultiplier);

  const riskRewardRatio = pipsSL > 0 ? parseFloat((pipsTP / pipsSL).toFixed(2)) : 0;
  const potentialReward = riskAmount * riskRewardRatio;

  // Calculate Lot Size
  // 1 standard forex lot = 100,000 units = $10 per pip on EUR/USD
  let lotSize = 0;
  if (pipsSL > 0) {
    if (isIndices) {
      lotSize = parseFloat((riskAmount / (pipsSL || 1)).toFixed(2));
    } else if (isCrypto) {
      lotSize = parseFloat((riskAmount / (pipsSL || 1)).toFixed(3));
    } else {
      // Forex standard lot: 1 Pip = $10 for 1 lot
      const pipValuePerLot = isJpy ? 7.5 : 10;
      lotSize = parseFloat((riskAmount / (pipsSL * pipValuePerLot)).toFixed(2));
    }
  }

  const handleApply = () => {
    if (onApplyToJournal) {
      onApplyToJournal({
        pair,
        entryPrice,
        stopLoss,
        takeProfit,
        lotSize,
        riskAmount,
        riskRewardRatio,
      });
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-[#0D1110]/80 backdrop-blur-md flex items-center justify-center p-4 font-sans">
      <div className="bg-[#111615] border border-[#1B2320] rounded-2xl max-w-xl w-full p-6 space-y-6 shadow-2xl relative text-slate-100">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#1B2320] pb-4">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-[#00E676]/10 text-[#00E676] border border-[#00E676]/20">
              <Calculator className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">Calculateur de Risk & Position Size</h3>
              <p className="text-xs text-slate-400">Calculez précisément vos lots MetaTrader & Prop Firm</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg bg-[#1B2320] hover:bg-[#232D29] text-slate-400 hover:text-white transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Direction Switch */}
        <div className="grid grid-cols-2 gap-2 bg-[#0D1110] p-1 rounded-xl border border-[#1B2320] text-xs font-bold">
          <button
            onClick={() => {
              setDirection("LONG");
              if (stopLoss > entryPrice) {
                const temp = stopLoss;
                setStopLoss(entryPrice);
                setEntryPrice(temp);
              }
            }}
            className={`py-2 rounded-lg transition-all ${
              direction === "LONG"
                ? "bg-[#00E676] text-slate-950 shadow-md font-extrabold"
                : "text-slate-400 hover:text-white"
            }`}
          >
            ACHAT (LONG) 📈
          </button>
          <button
            onClick={() => {
              setDirection("SHORT");
              if (stopLoss < entryPrice) {
                const temp = stopLoss;
                setStopLoss(entryPrice);
                setEntryPrice(temp);
              }
            }}
            className={`py-2 rounded-lg transition-all ${
              direction === "SHORT"
                ? "bg-rose-500 text-white shadow-md font-extrabold"
                : "text-slate-400 hover:text-white"
            }`}
          >
            VENTE (SHORT) 📉
          </button>
        </div>

        {/* Form Inputs Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs font-mono">
          <div>
            <label className="block text-slate-400 mb-1 font-sans">Paire / Instrument</label>
            <select
              value={pair}
              onChange={(e) => setPair(e.target.value)}
              className="w-full bg-[#0D1110] border border-[#1B2320] rounded-xl px-3 py-2.5 text-white font-bold focus:outline-none focus:border-[#00E676]"
            >
              <option value="EUR/USD">EUR/USD (Forex)</option>
              <option value="GBP/USD">GBP/USD (Forex)</option>
              <option value="USD/JPY">USD/JPY (Forex)</option>
              <option value="XAU/USD">XAU/USD (Or)</option>
              <option value="NAS100">NAS100 (Indice US)</option>
              <option value="US30">US30 (Dow Jones)</option>
              <option value="BTC/USDT">BTC/USDT (Crypto)</option>
            </select>
          </div>

          <div>
            <label className="block text-slate-400 mb-1 font-sans">Capital du Compte ($)</label>
            <input
              type="number"
              value={capital}
              onChange={(e) => setCapital(Number(e.target.value))}
              className="w-full bg-[#0D1110] border border-[#1B2320] rounded-xl px-3 py-2.5 text-white font-bold focus:outline-none focus:border-[#00E676]"
            />
          </div>

          <div>
            <label className="block text-slate-400 mb-1 font-sans">Risque % par Trade</label>
            <div className="flex gap-1.5">
              {[0.5, 1, 2].map((r) => (
                <button
                  key={r}
                  onClick={() => setRiskPercent(r)}
                  className={`px-2.5 py-1.5 rounded-lg border text-xs font-bold transition-all ${
                    riskPercent === r
                      ? "bg-[#00E676]/15 border-[#00E676] text-[#00E676]"
                      : "bg-[#0D1110] border-[#1B2320] text-slate-400"
                  }`}
                >
                  {r}%
                </button>
              ))}
              <input
                type="number"
                step="0.1"
                value={riskPercent}
                onChange={(e) => setRiskPercent(Number(e.target.value))}
                className="w-16 bg-[#0D1110] border border-[#1B2320] rounded-lg px-2 text-center text-white font-bold"
              />
            </div>
          </div>

          <div>
            <label className="block text-slate-400 mb-1 font-sans">Prix d'Entrée</label>
            <input
              type="number"
              step="0.0001"
              value={entryPrice}
              onChange={(e) => setEntryPrice(Number(e.target.value))}
              className="w-full bg-[#0D1110] border border-[#1B2320] rounded-xl px-3 py-2.5 text-white font-bold focus:outline-none focus:border-[#00E676]"
            />
          </div>

          <div>
            <label className="block text-slate-400 mb-1 font-sans">Stop Loss (SL)</label>
            <input
              type="number"
              step="0.0001"
              value={stopLoss}
              onChange={(e) => setStopLoss(Number(e.target.value))}
              className="w-full bg-[#0D1110] border border-[#1B2320] rounded-xl px-3 py-2.5 text-white font-bold focus:outline-none focus:border-rose-500"
            />
          </div>

          <div>
            <label className="block text-slate-400 mb-1 font-sans">Take Profit (TP)</label>
            <input
              type="number"
              step="0.0001"
              value={takeProfit}
              onChange={(e) => setTakeProfit(Number(e.target.value))}
              className="w-full bg-[#0D1110] border border-[#1B2320] rounded-xl px-3 py-2.5 text-white font-bold focus:outline-none focus:border-[#00E676]"
            />
          </div>
        </div>

        {/* Calculated Results Card */}
        <div className="bg-[#0D1110] border border-[#00E676]/30 rounded-xl p-4 space-y-3 font-mono">
          <div className="flex items-center justify-between text-xs border-b border-[#1B2320] pb-2">
            <span className="text-slate-400 font-sans">Montant Risqué :</span>
            <span className="text-rose-400 font-bold">-{formatCurrency(riskAmount)}</span>
          </div>

          <div className="grid grid-cols-2 gap-3 text-center">
            <div className="bg-[#111615] p-3 rounded-lg border border-[#1B2320]">
              <span className="text-[10px] text-slate-400 block uppercase font-sans">Taille du Lot à Passer</span>
              <span className="text-xl font-black text-[#00E676]">{lotSize} Lot(s)</span>
              <span className="text-[10px] text-slate-500 block">({pipsSL.toFixed(1)} Pips / Points SL)</span>
            </div>

            <div className="bg-[#111615] p-3 rounded-lg border border-[#1B2320]">
              <span className="text-[10px] text-slate-400 block uppercase font-sans">Ratio R:R & Gain Potentiel</span>
              <span className="text-xl font-black text-[#00E676]">1 : {riskRewardRatio}</span>
              <span className="text-[10px] text-[#00E676] block font-bold">+{formatCurrency(potentialReward)}</span>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-between pt-2">
          <button
            onClick={() => {
              const text = `Position ${pair} (${direction}) - Lots: ${lotSize} - SL: ${stopLoss} (${pipsSL.toFixed(1)} pips) - Risque: ${formatCurrency(riskAmount)}`;
              navigator.clipboard.writeText(text);
              setCopied(true);
              setTimeout(() => setCopied(false), 2000);
            }}
            className="text-xs text-slate-400 hover:text-white flex items-center gap-1 font-mono"
          >
            {copied ? <Check className="w-4 h-4 text-[#00E676]" /> : <Calculator className="w-4 h-4" />}
            <span>{copied ? "Copié !" : "Copier le résumé"}</span>
          </button>

          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl bg-[#1B2320] hover:bg-[#232D29] text-slate-300 text-xs font-semibold"
            >
              Fermer
            </button>
            {onApplyToJournal && (
              <button
                onClick={handleApply}
                className="px-5 py-2.5 rounded-xl bg-[#00E676] hover:bg-[#00c865] text-slate-950 font-extrabold text-xs shadow-lg shadow-[#00E676]/20"
              >
                Appliquer au Journal
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
