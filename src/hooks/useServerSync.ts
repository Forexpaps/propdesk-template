import { useCallback, useEffect, useRef, useState } from "react";
import { api, type ServerState } from "../lib/api";
import { clearPending, listPending, markPending, replayPending } from "../lib/pendingChanges";
import type { Trade, TradingAccount, Module, CoachMessage, ModuleQuizResult, StudentProfile, TraderBadge, Coach, AppNotification, TradingPlanData, Setup, Announcement } from "../types";

export type SyncStatus = "loading" | "online" | "offline";

/** Clés localStorage utilisées avant l'arrivée de la persistance serveur. */
const LEGACY_KEYS = {
  student: "horizon_student",
  quizResults: "horizon_quiz_results",
  collections: {
    trades: "horizon_trades",
    accounts: "horizon_accounts",
    messages: "horizon_messages",
    notifications: "horizon_notifications",
    enrolledStudents: "horizon_enrolled_students",
    badges: "horizon_badges",
    modules: "horizon_modules",
    setups: "horizon_setups",
  },
} as const;

function readLegacy<T>(key: string): T | undefined {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : undefined;
  } catch {
    return undefined;
  }
}

/**
 * Rassemble ce que l'utilisateur avait dans son navigateur avant que la
 * persistance serveur existe, pour pouvoir le reprendre au lieu de le perdre.
 */
function collectLegacyState() {
  const collections = Object.fromEntries(
    Object.entries(LEGACY_KEYS.collections)
      .map(([name, key]) => [name, readLegacy<{ id: string }[]>(key)])
      .filter(([, value]) => Array.isArray(value))
  );

  const student = readLegacy<Record<string, unknown>>(LEGACY_KEYS.student);
  const quizResults = readLegacy<Record<string, unknown>>(LEGACY_KEYS.quizResults);

  const hasSomething =
    Object.keys(collections).length > 0 || student !== undefined;

  return hasSomething ? { student, collections, quizResults } : null;
}

/**
 * Recopie l'état serveur dans le cache localStorage.
 *
 * Sans cela, une collection jamais modifiée n'aurait aucune copie locale, et
 * un démarrage à froid sans réseau repartirait des données de démonstration
 * au lieu des vraies données de l'utilisateur.
 */
function cacheState(state: ServerState): void {
  try {
    if (state.student) {
      localStorage.setItem(LEGACY_KEYS.student, JSON.stringify(state.student));
    }
    localStorage.setItem(
      LEGACY_KEYS.quizResults,
      JSON.stringify(state.quizResults ?? {})
    );
    Object.entries(LEGACY_KEYS.collections).forEach(([name, key]) => {
      const items = state.collections?.[name as keyof typeof state.collections];
      if (Array.isArray(items)) localStorage.setItem(key, JSON.stringify(items));
    });
  } catch {
    // Stockage indisponible : le serveur reste joignable, ce n'est pas bloquant.
  }
}

/**
 * Charge l'état applicatif depuis le serveur au démarrage.
 *
 * Si la base n'a jamais été amorcée et que le navigateur contient des données
 * de l'ancienne version localStorage, elles sont importées une seule fois
 * (le serveur refuse un second import avec un 409, ce qui protège du cas où
 * deux onglets démarrent en même temps).
 *
 * Si le serveur est injoignable, le statut passe à "offline" : l'application
 * démarre alors sur le cache localStorage et continue de fonctionner.
 */
