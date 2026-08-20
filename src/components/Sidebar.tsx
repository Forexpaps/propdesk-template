import React from "react";
import {
  LayoutDashboard,
  BookOpen,
  BookMarked,
  MessageSquare,
  LineChart,
  ShieldCheck,
  Users,
  Menu,
  X,
  ChevronRight,
  TrendingUp,
  Wallet,
  PanelLeftClose,
  PanelLeftOpen,
  Crown,
  UserCheck,
  User,
  Sliders,
  Eye,
  EyeOff,
  Settings2,
  Check,
  Brain,
  Calendar,
  LogOut,
  ClipboardList,
  Target,
} from "lucide-react";
import { StudentProfile } from "../types";

/**
 * Tous les onglets de l'application, **à l'exécution**.
 *
 * `TabType` en dérive, et non l'inverse : un type TypeScript disparaît à la
 * compilation, il ne peut donc pas servir à valider une chaîne reçue au
 * moment où elle arrive. Le sens de la dérivation est le point important —
 * ajouter un onglet ici étend le type *et* tout ce qui s'appuie sur la liste,
 * sans qu'un endroit puisse être oublié.
 *
 * Cette liste avait été recopiée à la main dans `handleNavigateFromNotification`
 * ([`App.tsx`](../App.tsx)) : un onglet ajouté sans penser à l'y reporter
 * devenait silencieusement inatteignable depuis le centre d'alertes. Ne
 * réintroduis pas de copie — utilise `isTabType`.
 */
export const ALL_TABS = [
  "dashboard",
  "students",
  "wallets",
  "academy",
  "journal",
  "messaging",
  "analytics",
  "macro",
  "setups",
] as const;

export type TabType = (typeof ALL_TABS)[number];

/**
 * Garde de type sur une chaîne d'origine extérieure — aujourd'hui le
 * `targetTab` en texte libre d'une notification.
 *
 * Ne dit **que** si l'onglet existe. Le droit d'y accéder est une question
 * distincte, tranchée par l'appelant (`students` est réservé à l'admin).
 */
export function isTabType(value: string): value is TabType {
  return (ALL_TABS as readonly string[]).includes(value);
}

/**
 * Entrées que le compte fondateur peut masquer, identifiées par une clé stable.
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
  "academy",
  "messaging",
  "mindset",
  "calendar",
  "tradingPlan",
  "setups",
] as const;

export type SidebarItemKey = (typeof SIDEBAR_TOGGLEABLE_KEYS)[number];

type SectionName = "suivi";

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
  academy: "academy",
  messaging: "messaging",
  mindset: null,
  calendar: "macro",
  tradingPlan: null,
  setups: "setups",
};

/**
 * Entrée de navigation.
 *
 * `id` vaut `null` et `onOpen` est renseigné pour les entrées qui ouvrent une
 * modale : elles ne changent pas d'onglet et ne sont jamais « actives ».
 *
 * Le routage passe par `onOpen` et non par une comparaison de libellé : avec
 * six entrées-modales, renommer un libellé aurait silencieusement cassé la
 * navigation.
 */
