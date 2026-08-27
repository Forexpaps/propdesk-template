import { db, DEFAULT_USER_ID } from "./db";

/**
 * Nom logique d'une collection, tel qu'exposé par l'API et attendu par le
 * client. La table sous-jacente est un détail d'implémentation.
 */
export type CollectionName =
  | "trades"
  | "accounts"
  | "notifications"
  | "badges"
  | "setups";

const TABLES: Record<CollectionName, string> = {
  trades: "trades",
  accounts: "trading_accounts",
  notifications: "notifications",
  badges: "badges",
  setups: "setups",
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

/**
 * Levée par `replaceCollection` quand `expectedVersion` ne correspond plus à
 * la version en base — quelqu'un d'autre (un autre onglet, un autre coach
 * sur le même bureau partagé) a écrit cette collection entre-temps. Voir le
 * commentaire de `collection_versions` (server/db.ts).
 */
export class CollectionVersionConflictError extends Error {
  constructor(public readonly currentVersion: number) {
    super("La collection a été modifiée entre-temps par quelqu'un d'autre.");
    this.name = "CollectionVersionConflictError";
  }
}

/** Version actuelle d'une collection pour un utilisateur — `0` si jamais écrite. */
export function getCollectionVersion(name: CollectionName, userId: string = DEFAULT_USER_ID): number {
  const row = db
    .prepare("SELECT version FROM collection_versions WHERE user_id = ? AND name = ?")
    .get(userId, name) as { version: number } | undefined;
  return row?.version ?? 0;
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

  return rows
    .map((r) => safeParsePayload<T>(r.payload, `${TABLES[name]}#${r.id}`))
    .filter((item): item is T => item !== null);
}

/**
 * Remplace intégralement une collection, dans une transaction.
 *
 * Le client détient toujours le tableau complet en mémoire et chaque action
 * produit un nouveau tableau complet : remplacer est donc l'opération qui
 * correspond exactement à sa sémantique, et elle est idempotente.
 *
 * Implémentée en UPSERT (+ suppression des seules lignes disparues), et non
 * en vidage puis réinsertion complète : une ligne qui continue d'exister par
 * son `id` est mise à jour en place, jamais recréée.
 */
export function replaceCollection<T extends WithId>(
  name: CollectionName,
  items: T[],
  userId: string = DEFAULT_USER_ID,
  /**
   * Version lue par l'appelant au dernier chargement — `undefined` désactive
   * la vérification (chemins internes non exposés à un client concurrent :
   * seed, import, restore). Fournie, l'écriture est refusée
   * (`CollectionVersionConflictError`) si elle ne correspond plus à la
   * version actuelle en base, plutôt que d'écraser une modification faite
   * entre-temps par un autre onglet/coach.
   */
  expectedVersion?: number
): number {
  const table = TABLES[name];
  const promoted = PROMOTED[name] ?? [];
  const columns = ["id", "user_id", "position", ...promoted, "payload"];
  const placeholders = columns.map(() => "?").join(", ");
  const updateSet = [...promoted, "payload"].map((col) => `${col} = excluded.${col}`).join(", ");

  const upsert = db.prepare(
    `INSERT INTO ${table} (${columns.join(", ")}) VALUES (${placeholders})
     ON CONFLICT(id) DO UPDATE SET position = excluded.position, ${updateSet}`
  );

  const versionRow = db.prepare(
    `INSERT INTO collection_versions (user_id, name, version) VALUES (?, ?, 1)
     ON CONFLICT(user_id, name) DO UPDATE SET version = version + 1
     RETURNING version`
  );

  const run = db.transaction((rows: T[]) => {
    // Vérifiée EN PREMIER, dans la même transaction que l'écriture : sans
    // cette atomicité, deux requêtes pourraient toutes les deux lire la même
    // version périmée avant qu'aucune n'ait eu la chance d'écrire, et
    // écraser quand même l'une l'autre malgré le contrôle.
    if (expectedVersion !== undefined) {
      const current = db
        .prepare("SELECT version FROM collection_versions WHERE user_id = ? AND name = ?")
        .get(userId, name) as { version: number } | undefined;
      const currentVersion = current?.version ?? 0;
      if (currentVersion !== expectedVersion) {
        throw new CollectionVersionConflictError(currentVersion);
      }
    }

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

      upsert.run(...values, JSON.stringify(item));
    });

    const { version: newVersion } = versionRow.get(userId, name) as { version: number };
    return newVersion;
  });

  return run(items);
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

  // Incrémente aussi la version de la collection (voir `replaceCollection`) :
  // sans ça, un onglet qui a chargé cette collection AVANT cette écriture
  // ciblée pousserait plus tard sa copie périmée en croyant la version
  // toujours valide (le contrôle ne détecterait rien), effaçant cette
  // modification faite en coulisses par une route staff (invitation, révocation,
  // changement d'email). L'incrément force ce type de push à échouer en
  // conflit plutôt qu'à écraser en silence.
  db.prepare(
    `INSERT INTO collection_versions (user_id, name, version) VALUES (?, ?, 1)
     ON CONFLICT(user_id, name) DO UPDATE SET version = version + 1`
  ).run(userId, name);
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

export const COLLECTION_NAMES = Object.keys(TABLES) as CollectionName[];
