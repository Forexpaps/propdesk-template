import { randomBytes } from "node:crypto";
import { db, DEFAULT_USER_ID } from "../db";
import { getProfile } from "../repositories";
import { parseStaffPermissions, serializeStaffPermissions, type StaffPermissionKey } from "./permissions";

/**
 * Accès à la table `staff_accounts`.
 *
 * Ce module est le seul à lire ou écrire les identités de connexion. Rien de
 * ce qu'il renvoie ne doit atteindre le client : `passwordHash` en particulier
 * ne sort jamais des routes d'authentification.
 *
 * Un compte staff est une IDENTITÉ, pas un bureau : plusieurs comptes
 * partagent les mêmes données (celles de `DEFAULT_USER_ID`), voir
 * `server/db.ts`.
 *
 * Les comptes ont les mêmes droits **métier** : quiconque est du staff peut
 * tout faire sur les données. La seule exception est `isOwner`, qui distingue
 * le compte fondateur et ne gouverne qu'une chose — le réglage des modules
 * visibles dans la sidebar, qui appartient au bureau partagé et vaut donc pour
 * tout le monde. Ce n'est pas un système de rôles : n'y accroche rien d'autre
 * sans y réfléchir à deux fois.
 */

export interface StaffAccount {
  id: string;
  name: string;
  email: string;
  emailLower: string;
  passwordHash: string;
  mustChangePassword: boolean;
  /** Voir `isOwnerRow` : compte fondateur, seul à régler la sidebar partagée. */
  isOwner: boolean;
  /** `null` = toutes accordées — voir `parseStaffPermissions`, `./permissions.ts`. */
  permissions: StaffPermissionKey[] | null;
}

/** Forme exposable au client : jamais de `passwordHash`. */
export interface StaffAccountSummary {
  id: string;
  name: string;
  email: string;
  mustChangePassword: boolean;
  createdAt: string;
  isOwner: boolean;
  permissions: StaffPermissionKey[] | null;
}

interface StaffAccountRow {
  id: string;
  name: string;
  email: string;
  email_lower: string;
  password_hash: string;
  must_change_password: number;
  invited_by: string | null;
  permissions: string | null;
}

interface StaffAccountSummaryRow {
  id: string;
  name: string;
  email: string;
  must_change_password: number;
  created_at: string;
  invited_by: string | null;
  permissions: string | null;
}

/**
 * Distingue le compte fondateur des comptes invités.
 *
 * `invited_by` est `NULL` pour le seul compte créé par `/auth/setup`, et
 * renseigné pour tous ceux créés par `createInvitedStaffAccount` — le drapeau
 * se lit donc sur le schéma existant, sans migration ni colonne nouvelle.
 *
 * Attention : la clé étrangère est `ON DELETE SET NULL`. Supprimer un compte
 * qui en a invité d'autres remettrait leur `invited_by` à `NULL` et les
 * promouvrait fondateurs par accident — d'où la garde dans
 * `deleteStaffAccount`, qui réaffecte les filleuls avant la suppression.
 */
function isOwnerRow(invitedBy: string | null): boolean {
  return invitedBy === null;
}

function toStaffAccount(row: StaffAccountRow): StaffAccount {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    emailLower: row.email_lower,
    passwordHash: row.password_hash,
    mustChangePassword: row.must_change_password === 1,
    isOwner: isOwnerRow(row.invited_by),
    permissions: parseStaffPermissions(row.permissions),
  };
}

/**
 * Normalise un email pour servir d'identifiant de connexion.
 *
 * La casse et les espaces de bord ne doivent pas empêcher une connexion
 * légitime. La forme saisie, elle, est conservée à part pour l'affichage.
 */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/**
 * Vrai dès qu'un compte staff existe.
 *
 * C'est ce qui distingue « première installation » de « connexion », et ce qui
 * verrouille la route de setup — sans quoi n'importe qui pourrait créer le
 * premier compte à distance.
 */
export function hasAnyStaffAccount(): boolean {
  const row = db.prepare("SELECT 1 FROM staff_accounts LIMIT 1").get();
  return row !== undefined;
}

export function getStaffByEmail(email: string): StaffAccount | null {
  const row = db
    .prepare(
      `SELECT id, name, email, email_lower, password_hash, must_change_password, invited_by, permissions
       FROM staff_accounts WHERE email_lower = ?`
    )
    .get(normalizeEmail(email)) as StaffAccountRow | undefined;

  return row ? toStaffAccount(row) : null;
}

