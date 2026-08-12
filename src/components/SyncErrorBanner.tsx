import React from "react";
import { AlertTriangle, X } from "lucide-react";

interface SyncErrorBannerProps {
  message: string | null;
  onDismiss: () => void;
}

/**
 * Avertissement immédiat quand une sauvegarde en arrière-plan échoue alors
 * que l'app se croit en ligne (réseau instable, conflit de synchronisation).
 *
 * La donnée elle-même n'est pas perdue — `useSyncedState` la protège via le
 * même registre `markPending` que le mode hors ligne, que
 * `PendingChangesBanner` proposera de renvoyer au prochain démarrage. Ce
 * bandeau-ci n'est qu'un signal immédiat pendant la session en cours ; il ne
 * déclenche aucune action de renvoi lui-même.
 */
export const SyncErrorBanner: React.FC<SyncErrorBannerProps> = ({ message, onDismiss }) => {
  if (!message) return null;

  return (
    <div className="fixed bottom-4 right-4 z-[70] max-w-sm bg-[#1B1010] border border-rose-500/40 rounded-xl shadow-2xl p-3.5 flex items-start gap-2.5">
      <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
      <div className="flex-1 min-w-0">
        <p className="text-xs font-bold text-rose-200">Sauvegarde impossible</p>
        <p className="text-[11px] text-rose-200/70 leading-relaxed">{message}</p>
      </div>
      <button
        onClick={onDismiss}
        className="shrink-0 text-rose-300/60 hover:text-rose-200 transition-colors"
        title="Fermer"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
};
