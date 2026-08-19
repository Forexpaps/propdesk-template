import React, { Suspense, useState } from "react";
import { ChevronDown, ChevronUp, NotebookPen, Plus, Trash2 } from "lucide-react";
import { CoachingSessionNote } from "../types";
import { computeSessionGlobalNote } from "../lib/coachingSessionStats";

/**
 * `StudentEvolutionChart` importé via `React.lazy` — voir ce fichier pour le
 * détail du piège Rollup, le même import statique/dynamique mélangé y
 * annulerait l'isolation de `recharts`.
 */
const StudentEvolutionChart = React.lazy(() =>
  import("./StudentEvolutionChart").then((m) => ({ default: m.StudentEvolutionChart }))
);

const LEGEND: { color: string; label: string }[] = [
  { color: "#00E676", label: "Discipline" },
  { color: "#3B82F6", label: "Performance" },
  { color: "#F59E0B", label: "Exécution du plan" },
  { color: "#A855F7", label: "Global" },
];

const SLIDER_FIELDS: { key: keyof Pick<CoachingSessionNote, "discipline" | "perceivedDifficulty" | "planExecution" | "performance">; label: string }[] = [
  { key: "discipline", label: "Discipline" },
  { key: "perceivedDifficulty", label: "Difficulté perçue" },
  { key: "planExecution", label: "Exécution du plan" },
  { key: "performance", label: "Performance" },
];

interface StudentEvolutionSectionProps {
  sessions: CoachingSessionNote[];
  /** Absent => lecture seule : pas de sliders actifs, pas d'ajout/suppression. */
  onChange?: (sessions: CoachingSessionNote[]) => void;
}

/**
 * Suivi d'évolution de l'élève au fil des sessions de coaching : graphique
 * (Discipline/Performance/Exécution du plan/Global) + notes de session
 * détaillées, cochables en accordéon. Un seul composant pour les deux
 * contextes (fiche édition ET fiche lecture seule) — `onChange` absent bascule
 * automatiquement tout le rendu en lecture seule, pour ne jamais faire
 * diverger les deux vues.
 */
export const StudentEvolutionSection: React.FC<StudentEvolutionSectionProps> = ({ sessions, onChange }) => {
  const readOnly = !onChange;
  const [openId, setOpenId] = useState<string | null>(sessions[sessions.length - 1]?.id ?? null);

  const handleAdd = () => {
    if (!onChange) return;
    const newSession: CoachingSessionNote = {
      id: `session-${Date.now()}`,
      label: `Coaching ${sessions.length + 1}`,
      date: new Date().toLocaleDateString("fr-FR", { day: "2-digit", month: "short" }),
      notes: "",
      discipline: 5,
      perceivedDifficulty: 5,
      planExecution: 5,
      performance: 5,
    };
    onChange([...sessions, newSession]);
    setOpenId(newSession.id);
  };

  const handleUpdate = (id: string, patch: Partial<CoachingSessionNote>) => {
    if (!onChange) return;
    onChange(sessions.map((s) => (s.id === id ? { ...s, ...patch } : s)));
  };

  const handleDelete = (id: string) => {
    if (!onChange) return;
    onChange(sessions.filter((s) => s.id !== id));
  };

  return (
    <div className="space-y-4">
      <div className="bg-[#0D1110] border border-[#1B2320] rounded-xl p-4 space-y-3">
        <div>
          <h4 className="text-sm font-bold text-white">Graphique d'évolution</h4>
          <p className="text-[11px] text-slate-500">Évolution de l'élève au fil des sessions de coaching</p>
        </div>

        <div className="flex flex-wrap items-center gap-4 text-[11px] text-slate-300">
          {LEGEND.map((item) => (
            <span key={item.label} className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: item.color }} />
              {item.label}
            </span>
          ))}
        </div>

        {sessions.length === 0 ? (
          <div className="h-32 flex items-center justify-center text-slate-500 text-xs italic">
            Aucune session de coaching enregistrée pour l'instant.
          </div>
        ) : (
          <div className="h-56">
            <Suspense
              fallback={
                <div className="h-full flex items-center justify-center text-slate-500 text-xs">
                  Chargement du graphique…
                </div>
              }
            >
              <StudentEvolutionChart sessions={sessions} />
            </Suspense>
          </div>
        )}
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h4 className="text-sm font-bold text-white">Notes de session</h4>
            <p className="text-[11px] text-slate-500">Blocs de notes et notation par session</p>
          </div>
          {!readOnly && (
            <button
              type="button"
              onClick={handleAdd}
              className="px-3 py-1.5 rounded-lg bg-[#00E676]/15 hover:bg-[#00E676]/25 text-[#00E676] border border-[#00E676]/30 font-bold text-[11px] flex items-center gap-1.5 shrink-0"
            >
              <Plus className="w-3.5 h-3.5" /> Ajouter une session
            </button>
          )}
        </div>

        {sessions.length === 0 ? (
          <div className="bg-[#0D1110] border border-[#1B2320] rounded-xl p-4 text-center text-slate-500 text-xs italic">
            Aucune note de session pour l'instant.
          </div>
        ) : (
          [...sessions].reverse().map((session) => (
            <SessionCard
              key={session.id}
              session={session}
              readOnly={readOnly}
              open={openId === session.id}
              onToggle={() => setOpenId(openId === session.id ? null : session.id)}
              onUpdate={(patch) => handleUpdate(session.id, patch)}
              onDelete={() => handleDelete(session.id)}
            />
          ))
        )}
      </div>
    </div>
  );
};

