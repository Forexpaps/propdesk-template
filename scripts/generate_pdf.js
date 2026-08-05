import { jsPDF } from "jspdf";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const doc = new jsPDF({
  orientation: "portrait",
  unit: "mm",
  format: "a4",
});

const PAGE_WIDTH = 210;
const PAGE_HEIGHT = 297;
const MARGIN = 15;
const CONTENT_WIDTH = PAGE_WIDTH - 2 * MARGIN;

let y = 20;

function checkNewPage(neededHeight = 20) {
  if (y + neededHeight > PAGE_HEIGHT - MARGIN) {
    doc.addPage();
    y = 20;
    addHeaderFooter();
  }
}

function addHeaderFooter() {
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    // Header
    doc.setFillColor(17, 22, 21);
    doc.rect(0, 0, PAGE_WIDTH, 12, "F");
    doc.setTextColor(0, 230, 118);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.text("HORIZON SMC ACADEMY & TRADING OS — DOSSIER TECHNIQUE SAAS", MARGIN, 8);

    doc.setTextColor(150, 150, 150);
    doc.setFont("helvetica", "normal");
    doc.text(`Doc Ref: SMC-SAAS-2026-v2.5 | Page ${i} sur ${totalPages}`, PAGE_WIDTH - MARGIN, 8, { align: "right" });

    // Footer
    doc.setFillColor(17, 22, 21);
    doc.rect(0, PAGE_HEIGHT - 10, PAGE_WIDTH, 10, "F");
    doc.setTextColor(150, 150, 150);
    doc.setFontSize(7);
    doc.text("© 2026 Horizon Trading Technologies. Tous droits réservés. Confidentialité & Propriété Industrielle.", MARGIN, PAGE_HEIGHT - 4);
  }
}

// COVER / TITLE BANNER
doc.setFillColor(17, 22, 21); // #111615
doc.rect(MARGIN, y, CONTENT_WIDTH, 38, "F");

doc.setDrawColor(0, 230, 118); // #00E676 border
doc.setLineWidth(0.8);
doc.rect(MARGIN, y, CONTENT_WIDTH, 38, "S");

doc.setTextColor(0, 230, 118);
doc.setFont("helvetica", "bold");
doc.setFontSize(16);
doc.text("HORIZON TRADING OS & SMC ACADEMY", MARGIN + 6, y + 12);

doc.setTextColor(255, 255, 255);
doc.setFontSize(11);
doc.setFont("helvetica", "bold");
doc.text("Catalogue Complet des Fonctionnalités SaaS & Spécifications Tech", MARGIN + 6, y + 22);

doc.setTextColor(180, 180, 180);
doc.setFontSize(8);
doc.setFont("helvetica", "normal");
doc.text("Plateforme tout-en-un d'apprentissage, d'exécution disciplinée, de risk management et de coaching par IA.", MARGIN + 6, y + 30);

y += 46;

// SECTION WRAPPER FUNCTION
function renderSection(number, title, description, features) {
  checkNewPage(40);

  // Section Header
  doc.setFillColor(27, 35, 32); // #1B2320
  doc.rect(MARGIN, y, CONTENT_WIDTH, 10, "F");

  doc.setTextColor(0, 230, 118);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text(`MODULE ${number} : ${title.toUpperCase()}`, MARGIN + 4, y + 6.8);

  y += 13;

  // Description
  doc.setTextColor(60, 60, 60);
  doc.setFont("helvetica", "italic");
  doc.setFontSize(8.5);
  const descLines = doc.splitTextToSize(description, CONTENT_WIDTH - 4);
  doc.text(descLines, MARGIN + 2, y);
  y += descLines.length * 4.5 + 2;

  // Features Bullet Points
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);

  features.forEach((feat) => {
    checkNewPage(12);

    doc.setFillColor(0, 230, 118);
    doc.circle(MARGIN + 4, y - 1.2, 0.8, "F");

    doc.setTextColor(20, 20, 20);
    doc.setFont("helvetica", "bold");
    doc.text(`${feat.name} : `, MARGIN + 7, y);

    const titleWidth = doc.getTextWidth(`${feat.name} : `);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(70, 70, 70);

    const detailLines = doc.splitTextToSize(feat.desc, CONTENT_WIDTH - 12 - titleWidth);
    
    if (detailLines.length === 1) {
      doc.text(detailLines[0], MARGIN + 7 + titleWidth, y);
      y += 5.5;
    } else {
      doc.text(detailLines[0], MARGIN + 7 + titleWidth, y);
      y += 4.5;
      for (let i = 1; i < detailLines.length; i++) {
        checkNewPage(6);
        doc.text(detailLines[i], MARGIN + 7, y);
        y += 4.5;
      }
      y += 1;
    }
  });

  y += 4;
}

