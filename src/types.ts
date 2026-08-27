export type TradeDirection = "LONG" | "SHORT";
export type TradeResult = "WIN" | "LOSS" | "BREAKEVEN" | "OPEN";
export type EmotionState = "Disciplined" | "FOMO" | "Impulsive" | "Anxious" | "Calm" | "Greedy";
export type MarketCategory = "Forex" | "Crypto" | "Indices" | "Matières Premières";
/**
 * Erreurs d'exécution récurrentes, taguées librement par l'élève sur un
 * trade (0, 1 ou plusieurs à la fois). Sert uniquement à l'analyse dans
 * Rentabilité (bloc « Erreurs les plus fréquentes ») — n'influence jamais
 * `result`/`pnl`.
 */
export type TradeMistake =
  | "Entrée anticipée"
  | "Sortie prématurée"
  | "SL trop serré"
  | "SL déplacé/retiré"
  | "Sur-risque (>1%)"
  | "Revenge trading"
  | "FOMO / Chasing"
  | "Pas de plan de trade"
  | "Sur-trading";
/**
 * Unité du champ `Trade.pnl`. Choisie librement par qui saisit le trade,
 * jamais déduite ni convertie — voir le commentaire de `Trade.pnl`.
 */
export type PnlUnit = "USD" | "PERCENT";

/**
 * Une capture d'écran attachée à un trade. `label` distingue les 3
 * emplacements par défaut (Début/Pendant/Après, voir
 * `DEFAULT_SCREENSHOT_LABELS` dans `TradingJournal.tsx`) d'une capture
 * supplémentaire à libellé libre.
 */
export interface TradeScreenshot {
  id: string;
  label: string;
  /** Data URL (capture redimensionnée côté client) ou `https://...` — jamais vide en base, un emplacement sans image n'est pas persisté. */
  url: string;
}

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
  /**
   * Compte sur lequel la position a été prise (`TradingAccount.id`).
   *
   * **Optionnel, et il doit le rester.** Les trades saisis avant l'existence
   * de ce champ n'en ont pas, et rien ne permet de deviner à quel compte les
   * rattacher — ils s'affichent « Non rattaché » jusqu'à ce que quelqu'un
   * tranche. Rendre le champ obligatoire reviendrait à inventer cette donnée.
   *
   * Un compte supprimé laisse aussi des `accountId` orphelins : traite donc
   * toujours « introuvable » comme « non rattaché », jamais comme une erreur.
   */
  accountId?: string;
  /**
   * Plan de trading suivi pour cette position (`TradingPlan.id`), choisi
   * explicitement à la saisie — jamais déduit de `strategy`. Un élève peut
   * avoir plusieurs plans (un par setup, voir `TradingPlanData` plus bas) ;
   * ce champ dit lequel s'appliquait à CE trade précis.
   *
   * **Optionnel, et il doit le rester.** Absent = trade pris hors plan,
   * volontairement ou parce qu'il a été saisi avant l'introduction de ce
   * champ — dans les deux cas, aucune vérification de conformité ne doit lui
   * être appliquée (voir `applyPlanCompliance`, `src/App.tsx`). Un plan
   * supprimé après coup laisse aussi des `tradingPlanId` orphelins : traite
   * toujours « introuvable » comme « aucun plan », jamais comme une erreur.
   */
  tradingPlanId?: string;
  pair: string; // e.g. "EUR/USD", "BTC/USDT"
  marketCategory: MarketCategory;
  direction: TradeDirection;
  entryPrice: number;
  stopLoss: number;
  takeProfit: number;
  exitPrice?: number;
  lotSize: number; // position size
  /**
   * Montant saisi librement, jamais recalculé. Son unité est `pnlUnit` : un
   * montant en $ si `"USD"` (ou absent), un pourcentage libre tapé tel quel
   * si `"PERCENT"` — dans ce cas ce n'est ni une part du capital, ni convertie
   * en $ : c'est le chiffre que l'utilisateur lit sur sa propre plateforme.
   */
  pnl: number;
  /** Optionnel : absent = `"USD"`, pour ne pas casser les trades existants. */
  pnlUnit?: PnlUnit;
  /**
   * @deprecated N'est plus jamais écrit — conservé uniquement pour la lecture
   * de données existantes créées avant l'introduction de `pnlUnit`.
   */
  pnlPercentage?: number;
  riskRewardRatio: number;
  result: TradeResult;
  strategy: string; // e.g. "SMC Orderblock", "Breakout FVG", "Liquidity Sweep"
  emotion: EmotionState;
  /** Optionnel : absent ou vide = aucune erreur taguée pour ce trade. */
  mistakes?: TradeMistake[];
  notes: string;
  /**
   * @deprecated Une seule capture d'écran, remplacée par `chartUrls`
   * (plusieurs captures labellisées : Début/Pendant/Après + supplémentaires).
   * N'est plus jamais écrit — conservé uniquement pour la lecture de trades
   * enregistrés avant cette fonctionnalité. `TradingJournal.tsx` absorbe
   * automatiquement ce champ dans `chartUrls` à l'ouverture du formulaire
   * d'édition, voir `toScreenshotSlots`.
   */
  chartUrl?: string;
  /** Captures d'écran du trade, chacune avec un libellé (Début/Pendant/Après/libre). */
  chartUrls?: TradeScreenshot[];
  /**
   * @deprecated L'audit IA Gemini a été retiré de l'application. N'est plus
   * jamais écrit — conservé uniquement pour la lecture de données existantes
   * créées avant son retrait.
   */
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
 * (calculateur de position, analyseur de setup).
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
  tradingPlanId?: string;
  notes?: string;
}

