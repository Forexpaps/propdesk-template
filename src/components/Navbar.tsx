import React from "react";
import { BookOpen, BookMarked, MessageSquare, LineChart, Award, ShieldCheck, Sparkles } from "lucide-react";
import { StudentProfile } from "../types";

interface NavbarProps {
  activeTab: "academy" | "journal" | "messaging" | "dashboard";
  setActiveTab: (tab: "academy" | "journal" | "messaging" | "dashboard") => void;
  student: StudentProfile;
  courseCompletionPercentage: number;
  totalUnreadMessages: number;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  setActiveTab,
  student,
  courseCompletionPercentage,
  totalUnreadMessages,
}) => {
  const capitalDiff = student.currentCapital - student.startingCapital;
  const capitalDiffPercent = ((capitalDiff / student.startingCapital) * 100).toFixed(1);

  return (
    <header className="sticky top-0 z-40 bg-slate-900/95 backdrop-blur border-b border-slate-800 text-slate-100 shadow-xl">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 gap-4">
          
          {/* Logo & Academy Brand */}
          <div className="flex items-center gap-3 cursor-pointer" onClick={() => setActiveTab("academy")}>
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-amber-500 via-amber-400 to-yellow-300 flex items-center justify-center text-slate-950 font-black text-xl shadow-lg shadow-amber-500/20">
              H
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold tracking-tight text-lg bg-clip-text text-transparent bg-gradient-to-r from-white via-slate-100 to-slate-300">
                  HORIZON
                </span>
                <span className="text-[10px] uppercase tracking-wider font-extrabold px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20">
                  ACADEMY PRO
                </span>
              </div>
              <p className="text-xs text-slate-400 hidden sm:block">L'Excellence du Trading & SMC</p>
            </div>
          </div>

          {/* Center Navigation Menu */}
          <nav className="hidden md:flex items-center gap-1 bg-slate-950/60 p-1 rounded-xl border border-slate-800/80">
            <button
              id="nav-btn-academy"
              onClick={() => setActiveTab("academy")}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold transition-all ${
                activeTab === "academy"
                  ? "bg-amber-500 text-slate-950 shadow-md font-bold"
                  : "text-slate-300 hover:text-white hover:bg-slate-800/60"
              }`}
            >
              <BookOpen className="w-4 h-4" />
              <span>Modules Vidéo</span>
              <span
                className={`ml-1 text-[10px] px-1.5 py-0.2 rounded-full ${
                  activeTab === "academy" ? "bg-slate-950/20 text-slate-950" : "bg-slate-800 text-amber-400"
                }`}
              >
                {courseCompletionPercentage}%
              </span>
            </button>

            <button
              id="nav-btn-journal"
              onClick={() => setActiveTab("journal")}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold transition-all ${
                activeTab === "journal"
                  ? "bg-amber-500 text-slate-950 shadow-md font-bold"
                  : "text-slate-300 hover:text-white hover:bg-slate-800/60"
              }`}
            >
              <BookMarked className="w-4 h-4" />
              <span>Journal de Trading</span>
            </button>

            <button
              id="nav-btn-messaging"
              onClick={() => setActiveTab("messaging")}
              className={`relative flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold transition-all ${
                activeTab === "messaging"
                  ? "bg-amber-500 text-slate-950 shadow-md font-bold"
                  : "text-slate-300 hover:text-white hover:bg-slate-800/60"
              }`}
            >
              <MessageSquare className="w-4 h-4" />
              <span>Messagerie Coach</span>
              {totalUnreadMessages > 0 && (
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
              )}
            </button>

            <button
              id="nav-btn-dashboard"
              onClick={() => setActiveTab("dashboard")}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold transition-all ${
                activeTab === "dashboard"
                  ? "bg-amber-500 text-slate-950 shadow-md font-bold"
                  : "text-slate-300 hover:text-white hover:bg-slate-800/60"
              }`}
            >
              <LineChart className="w-4 h-4" />
              <span>Analyse & Perf</span>
            </button>
          </nav>

          {/* Right Section: Student Capital & Profile */}
          <div className="flex items-center gap-3">
            {/* Capital Badge */}
            <div className="hidden lg:flex flex-col items-end px-3 py-1.5 rounded-lg bg-slate-950/80 border border-slate-800">
              <div className="text-[10px] text-slate-400 font-medium flex items-center gap-1">
                <ShieldCheck className="w-3 h-3 text-emerald-400" />
                Capital Financé:
              </div>
              <div className="text-sm font-bold text-emerald-400 font-mono">
                {student.currentCapital.toLocaleString("fr-FR")} €{" "}
                <span className="text-[10px] text-emerald-300 font-normal">
                  (+{capitalDiffPercent}%)
                </span>
              </div>
            </div>

            {/* Student Avatar */}
            <div className="flex items-center gap-2 pl-2 border-l border-slate-800">
              <img
                src={student.avatar}
                alt={student.name}
                className="w-9 h-9 rounded-full object-cover border-2 border-amber-500/40"
              />
              <div className="hidden sm:block text-left">
                <div className="text-xs font-bold text-slate-200">{student.name}</div>
                <div className="text-[10px] text-amber-400 flex items-center gap-1">
                  <Award className="w-2.5 h-2.5" />
                  {student.level}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Mobile Navigation Row */}
        <div className="flex md:hidden items-center justify-around py-2 border-t border-slate-800/80 text-xs">
          <button
            onClick={() => setActiveTab("academy")}
            className={`flex flex-col items-center gap-1 py-1 px-2 rounded ${
              activeTab === "academy" ? "text-amber-400 font-bold" : "text-slate-400"
            }`}
          >
            <BookOpen className="w-4 h-4" />
            <span>Cours</span>
          </button>
          <button
            onClick={() => setActiveTab("journal")}
            className={`flex flex-col items-center gap-1 py-1 px-2 rounded ${
              activeTab === "journal" ? "text-amber-400 font-bold" : "text-slate-400"
            }`}
          >
            <BookMarked className="w-4 h-4" />
            <span>Journal</span>
          </button>
          <button
            onClick={() => setActiveTab("messaging")}
            className={`flex flex-col items-center gap-1 py-1 px-2 rounded ${
              activeTab === "messaging" ? "text-amber-400 font-bold" : "text-slate-400"
            }`}
          >
            <MessageSquare className="w-4 h-4" />
            <span>Coach</span>
          </button>
          <button
            onClick={() => setActiveTab("dashboard")}
            className={`flex flex-col items-center gap-1 py-1 px-2 rounded ${
              activeTab === "dashboard" ? "text-amber-400 font-bold" : "text-slate-400"
            }`}
          >
            <LineChart className="w-4 h-4" />
            <span>Perf</span>
          </button>
        </div>
      </div>
    </header>
  );
};
