import { Module, Trade, CoachMessage, StudentProfile, TradingAccount, TraderBadge, EnrolledStudent, AppNotification, Setup } from "../types";

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
    rewardXP: 350,
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
    rewardXP: 650,
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
    rewardXP: 550,
  },
  // Paliers de série de discipline au-delà de badge-6 (7 jours) — même
  // critère (`computeDisciplineStreak`), cibles plus longues. `unlocked:
  // true` ici aussi : décision explicite du fondateur (mêmes raisons que les
  // 9 badges précédents, voir le commentaire en tête de fichier) — pour un
  // NOUVEL élève, `unlocked` est toujours remis à `false` à la copie
  // (`server/auth/routes.ts`, `backfillMissingBadges` dans
  // `server/routes.ts`), qui ne recopie jamais cet état.
  {
    id: "badge-10",
    title: "Série de Discipline 14 Jours",
    description: "Respecter à 100% ton plan de trading sans écart émotionnel pendant 14 jours de trading consécutifs.",
    iconName: "Flame",
    category: "DISCIPLINE",
    unlocked: true,
    progressPercentage: 100,
    currentValue: 14,
    targetValue: 14,
    unit: "jours",
    unlockedAt: "20 Octobre 2024",
    rewardXP: 500,
  },
  {
    id: "badge-11",
    title: "Série de Discipline 1 Mois",
    description: "Respecter à 100% ton plan de trading sans écart émotionnel pendant 30 jours de trading consécutifs.",
    iconName: "Flame",
    category: "DISCIPLINE",
    unlocked: true,
    progressPercentage: 100,
    currentValue: 30,
    targetValue: 30,
    unit: "jours",
    unlockedAt: "15 Novembre 2024",
    rewardXP: 700,
  },
  {
    id: "badge-12",
    title: "Série de Discipline 3 Mois",
    description: "Respecter à 100% ton plan de trading sans écart émotionnel pendant 90 jours de trading consécutifs.",
    iconName: "Flame",
    category: "DISCIPLINE",
    unlocked: true,
    progressPercentage: 100,
    currentValue: 90,
    targetValue: 90,
    unit: "jours",
    unlockedAt: "20 Décembre 2024",
    rewardXP: 1000,
  },
  {
    id: "badge-13",
    title: "Série de Discipline 6 Mois",
    description: "Respecter à 100% ton plan de trading sans écart émotionnel pendant 180 jours de trading consécutifs.",
    iconName: "Flame",
    category: "DISCIPLINE",
    unlocked: true,
    progressPercentage: 100,
    currentValue: 180,
    targetValue: 180,
    unit: "jours",
    unlockedAt: "14 Février 2025",
    rewardXP: 1400,
  },
  {
    id: "badge-14",
    title: "Série de Discipline 1 An",
    description: "Respecter à 100% ton plan de trading sans écart émotionnel pendant 365 jours de trading consécutifs.",
    iconName: "Flame",
    category: "DISCIPLINE",
    unlocked: true,
    progressPercentage: 100,
    currentValue: 365,
    targetValue: 365,
    unit: "jours",
    unlockedAt: "10 Août 2025",
    rewardXP: 2700,
  },
  // Paliers de volume — nombre total de trades journalisés (tous confondus,
  // contrairement à badge-1 « Maître du Risk 1% » qui exige un risque ≤ 1%
  // sur chaque trade, une donnée non suivie aujourd'hui — voir le
  // commentaire sur `trackable: false` dans `computeSingleBadgeProgress`,
  // `src/lib/badges.ts`). `unlocked: true` ici aussi pour le fondateur, même
  // convention que les autres badges de ce fichier.
  {
    id: "badge-15",
    title: "Trader Actif 30 Trades",
    description: "Enregistrer 30 trades dans le journal de trading.",
    iconName: "Trophy",
    category: "PERFORMANCE",
    unlocked: true,
    progressPercentage: 100,
    currentValue: 30,
    targetValue: 30,
    unit: "trades",
    unlockedAt: "3 Septembre 2025",
    rewardXP: 400,
  },
  {
    id: "badge-16",
    title: "Trader Actif 50 Trades",
    description: "Enregistrer 50 trades dans le journal de trading.",
    iconName: "Trophy",
    category: "PERFORMANCE",
    unlocked: true,
    progressPercentage: 100,
    currentValue: 50,
    targetValue: 50,
    unit: "trades",
    unlockedAt: "28 Septembre 2025",
    rewardXP: 600,
  },
  {
    id: "badge-17",
    title: "Trader Actif 100 Trades",
    description: "Enregistrer 100 trades dans le journal de trading.",
    iconName: "Trophy",
    category: "PERFORMANCE",
    unlocked: true,
    progressPercentage: 100,
    currentValue: 100,
    targetValue: 100,
    unit: "trades",
    unlockedAt: "22 Octobre 2025",
    rewardXP: 1100,
  },
  // Paliers de badge-4 « Trader Discipliné (Zero FOMO) » — même critère
  // (trades enregistrés avec une émotion maîtrisée 'Calm'/'Disciplined'),
  // cibles plus hautes que les 15 trades de badge-4.
  {
    id: "badge-18",
    title: "Trader Discipliné 30 Trades",
    description: "Enregistrer au moins 30 trades avec une émotion maîtrisée ('Calm' ou 'Disciplined').",
    iconName: "Smile",
    category: "DISCIPLINE",
    unlocked: true,
    progressPercentage: 100,
    currentValue: 30,
    targetValue: 30,
    unit: "trades sans tilt",
    unlockedAt: "5 Novembre 2025",
    rewardXP: 450,
  },
  {
    id: "badge-19",
    title: "Trader Discipliné 50 Trades",
    description: "Enregistrer au moins 50 trades avec une émotion maîtrisée ('Calm' ou 'Disciplined').",
    iconName: "Smile",
    category: "DISCIPLINE",
    unlocked: true,
    progressPercentage: 100,
    currentValue: 50,
    targetValue: 50,
    unit: "trades sans tilt",
    unlockedAt: "19 Novembre 2025",
    rewardXP: 650,
  },
  {
    id: "badge-20",
    title: "Trader Discipliné 100 Trades",
    description: "Enregistrer au moins 100 trades avec une émotion maîtrisée ('Calm' ou 'Disciplined').",
    iconName: "Smile",
    category: "DISCIPLINE",
    unlocked: true,
    progressPercentage: 100,
    currentValue: 100,
    targetValue: 100,
    unit: "trades sans tilt",
    unlockedAt: "3 Décembre 2025",
    rewardXP: 1200,
  },
  // Paliers de badge-1 « Maître du Risk 1% » — même critère (risque
  // strictement ≤ 1% sur chaque trade d'une série CONSÉCUTIVE), cibles plus
  // hautes que les 15 trades de badge-1. Comme badge-1, marqués
  // `trackable: false` dans `src/lib/badges.ts` : le % de risque réellement
  // engagé par trade n'est pas suivi aujourd'hui (le tag "Sur-risque (>1%)"
  // n'est qu'auto-déclaré par l'élève, absence de tag ≠ preuve de risque
  // maîtrisé) — inventer une progression à partir de ça serait malhonnête,
  // même raison que pour badge-1. `unlocked: true` pour le fondateur, même
  // convention que badge-1 et tous les badges de ce fichier.
  {
    id: "badge-21",
    title: "Maître du Risk 1% — 30 Trades",
    description: "Exécuter 30 trades consécutifs avec un risque strictement inférieur ou égal à 1%.",
    iconName: "ShieldCheck",
    category: "DISCIPLINE",
    unlocked: true,
    progressPercentage: 100,
    currentValue: 30,
    targetValue: 30,
    unit: "trades",
    unlockedAt: "17 Décembre 2025",
    rewardXP: 550,
  },
  {
    id: "badge-22",
    title: "Maître du Risk 1% — 50 Trades",
    description: "Exécuter 50 trades consécutifs avec un risque strictement inférieur ou égal à 1%.",
    iconName: "ShieldCheck",
    category: "DISCIPLINE",
    unlocked: true,
    progressPercentage: 100,
    currentValue: 50,
    targetValue: 50,
    unit: "trades",
    unlockedAt: "8 Janvier 2026",
    rewardXP: 700,
  },
  {
    id: "badge-23",
    title: "Maître du Risk 1% — 100 Trades",
    description: "Exécuter 100 trades consécutifs avec un risque strictement inférieur ou égal à 1%.",
    iconName: "ShieldCheck",
    category: "DISCIPLINE",
    unlocked: true,
    progressPercentage: 100,
    currentValue: 100,
    targetValue: 100,
    unit: "trades",
    unlockedAt: "22 Janvier 2026",
    rewardXP: 1400,
  },
  // Paliers de badge-5 « Analyste Rigoureux » — même critère (note technique
  // ≥ 40 caractères sur un trade clôturé, voir `computeSingleBadgeProgress`
  // dans `src/lib/badges.ts`), cibles plus hautes que les 5 trades de
  // badge-5. Contrairement aux paliers de badge-1, celui-ci EST calculable
  // en direct (la longueur de note est une vraie donnée suivie) : ces
  // badges ont donc une vraie progression pour tout le monde, pas seulement
  // un état figé pour le fondateur.
  {
    id: "badge-24",
    title: "Analyste Rigoureux 30 Trades",
    description: "Relire et documenter 30 trades clôturés avec une note technique complète dans le journal.",
    iconName: "Sparkles",
    category: "PERFORMANCE",
    unlocked: true,
    progressPercentage: 100,
    currentValue: 30,
    targetValue: 30,
    unit: "trades documentés",
    unlockedAt: "5 Février 2026",
    rewardXP: 600,
  },
  {
    id: "badge-25",
    title: "Analyste Rigoureux 50 Trades",
    description: "Relire et documenter 50 trades clôturés avec une note technique complète dans le journal.",
    iconName: "Sparkles",
    category: "PERFORMANCE",
    unlocked: true,
    progressPercentage: 100,
    currentValue: 50,
    targetValue: 50,
    unit: "trades documentés",
    unlockedAt: "19 Février 2026",
    rewardXP: 850,
  },
  {
    id: "badge-26",
    title: "Analyste Rigoureux 100 Trades",
    description: "Relire et documenter 100 trades clôturés avec une note technique complète dans le journal.",
    iconName: "Sparkles",
    category: "PERFORMANCE",
    unlocked: true,
    progressPercentage: 100,
    currentValue: 100,
    targetValue: 100,
    unit: "trades documentés",
    unlockedAt: "5 Mars 2026",
    rewardXP: 1400,
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
export const initialSetups: Setup[] = [];
