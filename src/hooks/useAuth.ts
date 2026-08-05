import { useCallback, useEffect, useState } from "react";
import { api, UNAUTHENTICATED_EVENT, type AuthUser } from "../lib/api";

/**
 * État d'authentification de l'application.
 *
 * - `loading` : la sonde de démarrage est en cours.
 * - `no-account` : la base n'a aucun identifiant → première installation.
 * - `unauthenticated` : un compte existe, mais pas de session valide.
 * - `authenticated` : session valide, l'application peut se monter.
 * - `offline` : le serveur est injoignable. On ne peut alors rien vérifier, et
 *   l'application démarre sur le cache local comme avant l'authentification —
 *   c'est un filet anti-perte de données, assumé (voir le README).
 */
export type AuthStatus =
  | "loading"
  | "no-account"
  | "unauthenticated"
  | "authenticated"
  | "offline";

export interface UseAuthResult {
  status: AuthStatus;
  user: AuthUser | null;
  /** Renseigné quand la session vient d'expirer, pour l'expliquer à l'écran. */
  expired: boolean;
  login: (email: string, password: string) => Promise<void>;
  setup: (email: string, password: string) => Promise<void>;
  /** Repasse en `unauthenticated` sans appeler le serveur. */
  markLoggedOut: () => void;
  refresh: () => Promise<void>;
}

export function useAuth(): UseAuthResult {
  const [status, setStatus] = useState<AuthStatus>("loading");
  const [user, setUser] = useState<AuthUser | null>(null);
  const [expired, setExpired] = useState(false);

  /**
   * Un seul aller-retour au démarrage : l'union discriminée de `/api/auth/me`
   * couvre les trois cas, le démarrage reste donc aussi rapide qu'avant.
   */
  const refresh = useCallback(async () => {
    try {
      const result = await api.fetchMe();
      if (result.state === "authenticated") {
        setUser(result.user);
        setStatus("authenticated");
        setExpired(false);
      } else {
        setUser(null);
        setStatus(result.state);
      }
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
   */
  useEffect(() => {
    const onUnauthenticated = () => {
      setUser(null);
      setExpired(true);
      setStatus((prev) => (prev === "authenticated" ? "unauthenticated" : prev));
    };

    window.addEventListener(UNAUTHENTICATED_EVENT, onUnauthenticated);
    return () => window.removeEventListener(UNAUTHENTICATED_EVENT, onUnauthenticated);
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const result = await api.login(email, password);
    setUser(result.user);
    setExpired(false);
    setStatus("authenticated");
  }, []);

  const setup = useCallback(async (email: string, password: string) => {
    const result = await api.setup(email, password);
    setUser(result.user);
    setExpired(false);
    setStatus("authenticated");
  }, []);

  const markLoggedOut = useCallback(() => {
    setUser(null);
    setExpired(false);
    setStatus("unauthenticated");
  }, []);

  return { status, user, expired, login, setup, markLoggedOut, refresh };
}
