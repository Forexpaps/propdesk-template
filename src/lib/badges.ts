import { Trade, Module, TraderBadge } from "../types";

/**
 * Calcule la progression EN DIRECT de chaque badge depuis les données réelles
 * (trades, modules) — jamais depuis les valeurs figées de `mockData.ts`.
 *
 * Ne touche jamais `unlocked`/`unlockedAt` : ce sont des états explicitement
 * réclamés par l'utilisateur (`onClaimBadge`), persistés tels quels. Seule la
 * progression affichée (`currentValue`/`targetValue`/`progressPercentage`)
 * est recalculée à chaque appel.
 *
 * Certains badges reposent sur une donnée qu'on ne suit pas du tout
 * aujourd'hui (% de risque engagé par trade, résultats du simulateur
 * Prop Firm, cumul en unité "R", score d'examen — l'onglet Examen est un
 * placeholder vide). Plutôt que d'inventer une progression, ils sont marqués
 * `trackable: false` et restent à 0% jusqu'à ce que le suivi correspondant
 * existe réellement.
 */
export function computeBadgeProgress(badges: TraderBadge[], trades: Trade[], modules: Module[]): TraderBadge[] {
  return badges.map((badge) => {
    const computed = computeSingleBadgeProgress(badge.id, trades, modules);
    if (!computed) {
      return {
        ...badge,
        trackable: false,
        currentValue: 0,
        progressPercentage: 0,
      };
    }
    return { ...badge, trackable: true, ...computed };
  });
}

/**
 * Un élève reçoit une copie personnelle des badges à l'invitation, avec des
 * `id` remappés en `${userId}-badge-N` (clé primaire globale de la table,
 * voir `server/auth/routes.ts`) — jamais `badge-N` tel quel. On retrouve donc
 * le critère à appliquer par le SUFFIXE de l'id, pas par égalité stricte.
 */
const KNOWN_BADGE_IDS = [
  "badge-1", "badge-2", "badge-3", "badge-4", "badge-5",
  "badge-6", "badge-7", "badge-8", "badge-9",
];
function canonicalBadgeId(badgeId: string): string {
  return KNOWN_BADGE_IDS.find((id) => badgeId === id || badgeId.endsWith(`-${id}`)) ?? badgeId;
}

function computeSingleBadgeProgress(
  badgeId: string,
  trades: Trade[],
  modules: Module[]
): { currentValue: number; targetValue: number; progressPercentage: number } | null {
  switch (canonicalBadgeId(badgeId)) {
    // Diplômé SMC Horizon — 100% des leçons du programme complétées.
    case "badge-2": {
      const totalLessons = modules.reduce((acc, m) => acc + m.lessons.length, 0);
      const completedLessons = modules.reduce(
        (acc, m) => acc + m.lessons.filter((l) => l.isCompleted).length,
        0
      );
      return {
        currentValue: completedLessons,
        targetValue: totalLessons,
        progressPercentage: totalLessons > 0 ? Math.round((completedLessons / totalLessons) * 100) : 0,
      };
    }

    // Trader Discipliné (Zero FOMO) — 15 trades avec émotion Calme/Discipliné.
    case "badge-4": {
      const count = trades.filter((t) => t.emotion === "Calm" || t.emotion === "Disciplined").length;
      const target = 15;
      return {
        currentValue: count,
        targetValue: target,
        progressPercentage: Math.min(100, Math.round((count / target) * 100)),
      };
    }

    // Analyste Rigoureux — 5 trades avec une note technique substantielle.
    //
    // Approximation assumée : « note complète » n'est pas un critère
    // formalisable, on retient une longueur minimale (40 caractères) plutôt
    // qu'une simple présence, pour écarter les notes triviales ("ok", "-").
    case "badge-5": {
      const MIN_NOTE_LENGTH = 40;
      const count = trades.filter((t) => (t.notes ?? "").trim().length >= MIN_NOTE_LENGTH).length;
      const target = 5;
      return {
        currentValue: count,
        targetValue: target,
        progressPercentage: Math.min(100, Math.round((count / target) * 100)),
      };
    }

    // Série de Discipline 7 Jours — même calcul que la carte du tableau de
    // bord, voir `computeDisciplineStreak` ci-dessous.
    case "badge-6": {
      const streak = computeDisciplineStreak(trades);
      const target = 7;
      return {
        currentValue: streak,
        targetValue: target,
        progressPercentage: Math.min(100, Math.round((streak / target) * 100)),
      };
    }

    // Sniper R/R 1:3+ — un trade gagnant validé avec un ratio Risque/Gain ≥ 3.
    case "badge-7": {
      const best = trades
        .filter((t) => t.result === "WIN")
        .reduce((max, t) => Math.max(max, t.riskRewardRatio), 0);
      const target = 3.0;
      return {
        currentValue: Number(best.toFixed(1)),
        targetValue: target,
        progressPercentage: Math.min(100, Math.round((best / target) * 100)),
      };
    }

    // badge-1 (% de risque par trade), badge-3 (résultats simulateur),
    // badge-8 (cumul en "R"), badge-9 (score d'examen) : aucune donnée
    // suivie aujourd'hui ne permet de les calculer honnêtement.
    default:
      return null;
  }
}

/**
 * Nombre de jours de trading CONSÉCUTIFS (en partant du plus récent) où
 * chaque trade de la journée a une émotion maîtrisée (Calme/Discipliné) et
 * aucune erreur taguée.
 *
 * Compte des jours de trading, pas des jours calendaires : un jour sans
 * aucun trade ne casse ni ne prolonge la série, il est simplement ignoré.
 * C'est un choix assumé plutôt qu'une évidence — documenté ici pour ne pas
 * le redécouvrir en lisant seulement le code.
 */
export function computeDisciplineStreak(trades: Trade[]): number {
  if (trades.length === 0) return 0;

  const byDay = new Map<string, Trade[]>();
  trades.forEach((t) => {
    if (!byDay.has(t.date)) byDay.set(t.date, []);
    byDay.get(t.date)!.push(t);
  });

  const daysDesc = [...byDay.keys()].sort().reverse();

  let streak = 0;
  for (const day of daysDesc) {
    const dayTrades = byDay.get(day)!;
    const disciplined = dayTrades.every(
      (t) => (t.emotion === "Disciplined" || t.emotion === "Calm") && (t.mistakes ?? []).length === 0
    );
    if (!disciplined) break;
    streak += 1;
  }

  return streak;
}
