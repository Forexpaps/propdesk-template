import { createClient } from "@libsql/client";
import { Pool } from "pg";
import fs from "fs";
import path from "path";

/**
 * Forme minimale partagée par les deux moteurs possibles (libSQL et
 * Postgres) — c'est tout ce que `repositories.ts` et le reste du serveur
 * utilisent, jamais une API spécifique à l'un ou l'autre.
 */
interface QueryResult {
  rows: Record<string, unknown>[];
  rowsAffected: number;
}
type Query = string | { sql: string; args?: unknown[] };
interface DbTransaction {
  execute(query: Query): Promise<QueryResult>;
  commit(): Promise<void>;
  rollback(): Promise<void>;
  close(): void;
}
interface DbClient {
  execute(query: Query): Promise<QueryResult>;
  transaction(mode?: "write" | "read"): Promise<DbTransaction>;
}

/**
 * Connexion unique pour tout le serveur, trois modes choisis par les
 * variables d'environnement présentes — indépendamment de l'hébergeur,
 * qu'il s'agisse de Vercel, Railway, Render, Fly.io, un VPS ou autre :
 *  - `POSTGRES_URL` : base Postgres, **n'importe quel fournisseur**
 *    (Postgres natif d'un hébergeur, Neon, Supabase, une instance
 *    auto-hébergée...) — utile sur un hébergeur dont le système de
 *    fichiers n'est pas persistant (fonctions serverless) ;
 *  - `TURSO_DATABASE_URL` : base SQLite distante chez Turso,
 *    `TURSO_AUTH_TOKEN` pour l'authentification — alternative à Postgres,
 *    même cas d'usage ;
 *  - aucune des deux (dev local, et tout hébergeur à disque persistant,
 *    Postgres ou pas) : fichier local dans DATA_DIR (./data par défaut) via
 *    libSQL en mode `file:`, aucun compte externe requis.
 *
 * Le reste du serveur ne parle qu'aux repositories, jamais à ce module
 * directement — et les repositories n'appellent que `execute`/`transaction`
 * ci-dessus, jamais une méthode propre à un moteur ou un hébergeur en
 * particulier. Ajouter un nouveau fournisseur de base ne demande donc de
 * toucher que ce fichier.
 */
export const DATA_DIR = process.env.DATA_DIR || path.join(process.cwd(), "data");

const usingPostgres = Boolean(process.env.POSTGRES_URL);
const usingTurso = !usingPostgres && Boolean(process.env.TURSO_DATABASE_URL);
const usingLocalFile = !usingPostgres && !usingTurso;

if (usingLocalFile) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

/**
 * `?` (convention SQLite/libSQL, utilisée dans tout le reste du serveur) →
 * `$1, $2, ...` (convention Postgres). Sûr ici : aucune requête de ce
 * serveur ne contient de `?` littéral dans une chaîne SQL.
 */
function toPostgresPlaceholders(sql: string): string {
  let index = 0;
  return sql.replace(/\?/g, () => `$${++index}`);
}

function normalizeQuery(query: Query): { sql: string; args: unknown[] } {
  return typeof query === "string" ? { sql: query, args: [] } : { sql: query.sql, args: query.args ?? [] };
}

/**
 * Adapte `pg` (Postgres) à la même interface `execute`/`transaction` que
 * libSQL, pour que `repositories.ts` et le reste du serveur n'aient jamais
 * besoin de savoir lequel des deux moteurs est actif.
 */
function createPostgresClient(connectionString: string): DbClient {
  const pool = new Pool({
    connectionString,
    // La plupart des fournisseurs gérés (Vercel Postgres, Neon...) exigent
    // TLS mais présentent un certificat que Node ne valide pas par défaut ;
    // `sslmode=disable` explicite dans l'URL (dev local sans TLS) reste
    // respecté par `pg` indépendamment de cette option.
    ssl: connectionString.includes("sslmode=disable") ? undefined : { rejectUnauthorized: false },
  });

  async function execute(query: Query): Promise<QueryResult> {
    const { sql, args } = normalizeQuery(query);
    const result = await pool.query(toPostgresPlaceholders(sql), args);
    return { rows: result.rows, rowsAffected: result.rowCount ?? 0 };
  }

  async function transaction(): Promise<DbTransaction> {
    const client = await pool.connect();
    await client.query("BEGIN");
    let released = false;
    const releaseOnce = () => {
      if (!released) {
        released = true;
        client.release();
      }
    };
    return {
      async execute(query: Query): Promise<QueryResult> {
        const { sql, args } = normalizeQuery(query);
        const result = await client.query(toPostgresPlaceholders(sql), args);
        return { rows: result.rows, rowsAffected: result.rowCount ?? 0 };
      },
      async commit() {
        await client.query("COMMIT");
      },
      async rollback() {
        await client.query("ROLLBACK");
      },
      close: releaseOnce,
    };
  }

  return { execute, transaction };
}

