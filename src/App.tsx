import React, { useState, useEffect } from "react";
import {
  Sidebar,
  TabType,
  SIDEBAR_TOGGLEABLE_KEYS,
  SIDEBAR_ITEM_TABS,
} from "./components/Sidebar";
import { TopHeader } from "./components/TopHeader";
import { MainDashboard } from "./components/MainDashboard";
import { PositionCalculatorModal } from "./components/PositionCalculatorModal";
import { TradingPlanModal } from "./components/TradingPlanModal";
import { MacroDashboard } from "./components/MacroDashboard";
import { UserProfileModal } from "./components/UserProfileModal";
import { PendingChangesBanner } from "./components/PendingChangesBanner";
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
import { isTabType, type TabType as SidebarTabType } from "./components/Sidebar";

/**
 * Vues d'onglet chargées à la demande.
 *
 * Une seule est affichée à la fois, mais toutes partaient dans le bundle
 * initial — ~4 500 lignes téléchargées pour en montrer une. Elles sont donc
 * découpées en fichiers séparés, récupérés au premier affichage de l'onglet
 * puis gardés en mémoire.
 *
 * `MainDashboard` reste en import direct, délibérément : c'est l'onglet
 * d'arrivée et le repli de tout onglet devenu inatteignable. Le différer
 * n'économiserait rien et ajouterait un écran d'attente au démarrage.
 *
 * Les modales ne sont pas traitées ici : elles sont montées en permanence et
 * pilotées par une prop `isOpen`, si bien qu'un `lazy` les chargerait
 * immédiatement. Les rendre conditionnelles changerait leur cycle de vie —
 * leur état interne serait remis à zéro à chaque ouverture.
 *
 * Le `.then()` convertit l'export nommé en export par défaut, seule forme que
 * `React.lazy` accepte.
 */
const VideoAcademy = React.lazy(() =>
  import("./components/VideoAcademy").then((m) => ({ default: m.VideoAcademy }))
);
const TradingJournal = React.lazy(() =>
  import("./components/TradingJournal").then((m) => ({ default: m.TradingJournal }))
);
const ForumSection = React.lazy(() =>
  import("./components/ForumSection").then((m) => ({ default: m.ForumSection }))
);
const CoachMessaging = React.lazy(() =>
  import("./components/CoachMessaging").then((m) => ({ default: m.CoachMessaging }))
);
const PerformanceDashboard = React.lazy(() =>
  import("./components/PerformanceDashboard").then((m) => ({
    default: m.PerformanceDashboard,
  }))
);
const WalletManagement = React.lazy(() =>
  import("./components/WalletManagement").then((m) => ({ default: m.WalletManagement }))
);
const SMCSimulator = React.lazy(() =>
  import("./components/SMCSimulator").then((m) => ({ default: m.SMCSimulator }))
);
const CoachSignals = React.lazy(() =>
  import("./components/CoachSignals").then((m) => ({ default: m.CoachSignals }))
);
const StudentTracking = React.lazy(() =>
  import("./components/StudentTracking").then((m) => ({ default: m.StudentTracking }))
);

/**
 * Attente d'une vue en cours de chargement.
 *
 * Discrète et sans hauteur imposée : sur une connexion correcte le fichier
 * arrive en quelques dizaines de millisecondes, un grand écran de chargement
 * produirait un clignotement plus gênant que l'attente elle-même.
 */
