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
  initialTrades,
  initialTradingAccounts,
  initialTraderBadges,
  initialNotifications,
  initialSetups,
} from "./data/mockData";
import {
  Trade,
  StudentProfile,
  TradingAccount,
  AppNotification,
  TraderBadge,
  TradeDraft,
  TradingPlanData,
  Setup,
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
const TradingJournal = React.lazy(() =>
  import("./components/TradingJournal").then((m) => ({ default: m.TradingJournal }))
);
const PerformanceDashboard = React.lazy(() =>
  import("./components/PerformanceDashboard").then((m) => ({
    default: m.PerformanceDashboard,
  }))
);
const WalletManagement = React.lazy(() =>
  import("./components/WalletManagement").then((m) => ({ default: m.WalletManagement }))
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
import { useBootstrap, useSyncedState } from "./hooks/useServerSync";
import { useNotificationSound } from "./hooks/useNotificationSound";
import { useAuth } from "./hooks/useAuth";
import { LoginScreen } from "./components/auth/LoginScreen";
import { TwoFactorVerifyScreen } from "./components/auth/TwoFactorVerifyScreen";
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
    expired,
    login,
    verifyTwoFactor,
    verifyTwoFactorRecovery,
    cancelTwoFactor,
    setup,
    changePassword,
    markLoggedOut,
    refresh,
  } = useAuth();

  if (status === "loading") {
    return <LoadingScreen message="Vérification de ta session…" />;
  }

  if (status === "no-account") {
    return <SetupScreen onSetup={setup} onRefresh={() => void refresh()} />;
  }

  if (status === "unauthenticated") {
    return (
      <LoginScreen
        onLogin={login}
        expired={expired}
        footer="Mot de passe oublié ? La procédure de secours est décrite dans le README."
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

  // Un mot de passe temporaire bloque l'accès à l'application jusqu'à son
  // remplacement — la session est valide, seul le mot de passe ne l'est
  // plus. Le serveur refuse par ailleurs toute autre route tant que cette
  // étape n'est pas franchie (filet de sécurité, voir requireAuth).
  if (status === "authenticated" && user?.mustChangePassword) {
    return <ChangePasswordScreen onChangePassword={changePassword} />;
  }

  // `authenticated` et `offline` mènent tous deux à l'application. Hors ligne,
  // aucune vérification n'est possible : on démarre sur le cache local, comme
  // avant l'authentification. C'est un choix assumé — le verrou n'est donc pas
  // une barrière d'accès aux données déjà présentes sur la machine (voir README).
  return <AuthenticatedApp onLoggedOut={markLoggedOut} currentUserId={user?.id ?? null} />;
}

/**
 * Charge l'état applicatif, puis monte l'application.
 *
 * Monté seulement une fois l'authentification résolue, si bien que
 * `useBootstrap` — et son import depuis l'ancien localStorage — ne s'exécute
 * jamais sans session.
 */
function AuthenticatedApp({
  onLoggedOut,
  currentUserId,
}: {
  onLoggedOut: () => void;
  currentUserId: string | null;
}) {
  const { status, state, pending, discardPending, acknowledgePending } = useBootstrap();

  if (status === "loading") {
    return <LoadingScreen message="Chargement de ton espace PropDesk…" />;
  }

  return (
    <TraderApp
      initialState={state}
      syncEnabled={status === "online"}
      onLoggedOut={onLoggedOut}
      currentUserId={currentUserId}
      pending={pending}
      onDiscardPending={discardPending}
      onReplayedPending={acknowledgePending}
    />
  );
}

interface TraderAppProps {
  /** État renvoyé par le serveur, ou null si celui-ci est injoignable. */
  initialState: ServerState | null;
  /** false quand on tourne sur le cache local : on n'essaie pas de pousser. */
  syncEnabled: boolean;
  /** Remonte la déconnexion pour afficher l'écran de connexion. */
  onLoggedOut: () => void;
  /** Identité du compte connecté. `null` hors ligne (pas de session vérifiée). */
  currentUserId: string | null;
  /**
   * Clés modifiées hors ligne et jamais envoyées. Vide dans le cas normal.
   * Voir `src/lib/pendingChanges.ts`.
   */
  pending: string[];
  onDiscardPending: () => void;
  onReplayedPending: () => void;
}

function TraderApp({
  initialState,
  syncEnabled,
  onLoggedOut,
  currentUserId,
  pending,
  onDiscardPending,
  onReplayedPending,
}: TraderAppProps) {
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
  const [isLegalNoticeOpen, setIsLegalNoticeOpen] = useState(false);
  const [isCguOpen, setIsCguOpen] = useState(false);

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

  const [accounts, setAccounts] = useSyncedState<TradingAccount[]>(
    "horizon_accounts",
    seed(server?.accounts, "horizon_accounts", initialTradingAccounts),
    (v) => api.saveCollection("accounts", v),
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
  const handleNavigateFromNotification = (tab: string) => {
    if (!isTabType(tab)) return;
    setActiveTab(tab);
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

  return (
    <div className="min-h-screen bg-[#0B0F0E] text-slate-100 font-sans antialiased selection:bg-[#00E676] selection:text-slate-950 flex">
      {/* Left Sidebar Navigation */}
      <Sidebar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        student={displayStudent}
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
        canManageSidebar={true}
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
              setActiveTab={setActiveTab}
            />
          )}

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

          {activeTab === "journal" && (
            <TradingJournal
              trades={trades}
              accounts={accounts}
              onAddTrade={handleAddTrade}
              onUpdateTrade={handleUpdateTrade}
              onDeleteTrade={handleDeleteTrade}
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
        badges={computeBadgeProgress(badges, trades)}
        onSaveProfile={handleSaveProfile}
        onClaimBadge={handleClaimBadge}
        initialTab={profileModalTab}
      />

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

