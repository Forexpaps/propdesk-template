import React from "react";
import { Scale, X } from "lucide-react";

interface LegalNoticeModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const SectionTitle: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <h4 className="text-sm font-bold text-white mt-5 mb-1.5 first:mt-0">{children}</h4>
);

const P: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <p className="text-xs text-slate-400 leading-relaxed mb-2">{children}</p>
);

export const LegalNoticeModal: React.FC<LegalNoticeModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-[#0D1110]/80 backdrop-blur-md flex items-center justify-center p-4 font-sans">
      <div className="bg-[#111615] border border-[#1B2320] rounded-2xl max-w-2xl w-full my-8 shadow-2xl relative text-slate-100 max-h-[calc(100vh-4rem)] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="p-5 sm:p-6 border-b border-[#1B2320] flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-[#00E676]/10 text-[#00E676] border border-[#00E676]/20">
              <Scale className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">Mentions Légales</h3>
              <p className="text-xs text-slate-400">Accompagnement Trading 1-to-1 — Version en vigueur au 19 août 2026</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg bg-[#1B2320] hover:bg-[#232D29] text-slate-400 hover:text-white transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 sm:p-6">
          <SectionTitle>1. Éditeur du site / de l'offre</SectionTitle>
          <P>
            Thomas Gauthey — Auto-entrepreneur
            <br />
            SIRET : en cours d'attribution
            <br />
            Adresse : 23 Rue Jean Eymar, 05000, Gap, France
            <br />
            E-mail :{" "}
            <a href="mailto:th.gauthey99@gmail.com" className="text-[#00E676]">
              th.gauthey99@gmail.com
            </a>
            <br />
            TVA non applicable — article 293 B du CGI.
          </P>

          <SectionTitle>2. Hébergement</SectionTitle>
          <P>
            Le site est hébergé par : Railway
            <br />
            Adresse de l'hébergeur : 548 Market St, PMB 68956, San Francisco, CA 94104, aux États-Unis
            <br />
            Site web de l'hébergeur :{" "}
            <a href="https://railway.com" target="_blank" rel="noreferrer" className="text-[#00E676]">
              railway.com
            </a>
          </P>

          <SectionTitle>3. Directeur de la publication</SectionTitle>
          <P>Thomas Gauthey, en qualité de responsable de l'activité.</P>

          <SectionTitle>4. Activité exercée</SectionTitle>
          <P>
            Thomas Gauthey propose des prestations de coaching et formation en trading à destination de particuliers
            souhaitant développer leurs compétences sur les marchés financiers.
          </P>
          <P>
            Cette activité est exercée à titre éducatif uniquement et ne constitue pas un service de conseil en
            investissement financier au sens de la directive MIF II ni de la réglementation AMF.
          </P>
          <P>
            Le Prestataire n'est pas enregistré en tant que Conseiller en Investissements Financiers (CIF) et ne
            fournit aucune recommandation personnalisée d'investissement.
          </P>

          <SectionTitle>5. Propriété intellectuelle</SectionTitle>
          <P>
            L'ensemble des contenus diffusés dans le cadre de l'accompagnement (vidéos, supports, méthodes, outils,
            textes, visuels) sont la propriété exclusive de Thomas Gauthey et sont protégés par les lois en vigueur
            relatives à la propriété intellectuelle.
          </P>
          <P>
            Toute reproduction, représentation, diffusion ou exploitation, totale ou partielle, sans autorisation
            écrite préalable est strictement interdite et constitue une contrefaçon sanctionnée par le Code de la
            propriété intellectuelle.
          </P>

          <SectionTitle>6. Protection des données personnelles (RGPD)</SectionTitle>
          <P>
            Conformément au Règlement Général sur la Protection des Données (RGPD — UE 2016/679) et à la loi
            Informatique et Libertés du 6 janvier 1978 modifiée, Thomas Gauthey collecte et traite les données
            personnelles suivantes : nom, prénom, adresse e-mail, données de paiement (traitées par le prestataire
            de paiement, non stockées directement).
          </P>
          <P>
            Finalité du traitement : gestion des commandes, envoi des accès, suivi de l'accompagnement, communication
            commerciale (avec consentement).
          </P>
          <P>
            Durée de conservation : les données sont conservées pendant la durée de la relation commerciale et
            jusqu'à 3 ans après la dernière interaction.
          </P>
          <P>
            Droits des personnes : conformément au RGPD, vous disposez d'un droit d'accès, de rectification,
            d'effacement, de portabilité et d'opposition au traitement de vos données. Pour exercer ces droits :{" "}
            <a href="mailto:th.gauthey99@gmail.com" className="text-[#00E676]">
              th.gauthey99@gmail.com
            </a>
          </P>
          <P>
            Vous pouvez également introduire une réclamation auprès de la CNIL (
            <a href="https://www.cnil.fr" target="_blank" rel="noreferrer" className="text-[#00E676]">
              www.cnil.fr
            </a>
            ) si vous estimez que vos droits ne sont pas respectés.
          </P>

          <SectionTitle>7. Cookies</SectionTitle>
          <P>
            Le site / la page de vente peut utiliser des cookies à des fins de mesure d'audience et de bon
            fonctionnement technique. Cookies utilisés : cookies techniques, finalité « bon fonctionnement du site »,
            durée « session ».
          </P>
          <P>
            Conformément à la réglementation en vigueur, votre consentement est recueilli avant tout dépôt de cookie
            non essentiel.
          </P>

          <SectionTitle>8. Liens hypertextes</SectionTitle>
          <P>
            Thomas Gauthey ne saurait être tenu responsable du contenu des sites tiers vers lesquels des liens
            pourraient pointer depuis ses pages ou supports de communication.
          </P>

          <SectionTitle>9. Avertissement sur les risques financiers</SectionTitle>
          <P>
            Le trading et la spéculation sur les marchés financiers comportent un risque élevé de perte en capital.
            Les performances passées ne préjugent pas des performances futures.
          </P>
          <P>
            Les contenus proposés dans le cadre de l'accompagnement sont à visée strictement éducative. Ils ne
            constituent en aucun cas une incitation à investir ni un conseil financier personnalisé.
          </P>
          <P>Chaque utilisateur est seul responsable de ses décisions de trading.</P>

          <SectionTitle>10. Droit applicable</SectionTitle>
          <P>
            Les présentes mentions légales sont soumises au droit français. Tout litige relatif à leur interprétation
            ou application relèvera de la compétence des tribunaux français.
          </P>

          <div className="mt-5 pt-4 border-t border-[#1B2320] text-[11px] text-slate-500">
            Dernière mise à jour : 19 août 2026 — Thomas Gauthey, Auto-entrepreneur
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end px-5 sm:px-6 py-4 border-t border-[#1B2320] shrink-0">
          <button
            onClick={onClose}
            className="px-5 py-2.5 rounded-xl bg-[#00E676] hover:bg-[#00c865] text-slate-950 font-extrabold text-xs shadow-lg shadow-[#00E676]/20"
          >
            Fermer
          </button>
        </div>
      </div>
    </div>
  );
};
