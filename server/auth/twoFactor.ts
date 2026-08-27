import { createHash, randomBytes, randomInt } from "node:crypto";
import { db } from "../db";
import { generateTotpSecret, findMatchingTotpStep } from "./totp";

/**
 * Vérifie un code TOTP contre `staffId` avec suivi anti-rejeu : un code qui
 * matche un pas déjà consommé (`totp_last_used_step`) — ou un pas antérieur,
 * par exemple rejoué depuis une requête interceptée — est refusé même s'il
 * reste dans la fenêtre ±1 de `findMatchingTotpStep`. Le pas est enregistré
 * dès qu'il est accepté, pour qu'il ne puisse plus jamais être réutilisé.
 */
async function verifyAndConsumeTotpStep(staffId: string, secretBase32: string, code: string): Promise<boolean> {
  const result = await db.execute({
    sql: "SELECT totp_last_used_step FROM staff_accounts WHERE id = ?",
    args: [staffId],
  });
  const row = result.rows[0] as unknown as { totp_last_used_step: number | null } | undefined;
  const lastUsedStep = row?.totp_last_used_step ?? null;

  const matchedStep = findMatchingTotpStep(secretBase32, code);
  if (matchedStep === null) return false;
  if (lastUsedStep !== null && matchedStep <= lastUsedStep) return false;

  await db.execute({
    sql: "UPDATE staff_accounts SET totp_last_used_step = ? WHERE id = ?",
    args: [matchedStep, staffId],
  });
  return true;
}

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

export async function isTotpEnabled(staffId: string): Promise<boolean> {
  const result = await db.execute({
    sql: "SELECT totp_enabled_at FROM staff_accounts WHERE id = ?",
    args: [staffId],
  });
  const row = result.rows[0] as unknown as { totp_enabled_at: string | null } | undefined;
  return row?.totp_enabled_at != null;
}

/**
 * Démarre (ou redémarre) une configuration 2FA : nouveau secret, stocké
 * immédiatement mais PAS encore actif (`totp_enabled_at` reste NULL tant que
 * `confirmTotpSetup` n'a pas vérifié un code valide). Écrase tout secret
 * précédemment en attente — un compte qui relance la configuration sans
 * avoir confirmé la précédente repart proprement, aucun état orphelin.
 */
export async function startTotpSetup(staffId: string): Promise<string> {
  const secret = generateTotpSecret();
  await db.execute({
    sql: "UPDATE staff_accounts SET totp_secret = ?, totp_enabled_at = NULL WHERE id = ?",
    args: [secret, staffId],
  });
  return secret;
}

/**
 * Confirme la configuration en cours : le compte doit prouver qu'il a bien
 * enregistré le secret (un code TOTP valide généré depuis) avant que la 2FA
 * ne devienne active. Renvoie `false` sans rien modifier si le code est
 * invalide ou qu'aucun secret n'est en attente.
 */
export async function confirmTotpSetup(staffId: string, code: string): Promise<boolean> {
  const result = await db.execute({
    sql: "SELECT totp_secret FROM staff_accounts WHERE id = ?",
    args: [staffId],
  });
  const row = result.rows[0] as unknown as { totp_secret: string | null } | undefined;
  if (!row?.totp_secret || !(await verifyAndConsumeTotpStep(staffId, row.totp_secret, code))) return false;

  await db.execute({
    sql: "UPDATE staff_accounts SET totp_enabled_at = ? WHERE id = ?",
    args: [new Date().toISOString(), staffId],
  });
  return true;
}

/** Désactive entièrement la 2FA du compte : secret et codes de récupération purgés. */
export async function disableTotp(staffId: string): Promise<void> {
  const tx = await db.transaction("write");
  try {
    await tx.execute({
      sql: "UPDATE staff_accounts SET totp_secret = NULL, totp_enabled_at = NULL WHERE id = ?",
      args: [staffId],
    });
    await tx.execute({
      sql: "DELETE FROM staff_recovery_codes WHERE staff_id = ?",
      args: [staffId],
    });
    await tx.commit();
  } catch (err) {
    await tx.rollback();
    throw err;
  } finally {
    tx.close();
  }
}

