import { Router, type Request, type Response, type NextFunction } from "express";
import { db, DEFAULT_USER_ID } from "../db";
import { getProfile, saveProfile } from "../repositories";
import {
  setupSchema,
  loginSchema,
  changePasswordSchema,
  totpCodeSchema,
  twoFactorLoginSchema,
  disableTotpSchema,
} from "../schemas";
import { createRateLimit } from "../middleware/rateLimit";
import { hashPassword, verifyPassword, needsRehash, verifyAgainstDecoy } from "./password";
import {
  createFirstStaffAccount,
  ensureUserRow,
  getStaffByEmail,
  getStaffById,
  hasAnyStaffAccount,
  normalizeEmail,
  setPassword,
  updatePasswordHash,
} from "./credentials";
import { getLockoutStatus, registerFailedLogin, clearLoginFailures } from "./loginLockout";
import { recordSecurityEvent } from "./securityEvents";
import {
  clearSessionCookie,
  createSession,
  destroyOtherSessions,
  destroySession,
  purgeExpiredSessions,
  readSessionToken,
  setSessionCookie,
  validateSession,
} from "./sessions";
import { requireAdmin } from "./middleware";
import { buildOtpauthUri, formatSecretForDisplay } from "./totp";
import {
  isTotpEnabled,
  startTotpSetup,
  confirmTotpSetup,
  disableTotp,
  verifyStaffTotpCode,
  generateRecoveryCodes,
  consumeRecoveryCode,
  countRemainingRecoveryCodes,
  createTwoFactorChallenge,
  peekTwoFactorChallenge,
  consumeTwoFactorChallenge,
  purgeExpiredTwoFactorChallenges,
} from "./twoFactor";

/** Routes accessibles sans session : `/me`, `/setup`, `/login`, `/logout`. */
export const authRouter = Router();

/**
 * Routes de gestion du compte, qui exigent une session valide.
 *
 * Montée séparément de `authRouter`, et **après** la barrière `requireAuth`
 * dans `server/routes.ts` : c'est ce qui la protège.
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

/** Forme renvoyée au client pour une session authentifiée. */
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
 * Première installation : crée le compte, unique pour cette instance,
 * rattaché au profil existant.
 *
 * Le 409 quand un compte existe déjà est la protection critique de cette
 * route — sans lui, n'importe qui pourrait créer le compte à distance. Une
 * instance de cette application n'accueille jamais qu'un seul compte.
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

    // Transaction : le bureau de données doit exister avant d'y référer un
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
    const emailLower = normalizeEmail(email);

    // Verrouillage PAR COMPTE (distinct de la limite IP ci-dessus), indexé
    // sur l'email brut avant toute résolution — un email inconnu se heurte
    // exactement au même verrouillage qu'un email réel avec mauvais mot de
    // passe, pour ne jamais révéler qu'un compte existe.
    const lockout = getLockoutStatus("staff", emailLower);
    if (lockout.lockedUntil) {
      recordSecurityEvent({
        eventType: "login_blocked",
        severity: "warning",
        accountKind: "staff",
        accountEmail: email.trim(),
        ip: req.ip,
        detail: `compte verrouillé (réessai après ${lockout.lockedUntil.toLocaleTimeString("fr-FR")})`,
      });
      res.status(403).json({ error: "Trop de tentatives. Réessaie dans quelques minutes.", code: "ACCOUNT_LOCKED" });
      return;
    }

    const staff = getStaffByEmail(email);

    // Compte inconnu : on paie quand même le coût du hachage. Sans cela, le
    // temps de réponse distinguerait « email inconnu » (immédiat) de « mot de
    // passe faux » (~80 ms), ce qui offrirait une énumération des comptes.
    if (!staff) {
      await verifyAgainstDecoy(password);
      const { locked } = registerFailedLogin("staff", emailLower);
      recordSecurityEvent({
        eventType: "login_failed", severity: "warning", accountKind: "staff",
        accountEmail: email.trim(), ip: req.ip, detail: "compte inconnu",
      });
      if (locked) {
        recordSecurityEvent({
          eventType: "account_locked", severity: "critical", accountKind: "staff",
          accountEmail: email.trim(), ip: req.ip, detail: "5 échecs en 15 min",
        });
      }
      res.status(401).json({ error: "Identifiants incorrects." });
      return;
    }

    if (!(await verifyPassword(password, staff.passwordHash))) {
      const { locked } = registerFailedLogin("staff", emailLower);
      recordSecurityEvent({
        eventType: "login_failed", severity: "warning", accountKind: "staff",
        accountEmail: email.trim(), ip: req.ip, detail: "mot de passe incorrect",
      });
      if (locked) {
        recordSecurityEvent({
          eventType: "account_locked", severity: "critical", accountKind: "staff",
          accountEmail: email.trim(), ip: req.ip, detail: "5 échecs en 15 min",
        });
      }
      // Message identique au cas précédent, délibérément.
      res.status(401).json({ error: "Identifiants incorrects." });
      return;
    }

    clearLoginFailures("staff", emailLower);

    // Montée en robustesse transparente si les paramètres ont durci depuis.
    if (needsRehash(staff.passwordHash)) {
      updatePasswordHash(staff.id, await hashPassword(password));
    }

    // Mot de passe vérifié, mais 2FA active sur ce compte : pas de session
    // créée ici — seulement un défi temporaire (5 min), à échanger contre
    // une vraie session via POST /auth/login/2fa. Le mot de passe seul ne
    // suffit donc plus à authentifier un compte 2FA.
    if (isTotpEnabled(staff.id)) {
      const pendingToken = createTwoFactorChallenge(staff.id);
      recordSecurityEvent({
        eventType: "login_2fa_required", severity: "info", accountKind: "staff",
        accountEmail: staff.email, ip: req.ip, detail: "",
      });
      res.json({ state: "2fa-required", pendingToken });
      return;
    }

    // Les sessions existantes sont conservées : plusieurs appareils peuvent
    // rester connectés en parallèle.
    const token = createSession(staff.id, req.headers["user-agent"]);
    setSessionCookie(res, token, parsed.data.rememberMe ?? true);
    recordSecurityEvent({
      eventType: "login_success", severity: "info", accountKind: "staff",
      accountEmail: staff.email, ip: req.ip, detail: "",
    });
    res.json(authenticatedPayload(staff.id));
  })
);

