import React from "react";
import { formatCurrency } from "../lib/format";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ReferenceLine,
  CartesianGrid,
} from "recharts";

/**
 * Courbe de progression du capital, extraite de `MainDashboard`.
 *
 * Ce fichier existe pour une seule raison : **isoler `recharts`**. C'est la
 * plus grosse dépendance du client (~327 ko), et le tableau de bord est
 * l'écran d'arrivée — elle partait donc dans le chargement initial de toute
 * l'application alors qu'elle ne sert qu'à ce graphique et à la vue
 * « Rentabilité ».
 *
 * `MainDashboard` l'importe via `React.lazy` : la page s'affiche sans attendre
 * `recharts`, et la courbe se remplit ensuite.
 *
 * **Ce fichier ne doit jamais être importé statiquement**, pas même pour une
 * broutille. Rollup fusionne dans le chunk principal tout module à la fois
 * importé statiquement et dynamiquement — le `React.lazy` deviendrait
 * décoratif et `recharts` repartirait dans le bundle initial, silencieusement.
 * C'est pourquoi le gabarit d'attente vit dans `MainDashboard.tsx` et non ici.
 *
 * N'importe rien de `recharts` en dehors d'ici et de `PerformanceDashboard` :
 * un import direct depuis un composant chargé au démarrage annulerait tout le
 * bénéfice, sans que rien ne le signale.
 */

export interface EquityPoint {
  label: string;
  capital: number;
}

interface EquityCurveChartProps {
  data: EquityPoint[];
  /**
   * Palier optionnel à matérialiser sur la courbe (ex: objectif de profit
   * d'un compte précis). Absent : aucune ligne de repère n'est dessinée.
   *
   * **Historique** : ce composant a longtemps dessiné une `ReferenceLine`
   * fixe à `y={11500}` avec le libellé "PALIER $11,500 · ATTEINT", codée en
   * dur et donc affichée à l'identique à tout élève quel que soit son vrai
   * capital — un reliquat de maquette/démo jamais retiré, qui affirmait à
   * tort avoir atteint un palier inexistant. Ce graphique agrège les trades
   * de TOUS les comptes de l'élève (`MainDashboard.tsx`) : il n'existe pas
   * un unique palier non-arbitraire à calculer pour l'ensemble (chaque
   * compte a son propre `profitTargetPercent`, voir `WalletManagement.tsx`).
   * Plutôt que d'inventer une formule, la ligne de repère devient optionnelle
   * et n'est dessinée que si un appelant fournit une vraie valeur.
   */
  referenceValue?: number;
  referenceLabel?: string;
}

export const EquityCurveChart: React.FC<EquityCurveChartProps> = ({ data, referenceValue, referenceLabel }) => (
  <ResponsiveContainer width="100%" height="100%">
    <AreaChart data={data} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
      <defs>
        <linearGradient id="colorCapital" x1="0" y1="0" x2="0" y2="1">
          <stop offset="5%" stopColor="#00E676" stopOpacity={0.25} />
          <stop offset="95%" stopColor="#00E676" stopOpacity={0.0} />
        </linearGradient>
      </defs>
      <CartesianGrid strokeDasharray="3 3" stroke="#1B2320" />
      <XAxis dataKey="label" stroke="#475569" fontSize={11} tickLine={false} axisLine={false} />
      <YAxis
        stroke="#475569"
        fontSize={11}
        tickLine={false}
        axisLine={false}
        tickFormatter={(val) => formatCurrency(Number(val))}
        domain={["auto", "auto"]}
      />
      <Tooltip
        contentStyle={{
          backgroundColor: "#0D1110",
          borderColor: "#1B2320",
          borderRadius: "12px",
          color: "#FFF",
          fontSize: "12px",
        }}
        formatter={(value: any) => [formatCurrency(Number(value)), "Capital"]}
      />
      {referenceValue !== undefined && (
        <ReferenceLine
          y={referenceValue}
          stroke="#00E676"
          strokeDasharray="4 4"
          label={{
            value: referenceLabel ?? formatCurrency(referenceValue),
            fill: "#00E676",
            fontSize: 10,
            position: "insideBottomLeft",
          }}
        />
      )}
      <Area
        type="monotone"
        dataKey="capital"
        stroke="#00E676"
        strokeWidth={2.5}
        fillOpacity={1}
        fill="url(#colorCapital)"
      />
    </AreaChart>
  </ResponsiveContainer>
);
