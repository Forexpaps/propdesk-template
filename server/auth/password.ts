import { randomBytes, scrypt, timingSafeEqual, type ScryptOptions } from "node:crypto";

/**
 * Hachage et vérification des mots de passe.
 *
 * scrypt, fourni par node:crypto — aucune dépendance ajoutée. Il est conçu pour
 * coûter de la mémoire autant que du calcul, ce qui rend le matériel dédié
 * (GPU, ASIC) beaucoup moins avantageux qu'avec un simple SHA.
 */

/**
 * Enveloppe promise de `scrypt`.
 *
 * Écrite à la main plutôt qu'avec `promisify` : `scrypt` a deux surcharges, avec
 * et sans `options`, et `promisify` n'en retient qu'une — celle sans options,
 * qui rejette donc l'appel à quatre arguments dont on a besoin pour `maxmem`.
 *
 * La version asynchrone est indispensable : le serveur est mono-processus et
 * sert aussi le HMR de Vite, 80 ms de boucle d'événements bloquée à chaque
 * tentative de connexion serait un déni de service gratuit.
 */
function scryptAsync(
  password: string,
  salt: Buffer,
  keylen: number,
  options: ScryptOptions
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(password, salt, keylen, options, (err, derivedKey) => {
      if (err) reject(err);
      else resolve(derivedKey);
    });
  });
}

/**
 * Paramètres courants.
 *
 * La mémoire requise vaut environ 128 × N × r, soit **128 Mio** ici — bien
 * au-dessus de la limite `maxmem` par défaut de Node, d'où le `MAXMEM`
 * explicite plus bas (sinon scrypt échoue sur ERR_CRYPTO_INVALID_SCRYPT_PARAMS).
 *
 * N = 2^17, le minimum recommandé par l'OWASP Password Storage Cheat Sheet
 * actuel pour scrypt (r=8, p=1). Un précédent réglage à 2^15 (~80 ms sur une
 * machine de dev) était calibré sur "ce qui semblait rapide", pas sur cette
 * recommandation — trouvé et corrigé en audit de sécurité : en cas de fuite
 * de la base (backup exposé, disque compromis), 2^15 cassait ~4× plus vite
 * qu'avec ce réglage. `needsRehash()` fait remonter en douceur tout hash
 * ancien à la prochaine connexion réussie — aucun mot de passe existant n'est
 * invalidé par ce changement.
 */
const CURRENT = { N: 131072, r: 8, p: 1, keylen: 64 } as const;

/**
 * Plafond mémoire accordé à scrypt.
 *
 * Large à dessein : les paramètres d'un hash ancien sont relus depuis la base et
 * pourraient exiger davantage que les paramètres courants. Un plafond trop juste
 * rendrait ces hash invérifiables, donc les comptes inaccessibles.
 */
const MAXMEM = 256 * 1024 * 1024;

/** Longueur du sel, en octets. 16 suffit à rendre les rainbow tables inutiles. */
const SALT_BYTES = 16;

/**
 * Le mot de passe est borné avant d'atteindre scrypt.
 *
 * Sans cela, un corps de requête volumineux ferait travailler la fonction sur
 * une entrée énorme. La route valide déjà cette borne côté zod ; ce garde-fou
 * couvre les appels internes.
 */
const MAX_PASSWORD_LENGTH = 200;

/**
 * Format de stockage, volontairement auto-descriptif :
 *
 *     scrypt$16384$8$1$<sel base64url>$<clé base64url>
 *
 * Les paramètres voyagent avec le hash. Un mot de passe haché avec les anciens
 * paramètres reste donc vérifiable après leur durcissement — sinon changer N
 * invaliderait tous les comptes existants. Le préfixe d'algorithme laisse la
 * place à un `argon2id$…` si une dépendance devenait acceptable un jour.
 */
const ALGORITHM = "scrypt";

interface ParsedHash {
  N: number;
  r: number;
  p: number;
  salt: Buffer;
  key: Buffer;
}

