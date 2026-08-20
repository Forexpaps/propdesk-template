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
/**
 * `value == null` (absent ou explicitement `null`) est le seul cas où le
 * champ n'est pas concerné — tout ce qui n'est PAS une chaîne (nombre, objet,
 * tableau, booléen) doit échouer, pas passer. La version précédente traitait
 * `typeof value !== "string"` comme "non concerné", ce qui laissait passer
 * n'importe quel type non-string sans jamais valider son contenu — un appel
 * direct à l'API avec un mauvais type contournait donc complètement ce verrou.
 */
const isSafeMediaUrl = (value: unknown): boolean =>
  value == null ||
  (typeof value === "string" &&
    (value === "" || /^https:\/\//.test(value) || /^data:image\//.test(value)));

/**
 * `initialBalance` (comptes `TradingAccount`) sert de diviseur dans plusieurs
 * calculs de pourcentage côté client (progression vers l'objectif de profit,
 * drawdown) — un compte créé avec un capital nul ou négatif produirait un
 * pourcentage NaN ou de signe inversé. Le formulaire l'empêche déjà
 * (`WalletManagement.tsx`), mais un appel direct à l'API le contournerait
 * sans ce verrou. Même correctif de confusion de type que `isSafeMediaUrl`
 * ci-dessus : `typeof value !== "number"` laissait passer une chaîne comme
 * `"0"`, reproduisant silencieusement le bug NaN que ce verrou doit empêcher.
 */
const isValidInitialBalance = (value: unknown): boolean =>
  value == null || (typeof value === "number" && value > 0);

/**
 * Tout élément de collection doit porter un id non vide et unique.
 *
 * ⚠️ `.passthrough()` : un élève écrivant dans une collection qui lui est
 * autorisée (`trades`/`accounts`/`modules`/`badges`/`messages`) peut inclure
 * n'importe quel champ supplémentaire sur SES PROPRES lignes. Sans danger
 * aujourd'hui — aucun champ de collection n'est relu avec un privilège
 * supérieur côté serveur (`isAdmin` ne vit jamais dans une collection, voir
 * `buildStudentProfile`/`buildStaffProfile`) — mais à garder en tête : une
 * future fonctionnalité qui accorderait une confiance implicite à un champ
 * passthrough (ex. un flag `verified`/`role` sur un `trade`) réintroduirait
 * une auto-élévation de privilège silencieuse. Relevé en audit de sécurité,
 * documenté ici plutôt que "corrigé" faute de vulnérabilité actuelle à
 * fermer sans casser le passthrough dont dépendent des champs légitimes.
 */
const collectionItem = z
  .object({ id: z.string().min(1).max(200) })
  .passthrough()
  .refine(
    (item) =>
      SAFE_MEDIA_URL_FIELDS.every((field) => isSafeMediaUrl((item as Record<string, unknown>)[field])),
    { message: "URL d'image invalide : seules https:// et data:image/... sont acceptées." }
  )
  .refine((item) => isValidInitialBalance((item as Record<string, unknown>).initialBalance), {
    message: "Le capital initial doit être un nombre supérieur à 0.",
  });

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
    // `>= 0`, pas `> 0` comme `isValidInitialBalance` : contrairement à un
    // compte de trading, un profil sans aucun portefeuille encore créé a
    // légitimement `startingCapital: 0` (voir `App.tsx`, dérivé de la somme
    // des comptes réels). Négatif en revanche n'a aucun sens ici.
    startingCapital: z.number().finite().min(0),
    currentCapital: z.number().finite().min(0),
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

/**
 * Mise à jour de sa propre photo de profil par un élève (`PUT
 * /auth/profile/avatar`) — seul champ du profil qu'un élève peut modifier
 * lui-même, le reste restant géré par le coach (voir `UserProfileModal.tsx`,
 * prop `avatarOnly`). Même garde `isSafeMediaUrl` que `profileSchema.avatar`.
 * La borne de taille couvre largement un avatar réduit à 256×256 en WebP/JPEG
 * qualité 0.85 (`AVATAR_SIZE`/`AVATAR_QUALITY`, `src/lib/image.ts`), qui ne
 * dépasse jamais quelques dizaines de Ko une fois encodé en base64.
 */
export const updateAvatarSchema = z.object({
  avatar: z
    .string()
    .min(1)
    .max(400_000)
    .refine(isSafeMediaUrl, {
      message: "URL d'avatar invalide : seules https:// et data:image/... sont acceptées.",
    }),
});

/**
 * Plan de trading d'un élève (`TradingPlanData`, `src/types.ts`) — un objet
 * unique, jamais un tableau. Bornes larges (les champs texte sont saisis à la
 * main dans un formulaire) mais présentes, même raisonnement que
 * `quizResultEntrySchema` juste en dessous.
 */
export const tradingPlanSchema = z.object({
  authorizedSessions: z.array(z.string().max(50)).max(20),
  tradingHours: z.string().max(200),
  trackedAssets: z.string().max(500),
  authorizedSetups: z.string().max(500),
  riskPerTradePercent: z.string().max(20),
  maxTradesPerDay: z.string().max(20),
  maxDailyLossPercent: z.string().max(20),
  entryConditions: z.string().max(2000),
  stopConditions: z.string().max(2000),
  goldenRules: z.string().max(2000),
});

/**
 * Un seul résultat de quiz de module — voir `ModuleQuizResult` dans
 * `src/types.ts`. Bornée (au lieu de `z.unknown()`) : la seule protection
 * précédente était la limite globale de 8 Mo sur le corps de la requête,
 * largement au-dessus de ce qu'un vrai résultat de quiz pèse jamais.
 */
const quizResultEntrySchema = z.object({
  scorePercentage: z.number().min(0).max(100),
  totalQuestions: z.number().int().min(0).max(500),
  correctAnswers: z.number().int().min(0).max(500),
  passed: z.boolean(),
  completedAt: z.string().max(100),
});

/**
 * Une clé par module — le programme réel en compte une poignée, 200 laisse
 * une marge généreuse sans autoriser un payload de milliers d'entrées.
 */
export const quizResultsSchema = z
  .record(z.string().min(1).max(200), quizResultEntrySchema)
  .refine((results) => Object.keys(results).length <= 200, {
    message: "Trop de résultats de quiz dans la même requête.",
  });

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

/** Le staff fixe directement le mot de passe d'un élève — pas de mot de passe actuel à fournir. */
export const setStudentPasswordSchema = z
  .object({
    newPassword: z.string().min(PASSWORD_MIN).max(200),
  })
  .strict();

/** Code TOTP à 6 chiffres — confirmation de configuration 2FA (`POST /auth/2fa/enable`). */
export const totpCodeSchema = z
  .object({
    code: z.string().regex(/^\d{6}$/, "Code à 6 chiffres requis."),
  })
  .strict();

/**
 * Étape 2 de connexion (2FA), après un mot de passe déjà vérifié — voir
 * `POST /auth/login/2fa`. `code` (TOTP) et `recoveryCode` sont mutuellement
 * exclusifs, exactement l'un des deux doit être fourni.
 */
export const twoFactorLoginSchema = z
  .object({
    pendingToken: z.string().min(1).max(200),
    code: z.string().regex(/^\d{6}$/).optional(),
    recoveryCode: z.string().trim().min(1).max(50).optional(),
  })
  .strict()
  .refine((v) => (v.code ? 1 : 0) + (v.recoveryCode ? 1 : 0) === 1, {
    message: "Fournis soit un code, soit un code de récupération.",
  });

/** Désactivation de la 2FA — mot de passe actuel requis, même raisonnement que `changePasswordSchema`. */
export const disableTotpSchema = z
  .object({
    password: z.string().min(1).max(200),
  })
  .strict();

/** Changement de l'identifiant (email) de connexion d'un compte élève. */
export const updateStudentEmailSchema = z
  .object({
    email: emailField,
  })
  .strict();

/** Réinitialisation via lien à jeton — même règle de longueur que partout ailleurs. */
export const consumeResetTokenSchema = z
  .object({
    newPassword: z.string().min(PASSWORD_MIN).max(200),
  })
  .strict();

/**
 * Filtres de lecture du journal de sécurité (`GET /api/auth/security-events`).
 * Pas de `.strict()` : une query string peut porter des paramètres
 * additionnels sans rapport (extensions navigateur, outils de debug) — on
 * ignore simplement ce qu'on ne connaît pas plutôt que de rejeter la requête.
 */
export const securityEventsQuerySchema = z.object({
  severity: z.enum(["info", "warning", "critical"]).optional(),
  eventType: z
    .enum([
      "login_success",
      "login_failed",
      "login_blocked",
      "account_locked",
      "logout",
      "password_changed",
      "password_change_failed",
      "access_denied",
      "staff_invited",
      "staff_revoked",
      "student_access_created",
      "student_access_revoked",
      "student_password_set_by_staff",
      "student_email_changed",
      "student_password_reset_link_created",
      "student_password_reset_completed",
    ])
    .optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});
