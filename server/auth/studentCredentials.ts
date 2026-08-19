import { createHash, randomBytes } from "node:crypto";
import { setInterval } from "node:timers";
import { db, DEFAULT_USER_ID } from "../db";
import { getProfile, listCollection } from "../repositories";

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

/**
 * Change l'identifiant de connexion (email) d'un compte élève déjà créé.
 *
 * L'appelant (route staff) doit avoir déjà vérifié l'absence de doublon —
 * cette fonction ne fait que l'écriture, comme `createStudentAccount`.
 */
export function updateStudentEmail(id: string, email: string): void {
  db.prepare(
    "UPDATE student_accounts SET email = ?, email_lower = ?, updated_at = ? WHERE id = ?"
  ).run(email.trim(), normalizeEmail(email), new Date().toISOString(), id);
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

// --- Jetons de réinitialisation de mot de passe ---------------------------

const RESET_TOKEN_TTL_MS = 60 * 60 * 1000; // 1h — court, généré à la demande

function fingerprint(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/**
 * Génère un jeton de réinitialisation pour un compte élève et le renvoie EN
 * CLAIR — seule occasion où il existe hors de sa forme hachée : l'appelant
 * (route staff) doit le donner au staff sous forme de lien complet
 * immédiatement, jamais le restocker.
 */
export function createPasswordResetToken(studentAccountId: string): {
  token: string;
  expiresAt: string;
} {
  const token = randomBytes(32).toString("base64url");
  const now = new Date();
  const expiresAt = new Date(now.getTime() + RESET_TOKEN_TTL_MS).toISOString();

  db.prepare(
    `INSERT INTO student_password_reset_tokens (id, student_account_id, created_at, expires_at)
     VALUES (?, ?, ?, ?)`
  ).run(fingerprint(token), studentAccountId, now.toISOString(), expiresAt);

  return { token, expiresAt };
}

/**
 * Consomme un jeton de réinitialisation : le marque utilisé et renvoie le
 * compte élève concerné, ou `null` si le jeton est invalide, déjà utilisé, ou
 * expiré. Marquer et lire en une seule opération atomique (transaction)
 * évite qu'un jeton soit consommé deux fois par deux requêtes concurrentes.
 */
export function consumePasswordResetToken(token: string): { studentAccountId: string } | null {
  const id = fingerprint(token);

  return db.transaction(() => {
    const row = db
      .prepare(
        `SELECT student_account_id, expires_at, used_at
         FROM student_password_reset_tokens WHERE id = ?`
      )
      .get(id) as { student_account_id: string; expires_at: string; used_at: string | null } | undefined;

    if (!row || row.used_at || new Date(row.expires_at).getTime() < Date.now()) {
      return null;
    }

    db.prepare("UPDATE student_password_reset_tokens SET used_at = ? WHERE id = ?").run(
      new Date().toISOString(),
      id
    );

    return { studentAccountId: row.student_account_id };
  })();
}

/** Purge périodique des jetons expirés depuis plus de 24h — même principe que `purgeExpiredStudentSessions`. */
export function purgeExpiredPasswordResetTokens(): number {
  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const result = db
    .prepare("DELETE FROM student_password_reset_tokens WHERE expires_at < ?")
    .run(cutoff);
  return result.changes;
}

export function startPasswordResetTokenCleanup(): void {
  purgeExpiredPasswordResetTokens();
  setInterval(purgeExpiredPasswordResetTokens, 60 * 60 * 1000).unref();
}

interface EnrolledStudentLite {
  id: string;
  name: string;
  email: string;
  avatar: string;
  level: string;
  joinedDate: string;
  currentCapital: number;
  startingCapital: number;
  [key: string]: unknown;
}

/**
 * Entrées de sidebar qu'un élève n'a structurellement aucun moyen d'utiliser
 * — aucun écran ne les prend en charge côté élève (Suivi des Élèves est
 * réservé à l'admin).
 *
 * Masquées quoi qu'il arrive, indépendamment du réglage de visibilité du
 * fondateur — ce dernier gouverne le reste (Portefeuille, Rentabilité,
 * Examen, Exercice du jour, Module vidéo, Messagerie,
 * Audit Setup, Mindset, Macro) : voir la fusion ci-dessous.
 */
const ALWAYS_HIDDEN_FOR_STUDENTS = ["students"];

/**
 * Profil affichable pour une session élève, reconstruit depuis sa fiche
 * `EnrolledStudent` côté coach — le compte élève lui-même n'a pas de ligne
 * `users` renseignée (voir `AdminStudentView.tsx` côté client, même
 * problème résolu à la même source).
 *
 * `hiddenSidebarItems` fusionne les entrées non prises en charge (toujours
 * masquées) avec le réglage de visibilité du bureau staff partagé : le
 * fondateur masque ou réaffiche un module pour tout le monde, élèves compris,
 * depuis la même icône réglage qu'il utilise déjà pour son propre bureau.
 *
 * **Seule implémentation** — utilisée à la fois pour la session élève réelle
 * (`GET /api/state`, `server/routes.ts`) et pour la Vue Complète admin
 * (`GET /admin/students/:id/view`, `server/auth/routes.ts`). Un appel direct
 * à `getProfile(account.userId)` à la place de cette fonction renverrait le
 * profil brut (quasi toujours `{}`, l'élève n'écrit jamais ce champ) et
 * ignorerait silencieusement le réglage de visibilité du fondateur — bug
 * réel rencontré et corrigé dans la Vue Complète.
 */
export function buildStudentProfile(studentAccountId: string): Record<string, unknown> | null {
  const account = getStudentById(studentAccountId);
  if (!account) return null;

  const enrolled = listCollection<EnrolledStudentLite>("enrolledStudents", DEFAULT_USER_ID).find(
    (s) => s.id === account.enrolledStudentId
  );
  if (!enrolled) return null;

  const staffProfile = getProfile<{ hiddenSidebarItems?: string[] }>(DEFAULT_USER_ID);
  const sharedHidden = staffProfile?.hiddenSidebarItems ?? [];

  return {
    name: enrolled.name,
    email: enrolled.email,
    avatar: enrolled.avatar,
    level: enrolled.level,
    joinedDate: enrolled.joinedDate,
    currentCapital: enrolled.currentCapital,
    startingCapital: enrolled.startingCapital,
    isAdmin: false,
    hiddenSidebarItems: [...new Set([...ALWAYS_HIDDEN_FOR_STUDENTS, ...sharedHidden])],
  };
}
