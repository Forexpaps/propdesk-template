import { Router, type Request, type Response, type NextFunction } from "express";
import { randomBytes } from "node:crypto";
import { db, DEFAULT_USER_ID, FOUNDER_COACH_ID } from "../db";
import { getProfile, saveProfile, listCollection, updateCollectionItem, replaceCollection, getTradingPlan, getAnnouncements, getAnnouncementsVersion, saveAnnouncements, CollectionVersionConflictError } from "../repositories";
import {
  setupSchema,
  loginSchema,
  inviteStaffSchema,
  changePasswordSchema,
  securityEventsQuerySchema,
  setStudentPasswordSchema,
  updateStudentEmailSchema,
  totpCodeSchema,
  twoFactorLoginSchema,
  disableTotpSchema,
  announcementsSchema,
} from "../schemas";
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
  normalizeEmail,
  setPassword,
  setStaffPermissions,
  updatePasswordHash,
} from "./credentials";
import { getLockoutStatus, registerFailedLogin, clearLoginFailures } from "./loginLockout";
import { get24hStats, listSecurityEvents, recordSecurityEvent } from "./securityEvents";
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
import {
  buildStudentProfile,
  createPasswordResetToken,
  createStudentAccount,
  deleteStudentAccount,
  getStudentByEmail as getStudentAccountByEmail,
  getStudentByEnrolledId,
  listAllStudentAccounts,
  setStudentPassword,
  updateStudentEmail,
} from "./studentCredentials";
import { destroyAllStudentSessions } from "./studentSessions";
import { requireOwner, requireStaffKind } from "./middleware";
import {
  requirePermission,
  hasStaffPermission,
  STAFF_PERMISSION_KEYS,
  type StaffPermissionKey,
} from "./permissions";
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
 * Routes de gestion des comptes staff, qui exigent une session valide.
 *
 * Montée séparément de `authRouter`, et **après** la barrière `requireAuth`
 * dans `server/routes.ts` : c'est ce qui la protège. Les chemins vus par
 * `requireAuth` restent ainsi cohérents avec ceux déclarés dans
 * `server/auth/middleware.ts` (`/auth/change-password`), sans ambiguïté liée
 * au point de montage.
 */
export const staffRouter = Router();

/**
 * Une double invitation concurrente (deux clics rapides, deux onglets) sur le
 * même email/la même fiche passe toutes deux le contrôle de doublon avant
 * qu'aucune n'ait écrit — seule l'écriture elle-même est protégée par un
 * index unique. La seconde à s'exécuter levait jusqu'ici une `SqliteError`
 * non interceptée, remontant en 500 générique avec un message peu clair au
 * lieu du 409 attendu. Détecte ce cas précis pour répondre pareil qu'au
 * contrôle de doublon normal, plutôt que de laisser fuiter l'erreur brute.
 */
function isUniqueConstraintViolation(err: unknown): boolean {
  return err instanceof Error && (err as { code?: string }).code === "SQLITE_CONSTRAINT_UNIQUE";
}

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
      // Gouverne la seule configuration réservée au fondateur : les entrées
      // masquées de la sidebar. Ne retire aucun droit métier — voir
      // `AuthContext.isOwner`.
      isOwner: staff?.isOwner === true,
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
      accountEmail: staff.email, ip: req.ip, detail: "rôle admin",
    });
    res.json(authenticatedPayload(staff.id));
  })
);

/**
 * Étape 2 de connexion, uniquement pour un compte avec 2FA active — échange
 * un défi temporaire (`pendingToken`, obtenu à l'étape 1) contre une vraie
 * session, après vérification d'un code TOTP ou d'un code de récupération.
 * Verrouillage PAR COMPTE partagé avec l'étape 1 (même bucket `("staff",
 * emailLower)`) : un attaquant qui a le mot de passe mais pas le second
 * facteur épuise le même compteur qu'un mauvais mot de passe.
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

// --- Gestion des comptes staff (protégées par requireAuth) ---------------

/**
 * Seule route de lecture de ce fichier sans rate limit dédié jusqu'ici —
 * incohérent avec le reste (toutes les autres routes du module auth en ont
 * un), trouvé en audit de sécurité. Généreuse (lecture seule, déjà
 * authentifiée) mais borne quand même le martelage de la base à coût nul.
 */
