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
import { MacroDashboard } from "./components/MacroDashboard";
import { UserProfileModal } from "./components/UserProfileModal";
import { PendingChangesBanner } from "./components/PendingChangesBanner";
import { StaffAccountsModal } from "./components/StaffAccountsModal";
import { SecurityLogModal } from "./components/SecurityLogModal";
import { NotificationModal } from "./components/NotificationModal";
import { MindsetJournalModal } from "./components/MindsetJournalModal";
import { TradingPlanEditorModal } from "./components/TradingPlanEditorModal";
import { LegalNoticeModal } from "./components/LegalNoticeModal";
import { CGUModal } from "./components/CGUModal";
import { PRIVACY_POLICY_URL } from "./lib/links";
import { SyncErrorBanner } from "./components/SyncErrorBanner";
import { ConfirmDialogHost, confirmDialog } from "./lib/confirmDialog";
import { loadTradingPlan, checkPlanViolations, upsertPlanAlert, getTradingPlanStorageKey, EMPTY_TRADING_PLANS, normalizeTradingPlans, renameSetupInPlans } from "./lib/planCompliance";
import { upsertWalletRiskAlerts } from "./lib/walletAlerts";
import { computeBadgeProgress } from "./lib/badges";
import { listPending, describePending } from "./lib/pendingChanges";

