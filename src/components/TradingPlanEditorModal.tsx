import React, { useState, useEffect, useRef } from "react";
import { ClipboardList, X, Check, Plus, Trash2 } from "lucide-react";
import { TradingPlan, TradingPlanData, Setup } from "../types";
import { getTradingPlanStorageKey, normalizeTradingPlans, createEmptyPlan } from "../lib/planCompliance";
import { confirmDialog } from "../lib/confirmDialog";

interface TradingPlanEditorModalProps {
  isOpen: boolean;
  onClose: () => void;
  /**
   * Namespace la persistance par compte (même motif que `MindsetJournalModal`)
   * — email de l'élève côté élève, absent côté staff (clé partagée bureau,
   * inchangé). Sans ça, un poste partagé comparerait les trades de l'un au
   * plan de l'autre (voir `src/lib/planCompliance.ts`).
   */
  storageKey?: string;
  /**
   * Mode contrôlé : la valeur et sa persistance (serveur + cache local) sont
   * portées par l'appelant (`App.tsx`), pas par ce composant. Sans ces deux
   * props, le composant retombe sur son ancien comportement autonome
   * (lecture/écriture directe de `localStorage`).
   */
  plans?: TradingPlanData;
  onChange?: (plans: TradingPlanData) => void;
  /**
   * Vue Complète du coach : consultation seule, aucune saisie ni bouton
   * "Enregistrer"/"Nouveau plan"/suppression — les plans appartiennent à
   * l'élève, voir `saveTradingPlan` (`server/repositories.ts`), qui n'a pas
   * de route d'écriture côté staff.
   */
  readOnly?: boolean;
  /**
   * Setups de l'élève (module Setups, voir `SetupManagement.tsx`) — source du
   * multi-choix `authorizedSetups` de chaque plan. Vide côté bureau staff
   * (ses plans personnels ne sont pas reliés à une liste de setups).
   */
  setups?: Setup[];
}

/** `authorizedSetups` "A, B, C" -> `["A", "B", "C"]`, en filtrant les entrées vides. */
const parseAuthorizedSetups = (value: string): string[] =>
  value
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

const loadPlans = (storageKey?: string): TradingPlanData => {
  try {
    const saved = localStorage.getItem(getTradingPlanStorageKey(storageKey));
    return saved ? normalizeTradingPlans(JSON.parse(saved)) : [];
  } catch {
    return [];
  }
};

const inputClass =
  "w-full bg-[#0D1110] border border-[#1B2320] rounded-xl px-3.5 py-2.5 text-white text-sm focus:outline-none focus:border-[#00E676]/50 placeholder-slate-600 disabled:opacity-70 disabled:cursor-not-allowed";

const SESSIONS = ["Asie", "Londres", "New York"];