// MODULES DATA
const modules = [
  {
    number: "01",
    title: "Tableau de Bord & Analytics Synthétiques (Dashboard)",
    description: "Vue d'ensemble centralisée des métriques de performance de l'étudiant, synchronisée en temps réel avec le journal et les sessions de trading.",
    features: [
      { name: "Metrics Principaux (KPIs)", desc: "Calcul automatique du Win Rate (%), Profit Factor, PnL Total (€), Capital Actuel et Nombre Total de Trades exécutés." },
      { name: "Courbe de Capital Interactive (Equity Curve)", desc: "Graphique dynamique (Recharts) retraçant la croissance du capital trade par trade avec zones de drawdown." },
      { name: "Analyse par Session & Actif", desc: "Segmentation de la profitabilité par session boursière (Asian, London, NY) et par paires d'actifs (Forex, Gold, Indices)." },
      { name: "Ticker Live & Horloge des Marchés", desc: "Indicateur en temps réel de la session active et des principales paires d'actifs." },
    ],
  },
  {
    number: "02",
    title: "Journal de Trading Professionnel SMC & Exporation (Trading Journal)",
    description: "Système complet de journalisation des positions d'exécution avec capture visuelle, tagging technique, export de données et gestion de l'historique.",
    features: [
      { name: "Saisie Ultra-Complète de Position", desc: "Formulaire d'enregistrement : Paire, Direction (Long/Short), Prix d'entrée, Stop Loss, Take Profit, Taille du Lot, Date et Capture d'écran (Chart Screenshot)." },
      { name: "Ratio Risque/Rendement & PnL Automatiques", desc: "Calcul direct du ratio R:R (ex: 1:3.5) et du résultat financier net en Euros (€)." },
      { name: "Tagging des Confluences SMC", desc: "Identification des raisons d'entrée : Liquidity Sweep (BSL/SSL), Casse de structure (CHoCH/BOS), Order Block M15/H1, Imbalance (FVG) et Killzone." },
      { name: "Export CSV en 1 Clic", desc: "Fonctionnalité d'exportation de l'intégralité du journal de trading au format CSV avec métriques et notes." },
      { name: "Visionneuse HD de Captures de Chartes", desc: "Modal dédié d'agrandissement plein écran pour analyser les graphiques joints à chaque trade." },
      { name: "Filtres Dynamiques & Recherche", desc: "Filtrage multicritères par statut de trade (Gagnant, Perdant, En Cours), par instrument et par timeframe." },
    ],
  },
  {
    number: "03",
    title: "Audit de Trade & Coaching Virtuel par IA (AI Trade Review)",
    description: "Moteur d'intelligence artificielle basé sur Gemini 3.6 Flash effectuant une critique clinique et pédagogique de chaque trade.",
    features: [
      { name: "Scoring Tridimensionnel", desc: "Calcul de 3 notes sur 10 : Score Technique SMC, Score de Risk Management et Score de Discipline Émotionnelle." },
      { name: "Diagnostic Percutant", desc: "Diagnostic synthétique instantané identifiant les erreurs majeures (ex: entrée FOMO avant le sweep, SL trop étroit)." },
      { name: "Points Forts & Axes d'Amélioration", desc: "Recommandations concrètes générées sur-mesure pour corriger les mauvaises habitudes de trading." },
      { name: "Coach Virtuel Interactif", desc: "Possibilité de poser des questions directes à l'IA pour obtenir des explications approfondies sur des setups." },
    ],
  },
  {
    number: "04",
    title: "Calculateur de Position & Money Management (Risk Engine)",
    description: "Outil de précision algorithmique conçu pour éliminer toute erreur humaine dans la taille de lot et le risque en capital.",
    features: [
      { name: "Calcul Instantané des Lots", desc: "Détermination exacte de la taille de lot à passer (Forex, XAU/USD, NAS100, Crypto) selon le capital du compte (€) et le % de risque sélectionné (0.5%, 1%, 2%)." },
      { name: "Conversion Pips & Points SL/TP", desc: "Affichage de la distance précise du Stop Loss et Take Profit en Pips ou Points." },
      { name: "Visualisation Financière du Risque", desc: "Montant exact risqué en € versus gain potentiel théorique." },
      { name: "Export Rapide vers Journal", desc: "Bouton de copie rapide pour intégrer le calcul directement au journal de trading." },
    ],
  },
  {
    number: "05",
    title: "Checklist Pré-Trade & Trading Plan SMC (Discipline Matrix)",
    description: "Verrou de sécurité comportemental assurant le respect absolu du plan d'exécution SMC avant d'ouvrir un ordre sur MetaTrader / TradingView.",
    features: [
      { name: "Checklist de Conformité à 6 Critères", desc: "Validation point par point (Liquidity Sweep, Trend Alignment, Killzone Time, Risk < 1%, etc.)." },
      { name: "Jauge de Conformité Dynamique", desc: "Pourcentage de respect du plan actualisé en temps réel de 0% à 100%." },
      { name: "Verdict Visuel 'Feu Vert / Feu Rouge'", desc: "Autorisation explicite de prise de position uniquement si 100% des critères sont cochés." },
    ],
  },
  {
    number: "06",
    title: "Académie SMC & Parcours d'Apprentissage (Interactive Curriculum)",
    description: "Programme de formation structuré de Débutant à Master pour maîtriser la théorie et la pratique des Smart Money Concepts.",
    features: [
      { name: "4 Niveaux de Progression", desc: "Débutant (Bases & Money Management), Intermédiaire (Structure & Liquinité), Avancé (Order Blocks & FVG) et Master (Killzones & Algorithme IPDA)." },
      { name: "Leçons Riches & Schémas Techniques", desc: "Contenus théoriques illustrés de graphiques et cas pratiques." },
      { name: "Quiz de Validation", desc: "Système de questions-réponses interactif pour valider l'acquisition des compétences de chaque chapitre." },
    ],
  },
  {
    number: "07",
    title: "Simulateur Monte Carlo & Backtesting Replay (Advanced Simulator)",
    description: "Environnement d'entraînement immersif combinant des scénarios de replay historiques SMC et un moteur de projection Monte Carlo.",
    features: [
      { name: "Simulateur de Probabilités Monte Carlo", desc: "Algorithme simulant 50 trades à partir de votre Win Rate et R:R pour calculer l'espérance mathématique du compte." },
      { name: "Estimation de Réussite Prop Firm", desc: "Calcul de la probabilité de valider un challenge sans dépasser la limite de drawdown." },
      { name: "Scénarios de Replay SMC", desc: "Cas pratiques réels pour tester sa lecture du marché sans risquer de capital réel." },
      { name: "Score de Progression & XP", desc: "Attribution de points et de réputation selon l'exactitude des analyses." },
    ],
  },
  {
    number: "08",
    title: "Simulateur & Suivi Challenge Prop Firm (Prop Firm Rules Tracker)",
    description: "Module de contrôle pour réussir les évaluations et challenges des sociétés de capital (FTMO, FundedNext, Alpha Capital).",
    features: [
      { name: "Presets des Grandes Prop Firms", desc: "Configurations pré-paramétrées (FTMO 100k, FundedNext 50k, Alpha Capital 200k, Compte Réel)." },
      { name: "Contrôle du Max Daily & Total Drawdown", desc: "Suivi en temps réel de la limite de perte journalière (-5%) et maximale (-10%)." },
      { name: "Barre de Progression de l'Objectif (Profit Target)", desc: "Calcul de l'écart restant pour atteindre la cible de +8% ou +10%." },
      { name: "Alerte de Dépassement", desc: "Notification d'échec de compte si la limite de perte tolérée est atteinte." },
    ],
  },
  {
    number: "09",
    title: "Psychologie, Biofeedback & Radar Anti-Tilt (Mindset & Emotion Tracker)",
    description: "Outil de biofeedback sonore et d'auto-évaluation psychologique pour éradiquer le revenge trading et l'anxiété de marché.",
    features: [
      { name: "Diagnostic Émotionnel Pré-Session", desc: "Évaluation de l'état mental (Calme, Discipliné, Anxieux, Impulsif, Revenge Trading)." },
      { name: "Calculateur d'Indice de Risque de Tilt", desc: "Pourcentage de risque psychologique combinant sommeil, stress et état émotionnel." },
      { name: "Exercice de Respiration Diaphragmatique 4-7-8 avec Son Zen", desc: "Module interactif animé avec fréquences harmoniques 432Hz/528Hz pour stabiliser le rythme cardiaque." },
      { name: "Historique & Persistance des Check-ins", desc: "Sauvegarde locale continue de l'état émotionnel avant chaque session de trading." },
    ],
  },
  {
    number: "10",
    title: "Matrix & Audit de Confluence SMC IA (AI Setup Matrix)",
    description: "Grille d'évaluation technique automatique permettant d'attribuer une note de probabilité à tout setup avant exécution.",
    features: [
      { name: "Pondération des Confluences SMC", desc: "Attribution de points selon la présence de Sweep, CHoCH, OB, FVG, Killzone et HTF Trend." },
      { name: "Verdict Automatique", desc: "Classification du setup en 'Setup A+ Parfait', 'Setup B+ Valide' ou 'Setup Non Conforme'." },
      { name: "Transfert Direct vers le Journal", desc: "Bouton de validation pour enregistrer automatiquement le setup analysé dans le journal de trading." },
      { name: "Conseil de Dimensionnement de Risque", desc: "Recommandation d'ajustement du risque (ex: réduire à 0.5% sur Setup B+)." },
    ],
  },
  {
    number: "11",
    title: "Gamification, Badges & Profil Étudiant (Student Gamification)",
    description: "Moteur de motivation favorisant la régularité et la discipline par la récompense d'étapes de réussite.",
    features: [
      { name: "Système de Points d'Expérience (XP)", desc: "Gains d'XP au fil des leçons terminées et des trades appliqués au journal." },
      { name: "Collection de Badges & Trophées", desc: "Déblocage de réussites (ex: 'Discipliné Master', 'SMC Analyst', 'Prop Firm Passed')." },
      { name: "Profil Utilisateur Persistant", desc: "Sauvegarde locale et cloud des préférences, objectifs et historiques." },
    ],
  },
];

modules.forEach((mod) => {
  renderSection(mod.number, mod.title, mod.description, mod.features);
});

// Finalize PDF Header/Footer
addHeaderFooter();

// Output file path
const publicDir = path.join(__dirname, "../public");
if (!fs.existsSync(publicDir)) {
  fs.mkdirSync(publicDir, { recursive: true });
}

const outputPath = path.join(publicDir, "Fonctionnalites_Horizon_SMC.pdf");
const pdfBuffer = doc.output("arraybuffer");
fs.writeFileSync(outputPath, Buffer.from(pdfBuffer));

console.log(`✅ PDF généré avec succès dans : ${outputPath}`);
