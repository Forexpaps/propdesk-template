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

/**
 * Levée par `replaceCollection` quand un `id` soumis appartient déjà à un
 * AUTRE bureau (`user_id` différent). Voir le commentaire de
 * `replaceCollection` pour le pourquoi de cette vérification.
 */
export class CollectionOwnershipConflictError extends Error {
  constructor(public readonly conflictingIds: string[]) {
    super(`Conflit de propriété sur ${conflictingIds.length} identifiant(s).`);
    this.name = "CollectionOwnershipConflictError";
  }
}

/** Colonnes promues hors du payload, par collection. */
const PROMOTED: Partial<Record<CollectionName, string[]>> = {
  trades: ["date", "pair", "direction", "result", "pnl"],
};

/**
 * `JSON.parse` défensif : une ligne dont le `payload` est corrompu (édition
 * manuelle ratée, bug de migration futur) ne doit jamais faire échouer la
 * lecture de toute une collection pour tout le monde — elle est ignorée et
 * journalisée, le reste de la collection reste lisible normalement.
 */
function safeParsePayload<T>(payload: string, context: string): T | null {
  try {
    return JSON.parse(payload) as T;
  } catch (err) {
    console.warn(
      `[propdesk] Ligne ignorée, payload JSON invalide (${context}) :`,
      (err as Error).message
    );
    return null;
  }
}

export function listCollection<T extends WithId>(
  name: CollectionName,
  userId: string = DEFAULT_USER_ID
): T[] {
  const rows = db
    .prepare(
      `SELECT id, payload FROM ${TABLES[name]} WHERE user_id = ? ORDER BY position ASC`
    )
    .all(userId) as { id: string; payload: string }[];

  const items = rows
    .map((r) => safeParsePayload<T>(r.payload, `${TABLES[name]}#${r.id}`))
    .filter((item): item is T => item !== null);

  // Les réponses du forum vivent dans leur propre table : on les recompose
  // pour que le client retrouve exactement la forme ForumTopic qu'il attend.
  if (name === "forumTopics") {
    return items.map((topic) => ({
      ...topic,
      replies: listForumReplies(topic.id, userId),
    })) as T[];
  }

  return items;
}

/**
 * `AND user_id = ?` en plus de `topic_id = ?` : vérification de propriété au
 * niveau de la table elle-même, pas seulement via le `topic_id` déjà vérifié
 * par l'appelant — défense en profondeur (voir migration dans `db.ts`).
 */
function listForumReplies(topicId: string, userId: string): unknown[] {
  const rows = db
    .prepare(
      "SELECT id, payload FROM forum_replies WHERE topic_id = ? AND user_id = ? ORDER BY position ASC"
    )
    .all(topicId, userId) as { id: string; payload: string }[];
  return rows
    .map((r) => safeParsePayload(r.payload, `forum_replies#${r.id}`))
    .filter((item) => item !== null);
}

/**
 * Remplace intégralement une collection, dans une transaction.
 *
 * Le client détient toujours le tableau complet en mémoire et chaque action
 * produit un nouveau tableau complet : remplacer est donc l'opération qui
 * correspond exactement à sa sémantique, et elle est idempotente.
 *
 * Implémentée en UPSERT (+ suppression des seules lignes disparues), et non
 * en vidage puis réinsertion complète : sur `enrolledStudents`, un vidage même
 * suivi d'une réinsertion identique fait passer chaque ligne par un `DELETE`
 * réel, qui déclenche le `ON DELETE CASCADE` de `student_accounts` — un coach
 * qui modifierait la note d'un élève sans rapport supprimerait ainsi l'accès
 * actif de tous les autres élèves de la fiche en un seul enregistrement. Une
 * ligne qui continue d'exister par son `id` doit donc être mise à jour en
 * place, jamais recréée.
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
  const updateSet = [...promoted, "payload"].map((col) => `${col} = excluded.${col}`).join(", ");

  const upsert = db.prepare(
    `INSERT INTO ${table} (${columns.join(", ")}) VALUES (${placeholders})
     ON CONFLICT(id) DO UPDATE SET position = excluded.position, ${updateSet}`
  );

  const run = db.transaction((rows: T[]) => {
    const existingIds = db
      .prepare(`SELECT id FROM ${table} WHERE user_id = ?`)
      .all(userId) as { id: string }[];
    const incomingIds = new Set(rows.map((r) => r.id));
    const staleIds = existingIds.map((r) => r.id).filter((id) => !incomingIds.has(id));

    // `id` est une clé primaire GLOBALE de la table, pas composite avec
    // `user_id` (voir HANDOFF §3/§8) : sans ce contrôle, l'UPSERT plus bas
    // (`ON CONFLICT(id) DO UPDATE`) écraserait silencieusement une ligne
    // appartenant à un AUTRE bureau si son `id` — généré côté client via
    // `Date.now()`, donc devinable — entre en collision avec un `id` soumis
    // ici. On rejette toute la requête (rien n'est écrit, transaction
    // annulée) dès qu'un seul `id` soumis appartient déjà à quelqu'un d'autre.
    if (incomingIds.size > 0) {
      const ids = [...incomingIds];
      const placeholdersForCheck = ids.map(() => "?").join(", ");
      const conflicting = db
        .prepare(`SELECT id FROM ${table} WHERE id IN (${placeholdersForCheck}) AND user_id != ?`)
        .all(...ids, userId) as { id: string }[];
      if (conflicting.length > 0) {
        throw new CollectionOwnershipConflictError(conflicting.map((r) => r.id));
      }
    }

    if (staleIds.length > 0) {
      const placeholdersForDelete = staleIds.map(() => "?").join(", ");
      db.prepare(`DELETE FROM ${table} WHERE user_id = ? AND id IN (${placeholdersForDelete})`).run(
        userId,
        ...staleIds
      );
    }

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
        upsert.run(...values, JSON.stringify(topic));
        replaceForumReplies(item.id, replies ?? [], userId);
      } else {
        upsert.run(...values, JSON.stringify(item));
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

function replaceForumReplies(topicId: string, replies: WithId[], userId: string): void {
  db.prepare("DELETE FROM forum_replies WHERE topic_id = ?").run(topicId);
  const insert = db.prepare(
    "INSERT INTO forum_replies (id, topic_id, user_id, position, payload) VALUES (?, ?, ?, ?, ?)"
  );
  replies.forEach((reply, index) => {
    insert.run(reply.id, topicId, userId, index, JSON.stringify(reply));
  });
}

export function getProfile<T>(userId: string = DEFAULT_USER_ID): T | null {
  const row = db.prepare("SELECT payload FROM users WHERE id = ?").get(userId) as
    | { payload: string }
    | undefined;
  if (!row) return null;
  return safeParsePayload<T>(row.payload, `users#${userId}`);
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

  const entries = rows
    .map((r): [string, T] | null => {
      const parsed = safeParsePayload<T>(r.payload, `quiz_results#${r.module_id}`);
      return parsed === null ? null : [r.module_id, parsed];
    })
    .filter((entry): entry is [string, T] => entry !== null);

  return Object.fromEntries(entries);
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
