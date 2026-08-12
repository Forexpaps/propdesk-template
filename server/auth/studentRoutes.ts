import { Router, type Request, type Response, type NextFunction } from "express";
import { loginSchema, changePasswordSchema } from "../schemas";
import { createRateLimit } from "../middleware/rateLimit";
import { normalizeEmail } from "./credentials";
import { getLockoutStatus, registerFailedLogin, clearLoginFailures } from "./loginLockout";
import { hashPassword, verifyPassword, needsRehash, verifyAgainstDecoy } from "./password";
import { recordSecurityEvent } from "./securityEvents";
import {
  getStudentByEmail,
  getStudentById,
  setStudentPassword,
  updateStudentPasswordHash,
} from "./studentCredentials";
import {
  clearStudentSessionCookie,
  createStudentSession,
  destroyAllStudentSessions,
  destroyStudentSession,
  purgeExpiredStudentSessions,
  readStudentSessionToken,
  setStudentSessionCookie,
  validateStudentSession,
} from "./studentSessions";
import { requireStudentKind } from "./middleware";

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
    const destroyed = destroyAllStudentSessions(student.id);
    recordSecurityEvent({
      eventType: "password_changed", severity: "info", accountKind: "student",
      accountEmail: student.email, ip: req.ip,
      detail: `${Math.max(0, destroyed - 1)} autre(s) session(s) fermée(s)`,
    });
    res.json(authenticatedStudentPayload(student.id));
  })
);