/** libSQL renvoie déjà `rows`/`rowsAffected` — juste besoin d'adapter le type de retour de `transaction`. */
function createLibsqlClient(url: string, authToken?: string): DbClient {
  const client = createClient({ url, authToken });
  return {
    execute: (query: Query) => client.execute(query as never) as unknown as Promise<QueryResult>,
    transaction: async (mode: "write" | "read" = "write") => {
      const tx = await client.transaction(mode);
      return {
        execute: (query: Query) => tx.execute(query as never) as unknown as Promise<QueryResult>,
        commit: () => tx.commit(),
        rollback: () => tx.rollback(),
        close: () => tx.close(),
      };
    },
  };
}

export const db: DbClient = usingPostgres
  ? createPostgresClient(process.env.POSTGRES_URL!)
  : usingTurso
  ? createLibsqlClient(process.env.TURSO_DATABASE_URL!, process.env.TURSO_AUTH_TOKEN)
  : createLibsqlClient(`file:${path.join(DATA_DIR, "horizon.db")}`);

/**
 * Toutes les collections partagent la même forme : un identifiant stable,
 * le propriétaire, un rang d'affichage (l'ordre des listes est significatif
 * dans l'UI) et l'objet complet sérialisé.
 *
 * `trades` promeut en colonnes les champs sur lesquels on veut pouvoir
 * requêter et indexer ; les autres collections ne sont jamais lues autrement
 * qu'en entier, leur payload suffit.
 *
 * Ces instructions sont écrites dans un sous-ensemble SQL commun à SQLite et
 * Postgres (types, `REFERENCES ... ON DELETE CASCADE`, `CREATE INDEX IF NOT
 * EXISTS` sont valables dans les deux) — aucune divergence nécessaire ici.
 */
