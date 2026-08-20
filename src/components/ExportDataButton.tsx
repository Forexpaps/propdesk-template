import React, { useState } from "react";
import { Download, Loader2, ShieldCheck } from "lucide-react";
import { api } from "../lib/api";

interface ExportDataButtonProps {
  className?: string;
}

/**
 * Export RGPD (Article 20, droit à la portabilité) des données personnelles
 * de l'élève connecté — profil, plan de trading, progression aux modules,
 * badges obtenus. Voir `server/auth/exportData.ts` pour le détail exact de
 * ce qui est collecté (limité à ce que ce schéma contient réellement : pas
 * de paiements, pas de logs d'accès, ces modules n'existent pas ici).
 *
 * Distinct du bouton "Exporter mes données" déjà présent dans "Données &
 * Sauvegarde" (`UserProfileModal.tsx`) : celui-là dump l'intégralité du
 * bureau (`fetchState`, format de sauvegarde technique réimportable) ;
 * celui-ci est le sous-ensemble RGPD, nommé et présenté comme tel.
 */
export const ExportDataButton: React.FC<ExportDataButtonProps> = ({ className = "" }) => {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleExport = async () => {
    setPending(true);
    setError(null);
    try {
      const data = await api.exportStudentData();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `propdesk-export-${new Date().toISOString().split("T")[0]}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err) {
      setError((err as Error).message || "Le téléchargement a échoué.");
    } finally {
      setPending(false);
    }
  };

  return (
    <div className={className}>
      <div className="flex items-center gap-3">
        <ShieldCheck className="w-6 h-6 text-[#00E676] shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="text-sm font-bold text-white">Mes données personnelles</div>
          <p className="text-xs text-slate-400">
            Conformément à l'article 20 du RGPD, télécharge une copie de tes données : profil, plan de
            trading, progression aux modules, badges obtenus.
          </p>
        </div>
        <button
          type="button"
          onClick={handleExport}
          disabled={pending}
          aria-busy={pending}
          className="px-3 py-2 rounded-xl text-[11px] font-bold text-slate-950 bg-[#00E676] hover:bg-[#00c865] disabled:opacity-60 shrink-0 transition-colors flex items-center gap-1.5"
        >
          {pending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
          {pending ? "Export…" : "Télécharger"}
        </button>
      </div>
      {error && <p className="text-xs text-rose-400 mt-2">{error}</p>}
    </div>
  );
};
