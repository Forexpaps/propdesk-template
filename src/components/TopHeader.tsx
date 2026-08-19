import React, { useEffect, useState } from "react";
import { Menu, Activity, ShieldCheck, Bell, TrendingUp, Clock, Calculator, CheckSquare, Award, User, Crown, Sliders } from "lucide-react";
import { StudentProfile } from "../types";
import { formatCurrency } from "../lib/format";

import { TabType } from "./Sidebar";

/**
 * Sessions de trading Forex, en heures UTC — fixes dans le temps, quel que
 * soit le fuseau horaire de la personne qui regarde l'écran. `new Date()`
 * représente toujours le même instant réel pour tout le monde ; c'est en
 * comparant son heure **UTC** (`getUTCHours`), et non l'heure locale
 * (`getHours`), que chaque utilisateur voit la bonne session ouverte au même
 * moment, d'où qu'il se connecte.
 *
 * Plages usuelles du marché (approximation standard, chevauchements compris
 * — Londres/New York se recouvrent l'après-midi UTC, la session la plus
 * active de la journée).
 */
const FOREX_SESSIONS: { name: string; startUTC: number; endUTC: number }[] = [
  { name: "Sydney", startUTC: 21, endUTC: 6 }, // traverse minuit UTC
  { name: "Tokyo", startUTC: 0, endUTC: 9 },
  { name: "Londres", startUTC: 7, endUTC: 16 },
  { name: "New York", startUTC: 12, endUTC: 21 },
];

function isSessionActive(session: { startUTC: number; endUTC: number }, hourUTC: number): boolean {
  if (session.startUTC < session.endUTC) {
    return hourUTC >= session.startUTC && hourUTC < session.endUTC;
  }
  // La session traverse minuit UTC (Sydney) : active avant OU après le seuil.
  return hourUTC >= session.startUTC || hourUTC < session.endUTC;
}

/**
 * Le marché Forex ferme du vendredi 21h UTC (clôture de New York) au dimanche
 * 21h UTC (ouverture de Sydney) — un week-end complet sans aucune session
 * active, quelle que soit l'heure.
 */
function isForexMarketClosed(date: Date): boolean {
  const day = date.getUTCDay(); // 0 = dimanche, 5 = vendredi, 6 = samedi
  const hour = date.getUTCHours();
  if (day === 6) return true;
  if (day === 5 && hour >= 21) return true;
  if (day === 0 && hour < 21) return true;
  return false;
}

/** Nom de la ou des sessions actuellement ouvertes, ou `null` marché fermé. */
function getActiveSessionLabel(date: Date): string | null {
  if (isForexMarketClosed(date)) return null;

  const hourUTC = date.getUTCHours();
  const active = FOREX_SESSIONS.filter((s) => isSessionActive(s, hourUTC)).map((s) => s.name);
  return active.length > 0 ? active.join(" / ") : null;
}

interface TopHeaderProps {
  activeTab: TabType;
  student: StudentProfile;
  setMobileOpen: (open: boolean) => void;
  onOpenProfileModal?: () => void;
  onOpenNotifications?: () => void;
  unreadNotificationsCount?: number;
}

export const TopHeader: React.FC<TopHeaderProps> = ({
  activeTab,
  student,
  setMobileOpen,
  onOpenProfileModal,
  onOpenNotifications,
  unreadNotificationsCount = 0,
}) => {
  const [activeSession, setActiveSession] = useState(() => getActiveSessionLabel(new Date()));

  // Une session change au plus toutes les heures (bornes UTC) : une minute de
  // granularité suffit très largement, sans re-rendre le header en continu.
  useEffect(() => {
    const timer = setInterval(() => {
      setActiveSession(getActiveSessionLabel(new Date()));
    }, 60_000);
    return () => clearInterval(timer);
  }, []);

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
      case "signals":
        return "Signaux & Analyses";
      case "forum":
        return "Badges & paliers";
      case "messaging":
        return "Messagerie Coach";
      case "analytics":
        return "Rentabilité";
      case "macro":
        return "Macro";
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

        {/* Session de marché actuellement ouverte, calculée en direct
            (heures UTC des sessions, comparées à l'instant réel — voir
            `getActiveSessionLabel` en tête de fichier). */}
        <div className="hidden md:flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#111615] border border-[#1B2320] text-slate-300 font-mono text-[11px]">
          <span
            className={`w-2 h-2 rounded-full ${
              activeSession ? "bg-[#00E676] animate-pulse" : "bg-slate-600"
            }`}
          />
          <span className="text-slate-400">SESSION</span>
          <span className="text-white font-bold">
            {activeSession ?? "Marché fermé"}
          </span>
        </div>

        {/* Capital Pill */}
        <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#111615] border border-[#1B2320] text-slate-300 font-mono text-[11px]">
          <span className="text-slate-400">CAPITAL</span>
          <span className="text-white font-bold">
            {formatCurrency(student.currentCapital)}
          </span>
        </div>

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