export function useBootstrap() {
  const [status, setStatus] = useState<SyncStatus>("loading");
  const [state, setState] = useState<ServerState | null>(null);
  // Clés modifiées hors ligne et jamais envoyées. Relevées **avant** tout
  // appel réseau : `cacheState` les écraserait sinon.
  const [pending, setPending] = useState<string[]>([]);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        let serverState = await api.fetchState();

        if (!serverState.bootstrapped) {
          const legacy = collectLegacyState();

          // Un 409 signifie qu'un autre onglet a amorcé la base entre-temps :
          // ce n'est pas une erreur, on se contente de relire l'état.
          await (legacy
            ? api.importState(legacy as Parameters<typeof api.importState>[0])
            : api.seedDemoData()
          ).catch(() => undefined);

          serverState = await api.fetchState();
        }

        // Point critique : `cacheState` recopie l'état serveur par-dessus le
        // cache local. Tant que des modifications hors ligne attendent d'être
        // arbitrées, ce serait les détruire avant même de les avoir proposées
        // — c'est exactement ce qui les faisait disparaître auparavant. On
        // laisse donc le cache intact et on remet la décision à l'utilisateur.
        const enAttente = listPending();
        if (enAttente.length === 0) cacheState(serverState);

        if (!cancelled) {
          setPending(enAttente);
          setState(serverState);
          setStatus("online");
        }
      } catch (err) {
        console.warn(
          "[horizon] Serveur injoignable, bascule sur le cache local.",
          err
        );
        if (!cancelled) setStatus("offline");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  /**
   * Oublie les modifications en attente et réaligne le cache sur le serveur.
   *
   * Appelé quand l'utilisateur choisit d'abandonner : le `cacheState` sauté
   * plus haut est rattrapé ici, sinon le cache garderait indéfiniment une
   * version que plus personne ne compte envoyer.
   */
  const discardPending = useCallback(() => {
    if (state) cacheState(state);
    // `clearPending()` est indispensable, et pas redondant avec `setPending([])`.
    // L'état React disparaît au rechargement qui suit ; c'est le registre
    // `localStorage` qui est relu au démarrage. Sans cette ligne, le bandeau
    // réapparaissait juste après avoir été abandonné, en proposant d'envoyer
    // des modifications que le cache ne contenait déjà plus.
    clearPending();
    setPending([]);
  }, [state]);

  /** Signale que le rejeu a eu lieu ; l'appelant recharge ensuite la page. */
  const acknowledgePending = useCallback(() => setPending([]), []);

  return { status, state, pending, discardPending, acknowledgePending };
}

/**
 * Chargement minimal pour le Journal élève.
 *
 * Volontairement plus simple que `useBootstrap` : pas d'import depuis un
 * ancien `localStorage` (aucun élève n'a de données antérieures à son
 * compte), pas de bandeau interactif de modifications hors ligne — un élève
 * est seul propriétaire de ses données, donc pas de conflit possible avec un
 * collègue à arbitrer, contrairement au bureau staff partagé. Une
 * modification restée en attente (`markPending`, suite à un échec de
 * `useSyncedState` signalé par `SyncErrorBanner`) est donc rejouée
 * silencieusement ici, avant même d'appliquer l'état serveur : sans ça, rien
 * ne la renvoyait jamais, et `resolveStudentValue` (App.tsx) la réappliquait
 * indéfiniment par-dessus l'état serveur à chaque rechargement sans jamais
 * réellement l'envoyer. `GET /api/state` est déjà filtré côté serveur pour
 * une session élève — il ne renvoie que les collections listées dans
 * `STUDENT_ALLOWED_COLLECTIONS` (voir `server/routes.ts`) : trades, accounts
 * (ses propres portefeuilles), modules (sa copie personnelle du programme),
 * messages (son fil avec le coach) et badges (son état de réclamation
 * personnel — la progression elle-même est recalculée en direct depuis
 * trades/modules, voir `src/lib/badges.ts`).
 */
