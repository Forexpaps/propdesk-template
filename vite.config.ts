import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

/**
 * Vite ne sert que le client. Le serveur Express (`server.ts`) le monte en
 * mode middleware en développement, et sert `dist/` en production.
 *
 * Le bloc `server.hmr` / `server.watch` d'origine, piloté par une variable
 * `DISABLE_HMR` propre à Google AI Studio, a été retiré : cette variable n'est
 * jamais définie hors de cet environnement, la configuration retombait donc
 * déjà sur les défauts de Vite. L'alias `@` vers la racine du projet l'a été
 * aussi — aucun import ne s'en servait.
 */
export default defineConfig({
  plugins: [react(), tailwindcss()],
  build: {
    rollupOptions: {
      output: {
        /**
         * Sépare les dépendances tierces du code applicatif.
         *
         * Sans cela tout part dans un seul fichier : la moindre correction
         * d'un composant oblige le navigateur à retélécharger `recharts`
         * avec. Isolées, ces bibliothèques changent rarement et restent en
         * cache d'un déploiement à l'autre.
         *
         * Une **fonction** et non un objet `{nom: ['paquet']}` : cette forme
         * courte compare des identifiants de module exacts, si bien que
         * `react` (importé comme `react/jsx-runtime`) et `react-dom` (comme
         * `react-dom/client`) produisaient des blocs **vides**. On teste donc
         * le chemin réel dans `node_modules`.
         *
         * `jspdf`/`jspdf-autotable` (export du rapport de trading, voir
         * `src/lib/pdfReport.ts`) rejoignent leur propre bloc : utilisées sur
         * un clic occasionnel, pas au chargement initial, les isoler évite
         * d'alourdir le chunk `vendor` principal.
         */
        manualChunks(id) {
          if (!id.includes('node_modules')) return undefined;

          // `recharts` traîne toute la famille `d3-*` derrière lui : les
          // regrouper évite un éparpillement en une dizaine de requêtes.
          if (/node_modules\/(recharts|d3-|victory-|internmap|delaunator|robust-predicates)/.test(id)) {
            return 'charts';
          }
          if (/node_modules\/(jspdf|jspdf-autotable)/.test(id)) {
            return 'pdf';
          }
          if (/node_modules\/(react|react-dom|scheduler)\//.test(id)) {
            return 'react';
          }
          return 'vendor';
        },
      },
    },
  },
});
