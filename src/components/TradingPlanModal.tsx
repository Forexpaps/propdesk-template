import React, { useState } from "react";
import { CheckSquare, ShieldCheck, AlertTriangle, Sparkles, Check, X, Flame } from "lucide-react";

interface TradingPlanModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const TradingPlanModal: React.FC<TradingPlanModalProps> = ({ isOpen, onClose }) => {
  const [checklist, setChecklist] = useState<{ [key: string]: boolean }>({
    bias: true,
    liquidity: false,
    fvg: false,
    ote: false,
    news: true,
    rr: true,
    risk: true,
  });

  if (!isOpen) return null;

  const items = [
    {
      id: "bias",
      title: "1. Tendance & Biais H4/D1 Clarifié",
      desc: "L'Order Flow Institutionnel est-il haussier ou baissier sur les unités de temps supérieures ?",
    },
    {
      id: "liquidity",
      title: "2. Sweep de Liquidité (Liquidity Sweep)",
      desc: "Les plus hauts/bas de la session asiatique ou de la veille ont-ils été purgés ?",
    },
    {
      id: "fvg",
      title: "3. Displacement & Fair Value Gap (FVG)",
      desc: "Y a-t-il eu une impulsion violente créant un déséquilibre (imbalance M5/M15) ?",
    },
    {
      id: "ote",
      title: "4. Zone d'Entrée OTE (61.8% - 78.6%)",
      desc: "Le prix est-il revenu retester un Order Block ou FVG dans la zone de discount/premium ?",
    },
    {
      id: "news",
      title: "5. Filtre Annonces Économiques (News)",
      desc: "Aucun rapport NFP, CPI ou FOMC prévu dans les 30 prochaines minutes ?",
    },
    {
      id: "rr",
      title: "6. Ratio Risque/Rendement ≥ 1:2",
      desc: "Le Take Profit visé offre-t-il au minimum le double du risque engagé ?",
    },
    {
      id: "risk",
      title: "7. Respect strict de la taille de lot (Max 1%)",
      desc: "Le risque total en euros ne dépasse pas 1% du capital financé Prop Firm.",
    },
  ];

  const totalChecked = Object.values(checklist).filter(Boolean).length;
  const isAllValid = totalChecked === items.length;

  const toggleItem = (id: string) => {
    setChecklist((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 font-sans">
      <div className="bg-[#111615] border border-[#1B2320] rounded-2xl max-w-xl w-full p-6 space-y-6 shadow-2xl relative text-slate-100">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#1B2320] pb-4">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
              <CheckSquare className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">Checklist Pre-Market & Plan SMC</h3>
              <p className="text-xs text-slate-400">Validez vos règles de trading institutionnel avant d'exécuter</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg bg-[#1B2320] hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Meter Gauge */}
        <div className="bg-[#0D1110] p-4 rounded-xl border border-[#1B2320] space-y-2">
          <div className="flex items-center justify-between text-xs font-bold">
            <span className="text-slate-300">Conformité au Plan SMC :</span>
            <span className={isAllValid ? "text-[#00E676]" : "text-amber-400"}>
              {totalChecked} / {items.length} Validé(s) ({Math.round((totalChecked / items.length) * 100)}%)
            </span>
          </div>

          <div className="w-full bg-[#111615] h-2.5 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-300 ${
                isAllValid
                  ? "bg-gradient-to-r from-[#00E676] to-teal-400"
                  : "bg-gradient-to-r from-amber-500 to-orange-400"
              }`}
              style={{ width: `${(totalChecked / items.length) * 100}%` }}
            />
          </div>
        </div>

        {/* Checklist Items */}
        <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
          {items.map((item) => {
            const checked = checklist[item.id];
            return (
              <div
                key={item.id}
                onClick={() => toggleItem(item.id)}
                className={`p-3 rounded-xl border transition-all cursor-pointer flex items-start gap-3 ${
                  checked
                    ? "bg-[#00E676]/10 border-[#00E676]/30 text-white"
                    : "bg-[#0D1110]/60 border-[#1B2320] text-slate-400 hover:border-slate-700"
                }`}
              >
                <div
                  className={`w-5 h-5 rounded-md border flex items-center justify-center shrink-0 mt-0.5 transition-colors ${
                    checked
                      ? "bg-[#00E676] border-[#00E676] text-slate-950 font-bold"
                      : "border-slate-700 bg-[#111615]"
                  }`}
                >
                  {checked && <Check className="w-3.5 h-3.5" />}
                </div>

                <div className="space-y-0.5">
                  <div className={`text-xs font-bold ${checked ? "text-[#00E676]" : "text-slate-200"}`}>
                    {item.title}
                  </div>
                  <p className="text-[11px] text-slate-400 leading-snug">{item.desc}</p>
                </div>
              </div>
            );
          })}
        </div>

        {/* Status Verdict */}
        {isAllValid ? (
          <div className="p-3.5 rounded-xl bg-[#00E676]/10 border border-[#00E676]/30 text-xs text-[#00E676] flex items-center gap-2 font-bold">
            <ShieldCheck className="w-5 h-5 text-[#00E676] shrink-0" />
            <span>FEU VERT : Votre plan est à 100% conforme. Discipline maximale activée.</span>
          </div>
        ) : (
          <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-xs text-amber-300 flex items-center gap-2 font-medium">
            <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0" />
            <span>Attention : Validez l'intégralité des critères SMC avant de cliquer sur 'Order'.</span>
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between pt-2">
          <button
            onClick={() => {
              setChecklist({
                bias: false,
                liquidity: false,
                fvg: false,
                ote: false,
                news: false,
                rr: false,
                risk: false,
              });
            }}
            className="text-xs text-slate-500 hover:text-slate-300 underline"
          >
            Réinitialiser la liste
          </button>

          <button
            onClick={onClose}
            className="px-5 py-2.5 rounded-xl bg-[#00E676] hover:bg-[#00c865] text-slate-950 font-extrabold text-xs shadow-lg shadow-[#00E676]/20"
          >
            Fermer et Exécuter
          </button>
        </div>
      </div>
    </div>
  );
};
