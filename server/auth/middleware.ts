import type { Request, Response, NextFunction } from "express";
import { DEFAULT_USER_ID } from "../db";
import { getStaffById } from "./credentials";
import { recordSecurityEvent } from "./securityEvents";
import { readSessionToken, validateSession } from "./sessions";

/**
 * Résout l'email d'une session déjà authentifiée, pour journaliser un
 * `access_denied` — `req.auth` ne porte que l'identifiant, jamais l'email.
 */
function resolveAuthEmail(req: Request): string | null {
  if (!req.auth) return null;
  return getStaffById(req.auth.userId)?.email ?? null;
}

/**
 * Barrière d'authentification.
 *
 * Elle est montée sur le routeur `api`, **jamais** en `app.use` : Vite est monté
 * après l'API dans `startServer()`, un middleware au niveau application
 * intercepterait donc `/@vite/client`, `/@react-refresh` et la négociation
 * WebSocket du rechargement à chaud, cassant tout le développement.
 *
 * Déploiement mono-utilisateur : une seule identité peut atteindre cette
 * barrière, le compte créé par `/auth/setup`.
 */

/** Identité attachée à la requête par `requireAuth`. */
export interface AuthContext {
  /** Identifiant du compte. */
  userId: string;
  /** Bureau de données sur lequel cette session agit — toujours `DEFAULT_USER_ID`. */
  dataUserId: string;
  /** Toujours vrai : cette instance n'a qu'un seul compte, avec tous les droits. */
  isAdmin: boolean;
}

declare global {
  namespace Express {
    interface Request {
      auth?: AuthContext;
    }
  }
}

/**
 * Routes accessibles sans session.
 *
 * L'ordre de déclaration dans `routes.ts` suffit déjà à les placer avant la
 * barrière ; cette liste est un filet de sécurité pour qu'un ajout de route au
 * mauvais endroit ne rende pas l'application inaccessible.
 *
 * Les chemins sont **relatifs au routeur** : `req.path` vaut `/state`, pas
 * `/api/state`, dans un middleware monté sur `/api`.
 */
const PUBLIC_PATHS = new Set([
  "/health",
  "/auth/me",
  "/auth/login",
  // 2ᵉ étape de la connexion (2FA) : aucune session n'existe encore à ce
  // stade (voir `createTwoFactorChallenge`).
  "/auth/login/2fa",
  "/auth/logout",
  "/auth/setup",
]);

/**
 * Préfixes publics, pour les routes paramétrées qu'un `Set` de chemins exacts
 * ne peut structurellement pas couvrir. Vide aujourd'hui — il n'existe pas de
 * route paramétrée sans session. Réintroduire une entrée ici SEULEMENT à
 * côté de l'implémentation réelle de la route correspondante (jamais par
 * anticipation) : une entrée orpheline accorderait un accès non authentifié
 * silencieux dès qu'une route paraissant correspondre au préfixe serait
 * ajoutée sans revue dédiée.
 */
const PUBLIC_PATH_PREFIXES: string[] = [];

/**
 * Seule route accessible à une session dont le mot de passe est encore
 * temporaire. Le client se gouverne déjà sur `mustChangePassword` renvoyé par
 * `/auth/me` et n'appelle normalement jamais les autres routes dans cet état
 * — ce blocage est un filet de sécurité, pas le mécanisme principal.
 */
const CHANGE_PASSWORD_PATH = "/auth/change-password";

export const requireAuth = (req: Request, res: Response, next: NextFunction) => {
  if (PUBLIC_PATHS.has(req.path) || PUBLIC_PATH_PREFIXES.some((prefix) => req.path.startsWith(prefix))) {
    next();
    return;
  }

  const token = readSessionToken(req);
  const session = token ? validateSession(token) : null;

  if (!session) {
    res.status(401).json({ error: "Session expirée ou absente." });
    return;
  }

  // Relu en base à chaque requête, jamais pris dans le cookie : un
  // changement de mot de passe prend effet immédiatement, sans attendre
  // l'expiration de la session.
  const staff = getStaffById(session.userId);
  if (!staff) {
    res.status(401).json({ error: "Session expirée ou absente." });
    return;
  }

  if (staff.mustChangePassword && req.path !== CHANGE_PASSWORD_PATH) {
    res.status(403).json({
      error: "Mot de passe temporaire : choisis-en un nouveau avant de continuer.",
      code: "MUST_CHANGE_PASSWORD",
    });
    return;
  }

  req.auth = {
    userId: staff.id,
    dataUserId: DEFAULT_USER_ID,
    isAdmin: true,
  };
  next();
};

/**
 * Réserve une route aux administrateurs.
 *
 * Toujours vrai aujourd'hui après `requireAuth` (le seul compte de cette
 * instance a tous les droits) — conservé pour documenter l'intention à
 * l'appel.
 */
export const requireAdmin = (req: Request, res: Response, next: NextFunction) => {
  if (req.auth?.isAdmin !== true) {
    recordSecurityEvent({
      eventType: "access_denied",
      severity: "critical",
      accountKind: "staff",
      accountEmail: resolveAuthEmail(req),
      ip: req.ip,
      detail: `réservé à l'administrateur (${req.method} ${req.path})`,
    });
    res.status(403).json({ error: "Action réservée à l'administrateur." });
    return;
  }
  next();
};
