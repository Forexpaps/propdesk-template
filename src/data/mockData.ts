import { Module, Trade, CoachMessage, StudentProfile, TradingAccount, TraderBadge, EnrolledStudent, AppNotification } from "../types";

/**
 * Définitions des badges — catalogue de ce qu'il est possible de débloquer.
 * Contrairement aux autres tableaux `initial*` de ce fichier (vidés lors de
 * la remise à zéro des données de démo), celui-ci décrit une vraie
 * fonctionnalité du produit (titre, description, critère, récompense) — il
 * n'a jamais été une donnée factice en soi.
 *
 * Les 9 badges sont marqués `unlocked: true` avec des dates de 2024 — décision
 * explicite du fondateur (pas une donnée de démo réintroduite par erreur).
 * `unlocked`/`unlockedAt` ne sont jamais recalculés par
 * `computeBadgeProgress` (`src/lib/badges.ts`) : une fois posés ici (ou
 * écrits en base), ils restent tels quels tant que personne n'y touche.
 * `currentValue`/`progressPercentage`, eux, sont recalculés en direct à
 * chaque rendu pour les badges calculables — les valeurs ci-dessous ne sont
 * qu'un repli inerte pour les 3 badges non calculables (voir
 * `computeSingleBadgeProgress`).
 */
export const initialTraderBadges: TraderBadge[] = [
  {
    id: "badge-1",
    title: "Maître du Risk 1%",
    description: "Exécuter 15 trades consécutifs avec un risque strictement inférieur ou égal à 1%.",
    iconName: "ShieldCheck",
    category: "DISCIPLINE",
    unlocked: true,
    progressPercentage: 100,
    currentValue: 15,
    targetValue: 15,
    unit: "trades",
    unlockedAt: "15 Janvier 2024",
    rewardXP: 300,
  },
  {
    id: "badge-2",
    title: "Diplômé SMC Horizon",
    description: "Compléter 100% des modules vidéo de la formation.",
    iconName: "Award",
    category: "ACADEMY",
    unlocked: true,
    progressPercentage: 100,
    currentValue: 0,
    targetValue: 0,
    unit: "leçons",
    unlockedAt: "22 Février 2024",
    rewardXP: 500,
  },
  {
    id: "badge-3",
    title: "Prop Firm Challenge Ready",
    description: "Atteindre 10% de profit virtuel en backtest sans jamais dépasser 10% de Drawdown Max.",
    iconName: "Zap",
    category: "PROPFIRM",
    unlocked: true,
    progressPercentage: 100,
    currentValue: 10,
    targetValue: 10,
    unit: "% profit",
    unlockedAt: "10 Mars 2024",
    rewardXP: 450,
  },
  {
    id: "badge-4",
    title: "Trader Discipliné (Zero FOMO)",
    description: "Enregistrer au moins 15 trades avec une émotion maîtrisée ('Calm' ou 'Disciplined').",
    iconName: "Smile",
    category: "DISCIPLINE",
    unlocked: true,
    progressPercentage: 100,
    currentValue: 15,
    targetValue: 15,
    unit: "trades sans tilt",
    unlockedAt: "5 Avril 2024",
    rewardXP: 350,
  },
  {
    id: "badge-5",
    title: "Analyste Rigoureux",
    description: "Relire et documenter 5 trades clôturés avec une note technique complète dans le journal.",
    iconName: "Sparkles",
    category: "PERFORMANCE",
    unlocked: true,
    progressPercentage: 100,
    currentValue: 5,
    targetValue: 5,
    unit: "trades documentés",
    unlockedAt: "18 Mai 2024",
    rewardXP: 250,
  },
  {
    id: "badge-6",
    title: "Série de Discipline 7 Jours",
    description: "Respecter à 100% ton plan de trading sans écart émotionnel pendant 7 jours consécutifs.",
    iconName: "Flame",
    category: "DISCIPLINE",
    unlocked: true,
    progressPercentage: 100,
    currentValue: 7,
    targetValue: 7,
    unit: "jours",
    unlockedAt: "30 Juin 2024",
    rewardXP: 400,
  },
  {
    id: "badge-7",
    title: "Sniper R/R 1:3+",
    description: "Valider un trade gagnant enregistré dans le journal avec un Risk/Reward ≥ 3.0.",
    iconName: "Target",
    category: "PERFORMANCE",
    unlocked: true,
    progressPercentage: 100,
    currentValue: 3.0,
    targetValue: 3.0,
    unit: "R/R",
    unlockedAt: "12 Juillet 2024",
    rewardXP: 300,
  },
  {
    id: "badge-8",
    title: "Cumul de Performance +10R",
    description: "Générer un total cumulé de au moins +10.0R de bénéfices sur le journal de trading.",
    iconName: "TrendingUp",
    category: "PERFORMANCE",
    unlocked: true,
    progressPercentage: 100,
    currentValue: 10.0,
    targetValue: 10.0,
    unit: "R",
    unlockedAt: "25 Août 2024",
    rewardXP: 600,
  },
  {
    id: "badge-9",
    title: "Examen SMC 80+",
    description: "Obtenir une note de 80/100 ou plus à l'évaluation finale.",
    iconName: "Crown",
    category: "ACADEMY",
    unlocked: true,
    progressPercentage: 100,
    currentValue: 80,
    targetValue: 80,
    unit: "pts",
    unlockedAt: "8 Septembre 2024",
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
  // Ce profil ne sert jamais qu'au bureau staff (voir App.tsx, `seed()`) :
  // un vrai compte élève reçoit le sien depuis le serveur
  // (`buildStudentProfile`, server/routes.ts), jamais ce repli. Tout compte
  // staff a les mêmes droits (voir StaffAccountsModal.tsx) — `false`
  // masquerait à tort "Suivi des Élèves" (Sidebar.tsx) sur un site neuf.
  isAdmin: true,
};

export const initialModules: Module[] = [];

export const initialTrades: Trade[] = [];

export const initialMessages: CoachMessage[] = [];

export const initialTradingAccounts: TradingAccount[] = [];

export const initialEnrolledStudents: EnrolledStudent[] = [];

export const initialNotifications: AppNotification[] = [];
