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
export const DATA_DIR = process.env.DATA_DIR || path.join(process.cwd(), "data");

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

  -- Verrouillage optimiste sur les collections CollectionName (trades,
  -- accounts, badges, setups, notifications, enrolledStudents) : un
  -- compteur par (utilisateur, collection),
  -- incrémenté à chaque écriture réussie. PUT /api/collections/:name
  -- exige la version lue au dernier chargement et refuse (409) si elle ne
  -- correspond plus — sans ça, deux onglets ouverts sur le même bureau
  -- staff partagé pouvaient s'écraser silencieusement l'un l'autre (l'un
  -- ajoute un trade, l'autre pousse sa propre version 10s plus tard sans
  -- jamais l'avoir vu, le premier trade disparaît sans erreur ni pour
  -- personne).
  CREATE TABLE IF NOT EXISTS collection_versions (
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name    TEXT NOT NULL,
    version INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (user_id, name)
  );

  CREATE TABLE IF NOT EXISTS setups (
    id       TEXT PRIMARY KEY,
    user_id  TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    position INTEGER NOT NULL,
    payload  TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS trading_accounts (
    id       TEXT PRIMARY KEY,
    user_id  TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    position INTEGER NOT NULL,
    payload  TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS notifications (
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
    -- 2FA (TOTP), voir server/auth/twoFactor.ts. totp_secret : présent dès
    -- qu'un compte a démarré une configuration, même non encore confirmée
    -- (voir startTotpSetup) — totp_enabled_at NULL est ce qui distingue "en
    -- cours de configuration" de "activé". Colonnes ajoutées ici pour une
    -- base neuve ; migrateAddTotpColumns() plus bas les ajoute à une base
    -- existante.
    totp_secret           TEXT,
    totp_enabled_at        TEXT,
    -- Anti-rejeu : dernier pas de temps TOTP (30s) accepte pour ce compte.
    -- Un code deja utilise pour ce pas (ou un pas anterieur) est refuse meme
    -- s'il correspond encore dans la fenetre de tolerance de findMatchingTotpStep,
    -- voir server/auth/twoFactor.ts.
    totp_last_used_step   INTEGER,
    created_at           TEXT NOT NULL,
    updated_at           TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_staff_accounts_email ON staff_accounts(email_lower);

  -- Codes de récupération 2FA à usage unique, un hash SHA-256 par code (pas
  -- de sel : chaque code est déjà un secret aléatoire de forte entropie,
  -- même raisonnement que sessions.ts). used_at NULL = encore valide.
  CREATE TABLE IF NOT EXISTS staff_recovery_codes (
    id         TEXT PRIMARY KEY,
    staff_id   TEXT NOT NULL REFERENCES staff_accounts(id) ON DELETE CASCADE,
    code_hash  TEXT NOT NULL,
    created_at TEXT NOT NULL,
    used_at    TEXT
  );
  CREATE INDEX IF NOT EXISTS idx_staff_recovery_codes_staff ON staff_recovery_codes(staff_id);

  -- Défi 2FA en attente entre "mot de passe vérifié" et "session créée" —
  -- voir POST /auth/login puis POST /auth/login/2fa. Jeton à usage unique,
  -- courte durée de vie (5 min, voir twoFactor.ts), empreinte SHA-256 en
  -- base comme les sessions (server/auth/sessions.ts).
  CREATE TABLE IF NOT EXISTS staff_2fa_challenges (
    token_hash TEXT PRIMARY KEY,
    staff_id   TEXT NOT NULL REFERENCES staff_accounts(id) ON DELETE CASCADE,
    created_at TEXT NOT NULL,
    expires_at TEXT NOT NULL
  );

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

  -- Journal de sécurité. Purge à 90 jours (les IP sont des données
  -- personnelles), jamais de mot de passe ni de jeton de session stocké ici.
  -- Pas de FK vers staff_accounts : un événement doit rester lisible même
  -- après révocation du compte concerné.
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
    -- Nombre de verrouillages déjà subis par ce compte — voir lockDurationFor
    -- (loginLockout.ts) : chaque nouveau verrouillage allonge le suivant
    -- (15 min, 1h, 4h, 24h), au lieu d'un verrouillage à durée fixe
    -- indéfiniment répétable toutes les 15 minutes.
    lock_count         INTEGER NOT NULL DEFAULT 0,
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
 * Migration ponctuelle : supprime `coach_signals`, table du module "Signaux
 * & Analyses" retiré entièrement de l'application sur demande explicite de
 * l'utilisateur (composant, routes de rendu, types, sidebar — voir git log).
 * Confirmée vide (0 ligne) avant suppression : aucune UI n'a jamais permis
 * d'y écrire (voir HANDOFF.md, historique). `DROP TABLE IF EXISTS` est
 * idempotent par construction — pas besoin de clé `meta` dédiée.
 */
function migrateDropCoachSignals(): void {
  db.exec("DROP TABLE IF EXISTS coach_signals;");
}

migrateDropCoachSignals();

/**
 * Migration ponctuelle : supprime `forum_topics`/`forum_replies`, tables du
 * module Forum retiré entièrement de l'application sur demande explicite de
 * l'utilisateur (composant, routes de rendu, types, sidebar — voir git log
 * et HANDOFF.md). Confirmées vides avant suppression : le forum n'a jamais
 * eu d'entrée dans la sidebar, aucun élève ni coach n'a donc jamais pu y
 * écrire depuis l'UI. `forum_replies` d'abord (clé étrangère vers
 * `forum_topics`), `DROP TABLE IF EXISTS` idempotent par construction — pas
 * besoin de clé `meta` dédiée.
 */
function migrateDropForum(): void {
  db.exec("DROP TABLE IF EXISTS forum_replies;");
  db.exec("DROP TABLE IF EXISTS forum_topics;");
}

migrateDropForum();

/**
 * Ajoute `totp_secret`/`totp_enabled_at` à `staff_accounts` sur une base
 * EXISTANTE créée avant l'introduction de la 2FA — le `CREATE TABLE IF NOT
 * EXISTS` plus haut ne les crée que sur une base neuve, où ces colonnes
 * existent donc déjà : vérifier leur présence via `PRAGMA table_info` (et
 * non une clé `meta`, qui déclencherait un `ALTER TABLE` en double sur une
 * base neuve — "duplicate column name") est ce qui rend cette migration
 * réellement idempotente dans les deux cas.
 */
function migrateAddTotpColumns(): void {
  const columns = db.prepare("PRAGMA table_info(staff_accounts)").all() as { name: string }[];
  const hasColumn = (name: string) => columns.some((c) => c.name === name);

  db.transaction(() => {
    if (!hasColumn("totp_secret")) {
      db.exec("ALTER TABLE staff_accounts ADD COLUMN totp_secret TEXT;");
    }
    if (!hasColumn("totp_enabled_at")) {
      db.exec("ALTER TABLE staff_accounts ADD COLUMN totp_enabled_at TEXT;");
    }
    if (!hasColumn("totp_last_used_step")) {
      db.exec("ALTER TABLE staff_accounts ADD COLUMN totp_last_used_step INTEGER;");
    }
  })();
}

migrateAddTotpColumns();

/**
 * Ajoute `lock_count` à `login_lockouts` sur une base existante — même
 * principe et même raison que `migrateAddTotpColumns`. Voir le commentaire
 * de la colonne dans le `CREATE TABLE IF NOT EXISTS` plus haut.
 */
function migrateAddLockCountColumn(): void {
  const columns = db.prepare("PRAGMA table_info(login_lockouts)").all() as { name: string }[];
  if (columns.some((c) => c.name === "lock_count")) return;
  db.exec("ALTER TABLE login_lockouts ADD COLUMN lock_count INTEGER NOT NULL DEFAULT 0;");
}

migrateAddLockCountColumn();

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
