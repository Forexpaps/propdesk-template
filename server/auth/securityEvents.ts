import { setInterval } from "node:timers";
import { randomBytes } from "node:crypto";
import { db } from "../db";

/**
 * Journal de sécurité, lecture réservée au compte fondateur (voir
 * `requireOwner` dans `server/auth/middleware.ts`). Couvre les deux mondes
 * d'identité (staff ET élève) — `accountKind` distingue lequel.
 *
 * Purge automatique à 90 jours : les adresses IP sont des données
 * personnelles (voir `purgeOldSecurityEvents`/`startSecurityEventCleanup`).
 * Aucun mot de passe ni jeton de session n'est jamais écrit ici.
 */

export type SecuritySeverity = "info" | "warning" | "critical";
export type SecurityAccountKind = "staff" | "student";

export interface RecordSecurityEventInput {
  eventType: string;
  severity: SecuritySeverity;
  accountKind?: SecurityAccountKind | null;
  accountEmail?: string | null;
  ip?: string | null;
  detail?: string;
}

export interface SecurityEventDTO {
  id: string;
  createdAt: string;
  eventType: string;
  severity: SecuritySeverity;
  accountKind: SecurityAccountKind | null;
  accountEmail: string | null;
  ip: string | null;
  detail: string;
}

interface SecurityEventRow {
  id: string;
  created_at: string;
  event_type: string;
  severity: SecuritySeverity;
  account_kind: SecurityAccountKind | null;
  account_email: string | null;
  ip_address: string | null;
  detail: string;
}

export interface SecurityEventFilters {
  severity?: SecuritySeverity;
  eventType?: string;
  limit: number;
  offset: number;
}

export interface SecurityEventListResult {
  events: SecurityEventDTO[];
  total: number;
}

export interface SecurityEvent24hStats {
  loginSuccess: number;
  loginFailed: number;
  lockouts: number;
  accessDenied: number;
}

/**
 * Écrit un événement dans le journal. Ne lève **jamais** : une panne
 * d'écriture du journal ne doit jamais faire échouer une vraie action
 * d'authentification (login, changement de mot de passe, etc.).
 */
export function recordSecurityEvent(input: RecordSecurityEventInput): void {
  try {
    db.prepare(
      `INSERT INTO security_events (id, created_at, event_type, severity, account_kind, account_email, ip_address, detail)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      `evt-${randomBytes(12).toString("base64url")}`,
      new Date().toISOString(),
      input.eventType,
      input.severity,
      input.accountKind ?? null,
      input.accountEmail ?? null,
      input.ip ?? null,
      input.detail ?? ""
    );
  } catch (err) {
    console.error("[propdesk] Écriture du journal de sécurité échouée.", err);
  }
}

function rowToDTO(row: SecurityEventRow): SecurityEventDTO {
  return {
    id: row.id,
    createdAt: row.created_at,
    eventType: row.event_type,
    severity: row.severity,
    accountKind: row.account_kind,
    accountEmail: row.account_email,
    ip: row.ip_address,
    detail: row.detail,
  };
}

/** Lecture filtrée, paginée, triée du plus récent au plus ancien. */
export function listSecurityEvents(filters: SecurityEventFilters): SecurityEventListResult {
  const conditions: string[] = [];
  const params: (string | number)[] = [];

  if (filters.severity) {
    conditions.push("severity = ?");
    params.push(filters.severity);
  }
  if (filters.eventType) {
    conditions.push("event_type = ?");
    params.push(filters.eventType);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

  const { count: total } = db
    .prepare(`SELECT COUNT(*) as count FROM security_events ${whereClause}`)
    .get(...params) as { count: number };

  const rows = db
    .prepare(`SELECT * FROM security_events ${whereClause} ORDER BY created_at DESC LIMIT ? OFFSET ?`)
    .all(...params, filters.limit, filters.offset) as SecurityEventRow[];

  return { events: rows.map(rowToDTO), total };
}

/**
 * Agrégats des 4 cartes de stats (fenêtre glissante 24h). "Échecs" inclut
 * les tentatives bloquées par un verrouillage déjà actif (`login_blocked`),
 * pas seulement les mauvais identifiants (`login_failed`) — toute tentative
 * rejetée compte. "Verrouillages" est un sous-ensemble temporel des échecs :
 * la tentative qui franchit le seuil génère À LA FOIS un `login_failed` et
 * un `account_locked`.
 */
export function get24hStats(): SecurityEvent24hStats {
  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const rows = db
    .prepare("SELECT event_type, COUNT(*) as count FROM security_events WHERE created_at > ? GROUP BY event_type")
    .all(cutoff) as { event_type: string; count: number }[];

  const counts = new Map(rows.map((r) => [r.event_type, r.count]));

  return {
    loginSuccess: counts.get("login_success") ?? 0,
    loginFailed: (counts.get("login_failed") ?? 0) + (counts.get("login_blocked") ?? 0),
    lockouts: counts.get("account_locked") ?? 0,
    accessDenied: counts.get("access_denied") ?? 0,
  };
}

/** Purge RGPD : les IP sont des données personnelles, conservées 90 jours max. */
export function purgeOldSecurityEvents(): number {
  const cutoff = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();
  return db.prepare("DELETE FROM security_events WHERE created_at <= ?").run(cutoff).changes;
}

export function startSecurityEventCleanup(): void {
  purgeOldSecurityEvents();
  setInterval(purgeOldSecurityEvents, 60 * 60 * 1000).unref();
}
