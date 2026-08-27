import { Trade, StudentProfile, TradingAccount, TraderBadge, AppNotification, Setup } from "../types";

/**
 * Définitions des badges — catalogue de ce qu'il est possible de débloquer.
 * Contrairement aux autres tableaux `initial*` de ce fichier (vidés lors de
 * la remise à zéro des données de démo), celui-ci décrit une vraie
 * fonctionnalité du produit (titre, description, critère, récompense) — il
 * n'a jamais été une donnée factice en soi.
 *
 * Tous les badges partent `unlocked: false` : c'est le catalogue de
 * référence utilisé pour amorcer un tout nouveau compte (voir
 * `backfillMissingBadges`/`syncBadgeCatalog`, `server/routes.ts`), il n'a
 * jamais de raison de démarrer avec des badges déjà acquis. `unlocked`/
 * `unlockedAt` ne sont jamais recalculés par `computeBadgeProgress`
 * (`src/lib/badges.ts`) : une fois qu'un compte réclame un badge
 * (`onClaimBadge`), l'état persisté en base n'est plus jamais écrasé par ce
 * catalogue (voir la note sur `syncBadgeCatalog`). `currentValue`/
 * `progressPercentage`, eux, sont recalculés en direct à chaque rendu pour
 * les badges calculables — les valeurs ci-dessous ne sont qu'un repli inerte
 * pour les 3 badges non calculables (voir `computeSingleBadgeProgress`).
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
    currentValue: 15,
    targetValue: 15,
    unit: "trades",
    rewardXP: 300,
  },
  {
    id: "badge-3",
    title: "Prop Firm Challenge Ready",
    description: "Atteindre 10% de profit virtuel en backtest sans jamais dépasser 10% de Drawdown Max.",
    iconName: "Zap",
    category: "PROPFIRM",
    unlocked: false,
    progressPercentage: 0,
    currentValue: 10,
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
    currentValue: 15,
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
    currentValue: 5,
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
    currentValue: 7,
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
    currentValue: 3.0,
    targetValue: 3.0,
    unit: "R/R",
    rewardXP: 350,
  },
  {
    id: "badge-8",
    title: "Cumul de Performance +10R",
    description: "Générer un total cumulé de au moins +10.0R de bénéfices sur le journal de trading.",
    iconName: "TrendingUp",
    category: "PERFORMANCE",
    unlocked: false,
    progressPercentage: 0,
    currentValue: 10.0,
    targetValue: 10.0,
    unit: "R",
    rewardXP: 650,
  },
  // Paliers de série de discipline au-delà de badge-6 (7 jours) — même
  // critère (`computeDisciplineStreak`), cibles plus longues.
  {
    id: "badge-10",
    title: "Série de Discipline 14 Jours",
    description: "Respecter à 100% ton plan de trading sans écart émotionnel pendant 14 jours de trading consécutifs.",
    iconName: "Flame",
    category: "DISCIPLINE",
    unlocked: false,
    progressPercentage: 0,
    currentValue: 14,
    targetValue: 14,
    unit: "jours",
    rewardXP: 500,
  },
  {
    id: "badge-11",
    title: "Série de Discipline 1 Mois",
    description: "Respecter à 100% ton plan de trading sans écart émotionnel pendant 30 jours de trading consécutifs.",
    iconName: "Flame",
    category: "DISCIPLINE",
    unlocked: false,
    progressPercentage: 0,
    currentValue: 30,
    targetValue: 30,
    unit: "jours",
    rewardXP: 700,
  },
  {
    id: "badge-12",
    title: "Série de Discipline 3 Mois",
    description: "Respecter à 100% ton plan de trading sans écart émotionnel pendant 90 jours de trading consécutifs.",
    iconName: "Flame",
    category: "DISCIPLINE",
    unlocked: false,
    progressPercentage: 0,
    currentValue: 90,
    targetValue: 90,
    unit: "jours",
    rewardXP: 1000,
  },
  {
    id: "badge-13",
    title: "Série de Discipline 6 Mois",
    description: "Respecter à 100% ton plan de trading sans écart émotionnel pendant 180 jours de trading consécutifs.",
    iconName: "Flame",
    category: "DISCIPLINE",
    unlocked: false,
    progressPercentage: 0,
    currentValue: 180,
    targetValue: 180,
    unit: "jours",
    rewardXP: 1400,
  },
  {
    id: "badge-14",
    title: "Série de Discipline 1 An",
    description: "Respecter à 100% ton plan de trading sans écart émotionnel pendant 365 jours de trading consécutifs.",
    iconName: "Flame",
    category: "DISCIPLINE",
    unlocked: false,
    progressPercentage: 0,
    currentValue: 365,
    targetValue: 365,
    unit: "jours",
    rewardXP: 2700,
  },
  // Paliers de volume — nombre total de trades journalisés (tous confondus,
  // contrairement à badge-1 « Maître du Risk 1% » qui exige un risque ≤ 1%
  // sur chaque trade, une donnée non suivie aujourd'hui — voir le
  // commentaire sur `trackable: false` dans `computeSingleBadgeProgress`,
  // `src/lib/badges.ts`).
  {
    id: "badge-15",
    title: "Trader Actif 30 Trades",
    description: "Enregistrer 30 trades dans le journal de trading.",
    iconName: "Trophy",
    category: "PERFORMANCE",
    unlocked: false,
    progressPercentage: 0,
    currentValue: 30,
    targetValue: 30,
    unit: "trades",
    rewardXP: 400,
  },
  {
    id: "badge-16",
    title: "Trader Actif 50 Trades",
    description: "Enregistrer 50 trades dans le journal de trading.",
    iconName: "Trophy",
    category: "PERFORMANCE",
    unlocked: false,
    progressPercentage: 0,
    currentValue: 50,
    targetValue: 50,
    unit: "trades",
    rewardXP: 600,
  },
  {
    id: "badge-17",
    title: "Trader Actif 100 Trades",
    description: "Enregistrer 100 trades dans le journal de trading.",
    iconName: "Trophy",
    category: "PERFORMANCE",
    unlocked: false,
    progressPercentage: 0,
    currentValue: 100,
    targetValue: 100,
    unit: "trades",
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
    unlocked: false,
    progressPercentage: 0,
    currentValue: 30,
    targetValue: 30,
    unit: "trades sans tilt",
    rewardXP: 450,
  },
  {
    id: "badge-19",
    title: "Trader Discipliné 50 Trades",
    description: "Enregistrer au moins 50 trades avec une émotion maîtrisée ('Calm' ou 'Disciplined').",
    iconName: "Smile",
    category: "DISCIPLINE",
    unlocked: false,
    progressPercentage: 0,
    currentValue: 50,
    targetValue: 50,
    unit: "trades sans tilt",
    rewardXP: 650,
  },
  {
    id: "badge-20",
    title: "Trader Discipliné 100 Trades",
    description: "Enregistrer au moins 100 trades avec une émotion maîtrisée ('Calm' ou 'Disciplined').",
    iconName: "Smile",
    category: "DISCIPLINE",
    unlocked: false,
    progressPercentage: 0,
    currentValue: 100,
    targetValue: 100,
    unit: "trades sans tilt",
    rewardXP: 1200,
  },
  // Paliers de badge-1 « Maître du Risk 1% » — même critère (risque
  // strictement ≤ 1% sur chaque trade d'une série CONSÉCUTIVE), cibles plus
  // hautes que les 15 trades de badge-1. Comme badge-1, marqués
  // `trackable: false` dans `src/lib/badges.ts` : le % de risque réellement
  // engagé par trade n'est pas suivi aujourd'hui (le tag "Sur-risque (>1%)"
  // n'est qu'auto-déclaré par le trader, absence de tag ≠ preuve de risque
  // maîtrisé) — inventer une progression à partir de ça serait malhonnête,
  // même raison que pour badge-1.
  {
    id: "badge-21",
    title: "Maître du Risk 1% — 30 Trades",
    description: "Exécuter 30 trades consécutifs avec un risque strictement inférieur ou égal à 1%.",
    iconName: "ShieldCheck",
    category: "DISCIPLINE",
    unlocked: false,
    progressPercentage: 0,
    currentValue: 30,
    targetValue: 30,
    unit: "trades",
    rewardXP: 550,
  },
  {
    id: "badge-22",
    title: "Maître du Risk 1% — 50 Trades",
    description: "Exécuter 50 trades consécutifs avec un risque strictement inférieur ou égal à 1%.",
    iconName: "ShieldCheck",
    category: "DISCIPLINE",
    unlocked: false,
    progressPercentage: 0,
    currentValue: 50,
    targetValue: 50,
    unit: "trades",
    rewardXP: 700,
  },
  {
    id: "badge-23",
    title: "Maître du Risk 1% — 100 Trades",
    description: "Exécuter 100 trades consécutifs avec un risque strictement inférieur ou égal à 1%.",
    iconName: "ShieldCheck",
    category: "DISCIPLINE",
    unlocked: false,
    progressPercentage: 0,
    currentValue: 100,
    targetValue: 100,
    unit: "trades",
    rewardXP: 1400,
  },
  // Paliers de badge-5 « Analyste Rigoureux » — même critère (note technique
  // ≥ 40 caractères sur un trade clôturé, voir `computeSingleBadgeProgress`
  // dans `src/lib/badges.ts`), cibles plus hautes que les 5 trades de
  // badge-5. Contrairement aux paliers de badge-1, celui-ci EST calculable
  // en direct (la longueur de note est une vraie donnée suivie).
  {
    id: "badge-24",
    title: "Analyste Rigoureux 30 Trades",
    description: "Relire et documenter 30 trades clôturés avec une note technique complète dans le journal.",
    iconName: "Sparkles",
    category: "PERFORMANCE",
    unlocked: false,
    progressPercentage: 0,
    currentValue: 30,
    targetValue: 30,
    unit: "trades documentés",
    rewardXP: 600,
  },
  {
    id: "badge-25",
    title: "Analyste Rigoureux 50 Trades",
    description: "Relire et documenter 50 trades clôturés avec une note technique complète dans le journal.",
    iconName: "Sparkles",
    category: "PERFORMANCE",
    unlocked: false,
    progressPercentage: 0,
    currentValue: 50,
    targetValue: 50,
    unit: "trades documentés",
    rewardXP: 850,
  },
  {
    id: "badge-26",
    title: "Analyste Rigoureux 100 Trades",
    description: "Relire et documenter 100 trades clôturés avec une note technique complète dans le journal.",
    iconName: "Sparkles",
    category: "PERFORMANCE",
    unlocked: false,
    progressPercentage: 0,
    currentValue: 100,
    targetValue: 100,
    unit: "trades documentés",
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

export const initialTrades: Trade[] = [];

export const initialTradingAccounts: TradingAccount[] = [];

export const initialNotifications: AppNotification[] = [];
export const initialSetups: Setup[] = [];
