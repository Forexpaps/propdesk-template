import { Trade, StudentProfile, EmotionState } from "../types";

/**
 * Calculs purs de Rentabilité et du résumé Journal, extraits de
 * `PerformanceDashboard.tsx` et `TradingJournal.tsx` — une seule
 * implémentation partagée, jamais deux qui risquent de diverger
 * silencieusement (déjà arrivé une fois cette session avec un bug de courbe
 * d'équité dupliquée entre deux fichiers).
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
  profitFactor: string;
  avgRR: string;
  /** Plus forte baisse depuis un sommet de la courbe d'équité, en % (0 si jamais en baisse). */
  drawdownMaxPercent: number;
  /** PnL net moyen par trade (tous résultats confondus) — 0 sans trade. */
  expectancyPerTrade: number;
  /** Moyenne des trades gagnants / perdants (en $, 0 s'il n'y en a aucun). */
  avgWin: number;
  avgLoss: number;
  monthlyChartData: { month: string; pnl: number; tradesCount: number }[];
  hourChartData: { hour: string; pnl: number; tradesCount: number }[];
  marketChartData: { market: string; pnl: number; tradesCount: number }[];
  /** Détail par actif (tableau) — trié par PnL total décroissant. */
  assetDetailData: { asset: string; tradesCount: number; winRate: number; pnl: number }[];
  /** Plus longue série de trades gagnants/perdants consécutifs (WIN/LOSS uniquement, BREAKEVEN/OPEN ignorés — ne rompent ni ne prolongent la série). */
  bestWinStreak: number;
  worstLossStreak: number;
}

