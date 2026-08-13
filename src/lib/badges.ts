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
 * aujourd'hui (% de risque engagé par trade, cumul en unité "R", score
 * d'examen — l'onglet Examen est un placeholder vide). Plutôt que d'inventer
 * une progression, ils sont marqués `trackable: false` et restent à 0%
 * jusqu'à ce que le suivi correspondant existe réellement.
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

    // Prop Firm Challenge Ready — 10% de profit virtuel sur le journal du
    // module Replay, sans jamais dépasser 10% de drawdown depuis le sommet.
    case "badge-3":
      return computePropFirmChallengeProgress();

    // badge-1 (% de risque par trade), badge-8 (cumul en "R"), badge-9
    // (score d'examen) : aucune donnée suivie aujourd'hui ne permet de les
    // calculer honnêtement.
    default:
      return null;
  }
}

/**
 * Clé localStorage du journal de Replay FX (`replay-fx/app.js`, `STORAGE_KEY`).
 * Réutilisée telle quelle plutôt que dupliquée, pour rester en phase si elle
 * change un jour côté Replay FX.
 */
const REPLAY_JOURNAL_KEY = "replayfx-journal-v1";

/**
 * Capital de départ par défaut de Replay FX (`#account-balance` dans
 * `replay-fx/app.js`, `calculateStats()`). Ce réglage vit uniquement dans le
 * DOM de Replay FX au moment du calcul de ses propres statistiques — jamais
 * persisté nulle part, y compris dans son propre `localStorage`. Impossible
 * de retrouver la valeur exacte qu'un élève a pu taper : on retombe sur ce
 * même défaut, cohérent avec ce que Replay FX utilise lui-même tant que
 * personne n'y touche.
 */
const REPLAY_BASE_BALANCE = 10000;

const PROP_FIRM_PROFIT_TARGET_PERCENT = 10;
const PROP_FIRM_MAX_DRAWDOWN_PERCENT = 10;

/**
 * Rejoue l'historique de trades de Replay FX (module « Replay », voir
 * `src/components/ReplayModule.tsx`) pour en dériver la progression du badge
 * « Prop Firm Challenge Ready ».
 *
 * Couplage assumé et fragile par construction : Replay FX est une appli
 * statique totalement indépendante (aucun import, aucun type partagé), sa
 * seule interface avec PropDesk est ce `localStorage` partagé (même origine).
 * Si son format de stockage change un jour, ce calcul se contentera de ne
 * plus rien trouver (voir le `try/catch` ci-dessous) plutôt que de planter —
 * mais il ne sera pas averti automatiquement du changement.
 *
 * Portée volontairement simple : tout le journal actuel de Replay FX, du
 * début jusqu'à son dernier trade. Recommencer une tentative se fait en
 * cliquant « Effacer le journal » dans Replay FX — aucune notion de
 * « tentative » séparée n'existe ni côté Replay FX ni ici.
 *
 * Jamais synchronisé serveur, comme `MindsetJournalModal` : ce badge ne
 * progresse donc que sur l'appareil/navigateur où Replay FX a été utilisé.
 */
function computePropFirmChallengeProgress(): {
  currentValue: number;
  targetValue: number;
  progressPercentage: number;
} | null {
  if (typeof localStorage === "undefined") return null;

  let rawTrades: unknown;
  try {
    const raw = localStorage.getItem(REPLAY_JOURNAL_KEY);
    rawTrades = raw ? JSON.parse(raw) : [];
  } catch {
    rawTrades = [];
  }

  if (!Array.isArray(rawTrades) || rawTrades.length === 0) {
    return { currentValue: 0, targetValue: PROP_FIRM_PROFIT_TARGET_PERCENT, progressPercentage: 0 };
  }

  // Replay FX empile ses trades du plus récent au plus ancien
  // (`state.trades.unshift(...)`) : on les rejoue en ordre chronologique,
  // exactement comme `calculateStats()` le fait dans `replay-fx/app.js`.
  const chronological = [...rawTrades].reverse();

  let balance = REPLAY_BASE_BALANCE;
  let peak = balance;
  let maxDrawdownPercent = 0;

  for (const trade of chronological) {
    const pnlCash =
      trade && typeof trade === "object" && typeof (trade as { pnlCash?: unknown }).pnlCash === "number"
        ? (trade as { pnlCash: number }).pnlCash
        : 0;
    balance += pnlCash;
    peak = Math.max(peak, balance);
    const drawdownPercent = peak > 0 ? ((peak - balance) / peak) * 100 : 0;
    maxDrawdownPercent = Math.max(maxDrawdownPercent, drawdownPercent);
  }

  const profitPercent = ((balance - REPLAY_BASE_BALANCE) / REPLAY_BASE_BALANCE) * 100;
  const currentValue = Number(Math.max(0, profitPercent).toFixed(1));
  const target = PROP_FIRM_PROFIT_TARGET_PERCENT;

  // La limite de drawdown n'est pas juste informative : si elle a été
  // dépassée à un moment quelconque du journal, la progression plafonne à
  // 99% même si le profit final atteint ou dépasse la cible — le badge ne se
  // débloque alors qu'en repartant d'un journal propre (« Effacer le
  // journal » dans Replay FX).
  const breachedDrawdown = maxDrawdownPercent > PROP_FIRM_MAX_DRAWDOWN_PERCENT;
  const rawPercentage = Math.round((currentValue / target) * 100);
  const progressPercentage = breachedDrawdown
    ? Math.min(99, rawPercentage)
    : Math.min(100, rawPercentage);

  return { currentValue, targetValue: target, progressPercentage };
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
