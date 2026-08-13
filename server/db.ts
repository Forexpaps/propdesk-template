import Database from "better-sqlite3";
import fs from "fs";
import path from "path";

/**
 * Connexion SQLite unique pour tout le serveur.
 *
 * Le fichier vit dans DATA_DIR (./data par défaut). Sur un hébergement à
 * disque éphémère (Cloud Run), monter un volume persistant sur ce chemin ou
 * remplacer cette couche par Postgres : tout le reste du serveur ne parle
 * qu'aux repositories, jamais à SQLite directement.
 */
const DATA_DIR = process.env.DATA_DIR || path.join(process.cwd(), "data");

fs.mkdirSync(DATA_DIR, { recursive: true });

export const db = new Database(path.join(DATA_DIR, "horizon.db"));

db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

/**
 * Toutes les collections partagent la même forme : un identifiant stable,
 * le propriétaire, un rang d'affichage (l'ordre des listes est significatif
 * dans l'UI) et l'objet complet sérialisé.
 *
 * `trades` promeut en colonnes les champs sur lesquels on veut pouvoir
 * requêter et indexer ; les autres collections ne sont jamais lues autrement
 * qu'en entier, leur payload suffit.
 */
db.exec(`
  CREATE TABLE IF NOT EXISTS meta (
    key   TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS users (
    id      TEXT PRIMARY KEY,
    payload TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS trades (
    id        TEXT PRIMARY KEY,
    user_id   TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    position  INTEGER NOT NULL,
    date      TEXT,
    pair      TEXT,
    direction TEXT,
    result    TEXT,
    pnl       REAL,
    payload   TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_trades_user ON trades(user_id, position);
  CREATE INDEX IF NOT EXISTS idx_trades_date ON trades(user_id, date);

  CREATE TABLE IF NOT EXISTS trading_accounts (
    id       TEXT PRIMARY KEY,
    user_id  TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    position INTEGER NOT NULL,
    payload  TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS coach_signals (
    id       TEXT PRIMARY KEY,
    user_id  TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    position INTEGER NOT NULL,
    payload  TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS coach_messages (
    id       TEXT PRIMARY KEY,
    user_id  TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    position INTEGER NOT NULL,
    payload  TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS forum_topics (
    id       TEXT PRIMARY KEY,
    user_id  TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    position INTEGER NOT NULL,
    payload  TEXT NOT NULL
  );

  -- user_id n'est indexée qu'après migrateForumRepliesUserId() plus bas :
  -- sur une base déjà existante, CREATE TABLE IF NOT EXISTS est un no-op
  -- (la table garde son ancien schéma sans user_id), un index dessus ici
  -- échouerait donc avant que la migration n'ait eu la main.
  CREATE TABLE IF NOT EXISTS forum_replies (
    id       TEXT PRIMARY KEY,
    topic_id TEXT NOT NULL REFERENCES forum_topics(id) ON DELETE CASCADE,
    user_id  TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    position INTEGER NOT NULL,
    payload  TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_replies_topic ON forum_replies(topic_id, position);

  CREATE TABLE IF NOT EXISTS notifications (
    id       TEXT PRIMARY KEY,
    user_id  TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    position INTEGER NOT NULL,
    payload  TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS enrolled_students (
    id       TEXT PRIMARY KEY,
    user_id  TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    position INTEGER NOT NULL,
    payload  TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS badges (
    id       TEXT PRIMARY KEY,
    user_id  TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    position INTEGER NOT NULL,
    payload  TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS modules (
    id       TEXT PRIMARY KEY,
    user_id  TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    position INTEGER NOT NULL,
    payload  TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS quiz_results (
    module_id TEXT NOT NULL,
    user_id   TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    payload   TEXT NOT NULL,
    PRIMARY KEY (module_id, user_id)
  );

  -- Comptes staff : identité de connexion, DÉCOUPLÉE du bureau partagé.
  --
  -- Plusieurs coachs peuvent avoir chacun leur propre email et mot de passe,
  -- tout en travaillant sur les MÊMES données (le bureau "users" reste
  -- singulier). C'est pourquoi il n'y a PAS de clé étrangère vers users(id) :
  -- un compte staff n'est pas "propriétaire" d'un bureau, il y accède.
  --
  -- Aucun champ ici n'atteint jamais le client via /api/state : GET /api/state
  -- ne renvoie que le payload de "users", jamais cette table.
  CREATE TABLE IF NOT EXISTS staff_accounts (
    id                   TEXT PRIMARY KEY,
    name                 TEXT NOT NULL,
    email                TEXT NOT NULL,
    email_lower          TEXT NOT NULL UNIQUE,
    password_hash        TEXT NOT NULL,
    -- Vrai tant qu'un mot de passe temporaire d'invitation n'a pas été
    -- remplacé par l'intéressé. Jamais vrai pour le premier compte (créé via
    -- /auth/setup, qui choisit son propre mot de passe).
    must_change_password INTEGER NOT NULL DEFAULT 0,
    invited_by           TEXT REFERENCES staff_accounts(id) ON DELETE SET NULL,
    created_at           TEXT NOT NULL,
    updated_at           TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_staff_accounts_email ON staff_accounts(email_lower);

  -- Sessions actives. La colonne id est le SHA-256 du jeton, jamais le jeton
  -- lui-même : le fichier de base vit en clair sur le disque (et dans le WAL, et
  -- dans les sauvegardes), une fuite ne doit pas permettre de rejouer les
  -- sessions.
  --
  -- Les dates sont en ISO 8601 UTC : la comparaison lexicographique vaut alors
  -- comparaison chronologique, ce dont dépend le filtre sur expires_at.
  CREATE TABLE IF NOT EXISTS sessions (
    id           TEXT PRIMARY KEY,
    user_id      TEXT NOT NULL REFERENCES staff_accounts(id) ON DELETE CASCADE,
    created_at   TEXT NOT NULL,
    expires_at   TEXT NOT NULL,
    last_seen_at TEXT NOT NULL,
    user_agent   TEXT
  );
  CREATE INDEX IF NOT EXISTS idx_sessions_user    ON sessions(user_id);
  CREATE INDEX IF NOT EXISTS idx_sessions_expires ON sessions(expires_at);

  -- Comptes élève : deuxième monde d'identité, complètement séparé du monde
  -- staff. Chaque élève a son propre "bureau" (une ligne users(id) dédiée,
  -- posée dans user_id), donc ses propres trades — au contraire du staff, qui
  -- partage tous le même bureau. La fiche enrolled_students reste la source
  -- de vérité administrative : ON DELETE CASCADE, supprimer la fiche
  -- supprime le compte.
  CREATE TABLE IF NOT EXISTS student_accounts (
    id                    TEXT PRIMARY KEY,
    enrolled_student_id  TEXT NOT NULL REFERENCES enrolled_students(id) ON DELETE CASCADE,
    user_id               TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    email                 TEXT NOT NULL,
    email_lower           TEXT NOT NULL UNIQUE,
    password_hash         TEXT NOT NULL,
    must_change_password  INTEGER NOT NULL DEFAULT 1,
    invited_by            TEXT REFERENCES staff_accounts(id) ON DELETE SET NULL,
    created_at            TEXT NOT NULL,
    updated_at            TEXT NOT NULL
  );
  CREATE UNIQUE INDEX IF NOT EXISTS idx_student_accounts_enrolled ON student_accounts(enrolled_student_id);
  CREATE INDEX IF NOT EXISTS idx_student_accounts_email ON student_accounts(email_lower);

  -- Sessions élève, structurellement identiques à "sessions" mais FK vers
  -- student_accounts : deux mondes séparés, jamais de session élève dans la
  -- table staff ni l'inverse.
  CREATE TABLE IF NOT EXISTS student_sessions (
    id           TEXT PRIMARY KEY,
    user_id      TEXT NOT NULL REFERENCES student_accounts(id) ON DELETE CASCADE,
    created_at   TEXT NOT NULL,
    expires_at   TEXT NOT NULL,
    last_seen_at TEXT NOT NULL,
    user_agent   TEXT
  );
  CREATE INDEX IF NOT EXISTS idx_student_sessions_user    ON student_sessions(user_id);
  CREATE INDEX IF NOT EXISTS idx_student_sessions_expires ON student_sessions(expires_at);

  -- Journal de sécurité, lecture réservée au fondateur (requireOwner). Couvre
  -- les deux mondes (staff ET élève) — account_kind distingue lequel. Purge à
  -- 90 jours (les IP sont des données personnelles), jamais de mot de passe
  -- ni de jeton de session stocké ici. Pas de FK vers staff_accounts/
  -- student_accounts : un événement doit rester lisible même après
  -- révocation du compte concerné.
  CREATE TABLE IF NOT EXISTS security_events (
    id            TEXT PRIMARY KEY,
    created_at    TEXT NOT NULL,
    event_type    TEXT NOT NULL,
    severity      TEXT NOT NULL,          -- 'info' | 'warning' | 'critical'
    account_kind  TEXT,                   -- 'staff' | 'student' | NULL
    account_email TEXT,
    ip_address    TEXT,
    detail        TEXT NOT NULL DEFAULT ''
  );
  CREATE INDEX IF NOT EXISTS idx_security_events_created ON security_events(created_at);
  CREATE INDEX IF NOT EXISTS idx_security_events_email   ON security_events(account_email);

  -- État opérationnel du verrouillage de compte, PAR (monde, email) — une
  -- seule ligne par compte, écrasée à chaque tentative de connexion.
  -- Distinct du journal ci-dessus (durée de vie et fréquence d'accès très
  -- différentes) : voir server/auth/loginLockout.ts.
  CREATE TABLE IF NOT EXISTS login_lockouts (
    kind               TEXT NOT NULL,     -- 'staff' | 'student'
    email_lower        TEXT NOT NULL,
    failed_count       INTEGER NOT NULL DEFAULT 0,
    window_started_at  TEXT NOT NULL,
    locked_until       TEXT,
    updated_at         TEXT NOT NULL,
    PRIMARY KEY (kind, email_lower)
  );
`);

