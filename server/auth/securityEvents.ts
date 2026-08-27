import { setInterval } from "node:timers";
import { randomBytes } from "node:crypto";
import { db } from "../db";

/**
 * Journal de sécurité — écriture seule aujourd'hui (aucune route de lecture
 * n'est exposée, la consultation en ligne a été retirée avec le journal de
 * sécurité affiché en profil). `accountKind` distingue encore les deux
 * mondes d'identité historiques (staff/élève) pour ne pas casser les lignes
 * déjà écrites.
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

/**
 * Écrit un événement dans le journal. Ne lève **jamais** : une panne
 * d'écriture du journal ne doit jamais faire échouer une vraie action
 * d'authentification (login, changement de mot de passe, etc.).
 */
export function recordSecurityEvent(input: RecordSecurityEventInput): void {
  db.execute({
    sql: `INSERT INTO security_events (id, created_at, event_type, severity, account_kind, account_email, ip_address, detail)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [
      `evt-${randomBytes(12).toString("base64url")}`,
      new Date().toISOString(),
      input.eventType,
      input.severity,
      input.accountKind ?? null,
      input.accountEmail ?? null,
      input.ip ?? null,
      input.detail ?? "",
    ],
  }).catch((err) => {
    console.error("[propdesk] Écriture du journal de sécurité échouée.", err);
  });
}

/** Purge RGPD : les IP sont des données personnelles, conservées 90 jours max. */
export async function purgeOldSecurityEvents(): Promise<number> {
  const cutoff = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();
  const result = await db.execute({
    sql: "DELETE FROM security_events WHERE created_at <= ?",
    args: [cutoff],
  });
  return result.rowsAffected;
}

export function startSecurityEventCleanup(): void {
  purgeOldSecurityEvents().catch((err) => {
    console.error("[propdesk] Purge du journal de sécurité échouée.", err);
  });
  setInterval(() => {
    purgeOldSecurityEvents().catch((err) => {
      console.error("[propdesk] Purge du journal de sécurité échouée.", err);
    });
  }, 60 * 60 * 1000).unref();
}
