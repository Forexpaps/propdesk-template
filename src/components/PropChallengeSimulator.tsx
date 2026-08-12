import React, { useEffect, useRef, useState } from "react";
import {
  Coins,
  LineChart,
  ShieldCheck,
  Target,
  AlertTriangle,
  Trophy,
  RefreshCw,
  SkipForward,
  Play,
  Pause,
  Sun,
  ArrowUpRight,
  ArrowDownRight,
  Calculator,
  CheckCircle2,
  XCircle,
  Info,
  X,
} from "lucide-react";
import { formatCurrency } from "../lib/format";
import {
  ASSET_LIST,
  AssetSymbol,
  CAPITAL_PRESETS,
  CHALLENGE_PRESETS,
  ChallengeConfig,
  ChallengeRules,
  ChallengeState,
  OrderDirection,
  PROP_SIM_ASSETS,
  advanceDay,
  advanceTick,
  closePositionManually,
  computeEquity,
  createChallengeState,
  currentPrice,
  floatingPnl,
  formatSimTimestamp,
  loadPersistedChallenge,
  openPosition,
  persistChallenge,
  potentialPnlForPips,
  targetPercentForPhase,
} from "../lib/propChallenge";
import { CandlestickChart } from "./CandlestickChart";

const AUTOPLAY_INTERVAL_MS = 450;

export const PropChallengeSimulator: React.FC = () => {
  const [state, setState] = useState<ChallengeState | null>(() => loadPersistedChallenge());
  const [isPlaying, setIsPlaying] = useState(false);
  const intervalRef = useRef<number | null>(null);

  useEffect(() => {
    persistChallenge(state);
  }, [state]);

  useEffect(() => {
    if (state && state.status !== "EN_COURS") setIsPlaying(false);
  }, [state?.status]);

  useEffect(() => {
    if (!isPlaying) return;
    intervalRef.current = window.setInterval(() => {
      setState((prev) => (prev ? advanceTick(prev) : prev));
    }, AUTOPLAY_INTERVAL_MS);
    return () => {
      if (intervalRef.current !== null) window.clearInterval(intervalRef.current);
    };
  }, [isPlaying]);

  const handleStart = (config: ChallengeConfig) => {
    setState(createChallengeState(config));
  };

  const handleReset = () => {
    setIsPlaying(false);
    setState(null);
  };

  if (!state) {
    return <ChallengeConfigScreen onStart={handleStart} />;
  }

  return (
    <TradingTerminal
      state={state}
      setState={setState}
      isPlaying={isPlaying}
      setIsPlaying={setIsPlaying}
      onReconfigure={handleReset}
    />
  );
};

// ---------------------------------------------------------------------------
// Écran de configuration du challenge
// ---------------------------------------------------------------------------

interface ChallengeConfigScreenProps {
  onStart: (config: ChallengeConfig) => void;
}