export function getStaffById(id: string): StaffAccount | null {
  const row = db
    .prepare(
      `SELECT id, name, email, email_lower, password_hash, must_change_password, invited_by, permissions
       FROM staff_accounts WHERE id = ?`
    )
    .get(id) as StaffAccountRow | undefined;

  return row ? toStaffAccount(row) : null;
}

/**
 * Liste tous les comptes staff, triés par ancienneté. Forme sans `passwordHash`
 * : c'est celle qu'on peut renvoyer telle quelle à un écran d'administration.
 */
export function listStaffAccounts(): StaffAccountSummary[] {
  const rows = db
    .prepare(
      `SELECT id, name, email, must_change_password, created_at, invited_by, permissions
       FROM staff_accounts ORDER BY created_at ASC`
    )
    .all() as StaffAccountSummaryRow[];

  // `staff_accounts.name` du fondateur date du tout premier bootstrap du
  // compte (souvent dérivé de l'email, ex. "th.gauthey99") et peut diverger
  // du nom complet qu'il a défini depuis dans son profil (`getProfile`,
  // affiché partout ailleurs dans l'app). Un coach invité n'a pas ce
  // problème : il n'a pas de profil séparé (bureau partagé), son nom de
  // compte est directement celui tapé à l'invitation. Même principe que
  // `buildCoachesForStudent` (server/routes.ts), qui reconstruit déjà le
  // coach affiché à l'élève depuis ce même profil.
  const ownerProfileName = getProfile<{ name?: string }>()?.name;

  return rows.map((row) => ({
    id: row.id,
    name: isOwnerRow(row.invited_by) && ownerProfileName ? ownerProfileName : row.name,
    email: row.email,
    mustChangePassword: row.must_change_password === 1,
    createdAt: row.created_at,
    isOwner: isOwnerRow(row.invited_by),
    permissions: parseStaffPermissions(row.permissions),
  }));
}

/** Identifiant du compte fondateur, ou `null` sur une base sans compte. */
export function getOwnerId(): string | null {
  const row = db
    .prepare("SELECT id FROM staff_accounts WHERE invited_by IS NULL ORDER BY created_at ASC LIMIT 1")
    .get() as { id: string } | undefined;
  return row?.id ?? null;
}

/**
 * Crée le premier compte staff, via `/auth/setup`.
 *
 * Réutilise `DEFAULT_USER_ID` comme identifiant : historique, sans
 * conséquence pour les comptes suivants (qui reçoivent un id aléatoire via
 * `createInvitedStaffAccount`), mais garde une continuité avec les bases qui
 * existaient avant l'introduction de `staff_accounts`.
 */
export function createFirstStaffAccount(input: { email: string; passwordHash: string }): void {
  const now = new Date().toISOString();
  db.prepare(
    `INSERT INTO staff_accounts
       (id, name, email, email_lower, password_hash, must_change_password, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, 0, ?, ?)`
  ).run(
    DEFAULT_USER_ID,
    input.email.split("@")[0] || "Coach",
    input.email.trim(),
    normalizeEmail(input.email),
    input.passwordHash,
    now,
    now
  );
}

/**
 * Crée un compte invité, avec un mot de passe temporaire déjà haché.
 *
 * `mustChangePassword` est toujours vrai : le mot de passe temporaire n'est
 * connu que de la personne qui invite, jamais choisi par l'intéressé — il
 * doit en définir un qui n'appartient qu'à lui avant de pouvoir utiliser
 * l'application normalement.
 */
export function createInvitedStaffAccount(input: {
  name: string;
  email: string;
  passwordHash: string;
  invitedBy: string;
}): string {
  const id = randomBytes(12).toString("base64url");
  const now = new Date().toISOString();
  db.prepare(
    `INSERT INTO staff_accounts
       (id, name, email, email_lower, password_hash, must_change_password, invited_by, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, 1, ?, ?, ?)`
  ).run(
    id,
    input.name.trim(),
    input.email.trim(),
    normalizeEmail(input.email),
    input.passwordHash,
    input.invitedBy,
    now,
    now
  );
  return id;
}

/** Remplace le hash d'un compte. Sert au re-hachage transparent après connexion. */
export function updatePasswordHash(id: string, passwordHash: string): void {
  db.prepare(
    "UPDATE staff_accounts SET password_hash = ?, updated_at = ? WHERE id = ?"
  ).run(passwordHash, new Date().toISOString(), id);
}