const SCHEMA_STATEMENTS = [
  `CREATE TABLE IF NOT EXISTS meta (
    key   TEXT PRIMARY KEY,
    value TEXT NOT NULL
  )`,

  `CREATE TABLE IF NOT EXISTS users (
    id      TEXT PRIMARY KEY,
    payload TEXT NOT NULL
  )`,

  `CREATE TABLE IF NOT EXISTS trades (
    id        TEXT PRIMARY KEY,
    user_id   TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    position  INTEGER NOT NULL,
    date      TEXT,
    pair      TEXT,
    direction TEXT,
    result    TEXT,
    pnl       REAL,
    payload   TEXT NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS idx_trades_user ON trades(user_id, position)`,
  `CREATE INDEX IF NOT EXISTS idx_trades_date ON trades(user_id, date)`,

  // Verrouillage optimiste sur les collections CollectionName (trades,
  // accounts, badges, setups, notifications, enrolledStudents) : un
  // compteur par (utilisateur, collection),
  // incrémenté à chaque écriture réussie. PUT /api/collections/:name
  // exige la version lue au dernier chargement et refuse (409) si elle ne
  // correspond plus — sans ça, deux onglets ouverts sur le même bureau
  // staff partagé pouvaient s'écraser silencieusement l'un l'autre (l'un
  // ajoute un trade, l'autre pousse sa propre version 10s plus tard sans
  // jamais l'avoir vu, le premier trade disparaît sans erreur ni pour
  // personne).
  `CREATE TABLE IF NOT EXISTS collection_versions (
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name    TEXT NOT NULL,
    version INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (user_id, name)
  )`,

  `CREATE TABLE IF NOT EXISTS setups (
    id       TEXT PRIMARY KEY,
    user_id  TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    position INTEGER NOT NULL,
    payload  TEXT NOT NULL
  )`,

  `CREATE TABLE IF NOT EXISTS trading_accounts (
    id       TEXT PRIMARY KEY,
    user_id  TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    position INTEGER NOT NULL,
    payload  TEXT NOT NULL
  )`,

  `CREATE TABLE IF NOT EXISTS notifications (
    id       TEXT PRIMARY KEY,
    user_id  TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    position INTEGER NOT NULL,
    payload  TEXT NOT NULL
  )`,

  `CREATE TABLE IF NOT EXISTS badges (
    id       TEXT PRIMARY KEY,
    user_id  TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    position INTEGER NOT NULL,
    payload  TEXT NOT NULL
  )`,

  // Comptes staff : identité de connexion, DÉCOUPLÉE du bureau partagé.
  //
  // Plusieurs coachs peuvent avoir chacun leur propre email et mot de passe,
  // tout en travaillant sur les MÊMES données (le bureau "users" reste
  // singulier). C'est pourquoi il n'y a PAS de clé étrangère vers users(id) :
  // un compte staff n'est pas "propriétaire" d'un bureau, il y accède.
  //
  // Aucun champ ici n'atteint jamais le client via /api/state : GET /api/state
  // ne renvoie que le payload de "users", jamais cette table.
  `CREATE TABLE IF NOT EXISTS staff_accounts (
    id                   TEXT PRIMARY KEY,
    name                 TEXT NOT NULL,
    email                TEXT NOT NULL,
    email_lower          TEXT NOT NULL UNIQUE,
    password_hash        TEXT NOT NULL,
    -- Vrai tant qu'un mot de passe temporaire d'invitation n'a pas été
    -- remplacé par l'intéressé. Jamais vrai pour le premier compte (créé via
    -- /auth/setup, qui choisit son propre mot de passe).
    must_change_password INTEGER NOT NULL DEFAULT 0,
    -- 2FA (TOTP), voir server/auth/twoFactor.ts. totp_secret : présent dès
    -- qu'un compte a démarré une configuration, même non encore confirmée
    -- (voir startTotpSetup) — totp_enabled_at NULL est ce qui distingue "en
    -- cours de configuration" de "activé".
    totp_secret           TEXT,
    totp_enabled_at        TEXT,
    -- Anti-rejeu : dernier pas de temps TOTP (30s) accepte pour ce compte.
    -- Un code deja utilise pour ce pas (ou un pas anterieur) est refuse meme
    -- s'il correspond encore dans la fenetre de tolerance de findMatchingTotpStep,
    -- voir server/auth/twoFactor.ts.
    totp_last_used_step   INTEGER,
    created_at           TEXT NOT NULL,
    updated_at           TEXT NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS idx_staff_accounts_email ON staff_accounts(email_lower)`,

  // Codes de récupération 2FA à usage unique, un hash SHA-256 par code (pas
  // de sel : chaque code est déjà un secret aléatoire de forte entropie,
  // même raisonnement que sessions.ts). used_at NULL = encore valide.
  `CREATE TABLE IF NOT EXISTS staff_recovery_codes (
    id         TEXT PRIMARY KEY,
    staff_id   TEXT NOT NULL REFERENCES staff_accounts(id) ON DELETE CASCADE,
    code_hash  TEXT NOT NULL,
    created_at TEXT NOT NULL,
    used_at    TEXT
  )`,
  `CREATE INDEX IF NOT EXISTS idx_staff_recovery_codes_staff ON staff_recovery_codes(staff_id)`,

  // Défi 2FA en attente entre "mot de passe vérifié" et "session créée" —
  // voir POST /auth/login puis POST /auth/login/2fa. Jeton à usage unique,
  // courte durée de vie (5 min, voir twoFactor.ts), empreinte SHA-256 en
  // base comme les sessions (server/auth/sessions.ts).
  `CREATE TABLE IF NOT EXISTS staff_2fa_challenges (
    token_hash TEXT PRIMARY KEY,
    staff_id   TEXT NOT NULL REFERENCES staff_accounts(id) ON DELETE CASCADE,
    created_at TEXT NOT NULL,
    expires_at TEXT NOT NULL
  )`,

  // Sessions actives. La colonne id est le SHA-256 du jeton, jamais le jeton
  // lui-même : le fichier de base vit en clair sur le disque (et dans le WAL, et
  // dans les sauvegardes), une fuite ne doit pas permettre de rejouer les
  // sessions.
  //
  // Les dates sont en ISO 8601 UTC : la comparaison lexicographique vaut alors
  // comparaison chronologique, ce dont dépend le filtre sur expires_at.
  `CREATE TABLE IF NOT EXISTS sessions (
    id           TEXT PRIMARY KEY,
    user_id      TEXT NOT NULL REFERENCES staff_accounts(id) ON DELETE CASCADE,
    created_at   TEXT NOT NULL,
    expires_at   TEXT NOT NULL,
    last_seen_at TEXT NOT NULL,
    user_agent   TEXT
  )`,
  `CREATE INDEX IF NOT EXISTS idx_sessions_user    ON sessions(user_id)`,
  `CREATE INDEX IF NOT EXISTS idx_sessions_expires ON sessions(expires_at)`,

  // Journal de sécurité. Purge à 90 jours (les IP sont des données
  // personnelles), jamais de mot de passe ni de jeton de session stocké ici.
  // Pas de FK vers staff_accounts : un événement doit rester lisible même
  // après révocation du compte concerné.
  `CREATE TABLE IF NOT EXISTS security_events (
    id            TEXT PRIMARY KEY,
    created_at    TEXT NOT NULL,
    event_type    TEXT NOT NULL,
    severity      TEXT NOT NULL,          -- 'info' | 'warning' | 'critical'
    account_kind  TEXT,                   -- 'staff' | 'student' | NULL
    account_email TEXT,
    ip_address    TEXT,
    detail        TEXT NOT NULL DEFAULT ''
  )`,
  `CREATE INDEX IF NOT EXISTS idx_security_events_created ON security_events(created_at)`,
  `CREATE INDEX IF NOT EXISTS idx_security_events_email   ON security_events(account_email)`,

  // État opérationnel du verrouillage de compte, PAR (monde, email) — une
  // seule ligne par compte, écrasée à chaque tentative de connexion.
  // Distinct du journal ci-dessus (durée de vie et fréquence d'accès très
  // différentes) : voir server/auth/loginLockout.ts.
  `CREATE TABLE IF NOT EXISTS login_lockouts (
    kind               TEXT NOT NULL,     -- 'staff' | 'student'
    email_lower        TEXT NOT NULL,
    failed_count       INTEGER NOT NULL DEFAULT 0,
    window_started_at  TEXT NOT NULL,
    locked_until       TEXT,
    updated_at         TEXT NOT NULL,
    -- Nombre de verrouillages déjà subis par ce compte — voir lockDurationFor
    -- (loginLockout.ts) : chaque nouveau verrouillage allonge le suivant
    -- (15 min, 1h, 4h, 24h), au lieu d'un verrouillage à durée fixe
    -- indéfiniment répétable toutes les 15 minutes.
    lock_count         INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (kind, email_lower)
  )`,
];

