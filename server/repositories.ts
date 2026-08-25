import { db, DEFAULT_USER_ID } from "./db";

/**
 * Nom logique d'une collection, tel qu'exposé par l'API et attendu par le
 * client. La table sous-jacente est un détail d'implémentation.
 */
export type CollectionName =
  | "trades"
  | "accounts"
  | "messages"
  | "notifications"
  | "enrolledStudents"
  | "badges"
  | "modules"
  | "setups";

const TABLES: Record<CollectionName, string> = {
  trades: "trades",
  accounts: "trading_accounts",
  messages: "coach_messages",
  notifications: "notifications",
  enrolledStudents: "enrolled_students",
  badges: "badges",
  modules: "modules",
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

      // Effacement RGPD (Article 17) : supprimer une fiche élève ne doit pas
      // laisser son bureau personnel (trades, plan de trading, setups,
      // progression, badges...) orphelin en base. `student_accounts.
      // enrolled_student_id` cascade déjà (ON DELETE CASCADE) quand la ligne
      // `enrolled_students` disparaît juste en dessous — mais cascade
      // seulement jusqu'à `student_accounts`, jamais jusqu'à `users`, qui n'a
      // aucune FK entrante depuis cette table. Il faut donc lire les
      // `user_id` concernés AVANT la suppression (sans quoi la ligne
      // `student_accounts` qui les portait aura déjà disparu), puis
      // supprimer ces lignes `users` explicitement — leur propre `ON DELETE
      // CASCADE` (voir server/db.ts) entraîne alors trades/trading_accounts/
      // coach_messages/notifications/badges/modules/setups/trading_plans/
      // quiz_results dans la foulée, en une seule transaction.
      let orphanedUserIds: string[] = [];
      if (name === "enrolledStudents") {
        const rows = db
          .prepare(
            `SELECT user_id FROM student_accounts WHERE enrolled_student_id IN (${placeholdersForDelete})`
          )
          .all(...staleIds) as { user_id: string }[];
        orphanedUserIds = rows.map((r) => r.user_id);
      }

      db.prepare(`DELETE FROM ${table} WHERE user_id = ? AND id IN (${placeholdersForDelete})`).run(
        userId,
        ...staleIds
      );

      if (orphanedUserIds.length > 0) {
        const placeholdersForUsers = orphanedUserIds.map(() => "?").join(", ");
        db.prepare(`DELETE FROM users WHERE id IN (${placeholdersForUsers})`).run(...orphanedUserIds);
      }
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

/**
 * Plans de trading d'un élève — payload JSON opaque (un tableau de
 * `TradingPlan`, voir `TradingPlanData` dans `src/types.ts`) sur une ligne
 * par utilisateur, même modèle que `getProfile`/`saveProfile`, sur sa propre
 * table plutôt que forcé dans le moule `CollectionName`. Passthrough
 * générique : le passage d'un objet unique (avant l'introduction du
 * multi-plan) à un tableau ne demande aucun changement ici, ni de migration
 * SQL — seule la validation applicative (`tradingPlansSchema`,
 * `server/schemas.ts`) et la normalisation à la lecture
 * (`normalizeTradingPlans`, `src/lib/planCompliance.ts`) en tiennent compte.
 */
export function getTradingPlan<T>(userId: string = DEFAULT_USER_ID): T | null {
  const row = db.prepare("SELECT payload FROM trading_plans WHERE user_id = ?").get(userId) as
    | { payload: string }
    | undefined;
  if (!row) return null;
  return safeParsePayload<T>(row.payload, `trading_plans#${userId}`);
}

export function saveTradingPlan(plan: unknown, userId: string = DEFAULT_USER_ID): void {
  db.prepare(
    `INSERT INTO trading_plans (user_id, payload) VALUES (?, ?)
     ON CONFLICT(user_id) DO UPDATE SET payload = excluded.payload`
  ).run(userId, JSON.stringify(plan));
}

/**
 * Annonces du fondateur — toujours `DEFAULT_USER_ID`, jamais un paramètre :
 * contrairement à tout le reste de cette app (scopé par élève), il n'existe
 * qu'UNE seule liste d'annonces, partagée par tout le monde. Même
 * passthrough générique que `getTradingPlan`/`saveTradingPlan`.
 */
export function getAnnouncements<T>(): T | null {
  const row = db.prepare("SELECT payload FROM announcements WHERE user_id = ?").get(DEFAULT_USER_ID) as
    | { payload: string }
    | undefined;
  if (!row) return null;
  return safeParsePayload<T>(row.payload, `announcements#${DEFAULT_USER_ID}`);
}

export function saveAnnouncements(list: unknown): void {
  db.prepare(
    `INSERT INTO announcements (user_id, payload) VALUES (?, ?)
     ON CONFLICT(user_id) DO UPDATE SET payload = excluded.payload`
  ).run(DEFAULT_USER_ID, JSON.stringify(list));
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
