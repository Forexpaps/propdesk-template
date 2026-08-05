import type { Request, Response, NextFunction } from "express";
import { getProfile } from "../repositories";
import { readSessionToken, validateSession } from "./sessions";

/**
 * Barrière d'authentification.
 *
 * Elle est montée sur le routeur `api`, **jamais** en `app.use` : Vite est monté
 * après l'API dans `startServer()`, un middleware au niveau application
 * intercepterait donc `/@vite/client`, `/@react-refresh` et la négociation
 * WebSocket du rechargement à chaud, cassant tout le développement.
 */

/** Identité attachée à la requête par `requireAuth`. */
export interface AuthContext {
  userId: string;
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
  "/auth/logout",
  "/auth/setup",
]);

export const requireAuth = (req: Request, res: Response, next: NextFunction) => {
  if (PUBLIC_PATHS.has(req.path)) {
    next();
    return;
  }

  const token = readSessionToken(req);
  const session = token ? validateSession(token) : null;

  if (!session) {
    res.status(401).json({ error: "Session expirée ou absente." });
    return;
  }

  // Le statut d'administrateur est relu en base à chaque requête, jamais pris
  // dans le cookie : une révocation prend effet immédiatement.
  const profile = getProfile<{ isAdmin?: boolean }>(session.userId);

  req.auth = {
    userId: session.userId,
    isAdmin: profile?.isAdmin === true,
  };

  next();
};

/**
 * Réserve une route aux administrateurs.
 *
 * À placer après `requireAuth`, qui a déjà renseigné `req.auth`.
 */
export const requireAdmin = (req: Request, res: Response, next: NextFunction) => {
  if (req.auth?.isAdmin !== true) {
    res.status(403).json({ error: "Action réservée à l'administrateur." });
    return;
  }
  next();
};