import {
  initialStudentProfile,
  initialModules,
  initialTrades,
  initialMessages,
  initialTradingAccounts,
  initialTraderBadges,
  initialEnrolledStudents,
  initialNotifications,
  initialSetups,
} from "./data/mockData";
import {
  Module,
  Lesson,
  Trade,
  CoachMessage,
  StudentProfile,
  ModuleQuizResult,
  TradingAccount,
  EnrolledStudent,
  AppNotification,
  TraderBadge,
  TradeDraft,
  Coach,
  FOUNDER_COACH_ID,
  TradingPlanData,
  Setup,
  Announcement,
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
const Announcements = React.lazy(() =>
  import("./components/Announcements").then((m) => ({ default: m.Announcements }))
);
const TradingJournal = React.lazy(() =>
  import("./components/TradingJournal").then((m) => ({ default: m.TradingJournal }))
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
const StudentTracking = React.lazy(() =>
  import("./components/StudentTracking").then((m) => ({ default: m.StudentTracking }))
);
const SetupManagement = React.lazy(() =>
  import("./components/SetupManagement").then((m) => ({ default: m.SetupManagement }))
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
import { formatCurrency, notificationTimestamp } from "./lib/format";
import { syncAccountsWithTrades, computeRealizedPnl } from "./lib/walletStats";
import { usePersistentState } from "./hooks/usePersistentState";
import { useBootstrap, useSyncedState, useStudentBootstrap } from "./hooks/useServerSync";
import { useNotificationSound } from "./hooks/useNotificationSound";
import { useAuth } from "./hooks/useAuth";
import { LoginScreen } from "./components/auth/LoginScreen";
import { TwoFactorVerifyScreen } from "./components/auth/TwoFactorVerifyScreen";
import { SetupScreen } from "./components/auth/SetupScreen";
import { ChangePasswordScreen } from "./components/auth/ChangePasswordScreen";
import { ResetPasswordScreen } from "./components/auth/ResetPasswordScreen";
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
    verifyTwoFactor,
    verifyTwoFactorRecovery,
    cancelTwoFactor,
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

  /**
   * Lien de réinitialisation de mot de passe élève (`/reset-password#token=…`,
   * généré par le staff depuis une fiche — `StudentTracking.tsx`). Vérifié
   * AVANT tout état d'authentification : ce lien doit fonctionner pour un
   * élève qui n'a justement plus accès à son compte, staff ou pas. Pas de
   * routeur dans cette app (voir HANDOFF) — un simple test sur
   * `window.location`, lu une seule fois au montage : l'URL ne change pas
   * pendant la vie de cet écran.
   *
   * Jeton en FRAGMENT (`#token=…`), pas en `?token=…` : un fragment n'est
   * jamais envoyé au serveur dans aucune requête HTTP (ni la navigation
   * initiale, ni un éventuel proxy/CDN en amont) — contrairement à une query
   * string, qui peut finir dans des logs d'infra hors du contrôle de cette
   * app. Trouvé en audit de sécurité (risque déjà atténué côté client par le
   * `replaceState` ci-dessous, mais fermé ici à la source).
   */
  const [resetToken] = useState<string | null>(() => {
    if (window.location.pathname !== "/reset-password") return null;
    const token = new URLSearchParams(window.location.hash.replace(/^#/, "")).get("token");
    // Retire le jeton de la barre d'adresse (et donc de l'historique local du
    // navigateur) dès qu'il est lu — `replaceState` modifie l'entrée
    // courante en place, sans en créer une nouvelle. Trouvé en audit de
    // sécurité : un jeton de reset de mot de passe (usage unique, TTL 1h,
    // donc impact limité) n'avait sinon aucune raison de rester lisible dans
    // l'historique après consommation, notamment sur un appareil dont
    // l'historique est synchronisé entre plusieurs machines.
    if (token) window.history.replaceState(null, "", "/reset-password");
    return token;
  });

  if (resetToken) {
    return (
      <ResetPasswordScreen
        token={resetToken}
        onDone={() => {
          window.location.href = "/";
        }}
      />
    );
  }

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

  if (status === "2fa-required") {
    return (
      <TwoFactorVerifyScreen
        onVerifyCode={verifyTwoFactor}
        onVerifyRecoveryCode={verifyTwoFactorRecovery}
        onCancel={cancelTwoFactor}
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
 * Résout la valeur à charger pour une collection élève au retour du fetch
 * serveur : si cette clé a une modification non envoyée en attente
 * (`listPending`, voir src/lib/pendingChanges.ts), le cache local prime sur
 * la réponse serveur — sinon une sauvegarde échouée pendant la session
 * précédente serait silencieusement écrasée dès ce chargement, exactement
 * le trou que `markPending` dans `useSyncedState` est censé combler.
 */
function resolveStudentValue<T>(serverValue: T, localKey: string): T {
  if (!listPending().includes(localKey)) return serverValue;
  try {
    const cached = localStorage.getItem(localKey);
    if (cached !== null) return JSON.parse(cached) as T;
  } catch {
    // Cache illisible : on retombe sur le serveur.
  }
  return serverValue;
}

/**
 * Espace personnel d'un élève — jamais `AcademyApp` (le bureau staff). Un
 * élève ne voit et ne modifie que ses propres données : son Journal, sa
 * copie personnelle du programme de formation, son fil de messagerie avec
 * le coach, et les outils sans donnée propre à un élève (Prop Firm,
 * Mindset). Ni Portefeuille/Rentabilité/Macro ni Suivi des Élèves : hors
 * périmètre de l'accès élève.
 */
function StudentAuthenticatedApp({ onLoggedOut }: { onLoggedOut: () => void }) {
  const { status, trades, accounts, modules, messages, badges, setups, notifications, quizResults, student, setStudent, coaches, tradingPlan, announcements } = useStudentBootstrap();
  const syncEnabled = status === "online";

  // Bandeau d'avertissement immédiat quand une sauvegarde échoue en
  // arrière-plan alors que l'app se croit en ligne — la donnée elle-même est
  // protégée par `markPending` dans `useSyncedState`, ce bandeau n'est qu'un
  // signal visible pendant la session en cours.
  const [syncErrorMessage, setSyncErrorMessage] = useState<string | null>(null);
  const reportSyncError = React.useCallback(
    (message?: string) => setSyncErrorMessage(message || "Vérifie ta connexion et réessaie."),
    []
  );

  const [syncedTrades, setSyncedTrades, markTradesLoaded] = useSyncedState<Trade[]>(
    "horizon_student_trades",
    trades,
    (v) => api.saveCollection("trades", v),
    syncEnabled,
    reportSyncError
  );
  const [syncedAccounts, setSyncedAccounts, markAccountsLoaded] = useSyncedState<TradingAccount[]>(
    "horizon_student_accounts",
    accounts,
    (v) => api.saveCollection("accounts", v),
    syncEnabled,
    reportSyncError
  );
  const [syncedModules, setSyncedModules, markModulesLoaded] = useSyncedState<Module[]>(
    "horizon_student_modules",
    modules,
    (v) => api.saveCollection("modules", v),
    syncEnabled,
    reportSyncError
  );
  const [syncedMessages, setSyncedMessages, markMessagesLoaded] = useSyncedState<CoachMessage[]>(
    "horizon_student_messages",
    messages,
    (v) => api.saveCollection("messages", v),
    syncEnabled,
    reportSyncError
  );
  const [syncedBadges, setSyncedBadges, markBadgesLoaded] = useSyncedState<TraderBadge[]>(
    "horizon_student_badges",
    badges,
    (v) => api.saveCollection("badges", v),
    syncEnabled,
    reportSyncError
  );
  const [syncedQuizResults, setSyncedQuizResults, markQuizResultsLoaded] = useSyncedState<Record<string, ModuleQuizResult>>(
    "horizon_student_quiz_results",
    quizResults,
    (v) => api.saveQuizResults(v),
    syncEnabled,
    reportSyncError
  );
  /** Stratégies de trading définies par l'élève (module Setups) — voir `Setup` dans `src/types.ts`. */
  const [syncedSetups, setSyncedSetups, markSetupsLoaded] = useSyncedState<Setup[]>(
    "horizon_student_setups",
    setups,
    (v) => api.saveCollection("setups", v),
    syncEnabled,
    reportSyncError
  );
  /**
   * Collection réelle, ajoutée pour porter les alertes de non-respect du
   * plan de trading (voir `src/lib/planCompliance.ts`) — avant, un élève
   * n'avait aucune notification persistée, seulement des notifications
   * DÉRIVÉES des messages/badges (voir `messageNotifications`/
   * `badgeNotifications` plus bas), sans mécanisme pour en pousser une
   * arbitraire. `"notifications"` a été ajoutée à
   * `STUDENT_ALLOWED_COLLECTIONS` côté serveur pour permettre ceci.
   */
  const [syncedNotifications, setSyncedNotifications, markNotificationsLoaded] = useSyncedState<AppNotification[]>(
    "horizon_student_notifications",
    notifications,
    (v) => api.saveCollection("notifications", v),
    syncEnabled,
    reportSyncError
  );
  // `ready` seulement une fois `status === "online"` : avant ça,
  // `syncedNotifications` porte encore sa valeur de départ, remplacée par
  // les vraies données serveur juste après (voir l'effet `[status]` plus
  // bas) — sans ce garde-fou, ce remplacement se lirait comme un déluge de
  // "nouvelles" notifications à l'ouverture et ferait sonner l'alerte.
  useNotificationSound(syncedNotifications, status === "online");
  /**
   * Plan de trading — même clé de cache que `TradingPlanEditorModal`/
   * `planCompliance.ts` (namespacée par email, voir `getTradingPlanStorageKey`)
   * pour que `applyPlanCompliance` (qui relit ce cache directement, plus bas)
   * voie toujours la même valeur que celle réellement synchronisée au
   * serveur. `EMPTY_TRADING_PLANS` en solde par défaut : un élève qui n'a
   * jamais enregistré de plan démarre avec une liste vide, pas une erreur.
   * `normalizeTradingPlans` absorbe les anciennes valeurs enregistrées avant
   * le multi-plan (objet unique plutôt que tableau) — voir son commentaire.
   */
  const [syncedTradingPlan, setSyncedTradingPlan, markTradingPlanLoaded] = useSyncedState<TradingPlanData>(
    getTradingPlanStorageKey(student?.email),
    normalizeTradingPlans(tradingPlan) ?? EMPTY_TRADING_PLANS,
    (v) => api.saveTradingPlan(v),
    syncEnabled,
    reportSyncError
  );

  // `useSyncedState` initialise sa valeur une seule fois, au montage — tant
  // que le chargement serveur n'est pas revenu, on affiche un état vide plutôt
  // que la valeur par défaut figée avant que les données ne soient connues.
  useEffect(() => {
    if (status !== "online") return;
    markTradesLoaded(resolveStudentValue(trades, "horizon_student_trades"));
    markAccountsLoaded(resolveStudentValue(accounts, "horizon_student_accounts"));
    markModulesLoaded(resolveStudentValue(modules, "horizon_student_modules"));
    markMessagesLoaded(resolveStudentValue(messages, "horizon_student_messages"));
    markBadgesLoaded(resolveStudentValue(badges, "horizon_student_badges"));
    markNotificationsLoaded(resolveStudentValue(notifications, "horizon_student_notifications"));
    markQuizResultsLoaded(resolveStudentValue(quizResults, "horizon_student_quiz_results"));
    markSetupsLoaded(resolveStudentValue(setups, "horizon_student_setups"));
    markTradingPlanLoaded(
      normalizeTradingPlans(
        resolveStudentValue(tradingPlan ?? EMPTY_TRADING_PLANS, getTradingPlanStorageKey(student?.email))
      )
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  // Solde de chaque portefeuille recalculé depuis les trades qui lui sont
  // rattachés à chaque saisie/modification/suppression — voir
  // `syncAccountsWithTrades`.
  useEffect(() => {
    setSyncedAccounts((prev) => syncAccountsWithTrades(prev, syncedTrades));
  }, [syncedTrades]);

  // Progression recalculée en direct depuis les vraies données — jamais
  // persistée telle quelle, voir `src/lib/badges.ts`.
  const liveBadges = computeBadgeProgress(syncedBadges, syncedTrades, syncedModules);

  const handleClaimBadge = (badgeId: string) => {
    setSyncedBadges((prev) =>
      prev.map((b) =>
        b.id === badgeId
          ? { ...b, unlocked: true, unlockedAt: new Date().toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" }) }
          : b
      )
    );
  };

  // Badges déjà signalés dans le panneau de notifications — un débloquage ne
  // doit apparaître "non lu" qu'une fois, pas à chaque rendu. Purement local
  // (pas de collection dédiée côté serveur pour cette seule marque de lecture).
  // Clé namespacée par email, même motif que `getTradingPlanStorageKey` :
  // sans ça, sur un poste partagé par plusieurs élèves, l'état "lu" du
  // premier élève à s'être connecté s'appliquait à tort à tous les suivants.
  const [readBadgeNotificationIds, setReadBadgeNotificationIds] = usePersistentState<string[]>(
    student?.email
      ? `horizon_student_read_badge_notifications_${student.email}`
      : "horizon_student_read_badge_notifications",
    []
  );

  // Notifications élève : messages du coach + débloquages de badge (dérivées
  // à chaque rendu depuis des données déjà synchronisées) + alertes de
  // non-respect du plan de trading (`syncedNotifications`, collection réelle
  // depuis cette période — voir plus haut).
  const messageNotifications: AppNotification[] = syncedMessages
    .filter((m) => m.sender === "coach")
    .map((m) => ({
      id: `msg-notif-${m.id}`,
      title: "Nouveau message du coach",
      message: m.text.length > 120 ? `${m.text.slice(0, 120)}…` : m.text,
      time: m.timestamp,
      type: "system",
      read: m.status === "read",
      targetTab: "messaging",
    }));
  const badgeNotifications: AppNotification[] = liveBadges
    .filter((b) => b.unlocked && b.unlockedAt)
    .map((b) => ({
      id: `badge-notif-${b.id}`,
      title: "Badge débloqué !",
      message: b.title,
      time: b.unlockedAt!,
      type: "academy",
      read: readBadgeNotificationIds.includes(b.id),
    }));
  const studentNotifications: AppNotification[] = [
    ...messageNotifications,
    ...badgeNotifications,
    ...syncedNotifications,
  ].sort((a, b) => notificationTimestamp(b.time) - notificationTimestamp(a.time));

  /**
   * Marque une notification comme lue. Message/badge : statut dérivé
   * (champ `status`/registre local, voir ci-dessus). Toute autre id (ex.
   * `plan-alert-...`) : bascule `read` dans la vraie collection
   * `syncedNotifications`.
   */
  const handleMarkStudentNotificationAsRead = (id: string) => {
    if (id.startsWith("msg-notif-")) {
      const msgId = id.slice("msg-notif-".length);
      setSyncedMessages((prev) => prev.map((m) => (m.id === msgId ? { ...m, status: "read" } : m)));
    } else if (id.startsWith("badge-notif-")) {
      const badgeId = id.slice("badge-notif-".length);
      setReadBadgeNotificationIds((prev) => (prev.includes(badgeId) ? prev : [...prev, badgeId]));
    } else {
      setSyncedNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
    }
  };

  const handleMarkAllStudentNotificationsAsRead = () => {
    setSyncedMessages((prev) => prev.map((m) => (m.sender === "coach" ? { ...m, status: "read" } : m)));
    setReadBadgeNotificationIds(liveBadges.filter((b) => b.unlocked).map((b) => b.id));
    setSyncedNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  };

  /** N'efface que la vraie collection — messages/badges restent dérivés de leurs propres données, rien à "effacer" là-bas. */
  const handleClearStudentNotifications = () => {
    setSyncedNotifications([]);
  };

  const [activeTab, setActiveTab] = useState<TabType>("journal");
  const [mobileOpen, setMobileOpen] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isMindsetModalOpen, setIsMindsetModalOpen] = useState(false);
  const [isTradingPlanOpen, setIsTradingPlanOpen] = useState(false);
  const [isLegalNoticeOpen, setIsLegalNoticeOpen] = useState(false);
  const [isCguOpen, setIsCguOpen] = useState(false);
  const [isNotificationsModalOpen, setIsNotificationsModalOpen] = useState(false);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [profileModalTab, setProfileModalTab] = useState<"profile" | "badges">("profile");
  const [prefilledLessonTitle, setPrefilledLessonTitle] = useState<string | undefined>();

  // Miroir synchrone de `syncedTrades`, mis à jour immédiatement à chaque
  // ajout/modif — jamais via un effet `[syncedTrades]`, qui ne se déclenche
  // qu'au rendu suivant. Sans ce miroir, deux appels rapprochés de
  // `handleAddTrade` (avant que React n'ait re-rendu entre les deux) lisaient
  // tous les deux la même valeur figée de `syncedTrades` : le second trade du
  // jour ne voyait pas le premier dans `allTrades`, sous-comptant
  // `sameDayTrades` pour la règle "max trades/jour" de `checkPlanViolations`.
  const syncedTradesRef = React.useRef(syncedTrades);
  React.useEffect(() => {
    syncedTradesRef.current = syncedTrades;
  }, [syncedTrades]);

  // Alertes de risque portefeuille (inactivité, drawdown quotidien/total) —
  // recalculées à chaque changement de compte ou de trade, donc aussi à
  // chaque ouverture de l'app (un jour peut s'être écoulé sans aucune autre
  // action). `upsertWalletRiskAlerts` renvoie `syncedNotifications` à
  // l'identique quand rien de nouveau n'est déclenché, donc pas de boucle.
  React.useEffect(() => {
    setSyncedNotifications((prev) => upsertWalletRiskAlerts(prev, syncedAccounts, syncedTrades));
  }, [syncedAccounts, syncedTrades]);

  const handleAddTrade = (newTrade: Omit<Trade, "id">) => {
    // Le suffixe aléatoire n'est pas cosmétique : deux trades ajoutés dans la
    // même milliseconde (import CSV en boucle synchrone, notamment) auraient
    // sinon le même id — rejeté par le serveur (`collectionPayloadSchema`
    // exige des id uniques), silencieusement pour tout le lot en cours.
    const tradeWithId: Trade = { ...newTrade, id: `trd-${Date.now()}-${Math.random().toString(36).slice(2, 8)}` };
    const next = [tradeWithId, ...syncedTradesRef.current];
    syncedTradesRef.current = next;
    setSyncedTrades(next);
    applyPlanCompliance(tradeWithId, next);
  };

  const handleUpdateTrade = (updated: Trade) => {
    const next = syncedTradesRef.current.map((t) => (t.id === updated.id ? updated : t));
    syncedTradesRef.current = next;
    setSyncedTrades(next);
    applyPlanCompliance(updated, next);
  };

  /**
   * Vérifie le respect du plan de trading pour un trade donné et upsert/
   * retire l'alerte correspondante — voir `src/lib/planCompliance.ts`. Le
   * plan vérifié est celui choisi explicitement sur CE trade
   * (`trade.tradingPlanId`), jamais déduit de son setup/stratégie. Sans plan
   * choisi (ou plan depuis supprimé), aucune vérification n'est faite — un
   * trade pris hors plan n'a pas de règle à respecter.
   *
   * Plan namespacé par email élève (`storageKey`, même motif que
   * `MindsetJournalModal`) : nécessaire, l'ancien plan côté élève était
   * partagé sans distinction entre comptes sur un même poste.
   */
  const applyPlanCompliance = (trade: Trade, allTrades: Trade[]) => {
    if (!trade.tradingPlanId) return;
    const plans = loadTradingPlan(studentProfile.email);
    const plan = plans.find((p) => p.id === trade.tradingPlanId);
    if (!plan) return;
    const sameDayTrades = allTrades.filter((t) => t.date === trade.date);
    const reasons = checkPlanViolations(trade, sameDayTrades, plan, studentProfile.startingCapital);
    setSyncedNotifications((prev) => upsertPlanAlert(prev, trade, reasons));
  };

  const handleDeleteTrade = (id: string) => {
    const next = syncedTradesRef.current.filter((t) => t.id !== id);
    syncedTradesRef.current = next;
    setSyncedTrades(next);
  };

  const handleAddSetup = (setup: Setup) => {
    setSyncedSetups((prev) => [setup, ...prev]);
  };

  const handleUpdateSetup = (setup: Setup) => {
    const previousName = syncedSetups.find((s) => s.id === setup.id)?.name;
    setSyncedSetups((prev) => prev.map((s) => (s.id === setup.id ? setup : s)));
    // Un setup renommé reste référencé par son ANCIEN nom dans les plans de
    // trading existants (`authorizedSetups` stocke des noms, pas des ids) —
    // sans cette propagation, le trade utilisant désormais le nouveau nom
    // déclenchait une fausse alerte "setup non autorisé". Trouvé en audit.
    if (previousName && previousName !== setup.name) {
      setSyncedTradingPlan((prev) => renameSetupInPlans(prev, previousName, setup.name));
    }
  };

  const handleDeleteSetup = (id: string) => {
    setSyncedSetups((prev) => prev.filter((s) => s.id !== id));
  };

  const handleAddAccount = (account: TradingAccount) => {
    setSyncedAccounts((prev) => [account, ...prev]);
  };

  // Stocke un DELTA (`manualAdjustment`), pas l'équité cible directement :
  // `syncAccountsWithTrades` (effet ci-dessus) recalcule `equity` à chaque
  // changement de `trades`, où qu'il ait lieu dans l'app — sans ce delta
  // persistant, le prochain trade ajouté (même sur un autre compte)
  // écrasait silencieusement cet ajustement manuel. Trouvé en audit.
  const handleUpdateAccountBalance = (id: string, newBalance: number) => {
    setSyncedAccounts((prev) =>
      prev.map((acc) => {
        if (acc.id !== id) return acc;
        const manualAdjustment = newBalance - acc.initialBalance - computeRealizedPnl(syncedTrades, acc.id);
        return { ...acc, equity: newBalance, currentBalance: newBalance, manualAdjustment };
      })
    );
  };

  const handleUpdateAccount = (id: string, patch: Partial<TradingAccount>) => {
    setSyncedAccounts((prev) => prev.map((acc) => (acc.id === id ? { ...acc, ...patch } : acc)));
  };

  const handleDeleteAccount = (id: string) => {
    setSyncedAccounts((prev) => prev.filter((acc) => acc.id !== id));
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

  // Modules masqués exclus, comme la "Progression Globale" de VideoAcademy
  // (`visibleModules`, `src/components/VideoAcademy.tsx`) — sinon un élève
  // avec au moins un module masqué voyait deux pourcentages différents pour
  // la même notion sur le même écran (badge sidebar vs bandeau Académie).
  // Trouvé en audit.
  const visibleSyncedModules = syncedModules.filter((m) => !m.hidden);
  const totalLessons = visibleSyncedModules.reduce((acc, m) => acc + m.lessons.length, 0);
  const completedLessons = visibleSyncedModules.reduce(
    (acc, m) => acc + m.lessons.filter((l) => l.isCompleted).length,
    0
  );
  const courseCompletionPercentage =
    totalLessons > 0 ? Math.round((completedLessons / totalLessons) * 100) : 0;
  const totalUnreadMessages = syncedMessages.filter(
    (m) => m.sender === "coach" && m.status !== "read"
  ).length;

  /**
   * Le cache est effacé délibérément, comme côté staff (`AcademyApp.handleLogout`,
   * même raison) : sur un poste partagé (salle de l'académie, ordinateur
   * familial), laisser `horizon_student_*` en place après une déconnexion
   * exposerait les trades/comptes/messages de cet élève à la personne
   * suivante — et pire, si une sauvegarde était restée "en attente"
   * (`markPending`), le compte suivant à se connecter se la verrait réinjectée
   * par `resolveStudentValue` puis repoussée sur LE SERVEUR sous sa propre
   * session, écrasant ses propres données. Bug réel corrigé ici.
   *
   * Mêmes garde-fous que côté staff (trouvés absents ici en audit) : refus
   * hors ligne (le cache local serait alors la SEULE copie d'une
   * modification en attente, la vider serait une perte sèche) et
   * confirmation explicite avant d'effacer quoi que ce soit — un simple clic
   * sur "Déconnexion" ne doit jamais suffire à perdre une saisie en cours.
   */
  const handleLogout = async () => {
    if (status !== "online") {
      alert(
        "Déconnexion impossible hors ligne : les modifications de cette session ne sont pas encore enregistrées sur le serveur. Reconnecte-toi au serveur avant de te déconnecter."
      );
      return;
    }

    // Voir le commentaire jumeau dans `AcademyApp.handleLogout` (bureau
    // staff) : `status` ne reflète que le dernier chargement global, pas un
    // échec de sauvegarde survenu plus tard dans la session. Sans ce
    // contrôle, le message "tes données restent enregistrées sur le
    // serveur" pouvait être faux et `localStorage.clear()` détruire une
    // modification jamais envoyée. Trouvé en audit.
    const pending = listPending();
    if (pending.length > 0) {
      alert(
        `Déconnexion impossible : ${describePending(pending).join(", ")} pas encore enregistré(e) sur le serveur. Réessaie dans quelques instants — si le problème persiste, recharge la page avant de te déconnecter.`
      );
      return;
    }

    let confirmed: boolean;
    try {
      confirmed = await confirmDialog(
        "Se déconnecter ? Tes données restent enregistrées sur le serveur. Le cache de cet appareil sera effacé.",
        { title: "Déconnexion", confirmLabel: "Se déconnecter" }
      );
    } catch (err) {
      console.error("[propdesk] confirmDialog() a levé une exception.", err);
      alert("La déconnexion n'a pas pu être confirmée. Réessaie, ou recharge la page.");
      return;
    }
    if (!confirmed) return;

    try {
      try {
        await api.studentLogout();
      } catch (err) {
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

  if (status === "loading" || !student) {
    return <LoadingScreen message="Chargement de ton espace…" />;
  }

  // `hiddenSidebarItems` vient déjà fusionné par le serveur (voir
  // `buildStudentProfile` dans `server/routes.ts`) : les entrées sans écran
  // élève restent masquées quoi qu'il arrive, le reste (Module cours,
  // Messagerie, Outils, Macro) suit le réglage de visibilité du fondateur —
  // pas de liste figée ici, sous peine de rendre ce réglage sans effet côté
  // élève.
  // Même principe que côté fondateur (AcademyApp) : le capital affiché vient
  // des portefeuilles réels de l'élève, jamais d'une valeur saisie à la main.
  const studentProfile: StudentProfile = {
    ...student,
    isAdmin: false,
    startingCapital: syncedAccounts.reduce((sum, a) => sum + a.initialBalance, 0),
    currentCapital: syncedAccounts.reduce((sum, a) => sum + a.equity, 0),
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
        onOpenProfileModal={() => {
          setProfileModalTab("badges");
          setIsProfileModalOpen(true);
        }}
        onLogout={handleLogout}
        onOpenTradingPlan={() => setIsTradingPlanOpen(true)}
        onOpenMindset={() => setIsMindsetModalOpen(true)}
        canManageSidebar={false}
      />

      <div className={`flex-1 flex flex-col min-w-0 transition-all duration-300 ${isCollapsed ? "lg:pl-20" : "lg:pl-64"}`}>
        <TopHeader
          activeTab={activeTab}
          student={studentProfile}
          setMobileOpen={setMobileOpen}
          onOpenNotifications={() => setIsNotificationsModalOpen(true)}
          unreadNotificationsCount={studentNotifications.filter((n) => !n.read).length}
          onOpenProfileModal={() => {
            setProfileModalTab("badges");
            setIsProfileModalOpen(true);
          }}
        />

        <main className="p-4 sm:p-8 flex-1 max-w-7xl w-full mx-auto">
          <React.Suspense fallback={<ViewFallback />}>
            {activeTab === "dashboard" && (
              <MainDashboard
                student={studentProfile}
                trades={syncedTrades}
                modules={syncedModules}
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
                setups={syncedSetups}
                plans={syncedTradingPlan}
              />
            )}

            {activeTab === "setups" && (
              <SetupManagement
                setups={syncedSetups}
                onAddSetup={handleAddSetup}
                onUpdateSetup={handleUpdateSetup}
                onDeleteSetup={handleDeleteSetup}
              />
            )}

            {activeTab === "wallets" && (
              <WalletManagement
                accounts={syncedAccounts}
                trades={syncedTrades}
                onAddAccount={handleAddAccount}
                onUpdateAccountBalance={handleUpdateAccountBalance}
                onUpdateAccount={handleUpdateAccount}
                onDeleteAccount={handleDeleteAccount}
              />
            )}

            {activeTab === "analytics" && (
              <PerformanceDashboard
                student={studentProfile}
                trades={syncedTrades}
              />
            )}

            {activeTab === "macro" && <MacroDashboard />}

            {activeTab === "academy" && (
              <VideoAcademy
                modules={syncedModules}
                quizResults={syncedQuizResults}
                onToggleLessonCompletion={handleToggleLessonCompletion}
                onAskCoachAboutLesson={handleAskCoachAboutLesson}
                onSaveModuleQuizResult={handleSaveModuleQuizResult}
              />
            )}

            {activeTab === "announcements" && (
              <Announcements announcements={announcements} isOwner={false} />
            )}

            {activeTab === "messaging" && (
              <CoachMessaging
                coaches={coaches}
                messages={syncedMessages}
                student={studentProfile}
                trades={syncedTrades}
                onSendMessage={handleSendMessage}
                prefilledLessonTitle={prefilledLessonTitle}
              />
            )}
          </React.Suspense>
        </main>

        <footer className="px-4 sm:px-8 py-4 flex items-center justify-between gap-4 text-[11px] text-slate-500 max-w-7xl w-full mx-auto">
          <span>© {new Date().getFullYear()} Thomas Gauthey — Entrepreneur individuel</span>
          <button onClick={() => setIsLegalNoticeOpen(true)} className="hover:text-[#00E676] transition-colors">
            Mentions légales
          </button>
          <button onClick={() => setIsCguOpen(true)} className="hover:text-[#00E676] transition-colors">
            CGU
          </button>
          {/* Politique de confidentialité : hébergée sur le site vitrine, pas
              dans la plateforme (voir HANDOFF.md) — lien externe plutôt qu'un
              modal. URL centralisée dans lib/links.ts (Vercel provisoire, pas
              encore de domaine personnalisé). */}
          <a
            href={PRIVACY_POLICY_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-[#00E676] transition-colors"
          >
            Politique de confidentialité
          </a>
        </footer>
      </div>

      <LegalNoticeModal isOpen={isLegalNoticeOpen} onClose={() => setIsLegalNoticeOpen(false)} />
      <CGUModal isOpen={isCguOpen} onClose={() => setIsCguOpen(false)} />
      <ConfirmDialogHost />
      <MindsetJournalModal
        isOpen={isMindsetModalOpen}
        onClose={() => setIsMindsetModalOpen(false)}
        storageKey={studentProfile.email}
      />
      <TradingPlanEditorModal
        isOpen={isTradingPlanOpen}
        onClose={() => setIsTradingPlanOpen(false)}
        storageKey={studentProfile.email}
        plans={syncedTradingPlan}
        onChange={setSyncedTradingPlan}
        setups={syncedSetups}
      />
      <NotificationModal
        isOpen={isNotificationsModalOpen}
        onClose={() => setIsNotificationsModalOpen(false)}
        notifications={studentNotifications}
        onMarkAsRead={handleMarkStudentNotificationAsRead}
        onMarkAllAsRead={handleMarkAllStudentNotificationsAsRead}
        // Messages/badges restent dérivés (rien à "effacer" là), mais les
        // alertes de plan (`syncedNotifications`) sont une vraie collection
        // depuis cette période — "tout effacer" les vide réellement.
        onClearAll={handleClearStudentNotifications}
        onNavigateToTab={(tab) => {
          if (isTabType(tab)) setActiveTab(tab);
        }}
      />
      <UserProfileModal
        isOpen={isProfileModalOpen}
        onClose={() => setIsProfileModalOpen(false)}
        student={studentProfile}
        badges={liveBadges}
        initialTab={profileModalTab}
        onClaimBadge={handleClaimBadge}
        avatarOnly
        onSaveProfile={async (updatedProfile) => {
          if (updatedProfile.avatar === studentProfile.avatar) return;
          try {
            await api.updateStudentAvatar(updatedProfile.avatar);
            setStudent((prev) => (prev ? { ...prev, avatar: updatedProfile.avatar } : prev));
          } catch (err) {
            alert((err as Error).message || "La mise à jour de la photo de profil a échoué.");
          }
        }}
      />
      <SyncErrorBanner message={syncErrorMessage} onDismiss={() => setSyncErrorMessage(null)} />
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
  const [isTradingPlanOpen, setIsTradingPlanOpen] = useState(false);

  /**
   * Plans de trading personnels du bureau staff — `localStorage` seul,
   * jamais synchronisé au serveur (hors périmètre, voir le commentaire de
   * `TradingPlanData` dans `src/types.ts`). Levé ici (plutôt que géré en
   * interne par `TradingPlanEditorModal`) pour que `TradingJournal` puisse
   * aussi lire la liste, son sélecteur "Plan de trading" en ayant besoin.
   */
  const [staffTradingPlan, setStaffTradingPlanState] = useState<TradingPlanData>(() => loadTradingPlan());
  const setStaffTradingPlan = (next: TradingPlanData) => {
    setStaffTradingPlanState(next);
    try {
      localStorage.setItem(getTradingPlanStorageKey(), JSON.stringify(next));
    } catch {
      // Quota dépassé ou navigation privée : rien à faire de plus ici.
    }
  };
  /**
   * Annonces du fondateur — synchronisées au serveur (`PUT /auth/announcements`),
   * mais sans la mécanique `useSyncedState`/debounce : publication peu
   * fréquente, sauvegarde immédiate à chaque action plutôt qu'un état
   * intermédiaire à réconcilier. `setAnnouncements` échoue de façon visible
   * (alert) plutôt que silencieusement : contrairement à un trade, une
   * annonce non publiée n'a aucune trace locale à rattraper au prochain
   * chargement.
   *
   * `announcementsVersion` : verrou optimiste dédié (voir
   * `announcementsVersion` sur `AuthState`, `saveAnnouncements` côté
   * serveur) — sans lui, deux comptes publiant à quelques secondes d'écart
   * pouvaient s'écraser silencieusement l'un l'autre. Mis à jour à chaque
   * publication réussie ET à chaque rejet 409 (le serveur renvoie la
   * version réelle dans son message ; on se contente ici de la re-réclamer
   * au prochain essai via un rechargement, plus simple qu'une fusion).
   */
  const [announcements, setAnnouncementsState] = useState<Announcement[]>(() =>
    seed(initialState?.announcements, "horizon_announcements", [])
  );
  const [announcementsVersion, setAnnouncementsVersion] = useState<number>(
    initialState?.announcementsVersion ?? 0
  );
  const setAnnouncements = async (next: Announcement[]) => {
    const previous = announcements;
    setAnnouncementsState(next);
    try {
      const result = await api.saveAnnouncements(next, announcementsVersion);
      setAnnouncementsVersion(result.version);
      localStorage.setItem("horizon_announcements", JSON.stringify(next));
    } catch (err) {
      console.warn("[propdesk] Publication de l'annonce échouée.", err);
      setAnnouncementsState(previous);
      alert((err as Error).message || "La publication a échoué. Vérifie ta connexion et réessaie.");
    }
  };
  const [isLegalNoticeOpen, setIsLegalNoticeOpen] = useState(false);
  const [isCguOpen, setIsCguOpen] = useState(false);
  const [isStaffAccountsOpen, setIsStaffAccountsOpen] = useState(false);
  const [isSecurityLogOpen, setIsSecurityLogOpen] = useState(false);

  // Bandeau d'avertissement immédiat quand une sauvegarde échoue en
  // arrière-plan alors que l'app se croit en ligne — la donnée elle-même est
  // protégée par `markPending` dans `useSyncedState`, ce bandeau n'est qu'un
  // signal visible pendant la session en cours.
  const [syncErrorMessage, setSyncErrorMessage] = useState<string | null>(null);
  const reportSyncError = React.useCallback(
    (message?: string) => setSyncErrorMessage(message || "Vérifie ta connexion et réessaie."),
    []
  );

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
    syncEnabled,
    reportSyncError
  );
  // `ready` d'emblée : contrairement à l'instance élève, `seed()` résout déjà
  // la vraie valeur de départ de façon synchrone au montage (serveur, sinon
  // cache local, sinon `initialNotifications`) — pas de remplacement différé
  // à ignorer.
  useNotificationSound(notifications, true);

  const [student, setStudent] = useSyncedState<StudentProfile>(
    "horizon_student",
    seed(initialState?.student ?? undefined, "horizon_student", initialStudentProfile),
    (v) => api.saveProfile(v),
    syncEnabled,
    reportSyncError
  );

  const [enrolledStudents, setEnrolledStudents] = useSyncedState<EnrolledStudent[]>(
    "horizon_enrolled_students",
    seed(server?.enrolledStudents, "horizon_enrolled_students", initialEnrolledStudents),
    (v) => api.saveCollection("enrolledStudents", v),
    syncEnabled,
    reportSyncError
  );

  const [accounts, setAccounts] = useSyncedState<TradingAccount[]>(
    "horizon_accounts",
    seed(server?.accounts, "horizon_accounts", initialTradingAccounts),
    (v) => api.saveCollection("accounts", v),
    syncEnabled,
    reportSyncError
  );

  const [modules, setModules] = useSyncedState<Module[]>(
    "horizon_modules",
    seed(server?.modules, "horizon_modules", initialModules),
    (v) => api.saveCollection("modules", v),
    syncEnabled,
    reportSyncError
  );

  const [trades, setTrades] = useSyncedState<Trade[]>(
    "horizon_trades",
    seed(server?.trades, "horizon_trades", initialTrades),
    (v) => api.saveCollection("trades", v),
    syncEnabled,
    reportSyncError
  );

  const [messages, setMessages] = useSyncedState<CoachMessage[]>(
    "horizon_messages",
    seed(server?.messages, "horizon_messages", initialMessages),
    (v) => api.saveCollection("messages", v),
    syncEnabled,
    reportSyncError
  );

  const [quizResults, setQuizResults] = useSyncedState<Record<string, ModuleQuizResult>>(
    "horizon_quiz_results",
    seed(initialState?.quizResults, "horizon_quiz_results", {}),
    (v) => api.saveQuizResults(v),
    syncEnabled,
    reportSyncError
  );

  const [badges, setBadges] = useSyncedState<TraderBadge[]>(
    "horizon_badges",
    seed(server?.badges, "horizon_badges", initialTraderBadges),
    (v) => api.saveCollection("badges", v),
    syncEnabled,
    reportSyncError
  );

  const [setups, setSetups] = useSyncedState<Setup[]>(
    "horizon_setups",
    seed(server?.setups, "horizon_setups", initialSetups),
    (v) => api.saveCollection("setups", v),
    syncEnabled,
    reportSyncError
  );

  // Pre-filled Messaging Navigation state
  const [prefilledLessonTitle, setPrefilledLessonTitle] = useState<
    string | undefined
  >(undefined);
  const [prefilledTradeId, setPrefilledTradeId] = useState<string | undefined>(
    undefined
  );

  // Ébauche de trade poussée vers le Journal par le calculateur de position
  const [journalDraft, setJournalDraft] = useState<TradeDraft | null>(null);

  const [isMindsetModalOpen, setIsMindsetModalOpen] = useState<boolean>(false);

  // L'écriture dans localStorage est désormais assurée par usePersistentState.

  // Solde de chaque portefeuille recalculé depuis les trades qui lui sont
  // rattachés à chaque saisie/modification/suppression — voir
  // `syncAccountsWithTrades`.
  useEffect(() => {
    setAccounts((prev) => syncAccountsWithTrades(prev, trades));
  }, [trades]);

  /**
   * Le capital affiché (en-tête, tableau de bord, sidebar, Rentabilité) n'est
   * plus une valeur saisie à la main sur le profil : c'est la somme des
   * portefeuilles réels (`accounts`), exactement comme "Capital Total Cumulé"
   * dans le Portefeuille. Sans portefeuille, il vaut 0 — un site neuf ne doit
   * jamais afficher un capital inventé.
   *
   * Calculé au rendu, jamais persisté : `student.startingCapital` /
   * `currentCapital` restent en base pour compatibilité mais ne pilotent plus
   * rien à l'affichage, `displayStudent` est un objet dérivé, pas un nouvel
   * état à synchroniser.
   */
  const displayStudent: StudentProfile = {
    ...student,
    startingCapital: accounts.reduce((sum, a) => sum + a.initialBalance, 0),
    currentCapital: accounts.reduce((sum, a) => sum + a.equity, 0),
  };

  /**
   * Le "coach" que les élèves voient dans leur Messagerie est le fondateur
   * lui-même — bureau staff partagé, un seul fil de discussion (voir
   * `buildCoachesForStudent`, `server/routes.ts`, et `FOUNDER_COACH_ID`,
   * `server/db.ts`). Ici, pas besoin d'aller-retour serveur : le profil est
   * déjà en mémoire. `[]` tant que le profil n'a pas encore de nom (juste
   * après la première installation) — cohérent avec ce que
   * `buildCoachesForStudent` renvoie côté élève dans ce même cas.
   */
  const founderCoaches: Coach[] = student.name
    ? [
        {
          id: FOUNDER_COACH_ID,
          name: student.name,
          role: student.role || "Coach",
          specialty: student.level || "",
          avatar: student.avatar,
          isOnline: true,
        },
      ]
    : [];

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
   * confirmée en moins de 400 ms perdrait la dernière modification — reste
   * théorique même avec `confirmDialog()` (asynchrone, contrairement à
   * l'ancien `confirm()` natif), mais à garder en tête.
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

    // `syncEnabled` ne reflète que le résultat du DERNIER chargement/sync
    // global — un échec ponctuel plus tard dans la session (conflit de
    // version, coupure réseau passagère) ne le repasse jamais à `false`.
    // Sans cette vérification, le message "tes données restent enregistrées
    // sur le serveur" ci-dessous pouvait être FAUX : une modification restée
    // en attente (`markPending`) était alors détruite par le
    // `localStorage.clear()` plus bas, en toute confiance. Trouvé en audit.
    const pending = listPending();
    if (pending.length > 0) {
      alert(
        `Déconnexion impossible : ${describePending(pending).join(", ")} pas encore enregistré(e) sur le serveur. Réessaie dans quelques instants — si le problème persiste, recharge la page avant de te déconnecter.`
      );
      return;
    }

    let confirmed: boolean;
    try {
      confirmed = await confirmDialog(
        "Se déconnecter ? Tes données restent enregistrées sur le serveur. Le cache de cet appareil sera effacé.",
        { title: "Déconnexion", confirmLabel: "Se déconnecter" }
      );
    } catch (err) {
      // Filet de sécurité conservé au cas où : la modale maison ne lève
      // normalement jamais, contrairement à l'ancien confirm() natif dans
      // certains contextes (iframe sandboxée, dialogues natifs bloqués).
      console.error("[propdesk] confirmDialog() a levé une exception.", err);
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

  const handleAddSetup = (setup: Setup) => {
    setSetups((prev) => [setup, ...prev]);
  };

  const handleUpdateSetup = (setup: Setup) => {
    const previousName = setups.find((s) => s.id === setup.id)?.name;
    setSetups((prev) => prev.map((s) => (s.id === setup.id ? setup : s)));
    // Voir le commentaire jumeau côté élève (`StudentAuthenticatedApp.handleUpdateSetup`).
    if (previousName && previousName !== setup.name) {
      setStaffTradingPlan(renameSetupInPlans(staffTradingPlan, previousName, setup.name));
    }
  };

  const handleDeleteSetup = (id: string) => {
    setSetups((prev) => prev.filter((s) => s.id !== id));
  };

  // La notification est calculée AVANT `setBadges`, jamais depuis l'intérieur
  // de son updater : StrictMode double-invoque les updaters en développement
  // pour détecter les impuretés, et un `setNotifications` imbriqué produisait
  // deux notifications "Badge débloqué" au lieu d'une (sans impact en
  // production, mais une vraie impureté — l'équivalent élève,
  // `StudentAuthenticatedApp.handleClaimBadge`, ne l'avait pas).
  const handleClaimBadge = (badgeId: string) => {
    const badge = badges.find((b) => b.id === badgeId);
    if (!badge) return;

    setBadges((prevBadges) =>
      prevBadges.map((b) =>
        b.id === badgeId
          ? {
              ...b,
              unlocked: true,
              progressPercentage: 100,
              unlockedAt: new Date().toLocaleDateString("fr-FR", {
                day: "numeric",
                month: "long",
                year: "numeric",
              }),
            }
          : b
      )
    );

    const newNotif: AppNotification = {
      id: `notif-badge-${Date.now()}`,
      title: "🏆 Nouveau Badge Débloqué !",
      message: `Félicitations ! Tu as débloqué le badge "${badge.title}" et gagné +${badge.rewardXP || 200} XP !`,
      time: "À l'instant",
      type: "system",
      read: false,
    };
    setNotifications((prev) => [newNotif, ...prev]);
  };

  // Accounts Handlers
  const handleAddAccount = (account: TradingAccount) => {
    setAccounts((prev) => [account, ...prev]);
  };

  // Voir le commentaire jumeau côté élève (`StudentAuthenticatedApp.handleUpdateAccountBalance`) :
  // `manualAdjustment` est un DELTA persistant, pour survivre au recalcul
  // de `syncAccountsWithTrades` déclenché par le prochain trade ajouté
  // n'importe où dans l'app. Trouvé en audit.
  const handleUpdateAccountBalance = (id: string, newBalance: number) => {
    setAccounts((prev) =>
      prev.map((acc) => {
        if (acc.id !== id) return acc;
        const manualAdjustment = newBalance - acc.initialBalance - computeRealizedPnl(trades, acc.id);
        return { ...acc, equity: newBalance, currentBalance: newBalance, manualAdjustment };
      })
    );
  };

  const handleUpdateAccount = (id: string, patch: Partial<TradingAccount>) => {
    setAccounts((prev) => prev.map((acc) => (acc.id === id ? { ...acc, ...patch } : acc)));
  };

  const handleDeleteAccount = (id: string) => {
    setAccounts((prev) => prev.filter((acc) => acc.id !== id));
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

  // Édition du programme (module Cours) — réservée au staff, jamais exposée
  // côté élève (voir VideoAcademyProps.isAdmin, src/components/VideoAcademy.tsx) :
  // "modules" reste le bureau PARTAGÉ pour le staff (resolveCollectionUserId,
  // server/routes.ts), donc toute modification ici vaut pour tout le monde,
  // coachs et élèves compris — comme pour les annonces ou le programme.
  const handleSaveModule = (module: Module) => {
    setModules((prev) => {
      const exists = prev.some((m) => m.id === module.id);
      return exists ? prev.map((m) => (m.id === module.id ? module : m)) : [...prev, module];
    });
  };

  const handleDeleteModule = (moduleId: string) => {
    setModules((prev) => prev.filter((m) => m.id !== moduleId));
  };

  const handleSaveLesson = (moduleId: string, lesson: Lesson) => {
    setModules((prev) =>
      prev.map((mod) => {
        if (mod.id !== moduleId) return mod;
        const exists = mod.lessons.some((l) => l.id === lesson.id);
        return {
          ...mod,
          lessons: exists
            ? mod.lessons.map((l) => (l.id === lesson.id ? lesson : l))
            : [...mod.lessons, lesson],
        };
      })
    );
  };

  const handleDeleteLesson = (moduleId: string, lessonId: string) => {
    setModules((prev) =>
      prev.map((mod) =>
        mod.id === moduleId ? { ...mod, lessons: mod.lessons.filter((l) => l.id !== lessonId) } : mod
      )
    );
  };

  // Voir le commentaire équivalent dans `StudentAuthenticatedApp` : sans ce
  // miroir synchrone, deux ajouts de trade rapprochés se basaient tous les
  // deux sur la même valeur figée de `trades`, sous-comptant `sameDayTrades`
  // dans `checkPlanViolations`.
  const tradesRef = React.useRef(trades);
  React.useEffect(() => {
    tradesRef.current = trades;
  }, [trades]);

  // Voir le commentaire équivalent dans `StudentAuthenticatedApp` — mêmes
  // alertes de risque portefeuille, pour les comptes du coach lui-même.
  React.useEffect(() => {
    setNotifications((prev) => upsertWalletRiskAlerts(prev, accounts, trades));
  }, [accounts, trades]);

  const handleAddTrade = (newTrade: Omit<Trade, "id">) => {
    // Voir le commentaire équivalent côté élève (`StudentAuthenticatedApp`) :
    // le suffixe aléatoire évite un id dupliqué quand plusieurs trades sont
    // ajoutés dans la même milliseconde (import CSV en boucle, notamment).
    const tradeWithId: Trade = {
      ...newTrade,
      id: `trd-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    };
    const next = [tradeWithId, ...tradesRef.current];
    tradesRef.current = next;
    setTrades(next);
    applyPlanCompliance(tradeWithId, next);
  };

  const handleUpdateTrade = (updated: Trade) => {
    const next = tradesRef.current.map((t) => (t.id === updated.id ? updated : t));
    tradesRef.current = next;
    setTrades(next);
    applyPlanCompliance(updated, next);
  };

  /**
   * Vérifie le respect du plan de trading pour un trade donné (ajout ou
   * modification) et upsert/retire l'alerte correspondante — voir
   * `src/lib/planCompliance.ts`. Le plan vérifié est celui choisi
   * explicitement sur CE trade (`trade.tradingPlanId`), jamais déduit de son
   * setup/stratégie. Clé de plan partagée (bureau staff), pas de
   * `storageKey`.
   */
  const applyPlanCompliance = (trade: Trade, allTrades: Trade[]) => {
    if (!trade.tradingPlanId) return;
    const plans = loadTradingPlan();
    const plan = plans.find((p) => p.id === trade.tradingPlanId);
    if (!plan) return;
    const sameDayTrades = allTrades.filter((t) => t.date === trade.date);
    // `displayStudent.startingCapital`, pas `student.startingCapital` : ce
    // dernier n'est plus jamais tenu à jour depuis que le capital affiché
    // vient des comptes réels (voir le commentaire de `displayStudent`
    // plus haut) — l'utiliser ici désactivait silencieusement la règle de
    // perte quotidienne max pour tout trade saisi depuis le bureau staff.
    const reasons = checkPlanViolations(trade, sameDayTrades, plan, displayStudent.startingCapital);
    setNotifications((prev) => upsertPlanAlert(prev, trade, reasons));
  };

  const handleDeleteTrade = (id: string) => {
    const next = tradesRef.current.filter((t) => t.id !== id);
    tradesRef.current = next;
    setTrades(next);
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
        student={displayStudent}
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
        onOpenTradingPlan={() => setIsTradingPlanOpen(true)}
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
          // Plusieurs entrées peuvent en théorie mener au même onglet, on ne
          // bascule donc que si plus aucune n'y conduit.
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
          student={displayStudent}
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
              student={displayStudent}
              trades={trades}
              modules={modules}
              messages={messages}
              courseCompletionPercentage={courseCompletionPercentage}
              setActiveTab={setActiveTab}
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
              onUpdateAccount={handleUpdateAccount}
              onDeleteAccount={handleDeleteAccount}
            />
          )}

          {activeTab === "academy" && (
            <VideoAcademy
              modules={modules}
              quizResults={quizResults}
              onToggleLessonCompletion={handleToggleLessonCompletion}
              onAskCoachAboutLesson={handleAskCoachAboutLesson}
              onSaveModuleQuizResult={handleSaveModuleQuizResult}
              isAdmin
              onSaveModule={handleSaveModule}
              onDeleteModule={handleDeleteModule}
              onSaveLesson={handleSaveLesson}
              onDeleteLesson={handleDeleteLesson}
            />
          )}

          {activeTab === "announcements" && (
            <Announcements announcements={announcements} isOwner={isOwner} onSave={setAnnouncements} />
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
              setups={setups}
              plans={staffTradingPlan}
            />
          )}

          {activeTab === "setups" && (
            <SetupManagement
              setups={setups}
              onAddSetup={handleAddSetup}
              onUpdateSetup={handleUpdateSetup}
              onDeleteSetup={handleDeleteSetup}
            />
          )}

          {activeTab === "messaging" && (
            <CoachMessaging
              coaches={founderCoaches}
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
              student={displayStudent}
              trades={trades}
            />
          )}

          {activeTab === "macro" && <MacroDashboard />}
          </React.Suspense>
        </main>

        <footer className="px-4 sm:px-8 py-4 flex items-center justify-between gap-4 text-[11px] text-slate-500 max-w-7xl w-full mx-auto">
          <span>© {new Date().getFullYear()} Thomas Gauthey — Entrepreneur individuel</span>
          <button onClick={() => setIsLegalNoticeOpen(true)} className="hover:text-[#00E676] transition-colors">
            Mentions légales
          </button>
          <button onClick={() => setIsCguOpen(true)} className="hover:text-[#00E676] transition-colors">
            CGU
          </button>
          {/* Politique de confidentialité : hébergée sur le site vitrine, pas
              dans la plateforme (voir HANDOFF.md) — lien externe plutôt qu'un
              modal. URL centralisée dans lib/links.ts (Vercel provisoire, pas
              encore de domaine personnalisé). */}
          <a
            href={PRIVACY_POLICY_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-[#00E676] transition-colors"
          >
            Politique de confidentialité
          </a>
        </footer>
      </div>

      <LegalNoticeModal isOpen={isLegalNoticeOpen} onClose={() => setIsLegalNoticeOpen(false)} />
      <CGUModal isOpen={isCguOpen} onClose={() => setIsCguOpen(false)} />
      <ConfirmDialogHost />

      {/* User Profile Edition Modal */}
      <UserProfileModal
        isOpen={isProfileModalOpen}
        onClose={() => setIsProfileModalOpen(false)}
        student={student}
        badges={computeBadgeProgress(badges, trades, modules)}
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
        onOpenSecurityLog={
          isOwner
            ? () => {
                setIsProfileModalOpen(false);
                setIsSecurityLogOpen(true);
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

      {/* Journal de sécurité — réservé au compte fondateur (isOwner), pas à
          tout le staff, contrairement à StaffAccountsModal ci-dessus. */}
      {isOwner && (
        <SecurityLogModal isOpen={isSecurityLogOpen} onClose={() => setIsSecurityLogOpen(false)} />
      )}

      {/* Position Calculator Modal */}
      <PositionCalculatorModal
        isOpen={isCalculatorOpen}
        onClose={() => setIsCalculatorOpen(false)}
        defaultCapital={displayStudent.currentCapital}
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

      {/* Module Pratique : plan de trading (règles personnelles) */}
      <TradingPlanEditorModal
        isOpen={isTradingPlanOpen}
        onClose={() => setIsTradingPlanOpen(false)}
        plans={staffTradingPlan}
        onChange={setStaffTradingPlan}
        setups={setups}
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

      <SyncErrorBanner message={syncErrorMessage} onDismiss={() => setSyncErrorMessage(null)} />
    </div>
  );
}