/**
 * Lecture défensive du format stocké.
 *
 * Renvoie `null` — jamais une exception — pour tout ce qui n'est pas un hash
 * valide. Une exception ici remonterait en 500, ce qui distinguerait « hash
 * corrompu en base » de « mauvais mot de passe » pour un appelant hostile.
 */
function parseHash(stored: string): ParsedHash | null {
  const parts = stored.split("$");
  if (parts.length !== 6 || parts[0] !== ALGORITHM) return null;

  const N = Number(parts[1]);
  const r = Number(parts[2]);
  const p = Number(parts[3]);
  if (!Number.isInteger(N) || !Number.isInteger(r) || !Number.isInteger(p)) return null;
  if (N <= 1 || r < 1 || p < 1) return null;

  try {
    const salt = Buffer.from(parts[4], "base64url");
    const key = Buffer.from(parts[5], "base64url");
    if (salt.length === 0 || key.length === 0) return null;
    return { N, r, p, salt, key };
  } catch {
    return null;
  }
}

/** Hache un mot de passe avec les paramètres courants et un sel neuf. */
export async function hashPassword(plain: string): Promise<string> {
  if (plain.length > MAX_PASSWORD_LENGTH) {
    throw new Error("Mot de passe trop long.");
  }

  const salt = randomBytes(SALT_BYTES);
  const key = (await scryptAsync(plain, salt, CURRENT.keylen, {
    N: CURRENT.N,
    r: CURRENT.r,
    p: CURRENT.p,
    maxmem: MAXMEM,
  })) as Buffer;

  return [
    ALGORITHM,
    CURRENT.N,
    CURRENT.r,
    CURRENT.p,
    salt.toString("base64url"),
    key.toString("base64url"),
  ].join("$");
}

/**
 * Vérifie un mot de passe contre un hash stocké.
 *
 * Les paramètres sont relus depuis le hash, pas repris des constantes : c'est ce
 * qui permet de vérifier un hash produit avec des paramètres antérieurs.
 */
export async function verifyPassword(plain: string, stored: string): Promise<boolean> {
  if (plain.length > MAX_PASSWORD_LENGTH) return false;

  const parsed = parseHash(stored);
  if (!parsed) return false;

  let derived: Buffer;
  try {
    derived = (await scryptAsync(plain, parsed.salt, parsed.key.length, {
      N: parsed.N,
      r: parsed.r,
      p: parsed.p,
      maxmem: MAXMEM,
    })) as Buffer;
  } catch {
    return false;
  }

  // timingSafeEqual lève sur des longueurs différentes : il faut les comparer
  // d'abord. Cette longueur ne dépend pas de l'entrée utilisateur (c'est celle
  // du hash stocké), la sortie anticipée ne fuite donc rien d'exploitable.
  if (derived.length !== parsed.key.length) return false;

  return timingSafeEqual(derived, parsed.key);
}

/**
 * Indique qu'un hash a été produit avec des paramètres dépassés.
 *
 * À la connexion réussie, on peut alors ré-hacher avec les paramètres courants
 * et mettre la base à jour — la montée en robustesse se fait donc sans jamais
 * demander à l'utilisateur de changer son mot de passe.
 */
export function needsRehash(stored: string): boolean {
  const parsed = parseHash(stored);
  if (!parsed) return true;
  return (
    parsed.N < CURRENT.N ||
    parsed.r < CURRENT.r ||
    parsed.p < CURRENT.p ||
    parsed.key.length < CURRENT.keylen
  );
}

/**
 * Hash factice, utilisé quand aucun compte ne correspond à l'email présenté.
 *
 * Sans cela, une tentative sur un email inconnu répondrait immédiatement alors
 * qu'un email connu coûterait ~100 ms de scrypt : l'écart suffit à énumérer les
 * comptes existants. On paie donc le même coût dans les deux cas.
 *
 * Calculé une fois, à la demande, sur un secret aléatoire — il n'a jamais à
 * correspondre à quoi que ce soit.
 */
let decoyHash: string | null = null;

export async function verifyAgainstDecoy(plain: string): Promise<void> {
  if (decoyHash === null) {
    decoyHash = await hashPassword(randomBytes(32).toString("base64url"));
  }
  await verifyPassword(plain, decoyHash);
}
