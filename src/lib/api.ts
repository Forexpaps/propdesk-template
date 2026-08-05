import {
  StudentProfile,
  Trade,
  TradingAccount,
  CoachSignal,
  CoachMessage,
  ForumTopic,
  AppNotification,
  EnrolledStudent,
  TraderBadge,
  Module,
  ModuleQuizResult,
} from "../types";

/** Collections synchronisées avec le serveur, dans les formes de src/types.ts. */
export interface ServerCollections {
  trades: Trade[];
  accounts: TradingAccount[];
  signals: CoachSignal[];
  messages: CoachMessage[];
  forumTopics: ForumTopic[];
  notifications: AppNotification[];
  enrolledStudents: EnrolledStudent[];
  badges: TraderBadge[];
  modules: Module[];
}

export type CollectionName = keyof ServerCollections;

export interface ServerState {
  bootstrapped: boolean;
  student: StudentProfile | null;
  quizResults: Record<string, ModuleQuizResult>;
  collections: ServerCollections;
}

/** État d'authentification renvoyé par `/api/auth/me`. */
export interface AuthUser {
  id: string;
  name: string;
  email: string;
  isAdmin: boolean;
  /** Vrai après une invitation, tant que le mot de passe temporaire est actif. */
  mustChangePassword: boolean;
}

export type AuthState =
  | { state: "no-account" }
  | { state: "unauthenticated" }
  | { state: "authenticated"; user: AuthUser };

/** Compte staff tel que listé dans l'écran de gestion de l'équipe. */
export interface StaffAccountSummary {
  id: string;
  name: string;
  email: string;
  mustChangePassword: boolean;
  createdAt: string;
}

/**
 * Événement émis dès qu'une requête revient en 401.
 *
 * Sans cela, une session expirée en cours d'usage se traduirait par des
 * `console.warn` silencieux dans `useSyncedState` : l'utilisateur continuerait de
 * travailler en croyant que ses données se sauvegardent. Un événement du
 * document évite un contexte React et un import circulaire entre ce module et
 * les hooks.
 */
export const UNAUTHENTICATED_EVENT = "propdesk:unauthenticated";

/** Levée sur 401, pour que les appelants puissent la distinguer. */
export class UnauthenticatedError extends Error {
  constructor(message = "Session expirée ou absente.") {
    super(message);
    this.name = "UnauthenticatedError";
  }
}

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    headers: { "Content-Type": "application/json" },
    // Déjà le défaut pour une URL relative, mais explicite : l'intention est
    // lisible et le comportement survit à un passage en URL absolue.
    credentials: "same-origin",
    ...init,
  });

  if (response.status === 401) {
    window.dispatchEvent(new CustomEvent(UNAUTHENTICATED_EVENT));
    throw new UnauthenticatedError();
  }

  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(
      (body as { error?: string }).error ?? `Requête ${url} échouée (${response.status})`
    );
  }

  // 204 sans corps : `response.json()` lèverait.
  if (response.status === 204) return undefined as unknown as T;

  return response.json() as Promise<T>;
}

export const api = {
  fetchState: () => request<ServerState>("/api/state"),

  saveCollection: <K extends CollectionName>(name: K, items: ServerCollections[K]) =>
    request<{ success: true }>(`/api/collections/${name}`, {
      method: "PUT",
      body: JSON.stringify(items),
    }),

  saveProfile: (student: StudentProfile) =>
    request<{ success: true }>("/api/profile", {
      method: "PUT",
      body: JSON.stringify(student),
    }),

  saveQuizResults: (results: Record<string, ModuleQuizResult>) =>
    request<{ success: true }>("/api/quiz-results", {
      method: "PUT",
      body: JSON.stringify(results),
    }),

  seedDemoData: () =>
    request<{ success: true }>("/api/state/seed", { method: "POST" }),

  importState: (state: {
    student?: StudentProfile;
    collections?: Partial<ServerCollections>;
    quizResults?: Record<string, ModuleQuizResult>;
  }) =>
    request<{ success: true; imported: string[] }>("/api/state/import", {
      method: "POST",
      body: JSON.stringify(state),
    }),

  // --- Authentification ---

  /** Sonde d'état du démarrage. Répond toujours 200. */
  fetchMe: () => request<AuthState>("/api/auth/me"),

  login: (email: string, password: string) =>
    request<Extract<AuthState, { state: "authenticated" }>>("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    }),

  /** Première installation : rattache des identifiants au profil existant. */
  setup: (email: string, password: string) =>
    request<Extract<AuthState, { state: "authenticated" }>>("/api/auth/setup", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    }),

  logout: () => request<void>("/api/auth/logout", { method: "POST" }),

  changePassword: (currentPassword: string, newPassword: string) =>
    request<Extract<AuthState, { state: "authenticated" }>>("/api/auth/change-password", {
      method: "POST",
      body: JSON.stringify({ currentPassword, newPassword }),
    }),

  listStaff: () =>
    request<{ accounts: StaffAccountSummary[] }>("/api/auth/staff"),

  /** Invite un nouveau compte staff. Le mot de passe temporaire n'est renvoyé qu'ici. */
  inviteStaff: (name: string, email: string) =>
    request<StaffAccountSummary & { temporaryPassword: string }>("/api/auth/staff", {
      method: "POST",
      body: JSON.stringify({ name, email }),
    }),

  removeStaff: (id: string) =>
    request<void>(`/api/auth/staff/${encodeURIComponent(id)}`, { method: "DELETE" }),
};