const listStaffRateLimit = createRateLimit({
  windowMs: 5 * 60_000,
  max: 60,
  message: "Trop de requêtes. Réessaie dans quelques minutes.",
});

/**
 * Liste les comptes staff. Tous égaux, donc accessible à quiconque est
 * connecté — il n'y a pas de rôle "peut voir la liste" séparé de "est staff".
 */
staffRouter.get("/staff", listStaffRateLimit, requireStaffKind, (_req, res) => {
  res.json({ accounts: listStaffAccounts() });
});

/**
 * Remplace la liste d'autorisations d'un coach — strictement réservée au
 * fondateur (`requireOwner`), jamais délégable via l'autorisation "team"
 * elle-même : un coach à qui "team" a été accordée pourrait sinon se
 * l'accorder à lui-même sur un autre compte, ou retirer les autorisations
 * d'un collègue sans que le fondateur l'ait décidé. Éditer QUI a QUOI reste
 * la seule chose qu'aucune autorisation ne peut jamais déléguer.
 *
 * Le compte fondateur lui-même est refusé en cible : `isOwner` court-circuite
 * déjà `hasStaffPermission` quoi que porte cette colonne (voir
 * `./permissions.ts`), un appel ici serait donc un no-op trompeur — mieux
 * vaut le refuser franchement que laisser croire qu'il a un effet.
 */
staffRouter.put(
  "/staff/:id/permissions",
  requireStaffKind,
  requireOwner,
  (req, res) => {
    const target = getStaffById(req.params.id);
    if (!target) {
      res.status(404).json({ error: "Compte introuvable." });
      return;
    }
    if (target.isOwner) {
      res.status(400).json({ error: "Le compte fondateur a toujours toutes les autorisations." });
      return;
    }

    const body = req.body as { permissions?: unknown };
    if (
      !Array.isArray(body.permissions) ||
      !body.permissions.every((key) => (STAFF_PERMISSION_KEYS as readonly string[]).includes(key))
    ) {
      res.status(400).json({ error: "Liste d'autorisations invalide." });
      return;
    }

    const keys = body.permissions as StaffPermissionKey[];
    setStaffPermissions(target.id, keys);

    recordSecurityEvent({
      eventType: "staff_permissions_updated",
      severity: "info",
      accountKind: "staff",
      accountEmail: target.email,
      ip: req.ip,
      detail: `autorisations : ${keys.length > 0 ? keys.join(", ") : "aucune"}`,
    });

    res.json({ success: true, permissions: keys });
  }
);

/**
 * Invite un nouveau compte staff.
 *
 * Le mot de passe est généré côté serveur, jamais choisi par l'inviteur : il
 * n'est renvoyé qu'une seule fois, dans cette réponse, pour être transmis de
 * la main à la main. `mustChangePassword` force son remplacement à la
 * première connexion.
 *
 * Gouvernée par l'autorisation "team" (`requirePermission`), pas
 * `requireOwner` : un coach à qui le fondateur l'a explicitement accordée
 * peut inviter d'autres coachs. Volontairement asymétrique avec `DELETE
 * /staff/:id` juste plus bas, restée strictement réservée au fondateur —
 * inviter n'a pas le même impact que révoquer l'accès d'un collègue.
 */
