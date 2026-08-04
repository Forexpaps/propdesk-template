import { useCallback, useEffect, useRef, useState } from "react";
import { api, type ServerState } from "../lib/api";

export type SyncStatus = "loading" | "online" | "offline";

/** Clés localStorage utilisées avant l'arrivée de la persistance serveur. */
const LEGACY_KEYS = {
  student: "horizon_student",
  quizResults: "horizon_quiz_results",
  collections: {
    trades: "horizon_trades",
    accounts: "horizon_accounts",
    signals: "horizon_signals",
    messages: "horizon_messages",
    forumTopics: "horizon_forum_topics",
    notifications: "horizon_notifications",
    enrolledStudents: "horizon_enrolled_students",
    badges: "horizon_badges",
    modules: "horizon_modules",
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

        cacheState(serverState);

        if (!cancelled) {
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

  return { status, state };
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
  onSyncError?: () => void
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

    if (!enabled) return;

    const timer = setTimeout(() => {
      stablePush(value).catch((err) => {
        console.warn(`[horizon] Synchronisation de "${localKey}" échouée.`, err);
        stableOnError();
      });
    }, 400);

    return () => clearTimeout(timer);
  }, [value, localKey, enabled, stablePush, stableOnError]);

  return [value, setValue];
}
