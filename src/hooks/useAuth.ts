import { useCallback, useEffect, useRef, useState } from "react";
import { api, UNAUTHENTICATED_EVENT, type AuthUser, type StudentAuthUser } from "../lib/api";

/**
 * État d'authentification de l'application.
 *
 * - `loading` : la sonde de démarrage est en cours.
 * - `no-account` : la base n'a aucun identifiant staff → première installation.
 * - `unauthenticated` : aucune session (ni staff, ni élève) valide.
 * - `authenticated` : session staff valide, `AcademyApp` peut se monter.
 * - `authenticated-student` : session élève valide, le Journal cloisonné peut
 *   se monter — jamais `AcademyApp`.
 * - `offline` : le serveur est injoignable. On ne peut alors rien vérifier, et
 *   l'application démarre sur le cache local comme avant l'authentification —
 *   c'est un filet anti-perte de données, assumé (voir le README). Ne
 *   concerne que le monde staff : il n'existe pas de mode hors ligne élève.
 */
export type AuthStatus =
  | "loading"
  | "no-account"
  | "unauthenticated"
  | "authenticated"
  | "authenticated-student"
  | "offline";

export interface UseAuthResult {
  status: AuthStatus;
  user: AuthUser | null;
  /** Renseigné seulement quand `status === "authenticated-student"`. */
  studentUser: StudentAuthUser | null;
  /** Renseigné quand la session vient d'expirer, pour l'expliquer à l'écran. */
  expired: boolean;
  login: (email: string, password: string) => Promise<void>;
  setup: (email: string, password: string) => Promise<void>;
  /** Change le mot de passe et lève `mustChangePassword`. */
  changePassword: (currentPassword: string, newPassword: string) => Promise<void>;
  studentLogin: (email: string, password: string) => Promise<void>;
  studentChangePassword: (currentPassword: string, newPassword: string) => Promise<void>;
  /** Repasse en `unauthenticated` sans appeler le serveur. */
  markLoggedOut: () => void;
  refresh: () => Promise<void>;
}

export function useAuth(): UseAuthResult {
  const [status, setStatus] = useState<AuthStatus>("loading");
  const [user, setUser] = useState<AuthUser | null>(null);
  const [studentUser, setStudentUser] = useState<StudentAuthUser | null>(null);
  const [expired, setExpired] = useState(false);
  /**
   * Miroir de `status`, lu dans `onUnauthenticated` (effet à dépendances
   * vides, donc fermé sur sa toute première valeur sans cette ref).
   */
  const statusRef = useRef<AuthStatus>("loading");
  useEffect(() => {
    statusRef.current = status;
  }, [status]);

  /**
   * Deux mondes de session possibles, deux cookies distincts : on interroge
   * d'abord `/api/auth/me` (staff, comportement inchangé), et seulement s'il
   * ne trouve aucune session valide, `/api/auth/student-me`. Un navigateur
   * n'a normalement jamais les deux à la fois, mais si c'était le cas, le
   * staff prime.
   */
  const refresh = useCallback(async () => {
    try {
      const result = await api.fetchMe();
      if (result.state === "authenticated") {
        setUser(result.user);
        setStudentUser(null);
        setStatus("authenticated");
        setExpired(false);
        return;
      }

      const studentResult = await api.fetchStudentMe();
      if (studentResult.state === "authenticated") {
        setUser(null);
        setStudentUser(studentResult.user);
        setStatus("authenticated-student");
        setExpired(false);
        return;
      }

      setUser(null);
      setStudentUser(null);
      setStatus(result.state);
    } catch (err) {
      // Échec réseau, pas un refus : on ne peut rien vérifier sans serveur.
      console.warn("[propdesk] Serveur injoignable, mode hors ligne.", err);
      setUser(null);
      setStudentUser(null);
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
   * Pour une session ÉLÈVE, ceci vide aussi `localStorage` — même geste que
   * la déconnexion volontaire (`App.tsx`, `StudentAuthenticatedApp.handleLogout`).
   * Sans ça, l'expiration NATURELLE d'une session (cas de loin le plus
   * fréquent en pratique — fermeture d'onglet, cookie qui expire tout seul —
   * plutôt qu'un clic explicite sur "Déconnexion") laissait le cache
   * `horizon_student_*` intact. Sur un poste partagé (salle de l'académie),
   * l'élève suivant qui se connectait pouvait alors se voir *rejouer
   * automatiquement* les données en attente du précédent
   * (`useStudentBootstrap`, rejeu silencieux ajouté pour ne jamais laisser une
   * sauvegarde échouée bloquée) — écrasant son propre journal avec celui d'un
   * autre élève, sous sa propre session. Faille de sécurité réelle, trouvée en
   * audit, corrigée ici à la source plutôt qu'au seul point d'entrée du clic.
   *
   * Le monde STAFF n'est volontairement pas concerné : `AcademyApp` a son
   * propre mode hors ligne où le cache local est la SEULE copie de
   * modifications non envoyées (voir son `handleLogout`, qui refuse même de
   * se déconnecter hors ligne pour cette raison) — le vider automatiquement
   * ici détruirait ce filet de sécurité au lieu de le protéger.
   */
  useEffect(() => {
    const onUnauthenticated = () => {
      if (statusRef.current === "authenticated-student") {
        try {
          localStorage.clear();
        } catch {
          // Stockage indisponible : il n'y avait alors rien à oublier.
        }
      }
      setUser(null);
      setStudentUser(null);
      setExpired(true);
      setStatus((prev) =>
        prev === "authenticated" || prev === "authenticated-student" ? "unauthenticated" : prev
      );
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

  const changePassword = useCallback(async (currentPassword: string, newPassword: string) => {
    const result = await api.changePassword(currentPassword, newPassword);
    setUser(result.user);
  }, []);

  const studentLogin = useCallback(async (email: string, password: string) => {
    const result = await api.studentLogin(email, password);
    setStudentUser(result.user);
    setExpired(false);
    setStatus("authenticated-student");
  }, []);

  const studentChangePassword = useCallback(
    async (currentPassword: string, newPassword: string) => {
      const result = await api.studentChangePassword(currentPassword, newPassword);
      setStudentUser(result.user);
    },
    []
  );

  const markLoggedOut = useCallback(() => {
    setUser(null);
    setStudentUser(null);
    setExpired(false);
    setStatus("unauthenticated");
  }, []);

  return {
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
  };
}
