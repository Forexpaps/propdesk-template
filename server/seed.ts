import { getMeta, setMeta } from "./db";
import {
  replaceCollection,
  replaceQuizResults,
  saveProfile,
  CollectionName,
} from "./repositories";
import {
  initialStudentProfile,
  initialModules,
  initialTrades,
  initialMessages,
  initialForumTopics,
  initialTradingAccounts,
  initialTraderBadges,
  initialEnrolledStudents,
  initialNotifications,
} from "../src/data/mockData";

const BOOTSTRAP_KEY = "bootstrapped_at";

export function isBootstrapped(): boolean {
  return getMeta(BOOTSTRAP_KEY) !== null;
}

function markBootstrapped(): void {
  setMeta(BOOTSTRAP_KEY, new Date().toISOString());
}

/**
 * Écrit un jeu de données complet, quelle qu'en soit l'origine, et marque la
 * base comme amorcée. Sert à la fois au seed de démonstration et à l'import
 * des données que l'utilisateur avait dans son localStorage.
 */
export function writeFullState(state: {
  student: unknown;
  collections: Partial<Record<CollectionName, { id: string }[]>>;
  quizResults?: Record<string, unknown>;
}): void {
  saveProfile(state.student);

  (Object.entries(state.collections) as [CollectionName, { id: string }[]][]).forEach(
    ([name, items]) => {
      if (Array.isArray(items)) replaceCollection(name, items);
    }
  );

  replaceQuizResults(state.quizResults ?? {});
  markBootstrapped();
}

/**
 * Amorce la base avec les données de démonstration.
 *
 * Déclenché par le client, et non au démarrage du serveur : sinon la base
 * serait toujours déjà amorcée à l'arrivée du premier navigateur, et les
 * données que celui-ci détient encore en localStorage ne pourraient jamais
 * être reprises.
 */
export function seedDemoData(): void {
  if (isBootstrapped()) return;

  writeFullState({
    student: initialStudentProfile,
    collections: {
      trades: initialTrades,
      accounts: initialTradingAccounts,
      messages: initialMessages,
      forumTopics: initialForumTopics,
      notifications: initialNotifications,
      enrolledStudents: initialEnrolledStudents,
      badges: initialTraderBadges,
      modules: initialModules,
    },
    quizResults: {},
  });

  console.log("Base Horizon amorcée avec le jeu de données de démonstration.");
}
