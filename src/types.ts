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
  /**
   * Contenu théorique écrit de la leçon (paragraphes séparés par une ligne
   * vide) — affiché sous la vidéo dans la modale de leçon, `undefined` tant
   * qu'aucune théorie n'a été rédigée pour cette leçon (aucune section
   * affichée dans ce cas, jamais un bloc vide).
   */
  theory?: string;
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

export interface Coach {
  id: string;
  name: string;
  role: string;
  specialty: string;
  avatar: string;
  isOnline: boolean;
  /** Absent pour un coach reconstruit depuis un vrai profil — pas de note fabriquée. */
  rating?: number;
}

/**
 * Identifiant du seul "coach" affiché côté élève — miroir client de
 * `FOUNDER_COACH_ID` (`server/db.ts`). Dupliqué plutôt que partagé via un
 * import, le client ne pouvant pas importer du code serveur (Node/
 * better-sqlite3) sans casser le bundle navigateur. Si l'un change, l'autre
 * doit changer avec lui.
 */
export const FOUNDER_COACH_ID = "coach-thomas";

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
 * Tous les plans de trading d'un élève.
 *
 * Élève : synchronisé serveur (`PUT /auth/trading-plan`, `getTradingPlan`/
 * `saveTradingPlan` dans `server/repositories.ts`), avec mise en cache locale
 * via `useSyncedState` — voir `src/App.tsx`. Le coach le consulte en lecture
 * seule dans la Vue Complète (`AdminStudentView.tsx`), sans route d'écriture
 * exposée côté staff. L'instance du bureau staff (son propre plan personnel)
 * reste en `localStorage` seul, non synchronisée — hors périmètre demandé.
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
   *
   * Champ du **bureau partagé** : il vaut pour tout le monde, un masquage est
   * donc visible par tous les comptes. Seul le compte fondateur peut le
   * modifier — le serveur réinjecte la valeur en base pour les autres
   * (`PUT /api/profile`). Ne t'appuie pas sur l'interface pour cette règle :
   * c'est le serveur qui fait autorité.
   */
  hiddenSidebarItems?: string[];
  /**
   * Autorisations de CE compte staff connecté (voir `StaffPermissionKey`,
   * src/lib/api.ts) — absent pour une session élève. `null` = toutes
   * accordées (compte fondateur, ou coach jamais restreint) : ne jamais
   * traiter `undefined`/`null` comme "aucune autorisation" (`?? []`) dans un
   * contrôle d'affichage, ce serait l'inverse du sens voulu.
   */
  permissions?: import("./lib/api").StaffPermissionKey[] | null;
}

/**
 * Statut du compte de trading de l'élève — compte démo, étape d'évaluation
 * Prop Firm, compte financé, ou capital propre. Remplace l'ancien statut
 * ("En Évaluation FTMO" / "Prop Firm Financé" / "Besoin Coaching" / "Alerte
 * Tilt") sur demande explicite : un seul statut, centré sur l'étape réelle
 * du compte plutôt que sur un jugement de suivi (coaching/tilt).
 */
export type StudentStatusTag =
  | "Compte DÉMO"
  | "Évaluation Étape 1"
  | "Évaluation Étape 2"
  | "Compte Financé"
  | "Fonds Propres";

/** Horizon de tenue des positions travaillé par l'élève. */
export type TradingStyle = "Scalping" | "Intraday" | "Swing Trading";

/**
 * Statistiques de départ de l'élève, saisies une fois au diagnostic initial
 * — distinct de `winRate`/`totalTrades` sur `EnrolledStudent`, qui suivent
 * la performance en cours dans l'app. Tous les champs sont optionnels : rien
 * n'est inventé tant que le coach ne les a pas renseignés.
 */
export interface StudentInitialDiagnostic {
  winRatePercent?: number;
  avgRR?: number;
  maxDrawdownPercent?: number;
  tradesPerWeek?: number;
  tradedCapital?: number;
  /** Même catalogue que `TradingAccount.type` (voir `AccountType`) — pas de liste distincte à maintenir. */
  accountType?: AccountType;
}

/** Catalogue fermé de points faibles récurrents, cochables sur la fiche. */
export const RECURRING_MISTAKES = [
  "Entrées trop tôt (impatience)",
  "FOMO",
  "Non-respect du plan",
  "Sorties trop tôt (peur)",
  "Revenge trading",
  "Over trading",
  "Mauvaise gestion du risque",
  "Autre",
] as const;
export type RecurringMistake = (typeof RECURRING_MISTAKES)[number];

