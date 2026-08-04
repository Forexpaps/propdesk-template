import React, { useState, useEffect } from "react";
import { Sidebar, TabType } from "./components/Sidebar";
import { TopHeader } from "./components/TopHeader";
import { MainDashboard } from "./components/MainDashboard";
import { VideoAcademy } from "./components/VideoAcademy";
import { TradingJournal } from "./components/TradingJournal";
import { ForumSection } from "./components/ForumSection";
import { CoachMessaging } from "./components/CoachMessaging";
import { PerformanceDashboard } from "./components/PerformanceDashboard";
import { TradeAuditModal } from "./components/TradeAuditModal";
import { PositionCalculatorModal } from "./components/PositionCalculatorModal";
import { TradingPlanModal } from "./components/TradingPlanModal";
import { CertificateModal } from "./components/CertificateModal";
import { EconomicCalendarModal } from "./components/EconomicCalendarModal";
import { WalletManagement } from "./components/WalletManagement";
import { SMCSimulator } from "./components/SMCSimulator";
import { CoachSignals } from "./components/CoachSignals";
import { StudentTracking } from "./components/StudentTracking";
import { UserProfileModal } from "./components/UserProfileModal";
import { NotificationModal } from "./components/NotificationModal";
import { PropFirmRulesModal } from "./components/PropFirmRulesModal";
import { MindsetJournalModal } from "./components/MindsetJournalModal";
import { AISetupAnalyzerModal } from "./components/AISetupAnalyzerModal";

import {
  initialStudentProfile,
  initialCoaches,
  initialModules,
  initialTrades,
  initialMessages,
  initialForumTopics,
  initialTradingAccounts,
  initialCoachSignals,
  initialBacktestScenarios,
  initialTraderBadges,
  initialEnrolledStudents,
  initialNotifications,
} from "./data/mockData";
import {
  Module,
  Trade,
  CoachMessage,
  StudentProfile,
  ForumTopic,
  ForumReply,
  ForumRole,
  ModuleQuizResult,
  TradingAccount,
  CoachSignal,
  EnrolledStudent,
  AppNotification,
  TraderBadge,
} from "./types";

