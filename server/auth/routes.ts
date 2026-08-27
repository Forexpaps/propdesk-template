import { Router, type Request, type Response, type NextFunction } from "express";
import { db, DEFAULT_USER_ID } from "../db";
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
  getSoleStaffAccount,
  getStaffById,
  hasAnyStaffAccount,
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
 * Profil minimal créé sur une base neuve — vide (pas de nom, pas d'email,
 * pas de photo) : rien n'est demandé à l'installation, la personne renseigne
 * ces informations plus tard si elle le souhaite, depuis Profil & Options.
 *
 * Volontairement pauvre par ailleurs : les vraies valeurs de trading viennent
 * du jeu de démonstration (`/api/state/seed`), déclenché par le client juste
 * après l'installation.
 */
function minimalProfile() {
  return {
    name: "",
    email: "",
    avatar: "",
    level: "",
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
async function authenticatedPayload(staffId: string) {
  const staff = await getStaffById(staffId);

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
authRouter.get(
  "/me",
  wrap(async (req, res) => {
    if (!(await hasAnyStaffAccount())) {
      res.json({ state: "no-account" });
      return;
    }

    const token = readSessionToken(req);
    const session = token ? await validateSession(token) : null;

    if (!session) {
      res.json({ state: "unauthenticated" });
      return;
    }

    res.json(await authenticatedPayload(session.userId));
  })
);

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
    if (await hasAnyStaffAccount()) {
      res.status(409).json({ error: "Un compte existe déjà." });
      return;
    }

    const parsed = setupSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        error: `Mot de passe trop court (10 caractères minimum).`,
        details: parsed.error.issues,
      });
      return;
    }

    const { password } = parsed.data;
    const passwordHash = await hashPassword(password);

    // Transaction : le bureau de données doit exister avant le compte, et un
    // échec ne doit pas laisser un état partiel.
    const tx = await db.transaction("write");
    let created: boolean;
    try {
      // Re-contrôle DANS la transaction : le hachage a pris ~80 ms, une seconde
      // requête a pu passer le test initial pendant ce temps. On renvoie un
      // booléen plutôt que de lever, pour répondre 409 et non 500.
      const alreadyResult = await tx.execute("SELECT 1 FROM staff_accounts LIMIT 1");
      if (alreadyResult.rows.length > 0) {
        created = false;
      } else {
        const existingUserRow = await tx.execute({
          sql: "SELECT 1 FROM users WHERE id = ?",
          args: [DEFAULT_USER_ID],
        });
        if (existingUserRow.rows.length === 0) {
          await tx.execute({
            sql: "INSERT INTO users (id, payload) VALUES (?, ?)",
            args: [DEFAULT_USER_ID, JSON.stringify(minimalProfile())],
          });
        }

        const now = new Date().toISOString();
        await tx.execute({
          sql: `INSERT INTO staff_accounts
             (id, name, email, email_lower, password_hash, must_change_password, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, 0, ?, ?)`,
          args: [DEFAULT_USER_ID, "", "", "", passwordHash, now, now],
        });

        created = true;
      }
      await tx.commit();
    } catch (err) {
      await tx.rollback();
      throw err;
    } finally {
      tx.close();
    }

    if (!created) {
      res.status(409).json({ error: "Un compte existe déjà." });
      return;
    }

    const token = await createSession(DEFAULT_USER_ID, req.headers["user-agent"]);
    setSessionCookie(res, token);
    res.status(201).json(await authenticatedPayload(DEFAULT_USER_ID));
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
      res.status(400).json({ error: "Mot de passe requis." });
      return;
    }

    await purgeExpiredSessions();

    const { password } = parsed.data;
    // Verrouillage PAR COMPTE (distinct de la limite IP ci-dessus). Une seule
    // clé fixe : il n'y a jamais qu'un compte par instance, donc plus
    // d'identifiant (email) sur lequel indexer le verrouillage.
    const lockoutKey = "singleton";

    const lockout = await getLockoutStatus("staff", lockoutKey);
    if (lockout.lockedUntil) {
      recordSecurityEvent({
        eventType: "login_blocked",
        severity: "warning",
        accountKind: "staff",
        accountEmail: null,
        ip: req.ip,
        detail: `compte verrouillé (réessai après ${lockout.lockedUntil.toLocaleTimeString("fr-FR")})`,
      });
      res.status(403).json({ error: "Trop de tentatives. Réessaie dans quelques minutes.", code: "ACCOUNT_LOCKED" });
      return;
    }

    const staff = await getSoleStaffAccount();

    // Aucun compte : la sonde /auth/me aurait dû rediriger vers l'écran
    // d'installation avant d'atteindre cette route — filet de sécurité, pas
    // le chemin normal. On paie quand même le coût du hachage (comparaison à
    // temps constant avec le cas "mot de passe incorrect" ci-dessous).
    if (!staff) {
      await verifyAgainstDecoy(password);
      res.status(401).json({ error: "Identifiants incorrects." });
      return;
    }

    if (!(await verifyPassword(password, staff.passwordHash))) {
      const { locked } = await registerFailedLogin("staff", lockoutKey);
      recordSecurityEvent({
        eventType: "login_failed", severity: "warning", accountKind: "staff",
        accountEmail: null, ip: req.ip, detail: "mot de passe incorrect",
      });
      if (locked) {
        recordSecurityEvent({
          eventType: "account_locked", severity: "critical", accountKind: "staff",
          accountEmail: null, ip: req.ip, detail: "5 échecs en 15 min",
        });
      }
      res.status(401).json({ error: "Identifiants incorrects." });
      return;
    }

    await clearLoginFailures("staff", lockoutKey);

    // Montée en robustesse transparente si les paramètres ont durci depuis.
    if (needsRehash(staff.passwordHash)) {
      await updatePasswordHash(staff.id, await hashPassword(password));
    }

    // Mot de passe vérifié, mais 2FA active sur ce compte : pas de session
    // créée ici — seulement un défi temporaire (5 min), à échanger contre
    // une vraie session via POST /auth/login/2fa. Le mot de passe seul ne
    // suffit donc plus à authentifier un compte 2FA.
    if (await isTotpEnabled(staff.id)) {
      const pendingToken = await createTwoFactorChallenge(staff.id);
      recordSecurityEvent({
        eventType: "login_2fa_required", severity: "info", accountKind: "staff",
        accountEmail: null, ip: req.ip, detail: "",
      });
      res.json({ state: "2fa-required", pendingToken });
      return;
    }

    // Les sessions existantes sont conservées : plusieurs appareils peuvent
    // rester connectés en parallèle.
    const token = await createSession(staff.id, req.headers["user-agent"]);
    setSessionCookie(res, token, parsed.data.rememberMe ?? true);
    recordSecurityEvent({
      eventType: "login_success", severity: "info", accountKind: "staff",
      accountEmail: null, ip: req.ip, detail: "",
    });
    res.json(await authenticatedPayload(staff.id));
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

    await purgeExpiredTwoFactorChallenges();

    const staffId = await peekTwoFactorChallenge(parsed.data.pendingToken);
    const staff = staffId ? await getStaffById(staffId) : null;
    if (!staff) {
      res.status(401).json({ error: "Session de connexion expirée, recommence depuis le début." });
      return;
    }

    // Même clé fixe que POST /auth/login — un seul compte par instance.
    const lockoutKey = "singleton";
    const lockout = await getLockoutStatus("staff", lockoutKey);
    if (lockout.lockedUntil) {
      res.status(403).json({ error: "Trop de tentatives. Réessaie dans quelques minutes.", code: "ACCOUNT_LOCKED" });
      return;
    }

    const valid = parsed.data.code
      ? await verifyStaffTotpCode(staff.id, parsed.data.code)
      : await consumeRecoveryCode(staff.id, parsed.data.recoveryCode!);

    if (!valid) {
      const { locked } = await registerFailedLogin("staff", lockoutKey);
      recordSecurityEvent({
        eventType: "login_failed", severity: "warning", accountKind: "staff",
        accountEmail: null, ip: req.ip,
        detail: parsed.data.code ? "code 2FA incorrect" : "code de récupération incorrect",
      });
      if (locked) {
        recordSecurityEvent({
          eventType: "account_locked", severity: "critical", accountKind: "staff",
          accountEmail: null, ip: req.ip, detail: "5 échecs en 15 min",
        });
      }
      res.status(401).json({ error: "Code incorrect." });
      return;
    }

    await clearLoginFailures("staff", lockoutKey);
    await consumeTwoFactorChallenge(parsed.data.pendingToken);

    const token = await createSession(staff.id, req.headers["user-agent"]);
    setSessionCookie(res, token, parsed.data.rememberMe ?? true);
    recordSecurityEvent({
      eventType: "login_success", severity: "info", accountKind: "staff",
      accountEmail: null, ip: req.ip,
      detail: parsed.data.code ? "2FA (TOTP)" : "2FA (code de récupération)",
    });
    res.json(await authenticatedPayload(staff.id));
  })
);

