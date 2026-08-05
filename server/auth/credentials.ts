import { randomBytes } from "node:crypto";
import { db, DEFAULT_USER_ID } from "../db";

/**
 * Accès à la table `staff_accounts`.
 *
 * Ce module est le seul à lire ou écrire les identités de connexion. Rien de
 * ce qu'il renvoie ne doit atteindre le client : `passwordHash` en particulier
 * ne sort jamais des routes d'authentification.
 *
 * Un compte staff est une IDENTITÉ, pas un bureau : plusieurs comptes
 * partagent les mêmes données (celles de `DEFAULT_USER_ID`), voir
 * `server/db.ts`. Tous les comptes ont les mêmes droits — quiconque a un
 * compte est du staff, il n'y a pas de rôle à vérifier.
 */

export interface StaffAccount {
  id: string;
  name: string;
  email: string;
  emailLower: string;
  passwordHash: string;
  mustChangePassword: boolean;
}

/** Forme exposable au client : jamais de `passwordHash`. */
export interface StaffAccountSummary {
  id: string;
  name: string;
  email: string;
  mustChangePassword: boolean;
  createdAt: string;
}

interface StaffAccountRow {
  id: string;
  name: string;
  email: string;
  email_lower: string;
  password_hash: string;
  must_change_password: number;
}

interface StaffAccountSummaryRow {
  id: string;
  name: string;
  email: string;
  must_change_password: number;
  created_at: string;
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
 * Vrai dès qu'un compte staff existe.
 *
 * C'est ce qui distingue « première installation » de « connexion », et ce qui
 * verrouille la route de setup — sans quoi n'importe qui pourrait créer le
 * premier compte à distance.
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
 * Liste tous les comptes staff, triés par ancienneté. Forme sans `passwordHash`
 * : c'est celle qu'on peut renvoyer telle quelle à un écran d'administration.
 */
export function listStaffAccounts(): StaffAccountSummary[] {
  const rows = db
    .prepare(
      `SELECT id, name, email, must_change_password, created_at
       FROM staff_accounts ORDER BY created_at ASC`
    )
    .all() as StaffAccountSummaryRow[];

  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    email: row.email,
    mustChangePassword: row.must_change_password === 1,
    createdAt: row.created_at,
  }));
}

/**
 * Crée le premier compte staff, via `/auth/setup`.
 *
 * Réutilise `DEFAULT_USER_ID` comme identifiant : historique, sans
 * conséquence pour les comptes suivants (qui reçoivent un id aléatoire via
 * `createInvitedStaffAccount`), mais garde une continuité avec les bases qui
 * existaient avant l'introduction de `staff_accounts`.
 */
export function createFirstStaffAccount(input: { email: string; passwordHash: string }): void {
  const now = new Date().toISOString();
  db.prepare(
    `INSERT INTO staff_accounts
       (id, name, email, email_lower, password_hash, must_change_password, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, 0, ?, ?)`
  ).run(
    DEFAULT_USER_ID,
    input.email.split("@")[0] || "Coach",
    input.email.trim(),
    normalizeEmail(input.email),
    input.passwordHash,
    now,
    now
  );
}

/**
 * Crée un compte invité, avec un mot de passe temporaire déjà haché.
 *
 * `mustChangePassword` est toujours vrai : le mot de passe temporaire n'est
 * connu que de la personne qui invite, jamais choisi par l'intéressé — il
 * doit en définir un qui n'appartient qu'à lui avant de pouvoir utiliser
 * l'application normalement.
 */
export function createInvitedStaffAccount(input: {
  name: string;
  email: string;
  passwordHash: string;
  invitedBy: string;
}): string {
  const id = randomBytes(12).toString("base64url");
  const now = new Date().toISOString();
  db.prepare(
    `INSERT INTO staff_accounts
       (id, name, email, email_lower, password_hash, must_change_password, invited_by, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, 1, ?, ?, ?)`
  ).run(
    id,
    input.name.trim(),
    input.email.trim(),
    normalizeEmail(input.email),
    input.passwordHash,
    input.invitedBy,
    now,
    now
  );
  return id;
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
 * Supprime un compte staff.
 *
 * Refuse de supprimer le dernier compte restant : sans lui, plus personne ne
 * pourrait jamais se reconnecter, et il n'existe aucune procédure de
 * récupération pour ce cas (voir README). Renvoie `false` si le compte
 * n'existait pas ou si c'était le dernier — dans les deux cas, rien n'a été
 * supprimé.
 */
export function deleteStaffAccount(id: string): boolean {
  const total = (db.prepare("SELECT count(*) c FROM staff_accounts").get() as { c: number }).c;
  if (total <= 1) return false;

  const result = db.prepare("DELETE FROM staff_accounts WHERE id = ?").run(id);
  return result.changes > 0;
}

/**
 * Garantit l'existence de la ligne `users` avant l'insertion du premier
 * compte staff.
 *
 * Sans lien avec `staff_accounts` (qui n'a plus de clé étrangère vers
 * `users`) — cette fonction reste nécessaire pour amorcer le bureau partagé
 * lui-même sur une base neuve. Un profil existant n'est jamais écrasé : c'est
 * ce qui préserve les données lors de l'installation sur une base déjà
 * peuplée.
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
