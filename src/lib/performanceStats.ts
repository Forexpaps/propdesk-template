import { Trade, StudentProfile, EmotionState } from "../types";

/**
 * Calculs purs de Rentabilité et du résumé Journal, extraits de
 * `PerformanceDashboard.tsx` et `TradingJournal.tsx` pour être partagés avec
 * l'export PDF (`src/lib/pdfReport.ts`) — une seule implémentation, jamais
 * deux qui risquent de diverger silencieusement (déjà arrivé une fois cette
 * session avec un bug de courbe d'équité dupliquée entre deux fichiers).
 */

/**
 * Les 6 états émotionnels saisissables dans le Journal de trading (chips
 * `EmotionState`) — même ordre, mêmes libellés français (sans l'emoji).
 * Sert à préremplir le graphique « Impact Psychologique » avec toutes les
 * émotions possibles, pas seulement celles déjà taguées sur un trade.
 */
const ALL_EMOTIONS: { id: EmotionState; label: string }[] = [
  { id: "Disciplined", label: "Discipliné" },
  { id: "FOMO", label: "FOMO" },
  { id: "Impulsive", label: "Impulsif" },
  { id: "Anxious", label: "Anxieux" },
  { id: "Calm", label: "Calme" },
  { id: "Greedy", label: "Avarice" },
];

interface CategoryStats {
  wins: number;
  total: number;
  pnl: number;
}

export interface PerformanceStats {
  equityData: { date: string; capital: number; pnl: number }[];
  strategyChartData: { strategy: string; winRate: number; pnl: number; tradesCount: number }[];
  emotionChartData: { emotion: string; winRate: number; pnl: number; tradesCount: number }[];
  totalTrades: number;
  wins: number;
  winRate: number;
  totalPnL: number;
  disciplineScore: number;
  capitalDiff: number;
  capitalDiffPercent: number;
  isCapitalUp: boolean;
  pairChartData: { pair: string; pnl: number; tradesCount: number }[];
  directionChartData: { direction: string; pnl: number; tradesCount: number }[];
  dayChartData: { day: string; pnl: number; tradesCount: number }[];
  sessionChartData: { session: string; pnl: number; tradesCount: number }[];
  tradesSansHeure: number;
  mistakeChartData: { mistake: string; count: number; cost: number }[];
  totalErrorsCost: number;
  netResultWithoutErrors: number;
}

