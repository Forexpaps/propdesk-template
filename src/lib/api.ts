import {
  StudentProfile,
  Trade,
  TradingAccount,
  CoachMessage,
  AppNotification,
  EnrolledStudent,
  TraderBadge,
  Module,
  ModuleQuizResult,
  Coach,
  TradingPlanData,
  Setup,
} from "../types";

/** Collections synchronisées avec le serveur, dans les formes de src/types.ts. */
export interface ServerCollections {
  trades: Trade[];
  accounts: TradingAccount[];
  messages: CoachMessage[];
  notifications: AppNotification[];
  enrolledStudents: EnrolledStudent[];
  badges: TraderBadge[];
  modules: Module[];
  setups: Setup[];
}

export type CollectionName = keyof ServerCollections;

/** Événement du calendrier économique — voir `server/economicCalendar.ts`. */
export interface EconomicCalendarEvent {
  id: string;
  title: string;
  country: string;
  date: string;
  impact: string;
  forecast: string;
  previous: string;
}

/** Cotation de marché — voir `server/marketData.ts`. */
export interface MarketQuote {
  symbol: string;
  label: string;
  price: number;
  previousClose: number;
  changePercent: number;
  sparkline: number[];
}

export interface ServerState {
  bootstrapped: boolean;
  student: StudentProfile | null;
  quizResults: Record<string, ModuleQuizResult>;
  collections: ServerCollections;
  /**
   * Présent uniquement pour une session élève : le coach reconstruit depuis
   * le vrai profil fondateur (voir `buildCoachesForStudent`,
   * `server/routes.ts`). Absent pour une session staff, qui construit sa
   * propre entrée directement depuis son profil déjà en mémoire.
   */
  coaches?: Coach[];
  /**
   * Présent uniquement pour une session élève — `null` si l'élève n'a jamais
   * enregistré de plan. Voir `getTradingPlan`, `server/repositories.ts`.
   */
  tradingPlan?: TradingPlanData | null;
}

/** État d'authentification renvoyé par `/api/auth/me`. */
export interface AuthUser {
  id: string;
  name: string;
  email: string;
  isAdmin: boolean;
  /** Vrai après une invitation, tant que le mot de passe temporaire est actif. */
  mustChangePassword: boolean;
  /**
   * Vrai pour le seul compte fondateur. Ne conditionne que le réglage des
   * modules visibles dans la sidebar : les coachs gardent tous les autres
   * droits.
   */
  isOwner: boolean;
}

export type AuthState =
  | { state: "no-account" }
  | { state: "unauthenticated" }
  | { state: "authenticated"; user: AuthUser }
  /**
   * Mot de passe vérifié, mais la 2FA du compte exige un second facteur
   * avant qu'une session ne soit créée — voir `POST /auth/login/2fa`.
   * `pendingToken` doit lui être transmis, il expire après 5 minutes.
   */
  | { state: "2fa-required"; pendingToken: string };

/** État d'authentification élève, renvoyé par `/api/auth/student-me`. */
export interface StudentAuthUser {
  id: string;
  email: string;
  mustChangePassword: boolean;
}

export type StudentAuthState =
  | { state: "unauthenticated" }
  | { state: "authenticated"; user: StudentAuthUser };

/** Compte staff tel que listé dans l'écran de gestion de l'équipe. */
export interface StaffAccountSummary {
  id: string;
  name: string;
  email: string;
  mustChangePassword: boolean;
  createdAt: string;
  /** Le compte fondateur : non supprimable, seul à régler les modules visibles. */
  isOwner: boolean;
}

/** Journal de sécurité — voir `server/auth/securityEvents.ts`. */
export type SecuritySeverity = "info" | "warning" | "critical";

export interface SecurityEvent {
  id: string;
  createdAt: string;
  eventType: string;
  severity: SecuritySeverity;
  accountKind: "staff" | "student" | null;
  accountEmail: string | null;
  ip: string | null;
  detail: string;
}

export interface SecurityEventFilters {
  severity?: SecuritySeverity;
  eventType?: string;
  limit?: number;
  offset?: number;
}

export interface SecurityLogResponse {
  events: SecurityEvent[];
  total: number;
  retentionDays: number;
  stats: {
    loginSuccess: number;
    loginFailed: number;
    lockouts: number;
    accessDenied: number;
  };
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

  /** Enregistre le plan de trading de l'élève connecté (lui seul peut l'écrire). */
  saveTradingPlan: (plan: TradingPlanData) =>
    request<void>("/api/auth/trading-plan", {
      method: "PUT",
      body: JSON.stringify(plan),
    }),