const ChallengeConfigScreen: React.FC<ChallengeConfigScreenProps> = ({ onStart }) => {
  const [capital, setCapital] = useState<number>(50000);
  const [asset, setAsset] = useState<AssetSymbol>("XAUUSD");
  const [presetIndex, setPresetIndex] = useState<number>(0);
  const [rules, setRules] = useState<ChallengeRules>({ ...CHALLENGE_PRESETS[0].rules });

  const applyPreset = (index: number) => {
    setPresetIndex(index);
    setRules({ ...CHALLENGE_PRESETS[index].rules });
  };

  const updateRule = <K extends keyof ChallengeRules>(key: K, value: ChallengeRules[K]) => {
    setRules((prev) => ({ ...prev, [key]: value }));
  };

  const phase1TargetAmount = capital * (rules.phase1TargetPercent / 100);
  const targetBalance = capital + phase1TargetAmount;

  return (
    <div className="space-y-6">
      <div className="bg-gradient-to-r from-[#111615] via-[#111615] to-[#00E676]/5 p-6 rounded-2xl border border-[#1B2320] flex flex-col md:flex-row md:items-center justify-between gap-6 shadow-xl">
        <div className="space-y-2">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#00E676]/10 text-[#00E676] border border-[#00E676]/20 text-xs font-mono font-bold">
            <LineChart className="w-3.5 h-3.5" /> Simulateur de Challenge Prop Firm
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
            Configurez votre Challenge
          </h1>
          <p className="text-slate-400 text-sm max-w-2xl">
            Tradez un marché simulé en temps réel et prouvez que vous maîtrisez la gestion du risque
            avant de passer un vrai challenge Prop Firm.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Capital */}
        <div className="bg-[#111615] border border-[#1B2320] rounded-2xl p-5 space-y-4">
          <h2 className="text-xs font-bold text-slate-300 uppercase tracking-wider font-mono flex items-center gap-2">
            <Coins className="w-4 h-4 text-[#00E676]" /> Capital Initial
          </h2>
          <div className="grid grid-cols-2 gap-2">
            {CAPITAL_PRESETS.map((c) => (
              <button
                key={c}
                onClick={() => setCapital(c)}
                className={`py-3 rounded-xl text-sm font-bold font-mono transition-all ${
                  capital === c
                    ? "bg-[#00E676]/15 border border-[#00E676]/50 text-white shadow-sm"
                    : "bg-[#0D1110] border border-[#1B2320] text-slate-400 hover:text-white"
                }`}
              >
                ${(c / 1000).toFixed(0)}k
              </button>
            ))}
          </div>
          <div className="text-xs text-slate-400 pt-1 border-t border-[#1B2320]">
            Objectif Phase 1 : <span className="text-[#00E676] font-mono font-bold">+{formatCurrency(phase1TargetAmount)}</span>
          </div>
        </div>

        {/* Actif */}
        <div className="bg-[#111615] border border-[#1B2320] rounded-2xl p-5 space-y-4">
          <h2 className="text-xs font-bold text-slate-300 uppercase tracking-wider font-mono flex items-center gap-2">
            <LineChart className="w-4 h-4 text-[#00E676]" /> Actif à Trader
          </h2>
          <div className="space-y-2">
            {ASSET_LIST.map((sym) => {
              const cfg = PROP_SIM_ASSETS[sym];
              const isSelected = asset === sym;
              return (
                <button
                  key={sym}
                  onClick={() => setAsset(sym)}
                  className={`w-full p-3 rounded-xl border text-left transition-all flex items-center justify-between ${
                    isSelected
                      ? "bg-[#00E676]/15 border-[#00E676]/50 text-white"
                      : "bg-[#0D1110] border-[#1B2320] text-slate-400 hover:text-white"
                  }`}
                >
                  <div>
                    <div className="text-sm font-bold">{sym}</div>
                    <div className="text-[10px] text-slate-500">{cfg.label}</div>
                  </div>
                  <div className="text-xs font-mono text-slate-400">{cfg.basePrice.toFixed(cfg.decimals)}</div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Règles */}
        <div className="bg-[#111615] border border-[#1B2320] rounded-2xl p-5 space-y-4">
          <h2 className="text-xs font-bold text-slate-300 uppercase tracking-wider font-mono flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-[#00E676]" /> Règles du Challenge
          </h2>
          <div className="grid grid-cols-2 gap-2">
            {CHALLENGE_PRESETS.map((p, i) => (
              <button
                key={p.name}
                onClick={() => applyPreset(i)}
                className={`px-2.5 py-2 rounded-xl text-[11px] font-bold text-left transition-all ${
                  presetIndex === i
                    ? "bg-[#00E676]/15 border border-[#00E676]/50 text-white"
                    : "bg-[#0D1110] border border-[#1B2320] text-slate-400 hover:text-white"
                }`}
              >
                {p.name}
              </button>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-2 text-xs pt-1">
            <div className="p-2.5 rounded-lg bg-[#0D1110] border border-[#1B2320] flex items-center justify-between">
              <span className="text-slate-400 flex items-center gap-1"><Target className="w-3.5 h-3.5 text-[#00E676]" /> Objectif P1</span>
              <span className="font-mono font-bold text-[#00E676]">+{rules.phase1TargetPercent}%</span>
            </div>
            <div className="p-2.5 rounded-lg bg-[#0D1110] border border-[#1B2320] flex items-center justify-between">
              <span className="text-slate-400 flex items-center gap-1"><AlertTriangle className="w-3.5 h-3.5 text-amber-400" /> Perte/jour</span>
              <span className="font-mono font-bold text-amber-400">-{rules.dailyLossPercent}%</span>
            </div>
            <div className="p-2.5 rounded-lg bg-[#0D1110] border border-[#1B2320] flex items-center justify-between col-span-2">
              <span className="text-slate-400 flex items-center gap-1"><ShieldCheck className="w-3.5 h-3.5 text-rose-400" /> Drawdown total max</span>
              <span className="font-mono font-bold text-rose-400">-{rules.totalDrawdownPercent}%</span>
            </div>
          </div>
        </div>
      </div>

      {/* Réglages avancés éditables */}
      <details className="bg-[#111615] border border-[#1B2320] rounded-2xl p-5 group">
        <summary className="text-xs font-bold text-slate-300 uppercase tracking-wider font-mono cursor-pointer select-none flex items-center gap-2">
          Réglages avancés (modifiables) <span className="text-slate-600 group-open:hidden">▸</span><span className="text-slate-600 hidden group-open:inline">▾</span>
        </summary>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4 text-xs">
          <div>
            <label className="block text-slate-400 mb-1">Perte journalière max (%)</label>
            <input type="number" value={rules.dailyLossPercent} onChange={(e) => updateRule("dailyLossPercent", Number(e.target.value))}
              className="w-full bg-[#0D1110] border border-[#1B2320] rounded-xl px-3 py-2 text-white font-mono" />
          </div>
          <div>
            <label className="block text-slate-400 mb-1">Drawdown total max (%)</label>
            <input type="number" value={rules.totalDrawdownPercent} onChange={(e) => updateRule("totalDrawdownPercent", Number(e.target.value))}
              className="w-full bg-[#0D1110] border border-[#1B2320] rounded-xl px-3 py-2 text-white font-mono" />
          </div>
          <div>
            <label className="block text-slate-400 mb-1">Objectif Phase 1 (%)</label>
            <input type="number" value={rules.phase1TargetPercent} onChange={(e) => updateRule("phase1TargetPercent", Number(e.target.value))}
              className="w-full bg-[#0D1110] border border-[#1B2320] rounded-xl px-3 py-2 text-white font-mono" />
          </div>
          <div>
            <label className="block text-slate-400 mb-1">Objectif Phase 2 (%)</label>
            <input type="number" value={rules.phase2TargetPercent} onChange={(e) => updateRule("phase2TargetPercent", Number(e.target.value))}
              className="w-full bg-[#0D1110] border border-[#1B2320] rounded-xl px-3 py-2 text-white font-mono" />
          </div>
          <div>
            <label className="block text-slate-400 mb-1">Jours de trading min.</label>
            <input type="number" value={rules.minTradingDays} onChange={(e) => updateRule("minTradingDays", Number(e.target.value))}
              className="w-full bg-[#0D1110] border border-[#1B2320] rounded-xl px-3 py-2 text-white font-mono" />
          </div>
          <div>
            <label className="block text-slate-400 mb-1">Risque max / trade (%)</label>
            <input type="number" value={rules.maxRiskPerTradePercent} onChange={(e) => updateRule("maxRiskPerTradePercent", Number(e.target.value))}
              className="w-full bg-[#0D1110] border border-[#1B2320] rounded-xl px-3 py-2 text-white font-mono" />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-4">
          <ToggleRow
            label="Drawdown trailing"
            description="La limite remonte avec le plus haut de l'équité."
            checked={rules.trailingDrawdown}
            onChange={(v) => updateRule("trailingDrawdown", v)}
          />
          <ToggleRow
            label="Règle de rendement"
            description={`Le meilleur trade ne peut pas dépasser ${rules.consistencyRuleMaxSharePercent}% des profits.`}
            checked={rules.consistencyRuleEnabled}
            onChange={(v) => updateRule("consistencyRuleEnabled", v)}
          />
          <ToggleRow
            label="Trading pendant les actualités"
            description="Informatif : aucun calendrier d'actus n'est simulé ici."
            checked={rules.newsTradingAllowed}
            onChange={(v) => updateRule("newsTradingAllowed", v)}
          />
        </div>
      </details>

      {/* Barre de résumé + démarrage */}
      <div className="bg-[#111615] border border-[#1B2320] rounded-2xl p-5 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-6 text-xs font-mono">
          <div className="flex items-center gap-1.5">
            <Coins className="w-4 h-4 text-[#00E676]" />
            <span className="text-slate-400">Capital:</span>
            <span className="text-white font-bold">{formatCurrency(capital)}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <LineChart className="w-4 h-4 text-[#00E676]" />
            <span className="text-slate-400">Actif:</span>
            <span className="text-white font-bold">{asset}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Trophy className="w-4 h-4 text-[#00E676]" />
            <span className="text-slate-400">Cible Phase 1:</span>
            <span className="text-[#00E676] font-bold">{formatCurrency(targetBalance)}</span>
          </div>
        </div>

        <button
          onClick={() => onStart({ asset, initialCapital: capital, rules })}
          className="w-full sm:w-auto px-6 py-3 rounded-xl bg-[#00E676] hover:bg-[#00c865] text-slate-950 font-extrabold text-sm shadow-md flex items-center justify-center gap-2"
        >
          Démarrer le Challenge <ArrowUpRight className="w-4 h-4" />
        </button>
      </div>

      <p className="text-center text-[11px] text-slate-600">
        Environnement simulé — aucun fonds réel, aucun broker réel. Sert uniquement à l'entraînement à la gestion du risque.
      </p>
    </div>
  );
};

const ToggleRow: React.FC<{ label: string; description: string; checked: boolean; onChange: (v: boolean) => void }> = ({
  label,
  description,
  checked,
  onChange,
}) => (
  <div className="bg-[#0D1110] border border-[#1B2320] rounded-xl p-3.5 flex items-center justify-between gap-3">
    <div>
      <div className="text-xs font-bold text-white">{label}</div>
      <div className="text-[10px] text-slate-500 mt-0.5">{description}</div>
    </div>
    <button
      onClick={() => onChange(!checked)}
      className={`shrink-0 w-9 h-5 rounded-full transition-colors relative ${checked ? "bg-[#00E676]" : "bg-[#1B2320]"}`}
    >
      <span
        className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all ${checked ? "left-4" : "left-0.5"}`}
      />
    </button>
  </div>
);

// ---------------------------------------------------------------------------
// Terminal de trading
// ---------------------------------------------------------------------------

interface TradingTerminalProps {
  state: ChallengeState;
  setState: React.Dispatch<React.SetStateAction<ChallengeState | null>>;
  isPlaying: boolean;
  setIsPlaying: (v: boolean) => void;
  onReconfigure: () => void;
}

const TradingTerminal: React.FC<TradingTerminalProps> = ({ state, setState, isPlaying, setIsPlaying, onReconfigure }) => {
  const asset = PROP_SIM_ASSETS[state.config.asset];
  const price = currentPrice(state);
  const equity = computeEquity(state);
  const pnl = floatingPnl(state);

  const [direction, setDirection] = useState<OrderDirection>("BUY");
  const [lots, setLots] = useState(1);
  const [slPips, setSlPips] = useState(20);
  const [tpPips, setTpPips] = useState(40);

  const lastCandle = state.candles[state.candles.length - 1];

  const targetPercent = targetPercentForPhase(state);
  const targetAmount = state.config.initialCapital * (targetPercent / 100);
  const netProfit = equity - state.config.initialCapital;
  const targetRemaining = Math.max(0, targetAmount - netProfit);

  const dailyLossLimit = state.config.initialCapital * (state.config.rules.dailyLossPercent / 100);
  const dailyLossUsed = Math.max(0, state.dayStartBalance - equity);
  const dailyLossRemaining = Math.max(0, dailyLossLimit - dailyLossUsed);

  const ddReference = state.config.rules.trailingDrawdown ? state.peakEquity : state.config.initialCapital;
  const totalDDLimit = state.config.initialCapital * (state.config.rules.totalDrawdownPercent / 100);
  const totalDDUsed = Math.max(0, ddReference - equity);
  const totalDDRemaining = Math.max(0, totalDDLimit - totalDDUsed);

  const potentialLoss = potentialPnlForPips(-slPips, lots, asset);
  const potentialGain = potentialPnlForPips(tpPips, lots, asset);
  const riskRewardRatio = slPips > 0 ? (tpPips / slPips).toFixed(2) : "—";
  const riskPercentOfAccount = equity > 0 ? (Math.abs(potentialLoss) / equity) * 100 : 0;
  const riskExceedsRule = riskPercentOfAccount > state.config.rules.maxRiskPerTradePercent;

  const handleTick = () => setState((prev) => (prev ? advanceTick(prev) : prev));
  const handleEndOfDay = () => {
    setIsPlaying(false);
    setState((prev) => (prev ? advanceDay(prev) : prev));
  };
  const handleOpen = (dir: OrderDirection) => {
    setState((prev) => (prev ? openPosition(prev, dir, lots, slPips, tpPips) : prev));
  };
  const handleClose = () => setState((prev) => (prev ? closePositionManually(prev) : prev));

  const statusLabel = state.status === "EN_COURS" ? "En cours" : state.status === "REUSSI" ? "Réussi" : "Échoué";
  const statusColor =
    state.status === "EN_COURS" ? "text-[#00E676] bg-[#00E676]/10 border-[#00E676]/30" :
    state.status === "REUSSI" ? "text-[#00E676] bg-[#00E676]/15 border-[#00E676]/40" :
    "text-rose-400 bg-rose-500/10 border-rose-500/30";

  return (
    <div className="space-y-6">
      {/* Barre supérieure */}
      <div className="bg-[#111615] border border-[#1B2320] rounded-2xl p-5 flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-6 text-xs font-mono">
          <div>
            <div className="text-slate-500">SOLDE</div>
            <div className="text-white font-bold text-base">{formatCurrency(state.balance)}</div>
          </div>
          <div>
            <div className="text-slate-500">ÉQUITÉ</div>
            <div className="text-white font-bold text-base">{formatCurrency(equity)}</div>
          </div>
          <div>
            <div className="text-slate-500">P&amp;L FLOTTANT</div>
            <div className={`font-bold text-base ${pnl >= 0 ? "text-[#00E676]" : "text-rose-400"}`}>
              {pnl >= 0 ? "+" : ""}{formatCurrency(pnl)}
            </div>
          </div>
          <div>
            <div className="text-slate-500">PHASE</div>
            <div className="text-white font-bold text-base">{state.phase} / 2</div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <span className={`px-3 py-1.5 rounded-full text-xs font-bold border ${statusColor}`}>{statusLabel}</span>
          <button
            onClick={onReconfigure}
            className="px-3 py-2 rounded-xl bg-[#1B2320] hover:bg-[#232D29] text-slate-300 hover:text-white text-xs font-bold flex items-center gap-1.5"
          >
            <RefreshCw className="w-3.5 h-3.5" /> Reconfigurer
          </button>
        </div>
      </div>

      {state.status !== "EN_COURS" && (
        <div className={`p-5 rounded-2xl border flex items-center gap-3 ${state.status === "REUSSI" ? "bg-[#00E676]/10 border-[#00E676]/30 text-[#00E676]" : "bg-rose-500/10 border-rose-500/30 text-rose-300"}`}>
          {state.status === "REUSSI" ? <CheckCircle2 className="w-7 h-7 shrink-0" /> : <XCircle className="w-7 h-7 shrink-0" />}
          <div>
            <div className="text-sm font-bold text-white">
              {state.status === "REUSSI" ? "Challenge validé avec succès !" : "Challenge échoué"}
            </div>
            <p className="text-xs mt-0.5">
              {state.status === "REUSSI" ? "Objectif atteint dans le respect des règles." : state.failureReason}
            </p>
          </div>
        </div>
      )}

      {state.consistencyWarning && state.status === "EN_COURS" && (
        <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 flex items-center gap-3 text-xs">
          <Info className="w-5 h-5 shrink-0" />
          <span>
            Objectif de profit atteint, mais un seul trade dépasse {state.config.rules.consistencyRuleMaxSharePercent}% de vos gains bruts
            (règle de régularité). Diversifiez vos gains sur plus de trades pour valider la phase.
          </span>
        </div>
      )}

      {/* Cartes de règles */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <RuleCard
          icon={<Target className="w-4 h-4 text-[#00E676]" />}
          label={`Objectif Phase ${state.phase}`}
          valuePercent={`+${targetPercent}%`}
          remainingLabel="Restant"
          remainingValue={formatCurrency(targetRemaining)}
          extraLabel="Cible"
          extraValue={formatCurrency(state.config.initialCapital + targetAmount)}
        />
        <RuleCard
          icon={<AlertTriangle className="w-4 h-4 text-amber-400" />}
          label="Perte journalière"
          valuePercent={`-${state.config.rules.dailyLossPercent}%`}
          remainingLabel="Restant"
          remainingValue={formatCurrency(dailyLossRemaining)}
          extraLabel="Limite"
          extraValue={formatCurrency(dailyLossLimit)}
          warn={dailyLossRemaining < dailyLossLimit * 0.3}
        />
        <RuleCard
          icon={<ShieldCheck className="w-4 h-4 text-rose-400" />}
          label="Drawdown total"
          valuePercent={`-${state.config.rules.totalDrawdownPercent}%`}
          remainingLabel="Restant"
          remainingValue={formatCurrency(totalDDRemaining)}
          extraLabel="Limite"
          extraValue={formatCurrency(totalDDLimit)}
          warn={totalDDRemaining < totalDDLimit * 0.3}
        />
        <div className="bg-[#111615] border border-[#1B2320] rounded-2xl p-4 space-y-2">
          <div className="text-[11px] text-slate-400 font-mono flex items-center gap-1.5">
            <Sun className="w-4 h-4 text-[#00E676]" /> Jour de trading
          </div>
          <div className="text-xl font-black text-white font-mono">{state.dayIndex}</div>
          <div className="text-[10px] text-slate-500">
            Min. requis : {state.config.rules.minTradingDays} jour{state.config.rules.minTradingDays > 1 ? "s" : ""}
          </div>
        </div>
      </div>

      {/* Graphique + exécution */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-[#111615] border border-[#1B2320] rounded-2xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-bold text-white">{state.config.asset} · {asset.label}</div>
              <div className="text-[11px] text-slate-500 font-mono">Bougies 1m · marché simulé</div>
            </div>
            <div className="text-lg font-black text-white font-mono">{price.toFixed(asset.decimals)}</div>
          </div>

          <div className="rounded-xl overflow-hidden border border-[#1B2320] bg-[#0D1110]" style={{ height: 320 }}>
            <CandlestickChart
              candles={state.candles}
              decimals={asset.decimals}
              positionEntryPrice={state.openPosition?.entryPrice ?? null}
              positionSl={state.openPosition?.sl ?? null}
              positionTp={state.openPosition?.tp ?? null}
            />
          </div>

          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-500 font-mono">{formatSimTimestamp(lastCandle.timestampMs)}</span>
            <div className="flex items-center gap-2">
              <button
                disabled={state.status !== "EN_COURS"}
                onClick={handleTick}
                className="px-4 py-2 rounded-xl bg-[#0D1110] border border-[#1B2320] text-slate-200 hover:text-white font-bold text-xs flex items-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <SkipForward className="w-3.5 h-3.5" /> Tick Suivant
              </button>
              <button
                disabled={state.status !== "EN_COURS"}
                onClick={() => setIsPlaying(!isPlaying)}
                className={`px-4 py-2 rounded-xl font-bold text-xs flex items-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed ${
                  isPlaying ? "bg-rose-500 hover:bg-rose-600 text-white" : "bg-[#0D1110] border border-[#1B2320] text-slate-200 hover:text-white"
                }`}
              >
                {isPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5 fill-current" />}
                {isPlaying ? "Pause" : "Lecture Rapide"}
              </button>
              <button
                disabled={state.status !== "EN_COURS"}
                onClick={handleEndOfDay}
                className="px-4 py-2 rounded-xl bg-[#0D1110] border border-[#1B2320] text-slate-200 hover:text-white font-bold text-xs flex items-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <Sun className="w-3.5 h-3.5" /> Fin de Journée
              </button>
            </div>
          </div>

          {/* Historique des trades clôturés */}
          {state.closedTrades.length > 0 && (
            <div className="pt-3 border-t border-[#1B2320]">
              <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider font-mono mb-2">
                Derniers trades ({state.closedTrades.length})
              </div>
              <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                {state.closedTrades.slice(0, 8).map((t) => (
                  <div key={t.id} className="flex items-center justify-between text-[11px] bg-[#0D1110] border border-[#151D1A] rounded-lg px-3 py-1.5">
                    <span className={`font-bold flex items-center gap-1 ${t.direction === "BUY" ? "text-[#00E676]" : "text-rose-400"}`}>
                      {t.direction === "BUY" ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                      {t.direction} {t.lots}L
                    </span>
                    <span className="text-slate-500 font-mono">{t.reason}</span>
                    <span className={`font-mono font-bold ${t.pnl >= 0 ? "text-[#00E676]" : "text-rose-400"}`}>
                      {t.pnl >= 0 ? "+" : ""}{formatCurrency(t.pnl)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Panneau d'exécution */}
        <div className="bg-[#111615] border border-[#1B2320] rounded-2xl p-5 space-y-4 h-fit">
          <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider font-mono flex items-center gap-2">
            <Calculator className="w-4 h-4 text-[#00E676]" /> Exécution d'Ordre
          </h3>

          {state.openPosition ? (
            <div className="space-y-3">
              <div className="p-4 rounded-xl bg-[#0D1110] border border-[#1B2320] space-y-2">
                <div className={`text-xs font-bold flex items-center gap-1.5 ${state.openPosition.direction === "BUY" ? "text-[#00E676]" : "text-rose-400"}`}>
                  {state.openPosition.direction === "BUY" ? <ArrowUpRight className="w-4 h-4" /> : <ArrowDownRight className="w-4 h-4" />}
                  Position {state.openPosition.direction} · {state.openPosition.lots} lot(s)
                </div>
                <div className="text-[11px] text-slate-400 font-mono">Entrée : {state.openPosition.entryPrice.toFixed(asset.decimals)}</div>
                {state.openPosition.sl !== null && <div className="text-[11px] text-rose-400 font-mono">SL : {state.openPosition.sl.toFixed(asset.decimals)}</div>}
                {state.openPosition.tp !== null && <div className="text-[11px] text-[#00E676] font-mono">TP : {state.openPosition.tp.toFixed(asset.decimals)}</div>}
                <div className={`text-lg font-black font-mono pt-1 ${pnl >= 0 ? "text-[#00E676]" : "text-rose-400"}`}>
                  {pnl >= 0 ? "+" : ""}{formatCurrency(pnl)}
                </div>
              </div>
              <button
                onClick={handleClose}
                className="w-full py-3 rounded-xl bg-[#1B2320] hover:bg-[#232D29] text-white font-bold text-sm flex items-center justify-center gap-2"
              >
                <X className="w-4 h-4" /> Clôturer la Position
              </button>
            </div>
          ) : (
            <>
              <div>
                <label className="block text-xs text-slate-400 mb-1.5">Taille de Position (lots)</label>
                <input
                  type="number"
                  step="0.1"
                  min="0.1"
                  value={lots}
                  onChange={(e) => setLots(Math.max(0.1, Number(e.target.value)))}
                  className="w-full bg-[#0D1110] border border-[#1B2320] rounded-xl px-3 py-2.5 text-white font-mono font-bold focus:outline-none focus:border-[#00E676]"
                />
                <div className="grid grid-cols-6 gap-1.5 mt-2">
                  {[0.1, 0.5, 1, 2, 5, 10].map((v) => (
                    <button
                      key={v}
                      onClick={() => setLots(v)}
                      className={`py-1.5 rounded-lg text-[11px] font-bold font-mono ${
                        lots === v ? "bg-[#00E676] text-slate-950" : "bg-[#0D1110] border border-[#1B2320] text-slate-400"
                      }`}
                    >
                      {v}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-rose-400 mb-1.5">Stop Loss (pips)</label>
                  <input
                    type="number"
                    value={slPips}
                    onChange={(e) => setSlPips(Math.max(0, Number(e.target.value)))}
                    className="w-full bg-[#0D1110] border border-[#1B2320] rounded-xl px-3 py-2.5 text-rose-400 font-mono font-bold focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs text-[#00E676] mb-1.5">Take Profit (pips)</label>
                  <input
                    type="number"
                    value={tpPips}
                    onChange={(e) => setTpPips(Math.max(0, Number(e.target.value)))}
                    className="w-full bg-[#0D1110] border border-[#1B2320] rounded-xl px-3 py-2.5 text-[#00E676] font-mono font-bold focus:outline-none"
                  />
                </div>
              </div>

              <div className="p-3.5 rounded-xl bg-[#0D1110] border border-[#1B2320] space-y-1.5 text-[11px] font-mono">
                <div className="flex justify-between">
                  <span className="text-slate-400">Perte potentielle (SL)</span>
                  <span className="text-rose-400 font-bold">{formatCurrency(potentialLoss)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Gain potentiel (TP)</span>
                  <span className="text-[#00E676] font-bold">+{formatCurrency(potentialGain)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Ratio Risque/Récompense</span>
                  <span className="text-white font-bold">1 : {riskRewardRatio}</span>
                </div>
                <div className="flex justify-between pt-1 border-t border-[#1B2320]">
                  <span className="text-slate-400">Risque compte</span>
                  <span className={`font-bold ${riskExceedsRule ? "text-rose-400" : "text-white"}`}>
                    {riskPercentOfAccount.toFixed(2)}%
                  </span>
                </div>
                {riskExceedsRule && (
                  <div className="text-amber-400 flex items-center gap-1 pt-1">
                    <AlertTriangle className="w-3 h-3 shrink-0" /> Dépasse le risque max/trade ({state.config.rules.maxRiskPerTradePercent}%)
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <button
                  disabled={state.status !== "EN_COURS"}
                  onClick={() => { setDirection("BUY"); handleOpen("BUY"); }}
                  className="py-3 rounded-xl bg-[#00E676] hover:bg-[#00c865] text-slate-950 font-extrabold text-sm flex items-center justify-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <ArrowUpRight className="w-4 h-4" /> Achat
                </button>
                <button
                  disabled={state.status !== "EN_COURS"}
                  onClick={() => { setDirection("SELL"); handleOpen("SELL"); }}
                  className="py-3 rounded-xl bg-rose-500 hover:bg-rose-600 text-white font-extrabold text-sm flex items-center justify-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <ArrowDownRight className="w-4 h-4" /> Vente
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

interface RuleCardProps {
  icon: React.ReactNode;
  label: string;
  valuePercent: string;
  remainingLabel: string;
  remainingValue: string;
  extraLabel: string;
  extraValue: string;
  warn?: boolean;
}

const RuleCard: React.FC<RuleCardProps> = ({ icon, label, valuePercent, remainingLabel, remainingValue, extraLabel, extraValue, warn }) => (
  <div className={`bg-[#111615] border rounded-2xl p-4 space-y-2 ${warn ? "border-amber-500/40" : "border-[#1B2320]"}`}>
    <div className="text-[11px] text-slate-400 font-mono flex items-center justify-between">
      <span className="flex items-center gap-1.5">{icon} {label}</span>
      <span className="font-bold text-white">{valuePercent}</span>
    </div>
    <div className="text-lg font-black text-white font-mono">{remainingValue}</div>
    <div className="text-[10px] text-slate-500 flex items-center justify-between">
      <span>{remainingLabel}</span>
      <span>{extraLabel} : {extraValue}</span>
    </div>
  </div>
);
