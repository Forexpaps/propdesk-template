import React from "react";
import { ChevronDown } from "lucide-react";

/**
 * `<select>` personnalisé, partagé par tout le projet.
 *
 * Sans ça, chaque navigateur affiche son propre widget natif pour un
 * `<select>` non stylé : un simple chevron sur Chrome/Firefox, mais une
 * double flèche façon "spinner" sur Safari (macOS/iOS). Un élève sur Safari
 * et son coach sur Chrome ne voyaient donc pas le même formulaire — aucune
 * différence de code entre les deux, juste le rendu natif du navigateur.
 * `appearance-none` masque ce widget natif partout ; le chevron
 * `ChevronDown` ci-dessous, toujours identique, le remplace.
 *
 * Le padding droit est fixé en `style` (pas en classe Tailwind) : une
 * classe `pr-*` perdrait face à un `p-2.5`/`px-3` du même niveau de
 * spécificité selon l'ordre interne des utilitaires Tailwind, un style
 * inline gagne toujours.
 *
 * Extrait de `TradingJournal.tsx` (premier module corrigé) pour être
 * réutilisé partout où l'app a un `<select>` — un élève avait signalé
 * exactement ce défaut sur le module Portefeuille ensuite, qui utilisait
 * encore un `<select>` brut.
 */
export const Select: React.FC<React.SelectHTMLAttributes<HTMLSelectElement>> = ({
  className = "",
  style,
  children,
  ...props
}) => (
  <div className="relative">
    <select {...props} className={`appearance-none ${className}`} style={{ paddingRight: "1.75rem", ...style }}>
      {children}
    </select>
    <ChevronDown className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" />
  </div>
);
