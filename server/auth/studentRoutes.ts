import { Router, type Request, type Response, type NextFunction } from "express";
import { loginSchema, changePasswordSchema, consumeResetTokenSchema, updateAvatarSchema, tradingPlanSchema } from "../schemas";
import { createRateLimit } from "../middleware/rateLimit";
import { getProfile, saveProfile, saveTradingPlan } from "../repositories";
import { normalizeEmail } from "./credentials";
import { getLockoutStatus, registerFailedLogin, clearLoginFailures } from "./loginLockout";
import { hashPassword, verifyPassword, needsRehash, verifyAgainstDecoy } from "./password";
import { recordSecurityEvent } from "./securityEvents";
import {
  consumePasswordResetToken,
  getStudentByEmail,
  getStudentById,
  setStudentPassword,
  updateStudentPasswordHash,
} from "./studentCredentials";
import {
  clearStudentSessionCookie,
  createStudentSession,
  destroyAllStudentSessions,
  destroyOtherStudentSessions,
  destroyStudentSession,
  purgeExpiredStudentSessions,
  readStudentSessionToken,
  setStudentSessionCookie,
  validateStudentSession,
} from "./studentSessions";
import { requireStudentKind } from "./middleware";
import { addStudentExportRoute } from "./exportData";

/** Routes accessibles sans session : `/student-me`, `/student-login`, `/student-logout`. */
export const studentAuthRouter = Router();

/**
 * Route protégée élève (changement de mot de passe), montée **après** la
 * barrière `requireAuth` dans `server/routes.ts` — comme `staffRouter` pour
 * le monde staff.
 */
export const studentProtectedRouter = Router();

const wrap =
  (fn: (req: Request, res: Response) => Promise<void>) =>
  (req: Request, res: Response, next: NextFunction) => {
    fn(req, res).catch(next);
  };

function authenticatedStudentPayload(studentId: string) {
  const student = getStudentById(studentId);

  return {
    state: "authenticated" as const,
    user: {
      id: studentId,
      email: student?.email ?? "",
      mustChangePassword: student?.mustChangePassword === true,
    },
  };
}

/**
 * Sonde d'état, sur le même modèle que `/auth/me` : renvoie toujours 200, le
 * client interroge les deux endpoints (staff et élève) au montage et retient
 * celui qui répond authentifié.
 */
studentAuthRouter.get("/student-me", (req, res) => {
  const token = readStudentSessionToken(req);
  const session = token ? validateStudentSession(token) : null;

  if (!session) {
    res.json({ state: "unauthenticated" });
    return;
  }

  res.json(authenticatedStudentPayload(session.userId));
});

studentAuthRouter.post(
  "/student-login",
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

    purgeExpiredStudentSessions();

    const { email, password } = parsed.data;
    const emailLower = normalizeEmail(email);

    const lockout = getLockoutStatus("student", emailLower);
    if (lockout.lockedUntil) {
      recordSecurityEvent({
        eventType: "login_blocked",
        severity: "warning",
        accountKind: "student",
        accountEmail: email.trim(),
        ip: req.ip,
        detail: `compte verrouillé (réessai après ${lockout.lockedUntil.toLocaleTimeString("fr-FR")})`,
      });
      res.status(403).json({ error: "Trop de tentatives. Réessaie dans quelques minutes.", code: "ACCOUNT_LOCKED" });
      return;
    }

    const student = getStudentByEmail(email);

    // Même anti-énumération que le login staff : payer le coût du hachage
    // même sur un compte inconnu, message identique dans les deux cas.
    if (!student) {
      await verifyAgainstDecoy(password);
      const { locked } = registerFailedLogin("student", emailLower);
      recordSecurityEvent({
        eventType: "login_failed", severity: "warning", accountKind: "student",
        accountEmail: email.trim(), ip: req.ip, detail: "compte inconnu",
      });
      if (locked) {
        recordSecurityEvent({
          eventType: "account_locked", severity: "critical", accountKind: "student",
          accountEmail: email.trim(), ip: req.ip, detail: "5 échecs en 15 min",
        });
      }
      res.status(401).json({ error: "Identifiants incorrects." });
      return;
    }

    if (!(await verifyPassword(password, student.passwordHash))) {
      const { locked } = registerFailedLogin("student", emailLower);
      recordSecurityEvent({
        eventType: "login_failed", severity: "warning", accountKind: "student",
        accountEmail: email.trim(), ip: req.ip, detail: "mot de passe incorrect",
      });
      if (locked) {
        recordSecurityEvent({
          eventType: "account_locked", severity: "critical", accountKind: "student",
          accountEmail: email.trim(), ip: req.ip, detail: "5 échecs en 15 min",
        });
      }
      res.status(401).json({ error: "Identifiants incorrects." });
      return;
    }

    clearLoginFailures("student", emailLower);

    if (needsRehash(student.passwordHash)) {
      updateStudentPasswordHash(student.id, await hashPassword(password));
    }

    const token = createStudentSession(student.id, req.headers["user-agent"]);
    setStudentSessionCookie(res, token);
    recordSecurityEvent({
      eventType: "login_success", severity: "info", accountKind: "student",
      accountEmail: student.email, ip: req.ip, detail: "rôle student",
    });
    res.json(authenticatedStudentPayload(student.id));
  })
);