/**
 * Migration ponctuelle : sépare l'identité de connexion (désormais
 * `staff_accounts`) de l'ancien modèle à un seul compte (`user_credentials`,
 * lié 1:1 au bureau partagé par une clé étrangère qui interdirait tout second
 * compte).
 *
 * SQLite/libSQL uniquement — une base Postgres est toujours créée neuve avec
 * `staff_accounts` déjà dans sa forme finale (voir `SCHEMA_STATEMENTS`),
 * cette migration n'a donc jamais de raison de s'y exécuter.
 *
 * Le compte existant conserve exactement son `id` d'origine (celui qui était
 * `user_id` dans `user_credentials`, presque toujours `DEFAULT_USER_ID`) :
 * les sessions déjà émises restent donc valides, personne n'est déconnecté
 * par cette migration.
 *
 * Protégée par un marqueur dans `meta`, comme `bootstrapped_at` : elle ne
 * s'exécute qu'une fois, même si `user_credentials` a déjà été vidée depuis.
 */
const MIGRATION_KEY = "migrated_staff_accounts_v1";

async function migrateToStaffAccounts(): Promise<void> {
  const already = await db.execute({
    sql: "SELECT 1 FROM meta WHERE key = ?",
    args: [MIGRATION_KEY],
  });
  if (already.rows.length > 0) return;

  const hasLegacyTableResult = await db.execute(
    "SELECT 1 FROM sqlite_master WHERE type='table' AND name='user_credentials'"
  );
  const hasLegacyTable = hasLegacyTableResult.rows.length > 0;

  // `CREATE TABLE IF NOT EXISTS` plus haut ne modifie jamais une table déjà
  // existante : sur une base créée avant cette migration, `sessions` porte
  // encore sa contrainte d'origine vers `users(id)`, incompatible avec des
  // comptes staff qui n'ont pas de ligne dans `users`. Il faut la recréer.
  const fkResult = await db.execute("PRAGMA foreign_key_list(sessions)");
  const sessionsReferenceUsers = fkResult.rows.some((row) => row.table === "users");

  const tx = await db.transaction("write");
  try {
    // Ordre impératif : `staff_accounts` doit être peuplée AVANT de recréer
    // `sessions` avec sa clé étrangère vers elle, sinon les lignes de session
    // copiées référenceraient des comptes qui n'existent pas encore.
    if (hasLegacyTable) {
      const legacy = await tx.execute(
        "SELECT user_id, email, email_lower, password_hash, created_at, updated_at FROM user_credentials"
      );

      for (const row of legacy.rows) {
        // Nom d'affichage de repli : la partie locale de l'email, faute de
        // mieux — cette table n'a jamais eu de champ "name" avant cette
        // migration. Le titulaire peut le changer depuis l'écran de compte.
        const email = row.email as string;
        const displayName = email.split("@")[0] || "Coach";
        await tx.execute({
          sql: `INSERT INTO staff_accounts
             (id, name, email, email_lower, password_hash, must_change_password, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, 0, ?, ?)`,
          args: [
            row.user_id as string,
            displayName,
            email,
            row.email_lower as string,
            row.password_hash as string,
            row.created_at as string,
            row.updated_at as string,
          ],
        });
      }

      await tx.execute("DROP TABLE user_credentials");
    }

    if (sessionsReferenceUsers) {
      await tx.execute(`
        CREATE TABLE sessions_new (
          id           TEXT PRIMARY KEY,
          user_id      TEXT NOT NULL REFERENCES staff_accounts(id) ON DELETE CASCADE,
          created_at   TEXT NOT NULL,
          expires_at   TEXT NOT NULL,
          last_seen_at TEXT NOT NULL,
          user_agent   TEXT
        );
      `);
      await tx.execute("INSERT INTO sessions_new SELECT * FROM sessions WHERE user_id IN (SELECT id FROM staff_accounts);");
      await tx.execute("DROP TABLE sessions;");
      await tx.execute("ALTER TABLE sessions_new RENAME TO sessions;");
      await tx.execute("CREATE INDEX IF NOT EXISTS idx_sessions_user    ON sessions(user_id);");
      await tx.execute("CREATE INDEX IF NOT EXISTS idx_sessions_expires ON sessions(expires_at);");
    }

    await tx.execute({
      sql: "INSERT INTO meta (key, value) VALUES (?, ?)",
      args: [MIGRATION_KEY, new Date().toISOString()],
    });

    await tx.commit();
  } catch (err) {
    await tx.rollback();
    throw err;
  } finally {
    tx.close();
  }
}

