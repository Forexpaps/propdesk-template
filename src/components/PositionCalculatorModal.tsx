import React, { useState } from "react";
import { Calculator, X, Check } from "lucide-react";
import { formatCurrency } from "../lib/format";
import { ThousandsInput } from "./ThousandsInput";

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

type AssetClass = "Forex" | "Indices" | "Crypto" | "Métaux";

const DEFAULT_CONTRACT: Record<AssetClass, number> = {
  Forex: 100000,
  Indices: 1,
  Crypto: 1,
  Métaux: 100,
};

/** Micro-label en petites majuscules espacées — même motif que Rentabilité/Macro. */
const MicroLabel: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <span className="text-[9px] uppercase tracking-wider text-slate-500 font-bold">{children}</span>
);

/** Carte flat à bordure fine, sans ombre — un des 4 calculateurs. */
const CalcCard: React.FC<{ title: string; subtitle: string; children: React.ReactNode }> = ({
  title,
  subtitle,
  children,
}) => (
  <div className="bg-[#111615] border border-[#1B2320] rounded-xl p-5 space-y-4">
    <div>
      <h4 className="text-sm font-bold text-white">{title}</h4>
      <p className="text-[11px] text-slate-500 mt-0.5">{subtitle}</p>
    </div>
    {children}
  </div>
);

/**
 * Champ numérique avec regroupement par milliers affiché en direct — jamais
 * `type="number"` : voir `ThousandsInput.tsx`. Un input number bloque net la
 * virgule décimale sur un indice comme NAS100 à 20.637,50, faussant
 * silencieusement le prix appliqué au calculateur puis au Ratio R:R.
 */
const FieldInput: React.FC<{
  label: string;
  value: string;
  onChange: (v: string) => void;
}> = ({ label, value, onChange }) => (
  <div>
    <label className="block text-[10px] text-slate-500 mb-1 font-sans">{label}</label>
    <ThousandsInput
      value={value}
      onChange={onChange}
      className="w-full bg-[#0D1110] border border-[#1B2320] rounded-lg px-2.5 py-2 text-white text-sm font-mono font-bold focus:outline-none focus:border-[#00E676]"
    />
  </div>
);

const ResultRow: React.FC<{ label: string; value: React.ReactNode; valueClassName?: string }> = ({
  label,
  value,
  valueClassName = "text-white",
}) => (
  <div className="flex items-center justify-between text-xs border-t border-[#1B2320] pt-2.5">
    <span className="text-slate-400 font-sans">{label}</span>
    <span className={`font-mono font-bold ${valueClassName}`}>{value}</span>
  </div>
);