/**
 * Étape 2 de connexion, uniquement pour un compte avec 2FA active — échange
 * un défi temporaire (`pendingToken`, obtenu à l'étape 1) contre une vraie
 * session, après vérification d'un code TOTP ou d'un code de récupération.
 */
authRouter.post(
  "/login/2fa",
  createRateLimit({
    windowMs: 15 * 60_000,
    max: 10,
    message: "Trop de tentatives. Réessaie dans quelques minutes.",
  }),
  wrap(async (req, res) => {
    const parsed = twoFactorLoginSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Code requis." });
      return;
    }

    purgeExpiredTwoFactorChallenges();

    const staffId = peekTwoFactorChallenge(parsed.data.pendingToken);
    const staff = staffId ? getStaffById(staffId) : null;
    if (!staff) {
      res.status(401).json({ error: "Session de connexion expirée, recommence depuis le début." });
      return;
    }

    const emailLower = normalizeEmail(staff.email);
    const lockout = getLockoutStatus("staff", emailLower);
    if (lockout.lockedUntil) {
      res.status(403).json({ error: "Trop de tentatives. Réessaie dans quelques minutes.", code: "ACCOUNT_LOCKED" });
      return;
    }

    const valid = parsed.data.code
      ? verifyStaffTotpCode(staff.id, parsed.data.code)
      : consumeRecoveryCode(staff.id, parsed.data.recoveryCode!);

    if (!valid) {
      const { locked } = registerFailedLogin("staff", emailLower);
      recordSecurityEvent({
        eventType: "login_failed", severity: "warning", accountKind: "staff",
        accountEmail: staff.email, ip: req.ip,
        detail: parsed.data.code ? "code 2FA incorrect" : "code de récupération incorrect",
      });
      if (locked) {
        recordSecurityEvent({
          eventType: "account_locked", severity: "critical", accountKind: "staff",
          accountEmail: staff.email, ip: req.ip, detail: "5 échecs en 15 min",
        });
      }
      res.status(401).json({ error: "Code incorrect." });
      return;
    }

    clearLoginFailures("staff", emailLower);
    consumeTwoFactorChallenge(parsed.data.pendingToken);

    const token = createSession(staff.id, req.headers["user-agent"]);
    setSessionCookie(res, token, parsed.data.rememberMe ?? true);
    recordSecurityEvent({
      eventType: "login_success", severity: "info", accountKind: "staff",
      accountEmail: staff.email, ip: req.ip,
      detail: parsed.data.code ? "2FA (TOTP)" : "2FA (code de récupération)",
    });
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
  if (token) {
    // Résolu avant destruction : après, la session n'existe plus pour
    // retrouver le compte. Rien n'est journalisé si le token est
    // absent/déjà invalide — pas de bruit sur une déconnexion sans session.
    const session = validateSession(token);
    const staff = session ? getStaffById(session.userId) : null;
    if (staff) {
      recordSecurityEvent({
        eventType: "logout", severity: "info", accountKind: "staff",
        accountEmail: staff.email, ip: req.ip, detail: "",
      });
    }
    destroySession(token);
  }
  clearSessionCookie(res);
  res.status(204).end();
});

// --- Gestion du compte (protégées par requireAuth) ------------------------