export function useStudentBootstrap() {
  const [status, setStatus] = useState<SyncStatus>("loading");
  const [trades, setTrades] = useState<Trade[]>([]);
  const [accounts, setAccounts] = useState<TradingAccount[]>([]);
  const [modules, setModules] = useState<Module[]>([]);
  const [messages, setMessages] = useState<CoachMessage[]>([]);
  const [badges, setBadges] = useState<TraderBadge[]>([]);
  const [setups, setSetups] = useState<Setup[]>([]);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [quizResults, setQuizResults] = useState<Record<string, ModuleQuizResult>>({});
  const [student, setStudent] = useState<StudentProfile | null>(null);
  const [coaches, setCoaches] = useState<Coach[]>([]);
  const [tradingPlan, setTradingPlan] = useState<TradingPlanData | null>(null);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        if (listPending().length > 0) {
          await replayPending().catch(() => undefined);
        }

        const serverState = await api.fetchState();
        if (!cancelled) {
          setTrades(serverState.collections.trades ?? []);
          setAccounts(serverState.collections.accounts ?? []);
          setModules(serverState.collections.modules ?? []);
          setMessages(serverState.collections.messages ?? []);
          setBadges(serverState.collections.badges ?? []);
          setSetups(serverState.collections.setups ?? []);
          setNotifications(serverState.collections.notifications ?? []);
          setQuizResults(serverState.quizResults ?? {});
          setStudent((serverState.student as StudentProfile | null) ?? null);
          setCoaches(serverState.coaches ?? []);
          setTradingPlan(serverState.tradingPlan ?? null);
          setAnnouncements(serverState.announcements ?? []);
          setStatus("online");
        }
      } catch (err) {
        console.warn("[propdesk] Serveur injoignable.", err);
        if (!cancelled) setStatus("offline");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  return { status, trades, accounts, modules, messages, badges, setups, notifications, quizResults, student, setStudent, coaches, tradingPlan, announcements };
}

/**
 * État applicatif synchronisé avec le serveur.
 *
 * L'écriture est différée (les actions de l'UI produisent souvent plusieurs
 * mises à jour rapprochées) et systématiquement doublée dans localStorage, qui
 * sert de cache de secours quand le serveur ne répond pas. L'interface reste
 * optimiste : elle n'attend jamais la réponse du serveur pour se mettre à jour.
 */
export function useSyncedState<T>(
  localKey: string,
  initialValue: T,
  push: (value: T) => Promise<unknown>,
  enabled: boolean,
  onSyncError?: (message?: string) => void
): [T, React.Dispatch<React.SetStateAction<T>>] {
  const [value, setValue] = useState<T>(initialValue);

  // Référence de la valeur chargée au démarrage. Comparer les identités plutôt
  // que compter les rendus : les setters produisent toujours un nouvel objet,
  // et cela reste correct sous le double-effet de StrictMode.
  const loadedValue = useRef(initialValue);

  const stablePush = useCallback(push, []); // eslint-disable-line react-hooks/exhaustive-deps
  const stableOnError = useCallback(onSyncError ?? (() => undefined), []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    // Ne pas réécrire ce qu'on vient tout juste de charger.
    if (value === loadedValue.current) return;

    try {
      localStorage.setItem(localKey, JSON.stringify(value));
    } catch {
      // Quota dépassé ou navigation privée : le serveur reste la source fiable.
    }

    // Hors ligne : rien à pousser, mais il faut retenir que cette collection a
    // divergé du serveur. Sans cette marque, le rechargement suivant reprendrait
    // l'état serveur et la modification disparaîtrait sans un mot.
    if (!enabled) {
      markPending(localKey);
      return;
    }

    const timer = setTimeout(() => {
      stablePush(value).catch((err) => {
        console.warn(`[horizon] Synchronisation de "${localKey}" échouée.`, err);
        // Échec ponctuel (réseau, conflit 409) alors que l'app se croit en
        // ligne : sans cette marque, le prochain rechargement écraserait
        // silencieusement cette modification avec la version serveur — le
        // même trou que le mode hors ligne comblait déjà. Le bandeau
        // `PendingChangesBanner` existant la proposera au prochain démarrage.
        markPending(localKey);
        stableOnError((err as Error)?.message);
      });
    }, 400);

    return () => clearTimeout(timer);
  }, [value, localKey, enabled, stablePush, stableOnError]);

  return [value, setValue];
}
