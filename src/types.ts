export type CourseLevel = "Débutant" | "Intermédiaire" | "Avancé" | "Masterclass";

export interface QuizQuestion {
  id: string;
  question: string;
  options: string[];
  correctAnswerIndex: number;
  explanation: string;
}

export interface Resource {
  id: string;
  title: string;
  type: "pdf" | "excel" | "cheat_sheet";
  size: string;
  url: string;
}

export interface ModuleQuizResult {
  scorePercentage: number;
  totalQuestions: number;
  correctAnswers: number;
  passed: boolean;
  completedAt: string;
}

export interface Lesson {
  id: string;
  title: string;
  duration: string; // e.g. "18 min"
  videoUrl: string; // placeholder embed or video source
  description: string;
  isCompleted: boolean;
  resources?: Resource[];
  quiz?: QuizQuestion[];
}

export interface Module {
  id: string;
  title: string;
  category: CourseLevel;
  iconName: string;
  description: string;
  durationTotal: string;
  lessons: Lesson[];
  quiz?: QuizQuestion[];
}

export type TradeDirection = "LONG" | "SHORT";
export type TradeResult = "WIN" | "LOSS" | "BREAKEVEN" | "OPEN";
export type EmotionState = "Disciplined" | "FOMO" | "Impulsive" | "Anxious" | "Calm" | "Greedy";
export type MarketCategory = "Forex" | "Crypto" | "Indices" | "Matières Premières";

export interface Trade {
  id: string;
  /** Date d'entrée en position, au format YYYY-MM-DD. */
  date: string;
  /** Heure d'entrée, au format HH:MM. */
  time?: string;
  /** Date de sortie. Absente tant que la position est ouverte. */
  exitDate?: string;
  /** Heure de sortie, au format HH:MM. */
  exitTime?: string;
  pair: string; // e.g. "EUR/USD", "BTC/USDT"
  marketCategory: MarketCategory;
  direction: TradeDirection;
  entryPrice: number;
  stopLoss: number;
  takeProfit: number;
  exitPrice?: number;
  lotSize: number; // position size
  pnl: number; // € gain/loss
  pnlPercentage: number;
  riskRewardRatio: number;
  result: TradeResult;
  strategy: string; // e.g. "SMC Orderblock", "Breakout FVG", "Liquidity Sweep"
  emotion: EmotionState;
  notes: string;
  chartUrl?: string;
  aiAudit?: {
    technicalScore: number;
    riskScore: number;
    disciplineScore: number;
    diagnosis: string;
    strengths: string[];
    improvements: string[];
    coachFeedback: string;
  };
}

/**
 * Ébauche de trade envoyée au Journal depuis un autre outil
 * (calculateur de position, analyseur de setup IA).
 * Tous les champs sont optionnels : seuls ceux fournis écrasent
 * les valeurs par défaut du formulaire d'ajout.
 */
export interface TradeDraft {
  pair?: string;
  marketCategory?: MarketCategory;
  direction?: TradeDirection;
  entryPrice?: number;
  stopLoss?: number;
  takeProfit?: number;
  lotSize?: number;
  strategy?: string;
  notes?: string;
}

export interface Coach {
  id: string;
  name: string;
  role: string;
  specialty: string;
  avatar: string;
  isOnline: boolean;
  rating: number;
}

export interface CoachMessage {
  id: string;
  sender: "student" | "coach";
  coachId: string;
  text: string;
  timestamp: string;
  attachedTradeId?: string;
  attachedModuleTitle?: string;
  status: "sent" | "delivered" | "read" | "replied";
}

export interface StudentProfile {
  name: string;
  email: string;
  avatar: string;
  level: string;
  joinedDate: string;
  currentCapital: number;
  startingCapital: number;
  isAdmin?: boolean;
  role?: string;
  phone?: string;
  bio?: string;
  preferredPairs?: string;
  /**
   * Clés des entrées de la sidebar masquées par l'administrateur (modules pas
   * encore terminés). Voir SIDEBAR_TOGGLEABLE_KEYS dans components/Sidebar.tsx.
   */
  hiddenSidebarItems?: string[];
}

