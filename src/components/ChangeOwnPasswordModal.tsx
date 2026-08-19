import React, { useState } from "react";
import { Eye, EyeOff, KeyRound, X } from "lucide-react";
import { api } from "../lib/api";

interface ChangeOwnPasswordModalProps {
  isOpen: boolean;
  onClose: () => void;
}

/** Doit rester aligné sur `changePasswordSchema` côté serveur (`server/schemas.ts`). */
const PASSWORD_MIN = 10;

/**
 * Changement de mot de passe volontaire, pour un compte staff déjà connecté
 * — accessible depuis "Badges & Profil", pas seulement forcé après une
 * invitation (`ChangePasswordScreen.tsx`, qui reste l'écran plein page
 * utilisé quand `mustChangePassword` bloque l'accès). Mêmes règles, même
 * route serveur (`POST /api/auth/change-password`) : mot de passe actuel
 * vérifié, 10 caractères minimum, empreinte hachée.
 *
 * Le serveur ferme toutes les AUTRES sessions ouvertes de ce compte à la
 * validation (`destroyOtherSessions`) — jamais celle-ci : contrairement au
 * changement forcé (où être déconnecté juste après n'a aucune importance,
 * l'écran suivant est de toute façon un tableau de bord tout neuf), ici
 * l'auteur du changement doit rester connecté sur l'appareil qu'il vient
 * d'utiliser pour le faire.
 */
export const ChangeOwnPasswordModal: React.FC<ChangeOwnPasswordModalProps> = ({ isOpen, onClose }) => {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [visible, setVisible] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const reset = () => {
    setCurrentPassword("");
    setNewPassword("");
    setConfirmation("");
    setVisible(false);
    setPending(false);
    setError(null);
    setSuccess(null);
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pending) return;

    if (newPassword.length < PASSWORD_MIN) {
      setError(`Le nouveau mot de passe doit faire au moins ${PASSWORD_MIN} caractères.`);
      return;
    }
    if (newPassword !== confirmation) {
      setError("Les deux mots de passe ne correspondent pas.");
      return;
    }

    setPending(true);
    setError(null);
    try {
      await api.changePassword(currentPassword, newPassword);
      setSuccess("Mot de passe changé. Tes autres sessions ouvertes ont été déconnectées.");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmation("");
    } catch (err) {
      setError((err as Error).message || "Le changement de mot de passe a échoué.");
    } finally {
      setPending(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[60] bg-[#0D1110]/85 backdrop-blur-md flex items-center justify-center p-4">
      <div className="bg-[#111615] border border-[#1B2320] rounded-2xl max-w-md w-full shadow-2xl relative">
        <div className="px-6 pt-6 pb-4 flex items-center justify-between border-b border-[#1B2320]">
          <div className="flex items-center gap-2.5">
            <KeyRound className="w-5 h-5 text-[#00E676]" />
            <div>
              <h3 className="text-base font-bold text-white">Mon mot de passe</h3>
              <p className="text-xs text-slate-400">Modifier le mot de passe de ce compte</p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="p-1.5 rounded-lg text-slate-500 hover:text-white hover:bg-[#1B2320] transition-colors"
            aria-label="Fermer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
          <div>
            <label className="block text-[10px] uppercase tracking-wide text-slate-500 mb-1.5" htmlFor="own-current-password">
              Mot de passe actuel
            </label>
            <input
              id="own-current-password"
              type={visible ? "text" : "password"}
              autoComplete="current-password"
              required
              autoFocus
              readOnly={pending}
              value={currentPassword}
              onChange={(e) => {
                setCurrentPassword(e.target.value);
                setError(null);
                setSuccess(null);
              }}
              className="w-full bg-[#0D1110] border border-[#1B2320] rounded-xl px-3.5 py-2.5 text-white focus:outline-none focus:border-[#00E676]"
            />
          </div>

          <div>
            <label className="block text-[10px] uppercase tracking-wide text-slate-500 mb-1.5" htmlFor="own-new-password">
              Nouveau mot de passe
            </label>
            <div className="relative">
              <input
                id="own-new-password"
                type={visible ? "text" : "password"}
                autoComplete="new-password"
                required
                minLength={PASSWORD_MIN}
                placeholder={`${PASSWORD_MIN} caractères minimum`}
                readOnly={pending}
                value={newPassword}
                onChange={(e) => {
                  setNewPassword(e.target.value);
                  setError(null);
                  setSuccess(null);
                }}
                className="w-full bg-[#0D1110] border border-[#1B2320] rounded-xl px-3.5 py-2.5 pr-11 text-white focus:outline-none focus:border-[#00E676]"
              />
              <button
                type="button"
                onClick={() => setVisible((v) => !v)}
                aria-pressed={visible}
                aria-label={visible ? "Masquer les mots de passe" : "Afficher les mots de passe"}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-lg text-slate-500 hover:text-slate-200 transition-colors"
              >
                {visible ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <div>
            <label className="block text-[10px] uppercase tracking-wide text-slate-500 mb-1.5" htmlFor="own-confirm-password">
              Confirme le nouveau mot de passe
            </label>
            <input
              id="own-confirm-password"
              type={visible ? "text" : "password"}
              autoComplete="new-password"
              required
              readOnly={pending}
              value={confirmation}
              onChange={(e) => {
                setConfirmation(e.target.value);
                setError(null);
                setSuccess(null);
              }}
              className="w-full bg-[#0D1110] border border-[#1B2320] rounded-xl px-3.5 py-2.5 text-white focus:outline-none focus:border-[#00E676]"
            />
          </div>

          {error && (
            <p role="alert" className="text-xs text-rose-400">
              {error}
            </p>
          )}
          {success && (
            <p role="status" className="text-xs text-[#00E676]">
              {success}
            </p>
          )}

          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={handleClose}
              className="px-4 py-2.5 rounded-xl bg-[#1B2320] hover:bg-[#232D29] text-slate-300 font-bold text-sm"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={pending}
              aria-busy={pending}
              className="px-5 py-2.5 rounded-xl bg-[#00E676] hover:bg-[#00c865] disabled:opacity-60 text-slate-950 font-extrabold text-sm flex items-center gap-1.5"
            >
              <KeyRound className="w-4 h-4" />
              {pending ? "Enregistrement…" : "Changer le mot de passe"}
            </button>
          </div>

          <p className="text-[10px] text-slate-500 leading-relaxed border-t border-[#1B2320] pt-3">
            Tes autres sessions ouvertes seront déconnectées.
          </p>
        </form>
      </div>
    </div>
  );
};
