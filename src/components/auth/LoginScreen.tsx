import React, { useState } from "react";
import { Eye, EyeOff, LogIn } from "lucide-react";
import {
  AuthShell,
  AuthField,
  AuthError,
  AUTH_INPUT_CLASS,
  AUTH_BUTTON_CLASS,
} from "./AuthShell";

interface LoginScreenProps {
  onLogin: (email: string, password: string) => Promise<void>;
  /** Vrai quand l'utilisateur arrive ici parce que sa session a expiré. */
  expired: boolean;
  /** Personnalisation du texte d'accroche — le formulaire reste identique. */
  title?: string;
  subtitle?: string;
  footer?: React.ReactNode;
}

const ERROR_ID = "login-error";

export const LoginScreen: React.FC<LoginScreenProps> = ({
  onLogin,
  expired,
  title = "Connexion",
  subtitle = "Accède à ton espace de trading.",
  footer = "Mot de passe oublié ? La procédure de secours est décrite dans le README.",
}) => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [visible, setVisible] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    // Une double-frappe sur Entrée consommerait deux crans de limitation de débit.
    if (pending) return;

    setPending(true);
    setError(null);
    try {
      await onLogin(email, password);
    } catch (err) {
      setError(
        err instanceof TypeError
          ? "Serveur injoignable. Vérifie qu'il est démarré."
          : (err as Error).message || "La connexion a échoué."
      );
    } finally {
      setPending(false);
    }
  };

  /** L'erreur ne doit pas rester affichée pendant une nouvelle saisie. */
  const clearError = () => setError((prev) => (prev === null ? prev : null));

  return (
    <AuthShell
      title={title}
      subtitle={subtitle}
      notice={
        expired && !error ? (
          <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2.5 text-xs text-amber-200">
            Ta session a expiré. Reconnecte-toi pour continuer.
          </div>
        ) : undefined
      }
      footer={footer}
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <AuthField id="login-email" label="Adresse e-mail">
          <input
            id="login-email"
            name="email"
            type="email"
            autoComplete="username"
            autoCapitalize="none"
            spellCheck={false}
            inputMode="email"
            required
            autoFocus
            readOnly={pending}
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              clearError();
            }}
            placeholder="toi@exemple.fr"
            className={AUTH_INPUT_CLASS}
          />
        </AuthField>

        <AuthField id="login-password" label="Mot de passe">
          <div className="relative">
            <input
              id="login-password"
              name="password"
              type={visible ? "text" : "password"}
              autoComplete="current-password"
              required
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
            {/* type="button" impératif : sinon ce bouton soumet le formulaire. */}
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

        {error && <AuthError id={ERROR_ID} message={error} />}

        <button type="submit" disabled={pending} aria-busy={pending} className={AUTH_BUTTON_CLASS}>
          <span className="inline-flex items-center justify-center gap-2">
            <LogIn className="w-4 h-4" />
            {pending ? "Connexion…" : "Se connecter"}
          </span>
        </button>
      </form>
    </AuthShell>
  );
};
