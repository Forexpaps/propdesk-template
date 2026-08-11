import React, { useState, useEffect } from "react";
import { X, Eye, AlertCircle, Loader } from "lucide-react";
import { EnrolledStudent, StudentProfile, Trade, TradingAccount, Module } from "../types";
import { api } from "../lib/api";
import { TradingJournal } from "./TradingJournal";
import { PerformanceDashboard } from "./PerformanceDashboard";
import { WalletManagement } from "./WalletManagement";

interface AdminStudentViewProps {
  enrolledStudentId: string;
  studentName: string;
  onClose: () => void;
}

type TabType = "journal" | "wallet" | "performance" | "calendar";

export const AdminStudentView: React.FC<AdminStudentViewProps> = ({
  enrolledStudentId,
  studentName,
  onClose,
}) => {
  const [activeTab, setActiveTab] = useState<TabType>("journal");
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

  if (error || !studentData) {
    return (
      <div className="fixed inset-0 z-50 bg-[#0D1110]/90 backdrop-blur-md flex items-center justify-center p-4">
        <div className="bg-[#111615] border border-rose-500/30 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl">
          <div className="flex items-center gap-3">
            <AlertCircle className="w-6 h-6 text-rose-400" />
            <h3 className="text-lg font-bold text-white">Erreur</h3>
          </div>
          <p className="text-sm text-slate-300">{error}</p>
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

  const TAB_CONFIG: Array<{ id: TabType; label: string; icon: string }> = [
    { id: "journal", label: "Journal de Trading", icon: "📔" },
    { id: "wallet", label: "Portefeuille", icon: "💼" },
    { id: "performance", label: "Rentabilité", icon: "📈" },
    { id: "calendar", label: "Calendrier", icon: "📅" },
  ];

  return (
    <div className="fixed inset-0 z-50 bg-[#0D1110]/40 backdrop-blur-sm overflow-y-auto">
      <div className="min-h-screen py-8 px-4">
        <div className="max-w-7xl mx-auto space-y-6">
          {/* Header */}
          <div className="bg-[#111615] border border-[#1B2320] rounded-2xl p-6 flex items-center justify-between shadow-xl">
            <div className="flex items-center gap-3">
              <Eye className="w-6 h-6 text-[#00E676]" />
              <div>
                <h2 className="text-2xl font-black text-white">Vue Complète : {studentName}</h2>
                <p className="text-xs text-slate-400 mt-1">Consultation en lecture seule • Admin</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-[#1B2320] rounded-lg transition-colors"
            >
              <X className="w-6 h-6 text-slate-400" />
            </button>
          </div>

          {/* Tab Navigation */}
          <div className="flex gap-2 flex-wrap">
            {TAB_CONFIG.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-4 py-2 rounded-lg font-semibold text-sm transition-all ${
                  activeTab === tab.id
                    ? "bg-[#00E676] text-slate-950"
                    : "bg-[#1B2320] text-slate-300 hover:bg-[#232D29]"
                }`}
              >
                {tab.icon} {tab.label}
              </button>
            ))}
          </div>

          {/* Tab Content */}
          <div className="space-y-6">
            {activeTab === "journal" && studentData && (
              <TradingJournal
                trades={studentData.trades}
                accounts={studentData.accounts}
                onAddTrade={() => {}}
                onUpdateTrade={() => {}}
                onDeleteTrade={() => {}}
                onSendTradeToCoach={() => {}}
                readOnly={true}
                hideAiAndCoachActions={true}
              />
            )}

            {activeTab === "wallet" && studentData && (
              <WalletManagement
                accounts={studentData.accounts}
                trades={studentData.trades}
                onAddAccount={() => {}}
                onUpdateAccountBalance={() => {}}
              />
            )}

            {activeTab === "performance" && studentData && studentData.student && (
              <PerformanceDashboard
                student={studentData.student}
                trades={studentData.trades}
                courseCompletionPercentage={0}
              />
            )}

            {activeTab === "calendar" && (
              <div className="bg-[#111615] border border-[#1B2320] rounded-2xl p-8 text-center">
                <p className="text-slate-400">Calendrier économique — À venir</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
