import React, { useEffect, useState } from "react";
import { ShieldCheck, ShieldOff, X, Copy, Check, RefreshCw, KeyRound, AlertTriangle } from "lucide-react";
import { api } from "../lib/api";

interface TwoFactorSetupModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type Step =
  | "loading"
  | "status"
  | "setup"
  | "reveal-codes"
  | "disable-confirm"
  | "regenerate-confirm";

const inputClass =
  "w-full bg-[#0D1110] border border-[#1B2320] rounded-xl px-3.5 py-2.5 text-white text-sm focus:outline-none focus:border-[#00E676]/50 placeholder-slate-600";

/**
 * Configuration/gestion de la 2FA (TOTP) d'un compte staff, depuis son
 * propre profil — voir `server/auth/routes.ts` (`/2fa/*`, toutes protégées
 * par `requireStaffKind` seul, donc chaque compte ne gère jamais que la
 * sienne). Pas de QR code (décision explicite, voir HANDOFF) : le secret
 * s'affiche en texte à recopier, plus un lien `otpauth://` cliquable sur
 * mobile.
 *
 * Quatre écrans dans une seule modale plutôt que quatre composants séparés :
 * ils partagent le même état de chargement/erreur et s'enchaînent
 * naturellement (statut → configuration → révélation des codes → retour au
 * statut), sans navigation entre plusieurs modales empilées.
 */
