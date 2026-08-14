import { Module, Trade, CoachMessage, StudentProfile, ForumTopic, TradingAccount, CoachSignal, TraderBadge, EnrolledStudent, AppNotification } from "../types";

/**
 * Définitions des badges — catalogue de ce qu'il est possible de débloquer,
 * pas un état d'activité. Contrairement aux autres tableaux `initial*` de ce
 * fichier (vidés lors de la remise à zéro des données de démo), celui-ci
 * décrit une vraie fonctionnalité du produit (titre, description, critère,
 * récompense) — il n'a jamais été une donnée factice en soi. Seul l'état
 * d'activité l'était (`unlocked: true` avec des dates de démo inventées) :
 * ici, chaque badge démarre honnêtement non débloqué, sans progression
 * inventée. `computeBadgeProgress` (`src/lib/badges.ts`) recalcule la vraie
 * progression en direct à chaque rendu pour les badges calculables ; les
 * `currentValue`/`progressPercentage` ci-dessous ne sont donc que des
 * valeurs de repli inertes, jamais affichées telles quelles.
 */
export const initialTraderBadges: TraderBadge[] = [
  {
    id: "badge-1",
    title: "Maître du Risk 1%",
    description: "Exécuter 15 trades consécutifs avec un risque strictement inférieur ou égal à 1%.",
    iconName: "ShieldCheck",
    category: "DISCIPLINE",
    unlocked: false,
    progressPercentage: 0,
    currentValue: 0,
    targetValue: 15,
    unit: "trades",
    rewardXP: 300,
  },
  {
    id: "badge-2",
    title: "Diplômé SMC Horizon",
    description: "Compléter 100% des modules vidéo de la formation.",
    iconName: "Award",
    category: "ACADEMY",
    unlocked: false,
    progressPercentage: 0,
    currentValue: 0,
    targetValue: 0,
    unit: "leçons",
    rewardXP: 500,
  },
  {
    id: "badge-3",
    title: "Prop Firm Challenge Ready",
    description: "Atteindre 10% de profit virtuel sur le module Replay sans jamais dépasser 10% de Drawdown Max.",
    iconName: "Zap",
    category: "PROPFIRM",
    unlocked: false,
    progressPercentage: 0,
    currentValue: 0,
    targetValue: 10,
    unit: "% profit",
    rewardXP: 450,
  },
  {
    id: "badge-4",
    title: "Trader Discipliné (Zero FOMO)",
    description: "Enregistrer au moins 15 trades avec une émotion maîtrisée ('Calm' ou 'Disciplined').",
    iconName: "Smile",
    category: "DISCIPLINE",
    unlocked: false,
    progressPercentage: 0,
    currentValue: 0,
    targetValue: 15,
    unit: "trades sans tilt",
    rewardXP: 350,
  },
  {
    id: "badge-5",
    title: "Analyste Rigoureux",
    description: "Relire et documenter 5 trades clôturés avec une note technique complète dans le journal.",
    iconName: "Sparkles",
    category: "PERFORMANCE",
    unlocked: false,
    progressPercentage: 0,
    currentValue: 0,
    targetValue: 5,
    unit: "trades documentés",
    rewardXP: 250,
  },
  {
    id: "badge-6",
    title: "Série de Discipline 7 Jours",
    description: "Respecter à 100% ton plan de trading sans écart émotionnel pendant 7 jours consécutifs.",
    iconName: "Flame",
    category: "DISCIPLINE",
    unlocked: false,
    progressPercentage: 0,
    currentValue: 0,
    targetValue: 7,
    unit: "jours",
    rewardXP: 400,
  },
  {
    id: "badge-7",
    title: "Sniper R/R 1:3+",
    description: "Valider un trade gagnant enregistré dans le journal avec un Risk/Reward ≥ 3.0.",
    iconName: "Target",
    category: "PERFORMANCE",
    unlocked: false,
    progressPercentage: 0,
    currentValue: 0,
    targetValue: 3.0,
    unit: "R/R",
    rewardXP: 300,
  },
  {
    id: "badge-8",
    title: "Cumul de Performance +10R",
    description: "Générer un total cumulé de au moins +10.0R de bénéfices sur le journal de trading.",
    iconName: "TrendingUp",
    category: "PERFORMANCE",
    unlocked: false,
    progressPercentage: 0,
    currentValue: 0,
    targetValue: 10.0,
    unit: "R",
    rewardXP: 600,
  },
  {
    id: "badge-9",
    title: "Examen SMC 80+",
    description: "Obtenir une note de 80/100 ou plus à l'évaluation finale.",
    iconName: "Crown",
    category: "ACADEMY",
    unlocked: false,
    progressPercentage: 0,
    currentValue: 0,
    targetValue: 80,
    unit: "pts",
    rewardXP: 500,
  },
];

export const initialStudentProfile: StudentProfile = {
  name: "",
  email: "",
  avatar: "",
  level: "",
  joinedDate: "",
  startingCapital: 0,
  currentCapital: 0,
};

export const initialModules: Module[] = [];

export const initialTrades: Trade[] = [];

export const initialMessages: CoachMessage[] = [];

export const initialForumTopics: ForumTopic[] = [];

export const initialTradingAccounts: TradingAccount[] = [];

export const initialCoachSignals: CoachSignal[] = [];

export const initialEnrolledStudents: EnrolledStudent[] = [];

export const initialNotifications: AppNotification[] = [];
