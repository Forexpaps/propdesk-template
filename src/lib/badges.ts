import { Trade, TraderBadge } from "../types";

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
 * aujourd'hui (% de risque engagé par trade, cumul en unité "R", score
 * d'examen — le module Examen a été retiré de l'app). Plutôt que d'inventer
 * une progression, ils sont marqués `trackable: false` et restent à 0%
 * jusqu'à ce que le suivi correspondant existe réellement.
 */
export function computeBadgeProgress(badges: TraderBadge[], trades: Trade[]): TraderBadge[] {
  return badges.map((badge) => {
    const computed = computeSingleBadgeProgress(badge.id, trades);
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
/** Seuil de risque des badges « Maître du Risk 1% », en pourcentage du capital. */
const MAX_RISK_PERCENT = 1;

const KNOWN_BADGE_IDS = [
  "badge-1", "badge-3", "badge-4", "badge-5",
  "badge-6", "badge-7", "badge-8",
  "badge-10", "badge-11", "badge-12", "badge-13", "badge-14",
  "badge-15", "badge-16", "badge-17",
  "badge-18", "badge-19", "badge-20",
  "badge-21", "badge-22", "badge-23",
  "badge-24", "badge-25", "badge-26",
];
function canonicalBadgeId(badgeId: string): string {
  return KNOWN_BADGE_IDS.find((id) => badgeId === id || badgeId.endsWith(`-${id}`)) ?? badgeId;
}

/** Voir badge-5 « Analyste Rigoureux » et ses paliers (badge-24 à badge-26). */
const MIN_ANALYST_NOTE_LENGTH = 40;

function computeSingleBadgeProgress(
  badgeId: string,
  trades: Trade[]
): { currentValue: number; targetValue: number; progressPercentage: number } | null {
  switch (canonicalBadgeId(badgeId)) {
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
      const count = trades.filter((t) => (t.notes ?? "").trim().length >= MIN_ANALYST_NOTE_LENGTH).length;
      const target = 5;
      return {
        currentValue: count,
        targetValue: target,
        progressPercentage: Math.min(100, Math.round((count / target) * 100)),
      };
    }

    // Paliers de badge-5 — même critère, cibles plus hautes.
    case "badge-24":
    case "badge-25":
    case "badge-26": {
      const targetByBadge: Record<string, number> = {
        "badge-24": 30,
        "badge-25": 50,
        "badge-26": 100,
      };
      const target = targetByBadge[canonicalBadgeId(badgeId)];
      const count = trades.filter((t) => (t.notes ?? "").trim().length >= MIN_ANALYST_NOTE_LENGTH).length;
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

    // Séries de Discipline longues — même calcul que badge-6, cibles plus
    // longues (jours de trading consécutifs, pas des jours calendaires, voir
    // `computeDisciplineStreak`).
    case "badge-10":
    case "badge-11":
    case "badge-12":
    case "badge-13":
    case "badge-14": {
      const targetByBadge: Record<string, number> = {
        "badge-10": 14,
        "badge-11": 30,
        "badge-12": 90,
        "badge-13": 180,
        "badge-14": 365,
      };
      const target = targetByBadge[canonicalBadgeId(badgeId)];
      const streak = computeDisciplineStreak(trades);
      return {
        currentValue: streak,
        targetValue: target,
        progressPercentage: Math.min(100, Math.round((streak / target) * 100)),
      };
    }

    // Paliers de volume — nombre total de trades journalisés, tous
    // confondus (contrairement à badge-4, qui ne compte que les trades
    // marqués d'une émotion maîtrisée).
    case "badge-15":
    case "badge-16":
    case "badge-17": {
      const targetByBadge: Record<string, number> = {
        "badge-15": 30,
        "badge-16": 50,
        "badge-17": 100,
      };
      const target = targetByBadge[canonicalBadgeId(badgeId)];
      const count = trades.length;
      return {
        currentValue: count,
        targetValue: target,
        progressPercentage: Math.min(100, Math.round((count / target) * 100)),
      };
    }

    // Paliers de badge-4 « Trader Discipliné (Zero FOMO) » — même critère
    // (émotion 'Calm'/'Disciplined'), cibles plus hautes que 15 trades.
    case "badge-18":
    case "badge-19":
    case "badge-20": {
      const targetByBadge: Record<string, number> = {
        "badge-18": 30,
        "badge-19": 50,
        "badge-20": 100,
      };
      const target = targetByBadge[canonicalBadgeId(badgeId)];
      const count = trades.filter((t) => t.emotion === "Calm" || t.emotion === "Disciplined").length;
      return {
        currentValue: count,
        targetValue: target,
        progressPercentage: Math.min(100, Math.round((count / target) * 100)),
      };
    }

    // Maître du Risk 1% et ses paliers — trades CONSÉCUTIFS dont le risque
    // engagé est ≤ 1 %.
    //
    // Seuls les trades qui RENSEIGNENT `riskPercent` comptent : un trade qui
    // l'omet ne prouve rien (il n'atteste ni un risque maîtrisé, ni un
    // dépassement) et casse la série, plutôt que d'être compté comme conforme.
    // C'est le même refus d'inventer une donnée que partout ailleurs ici — et
    // la raison pour laquelle ces badges sont restés `trackable: false` tant
    // que le champ n'existait pas.
    case "badge-1":
    case "badge-21":
    case "badge-22":
    case "badge-23": {
      const targetByBadge: Record<string, number> = {
        "badge-1": 15,
        "badge-21": 30,
        "badge-22": 50,
        "badge-23": 100,
      };
      const target = targetByBadge[canonicalBadgeId(badgeId)];
      const serie = computeRiskDisciplineStreak(trades);
      return {
        currentValue: serie,
        targetValue: target,
        progressPercentage: Math.min(100, Math.round((serie / target) * 100)),
      };
    }

    // badge-8 (cumul en "R") reste hors de portée : le R d'un trade vaut son
    // PnL divisé par le montant réellement risqué, en devise. `riskPercent`
    // donne le pourcentage, pas le montant — le reconstituer demanderait le
    // capital du compte au moment du trade, que rien ne conserve. Le déduire
    // des seuls prix (sortie/entrée/stop) supposerait une sortie unique de
    // toute la position, ce qui serait faux dès la première sortie partielle.
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
/**
 * Nombre de trades CONSÉCUTIFS (en partant du plus récent) dont le risque
 * engagé est renseigné et inférieur ou égal à 1 % du capital.
 *
 * Un trade sans `riskPercent` rompt la série au lieu d'être ignoré : la série
 * doit attester d'une discipline observée, et sauter les trades non renseignés
 * fabriquerait une série qui n'a jamais existé — un journal où le champ n'est
 * jamais rempli afficherait alors une série parfaite.
 *
 * Contrairement à `computeDisciplineStreak`, on raisonne trade par trade et
 * non jour par jour : le critère porte sur chaque position prise, pas sur une
 * journée.
 */
export function computeRiskDisciplineStreak(trades: Trade[]): number {
  // Trié ici, jamais supposé trié. Cette fonction se fiait à l'ordre du
  // tableau (« App.tsx insère en tête »), ce qui n'est vrai que pour une
  // saisie manuelle : un import CSV empile dans l'ordre du fichier, une
  // édition de date laisse le trade à sa place, et un rechargement rend
  // l'ordre de la base (`position`). Dans ces cas la série se calculait à
  // partir d'un trade qui n'était pas le plus récent. `computeDisciplineStreak`
  // juste en dessous triait déjà ses jours : les deux séries suivent
  // désormais la même règle.
  //
  // Départage à date égale par l'heure quand elle est connue ; à défaut,
  // l'ordre d'origine est conservé (tri stable) — inventer un ordre
  // intra-journalier serait pire que garder celui de la saisie.
  const parDateDesc = trades
    .map((t, index) => ({ t, index }))
    .sort((a, b) => {
      if (a.t.date !== b.t.date) return a.t.date < b.t.date ? 1 : -1;
      const heureA = a.t.time ?? "";
      const heureB = b.t.time ?? "";
      if (heureA !== heureB) return heureA < heureB ? 1 : -1;
      return a.index - b.index;
    })
    .map((e) => e.t);

  let serie = 0;
  for (const t of parDateDesc) {
    if (typeof t.riskPercent !== "number" || t.riskPercent > MAX_RISK_PERCENT) break;
    serie += 1;
  }
  return serie;
}

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
