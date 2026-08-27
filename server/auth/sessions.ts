import { createHash, randomBytes } from "node:crypto";
// Import explicite : le projet charge la lib DOM *et* @types/node, or la version
// DOM de setInterval renvoie un `number`, sans `.unref()`.
import { setInterval } from "node:timers";
import type { Request, Response } from "express";
import { db } from "../db";

/**
 * Sessions serveur, adossées à SQLite.
 *
 * Le jeton est un secret aléatoire de 256 bits : il n'y a rien à signer, sa
 * validité vient de sa présence en base. Cela évite `cookie-signature`
 * (dépendance transitive d'Express, non déclarée, et le build est en
 * `--packages=external`) et évite d'avoir à gérer un secret dans `.env`.
 */

/** Nom du cookie porteur du jeton de session. */
export const SESSION_COOKIE = "pd_session";

/** Durée d'inactivité tolérée avant expiration. Outil personnel d'usage quotidien : 30 jours. */
const TTL_MS = 30 * 24 * 60 * 60 * 1000;

/**
 * Au-delà de ce délai depuis la dernière vue, la session est prolongée.
 *
 * Le seuil évite un UPDATE à chaque requête : `useSyncedState` en produit
 * plusieurs par seconde.
 */
const SLIDING_THRESHOLD_MS = 24 * 60 * 60 * 1000;

/**
 * Durée de vie ABSOLUE, depuis `created_at`, jamais prolongée — même si la
 * session reste active en continu. Sans ce plafond, `TTL_MS` seul décrivait
 * une fenêtre GLISSANTE (renouvelée à chaque connexion espacée de plus de
 * `SLIDING_THRESHOLD_MS`) : un jeton créé il y a des années restait valide
 * indéfiniment tant que l'appareil se reconnectait au moins une fois par
 * mois — aucune expiration réelle en pratique. Au-delà de ce plafond, une
 * reconnexion complète (identifiants, ou 2FA le cas échéant) est exigée.
 */
const ABSOLUTE_TTL_MS = 90 * 24 * 60 * 60 * 1000;

export interface SessionRecord {
  id: string;
  userId: string;
}

/**
 * Empreinte stockée en base à la place du jeton.
 *
 * Pas de sel : le jeton fait déjà 256 bits d'entropie, aucune attaque par
 * dictionnaire n'est possible. Le but est qu'une copie du fichier de base — qui
 * vit en clair sur le disque, dans le WAL et dans les sauvegardes — ne permette
 * pas de rejouer les sessions.
 */
