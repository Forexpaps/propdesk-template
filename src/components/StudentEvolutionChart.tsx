import React from "react";
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip } from "recharts";
import { CoachingSessionNote } from "../types";
import { computeSessionGlobalNote } from "../lib/coachingSessionStats";

/**
 * Courbe d'évolution de l'élève au fil des sessions de coaching (Discipline,
 * Performance, Exécution du plan, Global).
 *
 * Isolé dans son propre fichier pour la même raison qu'`EquityCurveChart.tsx` :
 * `recharts` est la plus grosse dépendance du client, à ne charger que quand
 * ce graphique est réellement affiché. `StudentEvolutionSection.tsx`
 * l'importe via `React.lazy` — **ne jamais importer ce fichier statiquement**,
 * sous peine de faire repartir `recharts` dans le bundle initial (voir
 * `EquityCurveChart.tsx` pour le détail du piège Rollup).
 */

interface StudentEvolutionChartProps {
  sessions: CoachingSessionNote[];
}

export const StudentEvolutionChart: React.FC<StudentEvolutionChartProps> = ({ sessions }) => {
  const data = sessions.map((s, i) => ({
    label: `C${i + 1}`,
    discipline: s.discipline,
    performance: s.performance,
    planExecution: s.planExecution,
    global: computeSessionGlobalNote(s),
  }));

  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={data} margin={{ top: 10, right: 20, left: -10, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#1B2320" />
        <XAxis dataKey="label" stroke="#475569" fontSize={11} tickLine={false} axisLine={false} />
        <YAxis
          domain={[0, 10]}
          ticks={[0, 2.5, 5, 7.5, 10]}
          stroke="#475569"
          fontSize={11}
          tickLine={false}
          axisLine={false}
        />
        <Tooltip
          contentStyle={{
            backgroundColor: "#0D1110",
            borderColor: "#1B2320",
            borderRadius: "12px",
            color: "#FFF",
            fontSize: "12px",
          }}
        />
        <Line type="monotone" dataKey="discipline" name="Discipline" stroke="#00E676" strokeWidth={2} dot={{ r: 3 }} />
        <Line type="monotone" dataKey="performance" name="Performance" stroke="#3B82F6" strokeWidth={2} dot={{ r: 3 }} />
        <Line
          type="monotone"
          dataKey="planExecution"
          name="Exécution du plan"
          stroke="#F59E0B"
          strokeWidth={2}
          dot={{ r: 3 }}
        />
        <Line type="monotone" dataKey="global" name="Global" stroke="#A855F7" strokeWidth={2.5} dot={{ r: 3 }} />
      </LineChart>
    </ResponsiveContainer>
  );
};