/**
 * Déconnexion, **idempotente** et hors de `requireAuth` : une session expirée
 * doit pouvoir se déconnecter, sinon l'utilisateur reçoit un 401 en essayant de
 * partir, ce qui n'a aucun sens.
 */
authRouter.post(
  "/logout",
  wrap(async (req, res) => {
    const token = readSessionToken(req);
    if (token) {
      // Résolu avant destruction : après, la session n'existe plus pour
      // retrouver le compte. Rien n'est journalisé si le token est
      // absent/déjà invalide — pas de bruit sur une déconnexion sans session.
      const session = await validateSession(token);
      const staff = session ? await getStaffById(session.userId) : null;
      if (staff) {
        recordSecurityEvent({
          eventType: "logout", severity: "info", accountKind: "staff",
          accountEmail: staff.email, ip: req.ip, detail: "",
        });
      }
      await destroySession(token);
    }
    clearSessionCookie(res);
    res.status(204).end();
  })
);

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

    const staff = await getStaffById(req.auth!.userId);
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

    await setPassword(staff.id, await hashPassword(parsed.data.newPassword));
    // Le jeton courant est déjà connu (vérifié par `requireAuth` en amont) :
    // on l'exclut de la révocation pour ne pas déconnecter l'auteur du
    // changement — voir le commentaire de `destroyOtherSessions`.
    const currentToken = readSessionToken(req)!;
    const destroyed = await destroyOtherSessions(staff.id, currentToken);
    recordSecurityEvent({
      eventType: "password_changed", severity: "info", accountKind: "staff",
      accountEmail: staff.email, ip: req.ip,
      detail: `${destroyed} autre(s) session(s) fermée(s)`,
    });
    res.json(await authenticatedPayload(staff.id));
  })
);

