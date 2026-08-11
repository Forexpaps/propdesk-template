import { randomBytes } from "node:crypto";
import { db } from "../db";

/**
 * Accès à la table `student_accounts` — deuxième monde d'identité, séparé de
 * `staff_accounts` (voir `server/db.ts`). Un compte élève est toujours lié à
 * une fiche `EnrolledStudent` (`enrolledStudentId`) et à un bureau qui lui est
 * propre (`userId`, une ligne `users` dédiée) — au contraire du staff, qui
 * partage tous le même bureau.
 *
 * Aucun champ d'ici n'atteint jamais le client hors des routes d'auth :
 * `passwordHash` en particulier ne sort jamais.
 */

export interface StudentAccount {
  id: string;
  enrolledStudentId: string;
  userId: string;
  email: string;
  emailLower: string;
  passwordHash: string;
  mustChangePassword: boolean;
}

interface StudentAccountRow {
  id: string;
  enrolled_student_id: string;
  user_id: string;
  email: string;
  email_lower: string;
  password_hash: string;
  must_change_password: number;
}

function toStudentAccount(row: StudentAccountRow): StudentAccount {
  return {
    id: row.id,
    enrolledStudentId: row.enrolled_student_id,
    userId: row.user_id,
    email: row.email,
    emailLower: row.email_lower,
    passwordHash: row.password_hash,
    mustChangePassword: row.must_change_password === 1,
  };
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function getStudentByEmail(email: string): StudentAccount | null {
  const row = db
    .prepare(
      `SELECT id, enrolled_student_id, user_id, email, email_lower, password_hash, must_change_password
       FROM student_accounts WHERE email_lower = ?`
    )
    .get(normalizeEmail(email)) as StudentAccountRow | undefined;

  return row ? toStudentAccount(row) : null;
}

export function getStudentById(id: string): StudentAccount | null {
  const row = db
    .prepare(
      `SELECT id, enrolled_student_id, user_id, email, email_lower, password_hash, must_change_password
       FROM student_accounts WHERE id = ?`
    )
    .get(id) as StudentAccountRow | undefined;

  return row ? toStudentAccount(row) : null;
}

export function getStudentByEnrolledId(enrolledStudentId: string): StudentAccount | null {
  const row = db
    .prepare(
      `SELECT id, enrolled_student_id, user_id, email, email_lower, password_hash, must_change_password
       FROM student_accounts WHERE enrolled_student_id = ?`
    )
    .get(enrolledStudentId) as StudentAccountRow | undefined;

  return row ? toStudentAccount(row) : null;
}

/**
 * Crée un compte élève, avec un mot de passe temporaire déjà haché, et la
 * ligne `users` dédiée qui portera son bureau.
 *
 * L'appelant (route d'invitation) doit avoir déjà vérifié l'absence de
 * doublon d'email et l'absence de compte existant pour cette fiche — cette
 * fonction ne fait que l'écriture, dans une transaction unique avec la pose
 * du lien sur la fiche (voir `server/auth/studentRoutes.ts`).
 */
export function createStudentAccount(input: {
  enrolledStudentId: string;
  email: string;
  passwordHash: string;
  invitedBy: string;
}): { id: string; userId: string } {
  const id = randomBytes(12).toString("base64url");
  const userId = `student-${randomBytes(9).toString("base64url")}`;
  const now = new Date().toISOString();

  db.prepare("INSERT INTO users (id, payload) VALUES (?, ?)").run(userId, "{}");

  db.prepare(
    `INSERT INTO student_accounts
       (id, enrolled_student_id, user_id, email, email_lower, password_hash, must_change_password, invited_by, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?, ?)`
  ).run(
    id,
    input.enrolledStudentId,
    userId,
    input.email.trim(),
    normalizeEmail(input.email),
    input.passwordHash,
    input.invitedBy,
    now,
    now
  );

  return { id, userId };
}

/** Remplace le hash d'un compte. Sert au re-hachage transparent après connexion. */
export function updateStudentPasswordHash(id: string, passwordHash: string): void {
  db.prepare(
    "UPDATE student_accounts SET password_hash = ?, updated_at = ? WHERE id = ?"
  ).run(passwordHash, new Date().toISOString(), id);
}

/** Remplace le mot de passe ET lève l'obligation de changement, en une écriture. */
export function setStudentPassword(id: string, passwordHash: string): void {
  db.prepare(
    "UPDATE student_accounts SET password_hash = ?, must_change_password = 0, updated_at = ? WHERE id = ?"
  ).run(passwordHash, new Date().toISOString(), id);
}

/**
 * Révoque l'accès d'un élève : supprime le compte (cascade `student_sessions`
 * via la clé étrangère). La fiche `EnrolledStudent` et son bureau `users`
 * (donc ses trades) ne sont **pas** supprimés — seul l'accès disparaît.
 */
export function deleteStudentAccount(enrolledStudentId: string): boolean {
  const result = db
    .prepare("DELETE FROM student_accounts WHERE enrolled_student_id = ?")
    .run(enrolledStudentId);
  return result.changes > 0;
}