export const PositionCalculatorModal: React.FC<PositionCalculatorModalProps> = ({
  isOpen,
  onClose,
  defaultCapital,
  onApplyToJournal,
}) => {
  const [assetClass, setAssetClass] = useState<AssetClass>("Forex");
  const [pair, setPair] = useState("EUR/USD");
  const [copied, setCopied] = useState(false);

  // Panneau 1 — Taille de position & risque
  const [capital, setCapital] = useState<string>(String(defaultCapital || 10000));
  const [riskPercent, setRiskPercent] = useState<string>("1");
  const [entry1, setEntry1] = useState<string>("1.085");
  const [stop1, setStop1] = useState<string>("1.082");
  const [target1, setTarget1] = useState<string>("1.092");

  // Panneau 2 — Risque / Rendement
  const [entry2, setEntry2] = useState<string>("1.085");
  const [stop2, setStop2] = useState<string>("1.082");
  const [target2, setTarget2] = useState<string>("1.092");

  // Panneau 3 — Profit / Perte
  const [entry4, setEntry4] = useState<string>("1.085");
  const [exit4, setExit4] = useState<string>("1.09");
  const [units4, setUnits4] = useState<string>("100000");
  const [direction4, setDirection4] = useState<"LONG" | "SHORT">("LONG");

  if (!isOpen) return null;

  const handleAssetClass = (ac: AssetClass) => {
    setAssetClass(ac);
  };

  // Champs texte convertis en nombre au moment du calcul seulement — voir
  // le commentaire de `FieldInput`, la valeur reste une chaîne pendant la
  // frappe.
  const capitalNum = Number(capital) || 0;
  const riskPercentNum = Number(riskPercent) || 0;
  const entry1Num = Number(entry1) || 0;
  const stop1Num = Number(stop1) || 0;
  const target1Num = Number(target1) || 0;
  const entry2Num = Number(entry2) || 0;
  const stop2Num = Number(stop2) || 0;
  const target2Num = Number(target2) || 0;
  const entry4Num = Number(entry4) || 0;
  const exit4Num = Number(exit4) || 0;
  const units4Num = Number(units4) || 0;

  // --- Panneau 1 : Taille de position & risque ---
  // Taille de contrat dérivée de la classe d'actif (plus de champ éditable —
  // simplifié sur demande explicite de l'utilisateur).
  const contract1 = DEFAULT_CONTRACT[assetClass];
  const riskAmount1 = (capitalNum * riskPercentNum) / 100;
  const isLong1 = target1Num >= entry1Num;
  const riskDiff1 = Math.abs(entry1Num - stop1Num);
  const rewardDiff1 = Math.abs(target1Num - entry1Num);
  const units1 = riskDiff1 > 0 ? riskAmount1 / riskDiff1 : 0;
  const lots1 = contract1 > 0 ? units1 / contract1 : 0;
  const potentialProfit1 = units1 * rewardDiff1;
  const rr1 = riskDiff1 > 0 ? rewardDiff1 / riskDiff1 : 0;

  // --- Panneau 2 : Risque / Rendement ---
  const isLong2 = target2Num >= entry2Num;
  const riskDiff2 = Math.abs(entry2Num - stop2Num);
  const rewardDiff2 = Math.abs(target2Num - entry2Num);
  const riskPct2 = entry2Num > 0 ? (riskDiff2 / entry2Num) * 100 : 0;
  const gainPct2 = entry2Num > 0 ? (rewardDiff2 / entry2Num) * 100 : 0;
  const rr2 = riskDiff2 > 0 ? rewardDiff2 / riskDiff2 : 0;
  const breakevenWinRate2 = rr2 > 0 ? (1 / (1 + rr2)) * 100 : 0;

  // --- Panneau 3 : Profit / Perte ---
  const movement4 = exit4Num - entry4Num;
  const movementPct4 = entry4Num > 0 ? (Math.abs(movement4) / entry4Num) * 100 : 0;
  const pnl4 = (direction4 === "LONG" ? movement4 : -movement4) * units4Num;

  const handleApply = () => {
    if (onApplyToJournal) {
      onApplyToJournal({
        pair,
        entryPrice: entry1Num,
        stopLoss: stop1Num,
        takeProfit: target1Num,
        lotSize: parseFloat(lots1.toFixed(3)),
        riskAmount: riskAmount1,
        riskRewardRatio: parseFloat(rr1.toFixed(2)),
      });
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-[#0D1110]/80 backdrop-blur-md flex items-center justify-center p-4 font-sans overflow-y-auto">
      <div className="bg-[#111615] border border-[#1B2320] rounded-2xl max-w-5xl w-full my-8 shadow-2xl relative text-slate-100 max-h-[calc(100vh-4rem)] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="p-5 sm:p-6 border-b border-[#1B2320] flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-[#00E676]/10 text-[#00E676] border border-[#00E676]/20">
              <Calculator className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">Calculateurs de Trading</h3>
              <p className="text-xs text-slate-400">Position, risque et profit — en un coup d'œil</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg bg-[#1B2320] hover:bg-[#232D29] text-slate-400 hover:text-white transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-5">
          {/* Classe d'actif + paire (pour "Appliquer au Journal") */}
          <div className="flex flex-col sm:flex-row sm:items-center gap-3">
            <div className="grid grid-cols-4 gap-1.5 bg-[#0D1110] p-1 rounded-xl border border-[#1B2320] text-xs font-bold w-full sm:w-auto">
              {(["Forex", "Indices", "Crypto", "Métaux"] as AssetClass[]).map((ac) => (
                <button
                  key={ac}
                  onClick={() => handleAssetClass(ac)}
                  className={`px-3 py-1.5 rounded-lg transition-all ${
                    assetClass === ac
                      ? "bg-[#00E676] text-slate-950 font-extrabold"
                      : "text-slate-400 hover:text-white"
                  }`}
                >
                  {ac}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-2 text-xs sm:ml-auto">
              <MicroLabel>Paire (pour le journal)</MicroLabel>
              <input
                type="text"
                value={pair}
                onChange={(e) => setPair(e.target.value)}
                className="bg-[#0D1110] border border-[#1B2320] rounded-lg px-2.5 py-1.5 text-white font-mono font-bold w-32 focus:outline-none focus:border-[#00E676]"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            {/* Panneau 1 : Taille de position & risque */}
            <CalcCard title="Taille de position & risque" subtitle="Taille pour ne risquer qu'un % du capital + profit potentiel et perte max.">
              <div className="grid grid-cols-2 gap-2.5">
                <FieldInput label="Capital (€/$)" value={capital} onChange={setCapital} />
                <FieldInput label="Risque (%)" value={riskPercent} onChange={setRiskPercent} />
              </div>
              <div className="grid grid-cols-3 gap-2.5">
                <FieldInput label="Entrée" value={entry1} onChange={setEntry1} />
                <FieldInput label="Stop-loss" value={stop1} onChange={setStop1} />
                <FieldInput label="Objectif" value={target1} onChange={setTarget1} />
              </div>
              <div className="space-y-0">
                <ResultRow label="Taille (unités)" value={units1.toLocaleString("fr-FR", { maximumFractionDigits: 0 })} />
                <ResultRow label="≈ Lots" value={lots1.toFixed(2)} valueClassName="text-blue-400" />
                <ResultRow label="Perte maximale" value={`-${formatCurrency(riskAmount1)}`} valueClassName="text-rose-400" />
                <ResultRow label="Profit potentiel" value={`+${formatCurrency(potentialProfit1)}`} valueClassName="text-[#00E676]" />
                <ResultRow label="Ratio R:R" value={`1 : ${rr1.toFixed(2)}`} valueClassName="text-[#00E676]" />
              </div>
            </CalcCard>

            {/* Panneau 2 : Risque / Rendement */}
            <CalcCard title="Risque / Rendement" subtitle="Le ratio R:R et le taux de réussite pour être à l'équilibre.">
              <div className="grid grid-cols-3 gap-2.5">
                <FieldInput label="Entrée" value={entry2} onChange={setEntry2} />
                <FieldInput label="Stop" value={stop2} onChange={setStop2} />
                <FieldInput label="Objectif" value={target2} onChange={setTarget2} />
              </div>
              <div className="space-y-0">
                <ResultRow label="Sens" value={isLong2 ? "Achat (long)" : "Vente (short)"} />
                <ResultRow
                  label="Risque / Gain"
                  value={`${riskPct2.toFixed(2)}% / ${gainPct2.toFixed(2)}%`}
                />
                <ResultRow label="Ratio R:R" value={`1 : ${rr2.toFixed(2)}`} valueClassName="text-[#00E676]" />
                <ResultRow
                  label="% gagnants pour l'équilibre"
                  value={`${breakevenWinRate2.toFixed(1)} %`}
                  valueClassName="text-amber-400"
                />
              </div>
            </CalcCard>

            {/* Panneau 3 : Profit / Perte */}
            <CalcCard title="Profit / Perte" subtitle="Le résultat d'un trade entre l'entrée et la sortie.">
              <div className="grid grid-cols-2 gap-2.5">
                <FieldInput label="Entrée" value={entry4} onChange={setEntry4} />
                <FieldInput label="Sortie" value={exit4} onChange={setExit4} />
              </div>
              <div className="grid grid-cols-2 gap-2.5">
                <FieldInput label="Taille (unités)" value={units4} onChange={setUnits4} />
                <div>
                  <label className="block text-[10px] text-slate-500 mb-1 font-sans">Sens</label>
                  <select
                    value={direction4}
                    onChange={(e) => setDirection4(e.target.value as "LONG" | "SHORT")}
                    className="w-full bg-[#0D1110] border border-[#1B2320] rounded-lg px-2.5 py-2 text-white text-sm font-mono font-bold focus:outline-none focus:border-[#00E676]"
                  >
                    <option value="LONG">Achat (long)</option>
                    <option value="SHORT">Vente (short)</option>
                  </select>
                </div>
              </div>
              <div className="space-y-0">
                <ResultRow
                  label="Mouvement"
                  value={`${movement4 >= 0 ? "+" : ""}${movement4.toFixed(5)} (${movementPct4.toFixed(2)}%)`}
                />
                <ResultRow
                  label="Profit / Perte"
                  value={`${pnl4 >= 0 ? "+" : ""}${formatCurrency(pnl4)}`}
                  valueClassName={pnl4 >= 0 ? "text-[#00E676]" : "text-rose-400"}
                />
              </div>
            </CalcCard>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-between px-5 sm:px-6 py-4 border-t border-[#1B2320] shrink-0">
          <button
            onClick={() => {
              const text = `Position ${pair} — Lots: ${lots1.toFixed(2)} — SL: ${stop1} — Risque: ${formatCurrency(riskAmount1)} — R:R 1:${rr1.toFixed(2)}`;
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
