import React, { useState, useEffect } from "react";
import { X, AlertCircle, Loader } from "lucide-react";
import { EnrolledStudent, StudentProfile, Trade, TradingAccount, Module } from "../types";
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

/**
 * Onglets pris en charge par cette vue en lecture seule : ceux dont les
 * données viennent entièrement de `fetchAdminStudentView` (profil, comptes,
 * trades) ou qui ne dépendent d'aucune donnée propre à l'élève (Macro, flux
 * de marché partagé). Les autres (Examen, Replay, Module vidéo, Messagerie,
 * Sim propfirm...) demanderaient des données supplémentaires — quiz, badges,
 * fil de messagerie — non exposées par cette route ; masquées plutôt
 * qu'affichées à moitié cassées.
 */
const HIDDEN_ITEMS_FOR_READ_VIEW: SidebarItemKey[] = [
  "exam",
  "checklist",
  "replay",
  "propfirm",
  "academy",
  "messaging",
  "audit",
  "propfirmrules",
  "mindset",
];

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
  } | null>(null);

  useEffect(() => {
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
        });
      } catch (err) {
        setError((err as Error).message || "Impossible de charger la vue de l'élève.");
      } finally {
        setLoading(false);
      }
    };

    loadStudentView();
  }, [enrolledStudentId]);

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

  // Sidebar restreinte aux onglets pris en charge — indépendant de
  // `hiddenSidebarItems`, qui appartient normalement au bureau staff partagé
  // et n'a ici qu'un rôle local d'affichage pour cette vue.
  const readOnlyStudent: StudentProfile = {
    name: enrolledStudent.name,
    email: enrolledStudent.email,
    avatar: enrolledStudent.avatar,
    level: enrolledStudent.level,
    joinedDate: enrolledStudent.joinedDate,
    currentCapital: enrolledStudent.currentCapital,
    startingCapital: enrolledStudent.startingCapital,
    isAdmin: false,
    hiddenSidebarItems: HIDDEN_ITEMS_FOR_READ_VIEW,
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
          courseCompletionPercentage={enrolledStudent.courseCompletionPercentage}
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
                forumTopics={[]}
                messages={[]}
                courseCompletionPercentage={enrolledStudent.courseCompletionPercentage}
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
                readOnly
              />
            )}

            {activeTab === "analytics" && (
              <PerformanceDashboard
                student={readOnlyStudent}
                trades={studentData.trades}
                courseCompletionPercentage={enrolledStudent.courseCompletionPercentage}
              />
            )}

            {activeTab === "macro" && <MacroDashboard />}
          </main>
        </div>
      </div>
    </div>
  );
};
