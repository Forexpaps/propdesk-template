import type { Request, Response, NextFunction } from "express";
import { DEFAULT_USER_ID } from "../db";
import { getStaffById } from "./credentials";
import type { StaffPermissionKey } from "./permissions";
import { recordSecurityEvent } from "./securityEvents";
import { readSessionToken, validateSession } from "./sessions";
import { getStudentById } from "./studentCredentials";
import { readStudentSessionToken, validateStudentSession } from "./studentSessions";

/**
 * Résout l'email d'une session déjà authentifiée, pour journaliser un
 * `access_denied` — `req.auth` ne porte que l'identifiant, jamais l'email.
 */
function resolveAuthEmail(req: Request): string | null {
  if (!req.auth) return null;
  if (req.auth.kind === "staff") return getStaffById(req.auth.userId)?.email ?? null;
  return getStudentById(req.auth.userId)?.email ?? null;
}

/**
 * Barrière d'authentification.
 *
 * Elle est montée sur le routeur `api`, **jamais** en `app.use` : Vite est monté
 * après l'API dans `startServer()`, un middleware au niveau application
 * intercepterait donc `/@vite/client`, `/@react-refresh` et la négociation
 * WebSocket du rechargement à chaud, cassant tout le développement.
 *
 * Deux mondes d'identité peuvent atteindre cette barrière : le staff (bureau
 * partagé) et, depuis l'accès élève, un compte élève (bureau personnel). Elle
 * essaie d'abord la session staff, puis la session élève — jamais les deux à
 * la fois, chacune a son propre cookie.
 */

/** Identité attachée à la requête par `requireAuth`. */
export interface AuthContext {
  /** Identifiant du compte (identité de connexion), pas du bureau de données. */
  userId: string;
  /**
   * Quel monde d'identité a authentifié cette requête. Détermine quel
   * bureau de données (`dataUserId`) et quelles routes sont accessibles —
   * voir `server/routes.ts`, qui réserve `staffRouter` et les collections
   * hors Journal à `kind === "staff"`.
   */
  kind: "staff" | "student";
  /**
   * Bureau de données sur lequel cette session peut agir — le `userId` à
   * passer à `server/repositories.ts`. Pour le staff, c'est toujours
   * `DEFAULT_USER_ID` (bureau partagé, quel que soit le compte utilisé pour
   * s'y connecter). Pour un élève, c'est son bureau personnel dédié.
   */
  dataUserId: string;
  /**
   * Bureau PERSONNEL de la session — pour le staff, l'id du compte staff
   * lui-même (`staff.id`, PAS `DEFAULT_USER_ID`, sauf pour le fondateur chez
   * qui les deux coïncident historiquement, voir `createFirstStaffAccount`).
   * Pour un élève, identique à `dataUserId`.
   *
   * Distinct de `dataUserId` : certaines collections restent un bureau
   * VRAIMENT partagé entre tout le staff (fiches élèves, programme,
   * messagerie coach — un élève doit voir un seul coach cohérent, pas un
   * par membre du staff connecté), tandis que d'autres sont le suivi
   * personnel de CE compte (Journal, portefeuilles, badges, alertes,
   * setups) — un coach ne doit pas hériter des trades ni des badges déjà
   * débloqués du fondateur simplement parce qu'il partage le même bureau.
   * Voir `PERSONAL_STAFF_COLLECTIONS` et `resolveCollectionUserId`,
   * `server/routes.ts`.
   */
  personalDataUserId: string;
  /**
   * Toujours vrai pour une session staff, toujours faux pour une session
   * élève — décision produit, tous les comptes staff ont les mêmes droits,
   * aucun élève n'a de droit d'administration.
   */
  isAdmin: boolean;
  /**
   * Vrai pour le seul compte fondateur (`/auth/setup`), faux pour les comptes
   * invités et pour toute session élève.
   *
   * Volontairement **distinct de `isAdmin`**, qui reste vrai pour tout le
   * staff (aucun élève n'a de droit d'administration) : `isOwner` gouverne en
   * plus la configuration du bureau partagé (entrées masquées de la sidebar)
   * ET court-circuite TOUJOURS `permissions` ci-dessous — le fondateur n'est
   * jamais restreignable, y compris par lui-même.
   */
  isOwner: boolean;
  /**
   * Autorisations accordées à CE compte staff — `null` pour une session
   * élève (non applicable) ou pour un compte staff jamais restreint (toutes
   * accordées). Voir `hasStaffPermission`/`requirePermission`,
   * `./permissions.ts`, posé sur les routes staff qui doivent rester
   * retirables individuellement par le fondateur.
   */
  permissions: StaffPermissionKey[] | null;
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
  // 2ᵉ étape de la connexion staff (2FA) : aucune session n'existe encore à
  // ce stade (voir `createTwoFactorChallenge`), oubliée ici jusqu'ici — ne
  // fonctionnait que grâce à l'ordre de montage des routeurs dans
  // `server/routes.ts` (authRouter avant la barrière requireAuth), sans le
  // filet de sécurité que cette liste est censée fournir.
  "/auth/login/2fa",
  "/auth/logout",
  "/auth/setup",
  "/auth/student-me",
  "/auth/student-login",
  "/auth/student-logout",
]);