function ViewFallback() {
  return (
    <div className="flex items-center justify-center py-20">
      <p className="text-xs font-mono text-slate-600 animate-pulse">Chargement…</p>
    </div>
  );
}
import { formatCurrency } from "./lib/format";
import { usePersistentState } from "./hooks/usePersistentState";
import { useBootstrap, useSyncedState, useStudentBootstrap } from "./hooks/useServerSync";
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
  const {
    status,
    user,
    studentUser,
    expired,
    login,
    setup,
    changePassword,
    studentLogin,
    studentChangePassword,
    markLoggedOut,
    refresh,
  } = useAuth();

  // Au premier chargement, personne ne sait encore si la personne devant
  // l'écran est du staff ou un élève — un seul écran de connexion couvre les
  // deux mondes, avec un lien pour basculer entre les deux formulaires.
  const [loginMode, setLoginMode] = useState<"staff" | "student">("staff");

  if (status === "loading") {
    return <LoadingScreen message="Vérification de ta session…" />;
  }

  if (status === "no-account") {
    return <SetupScreen onSetup={setup} onRefresh={() => void refresh()} />;
  }

  if (status === "unauthenticated") {
    if (loginMode === "student") {
      return (
        <LoginScreen
          onLogin={studentLogin}
          expired={expired}
          title="Connexion élève"
          subtitle="Accède à ton Journal de trading."
          footer={
            <button
              type="button"
              onClick={() => setLoginMode("staff")}
              className="text-slate-400 hover:text-[#00E676] underline underline-offset-2"
            >
              Tu es coach ou staff ? Connecte-toi ici.
            </button>
          }
        />
      );
    }

    return (
      <LoginScreen
        onLogin={login}
        expired={expired}
        footer={
          <>
            Mot de passe oublié ? La procédure de secours est décrite dans le README.
            <br />
            <button
              type="button"
              onClick={() => setLoginMode("student")}
              className="text-slate-400 hover:text-[#00E676] underline underline-offset-2"
            >
              Tu es élève ? Connecte-toi ici.
            </button>
          </>
        }
      />
    );
  }

  // Un mot de passe temporaire (compte invité) bloque l'accès à l'application
  // jusqu'à son remplacement — la session est valide, seul le mot de passe ne
  // l'est plus. Le serveur refuse par ailleurs toute autre route tant que
  // cette étape n'est pas franchie (filet de sécurité, voir requireAuth).
  if (status === "authenticated" && user?.mustChangePassword) {
    return <ChangePasswordScreen onChangePassword={changePassword} />;
  }
  if (status === "authenticated-student" && studentUser?.mustChangePassword) {
    return <ChangePasswordScreen onChangePassword={studentChangePassword} />;
  }

  // Session élève : jamais `AuthenticatedApp`/`AcademyApp` (le bureau staff),
  // toujours ce composant dédié et minimal — voir §Contexte du plan élève.
  if (status === "authenticated-student") {
    return <StudentAuthenticatedApp onLoggedOut={markLoggedOut} />;
  }

  // `authenticated` et `offline` mènent tous deux à l'application. Hors ligne,
  // aucune vérification n'est possible : on démarre sur le cache local, comme
  // avant l'authentification. C'est un choix assumé — le verrou n'est donc pas
  // une barrière d'accès aux données déjà présentes sur la machine (voir README).
  // `isOwner` est faux hors ligne : sans serveur, aucune identité n'est
  // vérifiable, et le réglage des modules visibles ne pourrait de toute façon
  // pas être poussé. Le fondateur retrouve la main dès qu'il est reconnecté.
  return (
    <AuthenticatedApp
      onLoggedOut={markLoggedOut}
      currentStaffId={user?.id ?? null}
      isOwner={user?.isOwner === true}
    />
  );
}

/**
 * Espace personnel d'un élève — jamais `AcademyApp` (le bureau staff). Un
 * élève ne voit et ne modifie que ses propres données : son Journal, sa
 * copie personnelle du programme de formation, son fil de messagerie avec
 * le coach, et les outils sans donnée propre à un élève (Audit Setup, Prop
 * Firm, Mindset). Ni Portefeuille/Rentabilité/Macro ni Suivi des Élèves :
 * hors périmètre de l'accès élève.
 */
