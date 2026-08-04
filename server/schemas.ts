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

/** Tout élément de collection doit porter un id non vide et unique. */
const collectionItem = z
  .object({ id: z.string().min(1).max(200) })
  .passthrough();

export const collectionPayloadSchema = z
  .array(collectionItem)
  .max(5000)
  .refine(
    (items) => new Set(items.map((i) => i.id)).size === items.length,
    { message: "Identifiants dupliqués dans la collection." }
  );

export const profileSchema = z
  .object({
    name: z.string().min(1).max(200),
    email: z.string().max(320),
    startingCapital: z.number().finite(),
    currentCapital: z.number().finite(),
  })
  .passthrough();

export const quizResultsSchema = z.record(z.string().min(1), z.unknown());

export const importStateSchema = z.object({
  student: profileSchema.optional(),
  collections: z.record(z.string(), collectionPayloadSchema).optional(),
  quizResults: quizResultsSchema.optional(),
});

/** Corps accepté par la route d'audit IA du coach. */
export const coachReviewSchema = z
  .object({
    trade: z.object({}).passthrough().optional(),
    question: z.string().min(1).max(4000).optional(),
  })
  .refine((body) => body.trade !== undefined || body.question !== undefined, {
    message: "Fournir un trade à auditer ou une question.",
  });
