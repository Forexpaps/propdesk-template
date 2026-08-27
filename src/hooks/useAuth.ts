import { useCallback, useEffect, useRef, useState } from "react";
import { api, UNAUTHENTICATED_EVENT, type AuthUser } from "../lib/api";
import { purgeCacheKeepingPending } from "../lib/pendingChanges";

/**
 * État d'authentification de l'application.
 *
 * - `loading` : la sonde de démarrage est en cours.
 * - `no-account` : la base n'a aucun compte → première installation.
 * - `unauthenticated` : aucune session valide.
 * - `2fa-required` : mot de passe vérifié, en attente du second facteur
 *   (`TwoFactorVerifyScreen`) avant qu'une session existe.
 * - `authenticated` : session valide, `TraderApp` peut se monter.
 * - `offline` : le serveur est injoignable. On ne peut alors rien vérifier, et
 *   l'application démarre sur le cache local comme avant l'authentification —
 *   c'est un filet anti-perte de données, assumé (voir le README).
 */
export type AuthStatus =
  | "loading"
  | "no-account"
  | "unauthenticated"
  | "2fa-required"
  | "authenticated"
  | "offline";

export interface UseAuthResult {
  status: AuthStatus;
  user: AuthUser | null;
  /** Renseigné quand la session vient d'expirer, pour l'expliquer à l'écran. */
  expired: boolean;
  /**
   * Peut faire passer `status` à `"2fa-required"` au lieu de `"authenticated"`
   * — voir `AuthState`. `rememberMe` (défaut `false`) : voir `api.login`.
   */
  login: (email: string, password: string, rememberMe?: boolean) => Promise<void>;
  /** Jeton de l'étape 2 en attente, renseigné seulement quand `status === "2fa-required"`. */
  pendingTwoFactorToken: string | null;
  verifyTwoFactor: (code: string) => Promise<void>;
  verifyTwoFactorRecovery: (recoveryCode: string) => Promise<void>;
  /** Revient à l'écran de connexion sans appeler le serveur. */
  cancelTwoFactor: () => void;
  setup: (email: string, password: string) => Promise<void>;
  /** Change le mot de passe et lève `mustChangePassword`. */
  changePassword: (currentPassword: string, newPassword: string) => Promise<void>;
  /** Repasse en `unauthenticated` sans appeler le serveur. */
  markLoggedOut: () => void;
  refresh: () => Promise<void>;
}

