import { Router, type Request, type Response, type NextFunction } from "express";
import { randomBytes } from "node:crypto";
import { db, DEFAULT_USER_ID } from "../db";
import { getProfile, saveProfile } from "../repositories";
import { setupSchema, loginSchema, inviteStaffSchema, changePasswordSchema } from "../schemas";
import { createRateLimit } from "../middleware/rateLimit";
import { hashPassword, verifyPassword, needsRehash, verifyAgainstDecoy } from "./password";
import {
  createFirstStaffAccount,
  createInvitedStaffAccount,
  deleteStaffAccount,
  ensureUserRow,
  getStaffByEmail,
  getStaffById,
  hasAnyStaffAccount,
  listStaffAccounts,
  setPassword,
  updatePasswordHash,
} from "./credentials";
import {
  clearSessionCookie,
  createSession,
  destroySession,
  purgeExpiredSessions,
  readSessionToken,
  setSessionCookie,
  validateSession,
} from "./sessions";

/** Routes accessibles sans session : `/me`, `/setup`, `/login`, `/logout`. */
export const authRouter = Router();

/**
 * Routes de gestion des comptes staff, qui exigent une session valide.
 *
 * Montée séparément de `authRouter`, et **après** la barrière `requireAuth`
 * dans `server/routes.ts` : c'est ce qui la protège. Les chemins vus par
 * `requireAuth` restent ainsi cohérents avec ceux déclarés dans
 * `server/auth/middleware.ts` (`/auth/change-password`), sans ambiguïté liée
 * au point de montage.
 */
export const staffRouter = Router();

const wrap =
  (fn: (req: Request, res: Response) => Promise<void>) =>
  (req: Request, res: Response, next: NextFunction) => {
    fn(req, res).catch(next);
  };

/**
 * Profil minimal créé sur une base neuve.
 *
 * Volontairement pauvre : les vraies valeurs viennent du jeu de démonstration
 * (`/api/state/seed`), déclenché par le client juste après l'installation.
 */
function minimalProfile(email: string) {
  return {
    name: email.split("@")[0],
    email,
    avatar: "",
    level: "Trader",
    joinedDate: new Date().toLocaleDateString("fr-FR", {
      day: "numeric",
      month: "long",
      year: "numeric",
    }),
    startingCapital: 10000,
    currentCapital: 10000,
    isAdmin: true,
  };
}

/**
 * Forme renvoyée au client pour une session authentifiée.
 *
 * Reflète l'IDENTITÉ du compte staff connecté (son nom, son email) — pas le
 * bureau partagé, qui reste le même quel que soit le compte utilisé pour s'y
 * connecter.
 */
function authenticatedPayload(staffId: string) {
  const staff = getStaffById(staffId);

  return {
    state: "authenticated" as const,
    user: {
      id: staffId,
      name: staff?.name ?? "",
      email: staff?.email ?? "",
      isAdmin: true,
      mustChangePassword: staff?.mustChangePassword === true,
    },
  };
}

/**
 * Sonde d'état du démarrage.
 *
 * Renvoie **toujours 200**, avec une union discriminée. « Pas encore connecté »
 * est l'état normal au premier chargement : répondre 401 polluerait la console du
 * navigateur et pousserait à traiter un état comme une erreur.
 */
authRouter.get("/me", (req, res) => {
  if (!hasAnyStaffAccount()) {
    res.json({ state: "no-account" });
    return;
  }

  const token = readSessionToken(req);
  const session = token ? validateSession(token) : null;

  if (!session) {
    res.json({ state: "unauthenticated" });
    return;
  }

  res.json(authenticatedPayload(session.userId));
});

/**
 * Première installation : crée le premier compte staff, rattaché au profil
 * existant.
 *
 * Le 409 quand un compte existe déjà est la protection critique de cette route —
 * sans lui, n'importe qui pourrait créer le premier compte à distance.
 */
authRouter.post(
  "/setup",
  createRateLimit({
    windowMs: 15 * 60_000,
    max: 5,
    message: "Trop de tentatives d'installation. Réessaie dans quelques minutes.",
  }),
  wrap(async (req, res) => {
    if (hasAnyStaffAccount()) {
      res.status(409).json({ error: "Un compte existe déjà." });
      return;
    }

    const parsed = setupSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        error: `Adresse e-mail invalide ou mot de passe trop court (10 caractères minimum).`,
        details: parsed.error.issues,
      });
      return;
    }

    const { email, password } = parsed.data;
    const passwordHash = await hashPassword(password);

    // Transaction : le bureau partagé doit exister avant d'y référer un
    // email, et un échec ne doit pas laisser un état partiel.
    const created = db.transaction(() => {
      // Re-contrôle DANS la transaction : le hachage a pris ~80 ms, une seconde
      // requête a pu passer le test initial pendant ce temps. On renvoie un
      // booléen plutôt que de lever, pour répondre 409 et non 500.
      if (hasAnyStaffAccount()) return false;

      ensureUserRow(minimalProfile(email));
      createFirstStaffAccount({ email, passwordHash });

      // L'email de connexion devient celui du profil, sinon deux adresses
      // divergentes coexisteraient au tout premier démarrage.
      const profile = getProfile<Record<string, unknown>>(DEFAULT_USER_ID);
      if (profile) saveProfile({ ...profile, email }, DEFAULT_USER_ID);

      return true;
    })();

    if (!created) {
      res.status(409).json({ error: "Un compte existe déjà." });
      return;
    }

    const token = createSession(DEFAULT_USER_ID, req.headers["user-agent"]);
    setSessionCookie(res, token);
    res.status(201).json(authenticatedPayload(DEFAULT_USER_ID));
  })
);

