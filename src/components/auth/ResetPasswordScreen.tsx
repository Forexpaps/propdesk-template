import React, { useState } from "react";
import { Eye, EyeOff, CheckCircle2 } from "lucide-react";
import { AuthShell, AuthField, AuthError, AUTH_INPUT_CLASS, AUTH_BUTTON_CLASS } from "./AuthShell";
import { api } from "../../lib/api";

interface ResetPasswordScreenProps {
  token: string;
  /** Retour à l'écran de connexion, après succès ou en cas de lien inutilisable. */
  onDone: () => void;
}

const ERROR_ID = "reset-password-error";

/**
 * Écran public (aucune session requise) atteint via un lien
 * `/reset-password?token=...` généré par le staff depuis une fiche élève
 * (`StudentTracking.tsx`, section « Accès & connexion »). Consomme le jeton
 * en une seule tentative réussie : `api.consumePasswordReset` renvoie une
 * erreur explicite si le lien est déjà utilisé, invalide, ou expiré (1h).
 */
export const ResetPasswordScreen: React.FC<ResetPasswordScreenProps> = ({ token, onDone }) => {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [visible, setVisible] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const clearError = () => setError((prev) => (prev === null ? prev : null));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pending) return;

    if (password.length < 10) {
      setError("Le mot de passe doit faire au moins 10 caractères.");
      return;
    }
    if (password !== confirm) {
      setError("Les deux mots de passe ne correspondent pas.");
      return;
    }

    setPending(true);
    setError(null);
    try {
      await api.consumePasswordReset(token, password);
      setDone(true);
    } catch (err) {
      setError(
        err instanceof TypeError
          ? "Serveur injoignable. Vérifie qu'il est démarré."
          : (err as Error).message || "La réinitialisation a échoué."
      );
    } finally {
      setPending(false);
    }
  };

  if (done) {
    return (
      <AuthShell title="Mot de passe mis à jour" subtitle="Tu peux maintenant te connecter avec ton nouveau mot de passe.">
        <div className="space-y-4">
          <div className="flex items-center gap-2 rounded-xl border border-[#00E676]/30 bg-[#00E676]/10 px-3 py-2.5 text-xs text-[#00E676]">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            Ton mot de passe a bien été changé.
          </div>
          <button type="button" onClick={onDone} className={AUTH_BUTTON_CLASS}>
            Aller à la connexion
          </button>
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell title="Choisis un nouveau mot de passe" subtitle="Ce lien n'est valable qu'une seule fois.">
      <form onSubmit={handleSubmit} className="space-y-4">
        <AuthField id="reset-password" label="Nouveau mot de passe" hint="10 caractères minimum.">
          <div className="relative">
            <input
              id="reset-password"
              name="new-password"
              type={visible ? "text" : "password"}
              autoComplete="new-password"
              required
              autoFocus
              readOnly={pending}
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                clearError();
              }}
              className={`${AUTH_INPUT_CLASS} pr-11`}
            />
            <button
              type="button"
              onClick={() => setVisible((prev) => !prev)}
              aria-pressed={visible}
              aria-label={visible ? "Masquer le mot de passe" : "Afficher le mot de passe"}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-lg text-slate-500 hover:text-slate-200 transition-colors"
            >
              {visible ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
        </AuthField>

        <AuthField id="reset-password-confirm" label="Confirme le mot de passe">
          <input
            id="reset-password-confirm"
            name="new-password-confirm"
            type={visible ? "text" : "password"}
            autoComplete="new-password"
            required
            readOnly={pending}
            value={confirm}
            onChange={(e) => {
              setConfirm(e.target.value);
              clearError();
            }}
            aria-invalid={error !== null}
            aria-describedby={error ? ERROR_ID : undefined}
            className={AUTH_INPUT_CLASS}
          />
        </AuthField>

        {error && <AuthError id={ERROR_ID} message={error} />}

        <button type="submit" disabled={pending} aria-busy={pending} className={AUTH_BUTTON_CLASS}>
          {pending ? "Enregistrement…" : "Enregistrer le mot de passe"}
        </button>
      </form>
    </AuthShell>
  );
};
