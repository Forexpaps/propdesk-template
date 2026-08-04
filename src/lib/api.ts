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

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    headers: { "Content-Type": "application/json" },
    ...init,
  });

  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(
      (body as { error?: string }).error ?? `Requête ${url} échouée (${response.status})`
    );
  }

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
};