  saveQuizResults: (results: Record<string, ModuleQuizResult>) =>
    request<{ success: true }>("/api/quiz-results", {
      method: "PUT",
      body: JSON.stringify(results),
    }),

  seedDemoData: () =>
    request<{ success: true }>("/api/state/seed", { method: "POST" }),

  /** Annonces économiques de la semaine — flux public ForexFactory, mis en cache côté serveur. */
  fetchEconomicCalendar: () =>
    request<{ events: EconomicCalendarEvent[] }>("/api/economic-calendar"),

  /** Cotations de marché en direct — flux non officiel Yahoo Finance, mis en cache côté serveur. */
  fetchMarketData: () =>
    request<{ quotes: MarketQuote[] }>("/api/market-data"),

  importState: (state: {
    student?: StudentProfile;
    collections?: Partial<ServerCollections>;
    quizResults?: Record<string, ModuleQuizResult>;
  }) =>
    request<{ success: true; imported: string[] }>("/api/state/import", {
      method: "POST",
      body: JSON.stringify(state),
    }),

  /**
   * Restaure une sauvegarde JSON précédemment exportée (« Données &
   * Sauvegarde » dans le profil) — remplace le profil, les collections et
   * les résultats de quiz de l'appelant. Distincte de `importState` : celle-ci
   * fonctionne à tout moment sur une base déjà en service, pas uniquement au
   * tout premier amorçage.
   */
  restoreState: (state: {
    student?: StudentProfile;
    collections?: Partial<ServerCollections>;
    quizResults?: Record<string, ModuleQuizResult>;
  }) =>
    request<{ success: true; imported: string[]; skipped: string[] }>("/api/state/restore", {
      method: "POST",
      body: JSON.stringify(state),
    }),

  // --- Authentification ---

  /** Sonde d'état du démarrage. Répond toujours 200. */
  fetchMe: () => request<AuthState>("/api/auth/me"),

