import React, { useState } from "react";
import { AlertTriangle, Upload, Trash2, X } from "lucide-react";
import { describePending, replayPending } from "../lib/pendingChanges";
import { confirmDialog } from "../lib/confirmDialog";

/**
 * Bandeau proposé quand des modifications faites hors ligne n'ont jamais été
 * envoyées au serveur.
 *
 * Il existe parce que le rejeu ne peut **pas** être automatique. Le bureau est
 * partagé entre plusieurs comptes staff, et les collections sont remplacées en
 * bloc, jamais fusionnées ligne à ligne : renvoyer le cache local sans rien
 * demander écraserait ce qu'un collègue aurait modifié pendant la coupure.
 * L'arbitrage revient donc à l'utilisateur, qui seul sait ce que contiennent
 * ces modifications.
 *
 * Ce que l'écran affiche pendant ce temps est **l'état du serveur**, pas les
 * modifications en attente : elles dorment dans le cache local. D'où le
 * rechargement après un envoi réussi, sans lequel l'utilisateur continuerait
 * de voir l'ancienne version alors qu'il vient d'envoyer la nouvelle.
 */

interface PendingChangesBannerProps {
  /** Clés `localStorage` en attente. Le bandeau ne s'affiche pas si vide. */
  pending: string[];
  /** Oublie les modifications et réaligne le cache sur le serveur. */
  onDiscard: () => void;
  /** Signale un rejeu réussi au parent, avant rechargement. */
  onReplayed: () => void;
}

export const PendingChangesBanner: React.FC<PendingChangesBannerProps> = ({
  pending,
  onDiscard,
  onReplayed,
}) => {
  const [busy, setBusy] = useState(false);
  const [erreurs, setErreurs] = useState<{ label: string; motif: string }[]>([]);

  if (pending.length === 0) return null;

  const libelles = describePending(pending);

  const envoyer = async () => {
    if (busy) return;
    setBusy(true);
    setErreurs([]);
    try {
      const { echecs } = await replayPending();

      if (echecs.length > 0) {
        // Les clés en échec restent en attente : on garde le bandeau et on
        // explique, plutôt que de recharger sur un succès partiel silencieux.
        setErreurs(echecs);
        setBusy(false);
        return;
      }

      onReplayed();
      // Rechargement plutôt que remontée d'état : toutes les collections
      // viennent de changer côté serveur, et repartir d'un démarrage propre
      // est plus sûr que de tenter de les resynchroniser une à une.
      window.location.reload();
    } catch (err) {
      setErreurs([{ label: "Envoi", motif: (err as Error).message || "Échec inattendu." }]);
      setBusy(false);
    }
  };

  const abandonner = async () => {
    if (busy) return;
    const ok = await confirmDialog(
      `Abandonner définitivement les modifications hors ligne (${libelles.join(", ")}) ?\n\n` +
        "Elles seront remplacées par la version du serveur. C'est irréversible.",
      { title: "Abandonner les modifications", confirmLabel: "Abandonner", danger: true }
    );
    if (!ok) return;
    onDiscard();
    window.location.reload();
  };

  return (
    <div className="bg-amber-500/10 border-b border-amber-500/30 px-4 sm:px-8 py-3">
      <div className="max-w-7xl mx-auto flex flex-col gap-3">
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
          <div className="flex items-start gap-2.5 min-w-0">
            <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
            <div className="min-w-0">
              <p className="text-xs font-bold text-amber-200">
                Des modifications faites hors ligne n'ont pas été enregistrées.
              </p>
              <p className="text-[11px] text-amber-200/70 leading-relaxed">
                Concernées : {libelles.join(", ")}. L'écran affiche pour l'instant la
                version du serveur. Si un collègue a modifié les mêmes données pendant
                la coupure, l'envoi remplacera son travail.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={envoyer}
              disabled={busy}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-400 hover:bg-amber-300 disabled:opacity-60 text-slate-950 text-[11px] font-bold transition-colors"
            >
              <Upload className="w-3.5 h-3.5" />
              {busy ? "Envoi…" : "Envoyer mes modifications"}
            </button>
            <button
              onClick={abandonner}
              disabled={busy}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#1B2320] hover:bg-[#232D29] disabled:opacity-60 text-slate-300 text-[11px] font-semibold transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Abandonner
            </button>
          </div>
        </div>

        {erreurs.length > 0 && (
          <div className="flex items-start gap-2.5 rounded-lg bg-rose-500/10 border border-rose-500/30 px-3 py-2">
            <X className="w-3.5 h-3.5 text-rose-400 shrink-0 mt-0.5" />
            <div className="text-[11px] text-rose-200 space-y-0.5">
              <p className="font-bold">Envoi partiel — ces éléments sont restés en attente :</p>
              {erreurs.map((e) => (
                <p key={e.label}>
                  <span className="font-semibold">{e.label}</span> — {e.motif}
                </p>
              ))}
              <p className="text-rose-200/70">
                Ils te seront reproposés au prochain démarrage. Rien n'a été perdu.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
