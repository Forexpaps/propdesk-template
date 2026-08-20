import React, { useState } from "react";
import { Target, Plus, Pencil, Trash2, X } from "lucide-react";
import { Setup } from "../types";

const SectionHeader: React.FC<{ children: React.ReactNode; color?: string }> = ({
  children,
  color = "bg-[#00E676]",
}) => (
  <div className="flex items-center gap-2">
    <span className={`w-1 h-4 rounded-full ${color}`} />
    <h3 className="text-sm font-bold text-white">{children}</h3>
  </div>
);

interface SetupManagementProps {
  setups: Setup[];
  onAddSetup: (setup: Setup) => void;
  onUpdateSetup: (setup: Setup) => void;
  onDeleteSetup: (id: string) => void;
  /** Masque les actions d'ajout, d'édition et de suppression — Vue Complète du coach. */
  readOnly?: boolean;
}

const EMPTY_FORM = {
  name: "",
  description: "",
  entryConditions: "",
  exitConditions: "",
  timeframes: "",
  assets: "",
};

const inputClass =
  "w-full bg-[#0D1110] border border-[#1B2320] rounded-xl px-3.5 py-2.5 text-white text-sm focus:outline-none focus:border-[#00E676]/50 placeholder-slate-600";

export const SetupManagement: React.FC<SetupManagementProps> = ({
  setups,
  onAddSetup,
  onUpdateSetup,
  onDeleteSetup,
  readOnly = false,
}) => {
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingSetup, setEditingSetup] = useState<Setup | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  // Modale maison plutôt que `window.confirm()` — muet sur iOS en mode
  // application (icône ajoutée à l'écran d'accueil), même raisonnement que
  // `WalletManagement.tsx`.
  const [deleteConfirmSetup, setDeleteConfirmSetup] = useState<Setup | null>(null);

  const openCreate = () => {
    setEditingSetup(null);
    setForm(EMPTY_FORM);
    setIsFormOpen(true);
  };

  const openEdit = (setup: Setup) => {
    setEditingSetup(setup);
    setForm({
      name: setup.name,
      description: setup.description,
      entryConditions: setup.entryConditions,
      exitConditions: setup.exitConditions,
      timeframes: setup.timeframes,
      assets: setup.assets,
    });
    setIsFormOpen(true);
  };

  const closeForm = () => {
    setIsFormOpen(false);
    setEditingSetup(null);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) return;

    if (editingSetup) {
      onUpdateSetup({ ...editingSetup, ...form });
    } else {
      onAddSetup({ id: `setup-${Date.now()}`, ...form });
    }
    closeForm();
  };

  const confirmDelete = () => {
    if (!deleteConfirmSetup) return;
    onDeleteSetup(deleteConfirmSetup.id);
    setDeleteConfirmSetup(null);
  };

  return (
    <div className="space-y-6">
      <div className="bg-[#111615] p-6 rounded-xl border border-[#1B2320] flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="space-y-2">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#00E676]/10 text-[#00E676] border border-[#00E676]/20 text-xs font-mono font-bold">
            <Target className="w-3.5 h-3.5" /> Mes Stratégies de Trading
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">Setups</h1>
          <p className="text-slate-400 text-sm max-w-2xl">
            Décris chaque stratégie que tu utilises réellement — conditions d'entrée, de sortie, timeframes et
            actifs concernés. Ces setups deviennent le choix disponible dans le Journal de trading et dans les
            « Setups autorisés » de ton Plan de trading.
          </p>
        </div>

        {!readOnly && (
          <button
            onClick={openCreate}
            className="flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-[#00E676] hover:bg-[#00c865] text-slate-950 font-extrabold text-sm shadow-md transition-all shrink-0 cursor-pointer"
          >
            <Plus className="w-5 h-5" />
            <span>Ajouter un Setup</span>
          </button>
        )}
      </div>

      <SectionHeader>
        <span className="inline-flex items-center gap-2">
          <Target className="w-4 h-4 text-[#00E676]" /> Setups enregistrés ({setups.length})
        </span>
      </SectionHeader>

      {setups.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-[#1B2320] bg-[#111615] p-8 text-center text-sm text-slate-400">
          {readOnly
            ? "Aucun setup enregistré par l'élève pour l'instant."
            : "Aucun setup pour l'instant — décris ta première stratégie."}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {setups.map((setup) => (
            <div key={setup.id} className="bg-[#111615] border border-[#1B2320] rounded-xl p-5 space-y-3">
              <div className="flex items-start justify-between gap-3">
                <h3 className="text-sm font-bold text-white">{setup.name}</h3>
                {!readOnly && (
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      onClick={() => openEdit(setup)}
                      title="Modifier ce setup"
                      className="p-1.5 rounded-lg bg-[#1B2320] hover:bg-[#232D29] text-slate-400 hover:text-white transition-colors"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => setDeleteConfirmSetup(setup)}
                      title="Supprimer ce setup"
                      className="p-1.5 rounded-lg bg-[#1B2320] hover:bg-rose-500/10 text-slate-400 hover:text-rose-400 transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
              </div>

              {setup.description && (
                <p className="text-xs text-slate-400 whitespace-pre-wrap">{setup.description}</p>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-[#1B2320] text-xs">
                {setup.entryConditions && (
                  <div>
                    <div className="text-[9px] uppercase tracking-wider text-slate-500 font-bold mb-1">
                      Conditions d'entrée
                    </div>
                    <p className="text-slate-300 whitespace-pre-wrap">{setup.entryConditions}</p>
                  </div>
                )}
                {setup.exitConditions && (
                  <div>
                    <div className="text-[9px] uppercase tracking-wider text-slate-500 font-bold mb-1">
                      Conditions de sortie
                    </div>
                    <p className="text-slate-300 whitespace-pre-wrap">{setup.exitConditions}</p>
                  </div>
                )}
              </div>

              {(setup.timeframes || setup.assets) && (
                <div className="flex flex-wrap gap-2 pt-1">
                  {setup.timeframes && (
                    <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-[#00E676]/10 border border-[#00E676]/20 text-[#00E676]">
                      {setup.timeframes}
                    </span>
                  )}
                  {setup.assets && (
                    <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-[#1B2320] border border-[#1B2320] text-slate-300">
                      {setup.assets}
                    </span>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Formulaire d'ajout / édition */}
      {isFormOpen && (
        <div className="fixed inset-0 z-50 bg-[#0D1110]/80 backdrop-blur-md flex items-center justify-center p-4 font-sans">
          <div className="bg-[#111615] border border-[#1B2320] rounded-2xl max-w-lg w-full my-8 shadow-2xl relative text-slate-100 max-h-[calc(100vh-4rem)] flex flex-col overflow-hidden">
            <div className="p-5 sm:p-6 border-b border-[#1B2320] flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-[#00E676]/10 text-[#00E676] border border-[#00E676]/20">
                  <Target className="w-5 h-5" />
                </div>
                <h3 className="text-base font-bold text-white">
                  {editingSetup ? "Modifier le setup" : "Nouveau setup"}
                </h3>
              </div>
              <button
                onClick={closeForm}
                className="p-1.5 rounded-lg bg-[#1B2320] hover:bg-[#232D29] text-slate-400 hover:text-white transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-4 text-sm">
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1.5">Nom du setup</label>
                <input
                  type="text"
                  required
                  autoFocus
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="ex : Breakout retest FVG H1"
                  className={inputClass}
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1.5">Description</label>
                <textarea
                  rows={3}
                  value={form.description}
                  onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                  placeholder="Résumé de la stratégie..."
                  className={`${inputClass} resize-none`}
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1.5">Conditions d'entrée</label>
                  <textarea
                    rows={3}
                    value={form.entryConditions}
                    onChange={(e) => setForm((f) => ({ ...f, entryConditions: e.target.value }))}
                    placeholder="Ce qui doit être réuni pour entrer..."
                    className={`${inputClass} resize-none`}
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1.5">Conditions de sortie</label>
                  <textarea
                    rows={3}
                    value={form.exitConditions}
                    onChange={(e) => setForm((f) => ({ ...f, exitConditions: e.target.value }))}
                    placeholder="Stop, take profit, invalidation..."
                    className={`${inputClass} resize-none`}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1.5">Timeframe(s)</label>
                  <input
                    type="text"
                    value={form.timeframes}
                    onChange={(e) => setForm((f) => ({ ...f, timeframes: e.target.value }))}
                    placeholder="H1, M15..."
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1.5">Actifs concernés</label>
                  <input
                    type="text"
                    value={form.assets}
                    onChange={(e) => setForm((f) => ({ ...f, assets: e.target.value }))}
                    placeholder="EUR/USD, XAU, NAS100..."
                    className={inputClass}
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-[#1B2320]">
                <button
                  type="button"
                  onClick={closeForm}
                  className="px-4 py-2.5 rounded-xl bg-[#1B2320] hover:bg-[#232D29] text-slate-300 font-bold text-xs"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-xl bg-[#00E676] hover:bg-[#00c865] text-slate-950 font-extrabold text-xs shadow-lg shadow-[#00E676]/20"
                >
                  {editingSetup ? "Enregistrer" : "Créer le setup"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Confirmation de suppression */}
      {deleteConfirmSetup && (
        <div className="fixed inset-0 z-50 bg-[#0D1110]/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-[#111615] border border-[#1B2320] rounded-xl max-w-sm w-full p-6 space-y-5 shadow-2xl">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-rose-500/10 shrink-0">
                <Trash2 className="w-5 h-5 text-rose-400" />
              </div>
              <h3 className="text-base font-bold text-white">Supprimer ce setup ?</h3>
            </div>
            <p className="text-xs text-slate-400">
              Supprimer « <span className="text-white font-bold">{deleteConfirmSetup.name}</span> » ? Les trades
              qui le référencent déjà garderont son nom tel quel. Cette action est irréversible.
            </p>
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                onClick={() => setDeleteConfirmSetup(null)}
                className="px-4 py-2.5 rounded-xl bg-[#1B2320] hover:bg-[#232D29] text-slate-300 font-bold text-xs"
              >
                Annuler
              </button>
              <button
                onClick={confirmDelete}
                className="px-4 py-2.5 rounded-xl bg-rose-500 hover:bg-rose-400 text-white font-bold text-xs"
              >
                Supprimer définitivement
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