  /** Peut renvoyer `{ state: "2fa-required" }` — voir `AuthState`. */
  login: (email: string, password: string) =>
    request<AuthState>("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    }),

  /** Étape 2 de connexion : code TOTP à 6 chiffres. */
  verifyTwoFactor: (pendingToken: string, code: string) =>
    request<Extract<AuthState, { state: "authenticated" }>>("/api/auth/login/2fa", {
      method: "POST",
      body: JSON.stringify({ pendingToken, code }),
    }),

  /** Étape 2 de connexion, avec un code de récupération à usage unique à la place du TOTP. */
  verifyTwoFactorRecovery: (pendingToken: string, recoveryCode: string) =>
    request<Extract<AuthState, { state: "authenticated" }>>("/api/auth/login/2fa", {
      method: "POST",
      body: JSON.stringify({ pendingToken, recoveryCode }),
    }),

  /** État 2FA du compte staff connecté. */
  fetch2FAStatus: () =>
    request<{ enabled: boolean; remainingRecoveryCodes: number }>("/api/auth/2fa/status"),

  /** Démarre une configuration 2FA — secret pas encore actif tant que `enable2FA` n'a pas confirmé un code. */
  setup2FA: () =>
    request<{ secret: string; otpauthUri: string }>("/api/auth/2fa/setup", { method: "POST" }),

  /** Confirme la configuration et active la 2FA. Les codes de récupération ne sont renvoyés qu'ici, une seule fois. */
  enable2FA: (code: string) =>
    request<{ recoveryCodes: string[] }>("/api/auth/2fa/enable", {
      method: "POST",
      body: JSON.stringify({ code }),
    }),

  disable2FA: (password: string) =>
    request<void>("/api/auth/2fa/disable", {
      method: "POST",
      body: JSON.stringify({ password }),
    }),

  /** Invalide les codes de récupération existants et en génère 8 nouveaux, renvoyés une seule fois. */
  regenerateRecoveryCodes: (password: string) =>
    request<{ recoveryCodes: string[] }>("/api/auth/2fa/recovery-codes/regenerate", {
      method: "POST",
      body: JSON.stringify({ password }),
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

  // --- Accès élève (compte personnel, journal cloisonné) ---

  /** Donne un accès élève depuis une fiche EnrolledStudent. Mot de passe renvoyé une seule fois. */
  inviteStudent: (enrolledStudentId: string) =>
    request<{ studentAccountId: string; email: string; temporaryPassword: string }>(
      `/api/auth/students/${encodeURIComponent(enrolledStudentId)}/invite`,
      { method: "POST" }
    ),

  /** Révoque l'accès élève d'une fiche. Ne supprime ni la fiche ni ses trades. */
  revokeStudentAccess: (enrolledStudentId: string) =>
    request<void>(`/api/auth/students/${encodeURIComponent(enrolledStudentId)}/access`, {
      method: "DELETE",
    }),

  /** Fixe directement le mot de passe d'un compte élève. Déconnecte ses sessions en cours. */
  setStudentPassword: (enrolledStudentId: string, newPassword: string) =>
    request<void>(`/api/auth/students/${encodeURIComponent(enrolledStudentId)}/password`, {
      method: "PUT",
      body: JSON.stringify({ newPassword }),
    }),

  /** Change l'identifiant (email) de connexion d'un compte élève déjà créé. */
  updateStudentEmail: (enrolledStudentId: string, email: string) =>
    request<void>(`/api/auth/students/${encodeURIComponent(enrolledStudentId)}/email`, {
      method: "PUT",
      body: JSON.stringify({ email }),
    }),

  /** Génère un lien de réinitialisation à transmettre à la main. Le lien n'est renvoyé qu'ici, une seule fois. */
  generateStudentResetLink: (enrolledStudentId: string) =>
    request<{ link: string; expiresAt: string }>(
      `/api/auth/students/${encodeURIComponent(enrolledStudentId)}/reset-link`,
      { method: "POST" }
    ),

  /** Consomme un lien de réinitialisation — public, aucune session requise. */
  consumePasswordReset: (token: string, newPassword: string) =>
    request<void>(`/api/auth/reset-password/${encodeURIComponent(token)}`, {
      method: "POST",
      body: JSON.stringify({ newPassword }),
    }),

  /**
   * Vrais trades d'un élève, en lecture — pour la fiche côté coach.
   * `email` : le vrai email de connexion (`student_accounts.email`),
   * distinct du champ "Email" de la fiche (`EnrolledStudent.email`).
   */
  fetchStudentTrades: (enrolledStudentId: string) =>
    request<{ trades: Trade[]; accounts: TradingAccount[]; email: string }>(
      `/api/auth/students/${encodeURIComponent(enrolledStudentId)}/trades`
    ),

  /** Vue complète d'un élève pour l'admin — profil, comptes, trades, etc. (lecture seule) */
  fetchAdminStudentView: (enrolledStudentId: string) =>
    request<{
      student: StudentProfile | null;
      collections: {
        enrolledStudents: EnrolledStudent[];
        accounts: TradingAccount[];
        trades: Trade[];
        modules: Module[];
        messages: CoachMessage[];
        setups: Setup[];
      };
      tradingPlan: TradingPlanData | null;
    }>(`/api/auth/admin/students/${encodeURIComponent(enrolledStudentId)}/view`),

  /**
   * Journal de sécurité, réservé au compte fondateur (le serveur renvoie
   * 403 sinon). Premier usage de `URLSearchParams` dans ce fichier : les
   * autres routes GET n'ont aucun paramètre de filtre.
   */
  fetchSecurityLog: (filters: SecurityEventFilters = {}) => {
    const params = new URLSearchParams();
    if (filters.severity) params.set("severity", filters.severity);
    if (filters.eventType) params.set("eventType", filters.eventType);
    params.set("limit", String(filters.limit ?? 50));
    params.set("offset", String(filters.offset ?? 0));
    return request<SecurityLogResponse>(`/api/auth/security-events?${params.toString()}`);
  },

  /** Envoie un message de coach dans le fil d'un élève précis. */
  sendMessageToStudent: (enrolledStudentId: string, text: string) =>
    request<{ message: CoachMessage }>(
      `/api/auth/admin/students/${encodeURIComponent(enrolledStudentId)}/messages`,
      { method: "POST", body: JSON.stringify({ text }) }
    ),

  // --- Authentification élève ---

  fetchStudentMe: () => request<StudentAuthState>("/api/auth/student-me"),

  studentLogin: (email: string, password: string) =>
    request<Extract<StudentAuthState, { state: "authenticated" }>>("/api/auth/student-login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    }),

  studentLogout: () => request<void>("/api/auth/student-logout", { method: "POST" }),

  studentChangePassword: (currentPassword: string, newPassword: string) =>
    request<Extract<StudentAuthState, { state: "authenticated" }>>(
      "/api/auth/student-change-password",
      {
        method: "POST",
        body: JSON.stringify({ currentPassword, newPassword }),
      }
    ),

  /** Un élève choisit sa propre photo de profil — voir server/auth/studentRoutes.ts pour le détail. */
  updateStudentAvatar: (avatar: string) =>
    request<void>("/api/auth/profile/avatar", {
      method: "PUT",
      body: JSON.stringify({ avatar }),
    }),
};
