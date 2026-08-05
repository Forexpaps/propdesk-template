import React, { useEffect, useState } from "react";
import { UserPlus, Trash2, Clock, X, Copy, Check } from "lucide-react";
import { api, type StaffAccountSummary } from "../lib/api";

interface StaffAccountsModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** Compte actuellement connecté : on ne peut pas se supprimer soi-même. */
  currentUserId: string;
}

/**
 * Gestion des comptes staff.
 *
 * Tous les comptes ont les mêmes droits — il n'y a donc rien à régler par
 * compte au-delà de son existence : inviter, ou révoquer. Le mot de passe
 * temporaire d'une invitation n'est affiché qu'une seule fois, au moment de
 * la création ; il n'est jamais récupérable après coup, y compris par cette
 * modale.
 */
export const StaffAccountsModal: React.FC<StaffAccountsModalProps> = ({
  isOpen,
  onClose,
  currentUserId,
}) => {
  const [accounts, setAccounts] = useState<StaffAccountSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [inviting, setInviting] = useState(false);

  // Résultat de la dernière invitation : {email, temporaryPassword}. Effacé
  // dès qu'on referme la modale ou qu'on en lance une nouvelle — c'est
  // délibérément volatil, pour ne pas laisser un mot de passe affiché
  // indéfiniment à l'écran.
  const [lastInvite, setLastInvite] = useState<{ email: string; temporaryPassword: string } | null>(
    null
  );
  const [copied, setCopied] = useState(false);

  const load = () => {
    setLoading(true);
    setError(null);
    api
      .listStaff()
      .then((r) => setAccounts(r.accounts))
      .catch((err) => setError((err as Error).message || "Impossible de charger l'équipe."))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (isOpen) load();
    else {
      // Repart propre à la prochaine ouverture : pas de mot de passe résiduel
      // affiché après une fermeture/réouverture.
      setLastInvite(null);
      setName("");
      setEmail("");
      setError(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (inviting) return;

    setInviting(true);
    setError(null);
    setLastInvite(null);
    try {
      const result = await api.inviteStaff(name.trim(), email.trim());
      setLastInvite({ email: result.email, temporaryPassword: result.temporaryPassword });
      setName("");
      setEmail("");
      load();
    } catch (err) {
      setError((err as Error).message || "L'invitation a échoué.");
    } finally {
      setInviting(false);
    }
  };

  const handleRemove = async (account: StaffAccountSummary) => {
    if (
      !confirm(
        `Révoquer le compte de ${account.name} ? Il ne pourra plus se connecter.`
      )
    ) {
      return;
    }
    setError(null);
    try {
      await api.removeStaff(account.id);
      load();
    } catch (err) {
      setError((err as Error).message || "La suppression a échoué.");
    }
  };

  const handleCopy = async () => {
    if (!lastInvite) return;
    try {
      await navigator.clipboard.writeText(lastInvite.temporaryPassword);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Presse-papiers indisponible (contexte non sécurisé, permission
      // refusée) : le mot de passe reste affiché, la personne le recopiera
      // à la main.
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-[#0D1110]/80 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto font-sans">
      <div className="bg-[#111615] border border-[#1B2320] rounded-2xl max-w-lg w-full p-6 space-y-6 shadow-2xl relative my-8 text-slate-100">
        <div className="flex items-center justify-between border-b border-[#1B2320] pb-4">
          <div>
            <h3 className="text-base font-bold text-white">Membres du staff</h3>
            <p className="text-xs text-slate-400">
              Tous les comptes ont les mêmes droits sur ce bureau.
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-500 hover:text-white hover:bg-[#1B2320] transition-colors"
            aria-label="Fermer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Invitation */}
        <form onSubmit={handleInvite} className="space-y-3 bg-[#0D1110] p-4 rounded-xl border border-[#1B2320]">
          <label className="block text-xs font-medium text-slate-300">Inviter un coach</label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <input
              type="text"
              placeholder="Nom"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="bg-[#111615] border border-[#1B2320] rounded-xl px-3 py-2 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-[#00E676]"
            />
            <input
              type="email"
              placeholder="Adresse e-mail"
              required
              autoCapitalize="none"
              spellCheck={false}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="bg-[#111615] border border-[#1B2320] rounded-xl px-3 py-2 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-[#00E676]"
            />
          </div>
          <button
            type="submit"
            disabled={inviting}
            className="w-full flex items-center justify-center gap-2 rounded-xl bg-[#00E676] hover:bg-[#00c865] disabled:opacity-60 text-slate-950 font-bold text-sm py-2 transition-colors"
          >
            <UserPlus className="w-4 h-4" />
            {inviting ? "Invitation…" : "Envoyer l'invitation"}
          </button>
        </form>

        {/* Mot de passe temporaire — affiché une seule fois */}
        {lastInvite && (
          <div className="space-y-2 rounded-xl border border-[#00E676]/25 bg-[#00E676]/10 p-4">
            <p className="text-xs text-[#69F0AE] leading-relaxed">
              Compte créé pour <span className="font-semibold">{lastInvite.email}</span>. Transmets-lui
              ce mot de passe temporaire — il ne sera plus jamais affiché après avoir fermé cette
              fenêtre, et il devra le remplacer à sa première connexion.
            </p>
            <div className="flex items-center gap-2">
              <code className="flex-1 bg-[#0D1110] border border-[#1B2320] rounded-lg px-3 py-2 text-sm text-white font-mono truncate">
                {lastInvite.temporaryPassword}
              </code>
              <button
                type="button"
                onClick={handleCopy}
                className="p-2 rounded-lg bg-[#1B2320] hover:bg-[#232D29] text-slate-300 hover:text-white transition-colors shrink-0"
                aria-label="Copier le mot de passe temporaire"
              >
                {copied ? <Check className="w-4 h-4 text-[#00E676]" /> : <Copy className="w-4 h-4" />}
              </button>
            </div>
          </div>
        )}

        {error && (
          <div role="alert" className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-2.5 text-xs text-rose-200">
            {error}
          </div>
        )}

        {/* Liste des comptes */}
        <div className="space-y-2">
          {loading ? (
            <p className="text-xs text-slate-500 text-center py-4">Chargement…</p>
          ) : (
            accounts.map((account) => (
              <div
                key={account.id}
                className="flex items-center justify-between gap-3 bg-[#0D1110] border border-[#1B2320] rounded-xl px-3.5 py-2.5"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-white truncate">{account.name}</span>
                    {account.mustChangePassword && (
                      <span
                        title="N'a pas encore remplacé son mot de passe temporaire"
                        className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-300 text-[9px] font-semibold border border-amber-500/30 shrink-0"
                      >
                        <Clock className="w-2.5 h-2.5" />
                        En attente
                      </span>
                    )}
                    {account.id === currentUserId && (
                      <span className="text-[9px] text-slate-500 shrink-0">(toi)</span>
                    )}
                  </div>
                  <p className="text-[10px] text-slate-400 truncate">{account.email}</p>
                </div>

                {account.id !== currentUserId && (
                  <button
                    onClick={() => handleRemove(account)}
                    className="p-2 rounded-lg text-slate-500 hover:text-rose-300 hover:bg-rose-500/10 transition-colors shrink-0"
                    aria-label={`Révoquer le compte de ${account.name}`}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