function StudentAuthenticatedApp({ onLoggedOut }: { onLoggedOut: () => void }) {
  const { status, trades, accounts, modules, messages, quizResults, student } = useStudentBootstrap();
  const syncEnabled = status === "online";

  const [syncedTrades, setSyncedTrades] = useSyncedState<Trade[]>(
    "horizon_student_trades",
    trades,
    (v) => api.saveCollection("trades", v),
    syncEnabled
  );
  const [syncedAccounts, setSyncedAccounts] = useSyncedState<TradingAccount[]>(
    "horizon_student_accounts",
    accounts,
    (v) => api.saveCollection("accounts", v),
    syncEnabled
  );
  const [syncedModules, setSyncedModules] = useSyncedState<Module[]>(
    "horizon_student_modules",
    modules,
    (v) => api.saveCollection("modules", v),
    syncEnabled
  );
  const [syncedMessages, setSyncedMessages] = useSyncedState<CoachMessage[]>(
    "horizon_student_messages",
    messages,
    (v) => api.saveCollection("messages", v),
    syncEnabled
  );
  const [syncedQuizResults, setSyncedQuizResults] = useSyncedState<Record<string, ModuleQuizResult>>(
    "horizon_student_quiz_results",
    quizResults,
    (v) => api.saveQuizResults(v),
    syncEnabled
  );

  // `useSyncedState` initialise sa valeur une seule fois, au montage — tant
  // que le chargement serveur n'est pas revenu, on affiche un état vide plutôt
  // que la valeur par défaut figée avant que les données ne soient connues.
  useEffect(() => {
    if (status !== "online") return;
    setSyncedTrades(trades);
    setSyncedAccounts(accounts);
    setSyncedModules(modules);
    setSyncedMessages(messages);
    setSyncedQuizResults(quizResults);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  const [activeTab, setActiveTab] = useState<TabType>("journal");
  const [mobileOpen, setMobileOpen] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isSetupAnalyzerOpen, setIsSetupAnalyzerOpen] = useState(false);
  const [isPropFirmRulesOpen, setIsPropFirmRulesOpen] = useState(false);
  const [isMindsetModalOpen, setIsMindsetModalOpen] = useState(false);
  const [isChecklistOpen, setIsChecklistOpen] = useState(false);
  const [prefilledLessonTitle, setPrefilledLessonTitle] = useState<string | undefined>();

  const handleAddTrade = (newTrade: Omit<Trade, "id">) => {
    const tradeWithId: Trade = { ...newTrade, id: `trd-${Date.now()}` };
    setSyncedTrades((prev) => [tradeWithId, ...prev]);
  };

  const handleUpdateTrade = (updated: Trade) => {
    setSyncedTrades((prev) => prev.map((t) => (t.id === updated.id ? updated : t)));
  };

  const handleDeleteTrade = (id: string) => {
    setSyncedTrades((prev) => prev.filter((t) => t.id !== id));
  };

  const handleAddAccount = (account: TradingAccount) => {
    setSyncedAccounts((prev) => [account, ...prev]);
  };

  const handleUpdateAccountBalance = (id: string, newBalance: number) => {
    setSyncedAccounts((prev) =>
      prev.map((acc) =>
        acc.id === id ? { ...acc, equity: newBalance, currentBalance: newBalance } : acc
      )
    );
  };

  const handleToggleLessonCompletion = (moduleId: string, lessonId: string) => {
    setSyncedModules((prev) =>
      prev.map((mod) =>
        mod.id === moduleId
          ? {
              ...mod,
              lessons: mod.lessons.map((l) =>
                l.id === lessonId ? { ...l, isCompleted: !l.isCompleted } : l
              ),
            }
          : mod
      )
    );
  };

  const handleSaveModuleQuizResult = (moduleId: string, result: ModuleQuizResult) => {
    setSyncedQuizResults((prev) => ({ ...prev, [moduleId]: result }));
  };

  const handleAskCoachAboutLesson = (lessonTitle: string) => {
    setPrefilledLessonTitle(lessonTitle);
    setActiveTab("messaging");
  };

  /**
   * Enregistre un message envoyé au coach. Aucune réponse automatique : le
   * message attend une réponse humaine, que le coach poste depuis la Vue
   * Complète de sa fiche (`AdminStudentView.tsx`), dans ce même fil.
   */
  const handleSendMessage = async (
    coachId: string,
    text: string,
    attachedTradeId?: string,
    attachedModuleTitle?: string
  ) => {
    const studentMsg: CoachMessage = {
      id: `msg-${Date.now()}`,
      sender: "student",
      coachId,
      text,
      timestamp: new Date().toISOString(),
      attachedTradeId,
      attachedModuleTitle,
      status: "sent",
    };
    setSyncedMessages((prev) => [...prev, studentMsg]);
  };

  const totalLessons = syncedModules.reduce((acc, m) => acc + m.lessons.length, 0);
  const completedLessons = syncedModules.reduce(
    (acc, m) => acc + m.lessons.filter((l) => l.isCompleted).length,
    0
  );
  const courseCompletionPercentage =
    totalLessons > 0 ? Math.round((completedLessons / totalLessons) * 100) : 0;
  const totalUnreadMessages = syncedMessages.filter(
    (m) => m.sender === "coach" && m.status !== "read"
  ).length;

  const handleLogout = async () => {
    try {
      await api.studentLogout();
    } finally {
      onLoggedOut();
    }
  };

  if (status === "loading" || !student) {
    return <LoadingScreen message="Chargement de ton espace…" />;
  }

  // `hiddenSidebarItems` vient déjà fusionné par le serveur (voir
  // `buildStudentProfile` dans `server/routes.ts`) : les entrées sans écran
  // élève restent masquées quoi qu'il arrive, le reste (Module vidéo,
  // Messagerie, Outils, Macro) suit le réglage de visibilité du fondateur —
  // pas de liste figée ici, sous peine de rendre ce réglage sans effet côté
  // élève.
  const studentProfile: StudentProfile = {
    ...student,
    isAdmin: false,
  };

  return (
    <div className="min-h-screen bg-[#0B0F0E] text-slate-100 font-sans antialiased flex">
      <Sidebar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        student={studentProfile}
        courseCompletionPercentage={courseCompletionPercentage}
        totalUnreadMessages={totalUnreadMessages}
        mobileOpen={mobileOpen}
        setMobileOpen={setMobileOpen}
        isCollapsed={isCollapsed}
        setIsCollapsed={setIsCollapsed}
        onOpenProfileModal={() => {}}
        onLogout={handleLogout}
        onOpenChecklist={() => setIsChecklistOpen(true)}
        onOpenSetupAnalyzer={() => setIsSetupAnalyzerOpen(true)}
        onOpenPropFirmRules={() => setIsPropFirmRulesOpen(true)}
        onOpenMindset={() => setIsMindsetModalOpen(true)}
        canManageSidebar={false}
      />

      <div className={`flex-1 flex flex-col min-w-0 transition-all duration-300 ${isCollapsed ? "lg:pl-20" : "lg:pl-64"}`}>
        <TopHeader activeTab={activeTab} student={studentProfile} setMobileOpen={setMobileOpen} />

        <main className="p-4 sm:p-8 flex-1 max-w-7xl w-full mx-auto">
          <React.Suspense fallback={<ViewFallback />}>
            {activeTab === "dashboard" && (
              <MainDashboard
                student={studentProfile}
                trades={syncedTrades}
                modules={syncedModules}
                forumTopics={[]}
                messages={syncedMessages}
                courseCompletionPercentage={courseCompletionPercentage}
                setActiveTab={setActiveTab}
              />
            )}

            {activeTab === "journal" && (
              <TradingJournal
                trades={syncedTrades}
                accounts={syncedAccounts}
                onAddTrade={handleAddTrade}
                onUpdateTrade={handleUpdateTrade}
                onDeleteTrade={handleDeleteTrade}
                onSendTradeToCoach={() => undefined}
                hideAiAndCoachActions
              />
            )}

            {activeTab === "wallets" && (
              <WalletManagement
                accounts={syncedAccounts}
                trades={syncedTrades}
                onAddAccount={handleAddAccount}
                onUpdateAccountBalance={handleUpdateAccountBalance}
              />
            )}

            {activeTab === "analytics" && (
              <PerformanceDashboard
                student={studentProfile}
                trades={syncedTrades}
                courseCompletionPercentage={courseCompletionPercentage}
              />
            )}

            {activeTab === "macro" && <MacroDashboard />}

            {/* « Replay » et « Sim propfirm » partagent ce composant, comme côté
                staff : la clé force le remontage pour que chacun s'ouvre sur sa
                vue. Aucune donnée propre à l'élève requise (scénarios statiques). */}
            {(activeTab === "simulator" || activeTab === "propfirm") && (
              <SMCSimulator
                key={activeTab}
                scenarios={initialBacktestScenarios}
                initialMode={activeTab === "propfirm" ? "MONTE_CARLO" : "REPLAY"}
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

            {activeTab === "academy" && (
              <VideoAcademy
                modules={syncedModules}
                quizResults={syncedQuizResults}
                onToggleLessonCompletion={handleToggleLessonCompletion}
                onAskCoachAboutLesson={handleAskCoachAboutLesson}
                onSaveModuleQuizResult={handleSaveModuleQuizResult}
              />
            )}

            {activeTab === "messaging" && (
              <CoachMessaging
                coaches={initialCoaches}
                messages={syncedMessages}
                student={studentProfile}
                trades={syncedTrades}
                onSendMessage={handleSendMessage}
                prefilledLessonTitle={prefilledLessonTitle}
              />
            )}
          </React.Suspense>
        </main>
      </div>

      <SetupAnalyzerModal isOpen={isSetupAnalyzerOpen} onClose={() => setIsSetupAnalyzerOpen(false)} />
      <PropFirmRulesModal
        isOpen={isPropFirmRulesOpen}
        onClose={() => setIsPropFirmRulesOpen(false)}
        student={studentProfile}
      />
      <MindsetJournalModal isOpen={isMindsetModalOpen} onClose={() => setIsMindsetModalOpen(false)} />
      <TradingPlanModal isOpen={isChecklistOpen} onClose={() => setIsChecklistOpen(false)} />
    </div>
  );
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
  isOwner,
}: {
  onLoggedOut: () => void;
  currentStaffId: string | null;
  isOwner: boolean;
}) {
  const { status, state, pending, discardPending, acknowledgePending } = useBootstrap();

  if (status === "loading") {
    return <LoadingScreen message="Chargement de ton espace PropDesk…" />;
  }

  return (
    <AcademyApp
      initialState={state}
      syncEnabled={status === "online"}
      onLoggedOut={onLoggedOut}
      currentStaffId={currentStaffId}
      isOwner={isOwner}
      pending={pending}
      onDiscardPending={discardPending}
      onReplayedPending={acknowledgePending}
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
  /**
   * Vrai pour le seul compte fondateur. Ne conditionne que le réglage des
   * modules visibles : un coach garde tous les autres droits.
   */
  isOwner: boolean;
  /**
   * Clés modifiées hors ligne et jamais envoyées. Vide dans le cas normal.
   * Voir `src/lib/pendingChanges.ts`.
   */
  pending: string[];
  onDiscardPending: () => void;
  onReplayedPending: () => void;
}

function AcademyApp({
  initialState,
  syncEnabled,
  onLoggedOut,
  currentStaffId,
  isOwner,
  pending,
  onDiscardPending,
  onReplayedPending,
}: AcademyAppProps) {
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

  // Pre-filled Messaging Navigation state
  const [prefilledLessonTitle, setPrefilledLessonTitle] = useState<
    string | undefined
  >(undefined);
  const [prefilledTradeId, setPrefilledTradeId] = useState<string | undefined>(
    undefined
  );

  // Ébauche de trade poussée vers le Journal par le calculateur ou l'analyseur de setup
  const [journalDraft, setJournalDraft] = useState<TradeDraft | null>(null);

  const [isPropFirmRulesOpen, setIsPropFirmRulesOpen] = useState<boolean>(false);
  const [isMindsetModalOpen, setIsMindsetModalOpen] = useState<boolean>(false);
  const [isSetupAnalyzerOpen, setIsSetupAnalyzerOpen] = useState<boolean>(false);

  // L'écriture dans localStorage est désormais assurée par usePersistentState.

  // Le capital courant est dérivé du PnL cumulé du journal.
  //
  // Renvoyer `prev` **à l'identique** quand la valeur ne bouge pas n'est pas
  // une micro-optimisation : cet effet s'exécute à chaque montage, et un
  // nouvel objet à chaque fois — même porteur de la même valeur — suffisait à
  // faire croire au reste de l'application que le profil venait d'être
  // modifié. En ligne cela déclenchait un `PUT /api/profile` inutile à chaque
  // démarrage ; hors ligne cela marquait le profil comme « en attente », et le
  // bandeau de reconnexion annonçait des modifications qui n'existaient pas.
  // Un bandeau qui crie au loup à chaque fois n'est plus lu.
  useEffect(() => {
    // Un trade saisi en % n'est pas une somme d'argent : l'exclure du capital
    // recalculé, sous peine de mélanger deux unités hétérogènes.
    const totalPnL = trades
      .filter((t) => (t.pnlUnit ?? "USD") !== "PERCENT")
      .reduce((acc, t) => acc + t.pnl, 0);
    setStudent((prev) => {
      const capital = prev.startingCapital + totalPnL;
      return prev.currentCapital === capital ? prev : { ...prev, currentCapital: capital };
    });
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
  // La liste vit dans `ALL_TABS` (Sidebar.tsx), dont `TabType` dérive : un
  // onglet ajouté là devient navigable ici sans intervention. Elle était
  // auparavant recopiée à la main, ce qui rendait tout nouvel onglet
  // silencieusement inatteignable depuis une notification.
  //
  // Exister et être accessible sont deux questions distinctes : « students »
  // reste réservé à l'administrateur, sans quoi une notification suffirait à
  // contourner le masquage de la vue de suivi.
  const handleNavigateFromNotification = (tab: string) => {
    if (!isTabType(tab)) return;
    if (tab === "students" && !student.isAdmin) return;
    setActiveTab(tab);
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

  const handleUpdateTrade = (updated: Trade) => {
    setTrades((prev) => prev.map((t) => (t.id === updated.id ? updated : t)));
  };

  const handleDeleteTrade = (id: string) => {
    setTrades((prev) => prev.filter((t) => t.id !== id));
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

  /**
   * Enregistre un message envoyé à un coach.
   *
   * Aucune réponse automatique n'est générée : le message attend une réponse
   * humaine du coach, comme n'importe quelle messagerie. Il n'existait avant
   * cette suppression aucune vraie réponse humaine — seule une réponse
   * générée par IA simulait un coach qui répondait instantanément.
   */
  const handleSendMessage = async (
    coachId: string,
    text: string,
    attachedTradeId?: string,
    attachedModuleTitle?: string
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
        canManageSidebar={isOwner}
        onToggleSidebarItem={(key) => {
          // Garde de sûreté, en plus du masquage de l'interface : la sidebar
          // n'appelle déjà pas ce rappel pour un coach. Le serveur reste
          // l'autorité — il réinjecte la valeur en base sur `PUT /api/profile`
          // — mais sans cette ligne un coach verrait le masquage s'appliquer à
          // l'écran avant d'être silencieusement annulé au rechargement.
          if (!isOwner) return;

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
        {/* Modifications hors ligne en attente d'arbitrage. Placé au-dessus de
            l'en-tête, avant tout contenu : c'est une décision à prendre avant
            de continuer à travailler, pas une notification de plus. */}
        <PendingChangesBanner
          pending={pending}
          onDiscard={onDiscardPending}
          onReplayed={onReplayedPending}
        />

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
        {/* Une seule frontière Suspense pour toutes les vues : elles
            s'excluent mutuellement, il n'en charge jamais deux à la fois. La
            placer à l'intérieur de <main> conserve la mise en page et le
            gabarit pendant l'attente — au-dessus, la page entière sauterait. */}
        <main className="p-4 sm:p-8 flex-1 max-w-7xl w-full mx-auto">
          <React.Suspense fallback={<ViewFallback />}>
          {activeTab === "dashboard" && (
            <MainDashboard
              student={student}
              trades={trades}
              modules={modules}
              forumTopics={forumTopics}
              messages={messages}
              courseCompletionPercentage={courseCompletionPercentage}
              setActiveTab={setActiveTab}
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
              trades={trades}
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
              accounts={accounts}
              onAddTrade={handleAddTrade}
              onUpdateTrade={handleUpdateTrade}
              onDeleteTrade={handleDeleteTrade}
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

          {activeTab === "macro" && <MacroDashboard />}
          </React.Suspense>
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
            notes: `Position dimensionnée avec le calculateur : risque ${formatCurrency(
              calc.riskAmount
            )} pour un R:R de ${calc.riskRewardRatio}.`,
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