export const TwoFactorSetupModal: React.FC<TwoFactorSetupModalProps> = ({ isOpen, onClose }) => {
  const [step, setStep] = useState<Step>("loading");
  const [enabled, setEnabled] = useState(false);
  const [remainingRecoveryCodes, setRemainingRecoveryCodes] = useState(0);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Configuration en cours
  const [secret, setSecret] = useState("");
  const [otpauthUri, setOtpauthUri] = useState("");
  const [confirmCode, setConfirmCode] = useState("");
  const [copied, setCopied] = useState(false);

  // Confirmation par mot de passe (désactivation / régénération)
  const [password, setPassword] = useState("");

  // Codes de récupération à révéler une seule fois
  const [revealedCodes, setRevealedCodes] = useState<string[]>([]);
  const [acknowledged, setAcknowledged] = useState(false);

  const loadStatus = async () => {
    setStep("loading");
    setError(null);
    try {
      const status = await api.fetch2FAStatus();
      setEnabled(status.enabled);
      setRemainingRecoveryCodes(status.remainingRecoveryCodes);
      setStep("status");
    } catch (err) {
      setError((err as Error).message || "Impossible de charger l'état de la 2FA.");
      setStep("status");
    }
  };

  useEffect(() => {
    if (!isOpen) return;
    setError(null);
    setPassword("");
    setConfirmCode("");
    setAcknowledged(false);
    void loadStatus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  const handleClose = () => {
    if (revealedCodes.length > 0 && !acknowledged) return;
    onClose();
  };

  const startSetup = async () => {
    setPending(true);
    setError(null);
    try {
      const result = await api.setup2FA();
      setSecret(result.secret);
      setOtpauthUri(result.otpauthUri);
      setConfirmCode("");
      setStep("setup");
    } catch (err) {
      setError((err as Error).message || "Impossible de démarrer la configuration.");
    } finally {
      setPending(false);
    }
  };

  const confirmSetup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pending) return;
    setPending(true);
    setError(null);
    try {
      const { recoveryCodes } = await api.enable2FA(confirmCode.trim());
      setRevealedCodes(recoveryCodes);
      setAcknowledged(false);
      setStep("reveal-codes");
    } catch (err) {
      setError((err as Error).message || "Code incorrect.");
    } finally {
      setPending(false);
    }
  };

  const confirmDisable = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pending) return;
    setPending(true);
    setError(null);
    try {
      await api.disable2FA(password);
      setPassword("");
      await loadStatus();
    } catch (err) {
      setError((err as Error).message || "Mot de passe incorrect.");
    } finally {
      setPending(false);
    }
  };

  const confirmRegenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pending) return;
    setPending(true);
    setError(null);
    try {
      const { recoveryCodes } = await api.regenerateRecoveryCodes(password);
      setPassword("");
      setRevealedCodes(recoveryCodes);
      setAcknowledged(false);
      setStep("reveal-codes");
    } catch (err) {
      setError((err as Error).message || "Mot de passe incorrect.");
    } finally {
      setPending(false);
    }
  };

  const copySecret = async () => {
    try {
      await navigator.clipboard.writeText(secret);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Presse-papiers indisponible (contexte non sécurisé, permission refusée) : le secret reste affiché à recopier à la main.
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[60] bg-[#0D1110]/85 backdrop-blur-md flex items-center justify-center p-4">
      <div className="bg-[#111615] border border-[#1B2320] rounded-2xl max-w-md w-full shadow-2xl relative max-h-[calc(100vh-4rem)] flex flex-col overflow-hidden">
        <div className="px-6 pt-6 pb-4 flex items-center justify-between border-b border-[#1B2320] shrink-0">
          <div className="flex items-center gap-2.5">
            <ShieldCheck className="w-5 h-5 text-[#00E676]" />
            <div>
              <h3 className="text-base font-bold text-white">Authentification à deux facteurs</h3>
              <p className="text-xs text-slate-400">Sécurise ce compte avec un code à usage unique.</p>
            </div>
          </div>
          {(revealedCodes.length === 0 || acknowledged) && (
            <button
              onClick={handleClose}
              className="p-1.5 rounded-lg text-slate-500 hover:text-white hover:bg-[#1B2320] transition-colors"
              aria-label="Fermer"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        <div className="px-6 py-5 space-y-4 overflow-y-auto">
          {error && (
            <p role="alert" className="text-xs text-rose-400 bg-rose-500/10 border border-rose-500/20 rounded-xl px-3 py-2.5">
              {error}
            </p>
          )}

          {step === "loading" && (
            <p className="text-sm text-slate-400 text-center py-6">Chargement…</p>
          )}

          {step === "status" && (
            <div className="space-y-4">
              <div
                className={`flex items-center gap-3 p-4 rounded-xl border ${
                  enabled
                    ? "bg-[#00E676]/10 border-[#00E676]/30"
                    : "bg-[#0D1110] border-[#1B2320]"
                }`}
              >
                {enabled ? (
                  <ShieldCheck className="w-6 h-6 text-[#00E676] shrink-0" />
                ) : (
                  <ShieldOff className="w-6 h-6 text-slate-500 shrink-0" />
                )}
                <div>
                  <div className="text-sm font-bold text-white">
                    {enabled ? "2FA activée" : "2FA désactivée"}
                  </div>
                  <p className="text-xs text-slate-400">
                    {enabled
                      ? `${remainingRecoveryCodes} code${remainingRecoveryCodes > 1 ? "s" : ""} de récupération encore valide${remainingRecoveryCodes > 1 ? "s" : ""}.`
                      : "Recommandé pour tout compte staff — protège l'accès aux données de tes élèves."}
                  </p>
                </div>
              </div>

              {enabled ? (
                <div className="space-y-2">
                  <button
                    type="button"
                    onClick={() => setStep("regenerate-confirm")}
                    className="w-full px-4 py-2.5 rounded-xl bg-[#1B2320] hover:bg-[#232D29] text-slate-200 font-bold text-xs flex items-center justify-center gap-1.5"
                  >
                    <RefreshCw className="w-3.5 h-3.5" /> Régénérer mes codes de récupération
                  </button>
                  <button
                    type="button"
                    onClick={() => setStep("disable-confirm")}
                    className="w-full px-4 py-2.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 font-bold text-xs flex items-center justify-center gap-1.5"
                  >
                    <ShieldOff className="w-3.5 h-3.5" /> Désactiver la 2FA
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={startSetup}
                  disabled={pending}
                  className="w-full px-4 py-2.5 rounded-xl bg-[#00E676] hover:bg-[#00c865] disabled:opacity-60 text-slate-950 font-extrabold text-xs flex items-center justify-center gap-1.5"
                >
                  <ShieldCheck className="w-3.5 h-3.5" /> {pending ? "Démarrage…" : "Activer la 2FA"}
                </button>
              )}
            </div>
          )}

          {step === "setup" && (
            <form onSubmit={confirmSetup} className="space-y-4">
              <p className="text-xs text-slate-400">
                Ajoute ce compte dans une appli d'authentification (Google Authenticator, Authy, 1Password…),
                en recopiant le secret ci-dessous.
              </p>

              <div>
                <label className="block text-[10px] uppercase tracking-wide text-slate-500 mb-1.5">
                  Secret à recopier
                </label>
                <div className="flex items-center gap-2">
                  <code className="flex-1 bg-[#0D1110] border border-[#1B2320] rounded-xl px-3.5 py-2.5 text-white text-sm font-mono tracking-wider break-all">
                    {secret}
                  </code>
                  <button
                    type="button"
                    onClick={copySecret}
                    className="p-2.5 rounded-xl bg-[#1B2320] hover:bg-[#232D29] text-slate-300 shrink-0"
                    aria-label="Copier le secret"
                  >
                    {copied ? <Check className="w-4 h-4 text-[#00E676]" /> : <Copy className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <a
                href={otpauthUri}
                className="block text-center text-[11px] text-[#00E676] hover:underline"
              >
                Ouvrir directement dans l'appli d'authentification (mobile)
              </a>

              <div>
                <label className="block text-[10px] uppercase tracking-wide text-slate-500 mb-1.5" htmlFor="totp-confirm-code">
                  Code affiché par l'appli, pour confirmer
                </label>
                <input
                  id="totp-confirm-code"
                  type="text"
                  inputMode="numeric"
                  pattern="\d{6}"
                  maxLength={6}
                  required
                  autoFocus
                  readOnly={pending}
                  value={confirmCode}
                  onChange={(e) => setConfirmCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  placeholder="123456"
                  className={`${inputClass} font-mono tracking-[0.3em] text-center text-lg`}
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setStep("status")}
                  className="px-4 py-2.5 rounded-xl bg-[#1B2320] hover:bg-[#232D29] text-slate-300 font-bold text-xs"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={pending || confirmCode.length !== 6}
                  className="px-5 py-2.5 rounded-xl bg-[#00E676] hover:bg-[#00c865] disabled:opacity-60 text-slate-950 font-extrabold text-xs"
                >
                  {pending ? "Vérification…" : "Activer"}
                </button>
              </div>
            </form>
          )}

          {step === "reveal-codes" && (
            <div className="space-y-4">
              <div className="flex items-start gap-2.5 p-3 rounded-xl bg-amber-500/10 border border-amber-500/20">
                <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                <p className="text-xs text-amber-200">
                  Ces codes ne s'afficheront plus jamais. Note-les dans un endroit sûr — chacun ne fonctionne
                  qu'une seule fois, en secours si tu perds l'accès à ton appli d'authentification.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-2 bg-[#0D1110] border border-[#1B2320] rounded-xl p-4">
                {revealedCodes.map((c) => (
                  <code key={c} className="text-sm font-mono text-white text-center py-1">
                    {c}
                  </code>
                ))}
              </div>

              <label className="flex items-center gap-2.5 text-xs text-slate-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={acknowledged}
                  onChange={(e) => setAcknowledged(e.target.checked)}
                  className="w-4 h-4 rounded accent-[#00E676]"
                />
                J'ai noté mes codes de récupération en lieu sûr.
              </label>

              <button
                type="button"
                disabled={!acknowledged}
                onClick={() => {
                  setRevealedCodes([]);
                  void loadStatus();
                }}
                className="w-full px-5 py-2.5 rounded-xl bg-[#00E676] hover:bg-[#00c865] disabled:opacity-40 text-slate-950 font-extrabold text-xs"
              >
                Continuer
              </button>
            </div>
          )}

          {(step === "disable-confirm" || step === "regenerate-confirm") && (
            <form onSubmit={step === "disable-confirm" ? confirmDisable : confirmRegenerate} className="space-y-4">
              <p className="text-xs text-slate-400">
                {step === "disable-confirm"
                  ? "Confirme ton mot de passe pour désactiver la 2FA de ce compte."
                  : "Confirme ton mot de passe pour régénérer tes codes de récupération — les anciens deviendront inutilisables."}
              </p>
              <div>
                <label className="block text-[10px] uppercase tracking-wide text-slate-500 mb-1.5" htmlFor="totp-password-confirm">
                  Mot de passe actuel
                </label>
                <input
                  id="totp-password-confirm"
                  type="password"
                  autoComplete="current-password"
                  required
                  autoFocus
                  readOnly={pending}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className={inputClass}
                />
              </div>
              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setPassword("");
                    setStep("status");
                  }}
                  className="px-4 py-2.5 rounded-xl bg-[#1B2320] hover:bg-[#232D29] text-slate-300 font-bold text-xs"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={pending}
                  className={`px-5 py-2.5 rounded-xl font-extrabold text-xs disabled:opacity-60 flex items-center gap-1.5 ${
                    step === "disable-confirm"
                      ? "bg-rose-500 hover:bg-rose-400 text-white"
                      : "bg-[#00E676] hover:bg-[#00c865] text-slate-950"
                  }`}
                >
                  {step === "disable-confirm" ? (
                    <ShieldOff className="w-3.5 h-3.5" />
                  ) : (
                    <KeyRound className="w-3.5 h-3.5" />
                  )}
                  {pending ? "Confirmation…" : step === "disable-confirm" ? "Désactiver" : "Régénérer"}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
