import type { Request, Response, NextFunction } from "express";

/**
 * Autorisations qu'un fondateur peut accorder ou retirer à un coach invité,
 * une par une, depuis "Gérer l'équipe" — voir `StaffAccountsModal.tsx`.
 *
 * Volontairement plat (pas de hiérarchie de rôles) : chaque clé gouverne un
 * groupe de routes précis, listé sur la clé elle-même. N'y accroche rien de
 * nouveau sans mettre à jour la fois `STAFF_PERMISSION_LABELS` (client) et
 * les middlewares `requirePermission(...)` déjà posés sur les routes
 * concernées.
 */
export const STAFF_PERMISSION_KEYS = ["students", "messaging", "announcements", "team", "data"] as const;

export type StaffPermissionKey = (typeof STAFF_PERMISSION_KEYS)[number];

function isStaffPermissionKey(value: unknown): value is StaffPermissionKey {
  return typeof value === "string" && (STAFF_PERMISSION_KEYS as readonly string[]).includes(value);
}

/**
 * Décode la colonne `staff_accounts.permissions` (JSON, ou `NULL`).
 *
 * `NULL` (jamais restreint) et tout contenu invalide (JSON corrompu, pas un
 * tableau) retombent sur `null` — qui signifie "toutes accordées", jamais
 * "aucune". Un coach existant avant l'introduction de cette colonne garde
 * ainsi exactement les droits qu'il avait déjà, sans réinvitation ni action
 * du fondateur : retomber sur un tableau vide aurait silencieusement retiré
 * tous ses accès au déploiement de cette fonctionnalité.
 */
export function parseStaffPermissions(raw: string | null | undefined): StaffPermissionKey[] | null {
  if (raw === null || raw === undefined) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return null;
    return parsed.filter(isStaffPermissionKey);
  } catch {
    return null;
  }
}

export function serializeStaffPermissions(keys: StaffPermissionKey[]): string {
  return JSON.stringify(keys);
}

/**
 * Vrai si CE compte peut faire une action gouvernée par `key`.
 *
 * Le fondateur (`isOwner`) a TOUJOURS tout, quoi que porte `permissions` —
 * jamais restreignable, y compris par lui-même : sans ce court-circuit, une
 * mauvaise manipulation sur son propre compte dans "Gérer l'équipe"
 * pourrait le verrouiller hors de son propre système.
 */
export function hasStaffPermission(
  auth: { isOwner: boolean; permissions: StaffPermissionKey[] | null },
  key: StaffPermissionKey
): boolean {
  if (auth.isOwner) return true;
  if (auth.permissions === null) return true;
  return auth.permissions.includes(key);
}

/**
 * Middleware — 403 explicite si la session staff n'a pas `key`. À poser
 * APRÈS `requireStaffKind` (suppose `req.auth.kind === "staff"`, jamais
 * vérifié ici — voir `requireStaffKind`, server/auth/routes.ts).
 */
export function requirePermission(key: StaffPermissionKey) {
  return (req: Request, res: Response, next: NextFunction) => {
    const auth = req.auth;
    if (!auth || auth.kind !== "staff" || !hasStaffPermission(auth, key)) {
      res.status(403).json({ error: "Autorisation retirée par le fondateur pour cette action." });
      return;
    }
    next();
  };
}
