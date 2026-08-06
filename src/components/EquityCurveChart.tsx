import React from "react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ReferenceLine,
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
}

export const EquityCurveChart: React.FC<EquityCurveChartProps> = ({ data }) => (
  <ResponsiveContainer width="100%" height="100%">
    <AreaChart data={data} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
      <defs>
        <linearGradient id="colorCapital" x1="0" y1="0" x2="0" y2="1">
          <stop offset="5%" stopColor="#00E676" stopOpacity={0.25} />
          <stop offset="95%" stopColor="#00E676" stopOpacity={0.0} />
        </linearGradient>
      </defs>
      <XAxis dataKey="label" stroke="#475569" fontSize={11} tickLine={false} axisLine={false} />
      <YAxis
        stroke="#475569"
        fontSize={11}
        tickLine={false}
        axisLine={false}
        tickFormatter={(val) => `${val} €`}
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
        formatter={(value: any) => [`${Number(value).toLocaleString("fr-FR")} €`, "Capital"]}
      />
      <ReferenceLine
        y={11500}
        stroke="#00E676"
        strokeDasharray="4 4"
        label={{
          value: "PALIER 11 500 € · ATTEINT",
          fill: "#00E676",
          fontSize: 10,
          position: "insideBottomLeft",
        }}
      />
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
