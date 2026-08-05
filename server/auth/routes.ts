import { Router, type Request, type Response, type NextFunction } from "express";
import { db, DEFAULT_USER_ID } from "../db";
import { getProfile, saveProfile } from "../repositories";
import { setupSchema, loginSchema } from "../schemas";
import { createRateLimit } from "../middleware/rateLimit";
import { hashPassword, verifyPassword, needsRehash, verifyAgainstDecoy } from "./password";
import {
  createCredentials,
  ensureUserRow,
  getCredentialsByEmail,
  getCredentialsByUserId,
  hasAnyCredentials,
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

export const authRouter = Router();

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
    // Le premier compte créé est administrateur. À revoir le jour où plusieurs
    // comptes coexisteront.
    isAdmin: true,
  };
}

/** Forme renvoyée au client. Construite champ par champ : jamais de spread. */
function authenticatedPayload(userId: string) {
  const profile = getProfile<{ name?: string; email?: string; isAdmin?: boolean }>(userId);
  const credentials = getCredentialsByUserId(userId);

  return {
    state: "authenticated" as const,
    user: {
      id: userId,
      name: profile?.name ?? "",
      email: credentials?.email ?? profile?.email ?? "",
      isAdmin: profile?.isAdmin === true,
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
  if (!hasAnyCredentials()) {
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
 * Première installation : rattache des identifiants au profil existant.
 *
 * Le 409 quand un compte existe déjà est la protection critique de cette route —
 * sans lui, n'importe qui pourrait réinitialiser le mot de passe à distance.
 */
authRouter.post(
  "/setup",
  createRateLimit({
    windowMs: 15 * 60_000,
    max: 5,
    message: "Trop de tentatives d'installation. Réessaie dans quelques minutes.",
  }),
  wrap(async (req, res) => {
    if (hasAnyCredentials()) {
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

    // Transaction : la ligne users doit exister avant les identifiants
    // (foreign_keys = ON), et un échec ne doit pas laisser un état partiel.
    const created = db.transaction(() => {
      // Re-contrôle DANS la transaction : le hachage a pris ~80 ms, une seconde
      // requête a pu passer le test initial pendant ce temps. On renvoie un
      // booléen plutôt que de lever, pour répondre 409 et non 500.
      if (hasAnyCredentials()) return false;

      ensureUserRow(minimalProfile(email));
      createCredentials({ userId: DEFAULT_USER_ID, email, passwordHash });

      // L'email de connexion devient celui du profil, sinon deux adresses
      // divergentes coexisteraient.
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
    const credentials = getCredentialsByEmail(email);

    // Compte inconnu : on paie quand même le coût du hachage. Sans cela, le
    // temps de réponse distinguerait « email inconnu » (immédiat) de « mot de
    // passe faux » (~80 ms), ce qui offrirait une énumération des comptes.
    if (!credentials) {
      await verifyAgainstDecoy(password);
      res.status(401).json({ error: "Identifiants incorrects." });
      return;
    }

    if (!(await verifyPassword(password, credentials.passwordHash))) {
      // Message identique au cas précédent, délibérément.
      res.status(401).json({ error: "Identifiants incorrects." });
      return;
    }

    // Montée en robustesse transparente si les paramètres ont durci depuis.
    if (needsRehash(credentials.passwordHash)) {
      updatePasswordHash(credentials.userId, await hashPassword(password));
    }

    // Les sessions existantes sont conservées : plusieurs appareils peuvent
    // rester connectés en parallèle.
    const token = createSession(credentials.userId, req.headers["user-agent"]);
    setSessionCookie(res, token);
    res.json(authenticatedPayload(credentials.userId));
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