/**
 * Migration ponctuelle : supprime `coach_signals`, table du module "Signaux
 * & Analyses" retiré entièrement de l'application sur demande explicite de
 * l'utilisateur (composant, routes de rendu, types, sidebar — voir git log).
 * Confirmée vide (0 ligne) avant suppression : aucune UI n'a jamais permis
 * d'y écrire (voir HANDOFF.md, historique). `DROP TABLE IF EXISTS` est
 * idempotent par construction (et valide sur les deux moteurs) — pas besoin
 * de clé `meta` dédiée.
 */
async function migrateDropCoachSignals(): Promise<void> {
  await db.execute("DROP TABLE IF EXISTS coach_signals;");
}

/**
 * Migration ponctuelle : supprime `forum_topics`/`forum_replies`, tables du
 * module Forum retiré entièrement de l'application sur demande explicite de
 * l'utilisateur (composant, routes de rendu, types, sidebar — voir git log
 * et HANDOFF.md). Confirmées vides avant suppression : le forum n'a jamais
 * eu d'entrée dans la sidebar, aucun élève ni coach n'a donc jamais pu y
 * écrire depuis l'UI. `forum_replies` d'abord (clé étrangère vers
 * `forum_topics`), `DROP TABLE IF EXISTS` idempotent par construction (et
 * valide sur les deux moteurs) — pas besoin de clé `meta` dédiée.
 */
async function migrateDropForum(): Promise<void> {
  await db.execute("DROP TABLE IF EXISTS forum_replies;");
  await db.execute("DROP TABLE IF EXISTS forum_topics;");
}

