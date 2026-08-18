import React, { useState } from "react";
import {
  Search,
  Plus,
  Edit,
  Eye,
  ShieldCheck,
  CheckCircle2,
  Trash2,
  Wallet,
  Activity,
  Lock,
  Tag,
  Timer,
  MessageSquare,
  KeyRound,
  ShieldOff
} from "lucide-react";
import { EnrolledStudent, StudentStatusTag, TradingStyle, TradingAccount, Trade } from "../types";
import { formatCurrency } from "../lib/format";
import { api } from "../lib/api";
import { AdminStudentView } from "./AdminStudentView";

/**
 * En-tête de section — barre verticale colorée + titre, motif repris tel
 * quel de PerformanceDashboard.tsx pour un rendu cohérent sur tout l'écosystème.
 */
const SectionHeader: React.FC<{ children?: React.ReactNode; color?: string }> = ({
  children,
  color = "bg-[#00E676]",
}) => (
  <span className="inline-flex items-center gap-2">
    <span className={`w-1 h-4 rounded-full ${color} shrink-0`} />
    {children}
  </span>
);

interface StudentTrackingProps {
  students: EnrolledStudent[];
  onUpdateStudent: (updatedStudent: EnrolledStudent) => void;
  onAddStudent: (newStudent: EnrolledStudent) => void;
  onDeleteStudent: (studentId: string) => void;
}

const STATUS_TAG_STYLES: Record<StudentStatusTag, string> = {
  "En Évaluation FTMO": "bg-purple-500/10 text-purple-400 border-purple-500/30",
  "Prop Firm Financé": "bg-[#00E676]/20 text-[#00E676] border-[#00E676]/40 font-bold",
  "Besoin Coaching": "bg-blue-500/10 text-blue-400 border-blue-500/30",
  "Alerte Tilt": "bg-rose-500/20 text-rose-300 border-rose-500/40 animate-pulse font-bold",
};