interface SidebarEntry {
  key: SidebarItemKey;
  id: TabType | null;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: string | null;
  onOpen?: () => void;
}

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
  /**
   * Ferme la session. Absent tant qu'aucune authentification n'existe : le
   * bouton n'est alors pas rendu plutôt que de rester inerte.
   */
  onLogout?: () => void;
  onOpenTradingPlan?: () => void;
  // Section OUTILS : chaque entrée ouvre une modale.
  onOpenMindset?: () => void;
  /** Masque ou réaffiche une entrée. Réservé au compte fondateur. */
  onToggleSidebarItem?: (key: SidebarItemKey) => void;
  /**
   * Vrai pour le seul compte fondateur.
   *
   * Les entrées masquées appartiennent au bureau partagé : un coach qui les
   * modifierait changerait la sidebar de tout le monde, y compris celle du
   * fondateur. C'est pourquoi le réglage lui est retiré — il conserve en
   * revanche tous ses autres droits (`student.isAdmin` reste vrai).
   */
  canManageSidebar?: boolean;
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
  onLogout,
  onOpenTradingPlan,
  onOpenMindset,
  onToggleSidebarItem,
  canManageSidebar = false,
}) => {
  // Section dont le fondateur règle actuellement la visibilité.
  const [editingSection, setEditingSection] = React.useState<SectionName | null>(
    null
  );

  const hiddenItems = student.hiddenSidebarItems ?? [];

  // `canManageSidebar` (identité du compte connecté) et non `student.isAdmin`
  // (profil partagé, vrai pour tout le monde) : c'est ce qui distingue le
  // fondateur d'un coach invité.
  const canManage = Boolean(canManageSidebar && onToggleSidebarItem);

  const mainItem = {
    id: "dashboard" as const,
    label: "Tableau de bord",
    icon: LayoutDashboard,
  };

  /**
   * Tous les modules regroupés dans une seule section — sur demande
   * explicite de l'utilisateur, les anciennes sections PRATIQUE/FORMATION/
   * OUTILS ont été fusionnées ici, sans changement de fonction (mêmes
   * `id`/`onOpen`, seule la présentation change).
   *
   * « Badges & paliers » ne figure pas ici : les badges restent accessibles
   * par le profil (UserProfileModal, onglet Badges). « Calendrier » n'y
   * figure plus non plus : devenu l'onglet « Macro », ce n'est plus une
   * modale. « Audit Setup » (scoring de confluences SMC codé en dur) retiré
   * entièrement sur demande explicite antérieure — « Setups » ci-dessous est
   * un module distinct (fiches de stratégies libres, sans scoring), ne pas
   * confondre les deux.
   */
  const suiviItems: SidebarEntry[] = [
    { key: "journal", id: "journal", label: "Journal de trading", icon: BookMarked },
    { key: "wallets", id: "wallets", label: "Portefeuille", icon: Wallet },
    { key: "analytics", id: "analytics", label: "Rentabilité", icon: LineChart },
    { key: "calendar", id: "macro", label: "Macro", icon: Calendar },
    ...(student.isAdmin
      ? [{ key: "students" as const, id: "students" as const, label: "Suivi des Élèves", icon: UserCheck }]
      : []),
    { key: "setups", id: "setups", label: "Setups", icon: Target },
    { key: "tradingPlan", id: null, label: "Plan de trading", icon: ClipboardList, onOpen: onOpenTradingPlan },
    { key: "academy", id: "academy", label: "Module vidéo", icon: BookOpen, badge: `${courseCompletionPercentage}%` },
    { key: "messaging", id: "messaging", label: "Messagerie Coach", icon: MessageSquare, badge: totalUnreadMessages > 0 ? "1" : null },
    { key: "mindset", id: null, label: "Mindset", icon: Brain, onOpen: onOpenMindset },
  ];

  /**
   * En-tête de section. Pour le compte fondateur, le chevron décoratif laisse
   * la place à l'interrupteur qui ouvre le réglage de visibilité de la section.
   * Un coach ne voit que le chevron : le réglage ne lui est pas proposé.
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
   *
   * `canManage` est retesté ici pour que le mode réglage ne puisse pas
   * survivre à une perte du droit (déconnexion, bascule hors ligne) alors que
   * `editingSection` serait resté positionné.
   */
  const isEditingSection = (section: SectionName) =>
    canManage && !isCollapsed && editingSection === section;

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
      key={key}
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

  /**
   * Rendu d'une section complète. Les quatre sections étaient auparavant quatre
   * blocs quasi identiques ; une seule fonction évite d'avoir à répercuter
   * chaque correction quatre fois.
   */
  const renderSection = (
    label: string,
    section: SectionName,
    items: SidebarEntry[]
  ) => {
    const visibleItems = items.filter((item) => !hiddenItems.includes(item.key) || isEditingSection(section));

    // Section vide à masquer entièrement — mais jamais pour un compte qui
    // peut gérer la visibilité (`canManage`) : sans l'en-tête, le bouton ⚙️
    // qui permet justement de ressortir de cet état disparaîtrait avec lui.
    // Un admin qui masque tout le contenu d'une section (ou recharge la page
    // à ce moment précis, `editingSection` repartant à `null`) se
    // retrouverait alors sans aucun moyen, depuis l'interface, de rouvrir le
    // réglage pour la réafficher — seule une modification directe de la base
    // le permettrait. Pour un simple visiteur (élève, Vue Complète en
    // lecture seule) qui ne peut de toute façon rien basculer, la section
    // reste masquée en entier comme avant.
    if (visibleItems.length === 0 && !canManage) return null;

    return (
    <div className="space-y-1">
      {!isCollapsed && renderSectionHeader(label, section)}
      {items.map((item) => {
        const Icon = item.icon;
        const isHidden = hiddenItems.includes(item.key);

        if (isEditingSection(section)) {
          return renderVisibilityRow(item.key, item.label, Icon, isHidden);
        }
        if (isHidden) return null;

        // Les entrées-modales n'ont pas d'onglet : jamais actives.
        const isActive = item.id !== null && activeTab === item.id;
        // Une entrée-modale (id null) sans callback fourni par le parent ne
        // peut rien ouvrir — cas de `AdminStudentView.tsx` (Vue Complète en
        // lecture seule), qui ne branche jamais `onOpenTradingPlan`/
        // `onOpenMindset` : ces outils vivent en `localStorage` sur
        // l'appareil de l'ÉLÈVE, jamais synchronisés sur le serveur, donc
        // structurellement impossibles à consulter depuis le navigateur du
        // coach. Repéré en audit : le clic ne faisait auparavant RIEN de
        // visible (juste un survol), ce qui ressemblait à un bug plutôt qu'à
        // une limite connue — désormais visuellement désactivé, avec
        // l'explication en infobulle.
        const isUnavailableModalEntry = item.id === null && !item.onOpen;
        return (
          <button
            key={item.key}
            disabled={isUnavailableModalEntry}
            onClick={() => {
              if (item.onOpen) {
                item.onOpen();
              } else if (item.id) {
                setActiveTab(item.id);
              }
              setMobileOpen(false);
            }}
            title={
              isUnavailableModalEntry
                ? "Outil personnel de l'élève (stocké sur son appareil), non consultable depuis cette vue."
                : isCollapsed
                ? item.label
                : undefined
            }
            className={`w-full flex items-center justify-between px-3 py-2 rounded-lg transition-all ${
              isUnavailableModalEntry
                ? "text-slate-600 opacity-50 cursor-not-allowed"
                : isActive
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
    );
  };

  return (
    <>
      {/* Mobile Backdrop */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-[#0D1110]/80 backdrop-blur-sm lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Main Left Sidebar */}
      <aside
        className={`fixed top-0 bottom-0 left-0 z-50 bg-[#0A0E0D] border-r border-[#151D1A] flex flex-col justify-between transition-all duration-300 ease-in-out lg:translate-x-0 ${
          mobileOpen ? "translate-x-0 w-64" : "-translate-x-full lg:translate-x-0"
        } ${isCollapsed ? "lg:w-20" : "lg:w-64"}`}
      >
        {/* Seule la navigation défile : le logo et le pied (profil,
            déconnexion) doivent rester atteignables sans défilement, sur les
            écrans courts comme sur les grands. */}
        <div className="flex flex-col h-full min-h-0">
          {/* Header Brand Logo: PropDesk */}
          <div className={`shrink-0 p-4 border-b border-[#151D1A] flex items-center ${isCollapsed ? "justify-center" : "justify-between"}`}>
            <div
              className="flex items-center gap-3 cursor-pointer group"
              onClick={() => {
                setActiveTab("dashboard");
                setMobileOpen(false);
              }}
            >
              <img
                src="/icon.png"
                alt="PropDesk"
                className="w-9 h-9 rounded-xl shadow-sm group-hover:scale-105 transition-transform shrink-0"
              />
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

          {/* Bouton de dépliage, visible uniquement sidebar repliée (desktop).
              Sans lui, le seul moyen de redéplier était de cliquer sur l'avatar
              tout en bas — pas assez visible comme affordance de bouton. */}
          {isCollapsed && (
            <div className="hidden lg:flex justify-center shrink-0 py-2 border-b border-[#151D1A]">
              <button
                onClick={() => setIsCollapsed(false)}
                title="Déplier le menu"
                className="p-2 rounded-lg text-slate-400 hover:text-[#00E676] hover:bg-[#131816] transition-colors"
              >
                <PanelLeftOpen className="w-5 h-5" />
              </button>
            </div>
          )}

          {/* Navigation Items */}
          <nav className="p-3 space-y-4 flex-1 min-h-0 overflow-y-auto scrollbar-none text-xs">
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

            {renderSection("SUIVIE TRADING", "suivi", suiviItems)}
          </nav>

          {/* Reduce Sidebar Button */}
          {!isCollapsed && (
            <div className="shrink-0 px-4 py-2">
              <button
                onClick={() => setIsCollapsed(true)}
                className="w-full flex items-center gap-2 text-[11px] text-slate-400 hover:text-white px-2 py-1.5 rounded-lg hover:bg-slate-900 transition-colors"
              >
                <span>« Réduire</span>
              </button>
            </div>
          )}

          {/* User Profile Footer */}
          <div className="shrink-0 p-3 border-t border-[#151D1A] bg-[#0A0E0D] mt-auto">
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

            {/* Déconnexion. Ne quitte pas une section : elle vit sous la carte
                de profil, à laquelle elle se rapporte. */}
            {onLogout && (
              <button
                onClick={onLogout}
                title={isCollapsed ? "Déconnexion" : undefined}
                className={`mt-2 w-full flex items-center gap-2 rounded-lg px-3 py-2 text-[11px] font-medium text-slate-400 hover:text-rose-300 hover:bg-rose-500/10 transition-colors ${
                  isCollapsed ? "justify-center" : ""
                }`}
              >
                <LogOut className="w-4 h-4 shrink-0" />
                {!isCollapsed && <span>Déconnexion</span>}
              </button>
            )}
          </div>
        </div>
      </aside>
    </>
  );
};

