import React from "react";
import { Award, ShieldCheck, Printer, CheckCircle2, Download, Sparkles, X } from "lucide-react";
import { StudentProfile } from "../types";

interface CertificateModalProps {
  isOpen: boolean;
  onClose: () => void;
  student: StudentProfile;
  completionPercentage: number;
}

export const CertificateModal: React.FC<CertificateModalProps> = ({
  isOpen,
  onClose,
  student,
  completionPercentage,
}) => {
  if (!isOpen) return null;

  const certificateId = `SMC-CERT-2026-${Math.floor(100000 + Math.random() * 900000)}`;
  const currentDate = new Date().toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/90 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-3xl w-full p-6 sm:p-8 space-y-6 shadow-2xl relative my-8">
        {/* Header Action Controls */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-4 print:hidden">
          <div className="flex items-center gap-2">
            <Award className="w-5 h-5 text-amber-400" />
            <h3 className="text-base font-bold text-white">Certificat Officiel de Réussite SMC Pro</h3>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={handlePrint}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-amber-400 font-bold text-xs border border-slate-700 transition-colors"
            >
              <Printer className="w-4 h-4" />
              <span>Imprimer / Exporter PDF</span>
            </button>

            <button
              onClick={onClose}
              className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* The Printable Certificate Design */}
        <div className="relative overflow-hidden bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 border-4 border-amber-400/40 rounded-2xl p-8 sm:p-12 text-center space-y-6 shadow-2xl">
          {/* Ornamental Background Accents */}
          <div className="absolute top-0 left-0 w-32 h-32 bg-amber-400/5 rounded-br-full border-b border-r border-amber-400/20 pointer-events-none" />
          <div className="absolute bottom-0 right-0 w-32 h-32 bg-amber-400/5 rounded-tl-full border-t border-l border-amber-400/20 pointer-events-none" />

          {/* Logo Brand */}
          <div className="flex flex-col items-center justify-center space-y-2">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center text-slate-950 font-black text-2xl shadow-lg shadow-amber-500/20">
              HT
            </div>
            <span className="text-xs font-black uppercase tracking-widest text-amber-400">
              Horizon Trading Academy
            </span>
            <span className="text-[10px] text-slate-500 font-mono tracking-wider uppercase">
              Institut International de Finance et Trading Institutionnel
            </span>
          </div>

          {/* Title */}
          <div className="space-y-2">
            <h2 className="text-2xl sm:text-3xl font-serif font-bold text-white tracking-wide uppercase">
              CERTIFICAT DE MAÎTRISE SMC
            </h2>
            <div className="w-24 h-0.5 bg-gradient-to-r from-transparent via-amber-400 to-transparent mx-auto" />
            <p className="text-xs text-slate-400 italic">
              Ce document atteste officiellement que l'étudiant sous-nommé a validé le programme de perfectionnement aux stratégies Smart Money Concepts (SMC).
            </p>
          </div>

          {/* Student Name */}
          <div className="py-4 space-y-1">
            <span className="text-xs text-slate-400 uppercase tracking-widest font-mono">
              Décerné avec distinction à
            </span>
            <div className="text-3xl sm:text-4xl font-extrabold text-white font-serif tracking-tight text-amber-300">
              {student.name}
            </div>
            <p className="text-xs text-emerald-400 font-mono font-bold">
              Level : {student.level} • Score de Validation : {completionPercentage}%
            </p>
          </div>

          {/* Certificate Description Details */}
          <p className="text-xs sm:text-sm text-slate-300 max-w-xl mx-auto leading-relaxed">
            Ayant démontré une maîtrise rigoureuse de l'Order Flow Institutionnel, du Risk Management Prop Firm, des structures de marché SMC (Order blocks, FVG, Liquidity Sweeps) et une discipline de trading exemplaire.
          </p>

          {/* Verification Badge & Signatures Grid */}
          <div className="pt-6 border-t border-slate-800 grid grid-cols-1 sm:grid-cols-3 gap-6 items-center text-xs">
            {/* Left ID */}
            <div className="text-left font-mono space-y-1">
              <span className="text-[10px] text-slate-500 uppercase block">Identifiant Unique</span>
              <span className="text-slate-300 font-bold">{certificateId}</span>
              <span className="text-[10px] text-emerald-400 block flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3" /> Vérifié sur Blockchain HT
              </span>
            </div>

            {/* Center Seal Stamp */}
            <div className="flex flex-col items-center justify-center space-y-1">
              <div className="w-16 h-16 rounded-full bg-amber-500/10 border-2 border-amber-400 flex flex-col items-center justify-center text-amber-400 p-1">
                <ShieldCheck className="w-6 h-6" />
                <span className="text-[8px] font-bold uppercase tracking-tighter">SMC Certified</span>
              </div>
              <span className="text-[10px] text-slate-400 font-mono">{currentDate}</span>
            </div>

            {/* Right Signature */}
            <div className="text-right space-y-1">
              <span className="text-[10px] text-slate-500 uppercase block">Head Coach Pédagogique</span>
              <div className="font-serif italic text-base text-amber-300 font-bold">
                Thomas Laurent
              </div>
              <span className="text-[10px] text-slate-400 block font-mono">Fondateur Horizon Trading</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
