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
} from "lucide-react";
import { StudentProfile, TraderBadge } from "../types";

interface UserProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  student: StudentProfile;
  badges?: TraderBadge[];
  onSaveProfile: (updatedProfile: StudentProfile) => void;
  onClaimBadge?: (badgeId: string) => void;
  initialTab?: "profile" | "badges";
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
}) => {
  const [activeSubTab, setActiveSubTab] = useState<"profile" | "badges">(initialTab);
  const [badgeFilter, setBadgeFilter] = useState<string>("ALL");

  const [name, setName] = useState(student.name);
  const [email, setEmail] = useState(student.email);
  const [avatar, setAvatar] = useState(student.avatar);
  const [level, setLevel] = useState(student.level);
  const [role, setRole] = useState(
    student.role || (student.isAdmin ? "Fondateur / Head Coach" : "Élève Premium")
  );
  const [phone, setPhone] = useState(student.phone || "+33 6 12 34 56 78");
  const [bio, setBio] = useState(student.bio || "");
  const [preferredPairs, setPreferredPairs] = useState(
    student.preferredPairs || "EUR/USD, XAU/USD, NAS100"
  );
  const [startingCapital, setStartingCapital] = useState(
    student.startingCapital.toString()
  );
  const [currentCapital, setCurrentCapital] = useState(
    student.currentCapital.toString()
  );
  const [isAdmin, setIsAdmin] = useState(student.isAdmin ?? true);

  // La modale reste montée entre deux ouvertures : sans cela, `initialTab`
  // ne serait pris en compte qu'au tout premier rendu.
  useEffect(() => {
    if (isOpen) setActiveSubTab(initialTab);
  }, [isOpen, initialTab]);

  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        alert("L'image choisie est trop volumineuse (max 5 Mo). Veuillez en choisir une autre.");
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        if (typeof reader.result === "string") {
          setAvatar(reader.result);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSaveProfile({
      ...student,
      name,
      email,
      avatar,
      level,
      role,
      phone,
      bio,
      preferredPairs,
      startingCapital: parseFloat(startingCapital) || 10000,
      currentCapital: parseFloat(currentCapital) || 10000,
      isAdmin,
    });
    onClose();
  };

  // Badge calculations
  const unlockedBadgesCount = badges.filter((b) => b.unlocked).length;
  const totalXP = badges
    .filter((b) => b.unlocked)
    .reduce((acc, b) => acc + (b.rewardXP || 200), 0);

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
      <div className="bg-[#111615] border border-[#1B2320] rounded-2xl max-w-3xl w-full p-6 space-y-6 shadow-2xl relative my-8 text-slate-100">
        {/* Modal Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#1B2320] pb-4">
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
                    className="w-full py-2 px-3 rounded-xl bg-[#1B2320] hover:bg-[#232D29] border border-[#1B2320] text-slate-200 font-bold flex items-center justify-center gap-2 transition-all"
                  >
                    <Upload className="w-4 h-4 text-[#00E676]" />
                    <span>Importer une photo perso (.PNG, .JPG)</span>
                  </button>

                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-slate-500 shrink-0">Ou URL:</span>
                    <input
                      type="text"
                      value={avatar}
                      onChange={(e) => setAvatar(e.target.value)}
                      placeholder="https://..."
                      className="w-full bg-[#111615] border border-[#1B2320] rounded-lg px-2.5 py-1 text-white text-[11px] focus:outline-none focus:border-[#00E676] font-mono"
                    />
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

            {/* Admin Toggle */}
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

              <button
                type="button"
                onClick={() => setIsAdmin(!isAdmin)}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition-all shrink-0 ${
                  isAdmin
                    ? "bg-[#00E676] text-slate-950 font-extrabold"
                    : "bg-[#1B2320] text-slate-300 hover:text-white"
                }`}
              >
                {isAdmin ? "Admin Activé ✅" : "Activer Admin 👑"}
              </button>
            </div>

            {/* Inputs Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block font-medium text-slate-300 mb-1">Nom complet</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full bg-[#0D1110] border border-[#1B2320] rounded-xl px-3.5 py-2.5 text-white focus:outline-none focus:border-[#00E676]"
                />
              </div>

              <div>
                <label className="block font-medium text-slate-300 mb-1">Adresse Email</label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-[#0D1110] border border-[#1B2320] rounded-xl px-3.5 py-2.5 text-white focus:outline-none focus:border-[#00E676]"
                />
              </div>

              <div>
                <label className="block font-medium text-slate-300 mb-1">Rôle / Titre</label>
                <input
                  type="text"
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                  className="w-full bg-[#0D1110] border border-[#1B2320] rounded-xl px-3.5 py-2.5 text-white focus:outline-none focus:border-[#00E676]"
                />
              </div>

              <div>
                <label className="block font-medium text-slate-300 mb-1">Niveau SMC</label>
                <input
                  type="text"
                  value={level}
                  onChange={(e) => setLevel(e.target.value)}
                  className="w-full bg-[#0D1110] border border-[#1B2320] rounded-xl px-3.5 py-2.5 text-white focus:outline-none focus:border-[#00E676]"
                />
              </div>

              <div>
                <label className="block font-medium text-slate-300 mb-1">Capital Initial (€)</label>
                <input
                  type="number"
                  value={startingCapital}
                  onChange={(e) => setStartingCapital(e.target.value)}
                  className="w-full bg-[#0D1110] border border-[#1B2320] rounded-xl px-3.5 py-2.5 text-white font-mono focus:outline-none focus:border-[#00E676]"
                />
              </div>

              <div>
                <label className="block font-medium text-slate-300 mb-1">Capital Actuel Enregistré (€)</label>
                <input
                  type="number"
                  value={currentCapital}
                  onChange={(e) => setCurrentCapital(e.target.value)}
                  className="w-full bg-[#0D1110] border border-[#1B2320] rounded-xl px-3.5 py-2.5 text-[#00E676] font-mono focus:outline-none focus:border-[#00E676] font-bold"
                />
              </div>
            </div>

            <div>
              <label className="block font-medium text-slate-300 mb-1">Bio & Présentation</label>
              <textarea
                rows={2}
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                className="w-full bg-[#0D1110] border border-[#1B2320] rounded-xl p-3 text-white focus:outline-none focus:border-[#00E676]"
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
            <div className="bg-[#0D1110] border border-[#1B2320] rounded-2xl p-5 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <Crown className="w-5 h-5 text-amber-400" />
                    <h4 className="text-base font-bold text-white">Rang : Trader SMC Confirmé</h4>
                    <span className="px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-300 text-[10px] font-mono font-bold border border-amber-500/30">
                      NIVEAU 4
                    </span>
                  </div>
                  <p className="text-xs text-slate-400">
                    Gagne des points d'expérience (XP) en accomplissant tes objectifs de trading et d'apprentissage.
                  </p>
                </div>

                <div className="bg-[#111615] border border-[#1B2320] p-3 rounded-xl flex items-center gap-4 text-xs font-mono shrink-0">
                  <div>
                    <span className="text-slate-500 block text-[10px]">BADGES DÉBLOQUÉS</span>
                    <span className="text-[#00E676] font-bold text-base">
                      {unlockedBadgesCount} / {badges.length}
                    </span>
                  </div>
                  <div className="w-px h-8 bg-[#1B2320]" />
                  <div>
                    <span className="text-slate-500 block text-[10px]">TOTAL XP GAGNÉS</span>
                    <span className="text-amber-400 font-bold text-base">{totalXP} XP</span>
                  </div>
                </div>
              </div>

              {/* Progress Bar to next level */}
              <div className="space-y-1.5 pt-1">
                <div className="flex items-center justify-between text-xs text-slate-400 font-mono">
                  <span>Progression Niveau 5</span>
                  <span>{totalXP} / 3 000 XP</span>
                </div>
                <div className="w-full h-2.5 bg-[#1B2320] rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-[#00E676] to-amber-400 rounded-full transition-all duration-500"
                    style={{ width: `${Math.min(100, Math.round((totalXP / 3000) * 100))}%` }}
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
                { id: "AUDIT", label: "Audit IA" },
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
                const canClaim = !badge.unlocked && badge.progressPercentage >= 100;

                return (
                  <div
                    key={badge.id}
                    className={`p-4 rounded-2xl border transition-all space-y-3 flex flex-col justify-between ${
                      badge.unlocked
                        ? "bg-[#0D1110] border-[#00E676]/30 shadow-sm"
                        : canClaim
                        ? "bg-[#0D1110] border-amber-500/50 shadow-md animate-pulse"
                        : "bg-[#0D1110]/50 border-[#1B2320] opacity-80"
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
                            <span className="text-[10px] font-mono text-slate-500 uppercase">
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
          </div>
        )}
      </div>
    </div>
  );
};
