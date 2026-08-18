import React, { useEffect, useState } from "react";
import { ShieldAlert, X, KeyRound, LogIn, LogOut, Lock, UserX, UserPlus, UserMinus } from "lucide-react";
import { api, type SecurityEvent, type SecuritySeverity } from "../lib/api";

interface SecurityLogModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const PAGE_SIZE = 50;

const EVENT_TYPE_LABELS: Record<string, string> = {
  login_success: "Connexion réussie",
  login_failed: "Échec de connexion",
  login_blocked: "Connexion bloquée",
  account_locked: "Compte verrouillé",
  logout: "Déconnexion",
  password_changed: "Mot de passe changé",
  password_change_failed: "Échec changement mdp",
  access_denied: "Accès refusé",
  staff_invited: "Coach invité",
  staff_revoked: "Coach révoqué",
  student_access_created: "Accès élève créé",
  student_access_revoked: "Accès élève révoqué",
};

const SEVERITY_LABELS: Record<SecuritySeverity, string> = {
  info: "Info",
  warning: "Avertissement",
  critical: "Critique",
};

const SEVERITY_BADGE_CLASSES: Record<SecuritySeverity, string> = {
  info: "bg-[#00E676]/15 text-[#00E676] border-[#00E676]/30",
  warning: "bg-amber-500/15 text-amber-300 border-amber-500/30",
  critical: "bg-rose-500/15 text-rose-300 border-rose-500/30",
};

