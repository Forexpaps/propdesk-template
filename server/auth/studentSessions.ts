import { createHash, randomBytes } from "node:crypto";
import { setInterval } from "node:timers";
import type { Request, Response } from "express";
import { db } from "../db";

/**
 * Sessions élève — copie structurelle de `server/auth/sessions.ts`, mais sur
 * `student_sessions`/`student_accounts` et un cookie distinct. Deux mondes
 * séparés : jamais de session élève lue par la barrière staff, ni l'inverse.
 */

export const STUDENT_SESSION_COOKIE = "pd_student_session";

const TTL_MS = 30 * 24 * 60 * 60 * 1000;
const SLIDING_THRESHOLD_MS = 24 * 60 * 60 * 1000;

export interface StudentSessionRecord {
  id: string;
  userId: string;
}

function fingerprint(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function readCookie(req: Request, name: string): string | null {
  const header = req.headers.cookie;
  if (!header) return null;

  for (const part of header.split(";")) {
    const eq = part.indexOf("=");
    if (eq === -1) continue;
    if (part.slice(0, eq).trim() !== name) continue;

    const raw = part.slice(eq + 1).trim();
    try {
      return decodeURIComponent(raw);
    } catch {
      return null;
    }
  }

  return null;
}

export function createStudentSession(studentAccountId: string, userAgent?: string): string {
  const token = randomBytes(32).toString("base64url");
  const now = new Date();
  const nowIso = now.toISOString();
  const expiresIso = new Date(now.getTime() + TTL_MS).toISOString();

  db.prepare(
    `INSERT INTO student_sessions (id, user_id, created_at, expires_at, last_seen_at, user_agent)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).run(
    fingerprint(token),
    studentAccountId,
    nowIso,
    expiresIso,
    nowIso,
    userAgent?.slice(0, 200) ?? null
  );

  return token;
}

export function validateStudentSession(token: string): StudentSessionRecord | null {
  const id = fingerprint(token);
  const nowIso = new Date().toISOString();

  const row = db
    .prepare(
      `SELECT id, user_id, last_seen_at FROM student_sessions
       WHERE id = ? AND expires_at > ?`
    )
    .get(id, nowIso) as { id: string; user_id: string; last_seen_at: string } | undefined;

  if (!row) return null;

  const lastSeen = Date.parse(row.last_seen_at);
  if (Number.isNaN(lastSeen) || Date.now() - lastSeen > SLIDING_THRESHOLD_MS) {
    const expiresIso = new Date(Date.now() + TTL_MS).toISOString();
    db.prepare(
      "UPDATE student_sessions SET last_seen_at = ?, expires_at = ? WHERE id = ?"
    ).run(nowIso, expiresIso, id);
  }

  return { id: row.id, userId: row.user_id };
}

export function destroyStudentSession(token: string): void {
  db.prepare("DELETE FROM student_sessions WHERE id = ?").run(fingerprint(token));
}

/**
 * Renvoie le nombre de sessions détruites (inclut la session courante s'il y
 * en a une). Correct pour un mot de passe FIXÉ PAR UN TIERS (staff qui
 * définit le mot de passe d'un élève, ou lien de reset consommé hors
 * session) — il n'y a alors aucune "session courante de l'élève" à
 * préserver. Pour un changement VOLONTAIRE par l'élève lui-même, connecté,
 * voir `destroyOtherStudentSessions` à la place (même raison que
 * `destroyOtherSessions` côté staff, `sessions.ts`).
 */
export function destroyAllStudentSessions(studentAccountId: string): number {
  return db.prepare("DELETE FROM student_sessions WHERE user_id = ?").run(studentAccountId).changes;
}

/** Même principe que `destroyOtherSessions` (staff), pour le monde élève. */
export function destroyOtherStudentSessions(studentAccountId: string, currentToken: string): number {
  const currentId = fingerprint(currentToken);
  return db
    .prepare("DELETE FROM student_sessions WHERE user_id = ? AND id != ?")
    .run(studentAccountId, currentId).changes;
}

export function purgeExpiredStudentSessions(): number {
  const result = db
    .prepare("DELETE FROM student_sessions WHERE expires_at <= ?")
    .run(new Date().toISOString());
  return result.changes;
}

export function startStudentSessionCleanup(): void {
  purgeExpiredStudentSessions();
  setInterval(purgeExpiredStudentSessions, 60 * 60 * 1000).unref();
}

function cookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    path: "/",
    secure: process.env.NODE_ENV === "production",
  };
}

export function setStudentSessionCookie(res: Response, token: string): void {
  res.cookie(STUDENT_SESSION_COOKIE, token, { ...cookieOptions(), maxAge: TTL_MS });
}

export function clearStudentSessionCookie(res: Response): void {
  res.clearCookie(STUDENT_SESSION_COOKIE, cookieOptions());
}

export function readStudentSessionToken(req: Request): string | null {
  return readCookie(req, STUDENT_SESSION_COOKIE);
}
