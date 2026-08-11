import { db, DEFAULT_USER_ID } from "./db";

/**
 * Nom logique d'une collection, tel qu'exposé par l'API et attendu par le
 * client. La table sous-jacente est un détail d'implémentation.
 */
export type CollectionName =
  | "trades"
  | "accounts"
  | "signals"
  | "messages"
  | "forumTopics"
  | "notifications"
  | "enrolledStudents"
  | "badges"
  | "modules";

const TABLES: Record<CollectionName, string> = {
  trades: "trades",
  accounts: "trading_accounts",
  signals: "coach_signals",
  messages: "coach_messages",
  forumTopics: "forum_topics",
  notifications: "notifications",
  enrolledStudents: "enrolled_students",
  badges: "badges",
  modules: "modules",
};

/** Objet de collection : on n'exige qu'un identifiant stable. */
type WithId = { id: string; [key: string]: unknown };

/** Colonnes promues hors du payload, par collection. */
const PROMOTED: Partial<Record<CollectionName, string[]>> = {
  trades: ["date", "pair", "direction", "result", "pnl"],
};

export function listCollection<T extends WithId>(
  name: CollectionName,
  userId: string = DEFAULT_USER_ID
): T[] {
  const rows = db
    .prepare(
      `SELECT payload FROM ${TABLES[name]} WHERE user_id = ? ORDER BY position ASC`
    )
    .all(userId) as { payload: string }[];

  const items = rows.map((r) => JSON.parse(r.payload) as T);

  // Les réponses du forum vivent dans leur propre table : on les recompose
  // pour que le client retrouve exactement la forme ForumTopic qu'il attend.
  if (name === "forumTopics") {
    return items.map((topic) => ({
      ...topic,
      replies: listForumReplies(topic.id),
    })) as T[];
  }

  return items;
}

function listForumReplies(topicId: string): unknown[] {
  const rows = db
    .prepare(
      "SELECT payload FROM forum_replies WHERE topic_id = ? ORDER BY position ASC"
    )
    .all(topicId) as { payload: string }[];
  return rows.map((r) => JSON.parse(r.payload));
}

/**
 * Remplace intégralement une collection, dans une transaction.
 *
 * Le client détient toujours le tableau complet en mémoire et chaque action
 * produit un nouveau tableau complet : remplacer est donc l'opération qui
 * correspond exactement à sa sémantique, et elle est idempotente.
 */
export function replaceCollection<T extends WithId>(
  name: CollectionName,
  items: T[],
  userId: string = DEFAULT_USER_ID
): void {
  const table = TABLES[name];
  const promoted = PROMOTED[name] ?? [];
  const columns = ["id", "user_id", "position", ...promoted, "payload"];
  const placeholders = columns.map(() => "?").join(", ");

  const insert = db.prepare(
    `INSERT INTO ${table} (${columns.join(", ")}) VALUES (${placeholders})`
  );
  const clear = db.prepare(`DELETE FROM ${table} WHERE user_id = ?`);

  const run = db.transaction((rows: T[]) => {
    clear.run(userId);
    rows.forEach((item, index) => {
      const values = [
        item.id,
        userId,
        index,
        ...promoted.map((col) => (item[col] ?? null) as string | number | null),
      ];

      if (name === "forumTopics") {
        // Les réponses sont stockées à part : on les retire du payload du sujet
        // pour éviter d'avoir la même donnée à deux endroits.
        const { replies, ...topic } = item as T & { replies?: WithId[] };
        insert.run(...values, JSON.stringify(topic));
        replaceForumReplies(item.id, replies ?? []);
      } else {
        insert.run(...values, JSON.stringify(item));
      }
    });
  });

  run(items);
}

/**
 * Met à jour un seul élément d'une collection, sans toucher aux autres.
 *
 * `replaceCollection` vide puis réinsère toute la collection — sur
 * `enrolledStudents`, ça déclenche le `ON DELETE CASCADE` de
 * `student_accounts.enrolled_student_id` à chaque écriture, supprimant le
 * compte élève qu'on venait justement de créer dans la même transaction.
 * Cette fonction ne fait qu'un `UPDATE` ciblé : la ligne parente ne disparaît
 * jamais, même un instant.
 */
export function updateCollectionItem<T extends WithId>(
  name: CollectionName,
  id: string,
  item: T,
  userId: string = DEFAULT_USER_ID
): void {
  const table = TABLES[name];
  const promoted = PROMOTED[name] ?? [];

  const setClauses = [...promoted.map((col) => `${col} = ?`), "payload = ?"].join(", ");
  const values = [
    ...promoted.map((col) => (item[col] ?? null) as string | number | null),
    JSON.stringify(item),
  ];

  db.prepare(`UPDATE ${table} SET ${setClauses} WHERE id = ? AND user_id = ?`).run(
    ...values,
    id,
    userId
  );
}

function replaceForumReplies(topicId: string, replies: WithId[]): void {
  db.prepare("DELETE FROM forum_replies WHERE topic_id = ?").run(topicId);
  const insert = db.prepare(
    "INSERT INTO forum_replies (id, topic_id, position, payload) VALUES (?, ?, ?, ?)"
  );
  replies.forEach((reply, index) => {
    insert.run(reply.id, topicId, index, JSON.stringify(reply));
  });
}

export function getProfile<T>(userId: string = DEFAULT_USER_ID): T | null {
  const row = db.prepare("SELECT payload FROM users WHERE id = ?").get(userId) as
    | { payload: string }
    | undefined;
  return row ? (JSON.parse(row.payload) as T) : null;
}

export function saveProfile(profile: unknown, userId: string = DEFAULT_USER_ID): void {
  db.prepare(
    `INSERT INTO users (id, payload) VALUES (?, ?)
     ON CONFLICT(id) DO UPDATE SET payload = excluded.payload`
  ).run(userId, JSON.stringify(profile));
}

export function getQuizResults<T>(
  userId: string = DEFAULT_USER_ID
): Record<string, T> {
  const rows = db
    .prepare("SELECT module_id, payload FROM quiz_results WHERE user_id = ?")
    .all(userId) as { module_id: string; payload: string }[];

  return Object.fromEntries(
    rows.map((r) => [r.module_id, JSON.parse(r.payload) as T])
  );
}

export function replaceQuizResults(
  results: Record<string, unknown>,
  userId: string = DEFAULT_USER_ID
): void {
  const clear = db.prepare("DELETE FROM quiz_results WHERE user_id = ?");
  const insert = db.prepare(
    "INSERT INTO quiz_results (module_id, user_id, payload) VALUES (?, ?, ?)"
  );

  const run = db.transaction((entries: [string, unknown][]) => {
    clear.run(userId);
    entries.forEach(([moduleId, payload]) => {
      insert.run(moduleId, userId, JSON.stringify(payload));
    });
  });

  run(Object.entries(results));
}

export const COLLECTION_NAMES = Object.keys(TABLES) as CollectionName[];