// --- 2FA (TOTP) — configuration, depuis une session déjà active ----------

const twoFactorRateLimit = createRateLimit({
  windowMs: 15 * 60_000,
  max: 10,
  message: "Trop de tentatives. Réessaie dans quelques minutes.",
});

staffRouter.get(
  "/2fa/status",
  wrap(async (req, res) => {
    res.json({
      enabled: await isTotpEnabled(req.auth!.userId),
      remainingRecoveryCodes: await countRemainingRecoveryCodes(req.auth!.userId),
    });
  })
);

/**
 * Démarre une configuration 2FA : nouveau secret stocké mais PAS encore
 * actif (voir `startTotpSetup`). Le compte doit confirmer avec un code
 * valide (`POST /2fa/enable`) avant que la 2FA ne s'applique réellement à sa
 * prochaine connexion.
 */
staffRouter.post(
  "/2fa/setup",
  twoFactorRateLimit,
  wrap(async (req, res) => {
    const staff = await getStaffById(req.auth!.userId);
    if (!staff) {
      res.status(404).json({ error: "Compte introuvable." });
      return;
    }

    const secret = await startTotpSetup(staff.id);
    res.json({
      secret: formatSecretForDisplay(secret),
      otpauthUri: buildOtpauthUri(secret, staff.email),
    });
  })
);

/**
 * Confirme la configuration en cours et active la 2FA. Génère les codes de
 * récupération à cet instant précis et les renvoie une seule fois.
 */
staffRouter.post(
  "/2fa/enable",
  twoFactorRateLimit,
  wrap(async (req, res) => {
    const parsed = totpCodeSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Code à 6 chiffres requis." });
      return;
    }

    const staff = await getStaffById(req.auth!.userId);
    if (!staff || !(await confirmTotpSetup(staff.id, parsed.data.code))) {
      res.status(400).json({ error: "Code incorrect ou expiré." });
      return;
    }

    const recoveryCodes = await generateRecoveryCodes(staff.id);
    recordSecurityEvent({
      eventType: "two_factor_enabled", severity: "info", accountKind: "staff",
      accountEmail: staff.email, ip: req.ip, detail: "",
    });
    res.json({ recoveryCodes });
  })
);

/** Désactive la 2FA — mot de passe actuel requis, même garde que `/change-password`. */
staffRouter.post(
  "/2fa/disable",
  twoFactorRateLimit,
  wrap(async (req, res) => {
    const parsed = disableTotpSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Mot de passe requis." });
      return;
    }

    const staff = await getStaffById(req.auth!.userId);
    if (!staff || !(await verifyPassword(parsed.data.password, staff.passwordHash))) {
      res.status(403).json({ error: "Mot de passe incorrect." });
      return;
    }

    await disableTotp(staff.id);
    recordSecurityEvent({
      eventType: "two_factor_disabled", severity: "warning", accountKind: "staff",
      accountEmail: staff.email, ip: req.ip, detail: "",
    });
    res.status(204).end();
  })
);

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

    const staff = await getStaffById(req.auth!.userId);
    if (!staff || !(await verifyPassword(parsed.data.password, staff.passwordHash))) {
      res.status(403).json({ error: "Mot de passe incorrect." });
      return;
    }
    if (!(await isTotpEnabled(staff.id))) {
      res.status(400).json({ error: "La 2FA n'est pas activée sur ce compte." });
      return;
    }

    const recoveryCodes = await generateRecoveryCodes(staff.id);
    recordSecurityEvent({
      eventType: "two_factor_recovery_regenerated", severity: "info", accountKind: "staff",
      accountEmail: staff.email, ip: req.ip, detail: "",
    });
    res.json({ recoveryCodes });
  })
);
