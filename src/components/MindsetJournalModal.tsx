import React, { useState, useEffect } from "react";
import {
  Brain,
  Smile,
  Frown,
  Flame,
  AlertTriangle,
  Play,
  RotateCcw,
  CheckCircle2,
  X,
  ShieldCheck,
  Heart,
  Volume2,
} from "lucide-react";

interface MindsetJournalModalProps {
  isOpen: boolean;
  onClose: () => void;
  /**
   * Identifiant de compte (email) inclus dans la clé `localStorage` de
   * l'historique — absent : clé partagée `horizon_mindset_logs` (bureau
   * staff, partagé par construction entre tous les coachs, comme les autres
   * caches locaux de ce bureau). Fourni côté élève (`App.tsx`) : sans lui,
   * deux élèves différents sur un même poste partagé se voyaient le même
   * historique de check-in émotionnel (anxiété, tilt/revanche…) — une donnée
   * sensible qui n'a rien à faire entre deux comptes distincts.
   */
  storageKey?: string;
}

type EmotionState = "CALM" | "DISCIPLINED" | "ANXIOUS" | "IMPULSIVE" | "REVENGE";

interface MindsetLog {
  id: string;
  date: string;
  emotion: EmotionState;
  sleepQuality: number;
  tiltRisk: number;
  status: string;
}

const playZenSound = (freq = 432, duration = 1.2) => {
  try {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(freq, ctx.currentTime);
    gain.gain.setValueAtTime(0.08, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + duration);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + duration);
  } catch (e) {
    // Ignore audio autoplay restrictions
  }
};

