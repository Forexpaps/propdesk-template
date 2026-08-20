import React, { useState, useRef, useEffect } from "react";
import {
  User,
  ShieldCheck,
  Award,
  Zap,
  Smile,
  Sparkles,
  Flame,
  Target,
  TrendingUp,
  Crown,
  Camera,
  CheckCircle2,
  Upload,
  Clock,
  Lock,
  Trophy,
  Star,
  Check,
  ShieldAlert,
  DatabaseBackup,
  Download,
  KeyRound,
} from "lucide-react";
import { StudentProfile, TraderBadge } from "../types";
import { resizeAvatar, AVATAR_SIZE } from "../lib/image";
import { api } from "../lib/api";
import { confirmDialog } from "../lib/confirmDialog";
import { ChangeOwnPasswordModal } from "./ChangeOwnPasswordModal";
import { TwoFactorSetupModal } from "./TwoFactorSetupModal";
import { ExportDataButton } from "./ExportDataButton";

const SectionHeader: React.FC<{ children?: React.ReactNode; color?: string }> = ({
  children,
  color = "bg-[#00E676]",
}) => (
  <span className="inline-flex items-center gap-2">
    <span className={`w-1 h-4 rounded-full ${color} shrink-0`} />
    {children}
  </span>
);

interface UserProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  student: StudentProfile;
  badges?: TraderBadge[];
  onSaveProfile: (updatedProfile: StudentProfile) => void;
  onClaimBadge?: (badgeId: string) => void;
  initialTab?: "profile" | "badges";
  /** Ouvre la gestion des comptes staff. Absent : replié sur l'ancien badge statique. */
  onOpenStaffAccounts?: () => void;
  /**
   * Ouvre le journal de sécurité. Absent : le bouton ne s'affiche pas du
   * tout — ce composant ne connaît pas `isOwner` lui-même, c'est son parent
   * qui décide de fournir ou non ce callback (réservé au fondateur).
   */
  onOpenSecurityLog?: () => void;
  /**
   * Restreint le formulaire à la seule photo de profil — mode élève. Le
   * reste de la fiche (nom, email, rôle, niveau, bio) est géré par le coach
   * sur `StudentTracking.tsx`, jamais par l'élève lui-même : ces champs
   * passent en lecture seule et le bloc "Mode Administrateur / Staff" (qui ne
   * concerne que le bureau staff) ne s'affiche pas. `onSaveProfile` ne reçoit
   * alors qu'un objet dont seul `avatar` a pu changer.
   */
  avatarOnly?: boolean;
}

/**
 * Titres de rang par niveau — 5 paliers répartis sur le total d'XP
 * réellement disponible (somme de `rewardXP` sur le catalogue de badges
 * fourni), jamais une borne fixe. Avant ce correctif, "NIVEAU 4" et
 * "Progression Niveau 5 : X / 3 000 XP" étaient codés en dur, indépendants
 * du vrai total (repéré par l'utilisateur : 3650 XP affiché comme
 * "en cours vers 3000", donc au-delà de son propre objectif).
 */
const LEVEL_TITLES = [
  "Trader Débutant",
  "Trader Initié",
  "Trader SMC Confirmé",
  "Trader SMC Avancé",
  "Trader SMC Élite",
];

interface LevelInfo {
  levelIndex: number;
  title: string;
  isMaxLevel: boolean;
  xpFloor: number;
  xpCeil: number;
  progressPercent: number;
}

function computeLevelInfo(totalXP: number, badges: TraderBadge[]): LevelInfo {
  const maxXP = badges.reduce((sum, b) => sum + (b.rewardXP || 0), 0);
  const levelCount = LEVEL_TITLES.length;

  if (maxXP <= 0) {
    return { levelIndex: 1, title: LEVEL_TITLES[0], isMaxLevel: false, xpFloor: 0, xpCeil: 0, progressPercent: 0 };
  }

  const thresholds = Array.from({ length: levelCount + 1 }, (_, i) => Math.round((maxXP * i) / levelCount));

  let levelIndex = 1;
  while (levelIndex < levelCount && totalXP >= thresholds[levelIndex]) {
    levelIndex++;
  }

  const xpFloor = thresholds[levelIndex - 1];
  const xpCeil = thresholds[levelIndex];
  const isMaxLevel = levelIndex === levelCount && totalXP >= xpCeil;
  const progressPercent = isMaxLevel
    ? 100
    : Math.min(100, Math.round(((totalXP - xpFloor) / Math.max(1, xpCeil - xpFloor)) * 100));

  return { levelIndex, title: LEVEL_TITLES[levelIndex - 1], isMaxLevel, xpFloor, xpCeil, progressPercent };
}

const AVATAR_PRESETS = [
  "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=250",
  "https://images.unsplash.com/photo-1560250097-0b93528c311a?auto=format&fit=crop&q=80&w=250",
  "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&q=80&w=250",
  "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&q=80&w=250",
  "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&q=80&w=250",
  "https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&q=80&w=250",
];