export function computePerformanceStats(student: StudentProfile, trades: Trade[]): PerformanceStats {
  // 1. Courbe d'équité
  const sortedTrades = [...trades].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
  );

  let runningCapital = student.startingCapital;
  const equityData = [
    { date: "Début (15 Jan)", capital: student.startingCapital, pnl: 0 },
    ...sortedTrades.map((t, idx) => {
      // Un trade en % n'est pas une somme d'argent : il reste dans la courbe
      // temporelle mais n'ajoute rien au capital cumulé.
      if ((t.pnlUnit ?? "USD") !== "PERCENT") runningCapital += t.pnl;
      return {
        date: `Trade #${idx + 1} (${t.pair})`,
        capital: runningCapital,
        pnl: t.pnl,
      };
    }),
  ];

  // Trades en $ uniquement : seuls ceux-ci entrent dans les totaux monétaires.
  const tradesEnDollars = trades.filter((t) => (t.pnlUnit ?? "USD") !== "PERCENT");

  // 2. Performance par Stratégie
  const strategyStats: Record<string, CategoryStats> = {};
  trades.forEach((t) => {
    if (!strategyStats[t.strategy]) {
      strategyStats[t.strategy] = { wins: 0, total: 0, pnl: 0 };
    }
    strategyStats[t.strategy].total += 1;
    if (t.result === "WIN") strategyStats[t.strategy].wins += 1;
    if ((t.pnlUnit ?? "USD") !== "PERCENT") strategyStats[t.strategy].pnl += t.pnl;
  });

  const strategyChartData = Object.keys(strategyStats).map((strat) => ({
    strategy: strat,
    winRate: Math.round((strategyStats[strat].wins / strategyStats[strat].total) * 100),
    pnl: strategyStats[strat].pnl,
    tradesCount: strategyStats[strat].total,
  }));

  // 3. Performance par Émotion
  //
  // Préremplit les 6 émotions saisissables dans le Journal (`ALL_EMOTIONS`),
  // même celles jamais taguées — sinon un élève qui n'a par exemple jamais
  // trade "Anxieux" ne verrait jamais cette barre, alors que c'est justement
  // l'information utile (« je n'ai jamais (encore) tradé anxieux »).
  const emotionStats: Record<EmotionState, CategoryStats> = {
    Disciplined: { wins: 0, total: 0, pnl: 0 },
    FOMO: { wins: 0, total: 0, pnl: 0 },
    Impulsive: { wins: 0, total: 0, pnl: 0 },
    Anxious: { wins: 0, total: 0, pnl: 0 },
    Calm: { wins: 0, total: 0, pnl: 0 },
    Greedy: { wins: 0, total: 0, pnl: 0 },
  };
  trades.forEach((t) => {
    emotionStats[t.emotion].total += 1;
    if (t.result === "WIN") emotionStats[t.emotion].wins += 1;
    if ((t.pnlUnit ?? "USD") !== "PERCENT") emotionStats[t.emotion].pnl += t.pnl;
  });

  const emotionChartData = ALL_EMOTIONS.map(({ id, label }) => ({
    emotion: label,
    winRate:
      emotionStats[id].total > 0
        ? Math.round((emotionStats[id].wins / emotionStats[id].total) * 100)
        : 0,
    pnl: emotionStats[id].pnl,
    tradesCount: emotionStats[id].total,
  }));

  // Métriques générales
  const totalTrades = trades.length;
  const wins = trades.filter((t) => t.result === "WIN").length;
  const winRate = totalTrades > 0 ? Math.round((wins / totalTrades) * 100) : 0;
  const totalPnL = tradesEnDollars.reduce((acc, t) => acc + t.pnl, 0);

  const disciplinedCount = trades.filter(
    (t) => t.emotion === "Disciplined" || t.emotion === "Calm"
  ).length;
  const disciplineScore = totalTrades > 0 ? Math.round((disciplinedCount / totalTrades) * 100) : 100;

  const capitalDiff = student.currentCapital - student.startingCapital;
  const capitalDiffPercent =
    student.startingCapital > 0 ? (capitalDiff / student.startingCapital) * 100 : 0;
  const isCapitalUp = capitalDiff >= 0;

  // 4. Performance par Actif (paire)
  const pairStats: Record<string, CategoryStats> = {};
  trades.forEach((t) => {
    if (!pairStats[t.pair]) pairStats[t.pair] = { wins: 0, total: 0, pnl: 0 };
    pairStats[t.pair].total += 1;
    if (t.result === "WIN") pairStats[t.pair].wins += 1;
    if ((t.pnlUnit ?? "USD") !== "PERCENT") pairStats[t.pair].pnl += t.pnl;
  });
  const pairChartData = Object.keys(pairStats)
    .map((pair) => ({ pair, pnl: pairStats[pair].pnl, tradesCount: pairStats[pair].total }))
    .sort((a, b) => b.tradesCount - a.tradesCount)
    .slice(0, 8);

  // 5. Performance par Direction (Long / Short)
  const directionStats: Record<string, CategoryStats> = {};
  trades.forEach((t) => {
    if (!directionStats[t.direction]) directionStats[t.direction] = { wins: 0, total: 0, pnl: 0 };
    directionStats[t.direction].total += 1;
    if (t.result === "WIN") directionStats[t.direction].wins += 1;
    if ((t.pnlUnit ?? "USD") !== "PERCENT") directionStats[t.direction].pnl += t.pnl;
  });
  const directionChartData = (["LONG", "SHORT"] as const)
    .filter((d) => directionStats[d])
    .map((d) => ({
      direction: d === "LONG" ? "Long" : "Short",
      pnl: directionStats[d].pnl,
      tradesCount: directionStats[d].total,
    }));

  // 6. Performance par Jour de la Semaine
  // `date` (YYYY-MM-DD) parsé en composants locaux plutôt qu'en ISO, pour
  // éviter tout décalage de jour dû au fuseau horaire du navigateur.
  const DAY_LABELS = ["Dimanche", "Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi"];
  const DAY_ORDER = ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi", "Dimanche"];
  const getDayLabel = (dateStr: string): string => {
    const [y, m, d] = dateStr.split("-").map(Number);
    return DAY_LABELS[new Date(y, (m ?? 1) - 1, d ?? 1).getDay()];
  };
  const dayStats: Record<string, CategoryStats> = {};
  trades.forEach((t) => {
    const day = getDayLabel(t.date);
    if (!dayStats[day]) dayStats[day] = { wins: 0, total: 0, pnl: 0 };
    dayStats[day].total += 1;
    if (t.result === "WIN") dayStats[day].wins += 1;
    if ((t.pnlUnit ?? "USD") !== "PERCENT") dayStats[day].pnl += t.pnl;
  });
  const dayChartData = DAY_ORDER.filter((d) => dayStats[d]).map((d) => ({
    day: d.slice(0, 3),
    pnl: dayStats[d].pnl,
    tradesCount: dayStats[d].total,
  }));

  // 7. Performance par Session de Marché
  //
  // Approximation assumée : `Trade.time` est une chaîne "HH:MM" libre, sans
  // fuseau horaire garanti — l'heure saisie est utilisée telle quelle.
  // Découpage sans chevauchement (contrairement à la pastille live de
  // TopHeader.tsx, qui peut cumuler plusieurs sessions actives) pour ne
  // compter chaque trade qu'une seule fois dans ces statistiques.
  const getSessionLabel = (time?: string): string | null => {
    if (!time) return null;
    const hour = parseInt(time.split(":")[0], 10);
    if (Number.isNaN(hour)) return null;
    if (hour >= 21) return "Sydney";
    if (hour < 7) return "Tokyo";
    if (hour < 12) return "Londres";
    if (hour < 16) return "Londres/NY";
    return "New York";
  };
  const SESSION_ORDER = ["Sydney", "Tokyo", "Londres", "Londres/NY", "New York"];
  const sessionStats: Record<string, CategoryStats> = {};
  let tradesSansHeure = 0;
  trades.forEach((t) => {
    const session = getSessionLabel(t.time);
    if (!session) {
      tradesSansHeure += 1;
      return;
    }
    if (!sessionStats[session]) sessionStats[session] = { wins: 0, total: 0, pnl: 0 };
    sessionStats[session].total += 1;
    if (t.result === "WIN") sessionStats[session].wins += 1;
    if ((t.pnlUnit ?? "USD") !== "PERCENT") sessionStats[session].pnl += t.pnl;
  });
  const sessionChartData = SESSION_ORDER.filter((s) => sessionStats[s]).map((s) => ({
    session: s,
    pnl: sessionStats[s].pnl,
    tradesCount: sessionStats[s].total,
  }));

  // 8. Erreurs les plus fréquentes & leur coût total
  //
  // Un trade taggé de plusieurs erreurs compte dans chacune : les coûts par
  // catégorie ne s'excluent donc pas mutuellement, exactement comme leur
  // somme (`totalErrorsCost`) peut recompter un même trade plusieurs fois.
  const mistakeStats: Record<string, { count: number; cost: number }> = {};
  tradesEnDollars.forEach((t) => {
    (t.mistakes ?? []).forEach((m) => {
      if (!mistakeStats[m]) mistakeStats[m] = { count: 0, cost: 0 };
      mistakeStats[m].count += 1;
      mistakeStats[m].cost += t.pnl;
    });
  });
  const mistakeChartData = Object.entries(mistakeStats)
    .map(([mistake, s]) => ({ mistake, count: s.count, cost: s.cost }))
    .sort((a, b) => b.count - a.count);
  const totalErrorsCost = mistakeChartData.reduce((acc, m) => acc + m.cost, 0);
  const netResultWithoutErrors = totalPnL - totalErrorsCost;

  return {
    equityData,
    strategyChartData,
    emotionChartData,
    totalTrades,
    wins,
    winRate,
    totalPnL,
    disciplineScore,
    capitalDiff,
    capitalDiffPercent,
    isCapitalUp,
    pairChartData,
    directionChartData,
    dayChartData,
    sessionChartData,
    tradesSansHeure,
    mistakeChartData,
    totalErrorsCost,
    netResultWithoutErrors,
  };
}