export const MindsetJournalModal: React.FC<MindsetJournalModalProps> = ({
  isOpen,
  onClose,
  storageKey,
}) => {
  const [selectedEmotion, setSelectedEmotion] = useState<EmotionState>("CALM");
  const [sleepQuality, setSleepQuality] = useState<number>(8); // 1-10
  const [sleepHours, setSleepHours] = useState<number>(7.5);
  const [isSoundEnabled, setIsSoundEnabled] = useState<boolean>(true);

  const localStorageKey = storageKey ? `horizon_mindset_logs_${storageKey}` : "horizon_mindset_logs";

  // Mindset logs history
  const [logs, setLogs] = useState<MindsetLog[]>(() => {
    try {
      const saved = localStorage.getItem(localStorageKey);
      return saved ? JSON.parse(saved) : [
        { id: "1", date: "2026-07-29 14:00", emotion: "CALM", sleepQuality: 8, tiltRisk: 15, status: "OPTIMAL" },
        { id: "2", date: "2026-07-28 09:30", emotion: "DISCIPLINED", sleepQuality: 9, tiltRisk: 10, status: "OPTIMAL" },
      ];
    } catch {
      return [];
    }
  });

  // Breathing exercise state
  const [isBreathing, setIsBreathing] = useState<boolean>(false);
  const [breathingPhase, setBreathingPhase] = useState<"Inhale" | "Hold" | "Exhale">("Inhale");
  const [secondsLeft, setSecondsLeft] = useState<number>(4);

  useEffect(() => {
    let interval: any = null;
    if (isBreathing) {
      interval = setInterval(() => {
        setSecondsLeft((prev) => {
          if (prev > 1) return prev - 1;

          if (breathingPhase === "Inhale") {
            setBreathingPhase("Hold");
            if (isSoundEnabled) playZenSound(528, 1.5);
            return 7;
          } else if (breathingPhase === "Hold") {
            setBreathingPhase("Exhale");
            if (isSoundEnabled) playZenSound(396, 1.8);
            return 8;
          } else {
            setBreathingPhase("Inhale");
            if (isSoundEnabled) playZenSound(432, 1.2);
            return 4;
          }
        });
      }, 1000);
    } else {
      setBreathingPhase("Inhale");
      setSecondsLeft(4);
    }
    return () => clearInterval(interval);
  }, [isBreathing, breathingPhase, isSoundEnabled]);

  if (!isOpen) return null;

  // Compute tilt recommendation based on emotion & sleep
  const computedTilt = Math.min(
    100,
    Math.max(
      0,
      (selectedEmotion === "CALM"
        ? 10
        : selectedEmotion === "DISCIPLINED"
        ? 5
        : selectedEmotion === "ANXIOUS"
        ? 45
        : selectedEmotion === "IMPULSIVE"
        ? 75
        : 90) + (10 - sleepQuality) * 3
    )
  );

  const handleSaveCheckIn = () => {
    const newLog: MindsetLog = {
      id: Date.now().toString(),
      date: new Date().toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" }),
      emotion: selectedEmotion,
      sleepQuality,
      tiltRisk: computedTilt,
      status: computedTilt > 60 ? "DANGER" : computedTilt > 35 ? "MODERE" : "OPTIMAL",
    };
    const updated = [newLog, ...logs];
    setLogs(updated);
    try {
      localStorage.setItem(localStorageKey, JSON.stringify(updated));
    } catch {
      // ignore
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-[#0D1110]/80 backdrop-blur-md flex items-center justify-center p-4 font-sans">
      <div className="bg-[#111615] border border-[#1B2320] rounded-2xl max-w-2xl w-full p-6 space-y-6 shadow-2xl relative text-slate-100 my-6 max-h-[92vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#1B2320] pb-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-purple-500/10 text-purple-400 border border-purple-500/20">
              <Brain className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                Psychologie & Gestion du Tilt
                <span className="px-2 py-0.5 rounded bg-purple-500/20 text-purple-300 text-[10px] font-mono font-bold border border-purple-500/30">
                  MINDSET RADAR
                </span>
              </h3>
              <p className="text-xs text-slate-400">
                Évalue ton état d'esprit avant d'ouvrir la plateforme pour éviter le trading compulsif.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg bg-[#1B2320] hover:bg-[#232D29] text-slate-400 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Emotion Selector */}
        <div className="space-y-3">
          <label className="block text-xs font-medium text-slate-300">
            1. Comment te sens-tu en ce moment ?
          </label>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
            {[
              { id: "CALM", label: "Calme", icon: "😌", color: "border-[#00E676]/40 text-[#00E676]" },
              { id: "DISCIPLINED", label: "Discipliné", icon: "🎯", color: "border-blue-500/40 text-blue-400" },
              { id: "ANXIOUS", label: "Anxieux", icon: "😰", color: "border-amber-500/40 text-amber-400" },
              { id: "IMPULSIVE", label: "Impulsif", icon: "⚡", color: "border-orange-500/40 text-orange-400" },
              { id: "REVENGE", label: "Tilt / Revanche", icon: "😡", color: "border-rose-500/40 text-rose-400" },
            ].map((e) => (
              <button
                key={e.id}
                onClick={() => setSelectedEmotion(e.id as EmotionState)}
                className={`p-3 rounded-xl border text-center transition-all flex flex-col items-center gap-1.5 ${
                  selectedEmotion === e.id
                    ? `bg-[#1B2320] ${e.color} font-bold shadow-md scale-105`
                    : "bg-[#0D1110] border-[#1B2320] text-slate-400 hover:text-white"
                }`}
              >
                <span className="text-xl">{e.icon}</span>
                <span className="text-xs">{e.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Tilt Level Indicator Banner */}
        <div className="bg-[#0D1110] border border-[#1B2320] rounded-xl p-4 space-y-3">
          <div className="flex items-center justify-between text-xs font-mono">
            <span className="text-slate-400">INDICE DE RISQUE DE TILT PRE-SESSION :</span>
            <span
              className={`font-bold text-sm ${
                computedTilt > 60
                  ? "text-rose-400"
                  : computedTilt > 35
                  ? "text-amber-400"
                  : "text-[#00E676]"
              }`}
            >
              {computedTilt}% {computedTilt > 60 ? "(DANGER)" : computedTilt > 35 ? "(MODÉRÉ)" : "(OPTIMAL)"}
            </span>
          </div>

          <div className="w-full bg-[#111615] h-3 rounded-full overflow-hidden border border-[#1B2320]">
            <div
              className={`h-full transition-all duration-500 ${
                computedTilt > 60
                  ? "bg-rose-500"
                  : computedTilt > 35
                  ? "bg-amber-400"
                  : "bg-gradient-to-r from-[#00E676] to-[#00E676]"
              }`}
              style={{ width: `${computedTilt}%` }}
            />
          </div>

          {computedTilt > 60 ? (
            <div className="p-3 rounded-lg bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0" />
              <span>
                <strong>Alerte Tilt :</strong> Il est fortement déconseillé de trader aujourd'hui. Faites une pause et faites l'exercice de respiration ci-dessous.
              </span>
            </div>
          ) : (
            <div className="p-2.5 rounded-lg bg-[#00E676]/10 border border-[#00E676]/20 text-[#00E676] text-xs flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-[#00E676] shrink-0" />
              <span>Mentalité optimale pour exécuter le plan SMC sans biais émotionnel.</span>
            </div>
          )}
        </div>

        {/* Diaphragmatic Breathing Module */}
        <div className="bg-gradient-to-br from-[#0D1110] to-[#111615] border border-purple-500/30 rounded-2xl p-5 text-center space-y-4">
          <div className="flex items-center justify-center gap-2 text-xs font-mono text-purple-300">
            <Heart className="w-4 h-4 text-purple-400 animate-pulse" />
            <span>EXERCICE DE RESPIRATION DIAPHRAGMATIQUE (4-7-8)</span>
          </div>

          <div className="relative w-32 h-32 mx-auto flex items-center justify-center">
            {/* Pulsing ring */}
            <div
              className={`absolute inset-0 rounded-full border-2 transition-all duration-1000 ${
                isBreathing
                  ? breathingPhase === "Inhale"
                    ? "border-[#00E676] scale-110 shadow-[0_0_20px_rgba(0,230,118,0.4)]"
                    : breathingPhase === "Hold"
                    ? "border-amber-400 scale-105 shadow-[0_0_20px_rgba(251,191,36,0.4)]"
                    : "border-purple-400 scale-95 shadow-[0_0_20px_rgba(192,132,252,0.4)]"
                  : "border-[#1B2320]"
              }`}
            />

            <div className="text-center space-y-1">
              <div className="text-3xl font-black text-white font-mono">{secondsLeft}s</div>
              <div className="text-xs font-bold text-purple-300 uppercase tracking-wider">
                {isBreathing ? breathingPhase : "Prêt"}
              </div>
            </div>
          </div>

          <div className="flex justify-center gap-3 pt-2">
            <button
              onClick={() => setIsBreathing(!isBreathing)}
              className={`px-5 py-2.5 rounded-xl text-xs font-extrabold flex items-center gap-2 transition-all shadow-md ${
                isBreathing
                  ? "bg-rose-500 hover:bg-rose-600 text-white"
                  : "bg-purple-600 hover:bg-purple-500 text-white"
              }`}
            >
              {isBreathing ? (
                <>
                  <RotateCcw className="w-4 h-4" /> Stopper l'exercice
                </>
              ) : (
                <>
                  <Play className="w-4 h-4 fill-white" /> Démarrer la respiration 60s
                </>
              )}
            </button>
          </div>
        </div>

        {/* Footer actions */}
        <div className="flex items-center justify-between pt-3 border-t border-[#1B2320] text-xs">
          <span className="text-slate-500 font-mono">
            Règle n°1 : Le marché sera toujours là demain.
          </span>
          <button
            onClick={handleSaveCheckIn}
            className="px-5 py-2.5 rounded-xl bg-[#00E676] hover:bg-[#00c865] text-slate-950 font-extrabold shadow-md cursor-pointer"
          >
            Enregistrer mon Check-in & Entrer
          </button>
        </div>
      </div>
    </div>
  );
};