export const UserProfileModal: React.FC<UserProfileModalProps> = ({
  isOpen,
  onClose,
  student,
  badges = [],
  onSaveProfile,
  onClaimBadge,
  initialTab = "profile",
  onOpenStaffAccounts,
  onOpenSecurityLog,
  avatarOnly = false,
}) => {
  const [activeSubTab, setActiveSubTab] = useState<"profile" | "badges">(initialTab);
  const [badgeFilter, setBadgeFilter] = useState<string>("ALL");

  const [name, setName] = useState(student.name);
  const [email, setEmail] = useState(student.email);
  const [avatar, setAvatar] = useState(student.avatar);
  const [level, setLevel] = useState(student.level);
  // Repli du sous-titre affiché sous le nom (voir le rendu plus bas) : un
  // élève qui n'a jamais eu de `role` personnalisé voyait jusqu'ici
  // "Élève Premium", une étiquette générique sans rapport avec sa vraie
  // progression — remplacé par son niveau réel (`student.level`, déjà le
  // champ affiché en bas de la sidebar élève, voir Sidebar.tsx), sur
  // demande explicite de l'utilisateur.
  const [role, setRole] = useState(
    student.role || (student.isAdmin ? "Fondateur / Head Coach" : student.level)
  );
  const [phone, setPhone] = useState(student.phone || "+33 6 12 34 56 78");
  const [bio, setBio] = useState(student.bio || "");
  const [preferredPairs, setPreferredPairs] = useState(
    student.preferredPairs || "EUR/USD, XAU/USD, NAS100"
  );
  /**
   * Statut d'administrateur, en lecture seule.
   *
   * Ce n'est plus un état local éditable : le serveur retire `isAdmin` du corps
   * de PUT /api/profile et réinjecte la valeur qu'il détient. Un état local
   * laisserait croire que le basculer a un effet.
   */
  const isAdmin = student.isAdmin === true;
  /** Le décodage puis le rendu d'une grande image ne sont pas instantanés. */
  const [isResizing, setIsResizing] = useState(false);

  /** Photo téléversée (data URI) plutôt qu'une URL distante. */
  const isImported = avatar.startsWith("data:");

  // La modale reste montée entre deux ouvertures : sans cette resynchronisation,
  // tous les champs du formulaire (pas seulement `initialTab`) restaient figés
  // à leur toute première valeur de montage — annuler une modification sans
  // sauvegarder, puis rouvrir la modale, réaffichait la valeur "annulée" au
  // lieu de la vraie valeur de `student`, avec le risque de la persister par
  // erreur à la sauvegarde suivante.
  useEffect(() => {
    if (!isOpen) return;
    setActiveSubTab(initialTab);
    setName(student.name);
    setEmail(student.email);
    setAvatar(student.avatar);
    setLevel(student.level);
    setRole(student.role || (student.isAdmin ? "Fondateur / Head Coach" : student.level));
    setPhone(student.phone || "+33 6 12 34 56 78");
    setBio(student.bio || "");
    setPreferredPairs(student.preferredPairs || "EUR/USD, XAU/USD, NAS100");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, initialTab]);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Données & Sauvegarde — export/import JSON de tout le bureau de
  // l'utilisateur connecté (profil, trades, comptes, modules, messages,
  // badges, notifications, résultats de quiz). Aucune réinitialisation
  // destructrice ici, volontairement : voir `server/routes.ts`,
  // POST /state/restore.
  const [isChangePasswordOpen, setIsChangePasswordOpen] = useState(false);
  const [isTwoFactorOpen, setIsTwoFactorOpen] = useState(false);

  const backupFileInputRef = useRef<HTMLInputElement>(null);
  const [backupStatus, setBackupStatus] = useState<
    | { kind: "idle" }
    | { kind: "busy"; message: string }
    | { kind: "success"; message: string }
    | { kind: "error"; message: string }
  >({ kind: "idle" });

  const handleExportBackup = async () => {
    setBackupStatus({ kind: "busy", message: "Export en cours…" });
    try {
      const state = await api.fetchState();
      const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `propdesk-sauvegarde-${new Date().toISOString().split("T")[0]}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      setBackupStatus({ kind: "success", message: "Sauvegarde téléchargée." });
    } catch {
      setBackupStatus({ kind: "error", message: "L'export a échoué. Réessaie." });
    }
  };

  const handleImportBackupFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    // Sans réinitialiser la valeur, resélectionner le même fichier après une
    // erreur n'émettrait aucun évènement.
    e.target.value = "";
    if (!file) return;

    // Restaurer une sauvegarde REMPLACE les collections concernées (mêmes
    // règles qu'un PUT /collections/:name normal, voir server/routes.ts) —
    // ce n'est pas un ajout. Confirmation explicite avant d'agir.
    if (
      !(await confirmDialog(
        "Importer ce fichier va remplacer tes données actuelles (trades, comptes, modules, badges...) par celles du fichier. Cette action ne peut pas être annulée. Continuer ?",
        { title: "Restaurer une sauvegarde", confirmLabel: "Importer", danger: true }
      ))
    ) {
      return;
    }

    setBackupStatus({ kind: "busy", message: "Restauration en cours…" });
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      const result = await api.restoreState({
        student: parsed.student ?? undefined,
        collections: parsed.collections ?? undefined,
        quizResults: parsed.quizResults ?? undefined,
      });
      setBackupStatus({
        kind: "success",
        message: `Restauration terminée (${result.imported.length} élément(s)). Rechargement de la page…`,
      });
      setTimeout(() => window.location.reload(), 1200);
    } catch {
      setBackupStatus({
        kind: "error",
        message: "Ce fichier n'a pas pu être importé — vérifie qu'il s'agit bien d'un export PropDesk.",
      });
    }
  };

  if (!isOpen) return null;

  /**
   * L'image est réduite avant d'entrer dans l'état : le profil est sérialisé
   * en base, dans `/api/state` et dans le cache localStorage, une image brute
   * y pèserait donc son poids trois fois (voir `lib/image.ts`).
   */
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    // Le champ garde le fichier sélectionné : sans cela, re-choisir la même
    // image après une erreur n'émettrait aucun évènement.
    e.target.value = "";
    if (!file) return;

    // Garde-fou sur le décodage, pas sur le stockage : après réduction, la
    // taille du fichier d'origine n'a plus d'incidence.
    if (file.size > 20 * 1024 * 1024) {
      alert("L'image choisie est trop volumineuse (max 20 Mo). Veuillez en choisir une autre.");
      return;
    }

    setIsResizing(true);
    try {
      setAvatar(await resizeAvatar(file));
    } catch (err) {
      console.error("[horizon] Redimensionnement de l'avatar échoué.", err);
      alert("Cette image n'a pas pu être lue. Essayez un autre fichier (JPEG, PNG ou WebP).");
    } finally {
      setIsResizing(false);
    }
  };

  /**
   * Construit le profil à envoyer, à partir de l'état local du formulaire.
   * Extrait de `handleSubmit` pour être aussi appelable depuis l'onglet
   * Badges & Succès (bouton "Enregistrer" hors `<form>`) : l'état des champs
   * du formulaire persiste entre les deux onglets (pas de reset au
   * changement d'onglet), donc un enregistrement déclenché depuis Badges
   * capture bien les mêmes modifications que depuis Profil & Options.
   */
  const buildUpdatedProfile = (): StudentProfile =>
    avatarOnly
      ? // Seule la photo peut changer ici : le reste part de `student`
        // (la source de vérité), jamais de l'état local du formulaire — au
        // cas où celui-ci contiendrait une frappe dans un champ pourtant
        // désactivé (ex: autofill du navigateur).
        { ...student, avatar }
      : {
          ...student,
          name,
          email,
          avatar,
          level,
          role,
          phone,
          bio,
          preferredPairs,
          // `startingCapital`/`currentCapital` ne sont plus édités ici : ils sont
          // dérivés des portefeuilles réels à l'affichage (voir `App.tsx`,
          // `displayStudent`/`studentProfile`). Le `...student` initial les
          // conserve tels quels dans le payload envoyé au serveur.
          // `isAdmin` n'est volontairement pas renvoyé : le serveur l'ignore dans le
          // corps et réinjecte sa propre valeur. Le `...student` initial le conserve
          // pour que l'état local reste cohérent d'ici au prochain rechargement.
        };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSaveProfile(buildUpdatedProfile());
    onClose();
  };

  const handleSaveFromBadgesTab = () => {
    onSaveProfile(buildUpdatedProfile());
    onClose();
  };

  // Badge calculations
  const unlockedBadgesCount = badges.filter((b) => b.unlocked).length;
  const totalXP = badges
    .filter((b) => b.unlocked)
    .reduce((acc, b) => acc + (b.rewardXP || 200), 0);
  const levelInfo = computeLevelInfo(totalXP, badges);

  const getBadgeIcon = (iconName: string, unlocked: boolean) => {
    const cls = unlocked ? "w-5 h-5 text-[#00E676]" : "w-5 h-5 text-slate-500";
    switch (iconName) {
      case "ShieldCheck":
        return <ShieldCheck className={cls} />;
      case "Award":
        return <Award className={cls} />;
      case "Zap":
        return <Zap className={cls} />;
      case "Smile":
        return <Smile className={cls} />;
      case "Sparkles":
        return <Sparkles className={cls} />;
      case "Flame":
        return <Flame className={cls} />;
      case "Target":
        return <Target className={cls} />;
      case "TrendingUp":
        return <TrendingUp className={cls} />;
      case "Crown":
        return <Crown className={cls} />;
      default:
        return <Trophy className={cls} />;
    }
  };

  const filteredBadges = badges.filter((b) => {
    if (badgeFilter === "ALL") return true;
    if (badgeFilter === "UNLOCKED") return b.unlocked;
    if (badgeFilter === "IN_PROGRESS") return !b.unlocked;
    return b.category === badgeFilter;
  });

  return (
    <div className="fixed inset-0 z-50 bg-[#0D1110]/80 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto font-sans">
      <div className="bg-[#111615] border border-[#1B2320] rounded-2xl max-w-3xl w-full shadow-2xl relative my-8 text-slate-100 max-h-[calc(100vh-4rem)] flex flex-col overflow-hidden">
        {/* Modal Header — collée en haut (sticky) : sur un profil avec beaucoup
            de contenu (bio longue, badges nombreux), le corps défile sous cet
            en-tête sans jamais le faire disparaître, et sans jamais pousser le
            haut de la modale hors de l'écran (bug de centrage Safari observé
            avec `items-center` + `overflow-y-auto` sur le conteneur externe
            quand l'enfant dépasse la hauteur de l'écran : le début du contenu
            devient inatteignable au lieu de défiler). Voir aussi
            StaffAccountsModal.tsx et StudentTracking.tsx, même correctif. */}
        <div className="shrink-0 sticky top-0 z-10 bg-[#111615] px-6 pt-6 pb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#1B2320]">
          <div className="flex items-center gap-3">
            <img
              src={avatar}
              alt={name}
              className="w-11 h-11 rounded-full object-cover border-2 border-[#00E676]"
            />
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base sm:text-lg font-bold text-white">{name}</h3>
                {isAdmin && (
                  <span className="px-2 py-0.5 rounded bg-[#00E676]/15 text-[#00E676] border border-[#00E676]/30 text-[10px] font-mono font-bold">
                    Admin / Coach
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400">{role || "Élève Horizon SMC"}</p>
            </div>
          </div>

          {/* SubTab Switches */}
          <div className="flex items-center gap-1.5 bg-[#0D1110] p-1 rounded-xl border border-[#1B2320]">
            <button
              onClick={() => setActiveSubTab("profile")}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-2 ${
                activeSubTab === "profile"
                  ? "bg-[#1B2320] text-white shadow-sm"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              <User className="w-4 h-4 text-[#00E676]" />
              <span>Profil & Options</span>
            </button>

            <button
              onClick={() => setActiveSubTab("badges")}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-2 ${
                activeSubTab === "badges"
                  ? "bg-[#1B2320] text-white shadow-sm"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              <Trophy className="w-4 h-4 text-amber-400" />
              <span>Badges & Succès</span>
              <span className="px-1.5 py-0.5 rounded-full bg-[#00E676]/20 text-[#00E676] text-[10px] font-mono font-bold">
                {unlockedBadgesCount}/{badges.length}
              </span>
            </button>
          </div>
        </div>

        {/* Corps défilant : seule cette zone scrolle, l'en-tête ci-dessus reste
            fixe. `px-6 py-5` reprend le padding que portait autrefois la carte
            entière (`p-6`), désormais retiré de la carte elle-même. */}
        <div className="flex-1 overflow-y-auto px-6 py-5">
        {/* TAB 1: PROFILE & OPTIONS */}
        {activeSubTab === "profile" && (
          <form onSubmit={handleSubmit} className="space-y-5 text-xs">
            {/* Avatar Section */}
            <div className="space-y-3 bg-[#0D1110] p-4 rounded-xl border border-[#1B2320]">
              <label className="block font-medium text-slate-300">Photo de Profil</label>
              <div className="flex flex-col sm:flex-row items-center gap-4">
                <div className="relative group shrink-0">
                  <img
                    src={avatar}
                    alt={name}
                    className="w-20 h-20 rounded-full object-cover border-2 border-[#00E676] shadow-lg"
                  />
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="absolute inset-0 rounded-full bg-[#0D1110]/70 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center text-[#00E676] text-[10px] font-bold gap-0.5"
                  >
                    <Camera className="w-4 h-4" />
                    <span>Changer</span>
                  </button>
                </div>

                <div className="space-y-2.5 flex-1 w-full">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleFileUpload}
                    className="hidden"
                  />

                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isResizing}
                    className="w-full py-2 px-3 rounded-xl bg-[#1B2320] hover:bg-[#232D29] border border-[#1B2320] text-slate-200 font-bold flex items-center justify-center gap-2 transition-all disabled:opacity-60"
                  >
                    <Upload className="w-4 h-4 text-[#00E676]" />
                    <span>
                      {isResizing
                        ? "Optimisation de l'image…"
                        : "Importer une photo perso (.PNG, .JPG)"}
                    </span>
                  </button>

                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-slate-500 shrink-0">Ou URL:</span>
                    {/* Une image importée est un data URI de plusieurs dizaines de
                        milliers de caractères : l'afficher ici n'apprendrait rien
                        et rendrait le champ inutilisable. */}
                    {isImported ? (
                      <div className="w-full flex items-center justify-between gap-2 bg-[#111615] border border-[#1B2320] rounded-lg px-2.5 py-1">
                        <span className="text-[11px] text-slate-400 truncate">
                          Photo importée · optimisée en {AVATAR_SIZE}×{AVATAR_SIZE}
                        </span>
                        <button
                          type="button"
                          onClick={() => setAvatar(AVATAR_PRESETS[0])}
                          className="text-[10px] font-bold text-slate-500 hover:text-[#00E676] shrink-0"
                        >
                          Effacer
                        </button>
                      </div>
                    ) : (
                      <input
                        type="text"
                        value={avatar}
                        onChange={(e) => setAvatar(e.target.value)}
                        placeholder="https://..."
                        className="w-full bg-[#111615] border border-[#1B2320] rounded-lg px-2.5 py-1 text-white text-[11px] focus:outline-none focus:border-[#00E676] font-mono"
                      />
                    )}
                  </div>

                  <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
                    <span className="text-[10px] text-slate-500 shrink-0">Présélections:</span>
                    {AVATAR_PRESETS.map((url, i) => (
                      <button
                        key={i}
                        type="button"
                        onClick={() => setAvatar(url)}
                        className={`w-6 h-6 rounded-full overflow-hidden border transition-all shrink-0 ${
                          avatar === url
                            ? "border-[#00E676] scale-110 shadow-[0_0_8px_rgba(0,230,118,0.5)]"
                            : "border-[#1B2320] opacity-60 hover:opacity-100"
                        }`}
                      >
                        <img src={url} alt="preset" className="w-full h-full object-cover" />
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Admin Toggle — bureau staff uniquement, aucun sens pour un élève */}
            {!avatarOnly && (
            <div className="bg-[#0D1110] p-4 rounded-xl border border-[#1B2320] flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <Crown className="w-6 h-6 text-[#00E676] shrink-0" />
                <div>
                  <div className="text-sm font-bold text-white flex items-center gap-2">
                    Mode Administrateur / Staff
                    {isAdmin && (
                      <span className="px-2 py-0.5 rounded bg-[#00E676]/15 text-[#00E676] border border-[#00E676]/30 text-[10px] font-mono font-bold">
                        ACTIF 👑
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-400">
                    Accès au suivi complet des élèves, édition des fiches et gestion des portefeuilles.
                  </p>
                </div>
              </div>

              {/* Ce statut n'est plus un interrupteur : un interrupteur ici
                  permettait de s'auto-promouvoir, et le serveur ignore
                  désormais ce champ dans le corps de PUT /api/profile. Les
                  comptes staff ont les mêmes droits métier — ce bouton mène à
                  leur gestion (inviter, révoquer), pas à un réglage de rôle.
                  La seule distinction est le compte fondateur, qui règle les
                  modules visibles ; elle ne s'édite pas, elle se constate. */}
              {onOpenStaffAccounts ? (
                <button
                  type="button"
                  onClick={onOpenStaffAccounts}
                  className="px-3 py-2 rounded-xl text-[11px] font-bold text-slate-950 bg-[#00E676] hover:bg-[#00c865] shrink-0 transition-colors"
                >
                  Gérer l'équipe
                </button>
              ) : (
                <span className="px-3 py-2 rounded-xl text-[11px] font-medium text-slate-400 bg-[#0D1110] border border-[#1B2320] shrink-0 text-center">
                  Défini côté serveur
                </span>
              )}
            </div>
            )}

            {/* Mon mot de passe — n'importe quel compte staff peut changer le
                sien, ce n'est pas réservé au fondateur (même route serveur
                que le changement FORCÉ après invitation, `ChangePasswordScreen.tsx` —
                ici volontaire, self-service, depuis une session déjà active).
                Absent du mode élève (`avatarOnly`) : rien à voir avec la
                photo de profil, et un élève a son propre flux dédié
                (changement de mot de passe forcé après invitation, plus lien
                de réinitialisation généré par le staff — voir
                StudentTracking.tsx). */}
            {!avatarOnly && (
              <div className="bg-[#0D1110] p-4 rounded-xl border border-[#1B2320] flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <KeyRound className="w-6 h-6 text-[#00E676] shrink-0" />
                  <div>
                    <div className="text-sm font-bold text-white">Mon mot de passe</div>
                    <p className="text-xs text-slate-400">Modifie le mot de passe de ce compte.</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsChangePasswordOpen(true)}
                  className="px-3 py-2 rounded-xl text-[11px] font-bold text-slate-950 bg-[#00E676] hover:bg-[#00c865] shrink-0 transition-colors"
                >
                  Modifier
                </button>
              </div>
            )}

            {/* Authentification à deux facteurs — n'importe quel compte
                staff peut l'activer pour lui-même, ce n'est pas réservé au
                fondateur (même raisonnement que "Mon mot de passe"
                juste au-dessus). Absent du mode élève (`avatarOnly`) : les
                comptes élève n'ont pas de 2FA. */}
            {!avatarOnly && (
              <div className="bg-[#0D1110] p-4 rounded-xl border border-[#1B2320] flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <ShieldCheck className="w-6 h-6 text-[#00E676] shrink-0" />
                  <div>
                    <div className="text-sm font-bold text-white">Authentification à deux facteurs</div>
                    <p className="text-xs text-slate-400">Ajoute un code à usage unique à la connexion.</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsTwoFactorOpen(true)}
                  className="px-3 py-2 rounded-xl text-[11px] font-bold text-slate-950 bg-[#00E676] hover:bg-[#00c865] shrink-0 transition-colors"
                >
                  Gérer
                </button>
              </div>
            )}

            {/* Journal de sécurité — réservé au compte fondateur. Le bouton
                ne s'affiche que si le parent fournit onOpenSecurityLog
                (conditionné par isOwner, jamais par isAdmin). */}
            {onOpenSecurityLog && (
              <div className="bg-[#0D1110] p-4 rounded-xl border border-[#1B2320] flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <ShieldAlert className="w-6 h-6 text-[#00E676] shrink-0" />
                  <div>
                    <div className="text-sm font-bold text-white">Journal de sécurité</div>
                    <p className="text-xs text-slate-400">
                      Connexions, échecs, verrouillages et accès refusés sur ton écosystème.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={onOpenSecurityLog}
                  className="px-3 py-2 rounded-xl text-[11px] font-bold text-slate-950 bg-[#00E676] hover:bg-[#00c865] shrink-0 transition-colors"
                >
                  Consulter
                </button>
              </div>
            )}

            {/* Données & Sauvegarde — export/import JSON de tout le bureau
                de l'utilisateur connecté. Disponible aux deux mondes (staff
                et élève), chacun n'agissant que sur ses propres données —
                voir POST /state/restore. Pas de bouton de réinitialisation
                destructrice, décision explicite (voir HANDOFF §7.3). */}
            <div className="bg-[#0D1110] p-4 rounded-xl border border-[#1B2320] space-y-3">
              <div className="flex items-center gap-3">
                <DatabaseBackup className="w-6 h-6 text-[#00E676] shrink-0" />
                <div>
                  <div className="text-sm font-bold text-white">Données & Sauvegarde</div>
                  <p className="text-xs text-slate-400">
                    Exporte toutes tes données dans un fichier JSON, ou restaure une sauvegarde précédente.
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={handleExportBackup}
                  disabled={backupStatus.kind === "busy"}
                  className="px-3 py-2 rounded-xl text-[11px] font-bold text-slate-950 bg-[#00E676] hover:bg-[#00c865] disabled:opacity-50 shrink-0 transition-colors flex items-center gap-1.5"
                >
                  <Download className="w-3.5 h-3.5" />
                  Exporter mes données
                </button>

                <button
                  type="button"
                  onClick={() => backupFileInputRef.current?.click()}
                  disabled={backupStatus.kind === "busy"}
                  className="px-3 py-2 rounded-xl text-[11px] font-bold text-slate-300 bg-[#1B2320] hover:bg-[#232D29] disabled:opacity-50 shrink-0 transition-colors flex items-center gap-1.5"
                >
                  <Upload className="w-3.5 h-3.5" />
                  Importer une sauvegarde
                </button>
                <input
                  ref={backupFileInputRef}
                  type="file"
                  accept="application/json"
                  onChange={(e) => void handleImportBackupFile(e)}
                  className="hidden"
                />
              </div>

              {backupStatus.kind !== "idle" && (
                <p
                  className={`text-[11px] ${
                    backupStatus.kind === "error"
                      ? "text-rose-400"
                      : backupStatus.kind === "success"
                      ? "text-[#00E676]"
                      : "text-slate-400"
                  }`}
                >
                  {backupStatus.message}
                </p>
              )}
            </div>

            {/* Export RGPD (Article 20) — réservé à l'élève, sur sa propre
                fiche : ce sont ses données. Distinct du bloc générique
                juste au-dessus (sauvegarde technique complète). */}
            {avatarOnly && (
              <ExportDataButton className="bg-[#0D1110] p-4 rounded-xl border border-[#1B2320]" />
            )}

            {avatarOnly && (
              <p className="text-[11px] text-slate-500 -mt-1">
                Seule ta photo de profil est modifiable ici — le reste de ta fiche est géré par ton coach,
                contacte-le via la Messagerie pour une modification.
              </p>
            )}

            {/* Inputs Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block font-medium text-slate-300 mb-1">Nom complet</label>
                <input
                  type="text"
                  required
                  disabled={avatarOnly}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full bg-[#0D1110] border border-[#1B2320] rounded-xl px-3.5 py-2.5 text-white focus:outline-none focus:border-[#00E676] disabled:opacity-50 disabled:cursor-not-allowed"
                />
              </div>

              <div>
                <label className="block font-medium text-slate-300 mb-1">Adresse Email</label>
                <input
                  type="email"
                  required
                  disabled={avatarOnly}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-[#0D1110] border border-[#1B2320] rounded-xl px-3.5 py-2.5 text-white focus:outline-none focus:border-[#00E676] disabled:opacity-50 disabled:cursor-not-allowed"
                />
              </div>

              <div>
                <label className="block font-medium text-slate-300 mb-1">Rôle / Titre</label>
                <input
                  type="text"
                  disabled={avatarOnly}
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                  className="w-full bg-[#0D1110] border border-[#1B2320] rounded-xl px-3.5 py-2.5 text-white focus:outline-none focus:border-[#00E676] disabled:opacity-50 disabled:cursor-not-allowed"
                />
              </div>

              <div>
                <label className="block font-medium text-slate-300 mb-1">Niveau SMC</label>
                <input
                  type="text"
                  disabled={avatarOnly}
                  value={level}
                  onChange={(e) => setLevel(e.target.value)}
                  className="w-full bg-[#0D1110] border border-[#1B2320] rounded-xl px-3.5 py-2.5 text-white focus:outline-none focus:border-[#00E676] disabled:opacity-50 disabled:cursor-not-allowed"
                />
              </div>

            </div>

            <div>
              <label className="block font-medium text-slate-300 mb-1">Bio & Présentation</label>
              <textarea
                rows={2}
                disabled={avatarOnly}
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                className="w-full bg-[#0D1110] border border-[#1B2320] rounded-xl p-3 text-white focus:outline-none focus:border-[#00E676] disabled:opacity-50 disabled:cursor-not-allowed"
              />
            </div>

            <div className="flex items-center justify-end gap-3 pt-4 border-t border-[#1B2320]">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2.5 rounded-xl bg-[#1B2320] hover:bg-[#232D29] text-slate-300 font-bold"
              >
                Annuler
              </button>
              <button
                type="submit"
                className="px-5 py-2.5 rounded-xl bg-[#00E676] hover:bg-[#00c865] text-slate-950 font-extrabold flex items-center gap-1.5 shadow-md"
              >
                <CheckCircle2 className="w-4 h-4" /> Enregistrer
              </button>
            </div>
          </form>
        )}

        {/* TAB 2: BADGES & PROGRESSION */}
        {activeSubTab === "badges" && (
          <div className="space-y-6">
            {/* Top XP Level Header Card */}
            <div className="bg-[#111615] border border-[#1B2320] rounded-xl p-5 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <SectionHeader />
                    <Crown className="w-5 h-5 text-amber-400" />
                    <h4 className="text-base font-bold text-white">Rang : {levelInfo.title}</h4>
                    <span className="px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-300 text-[10px] font-mono font-bold border border-amber-500/30">
                      NIVEAU {levelInfo.levelIndex}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400">
                    Gagne des points d'expérience (XP) en accomplissant tes objectifs de trading et d'apprentissage.
                  </p>
                </div>

                <div className="bg-[#0D1110] border border-[#1B2320] p-3 rounded-xl flex items-center gap-4 text-xs font-mono shrink-0">
                  <div>
                    <span className="text-slate-500 block text-[9px] uppercase tracking-wider font-bold">BADGES DÉBLOQUÉS</span>
                    <span className="text-[#00E676] font-bold text-base">
                      {unlockedBadgesCount} / {badges.length}
                    </span>
                  </div>
                  <div className="w-px h-8 bg-[#1B2320]" />
                  <div>
                    <span className="text-slate-500 block text-[9px] uppercase tracking-wider font-bold">TOTAL XP GAGNÉS</span>
                    <span className="text-amber-400 font-bold text-base">{totalXP} XP</span>
                  </div>
                </div>
              </div>

              {/* Progress Bar to next level */}
              <div className="space-y-1.5 pt-1">
                <div className="flex items-center justify-between text-xs text-slate-400 font-mono">
                  <span>
                    {levelInfo.isMaxLevel
                      ? "Niveau maximum atteint"
                      : `Progression Niveau ${levelInfo.levelIndex + 1}`}
                  </span>
                  <span>
                    {levelInfo.isMaxLevel
                      ? `${totalXP} XP · tous les badges débloqués`
                      : `${totalXP} / ${levelInfo.xpCeil} XP`}
                  </span>
                </div>
                <div className="w-full h-2.5 bg-[#1B2320] rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-[#00E676] to-amber-400 rounded-full transition-all duration-500"
                    style={{ width: `${levelInfo.progressPercent}%` }}
                  />
                </div>
              </div>
            </div>

            {/* Category Filter Pills */}
            <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs font-medium">
              {[
                { id: "ALL", label: `Tous (${badges.length})` },
                { id: "UNLOCKED", label: `Débloqués (${unlockedBadgesCount})` },
                { id: "IN_PROGRESS", label: `En cours (${badges.length - unlockedBadgesCount})` },
                { id: "DISCIPLINE", label: "Discipline" },
                { id: "ACADEMY", label: "Académie" },
                { id: "PERFORMANCE", label: "Performance" },
                { id: "PROPFIRM", label: "Prop Firm" },
              ].map((f) => (
                <button
                  key={f.id}
                  onClick={() => setBadgeFilter(f.id)}
                  className={`px-3 py-1.5 rounded-xl border transition-all whitespace-nowrap ${
                    badgeFilter === f.id
                      ? "bg-[#00E676]/15 border-[#00E676]/40 text-[#00E676] font-bold"
                      : "bg-[#0D1110] border-[#1B2320] text-slate-400 hover:text-white"
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>

            {/* Badges Cards Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-h-[420px] overflow-y-auto pr-1">
              {filteredBadges.map((badge) => {
                const isTrackable = badge.trackable !== false;
                const canClaim = isTrackable && !badge.unlocked && badge.progressPercentage >= 100;

                return (
                  <div
                    key={badge.id}
                    className={`p-4 rounded-xl border transition-all space-y-3 flex flex-col justify-between ${
                      badge.unlocked
                        ? "bg-[#111615] border-[#00E676]/30"
                        : canClaim
                        ? "bg-[#111615] border-amber-500/50 animate-pulse"
                        : "bg-[#111615]/50 border-[#1B2320] opacity-80"
                    }`}
                  >
                    <div className="space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-3">
                          <div
                            className={`w-10 h-10 rounded-xl flex items-center justify-center border shrink-0 ${
                              badge.unlocked
                                ? "bg-[#00E676]/15 border-[#00E676]/40"
                                : canClaim
                                ? "bg-amber-500/20 border-amber-500/50"
                                : "bg-[#1B2320] border-[#1B2320]"
                            }`}
                          >
                            {getBadgeIcon(badge.iconName, badge.unlocked || canClaim)}
                          </div>

                          <div>
                            <h4 className="text-sm font-bold text-white flex items-center gap-1.5">
                              {badge.title}
                            </h4>
                            <span className="text-[9px] font-mono text-slate-500 uppercase tracking-wider">
                              {badge.category}
                            </span>
                          </div>
                        </div>

                        {badge.rewardXP && (
                          <span className="px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20 text-[10px] font-mono font-bold shrink-0">
                            +{badge.rewardXP} XP
                          </span>
                        )}
                      </div>

                      <p className="text-xs text-slate-400 leading-relaxed">
                        {badge.description}
                      </p>
                    </div>

                    {/* Progress & Actions */}
                    <div className="space-y-2 pt-2 border-t border-[#1B2320]">
                      {badge.unlocked ? (
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-[#00E676] font-bold flex items-center gap-1">
                            <Check className="w-4 h-4" /> Débloqué
                          </span>
                          {badge.unlockedAt && (
                            <span className="text-[11px] text-slate-500 font-mono">
                              {badge.unlockedAt}
                            </span>
                          )}
                        </div>
                      ) : canClaim ? (
                        <button
                          onClick={() => onClaimBadge && onClaimBadge(badge.id)}
                          className="w-full py-2 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-extrabold text-xs flex items-center justify-center gap-1.5 shadow-md transition-all cursor-pointer"
                        >
                          <Sparkles className="w-4 h-4" /> Réclamer le Badge (+{badge.rewardXP} XP)
                        </button>
                      ) : !isTrackable ? (
                        <div className="flex items-center gap-1.5 text-[11px] text-slate-500 italic">
                          <Lock className="w-3.5 h-3.5 shrink-0" />
                          Suivi pas encore disponible pour ce badge
                        </div>
                      ) : (
                        <div className="space-y-1">
                          <div className="flex items-center justify-between text-[11px] text-slate-400 font-mono">
                            <span>
                              {badge.currentValue !== undefined && badge.targetValue !== undefined
                                ? `${badge.currentValue} / ${badge.targetValue} ${badge.unit || ""}`
                                : `Progression`}
                            </span>
                            <span>{Math.round(badge.progressPercentage)}%</span>
                          </div>
                          <div className="w-full h-1.5 bg-[#1B2320] rounded-full overflow-hidden">
                            <div
                              className="h-full bg-[#00E676] rounded-full transition-all duration-300"
                              style={{ width: `${Math.min(100, badge.progressPercentage)}%` }}
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="flex items-center justify-end gap-3 pt-4 border-t border-[#1B2320]">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2.5 rounded-xl bg-[#1B2320] hover:bg-[#232D29] text-slate-300 font-bold"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={handleSaveFromBadgesTab}
                className="px-5 py-2.5 rounded-xl bg-[#00E676] hover:bg-[#00c865] text-slate-950 font-extrabold flex items-center gap-1.5 shadow-md"
              >
                <CheckCircle2 className="w-4 h-4" /> Enregistrer
              </button>
            </div>
          </div>
        )}
        </div>
      </div>

      <ChangeOwnPasswordModal
        isOpen={isChangePasswordOpen}
        onClose={() => setIsChangePasswordOpen(false)}
      />
      <TwoFactorSetupModal
        isOpen={isTwoFactorOpen}
        onClose={() => setIsTwoFactorOpen(false)}
      />
    </div>
  );
};
