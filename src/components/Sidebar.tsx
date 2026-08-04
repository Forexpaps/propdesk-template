import React from "react";
import {
  LayoutDashboard,
  BookOpen,
  BookMarked,
  MessageSquare,
  LineChart,
  Award,
  ShieldCheck,
  Users,
  Menu,
  X,
  Sparkles,
  ChevronRight,
  TrendingUp,
  Activity,
  Wallet,
  Radio,
  Zap,
  PanelLeftClose,
  PanelLeftOpen,
  Crown,
  UserCheck,
  User,
  Sliders,
  Eye,
  EyeOff,
  Settings2,
  Check
} from "lucide-react";
import { StudentProfile } from "../types";

export type TabType =
  | "dashboard"
  | "students"
  | "wallets"
  | "academy"
  | "journal"
  | "simulator"
  | "signals"
  | "forum"
  | "messaging"
  | "analytics"
  | "exam";

/**
 * Entrées que l'administrateur peut masquer, identifiées par une clé stable.
 *
 * L'`id` d'onglet ne peut pas servir de clé : « Replay » et « Sim propfirm »
 * pointent tous deux sur `simulator`.
 *
 * « Tableau de bord » en est volontairement absent : c'est la destination de
 * repli quand l'onglet courant devient inatteignable, le masquer créerait le
 * cul-de-sac qu'on cherche à éviter.
 */
export const SIDEBAR_TOGGLEABLE_KEYS = [
  "journal",
  "wallets",
  "analytics",
  "students",
  "exam",
  "checklist",
  "replay",
  "propfirm",
  "academy",
  "messaging",
] as const;

export type SidebarItemKey = (typeof SIDEBAR_TOGGLEABLE_KEYS)[number];

type SectionName = "suivi" | "pratique" | "formation";

/**
 * Onglet atteint par chaque entrée masquable, `null` pour celles qui ouvrent
 * une modale et ne changent donc jamais d'onglet.
 *
 * Sert à détecter qu'on vient de masquer le dernier accès à l'onglet courant.
 */
export const SIDEBAR_ITEM_TABS: Record<SidebarItemKey, TabType | null> = {
  journal: "journal",
  wallets: "wallets",
  analytics: "analytics",
  students: "students",
  exam: "exam",
  checklist: null,
  replay: "simulator",
  propfirm: "simulator",
  academy: "academy",
  messaging: "messaging",
};

