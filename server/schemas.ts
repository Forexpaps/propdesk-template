import { z } from "zod";

/**
 * Validation des entrées de l'API.
 *
 * Le contrat de forme des objets métier reste `src/types.ts` : on ne le
 * redéclare pas ici champ par champ, ce qui créerait deux sources de vérité à
 * garder synchronisées. On valide ce dont le serveur a réellement besoin pour
 * stocker sans corrompre la base : un identifiant stable, des tailles bornées,
 * et le fait que ce soit bien du JSON structuré.
 */

/**
 * `chartUrl`/`avatar` ne sont aujourd'hui rendus qu'en `<img src>`, jamais en
 * lien cliquable ou en navigation — une URL `javascript:` n'y est donc pas
 * exploitable en pratique. Verrou défensif tout de même : n'accepte que des
 * images `https://` ou des `data:image/...` (captures d'écran redimensionnées
 * côté client), pour qu'un futur refactor de ces champs en lien/iframe ne
 * réintroduise pas silencieusement un risque.
 */
const SAFE_MEDIA_URL_FIELDS = ["chartUrl", "avatar"] as const;
const isSafeMediaUrl = (value: unknown): boolean =>
  typeof value !== "string" ||
  value === "" ||
  /^https:\/\//.test(value) ||
  /^data:image\//.test(value);

/** Tout élément de collection doit porter un id non vide et unique. */
const collectionItem = z
  .object({ id: z.string().min(1).max(200) })
  .passthrough()
  .refine(
    (item) =>
      SAFE_MEDIA_URL_FIELDS.every((field) => isSafeMediaUrl((item as Record<string, unknown>)[field])),
    { message: "URL d'image invalide : seules https:// et data:image/... sont acceptées." }
  );

export const collectionPayloadSchema = z
  .array(collectionItem)
  .max(5000)
  .refine(
    (items) => new Set(items.map((i) => i.id)).size === items.length,
    { message: "Identifiants dupliqués dans la collection." }
  );

/**
 * Champs du profil dont le serveur est seul maître.
 *
 * Ils sont **retirés** du corps reçu, pas rejetés : le client renvoie fidèlement
 * l'objet qu'il a reçu, `isAdmin` inclus, donc un 400 casserait toute sauvegarde
 * de profil pour un compte administrateur.
 */
const SERVER_OWNED_PROFILE_FIELDS = ["isAdmin"] as const;

export const profileSchema = z
  .object({
    name: z.string().min(1).max(200),
    // Une adresse réelle, ou vide — mais plus n'importe quelle chaîne. Le champ
    // sert d'identité affichée ; l'email de connexion, lui, vit dans
    // `user_credentials` et est validé strictement à part.
    email: z
      .string()
      .max(320)
      .refine((v) => v === "" || z.email().safeParse(v).success, {
        message: "Adresse e-mail invalide.",
      }),
    startingCapital: z.number().finite(),
    currentCapital: z.number().finite(),
  })
  .passthrough()
  .refine((profile) => isSafeMediaUrl((profile as Record<string, unknown>).avatar), {
    message: "URL d'avatar invalide : seules https:// et data:image/... sont acceptées.",
  })
  .transform((profile) => {
    const cleaned = { ...profile } as Record<string, unknown>;
    for (const field of SERVER_OWNED_PROFILE_FIELDS) delete cleaned[field];
    return cleaned;
  });

export const quizResultsSchema = z.record(z.string().min(1), z.unknown());

export const importStateSchema = z.object({
  student: profileSchema.optional(),
  collections: z.record(z.string(), collectionPayloadSchema).optional(),
  quizResults: quizResultsSchema.optional(),
});

// --- Authentification ----------------------------------------------------

/**
 * Les identifiants ne suivent PAS la philosophie de tolérance du reste de ce
 * fichier. Ici on connaît exactement le contrat, et `.strict()` fait qu'un champ
 * inattendu est traité comme une erreur plutôt que stocké en silence.
 */

/** Longueur minimale d'un mot de passe, sans contrainte de composition. */
const PASSWORD_MIN = 10;

/** `z.email()` plutôt que `.email()` sur ZodString, déprécié en Zod 4. */
const emailField = z
  .string()
  .trim()
  .min(3)
  .max(320)
  .refine((v) => z.email().safeParse(v).success, {
    message: "Adresse e-mail invalide.",
  });

/**
 * Première installation.
 *
 * C'est le seul endroit où la longueur minimale est imposée : l'appliquer à la
 * connexion ferait échouer un mot de passe existant le jour où la règle change.
 */
export const setupSchema = z
  .object({
    email: emailField,
    password: z.string().min(PASSWORD_MIN).max(200),
  })
  .strict();

/**
 * Connexion.
 *
 * Volontairement sans `min(PASSWORD_MIN)` : une connexion légitime ne doit
 * jamais échouer sur une règle de force. Un mot de passe trop court sera de
 * toute façon refusé faute de correspondre au hash.
 */
export const loginSchema = z
  .object({
    email: z.string().trim().min(1).max(320),
    password: z.string().min(1).max(200),
  })
  .strict();

/** Invitation d'un nouveau compte staff. Le mot de passe est généré côté serveur. */
export const inviteStaffSchema = z
  .object({
    name: z.string().trim().min(1).max(200),
    email: emailField,
  })
  .strict();

/**
 * Changement de mot de passe, qu'il soit temporaire ou déjà personnel.
 *
 * `currentPassword` est exigé même quand `mustChangePassword` est vrai : sans
 * lui, connaître le jeton de session (volé, ou une machine restée ouverte)
 * suffirait à changer le mot de passe sans jamais le connaître.
 */
export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1).max(200),
    newPassword: z.string().min(PASSWORD_MIN).max(200),
  })
  .strict();