/**
 * Remplace le mot de passe ET lève le drapeau d'obligation de changement, en
 * une seule écriture — c'est le chemin de `/auth/change-password`.
 */
export function setPassword(id: string, passwordHash: string): void {
  db.prepare(
    "UPDATE staff_accounts SET password_hash = ?, must_change_password = 0, updated_at = ? WHERE id = ?"
  ).run(passwordHash, new Date().toISOString(), id);
}

/**
 * Remplace la liste d'autorisations d'un compte staff — appelé UNIQUEMENT
 * par la route `PUT /staff/:id/permissions` (réservée au fondateur, voir
 * `requireOwner` posé dessus, `server/auth/routes.ts`). `keys` vide (pas
 * `null`) écrit explicitement "aucune autorisation", distinct de la colonne
 * jamais renseignée (`NULL` = toutes) — retirer la dernière autorisation
 * d'un coach doit vraiment tout lui retirer, pas repasser silencieusement à
 * "toutes accordées" faute de savoir distinguer les deux cas.
 */
export function setStaffPermissions(id: string, keys: StaffPermissionKey[]): void {
  db.prepare("UPDATE staff_accounts SET permissions = ?, updated_at = ? WHERE id = ?").run(
    serializeStaffPermissions(keys),
    new Date().toISOString(),
    id
  );
}

/**
 * Motif de refus d'une suppression, ou `null` si elle a bien eu lieu.
 *
 * Une union plutôt qu'un booléen : l'appelant doit pouvoir expliquer *pourquoi*
 * il refuse, les deux cas n'ayant pas le même message.
 */
export type DeleteStaffFailure = "not-found" | "last-account" | "owner";

/**
 * Supprime un compte staff.
 *
 * Deux refus :
 *
 * - **le dernier compte restant** — sans lui, plus personne ne pourrait se
 *   reconnecter, et il n'existe aucune procédure de récupération (voir README) ;
 * - **le compte fondateur** — c'est l'ancre du drapeau `isOwner`. Le supprimer
 *   ne promouvrait personne : plus aucun compte ne pourrait régler la sidebar
 *   partagée, définitivement et sans recours.
 *
 * La réaffectation des filleuls est la partie non évidente. `invited_by` est
 * déclaré `ON DELETE SET NULL` : supprimer un coach qui en a invité d'autres
 * remettrait leur `invited_by` à `NULL`, ce qui les ferait passer pour des
 * fondateurs. On les rattache donc au fondateur **avant** la suppression, dans
 * la même transaction — sans quoi la suppression d'un compte deviendrait une
 * élévation de privilège pour un autre.
 */
export function deleteStaffAccount(id: string): DeleteStaffFailure | null {
  const total = (db.prepare("SELECT count(*) c FROM staff_accounts").get() as { c: number }).c;
  if (total <= 1) return "last-account";

  const target = getStaffById(id);
  if (!target) return "not-found";
  if (target.isOwner) return "owner";

  const ownerId = getOwnerId();

  return db.transaction((): DeleteStaffFailure | null => {
    if (ownerId !== null) {
      db.prepare("UPDATE staff_accounts SET invited_by = ? WHERE invited_by = ?").run(ownerId, id);
    }

    const result = db.prepare("DELETE FROM staff_accounts WHERE id = ?").run(id);
    return result.changes > 0 ? null : "not-found";
  })();
}

/**
 * Garantit l'existence de la ligne `users` avant l'insertion du premier
 * compte staff.
 *
 * Sans lien avec `staff_accounts` (qui n'a plus de clé étrangère vers
 * `users`) — cette fonction reste nécessaire pour amorcer le bureau partagé
 * lui-même sur une base neuve. Un profil existant n'est jamais écrasé : c'est
 * ce qui préserve les données lors de l'installation sur une base déjà
 * peuplée.
 */
export function ensureUserRow(profile: Record<string, unknown>): void {
  const existing = db
    .prepare("SELECT 1 FROM users WHERE id = ?")
    .get(DEFAULT_USER_ID);

  if (existing === undefined) {
    db.prepare("INSERT INTO users (id, payload) VALUES (?, ?)").run(
      DEFAULT_USER_ID,
      JSON.stringify(profile)
    );
  }
}
