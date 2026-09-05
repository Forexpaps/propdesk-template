import { Trade, StudentProfile, EmotionState, TradingPlan } from "../types";

/**
 * Calculs purs de Rentabilité et du résumé Journal, extraits de
 * `PerformanceDashboard.tsx` et `TradingJournal.tsx` — une seule
 * implémentation partagée, jamais deux qui risquent de diverger
 * silencieusement (déjà arrivé une fois cette session avec un bug de courbe
 * d'équité dupliquée entre deux fichiers).
 */

/**
 * Les 5 états émotionnels saisissables dans le Journal de trading (chips
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
];

interface CategoryStats {
  wins: number;
  losses: number;
  total: number;
  pnl: number;
}

/**
 * Un trade compte dans un total monétaire réalisé (PnL cumulé, courbe
 * d'équité, ventilations...) seulement s'il est en $ (pas en %, pas une
 * somme d'argent comparable) ET clôturé (`result !== "OPEN"`). Une position
 * encore ouverte n'a qu'un PnL indicatif tapé à la main par l'utilisateur —
 * le compter comme réalisé polluait le PnL cumulé, la courbe d'équité, le
 * solde recalculé du compte prop firm (`walletStats.ts`) et les alertes de
 * plan (`planCompliance.ts`) avec un montant qui n'est pas encore acquis.
 */
export function isRealizedDollarTrade(t: Trade): boolean {
  return (t.pnlUnit ?? "USD") !== "PERCENT" && t.result !== "OPEN";
}

/**
 * `wins/(wins+losses)` — BREAKEVEN et OPEN au dénominateur dilueraient le taux
 * sans jamais apparaître nulle part comme « neutres ». Au niveau module (et non
 * enfermée dans `computePerformanceStats`) pour que toute nouvelle ventilation
 * réutilise cette définition au lieu d'en recopier une variante.
 */
