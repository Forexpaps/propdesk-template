import React, { useEffect, useState } from "react";
import { Calculator, X, Check } from "lucide-react";
import { formatCurrency, parsePriceInput } from "../lib/format";
import { Select } from "./Select";
import { api } from "../lib/api";

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
    /** % du capital engagé, tel que saisi ici — repris tel quel par le Journal. */
    riskPercent: number;
    riskRewardRatio: number;
  }) => void;
}

type AssetClass = "Forex" | "Indices" | "Crypto" | "Métaux";

/**
 * Devise de COTATION d'une paire Forex saisie librement ("EUR/USD",
 * "eurusd", "USD-JPY"...) — `null` si la saisie ne correspond pas à deux
 * codes ISO de 3 lettres. Sert à savoir si un taux de conversion vers USD
 * est nécessaire pour le panneau "Taille de position & risque" (voir plus
 * bas) : inutile sur EUR/USD (déjà coté en USD), indispensable sur USD/JPY
 * (coté en JPY) ou une paire croisée comme EUR/GBP (coté en GBP).
 */
function quoteCurrencyOf(rawPair: string): string | null {
  const letters = rawPair.toUpperCase().replace(/[^A-Z]/g, "");
  return letters.length === 6 ? letters.slice(3, 6) : null;
}

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
 * Champ numérique en texte totalement libre — jamais `type="number"` (bloque
 * net la virgule décimale sur un indice comme NAS100 à 20.637,50), et plus
 * de regroupement par milliers imposé pendant la frappe non plus : un coach
 * ou un élève doit pouvoir taper le point et la virgule où il veut, la
 * cotation n'ayant pas la même forme d'un actif à l'autre (`parsePriceInput`,
 * `src/lib/format.ts`, s'occupe de retrouver le bon nombre au moment du
 * calcul, quelle que soit la convention utilisée).
 */