/**
 * Change le mot de passe du compte courant.
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
      recordSecurityEvent({
        eventType: "password_change_failed", severity: "warning", accountKind: "staff",
        accountEmail: staff?.email ?? null, ip: req.ip, detail: "mot de passe actuel incorrect",
      });
      // 403 et non 401 : un 401 déclencherait côté client l'interception
      // générique de session expirée (`request()` dans `src/lib/api.ts`),
      // alors qu'ici la session est parfaitement valide — seul le mot de
      // passe fourni est faux.
      res.status(403).json({ error: "Mot de passe actuel incorrect." });
      return;
    }

    setPassword(staff.id, await hashPassword(parsed.data.newPassword));
    // Le jeton courant est déjà connu (vérifié par `requireAuth` en amont) :
    // on l'exclut de la révocation pour ne pas déconnecter l'auteur du
    // changement — voir le commentaire de `destroyOtherSessions`.
    const currentToken = readSessionToken(req)!;
    const destroyed = destroyOtherSessions(staff.id, currentToken);
    recordSecurityEvent({
      eventType: "password_changed", severity: "info", accountKind: "staff",
      accountEmail: staff.email, ip: req.ip,
      detail: `${destroyed} autre(s) session(s) fermée(s)`,
    });
    res.json(authenticatedPayload(staff.id));
  })
);

// --- 2FA (TOTP) — configuration, depuis une session déjà active ----------

const twoFactorRateLimit = createRateLimit({
  windowMs: 15 * 60_000,
  max: 10,
  message: "Trop de tentatives. Réessaie dans quelques minutes.",
});

staffRouter.get("/2fa/status", (req, res) => {
  res.json({
    enabled: isTotpEnabled(req.auth!.userId),
    remainingRecoveryCodes: countRemainingRecoveryCodes(req.auth!.userId),
  });
});

/**
 * Démarre une configuration 2FA : nouveau secret stocké mais PAS encore
 * actif (voir `startTotpSetup`). Le compte doit confirmer avec un code
 * valide (`POST /2fa/enable`) avant que la 2FA ne s'applique réellement à sa
 * prochaine connexion.
 */
staffRouter.post("/2fa/setup", twoFactorRateLimit, (req, res) => {
  const staff = getStaffById(req.auth!.userId);
  if (!staff) {
    res.status(404).json({ error: "Compte introuvable." });
    return;
  }

  const secret = startTotpSetup(staff.id);
  res.json({
    secret: formatSecretForDisplay(secret),
    otpauthUri: buildOtpauthUri(secret, staff.email),
  });
});

/**
 * Confirme la configuration en cours et active la 2FA. Génère les codes de
 * récupération à cet instant précis et les renvoie une seule fois.
 */
staffRouter.post("/2fa/enable", twoFactorRateLimit, (req, res) => {
  const parsed = totpCodeSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Code à 6 chiffres requis." });
    return;
  }

  const staff = getStaffById(req.auth!.userId);
  if (!staff || !confirmTotpSetup(staff.id, parsed.data.code)) {
    res.status(400).json({ error: "Code incorrect ou expiré." });
    return;
  }

  const recoveryCodes = generateRecoveryCodes(staff.id);
  recordSecurityEvent({
    eventType: "two_factor_enabled", severity: "info", accountKind: "staff",
    accountEmail: staff.email, ip: req.ip, detail: "",
  });
  res.json({ recoveryCodes });
});

/** Désactive la 2FA — mot de passe actuel requis, même garde que `/change-password`. */
staffRouter.post("/2fa/disable", twoFactorRateLimit, wrap(async (req, res) => {
  const parsed = disableTotpSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Mot de passe requis." });
    return;
  }

  const staff = getStaffById(req.auth!.userId);
  if (!staff || !(await verifyPassword(parsed.data.password, staff.passwordHash))) {
    res.status(403).json({ error: "Mot de passe incorrect." });
    return;
  }

  disableTotp(staff.id);
  recordSecurityEvent({
    eventType: "two_factor_disabled", severity: "warning", accountKind: "staff",
    accountEmail: staff.email, ip: req.ip, detail: "",
  });
  res.status(204).end();
}));

/** Régénère les codes de récupération — invalide tous les précédents, mot de passe requis. */
staffRouter.post(
  "/2fa/recovery-codes/regenerate",
  twoFactorRateLimit,
  wrap(async (req, res) => {
    const parsed = disableTotpSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Mot de passe requis." });
      return;
    }

    const staff = getStaffById(req.auth!.userId);
    if (!staff || !(await verifyPassword(parsed.data.password, staff.passwordHash))) {
      res.status(403).json({ error: "Mot de passe incorrect." });
      return;
    }
    if (!isTotpEnabled(staff.id)) {
      res.status(400).json({ error: "La 2FA n'est pas activée sur ce compte." });
      return;
    }

    const recoveryCodes = generateRecoveryCodes(staff.id);
    recordSecurityEvent({
      eventType: "two_factor_recovery_regenerated", severity: "info", accountKind: "staff",
      accountEmail: staff.email, ip: req.ip, detail: "",
    });
    res.json({ recoveryCodes });
  })
);

