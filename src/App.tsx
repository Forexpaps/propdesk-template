import React, { useState, useEffect } from "react";
import {
  Sidebar,
  TabType,
  SIDEBAR_TOGGLEABLE_KEYS,
  SIDEBAR_ITEM_TABS,
} from "./components/Sidebar";
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
import { EconomicCalendarModal } from "./components/EconomicCalendarModal";
import { WalletManagement } from "./components/WalletManagement";
import { SMCSimulator } from "./components/SMCSimulator";
import { CoachSignals } from "./components/CoachSignals";
import { StudentTracking } from "./components/StudentTracking";
import { UserProfileModal } from "./components/UserProfileModal";
import { StaffAccountsModal } from "./components/StaffAccountsModal";
import { NotificationModal } from "./components/NotificationModal";
import { PropFirmRulesModal } from "./components/PropFirmRulesModal";
import { MindsetJournalModal } from "./components/MindsetJournalModal";
import { SetupAnalyzerModal } from "./components/SetupAnalyzerModal";

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
  TradeDraft,
} from "./types";
import { TabType as SidebarTabType } from "./components/Sidebar";
import { usePersistentState } from "./hooks/usePersistentState";
import { useBootstrap, useSyncedState } from "./hooks/useServerSync";
import { useAuth } from "./hooks/useAuth";
import { LoginScreen } from "./components/auth/LoginScreen";
import { SetupScreen } from "./components/auth/SetupScreen";
import { ChangePasswordScreen } from "./components/auth/ChangePasswordScreen";
import { api, type ServerState } from "./lib/api";

/** Écran d'attente partagé par les deux étapes de démarrage. */
function LoadingScreen({ message }: { message: string }) {
  return (
    <div className="min-h-screen bg-[#0B0F0E] text-slate-300 flex flex-col items-center justify-center gap-4 font-sans">
      <img
        src="/icon.png"
        alt=""
        className="w-10 h-10 rounded-xl animate-pulse"
      />
      <p className="text-xs font-mono text-slate-500">{message}</p>
    </div>
  );
}

/**
 * Porte d'entrée : décide quel écran monter selon l'état d'authentification.
 *
 * Ce composant ne fait *que* `useAuth()`. Le chargement des données vit dans
 * `AuthenticatedApp`, monté conditionnellement — les hooks ne pouvant pas être
 * conditionnels, c'est ce découpage qui garantit qu'aucun appel à `/api/state`
 * ne part avant qu'une session existe.
 *
 * Le serveur ne peut pas rediriger vers un écran de connexion : le catch-all
 * renvoie `index.html` pour toute URL non-API. Le filtrage est donc
 * nécessairement ici, à partir de `/api/auth/me`.
 */
export default function App() {
  const { status, user, expired, login, setup, changePassword, markLoggedOut, refresh } =
    useAuth();

  if (status === "loading") {
    return <LoadingScreen message="Vérification de ta session…" />;
  }

  if (status === "no-account") {
    return <SetupScreen onSetup={setup} onRefresh={() => void refresh()} />;
  }

  if (status === "unauthenticated") {
    return <LoginScreen onLogin={login} expired={expired} />;
  }

  // Un mot de passe temporaire (compte invité) bloque l'accès à l'application
  // jusqu'à son remplacement — la session est valide, seul le mot de passe ne
  // l'est plus. Le serveur refuse par ailleurs toute autre route tant que
  // cette étape n'est pas franchie (filet de sécurité, voir requireAuth).
  if (status === "authenticated" && user?.mustChangePassword) {
    return <ChangePasswordScreen onChangePassword={changePassword} />;
  }

  // `authenticated` et `offline` mènent tous deux à l'application. Hors ligne,
  // aucune vérification n'est possible : on démarre sur le cache local, comme
  // avant l'authentification. C'est un choix assumé — le verrou n'est donc pas
  // une barrière d'accès aux données déjà présentes sur la machine (voir README).
  return <AuthenticatedApp onLoggedOut={markLoggedOut} currentStaffId={user?.id ?? null} />;
}

/**
 * Charge l'état applicatif, puis monte l'académie.
 *
 * Monté seulement une fois l'authentification résolue, si bien que
 * `useBootstrap` — et son import depuis l'ancien localStorage — ne s'exécute
 * jamais sans session.
 */