/**
 * Un plan de trading (section Pratique, module « Plan de trading »). Un
 * élève peut en avoir plusieurs — un par setup, typiquement (voir
 * `TradingPlanData` juste en dessous) — chacun avec ses propres règles de
 * risque, sessions, actifs et conditions.
 *
 * `authorizedSetups` : chaîne de noms de `Setup` séparés par des virgules,
 * choisis parmi ceux de l'élève (voir `SetupManagement.tsx`) — même format
 * texte que `matchesAny` (`src/lib/planCompliance.ts`) attendait déjà. Sert
 * de référence déclarative ("ce plan couvre ces setups") et à la règle "setup
 * non autorisé" de `checkPlanViolations` ; ne détermine PAS automatiquement
 * quel plan s'applique à un trade — voir `Trade.tradingPlanId`, choisi
 * explicitement à la saisie. L'éditeur (`TradingPlanEditorModal.tsx`) impose
 * qu'un setup ne soit jamais coché dans deux plans à la fois.
 */
export interface TradingPlan {
  id: string;
  /** Nom affiché dans la liste des plans, ex: "OPR Confluence". */
  name: string;
  authorizedSessions: string[];
  tradingHours: string;
  trackedAssets: string;
  authorizedSetups: string;
  riskPerTradePercent: string;
  maxTradesPerDay: string;
  maxDailyLossPercent: string;
  entryConditions: string;
  stopConditions: string;
  goldenRules: string;
}

/**
 * Tous les plans de trading du compte connecté — `localStorage` seul, jamais
 * synchronisé au serveur (hors périmètre, voir le commentaire sur
 * `staffTradingPlan` dans `src/App.tsx`).
 *
 * Anciennes valeurs enregistrées avant l'introduction du multi-plan : un
 * objet `TradingPlan` unique, pas un tableau. Toujours lire une valeur
 * stockée via `normalizeTradingPlans` (`src/lib/planCompliance.ts`), jamais
 * directement — voir son commentaire pour la conversion.
 */
export type TradingPlanData = TradingPlan[];

/**
 * Une stratégie de trading définie par l'élève — remplace la liste figée de
 * 6 stratégies codées en dur dans `TradingJournal.tsx` (`Trade.strategy`) et
 * sert de source pour la sélection multiple `authorizedSetups` du Plan de
 * trading. Ne pas confondre avec l'ancien module "Audit Setup" (retiré sur
 * demande explicite) : pas de scoring de confluences, juste une fiche
 * descriptive libre par stratégie.
 */
export interface Setup {
  id: string;
  name: string;
  description: string;
  entryConditions: string;
  exitConditions: string;
  timeframes: string;
  assets: string;
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
   * Clés des entrées de la sidebar masquées (modules pas encore terminés).
   * Voir SIDEBAR_TOGGLEABLE_KEYS dans components/Sidebar.tsx.
   */
  hiddenSidebarItems?: string[];
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
  /**
   * Nombre de jours d'inactivité (sans trade journalisé) tolérés par la
   * prop firm/broker avant perte du compte — règle propre à certains
   * fournisseurs, absente par défaut (pas de limite affichée).
   */
  maxInactivityDays?: number;
  /**
   * Date (YYYY-MM-DD, locale) de dernière activité renseignée à la main —
   * pour un compte tradé directement chez le broker/la prop firm sans
   * journaliser chaque position ici : le compteur d'inactivité n'aurait
   * sinon aucune date à partir de laquelle compter (0 trade rattaché =
   * "Aucun trade" en permanence, même sur un compte actif). Comparée à la
   * date du dernier trade journalisé, seule la plus récente des deux compte.
   */
  lastManualActivityDate?: string;
  /**
   * Delta appliqué par-dessus `initialBalance + PnL des trades rattachés`
   * (dépôts/retraits/frais absents du journal, ou trades non journalisés) —
   * saisi via « Ajuster le Solde » (`WalletManagement.tsx`). Stocké comme un
   * DELTA plutôt que l'équité cible directement : `syncAccountsWithTrades`
   * (`src/lib/walletStats.ts`) recalcule `equity` à chaque changement de
   * `trades`, où qu'il ait lieu dans l'app — sans ce delta persistant,
   * n'importe quel trade ajouté ailleurs écrasait silencieusement un
   * ajustement manuel antérieur. Absent ou `0` : aucun ajustement, `equity`
   * suit exactement le PnL journalisé. Trouvé en audit.
   */
  manualAdjustment?: number;
}

export interface TraderBadge {
  id: string;
  title: string;
  description: string;
  iconName: string;
  category: "DISCIPLINE" | "PROPFIRM" | "AUDIT" | "PERFORMANCE";
  unlocked: boolean;
  progressPercentage: number;
  currentValue?: number;
  targetValue?: number;
  unit?: string;
  unlockedAt?: string;
  rewardXP?: number;
  /**
   * `false` quand ce badge repose sur une donnée qu'on ne suit pas encore
   * (ex. % de risque par trade, résultats du simulateur, examen final) —
   * calculé côté client à l'affichage, jamais persisté tel quel. Absent ou
   * `true` : suivi normalement. Voir `src/lib/badges.ts`.
   */
  trackable?: boolean;
}


export type NotificationType = "signal" | "trade" | "risk" | "system";

export interface AppNotification {
  id: string;
  title: string;
  message: string;
  time: string;
  type: NotificationType;
  read: boolean;
  targetTab?: string;
}

// (Module Forum retiré — voir HANDOFF.md pour l'historique.)