/** Vérifie un code TOTP contre le secret ACTIF du compte (2FA déjà activée) — `false` si la 2FA n'est pas active. */
export async function verifyStaffTotpCode(staffId: string, code: string): Promise<boolean> {
  const result = await db.execute({
    sql: "SELECT totp_secret FROM staff_accounts WHERE id = ? AND totp_enabled_at IS NOT NULL",
    args: [staffId],
  });
  const row = result.rows[0] as unknown as { totp_secret: string | null } | undefined;
  if (!row?.totp_secret) return false;
  return verifyAndConsumeTotpStep(staffId, row.totp_secret, code);
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
export async function generateRecoveryCodes(staffId: string): Promise<string[]> {
  const codes = Array.from({ length: RECOVERY_CODE_COUNT }, generateRecoveryCode);
  const now = new Date().toISOString();

  const tx = await db.transaction("write");
  try {
    await tx.execute({ sql: "DELETE FROM staff_recovery_codes WHERE staff_id = ?", args: [staffId] });
    for (const code of codes) {
      await tx.execute({
        sql: "INSERT INTO staff_recovery_codes (id, staff_id, code_hash, created_at, used_at) VALUES (?, ?, ?, ?, NULL)",
        args: [`rc-${randomBytes(8).toString("hex")}`, staffId, fingerprint(code), now],
      });
    }
    await tx.commit();
  } catch (err) {
    await tx.rollback();
    throw err;
  } finally {
    tx.close();
  }

  return codes;
}

/**
 * Consomme un code de récupération à usage unique. `true` et le code est
 * marqué utilisé s'il correspond à un code jamais consommé de ce compte ;
 * `false` sinon, sans effet de bord.
 */
export async function consumeRecoveryCode(staffId: string, code: string): Promise<boolean> {
  const hash = fingerprint(code.trim().toUpperCase());
  const result = await db.execute({
    sql: "SELECT id FROM staff_recovery_codes WHERE staff_id = ? AND code_hash = ? AND used_at IS NULL",
    args: [staffId, hash],
  });
  const row = result.rows[0] as unknown as { id: string } | undefined;
  if (!row) return false;

  await db.execute({
    sql: "UPDATE staff_recovery_codes SET used_at = ? WHERE id = ?",
    args: [new Date().toISOString(), row.id],
  });
  return true;
}

/** Nombre de codes de récupération encore valides — affiché côté profil pour inciter à en régénérer avant épuisement. */
export async function countRemainingRecoveryCodes(staffId: string): Promise<number> {
  const result = await db.execute({
    sql: "SELECT COUNT(*) AS n FROM staff_recovery_codes WHERE staff_id = ? AND used_at IS NULL",
    args: [staffId],
  });
  const row = result.rows[0] as unknown as { n: number };
  return row.n;
}

const CHALLENGE_TTL_MS = 5 * 60_000;

/**
 * Défi 2FA temporaire, créé juste après un mot de passe vérifié pour un
 * compte avec 2FA active — voir `POST /auth/login`. Aucune session n'existe
 * encore à ce stade, seulement ce jeton à courte durée de vie (empreinte
 * SHA-256 en base, même raisonnement que `sessions.ts`).
 */
export async function createTwoFactorChallenge(staffId: string): Promise<string> {
  const token = randomBytes(32).toString("hex");
  const now = Date.now();
  await db.execute({
    sql: "INSERT INTO staff_2fa_challenges (token_hash, staff_id, created_at, expires_at) VALUES (?, ?, ?, ?)",
    args: [fingerprint(token), staffId, new Date(now).toISOString(), new Date(now + CHALLENGE_TTL_MS).toISOString()],
  });
  return token;
}

/** `staffId` associé au jeton s'il est valide et non expiré, `null` sinon. Ne consomme PAS le jeton — plusieurs essais de code sont autorisés dans la fenêtre de 5 minutes (le rate-limit HTTP et le verrouillage par compte bornent déjà les tentatives). */
export async function peekTwoFactorChallenge(token: string): Promise<string | null> {
  const result = await db.execute({
    sql: "SELECT staff_id, expires_at FROM staff_2fa_challenges WHERE token_hash = ?",
    args: [fingerprint(token)],
  });
  const row = result.rows[0] as unknown as { staff_id: string; expires_at: string } | undefined;
  if (!row) return null;
  if (new Date(row.expires_at).getTime() <= Date.now()) return null;
  return row.staff_id;
}

/** Supprime le défi — appelé une fois la connexion aboutie (succès) pour qu'il ne serve plus qu'une fois. */
export async function consumeTwoFactorChallenge(token: string): Promise<void> {
  await db.execute({ sql: "DELETE FROM staff_2fa_challenges WHERE token_hash = ?", args: [fingerprint(token)] });
}

/** Purge périodique des défis expirés — même motif que `purgeExpiredSessions` (`sessions.ts`), appelé au fil des requêtes de connexion plutôt qu'un timer dédié. */
export async function purgeExpiredTwoFactorChallenges(): Promise<void> {
  await db.execute({
    sql: "DELETE FROM staff_2fa_challenges WHERE expires_at <= ?",
    args: [new Date().toISOString()],
  });
}
