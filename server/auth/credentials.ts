import { db, DEFAULT_USER_ID } from "../db";

/**
 * Accès à la table `user_credentials`.
 *
 * Ce module est le seul à lire ou écrire les identifiants de connexion. Rien de
 * ce qu'il renvoie ne doit atteindre le client : `passwordHash` en particulier
 * ne sort jamais des routes d'authentification.
 */

export interface Credentials {
  userId: string;
  email: string;
  emailLower: string;
  passwordHash: string;
}

interface CredentialsRow {
  user_id: string;
  email: string;
  email_lower: string;
  password_hash: string;
}

function toCredentials(row: CredentialsRow): Credentials {
  return {
    userId: row.user_id,
    email: row.email,
    emailLower: row.email_lower,
    passwordHash: row.password_hash,
  };
}

/**
 * Normalise un email pour servir d'identifiant de connexion.
 *
 * La casse et les espaces de bord ne doivent pas empêcher une connexion
 * légitime. La forme saisie, elle, est conservée à part pour l'affichage.
 */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/**
 * Vrai dès qu'un compte possède des identifiants.
 *
 * C'est ce qui distingue « première installation » de « connexion », et ce qui
 * verrouille la route de setup — sans quoi n'importe qui pourrait réinitialiser
 * le mot de passe à distance.
 */
export function hasAnyCredentials(): boolean {
  const row = db.prepare("SELECT 1 FROM user_credentials LIMIT 1").get();
  return row !== undefined;
}

export function getCredentialsByEmail(email: string): Credentials | null {
  const row = db
    .prepare(
      `SELECT user_id, email, email_lower, password_hash
       FROM user_credentials WHERE email_lower = ?`
    )
    .get(normalizeEmail(email)) as CredentialsRow | undefined;

  return row ? toCredentials(row) : null;
}

export function getCredentialsByUserId(userId: string): Credentials | null {
  const row = db
    .prepare(
      `SELECT user_id, email, email_lower, password_hash
       FROM user_credentials WHERE user_id = ?`
    )
    .get(userId) as CredentialsRow | undefined;

  return row ? toCredentials(row) : null;
}

export function createCredentials(input: {
  userId: string;
  email: string;
  passwordHash: string;
}): void {
  const now = new Date().toISOString();
  db.prepare(
    `INSERT INTO user_credentials
       (user_id, email, email_lower, password_hash, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).run(
    input.userId,
    input.email.trim(),
    normalizeEmail(input.email),
    input.passwordHash,
    now,
    now
  );
}

/** Remplace le hash d'un compte. Sert au re-hachage transparent après connexion. */
export function updatePasswordHash(userId: string, passwordHash: string): void {
  db.prepare(
    "UPDATE user_credentials SET password_hash = ?, updated_at = ? WHERE user_id = ?"
  ).run(passwordHash, new Date().toISOString(), userId);
}

/**
 * Garantit l'existence de la ligne `users` avant l'insertion des identifiants.
 *
 * `foreign_keys = ON` est actif : sans cette ligne, la clé étrangère de
 * `user_credentials` échouerait sur une base neuve. Un profil existant n'est
 * jamais écrasé — c'est ce qui préserve les données lors de l'installation sur
 * une base déjà peuplée.
 */
export function ensureUserRow(profile: Record<string, unknown>): void {
  const existing = db
    .prepare("SELECT 1 FROM users WHERE id = ?")
    .get(DEFAULT_USER_ID);

  if (existing === undefined) {
    db.prepare("INSERT INTO users (id, payload) VALUES (?, ?)").run(
      DEFAULT_USER_ID,
      JSON.stringify(profile)
    );
  }
}
