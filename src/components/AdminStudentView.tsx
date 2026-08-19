import React, { useState, useEffect } from "react";
import { X, AlertCircle, Loader, Send } from "lucide-react";
import { EnrolledStudent, StudentProfile, Trade, TradingAccount, Module, CoachMessage } from "../types";
import { api } from "../lib/api";
import { TradingJournal } from "./TradingJournal";
import { PerformanceDashboard } from "./PerformanceDashboard";
import { WalletManagement } from "./WalletManagement";
import { MainDashboard } from "./MainDashboard";
import { MacroDashboard } from "./MacroDashboard";
import { Sidebar, SidebarItemKey, TabType } from "./Sidebar";
import { TopHeader } from "./TopHeader";

interface AdminStudentViewProps {
  enrolledStudentId: string;
  studentName: string;
  onClose: () => void;
}


export const AdminStudentView: React.FC<AdminStudentViewProps> = ({
  enrolledStudentId,
  studentName,
  onClose,
}) => {
  const [activeTab, setActiveTab] = useState<TabType>("dashboard");
  const [mobileOpen, setMobileOpen] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [studentData, setStudentData] = useState<{
    student: StudentProfile | null;
    enrolledStudents: EnrolledStudent[];
    accounts: TradingAccount[];
    trades: Trade[];
    modules: Module[];
    messages: CoachMessage[];
  } | null>(null);
  const [replyText, setReplyText] = useState("");
  const [sending, setSending] = useState(false);

  const loadStudentView = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.fetchAdminStudentView(enrolledStudentId);
      setStudentData({
        student: data.student,
        enrolledStudents: data.collections.enrolledStudents,
        accounts: data.collections.accounts,
        trades: data.collections.trades,
        modules: data.collections.modules,
        messages: data.collections.messages,
      });
    } catch (err) {
      setError((err as Error).message || "Impossible de charger la vue de l'élève.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadStudentView();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enrolledStudentId]);

  const handleSendReply = async () => {
    const text = replyText.trim();
    if (!text || sending) return;
    setSending(true);
    try {
      const { message } = await api.sendMessageToStudent(enrolledStudentId, text);
      setStudentData((prev) => (prev ? { ...prev, messages: [...prev.messages, message] } : prev));
      setReplyText("");
    } catch (err) {
      alert((err as Error).message || "L'envoi a échoué.");
    } finally {
      setSending(false);
    }
  };

  if (loading) {
    return (
      <div className="fixed inset-0 z-50 bg-[#0D1110]/90 backdrop-blur-md flex items-center justify-center">
        <div className="bg-[#111615] border border-[#1B2320] rounded-2xl p-8 space-y-4 shadow-2xl text-center">
          <Loader className="w-8 h-8 text-[#00E676] mx-auto animate-spin" />
          <p className="text-slate-300 text-sm">Chargement de la vue de {studentName}…</p>
        </div>
      </div>
    );
  }

  // Le compte élève lui-même n'a jamais de `StudentProfile` renseigné (`{}` en
  // base) : un élève n'utilise que le Journal, jamais un tableau de bord
  // complet, donc rien n'écrit ce profil. Nom, avatar, capital et niveau
  // vivent sur la fiche `EnrolledStudent` côté coach — c'est elle qu'il faut
  // utiliser pour reconstruire un profil affichable ici.
  const enrolledStudent = studentData?.enrolledStudents.find((s) => s.id === enrolledStudentId);

  if (error || !studentData || !enrolledStudent) {
    return (
      <div className="fixed inset-0 z-50 bg-[#0D1110]/90 backdrop-blur-md flex items-center justify-center p-4">
        <div className="bg-[#111615] border border-rose-500/30 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl">
          <div className="flex items-center gap-3">
            <AlertCircle className="w-6 h-6 text-rose-400" />
            <h3 className="text-lg font-bold text-white">Erreur</h3>
          </div>
          <p className="text-sm text-slate-300">{error ?? "Fiche introuvable."}</p>
          <button
            onClick={onClose}
            className="w-full px-4 py-2 rounded-lg bg-slate-700 text-white font-semibold text-sm hover:bg-slate-600"
          >
            Fermer
          </button>
        </div>
      </div>
    );
  }

  // Calculé en direct depuis les vrais modules de l'élève — jamais depuis
  // `enrolledStudent.courseCompletionPercentage`, un champ saisi à la main
  // par le coach dans la fiche qui dérive silencieusement dès que l'élève a
  // un compte actif et progresse réellement (même bug de fond que la
  // désynchronisation de `hiddenSidebarItems`, déjà corrigée ailleurs dans
  // ce fichier). Même formule que côté élève, voir `src/App.tsx`.
  const totalLessons = studentData.modules.reduce((acc, m) => acc + m.lessons.length, 0);
  const completedLessons = studentData.modules.reduce(
    (acc, m) => acc + m.lessons.filter((l) => l.isCompleted).length,
    0
  );
  const courseCompletionPercentage =
    totalLessons > 0 ? Math.round((completedLessons / totalLessons) * 100) : 0;

  // Onglets pour lesquels cette vue a un rendu dédié. Le reste (Module
  // vidéo) reste accessible depuis la sidebar
  // dès que le réglage de visibilité les autorise pour les élèves (fusionné
  // plus haut), mais n'a pas d'équivalent lecture seule ici — un clic
  // affichait auparavant une page vide plutôt qu'un message explicite.
  const SUPPORTED_TABS: TabType[] = ["dashboard", "journal", "wallets", "analytics", "macro", "messaging"];

  // Sidebar restreinte via `hiddenSidebarItems` fusionné depuis le serveur.
  // Le profil élève (studentData.student) contient déjà la fusion du réglage
  // admin avec les modules toujours cachés (ALWAYS_HIDDEN_FOR_STUDENTS).
  // La Vue Complète affiche donc exactement ce que l'élève voit.
  const readOnlyStudent: StudentProfile = {
    name: enrolledStudent.name,
    email: enrolledStudent.email,
    avatar: enrolledStudent.avatar,
    level: enrolledStudent.level,
    joinedDate: enrolledStudent.joinedDate,
    currentCapital: enrolledStudent.currentCapital,
    startingCapital: enrolledStudent.startingCapital,
    isAdmin: false,
    hiddenSidebarItems: studentData.student?.hiddenSidebarItems ?? [],
  };

  return (
    <div className="fixed inset-0 z-50 bg-[#0B0F0E] overflow-y-auto">
      {/* Bandeau de contexte : seul ajout par rapport à l'écosystème réel, pour
          qu'on ne perde jamais de vue qu'on consulte la fiche d'un tiers. */}
      <div className="sticky top-0 z-[60] bg-[#00E676] text-slate-950 text-xs font-bold px-4 py-2 flex items-center justify-between">
        <span>
          Consultation en lecture seule — {studentName} · Aucune modification n'est possible depuis cet écran.
        </span>
        <button
          onClick={onClose}
          className="p-1 rounded hover:bg-slate-950/10 transition-colors"
          title="Fermer la vue complète"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="min-h-screen bg-[#0B0F0E] text-slate-100 font-sans antialiased flex">
        <Sidebar
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          student={readOnlyStudent}
          courseCompletionPercentage={courseCompletionPercentage}
          totalUnreadMessages={0}
          mobileOpen={mobileOpen}
          setMobileOpen={setMobileOpen}
          isCollapsed={isCollapsed}
          setIsCollapsed={setIsCollapsed}
          onOpenProfileModal={() => {}}
          canManageSidebar={false}
        />

        <div className={`flex-1 flex flex-col min-w-0 transition-all duration-300 ${isCollapsed ? "lg:pl-20" : "lg:pl-64"}`}>
          <TopHeader activeTab={activeTab} student={readOnlyStudent} setMobileOpen={setMobileOpen} />

          <main className="p-4 sm:p-8 flex-1 max-w-7xl w-full mx-auto">
            {activeTab === "dashboard" && (
              <MainDashboard
                student={readOnlyStudent}
                trades={studentData.trades}
                modules={studentData.modules}
                messages={[]}
                courseCompletionPercentage={courseCompletionPercentage}
                setActiveTab={setActiveTab}
              />
            )}

            {activeTab === "journal" && (
              <TradingJournal
                trades={studentData.trades}
                accounts={studentData.accounts}
                onAddTrade={() => {}}
                onUpdateTrade={() => {}}
                onDeleteTrade={() => {}}
                onSendTradeToCoach={() => {}}
                readOnly
                hideAiAndCoachActions
              />
            )}

            {activeTab === "wallets" && (
              <WalletManagement
                accounts={studentData.accounts}
                trades={studentData.trades}
                onAddAccount={() => {}}
                onUpdateAccountBalance={() => {}}
                onDeleteAccount={() => {}}
                readOnly
              />
            )}

            {activeTab === "analytics" && (
              <PerformanceDashboard
                student={readOnlyStudent}
                trades={studentData.trades}
              />
            )}

            {activeTab === "macro" && <MacroDashboard />}

            {activeTab === "messaging" && (
              <div className="space-y-4">
                <h1 className="text-2xl font-bold text-white">Messagerie — {studentData.enrolledStudents.find((s) => s.id === enrolledStudentId)?.name}</h1>
                <div className="bg-[#111615] border border-[#1B2320] rounded-2xl flex flex-col h-[60vh]">
                  <div className="flex-1 overflow-y-auto p-4 space-y-3">
                    {studentData.messages.length === 0 ? (
                      <p className="text-sm text-slate-500 text-center py-8">Aucun message pour l'instant.</p>
                    ) : (
                      studentData.messages.map((msg) => (
                        <div
                          key={msg.id}
                          className={`max-w-[75%] p-3 rounded-xl text-sm ${
                            msg.sender === "coach"
                              ? "ml-auto bg-[#00E676]/10 border border-[#00E676]/20 text-white"
                              : "bg-[#1B2320] text-slate-200"
                          }`}
                        >
                          <p className="whitespace-pre-wrap">{msg.text}</p>
                          <p className="text-[10px] text-slate-500 mt-1">
                            {msg.sender === "coach" ? "Toi" : "Élève"} ·{" "}
                            {new Date(msg.timestamp).toLocaleString("fr-FR", {
                              day: "2-digit",
                              month: "2-digit",
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </p>
                        </div>
                      ))
                    )}
                  </div>
                  <div className="border-t border-[#1B2320] p-3 flex items-center gap-2">
                    <input
                      value={replyText}
                      onChange={(e) => setReplyText(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey) {
                          e.preventDefault();
                          void handleSendReply();
                        }
                      }}
                      placeholder="Répondre à l'élève…"
                      className="flex-1 bg-[#0D1110] border border-[#1B2320] rounded-xl px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-[#00E676]/40"
                    />
                    <button
                      onClick={() => void handleSendReply()}
                      disabled={sending || !replyText.trim()}
                      className="p-2.5 rounded-xl bg-[#00E676] hover:bg-[#00c865] disabled:opacity-40 disabled:cursor-not-allowed text-slate-950 transition-colors"
                    >
                      <Send className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            )}

            {!SUPPORTED_TABS.includes(activeTab) && (
              <div className="rounded-2xl border border-dashed border-[#1B2320] bg-[#111615] p-8 text-center text-sm text-slate-400">
                Cet onglet n'a pas d'équivalent en lecture seule dans la Vue Complète.
              </div>
            )}
          </main>
        </div>
      </div>
    </div>
  );
};
