// Import explicite : le projet charge la lib DOM *et* @types/node, or la version
// DOM de setInterval renvoie un `number`, sans `.unref()`.
import { setInterval } from "node:timers";
import { db } from "../db";

/**
 * Verrouillage de compte après échecs de connexion répétés, PAR (monde,
 * email) — distinct et complémentaire du rate-limit HTTP par IP existant
 * (`server/middleware/rateLimit.ts`), qui reste inchangé. Ce mécanisme-ci
 * suit un COMPTE, pas une adresse IP : deux attaquants derrière deux IP
 * différentes qui ciblent le même compte se heurtent au même verrouillage.
 *
 * Indexé sur l'email **brut normalisé**, jamais sur "compte trouvé en
 * base" : un email inconnu déclenche exactement le même comportement de
 * verrouillage qu'un email réel avec mauvais mot de passe, pour préserver
 * l'anti-énumération déjà en place via `verifyAgainstDecoy` (voir
 * `server/auth/routes.ts` et `server/auth/studentRoutes.ts`).
 */

const WINDOW_MS = 15 * 60_000;
const THRESHOLD = 5;

/**
 * Durée du Nième verrouillage consécutif d'un même compte (`lock_count`,
 * jamais remis à zéro par une simple expiration de fenêtre — seulement par
 * une connexion réussie, `clearLoginFailures`, ou par la purge d'hygiène
 * après 24h d'inactivité, `purgeStaleLockouts`).
 *
 * Sans cette progression, un compte se verrouillait toujours exactement 15
 * minutes, indéfiniment répétable : un attaquant pouvait soutenir ~5
 * tentatives/15 min sans jamais se heurter à un blocage plus dissuasif — un
 * dictionnaire de mots de passe courants restait épuisable en quelques
 * dizaines d'heures. Trouvé en audit de sécurité.
 */
const LOCK_SCHEDULE_MS = [15, 60, 240, 1440].map((minutes) => minutes * 60_000); // 15min, 1h, 4h, 24h
function lockDurationFor(lockCount: number): number {
  const index = Math.min(lockCount, LOCK_SCHEDULE_MS.length) - 1;
  return LOCK_SCHEDULE_MS[Math.max(index, 0)];
}

export type LoginLockoutKind = "staff" | "student";

export interface LockoutStatus {
  lockedUntil: Date | null;
}

export interface RegisterFailedLoginResult {
  locked: boolean;
  lockedUntil: Date | null;
}

/** Verrouillage actif pour ce compte, ou `null` si aucun (jamais échoué, ou expiré). */
export function getLockoutStatus(kind: LoginLockoutKind, emailLower: string): LockoutStatus {
  const row = db
    .prepare("SELECT locked_until FROM login_lockouts WHERE kind = ? AND email_lower = ?")
    .get(kind, emailLower) as { locked_until: string | null } | undefined;

  if (!row?.locked_until) return { lockedUntil: null };

  const lockedUntil = new Date(row.locked_until);
  // Verrouillage expiré : traité comme absent, la prochaine tentative
  // repart avec un compteur neuf (voir registerFailedLogin).
  if (lockedUntil.getTime() <= Date.now()) return { lockedUntil: null };

  return { lockedUntil };
}

/**
 * Enregistre un échec de connexion. Incrémente le compteur si on est
 * toujours dans la fenêtre glissante de 15 minutes depuis le premier échec,
 * sinon repart à 1 avec une fenêtre neuve. Verrouille dès que le compteur
 * atteint le seuil.
 */
export function registerFailedLogin(
  kind: LoginLockoutKind,
  emailLower: string
): RegisterFailedLoginResult {
  const now = new Date();
  const nowIso = now.toISOString();

  const row = db
    .prepare("SELECT failed_count, window_started_at, lock_count FROM login_lockouts WHERE kind = ? AND email_lower = ?")
    .get(kind, emailLower) as { failed_count: number; window_started_at: string; lock_count: number } | undefined;

  let failedCount = 1;
  let windowStartedAt = nowIso;

  if (row && now.getTime() - new Date(row.window_started_at).getTime() < WINDOW_MS) {
    failedCount = row.failed_count + 1;
    windowStartedAt = row.window_started_at;
  }

  const locked = failedCount >= THRESHOLD;
  // `lock_count` n'avance QUE sur un nouveau verrouillage déclenché ici —
  // pas à chaque échec, et jamais remis à zéro par une fenêtre expirée (voir
  // le commentaire de `lockDurationFor`).
  const lockCount = locked ? (row?.lock_count ?? 0) + 1 : row?.lock_count ?? 0;
  const lockedUntil = locked ? new Date(now.getTime() + lockDurationFor(lockCount)) : null;

  db.prepare(
    `INSERT INTO login_lockouts (kind, email_lower, failed_count, window_started_at, locked_until, lock_count, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(kind, email_lower) DO UPDATE SET
       failed_count = excluded.failed_count,
       window_started_at = excluded.window_started_at,
       locked_until = excluded.locked_until,
       lock_count = excluded.lock_count,
       updated_at = excluded.updated_at`
  ).run(kind, emailLower, failedCount, windowStartedAt, lockedUntil ? lockedUntil.toISOString() : null, lockCount, nowIso);

  return { locked, lockedUntil };
}

/** Efface le compteur d'échecs — appelé après une connexion réussie. */
export function clearLoginFailures(kind: LoginLockoutKind, emailLower: string): void {
  db.prepare("DELETE FROM login_lockouts WHERE kind = ? AND email_lower = ?").run(kind, emailLower);
}

/**
 * Purge d'hygiène (pas RGPD ici, juste éviter qu'un scan de bot sur des
 * emails aléatoires fasse grossir la table indéfiniment) : les lignes non
 * mises à jour depuis plus de 24h sont forcément hors de toute fenêtre ou
 * verrouillage actif (15 min chacun).
 */
export function purgeStaleLockouts(): number {
  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  return db.prepare("DELETE FROM login_lockouts WHERE updated_at <= ?").run(cutoff).changes;
}

export function startLockoutCleanup(): void {
  purgeStaleLockouts();
  setInterval(purgeStaleLockouts, 60 * 60 * 1000).unref();
}