export const TradingPlanEditorModal: React.FC<TradingPlanEditorModalProps> = ({
  isOpen,
  onClose,
  storageKey,
  plans: controlledPlans,
  onChange,
  readOnly = false,
  setups = [],
}) => {
  // `onChange` est facultatif quand `readOnly` : la Vue Complète du coach
  // passe `plans` sans jamais avoir besoin d'écrire dessus.
  const isControlled = controlledPlans !== undefined;

  const [localPlans, setLocalPlans] = useState<TradingPlanData>(() => loadPlans(storageKey));
  const [showSaved, setShowSaved] = useState(false);
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);

  const plans = isControlled ? (controlledPlans as TradingPlanData) : localPlans;
  const setPlans = (update: TradingPlanData | ((prev: TradingPlanData) => TradingPlanData)) => {
    const next = typeof update === "function" ? (update as (p: TradingPlanData) => TradingPlanData)(plans) : update;
    if (isControlled) {
      onChange?.(next);
    } else {
      setLocalPlans(next);
    }
  };

  // Recharge depuis le stockage à chaque ouverture — au cas où un autre
  // onglet du même navigateur aurait modifié les plans entre-temps. Non
  // pertinent en mode contrôlé : la valeur vient déjà de l'état synchronisé
  // de l'appelant, toujours à jour.
  useEffect(() => {
    if (isOpen && !isControlled) setLocalPlans(loadPlans(storageKey));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, storageKey, isControlled]);

  // Sélectionne le premier plan à l'ouverture (ou reste sur `null` s'il n'y
  // en a aucun, pour afficher l'état vide).
  useEffect(() => {
    if (!isOpen) return;
    setSelectedPlanId((prev) => {
      if (prev && plans.some((p) => p.id === prev)) return prev;
      return plans[0]?.id ?? null;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, plans.length]);

  // Enregistrement automatique (500ms après la dernière frappe) — mode
  // non-contrôlé uniquement (en mode contrôlé, l'appelant gère déjà son
  // propre débounce de synchronisation). Un bouton "Enregistrer" explicite
  // existe en plus (voir `handleSaveNow` plus bas).
  const isFirstRun = useRef(true);
  useEffect(() => {
    if (!isOpen || isControlled) return;
    if (isFirstRun.current) {
      isFirstRun.current = false;
      return;
    }
    const timer = setTimeout(() => {
      try {
        localStorage.setItem(getTradingPlanStorageKey(storageKey), JSON.stringify(localPlans));
      } catch {
        // Quota dépassé ou navigation privée : rien à faire de plus ici.
      }
      setShowSaved(true);
      setTimeout(() => setShowSaved(false), 1500);
    }, 500);
    return () => clearTimeout(timer);
  }, [localPlans, isOpen, isControlled, storageKey]);

  useEffect(() => {
    if (isOpen) isFirstRun.current = true;
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSaveNow = () => {
    if (isControlled) {
      // La sauvegarde elle-même est déjà déclenchée par `onChange` à chaque
      // frappe (débounce porté par l'appelant) — ce bouton ne fait qu'offrir
      // le même retour visuel immédiat qu'en mode autonome.
      setShowSaved(true);
      setTimeout(() => setShowSaved(false), 1500);
      return;
    }
    try {
      localStorage.setItem(getTradingPlanStorageKey(storageKey), JSON.stringify(localPlans));
    } catch {
      // Quota dépassé ou navigation privée : rien à faire de plus ici.
    }
    setShowSaved(true);
    setTimeout(() => setShowSaved(false), 1500);
  };

  const activePlan = plans.find((p) => p.id === selectedPlanId) ?? null;

  const updateActivePlan = (updater: (p: TradingPlan) => TradingPlan) => {
    if (!activePlan) return;
    setPlans((prev) => prev.map((p) => (p.id === activePlan.id ? updater(p) : p)));
  };

  const handleAddPlan = () => {
    const fresh = createEmptyPlan(`Plan ${plans.length + 1}`);
    setPlans((prev) => [...prev, fresh]);
    setSelectedPlanId(fresh.id);
  };

  const handleDeletePlan = async (planId: string) => {
    const target = plans.find((p) => p.id === planId);
    if (!target) return;
    const ok = await confirmDialog(`Supprimer le plan « ${target.name} » ? Cette action est irréversible.`, {
      title: "Supprimer ce plan",
      confirmLabel: "Supprimer",
      danger: true,
    });
    if (!ok) return;
    setPlans((prev) => prev.filter((p) => p.id !== planId));
    if (selectedPlanId === planId) {
      setSelectedPlanId(null);
    }
  };

  const toggleSession = (session: string) => {
    updateActivePlan((p) => ({
      ...p,
      authorizedSessions: p.authorizedSessions.includes(session)
        ? p.authorizedSessions.filter((s) => s !== session)
        : [...p.authorizedSessions, session],
    }));
  };

  const authorizedSetupNames = activePlan ? parseAuthorizedSetups(activePlan.authorizedSetups) : [];
  /**
   * Coche/décoche un setup pour le plan actif — un setup ne peut appartenir
   * qu'à un seul plan à la fois : le cocher ici le retire silencieusement de
   * tout autre plan qui l'avait, pour qu'un trade ne se retrouve jamais à
   * cheval sur deux plans à la fois.
   */
  const toggleSetup = (name: string) => {
    if (!activePlan) return;
    const current = parseAuthorizedSetups(activePlan.authorizedSetups);
    const nowSelected = !current.includes(name);
    setPlans((prev) =>
      prev.map((p) => {
        if (p.id === activePlan.id) {
          const next = nowSelected ? [...current, name] : current.filter((s) => s !== name);
          return { ...p, authorizedSetups: next.join(", ") };
        }
        // Retire ce setup de tout autre plan qui l'aurait déjà, uniquement
        // quand on vient de le cocher ici (pas la peine si on le décoche).
        if (nowSelected) {
          const otherNames = parseAuthorizedSetups(p.authorizedSetups);
          if (otherNames.includes(name)) {
            return { ...p, authorizedSetups: otherNames.filter((s) => s !== name).join(", ") };
          }
        }
        return p;
      })
    );
  };

  /** Nom du plan (s'il y en a un) qui a déjà ce setup — pour l'afficher en grisé chez les autres. */
  const planOwningSetup = (name: string): string | null => {
    const owner = plans.find((p) => p.id !== activePlan?.id && parseAuthorizedSetups(p.authorizedSetups).includes(name));
    return owner?.name ?? null;
  };

  return (
    <div className="fixed inset-0 z-50 bg-[#0D1110]/80 backdrop-blur-md flex items-center justify-center p-4 font-sans">
      <div className="bg-[#111615] border border-[#1B2320] rounded-2xl max-w-4xl w-full my-8 shadow-2xl relative text-slate-100 max-h-[calc(100vh-4rem)] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="p-5 sm:p-6 border-b border-[#1B2320] flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-[#00E676]/10 text-[#00E676] border border-[#00E676]/20">
              <ClipboardList className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">
                {readOnly ? "Plans de trading" : "Mes plans de trading"}
              </h3>
              <p className="text-xs text-slate-400 flex items-center gap-1.5">
                {readOnly ? "Consultation seule — écrit par l'élève." : "Une règle par setup, ta discipline en un écran."}
                {!readOnly && (
                  <span
                    className={`transition-opacity duration-300 flex items-center gap-1 text-[#00E676] font-semibold ${
                      showSaved ? "opacity-100" : "opacity-0"
                    }`}
                  >
                    <Check className="w-3 h-3" /> Enregistré
                  </span>
                )}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg bg-[#1B2320] hover:bg-[#232D29] text-slate-400 hover:text-white transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {plans.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-4 p-10 text-center">
            <p className="text-sm text-slate-400 max-w-sm">
              {readOnly
                ? "L'élève n'a encore créé aucun plan de trading."
                : "Crée un premier plan pour définir tes règles de discipline — sessions, risque, setups autorisés."}
            </p>
            {!readOnly && (
              <button
                onClick={handleAddPlan}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#00E676] hover:bg-[#00c865] text-slate-950 font-extrabold text-xs shadow-lg shadow-[#00E676]/20"
              >
                <Plus className="w-4 h-4" /> Créer mon premier plan
              </button>
            )}
          </div>
        ) : (
          <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
            {/* Liste des plans */}
            <div className="md:w-56 shrink-0 border-b md:border-b-0 md:border-r border-[#1B2320] p-3 flex md:flex-col gap-1.5 overflow-x-auto md:overflow-y-auto">
              {plans.map((p) => (
                <div key={p.id} className="flex items-center gap-1 group shrink-0 md:shrink">
                  <button
                    onClick={() => setSelectedPlanId(p.id)}
                    className={`flex-1 text-left px-3 py-2 rounded-lg text-xs font-bold transition-all truncate ${
                      p.id === selectedPlanId
                        ? "bg-[#00E676]/15 border border-[#00E676] text-[#00E676]"
                        : "bg-[#0D1110] border border-[#1B2320] text-slate-300 hover:text-white"
                    }`}
                    title={p.name}
                  >
                    {p.name || "Sans nom"}
                  </button>
                  {!readOnly && (
                    <button
                      onClick={() => handleDeletePlan(p.id)}
                      className="p-1.5 rounded-lg text-slate-600 hover:text-rose-400 hover:bg-[#1B2320] opacity-0 group-hover:opacity-100 transition-all shrink-0"
                      title="Supprimer ce plan"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              ))}
              {!readOnly && (
                <button
                  onClick={handleAddPlan}
                  className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border border-dashed border-[#1B2320] text-slate-400 hover:text-[#00E676] hover:border-[#00E676]/40 text-xs font-bold shrink-0"
                >
                  <Plus className="w-3.5 h-3.5" /> Nouveau plan
                </button>
              )}
            </div>

            {/* Formulaire du plan sélectionné */}
            {activePlan && (
              <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-5 text-sm">
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1.5">Nom du plan</label>
                  <input
                    type="text"
                    value={activePlan.name}
                    onChange={(e) => updateActivePlan((p) => ({ ...p, name: e.target.value }))}
                    placeholder="ex : OPR Confluence"
                    className={inputClass}
                    disabled={readOnly}
                  />
                </div>

                {/* Sessions autorisées */}
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-2">Sessions autorisées</label>
                  <div className="flex flex-wrap gap-2">
                    {SESSIONS.map((session) => (
                      <button
                        key={session}
                        type="button"
                        disabled={readOnly}
                        onClick={() => toggleSession(session)}
                        className={`px-3.5 py-1.5 rounded-lg border text-xs font-bold transition-all disabled:cursor-not-allowed ${
                          activePlan.authorizedSessions.includes(session)
                            ? "bg-[#00E676]/15 border-[#00E676] text-[#00E676]"
                            : "bg-[#0D1110] border-[#1B2320] text-slate-400 hover:text-white"
                        }`}
                      >
                        {session}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Horaires / Actifs */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-300 mb-1.5">Horaires de trading</label>
                    <input
                      type="text"
                      value={activePlan.tradingHours}
                      onChange={(e) => updateActivePlan((p) => ({ ...p, tradingHours: e.target.value }))}
                      placeholder="ex : 09h–12h et 15h–18h"
                      className={inputClass}
                      disabled={readOnly}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-300 mb-1.5">Actifs suivis</label>
                    <input
                      type="text"
                      value={activePlan.trackedAssets}
                      onChange={(e) => updateActivePlan((p) => ({ ...p, trackedAssets: e.target.value }))}
                      placeholder="EUR/USD, XAU, NAS100, BTC..."
                      className={inputClass}
                      disabled={readOnly}
                    />
                  </div>
                </div>

                {/* Setups autorisés */}
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-2">
                    Setups autorisés{" "}
                    <span className="text-slate-600 font-normal">(un setup ne peut appartenir qu'à un seul plan)</span>
                  </label>
                  {setups.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      {setups.map((setup) => {
                        const owner = planOwningSetup(setup.name);
                        const isSelected = authorizedSetupNames.includes(setup.name);
                        return (
                          <button
                            key={setup.id}
                            type="button"
                            disabled={readOnly}
                            onClick={() => toggleSetup(setup.name)}
                            title={owner ? `Actuellement rattaché à « ${owner} »` : undefined}
                            className={`px-3.5 py-1.5 rounded-lg border text-xs font-bold transition-all disabled:cursor-not-allowed ${
                              isSelected
                                ? "bg-[#00E676]/15 border-[#00E676] text-[#00E676]"
                                : owner
                                ? "bg-[#0D1110] border-[#1B2320] text-slate-600"
                                : "bg-[#0D1110] border-[#1B2320] text-slate-400 hover:text-white"
                            }`}
                          >
                            {setup.name}
                            {owner && !isSelected && <span className="ml-1.5 text-[9px] italic">({owner})</span>}
                          </button>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="text-xs text-slate-500 bg-[#0D1110] border border-dashed border-[#1B2320] rounded-xl px-3.5 py-2.5">
                      {readOnly
                        ? "L'élève n'a encore défini aucun setup."
                        : "Décris d'abord tes setups dans l'onglet « Setups » pour pouvoir les autoriser ici."}
                    </p>
                  )}
                </div>

                {/* Risque / Nb trades / Perte max */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-300 mb-1.5">Risque par trade (%)</label>
                    <input
                      type="number"
                      step="0.1"
                      value={activePlan.riskPerTradePercent}
                      onChange={(e) => updateActivePlan((p) => ({ ...p, riskPerTradePercent: e.target.value }))}
                      placeholder="1"
                      className={`${inputClass} font-mono`}
                      disabled={readOnly}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-300 mb-1.5">Nb de trades / jour</label>
                    <input
                      type="number"
                      value={activePlan.maxTradesPerDay}
                      onChange={(e) => updateActivePlan((p) => ({ ...p, maxTradesPerDay: e.target.value }))}
                      placeholder="3"
                      className={`${inputClass} font-mono`}
                      disabled={readOnly}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-300 mb-1.5">Perte max / jour (%)</label>
                    <input
                      type="number"
                      step="0.1"
                      value={activePlan.maxDailyLossPercent}
                      onChange={(e) => updateActivePlan((p) => ({ ...p, maxDailyLossPercent: e.target.value }))}
                      placeholder="3"
                      className={`${inputClass} font-mono`}
                      disabled={readOnly}
                    />
                  </div>
                </div>

                {/* Conditions d'entrée / d'arrêt */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-300 mb-1.5">Conditions d'entrée</label>
                    <textarea
                      rows={3}
                      value={activePlan.entryConditions}
                      onChange={(e) => updateActivePlan((p) => ({ ...p, entryConditions: e.target.value }))}
                      placeholder="Ce qui doit être réuni pour entrer..."
                      className={`${inputClass} resize-none`}
                      disabled={readOnly}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-300 mb-1.5">Conditions d'arrêt (stop la journée)</label>
                    <textarea
                      rows={3}
                      value={activePlan.stopConditions}
                      onChange={(e) => updateActivePlan((p) => ({ ...p, stopConditions: e.target.value }))}
                      placeholder="Quand j'arrête : -3%, 2 pertes d'affilée, tilt..."
                      className={`${inputClass} resize-none`}
                      disabled={readOnly}
                    />
                  </div>
                </div>

                {/* Règles d'or */}
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1.5">Règles d'or / rappels</label>
                  <textarea
                    rows={3}
                    value={activePlan.goldenRules}
                    onChange={(e) => updateActivePlan((p) => ({ ...p, goldenRules: e.target.value }))}
                    placeholder="Ne jamais bouger mon stop. Pas de trade sur émotion. Respecter le plan."
                    className={`${inputClass} resize-none`}
                    disabled={readOnly}
                  />
                </div>
              </div>
            )}
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-5 sm:px-6 py-4 border-t border-[#1B2320] shrink-0">
          <button
            onClick={onClose}
            className="px-4 py-2.5 rounded-xl bg-[#1B2320] hover:bg-[#232D29] text-slate-300 font-bold text-xs"
          >
            Fermer
          </button>
          {!readOnly && plans.length > 0 && (
            <button
              onClick={handleSaveNow}
              className="px-5 py-2.5 rounded-xl bg-[#00E676] hover:bg-[#00c865] text-slate-950 font-extrabold text-xs shadow-lg shadow-[#00E676]/20 flex items-center gap-1.5"
            >
              <Check className="w-3.5 h-3.5" /> Enregistrer
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
