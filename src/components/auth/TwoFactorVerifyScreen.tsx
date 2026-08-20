import React, { useState } from "react";
import { ShieldCheck, KeyRound } from "lucide-react";
import { AuthShell, AuthField, AuthError, AUTH_INPUT_CLASS, AUTH_BUTTON_CLASS } from "./AuthShell";

interface TwoFactorVerifyScreenProps {
  onVerifyCode: (code: string) => Promise<void>;
  onVerifyRecoveryCode: (recoveryCode: string) => Promise<void>;
  /** Reprend depuis zéro l'écran de connexion — le défi expire de toute façon après 5 minutes. */
  onCancel: () => void;
}

const ERROR_ID = "totp-verify-error";

/**
 * Étape 2 de connexion, affichée uniquement quand `useAuth().status ===
 * "2fa-required"` (mot de passe déjà vérifié) — voir `POST /auth/login/2fa`.
 * Deux formulaires alternatifs (code TOTP à 6 chiffres, ou code de
 * récupération à usage unique) plutôt que deux écrans séparés : un compte
 * qui a perdu son téléphone doit pouvoir basculer sans revenir en arrière.
 */
export const TwoFactorVerifyScreen: React.FC<TwoFactorVerifyScreenProps> = ({
  onVerifyCode,
  onVerifyRecoveryCode,
  onCancel,
}) => {
  const [useRecoveryCode, setUseRecoveryCode] = useState(false);
  const [code, setCode] = useState("");
  const [recoveryCode, setRecoveryCode] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const clearError = () => setError((prev) => (prev === null ? prev : null));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pending) return;

    setPending(true);
    setError(null);
    try {
      if (useRecoveryCode) {
        await onVerifyRecoveryCode(recoveryCode.trim());
      } else {
        await onVerifyCode(code.trim());
      }
    } catch (err) {
      setError((err as Error).message || "Vérification impossible.");
    } finally {
      setPending(false);
    }
  };

  return (
    <AuthShell
      title="Vérification en deux étapes"
      subtitle={
        useRecoveryCode
          ? "Saisis l'un de tes codes de récupération à usage unique."
          : "Ouvre ton appli d'authentification et saisis le code à 6 chiffres."
      }
      footer={
        <button
          type="button"
          onClick={() => {
            setUseRecoveryCode((v) => !v);
            setCode("");
            setRecoveryCode("");
            clearError();
          }}
          className="text-slate-400 hover:text-[#00E676] underline underline-offset-2"
        >
          {useRecoveryCode ? "Utiliser mon appli d'authentification" : "Appareil perdu ? Utilise un code de récupération"}
        </button>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {useRecoveryCode ? (
          <AuthField id="totp-recovery-code" label="Code de récupération">
            <input
              id="totp-recovery-code"
              name="recoveryCode"
              type="text"
              autoComplete="one-time-code"
              autoCapitalize="characters"
              spellCheck={false}
              required
              autoFocus
              readOnly={pending}
              value={recoveryCode}
              onChange={(e) => {
                setRecoveryCode(e.target.value);
                clearError();
              }}
              placeholder="XXXXX-XXXXX"
              className={`${AUTH_INPUT_CLASS} font-mono tracking-wider`}
            />
          </AuthField>
        ) : (
          <AuthField id="totp-code" label="Code à 6 chiffres">
            <input
              id="totp-code"
              name="code"
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="\d{6}"
              maxLength={6}
              required
              autoFocus
              readOnly={pending}
              value={code}
              onChange={(e) => {
                setCode(e.target.value.replace(/\D/g, "").slice(0, 6));
                clearError();
              }}
              placeholder="123456"
              className={`${AUTH_INPUT_CLASS} font-mono tracking-[0.3em] text-center text-lg`}
            />
          </AuthField>
        )}

        {error && <AuthError id={ERROR_ID} message={error} />}

        <button type="submit" disabled={pending} aria-busy={pending} className={AUTH_BUTTON_CLASS}>
          <span className="inline-flex items-center justify-center gap-2">
            {useRecoveryCode ? <KeyRound className="w-4 h-4" /> : <ShieldCheck className="w-4 h-4" />}
            {pending ? "Vérification…" : "Vérifier"}
          </span>
        </button>

        <button
          type="button"
          onClick={onCancel}
          className="w-full text-center text-xs text-slate-500 hover:text-slate-300 transition-colors"
        >
          Annuler et revenir à la connexion
        </button>
      </form>
    </AuthShell>
  );
};