/**
 * Migration ponctuelle : sépare l'identité de connexion (désormais
 * `staff_accounts`) de l'ancien modèle à un seul compte (`user_credentials`,
 * lié 1:1 au bureau partagé par une clé étrangère qui interdirait tout second
 * compte).
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

function migrateToStaffAccounts(): void {
  const already = db
    .prepare("SELECT 1 FROM meta WHERE key = ?")
    .get(MIGRATION_KEY);
  if (already) return;

  const hasLegacyTable = db
    .prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='user_credentials'")
    .get();

  // `CREATE TABLE IF NOT EXISTS` plus haut ne modifie jamais une table déjà
  // existante : sur une base créée avant cette migration, `sessions` porte
  // encore sa contrainte d'origine vers `users(id)`, incompatible avec des
  // comptes staff qui n'ont pas de ligne dans `users`. Il faut la recréer.
  const sessionsForeignKeys = db.pragma("foreign_key_list(sessions)") as {
    table: string;
  }[];
  const sessionsReferenceUsers = sessionsForeignKeys.some((fk) => fk.table === "users");

  db.transaction(() => {
    // Ordre impératif : `staff_accounts` doit être peuplée AVANT de recréer
    // `sessions` avec sa clé étrangère vers elle, sinon les lignes de session
    // copiées référenceraient des comptes qui n'existent pas encore.
    if (hasLegacyTable) {
      const legacy = db
        .prepare(
          "SELECT user_id, email, email_lower, password_hash, created_at, updated_at FROM user_credentials"
        )
        .all() as {
        user_id: string;
        email: string;
        email_lower: string;
        password_hash: string;
        created_at: string;
        updated_at: string;
      }[];

      const insertStaff = db.prepare(
        `INSERT INTO staff_accounts
           (id, name, email, email_lower, password_hash, must_change_password, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, 0, ?, ?)`
      );

      for (const row of legacy) {
        // Nom d'affichage de repli : la partie locale de l'email, faute de
        // mieux — cette table n'a jamais eu de champ "name" avant cette
        // migration. Le titulaire peut le changer depuis l'écran de compte.
        const displayName = row.email.split("@")[0] || "Coach";
        insertStaff.run(
          row.user_id,
          displayName,
          row.email,
          row.email_lower,
          row.password_hash,
          row.created_at,
          row.updated_at
        );
      }

      db.exec("DROP TABLE user_credentials");
    }

    if (sessionsReferenceUsers) {
      db.exec(`
        CREATE TABLE sessions_new (
          id           TEXT PRIMARY KEY,
          user_id      TEXT NOT NULL REFERENCES staff_accounts(id) ON DELETE CASCADE,
          created_at   TEXT NOT NULL,
          expires_at   TEXT NOT NULL,
          last_seen_at TEXT NOT NULL,
          user_agent   TEXT
        );
        INSERT INTO sessions_new SELECT * FROM sessions WHERE user_id IN (SELECT id FROM staff_accounts);
        DROP TABLE sessions;
        ALTER TABLE sessions_new RENAME TO sessions;
        CREATE INDEX IF NOT EXISTS idx_sessions_user    ON sessions(user_id);
        CREATE INDEX IF NOT EXISTS idx_sessions_expires ON sessions(expires_at);
      `);
    }

    db.prepare("INSERT INTO meta (key, value) VALUES (?, ?)").run(
      MIGRATION_KEY,
      new Date().toISOString()
    );
  })();
}

migrateToStaffAccounts();

/**
 * Migration ponctuelle : ajoute `user_id` à `forum_replies`, absente à la
 * création de la table. Sans cette colonne, aucune vérification de propriété
 * n'est possible au niveau de la table elle-même — latent, jamais exploité
 * en pratique (le Forum est exclu de STUDENT_ALLOWED_COLLECTIONS et
 * `replaceForumReplies` n'est appelée que pour un `topic_id` déjà vérifié
 * appartenir à l'appelant), mais une vraie lacune structurelle à combler.
 *
 * Rétrocompatible par construction (backfill via jointure sur `forum_topics`,
 * qui porte déjà `user_id`) : idempotente par simple vérification de la
 * colonne, pas besoin de clé `meta` dédiée.
 */
