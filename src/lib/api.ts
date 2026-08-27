import {
  StudentProfile,
  Trade,
  TradingAccount,
  AppNotification,
  TraderBadge,
  Setup,
} from "../types";

/** Collections synchronisées avec le serveur, dans les formes de src/types.ts. */
export interface ServerCollections {
  trades: Trade[];
  accounts: TradingAccount[];
  notifications: AppNotification[];
  badges: TraderBadge[];
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
  collections: ServerCollections;
  /**
   * Version actuelle de chaque collection modifiable, pour détecter qu'un
   * autre onglet l'a modifiée entre-temps — voir le commentaire au-dessus de
   * `saveCollection`.
   */
  versions?: Partial<Record<CollectionName, number>>;
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
  | { state: "authenticated"; user: AuthUser }
  /**
   * Mot de passe vérifié, mais la 2FA du compte exige un second facteur
   * avant qu'une session ne soit créée — voir `POST /auth/login/2fa`.
   * `pendingToken` doit lui être transmis, il expire après 5 minutes.
   */
  | { state: "2fa-required"; pendingToken: string };

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

/**
 * Dernière version connue de chaque collection, tenue à jour par
 * `fetchState` et par chaque `saveCollection` réussi — jamais exposée en
 * dehors de ce module. Sert de verrouillage optimiste transparent : les
 * appelants (`useSyncedState`, `App.tsx`) n'ont rien à savoir des versions,
 * seul `saveCollection` en a besoin pour que le serveur puisse détecter
 * qu'un AUTRE onglet (ou un autre coach sur le même bureau partagé) a écrit
 * cette collection entre-temps, et refuser plutôt qu'écraser en silence —
 * voir le commentaire de `collection_versions` (server/db.ts).
 */
const collectionVersions: Partial<Record<CollectionName, number>> = {};

export const api = {
  fetchState: async () => {
    const state = await request<ServerState>("/api/state");
    if (state.versions) Object.assign(collectionVersions, state.versions);
    return state;
  },

  saveCollection: async <K extends CollectionName>(name: K, items: ServerCollections[K]) => {
    const version = collectionVersions[name];
    const result = await request<{ success: true; version?: number }>(`/api/collections/${name}`, {
      method: "PUT",
      body: JSON.stringify({ items, version }),
    });
    if (typeof result.version === "number") collectionVersions[name] = result.version;
    return result;
  },

  saveProfile: (student: StudentProfile) =>
    request<{ success: true }>("/api/profile", {
      method: "PUT",
      body: JSON.stringify(student),
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
  }) =>
    request<{ success: true; imported: string[]; skipped: string[] }>("/api/state/restore", {
      method: "POST",
      body: JSON.stringify(state),
    }),

  // --- Authentification ---

  /** Sonde d'état du démarrage. Répond toujours 200. */
  fetchMe: () => request<AuthState>("/api/auth/me"),

  /**
   * Peut renvoyer `{ state: "2fa-required" }` — voir `AuthState`.
   * `rememberMe` (défaut `false`) : décoché, le cookie posé est un cookie de
   * session (effacé à la fermeture du navigateur) — pertinent sur un poste
   * partagé (salle de l'académie). Voir `setSessionCookie`/`server/schemas.ts`.
   */
  login: (password: string, rememberMe = false) =>
    request<AuthState>("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ password, rememberMe }),
    }),

  /** Étape 2 de connexion : code TOTP à 6 chiffres. `rememberMe` doit être le même choix qu'à l'étape 1 (mot de passe). */
  verifyTwoFactor: (pendingToken: string, code: string, rememberMe = false) =>
    request<Extract<AuthState, { state: "authenticated" }>>("/api/auth/login/2fa", {
      method: "POST",
      body: JSON.stringify({ pendingToken, code, rememberMe }),
    }),

  /** Étape 2 de connexion, avec un code de récupération à usage unique à la place du TOTP. */
  verifyTwoFactorRecovery: (pendingToken: string, recoveryCode: string, rememberMe = false) =>
    request<Extract<AuthState, { state: "authenticated" }>>("/api/auth/login/2fa", {
      method: "POST",
      body: JSON.stringify({ pendingToken, recoveryCode, rememberMe }),
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

  /** Première installation : définit le mot de passe du seul compte de cette instance. */
  setup: (password: string) =>
    request<Extract<AuthState, { state: "authenticated" }>>("/api/auth/setup", {
      method: "POST",
      body: JSON.stringify({ password }),
    }),

  logout: () => request<void>("/api/auth/logout", { method: "POST" }),

  changePassword: (currentPassword: string, newPassword: string) =>
    request<Extract<AuthState, { state: "authenticated" }>>("/api/auth/change-password", {
      method: "POST",
      body: JSON.stringify({ currentPassword, newPassword }),
    }),

};