staffRouter.post(
  "/staff",
  requireStaffKind,
  requirePermission("team"),
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

    let id: string;
    try {
      id = createInvitedStaffAccount({
        name: parsed.data.name,
        email: parsed.data.email,
        passwordHash,
        invitedBy: req.auth!.userId,
      });
    } catch (err) {
      if (isUniqueConstraintViolation(err)) {
        res.status(409).json({ error: "Un compte existe déjà avec cette adresse." });
        return;
      }
      throw err;
    }

    recordSecurityEvent({
      eventType: "staff_invited", severity: "info", accountKind: "staff",
      accountEmail: parsed.data.email, ip: req.ip, detail: "rôle admin",
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
 * Révoque un compte staff — réservé au compte fondateur (`requireOwner`).
 *
 * `deleteStaffAccount` porte les gardes — dernier compte restant, compte
 * fondateur — et réaffecte les filleuls du compte supprimé pour qu'aucun ne
 * devienne fondateur par effet de bord.
 *
 * `requireOwner` ajouté suite à un audit de sécurité : sans lui, n'importe
 * quel coach invité (staff non-fondateur) pouvait supprimer n'importe quel
 * AUTRE coach invité — un compte staff compromis devenait une primitive de
 * purge de toute l'équipe. Décision explicite de l'utilisateur de restreindre
 * cette action au fondateur, plutôt que de la laisser dans le principe
 * "mêmes droits pour tous les coachs" qui s'applique par ailleurs (voir
 * `credentials.ts`, `StaffAccountsModal.tsx`).
 *
 * Reste `requireOwner` STRICT même après l'introduction de l'autorisation
 * "team" (voir `POST /staff` juste au-dessus) : accorder "team" à un coach
 * lui permet d'INVITER, jamais de révoquer un autre membre de l'équipe —
 * l'asymétrie est volontaire, pas un oubli.
 */
staffRouter.delete("/staff/:id", requireStaffKind, requireOwner, (req, res) => {
  // Capturé avant suppression : la ligne n'existe plus pour retrouver
  // l'email une fois deleteStaffAccount passé.
  const revokedStaff = getStaffById(req.params.id);
  const failure = deleteStaffAccount(req.params.id);

  if (failure === "last-account") {
    res.status(409).json({ error: "Impossible de supprimer le dernier compte restant." });
    return;
  }

  if (failure === "owner") {
    res.status(409).json({
      error:
        "Le compte principal ne peut pas être supprimé : c'est lui qui règle les modules visibles.",
    });
    return;
  }

  if (failure === "not-found") {
    res.status(404).json({ error: "Ce compte n'existe pas." });
    return;
  }

  // Les sessions du compte supprimé n'ont plus lieu d'être : autant les
  // purger immédiatement plutôt que d'attendre leur expiration naturelle.
  db.prepare("DELETE FROM sessions WHERE user_id = ?").run(req.params.id);

  recordSecurityEvent({
    eventType: "staff_revoked", severity: "warning", accountKind: "staff",
    accountEmail: revokedStaff?.email ?? req.params.id, ip: req.ip, detail: "compte révoqué",
  });

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
  requireStaffKind,
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

staffRouter.get("/2fa/status", requireStaffKind, (req, res) => {
  res.json({
    enabled: isTotpEnabled(req.auth!.userId),
    remainingRecoveryCodes: countRemainingRecoveryCodes(req.auth!.userId),
  });
});

/**
 * Démarre une configuration 2FA : nouveau secret stocké mais PAS encore
 * actif (voir `startTotpSetup`). Le compte doit confirmer avec un code
 * valide (`POST /2fa/enable`) avant que la 2FA ne s'applique réellement à sa
 * prochaine connexion — sans quoi une configuration commencée puis
 * abandonnée à mi-chemin (secret enregistré nulle part côté élève) le
 * verrouillerait hors de son propre compte.
 */
staffRouter.post("/2fa/setup", requireStaffKind, twoFactorRateLimit, (req, res) => {
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
 * récupération à cet instant précis (jamais avant : les générer plus tôt
 * laisserait des codes valides pour une 2FA jamais réellement activée) et
 * les renvoie une seule fois, comme un mot de passe temporaire d'invitation.
 */
staffRouter.post("/2fa/enable", requireStaffKind, twoFactorRateLimit, (req, res) => {
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
staffRouter.post("/2fa/disable", requireStaffKind, twoFactorRateLimit, wrap(async (req, res) => {
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
  requireStaffKind,
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

// --- Accès élève, géré par le staff depuis une fiche EnrolledStudent -----

/** Forme minimale d'une fiche telle que stockée : on ne lit que ce dont on a besoin. */
interface EnrolledStudentLike {
  id: string;
  email: string;
  studentAccountId?: string;
  [key: string]: unknown;
}

/**
 * Donne un accès élève à une fiche existante.
 *
 * Le mot de passe est généré côté serveur, jamais choisi par le staff, sur le
 * même modèle que l'invitation staff : renvoyé une seule fois, jamais
 * restocké en clair. La création du compte ET la pose du lien sur la fiche
 * sont dans une même transaction — un échec ne doit pas laisser un compte
 * orphelin sans lien, ni une fiche qui pointe vers un compte qui n'existe
 * plus.
 */
staffRouter.post(
  "/students/:enrolledStudentId/invite",
  requireStaffKind,
  requirePermission("students"),
  createRateLimit({
    windowMs: 15 * 60_000,
    max: 10,
    message: "Trop d'invitations envoyées. Réessaie dans quelques minutes.",
  }),
  wrap(async (req, res) => {
    const students = listCollection<EnrolledStudentLike>("enrolledStudents");
    const student = students.find((s) => s.id === req.params.enrolledStudentId);

    if (!student) {
      res.status(404).json({ error: "Fiche élève introuvable." });
      return;
    }

    if (student.studentAccountId || getStudentByEnrolledId(student.id)) {
      res.status(409).json({ error: "Cette fiche a déjà un accès actif." });
      return;
    }

    if (!student.email) {
      res.status(400).json({ error: "La fiche n'a pas d'adresse e-mail." });
      return;
    }

    if (getStudentAccountByEmail(student.email)) {
      res.status(409).json({ error: "Un compte existe déjà avec cette adresse." });
      return;
    }

    // Même génération que l'invitation staff : 12 caractères base64url.
    const temporaryPassword = randomBytes(9).toString("base64url");
    const passwordHash = await hashPassword(temporaryPassword);

    let created: { id: string; userId: string };
    try {
      created = db.transaction(() => {
      const account = createStudentAccount({
        enrolledStudentId: student.id,
        email: student.email,
        passwordHash,
        invitedBy: req.auth!.userId,
      });

      updateCollectionItem("enrolledStudents", student.id, {
        ...student,
        studentAccountId: account.id,
      });

      // Copie le programme de formation partagé dans le bureau personnel du
      // nouvel élève : sans cette copie, sa progression (leçons vues, quiz)
      // n'aurait nulle part où vivre, puisque chaque bureau a sa propre
      // collection `modules`. Une copie et non un renvoi vers le contenu
      // partagé : la progression de chaque élève doit rester la sienne.
      //
      // `id` est une clé primaire GLOBALE de la table `modules`, pas
      // composite avec `user_id` : réutiliser les id du programme partagé
      // provoquerait un conflit avec les lignes de DEFAULT_USER_ID (ou d'un
      // autre élève déjà servi). Chaque copie reçoit donc des id propres,
      // préfixés par le compte élève.
      const sharedModules = listCollection<{ id: string; [key: string]: unknown }>(
        "modules",
        DEFAULT_USER_ID
      );
      if (sharedModules.length > 0) {
        const personalModules = sharedModules.map((mod) => ({
          ...mod,
          id: `${account.userId}-${mod.id}`,
        }));
        replaceCollection("modules", personalModules, account.userId);
      }

      // Même principe pour les badges : copie des DÉFINITIONS partagées
      // (titre, description, critère), mais jamais de leur état de
      // réclamation — un nouvel élève n'a évidemment rien débloqué. Les `id`
      // sont remappés pour la même raison que `modules` : clé primaire
      // globale de la table, pas composite avec `user_id` (sans ça, le
      // contrôle anti-collision de `replaceCollection` rejetterait la copie
      // dès le second élève inscrit, "badge-1" existant déjà chez le premier).
      const sharedBadges = listCollection<{ id: string; [key: string]: unknown }>(
        "badges",
        DEFAULT_USER_ID
      );
      if (sharedBadges.length > 0) {
        const personalBadges = sharedBadges.map((badge) => ({
          ...badge,
          id: `${account.userId}-${badge.id}`,
          unlocked: false,
          unlockedAt: undefined,
        }));
        replaceCollection("badges", personalBadges, account.userId);
      }

      return account;
      })();
    } catch (err) {
      if (isUniqueConstraintViolation(err)) {
        res.status(409).json({ error: "Cette fiche a déjà un accès actif." });
        return;
      }
      throw err;
    }

    recordSecurityEvent({
      eventType: "student_access_created", severity: "info", accountKind: "student",
      accountEmail: student.email, ip: req.ip, detail: `fiche : ${String(student.name ?? "")}`,
    });

    res.status(201).json({
      studentAccountId: created.id,
      email: student.email,
      temporaryPassword,
    });
  })
);

/**
 * Révoque l'accès élève d'une fiche.
 *
 * Supprime le compte (cascade ses sessions) et retire le lien de la fiche.
 * La fiche elle-même, son bureau `users` et ses trades ne sont pas supprimés
 * — seul l'accès disparaît.
 */
staffRouter.delete("/students/:enrolledStudentId/access", requireStaffKind, requirePermission("students"), (req, res) => {
  const students = listCollection<EnrolledStudentLike>("enrolledStudents");
  const student = students.find((s) => s.id === req.params.enrolledStudentId);

  if (!student) {
    res.status(404).json({ error: "Fiche élève introuvable." });
    return;
  }

  db.transaction(() => {
    deleteStudentAccount(student.id);
    const { studentAccountId, ...rest } = student;
    updateCollectionItem("enrolledStudents", student.id, rest);
  })();

  recordSecurityEvent({
    eventType: "student_access_revoked", severity: "warning", accountKind: "student",
    accountEmail: student.email, ip: req.ip, detail: `fiche : ${String(student.name ?? "")}`,
  });

  res.status(204).end();
});

const studentAccessRateLimit = createRateLimit({
  windowMs: 15 * 60_000,
  max: 20,
  message: "Trop d'actions sur cet accès. Réessaie dans quelques minutes.",
});

/**
 * Fixe directement le mot de passe d'un compte élève — le staff choisit la
 * valeur (contrairement à l'invitation, où elle est générée côté serveur).
 * Déconnecte l'élève de ses sessions en cours : un mot de passe changé sous
 * lui ne doit pas laisser une session ouverte ailleurs continuer à vivre.
 */
staffRouter.put(
  "/students/:enrolledStudentId/password",
  requireStaffKind,
  requirePermission("students"),
  studentAccessRateLimit,
  wrap(async (req, res) => {
    const parsed = setStudentPasswordSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Mot de passe invalide.", details: parsed.error.issues });
      return;
    }

    const account = getStudentByEnrolledId(req.params.enrolledStudentId);
    if (!account) {
      res.status(404).json({ error: "Cette fiche n'a pas d'accès actif." });
      return;
    }

    const passwordHash = await hashPassword(parsed.data.newPassword);
    // `true` : c'est le staff qui choisit cette valeur, pas l'élève — voir le
    // commentaire de `setStudentPassword` (studentCredentials.ts).
    setStudentPassword(account.id, passwordHash, true);
    destroyAllStudentSessions(account.id);

    recordSecurityEvent({
      eventType: "student_password_set_by_staff", severity: "warning", accountKind: "student",
      accountEmail: account.email, ip: req.ip, detail: `fiche : ${req.params.enrolledStudentId}`,
    });

    res.status(204).end();
  })
);

/**
 * Change l'identifiant (email) de connexion d'un compte élève déjà créé.
 *
 * Met à jour à la fois `student_accounts.email` (connexion) et le champ
 * `email` de la fiche `EnrolledStudent` (affichage) — les deux doivent
 * rester cohérents, un élève ne se connaît que par une seule adresse.
 */
staffRouter.put(
  "/students/:enrolledStudentId/email",
  requireStaffKind,
  requirePermission("students"),
  studentAccessRateLimit,
  (req, res) => {
    const parsed = updateStudentEmailSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Adresse e-mail invalide.", details: parsed.error.issues });
      return;
    }

    const account = getStudentByEnrolledId(req.params.enrolledStudentId);
    if (!account) {
      res.status(404).json({ error: "Cette fiche n'a pas d'accès actif." });
      return;
    }

    const existing = getStudentAccountByEmail(parsed.data.email);
    if (existing && existing.id !== account.id) {
      res.status(409).json({ error: "Un compte existe déjà avec cette adresse." });
      return;
    }

    const students = listCollection<EnrolledStudentLike>("enrolledStudents");
    const student = students.find((s) => s.id === req.params.enrolledStudentId);

    db.transaction(() => {
      updateStudentEmail(account.id, parsed.data.email);
      if (student) {
        updateCollectionItem("enrolledStudents", student.id, { ...student, email: parsed.data.email });
      }
    })();

    recordSecurityEvent({
      eventType: "student_email_changed", severity: "warning", accountKind: "student",
      accountEmail: parsed.data.email, ip: req.ip, detail: `fiche : ${req.params.enrolledStudentId}`,
    });

    res.status(204).end();
  }
);

/**
 * Génère un lien de réinitialisation de mot de passe pour un élève, à
 * transmettre à la main (pas d'envoi d'e-mail automatique dans ce chantier —
 * même limitation que le mot de passe temporaire de l'invitation, déjà
 * affiché une seule fois pour être copié/collé). Le jeton n'est renvoyé
 * qu'ici, en clair, jamais récupérable ensuite.
 */
staffRouter.post(
  "/students/:enrolledStudentId/reset-link",
  requireStaffKind,
  requirePermission("students"),
  studentAccessRateLimit,
  (req, res) => {
    const account = getStudentByEnrolledId(req.params.enrolledStudentId);
    if (!account) {
      res.status(404).json({ error: "Cette fiche n'a pas d'accès actif." });
      return;
    }

    const { token, expiresAt } = createPasswordResetToken(account.id);

    recordSecurityEvent({
      eventType: "student_password_reset_link_created", severity: "info", accountKind: "student",
      accountEmail: account.email, ip: req.ip, detail: `fiche : ${req.params.enrolledStudentId}`,
    });

    res.status(201).json({
      // Fragment (`#token=`), pas query string : jamais envoyé au serveur
      // dans aucune requête HTTP, donc jamais loggué par un proxy/CDN en
      // amont — voir le commentaire jumeau dans `src/App.tsx`. Trouvé en
      // audit de sécurité.
      link: `${req.protocol}://${req.get("host")}/reset-password#token=${token}`,
      expiresAt,
    });
  }
);

/**
 * Trades réels d'un élève, en lecture seule — sert à `StudentTracking.tsx`
 * pour afficher les vrais trades une fois un accès actif, à la place de la
 * saisie manuelle `recentTrades`. Jamais d'écriture par cette route : l'élève
 * reste seul à journaliser ses propres trades.
 *
 * `accounts` suit le même principe : une fois un accès actif, les
 * portefeuilles que l'élève a lui-même créés (bureau `account.userId`) font
 * foi, à la place de la saisie manuelle `EnrolledStudent.accounts` — sans
 * quoi la fiche affichée au coach ne refléterait jamais les vrais comptes
 * ouverts par l'élève depuis son propre espace Portefeuille.
 *
 * `email` : le vrai email de connexion (`student_accounts.email`), distinct
 * de `EnrolledStudent.email` (la fiche staff, un simple champ de contact une
 * fois l'accès créé — voir son commentaire dans `src/types.ts`). Le
 * formulaire d'édition préchargeait jusqu'ici le champ "Identifiant (email
 * de connexion)" avec l'email de la fiche, pas le vrai email de connexion —
 * les deux peuvent diverger dès que l'un des deux est modifié séparément de
 * l'autre. Corrigé en renvoyant ici la valeur qui fait réellement foi.
 */
staffRouter.get(
  "/students/:enrolledStudentId/trades",
  requireStaffKind,
  requirePermission("students"),
  createRateLimit({
    windowMs: 15 * 60_000,
    max: 30,
    message: "Trop de requêtes. Réessaie dans quelques minutes.",
  }),
  (req, res) => {
    const account = getStudentByEnrolledId(req.params.enrolledStudentId);
    if (!account) {
      res.status(404).json({ error: "Cette fiche n'a pas d'accès actif." });
      return;
    }

    res.json({
      trades: listCollection("trades", account.userId),
      accounts: listCollection("accounts", account.userId),
      email: account.email,
    });
  }
);

// Vue admin complète d'un élève (lecture seule)
staffRouter.get(
  "/admin/students/:enrolledStudentId/view",
  requireStaffKind,
  requirePermission("students"),
  createRateLimit({
    windowMs: 15 * 60_000,
    max: 30,
    message: "Trop de requêtes. Réessaie dans quelques minutes.",
  }),
  (req, res) => {
    const account = getStudentByEnrolledId(req.params.enrolledStudentId);
    if (!account) {
      res.status(404).json({ error: "Cette fiche n'a pas d'accès actif." });
      return;
    }

    // Retourne l'état complet de l'élève (profil, fiches, comptes, trades, etc)
    //
    // `accounts`, `modules` et `messages` viennent du bureau personnel de
    // l'élève (`account.userId`), pas du bureau staff partagé : chaque élève a
    // ses propres portefeuilles, sa propre copie du programme (progression
    // individuelle) et son propre fil de messagerie.
    //
    // `student` passe par `buildStudentProfile` (et non `getProfile(account.userId)`
    // brut) pour la même raison que la vraie session élève : le profil élève
    // n'a quasiment jamais `hiddenSidebarItems` renseigné lui-même, un accès
    // direct à `getProfile` ignorerait donc silencieusement le réglage de
    // visibilité du fondateur et la Vue Complète afficherait des modules que
    // le fondateur a pourtant masqués. Bug réel corrigé ici.
    res.json({
      student: buildStudentProfile(account.id),
      collections: {
        enrolledStudents: listCollection("enrolledStudents", DEFAULT_USER_ID),
        accounts: listCollection("accounts", account.userId),
        trades: listCollection("trades", account.userId),
        modules: listCollection("modules", account.userId),
        messages: listCollection("messages", account.userId),
        setups: listCollection("setups", account.userId),
      },
      // Lecture seule : aucune route d'écriture n'est exposée au staff pour
      // le plan de trading, seule `PUT /auth/trading-plan` (élève, sur sa
      // propre session) peut l'écrire — voir `studentRoutes.ts`.
      tradingPlan: getTradingPlan(account.userId),
      announcements: getAnnouncements() ?? [],
    });
  }
);

/**
 * Envoie un message de coach dans le fil d'un élève précis.
 *
 * Écrit directement dans le bureau personnel de l'élève (`account.userId`) —
 * le même espace où vit sa propre collection `messages`, pour que son envoi
 * et la réponse du coach vivent dans le même fil sans synchronisation à
 * organiser entre deux bureaux.
 */
staffRouter.post(
  "/students/:enrolledStudentId/messages",
  requireStaffKind,
  requirePermission("messaging"),
  createRateLimit({
    windowMs: 15 * 60_000,
    max: 10,
    message: "Trop de messages envoyés. Réessaie dans quelques minutes.",
  }),
  (req, res) => {
    const account = getStudentByEnrolledId(req.params.enrolledStudentId);
    if (!account) {
      res.status(404).json({ error: "Cette fiche n'a pas d'accès actif." });
      return;
    }

    const text = typeof req.body?.text === "string" ? req.body.text.trim() : "";
    if (!text || text.length > 5000) {
      res.status(400).json({ error: "Le message doit faire entre 1 et 5000 caractères." });
      return;
    }

    // `coachId` doit correspondre au coach affiché côté élève, reconstruit
    // depuis le vrai profil fondateur par `buildCoachesForStudent`
    // (server/routes.ts) : `CoachMessaging` filtre son fil par ce champ, pas
    // par l'identité réelle du compte staff qui répond. Fixé sur
    // `FOUNDER_COACH_ID` faute d'un vrai choix d'expéditeur dans cette vue —
    // un seul fil existe ici, pas un par membre du staff (bureau partagé).
    const message = {
      id: `msg-${randomBytes(9).toString("base64url")}`,
      sender: "coach" as const,
      coachId: FOUNDER_COACH_ID,
      text,
      timestamp: new Date().toISOString(),
      status: "sent" as const,
    };

    // Lecture puis écriture dans une même transaction : sans elle, deux coachs
    // répondant au même instant (ou une réponse coach et un envoi élève
    // concurrent) pourraient chacun lire l'état avant l'écriture de l'autre et
    // se marcher dessus au moment d'écrire, perdant l'un des deux messages.
    db.transaction(() => {
      const existing = listCollection("messages", account.userId);
      replaceCollection("messages", [...existing, message], account.userId);
    })();

    res.status(201).json({ message });
  }
);

/**
 * Publie la liste complète des annonces — gouvernée par l'autorisation
 * "announcements" (le fondateur l'a toujours, `hasStaffPermission`
 * court-circuite sur `isOwner` ; un coach ne l'a que si explicitement
 * accordée, sinon 403). Diffuse une notification (type "academy", avec le
 * son d'alerte côté client — voir `useNotificationSound`,
 * `src/hooks/useNotificationSound.ts`) dans le fil de CHAQUE élève actif,
 * mais seulement pour les entrées dont l'`id` n'existait pas dans l'ancienne
 * liste : une simple édition (même id) ne renotifie personne.
 */
staffRouter.put(
  "/announcements",
  requireStaffKind,
  requirePermission("announcements"),
  createRateLimit({
    windowMs: 15 * 60_000,
    max: 30,
    message: "Trop d'écritures. Réessaie dans quelques minutes.",
  }),
  (req, res) => {
    const parsed = announcementsSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Annonces invalides." });
      return;
    }

    const { announcements: nextAnnouncements, expectedVersion } = parsed.data;
    const previousIds = new Set((getAnnouncements<{ id: string }[]>() ?? []).map((a) => a.id));
    const newAnnouncements = nextAnnouncements.filter((a) => !previousIds.has(a.id));

    let newVersion: number;
    try {
      newVersion = db.transaction(() => {
        const version = saveAnnouncements(nextAnnouncements, expectedVersion);

        if (newAnnouncements.length > 0) {
          const students = listAllStudentAccounts();
          for (const student of students) {
            const existing = listCollection("notifications", student.userId);
            const notifications = newAnnouncements.map((a) => ({
              id: `announce-${a.id}-${student.id}`,
              title: `📣 ${a.title}`,
              message: a.body.slice(0, 200),
              time: "À l'instant",
              type: "academy" as const,
              read: false,
              targetTab: "announcements",
            }));
            // Plafonnée : sans ça, la collection `notifications` d'un élève actif
            // grossirait indéfiniment au fil des annonces + alertes de plan
            // accumulées sur des mois, jamais purgée par ailleurs (voir
            // `MAX_STUDENT_NOTIFICATIONS` côté client, `planCompliance.ts`, pour
            // le même plafond appliqué aux alertes de plan).
            replaceCollection("notifications", [...notifications, ...existing].slice(0, 300), student.userId);
          }
        }

        return version;
      })();
    } catch (err) {
      if (err instanceof CollectionVersionConflictError) {
        // Un autre coach (ou le fondateur, dans un autre onglet) a publié
        // entre-temps — rien n'a été écrit, pour ne pas écraser cette autre
        // modification en silence. Voir `announcementsSchema`.
        res.status(409).json({ error: "Conflit de synchronisation : recharge la page et réessaie." });
        return;
      }
      throw err;
    }

    res.json({ success: true, count: nextAnnouncements.length, version: newVersion });
  }
);

/**
 * Journal de sécurité — lecture réservée au compte fondateur (`requireOwner`,
 * en plus de `requireStaffKind`). Couvre les deux mondes d'identité (staff
 * ET élève), voir `server/auth/securityEvents.ts`.
 */
staffRouter.get("/security-events", requireStaffKind, requireOwner, (req, res) => {
  const parsed = securityEventsQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: "Filtres invalides." });
    return;
  }

  const { events, total } = listSecurityEvents(parsed.data);
  res.json({ events, total, stats: get24hStats(), retentionDays: 90 });
});
