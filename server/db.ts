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

  CREATE TABLE IF NOT EXISTS forum_replies (
    id       TEXT PRIMARY KEY,
    topic_id TEXT NOT NULL REFERENCES forum_topics(id) ON DELETE CASCADE,
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

  -- Identifiants de connexion, volontairement HORS de users.payload.
  --
  -- GET /api/state renvoie le payload du profil tel quel au navigateur : un hash
  -- de mot de passe qui y vivrait partirait au client à chaque démarrage. Une
  -- table séparée rend cette fuite structurellement impossible.
  --
  -- email_lower porte enfin la contrainte d'unicité qui manquait, et elle est
  -- déjà correcte pour le jour où plusieurs comptes existeront.
  CREATE TABLE IF NOT EXISTS user_credentials (
    user_id       TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    email         TEXT NOT NULL,
    email_lower   TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    created_at    TEXT NOT NULL,
    updated_at    TEXT NOT NULL
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
    user_id      TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at   TEXT NOT NULL,
    expires_at   TEXT NOT NULL,
    last_seen_at TEXT NOT NULL,
    user_agent   TEXT
  );
  CREATE INDEX IF NOT EXISTS idx_sessions_user    ON sessions(user_id);
  CREATE INDEX IF NOT EXISTS idx_sessions_expires ON sessions(expires_at);
`);

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
