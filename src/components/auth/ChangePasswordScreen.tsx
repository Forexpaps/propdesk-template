import React, { useState } from "react";
import { Eye, EyeOff, KeyRound } from "lucide-react";
import {
  AuthShell,
  AuthField,
  AuthError,
  AUTH_INPUT_CLASS,
  AUTH_BUTTON_CLASS,
} from "./AuthShell";

interface ChangePasswordScreenProps {
  onChangePassword: (currentPassword: string, newPassword: string) => Promise<void>;
}

/** Doit rester aligné sur `changePasswordSchema` côté serveur. */
const PASSWORD_MIN = 10;

const ERROR_ID = "change-password-error";

/**
 * Écran bloquant affiché tant qu'un compte invité utilise encore son mot de
 * passe temporaire. Contrairement à `LoginScreen`/`SetupScreen`, il se monte
 * APRÈS une authentification réussie — la session est valide, seul le mot de
 * passe doit changer avant que le reste de l'application n'apparaisse.
 */
export const ChangePasswordScreen: React.FC<ChangePasswordScreenProps> = ({
  onChangePassword,
}) => {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [visible, setVisible] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pending) return;

    if (newPassword.length < PASSWORD_MIN) {
      setError(`Ton nouveau mot de passe doit faire au moins ${PASSWORD_MIN} caractères.`);
      return;
    }
    if (newPassword !== confirmation) {
      setError("Les deux mots de passe ne correspondent pas.");
      return;
    }

    setPending(true);
    setError(null);
    try {
      await onChangePassword(currentPassword, newPassword);
    } catch (err) {
      setError(
        err instanceof TypeError
          ? "Serveur injoignable. Vérifie qu'il est démarré."
          : (err as Error).message || "Le changement de mot de passe a échoué."
      );
    } finally {
      setPending(false);
    }
  };

  const clearError = () => setError((prev) => (prev === null ? prev : null));

  return (
    <AuthShell
      title="Choisis ton mot de passe"
      subtitle="Ton compte a été créé avec un mot de passe temporaire. Remplace-le par le tien avant de continuer."
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <AuthField id="change-current-password" label="Mot de passe temporaire">
          <input
            id="change-current-password"
            name="current-password"
            type={visible ? "text" : "password"}
            autoComplete="current-password"
            required
            autoFocus
            readOnly={pending}
            value={currentPassword}
            onChange={(e) => {
              setCurrentPassword(e.target.value);
              clearError();
            }}
            className={AUTH_INPUT_CLASS}
          />
        </AuthField>

        <AuthField
          id="change-new-password"
          label="Nouveau mot de passe"
          hint={`${PASSWORD_MIN} caractères minimum.`}
        >
          <div className="relative">
            <input
              id="change-new-password"
              name="new-password"
              type={visible ? "text" : "password"}
              autoComplete="new-password"
              required
              minLength={PASSWORD_MIN}
              readOnly={pending}
              value={newPassword}
              onChange={(e) => {
                setNewPassword(e.target.value);
                clearError();
              }}
              aria-invalid={error !== null}
              aria-describedby={error ? ERROR_ID : undefined}
              className={`${AUTH_INPUT_CLASS} pr-11`}
            />
            <button
              type="button"
              onClick={() => setVisible((prev) => !prev)}
              aria-pressed={visible}
              aria-label={visible ? "Masquer les mots de passe" : "Afficher les mots de passe"}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-lg text-slate-500 hover:text-slate-200 transition-colors"
            >
              {visible ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
        </AuthField>

        <AuthField id="change-confirmation" label="Confirme le nouveau mot de passe">
          <input
            id="change-confirmation"
            name="confirm-password"
            type={visible ? "text" : "password"}
            autoComplete="new-password"
            required
            readOnly={pending}
            value={confirmation}
            onChange={(e) => {
              setConfirmation(e.target.value);
              clearError();
            }}
            aria-invalid={error !== null}
            aria-describedby={error ? ERROR_ID : undefined}
            className={AUTH_INPUT_CLASS}
          />
        </AuthField>

        {error && <AuthError id={ERROR_ID} message={error} />}

        <button type="submit" disabled={pending} aria-busy={pending} className={AUTH_BUTTON_CLASS}>
          <span className="inline-flex items-center justify-center gap-2">
            <KeyRound className="w-4 h-4" />
            {pending ? "Enregistrement…" : "Enregistrer mon mot de passe"}
          </span>
        </button>
      </form>
    </AuthShell>
  );
};
