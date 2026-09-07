import React, { useMemo, useState } from "react";
import { NotebookPen, X, Target } from "lucide-react";
import { Trade, TradingPlanData, WeeklyReview, ObjectifHebdoType } from "../types";
import {
  OBJECTIF_CATALOGUE,
  currentWeekStart,
  describeObjectif,
  evaluerObjectif,
  findReview,
  formatSemaine,
  nextWeekStart,
  previousWeekStart,
  reviewId,
  tradesDeLaSemaine,
} from "../lib/weeklyReview";

/**
 * Écriture de la revue d'une semaine.
 *
 * Une MODALE, pas un onglet : on écrit une revue une fois par semaine, et un
 * onglet resterait vide six jours sur sept. Même famille que
 * `TradingPlanEditorModal`, pour la même raison.
 */

/** Nombre de semaines proposées au sélecteur — de quoi rattraper un retard sans dérouler l'année entière. */
const SEMAINES_PROPOSEES = 8;

/** Les deux textes libres sont bornés côté client : ils partent dans une collection dont le payload est plafonné. */
const MAX_TEXTE = 2000;

const inputClass =
  "w-full bg-[#0D1110] border border-[#1B2320] rounded-xl px-3.5 py-2.5 text-white text-sm focus:outline-none focus:border-[#00E676]/50 placeholder-slate-600";

interface WeeklyReviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  trades: Trade[];
  plans: TradingPlanData;
  reviews: WeeklyReview[];
  onSave: (review: WeeklyReview) => void;
  /** Semaine ouverte à l'arrivée. Par défaut, la semaine écoulée. */
  semaineInitiale?: string;
}

/** Les `SEMAINES_PROPOSEES` derniers lundis, la semaine en cours en tête. */
function derniersLundis(reference: Date): string[] {
  const lundis: string[] = [currentWeekStart(reference)];
  let curseur = reference;
  for (let i = 1; i < SEMAINES_PROPOSEES; i += 1) {
    const precedent = previousWeekStart(curseur);
    lundis.push(precedent);
    curseur = new Date(`${precedent}T12:00:00`);
  }
  return lundis;
}

export const WeeklyReviewModal: React.FC<WeeklyReviewModalProps> = ({
  isOpen,
  onClose,
  trades,
  plans,
  reviews,
  onSave,
  semaineInitiale,
}) => {
  const maintenant = useMemo(() => new Date(), []);
  const semaines = useMemo(() => derniersLundis(maintenant), [maintenant]);
  const [semaine, setSemaine] = useState(semaineInitiale ?? previousWeekStart(maintenant));

  if (!isOpen) return null;

  // Clé de remontage : changer de semaine dans le sélecteur doit recharger les
  // champs depuis la revue de CETTE semaine. Sans ça, le texte de la semaine
  // précédente resterait affiché et repartirait sous une autre date.
  return (
    <FormulaireRevue
      key={semaine}
      semaine={semaine}
      semaines={semaines}
      onChangeSemaine={setSemaine}
      existante={findReview(reviews, semaine)}
      trades={trades}
      plans={plans}
      reviews={reviews}
      onSave={onSave}
      onClose={onClose}
      maintenant={maintenant}
    />
  );
};

interface FormulaireProps {
  semaine: string;
  semaines: string[];
  onChangeSemaine: (s: string) => void;
  existante?: WeeklyReview;
  trades: Trade[];
  plans: TradingPlanData;
  reviews: WeeklyReview[];
  onSave: (review: WeeklyReview) => void;
  onClose: () => void;
  maintenant: Date;
}

