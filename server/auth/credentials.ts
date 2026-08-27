import { db, DEFAULT_USER_ID } from "../db";

/**
 * Accès à la table `staff_accounts`.
 *
 * Ce module est le seul à lire ou écrire l'identité de connexion. Rien de ce
 * qu'il renvoie ne doit atteindre le client : `passwordHash` en particulier
 * ne sort jamais des routes d'authentification.
 *
 * Déploiement mono-utilisateur : chaque instance de l'application n'a
 * qu'un seul compte, créé une fois pour toutes par `/auth/setup` et
 * réutilisant `DEFAULT_USER_ID` comme identifiant — c'est aussi le bureau de
 * données (voir `server/db.ts`), il n'y a donc pas de distinction entre
 * "identité de connexion" et "bureau" comme dans un système multi-comptes.
 */

export interface StaffAccount {
  id: string;
  name: string;
  email: string;
  emailLower: string;
  passwordHash: string;
  mustChangePassword: boolean;
}

interface StaffAccountRow {
  id: string;
  name: string;
  email: string;
  email_lower: string;
  password_hash: string;
  must_change_password: number;
}

function toStaffAccount(row: StaffAccountRow): StaffAccount {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    emailLower: row.email_lower,
    passwordHash: row.password_hash,
    mustChangePassword: row.must_change_password === 1,
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
 * Vrai dès qu'un compte existe.
 *
 * C'est ce qui distingue « première installation » de « connexion », et ce qui
 * verrouille la route de setup — sans quoi n'importe qui pourrait créer le
 * compte à distance. Cette instance n'accueille jamais qu'un seul compte.
 */
export function hasAnyStaffAccount(): boolean {
  const row = db.prepare("SELECT 1 FROM staff_accounts LIMIT 1").get();
  return row !== undefined;
}

export function getStaffByEmail(email: string): StaffAccount | null {
  const row = db
    .prepare(
      `SELECT id, name, email, email_lower, password_hash, must_change_password
       FROM staff_accounts WHERE email_lower = ?`
    )
    .get(normalizeEmail(email)) as StaffAccountRow | undefined;

  return row ? toStaffAccount(row) : null;
}

export function getStaffById(id: string): StaffAccount | null {
  const row = db
    .prepare(
      `SELECT id, name, email, email_lower, password_hash, must_change_password
       FROM staff_accounts WHERE id = ?`
    )
    .get(id) as StaffAccountRow | undefined;

  return row ? toStaffAccount(row) : null;
}

/**
 * Crée le compte, via `/auth/setup`.
 *
 * Réutilise `DEFAULT_USER_ID` comme identifiant : il n'y a qu'un compte par
 * déploiement, confondu avec le bureau de données.
 */
export function createFirstStaffAccount(input: { email: string; passwordHash: string }): void {
  const now = new Date().toISOString();
  db.prepare(
    `INSERT INTO staff_accounts
       (id, name, email, email_lower, password_hash, must_change_password, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, 0, ?, ?)`
  ).run(
    DEFAULT_USER_ID,
    input.email.split("@")[0] || "Utilisateur",
    input.email.trim(),
    normalizeEmail(input.email),
    input.passwordHash,
    now,
    now
  );
}

/** Remplace le hash d'un compte. Sert au re-hachage transparent après connexion. */
export function updatePasswordHash(id: string, passwordHash: string): void {
  db.prepare(
    "UPDATE staff_accounts SET password_hash = ?, updated_at = ? WHERE id = ?"
  ).run(passwordHash, new Date().toISOString(), id);
}

/**
 * Remplace le mot de passe ET lève le drapeau d'obligation de changement, en
 * une seule écriture — c'est le chemin de `/auth/change-password`.
 */
export function setPassword(id: string, passwordHash: string): void {
  db.prepare(
    "UPDATE staff_accounts SET password_hash = ?, must_change_password = 0, updated_at = ? WHERE id = ?"
  ).run(passwordHash, new Date().toISOString(), id);
}

/**
 * Garantit l'existence de la ligne `users` avant l'insertion du compte.
 *
 * Sans lien avec `staff_accounts` (pas de clé étrangère vers `users`) — cette
 * fonction reste nécessaire pour amorcer le bureau de données lui-même sur une
 * base neuve. Un profil existant n'est jamais écrasé : c'est ce qui préserve
 * les données lors de l'installation sur une base déjà peuplée.
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