/**
 * Une session de coaching notée — texte libre + 4 notes sur 10, saisies par
 * le coach. `label` ("Coaching N") est calculé à la création à partir du
 * nombre de sessions déjà présentes, jamais renumboté après coup (une
 * suppression au milieu ne renomme pas les suivantes). La note globale
 * n'est pas stockée : voir `computeSessionGlobalNote` dans
 * `src/lib/coachingSessionStats.ts`, seule implémentation, ne jamais la
 * dupliquer.
 */
export interface CoachingSessionNote {
  id: string;
  label: string;
  date: string;
  notes?: string;
  discipline: number;
  perceivedDifficulty: number;
  planExecution: number;
  performance: number;
}

export interface EnrolledStudent {
  id: string;
  name: string;
  /**
   * Email de contact sur la fiche staff — sert d'email de connexion à la
   * création du compte élève (voir la route d'invitation), mais **diverge**
   * dès qu'on modifie l'un des deux séparément de l'autre une fois l'accès
   * actif : le vrai email de connexion vit dans `student_accounts.email`,
   * modifiable via "Accès & connexion" (`StudentTracking.tsx`). Pour lire la
   * valeur qui fait foi une fois un accès créé, voir `api.fetchStudentTrades`
   * (champ `email` de la réponse), pas ce champ.
   */
  email: string;
  avatar: string;
  phone?: string;
  joinedDate: string;
  /**
   * Nom du coach attribué — doit correspondre au nom d'un vrai compte staff
   * (`StaffAccountSummary.name`, voir `api.listStaff`), jamais un nom
   * inventé. Optionnel : une fiche peut n'avoir aucun coach attribué.
   */
  assignedCoach?: string;
  level: string;
  /**
   * Optionnel : les anciennes valeurs "Besoin Coaching"/"Alerte Tilt"
   * (retirées, sans équivalent dans le nouveau système, voir la migration
   * `migrateStudentStatusTags` dans `server/db.ts`) laissent le champ vide
   * plutôt que de forcer une valeur arbitraire.
   */
  statusTag?: StudentStatusTag;
  /** Absent pour les fiches créées avant l'ajout du champ. */
  tradingStyle?: TradingStyle;
  courseCompletionPercentage: number;
  startingCapital: number;
  currentCapital: number;
  totalTrades: number;
  winRate: number;
  riskStatus: "🟢 Risque Maîtrisé" | "⚠️ Attention Risk" | "🔴 Sur-Risque" | "🏆 Challenge Validé";
  privateCoachNotes: string;
  /** Diagnostic initial — statistiques de départ, distinctes du suivi en cours (`winRate`/`totalTrades`). */
  initialDiagnostic?: StudentInitialDiagnostic;
  /** Points faibles récurrents identifiés, catalogue fermé (voir `RECURRING_MISTAKES`). */
  recurringMistakes?: RecurringMistake[];
  /** Historique des sessions de coaching notées — voir `CoachingSessionNote`. */
  coachingSessions?: CoachingSessionNote[];
  accounts: TradingAccount[];
  recentTrades: Trade[];
  /**
   * Identifiant du compte élève actif pour cette fiche, si le coach lui a
   * donné un accès (« Donner un accès » dans Suivi des Élèves). Absent = pas
   * de compte, `recentTrades`/`currentCapital` restent la saisie manuelle du
   * coach. Présent = ces champs deviennent obsolètes, le coach lit les vrais
   * trades via `GET /students/:id/trades`.
   */
  studentAccountId?: string;
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
  /**
   * `false` quand ce badge repose sur une donnée qu'on ne suit pas encore
   * (ex. % de risque par trade, résultats du simulateur, examen final) —
   * calculé côté client à l'affichage, jamais persisté tel quel. Absent ou
   * `true` : suivi normalement. Voir `src/lib/badges.ts`.
   */
  trackable?: boolean;
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

/**
 * Une annonce publiée par le fondateur, visible par tous les élèves — le
 * seul contenu de toute l'app qui n'est pas scopé par élève, voir le
 * commentaire de `saveAnnouncements` (`server/repositories.ts`).
 */
export type AnnouncementCategory = "Général" | "Alerte marché" | "Pédagogie" | "Événement";

export interface Announcement {
  id: string;
  title: string;
  body: string;
  category: AnnouncementCategory;
  pinned: boolean;
  /** Optionnel : capture d'écran/illustration jointe, même traitement que `Trade.chartUrl`. */
  imageUrl?: string;
  /** ISO — pour le tri chronologique (plus récent en premier). */
  createdAt: string;
}

// (Module Forum retiré — voir HANDOFF.md pour l'historique.)