const SessionCard: React.FC<{
  session: CoachingSessionNote;
  readOnly: boolean;
  open: boolean;
  onToggle: () => void;
  onUpdate: (patch: Partial<CoachingSessionNote>) => void;
  onDelete: () => void;
}> = ({ session, readOnly, open, onToggle, onUpdate, onDelete }) => {
  const global = computeSessionGlobalNote(session);

  return (
    <div className="bg-[#111615] border border-[#1B2320] rounded-xl overflow-hidden">
      <button type="button" onClick={onToggle} className="w-full flex items-center justify-between px-4 py-3 text-left">
        <div className="flex items-center gap-3 min-w-0">
          <span className="w-8 h-8 rounded-lg bg-[#00E676]/10 border border-[#00E676]/30 flex items-center justify-center text-[#00E676] shrink-0">
            <NotebookPen className="w-4 h-4" />
          </span>
          <div className="min-w-0">
            <span className="font-bold text-white text-sm block truncate">
              {session.label} — {session.date}
            </span>
            <span className="text-[11px] text-slate-500">Note globale {global.toFixed(1)}/10</span>
          </div>
        </div>
        {open ? (
          <ChevronUp className="w-4 h-4 text-slate-400 shrink-0" />
        ) : (
          <ChevronDown className="w-4 h-4 text-slate-400 shrink-0" />
        )}
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-4 border-t border-[#1B2320] pt-4">
          <textarea
            rows={3}
            readOnly={readOnly}
            value={session.notes || ""}
            onChange={(e) => onUpdate({ notes: e.target.value })}
            placeholder="Notes de la session..."
            className="w-full bg-[#0D1110] border border-[#1B2320] rounded-lg p-3 text-white text-xs"
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {SLIDER_FIELDS.map(({ key, label }) => (
              <div key={key}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[10px] uppercase tracking-wide text-slate-500 font-bold">{label}</span>
                  <span className="text-[11px] font-bold text-[#00E676]">{session[key]}/10</span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={10}
                  step={1}
                  disabled={readOnly}
                  value={session[key]}
                  onChange={(e) => onUpdate({ [key]: Number(e.target.value) } as Partial<CoachingSessionNote>)}
                  className="w-full accent-[#00E676] disabled:opacity-60"
                />
              </div>
            ))}
          </div>

          {!readOnly && (
            <div className="flex justify-end">
              <button
                type="button"
                onClick={onDelete}
                className="px-3 py-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 font-bold text-[11px] flex items-center gap-1.5"
              >
                <Trash2 className="w-3.5 h-3.5" /> Supprimer
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
