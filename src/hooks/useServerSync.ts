import { useCallback, useEffect, useRef, useState } from "react";
import { api, type ServerState } from "../lib/api";
import { clearPending, listPending, markPending, subscribePending } from "../lib/pendingChanges";

export type SyncStatus = "loading" | "online" | "offline";

/** Clés localStorage utilisées avant l'arrivée de la persistance serveur. */
const LEGACY_KEYS = {
  student: "horizon_student",
  collections: {
    trades: "horizon_trades",
    accounts: "horizon_accounts",
    notifications: "horizon_notifications",
    badges: "horizon_badges",
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

  const hasSomething =
    Object.keys(collections).length > 0 || student !== undefined;

  return hasSomething ? { student, collections } : null;
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

  // Tient `pending` à jour PENDANT la session, pas seulement au démarrage —
  // voir le commentaire de `subscribePending` (`src/lib/pendingChanges.ts`).
  // `status === "online"` uniquement : avant ça, l'effet ci-dessus n'a pas
  // encore posé le `pending` initial (calculé AVANT `cacheState`, voir plus
  // haut), une notification prématurée l'écraserait avec un instantané
  // partiel.
  useEffect(() => {
    if (status !== "online") return;
    return subscribePending(() => setPending(listPending()));
  }, [status]);

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
): [T, React.Dispatch<React.SetStateAction<T>>, (value: T) => void] {
  const [value, setValue] = useState<T>(initialValue);

  // Référence de la valeur chargée au démarrage. Comparer les identités plutôt
  // que compter les rendus : les setters produisent toujours un nouvel objet,
  // et cela reste correct sous le double-effet de StrictMode.
  const loadedValue = useRef(initialValue);

  const stablePush = useCallback(push, []); // eslint-disable-line react-hooks/exhaustive-deps
  const stableOnError = useCallback(onSyncError ?? (() => undefined), []); // eslint-disable-line react-hooks/exhaustive-deps

  // Dernière valeur en attente d'envoi (avant le débounce de 400 ms) et
  // indicateur qu'un envoi est planifié — lus par l'effet de démontage
  // ci-dessous, jamais par le rendu.
  const pendingValue = useRef<T | null>(null);
  const hasPending = useRef(false);

  useEffect(() => {
    // Ne pas réécrire ce qu'on vient tout juste de charger — que ce soit la
    // valeur initiale, OU une valeur reposée après coup par `markLoaded`
    // (résolution post-bootstrap, `resolveStudentValue` dans App.tsx) : sans
    // cette seconde voie, `value` restait perpétuellement différent de
    // `loadedValue.current` (figé à sa toute première valeur) et CHAQUE
    // rechargement de page repoussait inutilement vers le serveur une
    // collection qu'il venait tout juste d'envoyer — un aller-retour réseau
    // superflu à chaque connexion, et depuis le verrouillage optimiste des
    // collections, un faux conflit de version à chaque fois qu'un autre
    // onglet avait entre-temps écrit la même collection.
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

    pendingValue.current = value;
    hasPending.current = true;

    const timer = setTimeout(() => {
      hasPending.current = false;
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

  // Filet de secours pour le vrai démontage (déconnexion, fermeture d'onglet
  // — pas un simple ré-rendu, cet effet n'a aucune dépendance) : si une
  // frappe/modification est encore dans les 400 ms de débounce au moment où
  // le composant disparaît, on la pousse quand même plutôt que de la laisser
  // s'annuler silencieusement avec `clearTimeout`. `handleLogout`
  // (`App.tsx`) confirme déjà explicitement avant de démonter, donc ce
  // filet ne se déclenche qu'en dernier recours (l'utilisateur a été rapide
  // au clavier juste avant de confirmer).
  useEffect(() => {
    return () => {
      if (hasPending.current && pendingValue.current !== null) {
        stablePush(pendingValue.current).catch(() => markPending(localKey));
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /**
   * Repose la valeur sans déclencher d'envoi ni de marque "en attente" — à
   * utiliser quand la nouvelle valeur vient d'être confirmée par le serveur
   * lui-même (ex: `resolveStudentValue` juste après le retour du bootstrap),
   * jamais pour une vraie modification locale.
   */
  const markLoaded = useCallback((v: T) => {
    loadedValue.current = v;
    setValue(v);
  }, []);

  return [value, setValue, markLoaded];
}
