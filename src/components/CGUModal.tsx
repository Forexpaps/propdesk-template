import React from "react";
import { FileText, X } from "lucide-react";

interface CGUModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const SectionTitle: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <h4 className="text-sm font-bold text-white mt-5 mb-1.5 first:mt-0">{children}</h4>
);

const P: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <p className="text-xs text-slate-400 leading-relaxed mb-2">{children}</p>
);

export const CGUModal: React.FC<CGUModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-[#0D1110]/80 backdrop-blur-md flex items-center justify-center p-4 font-sans">
      <div className="bg-[#111615] border border-[#1B2320] rounded-2xl max-w-2xl w-full my-8 shadow-2xl relative text-slate-100 max-h-[calc(100vh-4rem)] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="p-5 sm:p-6 border-b border-[#1B2320] flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-[#00E676]/10 text-[#00E676] border border-[#00E676]/20">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">Conditions Générales d'Utilisation</h3>
              <p className="text-xs text-slate-400">Plateforme PropDesk — Version en vigueur au 20 août 2026</p>
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
          <SectionTitle>1. Objet</SectionTitle>
          <P>
            Les présentes Conditions Générales d'Utilisation (« CGU ») régissent l'accès et l'utilisation de la
            plateforme PropDesk (« la Plateforme »), éditée par Thomas Gauthey, entrepreneur individuel exerçant sous
            le régime de la micro-entreprise. Toute utilisation de la Plateforme implique l'acceptation sans réserve
            des présentes CGU.
          </P>

          <SectionTitle>2. Accès à la Plateforme</SectionTitle>
          <P>
            L'accès à la Plateforme est strictement réservé aux personnes bénéficiant d'un accompagnement en cours et
            aux comptes autorisés par l'éditeur. L'accès est fourni dans le cadre de la prestation souscrite et pour
            sa seule durée. Il est personnel, nominatif, non cessible et non transférable.
          </P>

          <SectionTitle>3. Compte et identifiants</SectionTitle>
          <P>
            L'utilisateur est responsable de la confidentialité de ses identifiants et de toute activité réalisée
            depuis son compte. Il s'engage à choisir un mot de passe robuste, à ne pas le partager, et à signaler
            sans délai toute utilisation non autorisée de son compte à{" "}
            <a href="mailto:th.gauthey99@gmail.com" className="text-[#00E676]">
              th.gauthey99@gmail.com
            </a>
            .
          </P>

          <SectionTitle>4. Utilisation conforme</SectionTitle>
          <P>L'utilisateur s'engage à un usage strictement personnel de la Plateforme. Sont notamment interdits :</P>
          <P>
            — le partage, la diffusion, la revente ou la mise à disposition de tout ou partie des contenus ;<br />
            — l'extraction, la copie ou l'enregistrement des vidéos et supports pédagogiques ;<br />
            — toute tentative de contournement des mesures de sécurité ou d'accès à des données d'autres
            utilisateurs ;<br />
            — tout usage détournant la Plateforme de sa finalité pédagogique.
          </P>

          <SectionTitle>5. Propriété intellectuelle</SectionTitle>
          <P>
            L'ensemble des contenus de la Plateforme (vidéos, supports, méthodes, outils, textes, visuels) sont la
            propriété exclusive de Thomas Gauthey et protégés par le Code de la propriété intellectuelle. Toute
            reproduction ou exploitation non autorisée constitue une contrefaçon.
          </P>

          <SectionTitle>6. Disponibilité et maintenance</SectionTitle>
          <P>
            La Plateforme est fournie « en l'état ». L'éditeur s'efforce d'en assurer la disponibilité mais ne
            garantit pas un fonctionnement continu et sans interruption. Des opérations de maintenance, mises à jour
            ou indisponibilités techniques peuvent survenir sans que la responsabilité de l'éditeur puisse être
            engagée.
          </P>

          <SectionTitle>7. Données personnelles</SectionTitle>
          <P>
            La Plateforme collecte et traite des données personnelles (adresse e-mail, mot de passe haché, photo de
            profil éventuelle, données saisies dans les outils). Les finalités, durées de conservation et modalités
            d'exercice de vos droits sont détaillées dans la Politique de confidentialité.
          </P>

          <SectionTitle>8. Nature éducative et avertissement sur les risques</SectionTitle>
          <P>
            Les contenus et outils de la Plateforme sont à visée strictement éducative. Ils ne constituent pas un
            conseil en investissement financier au sens de la réglementation AMF, ni une recommandation personnalisée
            d'achat ou de vente. Le trading comporte un risque élevé de perte en capital ; l'utilisateur reste seul
            responsable de ses décisions.
          </P>

          <SectionTitle>9. Suspension et résiliation d'accès</SectionTitle>
          <P>
            En cas de manquement aux présentes CGU (notamment partage de compte ou de contenus), l'éditeur peut
            suspendre ou résilier l'accès sans préavis ni remboursement. L'accès prend fin de plein droit au terme de
            l'accompagnement.
          </P>

          <SectionTitle>10. Responsabilité</SectionTitle>
          <P>
            La responsabilité de l'éditeur ne saurait être engagée en cas de pertes liées à l'activité de trading de
            l'utilisateur, d'interruption technique indépendante de sa volonté, ou de mauvaise utilisation de la
            Plateforme. Elle est en tout état de cause limitée au montant de la prestation payée.
          </P>

          <SectionTitle>11. Modification des CGU</SectionTitle>
          <P>
            L'éditeur se réserve le droit de modifier les présentes CGU à tout moment. Les CGU applicables sont celles
            en vigueur lors de l'utilisation de la Plateforme.
          </P>

          <SectionTitle>12. Droit applicable</SectionTitle>
          <P>
            Les présentes CGU sont soumises au droit français. Tout litige relève, à défaut d'accord amiable, de la
            compétence des tribunaux français.
          </P>

          <div className="mt-5 pt-4 border-t border-[#1B2320] text-[11px] text-slate-500">
            Dernière mise à jour : 20 août 2026 — Thomas Gauthey, entrepreneur individuel
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