function migrateForumRepliesUserId(): void {
  const columns = db.pragma("table_info(forum_replies)") as { name: string }[];
  const hasUserId = columns.some((c) => c.name === "user_id");
  if (hasUserId) return;

  db.transaction(() => {
    db.exec(`
      CREATE TABLE forum_replies_new (
        id       TEXT PRIMARY KEY,
        topic_id TEXT NOT NULL REFERENCES forum_topics(id) ON DELETE CASCADE,
        user_id  TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        position INTEGER NOT NULL,
        payload  TEXT NOT NULL
      );

      INSERT INTO forum_replies_new (id, topic_id, user_id, position, payload)
      SELECT r.id, r.topic_id, t.user_id, r.position, r.payload
      FROM forum_replies r
      JOIN forum_topics t ON t.id = r.topic_id;

      DROP TABLE forum_replies;
      ALTER TABLE forum_replies_new RENAME TO forum_replies;
      CREATE INDEX IF NOT EXISTS idx_replies_topic ON forum_replies(topic_id, position);
      CREATE INDEX IF NOT EXISTS idx_replies_user  ON forum_replies(user_id);
    `);
  })();
}

migrateForumRepliesUserId();

// Colonne garantie présente à ce stade (création fraîche ou migration
// ci-dessus) : l'index peut être posé sans risque, dans les deux cas.
db.exec("CREATE INDEX IF NOT EXISTS idx_replies_user ON forum_replies(user_id);");

export function getMeta(key: string): string | null {
  const row = db.prepare("SELECT value FROM meta WHERE key = ?").get(key) as
    | { value: string }
    | undefined;
  return row?.value ?? null;
}

export function setMeta(key: string, value: string): void {
  db.prepare(
    "INSERT INTO meta (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value"
  ).run(key, value);
}

/**
 * Utilisateur unique implicite : l'application n'a pas encore
 * d'authentification, mais chaque ligne porte déjà son user_id pour que
 * l'ajout d'un écran de connexion ne demande aucune migration de schéma.
 */
export const DEFAULT_USER_ID = "user-local";
