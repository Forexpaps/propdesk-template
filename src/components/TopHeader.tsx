import React from "react";
import { Menu, Activity, ShieldCheck, Bell, TrendingUp, Clock, Calculator, CheckSquare, Award, User, Crown, Sliders, FileText, Download } from "lucide-react";
import { StudentProfile } from "../types";

import { TabType } from "./Sidebar";

interface TopHeaderProps {
  activeTab: TabType;
  student: StudentProfile;
  setMobileOpen: (open: boolean) => void;
  onOpenCalculator?: () => void;
  onOpenChecklist?: () => void;
  onOpenProfileModal?: () => void;
  onOpenNotifications?: () => void;
  unreadNotificationsCount?: number;
}

export const TopHeader: React.FC<TopHeaderProps> = ({
  activeTab,
  student,
  setMobileOpen,
  onOpenCalculator,
  onOpenChecklist,
  onOpenProfileModal,
  onOpenNotifications,
  unreadNotificationsCount = 0,
}) => {
  const getBreadcrumbTitle = () => {
    switch (activeTab) {
      case "dashboard":
        return "Tableau de bord";
      case "students":
        return "Suivi des Élèves";
      case "wallets":
        return "Portefeuille";
      case "academy":
        return "Module vidéo";
      case "journal":
        return "Journal de trading";
      case "simulator":
        return "Replay & Backtest";
      case "signals":
        return "Signaux & Analyses";
      case "forum":
        return "Badges & paliers";
      case "messaging":
        return "Messagerie Coach";
      case "analytics":
        return "Rentabilité";
      case "exam":
        return "Examen";
      default:
        return "Tableau de bord";
    }
  };

  return (
    <header className="sticky top-0 z-30 bg-[#0A0E0D]/90 backdrop-blur-md border-b border-[#151D1A] px-4 sm:px-8 py-3.5 flex items-center justify-between gap-4">
      {/* Left Title & Mobile Menu Trigger */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => setMobileOpen(true)}
          className="p-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-300 hover:text-white lg:hidden"
        >
          <Menu className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-2 text-sm">
          <h1 className="font-bold text-white tracking-tight">{getBreadcrumbTitle()}</h1>
          <span className="text-slate-500 text-xs font-normal ml-2 hidden sm:inline">Vue d'ensemble</span>
        </div>
      </div>

      {/* Right Header Badges & Quick Tools */}
      <div className="flex items-center gap-2 sm:gap-2.5 text-xs">

        {/* Live Session NY Pill (from PropDesk aesthetic) */}
        <div className="hidden md:flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#111615] border border-[#1B2320] text-slate-300 font-mono text-[11px]">
          <span className="w-2 h-2 rounded-full bg-[#00E676] animate-pulse" />
          <span className="text-slate-400">SESSION NY</span>
          <span className="text-white font-bold">XAU/USD 2418.4</span>
          <span className="text-[#00E676] font-bold">+1.2%</span>
        </div>

        {/* Capital Pill */}
        <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#111615] border border-[#1B2320] text-slate-300 font-mono text-[11px]">
          <span className="text-slate-400">CAPITAL</span>
          <span className="text-white font-bold">
            {student.currentCapital.toLocaleString("fr-FR")} €
          </span>
        </div>

        {/* PDF Download Button */}
        <a
          href="/api/download-features-pdf"
          download="Fonctionnalites_Horizon_SMC.pdf"
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#00E676]/10 hover:bg-[#00E676]/20 border border-[#00E676]/30 text-[#00E676] transition-all text-[11px] font-mono font-bold"
          title="Télécharger le catalogue PDF des fonctionnalités"
        >
          <FileText className="w-3.5 h-3.5 text-[#00E676]" />
          <span className="hidden sm:inline">PDF Features</span>
          <Download className="w-3 h-3 ml-0.5" />
        </a>

        {/* Profile & Badges Button */}
        {onOpenProfileModal && (
          <button
            onClick={onOpenProfileModal}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#111615] hover:bg-[#1B2320] border border-[#1B2320] hover:border-[#00E676]/40 text-slate-300 hover:text-white transition-all text-[11px] font-mono"
            title="Mon Profil & Badges de Progression"
          >
            <Award className="w-3.5 h-3.5 text-amber-400" />
            <span className="hidden sm:inline font-bold">Badges & Profil</span>
          </button>
        )}

        {/* Notifications Icon Button */}
        <button
          onClick={onOpenNotifications}
          className="relative p-2 rounded-xl bg-[#111615] border border-[#1B2320] text-slate-300 hover:text-white hover:border-[#00E676]/40 transition-all group"
          title="Centre Notifications SMC"
        >
          <Bell className="w-4 h-4 group-hover:text-[#00E676] transition-colors" />
          {unreadNotificationsCount > 0 && (
            <span className="absolute -top-1 -right-1 min-w-[16px] h-[16px] bg-[#00E676] text-slate-950 font-extrabold text-[10px] rounded-full flex items-center justify-center px-1">
              {unreadNotificationsCount}
            </span>
          )}
        </button>
      </div>
    </header>
  );
};