authRouter.post(
  "/login",
  createRateLimit({
    windowMs: 15 * 60_000,
    max: 10,
    message: "Trop de tentatives. Réessaie dans quelques minutes.",
  }),
  wrap(async (req, res) => {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Adresse e-mail et mot de passe requis." });
      return;
    }

    purgeExpiredSessions();

    const { email, password } = parsed.data;
    const staff = getStaffByEmail(email);

    // Compte inconnu : on paie quand même le coût du hachage. Sans cela, le
    // temps de réponse distinguerait « email inconnu » (immédiat) de « mot de
    // passe faux » (~80 ms), ce qui offrirait une énumération des comptes.
    if (!staff) {
      await verifyAgainstDecoy(password);
      res.status(401).json({ error: "Identifiants incorrects." });
      return;
    }

    if (!(await verifyPassword(password, staff.passwordHash))) {
      // Message identique au cas précédent, délibérément.
      res.status(401).json({ error: "Identifiants incorrects." });
      return;
    }

    // Montée en robustesse transparente si les paramètres ont durci depuis.
    if (needsRehash(staff.passwordHash)) {
      updatePasswordHash(staff.id, await hashPassword(password));
    }

    // Les sessions existantes sont conservées : plusieurs appareils peuvent
    // rester connectés en parallèle.
    const token = createSession(staff.id, req.headers["user-agent"]);
    setSessionCookie(res, token);
    res.json(authenticatedPayload(staff.id));
  })
);

/**
 * Déconnexion, **idempotente** et hors de `requireAuth` : une session expirée
 * doit pouvoir se déconnecter, sinon l'utilisateur reçoit un 401 en essayant de
 * partir, ce qui n'a aucun sens.
 */
authRouter.post("/logout", (req, res) => {
  const token = readSessionToken(req);
  if (token) destroySession(token);
  clearSessionCookie(res);
  res.status(204).end();
});

// --- Gestion des comptes staff (protégées par requireAuth) ---------------

/**
 * Liste les comptes staff. Tous égaux, donc accessible à quiconque est
 * connecté — il n'y a pas de rôle "peut voir la liste" séparé de "est staff".
 */
staffRouter.get("/staff", (_req, res) => {
  res.json({ accounts: listStaffAccounts() });
});

/**
 * Invite un nouveau compte staff.
 *
 * Le mot de passe est généré côté serveur, jamais choisi par l'inviteur : il
 * n'est renvoyé qu'une seule fois, dans cette réponse, pour être transmis de
 * la main à la main. `mustChangePassword` force son remplacement à la
 * première connexion.
 */
staffRouter.post(
  "/staff",
  createRateLimit({
    windowMs: 15 * 60_000,
    max: 10,
    message: "Trop d'invitations envoyées. Réessaie dans quelques minutes.",
  }),
  wrap(async (req, res) => {
    const parsed = inviteStaffSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Nom ou adresse e-mail invalide." });
      return;
    }

    if (getStaffByEmail(parsed.data.email)) {
      res.status(409).json({ error: "Un compte existe déjà avec cette adresse." });
      return;
    }

    // 12 caractères en base64url (9 octets), au-dessus du minimum de 10 —
    // assez court pour être transcrit à la main si besoin.
    const temporaryPassword = randomBytes(9).toString("base64url");
    const passwordHash = await hashPassword(temporaryPassword);

    const id = createInvitedStaffAccount({
      name: parsed.data.name,
      email: parsed.data.email,
      passwordHash,
      invitedBy: req.auth!.userId,
    });

    res.status(201).json({
      id,
      name: parsed.data.name,
      email: parsed.data.email,
      temporaryPassword,
    });
  })
);

/**
 * Révoque un compte staff.
 *
 * Refuse de supprimer le dernier compte restant (`deleteStaffAccount` porte
 * la garde) : sans lui, plus personne ne pourrait jamais se reconnecter.
 */
staffRouter.delete("/staff/:id", (req, res) => {
  const removed = deleteStaffAccount(req.params.id);
  if (!removed) {
    res.status(409).json({
      error: "Impossible de supprimer le dernier compte restant.",
    });
    return;
  }

  // Les sessions du compte supprimé n'ont plus lieu d'être : autant les
  // purger immédiatement plutôt que d'attendre leur expiration naturelle.
  db.prepare("DELETE FROM sessions WHERE user_id = ?").run(req.params.id);

  res.status(204).end();
});

/**
 * Change le mot de passe du compte courant — chemin normal après une
 * invitation (`mustChangePassword`), ou changement volontaire.
 *
 * `currentPassword` est vérifié même si un mot de passe temporaire est en
 * vigueur : connaître le jeton de session ne doit pas suffire à changer le
 * mot de passe sans le connaître.
 */
staffRouter.post(
  "/change-password",
  createRateLimit({
    windowMs: 15 * 60_000,
    max: 10,
    message: "Trop de tentatives. Réessaie dans quelques minutes.",
  }),
  wrap(async (req, res) => {
    const parsed = changePasswordSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        error: "Mot de passe actuel requis, nouveau mot de passe de 10 caractères minimum.",
      });
      return;
    }

    const staff = getStaffById(req.auth!.userId);
    if (!staff || !(await verifyPassword(parsed.data.currentPassword, staff.passwordHash))) {
      // 403 et non 401 : un 401 déclencherait côté client l'interception
      // générique de session expirée (`request()` dans `src/lib/api.ts`),
      // alors qu'ici la session est parfaitement valide — seul le mot de
      // passe fourni est faux.
      res.status(403).json({ error: "Mot de passe actuel incorrect." });
      return;
    }

    setPassword(staff.id, await hashPassword(parsed.data.newPassword));
    res.json(authenticatedPayload(staff.id));
  })
);