const FieldInput: React.FC<{
  label: string;
  value: string;
  onChange: (v: string) => void;
}> = ({ label, value, onChange }) => (
  <div>
    <label className="block text-[10px] text-slate-500 mb-1 font-sans">{label}</label>
    <input
      type="text"
      inputMode="decimal"
      value={value}
      onChange={(e) => {
        if (/^[\d.,]*$/.test(e.target.value)) onChange(e.target.value);
      }}
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

  // Taux de conversion devise de cotation → USD, pour le panneau 1 — voir
  // `quoteCurrencyOf` et le commentaire au-dessus de `units1` plus bas.
  const quoteCurrency = assetClass === "Forex" ? quoteCurrencyOf(pair) : null;
  const needsConversion = !!quoteCurrency && quoteCurrency !== "USD";
  const [fxRate, setFxRate] = useState<number | null>(1);
  const [fxRateLoading, setFxRateLoading] = useState(false);

  useEffect(() => {
    if (!needsConversion) {
      setFxRate(1);
      setFxRateLoading(false);
      return;
    }
    let cancelled = false;
    setFxRateLoading(true);
    // Léger débounce : évite un appel réseau à chaque caractère tapé dans "Paire".
    const timer = setTimeout(() => {
      api
        .fetchFxRate(quoteCurrency!)
        .then(({ rate }) => {
          if (!cancelled) setFxRate(rate);
        })
        .catch(() => {
          if (!cancelled) setFxRate(null);
        })
        .finally(() => {
          if (!cancelled) setFxRateLoading(false);
        });
    }, 400);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [needsConversion, quoteCurrency]);

  if (!isOpen) return null;

  const handleAssetClass = (ac: AssetClass) => {
    setAssetClass(ac);
  };

  // Champs texte convertis en nombre au moment du calcul seulement — voir
  // le commentaire de `FieldInput`, la valeur reste une chaîne pendant la
  // frappe. `parsePriceInput` (pas `Number` direct) : point et virgule sont
  // acceptés dans n'importe quel ordre, voir son commentaire.
  const capitalNum = parsePriceInput(capital) || 0;
  const riskPercentNum = parsePriceInput(riskPercent) || 0;
  const entry1Num = parsePriceInput(entry1) || 0;
  const stop1Num = parsePriceInput(stop1) || 0;
  const target1Num = parsePriceInput(target1) || 0;
  const entry2Num = parsePriceInput(entry2) || 0;
  const stop2Num = parsePriceInput(stop2) || 0;
  const target2Num = parsePriceInput(target2) || 0;
  const entry4Num = parsePriceInput(entry4) || 0;
  const exit4Num = parsePriceInput(exit4) || 0;
  const units4Num = parsePriceInput(units4) || 0;

  // --- Panneau 1 : Taille de position & risque ---
  // Taille de contrat dérivée de la classe d'actif (plus de champ éditable —
  // simplifié sur demande explicite de l'utilisateur).
  const contract1 = DEFAULT_CONTRACT[assetClass];
  const riskAmount1 = (capitalNum * riskPercentNum) / 100;
  const isLong1 = target1Num >= entry1Num;
  const riskDiff1 = Math.abs(entry1Num - stop1Num);
  const rewardDiff1 = Math.abs(target1Num - entry1Num);
  // `riskDiff1`/`rewardDiff1` sont dans la devise de COTATION de la paire —
  // seulement en USD quand cette devise EST l'USD (EUR/USD, GBP/USD...).
  // Sur USD/JPY (coté en JPY) ou une croisée comme EUR/GBP (coté en GBP), le
  // risque en unités de compte doit être converti avant de dimensionner la
  // position : sans `fxRate`, la taille calculée était juste uniquement pour
  // les paires cotées en USD — silencieusement fausse sur les autres.
  const conversionReady = !needsConversion || fxRate !== null;
  const rate1 = needsConversion ? fxRate ?? 0 : 1;
  const units1 = riskDiff1 > 0 && conversionReady && rate1 > 0 ? riskAmount1 / (riskDiff1 * rate1) : 0;
  const lots1 = contract1 > 0 ? units1 / contract1 : 0;
  const potentialProfit1 = units1 * rewardDiff1 * rate1;
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

  // Entrée = stop : `riskDiff1` vaut 0, `units1`/`riskAmount1`/`rr1` valent
  // déjà silencieusement 0 (voir leurs gardes plus haut) — sans ce contrôle,
  // le bouton restait actif et poussait ces zéros tels quels dans le
  // Journal sans le moindre avertissement, un trade inexploitable. Même
  // logique pour `conversionReady` : appliquer une taille calculée sur un
  // taux de conversion manquant serait la même classe de bug que celui
  // qu'il corrige.
  const canApply = riskDiff1 > 0 && conversionReady;

  const handleApply = () => {
    if (!canApply) return;
    if (onApplyToJournal) {
      onApplyToJournal({
        pair,
        entryPrice: entry1Num,
        stopLoss: stop1Num,
        takeProfit: target1Num,
        lotSize: parseFloat(lots1.toFixed(3)),
        riskAmount: riskAmount1,
        riskPercent: riskPercentNum,
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
              {needsConversion && (
                <div className="text-[10px] font-mono">
                  {fxRateLoading ? (
                    <span className="text-slate-500">Récupération du taux {quoteCurrency}/USD…</span>
                  ) : fxRate !== null ? (
                    <span className="text-slate-400">
                      1 {quoteCurrency} = {fxRate.toFixed(5)} USD{" "}
                      <span className="text-slate-600">(taux en direct)</span>
                    </span>
                  ) : (
                    <span className="text-rose-400">
                      Taux {quoteCurrency}/USD indisponible — calcul suspendu.
                    </span>
                  )}
                </div>
              )}
              <div className="space-y-0">
                <ResultRow
                  label="Taille (unités)"
                  value={conversionReady ? units1.toLocaleString("fr-FR", { maximumFractionDigits: 0 }) : "—"}
                />
                <ResultRow
                  label="≈ Lots"
                  value={conversionReady ? lots1.toFixed(2) : "—"}
                  valueClassName="text-blue-400"
                />
                <ResultRow label="Perte maximale" value={`-${formatCurrency(riskAmount1)}`} valueClassName="text-rose-400" />
                <ResultRow
                  label="Profit potentiel"
                  value={conversionReady ? `+${formatCurrency(potentialProfit1)}` : "—"}
                  valueClassName="text-[#00E676]"
                />
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
                  <Select
                    value={direction4}
                    onChange={(e) => setDirection4(e.target.value as "LONG" | "SHORT")}
                    className="w-full bg-[#0D1110] border border-[#1B2320] rounded-lg px-2.5 py-2 text-white text-sm font-mono font-bold focus:outline-none focus:border-[#00E676]"
                  >
                    <option value="LONG">Achat (long)</option>
                    <option value="SHORT">Vente (short)</option>
                  </Select>
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
                disabled={!canApply}
                title={canApply ? undefined : "Le prix d'entrée et le stop doivent être différents."}
                className="px-5 py-2.5 rounded-xl bg-[#00E676] hover:bg-[#00c865] disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-[#00E676] text-slate-950 font-extrabold text-xs shadow-lg shadow-[#00E676]/20"
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