const FormulaireRevue: React.FC<FormulaireProps> = ({
  semaine,
  semaines,
  onChangeSemaine,
  existante,
  trades,
  plans,
  reviews,
  onSave,
  onClose,
  maintenant,
}) => {
  const [ceQuiAMarche, setCeQuiAMarche] = useState(existante?.ceQuiAMarche ?? "");
  const [ceQuiNaPasMarche, setCeQuiNaPasMarche] = useState(existante?.ceQuiNaPasMarche ?? "");
  const [typeObjectif, setTypeObjectif] = useState<ObjectifHebdoType | "">(existante?.objectif?.type ?? "");
  const [valeurObjectif, setValeurObjectif] = useState<string>(
    existante?.objectif ? String(existante.objectif.valeur) : ""
  );

  const entreeCatalogue = OBJECTIF_CATALOGUE.find((e) => e.type === typeObjectif);
  const tradesSemaine = tradesDeLaSemaine(trades, semaine);

  // Verdict de l'objectif posé la semaine PRÉCÉDENTE et visant celle-ci : le
  // seul endroit où la boucle se referme. Recalculé, jamais lu d'un stockage.
  const objectifEchu = reviews
    .map((r) => r.objectif)
    .find((o) => o && o.cibleWeekStart === semaine);
  const planIds = useMemo(() => new Set(plans.map((p) => p.id)), [plans]);
  const verdictEchu = objectifEchu ? evaluerObjectif(objectifEchu, tradesSemaine, planIds) : null;

  const enregistrer = () => {
    const maintenantIso = new Date().toISOString();
    // La cible d'un objectif est TOUJOURS la semaine qui suit celle relue —
    // on ne se fixe pas un objectif pour une semaine déjà écoulée. Elle est
    // STOCKÉE avec l'objectif : si la définition de « semaine » changeait, une
    // revue ancienne doit rester jugée sur la fenêtre qui lui a été annoncée.
    const cible = nextWeekStart(semaine);

    const valeur = Number(valeurObjectif);
    const objectif =
      entreeCatalogue && typeObjectif
        ? {
            type: typeObjectif,
            // Un type sans seuil (« aucune erreur taguée ») stocke 0 : la
            // valeur n'est jamais lue par son évaluateur.
            valeur: entreeCatalogue.defaut === null ? 0 : Number.isFinite(valeur) && valeur > 0 ? valeur : entreeCatalogue.defaut,
            cibleWeekStart: cible,
          }
        : null;

    onSave({
      id: reviewId(semaine),
      weekStart: semaine,
      ceQuiAMarche: ceQuiAMarche.slice(0, MAX_TEXTE),
      ceQuiNaPasMarche: ceQuiNaPasMarche.slice(0, MAX_TEXTE),
      objectif,
      createdAt: existante?.createdAt ?? maintenantIso,
      updatedAt: maintenantIso,
    });
    onClose();
  };

  const semaineEnCours = semaine === currentWeekStart(maintenant);

  return (
    <div className="fixed inset-0 z-50 bg-[#0D1110]/80 backdrop-blur-md flex items-center justify-center p-4 font-sans">
      <div className="bg-[#111615] border border-[#1B2320] rounded-2xl max-w-2xl w-full my-8 shadow-2xl relative text-slate-100 max-h-[calc(100vh-4rem)] flex flex-col overflow-hidden">
        <div className="p-5 sm:p-6 border-b border-[#1B2320] flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-[#00E676]/10 text-[#00E676] border border-[#00E676]/20">
              <NotebookPen className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">Revue de la semaine</h3>
              <p className="text-xs text-slate-400">
                Ce que tu écris, et l'objectif que le journal vérifiera tout seul.
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

        <div className="overflow-y-auto px-5 sm:px-6 py-5 space-y-5">
          <div className="space-y-1.5">
            <label className="text-[9px] uppercase tracking-wider text-slate-500 font-bold">Semaine relue</label>
            <select
              value={semaine}
              onChange={(e) => onChangeSemaine(e.target.value)}
              className={inputClass}
            >
              {semaines.map((s) => (
                <option key={s} value={s}>
                  {formatSemaine(s)}
                  {s === currentWeekStart(maintenant) ? " (en cours)" : ""}
                  {findReview(reviews, s) ? " · déjà écrite" : ""}
                </option>
              ))}
            </select>
            <p className="text-[10px] text-slate-500">
              {tradesSemaine.length} trade{tradesSemaine.length > 1 ? "s" : ""} sur cette semaine
              {semaineEnCours && " · semaine encore en cours"}
            </p>
          </div>

          {/* Verdict de l'objectif qui visait cette semaine — remonté tout en
              haut : c'est la seule chose que le trader ne peut pas savoir sans
              l'application. */}
          {objectifEchu && verdictEchu && (
            <div
              className={`rounded-xl border p-4 space-y-1 ${
                verdictEchu.verdict === "atteint"
                  ? "border-[#00E676]/30 bg-[#00E676]/5"
                  : verdictEchu.verdict === "manque"
                  ? "border-rose-500/30 bg-rose-500/5"
                  : "border-[#1B2320] bg-[#0D1110]"
              }`}
            >
              <div className="flex items-center gap-2">
                <Target
                  className={`w-4 h-4 ${
                    verdictEchu.verdict === "atteint"
                      ? "text-[#00E676]"
                      : verdictEchu.verdict === "manque"
                      ? "text-rose-400"
                      : "text-slate-500"
                  }`}
                />
                <span className="text-xs font-bold text-white">
                  {verdictEchu.verdict === "atteint"
                    ? "Objectif tenu"
                    : verdictEchu.verdict === "manque"
                    ? "Objectif manqué"
                    : "Objectif non vérifiable"}
                </span>
              </div>
              <p className="text-xs text-slate-300">{describeObjectif(objectifEchu)}</p>
              <p className="text-[11px] text-slate-500">{verdictEchu.constat}</p>
            </div>
          )}

          <div className="space-y-1.5">
            <label className="text-[9px] uppercase tracking-wider text-slate-500 font-bold">Ce qui a marché</label>
            <textarea
              value={ceQuiAMarche}
              onChange={(e) => setCeQuiAMarche(e.target.value.slice(0, MAX_TEXTE))}
              rows={4}
              maxLength={MAX_TEXTE}
              placeholder="Ce que tu veux refaire la semaine prochaine..."
              className={inputClass}
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-[9px] uppercase tracking-wider text-slate-500 font-bold">
              Ce qui n'a pas marché
            </label>
            <textarea
              value={ceQuiNaPasMarche}
              onChange={(e) => setCeQuiNaPasMarche(e.target.value.slice(0, MAX_TEXTE))}
              rows={4}
              maxLength={MAX_TEXTE}
              placeholder="Ce que tu ne veux plus revoir..."
              className={inputClass}
            />
          </div>

          <div className="space-y-2 pt-1 border-t border-[#1B2320]">
            <div className="pt-3">
              <label className="text-[9px] uppercase tracking-wider text-slate-500 font-bold">
                Objectif pour la semaine suivante
              </label>
              {/* Liste fermée, et c'est le point : le journal ne peut vérifier
                  que ce qu'il sait mesurer sur des données déjà saisies. Un
                  objectif écrit librement serait invérifiable, donc jamais
                  confronté aux faits — exactement ce que ce module corrige. */}
              <p className="text-[10px] text-slate-500 mt-0.5">
                Le journal le vérifiera tout seul sur tes trades. Le texte libre, lui, reste au-dessus.
              </p>
            </div>
            <select
              value={typeObjectif}
              onChange={(e) => {
                const type = e.target.value as ObjectifHebdoType | "";
                setTypeObjectif(type);
                const entree = OBJECTIF_CATALOGUE.find((x) => x.type === type);
                setValeurObjectif(entree?.defaut != null ? String(entree.defaut) : "");
              }}
              className={inputClass}
            >
              <option value="">— Aucun objectif cette semaine —</option>
              {OBJECTIF_CATALOGUE.map((e) => (
                <option key={e.type} value={e.type}>
                  {e.label}
                </option>
              ))}
            </select>

            {entreeCatalogue?.defaut !== null && entreeCatalogue !== undefined && (
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min={0}
                  step="any"
                  value={valeurObjectif}
                  onChange={(e) => setValeurObjectif(e.target.value)}
                  className={`${inputClass} max-w-[8rem]`}
                />
                <span className="text-xs text-slate-400">{entreeCatalogue.unite}</span>
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 px-5 sm:px-6 py-4 border-t border-[#1B2320] shrink-0">
          <button
            onClick={onClose}
            className="px-4 py-2.5 rounded-xl bg-[#1B2320] hover:bg-[#232D29] text-slate-300 font-bold text-xs"
          >
            Fermer
          </button>
          <button
            onClick={enregistrer}
            className="px-5 py-2.5 rounded-xl bg-[#00E676] hover:bg-[#00c865] text-slate-950 font-extrabold text-xs shadow-lg shadow-[#00E676]/20"
          >
            {existante ? "Mettre à jour la revue" : "Enregistrer la revue"}
          </button>
        </div>
      </div>
    </div>
  );
};
