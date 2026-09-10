import { Trade, TradeMistake } from "../types";
<<<<<<< HEAD
=======
import { startOfWeek } from "./performanceStats";
>>>>>>> origin/main

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/** Formulation française du point faible, pour chaque tag `TradeMistake`. */
const MISTAKE_PHRASES: Record<TradeMistake, string> = {
  "Entrée anticipée": "la patience sur les entrées (setups pris trop tôt)",
  "Sortie prématurée": "la patience sur les sorties (clôtures trop rapides)",
  "SL trop serré": "la marge laissée à ton Stop Loss (trop serré)",
  "SL déplacé/retiré": "la discipline sur ton Stop Loss (déplacé ou retiré en cours de trade)",
  "Sur-risque (>1%)": "la gestion du risque (positions au-delà de 1%)",
  "Revenge trading": "le revenge trading après une perte",
  "FOMO / Chasing": "le FOMO (entrées après un mouvement déjà lancé)",
  "Pas de plan de trade": "le respect d'un plan de trade défini à l'avance",
<<<<<<< HEAD
  "Sur-trading": "la fréquence de prise de position (sur-trading)",
=======
  "Over-trading": "la fréquence de prise de position (over-trading)",
>>>>>>> origin/main
};

const SESSIONS_TARGET = 5;

function parseDate(isoDate: string): Date {
  return new Date(`${isoDate}T00:00:00`);
}

function mostFrequentMistake(trades: Trade[]): TradeMistake | null {
  const counts = new Map<TradeMistake, number>();
  trades.forEach((t) => {
    (t.mistakes ?? []).forEach((m) => {
      counts.set(m, (counts.get(m) ?? 0) + 1);
    });
  });

  let best: TradeMistake | null = null;
  let bestCount = 0;
  counts.forEach((count, mistake) => {
    if (count > bestCount) {
      best = mistake;
      bestCount = count;
    }
  });
  return best;
}

/**
 * Phrase d'accueil du tableau de bord ("Semaine N · X sessions travaillées
 * sur 5. Ton point faible du moment : ...") — recalculée à chaque appel
 * depuis les vrais trades de l'élève, jamais stockée.
 *
<<<<<<< HEAD
 * "Semaine 1" part de la date du tout premier trade jamais journalisé, pas
 * d'une valeur arbitraire : le suivi hebdomadaire démarre quand l'élève
 * démarre réellement, pas avant.
=======
 * "Semaine 1" est la semaine CALENDAIRE du tout premier trade journalisé : le
 * suivi démarre quand l'élève démarre réellement, mais les semaines suivantes
 * se comptent de lundi à dimanche.
 *
 * Cette fenêtre était auparavant ancrée sur la DATE du premier trade, donc
 * décalée de N jours : « Semaine 12 » et « la semaine dernière » de la
 * comparaison de périodes désignaient deux fenêtres différentes, côte à côte
 * sur le même écran. Changement visible et volontaire — voir `startOfWeek`,
 * seule définition de semaine de l'application.
>>>>>>> origin/main
 */
export function computeWeeklySummary(trades: Trade[]): string {
  if (trades.length === 0) {
    return "Ajoute ton premier trade pour lancer le suivi hebdomadaire.";
  }

  const firstTradeDate = trades.reduce(
    (earliest, t) => (t.date < earliest ? t.date : earliest),
    trades[0].date
  );
<<<<<<< HEAD
  const firstDate = parseDate(firstTradeDate);
  const today = new Date(new Date().toDateString());

  const daysSinceFirst = Math.max(0, Math.floor((today.getTime() - firstDate.getTime()) / MS_PER_DAY));
  const weekNumber = Math.floor(daysSinceFirst / 7) + 1;

  const weekStart = new Date(firstDate.getTime() + (weekNumber - 1) * 7 * MS_PER_DAY);
  const weekEnd = new Date(weekStart.getTime() + 6 * MS_PER_DAY);

  const tradesThisWeek = trades.filter((t) => {
    const d = parseDate(t.date);
    return d >= weekStart && d <= weekEnd;
=======
  const premiereSemaine = startOfWeek(parseDate(firstTradeDate));
  const semaineCourante = startOfWeek(new Date());

  // Division sur des lundis à minuit : le nombre de jours qui les sépare est
  // toujours un multiple de 7 en temps civil, mais pas en millisecondes (un
  // changement d'heure en retire ou en ajoute 3 600 000). D'où l'arrondi.
  const semainesEcoulees = Math.max(
    0,
    Math.round((semaineCourante.getTime() - premiereSemaine.getTime()) / (7 * MS_PER_DAY))
  );
  const weekNumber = semainesEcoulees + 1;

  const weekEnd = new Date(
    semaineCourante.getFullYear(),
    semaineCourante.getMonth(),
    semaineCourante.getDate() + 7
  );

  const tradesThisWeek = trades.filter((t) => {
    const d = parseDate(t.date);
    return d >= semaineCourante && d < weekEnd;
>>>>>>> origin/main
  });

  const sessionsThisWeek = new Set(tradesThisWeek.map((t) => t.date)).size;

  const weakness = mostFrequentMistake(tradesThisWeek) ?? mostFrequentMistake(trades);

  const sessionLabel = sessionsThisWeek === 1 ? "session travaillée" : "sessions travaillées";
  const base = `Semaine ${weekNumber} · ${sessionsThisWeek} ${sessionLabel} sur ${SESSIONS_TARGET}.`;

<<<<<<< HEAD
  if (!weakness) {
    return `${base} Aucun point faible identifié pour l'instant.`;
  }

  return `${base} Ton point faible du moment : ${MISTAKE_PHRASES[weakness]}.`;
=======
  // Un tag absent du catalogue (trade restauré d'une sauvegarde éditée à la
  // main, ou écrit par une version antérieure) n'a pas de formulation : la
  // phrase retombe sur « aucun point faible » plutôt que d'afficher
  // « Ton point faible du moment : undefined. » à l'utilisateur.
  const phrase = weakness ? MISTAKE_PHRASES[weakness] : undefined;
  if (!phrase) {
    return `${base} Aucun point faible identifié pour l'instant.`;
  }

  return `${base} Ton point faible du moment : ${phrase}.`;
>>>>>>> origin/main
}
