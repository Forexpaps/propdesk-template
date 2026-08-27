import { getMeta, setMeta } from "./db";
import {
  replaceCollection,
  saveProfile,
  CollectionName,
} from "./repositories";
import {
  initialStudentProfile,
  initialTrades,
  initialTradingAccounts,
  initialTraderBadges,
  initialNotifications,
} from "../src/data/mockData";

const BOOTSTRAP_KEY = "bootstrapped_at";

export async function isBootstrapped(): Promise<boolean> {
  return (await getMeta(BOOTSTRAP_KEY)) !== null;
}

async function markBootstrapped(): Promise<void> {
  await setMeta(BOOTSTRAP_KEY, new Date().toISOString());
}

/**
 * Écrit un jeu de données complet, quelle qu'en soit l'origine, et marque la
 * base comme amorcée. Sert à la fois au seed de démonstration et à l'import
 * des données que l'utilisateur avait dans son localStorage.
 *
 * `replaceCollection` fait déjà sa propre transaction interne (le client
 * libSQL ne supporte pas les transactions imbriquées comme le faisait
 * better-sqlite3 via savepoints) : les écritures s'enchaînent donc ici
 * séquentiellement plutôt que dans une seule transaction englobante. Un
 * échec en cours de boucle (ex. `CollectionOwnershipConflictError` sur un
 * import corrompu) peut donc laisser les collections déjà écrites en base
 * alors que `bootstrapped_at` n'est jamais posé — état partiel possible en
 * théorie sur un import concurrent malformé, accepté ici : ce chemin ne sert
 * qu'au tout premier amorçage (seed de démonstration, ou reprise du
 * localStorage), jamais exposé à une écriture concurrente réelle.
 */
export async function writeFullState(state: {
  student: unknown;
  collections: Partial<Record<CollectionName, { id: string }[]>>;
}): Promise<void> {
  await saveProfile(state.student);

  for (const [name, items] of Object.entries(state.collections) as [
    CollectionName,
    { id: string }[]
  ][]) {
    if (Array.isArray(items)) await replaceCollection(name, items);
  }

  await markBootstrapped();
}

/**
 * Amorce la base avec les données de démonstration.
 *
 * Déclenché par le client, et non au démarrage du serveur : sinon la base
 * serait toujours déjà amorcée à l'arrivée du premier navigateur, et les
 * données que celui-ci détient encore en localStorage ne pourraient jamais
 * être reprises.
 */
export async function seedDemoData(): Promise<void> {
  if (await isBootstrapped()) return;

  await writeFullState({
    student: initialStudentProfile,
    collections: {
      trades: initialTrades,
      accounts: initialTradingAccounts,
      notifications: initialNotifications,
      badges: initialTraderBadges,
    },
  });

  console.log("Base Horizon amorcée avec le jeu de données de démonstration.");
}