export function computePerformanceStats(student: StudentProfile, trades: Trade[]): PerformanceStats {
  // 1. Courbe d'équité
  const sortedTrades = [...trades].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
  );

  let runningCapital = student.startingCapital;
  const equityData = [
    { date: `Début (${student.joinedDate})`, capital: student.startingCapital, pnl: 0 },
    ...sortedTrades.map((t) => {
      // Un trade en % n'est pas une somme d'argent : il reste dans la courbe
      // temporelle mais n'ajoute rien au capital cumulé.
      if ((t.pnlUnit ?? "USD") !== "PERCENT") runningCapital += t.pnl;
      return {
        date: t.date,
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

  // 9. Profit factor & R/R moyen — même calcul que le résumé du Journal
  // (computeJournalSummary ci-dessous), jamais dupliqué.
  const { profitFactor, avgRR } = computeJournalSummary(trades);

  // 10. Drawdown max — plus forte baisse depuis un sommet, rejouée sur la
  // même courbe que `equityData` (capital de départ, puis chaque trade en $
  // dans l'ordre chronologique).
  let peakCapital = student.startingCapital;
  let drawdownMaxPercent = 0;
  equityData.forEach((point) => {
    peakCapital = Math.max(peakCapital, point.capital);
    if (peakCapital > 0) {
      const drawdown = ((peakCapital - point.capital) / peakCapital) * 100;
      drawdownMaxPercent = Math.max(drawdownMaxPercent, drawdown);
    }
  });

  // 11. Espérance par trade & gains/pertes moyens — trades en $ uniquement,
  // un trade en % n'étant pas une somme d'argent comparable.
  const expectancyPerTrade = totalTrades > 0 ? totalPnL / totalTrades : 0;
  const winningTrades = tradesEnDollars.filter((t) => t.pnl > 0);
  const losingTrades = tradesEnDollars.filter((t) => t.pnl < 0);
  const avgWin = winningTrades.length > 0 ? winningTrades.reduce((a, t) => a + t.pnl, 0) / winningTrades.length : 0;
  const avgLoss = losingTrades.length > 0 ? losingTrades.reduce((a, t) => a + t.pnl, 0) / losingTrades.length : 0;

  // 12. Performance mensuelle — cumul du PnL par mois calendaire, dans
  // l'ordre chronologique d'apparition (pas un calendrier plein préformaté :
  // un mois sans aucun trade n'a rien à montrer).
  const MONTH_LABELS = [
    "Jan", "Fév", "Mar", "Avr", "Mai", "Juin",
    "Juil", "Août", "Sep", "Oct", "Nov", "Déc",
  ];
  const monthlyStats = new Map<string, { pnl: number; count: number; order: number }>();
  tradesEnDollars.forEach((t) => {
    const [y, m] = t.date.split("-").map(Number);
    const key = `${y}-${String(m).padStart(2, "0")}`;
    if (!monthlyStats.has(key)) {
      monthlyStats.set(key, { pnl: 0, count: 0, order: y * 12 + (m ?? 1) });
    }
    const entry = monthlyStats.get(key)!;
    entry.pnl += t.pnl;
    entry.count += 1;
  });
  const monthlyChartData = [...monthlyStats.entries()]
    .sort((a, b) => a[1].order - b[1].order)
    .map(([key, s]) => {
      const monthIndex = Number(key.split("-")[1]) - 1;
      return { month: MONTH_LABELS[monthIndex] ?? key, pnl: s.pnl, tradesCount: s.count };
    });

  // 13. Répartition par heure d'entrée — même donnée libre "HH:MM" que la
  // répartition par session, regroupée cette fois heure par heure plutôt que
  // par plage de session.
  const hourStats: Record<string, CategoryStats> = {};
  tradesEnDollars.forEach((t) => {
    if (!t.time) return;
    const hour = parseInt(t.time.split(":")[0], 10);
    if (Number.isNaN(hour)) return;
    const key = `${String(hour).padStart(2, "0")}h`;
    if (!hourStats[key]) hourStats[key] = { wins: 0, total: 0, pnl: 0 };
    hourStats[key].total += 1;
    if (t.result === "WIN") hourStats[key].wins += 1;
    hourStats[key].pnl += t.pnl;
  });
  const hourChartData = Object.keys(hourStats)
    .sort()
    .map((h) => ({ hour: h, pnl: hourStats[h].pnl, tradesCount: hourStats[h].total }));

  // 14. Répartition par marché — `Trade.marketCategory`, jamais absent (champ
  // obligatoire à la saisie), donc pas de catégorie "non renseigné" à gérer.
  const marketStats: Record<string, CategoryStats> = {};
  trades.forEach((t) => {
    if (!marketStats[t.marketCategory]) marketStats[t.marketCategory] = { wins: 0, total: 0, pnl: 0 };
    marketStats[t.marketCategory].total += 1;
    if (t.result === "WIN") marketStats[t.marketCategory].wins += 1;
    if ((t.pnlUnit ?? "USD") !== "PERCENT") marketStats[t.marketCategory].pnl += t.pnl;
  });
  const marketChartData = Object.keys(marketStats).map((market) => ({
    market,
    pnl: marketStats[market].pnl,
    tradesCount: marketStats[market].total,
  }));

  // 15. Détail par actif (tableau) — reprend `pairStats` déjà calculé (point
  // 4), mais avec la totalité des actifs (pas les 8 premiers par nombre de
  // trades comme `pairChartData`) et triés par PnL total décroissant.
  const assetDetailData = Object.keys(pairStats)
    .map((asset) => ({
      asset,
      tradesCount: pairStats[asset].total,
      winRate:
        pairStats[asset].total > 0
          ? Math.round((pairStats[asset].wins / pairStats[asset].total) * 100)
          : 0,
      pnl: pairStats[asset].pnl,
    }))
    .sort((a, b) => b.pnl - a.pnl);

  // 16. Meilleure/pire série — la plus longue suite de WIN/LOSS consécutifs
  // dans l'ordre chronologique (`sortedTrades`). BREAKEVEN/OPEN sont ignorés,
  // ni ne rompent ni ne prolongent une série en cours.
  let bestWinStreak = 0;
  let worstLossStreak = 0;
  let currentWinStreak = 0;
  let currentLossStreak = 0;
  sortedTrades.forEach((t) => {
    if (t.result === "WIN") {
      currentWinStreak += 1;
      currentLossStreak = 0;
      bestWinStreak = Math.max(bestWinStreak, currentWinStreak);
    } else if (t.result === "LOSS") {
      currentLossStreak += 1;
      currentWinStreak = 0;
      worstLossStreak = Math.max(worstLossStreak, currentLossStreak);
    }
  });

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
    profitFactor,
    avgRR,
    drawdownMaxPercent,
    expectancyPerTrade,
    avgWin,
    avgLoss,
    monthlyChartData,
    hourChartData,
    marketChartData,
    assetDetailData,
    bestWinStreak,
    worstLossStreak,
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

export interface PeriodPnl {
  pnl: number;
  tradesCount: number;
}

export interface PnlByPeriod {
  day: PeriodPnl;
  week: PeriodPnl;
  month: PeriodPnl;
  year: PeriodPnl;
}

/** Lundi 00:00 de la semaine calendaire contenant `date` (ISO, jamais un décalage glissant de 7 jours). */
function startOfWeek(date: Date): Date {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const day = d.getDay(); // 0 = dimanche
  const diffToMonday = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diffToMonday);
  return d;
}

/**
 * PnL et nombre de trades sur 4 fenêtres calendaires glissantes — jour,
 * semaine (lundi→dimanche, pas "les 7 derniers jours"), mois, année en
 * cours, toutes ancrées sur `reference` (le vrai "maintenant" par défaut).
 * `tradesCount` compte tous les trades de la fenêtre quelle que soit leur
 * unité de PnL ($ ou %) ; `pnl` ne somme que les trades en $, même
 * convention que le reste de ce fichier (un trade en % n'est pas une somme
 * d'argent qu'on peut additionner à des dollars).
 */
export function computePnlByPeriod(trades: Trade[], reference: Date = new Date()): PnlByPeriod {
  const dayStart = new Date(reference.getFullYear(), reference.getMonth(), reference.getDate());
  const weekStart = startOfWeek(reference);
  const monthStart = new Date(reference.getFullYear(), reference.getMonth(), 1);
  const yearStart = new Date(reference.getFullYear(), 0, 1);

  const empty: PeriodPnl = { pnl: 0, tradesCount: 0 };
  const totals: PnlByPeriod = { day: { ...empty }, week: { ...empty }, month: { ...empty }, year: { ...empty } };

  for (const t of trades) {
    const tradeDate = new Date(`${t.date}T00:00:00`);
    if (Number.isNaN(tradeDate.getTime())) continue;
    const isDollar = (t.pnlUnit ?? "USD") !== "PERCENT";

    if (tradeDate >= yearStart) {
      totals.year.tradesCount += 1;
      if (isDollar) totals.year.pnl += t.pnl;
    }
    if (tradeDate >= monthStart) {
      totals.month.tradesCount += 1;
      if (isDollar) totals.month.pnl += t.pnl;
    }
    if (tradeDate >= weekStart) {
      totals.week.tradesCount += 1;
      if (isDollar) totals.week.pnl += t.pnl;
    }
    if (tradeDate.getTime() === dayStart.getTime()) {
      totals.day.tradesCount += 1;
      if (isDollar) totals.day.pnl += t.pnl;
    }
  }

  return totals;
}