const EVENT_TYPE_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  login_success: LogIn,
  login_failed: LogIn,
  login_blocked: Lock,
  account_locked: Lock,
  logout: LogOut,
  password_changed: KeyRound,
  password_change_failed: KeyRound,
  access_denied: UserX,
  staff_invited: UserPlus,
  staff_revoked: UserMinus,
  student_access_created: UserPlus,
  student_access_revoked: UserMinus,
};

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString("fr-FR", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * Journal de sécurité, réservé au compte fondateur — voir `requireOwner`
 * côté serveur (`server/auth/middleware.ts`). Couvre les deux mondes
 * d'identité (staff ET élève).
 *
 * Même gabarit que `StaffAccountsModal.tsx` : fetch au montage/à l'ouverture,
 * lecture seule, pas de `useSyncedState` (ce n'est pas une collection
 * synchronisée, c'est un flux d'audit écrit uniquement par le serveur).
 */
export const SecurityLogModal: React.FC<SecurityLogModalProps> = ({ isOpen, onClose }) => {
  const [events, setEvents] = useState<SecurityEvent[]>([]);
  const [total, setTotal] = useState(0);
  const [stats, setStats] = useState({ loginSuccess: 0, loginFailed: 0, lockouts: 0, accessDenied: 0 });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [severityFilter, setSeverityFilter] = useState<SecuritySeverity | "">("");
  const [eventTypeFilter, setEventTypeFilter] = useState<string>("");
  const [limit, setLimit] = useState(PAGE_SIZE);

  const load = () => {
    setLoading(true);
    setError(null);
    api
      .fetchSecurityLog({
        severity: severityFilter || undefined,
        eventType: eventTypeFilter || undefined,
        limit,
        offset: 0,
      })
      .then((r) => {
        setEvents(r.events);
        setTotal(r.total);
        setStats(r.stats);
      })
      .catch((err) => setError((err as Error).message || "Impossible de charger le journal."))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (isOpen) load();
    else {
      // Repart propre à la prochaine ouverture.
      setSeverityFilter("");
      setEventTypeFilter("");
      setLimit(PAGE_SIZE);
      setError(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, severityFilter, eventTypeFilter, limit]);

  if (!isOpen) return null;

  const statCards: { label: string; value: number }[] = [
    { label: "Connexions réussies", value: stats.loginSuccess },
    { label: "Échecs de connexion", value: stats.loginFailed },
    { label: "Verrouillages", value: stats.lockouts },
    { label: "Accès refusés", value: stats.accessDenied },
  ];

  return (
    <div className="fixed inset-0 z-50 bg-[#0D1110]/80 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto font-sans">
      <div className="bg-[#111615] border border-[#1B2320] rounded-2xl max-w-3xl w-full shadow-2xl relative my-8 text-slate-100 max-h-[calc(100vh-4rem)] flex flex-col overflow-hidden">
        {/* En-tête collée en haut : voir UserProfileModal.tsx pour le détail du
            correctif. */}
        <div className="shrink-0 sticky top-0 z-10 bg-[#111615] px-6 pt-6 pb-4 flex items-center justify-between border-b border-[#1B2320]">
          <div className="flex items-center gap-2.5">
            <ShieldAlert className="w-5 h-5 text-[#00E676]" />
            <div>
              <h3 className="text-base font-bold text-white">Journal de sécurité</h3>
              <p className="text-xs text-slate-400">
                Qui s'est connecté, quand, depuis où — et ce qui a été refusé.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-500 hover:text-white hover:bg-[#1B2320] transition-colors"
            aria-label="Fermer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
        {/* Cartes de stats — dernières 24h */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {statCards.map((card) => (
            <div key={card.label} className="bg-[#0D1110] border border-[#1B2320] rounded-xl p-3 space-y-1">
              <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide">{card.label}</div>
              <div className="text-xl font-black text-white font-mono">{card.value}</div>
              <div className="text-[10px] text-slate-500">dernières 24 h</div>
            </div>
          ))}
        </div>

        {/* Filtres */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
          <select
            value={severityFilter}
            onChange={(e) => {
              setSeverityFilter(e.target.value as SecuritySeverity | "");
              setLimit(PAGE_SIZE);
            }}
            className="bg-[#0D1110] border border-[#1B2320] rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-[#00E676]"
          >
            <option value="">Toutes gravités</option>
            {(Object.keys(SEVERITY_LABELS) as SecuritySeverity[]).map((s) => (
              <option key={s} value={s}>
                {SEVERITY_LABELS[s]}
              </option>
            ))}
          </select>

          <select
            value={eventTypeFilter}
            onChange={(e) => {
              setEventTypeFilter(e.target.value);
              setLimit(PAGE_SIZE);
            }}
            className="bg-[#0D1110] border border-[#1B2320] rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-[#00E676]"
          >
            <option value="">Tous les événements</option>
            {Object.entries(EVENT_TYPE_LABELS).map(([type, label]) => (
              <option key={type} value={type}>
                {label}
              </option>
            ))}
          </select>

          <span className="text-[11px] text-slate-500 sm:ml-auto self-center">
            <span className="font-bold text-slate-300">{events.length}</span> affichés ·{" "}
            <span className="font-bold text-slate-300">{total}</span> au total · conservés 90 jours
          </span>
        </div>

        {error && (
          <div role="alert" className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-2.5 text-xs text-rose-200">
            {error}
          </div>
        )}

        {/* Tableau */}
        <div className="border border-[#1B2320] rounded-xl overflow-hidden">
          <div className="overflow-x-auto max-h-[420px] overflow-y-auto">
            <table className="w-full text-xs">
              <thead className="bg-[#0D1110] sticky top-0">
                <tr className="text-left text-[10px] text-slate-500 uppercase tracking-wide">
                  <th className="px-3 py-2 font-semibold">Date</th>
                  <th className="px-3 py-2 font-semibold">Événement</th>
                  <th className="px-3 py-2 font-semibold">Compte</th>
                  <th className="px-3 py-2 font-semibold">Adresse IP</th>
                  <th className="px-3 py-2 font-semibold">Détail</th>
                </tr>
              </thead>
              <tbody>
                {loading && events.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-3 py-6 text-center text-slate-500">
                      Chargement…
                    </td>
                  </tr>
                ) : events.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-3 py-6 text-center text-slate-500">
                      Aucun événement pour ces filtres.
                    </td>
                  </tr>
                ) : (
                  events.map((event) => {
                    const Icon = EVENT_TYPE_ICONS[event.eventType] ?? ShieldAlert;
                    return (
                      <tr key={event.id} className="border-t border-[#1B2320]">
                        <td className="px-3 py-2 text-slate-400 font-mono whitespace-nowrap">
                          {formatDate(event.createdAt)}
                        </td>
                        <td className="px-3 py-2">
                          <span
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[10px] font-semibold whitespace-nowrap ${SEVERITY_BADGE_CLASSES[event.severity]}`}
                          >
                            <Icon className="w-3 h-3" />
                            {EVENT_TYPE_LABELS[event.eventType] ?? event.eventType}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-slate-300 truncate max-w-[160px]">
                          {event.accountEmail ?? "—"}
                        </td>
                        <td className="px-3 py-2 text-slate-400 font-mono whitespace-nowrap">
                          {event.ip ?? "—"}
                        </td>
                        <td className="px-3 py-2 text-slate-400">{event.detail || "—"}</td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {events.length < total && (
          <button
            onClick={() => setLimit((l) => l + PAGE_SIZE)}
            disabled={loading}
            className="w-full py-2 rounded-xl bg-[#1B2320] hover:bg-[#232D29] disabled:opacity-60 text-slate-300 text-xs font-bold transition-colors"
          >
            {loading ? "Chargement…" : "Charger plus"}
          </button>
        )}

        <p className="text-[10px] text-slate-500 leading-relaxed border-t border-[#1B2320] pt-3">
          Les mots de passe et jetons de session ne sont jamais enregistrés. Les adresses IP étant des
          données personnelles, les entrées sont supprimées automatiquement au bout de 90 jours.
        </p>
        </div>
      </div>
    </div>
  );
};
