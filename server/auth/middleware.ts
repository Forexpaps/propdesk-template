import type { Request, Response, NextFunction } from "express";
import { getStaffById } from "./credentials";
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
  /**
   * Toujours vrai après cette barrière : avoir un compte staff, c'est être du
   * staff — décision produit, tous les comptes ont les mêmes droits. Le champ
   * reste distinct d'un simple "authentifié" pour ne rien changer côté
   * consommateurs (`requireAdmin`, le profil renvoyé au client) si un rôle
   * différencié devenait nécessaire un jour.
   */
  isAdmin: boolean;
  /**
   * Vrai pour le seul compte fondateur (`/auth/setup`), faux pour les comptes
   * invités.
   *
   * Volontairement **distinct de `isAdmin`**, qui reste vrai pour tout le
   * monde : les coachs gardent l'intégralité des droits métier (suivi des
   * élèves, écriture des collections, gestion de l'équipe). Ce drapeau ne
   * gouverne que la configuration du bureau partagé — aujourd'hui les entrées
   * masquées de la sidebar. Réutiliser `isAdmin` aurait retiré aux coachs bien
   * plus que ce qui était demandé.
   */
  isOwner: boolean;
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

/**
 * Seule route accessible à une session dont le mot de passe est encore
 * temporaire. Le client se gouverne déjà sur `mustChangePassword` renvoyé par
 * `/auth/me` et n'appelle normalement jamais les autres routes dans cet état
 * — ce blocage est un filet de sécurité, pas le mécanisme principal.
 */
const CHANGE_PASSWORD_PATH = "/auth/change-password";

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

  // Relu en base à chaque requête, jamais pris dans le cookie : la
  // suppression d'un compte ou un changement de mot de passe prennent effet
  // immédiatement, sans attendre l'expiration de la session.
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

  req.auth = { userId: session.userId, isAdmin: true, isOwner: staff.isOwner };
  next();
};

/**
 * Réserve une route au compte fondateur.
 *
 * Distinct de `requireAdmin` : voir `AuthContext.isOwner`. N'est pas monté sur
 * `PUT /profile`, qui doit rester ouverte aux coachs pour tout le reste du
 * profil — cette route neutralise le seul champ concerné plutôt que de refuser
 * l'écriture entière (voir `server/routes.ts`).
 */
export const requireOwner = (req: Request, res: Response, next: NextFunction) => {
  if (req.auth?.isOwner !== true) {
    res.status(403).json({ error: "Action réservée au compte principal." });
    return;
  }
  next();
};

/**
 * Réserve une route aux administrateurs.
 *
 * Toujours vrai aujourd'hui après `requireAuth` (tous les comptes staff sont
 * égaux) — conservé pour documenter l'intention à l'appel, et pour rester le
 * seul endroit à modifier si des rôles différenciés apparaissent un jour.
 */
export const requireAdmin = (req: Request, res: Response, next: NextFunction) => {
  if (req.auth?.isAdmin !== true) {
    res.status(403).json({ error: "Action réservée à l'administrateur." });
    return;
  }
  next();
};