function winRateOf(s: CategoryStats): number {
  return s.wins + s.losses > 0 ? Math.round((s.wins / (s.wins + s.losses)) * 100) : 0;
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
      // Un trade en % n'est pas une somme d'argent, une position encore
      // ouverte n'a rien de réalisé : ni l'un ni l'autre n'ajoute au capital
      // cumulé — voir `isRealizedDollarTrade`.
      if (isRealizedDollarTrade(t)) runningCapital += t.pnl;
      return {
        date: t.date,
        capital: runningCapital,
        pnl: t.pnl,
      };
    }),
  ];

  // Trades en $ ET clôturés uniquement : seuls ceux-ci entrent dans les totaux monétaires.
  const tradesEnDollars = trades.filter(isRealizedDollarTrade);

  // 2. Performance par Stratégie
  const strategyStats: Record<string, CategoryStats> = {};
  trades.forEach((t) => {
    if (!strategyStats[t.strategy]) {
      strategyStats[t.strategy] = { wins: 0, losses: 0, total: 0, pnl: 0 };
    }
    strategyStats[t.strategy].total += 1;
    if (t.result === "WIN") strategyStats[t.strategy].wins += 1;
    if (t.result === "LOSS") strategyStats[t.strategy].losses += 1;
    if (isRealizedDollarTrade(t)) strategyStats[t.strategy].pnl += t.pnl;
  });

  const strategyChartData = Object.keys(strategyStats).map((strat) => ({
    strategy: strat,
    winRate: winRateOf(strategyStats[strat]),
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
    Disciplined: { wins: 0, losses: 0, total: 0, pnl: 0 },
    FOMO: { wins: 0, losses: 0, total: 0, pnl: 0 },
    Impulsive: { wins: 0, losses: 0, total: 0, pnl: 0 },
    Anxious: { wins: 0, losses: 0, total: 0, pnl: 0 },
    Calm: { wins: 0, losses: 0, total: 0, pnl: 0 },
  };
  trades.forEach((t) => {
    emotionStats[t.emotion].total += 1;
    if (t.result === "WIN") emotionStats[t.emotion].wins += 1;
    if (t.result === "LOSS") emotionStats[t.emotion].losses += 1;
    if (isRealizedDollarTrade(t)) emotionStats[t.emotion].pnl += t.pnl;
  });

  const emotionChartData = ALL_EMOTIONS.map(({ id, label }) => ({
    emotion: label,
    winRate: winRateOf(emotionStats[id]),
    pnl: emotionStats[id].pnl,
    tradesCount: emotionStats[id].total,
  }));

  // Métriques générales
  const totalTrades = trades.length;
  const wins = trades.filter((t) => t.result === "WIN").length;
  const losses = trades.filter((t) => t.result === "LOSS").length;
  // Sur gagnants + perdants uniquement (même règle que `computeJournalSummary`
  // plus bas) : un trade au break-even ou encore ouvert n'est ni l'un ni
  // l'autre, le compter au dénominateur diluait artificiellement le taux.
  const decidedTrades = wins + losses;
  const winRate = decidedTrades > 0 ? Math.round((wins / decidedTrades) * 100) : 0;
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
    if (!pairStats[t.pair]) pairStats[t.pair] = { wins: 0, losses: 0, total: 0, pnl: 0 };
    pairStats[t.pair].total += 1;
    if (t.result === "WIN") pairStats[t.pair].wins += 1;
    if (t.result === "LOSS") pairStats[t.pair].losses += 1;
    if (isRealizedDollarTrade(t)) pairStats[t.pair].pnl += t.pnl;
  });
  const pairChartData = Object.keys(pairStats)
    .map((pair) => ({ pair, pnl: pairStats[pair].pnl, tradesCount: pairStats[pair].total }))
    .sort((a, b) => b.tradesCount - a.tradesCount)
    .slice(0, 8);

  // 5. Performance par Direction (Long / Short)
  const directionStats: Record<string, CategoryStats> = {};
  trades.forEach((t) => {
    if (!directionStats[t.direction]) directionStats[t.direction] = { wins: 0, losses: 0, total: 0, pnl: 0 };
    directionStats[t.direction].total += 1;
    if (t.result === "WIN") directionStats[t.direction].wins += 1;
    if (t.result === "LOSS") directionStats[t.direction].losses += 1;
    if (isRealizedDollarTrade(t)) directionStats[t.direction].pnl += t.pnl;
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
    if (!dayStats[day]) dayStats[day] = { wins: 0, losses: 0, total: 0, pnl: 0 };
    dayStats[day].total += 1;
    if (t.result === "WIN") dayStats[day].wins += 1;
    if (t.result === "LOSS") dayStats[day].losses += 1;
    if (isRealizedDollarTrade(t)) dayStats[day].pnl += t.pnl;
  });
  const dayChartData = DAY_ORDER.filter((d) => dayStats[d]).map((d) => ({
    day: d.slice(0, 3),
    pnl: dayStats[d].pnl,
    tradesCount: dayStats[d].total,
  }));

  // 7. Performance par Session de Marché
  //
  // Convertie en heure UTC avant classification — même convention que
  // `checkPlanViolations` (`src/lib/planCompliance.ts`, règle "session
  // autorisée") et `FOREX_SESSIONS`/`isSessionActive` (`TopHeader.tsx`) : un
  // `new Date(\`${date}T${time}\`)` sans suffixe de fuseau est interprété par
  // JS dans le fuseau LOCAL du navigateur, puis `getUTCHours()` en tire
  // l'heure UTC réelle. Avant ce correctif, cette fonction traitait
  // directement le chiffre d'heure saisi comme s'il était déjà en UTC : un
  // même trade pouvait tomber dans une session ici et dans une autre pour
  // `checkPlanViolations`, pour tout utilisateur hors UTC (ex. France,
  // UTC+1/+2) — Rentabilité et l'alerte de non-respect du plan racontaient
  // alors deux histoires différentes sur la même donnée.
  // Découpage sans chevauchement (contrairement à la pastille live de
  // TopHeader.tsx, qui peut cumuler plusieurs sessions actives) pour ne
  // compter chaque trade qu'une seule fois dans ces statistiques.
  const getSessionLabel = (date?: string, time?: string): string | null => {
    if (!time || !date) return null;
    const instant = new Date(`${date}T${time}`);
    if (Number.isNaN(instant.getTime())) return null;
    const hour = instant.getUTCHours();
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
    const session = getSessionLabel(t.date, t.time);
    if (!session) {
      tradesSansHeure += 1;
      return;
    }
    if (!sessionStats[session]) sessionStats[session] = { wins: 0, losses: 0, total: 0, pnl: 0 };
    sessionStats[session].total += 1;
    if (t.result === "WIN") sessionStats[session].wins += 1;
    if (t.result === "LOSS") sessionStats[session].losses += 1;
    if (isRealizedDollarTrade(t)) sessionStats[session].pnl += t.pnl;
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
    if (!hourStats[key]) hourStats[key] = { wins: 0, losses: 0, total: 0, pnl: 0 };
    hourStats[key].total += 1;
    if (t.result === "WIN") hourStats[key].wins += 1;
    if (t.result === "LOSS") hourStats[key].losses += 1;
    hourStats[key].pnl += t.pnl;
  });
  const hourChartData = Object.keys(hourStats)
    .sort()
    .map((h) => ({ hour: h, pnl: hourStats[h].pnl, tradesCount: hourStats[h].total }));

  // 14. Répartition par marché — `Trade.marketCategory`, jamais absent (champ
  // obligatoire à la saisie), donc pas de catégorie "non renseigné" à gérer.
  const marketStats: Record<string, CategoryStats> = {};
  trades.forEach((t) => {
    if (!marketStats[t.marketCategory]) marketStats[t.marketCategory] = { wins: 0, losses: 0, total: 0, pnl: 0 };
    marketStats[t.marketCategory].total += 1;
    if (t.result === "WIN") marketStats[t.marketCategory].wins += 1;
    if (t.result === "LOSS") marketStats[t.marketCategory].losses += 1;
    if (isRealizedDollarTrade(t)) marketStats[t.marketCategory].pnl += t.pnl;
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
      winRate: winRateOf(pairStats[asset]),
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
  /** Trades clôturés au break-even (`result === "BREAKEVEN"`) — ni gagnants ni perdants. */
  breakevenTrades: number;
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
  const breakevenTrades = trades.filter((t) => t.result === "BREAKEVEN").length;
  // Sur gagnants + perdants uniquement (convention standard du "win rate") :
  // un trade clôturé au break-even n'est ni un gagnant ni un perdant, le
  // compter au dénominateur diluait artificiellement le taux de réussite
  // sans jamais apparaître nulle part comme "neutre" à l'écran.
  const decidedTrades = winTrades + lossTrades;
  const winRate = decidedTrades > 0 ? Math.round((winTrades / decidedTrades) * 100) : 0;

  const tradesEnDollars = trades.filter(isRealizedDollarTrade);
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

  return {
    totalTrades,
    winTrades,
    lossTrades,
    breakevenTrades,
    winRate,
    totalPnL,
    profitFactor,
    avgRR,
    disciplineEmoPercent,
  };
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
    const isDollar = isRealizedDollarTrade(t);

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

// ---------------------------------------------------------------------------
// Durée de détention
// ---------------------------------------------------------------------------

/**
 * Durée de détention en minutes, ou `null` quand elle n'est pas calculable.
 *
 * Exige les DEUX horodatages complets (date + heure, à l'entrée comme à la
 * sortie). `time`/`exitTime` étant optionnels, compléter une heure manquante
 * par 00:00 fabriquerait une durée qui n'a jamais existé — même parti pris que
 * la heatmap horaire, qui écarte les trades sans `time` plutôt que de les
 * ranger à minuit.
 *
 * Les deux bornes sont parsées en UTC (suffixe "Z") : seule leur DIFFÉRENCE
 * nous intéresse, et l'arithmétique UTC ignore les changements d'heure — un
 * trade tenu pendant la nuit du passage à l'heure d'hiver ne gagne pas une
 * heure fantôme. (`computePnlByPeriod` et `periodStart`, eux, restent en heure
 * locale : ils comparent à « aujourd'hui », pas deux instants entre eux.)
 */
export function tradeDurationMinutes(t: Trade): number | null {
  if (t.result === "OPEN" || !t.exitDate || !t.time || !t.exitTime) return null;
  const debut = Date.parse(`${t.date}T${t.time}:00Z`);
  const fin = Date.parse(`${t.exitDate}T${t.exitTime}:00Z`);
  if (Number.isNaN(debut) || Number.isNaN(fin)) return null;
  const minutes = (fin - debut) / 60_000;
  // Sortie antérieure à l'entrée : saisie incohérente. Le formulaire borne
  // `exitDate >= date` mais rien n'empêche 16:00 → 09:00 le même jour. Une
  // durée négative dans une moyenne est pire qu'une durée absente.
  return minutes < 0 ? null : minutes;
}

export interface DurationStats {
  /** Moyenne en minutes, `null` si aucun trade exploitable. */
  avgMinutes: number | null;
  /** Médiane — bien plus représentative dès qu'un swing de plusieurs jours côtoie des scalps de 10 minutes. */
  medianMinutes: number | null;
  countedTrades: number;
  /** Trades CLÔTURÉS écartés faute d'horodatage complet — affiché, jamais tu. */
  skippedTrades: number;
}

export function computeDurationStats(trades: Trade[]): DurationStats {
  const durees: number[] = [];
  let skipped = 0;

  for (const t of trades) {
    // Une position ouverte n'a légitimement pas de durée : elle n'est pas
    // « écartée », elle n'est simplement pas encore mesurable.
    if (t.result === "OPEN") continue;
    const d = tradeDurationMinutes(t);
    if (d === null) skipped += 1;
    else durees.push(d);
  }

  if (durees.length === 0) {
    return { avgMinutes: null, medianMinutes: null, countedTrades: 0, skippedTrades: skipped };
  }

  const tri = [...durees].sort((a, b) => a - b);
  const milieu = Math.floor(tri.length / 2);
  const mediane = tri.length % 2 === 0 ? (tri[milieu - 1] + tri[milieu]) / 2 : tri[milieu];

  return {
    avgMinutes: durees.reduce((a, b) => a + b, 0) / durees.length,
    medianMinutes: mediane,
    countedTrades: durees.length,
    skippedTrades: skipped,
  };
}

// ---------------------------------------------------------------------------
// Capture de la cible (« efficacité de sortie »)
// ---------------------------------------------------------------------------

export interface ExitRatios {
  /** Part de la cible atteinte. 1 = sortie exactement au TP, 0 = sortie au prix d'entrée, >1 = au-delà du TP, <0 = sortie en perte. */
  capture: number;
  /** Part du risque planifié réellement encaissée. 1 = sortie exactement au SL, >1 = stop dépassé (slippage, ou stop déplacé). Négatif sur un gagnant — à n'agréger que sur les perdants. */
  risqueConsomme: number;
}

/**
 * Compare le prix de sortie réel aux niveaux planifiés (TP/SL), dans le sens du
 * trade.
 *
 * Faute de MFE (plus haut atteint pendant la position), on ne peut PAS mesurer
 * ce que le marché a réellement offert — seulement la part de l'objectif qu'on
 * s'était fixé et qu'on a effectivement encaissée. D'où « capture de la cible »
 * et non « efficacité » au sens académique : la métrique répond à « est-ce que
 * je coupe mes gagnants avant mon TP ? », rien de plus.
 *
 * `null` dès qu'un ingrédient manque ou qu'il est incohérent — jamais un 0 de
 * repli, qui se confondrait avec une vraie sortie au prix d'entrée.
 */
export function tradeExitRatios(t: Trade): ExitRatios | null {
  // Position ouverte : rien n'est sorti, il n'y a rien à mesurer.
  if (t.result === "OPEN") return null;

  // `exitPrice` absent OU égal à 0 : dans les deux cas la sortie n'est pas
  // renseignée. 0 n'est une cotation réelle pour aucun marché du Journal, et
  // des trades saisis avant la correction du formulaire portent un 0 parasite —
  // les exclure évite de polluer la moyenne rétroactivement.
  if (!t.exitPrice) return null;

  // Un seul facteur de sens : sur un SHORT, « aller dans le bon sens » c'est
  // voir le prix BAISSER. Toutes les distances sont donc signées « en faveur du
  // trade », jamais en valeur absolue — un Math.abs rendrait une sortie du
  // mauvais côté indiscernable d'une bonne sortie.
  const sens = t.direction === "LONG" ? 1 : -1;
  const mouvement = sens * (t.exitPrice - t.entryPrice);
  const cible = sens * (t.takeProfit - t.entryPrice);
  const risque = sens * (t.entryPrice - t.stopLoss);

  // TP du mauvais côté de l'entrée (ou confondu avec elle), SL idem : le setup
  // lui-même est incohérent (un LONG dont le TP est SOUS son entrée). Aucun
  // ratio n'a de sens, et diviser par 0 ou par un négatif inverserait le signe
  // sans prévenir.
  if (cible <= 0 || risque <= 0) return null;

  return { capture: mouvement / cible, risqueConsomme: -mouvement / risque };
}

export interface ExitEfficiencyStats {
  /** Capture moyenne de la cible sur les GAGNANTS. 0.7 = « en moyenne tu encaisses 70 % de ton TP ». */
  captureMoyenneWins: number | null;
  winsComptes: number;
  /** Gagnants sortis AVANT le TP. Le compte brut parle plus qu'une moyenne sur un petit échantillon. */
  winsSortisAvantTp: number;
  /** Part du risque réellement encaissée sur les PERDANTS. >1 = stops dépassés — signal plus grave qu'une sortie prématurée. */
  risqueMoyenLosses: number | null;
  lossesComptes: number;
  /** Trades clôturés écartés (pas de prix de sortie, ou niveaux incohérents). */
  tradesNonExploitables: number;
}

/**
 * Agrège `tradeExitRatios` en séparant gagnants et perdants.
 *
 * Moyenner la capture sur TOUS les trades serait trompeur : un perdant sorti au
 * stop produit mécaniquement `-risque/cible`, ce qui tire la moyenne vers le bas
 * sans rien dire sur la question posée. D'où deux indicateurs distincts.
 *
 * Le regroupement suit `result`, JAMAIS le signe de `capture` : `result` est
 * choisi explicitement par l'utilisateur et n'est jamais déduit (règle de fond
 * du Journal). Un trade marqué WIN dont la capture est négative est une
 * incohérence de saisie qu'il faut laisser voir, pas reclasser en douce.
 *
 * Contrairement au reste de ce fichier, on ne filtre PAS sur
 * `isRealizedDollarTrade` : ces ratios sont purement géométriques (des prix, pas
 * de l'argent), un trade dont le PnL est en % y entre exactement comme un trade
 * en $.
 */
export function computeExitEfficiency(trades: Trade[]): ExitEfficiencyStats {
  const captures: number[] = [];
  const risques: number[] = [];
  let winsSortisAvantTp = 0;
  let nonExploitables = 0;

  for (const t of trades) {
    if (t.result === "OPEN") continue;
    const ratios = tradeExitRatios(t);
    if (!ratios) {
      nonExploitables += 1;
      continue;
    }
    // BREAKEVEN exclu des deux moyennes : par construction il n'a ni gain ni
    // perte à mesurer contre un objectif.
    if (t.result === "WIN") {
      captures.push(ratios.capture);
      if (ratios.capture < 1) winsSortisAvantTp += 1;
    } else if (t.result === "LOSS") {
      risques.push(ratios.risqueConsomme);
    }
  }

  const moyenne = (xs: number[]) => (xs.length > 0 ? xs.reduce((a, b) => a + b, 0) / xs.length : null);

  return {
    captureMoyenneWins: moyenne(captures),
    winsComptes: captures.length,
    winsSortisAvantTp,
    risqueMoyenLosses: moyenne(risques),
    lossesComptes: risques.length,
    tradesNonExploitables: nonExploitables,
  };
}

// ---------------------------------------------------------------------------
// Ventilation par plan de trading
// ---------------------------------------------------------------------------

export interface PlanDetailRow {
  /** `null` = trades hors plan (aucun `tradingPlanId`, ou plan supprimé depuis). */
  planId: string | null;
  planName: string;
  tradesCount: number;
  winRate: number;
  pnl: number;
}

/**
 * Ventilation par plan de trading — même forme que « Détail par Actif ».
 *
 * Un `tradingPlanId` introuvable (plan supprimé depuis la saisie) est rangé dans
 * « Hors plan », jamais traité comme une erreur ni affiché comme un plan
 * fantôme : c'est la règle que pose déjà le type `Trade`, dont le champ est
 * optionnel par nature.
 *
 * Les plans sans aucun trade sont inclus avec des zéros — « ce plan n'est jamais
 * utilisé » est une information en soi.
 *
 * Note : l'import CSV n'attribue aucun `tradingPlanId` (la colonne n'existe ni à
 * l'export ni à l'import), donc tout trade importé apparaît « Hors plan ».
 */
export function computePlanDetail(trades: Trade[], plans: TradingPlan[]): PlanDetailRow[] {
  const HORS_PLAN = "__hors_plan__";
  const nomParId = new Map(plans.map((p) => [p.id, p.name]));

  const buckets = new Map<string, CategoryStats>();
  // Les plans existants d'abord, pour que ceux sans trade apparaissent aussi.
  plans.forEach((p) => buckets.set(p.id, { wins: 0, losses: 0, total: 0, pnl: 0 }));

  for (const t of trades) {
    const cle = t.tradingPlanId && nomParId.has(t.tradingPlanId) ? t.tradingPlanId : HORS_PLAN;
    if (!buckets.has(cle)) buckets.set(cle, { wins: 0, losses: 0, total: 0, pnl: 0 });
    const b = buckets.get(cle)!;
    b.total += 1;
    if (t.result === "WIN") b.wins += 1;
    if (t.result === "LOSS") b.losses += 1;
    if (isRealizedDollarTrade(t)) b.pnl += t.pnl;
  }

  const lignes: PlanDetailRow[] = [...buckets.entries()].map(([cle, s]) => ({
    planId: cle === HORS_PLAN ? null : cle,
    planName: cle === HORS_PLAN ? "Hors plan" : (nomParId.get(cle) ?? "Hors plan"),
    tradesCount: s.total,
    winRate: winRateOf(s),
    pnl: s.pnl,
  }));

  // Tri par PnL décroissant, « Hors plan » épinglé en dernier quel que soit son
  // PnL : ce n'est pas un plan, il ne concourt pas au classement.
  return lignes.sort((a, b) => {
    if (a.planId === null) return 1;
    if (b.planId === null) return -1;
    return b.pnl - a.pnl;
  });
}
