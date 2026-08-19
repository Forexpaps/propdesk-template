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
      // dialogue natif plutôt que de bloquer indéfiniment l'appelant.
      resolve(window.confirm(message));
      return;
    }
    listener({ message, resolve, ...options });
  });
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
          <button
            type="button"
            onClick={() => close(false)}
            className="px-4 py-2 rounded-lg text-sm font-semibold bg-[#1B2320] hover:bg-[#232D29] text-slate-300 transition-colors"
          >
            {request.cancelLabel || "Annuler"}
          </button>
          <button
            type="button"
            onClick={() => close(true)}
            className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${
              request.danger
                ? "bg-rose-500/90 hover:bg-rose-500 text-white"
                : "bg-[#00E676] hover:bg-[#00E676]/90 text-[#0D1110]"
            }`}
          >
            {request.confirmLabel || "Confirmer"}
          </button>
        </div>
      </div>
    </div>
  );
};