interface SidebarProps {
  activeTab: TabType;
  setActiveTab: (tab: TabType) => void;
  student: StudentProfile;
  courseCompletionPercentage: number;
  totalUnreadMessages: number;
  mobileOpen: boolean;
  setMobileOpen: (open: boolean) => void;
  isCollapsed: boolean;
  setIsCollapsed: (collapsed: boolean) => void;
  onOpenProfileModal: () => void;
  onOpenChecklist?: () => void;
  /** Masque ou réaffiche une entrée. Réservé à l'administrateur. */
  onToggleSidebarItem?: (key: SidebarItemKey) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  setActiveTab,
  student,
  courseCompletionPercentage,
  totalUnreadMessages,
  mobileOpen,
  setMobileOpen,
  isCollapsed,
  setIsCollapsed,
  onOpenProfileModal,
  onOpenChecklist,
  onToggleSidebarItem,
}) => {
  const capitalDiff = student.currentCapital - student.startingCapital;
  const capitalDiffPercent = ((capitalDiff / student.startingCapital) * 100).toFixed(1);

  // Section dont l'administrateur règle actuellement la visibilité.
  const [editingSection, setEditingSection] = React.useState<SectionName | null>(
    null
  );

  const hiddenItems = student.hiddenSidebarItems ?? [];
  const canManage = Boolean(student.isAdmin && onToggleSidebarItem);

  const mainItem = {
    id: "dashboard" as const,
    label: "Tableau de bord",
    icon: LayoutDashboard,
  };

  const suiviItems = [
    { key: "journal" as const, id: "journal" as const, label: "Journal de trading", icon: BookMarked },
    { key: "wallets" as const, id: "wallets" as const, label: "Portefeuille", icon: Wallet },
    { key: "analytics" as const, id: "analytics" as const, label: "Rentabilité", icon: LineChart },
    ...(student.isAdmin
      ? [{ key: "students" as const, id: "students" as const, label: "Suivi des Élèves", icon: UserCheck, badge: "Admin" }]
      : []),
  ];

  // « Badges & paliers » ne figure plus ici : les badges restent accessibles par
  // le profil (UserProfileModal, onglet Badges).
  const pratiqueItems = [
    { key: "exam" as const, id: "exam" as const, label: "Examen", icon: Award },
    { key: "checklist" as const, id: "checklist" as const, label: "Exercice du jour", icon: Sliders },
    { key: "replay" as const, id: "simulator" as const, label: "Replay", icon: Zap },
    { key: "propfirm" as const, id: "simulator" as const, label: "Sim propfirm", icon: Radio },
  ];

  const formationItems = [
    { key: "academy" as const, id: "academy" as const, label: "Module vidéo", icon: BookOpen, badge: `${courseCompletionPercentage}%` },
    { key: "messaging" as const, id: "messaging" as const, label: "Messagerie Coach", icon: MessageSquare, badge: totalUnreadMessages > 0 ? "1" : null },
  ];

  /**
   * En-tête de section. Pour l'administrateur, le chevron décoratif laisse la
   * place à l'interrupteur qui ouvre le réglage de visibilité de la section.
   */
  const renderSectionHeader = (label: string, section: SectionName) => {
    const isEditing = editingSection === section;
    return (
      <div className="px-3 py-1 text-[10px] font-bold text-slate-500 tracking-wider flex items-center justify-between uppercase">
        <span>{label}</span>
        {canManage ? (
          <button
            onClick={() => setEditingSection(isEditing ? null : section)}
            className={`p-0.5 rounded transition-colors ${
              isEditing
                ? "text-[#00E676]"
                : "text-slate-600 hover:text-slate-300"
            }`}
            title={
              isEditing
                ? "Terminer le réglage d'affichage"
                : "Masquer ou réafficher des modules"
            }
          >
            {isEditing ? (
              <Check className="w-3 h-3" />
            ) : (
              <Settings2 className="w-3 h-3" />
            )}
          </button>
        ) : (
          <span className="text-[9px] text-slate-600">▾</span>
        )}
      </div>
    );
  };

  /**
   * Le réglage n'a de sens qu'en sidebar dépliée : repliée, les en-têtes de
   * section — donc l'interrupteur — ne sont pas rendus.
   */
  const isEditingSection = (section: SectionName) =>
    !isCollapsed && editingSection === section;

  /**
   * Ligne en mode réglage : cliquer n'importe où bascule la visibilité plutôt
   * que de naviguer. Un bouton dans un bouton serait du HTML invalide, et la
   * navigation n'a pas sa place tant qu'on règle l'affichage.
   */
  const renderVisibilityRow = (
    key: SidebarItemKey,
    label: string,
    Icon: React.ComponentType<{ className?: string }>,
    isHidden: boolean
  ) => (
    <button
      key={label}
      onClick={() => onToggleSidebarItem?.(key)}
      className={`w-full flex items-center justify-between px-3 py-2 rounded-lg border border-dashed transition-all ${
        isHidden
          ? "border-[#1B2320] text-slate-600 hover:text-slate-400"
          : "border-[#00E676]/25 text-slate-300 hover:text-white"
      }`}
      title={isHidden ? `Réafficher « ${label} »` : `Masquer « ${label} »`}
    >
      <div className="flex items-center gap-3">
        <Icon className="w-4 h-4" />
        <span className={isHidden ? "line-through" : undefined}>{label}</span>
      </div>
      {isHidden ? (
        <EyeOff className="w-3.5 h-3.5 shrink-0" />
      ) : (
        <Eye className="w-3.5 h-3.5 shrink-0 text-[#00E676]" />
      )}
    </button>
  );

  return (
    <>
      {/* Mobile Backdrop */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-slate-950/80 backdrop-blur-sm lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Main Left Sidebar */}
      <aside
        className={`fixed top-0 bottom-0 left-0 z-50 bg-[#0A0E0D] border-r border-[#151D1A] flex flex-col justify-between transition-all duration-300 ease-in-out lg:translate-x-0 ${
          mobileOpen ? "translate-x-0 w-64" : "-translate-x-full lg:translate-x-0"
        } ${isCollapsed ? "lg:w-20" : "lg:w-64"}`}
      >
        <div className="flex flex-col h-full overflow-y-auto scrollbar-none">
          {/* Header Brand Logo: PropDesk */}
          <div className={`p-4 border-b border-[#151D1A] flex items-center ${isCollapsed ? "justify-center" : "justify-between"}`}>
            <div
              className="flex items-center gap-3 cursor-pointer group"
              onClick={() => {
                setActiveTab("dashboard");
                setMobileOpen(false);
              }}
            >
              <div className="w-9 h-9 rounded-xl bg-[#00E676]/15 border border-[#00E676]/30 flex items-center justify-center text-[#00E676] font-extrabold text-lg shadow-sm group-hover:scale-105 transition-transform shrink-0">
                P
              </div>
              {!isCollapsed && (
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="font-bold tracking-tight text-base text-white">
                      PropDesk
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400 font-normal">Académie de trading</p>
                </div>
              )}
            </div>

            {/* Mobile Close Button */}
            <button
              onClick={() => setMobileOpen(false)}
              className="p-1 rounded-lg bg-slate-900 text-slate-400 hover:text-white lg:hidden"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Navigation Items */}
          <nav className="p-3 space-y-4 flex-1 text-xs">
            {/* Main Item: Tableau de bord */}
            <div>
              <button
                onClick={() => {
                  setActiveTab("dashboard");
                  setMobileOpen(false);
                }}
                className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl font-medium transition-all ${
                  activeTab === "dashboard"
                    ? "bg-[#131B18] text-white border border-[#00E676]/40 font-semibold shadow-sm"
                    : "text-slate-400 hover:text-slate-200 hover:bg-slate-900/60"
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-[#00E676]/10 border border-[#00E676]/20 flex items-center justify-center text-[#00E676]">
                    <LayoutDashboard className="w-4 h-4" />
                  </div>
                  {!isCollapsed && <span>Tableau de bord</span>}
                </div>
                {!isCollapsed && activeTab === "dashboard" && (
                  <span className="w-2 h-2 rounded-full bg-[#00E676] shadow-[0_0_8px_#00E676]" />
                )}
              </button>
            </div>

            {/* SUIVI Category */}
            <div className="space-y-1">
              {!isCollapsed && (
                renderSectionHeader("SUIVI", "suivi")
              )}
              {suiviItems.map((item) => {
                const Icon = item.icon;
                const isHidden = hiddenItems.includes(item.key);

                if (isEditingSection("suivi")) {
                  return renderVisibilityRow(item.key, item.label, Icon, isHidden);
                }
                if (isHidden) return null;

                const isActive = activeTab === item.id;
                return (
                  <button
                    key={item.label}
                    onClick={() => {
                      setActiveTab(item.id as TabType);
                      setMobileOpen(false);
                    }}
                    className={`w-full flex items-center justify-between px-3 py-2 rounded-lg transition-all ${
                      isActive
                        ? "bg-[#131B18] text-white border border-[#00E676]/30 font-semibold"
                        : "text-slate-400 hover:text-slate-100 hover:bg-[#131816]"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <Icon className="w-4 h-4 text-slate-400 group-hover:text-white" />
                      {!isCollapsed && <span>{item.label}</span>}
                    </div>
                  </button>
                );
              })}
            </div>

            {/* PRATIQUE Category */}
            <div className="space-y-1">
              {!isCollapsed && renderSectionHeader("PRATIQUE", "pratique")}
              {pratiqueItems.map((item, idx) => {
                const Icon = item.icon;
                const isHidden = hiddenItems.includes(item.key);

                if (isEditingSection("pratique")) {
                  return renderVisibilityRow(item.key, item.label, Icon, isHidden);
                }
                if (isHidden) return null;

                const isActive = activeTab === item.id && idx === 0;
                return (
                  <button
                    key={item.label}
                    onClick={() => {
                      if (item.label === "Exercice du jour" && onOpenChecklist) {
                        onOpenChecklist();
                      } else {
                        setActiveTab(item.id as TabType);
                      }
                      setMobileOpen(false);
                    }}
                    className={`w-full flex items-center justify-between px-3 py-2 rounded-lg transition-all ${
                      isActive
                        ? "bg-[#131B18] text-white border border-[#00E676]/30 font-semibold"
                        : "text-slate-400 hover:text-slate-100 hover:bg-[#131816]"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <Icon className="w-4 h-4 text-slate-400" />
                      {!isCollapsed && <span>{item.label}</span>}
                    </div>
                  </button>
                );
              })}
            </div>

            {/* FORMATION Category */}
            <div className="space-y-1">
              {!isCollapsed && renderSectionHeader("FORMATION", "formation")}
              {formationItems.map((item) => {
                const Icon = item.icon;
                const isHidden = hiddenItems.includes(item.key);

                if (isEditingSection("formation")) {
                  return renderVisibilityRow(item.key, item.label, Icon, isHidden);
                }
                if (isHidden) return null;

                const isActive = activeTab === item.id;
                return (
                  <button
                    key={item.label}
                    onClick={() => {
                      setActiveTab(item.id as TabType);
                      setMobileOpen(false);
                    }}
                    className={`w-full flex items-center justify-between px-3 py-2 rounded-lg transition-all ${
                      isActive
                        ? "bg-[#131B18] text-white border border-[#00E676]/30 font-semibold"
                        : "text-slate-400 hover:text-slate-100 hover:bg-[#131816]"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <Icon className="w-4 h-4 text-slate-400" />
                      {!isCollapsed && <span>{item.label}</span>}
                    </div>
                    {!isCollapsed && item.badge && (
                      <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-800 text-slate-300">
                        {item.badge}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </nav>

          {/* Reduce Sidebar Button */}
          {!isCollapsed && (
            <div className="px-4 py-2">
              <button
                onClick={() => setIsCollapsed(true)}
                className="w-full flex items-center gap-2 text-[11px] text-slate-400 hover:text-white px-2 py-1.5 rounded-lg hover:bg-slate-900 transition-colors"
              >
                <span>« Réduire</span>
              </button>
            </div>
          )}

          {/* User Profile Footer */}
          <div className="p-3 border-t border-[#151D1A] bg-[#0A0E0D] mt-auto">
            {!isCollapsed ? (
              <div
                onClick={onOpenProfileModal}
                className="flex items-center justify-between p-2 rounded-xl bg-[#111615] border border-[#1B2320] hover:border-[#00E676]/40 cursor-pointer transition-all group"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <img
                    src={student.avatar}
                    alt={student.name}
                    className="w-9 h-9 rounded-full object-cover border border-[#00E676]/60 shrink-0"
                  />
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-bold text-white truncate">{student.name}</span>
                      {student.isAdmin && (
                        <span className="px-1.5 py-0.2 rounded bg-[#00E676]/15 text-[#00E676] text-[9px] font-semibold border border-[#00E676]/30 shrink-0">
                          Administrateur
                        </span>
                      )}
                    </div>
                    <p className="text-[10px] text-slate-400 truncate">
                      {student.isAdmin ? "Admin · Coach principal" : student.level}
                    </p>
                  </div>
                </div>

                <Sliders className="w-3.5 h-3.5 text-slate-500 group-hover:text-[#00E676] shrink-0" />
              </div>
            ) : (
              <div className="flex justify-center">
                <button
                  onClick={() => setIsCollapsed(false)}
                  className="p-2 rounded-full hover:bg-slate-800 text-slate-400 hover:text-white"
                >
                  <img
                    src={student.avatar}
                    alt={student.name}
                    className="w-8 h-8 rounded-full object-cover border border-[#00E676]"
                  />
                </button>
              </div>
            )}
          </div>
        </div>
      </aside>
    </>
  );
};

