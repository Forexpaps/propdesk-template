import React, { useEffect, useState } from "react";
import { UserPlus, Trash2, Clock, X, Copy, Check, Crown } from "lucide-react";
import { api, STAFF_PERMISSION_KEYS, type StaffAccountSummary, type StaffPermissionKey } from "../lib/api";
import { confirmDialog } from "../lib/confirmDialog";

/** Libellé court affiché sur chaque bouton d'autorisation. */
const PERMISSION_LABELS: Record<StaffPermissionKey, string> = {
  students: "Suivi des élèves",
  messaging: "Messagerie",
  announcements: "Annonces",
  team: "Gestion d'équipe",
  data: "Restauration de données",
};

interface StaffAccountsModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** Compte actuellement connecté : on ne peut pas se supprimer soi-même. */
  currentUserId: string;
}

/**
 * Gestion des comptes staff.
 *
 * En plus d'inviter/révoquer, le fondateur règle ici les autorisations de
 * chaque coach individuellement (Suivi des élèves, Messagerie, Annonces,
 * Gestion d'équipe, Restauration de données — voir `PERMISSION_LABELS` et
 * `server/auth/permissions.ts`, source de vérité du catalogue). Un compte
 * jamais restreint (`permissions: null`) a tout par défaut, pour rester
 * compatible avec les comptes déjà invités avant cette fonctionnalité.
 *
 * Le compte fondateur se distingue toujours sur deux points : lui seul règle
 * les modules visibles dans la sidebar, et il a TOUJOURS toutes les
 * autorisations, non révocable ni restreignable (même par lui-même). Le mot
 * de passe temporaire d'une invitation n'est affiché qu'une seule fois, au
 * moment de la création ; il n'est jamais récupérable après coup, y compris
 * par cette modale.
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

  /** Le viewer courant est-il le fondateur ? Déterminé depuis la liste elle-même, pas une prop dédiée. */
  const isCurrentUserOwner = accounts.some((a) => a.id === currentUserId && a.isOwner);

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
      !(await confirmDialog(
        `Révoquer le compte de ${account.name} ? Il ne pourra plus se connecter.`,
        { title: "Révoquer un compte staff", confirmLabel: "Révoquer", danger: true }
      ))
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

  /**
   * `account.permissions === null` veut dire "toutes accordées" (jamais
   * restreint) — pour calculer le prochain état à envoyer, on part donc du
   * catalogue complet dans ce cas, jamais d'un tableau vide.
   */
  const togglePermission = async (account: StaffAccountSummary, key: StaffPermissionKey) => {
    const current = account.permissions ?? [...STAFF_PERMISSION_KEYS];
    const next = current.includes(key) ? current.filter((k) => k !== key) : [...current, key];

    setAccounts((prev) => prev.map((a) => (a.id === account.id ? { ...a, permissions: next } : a)));
    setError(null);
    try {
      await api.updateStaffPermissions(account.id, next);
    } catch (err) {
      // Écriture refusée (réseau, session expirée) : on revient à l'état
      // d'avant plutôt que de laisser le bouton mentir sur ce qui est
      // réellement enregistré côté serveur.
      setAccounts((prev) => prev.map((a) => (a.id === account.id ? { ...a, permissions: current } : a)));
      setError((err as Error).message || "La mise à jour des autorisations a échoué.");
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
      <div className="bg-[#111615] border border-[#1B2320] rounded-2xl max-w-lg w-full shadow-2xl relative my-8 text-slate-100 max-h-[calc(100vh-4rem)] flex flex-col overflow-hidden">
        {/* En-tête collée en haut : voir UserProfileModal.tsx pour le détail du
            correctif (une longue liste de coachs poussait sinon le haut de la
            modale — titre et bouton fermer compris — hors de portée). */}
        <div className="shrink-0 sticky top-0 z-10 bg-[#111615] px-6 pt-6 pb-4 flex items-center justify-between border-b border-[#1B2320]">
          <div>
            <h3 className="text-base font-bold text-white">Membres du staff</h3>
            <p className="text-xs text-slate-400">
              Un bouton par autorisation, sous chaque coach. Seul le compte
              principal a toujours tout et règle les modules visibles.
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

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">
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
                className="bg-[#0D1110] border border-[#1B2320] rounded-xl px-3.5 py-2.5 space-y-2.5"
              >
                <div className="flex items-center justify-between gap-3">
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
                      {account.isOwner && (
                        <span
                          title="Compte principal : seul à régler les modules visibles dans la sidebar, et non supprimable"
                          className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-[#00E676]/15 text-[#00E676] text-[9px] font-semibold border border-[#00E676]/30 shrink-0"
                        >
                          <Crown className="w-2.5 h-2.5" />
                          Compte principal
                        </span>
                      )}
                      {account.id === currentUserId && (
                        <span className="text-[9px] text-slate-500 shrink-0">(toi)</span>
                      )}
                    </div>
                    <p className="text-[10px] text-slate-400 truncate">{account.email}</p>
                  </div>

                  {/* Le compte principal n'est jamais révocable : c'est lui qui
                      porte le réglage des modules visibles, et le serveur refuse
                      sa suppression (409). Ne pas rendre le bouton évite de
                      proposer une action vouée à échouer.
                      Réservé au fondateur (`requireOwner` côté serveur, suite à
                      un audit de sécurité) : un coach invité voyait auparavant
                      ce bouton pour tout AUTRE coach invité, alors que seul le
                      fondateur peut réellement l'utiliser — même logique que
                      ci-dessus, ne pas proposer une action vouée à échouer. */}
                  {account.id !== currentUserId && !account.isOwner && isCurrentUserOwner && (
                    <button
                      onClick={() => handleRemove(account)}
                      className="p-2 rounded-lg text-slate-500 hover:text-rose-300 hover:bg-rose-500/10 transition-colors shrink-0"
                      aria-label={`Révoquer le compte de ${account.name}`}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                {/* Autorisations : un bouton par droit, activable/désactivable
                    d'un clic — réservé au fondateur (`requireOwner` côté
                    serveur, voir PUT /staff/:id/permissions), jamais proposé
                    sur le compte principal lui-même (toujours tout, non
                    restreignable — voir hasStaffPermission). */}
                {!account.isOwner && isCurrentUserOwner && (
                  <div className="flex flex-wrap gap-1.5 pt-2 border-t border-[#1B2320]">
                    {STAFF_PERMISSION_KEYS.map((key) => {
                      const granted = account.permissions === null || account.permissions.includes(key);
                      return (
                        <button
                          key={key}
                          type="button"
                          onClick={() => togglePermission(account, key)}
                          title={
                            granted
                              ? `Retirer l'autorisation « ${PERMISSION_LABELS[key]} »`
                              : `Accorder l'autorisation « ${PERMISSION_LABELS[key]} »`
                          }
                          className={`px-2 py-1 rounded-lg text-[10px] font-bold border transition-colors ${
                            granted
                              ? "bg-[#00E676]/15 text-[#00E676] border-[#00E676]/30 hover:bg-[#00E676]/25"
                              : "bg-[#1B2320] text-slate-500 border-[#1B2320] hover:text-slate-300"
                          }`}
                        >
                          {PERMISSION_LABELS[key]}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
        </div>
      </div>
    </div>
  );
};