function fingerprint(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/**
 * Lit un cookie depuis l'en-tête brut.
 *
 * `cookie-parser` n'est pas installé et la contrainte est de ne rien ajouter :
 * ces quelques lignes suffisent et n'ont aucune dette.
 */
export function readCookie(req: Request, name: string): string | null {
  const header = req.headers.cookie;
  if (!header) return null;

  for (const part of header.split(";")) {
    // Découpage sur le PREMIER « = » seulement : une valeur encodée peut en
    // contenir (padding base64, par exemple).
    const eq = part.indexOf("=");
    if (eq === -1) continue;
    if (part.slice(0, eq).trim() !== name) continue;

    const raw = part.slice(eq + 1).trim();
    try {
      return decodeURIComponent(raw);
    } catch {
      // Valeur mal formée : on la traite comme absente plutôt que de laisser
      // remonter une URIError.
      return null;
    }
  }

  return null;
}

/**
 * Crée une session et renvoie le jeton en clair.
 *
 * Le jeton n'est retourné qu'ici, une seule fois : il n'est stocké nulle part
 * sous cette forme, seule son empreinte l'est.
 *
 * Les sessions existantes ne sont pas révoquées — décision produit : plusieurs
 * appareils peuvent rester connectés en parallèle.
 */
export function createSession(userId: string, userAgent?: string): string {
  const token = randomBytes(32).toString("base64url");
  const now = new Date();
  const nowIso = now.toISOString();
  const expiresIso = new Date(now.getTime() + TTL_MS).toISOString();

  db.prepare(
    `INSERT INTO sessions (id, user_id, created_at, expires_at, last_seen_at, user_agent)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).run(
    fingerprint(token),
    userId,
    nowIso,
    expiresIso,
    nowIso,
    userAgent?.slice(0, 200) ?? null
  );

  return token;
}

/**
 * Valide un jeton et renvoie la session correspondante, ou `null`.
 *
 * La comparaison sur `expires_at` est faite en SQL : une session expirée mais
 * pas encore purgée n'est donc jamais utilisable.
 *
 * Prolonge la session si la dernière vue est ancienne.
 */
export function validateSession(token: string): SessionRecord | null {
  const id = fingerprint(token);
  const nowIso = new Date().toISOString();
  const absoluteCutoffIso = new Date(Date.now() - ABSOLUTE_TTL_MS).toISOString();

  const row = db
    .prepare(
      `SELECT id, user_id, last_seen_at FROM sessions
       WHERE id = ? AND expires_at > ? AND created_at > ?`
    )
    .get(id, nowIso, absoluteCutoffIso) as { id: string; user_id: string; last_seen_at: string } | undefined;

  if (!row) return null;

  const lastSeen = Date.parse(row.last_seen_at);
  if (Number.isNaN(lastSeen) || Date.now() - lastSeen > SLIDING_THRESHOLD_MS) {
    const expiresIso = new Date(Date.now() + TTL_MS).toISOString();
    db.prepare(
      "UPDATE sessions SET last_seen_at = ?, expires_at = ? WHERE id = ?"
    ).run(nowIso, expiresIso, id);
  }

  return { id: row.id, userId: row.user_id };
}

/** Révoque une session précise. Idempotent. */
export function destroySession(token: string): void {
  db.prepare("DELETE FROM sessions WHERE id = ?").run(fingerprint(token));
}

/**
 * Révoque toutes les sessions d'un compte SAUF celle qui vient de faire la
 * requête. Pour un changement de mot de passe volontaire : l'auteur du
 * changement doit rester connecté sur l'appareil qu'il utilise déjà (voir
 * la modale "Mon mot de passe"), seuls les AUTRES appareils/onglets sont
 * déconnectés.
 *
 * Distinct de `destroyAllSessions` (auparavant utilisée ici) : celle-ci
 * détruisait aussi la session courante — la réponse HTTP renvoyait bien un
 * 200 "changement réussi", mais la toute requête suivante du même
 * navigateur échouait en 401, déconnectant silencieusement l'auteur du
 * changement au moment même où il s'y attendait le moins. Trouvé en
 * construisant le self-service volontaire (jusqu'ici seul le changement
 * FORCÉ après invitation l'utilisait, où l'effet passait inaperçu — l'écran
 * suivant est de toute façon le tableau de bord fraîchement chargé).
 */
export function destroyOtherSessions(userId: string, currentToken: string): number {
  const currentId = fingerprint(currentToken);
  return db
    .prepare("DELETE FROM sessions WHERE user_id = ? AND id != ?")
    .run(userId, currentId).changes;
}

/**
 * Supprime les sessions expirées.
 *
 * Hygiène, pas sécurité : `validateSession` filtre déjà sur l'expiration.
 * Renvoie le nombre de lignes supprimées.
 */
export function purgeExpiredSessions(): number {
  const nowIso = new Date().toISOString();
  const absoluteCutoffIso = new Date(Date.now() - ABSOLUTE_TTL_MS).toISOString();
  const result = db
    .prepare("DELETE FROM sessions WHERE expires_at <= ? OR created_at <= ?")
    .run(nowIso, absoluteCutoffIso);
  return result.changes;
}

/**
 * Démarre la purge périodique.
 *
 * `.unref()` est indispensable : sans lui, le minuteur garde la boucle
 * d'événements active et le processus ne se termine jamais proprement.
 */
export function startSessionCleanup(): void {
  purgeExpiredSessions();
  setInterval(purgeExpiredSessions, 60 * 60 * 1000).unref();
}

/**
 * Attributs du cookie de session.
 *
 * `secure` est conditionné à la production : le serveur de développement écoute
 * en HTTP clair, et un `secure: true` inconditionnel ferait silencieusement
 * disparaître le cookie — la connexion échouerait sans message compréhensible.
 *
 * `sameSite: "lax"` suffit : combiné à des mutations en PUT/POST
 * `application/json`, il couvre le risque CSRF sans jeton dédié. `strict`
 * n'apporterait rien de plus ici et casserait l'arrivée depuis un lien externe.
 */
function cookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    path: "/",
    secure: process.env.NODE_ENV === "production",
  };
}

/**
 * `rememberMe = false` (poste partagé, décoché par défaut au login) pose un
 * cookie de SESSION — sans `maxAge`, donc effacé par le navigateur à sa
 * fermeture — même si la session serveur, elle, garde sa durée de vie
 * normale (`TTL_MS`/`ABSOLUTE_TTL_MS`) comme filet de secours. `rememberMe =
 * true` (défaut, comportement historique) pose le cookie persistant habituel.
 */
export function setSessionCookie(res: Response, token: string, rememberMe = true): void {
  const options = cookieOptions();
  res.cookie(SESSION_COOKIE, token, rememberMe ? { ...options, maxAge: TTL_MS } : options);
}

/**
 * Supprime le cookie de session.
 *
 * Les attributs doivent correspondre à ceux de l'émission, sinon le navigateur
 * ne supprime rien.
 */
export function clearSessionCookie(res: Response): void {
  res.clearCookie(SESSION_COOKIE, cookieOptions());
}

/** Jeton de session présenté par la requête, s'il y en a un. */
export function readSessionToken(req: Request): string | null {
  return readCookie(req, SESSION_COOKIE);
}
