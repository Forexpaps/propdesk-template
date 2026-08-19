import { CoachingSessionNote } from "../types";

/**
 * Note globale d'une session de coaching, sur 10 : moyenne de Discipline,
 * Exécution du plan, Performance et de la difficulté perçue inversée
 * (10 − difficulté) — une session perçue comme facile ET bien exécutée
 * obtient le meilleur score, une session difficile ne pénalise pas si le
 * reste est bon. Arrondie à une décimale pour l'affichage ("7.8/10").
 */
export function computeSessionGlobalNote(session: CoachingSessionNote): number {
  const raw =
    (session.discipline + session.planExecution + session.performance + (10 - session.perceivedDifficulty)) / 4;
  return Math.round(raw * 10) / 10;
}