export default function App() {
  const [activeTab, setActiveTab] = useState<TabType>("dashboard");

  const [mobileOpen, setMobileOpen] = useState<boolean>(false);

  // Sidebar Collapsed State (Fullscreen optimization)
  const [isCollapsed, setIsCollapsed] = useState<boolean>(() => {
    const saved = localStorage.getItem("horizon_sidebar_collapsed");
    return saved ? JSON.parse(saved) : false;
  });

  // Modals States
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [isNotificationsModalOpen, setIsNotificationsModalOpen] = useState(false);
  const [isCalculatorOpen, setIsCalculatorOpen] = useState(false);
  const [isChecklistOpen, setIsChecklistOpen] = useState(false);
  const [isCertificateOpen, setIsCertificateOpen] = useState(false);
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);

  // Local Storage Persistent State or Defaults
  const [notifications, setNotifications] = useState<AppNotification[]>(() => {
    const saved = localStorage.getItem("horizon_notifications");
    return saved ? JSON.parse(saved) : initialNotifications;
  });

  // Local Storage Persistent State or Defaults
  const [student, setStudent] = useState<StudentProfile>(() => {
    const saved = localStorage.getItem("horizon_student");
    return saved ? JSON.parse(saved) : initialStudentProfile;
  });

  const [enrolledStudents, setEnrolledStudents] = useState<EnrolledStudent[]>(() => {
    const saved = localStorage.getItem("horizon_enrolled_students");
    return saved ? JSON.parse(saved) : initialEnrolledStudents;
  });

  const [accounts, setAccounts] = useState<TradingAccount[]>(() => {
    const saved = localStorage.getItem("horizon_accounts");
    return saved ? JSON.parse(saved) : initialTradingAccounts;
  });

  const [signals, setSignals] = useState<CoachSignal[]>(() => {
    const saved = localStorage.getItem("horizon_signals");
    return saved ? JSON.parse(saved) : initialCoachSignals;
  });

  const [modules, setModules] = useState<Module[]>(() => {
    const saved = localStorage.getItem("horizon_modules");
    return saved ? JSON.parse(saved) : initialModules;
  });

  const [trades, setTrades] = useState<Trade[]>(() => {
    const saved = localStorage.getItem("horizon_trades");
    return saved ? JSON.parse(saved) : initialTrades;
  });

  const [messages, setMessages] = useState<CoachMessage[]>(() => {
    const saved = localStorage.getItem("horizon_messages");
    return saved ? JSON.parse(saved) : initialMessages;
  });

  const [forumTopics, setForumTopics] = useState<ForumTopic[]>(() => {
    const saved = localStorage.getItem("horizon_forum_topics");
    return saved ? JSON.parse(saved) : initialForumTopics;
  });

  const [quizResults, setQuizResults] = useState<Record<string, ModuleQuizResult>>(() => {
    const saved = localStorage.getItem("horizon_quiz_results");
    return saved ? JSON.parse(saved) : {};
  });

  const [badges, setBadges] = useState<TraderBadge[]>(() => {
    const saved = localStorage.getItem("horizon_badges");
    return saved ? JSON.parse(saved) : initialTraderBadges;
  });

  // Modal & Pre-filled Messaging Navigation state
  const [selectedTradeForAudit, setSelectedTradeForAudit] = useState<Trade | null>(
    null
  );
  const [prefilledLessonTitle, setPrefilledLessonTitle] = useState<
    string | undefined
  >(undefined);
  const [prefilledTradeId, setPrefilledTradeId] = useState<string | undefined>(
    undefined
  );

  const [isPropFirmRulesOpen, setIsPropFirmRulesOpen] = useState<boolean>(false);
  const [isMindsetModalOpen, setIsMindsetModalOpen] = useState<boolean>(false);
  const [isAISetupAnalyzerOpen, setIsAISetupAnalyzerOpen] = useState<boolean>(false);

  // Persistence Effects
  useEffect(() => {
    localStorage.setItem("horizon_badges", JSON.stringify(badges));
  }, [badges]);
  useEffect(() => {
    localStorage.setItem("horizon_student", JSON.stringify(student));
  }, [student]);

  useEffect(() => {
    localStorage.setItem("horizon_notifications", JSON.stringify(notifications));
  }, [notifications]);

  useEffect(() => {
    localStorage.setItem("horizon_sidebar_collapsed", JSON.stringify(isCollapsed));
  }, [isCollapsed]);

  useEffect(() => {
    localStorage.setItem("horizon_enrolled_students", JSON.stringify(enrolledStudents));
  }, [enrolledStudents]);

  useEffect(() => {
    localStorage.setItem("horizon_accounts", JSON.stringify(accounts));
  }, [accounts]);

  useEffect(() => {
    localStorage.setItem("horizon_signals", JSON.stringify(signals));
  }, [signals]);

  useEffect(() => {
    localStorage.setItem("horizon_modules", JSON.stringify(modules));
  }, [modules]);

  useEffect(() => {
    localStorage.setItem("horizon_trades", JSON.stringify(trades));
  }, [trades]);

  useEffect(() => {
    localStorage.setItem("horizon_messages", JSON.stringify(messages));
  }, [messages]);

  useEffect(() => {
    localStorage.setItem("horizon_forum_topics", JSON.stringify(forumTopics));
  }, [forumTopics]);

  useEffect(() => {
    localStorage.setItem("horizon_quiz_results", JSON.stringify(quizResults));
  }, [quizResults]);

  // Recalculate Student Capital from Trades PnL
  useEffect(() => {
    const totalPnL = trades.reduce((acc, t) => acc + t.pnl, 0);
    setStudent((prev) => ({
      ...prev,
      currentCapital: prev.startingCapital + totalPnL,
    }));
  }, [trades]);

  // Student Admin Handlers
  const handleUpdateStudent = (updatedStudent: EnrolledStudent) => {
    setEnrolledStudents((prev) =>
      prev.map((s) => (s.id === updatedStudent.id ? updatedStudent : s))
    );
  };

  const handleAddStudent = (newStudent: EnrolledStudent) => {
    setEnrolledStudents((prev) => [newStudent, ...prev]);
  };

  const handleDeleteStudent = (studentId: string) => {
    setEnrolledStudents((prev) => prev.filter((s) => s.id !== studentId));
  };

  const handleSaveProfile = (updatedProfile: StudentProfile) => {
    setStudent(updatedProfile);
  };

  const handleClaimBadge = (badgeId: string) => {
    setBadges((prevBadges) =>
      prevBadges.map((b) => {
        if (b.id === badgeId) {
          const unlockedBadge = {
            ...b,
            unlocked: true,
            progressPercentage: 100,
            unlockedAt: new Date().toLocaleDateString("fr-FR", {
              day: "numeric",
              month: "long",
              year: "numeric",
            }),
          };

          const newNotif: AppNotification = {
            id: `notif-badge-${Date.now()}`,
            title: "🏆 Nouveau Badge Débloqué !",
            message: `Félicitations ! Tu as débloqué le badge "${b.title}" et gagné +${b.rewardXP || 200} XP !`,
            time: "À l'instant",
            type: "system",
            read: false,
          };
          setNotifications((prev) => [newNotif, ...prev]);

          return unlockedBadge;
        }
        return b;
      })
    );
  };

  // Accounts Handlers
  const handleAddAccount = (account: TradingAccount) => {
    setAccounts((prev) => [account, ...prev]);
  };

  const handleUpdateAccountBalance = (id: string, newBalance: number) => {
    setAccounts((prev) =>
      prev.map((acc) =>
        acc.id === id ? { ...acc, equity: newBalance, currentBalance: newBalance } : acc
      )
    );
  };

  const handleImportSignalToJournal = (sig: CoachSignal) => {
    const newTrade: Trade = {
      id: `trade-sig-${Date.now()}`,
      date: new Date().toISOString().split("T")[0],
      pair: sig.pair,
      marketCategory: sig.pair.includes("USD") ? "Forex" : sig.pair.includes("NAS") ? "Indices" : "Matières Premières",
      direction: sig.direction,
      entryPrice: sig.entryPrice,
      stopLoss: sig.stopLoss,
      takeProfit: sig.takeProfit1,
      lotSize: 1.0,
      pnl: sig.pnlResultPips ? sig.pnlResultPips * 10 : 0,
      pnlPercentage: 1.5,
      riskRewardRatio: 2.5,
      result: sig.status === "TP_ATTEINT" ? "WIN" : sig.status === "SL_ATTEINT" ? "LOSS" : "OPEN",
      strategy: `Signal Coach ${sig.coachName}`,
      emotion: "Disciplined",
      notes: `Signal importé depuis le centre de signaux par Coach ${sig.coachName}. Zone: ${sig.entryZone}. TP1: ${sig.takeProfit1}, TP2: ${sig.takeProfit2}. Notes: ${sig.smcNotes}`,
    };

    setTrades((prev) => [newTrade, ...prev]);
    alert(`Trade ${sig.pair} (${sig.direction}) importé avec succès dans votre Journal de Trading !`);
  };

  // Handlers
  const handleToggleLessonCompletion = (
    moduleId: string,
    lessonId: string
  ) => {
    setModules((prev) =>
      prev.map((mod) => {
        if (mod.id === moduleId) {
          return {
            ...mod,
            lessons: mod.lessons.map((l) =>
              l.id === lessonId ? { ...l, isCompleted: !l.isCompleted } : l
            ),
          };
        }
        return mod;
      })
    );
  };

  const handleSaveModuleQuizResult = (moduleId: string, result: ModuleQuizResult) => {
    setQuizResults((prev) => ({
      ...prev,
      [moduleId]: result,
    }));
  };

  const handleAddTrade = (newTrade: Omit<Trade, "id">) => {
    const tradeWithId: Trade = {
      ...newTrade,
      id: `trd-${Date.now()}`,
    };
    setTrades((prev) => [tradeWithId, ...prev]);
  };

  const handleDeleteTrade = (id: string) => {
    setTrades((prev) => prev.filter((t) => t.id !== id));
  };

  const handleUpdateTradeAudit = (tradeId: string, auditData: any) => {
    setTrades((prev) =>
      prev.map((t) => {
        if (t.id === tradeId) {
          const updated = { ...t, aiAudit: auditData };
          if (selectedTradeForAudit?.id === tradeId) {
            setSelectedTradeForAudit(updated);
          }
          return updated;
        }
        return t;
      })
    );
  };

  const handleAskCoachAboutLesson = (lessonTitle: string) => {
    setPrefilledLessonTitle(lessonTitle);
    setPrefilledTradeId(undefined);
    setActiveTab("messaging");
  };

  const handleSendTradeToCoach = (trade: Trade) => {
    setPrefilledTradeId(trade.id);
    setPrefilledLessonTitle(undefined);
    setActiveTab("messaging");
  };

  const handleSendMessage = async (
    coachId: string,
    text: string,
    attachedTradeId?: string,
    attachedModuleTitle?: string,
    triggerAiReply: boolean = true
  ) => {
    const timestamp = "Aujourd'hui, " + new Date().toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
    const studentMsg: CoachMessage = {
      id: `msg-${Date.now()}`,
      sender: "student",
      coachId,
      text,
      timestamp,
      attachedTradeId,
      attachedModuleTitle,
      status: "sent",
    };

    setMessages((prev) => [...prev, studentMsg]);

    if (triggerAiReply) {
      try {
        const attachedTrade = attachedTradeId
          ? trades.find((t) => t.id === attachedTradeId)
          : undefined;

        const response = await fetch("/api/coach/ai-review", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            question: text,
            trade: attachedTrade,
          }),
        });

        const json = await response.json();
        let coachFeedbackText =
          json.data?.coachFeedback ||
          "Excellente question. Continue à respecter ta checklist et ton Risk Management.";

        const coachReply: CoachMessage = {
          id: `msg-reply-${Date.now()}`,
          sender: "coach",
          coachId,
          text: coachFeedbackText,
          timestamp: "À l'instant",
          status: "replied",
        };

        setMessages((prev) => [...prev, coachReply]);
      } catch (err) {
        console.error("Erreur réponse IA Coach:", err);
      }
    }
  };

  // Forum Handlers
  const handleCreateForumTopic = (newTopicData: Omit<ForumTopic, "id" | "createdAt" | "repliesCount" | "viewsCount" | "likesCount" | "isPinned" | "isSolved" | "isLocked" | "replies">) => {
    const newTopic: ForumTopic = {
      ...newTopicData,
      id: `topic-${Date.now()}`,
      createdAt: "À l'instant",
      repliesCount: 0,
      viewsCount: 1,
      likesCount: 1,
      isPinned: false,
      isSolved: false,
      isLocked: false,
      replies: [],
    };
    setForumTopics((prev) => [newTopic, ...prev]);
  };

  const handleAddForumReply = (
    topicId: string,
    content: string,
    role: ForumRole = "Élève Premium",
    authorName: string = student.name,
    isCoachCertified: boolean = false
  ) => {
    const isCoach = role === "Head Coach";
    const avatar = isCoach
      ? "https://images.unsplash.com/photo-1560250097-0b93528c311a?auto=format&fit=crop&q=80&w=250"
      : student.avatar;

    const newReply: ForumReply = {
      id: `rep-${Date.now()}`,
      authorName,
      authorAvatar: avatar,
      authorRole: role,
      createdAt: "À l'instant",
      content,
      likesCount: 0,
      isCoachCertified,
      isSolution: isCoach,
    };

    setForumTopics((prev) =>
      prev.map((topic) => {
        if (topic.id === topicId) {
          return {
            ...topic,
            repliesCount: topic.repliesCount + 1,
            isSolved: isCoach ? true : topic.isSolved,
            replies: [...topic.replies, newReply],
          };
        }
        return topic;
      })
    );
  };

  const handleToggleLikeTopic = (topicId: string) => {
    setForumTopics((prev) =>
      prev.map((t) => (t.id === topicId ? { ...t, likesCount: t.likesCount + 1 } : t))
    );
  };

  const handleToggleLikeReply = (topicId: string, replyId: string) => {
    setForumTopics((prev) =>
      prev.map((t) => {
        if (t.id === topicId) {
          return {
            ...t,
            replies: t.replies.map((r) =>
              r.id === replyId ? { ...r, likesCount: r.likesCount + 1 } : r
            ),
          };
        }
        return t;
      })
    );
  };

  const handleTogglePinTopic = (topicId: string) => {
    setForumTopics((prev) =>
      prev.map((t) => (t.id === topicId ? { ...t, isPinned: !t.isPinned } : t))
    );
  };

  const handleToggleSolveTopic = (topicId: string) => {
    setForumTopics((prev) =>
      prev.map((t) => (t.id === topicId ? { ...t, isSolved: !t.isSolved } : t))
    );
  };

  const handleToggleLockTopic = (topicId: string) => {
    setForumTopics((prev) =>
      prev.map((t) => (t.id === topicId ? { ...t, isLocked: !t.isLocked } : t))
    );
  };

  const handleDeleteForumTopic = (topicId: string) => {
    setForumTopics((prev) => prev.filter((t) => t.id !== topicId));
  };

  // Stats for Sidebar
  const totalLessons = modules.reduce((acc, m) => acc + m.lessons.length, 0);
  const completedLessons = modules.reduce(
    (acc, m) => acc + m.lessons.filter((l) => l.isCompleted).length,
    0
  );
  const courseCompletionPercentage =
    totalLessons > 0 ? Math.round((completedLessons / totalLessons) * 100) : 0;

  return (
    <div className="min-h-screen bg-[#0B0F0E] text-slate-100 font-sans antialiased selection:bg-[#00E676] selection:text-slate-950 flex">
      {/* Left Sidebar Navigation */}
      <Sidebar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        student={student}
        courseCompletionPercentage={courseCompletionPercentage}
        totalUnreadMessages={1}
        mobileOpen={mobileOpen}
        setMobileOpen={setMobileOpen}
        isCollapsed={isCollapsed}
        setIsCollapsed={setIsCollapsed}
        onOpenProfileModal={() => setIsProfileModalOpen(true)}
        onOpenChecklist={() => setIsChecklistOpen(true)}
      />

      {/* Main Content Area (offset by sidebar width on large screens) */}
      <div className={`flex-1 flex flex-col min-w-0 transition-all duration-300 ${isCollapsed ? "lg:pl-20" : "lg:pl-64"}`}>
        {/* Top Header Bar */}
        <TopHeader
          activeTab={activeTab}
          student={student}
          setMobileOpen={setMobileOpen}
          onOpenCalculator={() => setIsCalculatorOpen(true)}
          onOpenChecklist={() => setIsChecklistOpen(true)}
          onOpenCalendar={() => setIsCalendarOpen(true)}
          onOpenCertificate={() => setIsCertificateOpen(true)}
          onOpenProfileModal={() => setIsProfileModalOpen(true)}
          onOpenNotifications={() => setIsNotificationsModalOpen(true)}
          onOpenPropFirmRules={() => setIsPropFirmRulesOpen(true)}
          onOpenMindsetModal={() => setIsMindsetModalOpen(true)}
          onOpenAISetupAnalyzer={() => setIsAISetupAnalyzerOpen(true)}
          unreadNotificationsCount={notifications.filter((n) => !n.read).length}
        />

        {/* Page Content View */}
        <main className="p-4 sm:p-8 flex-1 max-w-7xl w-full mx-auto">
          {activeTab === "dashboard" && (
            <MainDashboard
              student={student}
              trades={trades}
              modules={modules}
              forumTopics={forumTopics}
              messages={messages}
              courseCompletionPercentage={courseCompletionPercentage}
              setActiveTab={setActiveTab}
              onSelectTradeForAudit={(trade) => setSelectedTradeForAudit(trade)}
              onOpenCalculator={() => setIsCalculatorOpen(true)}
              onOpenChecklist={() => setIsChecklistOpen(true)}
              onOpenCalendar={() => setIsCalendarOpen(true)}
              onOpenCertificate={() => setIsCertificateOpen(true)}
            />
          )}

          {activeTab === "students" && (
            <StudentTracking
              students={enrolledStudents}
              onUpdateStudent={handleUpdateStudent}
              onAddStudent={handleAddStudent}
              onDeleteStudent={handleDeleteStudent}
            />
          )}

          {activeTab === "wallets" && (
            <WalletManagement
              accounts={accounts}
              onAddAccount={handleAddAccount}
              onUpdateAccountBalance={handleUpdateAccountBalance}
            />
          )}

          {activeTab === "simulator" && (
            <SMCSimulator scenarios={initialBacktestScenarios} />
          )}

          {activeTab === "signals" && (
            <CoachSignals
              signals={signals}
              onImportSignalToJournal={handleImportSignalToJournal}
            />
          )}

          {activeTab === "academy" && (
            <VideoAcademy
              modules={modules}
              quizResults={quizResults}
              onToggleLessonCompletion={handleToggleLessonCompletion}
              onAskCoachAboutLesson={handleAskCoachAboutLesson}
              onSaveModuleQuizResult={handleSaveModuleQuizResult}
            />
          )}

          {activeTab === "journal" && (
            <TradingJournal
              trades={trades}
              onAddTrade={handleAddTrade}
              onDeleteTrade={handleDeleteTrade}
              onSelectTradeForAudit={(trade) => setSelectedTradeForAudit(trade)}
              onSendTradeToCoach={handleSendTradeToCoach}
              onOpenCalculator={() => setIsCalculatorOpen(true)}
            />
          )}

          {activeTab === "forum" && (
            <ForumSection
              topics={forumTopics}
              student={student}
              coaches={initialCoaches}
              onCreateTopic={handleCreateForumTopic}
              onAddReply={handleAddForumReply}
              onToggleLikeTopic={handleToggleLikeTopic}
              onToggleLikeReply={handleToggleLikeReply}
              onTogglePinTopic={handleTogglePinTopic}
              onToggleSolveTopic={handleToggleSolveTopic}
              onToggleLockTopic={handleToggleLockTopic}
              onDeleteTopic={handleDeleteForumTopic}
            />
          )}

          {activeTab === "messaging" && (
            <CoachMessaging
              coaches={initialCoaches}
              messages={messages}
              student={student}
              trades={trades}
              onSendMessage={handleSendMessage}
              prefilledLessonTitle={prefilledLessonTitle}
              prefilledTradeId={prefilledTradeId}
            />
          )}

          {activeTab === "analytics" && (
            <PerformanceDashboard
              student={student}
              trades={trades}
              courseCompletionPercentage={courseCompletionPercentage}
            />
          )}
        </main>
      </div>

      {/* User Profile Edition Modal */}
      <UserProfileModal
        isOpen={isProfileModalOpen}
        onClose={() => setIsProfileModalOpen(false)}
        student={student}
        badges={badges}
        onSaveProfile={handleSaveProfile}
        onClaimBadge={handleClaimBadge}
      />

      {/* AI Trade Audit Modal */}
      {selectedTradeForAudit && (
        <TradeAuditModal
          trade={selectedTradeForAudit}
          onClose={() => setSelectedTradeForAudit(null)}
          onUpdateTradeAudit={handleUpdateTradeAudit}
        />
      )}

      {/* Position Calculator Modal */}
      <PositionCalculatorModal
        isOpen={isCalculatorOpen}
        onClose={() => setIsCalculatorOpen(false)}
        studentCapital={student.currentCapital}
      />

      {/* Trading Plan Checklist Modal */}
      <TradingPlanModal
        isOpen={isChecklistOpen}
        onClose={() => setIsChecklistOpen(false)}
      />

      {/* Certificate Modal */}
      <CertificateModal
        isOpen={isCertificateOpen}
        onClose={() => setIsCertificateOpen(false)}
        studentName={student.name}
        completionPercentage={courseCompletionPercentage}
      />

      {/* Economic Calendar Modal */}
      <EconomicCalendarModal
        isOpen={isCalendarOpen}
        onClose={() => setIsCalendarOpen(false)}
      />

      {/* Prop Firm Rules & Challenge Modal */}
      <PropFirmRulesModal
        isOpen={isPropFirmRulesOpen}
        onClose={() => setIsPropFirmRulesOpen(false)}
        student={student}
      />

      {/* Mindset & Tilt Radar Modal */}
      <MindsetJournalModal
        isOpen={isMindsetModalOpen}
        onClose={() => setIsMindsetModalOpen(false)}
      />

      {/* AI Setup & Confluence Matrix Modal */}
      <AISetupAnalyzerModal
        isOpen={isAISetupAnalyzerOpen}
        onClose={() => setIsAISetupAnalyzerOpen(false)}
        onApplyToJournal={(setup) => {
          setActiveTab("journal");
          setIsAISetupAnalyzerOpen(false);
        }}
      />
    </div>
  );
}