export type StudentStatusTag = "En Évaluation FTMO" | "Prop Firm Financé" | "Besoin Coaching" | "Alerte Tilt";

export interface EnrolledStudent {
  id: string;
  name: string;
  email: string;
  avatar: string;
  phone?: string;
  joinedDate: string;
  assignedCoach: string;
  level: string;
  statusTag: StudentStatusTag;
  courseCompletionPercentage: number;
  startingCapital: number;
  currentCapital: number;
  totalTrades: number;
  winRate: number;
  riskStatus: "🟢 Risque Maîtrisé" | "⚠️ Attention Risk" | "🔴 Sur-Risque" | "🏆 Challenge Validé";
  privateCoachNotes: string;
  accounts: TradingAccount[];
  recentTrades: Trade[];
}

export type AccountType = "Prop Firm Evaluation" | "Prop Firm Funded" | "Broker Réel" | "Compte DÉMO";

export interface TradingAccount {
  id: string;
  name: string;
  firmOrBroker: string;
  type: AccountType;
  initialBalance: number;
  currentBalance: number;
  equity: number;
  maxTotalDrawdownPercent: number;
  maxDailyDrawdownPercent: number;
  profitTargetPercent: number;
  startDate: string;
  status: "ACTIVE" | "PASSED" | "FAILED" | "PAID_OUT";
  tradingDays: number;
  minTradingDaysRequired: number;
  tradesCount: number;
  accountNumber?: string;
}

export interface BacktestScenario {
  id: string;
  title: string;
  pair: string;
  timeframe: string;
  difficulty: "Débutant" | "Intermédiaire" | "Expert";
  smcPattern: string;
  description: string;
  chartUrl: string;
  suggestedDirection: TradeDirection;
  suggestedEntry: number;
  suggestedSL: number;
  suggestedTP: number;
  explanation: string;
  marketCategory: MarketCategory;
}

export interface CoachSignal {
  id: string;
  coachName: string;
  coachAvatar: string;
  pair: string;
  direction: TradeDirection;
  timeframe: string;
  entryZone: string;
  entryPrice: number;
  stopLoss: number;
  takeProfit1: number;
  takeProfit2: number;
  riskLevel: "Faible" | "Modéré" | "High Volatility";
  status: "EN_ATTENTE" | "ACTIF" | "TP_ATTEINT" | "SL_ATTEINT" | "ANNULÉ";
  date: string;
  smcNotes: string;
  pnlResultPips?: number;
}

export interface TraderBadge {
  id: string;
  title: string;
  description: string;
  iconName: string;
  category: "DISCIPLINE" | "ACADEMY" | "PROPFIRM" | "AUDIT" | "PERFORMANCE";
  unlocked: boolean;
  progressPercentage: number;
  currentValue?: number;
  targetValue?: number;
  unit?: string;
  unlockedAt?: string;
  rewardXP?: number;
}


export type NotificationType = "signal" | "trade" | "academy" | "risk" | "system";

export interface AppNotification {
  id: string;
  title: string;
  message: string;
  time: string;
  type: NotificationType;
  read: boolean;
  targetTab?: string;
}

export type ForumCategory =
  | "SMC & Price Action"
  | "Psychologie & Discipline"
  | "Risk Management"
  | "Analyses de Marché"
  | "Questions Générales";

export type ForumRole = "Élève Premium" | "Modérateur" | "Head Coach";

export interface ForumReply {
  id: string;
  authorName: string;
  authorAvatar: string;
  authorRole: ForumRole;
  createdAt: string;
  content: string;
  likesCount: number;
  isCoachCertified?: boolean;
  isSolution?: boolean;
}

export interface ForumTopic {
  id: string;
  title: string;
  category: ForumCategory;
  authorName: string;
  authorAvatar: string;
  authorRole: ForumRole;
  createdAt: string;
  repliesCount: number;
  viewsCount: number;
  likesCount: number;
  isPinned: boolean;
  isSolved: boolean;
  isLocked: boolean;
  content: string;
  replies: ForumReply[];
}
