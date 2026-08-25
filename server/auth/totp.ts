import { createHmac, randomBytes } from "node:crypto";

/**
 * TOTP (RFC 6238) maison, sans dépendance externe — le projet n'a jamais eu
 * de lib d'auth à deux facteurs (`speakeasy`/`otplib`/`qrcode`), et
 * l'algorithme lui-même est simple : HMAC-SHA1 + troncature dynamique
 * (RFC 4226), compatible avec Google Authenticator/Authy/1Password comme
 * n'importe quelle appli TOTP standard.
 *
 * Choix explicite (voir HANDOFF) : pas de QR code — le secret s'affiche en
 * texte à recopier dans l'appli, plus un lien `otpauth://` cliquable sur
 * mobile. Évite d'ajouter une dépendance juste pour l'ergonomie du scan.
 */

const DIGITS = 6;
const PERIOD_SECONDS = 30;
/** Nombre de pas de temps de chaque côté du pas courant tolérés à la vérification — absorbe le décalage d'horloge entre serveur et téléphone. */
const WINDOW_STEPS = 1;

const BASE32_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

/** RFC 4648, sans padding — forme attendue par les applis d'authentification. */
function base32Encode(buffer: Buffer): string {
  let bits = "";
  for (const byte of buffer) bits += byte.toString(2).padStart(8, "0");

  let output = "";
  for (let i = 0; i + 5 <= bits.length; i += 5) {
    output += BASE32_ALPHABET[parseInt(bits.slice(i, i + 5), 2)];
  }
  const remainder = bits.length % 5;
  if (remainder > 0) {
    const lastChunk = bits.slice(bits.length - remainder).padEnd(5, "0");
    output += BASE32_ALPHABET[parseInt(lastChunk, 2)];
  }
  return output;
}

function base32Decode(encoded: string): Buffer {
  const clean = encoded.toUpperCase().replace(/[^A-Z2-7]/g, "");
  let bits = "";
  for (const char of clean) {
    const index = BASE32_ALPHABET.indexOf(char);
    if (index === -1) continue;
    bits += index.toString(2).padStart(5, "0");
  }

  const bytes: number[] = [];
  for (let i = 0; i + 8 <= bits.length; i += 8) {
    bytes.push(parseInt(bits.slice(i, i + 8), 2));
  }
  return Buffer.from(bytes);
}

/** 20 octets (160 bits) — taille recommandée RFC 4226 pour HMAC-SHA1. */
export function generateTotpSecret(): string {
  return base32Encode(randomBytes(20));
}

/** Espacé par blocs de 4 pour la lisibilité à la recopie manuelle — purement cosmétique, `base32Decode` ignore les espaces. */
export function formatSecretForDisplay(secretBase32: string): string {
  return secretBase32.match(/.{1,4}/g)?.join(" ") ?? secretBase32;
}

function hotp(secretBase32: string, counter: number): string {
  const key = base32Decode(secretBase32);
  const counterBuffer = Buffer.alloc(8);
  counterBuffer.writeBigUInt64BE(BigInt(counter));

  const hmac = createHmac("sha1", key).update(counterBuffer).digest();
  const offset = hmac[hmac.length - 1] & 0x0f;
  const truncated =
    ((hmac[offset] & 0x7f) << 24) |
    ((hmac[offset + 1] & 0xff) << 16) |
    ((hmac[offset + 2] & 0xff) << 8) |
    (hmac[offset + 3] & 0xff);

  return (truncated % 10 ** DIGITS).toString().padStart(DIGITS, "0");
}

function currentTimeStep(forEpochMs: number = Date.now()): number {
  return Math.floor(forEpochMs / 1000 / PERIOD_SECONDS);
}

export function generateTotpCode(secretBase32: string, forEpochMs?: number): string {
  return hotp(secretBase32, currentTimeStep(forEpochMs));
}

/**
 * Compare le code à chaque pas de temps dans `±WINDOW_STEPS` — pas de
 * comparaison en temps constant ici : un code TOTP change toutes les 30s,
 * l'attaque par mesure de temps qui justifierait `timingSafeEqual` ailleurs
 * dans ce projet (mots de passe, jetons) n'a pas de prise pratique sur une
 * fenêtre aussi courte.
 *
 * Renvoie le pas de temps effectivement apparié (pas juste `true`/`false`) —
 * nécessaire pour que l'appelant (`twoFactor.ts`) puisse rejeter un code déjà
 * consommé (anti-rejeu, voir `totp_last_used_step`) : sans connaître QUEL pas
 * a matché dans la fenêtre ±1, impossible de comparer au dernier pas utilisé.
 */
export function findMatchingTotpStep(secretBase32: string, code: string, forEpochMs?: number): number | null {
  if (!/^\d{6}$/.test(code)) return null;

  const step = currentTimeStep(forEpochMs);
  for (let delta = -WINDOW_STEPS; delta <= WINDOW_STEPS; delta++) {
    if (hotp(secretBase32, step + delta) === code) return step + delta;
  }
  return null;
}

/** Vérification simple, sans suivi anti-rejeu — utilisée seulement là où consommer le pas ne s'applique pas. */
export function verifyTotpCode(secretBase32: string, code: string, forEpochMs?: number): boolean {
  return findMatchingTotpStep(secretBase32, code, forEpochMs) !== null;
}

/**
 * URI `otpauth://` standard (RFC lié à Google Authenticator) — cliquable
 * depuis un navigateur mobile pour ouvrir directement l'appli
 * d'authentification par défaut, sans passer par un QR code.
 */
export function buildOtpauthUri(secretBase32: string, accountEmail: string, issuer = "PropDesk"): string {
  const label = encodeURIComponent(`${issuer}:${accountEmail}`);
  const params = new URLSearchParams({
    secret: secretBase32,
    issuer,
    algorithm: "SHA1",
    digits: String(DIGITS),
    period: String(PERIOD_SECONDS),
  });
  return `otpauth://totp/${label}?${params.toString()}`;
}
