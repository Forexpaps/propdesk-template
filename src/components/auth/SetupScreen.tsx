import React, { useState } from "react";
import { Eye, EyeOff, ShieldCheck } from "lucide-react";
import {
  AuthShell,
  AuthField,
  AuthError,
  AUTH_INPUT_CLASS,
  AUTH_BUTTON_CLASS,
} from "./AuthShell";

interface SetupScreenProps {
  onSetup: (password: string) => Promise<void>;
  /** Relance la sonde d'état, quand un compte s'avère déjà exister. */
  onRefresh: () => void;
}

/** Doit rester aligné sur `setupSchema` côté serveur. */
const PASSWORD_MIN = 10;

const ERROR_ID = "setup-error";

export const SetupScreen: React.FC<SetupScreenProps> = ({ onSetup, onRefresh }) => {
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [visible, setVisible] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pending) return;

    // Contrôles côté client : ils évitent un aller-retour, mais le serveur
    // revalide tout — c'est lui qui fait autorité.
    if (password.length < PASSWORD_MIN) {
      setError(`Ton mot de passe doit faire au moins ${PASSWORD_MIN} caractères.`);
      return;
    }
    if (password !== confirmation) {
      setError("Les deux mots de passe ne correspondent pas.");
      return;
    }

    setPending(true);
    setError(null);
    try {
      await onSetup(password);
    } catch (err) {
      const message = (err as Error).message ?? "";
      if (message.includes("existe déjà")) {
        setError("Un compte existe déjà. Retour à l'écran de connexion…");
        onRefresh();
      } else {
        setError(
          err instanceof TypeError
            ? "Serveur injoignable. Vérifie qu'il est démarré."
            : message || "L'installation a échoué."
        );
      }
    } finally {
      setPending(false);
    }
  };

  const clearError = () => setError((prev) => (prev === null ? prev : null));

  return (
    <AuthShell
      title="Première installation"
      subtitle="Choisis le mot de passe qui protégera ton espace."
      notice={
        <div className="rounded-xl border border-[#00E676]/25 bg-[#00E676]/10 px-3 py-2.5 text-xs text-[#69F0AE] leading-relaxed">
          Tes données existantes sont conservées — trades, portefeuille,
          badges et progression. Cette étape ne fait qu'ajouter un mot de
          passe.
        </div>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <AuthField
          id="setup-password"
          label="Mot de passe"
          hint={`${PASSWORD_MIN} caractères minimum. Une phrase longue vaut mieux qu'un mot compliqué.`}
        >
          <div className="relative">
            <input
              id="setup-password"
              name="new-password"
              type={visible ? "text" : "password"}
              autoComplete="new-password"
              required
              autoFocus
              minLength={PASSWORD_MIN}
              readOnly={pending}
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
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
              aria-label={visible ? "Masquer le mot de passe" : "Afficher le mot de passe"}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-lg text-slate-500 hover:text-slate-200 transition-colors"
            >
              {visible ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
        </AuthField>

        <AuthField id="setup-confirmation" label="Confirme le mot de passe">
          <input
            id="setup-confirmation"
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
            <ShieldCheck className="w-4 h-4" />
            {pending ? "Création du compte…" : "Créer mon accès"}
          </span>
        </button>
      </form>
    </AuthShell>
  );
};
