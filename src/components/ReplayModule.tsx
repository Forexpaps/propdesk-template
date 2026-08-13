import React from "react";

/**
 * Intègre Replay FX (application HTML/CSS/JS vanilla autonome, backtest
 * manuel sur données historiques réelles HistData.com 2024) dans PropDesk.
 *
 * Rendu comme un onglet standard — sidebar et header PropDesk restent
 * accessibles pendant l'utilisation, comme pour tous les autres modules.
 * Replay FX garde sa propre navigation interne (Backtest/Journal/
 * Statistiques) à l'intérieur de l'iframe.
 *
 * Occupe tout l'espace restant sous le header (`App.tsx` retire le padding
 * et le `max-w-7xl` du `<main>` pour cet onglet précis) : Replay FX a besoin
 * de sa pleine hauteur/largeur pour le graphique, contrairement aux autres
 * onglets qui restent dans le contenu centré habituel.
 *
 * L'iframe pointe vers `/replay-fx/index.html`, servi par une route Express
 * dédiée (voir `server.ts`) plutôt que `public/` : le fichier de données
 * embarqué (`market-data.js`, ~25 Mo) bloquait `npm run build` plusieurs
 * minutes quand il vivait dans `public/` (voir HANDOFF.md §4ter). Aucun
 * fichier de Replay FX n'est modifié — appli fournie telle quelle.
 */
export const ReplayModule: React.FC = () => {
  return (
    <iframe
      src="/replay-fx/index.html"
      title="Replay FX"
      className="flex-1 w-full border-0"
    />
  );
};
