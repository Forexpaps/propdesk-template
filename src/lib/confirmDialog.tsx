import React, { useEffect, useState } from "react";

/**
 * Remplace `window.confirm()` par une modale stylée, sans devoir faire
 * remonter un state de dialogue dans chaque composant appelant. Un seul
 * host (`ConfirmDialogHost`, monté une fois dans App.tsx) écoute une
 * file d'attente module-level ; `confirmDialog()` s'utilise comme
 * `window.confirm()` mais retourne une Promise, d'où le passage en
 * `async` des handlers qui l'utilisent.
 */

interface ConfirmOptions {
  title?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** Action destructive (suppression, révocation...) : bouton de confirmation en rouge. */
  danger?: boolean;
  /**
   * Simple information à accuser : un seul bouton, aucun choix à faire.
   * Posé ici plutôt que dans un second composant, pour que `alertDialog` et
   * `confirmDialog` partagent exactement la même apparence et la même file.
   */
  infoOnly?: boolean;
}

interface ConfirmRequest extends ConfirmOptions {
  message: string;
  resolve: (value: boolean) => void;
}

let listener: ((req: ConfirmRequest) => void) | null = null;

export function confirmDialog(message: string, options: ConfirmOptions = {}): Promise<boolean> {
  return new Promise((resolve) => {
    if (!listener) {
      // Host pas encore monté (ne devrait pas arriver) : repli sur le
      // dialogue natif plutôt que de bloquer indéfiniment l'appelant. Une
      // information passe par `alert` et non `confirm`, sans quoi elle
      // proposerait un « Annuler » qui n'a aucun sens.
      if (options.infoOnly) {
        window.alert(message);
        resolve(true);
        return;
      }
      resolve(window.confirm(message));
      return;
    }
    listener({ message, resolve, ...options });
  });
}

/**
 * Remplace `window.alert()` : même modale, un seul bouton. Rend la main quand
 * l'utilisateur a accusé réception, ce qui permet d'enchaîner sans empiler
 * deux fenêtres — contrairement à `alert()`, qui bloque tout le thread et
 * casse l'apparence de l'app avec une fenêtre système.
 */
export function alertDialog(message: string, options: Omit<ConfirmOptions, "infoOnly"> = {}): Promise<void> {
  return confirmDialog(message, { ...options, infoOnly: true }).then(() => undefined);
}

export const ConfirmDialogHost: React.FC = () => {
  const [request, setRequest] = useState<ConfirmRequest | null>(null);

  useEffect(() => {
    listener = setRequest;
    return () => {
      listener = null;
    };
  }, []);

  if (!request) return null;

  const close = (result: boolean) => {
    request.resolve(result);
    setRequest(null);
  };

  return (
    <div className="fixed inset-0 z-[100] bg-[#0D1110]/80 backdrop-blur-md flex items-center justify-center p-4 font-sans">
      <div className="bg-[#111615] border border-[#1B2320] rounded-2xl max-w-md w-full shadow-2xl p-5 sm:p-6 text-slate-100">
        {request.title && <h3 className="text-base font-bold text-white mb-2">{request.title}</h3>}
        <p className="text-sm text-slate-300 whitespace-pre-line leading-relaxed">{request.message}</p>
        <div className="flex justify-end gap-2.5 mt-5">
          {/* Une information ne se refuse pas : pas de bouton « Annuler ». */}
          {!request.infoOnly && (
            <button
              type="button"
              onClick={() => close(false)}
              className="px-4 py-2 rounded-lg text-sm font-semibold bg-[#1B2320] hover:bg-[#232D29] text-slate-300 transition-colors"
            >
              {request.cancelLabel || "Annuler"}
            </button>
          )}
          <button
            type="button"
            onClick={() => close(true)}
            className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${
              request.danger
                ? "bg-rose-500/90 hover:bg-rose-500 text-white"
                : "bg-[#00E676] hover:bg-[#00E676]/90 text-[#0D1110]"
            }`}
          >
            {request.confirmLabel || (request.infoOnly ? "OK" : "Confirmer")}
          </button>
        </div>
      </div>
    </div>
  );
};