export const StudentTracking: React.FC<StudentTrackingProps> = ({
  students,
  onUpdateStudent,
  onAddStudent,
  onDeleteStudent,
}) => {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedTagFilter, setSelectedTagFilter] = useState<string>("ALL");
  const [selectedStudent, setSelectedStudent] = useState<EnrolledStudent | null>(null);
  const [isEditingFile, setIsEditingFile] = useState(false);
  const [isReadOnlyPreview, setIsReadOnlyPreview] = useState(false);
  const [isFullViewOpen, setIsFullViewOpen] = useState(false);
  const [isCreatingStudent, setIsCreatingStudent] = useState(false);

  // Edit form state
  const [editForm, setEditForm] = useState<Partial<EnrolledStudent>>({});

  // Accès élève : invitation en cours, résultat à afficher une seule fois,
  // et vrais trades chargés pour la fiche en mode lecture (si un compte est actif).
  const [invitingId, setInvitingId] = useState<string | null>(null);
  const [inviteResult, setInviteResult] = useState<{ email: string; temporaryPassword: string } | null>(null);
  const [realTrades, setRealTrades] = useState<Trade[] | null>(null);
  const [realAccounts, setRealAccounts] = useState<TradingAccount[] | null>(null);
  const [loadingRealTrades, setLoadingRealTrades] = useState(false);

  const handleInviteStudent = async (student: EnrolledStudent) => {
    setInvitingId(student.id);
    try {
      const result = await api.inviteStudent(student.id);
      onUpdateStudent({ ...student, studentAccountId: result.studentAccountId });
      setInviteResult({ email: result.email, temporaryPassword: result.temporaryPassword });
    } catch (err) {
      alert((err as Error).message || "L'invitation a échoué.");
    } finally {
      setInvitingId(null);
    }
  };

  const handleRevokeAccess = async (student: EnrolledStudent) => {
    if (!confirm(`Révoquer l'accès élève de ${student.name} ? Ses trades restent conservés.`)) return;
    try {
      await api.revokeStudentAccess(student.id);
      const { studentAccountId, ...rest } = student;
      onUpdateStudent(rest);
    } catch (err) {
      alert((err as Error).message || "La révocation a échoué.");
    }
  };

  const filteredStudents = students.filter((st) => {
    const matchesSearch =
      st.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      st.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      st.assignedCoach.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesTag = selectedTagFilter === "ALL" || st.statusTag === selectedTagFilter;
    return matchesSearch && matchesTag;
  });

  const handleOpenEdit = (student: EnrolledStudent) => {
    setSelectedStudent(student);
    // Une fiche antérieure au champ n'a pas de style : on aligne l'état du
    // formulaire sur ce que le menu affiche, sinon enregistrer sans y toucher
    // laisserait la valeur vide.
    setEditForm({ ...student, tradingStyle: student.tradingStyle ?? "Intraday" });
    setIsEditingFile(true);
  };

  const handleOpenReadOnly = (student: EnrolledStudent) => {
    setSelectedStudent(student);
    setIsReadOnlyPreview(true);
    setRealTrades(null);
    setRealAccounts(null);

    // Un compte actif rend la saisie manuelle recentTrades/accounts
    // obsolète : on charge les vrais trades et portefeuilles de l'élève à
    // la place, en lecture seule.
    if (student.studentAccountId) {
      setLoadingRealTrades(true);
      api
        .fetchStudentTrades(student.id)
        .then((res) => {
          setRealTrades(res.trades);
          setRealAccounts(res.accounts);
        })
        .catch(() => {
          setRealTrades([]);
          setRealAccounts([]);
        })
        .finally(() => setLoadingRealTrades(false));
    }
  };

  const handleSaveStudentFile = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStudent || !editForm.name) return;

    const updated: EnrolledStudent = {
      ...selectedStudent,
      ...(editForm as EnrolledStudent),
    };

    onUpdateStudent(updated);
    setSelectedStudent(updated);
    setIsEditingFile(false);
  };

  const handleCreateNewStudent = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editForm.name || !editForm.email) return;

    const newSt: EnrolledStudent = {
      id: `stud-${Date.now()}`,
      name: editForm.name || "Nouvel Élève",
      email: editForm.email || "eleve@horizon.fr",
      avatar: editForm.avatar || "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=250",
      phone: editForm.phone || "+33 6 00 00 00 00",
      joinedDate: new Date().toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" }),
      assignedCoach: editForm.assignedCoach || "Thomas Laurent",
      level: editForm.level || "Élève Débutant",
      statusTag: (editForm.statusTag as StudentStatusTag) || "En Évaluation FTMO",
      tradingStyle: (editForm.tradingStyle as TradingStyle) || "Intraday",
      courseCompletionPercentage: Number(editForm.courseCompletionPercentage) || 0,
      startingCapital: Number(editForm.startingCapital) || 10000,
      currentCapital: Number(editForm.currentCapital) || 10000,
      totalTrades: Number(editForm.totalTrades) || 0,
      winRate: Number(editForm.winRate) || 50,
      riskStatus: editForm.riskStatus || "🟢 Risque Maîtrisé",
      privateCoachNotes: editForm.privateCoachNotes || "Première prise de contact.",
      accounts: [
        {
          id: `acc-new-${Date.now()}`,
          name: "Compte Initial",
          firmOrBroker: "FTMO",
          type: "Prop Firm Evaluation",
          initialBalance: 10000,
          currentBalance: 10000,
          equity: 10000,
          maxTotalDrawdownPercent: 10,
          maxDailyDrawdownPercent: 5,
          profitTargetPercent: 10,
          startDate: new Date().toISOString().split("T")[0],
          status: "ACTIVE",
          tradingDays: 1,
          minTradingDaysRequired: 5,
          tradesCount: 0,
        },
      ],
      recentTrades: [],
    };

    onAddStudent(newSt);
    setIsCreatingStudent(false);
    setEditForm({});
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-[#111615] border border-[#1B2320] rounded-xl p-6 relative overflow-hidden">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-1 rounded-full bg-[#00E676]/20 text-[#00E676] border border-[#00E676]/30 text-xs font-bold font-mono flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5" /> Espace Admin & Coach
              </span>
              <span className="text-xs text-slate-400">• Suivi & Contrôle des Élèves</span>
            </div>
            <h2 className="text-2xl font-black text-white tracking-tight">
              Gestionnaire de Fiches & Portefeuilles Élèves
            </h2>
            <p className="text-xs text-slate-400 max-w-2xl">
              Consultez le solde réel, l'historique de trading et les métriques de risque de tous les élèves inscrits à l'Académie.
              Modifiez intégralement les fiches élèves ou basculez en mode lecture seule.
            </p>
          </div>

          <button
            onClick={() => {
              setEditForm({
                statusTag: "En Évaluation FTMO",
                assignedCoach: "Thomas Laurent",
                level: "Élève Débutant",
                riskStatus: "🟢 Risque Maîtrisé",
                startingCapital: 10000,
                currentCapital: 10000,
              });
              setIsCreatingStudent(true);
            }}
            className="px-4 py-2.5 bg-[#00E676] hover:bg-[#00c865] text-slate-950 rounded-xl font-bold text-xs flex items-center gap-2 shadow-lg shadow-[#00E676]/20 self-start md:self-auto shrink-0"
          >
            <Plus className="w-4 h-4" /> Inscrire un Nouvel Élève
          </button>
        </div>
      </div>

      {/* Controls Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-[#111615]/80 border border-[#1B2320] p-4 rounded-xl">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
          <input
            type="text"
            placeholder="Rechercher un élève, un email, un coach..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-[#0D1110] border border-[#1B2320] rounded-xl pl-9 pr-4 py-2 text-xs text-white focus:outline-none focus:border-[#00E676]"
          />
        </div>

        <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0">
          <span className="text-xs text-slate-400 shrink-0">Statut:</span>
          {["ALL", "En Évaluation FTMO", "Prop Firm Financé", "Besoin Coaching", "Alerte Tilt"].map((tag) => (
            <button
              key={tag}
              onClick={() => setSelectedTagFilter(tag)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium border whitespace-nowrap transition-all ${
                selectedTagFilter === tag
                  ? "bg-[#00E676]/20 text-[#00E676] border-[#00E676]/40 font-bold"
                  : "bg-[#0D1110] text-slate-400 border-[#1B2320] hover:text-white"
              }`}
            >
              {tag === "ALL" ? "Tous les élèves" : tag}
            </button>
          ))}
        </div>
      </div>

      {/* Student Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-4">
        {filteredStudents.map((st) => {
          const pnlTotal = st.currentCapital - st.startingCapital;
          const isProfit = pnlTotal >= 0;

          return (
            <div
              key={st.id}
              className="bg-[#111615] border border-[#1B2320] hover:border-[#232D29] rounded-xl p-5 space-y-4 transition-all relative group"
            >
              <div className="border-b border-[#1B2320]/80 pb-4 space-y-3">
                <div className="flex items-center gap-3">
                  <img
                    src={st.avatar}
                    alt={st.name}
                    className="w-12 h-12 rounded-full object-cover border-2 border-[#232D29] shrink-0"
                  />
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-bold text-white text-base">{st.name}</h3>
                      <span className={`px-2 py-0.5 rounded text-[10px] border ${STATUS_TAG_STYLES[st.statusTag]}`}>
                        {st.statusTag}
                      </span>
                      {st.tradingStyle && (
                        <span className="px-2 py-0.5 rounded text-[10px] border border-[#232D29] bg-[#1B2320] text-slate-300 flex items-center gap-1">
                          <Timer className="w-3 h-3 text-slate-500" />
                          {st.tradingStyle}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-400">{st.email} • {st.level}</p>
                    <p className="text-[11px] text-slate-500">Coach attribué : <span className="text-[#00E676]">{st.assignedCoach}</span></p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-1.5">
                  <button
                    onClick={() => {
                      setSelectedStudent(st);
                      setIsFullViewOpen(true);
                    }}
                    title="Voir la vue complète de l'élève (Journal, Portefeuille, Rentabilité)"
                    className="px-2.5 py-1.5 rounded-lg bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 border border-blue-500/20 text-xs font-semibold flex items-center gap-1"
                  >
                    <Eye className="w-3.5 h-3.5" /> Vue Complète
                  </button>
                  <button
                    onClick={() => handleOpenReadOnly(st)}
                    title="Voir en Mode Lecture (Vue Élève)"
                    className="px-2.5 py-1.5 rounded-lg bg-[#00E676]/10 hover:bg-[#00E676]/20 text-[#00E676] border border-[#00E676]/20 text-xs font-semibold flex items-center gap-1"
                  >
                    <Eye className="w-3.5 h-3.5" /> Lecture
                  </button>
                  <button
                    onClick={() => handleOpenEdit(st)}
                    title="Modifier la Fiche Élève"
                    className="px-2.5 py-1.5 rounded-lg bg-[#00E676]/10 hover:bg-[#00E676]/20 text-[#00E676] border border-[#00E676]/20 text-xs font-semibold flex items-center gap-1"
                  >
                    <Edit className="w-3.5 h-3.5" /> Éditer Fiche
                  </button>
                  {st.studentAccountId ? (
                    <button
                      onClick={() => void handleRevokeAccess(st)}
                      title="Révoquer l'accès élève"
                      className="px-2.5 py-1.5 rounded-lg bg-[#1B2320] hover:bg-rose-500/10 text-slate-400 hover:text-rose-400 border border-[#232D29] text-xs font-semibold flex items-center gap-1"
                    >
                      <ShieldOff className="w-3.5 h-3.5" /> Compte actif
                    </button>
                  ) : (
                    <button
                      onClick={() => void handleInviteStudent(st)}
                      disabled={invitingId === st.id}
                      title="Donner un accès élève à son propre Journal"
                      className="px-2.5 py-1.5 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/20 text-xs font-semibold flex items-center gap-1 disabled:opacity-50"
                    >
                      <KeyRound className="w-3.5 h-3.5" />
                      {invitingId === st.id ? "Création…" : "Donner un accès"}
                    </button>
                  )}
                </div>
              </div>

              {/* Performance & Capital Metrics */}
              <div className="grid grid-cols-3 gap-2 bg-[#0D1110] p-3 rounded-xl border border-[#1B2320] text-xs">
                <div>
                  <span className="text-[9px] uppercase tracking-wider text-slate-500 font-bold block">Capital Enregistré</span>
                  <span className="font-mono font-black text-white text-sm">
                    {formatCurrency(st.currentCapital)}
                  </span>
                  <span className={`text-[10px] block ${isProfit ? "text-[#00E676]" : "text-rose-400"}`}>
                    {isProfit ? "+" : ""}{formatCurrency(pnlTotal)}
                  </span>
                </div>
                <div>
                  <span className="text-[9px] uppercase tracking-wider text-slate-500 font-bold block">Win Rate & Trades</span>
                  <span className="font-mono font-black text-[#00E676] text-sm">{st.winRate}%</span>
                  <span className="text-[10px] text-slate-400 block">{st.totalTrades} positions</span>
                </div>
                <div>
                  <span className="text-[9px] uppercase tracking-wider text-slate-500 font-bold block">Progression Cours</span>
                  <span className="font-mono font-black text-[#00E676] text-sm">{st.courseCompletionPercentage}%</span>
                  <div className="w-full bg-[#1B2320] h-1.5 rounded-full mt-1 overflow-hidden">
                    <div
                      className="bg-[#00E676] h-full rounded-full"
                      style={{ width: `${st.courseCompletionPercentage}%` }}
                    />
                  </div>
                </div>
              </div>

              {/* Accounts & Risk Tag */}
              <div className="flex items-center justify-between text-xs pt-1">
                <div className="flex items-center gap-1.5 text-slate-300">
                  <Wallet className="w-3.5 h-3.5 text-[#00E676]" />
                  <span>{st.accounts.length} Compte(s) Prop Firm / Broker</span>
                </div>
                <span className="px-2 py-0.5 rounded text-[11px] bg-[#0D1110] border border-[#1B2320] font-medium">
                  {st.riskStatus}
                </span>
              </div>

              {/* Private Notes Preview */}
              <div className="bg-[#0D1110]/60 p-2.5 rounded-xl border border-[#1B2320]/80 text-[11px] text-slate-400 italic flex items-start gap-2">
                <MessageSquare className="w-3.5 h-3.5 text-slate-500 shrink-0 mt-0.5" />
                <span className="line-clamp-2">
                  <strong className="not-italic text-slate-300">Note Coach : </strong>
                  {st.privateCoachNotes}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* EDIT MODAL / FICHE ÉLÈVE MODULABLE */}
      {isEditingFile && selectedStudent && (
        <div className="fixed inset-0 z-50 bg-[#0D1110]/85 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-[#111615] border border-[#1B2320] rounded-2xl max-w-3xl w-full shadow-2xl relative my-8 max-h-[calc(100vh-4rem)] flex flex-col overflow-hidden">
            {/* En-tête collée en haut : voir UserProfileModal.tsx pour le
                détail du correctif — une fiche élève avec beaucoup de champs
                poussait sinon le titre et le bouton fermer hors de portée. */}
            <div className="shrink-0 sticky top-0 z-10 bg-[#111615] px-6 pt-6 pb-4 flex items-center justify-between border-b border-[#1B2320]">
              <div className="flex items-center gap-3">
                <img
                  src={selectedStudent.avatar}
                  alt={selectedStudent.name}
                  className="w-10 h-10 rounded-full object-cover border border-[#00E676]/50"
                />
                <div>
                  <h3 className="text-lg font-bold text-white flex items-center gap-2">
                    Fiche Édition : {selectedStudent.name}
                    <span className="text-xs font-normal text-slate-400">({selectedStudent.id})</span>
                  </h3>
                  <p className="text-xs text-[#00E676]">Modification des métriques, capital, notes coach & comptes</p>
                </div>
              </div>
              <button
                onClick={() => setIsEditingFile(false)}
                className="text-slate-400 hover:text-white text-sm p-1 rounded-lg hover:bg-[#1B2320]"
              >
                ✕
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-5">
            <form onSubmit={handleSaveStudentFile} className="space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block font-medium text-slate-300 mb-1">Nom Élève</label>
                  <input
                    type="text"
                    required
                    value={editForm.name || ""}
                    onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                    className="w-full bg-[#0D1110] border border-[#1B2320] rounded-xl px-3 py-2 text-white"
                  />
                </div>

                <div>
                  <label className="block font-medium text-slate-300 mb-1">Email</label>
                  <input
                    type="email"
                    required
                    value={editForm.email || ""}
                    onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                    className="w-full bg-[#0D1110] border border-[#1B2320] rounded-xl px-3 py-2 text-white"
                  />
                </div>

                <div>
                  <label className="block font-medium text-slate-300 mb-1">Téléphone</label>
                  <input
                    type="text"
                    value={editForm.phone || ""}
                    onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                    className="w-full bg-[#0D1110] border border-[#1B2320] rounded-xl px-3 py-2 text-white"
                  />
                </div>

                <div>
                  <label className="block font-medium text-slate-300 mb-1">Coach Attribué</label>
                  <select
                    value={editForm.assignedCoach || "Thomas Laurent"}
                    onChange={(e) => setEditForm({ ...editForm, assignedCoach: e.target.value })}
                    className="w-full bg-[#0D1110] border border-[#1B2320] rounded-xl px-3 py-2 text-white"
                  >
                    <option value="Thomas Laurent">Thomas Laurent (Head Coach)</option>
                    <option value="Sarah Benali">Sarah Benali (Psychologie & Risk)</option>
                    <option value="Marc Dupuis">Marc Dupuis (Indices & Crypto)</option>
                  </select>
                </div>

                <div>
                  <label className="block font-medium text-slate-300 mb-1">Statut Élève (Badge)</label>
                  <select
                    value={editForm.statusTag || "En Évaluation FTMO"}
                    onChange={(e) => setEditForm({ ...editForm, statusTag: e.target.value as StudentStatusTag })}
                    className="w-full bg-[#0D1110] border border-[#1B2320] rounded-xl px-3 py-2 text-white font-bold"
                  >
                    <option value="En Évaluation FTMO">En Évaluation FTMO</option>
                    <option value="Prop Firm Financé">Prop Firm Financé 🏆</option>
                    <option value="Besoin Coaching">Besoin Coaching ⚠️</option>
                    <option value="Alerte Tilt">Alerte Tilt 🔴</option>
                  </select>
                </div>

                <div>
                  <label className="block font-medium text-slate-300 mb-1">Style de Trading</label>
                  <select
                    value={editForm.tradingStyle || "Intraday"}
                    onChange={(e) => setEditForm({ ...editForm, tradingStyle: e.target.value as TradingStyle })}
                    className="w-full bg-[#0D1110] border border-[#1B2320] rounded-xl px-3 py-2 text-white"
                  >
                    <option value="Scalping">Scalping</option>
                    <option value="Intraday">Intraday</option>
                    <option value="Swing Trading">Swing Trading</option>
                  </select>
                </div>

                <div>
                  <label className="block font-medium text-slate-300 mb-1">Évaluation du Risque</label>
                  <select
                    value={editForm.riskStatus || "🟢 Risque Maîtrisé"}
                    onChange={(e) => setEditForm({ ...editForm, riskStatus: e.target.value as any })}
                    className="w-full bg-[#0D1110] border border-[#1B2320] rounded-xl px-3 py-2 text-white"
                  >
                    <option value="🟢 Risque Maîtrisé">🟢 Risque Maîtrisé</option>
                    <option value="⚠️ Attention Risk">⚠️ Attention Risk</option>
                    <option value="🔴 Sur-Risque">🔴 Sur-Risque / Danger</option>
                    <option value="🏆 Challenge Validé">🏆 Challenge Validé</option>
                  </select>
                </div>

                <div>
                  <label className="block font-medium text-slate-300 mb-1">Capital Initial ($)</label>
                  <input
                    type="number"
                    value={editForm.startingCapital || 0}
                    onChange={(e) => setEditForm({ ...editForm, startingCapital: Number(e.target.value) })}
                    className="w-full bg-[#0D1110] border border-[#1B2320] rounded-xl px-3 py-2 text-white font-mono"
                  />
                </div>

                <div>
                  <label className="block font-medium text-slate-300 mb-1">Capital Actuel Réel ($)</label>
                  <input
                    type="number"
                    value={editForm.currentCapital || 0}
                    onChange={(e) => setEditForm({ ...editForm, currentCapital: Number(e.target.value) })}
                    className="w-full bg-[#0D1110] border border-[#1B2320] rounded-xl px-3 py-2 text-[#00E676] font-mono font-bold"
                  />
                </div>

                <div>
                  <label className="block font-medium text-slate-300 mb-1">Win Rate (%)</label>
                  <input
                    type="number"
                    step="0.1"
                    value={editForm.winRate || 0}
                    onChange={(e) => setEditForm({ ...editForm, winRate: Number(e.target.value) })}
                    className="w-full bg-[#0D1110] border border-[#1B2320] rounded-xl px-3 py-2 text-[#00E676] font-mono"
                  />
                </div>

                <div>
                  <label className="block font-medium text-slate-300 mb-1">Progression Académie (%)</label>
                  <input
                    type="number"
                    value={editForm.courseCompletionPercentage || 0}
                    onChange={(e) => setEditForm({ ...editForm, courseCompletionPercentage: Number(e.target.value) })}
                    className="w-full bg-[#0D1110] border border-[#1B2320] rounded-xl px-3 py-2 text-[#00E676] font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block font-medium text-slate-300 mb-1">Notes du Coach (Privées & Confidentiales)</label>
                <textarea
                  rows={3}
                  value={editForm.privateCoachNotes || ""}
                  onChange={(e) => setEditForm({ ...editForm, privateCoachNotes: e.target.value })}
                  placeholder="Inscrivez les observations sur les biais psychologiques, règles de sur-lotage et plans d'actions..."
                  className="w-full bg-[#0D1110] border border-[#1B2320] rounded-xl p-3 text-white"
                />
              </div>

              <div className="flex items-center justify-between pt-4 border-t border-[#1B2320]">
                <button
                  type="button"
                  onClick={() => {
                    if (confirm("Voulez-vous vraiment supprimer cet élève de l'académie ?")) {
                      onDeleteStudent(selectedStudent.id);
                      setIsEditingFile(false);
                    }
                  }}
                  className="px-3.5 py-2 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 font-bold flex items-center gap-1.5"
                >
                  <Trash2 className="w-4 h-4" /> Supprimer l'Élève
                </button>

                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setIsEditingFile(false)}
                    className="px-4 py-2 rounded-xl bg-[#1B2320] text-slate-300 font-bold"
                  >
                    Annuler
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 rounded-xl bg-[#00E676] hover:bg-[#00c865] text-slate-950 font-bold flex items-center gap-1.5"
                  >
                    <CheckCircle2 className="w-4 h-4" /> Sauvegarder la Fiche
                  </button>
                </div>
              </div>
            </form>
            </div>
          </div>
        </div>
      )}

      {/* CREATE STUDENT MODAL */}
      {isCreatingStudent && (
        <div className="fixed inset-0 z-50 bg-[#0D1110]/85 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-[#111615] border border-[#1B2320] rounded-2xl max-w-xl w-full shadow-2xl relative my-8 max-h-[calc(100vh-4rem)] flex flex-col overflow-hidden">
            <div className="shrink-0 sticky top-0 z-10 bg-[#111615] px-6 pt-6 pb-3 flex items-center justify-between border-b border-[#1B2320]">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <Plus className="w-5 h-5 text-[#00E676]" /> Inscrire un Nouvel Élève
              </h3>
              <button onClick={() => setIsCreatingStudent(false)} className="text-slate-400 hover:text-white">✕</button>
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-5">
            <form onSubmit={handleCreateNewStudent} className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-300 font-medium mb-1">Nom Complet</label>
                <input
                  type="text"
                  required
                  value={editForm.name || ""}
                  onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                  placeholder="ex: Jean Dupont"
                  className="w-full bg-[#0D1110] border border-[#1B2320] rounded-xl px-3 py-2 text-white"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1">Email</label>
                <input
                  type="email"
                  required
                  value={editForm.email || ""}
                  onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                  placeholder="jean.dupont@gmail.com"
                  className="w-full bg-[#0D1110] border border-[#1B2320] rounded-xl px-3 py-2 text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-medium mb-1">Capital Départ ($)</label>
                  <input
                    type="number"
                    value={editForm.startingCapital || 10000}
                    onChange={(e) => setEditForm({ ...editForm, startingCapital: Number(e.target.value) })}
                    className="w-full bg-[#0D1110] border border-[#1B2320] rounded-xl px-3 py-2 text-white"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 font-medium mb-1">Coach</label>
                  <select
                    value={editForm.assignedCoach || "Thomas Laurent"}
                    onChange={(e) => setEditForm({ ...editForm, assignedCoach: e.target.value })}
                    className="w-full bg-[#0D1110] border border-[#1B2320] rounded-xl px-3 py-2 text-white"
                  >
                    <option value="Thomas Laurent">Thomas Laurent</option>
                    <option value="Sarah Benali">Sarah Benali</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1">Notes Initiales</label>
                <textarea
                  rows={2}
                  value={editForm.privateCoachNotes || ""}
                  onChange={(e) => setEditForm({ ...editForm, privateCoachNotes: e.target.value })}
                  placeholder="Notes lors de la première évaluation..."
                  className="w-full bg-[#0D1110] border border-[#1B2320] rounded-xl p-2.5 text-white"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#1B2320]">
                <button
                  type="button"
                  onClick={() => setIsCreatingStudent(false)}
                  className="px-4 py-2 rounded-xl bg-[#1B2320] text-slate-300"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-[#00E676] font-bold text-slate-950"
                >
                  Valider l'Inscription
                </button>
              </div>
            </form>
            </div>
          </div>
        </div>
      )}

      {/* READ ONLY PREVIEW MODAL / MODE LECTURE ÉLÈVE */}
      {isReadOnlyPreview && selectedStudent && (
        <div className="fixed inset-0 z-50 bg-[#0D1110]/90 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-[#111615] border border-[#00E676]/40 rounded-2xl max-w-4xl w-full shadow-2xl relative my-8 max-h-[calc(100vh-4rem)] flex flex-col overflow-hidden">
            {/* En-tête collée en haut (bannière + profil élève) : voir
                UserProfileModal.tsx pour le détail du correctif — cette vue,
                la plus longue des quatre modales de ce fichier, est celle qui
                dépassait le plus souvent la hauteur de l'écran. */}
            <div className="shrink-0 sticky top-0 z-10 bg-[#111615] px-6 pt-6 pb-3 space-y-3 border-b border-[#1B2320]">
            {/* Top Banner indicating Read-Only Inspection Mode */}
            <div className="bg-[#00E676]/10 border border-[#00E676]/30 p-3 rounded-xl flex items-center justify-between text-xs">
              <div className="flex items-center gap-2 text-[#00E676] font-medium">
                <Lock className="w-4 h-4 text-[#00E676]" />
                <span>
                  <strong>MODE LECTURE ADMIN :</strong> Vous visualisez le tableau de bord et les comptes réels de <strong>{selectedStudent.name}</strong> en consultation seule.
                </span>
              </div>
              <button
                onClick={() => setIsReadOnlyPreview(false)}
                className="px-3 py-1 rounded-lg bg-[#00E676] text-slate-950 font-bold text-[11px]"
              >
                Fermer l'Inspection
              </button>
            </div>

            {/* Profile Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#1B2320] pb-5">
              <div className="flex items-center gap-4">
                <img
                  src={selectedStudent.avatar}
                  alt={selectedStudent.name}
                  className="w-16 h-16 rounded-full object-cover border-2 border-[#00E676] shadow-md"
                />
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-xl font-black text-white">{selectedStudent.name}</h2>
                    <span className={`px-2 py-0.5 rounded text-xs border ${STATUS_TAG_STYLES[selectedStudent.statusTag]}`}>
                      {selectedStudent.statusTag}
                    </span>
                    {selectedStudent.tradingStyle && (
                      <span className="px-2 py-0.5 rounded text-xs border border-[#232D29] bg-[#1B2320] text-slate-300 flex items-center gap-1">
                        <Timer className="w-3 h-3 text-slate-500" />
                        {selectedStudent.tradingStyle}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-400">{selectedStudent.email} • Inscrit le {selectedStudent.joinedDate}</p>
                  <p className="text-xs text-[#00E676]">Coach Référent : {selectedStudent.assignedCoach}</p>
                </div>
              </div>

              <div className="flex items-center gap-3 bg-[#0D1110] p-3 rounded-xl border border-[#1B2320]">
                <div className="text-right">
                  <span className="text-[10px] text-slate-500 block uppercase font-bold">Capital sous Gestion</span>
                  <span className="text-lg font-mono font-black text-[#00E676]">
                    {formatCurrency(selectedStudent.currentCapital)}
                  </span>
                </div>
              </div>
            </div>
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">
            {/* Accounts Section in Read-Only */}
            <div className="space-y-3">
              <h4 className="text-sm font-bold text-white flex items-center gap-2">
                <SectionHeader />
                <Wallet className="w-4 h-4 text-[#00E676]" /> Portefeuilles & Comptes Attribués (
                {(selectedStudent.studentAccountId ? realAccounts ?? [] : selectedStudent.accounts).length})
                {selectedStudent.studentAccountId && (
                  <span className="text-[10px] font-normal text-[#00E676] normal-case">
                    (vrais portefeuilles créés par l'élève)
                  </span>
                )}
              </h4>
              {selectedStudent.studentAccountId && loadingRealTrades ? (
                <div className="bg-[#0D1110] p-4 rounded-xl text-center text-slate-500 text-xs italic">
                  Chargement des portefeuilles…
                </div>
              ) : (selectedStudent.studentAccountId ? realAccounts ?? [] : selectedStudent.accounts).length === 0 ? (
                <div className="bg-[#0D1110] p-4 rounded-xl text-center text-slate-500 text-xs italic">
                  Aucun portefeuille créé par l'élève pour l'instant.
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {(selectedStudent.studentAccountId ? realAccounts ?? [] : selectedStudent.accounts).map((acc) => (
                    <div key={acc.id} className="bg-[#0D1110] p-4 rounded-xl border border-[#1B2320] space-y-2 text-xs">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-white">{acc.name}</span>
                        <span className="px-2 py-0.5 rounded bg-[#00E676]/10 text-[#00E676] text-[10px] font-mono border border-[#00E676]/20">
                          {acc.status}
                        </span>
                      </div>
                      <div className="text-slate-400 text-[11px]">Courtier/Prop Firm : {acc.firmOrBroker} ({acc.type})</div>
                      <div className="flex items-center justify-between pt-2 border-t border-[#1B2320] font-mono">
                        <span className="text-slate-500">Solde Réel:</span>
                        <span className="font-bold text-[#00E676] text-sm">{formatCurrency(acc.currentBalance)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Recent Trades Journal in Read-Only */}
            <div className="space-y-3">
              <h4 className="text-sm font-bold text-white flex items-center gap-2">
                <SectionHeader />
                <Activity className="w-4 h-4 text-[#00E676]" /> Historique Récent des Trades
                {selectedStudent.studentAccountId && (
                  <span className="text-[10px] font-normal text-[#00E676] normal-case">
                    (vrais trades journalisés par l'élève)
                  </span>
                )}
              </h4>
              {selectedStudent.studentAccountId && loadingRealTrades ? (
                <div className="bg-[#0D1110] p-4 rounded-xl text-center text-slate-500 text-xs italic">
                  Chargement des trades…
                </div>
              ) : (selectedStudent.studentAccountId ? realTrades ?? [] : selectedStudent.recentTrades).length === 0 ? (
                <div className="bg-[#0D1110] p-4 rounded-xl text-center text-slate-500 text-xs italic">
                  Aucune position enregistrée récemment pour cet élève.
                </div>
              ) : (
                <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                  {(selectedStudent.studentAccountId ? realTrades ?? [] : selectedStudent.recentTrades).map((tr) => (
                    <div key={tr.id} className="bg-[#0D1110] p-3 rounded-xl border border-[#1B2320] flex items-center justify-between text-xs">
                      <div className="flex items-center gap-3">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          tr.direction === "LONG" ? "bg-[#00E676]/20 text-[#00E676]" : "bg-rose-500/20 text-rose-300"
                        }`}>
                          {tr.direction}
                        </span>
                        <div>
                          <span className="font-bold text-white">{tr.pair}</span>
                          <span className="text-[10px] text-slate-400 block">{tr.strategy} • Emotion: {tr.emotion}</span>
                        </div>
                      </div>
                      <div className="text-right font-mono">
                        <span className={`font-bold ${tr.pnl >= 0 ? "text-[#00E676]" : "text-rose-400"}`}>
                          {(tr.pnlUnit ?? "USD") === "PERCENT"
                            ? `${tr.pnl >= 0 ? "+" : ""}${tr.pnl}%`
                            : `${tr.pnl >= 0 ? "+" : ""}${formatCurrency(tr.pnl)}`}
                        </span>
                        <span className="text-[10px] text-slate-500 block">{tr.date}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Private Coach Notes */}
            <div className="bg-[#0D1110] p-4 rounded-xl border border-[#1B2320] text-xs space-y-1">
              <span className="text-[#00E676] font-bold block flex items-center gap-1.5">
                <MessageSquare className="w-3.5 h-3.5" /> Notes Confidentielles du Coach :
              </span>
              <p className="text-slate-300 italic">{selectedStudent.privateCoachNotes}</p>
            </div>
            </div>
          </div>
        </div>
      )}

      {/* Mot de passe temporaire de l'invitation élève — affiché une seule
          fois, jamais récupérable après la fermeture de cette modale. */}
      {inviteResult && (
        <div className="fixed inset-0 z-[60] bg-[#0D1110]/90 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-[#111615] border border-amber-500/40 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <KeyRound className="w-5 h-5 text-amber-400" /> Accès élève créé
            </h3>
            <p className="text-xs text-slate-400">
              Transmets ces identifiants à l'élève de la main à la main. Ce mot de passe temporaire
              ne sera plus jamais affiché — il devra le remplacer à sa première connexion.
            </p>
            <div className="bg-[#0D1110] border border-[#1B2320] rounded-xl p-4 space-y-2 font-mono text-sm">
              <div>
                <span className="text-[10px] text-slate-500 block uppercase">E-mail</span>
                <span className="text-white">{inviteResult.email}</span>
              </div>
              <div>
                <span className="text-[10px] text-slate-500 block uppercase">Mot de passe temporaire</span>
                <span className="text-amber-400 font-bold">{inviteResult.temporaryPassword}</span>
              </div>
            </div>
            <button
              onClick={() => setInviteResult(null)}
              className="w-full px-4 py-2.5 rounded-xl bg-[#00E676] text-slate-950 font-bold"
            >
              J'ai bien noté ces identifiants
            </button>
          </div>
        </div>
      )}

      {/* Vue complète de l'élève */}
      {isFullViewOpen && selectedStudent && (
        <AdminStudentView
          enrolledStudentId={selectedStudent.id}
          studentName={selectedStudent.name}
          onClose={() => setIsFullViewOpen(false)}
        />
      )}
    </div>
  );
};
