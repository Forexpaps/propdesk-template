import { createHash, randomBytes, randomInt } from "node:crypto";
import { db } from "../db";
import { generateTotpSecret, verifyTotpCode } from "./totp";

/**
 * Accès bas niveau à la 2FA (TOTP) d'un compte staff — secret, activation,
 * codes de récupération, défi de connexion en attente. Module séparé de
 * `credentials.ts` (même découpage que `studentCredentials.ts` à côté de
 * `credentials.ts`) : `credentials.ts` reste le seul point d'accès aux
 * identifiants de connexion eux-mêmes, celui-ci ne touche que les colonnes
 * `totp_*` et les deux tables dédiées (`staff_recovery_codes`,
 * `staff_2fa_challenges`).
 */

function fingerprint(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

export function isTotpEnabled(staffId: string): boolean {
  const row = db.prepare("SELECT totp_enabled_at FROM staff_accounts WHERE id = ?").get(staffId) as
    | { totp_enabled_at: string | null }
    | undefined;
  return row?.totp_enabled_at != null;
}

/**
 * Démarre (ou redémarre) une configuration 2FA : nouveau secret, stocké
 * immédiatement mais PAS encore actif (`totp_enabled_at` reste NULL tant que
 * `confirmTotpSetup` n'a pas vérifié un code valide). Écrase tout secret
 * précédemment en attente — un compte qui relance la configuration sans
 * avoir confirmé la précédente repart proprement, aucun état orphelin.
 */
export function startTotpSetup(staffId: string): string {
  const secret = generateTotpSecret();
  db.prepare("UPDATE staff_accounts SET totp_secret = ?, totp_enabled_at = NULL WHERE id = ?").run(
    secret,
    staffId
  );
  return secret;
}

/**
 * Confirme la configuration en cours : le compte doit prouver qu'il a bien
 * enregistré le secret (un code TOTP valide généré depuis) avant que la 2FA
 * ne devienne active. Renvoie `false` sans rien modifier si le code est
 * invalide ou qu'aucun secret n'est en attente.
 */
export function confirmTotpSetup(staffId: string, code: string): boolean {
  const row = db.prepare("SELECT totp_secret FROM staff_accounts WHERE id = ?").get(staffId) as
    | { totp_secret: string | null }
    | undefined;
  if (!row?.totp_secret || !verifyTotpCode(row.totp_secret, code)) return false;

  db.prepare("UPDATE staff_accounts SET totp_enabled_at = ? WHERE id = ?").run(
    new Date().toISOString(),
    staffId
  );
  return true;
}

/** Désactive entièrement la 2FA du compte : secret et codes de récupération purgés. */
export function disableTotp(staffId: string): void {
  db.transaction(() => {
    db.prepare("UPDATE staff_accounts SET totp_secret = NULL, totp_enabled_at = NULL WHERE id = ?").run(
      staffId
    );
    db.prepare("DELETE FROM staff_recovery_codes WHERE staff_id = ?").run(staffId);
  })();
}

/** Vérifie un code TOTP contre le secret ACTIF du compte (2FA déjà activée) — `null` si la 2FA n'est pas active. */
export function verifyStaffTotpCode(staffId: string, code: string): boolean {
  const row = db
    .prepare("SELECT totp_secret FROM staff_accounts WHERE id = ? AND totp_enabled_at IS NOT NULL")
    .get(staffId) as { totp_secret: string | null } | undefined;
  if (!row?.totp_secret) return false;
  return verifyTotpCode(row.totp_secret, code);
}

const RECOVERY_CODE_COUNT = 8;
/** Alphabet sans caractères ambigus (0/O, 1/I/l) — recopié à la main en cas de perte du téléphone. */
const RECOVERY_CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

function generateRecoveryCode(): string {
  let raw = "";
  for (let i = 0; i < 10; i++) {
    raw += RECOVERY_CODE_ALPHABET[randomInt(RECOVERY_CODE_ALPHABET.length)];
  }
  return `${raw.slice(0, 5)}-${raw.slice(5)}`;
}

/**
 * (Re)génère les codes de récupération d'un compte — remplace intégralement
 * les précédents (les anciens deviennent inutilisables), renvoyés en clair
 * une seule fois, jamais relisibles ensuite (seul le hash est conservé).
 */
export function generateRecoveryCodes(staffId: string): string[] {
  const codes = Array.from({ length: RECOVERY_CODE_COUNT }, generateRecoveryCode);
  const now = new Date().toISOString();

  db.transaction(() => {
    db.prepare("DELETE FROM staff_recovery_codes WHERE staff_id = ?").run(staffId);
    const insert = db.prepare(
      "INSERT INTO staff_recovery_codes (id, staff_id, code_hash, created_at, used_at) VALUES (?, ?, ?, ?, NULL)"
    );
    for (const code of codes) {
      insert.run(`rc-${randomBytes(8).toString("hex")}`, staffId, fingerprint(code), now);
    }
  })();

  return codes;
}

/**
 * Consomme un code de récupération à usage unique. `true` et le code est
 * marqué utilisé s'il correspond à un code jamais consommé de ce compte ;
 * `false` sinon, sans effet de bord.
 */
export function consumeRecoveryCode(staffId: string, code: string): boolean {
  const hash = fingerprint(code.trim().toUpperCase());
  const row = db
    .prepare(
      "SELECT id FROM staff_recovery_codes WHERE staff_id = ? AND code_hash = ? AND used_at IS NULL"
    )
    .get(staffId, hash) as { id: string } | undefined;
  if (!row) return false;

  db.prepare("UPDATE staff_recovery_codes SET used_at = ? WHERE id = ?").run(
    new Date().toISOString(),
    row.id
  );
  return true;
}

/** Nombre de codes de récupération encore valides — affiché côté profil pour inciter à en régénérer avant épuisement. */
export function countRemainingRecoveryCodes(staffId: string): number {
  const row = db
    .prepare("SELECT COUNT(*) AS n FROM staff_recovery_codes WHERE staff_id = ? AND used_at IS NULL")
    .get(staffId) as { n: number };
  return row.n;
}

const CHALLENGE_TTL_MS = 5 * 60_000;

/**
 * Défi 2FA temporaire, créé juste après un mot de passe vérifié pour un
 * compte avec 2FA active — voir `POST /auth/login`. Aucune session n'existe
 * encore à ce stade, seulement ce jeton à courte durée de vie (empreinte
 * SHA-256 en base, même raisonnement que `sessions.ts`).
 */
export function createTwoFactorChallenge(staffId: string): string {
  const token = randomBytes(32).toString("hex");
  const now = Date.now();
  db.prepare(
    "INSERT INTO staff_2fa_challenges (token_hash, staff_id, created_at, expires_at) VALUES (?, ?, ?, ?)"
  ).run(fingerprint(token), staffId, new Date(now).toISOString(), new Date(now + CHALLENGE_TTL_MS).toISOString());
  return token;
}

/** `staffId` associé au jeton s'il est valide et non expiré, `null` sinon. Ne consomme PAS le jeton — plusieurs essais de code sont autorisés dans la fenêtre de 5 minutes (le rate-limit HTTP et le verrouillage par compte bornent déjà les tentatives). */
export function peekTwoFactorChallenge(token: string): string | null {
  const row = db
    .prepare("SELECT staff_id, expires_at FROM staff_2fa_challenges WHERE token_hash = ?")
    .get(fingerprint(token)) as { staff_id: string; expires_at: string } | undefined;
  if (!row) return null;
  if (new Date(row.expires_at).getTime() <= Date.now()) return null;
  return row.staff_id;
}

/** Supprime le défi — appelé une fois la connexion aboutie (succès) pour qu'il ne serve plus qu'une fois. */
export function consumeTwoFactorChallenge(token: string): void {
  db.prepare("DELETE FROM staff_2fa_challenges WHERE token_hash = ?").run(fingerprint(token));
}

/** Purge périodique des défis expirés — même motif que `purgeExpiredSessions` (`sessions.ts`), appelé au fil des requêtes de connexion plutôt qu'un timer dédié. */
export function purgeExpiredTwoFactorChallenges(): void {
  db.prepare("DELETE FROM staff_2fa_challenges WHERE expires_at <= ?").run(new Date().toISOString());
}