/**
 * Préfixes publics, pour les routes paramétrées qu'un `Set` de chemins exacts
 * ne peut structurellement pas couvrir — repéré en audit : la consommation
 * du lien de reset élève (`POST /auth/reset-password/:token`,
 * `studentAuthRouter`) reposait uniquement sur l'ordre de montage des
 * routeurs pour rester accessible sans session, sans filet ici. Aujourd'hui
 * sans conséquence (l'ordre actuel la protège déjà), mais un futur refactor
 * qui regrouperait les routeurs après la barrière `requireAuth` l'aurait
 * silencieusement cassée.
 */
const PUBLIC_PATH_PREFIXES = ["/auth/reset-password/"];

/**
 * Seule route accessible à une session dont le mot de passe est encore
 * temporaire. Le client se gouverne déjà sur `mustChangePassword` renvoyé par
 * `/auth/me` et n'appelle normalement jamais les autres routes dans cet état
 * — ce blocage est un filet de sécurité, pas le mécanisme principal.
 */
const CHANGE_PASSWORD_PATH = "/auth/change-password";
const STUDENT_CHANGE_PASSWORD_PATH = "/auth/student-change-password";

/**
 * Essaie la session staff. Ne répond jamais elle-même — renvoie `null` si
 * aucune session staff valide n'est présente, pour laisser `requireAuth`
 * essayer la session élève ensuite.
 */
function tryStaffAuth(req: Request, res: Response): AuthContext | "blocked" | null {
  const token = readSessionToken(req);
  const session = token ? validateSession(token) : null;
  if (!session) return null;

  // Relu en base à chaque requête, jamais pris dans le cookie : la
  // suppression d'un compte ou un changement de mot de passe prennent effet
  // immédiatement, sans attendre l'expiration de la session.
  const staff = getStaffById(session.userId);
  if (!staff) return null;

  if (staff.mustChangePassword && req.path !== CHANGE_PASSWORD_PATH) {
    res.status(403).json({
      error: "Mot de passe temporaire : choisis-en un nouveau avant de continuer.",
      code: "MUST_CHANGE_PASSWORD",
    });
    return "blocked";
  }

  return {
    userId: staff.id,
    kind: "staff",
    dataUserId: DEFAULT_USER_ID,
    personalDataUserId: staff.id,
    isAdmin: true,
    isOwner: staff.isOwner,
    permissions: staff.permissions,
  };
}

/** Même contrat que `tryStaffAuth`, pour le monde élève. */
function tryStudentAuth(req: Request, res: Response): AuthContext | "blocked" | null {
  const token = readStudentSessionToken(req);
  const session = token ? validateStudentSession(token) : null;
  if (!session) return null;

  const student = getStudentById(session.userId);
  if (!student) return null;

  if (student.mustChangePassword && req.path !== STUDENT_CHANGE_PASSWORD_PATH) {
    res.status(403).json({
      error: "Mot de passe temporaire : choisis-en un nouveau avant de continuer.",
      code: "MUST_CHANGE_PASSWORD",
    });
    return "blocked";
  }

  return {
    userId: student.id,
    kind: "student",
    dataUserId: student.userId,
    personalDataUserId: student.userId,
    isAdmin: false,
    isOwner: false,
    permissions: null,
  };
}

export const requireAuth = (req: Request, res: Response, next: NextFunction) => {
  if (PUBLIC_PATHS.has(req.path) || PUBLIC_PATH_PREFIXES.some((prefix) => req.path.startsWith(prefix))) {
    next();
    return;
  }

  const staffResult = tryStaffAuth(req, res);
  if (staffResult === "blocked") return;
  if (staffResult) {
    req.auth = staffResult;
    next();
    return;
  }

  const studentResult = tryStudentAuth(req, res);
  if (studentResult === "blocked") return;
  if (studentResult) {
    req.auth = studentResult;
    next();
    return;
  }

  res.status(401).json({ error: "Session expirée ou absente." });
};

/**
 * Réserve une route au monde staff, en plus de `requireAuth`.
 *
 * Défense en profondeur : `staffRouter` et les routes de gestion des élèves
 * ne devraient jamais être appelées par une session élève, mais on ne compte
 * pas uniquement sur l'absence d'appel légitime.
 */
export const requireStaffKind = (req: Request, res: Response, next: NextFunction) => {
  if (req.auth?.kind !== "staff") {
    recordSecurityEvent({
      eventType: "access_denied",
      severity: "critical",
      accountKind: req.auth?.kind ?? null,
      accountEmail: resolveAuthEmail(req),
      ip: req.ip,
      detail: `réservé au staff (${req.method} ${req.path})`,
    });
    res.status(403).json({ error: "Action réservée au staff." });
    return;
  }
  next();
};

/** Symétrique de `requireStaffKind`, pour les routes propres au monde élève. */
export const requireStudentKind = (req: Request, res: Response, next: NextFunction) => {
  if (req.auth?.kind !== "student") {
    recordSecurityEvent({
      eventType: "access_denied",
      severity: "critical",
      accountKind: req.auth?.kind ?? null,
      accountEmail: resolveAuthEmail(req),
      ip: req.ip,
      detail: `réservé à un compte élève (${req.method} ${req.path})`,
    });
    res.status(403).json({ error: "Action réservée à un compte élève." });
    return;
  }
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
    recordSecurityEvent({
      eventType: "access_denied",
      severity: "critical",
      accountKind: req.auth?.kind ?? null,
      accountEmail: resolveAuthEmail(req),
      ip: req.ip,
      detail: `réservé au compte principal (${req.method} ${req.path})`,
    });
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