studentAuthRouter.post("/student-logout", (req, res) => {
  const token = readStudentSessionToken(req);
  if (token) {
    const session = validateStudentSession(token);
    const student = session ? getStudentById(session.userId) : null;
    if (student) {
      recordSecurityEvent({
        eventType: "logout", severity: "info", accountKind: "student",
        accountEmail: student.email, ip: req.ip, detail: "",
      });
    }
    destroyStudentSession(token);
  }
  clearStudentSessionCookie(res);
  res.status(204).end();
});

/**
 * Consomme un jeton de réinitialisation (« Générer un lien de
 * réinitialisation » côté staff, `StudentTracking.tsx`) — accessible sans
 * session, exactement comme `/student-login` : c'est le point d'entrée d'un
 * élève qui n'a plus accès à son compte. Le jeton lui-même prouve l'identité,
 * pas de mot de passe actuel à fournir (au contraire de
 * `/student-change-password`).
 */
studentAuthRouter.post(
  "/reset-password/:token",
  createRateLimit({
    windowMs: 15 * 60_000,
    max: 10,
    message: "Trop de tentatives. Réessaie dans quelques minutes.",
  }),
  wrap(async (req, res) => {
    const parsed = consumeResetTokenSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Mot de passe invalide." });
      return;
    }

    const token = typeof req.params.token === "string" ? req.params.token : "";
    const result = consumePasswordResetToken(token);
    if (!result) {
      res.status(400).json({ error: "Ce lien est invalide, déjà utilisé, ou expiré." });
      return;
    }

    const passwordHash = await hashPassword(parsed.data.newPassword);
    setStudentPassword(result.studentAccountId, passwordHash);
    destroyAllStudentSessions(result.studentAccountId);

    const student = getStudentById(result.studentAccountId);
    recordSecurityEvent({
      eventType: "student_password_reset_completed", severity: "info", accountKind: "student",
      accountEmail: student?.email ?? "", ip: req.ip, detail: "",
    });

    res.status(204).end();
  })
);

studentProtectedRouter.post(
  "/student-change-password",
  requireStudentKind,
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

    const student = getStudentById(req.auth!.userId);
    if (!student || !(await verifyPassword(parsed.data.currentPassword, student.passwordHash))) {
      recordSecurityEvent({
        eventType: "password_change_failed", severity: "warning", accountKind: "student",
        accountEmail: student?.email ?? null, ip: req.ip, detail: "mot de passe actuel incorrect",
      });
      res.status(403).json({ error: "Mot de passe actuel incorrect." });
      return;
    }

    setStudentPassword(student.id, await hashPassword(parsed.data.newPassword));
    // Exclut la session courante — voir `destroyOtherStudentSessions` :
    // sans ça, l'élève qui change volontairement son mot de passe se
    // retrouvait lui aussi déconnecté juste après, alors que seuls les
    // AUTRES appareils doivent l'être.
    const currentToken = readStudentSessionToken(req)!;
    const destroyed = destroyOtherStudentSessions(student.id, currentToken);
    recordSecurityEvent({
      eventType: "password_changed", severity: "info", accountKind: "student",
      accountEmail: student.email, ip: req.ip,
      detail: `${destroyed} autre(s) session(s) fermée(s)`,
    });
    res.json(authenticatedStudentPayload(student.id));
  })
);

/**
 * Un élève choisit sa propre photo de profil — seul champ de profil qu'il
 * peut modifier lui-même, le reste (nom, niveau, bio…) restant géré par le
 * coach sur la fiche `enrolledStudents`. Écrit dans le bureau personnel de
 * l'élève (`student.userId`), jamais dans la fiche staff partagée — voir
 * `buildStudentProfile` (`studentCredentials.ts`), qui relit cette valeur et
 * la fait primer sur `enrolled.avatar` si elle est présente.
 */
studentProtectedRouter.put(
  "/profile/avatar",
  requireStudentKind,
  createRateLimit({
    windowMs: 15 * 60_000,
    max: 20,
    message: "Trop de tentatives. Réessaie dans quelques minutes.",
  }),
  wrap(async (req, res) => {
    const parsed = updateAvatarSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Photo de profil invalide." });
      return;
    }

    const student = getStudentById(req.auth!.userId);
    if (!student) {
      res.status(404).json({ error: "Compte introuvable." });
      return;
    }

    const current = getProfile<Record<string, unknown>>(student.userId) ?? {};
    saveProfile({ ...current, avatar: parsed.data.avatar }, student.userId);

    res.status(204).end();
  })
);

/**
 * Enregistre le plan de trading de l'élève connecté — seul propriétaire
 * autorisé à l'écrire (voir `getTradingPlan` dans la Vue Complète du coach,
 * `server/auth/routes.ts`, qui ne l'expose qu'en lecture, aucune route
 * d'écriture n'étant proposée au staff).
 */
studentProtectedRouter.put(
  "/trading-plan",
  requireStudentKind,
  createRateLimit({
    windowMs: 15 * 60_000,
    max: 60,
    message: "Trop d'écritures. Réessaie dans quelques minutes.",
  }),
  wrap(async (req, res) => {
    const parsed = tradingPlanSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Plan de trading invalide." });
      return;
    }

    const student = getStudentById(req.auth!.userId);
    if (!student) {
      res.status(404).json({ error: "Compte introuvable." });
      return;
    }

    saveTradingPlan(parsed.data, student.userId);
    res.status(204).end();
  })
);

// Export des données personnelles (Article 20 RGPD) — voir exportData.ts.
addStudentExportRoute(studentProtectedRouter);