export function useAuth(): UseAuthResult {
  const [status, setStatus] = useState<AuthStatus>("loading");
  const [user, setUser] = useState<AuthUser | null>(null);
  const [expired, setExpired] = useState(false);
  const [pendingTwoFactorToken, setPendingTwoFactorToken] = useState<string | null>(null);
  /**
   * Choix "Se souvenir de moi" fait à l'étape 1 (mot de passe), à réutiliser
   * tel quel à l'étape 2 (`verifyTwoFactor`/`verifyTwoFactorRecovery`) qui
   * crée la vraie session — une `ref` suffit, jamais lu par le rendu.
   */
  const pendingRememberMeRef = useRef(false);
  /**
   * Miroir de `status`, lu dans `onUnauthenticated` (effet à dépendances
   * vides, donc fermé sur sa toute première valeur sans cette ref).
   */
  const statusRef = useRef<AuthStatus>("loading");
  useEffect(() => {
    statusRef.current = status;
  }, [status]);

  const refresh = useCallback(async () => {
    try {
      const result = await api.fetchMe();
      if (result.state === "authenticated") {
        setUser(result.user);
        setStatus("authenticated");
        setExpired(false);
        return;
      }

      setUser(null);
      setStatus(result.state);
    } catch (err) {
      // Échec réseau, pas un refus : on ne peut rien vérifier sans serveur.
      console.warn("[propdesk] Serveur injoignable, mode hors ligne.", err);
      setUser(null);
      setStatus("offline");
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  /**
   * Une requête revenue en 401 pendant l'usage signifie que la session a expiré
   * ou été révoquée. On ramène à l'écran de connexion plutôt que de laisser
   * l'utilisateur travailler dans le vide.
   *
   * Le cache local peut être la SEULE copie de modifications non envoyées
   * (mode hors ligne, voir `TraderApp.handleLogout`, qui refuse même de se
   * déconnecter hors ligne pour cette raison) : un `localStorage.clear()`
   * total détruirait ce filet de sécurité. On applique donc une purge CIBLÉE
   * (`purgeCacheKeepingPending`) — tout le cache de lecture disparaît, sauf
   * les clés qui portent une modification réellement non envoyée.
   */
  useEffect(() => {
    const onUnauthenticated = () => {
      if (statusRef.current === "authenticated") {
        purgeCacheKeepingPending();
      }
      setUser(null);
      setExpired(true);
      setStatus((prev) => (prev === "authenticated" ? "unauthenticated" : prev));
    };

    window.addEventListener(UNAUTHENTICATED_EVENT, onUnauthenticated);
    return () => window.removeEventListener(UNAUTHENTICATED_EVENT, onUnauthenticated);
  }, []);

  const login = useCallback(async (email: string, password: string, rememberMe = false) => {
    pendingRememberMeRef.current = rememberMe;
    const result = await api.login(email, password, rememberMe);
    if (result.state === "2fa-required") {
      setPendingTwoFactorToken(result.pendingToken);
      setExpired(false);
      setStatus("2fa-required");
      return;
    }
    // `/auth/login` ne renvoie jamais "no-account"/"unauthenticated" côté
    // serveur (seul `authenticatedPayload` ou l'état 2FA ci-dessus) —
    // `AuthState` reste large car partagée avec `fetchMe`, d'où cette garde.
    if (result.state !== "authenticated") {
      throw new Error("Réponse de connexion inattendue.");
    }
    setUser(result.user);
    setExpired(false);
    setStatus("authenticated");
  }, []);

  const verifyTwoFactor = useCallback(
    async (code: string) => {
      if (!pendingTwoFactorToken) throw new Error("Aucune connexion en attente de 2FA.");
      const result = await api.verifyTwoFactor(pendingTwoFactorToken, code, pendingRememberMeRef.current);
      setUser(result.user);
      setPendingTwoFactorToken(null);
      setExpired(false);
      setStatus("authenticated");
    },
    [pendingTwoFactorToken]
  );

  const verifyTwoFactorRecovery = useCallback(
    async (recoveryCode: string) => {
      if (!pendingTwoFactorToken) throw new Error("Aucune connexion en attente de 2FA.");
      const result = await api.verifyTwoFactorRecovery(pendingTwoFactorToken, recoveryCode, pendingRememberMeRef.current);
      setUser(result.user);
      setPendingTwoFactorToken(null);
      setExpired(false);
      setStatus("authenticated");
    },
    [pendingTwoFactorToken]
  );

  const cancelTwoFactor = useCallback(() => {
    setPendingTwoFactorToken(null);
    setStatus("unauthenticated");
  }, []);

  const setup = useCallback(async (email: string, password: string) => {
    const result = await api.setup(email, password);
    setUser(result.user);
    setExpired(false);
    setStatus("authenticated");
  }, []);

  const changePassword = useCallback(async (currentPassword: string, newPassword: string) => {
    const result = await api.changePassword(currentPassword, newPassword);
    setUser(result.user);
  }, []);

  const markLoggedOut = useCallback(() => {
    setUser(null);
    setPendingTwoFactorToken(null);
    setExpired(false);
    setStatus("unauthenticated");
  }, []);

  return {
    status,
    user,
    expired,
    login,
    pendingTwoFactorToken,
    verifyTwoFactor,
    verifyTwoFactorRecovery,
    cancelTwoFactor,
    setup,
    changePassword,
    markLoggedOut,
    refresh,
  };
}