function AuthenticatedApp({
  onLoggedOut,
  currentStaffId,
}: {
  onLoggedOut: () => void;
  currentStaffId: string | null;
}) {
  const { status, state } = useBootstrap();

  if (status === "loading") {
    return <LoadingScreen message="Chargement de ton espace PropDesk…" />;
  }

  return (
    <AcademyApp
      initialState={state}
      syncEnabled={status === "online"}
      onLoggedOut={onLoggedOut}
      currentStaffId={currentStaffId}
    />
  );
}

interface AcademyAppProps {
  /** État renvoyé par le serveur, ou null si celui-ci est injoignable. */
  initialState: ServerState | null;
  /** false quand on tourne sur le cache local : on n'essaie pas de pousser. */
  syncEnabled: boolean;
  /** Remonte la déconnexion pour afficher l'écran de connexion. */
  onLoggedOut: () => void;
  /** Identité du compte staff connecté. `null` hors ligne (pas de session vérifiée). */
  currentStaffId: string | null;
}

function AcademyApp({ initialState, syncEnabled, onLoggedOut, currentStaffId }: AcademyAppProps) {
  const server = initialState?.collections;
  const [activeTab, setActiveTab] = useState<TabType>("dashboard");

  const [mobileOpen, setMobileOpen] = useState<boolean>(false);

  // Sidebar Collapsed State (Fullscreen optimization)
  const [isCollapsed, setIsCollapsed] = usePersistentState<boolean>(
    "horizon_sidebar_collapsed",
    false
  );

  // Modals States
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [profileModalTab, setProfileModalTab] = useState<"profile" | "badges">("profile");
  const [isNotificationsModalOpen, setIsNotificationsModalOpen] = useState(false);
  const [isCalculatorOpen, setIsCalculatorOpen] = useState(false);
  const [isChecklistOpen, setIsChecklistOpen] = useState(false);
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const [isStaffAccountsOpen, setIsStaffAccountsOpen] = useState(false);

  // Valeur de départ d'une collection : le serveur fait autorité quand il a
  // répondu ; sinon on repart du cache local, et en dernier recours du seed.
  function seed<T>(fromServer: T | undefined, localKey: string, fallback: T): T {
    if (initialState) return fromServer ?? fallback;
    try {
      const cached = localStorage.getItem(localKey);
      if (cached !== null) return JSON.parse(cached) as T;
    } catch {
      // Cache illisible : on retombe sur le seed.
    }
    return fallback;
  }

  // Collections synchronisées avec le serveur, avec miroir localStorage
  const [notifications, setNotifications] = useSyncedState<AppNotification[]>(
    "horizon_notifications",
    seed(server?.notifications, "horizon_notifications", initialNotifications),
    (v) => api.saveCollection("notifications", v),
    syncEnabled
  );

  const [student, setStudent] = useSyncedState<StudentProfile>(
    "horizon_student",
    seed(initialState?.student ?? undefined, "horizon_student", initialStudentProfile),
    (v) => api.saveProfile(v),
    syncEnabled
  );

  const [enrolledStudents, setEnrolledStudents] = useSyncedState<EnrolledStudent[]>(
    "horizon_enrolled_students",
    seed(server?.enrolledStudents, "horizon_enrolled_students", initialEnrolledStudents),
    (v) => api.saveCollection("enrolledStudents", v),
    syncEnabled
  );

  const [accounts, setAccounts] = useSyncedState<TradingAccount[]>(
    "horizon_accounts",
    seed(server?.accounts, "horizon_accounts", initialTradingAccounts),
    (v) => api.saveCollection("accounts", v),
    syncEnabled
  );

  const [signals, setSignals] = useSyncedState<CoachSignal[]>(
    "horizon_signals",
    seed(server?.signals, "horizon_signals", initialCoachSignals),
    (v) => api.saveCollection("signals", v),
    syncEnabled
  );

  const [modules, setModules] = useSyncedState<Module[]>(
    "horizon_modules",
    seed(server?.modules, "horizon_modules", initialModules),
    (v) => api.saveCollection("modules", v),
    syncEnabled
  );

  const [trades, setTrades] = useSyncedState<Trade[]>(
    "horizon_trades",
    seed(server?.trades, "horizon_trades", initialTrades),
    (v) => api.saveCollection("trades", v),
    syncEnabled
  );

  const [messages, setMessages] = useSyncedState<CoachMessage[]>(
    "horizon_messages",
    seed(server?.messages, "horizon_messages", initialMessages),
    (v) => api.saveCollection("messages", v),
    syncEnabled
  );

  const [forumTopics, setForumTopics] = useSyncedState<ForumTopic[]>(
    "horizon_forum_topics",
    seed(server?.forumTopics, "horizon_forum_topics", initialForumTopics),
    (v) => api.saveCollection("forumTopics", v),
    syncEnabled
  );

  const [quizResults, setQuizResults] = useSyncedState<Record<string, ModuleQuizResult>>(
    "horizon_quiz_results",
    seed(initialState?.quizResults, "horizon_quiz_results", {}),
    (v) => api.saveQuizResults(v),
    syncEnabled
  );

  const [badges, setBadges] = useSyncedState<TraderBadge[]>(
    "horizon_badges",
    seed(server?.badges, "horizon_badges", initialTraderBadges),
    (v) => api.saveCollection("badges", v),
    syncEnabled
  );

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

  // Ébauche de trade poussée vers le Journal par le calculateur ou l'analyseur IA
  const [journalDraft, setJournalDraft] = useState<TradeDraft | null>(null);

  const [isPropFirmRulesOpen, setIsPropFirmRulesOpen] = useState<boolean>(false);
  const [isMindsetModalOpen, setIsMindsetModalOpen] = useState<boolean>(false);
  const [isSetupAnalyzerOpen, setIsSetupAnalyzerOpen] = useState<boolean>(false);

  // L'écriture dans localStorage est désormais assurée par usePersistentState.

  // Recalculate Student Capital from Trades PnL
  useEffect(() => {
    const totalPnL = trades.reduce((acc, t) => acc + t.pnl, 0);
    setStudent((prev) => ({
      ...prev,
      currentCapital: prev.startingCapital + totalPnL,
    }));
  }, [trades]);

  /**
   * Ferme la session : invalide le jeton côté serveur, oublie le cache local, et
   * ramène à l'écran de connexion.
   *
   * Le cache est effacé délibérément. Hors ligne, l'application démarre sur ce
   * cache sans pouvoir vérifier d'identité (voir README) : le laisser en place
   * après une déconnexion volontaire rendrait le verrou contournable sur la
   * machine.
   *
   * Note : `useSyncedState` regroupe ses écritures sur 400 ms. Une déconnexion
   * confirmée en moins de 400 ms perdrait la dernière modification — théorique
   * avec un `confirm()` bloquant, à revoir si on le remplace par une modale.
   */
  const handleLogout = async () => {
    // Hors ligne, le cache local est la SEULE copie des données : le vider
    // serait une perte sèche. On refuse plutôt que de détruire en silence.
    if (!syncEnabled) {
      alert(
        "Déconnexion impossible hors ligne : les modifications de cette session ne sont pas encore enregistrées sur le serveur. Reconnecte-toi au serveur avant de te déconnecter."
      );
      return;
    }

    let confirmed: boolean;
    try {
      confirmed = confirm(
        "Se déconnecter ? Tes données restent enregistrées sur le serveur. Le cache de cet appareil sera effacé."
      );
    } catch (err) {
      // Certains contextes (iframe sandboxée, extension bloquant les dialogues
      // natifs) font lever confirm() plutôt que renvoyer false. Sans ce
      // filet, le clic resterait sans aucun effet ni message.
      console.error("[propdesk] confirm() a levé une exception.", err);
      alert("La déconnexion n'a pas pu être confirmée. Réessaie, ou recharge la page.");
      return;
    }
    if (!confirmed) return;

    // Le `try/finally` garantit que l'écran de connexion s'affiche même si
    // `api.logout()` ou `localStorage.clear()` échoue de façon inattendue —
    // sans lui, une exception imprévue laisserait le bouton sans aucun effet
    // visible, ce qui est exactement le symptôme le plus trompeur possible.
    try {
      try {
        await api.logout();
      } catch (err) {
        // Serveur devenu injoignable : on nettoie quand même l'appareil. Le
        // pire cas est une session orpheline côté serveur, qui expirera seule.
        console.warn("[propdesk] Déconnexion serveur échouée.", err);
      }

      try {
        localStorage.clear();
      } catch {
        // Stockage indisponible : il n'y avait alors rien à oublier.
      }
    } finally {
      onLoggedOut();
    }
  };

  // Notifications Handlers
  const handleMarkNotificationAsRead = (id: string) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n))
    );
  };

  const handleMarkAllNotificationsAsRead = () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  };

  const handleClearAllNotifications = () => {
    setNotifications([]);
  };

  // Le centre d'alertes renvoie un targetTab en texte libre : on ne navigue
  // que si c'est un onglet réellement existant.
  //
  // « students » n'y figure que pour un administrateur : sans cela, une
  // notification suffirait à contourner le masquage de la vue de suivi.
  const handleNavigateFromNotification = (tab: string) => {
    const knownTabs: SidebarTabType[] = [
      "dashboard",
      "wallets",
      "academy",
      "journal",
      "simulator",
      "propfirm",
      "signals",
      "forum",
      "messaging",
      "analytics",
      "exam",
      ...(student.isAdmin ? (["students"] as SidebarTabType[]) : []),
    ];
    if (knownTabs.includes(tab as SidebarTabType)) {
      setActiveTab(tab as SidebarTabType);
    }
  };

  // Filet de sécurité : si le statut d'administrateur est révoqué pendant la
  // session, l'onglet de suivi des élèves ne doit pas rester affiché.
  useEffect(() => {
    if (activeTab === "students" && !student.isAdmin) setActiveTab("dashboard");
  }, [activeTab, student.isAdmin]);

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

  // Messages du coach pas encore marqués comme lus
  const totalUnreadMessages = messages.filter(
    (m) => m.sender === "coach" && m.status !== "read"
  ).length;

  return (
    <div className="min-h-screen bg-[#0B0F0E] text-slate-100 font-sans antialiased selection:bg-[#00E676] selection:text-slate-950 flex">
      {/* Left Sidebar Navigation */}
      <Sidebar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        student={student}
        courseCompletionPercentage={courseCompletionPercentage}
        totalUnreadMessages={totalUnreadMessages}
        mobileOpen={mobileOpen}
        setMobileOpen={setMobileOpen}
        isCollapsed={isCollapsed}
        setIsCollapsed={setIsCollapsed}
        onOpenProfileModal={() => {
          setProfileModalTab("profile");
          setIsProfileModalOpen(true);
        }}
        onLogout={handleLogout}
        onOpenChecklist={() => setIsChecklistOpen(true)}
        onOpenSetupAnalyzer={() => setIsSetupAnalyzerOpen(true)}
        onOpenPropFirmRules={() => setIsPropFirmRulesOpen(true)}
        onOpenMindset={() => setIsMindsetModalOpen(true)}
        onOpenCalendar={() => setIsCalendarOpen(true)}
        onToggleSidebarItem={(key) => {
          // Forme fonctionnelle obligatoire : deux bascules dans le même lot de
          // rendu liraient sinon le même `student`, et la seconde écraserait la
          // première.
          setStudent((prev) => {
            const hidden = prev.hiddenSidebarItems ?? [];
            return {
              ...prev,
              hiddenSidebarItems: hidden.includes(key)
                ? hidden.filter((k) => k !== key)
                : [...hidden, key],
            };
          });

          // Masquer le dernier accès à l'onglet courant en ferait un cul-de-sac.
          // Deux entrées pouvant mener au même onglet (« Replay » et « Sim
          // propfirm »), on ne bascule que si plus aucune n'y conduit.
          const hidden = student.hiddenSidebarItems ?? [];
          if (hidden.includes(key) || SIDEBAR_ITEM_TABS[key] !== activeTab) return;

          const stillReachable = SIDEBAR_TOGGLEABLE_KEYS.some(
            (k) =>
              k !== key &&
              !hidden.includes(k) &&
              SIDEBAR_ITEM_TABS[k] === activeTab
          );
          if (!stillReachable) setActiveTab("dashboard");
        }}
      />

      {/* Main Content Area (offset by sidebar width on large screens) */}
      <div className={`flex-1 flex flex-col min-w-0 transition-all duration-300 ${isCollapsed ? "lg:pl-20" : "lg:pl-64"}`}>
        {/* Top Header Bar */}
        <TopHeader
          activeTab={activeTab}
          student={student}
          setMobileOpen={setMobileOpen}
          onOpenProfileModal={() => {
            setProfileModalTab("profile");
            setIsProfileModalOpen(true);
          }}
          onOpenNotifications={() => setIsNotificationsModalOpen(true)}
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
              onOpenChecklist={() => setIsChecklistOpen(true)}
            />
          )}

          {/* Le masquage dans la sidebar ne suffit pas : cette vue expose les
              notes privées du coach, elle doit être gardée au rendu. Le serveur
              refuse par ailleurs l'écriture de cette collection à un non-admin. */}
          {activeTab === "students" &&
            (student.isAdmin ? (
              <StudentTracking
                students={enrolledStudents}
                onUpdateStudent={handleUpdateStudent}
                onAddStudent={handleAddStudent}
                onDeleteStudent={handleDeleteStudent}
              />
            ) : (
              <div className="space-y-6">
                <h1 className="text-2xl font-bold text-white">Suivi des Élèves</h1>
                <div className="bg-[#111615] border border-[#1B2320] rounded-2xl p-8 min-h-96 flex flex-col items-center justify-center gap-2 text-center">
                  <p className="text-slate-300 font-semibold">
                    Cette section est réservée au staff.
                  </p>
                  <p className="text-xs text-slate-500">
                    Contacte ton coach si tu penses devoir y accéder.
                  </p>
                </div>
              </div>
            ))}

          {activeTab === "wallets" && (
            <WalletManagement
              accounts={accounts}
              onAddAccount={handleAddAccount}
              onUpdateAccountBalance={handleUpdateAccountBalance}
            />
          )}

          {/* « Replay » et « Sim propfirm » partagent ce composant : la clé
              force le remontage pour que chacun s'ouvre sur sa vue. */}
          {(activeTab === "simulator" || activeTab === "propfirm") && (
            <SMCSimulator
              key={activeTab}
              scenarios={initialBacktestScenarios}
              initialMode={activeTab === "propfirm" ? "MONTE_CARLO" : "REPLAY"}
            />
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
              prefillDraft={journalDraft}
              onPrefillConsumed={() => setJournalDraft(null)}
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

          {activeTab === "exam" && (
            <div className="space-y-6">
              <h1 className="text-2xl font-bold text-white">Examen</h1>
              <div className="bg-[#111615] border border-[#1B2320] rounded-2xl p-8 min-h-96 flex items-center justify-center">
                <p className="text-slate-400">Contenu à venir</p>
              </div>
            </div>
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
        initialTab={profileModalTab}
        onOpenStaffAccounts={
          currentStaffId
            ? () => {
                setIsProfileModalOpen(false);
                setIsStaffAccountsOpen(true);
              }
            : undefined
        }
      />

      {/* Gestion des comptes staff — nécessite une identité vérifiée, absente
          hors ligne (aucune session à interroger sans serveur). */}
      {currentStaffId && (
        <StaffAccountsModal
          isOpen={isStaffAccountsOpen}
          onClose={() => setIsStaffAccountsOpen(false)}
          currentUserId={currentStaffId}
        />
      )}

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
        defaultCapital={student.currentCapital}
        onApplyToJournal={(calc) => {
          setJournalDraft({
            pair: calc.pair,
            entryPrice: calc.entryPrice,
            stopLoss: calc.stopLoss,
            takeProfit: calc.takeProfit,
            lotSize: calc.lotSize,
            notes: `Position dimensionnée avec le calculateur : risque ${calc.riskAmount.toFixed(
              2
            )} € pour un R:R de ${calc.riskRewardRatio}.`,
          });
          setIsCalculatorOpen(false);
          setActiveTab("journal");
        }}
      />

      {/* Trading Plan Checklist Modal */}
      <TradingPlanModal
        isOpen={isChecklistOpen}
        onClose={() => setIsChecklistOpen(false)}
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

      {/* Notifications Center Modal */}
      <NotificationModal
        isOpen={isNotificationsModalOpen}
        onClose={() => setIsNotificationsModalOpen(false)}
        notifications={notifications}
        onMarkAsRead={handleMarkNotificationAsRead}
        onMarkAllAsRead={handleMarkAllNotificationsAsRead}
        onClearAll={handleClearAllNotifications}
        onNavigateToTab={handleNavigateFromNotification}
      />

      {/* Setup & Confluence Matrix Modal */}
      <SetupAnalyzerModal
        isOpen={isSetupAnalyzerOpen}
        onClose={() => setIsSetupAnalyzerOpen(false)}
        onApplyToJournal={(setup) => {
          setJournalDraft({
            pair: setup.pair,
            direction: setup.direction,
            strategy: `Setup SMC ${setup.verdict} (${setup.score}/100)`,
            notes: setup.notes,
          });
          setIsSetupAnalyzerOpen(false);
          setActiveTab("journal");
        }}
      />
    </div>
  );
}

