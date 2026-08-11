import { Router, type Request, type Response, type NextFunction } from "express";
import { randomBytes } from "node:crypto";
import { db, DEFAULT_USER_ID } from "../db";
import { getProfile, saveProfile, listCollection, updateCollectionItem, replaceCollection } from "../repositories";
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
import {
  createStudentAccount,
  deleteStudentAccount,
  getStudentByEmail as getStudentAccountByEmail,
  getStudentByEnrolledId,
} from "./studentCredentials";
import { requireStaffKind } from "./middleware";

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
staffRouter.get("/staff", requireStaffKind, (_req, res) => {
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
  requireStaffKind,
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
 * `deleteStaffAccount` porte les gardes — dernier compte restant, compte
 * fondateur — et réaffecte les filleuls du compte supprimé pour qu'aucun ne
 * devienne fondateur par effet de bord.
 */
staffRouter.delete("/staff/:id", requireStaffKind, (req, res) => {
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

    const created = db.transaction(() => {
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

      return account;
    })();

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
staffRouter.delete("/students/:enrolledStudentId/access", requireStaffKind, (req, res) => {
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

  res.status(204).end();
});

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
 */
staffRouter.get("/students/:enrolledStudentId/trades", requireStaffKind, (req, res) => {
  const account = getStudentByEnrolledId(req.params.enrolledStudentId);
  if (!account) {
    res.status(404).json({ error: "Cette fiche n'a pas d'accès actif." });
    return;
  }

  res.json({
    trades: listCollection("trades", account.userId),
    accounts: listCollection("accounts", account.userId),
  });
});

// Vue admin complète d'un élève (lecture seule)
staffRouter.get("/admin/students/:enrolledStudentId/view", requireStaffKind, (req, res) => {
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
  res.json({
    student: getProfile(account.userId),
    collections: {
      enrolledStudents: listCollection("enrolledStudents", DEFAULT_USER_ID),
      accounts: listCollection("accounts", account.userId),
      trades: listCollection("trades", account.userId),
      modules: listCollection("modules", account.userId),
      messages: listCollection("messages", account.userId),
    },
  });
});

/**
 * Envoie un message de coach dans le fil d'un élève précis.
 *
 * Écrit directement dans le bureau personnel de l'élève (`account.userId`) —
 * le même espace où vit sa propre collection `messages`, pour que son envoi
 * et la réponse du coach vivent dans le même fil sans synchronisation à
 * organiser entre deux bureaux.
 */
staffRouter.post("/students/:enrolledStudentId/messages", requireStaffKind, (req, res) => {
  const account = getStudentByEnrolledId(req.params.enrolledStudentId);
  if (!account) {
    res.status(404).json({ error: "Cette fiche n'a pas d'accès actif." });
    return;
  }

  const text = typeof req.body?.text === "string" ? req.body.text.trim() : "";
  if (!text) {
    res.status(400).json({ error: "Le message ne peut pas être vide." });
    return;
  }

  // `coachId` doit correspondre à l'un des coachs fictifs affichés côté
  // élève (`src/data/mockData.ts`, `initialCoaches`) : `CoachMessaging`
  // filtre son fil par ce champ, pas par l'identité réelle du compte staff
  // qui répond. Fixé sur le head coach faute d'un vrai choix d'expéditeur
  // dans cette vue — un seul fil existe ici, pas un par coach fictif.
  const message = {
    id: `msg-${randomBytes(9).toString("base64url")}`,
    sender: "coach" as const,
    coachId: "coach-thomas",
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
});