/**
 * Ajoute `totp_secret`/`totp_enabled_at` à `staff_accounts` sur une base
 * SQLite/libSQL EXISTANTE créée avant l'introduction de la 2FA — le `CREATE
 * TABLE IF NOT EXISTS` plus haut ne les crée que sur une base neuve, où ces
 * colonnes existent donc déjà. SQLite/libSQL uniquement (voir
 * `migrateToStaffAccounts`) : une base Postgres neuve les a toujours.
 */
async function migrateAddTotpColumns(): Promise<void> {
  const columnsResult = await db.execute("PRAGMA table_info(staff_accounts)");
  const hasColumn = (name: string) => columnsResult.rows.some((c) => c.name === name);

  const tx = await db.transaction("write");
  try {
    if (!hasColumn("totp_secret")) {
      await tx.execute("ALTER TABLE staff_accounts ADD COLUMN totp_secret TEXT;");
    }
    if (!hasColumn("totp_enabled_at")) {
      await tx.execute("ALTER TABLE staff_accounts ADD COLUMN totp_enabled_at TEXT;");
    }
    if (!hasColumn("totp_last_used_step")) {
      await tx.execute("ALTER TABLE staff_accounts ADD COLUMN totp_last_used_step INTEGER;");
    }
    await tx.commit();
  } catch (err) {
    await tx.rollback();
    throw err;
  } finally {
    tx.close();
  }
}

/**
 * Ajoute `lock_count` à `login_lockouts` sur une base SQLite/libSQL existante
 * — même principe et même raison que `migrateAddTotpColumns`.
 */
async function migrateAddLockCountColumn(): Promise<void> {
  const columnsResult = await db.execute("PRAGMA table_info(login_lockouts)");
  if (columnsResult.rows.some((c) => c.name === "lock_count")) return;
  await db.execute("ALTER TABLE login_lockouts ADD COLUMN lock_count INTEGER NOT NULL DEFAULT 0;");
}

let initialized = false;

/**
 * Crée le schéma (si absent) puis applique les migrations ponctuelles, dans
 * l'ordre. Appelée une seule fois, au démarrage du serveur, avant que
 * quiconque touche `db` — voir `server.ts`.
 */
export async function initDb(): Promise<void> {
  if (initialized) return;
  initialized = true;

  if (usingLocalFile) {
    // Pertinent seulement en mode fichier local : une base distante (Turso
    // ou Postgres) gère elle-même son mode de journalisation, et WAL n'a pas
    // de sens sur une connexion réseau. Non bloquant si le moteur libSQL
    // local le refuse pour une raison quelconque.
    try {
      await db.execute("PRAGMA journal_mode = WAL;");
    } catch (err) {
      console.warn("[propdesk] PRAGMA journal_mode = WAL ignoré.", err);
    }
  }

  if (!usingPostgres) {
    // Postgres applique toujours les clés étrangères — pas de PRAGMA
    // équivalent, et cette commande échouerait si on l'y envoyait.
    await db.execute("PRAGMA foreign_keys = ON;");
  }

  for (const statement of SCHEMA_STATEMENTS) {
    await db.execute(statement);
  }

  if (!usingPostgres) {
    // Migrations SQLite/libSQL uniquement — une base Postgres est toujours
    // créée neuve, directement dans sa forme finale (voir les commentaires
    // de chaque migration ci-dessus).
    await migrateToStaffAccounts();
    await migrateAddTotpColumns();
    await migrateAddLockCountColumn();
  }
  await migrateDropCoachSignals();
  await migrateDropForum();
}

export async function getMeta(key: string): Promise<string | null> {
  const result = await db.execute({ sql: "SELECT value FROM meta WHERE key = ?", args: [key] });
  const row = result.rows[0] as unknown as { value: string } | undefined;
  return row?.value ?? null;
}

export async function setMeta(key: string, value: string): Promise<void> {
  await db.execute({
    sql: "INSERT INTO meta (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
    args: [key, value],
  });
}

/**
 * Utilisateur unique implicite : l'application n'a pas encore
 * d'authentification, mais chaque ligne porte déjà son user_id pour que
 * l'ajout d'un écran de connexion ne demande aucune migration de schéma.
 */
export const DEFAULT_USER_ID = "user-local";