export interface JournalSummary {
  totalTrades: number;
  winTrades: number;
  lossTrades: number;
  winRate: number;
  totalPnL: number;
  profitFactor: string;
  avgRR: string;
  disciplineEmoPercent: number;
}

/** Les 5 cartes de stats du Journal (`TradingJournal.tsx`). */
export function computeJournalSummary(trades: Trade[]): JournalSummary {
  const totalTrades = trades.length;
  const winTrades = trades.filter((t) => t.result === "WIN").length;
  const lossTrades = trades.filter((t) => t.result === "LOSS").length;
  const winRate = totalTrades > 0 ? Math.round((winTrades / totalTrades) * 100) : 0;

  const tradesEnDollars = trades.filter((t) => (t.pnlUnit ?? "USD") !== "PERCENT");
  const totalPnL = tradesEnDollars.reduce((acc, t) => acc + t.pnl, 0);
  const totalGains = tradesEnDollars.filter((t) => t.pnl > 0).reduce((acc, t) => acc + t.pnl, 0);
  const totalLosses = Math.abs(tradesEnDollars.filter((t) => t.pnl < 0).reduce((acc, t) => acc + t.pnl, 0));
  const profitFactor = totalLosses > 0 ? (totalGains / totalLosses).toFixed(2) : "N/A";

  const avgRR =
    totalTrades > 0
      ? (trades.reduce((acc, t) => acc + t.riskRewardRatio, 0) / totalTrades).toFixed(1)
      : "0";

  const disciplineEmoPercent =
    totalTrades > 0
      ? Math.round(
          (trades.filter((t) => t.emotion === "Disciplined" || t.emotion === "Calm").length / totalTrades) * 100
        )
      : 100;

  return { totalTrades, winTrades, lossTrades, winRate, totalPnL, profitFactor, avgRR, disciplineEmoPercent };
}
